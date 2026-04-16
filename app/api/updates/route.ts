import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  lastTouchedAt: string;
  updateAvailable: boolean;
  githubUrl: string;
}

// Get local OpenClaw version from config
async function getLocalVersion(): Promise<{ version: string; lastTouchedAt: string }> {
  try {
    const configPath = path.join(process.env.HOME || process.env.USERPROFILE || "", ".openclaw", "openclaw.json");
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    
    return {
      version: config.meta?.lastTouchedVersion || "unknown",
      lastTouchedAt: config.meta?.lastTouchedAt || "unknown",
    };
  } catch (err) {
    console.error("Error reading local version:", err);
    return { version: "unknown", lastTouchedAt: "unknown" };
  }
}

// Get latest version from GitHub
async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch("https://github.com/openclaw/openclaw/releases/latest", {
      headers: {
        "Accept": "text/html",
        "User-Agent": "OpenClaw-Health-Check"
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    // Extract version from redirect URL or page title
    const finalUrl = response.url;
    const versionMatch = finalUrl.match(/\/tag\/(v?[\d.]+)/);
    if (versionMatch) {
      return versionMatch[1];
    }
    
    // Try parsing from HTML title
    const html = await response.text();
    const titleMatch = html.match(/Release\s+(openclaw\s+)?(v?[\d.]+)/i);
    if (titleMatch) {
      return titleMatch[2];
    }
    
    return null;
  } catch (err) {
    console.error("Error fetching latest version:", err);
    return null;
  }
}

export async function GET() {
  try {
    const localInfo = await getLocalVersion();
    const latestVersion = await getLatestVersion();
    
    // Compare versions (simple string comparison, can be enhanced with semver)
    const updateAvailable = latestVersion !== null && 
      localInfo.version !== "unknown" && 
      latestVersion !== localInfo.version;
    
    const versionInfo: VersionInfo = {
      currentVersion: localInfo.version,
      latestVersion: latestVersion,
      lastTouchedAt: localInfo.lastTouchedAt,
      updateAvailable: updateAvailable,
      githubUrl: "https://github.com/openclaw/openclaw/releases/latest",
    };
    
    return NextResponse.json(versionInfo);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, currentVersion: "unknown", latestVersion: null },
      { status: 500 }
    );
  }
}