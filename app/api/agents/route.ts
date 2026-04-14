import { NextResponse } from "next/server";
import { createOpenClawGatewayClient } from "@/lib/openclaw";

/**
 * GET /api/agents
 * Devuelve la lista de agentes disponibles en el Gateway de OpenClaw
 * vía API WebSocket (nunca CLI).
 * 
 * ENFOQUE SIN SINGLETON: Cada request crea una instancia COMPLETAMENTE NUEVA
 * del cliente para evitar cualquier problema de estado cacheado.
 */
export async function GET() {
  // Crear cliente FRESNO - no reuse nada de instancias anteriores
  const client = createOpenClawGatewayClient();

  try {
    console.log("[API /agents] Creating fresh WebSocket connection...");
    
    await client.connect();
    console.log("[API /agents] Connected successfully");
    
    console.log("[API /agents] Calling agents.list...");
    const agents = await client.listAgents();
    console.log(`[API /agents] Got ${agents.length} agents`);

    // Desconectar limpiamente
    client.disconnect();

    return NextResponse.json({
      agents: agents.map((a) => ({
        id: a.id,
        name: a.identityName || a.name || a.id,
        emoji: a.identityEmoji || "🤖",
        workspace: a.workspace,
        description: a.model,
        status: "active",
        lastActive: new Date().toISOString(),
        capabilities: [
          a.model,
          `${a.bindings || 0} binding${a.bindings === 1 ? "" : "s"}`,
          ...(a.isDefault ? ["default"] : []),
        ],
      })),
      source: "gateway-api",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[API /agents] Error:", errorMsg);
    
    // Asegurar desconexión en caso de error
    client.disconnect();

    return NextResponse.json({
      agents: getMockAgents(),
      source: "mock",
      warning: `Error conectando con Gateway: ${errorMsg}`,
    });
  }
}

/**
 * Datos de ejemplo para desarrollo / fallback
 */
function getMockAgents() {
  return [
    {
      id: "main",
      name: "Main Agent",
      description: "Agente principal de OpenClaw",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["orchestration", "main"],
    },
    {
      id: "rob_web",
      name: "Rob Web",
      description: "Agente especialista en desarrollo web",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["web", "frontend", "backend"],
    },
    {
      id: "rob_android",
      name: "Rob Android",
      description: "Agente especialista en desarrollo Android nativo",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["android", "mobile"],
    },
    {
      id: "rob_tester",
      name: "Rob Tester",
      description: "Agente especialista en testing y QA",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["testing", "qa"],
    },
  ];
}
