/**
 * OpenClaw Gateway API Client
 * Módulo central para interactuar con el Gateway de OpenClaw
 * Documentación: https://docs.openclaw.ai/gateway
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const GATEWAY_BASE_URL = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const REQUEST_TIMEOUT_MS = 5000;

interface GatewayConfig {
  baseUrl: string;
  token: string;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  workspace?: string;
  status: "active" | "inactive" | "error";
  lastActive?: string;
  capabilities?: string[];
}

interface GatewayResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface OpenClawAgentJson {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  identitySource?: string;
  workspace: string;
  agentDir: string;
  model: string;
  bindings: number;
  isDefault?: boolean;
  routes?: string[];
}

class OpenClawGatewayClient {
  private config: GatewayConfig;

  constructor(config?: Partial<GatewayConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || GATEWAY_BASE_URL,
      token: config?.token || GATEWAY_TOKEN,
    };
  }

  /**
   * Realiza una petición al Gateway
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<GatewayResponse<T>> {
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

      if (this.config.token) {
        headers["Authorization"] = `Bearer ${this.config.token}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Obtiene la lista de agentes disponibles en el Gateway
   * Usa `openclaw agents list --json` como fuente real de agentes configurados.
   */
  async listAgents(): Promise<GatewayResponse<Agent[]>> {
    try {
      const { stdout } = await execAsync("openclaw agents list --json", {
        timeout: REQUEST_TIMEOUT_MS,
        windowsHide: true,
      });

      const rawAgents: OpenClawAgentJson[] = JSON.parse(stdout.trim() || "[]");

      const agents: Agent[] = rawAgents.map((a) => ({
        id: a.id,
        name: a.identityName || a.name || a.id,
        emoji: a.identityEmoji || "🤖",
        workspace: a.workspace,
        description: a.model,
        status: a.isDefault ? "active" : "active",
        lastActive: new Date().toISOString(),
        capabilities: [
          a.model,
          `${a.bindings} binding${a.bindings === 1 ? "" : "s"}`,
          ...(a.isDefault ? ["default"] : []),
        ],
      }));

      return { success: true, data: agents };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GatewayClient] Failed to list agents via CLI:", message);
      return {
        success: false,
        error: `No se pudo ejecutar 'openclaw agents list --json': ${message}`,
      };
    }
  }

  /**
   * Obtiene información de un agente específico
   */
  async getAgent(agentId: string): Promise<GatewayResponse<Agent>> {
    return this.request<Agent>(`/api/agents/${agentId}`);
  }

  /**
   * Envía un mensaje a un agente
   */
  async sendMessage(
    agentId: string,
    message: string,
    sessionId?: string
  ): Promise<GatewayResponse<{ response: string; sessionId: string }>> {
    return this.request(`/api/agents/${agentId}/message`, {
      method: "POST",
      body: JSON.stringify({
        message,
        sessionId,
      }),
    });
  }

  /**
   * Obtiene el estado del Gateway
   */
  async getStatus(): Promise<GatewayResponse<{ status: string; version: string }>> {
    return this.request("/");
  }
}

// Export singleton instance
export const gatewayClient = new OpenClawGatewayClient();

// Export class for custom instances
export { OpenClawGatewayClient };
export type { Agent, GatewayResponse, GatewayConfig };
