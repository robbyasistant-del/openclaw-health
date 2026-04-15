import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// CLEAN WORKSPACE ROOT prompt - se envía literalmente al LLM
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

// Obtener lista de archivos en la raíz del workspace
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

// Archivos permitidos en la raíz
const ALLOWED_ROOT_FILES = new Set([
  "memory.md", "soul.md", "user.md", "identity.md", "tools.md", "agents.md", 
  "heartbeat.md", "bootstrap.md", "readme.md", "prompts.md",
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "tsconfig.json", "jsconfig.json", ".gitignore", ".env", ".env.local",
  "next.config.js", "next.config.ts", "next.config.mjs",
  "tailwind.config.js", "tailwind.config.ts",
  "postcss.config.js", "postcss.config.ts",
  "vite.config.js", "vite.config.ts",
  "webpack.config.js", "rollup.config.js",
  "nodemon.json", "pm2.config.js",
  ".gitattributes",
  "license", "license.md", "license.txt",
  "changelog.md", "changelog.txt",
  "contributing.md",
  "dockerfile", "docker-compose.yml", "docker-compose.yaml",
  ".nvmrc", ".node-version",
  ".editorconfig", ".prettierrc", ".eslintrc", ".eslintrc.json",
]);

// Llamar al LLM vía HTTP - usa el mismo endpoint que analyze-folder
async function callLLM(prompt: string): Promise<string> {
  const endpoints = [
    "http://localhost:8080/api/llm",
    "http://127.0.0.1:8080/api/llm",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: "default",
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || data.content || data.text || "No se pudo obtener respuesta del LLM.";
      }
    } catch (err) {
      console.error(`Error con endpoint ${endpoint}:`, err);
      continue;
    }
  }

  throw new Error("No se pudo conectar con el LLM");
}

// Ejecutar limpieza basada en análisis automático
async function executeCleaning(workspacePath: string, files: string[]): Promise<{ moved: string[]; deleted: string[]; errors: string[]; summary: string }> {
  const moved: string[] = [];
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const lowerFile = file.toLowerCase();
    
    if (ALLOWED_ROOT_FILES.has(lowerFile)) {
      continue;
    }
    
    const sourcePath = path.join(workspacePath, file);
    let targetDir: string | null = null;
    let shouldDelete = false;
    
    if (/\.(js|ts|py|sh|ps1|bat)$/i.test(file)) {
      targetDir = "scripts";
    } else if (/\.(txt|pdf|docx?)$/i.test(file)) {
      targetDir = "docs";
    } else if (/\.(jpg|jpeg|png|gif|svg|webp|ico|mp4|mov|avi)$/i.test(file)) {
      targetDir = "assets";
    } else if (/\.(tmp|log|bak|cache|old|orig)$/i.test(file)) {
      shouldDelete = true;
    } else {
      targetDir = "misc";
    }

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
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${file}: ${message}`);
    }
  }

  const parts: string[] = [];
  if (moved.length > 0) parts.push(`Movidos ${moved.length} archivos`);
  if (deleted.length > 0) parts.push(`Eliminados ${deleted.length} archivos`);
  if (errors.length > 0) parts.push(`${errors.length} errores`);
  
  const summary = parts.length > 0 ? parts.join(". ") + "." : "No se realizaron cambios.";

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
        llmResponse: "El workspace está vacío. No hay archivos que organizar.",
        executed: { moved: [], deleted: [], errors: [], summary: "Workspace vacío." }
      });
    }

    const prompt = CLEAN_WORKSPACE_PROMPT.replace("{{ROOT_FILES_LIST}}", rootFiles.join("\n"));

    let llmResponse: string;
    try {
      llmResponse = await callLLM(prompt);
    } catch (err) {
      const result = await executeCleaning(workspacePath, rootFiles);
      return NextResponse.json({ 
        llmResponse: `Modo automático (LLM no disponible):\n${result.summary}`,
        executed: result
      });
    }

    const result = await executeCleaning(workspacePath, rootFiles);

    return NextResponse.json({ 
      llmResponse: llmResponse,
      executed: result
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
