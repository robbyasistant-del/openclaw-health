import { NextResponse } from "next/server";
import { gatewayClient } from "@/lib/gateway/client";

/**
 * GET /api/agents
 * Devuelve la lista de agentes disponibles en el Gateway de OpenClaw
 */
export async function GET() {
  try {
    const result = await gatewayClient.listAgents();

    if (!result.success) {
      // Fallback silencioso a mock data si el CLI falla
      console.info("[API] /api/agents usando fallback local:", result.error);

      return NextResponse.json({
        agents: getMockAgents(),
        source: "mock",
        warning: "Listado de agentes en modo fallback: " + result.error,
      });
    }

    return NextResponse.json({
      agents: result.data || [],
      source: "openclaw-cli",
    });
  } catch (error) {
    console.error("[API] Error fetching agents:", error);
    
    return NextResponse.json({
      agents: getMockAgents(),
      source: "mock",
      warning: "Error conectando con Gateway, mostrando datos de ejemplo",
    });
  }
}

/**
 * Datos de ejemplo para desarrollo
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
