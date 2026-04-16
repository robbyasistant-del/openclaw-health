import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface ExecutePromptRequest {
  promptName: string;
  timeout?: number;
  variables?: Record<string, string>;
}

interface PromptDefinition {
  name: string;
  feature?: string;
  prompt: string;
}

// Parsear prompts.md para extraer los prompts disponibles
async function parsePromptsFile(): Promise<PromptDefinition[]> {
  const promptsPath = path.join(process.cwd(), "prompts.md");
  
  try {
    const content = await fs.readFile(promptsPath, "utf-8");
    const prompts: PromptDefinition[] = [];
    
    // Regex para encontrar headers de prompts (## NAME o ## NAME_V1)
    const promptBlocks = content.split(/\n##\s+/);
    
    for (const block of promptBlocks) {
      if (!block.trim()) continue;
      
      const lines = block.split("\n");
      const name = lines[0].trim();
      
      // Encontrar el contenido del prompt (entre ```text y ```)
      const match = block.match(/```text\n([\s\S]*?)```/);
      if (match) {
        prompts.push({
          name,
          prompt: match[1].trim()
        });
      }
    }
    
    return prompts;
  } catch (err) {
    console.error("Error reading prompts.md:", err);
    return [];
  }
}

// Buscar un prompt por nombre
async function findPrompt(name: string): Promise<PromptDefinition | null> {
  const prompts = await parsePromptsFile();
  return prompts.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
}

// Llamar al gateway de OpenClaw
async function callOpenClawGateway(prompt: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
  
  try {
    const response = await fetch("http://localhost:18789/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openclaw",
        message: prompt,
        timeoutSeconds: timeout
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Gateway error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extraer respuesta de diferentes formatos posibles
    return data.response?.text || 
           data.response?.content || 
           data.text || 
           data.content || 
           data.message || 
           JSON.stringify(data);
           
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error(`Timeout after ${timeout}s`);
      }
      throw err;
    }
    throw new Error(String(err));
  }
}

// GET - Listar prompts disponibles
export async function GET() {
  try {
    const prompts = await parsePromptsFile();
    return NextResponse.json({ prompts: prompts.map(p => ({ name: p.name })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Ejecutar un prompt
export async function POST(request: NextRequest) {
  try {
    const body: ExecutePromptRequest = await request.json();
    const { promptName, timeout = 60, variables = {} } = body;
    
    if (!promptName) {
      return NextResponse.json(
        { error: "promptName is required" }, 
        { status: 400 }
      );
    }
    
    // Buscar el prompt
    const promptDef = await findPrompt(promptName);
    if (!promptDef) {
      return NextResponse.json(
        { error: `Prompt "${promptName}" not found in prompts.md` }, 
        { status: 404 }
      );
    }
    
    // Reemplazar variables si existen
    let promptText = promptDef.prompt;
    for (const [key, value] of Object.entries(variables)) {
      promptText = promptText.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    
    // Llamar al gateway
    const startTime = Date.now();
    const response = await callOpenClawGateway(promptText, timeout);
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      promptName,
      response,
      duration: `${(duration / 1000).toFixed(2)}s`
    });
    
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message }, 
      { status: 500 }
    );
  }
}
