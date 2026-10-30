import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchTradeDeal } from "@/lib/trade-matching";
import { reconcileTradeExtractions } from "@/agents/trade/trade-reconciliation";
import { runTradeBenchmark } from "@/agents/trade/trade-benchmark-agent";
import type { TradeDocumentExtraction } from "@/dsl/trade";

export const maxDuration = 300;

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

  try {
    const { resolveAuthoritativeTradeDealSpec } = await import("@/agents/trade/trade-reconciliation");
    const spec = resolveAuthoritativeTradeDealSpec(deal);

    const funders = await db.tradeFunder.findMany({
      include: { documentsRequired: true },
    });

    const funderSourcesMap: Record<string, { sources: string[]; contact?: string | null }> = {};
    for (const f of funders) {
      funderSourcesMap[f.id] = { sources: f.sources ?? [], contact: f.contact };
    }

    const matchingResult = matchTradeDeal(
      spec,
      funders,
      deal.documents,
    );

    const termSheetOutput = await runTradeBenchmark({
      spec,
      matchingResult,
      funderSourcesMap,
    });

    // Persist term sheet
    const createdTermSheet = await db.tradeTermSheetModel.create({
      data: {
        dealId,
        facilityType: termSheetOutput.deterministicTerms.facilityType === "SINGLE_UMBRELLA_FACILITY" ? "UMBRELLA" : "MODULAR_SYNDICATE",
        leadFunderName: termSheetOutput.deterministicTerms.leadFunderName,
        facilityLimitUsd: termSheetOutput.deterministicTerms.totalFacilityAmountUsd,
        blendedPricing: termSheetOutput.deterministicTerms.blendedPricingPcnt,
        pricingFormula: termSheetOutput.deterministicTerms.pricingFormula,
        advanceRatePct: termSheetOutput.deterministicTerms.advanceRatePct,
        tenorDaysMax: termSheetOutput.deterministicTerms.maximumTenorDays,
        securityTerms: termSheetOutput.facilityStructure.securityPackage,
        conditionsPrecedent: termSheetOutput.facilityStructure.conditionsPrecedent,
        benchmarkTableJson: JSON.parse(JSON.stringify(termSheetOutput.benchmarkTable)),
      },
    });

    return NextResponse.json({
      dealId,
      termSheetId: createdTermSheet.id,
      termSheet: termSheetOutput,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Benchmark failed: ${message}` },
      { status: 500 },
    );
  }
}
