import { NextResponse } from "next/server";
import { execSync } from "child_process";

const BACKUP_REPO_PATH = "C:\\Users\\robby\\.openclaw\\workspace\\openclaw-backups";

export async function GET() {
  try {
    const log = execSync(
      `git -C "${BACKUP_REPO_PATH}" log --pretty=format:"%H|%ci|%s" -n 50`,
      { encoding: "utf8", windowsHide: true }
    );

    const commits = log
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, ...messageParts] = line.split("|");
        return {
          hash: hash?.trim() || "",
          date: date?.trim() || "",
          message: messageParts.join("|").trim(),
        };
      });

    return NextResponse.json({ commits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ commits: [], error: message }, { status: 500 });
  }
}
