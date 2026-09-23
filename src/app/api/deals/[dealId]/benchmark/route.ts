import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runLenderBenchmark } from "@/agents/benchmark-agent";

/**
 * The productionized `lender-benchmark` skill, exposed as an on-demand
 * action ("Benchmark this deal for a new lender" button), not part of the
 * automatic pipeline. Synchronous (not an Inngest event) because a single
 * Claude call here is well within a normal serverless function timeout —
 * unlike provider research, it doesn't loop on web search.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      parties: true,
      financingAsks: true,
      riskFlags: true,
      providerMatches: { include: { provider: true } },
    },
  });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });
  if (deal.providerMatches.length === 0) {
    return NextResponse.json(
      { error: "Run matching before requesting a lender benchmark — there's nothing to benchmark against yet." },
      { status: 409 },
    );
  }

  const output = await runLenderBenchmark({
    deal,
    parties: deal.parties,
    financingAsks: deal.financingAsks,
    riskFlags: deal.riskFlags,
    matches: deal.providerMatches,
  });

  const termSheet = await db.termSheet.create({
    data: {
      dealId,
      proposedRatePct: output.proposedRatePct,
      rateRationale: output.rateRationale,
      advanceRatePct: output.advanceRatePct,
      tenorDaysMin: output.tenorDaysMin,
      tenorDaysMax: output.tenorDaysMax,
      tenorNote: output.tenorNote,
      currency: output.currency,
      securityTerms: output.securityTerms,
      conditionsPrecedent: output.conditionsPrecedent,
      benchmarkTableJson: output.benchmarkTable,
      leverageAssessment: output.leverageAssessment,
    },
  });

  return NextResponse.json(termSheet, { status: 201 });
}
