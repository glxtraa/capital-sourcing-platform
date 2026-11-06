import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchStartupDeal } from "@/lib/vc-matching";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import { runVCBenchmark } from "@/agents/vc/vc-benchmark-agent";
import type { StartupDocumentExtraction } from "@/dsl/vc";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      founders: true,
      capTable: true,
      financingAsks: true,
      riskFlags: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  try {
    const { resolveAuthoritativeStartupDealSpec } = await import("@/agents/vc/vc-reconciliation");
    const spec = resolveAuthoritativeStartupDealSpec(deal);

    const investors = await db.startupInvestor.findMany({
      include: { documentsRequired: true },
    });

    const matchingResult = matchStartupDeal(
      spec,
      investors,
      deal.documents,
    );

    const termSheetOutput = await runVCBenchmark({
      spec,
      matchingResult,
    });

    return NextResponse.json({
      dealId,
      benchmark: termSheetOutput,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Benchmarking failed: ${message}` }, { status: 500 });
  }
}
