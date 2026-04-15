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
  fileCount: number;
  dirCount: number;
  truncated: boolean;
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
  "out",
  "target", // Rust
  "bin",
  "obj", // C#
  "__pycache__",
  ".venv",
  "venv",
];

// Límites ajustados - escaneo profundo pero respuesta controlada
const MAX_DEPTH = 6;               // Profundidad de exploración
const MAX_ITEMS_IN_RESPONSE = 500; // Items devueltos en JSON (evita "Invalid string length")
const MAX_SCAN_DEPTH = 8;          // Profundidad máxima de escaneo para cálculo de tamaño

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

// Escanear directorio completamente - sin límite de items, solo profundidad
async function scanDirectoryComplete(
  targetPath: string,
  depth: number,
  counters: { fileCount: number; dirCount: number },
  forDisplay: boolean,
  maxDisplayItems: number,
  displayCounters: { count: number }
): Promise<{ size: number; items: ScanItem[]; truncated: boolean }> {
  // Límite de profundidad para escaneo
  if (depth > MAX_SCAN_DEPTH) {
    return { size: 0, items: [], truncated: true };
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const items: ScanItem[] = [];
  let totalSize = 0;
  let truncated = false;

  // Procesar todas las entradas (sin límite de conteo para precisión)
  for (const entry of entries) {
    // Skip excluidos y archivos ocultos
    if (EXCLUDED.includes(entry.name) || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      counters.dirCount++;

      try {
        // Escaneo recursivo completo para calcular tamaño
        const subResult = await scanDirectoryComplete(
          fullPath,
          depth + 1,
          counters,
          forDisplay,
          maxDisplayItems,
          displayCounters
        );

        const dirSize = subResult.size;
        totalSize += dirSize;

        // Solo incluir en items si estamos en modo display y no hemos alcanzado el límite
        if (forDisplay && depth < MAX_DEPTH && displayCounters.count < maxDisplayItems) {
          const children = subResult.items.length > 0 ? subResult.items : undefined;

          items.push({
            name: entry.name,
            path: fullPath,
            type: "directory",
            size: dirSize,
            sizeFormatted: formatBytes(dirSize),
            percent: 0, // Se calcula después
            children,
          });

          displayCounters.count++;
        }

        if (subResult.truncated) truncated = true;
      } catch {
        // Skip directories we can't read
      }
    } else if (entry.isFile()) {
      counters.fileCount++;

      try {
        const stats = await fs.stat(fullPath);
        const fileSize = stats.size;
        totalSize += fileSize;

        // Solo incluir archivos en el nivel 0 para el display
        // (los archivos en subdirectorios se agregan al conteo total pero no a items individuales)
        if (forDisplay && depth === 0 && displayCounters.count < maxDisplayItems) {
          items.push({
            name: entry.name,
            path: fullPath,
            type: "file",
            size: fileSize,
            sizeFormatted: formatBytes(fileSize),
            percent: 0, // Se calcula después
          });

          displayCounters.count++;
        }
      } catch {
        // Skip files we can't stat
      }
    }
  }

  // Sort by size descending (más grandes primero)
  items.sort((a, b) => b.size - a.size);

  return { size: totalSize, items, truncated };
}

function calculatePercentages(items: ScanItem[], totalSize: number): void {
  for (const item of items) {
    item.percent = totalSize > 0 ? Math.round((item.size / totalSize) * 1000) / 10 : 0;
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

    // Escaneo único completo - obtiene tamaño total y items para display
    const counters = { fileCount: 0, dirCount: 0 };
    const displayCounters = { count: 0 };

    const result = await scanDirectoryComplete(
      targetPath,
      0,
      counters,
      true, // forDisplay
      MAX_ITEMS_IN_RESPONSE,
      displayCounters
    );

    // Calcular porcentajes basado en el tamaño TOTAL real
    calculatePercentages(result.items, result.size);

    const scanTime = Date.now() - startTime;

    const response: ScanResponse = {
      path: targetPath,
      name: path.basename(targetPath),
      totalSize: result.size,
      totalSizeFormatted: formatBytes(result.size),
      itemCount: counters.fileCount + counters.dirCount,
      fileCount: counters.fileCount,
      dirCount: counters.dirCount,
      truncated: result.truncated,
      items: result.items,
    };

    return NextResponse.json({
      ...response,
      scanTimeMs: scanTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Scan API Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
