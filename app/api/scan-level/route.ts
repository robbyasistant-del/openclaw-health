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
  fileCount?: number;
  dirCount?: number;
}

const EXCLUDED = [
  "node_modules", ".git", ".next", "dist", "build", "coverage",
  ".cache", ".turbo", "out", "target", "bin", "obj", "__pycache__",
  ".venv", "venv",
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
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

// Calcular tamaño total de un directorio (recursivo, sin construir árbol)
async function getDirectorySize(
  dirPath: string
): Promise<{ size: number; fileCount: number; dirCount: number }> {
  let size = 0;
  let fileCount = 0;
  let dirCount = 0;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED.includes(entry.name) || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      dirCount++;
      try {
        const subResult = await getDirectorySize(fullPath);
        size += subResult.size;
        fileCount += subResult.fileCount;
        dirCount += subResult.dirCount;
      } catch {
        // Skip
      }
    } else if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        size += stats.size;
        fileCount++;
      } catch {
        // Skip
      }
    }
  }

  return { size, fileCount, dirCount };
}

// Escanear UN nivel de directorio y calcular tamaños recursivamente para cada item
async function scanOneLevel(
  targetPath: string,
  parentTotalSize: number
): Promise<{ items: ScanItem[]; totalSize: number; fileCount: number; dirCount: number }> {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const items: ScanItem[] = [];
  let totalSize = 0;
  let totalFileCount = 0;
  let totalDirCount = 0;

  // Procesar cada entrada del nivel 1
  for (const entry of entries) {
    if (EXCLUDED.includes(entry.name) || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      // Escanear recursivamente esta carpeta para obtener su tamaño total
      const { size, fileCount, dirCount } = await getDirectorySize(fullPath);
      
      totalSize += size;
      totalFileCount += fileCount;
      totalDirCount += dirCount + 1; // +1 por esta carpeta misma

      items.push({
        name: entry.name,
        path: fullPath,
        type: "directory",
        size,
        sizeFormatted: formatBytes(size),
        percent: parentTotalSize > 0 ? Math.round((size / parentTotalSize) * 1000) / 10 : 0,
        fileCount,
        dirCount,
      });
    } else if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        const fileSize = stats.size;
        totalSize += fileSize;
        totalFileCount++;

        items.push({
          name: entry.name,
          path: fullPath,
          type: "file",
          size: fileSize,
          sizeFormatted: formatBytes(fileSize),
          percent: parentTotalSize > 0 ? Math.round((fileSize / parentTotalSize) * 1000) / 10 : 0,
        });
      } catch {
        // Skip
      }
    }
  }

  // Ordenar por tamaño descendente
  items.sort((a, b) => b.size - a.size);

  return { items, totalSize, fileCount: totalFileCount, dirCount: totalDirCount };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetPath = searchParams.get("path");
  const parentSize = parseInt(searchParams.get("parentSize") || "0", 10);

  if (!targetPath) {
    return NextResponse.json({ error: "Falta el parámetro path" }, { status: 400 });
  }

  if (!isAllowedPath(targetPath)) {
    return NextResponse.json({ error: "Path no permitido" }, { status: 403 });
  }

  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: "El path no es un directorio" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "No se puede acceder al directorio" }, { status: 404 });
  }

  try {
    const result = await scanOneLevel(targetPath, parentSize);

    return NextResponse.json({
      path: targetPath,
      name: path.basename(targetPath),
      items: result.items,
      totalSize: result.totalSize,
      totalSizeFormatted: formatBytes(result.totalSize),
      fileCount: result.fileCount,
      dirCount: result.dirCount,
      itemCount: result.fileCount + result.dirCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Scan Level Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
