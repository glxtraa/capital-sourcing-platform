import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { StartupInvestorType, StartupStage, StartupSector } from "@prisma/client";
import { matchStartupDeal } from "@/lib/vc-matching";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import type { StartupDocumentExtraction } from "@/dsl/vc";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ investorId: string }> },
) {
  const { investorId } = await params;
  const investor = await db.startupInvestor.findUnique({
    where: { id: investorId },
    include: { documentsRequired: true },
  });

  if (!investor) {
    return NextResponse.json({ error: "Investor not found" }, { status: 404 });
  }

  return NextResponse.json(investor);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ investorId: string }> },
) {
  const { investorId } = await params;

  const existing = await db.startupInvestor.findUnique({
    where: { id: investorId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Investor not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const {
      name,
      type,
      targetStages,
      preferredSectors,
      excludedSectors,
      minCheckUsd,
      maxCheckUsd,
      sweetSpotCheckUsd,
      leadsRounds,
      takesBoardSeats,
      targetOwnershipPct,
      acceptedJurisdictions,
      minArrUsd,
      portfolioCompanies,
      activelyFundingIndustry,
      gatingFactor,
      typicalTurnaroundWeeks,
      applicationRoute,
      applicationUrl,
      websiteUrl,
      contactEmail,
      headquarters,
      keyContacts,
      notes,
      dealId,
    } = body;

    const data: Record<string, any> = {};

    if (name !== undefined) data.name = String(name).trim();
    if (type !== undefined && Object.values(StartupInvestorType).includes(type)) {
      data.type = type;
    }
    if (Array.isArray(targetStages)) {
      data.targetStages = targetStages.filter((s) => Object.values(StartupStage).includes(s));
    }
    if (Array.isArray(preferredSectors)) {
      data.preferredSectors = preferredSectors.filter((s) => Object.values(StartupSector).includes(s));
    }
    if (Array.isArray(excludedSectors)) {
      data.excludedSectors = excludedSectors.filter((s) => Object.values(StartupSector).includes(s));
    }
    if (minCheckUsd !== undefined) data.minCheckUsd = minCheckUsd === null ? null : Number(minCheckUsd);
    if (maxCheckUsd !== undefined) data.maxCheckUsd = maxCheckUsd === null ? null : Number(maxCheckUsd);
    if (sweetSpotCheckUsd !== undefined) data.sweetSpotCheckUsd = sweetSpotCheckUsd === null ? null : Number(sweetSpotCheckUsd);
    if (leadsRounds !== undefined) data.leadsRounds = Boolean(leadsRounds);
    if (takesBoardSeats !== undefined) data.takesBoardSeats = Boolean(takesBoardSeats);
    if (targetOwnershipPct !== undefined) data.targetOwnershipPct = targetOwnershipPct === null ? null : Number(targetOwnershipPct);
    if (Array.isArray(acceptedJurisdictions)) {
      data.acceptedJurisdictions = acceptedJurisdictions.map((j) => String(j).trim()).filter(Boolean);
    }
    if (minArrUsd !== undefined) data.minArrUsd = minArrUsd === null ? null : Number(minArrUsd);
    if (Array.isArray(portfolioCompanies)) {
      data.portfolioCompanies = portfolioCompanies.map((c) => String(c).trim()).filter(Boolean);
    }
    if (activelyFundingIndustry !== undefined) data.activelyFundingIndustry = Boolean(activelyFundingIndustry);
    if (gatingFactor !== undefined) data.gatingFactor = gatingFactor ? String(gatingFactor).trim() : null;
    if (typicalTurnaroundWeeks !== undefined) data.typicalTurnaroundWeeks = typicalTurnaroundWeeks === null ? null : Number(typicalTurnaroundWeeks);
    if (applicationRoute !== undefined) data.applicationRoute = String(applicationRoute).trim();
    if (applicationUrl !== undefined) data.applicationUrl = applicationUrl ? String(applicationUrl).trim() : null;
    if (websiteUrl !== undefined) data.websiteUrl = websiteUrl ? String(websiteUrl).trim() : null;
    if (contactEmail !== undefined) data.contactEmail = contactEmail ? String(contactEmail).trim() : null;
    if (headquarters !== undefined) data.headquarters = headquarters ? String(headquarters).trim() : null;
    if (keyContacts !== undefined) data.keyContactsJson = Array.isArray(keyContacts) ? keyContacts : [];
    if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;

    data.lastVerified = new Date();

    const updated = await db.startupInvestor.update({
      where: { id: investorId },
      data,
      include: { documentsRequired: true },
    });

    // If dealId is provided, recompute matches for that deal immediately
    if (dealId) {
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

      if (deal && deal.financingAsks.length > 0) {
        const extractions = deal.documents
          .map((d) => d.extractedRaw)
          .filter(Boolean) as unknown as StartupDocumentExtraction[];

        const reconciliation = reconcileStartupExtractions(deal.id, deal.companyName, extractions);
        const spec = reconciliation.startupDealSpec;

        if (spec) {
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

          const allInvestors = await db.startupInvestor.findMany({
            include: { documentsRequired: true },
          });

          const matchResult = matchStartupDeal(spec, allInvestors, deal.documents);

          const allCandidates = [
            ...matchResult.leadCandidates,
            ...matchResult.coInvestorCandidates,
            ...matchResult.angelCandidates,
            ...matchResult.acceleratorOptions,
          ];

          const uniqueCandidates = Array.from(
            new Map(allCandidates.map((c) => [c.investorId, c])).values(),
          );

          await db.$transaction(async (tx) => {
            await tx.startupInvestorMatch.deleteMany({ where: { dealId } });
            await tx.startupSyndicateBlueprint.deleteMany({ where: { dealId } });

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
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to update investor: ${message}` }, { status: 400 });
  }
}
