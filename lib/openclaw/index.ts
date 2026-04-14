/**
 * OpenClaw Central Module
 * Punto único de entrada para toda interacción con el Gateway de OpenClaw.
 * Arquitectura: UI/Frontend → API routes de Next.js → WebSocket/HTTP al Gateway.
 * NUNCA usa CLI.
 */

export {
  OpenClawGatewayClient,
  createOpenClawGatewayClient,
  getOpenClawGatewayClient,
  type GatewayResponse,
  type GatewayConfigSnapshot,
  type GatewayModelChoice,
  type OpenClawSessionInfo,
  type AgentDescriptor,
} from "./gateway";

export {
  complete,
  completeJSON,
  quickAnalyze,
  type LLMCompletionOptions,
  type LLMCompletionResult,
} from "./llm";
