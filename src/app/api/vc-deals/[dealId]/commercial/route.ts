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
    include: {
      contacts: {
        orderBy: { createdAt: "asc" },
      },
    },
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
      competitors: { select: { name: true, differentiation: true } },
    },
  });

  const dslInput = {
    companyName: deal?.companyName ?? "",
    stage: deal?.stage ?? "SEED",
    primaryVertical: deal?.primaryVertical ?? "B2B_SAAS",
    industry: deal?.industry ?? "",
    subIndustries: deal?.subIndustries ?? [],
    targetCustomerProfile: deal?.targetCustomerProfile ?? "",
    businessModel: deal?.businessModel ?? "",
    jurisdiction: deal?.legalEntityJurisdiction ?? "",
    competitorsHint: (deal?.competitors || []).map((c) => c.name),
  };

  const clients = prospects.filter(
    (p) =>
      p.category === "ENTERPRISE_CUSTOMER" ||
      p.category === "MIDMARKET_CUSTOMER" ||
      p.category === "INSTITUTIONAL_BUYER" ||
      p.category === "SMB_CUSTOMER_SEGMENT",
  );

  const strategicPartners = prospects.filter(
    (p) =>
      p.category === "STRATEGIC_CHANNEL_PARTNER" ||
      p.category === "INTEGRATION_ALLIANCE" ||
      p.category === "REGULATORY_REGISTRY_PARTNER" ||
      p.category === "DATA_OR_SUPPLY_PARTNER",
  );

  return NextResponse.json({
    dealId,
    dslInput,
    industry: deal?.industry ?? null,
    subIndustries: deal?.subIndustries ?? [],
    targetCustomerProfile: deal?.targetCustomerProfile ?? null,
    businessModel: deal?.businessModel ?? null,
    clients,
    strategicPartners,
    prospects,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const body = await req.json().catch(() => ({}));
  const {
    industry: overrideIndustry,
    subIndustries: overrideSubIndustries,
    targetCustomerProfile: overrideTargetCustomerProfile,
    businessModel: overrideBusinessModel,
  } = body || {};

  let deal = await db.startupDeal.findUnique({
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

  // 1. If overrides were provided, persist them to the deal
  const hasUpdates =
    overrideIndustry !== undefined ||
    overrideSubIndustries !== undefined ||
    overrideTargetCustomerProfile !== undefined ||
    overrideBusinessModel !== undefined;

  if (hasUpdates) {
    deal = await db.startupDeal.update({
      where: { id: dealId },
      data: {
        ...(typeof overrideIndustry === "string" ? { industry: overrideIndustry } : {}),
        ...(Array.isArray(overrideSubIndustries) ? { subIndustries: overrideSubIndustries } : {}),
        ...(typeof overrideTargetCustomerProfile === "string" ? { targetCustomerProfile: overrideTargetCustomerProfile } : {}),
        ...(typeof overrideBusinessModel === "string" ? { businessModel: overrideBusinessModel } : {}),
      },
      include: {
        documents: true,
        financingAsks: true,
        competitors: true,
        commercialProspects: true,
      },
    });
  }

  try {
    const ask = deal.financingAsks[0];
    const targetRaise = ask?.targetRaiseUsd ? `$${ask.targetRaiseUsd.toLocaleString()}` : "early-stage venture capital";

    // Gather rich context strictly from this deal's own uploaded documents
    const docContextBlocks: string[] = [];
    const docSubIndustries: string[] = [];
    let docDerivedIndustry = "";

    for (const doc of deal.documents) {
      const raw = doc.extractedRaw as any;
      if (raw) {
        if (raw.documentSummary) {
          docContextBlocks.push(`[${doc.fileName}]: ${raw.documentSummary}`);
        }
        if (raw.industry && !docDerivedIndustry) {
          docDerivedIndustry = raw.industry;
        }
        if (Array.isArray(raw.subIndustries)) {
          for (const sub of raw.subIndustries) {
            if (sub && !docSubIndustries.includes(sub)) {
              docSubIndustries.push(sub);
            }
          }
        }
      }
    }

    const effectiveIndustry = deal.industry || docDerivedIndustry || undefined;
    const effectiveSubIndustries =
      deal.subIndustries && deal.subIndustries.length > 0 ? deal.subIndustries : docSubIndustries;

    const summaryContext =
      `${deal.companyName} is raising ${targetRaise}${ask?.instrumentType ? ` on ${ask.instrumentType}` : ""}. ` +
      `Data room files: ${deal.documents.map((d) => d.fileName).join(", ") || "Deck and model"}. ` +
      (docContextBlocks.length > 0 ? `Extracted Document Summaries: ${docContextBlocks.join(" | ")}. ` : "") +
      (deal.targetCustomerProfile ? `Target ICP: ${deal.targetCustomerProfile}. ` : "") +
      (deal.businessModel ? `Business Model: ${deal.businessModel}. ` : "");

    const competitorNames = deal.competitors.map((c) => c.name);
    const diffs = deal.competitors
      .map((c) => c.differentiation)
      .filter(Boolean)
      .slice(0, 2)
      .join("; ");

    const result = await researchStartupCommercialProspects({
      companyName: deal.companyName,
      stage: deal.stage,
      primaryVertical: deal.primaryVertical,
      industryHint: effectiveIndustry,
      subIndustries: effectiveSubIndustries,
      descriptionOrDeckSummary: summaryContext,
      targetCustomerProfile: deal.targetCustomerProfile || undefined,
      businessModel: deal.businessModel || undefined,
      jurisdiction: deal.legalEntityJurisdiction || undefined,
      competitorsHint: competitorNames.length > 0 ? competitorNames : undefined,
      differentiationHint: diffs || undefined,
    });

    await db.$transaction(async (tx) => {
      const existing = await tx.startupCommercialProspect.findMany({
        where: { dealId },
        include: { contacts: true },
      });
      const existingByName = new Map(existing.map((p) => [p.name.toLowerCase().trim(), p]));
      const keepIds = new Set<string>();

      for (const p of result.prospects) {
        const key = p.name.toLowerCase().trim();
        const prev = existingByName.get(key);
        if (prev) {
          keepIds.add(prev.id);
          await tx.startupCommercialProspect.update({
            where: { id: prev.id },
            data: {
              websiteUrl: p.websiteUrl ?? prev.websiteUrl,
              category: p.category,
              buyerPersona: p.buyerPersona ?? prev.buyerPersona,
              useCaseFit: p.useCaseFit,
              estimatedAcvTier: p.estimatedAcvTier,
              strategicSynergy: p.strategicSynergy ?? prev.strategicSynergy,
              sourceUrl: p.sourceUrl ?? prev.sourceUrl,
              sourceVerified: p.sourceVerified,
              sourceHttpStatus: p.sourceHttpStatus ?? prev.sourceHttpStatus,
              lastVerified: new Date(),
            },
          });
        } else {
          const created = await tx.startupCommercialProspect.create({
            data: {
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
            },
          });
          keepIds.add(created.id);
        }
      }

      // Only delete obsolete prospects if they do not have any contacts attached
      for (const prev of existing) {
        if (!keepIds.has(prev.id) && prev.contacts.length === 0) {
          await tx.startupCommercialProspect.delete({ where: { id: prev.id } });
        }
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

    const savedProspects = await db.startupCommercialProspect.findMany({
      where: { dealId },
      include: { contacts: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      dslInput: result.dslInput,
      clients: result.clients,
      strategicPartners: result.strategicPartners,
      prospects: savedProspects.length > 0 ? savedProspects : result.prospects,
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
