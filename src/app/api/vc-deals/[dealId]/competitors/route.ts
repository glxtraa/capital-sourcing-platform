import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { researchStartupCompetitors } from "@/agents/vc/vc-competitor-agent";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import { matchStartupDeal } from "@/lib/vc-matching";
import type { StartupDocumentExtraction } from "@/dsl/vc";

export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const competitors = await db.startupCompetitor.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  });

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    select: {
      companyName: true,
      stage: true,
      primaryVertical: true,
      industry: true,
      subIndustries: true,
      targetCustomerProfile: true,
      businessModel: true,
      legalEntityJurisdiction: true,
    },
  });

  const dslInput = {
    agentFlow: "COMPETITOR_INTELLIGENCE_AND_ANTI_PORTFOLIO_V2",
    companyName: deal?.companyName ?? "",
    stage: deal?.stage ?? "SEED",
    primaryVertical: deal?.primaryVertical ?? "B2B_SAAS",
    industry: deal?.industry ?? "",
    subIndustries: deal?.subIndustries ?? [],
    targetCustomerProfile: deal?.targetCustomerProfile ?? null,
    businessModel: deal?.businessModel ?? null,
    jurisdiction: deal?.legalEntityJurisdiction ?? "Delaware (US)",
  };

  return NextResponse.json({
    dealId,
    dslInput,
    industry: deal?.industry ?? null,
    subIndustries: deal?.subIndustries ?? [],
    competitors,
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      financingAsks: true,
      competitors: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  try {
    const ask = deal.financingAsks[0];
    const targetRaise = ask?.targetRaiseUsd ? `$${ask.targetRaiseUsd.toLocaleString()}` : "early-stage venture capital";

    const docSummaries = deal.documents
      .map((d) => (d.extractedRaw as any)?.documentSummary)
      .filter(Boolean)
      .join(" ");

    const summaryContext = [
      `${deal.companyName} is raising ${targetRaise} on ${ask?.instrumentType ?? "POST_MONEY_SAFE"}.`,
      docSummaries ? `Document extraction summary: ${docSummaries}` : null,
      deal.targetCustomerProfile ? `Target ICP / Buyer Persona: ${deal.targetCustomerProfile}` : null,
      deal.businessModel ? `Monetization & Business Model: ${deal.businessModel}` : null,
      `Data room files: ${deal.documents.map((d) => d.fileName).join(", ") || "Deck and model"}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await researchStartupCompetitors({
      companyName: deal.companyName,
      stage: deal.stage,
      primaryVertical: deal.primaryVertical,
      industryHint: deal.industry || undefined,
      subIndustries: deal.subIndustries,
      targetCustomerProfile: deal.targetCustomerProfile || undefined,
      businessModel: deal.businessModel || undefined,
      descriptionOrDeckSummary: summaryContext,
      jurisdiction: deal.legalEntityJurisdiction,
    });

    await db.$transaction(async (tx) => {
      // 1. Clear old competitors for this deal
      await tx.startupCompetitor.deleteMany({ where: { dealId } });

      // 2. Update deal industry classification
      await tx.startupDeal.update({
        where: { id: dealId },
        data: {
          industry: result.industry,
          subIndustries: result.subIndustries,
        },
      });

      // 3. Persist discovered competitors
      if (result.competitors.length > 0) {
        await tx.startupCompetitor.createMany({
          data: result.competitors.map((c) => ({
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
    });

    // 4. If the deal already has documents reconciled, refresh syndicate matching with the new competitor anti-portfolio data
    const extractions = deal.documents
      .map((d) => d.extractedRaw)
      .filter(Boolean) as unknown as StartupDocumentExtraction[];

    if (extractions.length > 0) {
      try {
        const reconciliation = reconcileStartupExtractions(deal.id, deal.companyName, extractions);
        const spec = reconciliation.startupDealSpec;
        if (spec) {
          // Overlay discovered competitors & industry
          spec.competitors = result.competitors.map((c) => ({
            name: c.name,
            websiteUrl: c.websiteUrl,
            description: c.description,
            overlapDegree: c.overlapDegree,
            knownInvestors: c.knownInvestors,
            differentiation: c.differentiation,
            sourceUrl: c.sourceUrl,
            sourceVerified: c.sourceVerified,
            sourceHttpStatus: c.sourceHttpStatus,
          }));
          spec.industry = result.industry;
          spec.subIndustries = result.subIndustries;

          const allInvestors = await db.startupInvestor.findMany({
            include: { documentsRequired: true },
          });

          if (allInvestors.length > 0) {
            const matchResult = matchStartupDeal(spec, allInvestors, deal.documents);

            await db.$transaction(async (tx) => {
              await tx.startupInvestorMatch.deleteMany({ where: { dealId } });
              const allCandidates = [
                ...matchResult.leadCandidates,
                ...matchResult.coInvestorCandidates,
                ...matchResult.angelCandidates,
                ...matchResult.acceleratorOptions,
              ];
              const unique = Array.from(new Map(allCandidates.map((c) => [c.investorId, c])).values());
              await tx.startupInvestorMatch.createMany({
                data: unique.map((c) => ({
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
            });
          }
        }
      } catch (rematchErr) {
        console.warn("Rematching syndicate after competitor discovery encountered a warning:", rematchErr);
      }
    }

    return NextResponse.json({
      ok: true,
      dslInput: result.dslInput,
      industry: result.industry,
      subIndustries: result.subIndustries,
      competitors: result.competitors,
      verifiedLinks: result.verifiedLinks,
      auditSummary: result.auditSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Competitor discovery failed: ${message}` }, { status: 500 });
  }
}
