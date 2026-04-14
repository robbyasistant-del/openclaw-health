import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const OPENCLAW_CONFIG_PATH = "C:\\Users\\robby\\.openclaw\\openclaw.json";

interface AgentConfig {
  id: string;
  name?: string;
  identity?: { emoji?: string };
  workspace?: string;
  agentDir?: string;
  subagents?: { allowAgents?: string[] };
}

/**
 * GET /api/agents
 * Devuelve la lista de agentes desde la configuración local de OpenClaw.
 * 
 * NOTA: Esta implementación lee directamente del archivo openclaw.json
 * en lugar de usar WebSocket, evitando problemas de scopes/permisos del Gateway.
 */
export async function GET() {
  try {
    console.log("[API /agents] Reading agents from local OpenClaw config...");
    
    const configRaw = await fs.readFile(OPENCLAW_CONFIG_PATH, "utf8");
    const config = JSON.parse(configRaw);
    
    // Extraer agentes de config.agents.list
    const agents: AgentConfig[] = config?.agents?.list || [];
    
    console.log(`[API /agents] Found ${agents.length} agents in config`);

    return NextResponse.json({
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name || a.id,
        emoji: a.identity?.emoji || "🤖",
        workspace: a.workspace,
        description: a.agentDir ? `Workspace: ${path.basename(a.workspace || "")}` : "System agent",
        status: "active",
        lastActive: new Date().toISOString(),
        capabilities: a.subagents?.allowAgents ? ["allows subagents", ...a.subagents.allowAgents] : [],
      })),
      source: "openclaw-config",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[API /agents] Error reading config:", errorMsg);

    return NextResponse.json({
      agents: getFallbackAgents(),
      source: "fallback",
      warning: `Error leyendo config de OpenClaw: ${errorMsg}`,
    });
  }
}

/**
 * Agentes de fallback si no se puede leer el archivo
 */
function getFallbackAgents() {
  return [
    {
      id: "main",
      name: "Main Agent",
      emoji: "🤖",
      description: "Agente principal de OpenClaw",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["orchestration"],
    },
    {
      id: "rob_web",
      name: "Rob Web",
      emoji: "🌐",
      description: "Especialista desarrollo web",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["web", "frontend"],
    },
    {
      id: "rob_android",
      name: "Rob Android",
      emoji: "📱",
      description: "Especialista Android nativo",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["android", "mobile"],
    },
    {
      id: "rob_tester",
      name: "Rob Tester",
      emoji: "📋",
      description: "Especialista testing y QA",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["testing", "qa"],
    },
    {
      id: "rob_market",
      name: "Rob Market",
      emoji: "🎯",
      description: "Especialista marketing",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["marketing", "analytics"],
    },
    {
      id: "rob_uxdesigner",
      name: "Rob UX Designer",
      emoji: "🎨",
      description: "Especialista diseño UX/UI",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["design", "ux", "ui"],
    },
    {
      id: "rob_asogrowth",
      name: "Rob ASO Growth",
      emoji: "🚀",
      description: "Especialista ASO y Growth",
      status: "active",
      lastActive: new Date().toISOString(),
      capabilities: ["aso", "growth"],
    },
  ];
}
