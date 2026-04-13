import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_REPO_URL = "https://github.com/robbyasistant-del/openclaw-backups";
const CONFIG_KEY = "backup_repo_url";

export async function GET() {
  try {
    const config = await prisma.backupConfig.findUnique({
      where: { key: CONFIG_KEY },
    });
    return NextResponse.json({ repoUrl: config?.value || DEFAULT_REPO_URL });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl : DEFAULT_REPO_URL;

    await prisma.backupConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: repoUrl },
      create: { key: CONFIG_KEY, value: repoUrl },
    });

    return NextResponse.json({ repoUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
