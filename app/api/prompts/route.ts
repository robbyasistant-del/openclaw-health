import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface ExecutePromptRequest {
  promptName: string;
  promptText?: string;  // Permitir enviar texto personalizado
  timeout?: number;
  variables?: Record<string, string>;
}

interface PromptDefinition {
  name: string;
  feature?: string;
  prompt: string;
}

// Parsear prompts.md para extraer TODOS los prompts disponibles
async function parsePromptsFile(): Promise<PromptDefinition[]> {
  const promptsPath = path.join(process.cwd(), "prompts.md");
  
  try {
    const content = await fs.readFile(promptsPath, "utf-8");
    const prompts: PromptDefinition[] = [];
    
    // Buscar bloques ## NOMBRE seguidos de **Feature:** y el prompt
    const sections = content.split(/\n(?=##\s)/);
    
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.startsWith("# Openclaw")) continue;
      
      // Extraer nombre (primera línea después de ##)
      const nameMatch = trimmed.match(/^##\s+(.+)$/m);
      if (!nameMatch) continue;
      
      const name = nameMatch[1].trim();
      
      // Intentar encontrar el prompt en bloque ```text
      const textBlockMatch = trimmed.match(/```text\n([\s\S]*?)```/);
      if (textBlockMatch) {
        prompts.push({
          name,
          prompt: textBlockMatch[1].trim()
        });
      } else {
        // Si no hay bloque ```text, buscar texto directo después de **Prompt:**
        const promptMatch = trimmed.match(/\*\*Prompt:\*\*\s*\n?\n?```?\n?([\s\S]*?)(?:\n---|\n\*\*Usage:|\n##\s|$)/);
        if (promptMatch) {
          let promptText = promptMatch[1].trim();
          // Limpiar posible ``` al final
          promptText = promptText.replace(/```\s*$/, "").trim();
          prompts.push({ name, prompt: promptText });
        }
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

// GET - Listar prompts disponibles o devolver uno específico
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    
    if (name) {
      // Devolver prompt específico con su contenido
      const prompt = await findPrompt(name);
      if (!prompt) {
        return NextResponse.json(
          { error: `Prompt "${name}" not found` }, 
          { status: 404 }
        );
      }
      return NextResponse.json({ prompt });
    }
    
    // Listar todos los prompts
    const prompts = await parsePromptsFile();
    return NextResponse.json({ 
      prompts: prompts.map(p => ({ name: p.name, prompt: p.prompt })) 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Ejecutar un prompt
export async function POST(request: NextRequest) {
  try {
    const body: ExecutePromptRequest = await request.json();
    const { promptName, promptText, timeout = 300, variables = {} } = body;
    
    if (!promptName) {
      return NextResponse.json(
        { error: "promptName is required" }, 
        { status: 400 }
      );
    }
    
    let finalPromptText: string;
    
    // Si se proporciona texto personalizado, usar ese
    if (promptText && promptText.trim()) {
      finalPromptText = promptText;
    } else {
      // Buscar el prompt en prompts.md
      const promptDef = await findPrompt(promptName);
      if (!promptDef) {
        return NextResponse.json(
          { error: `Prompt "${promptName}" not found in prompts.md` }, 
          { status: 404 }
        );
      }
      finalPromptText = promptDef.prompt;
    }
    
    // Reemplazar variables si existen
    for (const [key, value] of Object.entries(variables)) {
      finalPromptText = finalPromptText.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    
    // Llamar al gateway
    const startTime = Date.now();
    const response = await callOpenClawGateway(finalPromptText, timeout);
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
