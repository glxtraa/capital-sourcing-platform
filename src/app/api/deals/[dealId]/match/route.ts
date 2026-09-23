import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

/**
 * Manually (re-)trigger matching — used from the UI when a deal is
 * NEEDS_REVIEW (a human just edited/confirmed the extracted Deal Spec) or
 * when a user wants to re-run matching after the shared provider database
 * has been refreshed independently of this deal's own feedback loop.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  await inngest.send({ name: "deal/matching.requested", data: { dealId } });
  return NextResponse.json({ ok: true });
}
