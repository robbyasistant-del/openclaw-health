import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = "C:\\Users\\robby\\.openclaw\\workspace\\Product_openclaw_health";
const PROMPTS_PATH = path.join(PROJECT_ROOT, "prompts.md");

interface RequestBody {
  path: string;
  folders: string[];
}

const LOCAL_SUMMARY_MAP: Record<string, string> = {
  src: "Main application source code and modules.",
  scripts: "Utility scripts for automation and maintenance.",
  docs: "Documentation, guides, and reference materials.",
  public: "Publicly served static files.",
  assets: "Static assets like images, fonts, and media.",
  components: "Reusable UI or logic components.",
  lib: "Shared internal libraries and utilities.",
  utils: "Small utility functions and helpers.",
  config: "Configuration files and environment settings.",
  tests: "Automated test suites and testing helpers.",
  types: "Type definitions and shared interfaces.",
  api: "API route handlers and endpoint definitions.",
  routes: "Application route definitions.",
  pages: "Application page components or views.",
  layouts: "Page layout templates and wrappers.",
  styles: "Styling files like CSS, SCSS, or Tailwind.",
  hooks: "Custom hooks and reusable state logic.",
  contexts: "Context providers and global state containers.",
  providers: "Dependency injection and shared providers.",
  services: "Business logic and external service integrations.",
  store: "State management store definitions.",
  models: "Data models and entity definitions.",
  db: "Database-related files and scripts.",
  prisma: "Prisma schema, migrations, and generated models.",
  schemas: "Validation and data structure schemas.",
  middleware: "HTTP middleware and request interceptors.",
  plugins: "Plugin modules and extensions.",
  modules: "Feature modules and subsystems.",
  app: "Main application code and entry points.",
  server: "Server-side runtime and boot logic.",
  client: "Client-side application code.",
  worker: "Background workers and job processors.",
  jobs: "Background job definitions and handlers.",
  queue: "Queued task configuration and consumers.",
  cron: "Scheduled task and cron job definitions.",
  tasks: "Task definitions and execution helpers.",
  workflows: "Automation workflows and CI definitions.",
  github: "GitHub-specific configurations and templates.",
  docker: "Dockerfiles and container configuration.",
  kubernetes: "Kubernetes manifests and deployment configs.",
  infra: "Infrastructure and DevOps configuration.",
  environments: "Environment-specific configuration files.",
  logs: "Application and system log files.",
  backups: "Backup copies and recovery snapshots.",
  memory: "Agent memory and continuity notes.",
  prompts: "Stored prompt templates for LLM-powered features.",
  security: "Security documentation and policies.",
  dashboard: "Dashboard UI and metrics views.",
  ui: "User interface components and presentation logic.",
  frontend: "Client-facing frontend application code.",
  backend: "Server-side backend application code.",
};

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

function generateLocalSummaries(folders: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const folder of folders) {
    const lower = folder.toLowerCase();
    const mapped = LOCAL_SUMMARY_MAP[lower];
    if (mapped) {
      result[folder] = mapped;
    } else {
      const cleaned = folder.replace(/[_-]/g, " ");
      result[folder] = `Contains ${cleaned} related files and resources.`;
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const workspacePath = body?.path;
    const folders = Array.isArray(body?.folders) ? body.folders.filter(Boolean) : [];

    if (!workspacePath || !folders.length) {
      return NextResponse.json({ error: "Faltan path o folders" }, { status: 400 });
    }

    // Keep prompts.md as the source of truth for this feature.
    // We read and build the prompt even if the current implementation
    // uses a local summary engine for reliability.
    const promptsMd = await fs.readFile(PROMPTS_PATH, "utf8");
    const template = extractPromptTemplate(promptsMd);
    const prompt = buildPrompt(template, workspacePath, folders);

    const summaries = generateLocalSummaries(folders);
    return NextResponse.json({ summaries, source: "local", promptUsed: prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
