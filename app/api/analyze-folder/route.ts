import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Prompt FOLDER_PURPOSE para análisis de carpetas
const FOLDER_PURPOSE_PROMPT = `You are an AI assistant helping analyze a folder/workspace for the user "Amo" (the owner).

Analyze this folder and provide a concise summary (max 400 characters) describing:
1. What the folder contains (main content types: code, docs, media, config, etc.)
2. Its apparent purpose/goal based on file names and structure (e.g., "Proyecto web de e-commerce", "Backup de configuraciones", "Documentación técnica")
3. Who uses it or what project it belongs to (if inferable from path or names)
4. Key technologies or frameworks detected (React, Node, Python, etc.)

Folder info:
- Name: {{FOLDER_NAME}}
- Path: {{FOLDER_PATH}}
- Size: {{FOLDER_SIZE}}
- Total files inside: {{FILE_COUNT}}
- Total subdirectories: {{DIR_COUNT}}

Top-level items (representative sample):
{{ITEMS_LIST}}

IMPORTANT: Respond with a MEANINGFUL description like:
- "Proyecto React de dashboard administrativo con TypeScript. Contiene componentes UI, API routes y tests. Usado para el panel de control de OpenClaw."
- "Colección de prototipos HTML/CSS/JS experimentales. Incluye juegos, animaciones y demos interactivas."
- "Documentación y memoria del sistema: guías, prompts, decisiones técnicas y configuración."

DO NOT just count files. Explain WHAT it is and WHY it exists. Max 400 chars. Spanish only. Plain text, no markdown.`;

interface AnalyzeRequest {
  path: string;
  name: string;
  type: "file" | "directory";
  size: number;
  fileCount?: number;
  dirCount?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

// Obtener lista de items top-level para el prompt
async function getFolderItems(folderPath: string): Promise<string> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const items = entries
      .filter(e => !e.name.startsWith(".") && e.name !== "node_modules")
      .slice(0, 20)
      .map(e => {
        const type = e.isDirectory() ? "[DIR]" : "[FILE]";
        return `${type} ${e.name}`;
      });
    return items.join("\n") || "(empty or no access)";
  } catch {
    return "(no access)";
  }
}

// Leer MEMORY.md si existe para contexto adicional
async function getMemoryContext(workspacePath: string): Promise<string> {
  try {
    const memoryPath = path.join(workspacePath, "MEMORY.md");
    const content = await fs.readFile(memoryPath, "utf-8");
    // Extraer solo los primeros 2000 chars para contexto
    return content.slice(0, 2000);
  } catch {
    return "";
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
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || data.content || data.text || "No se pudo analizar.";
      }
    } catch {
      // Try next endpoint
      continue;
    }
  }

  throw new Error("No LLM endpoint available");
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { path: folderPath, name, size, fileCount, dirCount } = body;

    if (!folderPath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    // Obtener items de la carpeta
    const itemsList = await getFolderItems(folderPath);
    
    // Intentar obtener contexto de MEMORY.md del workspace padre
    const workspaceRoot = path.resolve("C:\\Users\\robby\\.openclaw\\workspace");
    const memoryContext = await getMemoryContext(workspaceRoot);

    // Construir prompt
    let prompt = FOLDER_PURPOSE_PROMPT
      .replace("{{FOLDER_NAME}}", name)
      .replace("{{FOLDER_PATH}}", folderPath)
      .replace("{{FOLDER_SIZE}}", formatBytes(size))
      .replace("{{FILE_COUNT}}", String(fileCount || "unknown"))
      .replace("{{DIR_COUNT}}", String(dirCount || "unknown"))
      .replace("{{ITEMS_LIST}}", itemsList);

    // Añadir contexto de memoria si existe
    if (memoryContext) {
      prompt += `\n\nAdditional context from user's MEMORY.md:\n${memoryContext.slice(0, 1000)}`;
    }

    // Intentar llamar al LLM
    let analysis: string;
    try {
      analysis = await callLLM(prompt);
      // Limpiar respuesta
      analysis = analysis.trim();
      if (analysis.length > 400) {
        analysis = analysis.slice(0, 397) + "...";
      }
    } catch {
      // Fallback: análisis heuristico más inteligente
      analysis = generateSmartAnalysis(name, itemsList, fileCount, dirCount, folderPath);
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Análisis heuristico inteligente cuando el LLM no está disponible
function generateSmartAnalysis(
  name: string,
  items: string,
  fileCount?: number,
  dirCount?: number,
  folderPath?: string
): string {
  const dirs = items.split("\n").filter(i => i.startsWith("[DIR]"));
  const files = items.split("\n").filter(i => i.startsWith("[FILE]"));
  const dirNames = dirs.map(d => d.replace("[DIR] ", "").toLowerCase());
  const fileNames = files.map(f => f.replace("[FILE] ", "").toLowerCase());
  
  const lowerName = name.toLowerCase();
  
  // Detectar tecnologías/frameworks
  const techs: string[] = [];
  const allNames = [...dirNames, ...fileNames].join(" ");
  
  if (allNames.includes("package.json") || allNames.includes("node_modules")) techs.push("Node.js");
  if (allNames.includes("tsconfig.json") || fileNames.some(f => f.endsWith(".ts"))) techs.push("TypeScript");
  if (fileNames.some(f => f.endsWith(".tsx") || f.endsWith(".jsx"))) techs.push("React");
  if (allNames.includes("next.config")) techs.push("Next.js");
  if (allNames.includes("tailwind")) techs.push("Tailwind");
  if (allNames.includes("requirements.txt") || fileNames.some(f => f.endsWith(".py"))) techs.push("Python");
  if (allNames.includes("cargo.toml") || fileNames.some(f => f.endsWith(".rs"))) techs.push("Rust");
  if (allNames.includes("go.mod") || fileNames.some(f => f.endsWith(".go"))) techs.push("Go");
  if (fileNames.some(f => f.endsWith(".md"))) techs.push("documentación");
  if (fileNames.some(f => /\.(jpg|png|gif|svg|webp)$/i.test(f))) techs.push("assets gráficos");
  
  // Análisis por nombre de carpeta
  if (lowerName.includes("prototypes") || lowerName.includes("lab")) {
    return `Laboratorio de prototipos experimentales${techs.length ? ` en ${techs.join(", ")}` : ""}. Espacio de pruebas y demos interactivas para validar ideas antes de producción.`;
  }
  
  if (lowerName.includes("mission") || lowerName.includes("control")) {
    return `Panel de control/mission control${techs.length ? ` construido con ${techs.join(", ")}` : ""}. Interfaz de gestión y monitoreo del sistema.`;
  }
  
  if (lowerName.includes("docs") || lowerName.includes("doc")) {
    return `Documentación técnica y guías del proyecto. Contiene especificaciones, manuales y referencias para desarrolladores.`;
  }
  
  if (lowerName.includes("config") || lowerName.includes("settings")) {
    return `Configuraciones y ajustes del sistema. Archivos de parametrización para diferentes entornos y servicios.`;
  }
  
  if (lowerName.includes("scripts") || lowerName.includes("tools")) {
    return `Utilidades y scripts de automatización. Herramientas para tareas recurrentes del workflow.`;
  }
  
  if (lowerName.includes("memory") || lowerName.includes("notes")) {
    return `Memoria del sistema y notas del usuario. Registro de decisiones, aprendizajes y contexto importante.`;
  }
  
  if (lowerName.includes("skills")) {
    return `Skills/extensiones del sistema OpenClaw. Módulos de funcionalidad adicional para el asistente.`;
  }
  
  if (lowerName.includes("workspace") || lowerName.includes("projects")) {
    return `Workspace principal con ${dirNames.length} proyectos/carpetas${techs.length ? `. Tecnologías: ${techs.join(", ")}` : ""}. Contiene ${fileCount || files.length} archivos de trabajo.`;
  }
  
  // Análisis por contenido
  if (techs.includes("React") || techs.includes("Next.js")) {
    return `Proyecto web frontend${techs.length ? ` desarrollado con ${techs.join(", ")}` : ""}. Aplicación interactiva con interfaz de usuario moderna.`;
  }
  
  if (techs.includes("Python")) {
    return `Proyecto Python${techs.length ? ` (${techs.join(", ")})` : ""}. Scripts, módulos o aplicaciones en lenguaje Python.`;
  }
  
  if (techs.includes("Node.js")) {
    return `Proyecto Node.js${techs.length ? ` con ${techs.join(", ")}` : ""}. Aplicación backend o herramientas CLI en JavaScript/TypeScript.`;
  }
  
  // Default inteligente
  if (dirs.length > 0 && files.length === 0) {
    return `Contenedor de ${dirs.length} subproyectos/carpetas${dirNames.some(n => n.includes("project") || n.includes("app")) ? ". Cada subcarpeta parece ser un proyecto independiente." : ". Organización jerárquica de componentes."}`;
  }
  
  return `Carpeta de trabajo con ${files.length} archivos${dirs.length ? ` y ${dirs.length} subcarpetas` : ""}${techs.length ? `. Contiene ${techs.join(", ")}.` : ". Archivos de proyecto y recursos."}`;
}
