import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import type { StartupDocumentExtraction } from "@/dsl/vc";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: { documents: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  const unextracted = deal.documents.filter((d) => !d.extractedRaw);
  if (unextracted.length > 0) {
    return NextResponse.json(
      {
        error: "Cannot reconcile: some documents have not been extracted yet.",
        unextractedFiles: unextracted.map((d) => d.fileName),
      },
      { status: 409 },
    );
  }

  const extractions = deal.documents.map(
    (d) => d.extractedRaw as unknown as StartupDocumentExtraction,
  );

  const reconciliation = reconcileStartupExtractions(deal.id, deal.companyName, extractions);

  if (!reconciliation.startupDealSpec) {
    return NextResponse.json({ error: "Failed to produce startup deal spec" }, { status: 500 });
  }

  const spec = reconciliation.startupDealSpec;

  // Persist reconciled data atomically
  await db.$transaction(async (tx) => {
    // 1. Clean existing children
    await tx.startupFounder.deleteMany({ where: { dealId } });
    await tx.startupCapTable.deleteMany({ where: { dealId } });
    await tx.startupFinancingAsk.deleteMany({ where: { dealId } });
    await tx.startupRiskFlag.deleteMany({ where: { dealId } });
    await tx.startupCompetitor.deleteMany({ where: { dealId } });

    // 2. Persist founders
    if (spec.founders.length > 0) {
      await tx.startupFounder.createMany({
        data: spec.founders.map((f) => ({
          dealId,
          name: f.name,
          role: f.role,
          isTechnical: f.isTechnical,
          isRepeatFounder: f.isRepeatFounder,
          equityOwnershipPct: f.equityOwnershipPct ?? 0,
          vestingConfirmed: f.vestingConfirmed,
          linkedinUrl: f.linkedinUrl ?? null,
          priorExits: f.priorExits,
        })),
      });
    }

    // 3. Persist Cap Table
    await tx.startupCapTable.create({
      data: {
        dealId,
        foundersOwnershipPct: spec.capTable.foundersOwnershipPct ?? 80,
        investorOwnershipPct: spec.capTable.investorOwnershipPct ?? 10,
        optionPoolPct: spec.capTable.optionPoolPct ?? 10,
        safesNotesOutstandingUsd: spec.capTable.safesNotesOutstandingUsd ?? 0,
        safeHoldersJson: spec.capTable.safeHolders as any,
        commonHoldersJson: spec.capTable.commonHolders as any,
        hasDeadEquity: spec.capTable.hasDeadEquity ?? false,
        deadEquityNotes: spec.capTable.deadEquityNotes ?? null,
      },
    });

    // 4. Persist Financing Ask
    await tx.startupFinancingAsk.create({
      data: {
        dealId,
        targetRaiseUsd: spec.financingAsk.targetRaiseUsd ?? 1500000,
        instrumentType: spec.financingAsk.instrumentType,
        valuationCapUsd: spec.financingAsk.valuationCapUsd ?? null,
        discountPct: spec.financingAsk.discountPct ?? null,
        plannedRunwayMonths: spec.financingAsk.plannedRunwayMonths ?? 18,
        leadCommitted: spec.financingAsk.leadCommitted ?? false,
        committedAmountUsd: spec.financingAsk.committedAmountUsd ?? 0,
      },
    });

    // 5. Persist Risk Flags
    if (spec.riskFlags.length > 0) {
      await tx.startupRiskFlag.createMany({
        data: spec.riskFlags.map((rf) => ({
          dealId,
          category: rf.category,
          severity: rf.severity,
          description: rf.description,
        })),
      });
    }

    // 6. Persist Discovered/Reconciled Competitors
    if (spec.competitors.length > 0) {
      await tx.startupCompetitor.createMany({
        data: spec.competitors.map((c) => ({
          dealId,
          name: c.name,
          websiteUrl: c.websiteUrl ?? null,
          description: c.description,
          overlapDegree: c.overlapDegree,
          knownInvestors: c.knownInvestors,
          differentiation: c.differentiation ?? null,
          sourceUrl: c.sourceUrl ?? null,
          sourceVerified: c.sourceVerified,
          sourceHttpStatus: c.sourceHttpStatus ?? null,
          lastVerified: new Date(),
        })),
      });
    }

    // 7. Update deal status, industry, and core metadata
    await tx.startupDeal.update({
      where: { id: dealId },
      data: {
        companyName: spec.companyName,
        stage: spec.stage,
        primaryVertical: spec.primaryVertical,
        industry: spec.industry,
        subIndustries: spec.subIndustries,
        legalEntityJurisdiction: spec.legalEntityJurisdiction,
        status: "READY_TO_MATCH",
      },
    });
  });

  return NextResponse.json({
    dealId,
    readyForMatching: reconciliation.readyForMatching,
    reconciliationAudit: spec.reconciliationAudit,
    unresolvedRiskFlags: reconciliation.unresolvedRiskFlags,
  });
}
