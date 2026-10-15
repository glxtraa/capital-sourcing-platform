import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchStartupDeal } from "@/lib/vc-matching";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import type { StartupDocumentExtraction } from "@/dsl/vc";

export const maxDuration = 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;
  const body = await req.json().catch(() => null);

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      founders: true,
      capTable: true,
      financingAsks: true,
      riskFlags: true,
      competitors: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  await db.startupDeal.update({ where: { id: dealId }, data: { status: "MATCHING" } });

  try {
    const extractions = deal.documents
      .map((d) => d.extractedRaw)
      .filter(Boolean) as unknown as StartupDocumentExtraction[];

    const reconciliation = reconcileStartupExtractions(deal.id, deal.companyName, extractions);
    const spec = reconciliation.startupDealSpec;
    if (!spec) {
      return NextResponse.json(
        { error: "Startup deal has not been reconciled. Please run reconcile first." },
        { status: 400 },
      );
    }

    if (spec.competitors.length === 0 && deal.competitors.length > 0) {
      spec.competitors = deal.competitors.map((c) => ({
        name: c.name,
        websiteUrl: c.websiteUrl,
        description: c.description,
        overlapDegree: (c.overlapDegree as "DIRECT" | "INDIRECT" | "ADJACENT") || "DIRECT",
        knownInvestors: c.knownInvestors,
        differentiation: c.differentiation,
        sourceUrl: c.sourceUrl,
        sourceVerified: c.sourceVerified,
        sourceHttpStatus: c.sourceHttpStatus,
      }));
    }
    if (deal.industry) spec.industry = deal.industry;
    if (deal.subIndustries && deal.subIndustries.length > 0) spec.subIndustries = deal.subIndustries;

    let investors = await db.startupInvestor.findMany({
      include: { documentsRequired: true },
    });

    if (investors.length === 0) {
      const { SEED_VC_INVESTORS } = await import("../../../../../../scripts/seed-vc-investors");
      for (const inv of SEED_VC_INVESTORS) {
        const { documentsRequired = [], ...invData } = inv;
        await db.startupInvestor.upsert({
          where: { id: inv.id },
          create: {
            ...invData,
            documentsRequired: {
              create: documentsRequired.map((d) => ({ code: d.code, note: d.note ?? null })),
            },
          },
          update: {},
        });
      }
      investors = await db.startupInvestor.findMany({
        include: { documentsRequired: true },
      });
    }

    const matchResult = matchStartupDeal(
      spec,
      investors,
      deal.documents,
      body?.customPreferences,
    );

    // Persist matches and syndicate blueprint atomically
    await db.$transaction(async (tx) => {
      await tx.startupInvestorMatch.deleteMany({ where: { dealId } });
      await tx.startupSyndicateBlueprint.deleteMany({ where: { dealId } });

      const allCandidates = [
        ...matchResult.leadCandidates,
        ...matchResult.coInvestorCandidates,
        ...matchResult.angelCandidates,
        ...matchResult.acceleratorOptions,
      ];

      // Deduplicate candidates by investorId
      const uniqueCandidates = Array.from(
        new Map(allCandidates.map((c) => [c.investorId, c])).values(),
      );

      await tx.startupInvestorMatch.createMany({
        data: uniqueCandidates.map((c) => ({
          dealId,
          investorId: c.investorId,
          tier: c.tier,
          verdict: c.verdict,
          rationale: c.rationale,
          isLeadCandidate: c.isLeadCandidate,
          thesisResonanceScore: c.thesisResonanceScore,
          portfolioConflictDetected: c.portfolioConflictDetected,
          conflictingPortfolioCompany: c.conflictingPortfolioCompany ?? null,
          activelyFundingIndustry: c.activelyFundingIndustry,
          industryDeploymentScore: c.industryDeploymentScore,
          competitorConflictNotes: c.competitorConflictNotes ?? null,
          sourceLinksAudit: c.sourceLinksAudit ?? [],
        })),
      });

      await tx.startupSyndicateBlueprint.create({
        data: {
          dealId,
          targetRaiseUsd: matchResult.targetRaiseAmountUsd,
          leadAllocationUsd: matchResult.recommendedLeadAllocationUsd,
          syndicateAllocationUsd: matchResult.recommendedSyndicateAllocationUsd,
          angelAllocationUsd: matchResult.recommendedAngelAllocationUsd,
          recommendedValuationCapUsd: spec.financingAsk.valuationCapUsd ?? null,
          dilutionModelJson: JSON.parse(
            JSON.stringify(spec.reconciliationAudit),
          ),
          synthesisSummary: matchResult.synthesisSummary,
        },
      });

      await tx.startupDeal.update({
        where: { id: dealId },
        data: { status: "COMPLETE" },
      });
    });

    return NextResponse.json({
      dealId,
      matchingResult: matchResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Matching failed: ${message}` }, { status: 500 });
  }
}
