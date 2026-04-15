import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// CLEAN WORKSPACE ROOT prompt
const CLEAN_WORKSPACE_PROMPT = `## CLEAN WORKSPACE ROOT

You are an AI assistant helping clean and organize the workspace root for the user "Amo" (the owner).

CRITICAL RULES:
1. ONLY these files are allowed in root:
   - .md files: MEMORY.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, AGENTS.md, HEARTBEAT.md, BOOTSTRAP.md, README.md, prompts.md
   - Config files: package.json, tsconfig.json, .gitignore, .env, next.config.*, tailwind.config.*, etc.
2. ALL other loose files MUST be moved to subdirectories
3. NEVER delete files - only move them to appropriate folders
4. Create target folders if needed: scripts/, docs/, assets/, temp/, misc/

TASK: Analyze the workspace root and execute the cleaning actions.

Current root files:
{{ROOT_FILES_LIST}}

For each file NOT in the allowed list, determine the action:
- Scripts (.js, .ts, .py, .sh, .ps1, .bat) → move to "scripts/"
- Documents (.txt, .pdf, .docx) → move to "docs/"
- Images/media (.jpg, .png, .gif, .svg, .webp, .ico, .mp4) → move to "assets/"
- Temp files (.tmp, .log, .bak, .cache) → move to "temp/" or delete
- Other loose files → move to "misc/"

Execute the moves and report what was done. Be thorough and move ALL files that don't belong in root.

Respond with a detailed summary in Spanish of what files were moved where. Include the count of files moved.`;

const GATEWAY_URL = "http://localhost:18789/v1/chat/completions";
const GATEWAY_TOKEN = "3e5d3201a70ba8d18492d4f8a2d20b830d8b10620864ddc7";

interface CleanWorkspaceRequest {
  path: string;
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

const ALLOWED_ROOT_FILES = new Set([
  "memory.md", "soul.md", "user.md", "identity.md", "tools.md", "agents.md", 
  "heartbeat.md", "bootstrap.md", "readme.md", "prompts.md",
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "tsconfig.json", "jsconfig.json", ".gitignore", ".env", ".env.local",
  "next.config.js", "next.config.ts", "next.config.mjs",
  "tailwind.config.js", "tailwind.config.ts",
  "vite.config.js", "vite.config.ts",
  ".gitattributes",
  "license", "license.md", "changelog.md",
]);

async function callLLM(prompt: string): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    console.log("[LLM] Calling gateway at:", GATEWAY_URL);
    
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openclaw",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    console.log("[LLM] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] Error response:", errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    console.log("[LLM] Response data:", JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No content in response" };
    }
    
    return { success: true, response: content };
  } catch (err) {
    console.error("[LLM] Exception:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function executeCleaning(workspacePath: string, files: string[]) {
  const moved: string[] = [];
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const lowerFile = file.toLowerCase();
    if (ALLOWED_ROOT_FILES.has(lowerFile)) continue;
    
    const sourcePath = path.join(workspacePath, file);
    let targetDir: string | null = null;
    let shouldDelete = false;
    
    if (/\.(js|ts|py|sh|ps1|bat)$/i.test(file)) targetDir = "scripts";
    else if (/\.(txt|pdf|docx?)$/i.test(file)) targetDir = "docs";
    else if (/\.(jpg|jpeg|png|gif|svg|webp|ico|mp4)$/i.test(file)) targetDir = "assets";
    else if (/\.(tmp|log|bak|cache)$/i.test(file)) shouldDelete = true;
    else targetDir = "misc";

    try {
      if (shouldDelete) {
        await fs.unlink(sourcePath);
        deleted.push(file);
      } else if (targetDir) {
        const targetDirPath = path.join(workspacePath, targetDir);
        const targetPath = path.join(targetDirPath, file);
        await fs.mkdir(targetDirPath, { recursive: true });
        await fs.rename(sourcePath, targetPath);
        moved.push(`${file} → ${targetDir}/`);
      }
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary = [
    moved.length > 0 ? `Movidos ${moved.length} archivos` : "",
    deleted.length > 0 ? `Eliminados ${deleted.length} archivos` : "",
    errors.length > 0 ? `${errors.length} errores` : "",
  ].filter(Boolean).join(". ") || "No se realizaron cambios.";

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
    const cleaningResult = await executeCleaning(workspacePath, rootFiles);

    if (!llmResult.success) {
      return NextResponse.json({ 
        llmResponse: `Error LLM: ${llmResult.error}\n\nModo automático: ${cleaningResult.summary}`,
        executed: cleaningResult
      });
    }

    return NextResponse.json({ 
      llmResponse: llmResult.response,
      executed: cleaningResult
    });
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
