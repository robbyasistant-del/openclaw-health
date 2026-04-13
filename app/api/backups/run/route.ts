import { NextResponse } from "next/server";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

const execAsync = promisify(exec);

const BACKUP_REPO_PATH = "C:\\Users\\robby\\.openclaw\\workspace\\openclaw-backups";
const WORKSPACE_ROOT = "C:\\Users\\robby\\.openclaw\\workspace";
const PROMPTS_PATH = "C:\\Users\\robby\\.openclaw\\workspace\\Product_openclaw_health\\prompts.md";

const FILES_TO_BACKUP = [
  "SOUL.md",
  "MEMORY.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "AGENTS.md",
  "BOOTSTRAP.md",
];

function extractBackupPrompt(markdown: string): string {
  const marker = "## BACKUP_V1";
  const start = markdown.indexOf(marker);
  if (start === -1) throw new Error("Prompt BACKUP_V1 no encontrado");
  const end = markdown.indexOf("##", start + marker.length);
  const block = end === -1 ? markdown.slice(start) : markdown.slice(start, end);
  return block.trim();
}

async function copyFilesToBackupRepo(): Promise<void> {
  for (const file of FILES_TO_BACKUP) {
    const src = path.join(WORKSPACE_ROOT, file);
    const dest = path.join(BACKUP_REPO_PATH, file);
    try {
      await fs.copyFile(src, dest);
    } catch {
      // skip missing files
    }
  }

  // Also copy this project's prompts.md into the backup repo
  try {
    const destPrompts = path.join(BACKUP_REPO_PATH, "prompts.md");
    await fs.copyFile(PROMPTS_PATH, destPrompts);
  } catch {
    // ignore
  }
}

async function sanitizeSecrets(): Promise<void> {
  const entries = await fs.readdir(BACKUP_REPO_PATH);
  for (const entry of entries) {
    const fullPath = path.join(BACKUP_REPO_PATH, entry);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;

    let content = await fs.readFile(fullPath, "utf8");
    let modified = false;

    // Simple secret patterns
    const patterns: { regex: RegExp; placeholder: string }[] = [
      { regex: /sk-[a-zA-Z0-9]{20,}/g, placeholder: "[OPENAI_API_KEY]" },
      { regex: /gho_[a-zA-Z0-9]{20,}/g, placeholder: "[GITHUB_TOKEN]" },
      { regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g, placeholder: "[GITHUB_TOKEN]" },
      { regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g, placeholder: "[BEARER_TOKEN]" },
      { regex: /api[_-]?key\s*[:=]\s*[\"']?[a-zA-Z0-9_\-]{10,}[\"']?/gi, placeholder: "[API_KEY]" },
      { regex: /password\s*[:=]\s*[\"']?[^\"'\s\n]{4,}[\"']?/gi, placeholder: "[PASSWORD]" },
      { regex: /token\s*[:=]\s*[\"']?[a-zA-Z0-9_\-]{10,}[\"']?/gi, placeholder: "[TOKEN]" },
      { regex: /secret\s*[:=]\s*[\"']?[a-zA-Z0-9_\-]{10,}[\"']?/gi, placeholder: "[SECRET]" },
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
  const escaped = prompt.replace(/"/g, '\\"');
  try {
    const { stdout } = await execAsync(
      `openclaw agent --agent main --to +15555550123 --message "${escaped}" --json --timeout 120`,
      {
        cwd: BACKUP_REPO_PATH,
        timeout: 130000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      }
    );

    const parsed = JSON.parse(stdout);
    const payloads = parsed?.payloads;
    if (Array.isArray(payloads) && payloads.length > 0 && typeof payloads[0]?.text === "string") {
      return payloads[0].text.trim();
    }
    if (typeof parsed?.text === "string") return parsed.text.trim();
    return stdout.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Agent confirmation unavailable: ${message}`;
  }
}

export async function POST() {
  try {
    // 1. Copy files
    await copyFilesToBackupRepo();

    // 2. Sanitize secrets
    await sanitizeSecrets();

    // 3. Git add / commit / push
    const now = new Date().toISOString();
    const defaultMessage = `Backup - ${now}`;

    execSync(`git -C "${BACKUP_REPO_PATH}" add -A`, { windowsHide: true });
    execSync(`git -C "${BACKUP_REPO_PATH}" commit -m "${defaultMessage}"`, { windowsHide: true });
    execSync(`git -C "${BACKUP_REPO_PATH}" push origin master`, { windowsHide: true });

    // 4. Read prompt and call agent
    const promptsMd = await fs.readFile(PROMPTS_PATH, "utf8");
    const prompt = extractBackupPrompt(promptsMd);
    const agentReply = await askAgentConfirmation(prompt);

    return NextResponse.json({
      success: true,
      committedAt: now,
      agentReply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
