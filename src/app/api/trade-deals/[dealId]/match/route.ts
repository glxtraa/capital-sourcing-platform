import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchTradeDeal } from "@/lib/trade-matching";
import { reconcileTradeExtractions } from "@/agents/trade/trade-reconciliation";
import type { TradeDocumentExtraction } from "@/dsl/trade";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      parties: true,
      contractLegs: true,
      financingAsks: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Trade deal not found" }, { status: 404 });
  }

  await db.tradeDeal.update({ where: { id: dealId }, data: { status: "MATCHING" } });

  try {
    const extractions = deal.documents
      .map((d) => d.extractedRaw)
      .filter(Boolean) as unknown as TradeDocumentExtraction[];

    const reconciliation = reconcileTradeExtractions(deal.id, deal.name, extractions);
    if (!reconciliation.tradeDealSpec) {
      return NextResponse.json(
        { error: "Trade deal has not been reconciled. Please run reconcile first." },
        { status: 400 },
      );
    }

    const funders = await db.tradeFunder.findMany({
      include: { documentsRequired: true },
    });

    const matchResult = matchTradeDeal(
      reconciliation.tradeDealSpec,
      funders,
      deal.documents,
    );

    const matchesToCreate = [
      ...matchResult.umbrellaMatches.map((m) => ({
        dealId,
        funderId: m.funderId,
        isUmbrella: true,
        verdict: m.verdict,
        rationale: m.rationale,
        isTier1: m.isTier1,
      })),
      ...matchResult.modularMatches.supplierLegMatches
        .filter((m) => m.verdict === "POSSIBLE")
        .map((m) => ({
          dealId,
          funderId: m.funderId,
          isUmbrella: false,
          verdict: m.verdict,
          rationale: `[Supplier Leg] ${m.rationale}`,
          isTier1: false,
        })),
      ...matchResult.modularMatches.traderLegMatches
        .filter((m) => m.verdict === "POSSIBLE")
        .map((m) => ({
          dealId,
          funderId: m.funderId,
          isUmbrella: false,
          verdict: m.verdict,
          rationale: `[Trader Leg] ${m.rationale}`,
          isTier1: false,
        })),
      ...matchResult.modularMatches.buyerLegMatches
        .filter((m) => m.verdict === "POSSIBLE")
        .map((m) => ({
          dealId,
          funderId: m.funderId,
          isUmbrella: false,
          verdict: m.verdict,
          rationale: `[Buyer Leg] ${m.rationale}`,
          isTier1: false,
        })),
    ];

    // Deduplicate by (dealId, funderId)
    const uniqueMatches = Array.from(
      new Map(matchesToCreate.map((item) => [item.funderId, item])).values(),
    );

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
