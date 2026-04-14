/**
 * OpenClaw Gateway WebSocket Client
 * Módulo central para comunicación RPC + streaming con el Gateway de OpenClaw.
 * NUNCA usa CLI. Todo pasa por WebSocket hacia el Gateway.
 */

import { EventEmitter } from "events";
import { createHash, randomUUID } from "crypto";
import WebSocket from "ws";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const WS_TIMEOUT_MS = Number(process.env.OPENCLAW_GATEWAY_WS_TIMEOUT_MS || "30000");
const RPC_TIMEOUT_MS = Number(process.env.OPENCLAW_GATEWAY_RPC_TIMEOUT_MS || "30000");

// Deduplicación global de eventos (sobrevive a hot-reload de Next.js)
const GLOBAL_EVENT_CACHE_KEY = "__openclaw_health_events__";
if (!(GLOBAL_EVENT_CACHE_KEY in globalThis)) {
  (globalThis as Record<string, unknown>)[GLOBAL_EVENT_CACHE_KEY] = new Map<string, number>();
}
const globalProcessedEvents = (globalThis as unknown as Record<string, Map<string, number>>)[GLOBAL_EVENT_CACHE_KEY];

export interface GatewayModelChoice {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

export interface GatewayConfigSnapshot {
  config?: {
    agents?: {
      defaults?: {
        model?: {
          primary?: string;
        };
      };
    };
  };
}

export interface OpenClawSessionInfo {
  key: string;
  label?: string;
  channel?: string;
  peer?: string;
  createdAt?: string;
  lastMessageAt?: string;
}

export interface AgentDescriptor {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  identitySource?: string;
  workspace?: string;
  agentDir?: string;
  model?: string;
  bindings?: number;
  isDefault?: boolean;
  routes?: string[];
  status?: string;
}

export interface GatewayResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class OpenClawGatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private authenticated = false;
  private connecting: Promise<void> | null = null;
  private autoReconnect = true;
  private messageId = 0;
  private pendingRequests = new Map<
    string | number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly MAX_PROCESSED_EVENTS = 2000;

  constructor(
    private url: string = GATEWAY_URL,
    private token: string = GATEWAY_TOKEN
  ) {
    super();
    this.on("error", () => {});
  }

  // ───────────────────────── Connection ─────────────────────────

  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      this.cleanupSocket();

      const wsUrl = new URL(this.url);
      if (this.token) wsUrl.searchParams.set("token", this.token);

      console.log("[OpenClaw] Connecting to:", wsUrl.toString().replace(/token=[^&]+/, "token=***"));

      this.ws = new WebSocket(wsUrl.toString());

      const connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          this.ws?.close();
          reject(new Error("Connection timeout"));
        }
      }, WS_TIMEOUT_MS);

      this.ws.onopen = () => {
        console.log("[OpenClaw] WebSocket opened, waiting for challenge...");
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        const wasConnected = this.connected;
        this.connected = false;
        this.authenticated = false;
        this.connecting = null;
        this.emit("disconnected");
        console.log(`[OpenClaw] Disconnected (code: ${event.code}, reason: "${event.reason}")`);
        if (this.autoReconnect && wasConnected) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.emit("error", error);
        if (!this.connected) {
          this.connecting = null;
          reject(new Error("Failed to connect to OpenClaw Gateway"));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = typeof event.data === "string" ? event.data : event.data.toString();
          const data = JSON.parse(raw);
          this.handleIncoming(data, resolve, reject);
        } catch (err) {
          console.error("[OpenClaw] Failed to parse message:", err);
        }
      };
    });

    return this.connecting;
  }

  private cleanupSocket(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private handleIncoming(
    data: any,
    connectResolve: () => void,
    connectReject: (err: Error) => void
  ): void {
    const isRpcResponse = data.type === "res" || (data.id !== undefined && this.pendingRequests.has(data.id));

    if (!isRpcResponse) {
      const eventId = this.generateEventId(data);
      if (globalProcessedEvents.has(eventId)) {
        return;
      }
      globalProcessedEvents.set(eventId, Date.now());
      this.performCacheCleanup();
    }

    // Streaming events
    if (data.type === "event" && data.event === "agent" && data.payload) {
      this.emit("agent_event", data.payload);
    }
    if (data.type === "event" && data.event === "chat" && data.payload) {
      this.emit("chat_event", data.payload);
    }

    // Challenge-response auth
    if (data.type === "event" && data.event === "connect.challenge") {
      this.handleChallenge(data, connectResolve, connectReject);
      return;
    }

    // RPC / legacy responses
    if (data.type === "res" && data.id !== undefined) {
      const pending = this.pendingRequests.get(data.id);
      if (pending) {
        this.pendingRequests.delete(data.id);
        if (data.ok === false && data.error) {
          pending.reject(new Error(data.error.message || String(data.error)));
        } else {
          pending.resolve(data.payload);
        }
        return;
      }
    }

    if (data.method) {
      this.emit("notification", data);
      this.emit(data.method, data.params);
    }
  }

  private handleChallenge(
    data: any,
    connectResolve: () => void,
    connectReject: (err: Error) => void
  ): void {
    const nonce = data.payload?.nonce;
    const requestId = randomUUID();
    const response = {
      type: "req",
      id: requestId,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-health",
          version: "1.0.0",
          platform: typeof process !== "undefined" ? process.platform || "web" : "web",
          mode: "ui",
        },
        auth: { token: this.token },
        role: "operator",
        scopes: ["operator.admin"],
      },
    };

    this.pendingRequests.set(requestId, {
      resolve: () => {
        this.connected = true;
        this.authenticated = true;
        this.connecting = null;
        this.emit("connected");
        console.log("[OpenClaw] Authenticated successfully");
        connectResolve();
      },
      reject: (error: Error) => {
        this.connecting = null;
        this.ws?.close();
        connectReject(new Error(`Authentication failed: ${error.message}`));
      },
    });

    console.log("[OpenClaw] Sending challenge response (nonce:", nonce, ")");
    this.ws!.send(JSON.stringify(response));
  }

  // ───────────────────────── RPC ─────────────────────────

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || !this.connected || !this.authenticated) {
      throw new Error("Not connected to OpenClaw Gateway");
    }

    const id = randomUUID();
    const message = { type: "req", id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, RPC_TIMEOUT_MS);

      this.ws!.send(JSON.stringify(message));
    });
  }

  // ───────────────────────── Agent & Session helpers ─────────────────────────

  async listAgents(): Promise<AgentDescriptor[]> {
    const result = await this.call<{ agents?: AgentDescriptor[] }>("agents.list", {});
    if (result && typeof result === "object" && Array.isArray(result.agents)) {
      return result.agents;
    }
    return [];
  }

  async listSessions(): Promise<OpenClawSessionInfo[]> {
    return this.call<OpenClawSessionInfo[]>("sessions.list", {});
  }

  async getSessionHistory(sessionId: string): Promise<unknown[]> {
    return this.call<unknown[]>("sessions.history", { session_id: sessionId });
  }

  async createSession(channel: string, peer?: string): Promise<OpenClawSessionInfo> {
    return this.call<OpenClawSessionInfo>("sessions.create", { channel, peer });
  }

  async sendSessionMessage(sessionId: string, content: string): Promise<void> {
    await this.call("sessions.send", { session_id: sessionId, content });
  }

  async chatSend(sessionKey: string, message: string, extra?: Record<string, unknown>): Promise<void> {
    await this.call("chat.send", { sessionKey, message, ...extra });
  }

  async listModels(): Promise<GatewayModelChoice[]> {
    const result = await this.call<{ models?: GatewayModelChoice[] }>("models.list", {});
    return result?.models || [];
  }

  async getGatewayConfig(): Promise<GatewayConfigSnapshot> {
    const result = await this.call<unknown>("config.get", {});
    return (result as GatewayConfigSnapshot) || {};
  }

  async getStatus(): Promise<{ status: string; version?: string }> {
    const result = await this.call<unknown>("status", {});
    return (result as { status: string; version?: string }) || { status: "unknown" };
  }

  // ───────────────────────── Utilities ─────────────────────────

  private generateEventId(data: any): string {
    const canonical = JSON.stringify({
      type: data.type,
      seq: data.seq,
      runId: data.payload?.runId,
      stream: data.payload?.stream,
      event: data.event,
      payloadHash: data.payload
        ? createHash("sha256").update(JSON.stringify(data.payload)).digest("hex").slice(0, 16)
        : null,
    });
    return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  }

  private performCacheCleanup(): void {
    if (globalProcessedEvents.size > this.MAX_PROCESSED_EVENTS) {
      const entries = Array.from(globalProcessedEvents.entries()).sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - this.MAX_PROCESSED_EVENTS + 200);
      for (const [id] of toRemove) globalProcessedEvents.delete(id);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.autoReconnect) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.autoReconnect) return;
      console.log("[OpenClaw] Attempting reconnect...");
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, 10000);
  }

  forceReconnect(): void {
    this.cleanupSocket();
    this.connected = false;
    this.authenticated = false;
    this.connecting = null;
    this.pendingRequests.forEach(({ reject }) => reject(new Error("Connection reset")));
    this.pendingRequests.clear();
  }

  disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.connected = false;
    this.authenticated = false;
    this.connecting = null;
  }

  isConnected(): boolean {
    return this.connected && this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton
let clientInstance: OpenClawGatewayClient | null = null;

export function getOpenClawGatewayClient(): OpenClawGatewayClient {
  if (!clientInstance) {
    clientInstance = new OpenClawGatewayClient();
  }
  return clientInstance;
}
