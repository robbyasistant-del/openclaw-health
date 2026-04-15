import { NextRequest } from "next/server";
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

// Estructura ligera para acumulación interna (sin metadata pesada)
interface DirInfo {
  name: string;
  path: string;
  size: number;
  children?: DirInfo[];
}

// Escanea recursivamente acumulando tamaños
async function scanRecursive(
  targetPath: string,
  globalCounters: { fileCount: number; dirCount: number },
  onProgress: (size: number) => void
): Promise<{ size: number; topItems: DirInfo[] }> {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  let totalSize = 0;
  const topItems: DirInfo[] = [];

  // Separar archivos y directorios
  const fileEntries = entries.filter(e => 
    e.isFile() && !EXCLUDED.includes(e.name) && !e.name.startsWith(".")
  );
  const dirEntries = entries.filter(e => 
    e.isDirectory() && !EXCLUDED.includes(e.name) && !e.name.startsWith(".")
  );

  // Procesar archivos
  for (const entry of fileEntries) {
    const fullPath = path.join(targetPath, entry.name);
    try {
      const stats = await fs.stat(fullPath);
      const fileSize = stats.size;
      totalSize += fileSize;
      globalCounters.fileCount++;

      topItems.push({
        name: entry.name,
        path: fullPath,
        size: fileSize,
      });

      // Reportar progreso cada 100 archivos
      if (globalCounters.fileCount % 100 === 0) {
        onProgress(totalSize);
      }
    } catch {
      // Skip
    }
  }

  // Procesar directorios recursivamente
  for (const entry of dirEntries) {
    const fullPath = path.join(targetPath, entry.name);
    globalCounters.dirCount++;

    try {
      // Escanear subdirectorio
      const subResult = await scanRecursive(fullPath, globalCounters, onProgress);
      
      totalSize += subResult.size;
      
      topItems.push({
        name: entry.name,
        path: fullPath,
        size: subResult.size,
      });

      // Reportar progreso
      if (globalCounters.dirCount % 10 === 0) {
        onProgress(totalSize);
      }
    } catch {
      // Skip directorios sin acceso
    }
  }

  // Ordenar por tamaño descendente
  topItems.sort((a, b) => b.size - a.size);

  return { size: totalSize, topItems };
}

// Convierte DirInfo a ScanItem con children limitados
function convertToScanItems(
  dirInfos: DirInfo[],
  totalSize: number,
  maxChildrenDepth: number,
  currentDepth: number = 0
): ScanItem[] {
  return dirInfos.map(info => {
    const percent = totalSize > 0 ? Math.round((info.size / totalSize) * 1000) / 10 : 0;
    
    const item: ScanItem = {
      name: info.name,
      path: info.path,
      type: info.children ? "directory" : "file",
      size: info.size,
      sizeFormatted: formatBytes(info.size),
      percent,
    };

    // Solo incluir children si estamos en profundidad permitida
    if (info.children && currentDepth < maxChildrenDepth) {
      item.children = convertToScanItems(info.children, totalSize, maxChildrenDepth, currentDepth + 1);
    }

    return item;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetPath = searchParams.get("path");

  if (!targetPath) {
    return new Response(
      `data: ${JSON.stringify({ error: "Falta el parámetro path" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  if (!isAllowedPath(targetPath)) {
    return new Response(
      `data: ${JSON.stringify({ error: "Path no permitido" })}\n\n`,
      { status: 403, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      return new Response(
        `data: ${JSON.stringify({ error: "El path no es un directorio" })}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  } catch {
    return new Response(
      `data: ${JSON.stringify({ error: "No se puede acceder al directorio" })}\n\n`,
      { status: 404, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();
  const globalCounters = { fileCount: 0, dirCount: 0 };

  const stream = new ReadableStream({
    async start(controller) {
      // Enviar inicio
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "start", path: targetPath })}\n\n`)
      );

      let lastReportedSize = 0;
      let lastReportTime = Date.now();
      let itemCountAtLastReport = 0;

      const reportProgress = (currentSize: number) => {
        const now = Date.now();
        const currentItemCount = globalCounters.fileCount + globalCounters.dirCount;
        
        // Reportar cada 2 segundos o cuando hay cambios significativos
        if (now - lastReportTime > 2000 || 
            Math.abs(currentSize - lastReportedSize) > 52428800 || // 50MB
            Math.abs(currentItemCount - itemCountAtLastReport) > 1000) {
          
          lastReportedSize = currentSize;
          lastReportTime = now;
          itemCountAtLastReport = currentItemCount;
          
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                totalSize: currentSize,
                totalSizeFormatted: formatBytes(currentSize),
                fileCount: globalCounters.fileCount,
                dirCount: globalCounters.dirCount,
                itemCount: currentItemCount,
                elapsedMs: now - startTime,
              })}\n\n`
            )
          );
        }
      };

      try {
        // Escanear TODO el directorio
        const result = await scanRecursive(targetPath, globalCounters, reportProgress);

        // Limitar items top-level a mostrar (los más grandes)
        const MAX_TOP_ITEMS = 100;
        const limitedTopItems = result.topItems.slice(0, MAX_TOP_ITEMS);

        // Convertir a ScanItems con children limitados a profundidad 1
        // (para evitar JSON masivo)
        const scanItems = convertToScanItems(limitedTopItems, result.size, 1);

        // Enviar resultado completo
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "complete",
              path: targetPath,
              name: path.basename(targetPath),
              totalSize: result.size,
              totalSizeFormatted: formatBytes(result.size),
              itemCount: globalCounters.fileCount + globalCounters.dirCount,
              fileCount: globalCounters.fileCount,
              dirCount: globalCounters.dirCount,
              items: scanItems,
              truncated: result.topItems.length > MAX_TOP_ITEMS,
              totalItemsFound: result.topItems.length,
              elapsedMs: Date.now() - startTime,
            })}\n\n`
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[Scan Stream Error]", message);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
