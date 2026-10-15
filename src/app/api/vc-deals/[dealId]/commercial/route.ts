import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { researchStartupCommercialProspects } from "@/agents/vc/vc-commercial-agent";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import { matchStartupDeal } from "@/lib/vc-matching";
import type { StartupDocumentExtraction } from "@/dsl/vc";

export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const prospects = await db.startupCommercialProspect.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  });

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    select: { industry: true, subIndustries: true, targetCustomerProfile: true, businessModel: true },
  });

  return NextResponse.json({
    dealId,
    industry: deal?.industry ?? null,
    subIndustries: deal?.subIndustries ?? [],
    targetCustomerProfile: deal?.targetCustomerProfile ?? null,
    businessModel: deal?.businessModel ?? null,
    prospects,
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
      commercialProspects: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  try {
    const ask = deal.financingAsks[0];
    const targetRaise = ask?.targetRaiseUsd ? `$${ask.targetRaiseUsd.toLocaleString()}` : "early-stage venture capital";

    const summaryContext =
      `${deal.companyName} is raising ${targetRaise} on ${ask?.instrumentType ?? "POST_MONEY_SAFE"}. ` +
      `Data room files: ${deal.documents.map((d) => d.fileName).join(", ") || "Deck and model"}. ` +
      `Target Customer Profile: ${deal.targetCustomerProfile || "B2B Mid-Market / Enterprise"}. ` +
      `Business Model: ${deal.businessModel || "Subscription SaaS / Platform"}.`;

    const result = await researchStartupCommercialProspects({
      companyName: deal.companyName,
      stage: deal.stage,
      primaryVertical: deal.primaryVertical,
      industryHint: deal.industry || undefined,
      descriptionOrDeckSummary: summaryContext,
      targetCustomerProfile: deal.targetCustomerProfile || undefined,
      businessModel: deal.businessModel || undefined,
      jurisdiction: deal.legalEntityJurisdiction,
    });

    await db.$transaction(async (tx) => {
      // 1. Clear old commercial prospects for this deal
      await tx.startupCommercialProspect.deleteMany({ where: { dealId } });

      // 2. Persist newly discovered commercial prospects
      if (result.prospects.length > 0) {
        await tx.startupCommercialProspect.createMany({
          data: result.prospects.map((p) => ({
            dealId,
            name: p.name,
            websiteUrl: p.websiteUrl ?? null,
            category: p.category,
            buyerPersona: p.buyerPersona ?? null,
            useCaseFit: p.useCaseFit,
            estimatedAcvTier: p.estimatedAcvTier,
            strategicSynergy: p.strategicSynergy ?? null,
            sourceUrl: p.sourceUrl ?? null,
            sourceVerified: p.sourceVerified,
            sourceHttpStatus: p.sourceHttpStatus ?? null,
            lastVerified: new Date(),
          })),
        });
      }
    });

    // 3. If documents are present, re-reconcile and refresh syndicate matching with portfolio synergies
    const extractions = deal.documents
      .map((d) => d.extractedRaw)
      .filter(Boolean) as unknown as StartupDocumentExtraction[];

    if (extractions.length > 0) {
      try {
        const reconciliation = reconcileStartupExtractions(deal.id, deal.companyName, extractions);
        const spec = reconciliation.startupDealSpec;
        if (spec) {
          // Overlay discovered commercial prospects & competitors
          spec.commercialProspects = result.prospects.map((p) => ({
            name: p.name,
            websiteUrl: p.websiteUrl,
            category: p.category as any,
            buyerPersona: p.buyerPersona,
            useCaseFit: p.useCaseFit,
            estimatedAcvTier: p.estimatedAcvTier as any,
            strategicSynergy: p.strategicSynergy,
            sourceUrl: p.sourceUrl,
            sourceVerified: p.sourceVerified,
            sourceHttpStatus: p.sourceHttpStatus,
          }));

          spec.competitors = deal.competitors.map((c) => ({
            name: c.name,
            websiteUrl: c.websiteUrl,
            description: c.description,
            overlapDegree: c.overlapDegree as any,
            knownInvestors: c.knownInvestors,
            differentiation: c.differentiation,
            sourceUrl: c.sourceUrl,
            sourceVerified: c.sourceVerified,
            sourceHttpStatus: c.sourceHttpStatus,
          }));

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
        console.warn("Rematching syndicate after commercial discovery warning:", rematchErr);
      }
    }

    return NextResponse.json({
      ok: true,
      prospects: result.prospects,
      verifiedLinks: result.verifiedLinks,
      auditSummary: result.auditSummary,
      targetCustomersCount: result.targetCustomersCount,
      strategicPartnersCount: result.strategicPartnersCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Commercial discovery failed: ${message}` }, { status: 500 });
  }
}
