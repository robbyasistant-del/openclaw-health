import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// CLEAN WORKSPACE ROOT prompt - devuelve JSON estructurado
const CLEAN_WORKSPACE_PROMPT = `## CLEAN WORKSPACE ROOT

You are an AI assistant helping clean and organize the workspace root for the user "Amo" (the owner).

CRITICAL RULES:
1. ONLY these files are allowed in root:
   - .md files: MEMORY.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, AGENTS.md, HEARTBEAT.md, BOOTSTRAP.md, README.md, prompts.md
2. ALL other loose files MUST be moved to subdirectories
3. NEVER delete files - only move them to appropriate folders
4. Create target folders if needed: scripts/, docs/, assets/, temp/, misc/

TASK: Analyze the workspace root and return a JSON with the actions to execute.

Current root files:
{{ROOT_FILES_LIST}}

For each file NOT in the allowed list (.md files only), determine the action:
- Scripts (.js, .ts, .py, .sh, .ps1, .bat) → move to "scripts/"
- Documents (.txt, .pdf, .docx) → move to "docs/"
- Images/media (.jpg, .png, .gif, .svg, .webp, .ico, .mp4) → move to "assets/"
- Temp files (.tmp, .log, .bak, .cache) → move to "temp/" or delete
- Config files (.json, .config.*, .ignore, .env*, etc.) → move to "config/"
- Other loose files → move to "misc/"

Respond ONLY with valid JSON in this exact format:
{
  "analysis": "brief summary in Spanish of what was found",
  "actions": [
    {"action": "move", "file": "filename.js", "to": "scripts/"},
    {"action": "move", "file": "notes.txt", "to": "docs/"},
    {"action": "delete", "file": "temp.tmp"}
  ]
}

If no actions needed (only .md files present), return:
{"actions": [], "analysis": "Workspace limpio. Solo hay archivos .md permitidos en la raíz."}`;

const GATEWAY_URL = "http://localhost:18789/v1/chat/completions";
const GATEWAY_TOKEN = "3e5d3201a70ba8d18492d4f8a2d20b830d8b10620864ddc7";

interface CleanWorkspaceRequest {
  path: string;
}

interface LLMAction {
  action: "move" | "delete";
  file: string;
  to?: string;
}

function isAllowedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const allowedBases = [
    path.resolve(process.env.OPENCLAW_WORKSPACE_BASE || "C:\\Users\\robby\\.openclaw"),
    path.resolve("C:\\Users\\robby\\.openclaw"),
  ];
  return allowedBases.some((base) => resolved.startsWith(base));
}

async function getRootFiles(folderPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && !e.name.startsWith("."))
      .map(e => e.name);
  } catch {
    return [];
  }
}

async function callLLM(prompt: string): Promise<{ success: boolean; analysis?: string; actions?: LLMAction[]; error?: string }> {
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openclaw",
        messages: [
          { role: "system", content: "You are a helpful assistant. Respond only with valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No content in response" };
    }

    // Parsear JSON de la respuesta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const result = JSON.parse(jsonMatch[0]);
    return { 
      success: true, 
      analysis: result.analysis || "Análisis completado.",
      actions: result.actions || []
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function executeActions(workspacePath: string, actions: LLMAction[]) {
  console.log(`[Execute] Starting with ${actions.length} actions`);
  console.log(`[Execute] Workspace: ${workspacePath}`);
  console.log(`[Execute] Actions:`, JSON.stringify(actions, null, 2));
  
  const moved: string[] = [];
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const action of actions) {
    const sourcePath = path.join(workspacePath, action.file);
    console.log(`[Execute] Processing: ${action.file} -> ${action.action}`);
    
    try {
      // Verificar que el archivo existe
      try {
        await fs.access(sourcePath);
        console.log(`[Execute] File exists: ${sourcePath}`);
      } catch {
        console.error(`[Execute] File NOT FOUND: ${sourcePath}`);
        errors.push(`${action.file}: File not found`);
        continue;
      }
      
      if (action.action === "delete") {
        await fs.unlink(sourcePath);
        deleted.push(action.file);
        console.log(`[Execute] Deleted: ${action.file}`);
      } else if (action.action === "move" && action.to) {
        const targetDir = path.join(workspacePath, action.to);
        const targetPath = path.join(targetDir, path.basename(action.file));
        console.log(`[Execute] Moving to: ${targetPath}`);
        await fs.mkdir(targetDir, { recursive: true });
        await fs.rename(sourcePath, targetPath);
        moved.push(`${action.file} → ${action.to}`);
        console.log(`[Execute] Moved: ${action.file} -> ${action.to}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Execute] ERROR for ${action.file}:`, errorMsg);
      errors.push(`${action.file}: ${errorMsg}`);
    }
  }

  const summary = [
    moved.length > 0 ? `Movidos ${moved.length} archivos` : "",
    deleted.length > 0 ? `Eliminados ${deleted.length} archivos` : "",
    errors.length > 0 ? `${errors.length} errores` : "",
  ].filter(Boolean).join(". ") || "No se realizaron cambios.";
  
  console.log(`[Execute] Summary: ${summary}`);
  console.log(`[Execute] Moved:`, moved);
  console.log(`[Execute] Errors:`, errors);

  return { moved, deleted, errors, summary };
}

export async function POST(request: NextRequest) {
  try {
    const body: CleanWorkspaceRequest = await request.json();
    const { path: workspacePath } = body;

    if (!workspacePath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    if (!isAllowedPath(workspacePath)) {
      return NextResponse.json({ error: "Path no permitido" }, { status: 403 });
    }

    const rootFiles = await getRootFiles(workspacePath);
    
    if (rootFiles.length === 0) {
      return NextResponse.json({ 
        llmResponse: "El workspace está vacío.",
        executed: { moved: [], deleted: [], errors: [], summary: "Workspace vacío." }
      });
    }

    const prompt = CLEAN_WORKSPACE_PROMPT.replace("{{ROOT_FILES_LIST}}", rootFiles.join("\n"));

    const llmResult = await callLLM(prompt);

    if (!llmResult.success) {
      return NextResponse.json({ 
        llmResponse: `Error LLM: ${llmResult.error}`,
        executed: { moved: [], deleted: [], errors: [], summary: "Error" }
      });
    }

    // Ejecutar las acciones que el LLM decidió
    const cleaningResult = await executeActions(workspacePath, llmResult.actions || []);

    return NextResponse.json({ 
      llmResponse: llmResult.analysis,
      executed: cleaningResult
    });
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
