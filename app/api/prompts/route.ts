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
      let promptText = "";
      
      // CASO 1: Prompt en bloque ```text
      const textBlockMatch = trimmed.match(/```text\n([\s\S]*?)```/);
      if (textBlockMatch) {
        promptText = textBlockMatch[1].trim();
      } else {
        // CASO 2: Prompt directo después del título (como BACKUP_V1)
        // Buscar todo el contenido después del título ## hasta el próximo ## o final
        const lines = trimmed.split('\n');
        let contentStarted = false;
        const contentLines: string[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // Ignorar líneas de metadata como **Feature:** hasta encontrar contenido real
          if (!contentStarted) {
            if (line.trim() === "" || line.startsWith("**")) continue;
            contentStarted = true;
          }
          contentLines.push(line);
        }
        
        if (contentLines.length > 0) {
          promptText = contentLines.join('\n').trim();
        }
      }
      
      // Solo agregar si encontramos contenido
      if (promptText && promptText.length > 50) {
        prompts.push({ name, prompt: promptText });
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

// Llamar al gateway de OpenClaw usando el endpoint /v1/chat/completions (formato OpenAI compatible)
async function callOpenClawGateway(prompt: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
  
  // Token del gateway - desde variables de entorno
  const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
  
  try {
    const response = await fetch("http://localhost:18789/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`
      },
      body: JSON.stringify({
        model: "openclaw",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 4000
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extraer respuesta del formato OpenAI
    return data.choices?.[0]?.message?.content || 
           data.response?.text || 
           data.text || 
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
