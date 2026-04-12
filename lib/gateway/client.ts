/**
 * OpenClaw Gateway API Client
 * Módulo central para interactuar con el Gateway de OpenClaw
 * Documentación: https://docs.openclaw.ai/gateway
 */

const GATEWAY_BASE_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:8080";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

interface GatewayConfig {
  baseUrl: string;
  token: string;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "error";
  lastActive?: string;
  capabilities?: string[];
}

interface GatewayResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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

      const response = await fetch(url, {
        ...options,
        headers,
      });

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
   */
  async listAgents(): Promise<GatewayResponse<Agent[]>> {
    return this.request<Agent[]>("/api/agents");
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
    return this.request("/api/status");
  }
}

// Export singleton instance
export const gatewayClient = new OpenClawGatewayClient();

// Export class for custom instances
export { OpenClawGatewayClient };
export type { Agent, GatewayResponse, GatewayConfig };
