import { NextResponse } from "next/server";
import { getOpenClawGatewayClient } from "@/lib/openclaw";

/**
 * GET /api/agents
 * Devuelve la lista de agentes disponibles en el Gateway de OpenClaw
 * vía API WebSocket (nunca CLI).
 */
export async function GET() {
  try {
    const client = getOpenClawGatewayClient();

    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch (err) {
        console.error("[API /agents] Failed to connect to Gateway:", err);
        return NextResponse.json(
          {
            agents: getMockAgents(),
            source: "mock",
            warning: "No se pudo conectar al Gateway. Mostrando datos de fallback.",
          },
          { status: 503 }
        );
      }
    }

    const agents = await client.listAgents();

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
    console.error("[API /agents] Error fetching agents:", error);

    return NextResponse.json({
      agents: getMockAgents(),
      source: "mock",
      warning: "Error conectando con Gateway, mostrando datos de ejemplo",
    });
  }
}

/**
 * Datos de ejemplo para desarrollo / fallback
 */
function getMockAgents() {
  return [
    {
      id: "agent-1",
      name: "Health Assistant",
      description: "Agente especializado en consultas de salud general",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["health", "advice", "monitoring"],
    },
    {
      id: "agent-2",
      name: "Medical Records",
      description: "Gestiona y analiza historiales médicos",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["records", "analysis", "reports"],
    },
    {
      id: "agent-3",
      name: "Symptom Checker",
      description: "Evaluación de síntomas y recomendaciones",
      status: "inactive",
      lastActive: new Date(Date.now() - 86400000).toISOString(),
      capabilities: ["symptoms", "diagnosis", "recommendations"],
    },
    {
      id: "agent-4",
      name: "Appointment Scheduler",
      description: "Programación y gestión de citas médicas",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["scheduling", "calendar", "reminders"],
    },
  ];
}
