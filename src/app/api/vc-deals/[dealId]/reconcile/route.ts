import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import type { StartupDocumentExtraction } from "@/dsl/vc";
import { getTaintPolicyMap } from "@/lib/taint-policy";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: { documents: true, riskFlags: true },
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

  const policyMap = await getTaintPolicyMap("VC");
  const existingFlagMap = new Map(
    deal.riskFlags.map((rf) => [
      `${rf.category}::${rf.description.trim().toLowerCase()}`,
      rf,
    ]),
  );

  const extractions = deal.documents.map((d) => ({
    ...(d.extractedRaw as unknown as StartupDocumentExtraction),
    _taintOverride: d.taintOverride,
    _fileName: d.fileName,
  }));

  const reconciliation = reconcileStartupExtractions(
    deal.id,
    deal.companyName,
    extractions,
    policyMap,
  );

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
        foundersOwnershipPct: spec.capTable.foundersOwnershipPct ?? null,
        investorOwnershipPct: spec.capTable.investorOwnershipPct ?? null,
        optionPoolPct: spec.capTable.optionPoolPct ?? null,
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
        targetRaiseUsd: spec.financingAsk.targetRaiseUsd ?? null,
        instrumentType: spec.financingAsk.instrumentType ?? null,
        valuationCapUsd: spec.financingAsk.valuationCapUsd ?? null,
        discountPct: spec.financingAsk.discountPct ?? null,
        plannedRunwayMonths: spec.financingAsk.plannedRunwayMonths ?? null,
        leadCommitted: spec.financingAsk.leadCommitted ?? false,
        committedAmountUsd: spec.financingAsk.committedAmountUsd ?? 0,
      },
    });

    // 5. Persist Risk Flags (preserving human verification status)
    if (spec.riskFlags.length > 0) {
      await tx.startupRiskFlag.createMany({
        data: spec.riskFlags.map((rf) => {
          const prev = existingFlagMap.get(
            `${rf.category}::${rf.description.trim().toLowerCase()}`,
          );
          return {
            dealId,
            category: rf.category,
            severity: rf.severity,
            description: rf.description,
            sourceFileName: rf.sourceFileName ?? prev?.sourceFileName ?? null,
            evidenceSnippet: rf.evidenceSnippet ?? prev?.evidenceSnippet ?? null,
            resolved: prev?.resolved ?? false,
            verificationStatus: prev?.verificationStatus ?? "UNVERIFIED",
            verifiedBy: prev?.verifiedBy ?? null,
            verifiedAt: prev?.verifiedAt ?? null,
            verificationNotes: prev?.verificationNotes ?? null,
          };
        }),
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
