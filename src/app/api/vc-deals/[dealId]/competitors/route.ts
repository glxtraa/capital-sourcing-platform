import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { researchStartupCompetitors } from "@/agents/vc/vc-competitor-agent";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import { matchStartupDeal } from "@/lib/vc-matching";
import type { StartupDocumentExtraction, StartupCompetitorExtraction } from "@/dsl/vc";

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
    select: { industry: true, subIndustries: true },
  });

  return NextResponse.json({
    dealId,
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

    // Gather rich context from uploaded startup data room documents
    const docContextBlocks: string[] = [];
    const deckCompetitors: StartupCompetitorExtraction[] = [];

    for (const doc of deal.documents) {
      const raw = doc.extractedRaw as any;
      if (raw) {
        if (raw.documentSummary) {
          docContextBlocks.push(`[${doc.fileName}]:\n${raw.documentSummary}`);
        }
        if (raw.industry) {
          docContextBlocks.push(`[${doc.fileName} Domain]: ${raw.industry}`);
        }
        if (Array.isArray(raw.subIndustries) && raw.subIndustries.length > 0) {
          docContextBlocks.push(`[${doc.fileName} Sub-sectors]: ${raw.subIndustries.join(", ")}`);
        }
        if (Array.isArray(raw.competitors) && raw.competitors.length > 0) {
          for (const c of raw.competitors) {
            if (c.name && !deckCompetitors.some((existing) => existing.name.toLowerCase() === c.name.toLowerCase())) {
              deckCompetitors.push(c);
            }
          }
        }
      }
    }

    if (deal.targetCustomerProfile) {
      docContextBlocks.push(`Target Customer Profile (ICP):\n${deal.targetCustomerProfile}`);
    }
    if (deal.businessModel) {
      docContextBlocks.push(`Business & Monetization Model:\n${deal.businessModel}`);
    }

    const documentContext = docContextBlocks.join("\n\n");
    const instrumentPart = ask?.instrumentType ? ` on ${ask.instrumentType}` : "";
    const summaryContext =
      `${deal.companyName} is raising ${targetRaise}${instrumentPart}.\n\n` +
      documentContext;

    const result = await researchStartupCompetitors({
      companyName: deal.companyName,
      stage: deal.stage,
      primaryVertical: deal.primaryVertical,
      industryHint: deal.industry || undefined,
      subIndustries: deal.subIndustries || [],
      targetCustomerProfile: deal.targetCustomerProfile || undefined,
      businessModel: deal.businessModel || undefined,
      documentContext,
      deckCompetitors,
      descriptionOrDeckSummary: summaryContext,
      jurisdiction: deal.legalEntityJurisdiction || undefined,
    });

    await db.$transaction(async (tx) => {
      // 1. Clear old competitors for this deal
      await tx.startupCompetitor.deleteMany({ where: { dealId } });

      // 2. Update deal industry classification only if not already specified
      const dataToUpdate: Record<string, any> = {};
      if (!deal.industry || deal.industry.trim().length === 0) {
        dataToUpdate.industry = result.industry;
      }
      if (!deal.subIndustries || deal.subIndustries.length === 0) {
        dataToUpdate.subIndustries = result.subIndustries;
      }
      if (Object.keys(dataToUpdate).length > 0) {
        await tx.startupDeal.update({
          where: { id: dealId },
          data: dataToUpdate,
        });
      }

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

    const savedCompetitors = await db.startupCompetitor.findMany({
      where: { dealId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      industry: result.industry,
      subIndustries: result.subIndustries,
      competitors: savedCompetitors.length > 0 ? savedCompetitors : result.competitors,
      verifiedLinks: result.verifiedLinks,
      auditSummary: result.auditSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Competitor discovery failed: ${message}` }, { status: 500 });
  }
}
