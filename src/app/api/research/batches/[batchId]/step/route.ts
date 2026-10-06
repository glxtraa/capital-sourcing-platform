import { NextResponse } from "next/server";
import { stepBatch } from "@/lib/research-runner";
import { db } from "@/lib/db";

// One model call per request (see research-runner.ts); the client loops until progress.done_.
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  if (!(await db.researchBatch.findUnique({ where: { id: batchId }, select: { id: true } }))) {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  return NextResponse.json(await stepBatch(batchId));
}
