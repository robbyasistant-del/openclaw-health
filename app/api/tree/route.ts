import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export interface TreeNode {
  name: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

const MAX_DEPTH = 3;

function isAllowedPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const allowedBases = [
    path.resolve(process.env.OPENCLAW_WORKSPACE_BASE || "C:\\Users\\robby\\.openclaw"),
    path.resolve("C:\\Users\\robby\\.openclaw"),
  ];
  return allowedBases.some((base) => resolved.startsWith(base));
}

async function readTree(targetPath: string, depth = 0): Promise<TreeNode[]> {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  // Ocultar node_modules, .git, .next y similares
  const excluded = ["node_modules", ".git", ".next", "dist", "build", "coverage"];

  for (const entry of entries) {
    if (excluded.includes(entry.name) || entry.name.startsWith(".")) continue;

    const node: TreeNode = {
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    };

    if (entry.isDirectory() && depth < MAX_DEPTH) {
      try {
        node.children = await readTree(path.join(targetPath, entry.name), depth + 1);
      } catch {
        node.children = [];
      }
    }

    nodes.push(node);
  }

  // Ordenar: directorios primero, luego archivos
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "directory" ? -1 : 1;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const target = searchParams.get("path");

  if (!target) {
    return NextResponse.json({ error: "Falta el parámetro path" }, { status: 400 });
  }

  if (!isAllowedPath(target)) {
    return NextResponse.json({ error: "Path no permitido" }, { status: 403 });
  }

  try {
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: "El path no es un directorio" }, { status: 400 });
    }

    const children = await readTree(target);

    return NextResponse.json({
      path: target,
      name: path.basename(target),
      children,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
