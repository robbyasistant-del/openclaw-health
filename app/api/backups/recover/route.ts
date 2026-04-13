import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

const BACKUP_REPO_PATH = "C:\\Users\\robby\\.openclaw\\workspace\\openclaw-backups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const commitHash = body?.commitHash;

    if (!commitHash || typeof commitHash !== "string") {
      return NextResponse.json({ error: "Falta commitHash" }, { status: 400 });
    }

    execSync(`git -C "${BACKUP_REPO_PATH}" checkout ${commitHash}`, {
      windowsHide: true,
    });

    return NextResponse.json({
      success: true,
      message: `Restored to commit ${commitHash}. Local backup repo now at this version.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
