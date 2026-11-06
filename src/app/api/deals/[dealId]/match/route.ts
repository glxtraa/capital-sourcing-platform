import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchAllProviders, buildMatchInputs } from "@/lib/matching";
import { isBlockingRiskFlag } from "@/dsl/provenance";

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { parties: true, financingAsks: true, riskFlags: true },
  });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const blockingFlags = deal.riskFlags.filter((rf) => isBlockingRiskFlag(rf));
  if (blockingFlags.length > 0) {
    return NextResponse.json(
      {
        error: `Matching blocked: ${blockingFlags.length} high-severity or security risk flag(s) require Human Verification ("Verify Safe" or "Waive with Notes") in Step 2 before running Capital Matching.`,
        blockingFlags,
      },
      { status: 409 },
    );
  }

  await db.deal.update({ where: { id: dealId }, data: { status: "MATCHING" } });

  try {
    const { dealInput, askInput } = buildMatchInputs(deal.parties, deal.financingAsks);
    const providers = await db.provider.findMany();
    const results = matchAllProviders(providers, dealInput, askInput, {
      relaxInferredBlockers: Boolean(body?.relaxInferredBlockers),
    });
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
