import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export interface ScanItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  sizeFormatted: string;
  percent: number;
  children?: ScanItem[];
}

export interface ScanResponse {
  path: string;
  name: string;
  totalSize: number;
  totalSizeFormatted: string;
  itemCount: number;
  items: ScanItem[];
}

const EXCLUDED = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".turbo",
];

function isAllowedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const allowedBases = [
    path.resolve(process.env.OPENCLAW_WORKSPACE_BASE || "C:\\Users\\robby\\.openclaw"),
    path.resolve("C:\\Users\\robby\\.openclaw"),
  ];
  return allowedBases.some((base) => resolved.startsWith(base));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function scanDirectory(targetPath: string): Promise<{
  items: ScanItem[];
  totalSize: number;
  itemCount: number;
}> {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const items: ScanItem[] = [];
  let totalSize = 0;
  let itemCount = 0;

  for (const entry of entries) {
    if (EXCLUDED.includes(entry.name) || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      try {
        const result = await scanDirectory(fullPath);
        const dirSize = result.totalSize;
        
        items.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          size: dirSize,
          sizeFormatted: formatBytes(dirSize),
          percent: 0,
          children: result.items,
        });
        
        totalSize += dirSize;
        itemCount += result.itemCount + 1;
      } catch {
        // Skip directories we can't read
      }
    } else if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        const fileSize = stats.size;
        
        items.push({
          name: entry.name,
          path: fullPath,
          type: "file",
          size: fileSize,
          sizeFormatted: formatBytes(fileSize),
          percent: 0,
        });
        
        totalSize += fileSize;
        itemCount++;
      } catch {
        // Skip files we can't stat
      }
    }
  }

  // Sort by size descending
  items.sort((a, b) => b.size - a.size);

  return { items, totalSize, itemCount };
}

function calculatePercentages(items: ScanItem[], totalSize: number): void {
  for (const item of items) {
    item.percent = totalSize > 0 ? Math.round((item.size / totalSize) * 100) : 0;
    if (item.children) {
      calculatePercentages(item.children, totalSize);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: targetPath } = body;

    if (!targetPath || typeof targetPath !== "string") {
      return NextResponse.json(
        { error: "Falta el parámetro path" },
        { status: 400 }
      );
    }

    if (!isAllowedPath(targetPath)) {
      return NextResponse.json(
        { error: "Path no permitido" },
        { status: 403 }
      );
    }

    try {
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { error: "El path no es un directorio" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "No se puede acceder al directorio" },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const { items, totalSize, itemCount } = await scanDirectory(targetPath);
    calculatePercentages(items, totalSize);
    const scanTime = Date.now() - startTime;

    const response: ScanResponse = {
      path: targetPath,
      name: path.basename(targetPath),
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      itemCount,
      items,
    };

    return NextResponse.json({
      ...response,
      scanTimeMs: scanTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
