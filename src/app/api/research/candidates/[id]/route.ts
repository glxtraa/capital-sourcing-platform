import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createProfileBatch } from "@/lib/research-runner";

const BodySchema = z.object({ action: z.enum(["promote", "reject"]) });

/**
 * reject: hide the candidate. promote: queue a PROFILE batch that builds a
 * full Provider record (then onboarding research); the client drives the
 * returned batch via /api/research/batches/:id/step.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "action must be promote or reject" }, { status: 400 });

  const candidate = await db.providerCandidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (parsed.data.action === "reject") {
    await db.providerCandidate.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ ok: true });
  }
  if (candidate.status === "PROMOTED") return NextResponse.json({ error: "already promoted" }, { status: 409 });
  return NextResponse.json(await createProfileBatch(id));
}
