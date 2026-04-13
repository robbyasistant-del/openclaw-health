import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const latest = await prisma.backupRun.findFirst({
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ latest: latest || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
