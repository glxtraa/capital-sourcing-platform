import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchAllProviders, buildMatchInputs } from "@/lib/matching";

/**
 * Runs the mechanical provider filter against the CURRENT provider table and
 * persists the result -- nothing else. No LLM or web-search work happens
 * here, so this is a fast, DB-only request that can't hit Vercel Hobby's
 * 60s function cap.
 *
 * The "zero eligible providers -> research a new one -> try again" feedback
 * loop used to run inside this same request (up to three research attempts,
 * each a web search plus two LLM calls). That could run well past 60s and
 * get killed mid-request, leaving the deal stuck in MATCHING/RESEARCHING.
 * It's now driven by the caller instead (DealActions.runMatch): call this
 * route; if it reports zero eligible providers, call
 * POST .../research (one step per request, see that route) and then this
 * route again, up to a small attempt cap. Each individual request stays
 * short, and re-running is always safe -- this route recomputes everything
 * from current state.
 */
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { parties: true, financingAsks: true },
  });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  await db.deal.update({ where: { id: dealId }, data: { status: "MATCHING" } });

  try {
    const { dealInput, askInput } = buildMatchInputs(deal.parties, deal.financingAsks);
    const providers = await db.provider.findMany();
    const results = matchAllProviders(providers, dealInput, askInput);
    const eligibleCount = results.filter((r) => r.eligibleOnPaper).length;

    // In a fuller build this step also calls an LLM (mirroring deal-intake's
    // "don't stop at the mechanical script's output -- reason about gating
    // factors" rule) to write the per-match `rationale` and set
    // `verdict`/`isTier1` with real judgment instead of just
    // eligibleOnPaper. Left as a straightforward mechanical mapping here to
    // keep this route's scope legible.
    await db.$transaction([
      db.providerMatch.deleteMany({ where: { dealId } }),
      db.providerMatch.createMany({
        data: results.map((r) => ({
          dealId,
          providerId: r.providerId,
          verdict: r.eligibleOnPaper ? "POSSIBLE" : "EXCLUDED",
          rationale: r.reasons.join("; ") || "No disqualifying factors found by the mechanical pre-filter.",
          isTier1: r.eligibleOnPaper,
        })),
      }),
      db.deal.update({ where: { id: dealId }, data: { status: "COMPLETE" } }),
    ]);

    return NextResponse.json({ dealId, eligibleCount });
  } catch (error) {
    return NextResponse.json(
      { error: `Matching failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
