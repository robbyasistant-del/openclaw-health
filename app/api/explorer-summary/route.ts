import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = "C:\\Users\\robby\\.openclaw\\workspace\\Product_openclaw_health";
const PROMPTS_PATH = path.join(PROJECT_ROOT, "prompts.md");

interface RequestBody {
  path: string;
  folders: string[];
}

function extractPromptTemplate(markdown: string): string {
  const marker = "## EXPLORER_FOLDER_PURPOSE_V1";
  const start = markdown.indexOf(marker);
  if (start === -1) throw new Error("Prompt EXPLORER_FOLDER_PURPOSE_V1 no encontrado");

  const codeStart = markdown.indexOf("```text", start);
  const codeEnd = markdown.indexOf("```", codeStart + 7);
  if (codeStart === -1 || codeEnd === -1) {
    throw new Error("No se pudo extraer el prompt template de prompts.md");
  }

  return markdown.slice(codeStart + 7, codeEnd).trim();
}

function buildPrompt(template: string, workspacePath: string, folders: string[]): string {
  return template
    .replace("<path>", workspacePath)
    .replace("<folder_list>", folders.map((f) => `- ${f}`).join("\n"));
}

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeSummaries(parsed: any): Record<string, string> {
  const items = Array.isArray(parsed?.folders) ? parsed.folders : [];
  const result: Record<string, string> = {};
  for (const item of items) {
    if (typeof item?.name === "string" && typeof item?.summary === "string") {
      result[item.name] = item.summary.trim();
    }
  }
  return result;
}

async function askOpenAI(prompt: string): Promise<Record<string, string>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "folder_purpose_map",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              folders: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    summary: { type: "string" },
                  },
                  required: ["name", "summary"],
                },
              },
            },
            required: ["folders"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const parsed = data?.output_parsed ?? safeJsonParse(data?.output_text || "");
  const summaries = normalizeSummaries(parsed);
  if (!Object.keys(summaries).length) {
    throw new Error("No se pudieron extraer resúmenes del modelo");
  }
  return summaries;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const workspacePath = body?.path;
    const folders = Array.isArray(body?.folders) ? body.folders.filter(Boolean) : [];

    if (!workspacePath || !folders.length) {
      return NextResponse.json({ error: "Faltan path o folders" }, { status: 400 });
    }

    const promptsMd = await fs.readFile(PROMPTS_PATH, "utf8");
    const template = extractPromptTemplate(promptsMd);
    const prompt = buildPrompt(template, workspacePath, folders);

    const summaries = await askOpenAI(prompt);
    return NextResponse.json({ summaries, source: "openai" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
