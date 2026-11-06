import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchTradeDeal } from "@/lib/trade-matching";
import { reconcileTradeExtractions } from "@/agents/trade/trade-reconciliation";
import type { TradeDocumentExtraction } from "@/dsl/trade";
import { isBlockingRiskFlag } from "@/dsl/provenance";
import { getTaintPolicyMap } from "@/lib/taint-policy";

export const maxDuration = 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      parties: true,
      contractLegs: true,
      financingAsks: true,
      riskFlags: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Trade deal not found" }, { status: 404 });
  }

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

  await db.tradeDeal.update({ where: { id: dealId }, data: { status: "MATCHING" } });

  try {
    const policyMap = await getTaintPolicyMap("TRADE");
    const { resolveAuthoritativeTradeDealSpec } = await import("@/agents/trade/trade-reconciliation");
    const spec = resolveAuthoritativeTradeDealSpec(deal, policyMap);

    const funders = await db.tradeFunder.findMany({
      include: { documentsRequired: true },
    });

    const matchResult = matchTradeDeal(
      spec,
      funders,
      deal.documents,
      { relaxInferredBlockers: Boolean(body?.relaxInferredBlockers) },
    );

    // Collect all matches across Umbrella and Modular Legs
    // Keep EXCLUDED matches so users can inspect reasons why a funder did not qualify!
    const matchesToCreate = [
      ...matchResult.umbrellaMatches.map((m) => ({
        dealId,
        funderId: m.funderId,
        isUmbrella: true,
        verdict: m.verdict,
        rationale: m.rationale,
        isTier1: m.isTier1,
      })),
      ...matchResult.modularMatches.supplierLegMatches.map((m) => ({
        dealId,
        funderId: m.funderId,
        isUmbrella: false,
        verdict: m.verdict,
        rationale: `[Supplier Leg] ${m.rationale}`,
        isTier1: false,
      })),
      ...matchResult.modularMatches.traderLegMatches.map((m) => ({
        dealId,
        funderId: m.funderId,
        isUmbrella: false,
        verdict: m.verdict,
        rationale: `[Trader Leg] ${m.rationale}`,
        isTier1: false,
      })),
      ...matchResult.modularMatches.buyerLegMatches.map((m) => ({
        dealId,
        funderId: m.funderId,
        isUmbrella: false,
        verdict: m.verdict,
        rationale: `[Buyer Leg] ${m.rationale}`,
        isTier1: false,
      })),
    ];

    // Deduplicate by funderId (prioritize GOOD/POSSIBLE over EXCLUDED, and Umbrella over Modular)
    const scoreVerdict = (v: string) => (v === "GOOD" ? 3 : v === "POSSIBLE" ? 2 : 1);
    const matchMap = new Map<string, typeof matchesToCreate[0]>();
    for (const item of matchesToCreate) {
      const existing = matchMap.get(item.funderId);
      if (!existing) {
        matchMap.set(item.funderId, item);
      } else {
        const scoreExisting = scoreVerdict(existing.verdict) + (existing.isUmbrella ? 1 : 0);
        const scoreNew = scoreVerdict(item.verdict) + (item.isUmbrella ? 1 : 0);
        if (scoreNew > scoreExisting) {
          matchMap.set(item.funderId, item);
        }
      }
    }
    const uniqueMatches = Array.from(matchMap.values());

    // Persist matches transactionally
    await db.$transaction(async (tx) => {
      await tx.tradeFunderMatchModel.deleteMany({ where: { dealId } });

      if (uniqueMatches.length > 0) {
        await tx.tradeFunderMatchModel.createMany({ data: uniqueMatches });
      }

      await tx.tradeDeal.update({
        where: { id: dealId },
        data: { status: "COMPLETE" },
      });
    });

    const eligibleUmbrellas = matchResult.umbrellaMatches.filter(
      (m) => m.verdict === "GOOD" || m.verdict === "POSSIBLE",
    );

    return NextResponse.json({
      dealId,
      eligibleCount: uniqueMatches.length,
      umbrellaCount: eligibleUmbrellas.length,
      matchResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Matching failed: ${message}` },
      { status: 500 },
    );
  }
}
