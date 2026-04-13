import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const runId = req.nextUrl.searchParams.get("runId");

    if (runId) {
      const run = await prisma.backupRun.findUnique({
        where: { id: runId },
      });
      return NextResponse.json({ run: run || null });
    }

    const latest = await prisma.backupRun.findFirst({
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ latest: latest || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
