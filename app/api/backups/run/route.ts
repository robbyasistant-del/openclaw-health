import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { complete } from "@/lib/openclaw";

const GATEWAY_LLM_TIMEOUT_SECONDS = Number(process.env.OPENCLAW_GATEWAY_LLM_TIMEOUT_SECONDS || "600");
const GATEWAY_LLM_TIMEOUT_MS = GATEWAY_LLM_TIMEOUT_SECONDS * 1000;

const BACKUP_REPO_PATH = "C:\\Users\\robby\\.openclaw\\workspace\\openclaw-backups";
const WORKSPACE_ROOT = "C:\\Users\\robby\\.openclaw\\workspace";
const OPENCLAW_ROOT = "C:\\Users\\robby\\.openclaw";
const AGENTS_ROOT = "C:\\Users\\robby\\.openclaw\\agents";
const SKILLS_ROOT = "C:\\Users\\robby\\.openclaw\\workspace\\skills";
const PROMPTS_PATH = "C:\\Users\\robby\\.openclaw\\workspace\\Product_openclaw_health\\prompts.md";

const WORKSPACE_FILES: string[] = [
  "AGENTS.md",
  "SOUL.md",
  "MEMORY.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "PLAYBOOK_SUBAGENTS.md",
  ".env",
  ".env.example",
  "next.config.mjs",
  "next.config.ts",
  "next.config.js",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "prisma.config.ts",
  "jest.config.js",
  "jest.setup.js",
  "vercel.json",
  "components.json",
  "postcss.config.mjs",
  "middleware.ts",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierignore",
  ".lintstagedrc.json",
];

const OPENCLAW_FILES: string[] = [
  "openclaw.json",
  "openclaw.json.bak",
  "openclaw.json.bak.1",
  "openclaw.json.bak.2",
  "openclaw.json.bak.3",
  "openclaw.json.bak.4",
  "openclaw-new.json",
  "exec-approvals.json",
  "gateway.cmd",
  ".env",
  "update-check.json",
];

const AGENT_FILES: string[] = [
  "agent/auth.json",
  "agent/auth-profiles.json",
  "agent/models.json",
  "sessions/sessions.json",
];

function extractBackupPrompt(markdown: string): string {
  const marker = "## BACKUP_V1";
  const start = markdown.indexOf(marker);
  if (start === -1) throw new Error("Prompt BACKUP_V1 no encontrado");
  const end = markdown.indexOf("##", start + marker.length);
  const block = end === -1 ? markdown.slice(start) : markdown.slice(start, end);
  return block.trim();
}

async function ensureDir(destPath: string): Promise<void> {
  const dir = path.dirname(destPath);
  await fs.mkdir(dir, { recursive: true });
}

async function copyFileSafe(src: string, dest: string): Promise<void> {
  try {
    await fs.access(src);
    await ensureDir(dest);
    await fs.copyFile(src, dest);
  } catch {
    // skip missing files
  }
}

async function copyWorkspaceFiles(): Promise<void> {
  for (const file of WORKSPACE_FILES) {
    await copyFileSafe(path.join(WORKSPACE_ROOT, file), path.join(BACKUP_REPO_PATH, file));
  }
}

async function copyOpenclawGlobalFiles(): Promise<void> {
  for (const file of OPENCLAW_FILES) {
    await copyFileSafe(path.join(OPENCLAW_ROOT, file), path.join(BACKUP_REPO_PATH, "openclaw-global", file));
  }
}

async function copyAgentFiles(): Promise<void> {
  try {
    const agentDirs = await fs.readdir(AGENTS_ROOT);
    for (const agentDir of agentDirs) {
      const agentPath = path.join(AGENTS_ROOT, agentDir);
      const stat = await fs.stat(agentPath);
      if (!stat.isDirectory()) continue;

      for (const relFile of AGENT_FILES) {
        await copyFileSafe(
          path.join(agentPath, relFile),
          path.join(BACKUP_REPO_PATH, "agents", agentDir, relFile)
        );
      }
    }
  } catch {
    // ignore if agents dir missing
  }
}

async function copySkills(): Promise<void> {
  try {
    const skillDirs = await fs.readdir(SKILLS_ROOT);
    for (const skillDir of skillDirs) {
      const skillPath = path.join(SKILLS_ROOT, skillDir);
      const stat = await fs.stat(skillPath);
      if (!stat.isDirectory()) continue;

      const skillMd = path.join(skillPath, "SKILL.md");
      await copyFileSafe(skillMd, path.join(BACKUP_REPO_PATH, "skills", skillDir, "SKILL.md"));
    }
  } catch {
    // ignore if skills dir missing
  }
}

async function copyPromptsMd(): Promise<void> {
  await copyFileSafe(PROMPTS_PATH, path.join(BACKUP_REPO_PATH, "prompts.md"));
}

async function copyFilesToBackupRepo(): Promise<void> {
  await copyWorkspaceFiles();
  await copyOpenclawGlobalFiles();
  await copyAgentFiles();
  await copySkills();
  await copyPromptsMd();
}

async function sanitizeSecretsInDir(dirPath: string): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await sanitizeSecretsInDir(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;

    let content: string;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }

    let modified = false;
    const patterns: { regex: RegExp; placeholder: string }[] = [
      { regex: /sk-[a-zA-Z0-9]{20,}/g, placeholder: "[OPENAI_API_KEY]" },
      { regex: /gho_[a-zA-Z0-9]{20,}/g, placeholder: "[GITHUB_TOKEN]" },
      { regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g, placeholder: "[GITHUB_TOKEN]" },
      { regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g, placeholder: "[BEARER_TOKEN]" },
      { regex: /api[_-]?key\s*[:=]\s*[\"']?[a-zA-Z0-9_\-]{10,}[\"']?/gi, placeholder: "[API_KEY]" },
      { regex: /password\s*[:=]\s*[\"']?[^\"'\s\n]{4,}[\"']?/gi, placeholder: "[PASSWORD]" },
      { regex: /token\s*[:=]\s*[\"']?[a-zA-Z0-9_\-]{10,}[\"']?/gi, placeholder: "[TOKEN]" },
      { regex: /secret\s*[:=]\s*[\"']?[a-zA-Z0-9_\-]{10,}[\"']?/gi, placeholder: "[SECRET]" },
      { regex: /ssh-rsa\s+[A-Za-z0-9+\/]{50,}/g, placeholder: "[SSH_KEY]" },
      { regex: /-----BEGIN (RSA |OPENSSH |PRIVATE )?KEY-----[\s\S]*?-----END (RSA |OPENSSH |PRIVATE )?KEY-----/g, placeholder: "[PRIVATE_KEY]" },
      { regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, placeholder: "[JWT_TOKEN]" },
    ];

    for (const { regex, placeholder } of patterns) {
      if (regex.test(content)) {
        content = content.replace(regex, placeholder);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(fullPath, content, "utf8");
    }
  }
}

async function askAgentConfirmation(prompt: string): Promise<string> {
  try {
    const result = await complete(prompt, {
      systemPrompt:
        "Eres el agente principal de OpenClaw Health. Confirmas cuando un backup se completó correctamente y reportas cualquier problema de forma concisa.",
      temperature: 0.4,
      maxTokens: 2048,
      timeoutMs: GATEWAY_LLM_TIMEOUT_MS,
    });
    return result.content.trim();
  } catch {
    return "Backup committed and pushed. Agent confirmation skipped (LLM provider unavailable).";
  }
}

async function setRunMessage(runId: string, message: string): Promise<void> {
  try {
    await prisma.backupRun.update({ where: { id: runId }, data: { message } });
  } catch {
    // ignore write errors during progress updates
  }
}

async function processBackupRun(runId: string): Promise<{ status: string; committedAt?: string; agentReply?: string; message?: string; error?: string }> {
  try {
    await setRunMessage(runId, "Copiando archivos...");
    await copyFilesToBackupRepo();

    await setRunMessage(runId, "Sanitizando secretos...");
    await sanitizeSecretsInDir(BACKUP_REPO_PATH);

    await setRunMessage(runId, "Preparando commit...");
    const now = new Date().toISOString();
    const defaultMessage = `Backup - ${now}`;

    execSync(`git -C "${BACKUP_REPO_PATH}" add -A`, { windowsHide: true });

    const status = execSync(`git -C "${BACKUP_REPO_PATH}" status --porcelain`, {
      encoding: "utf8",
      windowsHide: true,
    });

    if (!status.trim()) {
      await prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: "no_changes",
          finishedAt: new Date(),
          message: "No hay cambios nuevos para respaldar.",
        },
      });
      return { status: "no_changes", message: "No hay cambios nuevos para respaldar." };
    }

    await setRunMessage(runId, "Haciendo commit y push...");
    execSync(`git -C "${BACKUP_REPO_PATH}" commit -m "${defaultMessage}"`, { windowsHide: true });
    execSync(`git -C "${BACKUP_REPO_PATH}" push origin master`, { windowsHide: true });

    await setRunMessage(runId, "Esperando confirmación del agente (puede tardar)...");
    const promptsMd = await fs.readFile(PROMPTS_PATH, "utf8");
    const prompt = extractBackupPrompt(promptsMd);
    const agentReply = await askAgentConfirmation(prompt);

    await prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: "success",
        finishedAt: new Date(),
        committedAt: now,
        agentReply,
      },
    });

    return { status: "success", committedAt: now, agentReply };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: message,
      },
    });
    return { status: "failed", error: message };
  }
}

export async function POST() {
  const run = await prisma.backupRun.create({
    data: { status: "started" },
  });

  const result = await processBackupRun(run.id);

  if (result.status === "no_changes") {
    return NextResponse.json({ success: true, noChanges: true, message: result.message });
  }

  if (result.status === "failed") {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    runId: run.id,
    committedAt: result.committedAt,
    agentReply: result.agentReply,
  });
}
