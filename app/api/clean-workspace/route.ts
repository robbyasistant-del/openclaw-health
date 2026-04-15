import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// CLEAN WORKSPACE ROOT prompt
const CLEAN_WORKSPACE_PROMPT = `You are an AI assistant helping clean and organize the workspace for the user "Amo" (the owner).

TASK: Analyze the workspace root directory and identify loose files (files that are directly in the root, not in subdirectories) that should be moved or organized.

Rules for cleaning:
1. NEVER delete files - only suggest moves to appropriate subdirectories
2. Loose scripts (.js, .ts, .py, .sh) → suggest moving to "scripts/" folder
3. Loose documents (.md, .txt, .pdf) → suggest moving to "docs/" or keeping if they are system files (MEMORY.md, SOUL.md, etc.)
4. Loose images/media → suggest moving to "assets/" or appropriate project folder
5. Temporary files (.tmp, .log, .bak) → suggest moving to "temp/" or deleting if safe
6. Keep these files in root: README.md, .gitignore, package.json, tsconfig.json, and other config files that belong at root level

Current root files:
{{ROOT_FILES_LIST}}

Respond with:
1. A brief summary of what loose files were found
2. Specific recommendations for each file (where to move it and why)
3. Any files that can be safely deleted (temp files only)

Format as plain text, max 600 characters, in Spanish.`;

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
async function getRootFiles(folderPath: string): Promise<string> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && !e.name.startsWith("."))
      .map(e => e.name);
    return files.join("\n") || "(no loose files)";
  } catch {
    return "(error reading directory)";
  }
}

// Llamar al LLM vía HTTP al gateway de OpenClaw
async function callLLM(prompt: string): Promise<string> {
  // Intentar varios endpoints del gateway
  const endpoints = [
    "http://localhost:8080/api/llm",
    "http://localhost:3000/api/llm",
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
          max_tokens: 800,
          temperature: 0.5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || data.content || data.text || "No se pudo analizar.";
      }
    } catch {
      continue;
    }
  }

  throw new Error("No LLM endpoint available");
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

    // Obtener archivos sueltos en la raíz
    const rootFiles = await getRootFiles(workspacePath);

    // Construir prompt
    const prompt = CLEAN_WORKSPACE_PROMPT.replace("{{ROOT_FILES_LIST}}", rootFiles);

    // Intentar llamar al LLM
    let analysis: string;
    try {
      analysis = await callLLM(prompt);
      analysis = analysis.trim();
      if (analysis.length > 600) {
        analysis = analysis.slice(0, 597) + "...";
      }
    } catch {
      // Fallback: análisis básico
      analysis = generateBasicCleaningAdvice(rootFiles);
    }

    return NextResponse.json({ analysis, files: rootFiles.split("\n").filter(f => f !== "(no loose files)" && f !== "(error reading directory)") });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Análisis básico cuando el LLM no está disponible
function generateBasicCleaningAdvice(filesList: string): string {
  const files = filesList.split("\n").filter(f => f && !f.startsWith("("));
  
  if (files.length === 0) {
    return "No se encontraron archivos sueltos en la raíz del workspace. ¡Todo está ordenado!";
  }

  const scripts = files.filter(f => /\.(js|ts|py|sh|ps1)$/i.test(f));
  const docs = files.filter(f => /\.(md|txt|pdf|docx?)$/i.test(f));
  const images = files.filter(f => /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(f));
  const configs = files.filter(f => /^(package\.json|tsconfig|README|\.gitignore|\.env|next\.config|tailwind)/i.test(f));
  
  let advice = `Se encontraron ${files.length} archivos sueltos en la raíz:\n\n`;
  
  if (scripts.length > 0) {
    advice += `📜 Scripts (${scripts.length}): ${scripts.join(", ")}\n→ Mover a carpeta "scripts/"\n\n`;
  }
  
  if (docs.length > 0) {
    const systemDocs = docs.filter(f => /^(MEMORY|SOUL|USER|IDENTITY|TOOLS|AGENTS|README)\.md$/i.test(f));
    const otherDocs = docs.filter(f => !systemDocs.includes(f));
    if (otherDocs.length > 0) {
      advice += `📄 Documentos (${otherDocs.length}): ${otherDocs.join(", ")}\n→ Mover a carpeta "docs/"\n\n`;
    }
    if (systemDocs.length > 0) {
      advice += `✅ Archivos de sistema: ${systemDocs.join(", ")}\n→ Mantener en raíz\n\n`;
    }
  }
  
  if (images.length > 0) {
    advice += `🖼️ Imágenes (${images.length}): ${images.join(", ")}\n→ Mover a carpeta "assets/" o proyecto correspondiente\n\n`;
  }
  
  if (configs.length > 0) {
    advice += `⚙️ Configuraciones: ${configs.join(", ")}\n→ Mantener en raíz (archivos de configuración)`;
  }
  
  return advice;
}
