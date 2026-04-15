import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface FileOperationRequest {
  action: "delete" | "rename";
  path: string;
  newName?: string;
}

function isAllowedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const allowedBases = [
    path.resolve(process.env.OPENCLAW_WORKSPACE_BASE || "C:\\Users\\robby\\.openclaw"),
    path.resolve("C:\\Users\\robby\\.openclaw"),
  ];
  return allowedBases.some((base) => resolved.startsWith(base));
}

export async function POST(request: NextRequest) {
  try {
    const body: FileOperationRequest = await request.json();
    const { action, path: targetPath, newName } = body;

    if (!targetPath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    if (!isAllowedPath(targetPath)) {
      return NextResponse.json({ error: "Path no permitido" }, { status: 403 });
    }

    if (action === "delete") {
      try {
        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.unlink(targetPath);
        }
        return NextResponse.json({ success: true, message: "Eliminado correctamente" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Error al eliminar: ${message}` }, { status: 500 });
      }
    }

    if (action === "rename") {
      if (!newName || newName.includes("..") || newName.includes("/") || newName.includes("\\")) {
        return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
      }

      try {
        const parentDir = path.dirname(targetPath);
        const newPath = path.join(parentDir, newName);
        
        if (!isAllowedPath(newPath)) {
          return NextResponse.json({ error: "Nuevo path no permitido" }, { status: 403 });
        }

        await fs.rename(targetPath, newPath);
        return NextResponse.json({ success: true, message: "Renombrado correctamente", newPath });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Error al renombrar: ${message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
