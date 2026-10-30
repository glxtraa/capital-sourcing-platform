import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  researchVCInvestorFindings,
  structureVCInvestorFindings,
} from "@/agents/vc/vc-research-agent";
import { matchStartupDeal } from "@/lib/vc-matching";
import { reconcileStartupExtractions } from "@/agents/vc/vc-reconciliation";
import { researchStartupCompetitors } from "@/agents/vc/vc-competitor-agent";
import type { StartupDocumentExtraction, StartupInvestorDTO } from "@/dsl/vc";

function cleanJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_, v) => (v === undefined ? null : v)));
}

function sanitizeInvestorData(investor: StartupInvestorDTO) {
  const uniq = <T>(arr: T[] | undefined | null): T[] => Array.from(new Set(arr ?? []));
  return {
    id: investor.id,
    name: investor.name,
    type: investor.type,
    targetStages: uniq(investor.targetStages),
    preferredSectors: uniq(investor.preferredSectors),
    excludedSectors: uniq(investor.excludedSectors),
    minCheckUsd: investor.minCheckUsd ?? null,
    maxCheckUsd: investor.maxCheckUsd ?? null,
    sweetSpotCheckUsd: investor.sweetSpotCheckUsd ?? null,
    leadsRounds: Boolean(investor.leadsRounds),
    takesBoardSeats: Boolean(investor.takesBoardSeats),
    targetOwnershipPct: investor.targetOwnershipPct ?? null,
    acceptedJurisdictions: uniq(investor.acceptedJurisdictions),
    minArrUsd: investor.minArrUsd ?? null,
    portfolioCompanies: uniq(investor.portfolioCompanies),
    activelyFundingIndustry: Boolean(investor.activelyFundingIndustry),
    recentIndustryInvestments: cleanJson(investor.recentIndustryInvestments ?? []),
    competitorInvestments: cleanJson(investor.competitorInvestments ?? []),
    thesisMatchSummary: investor.thesisMatchSummary ?? null,
    sourceLinksAudit: cleanJson(investor.sourceLinksAudit ?? []),
    criteriaProvenance: cleanJson(investor.criteriaProvenance ?? []),
    gatingFactor: investor.gatingFactor ?? null,
    typicalTurnaroundWeeks: investor.typicalTurnaroundWeeks ?? null,
    applicationRoute: investor.applicationRoute ?? "WARM_INTRO",
    applicationUrl: investor.applicationUrl ?? null,
    confidence: investor.confidence ?? "VERIFIED_SECONDARY",
    sources: uniq(investor.sources),
    notes: investor.notes ?? null,
    contactEmail: investor.contactEmail ?? null,
    headquarters: investor.headquarters ?? null,
    websiteUrl: investor.websiteUrl ?? null,
    keyContactsJson: cleanJson(investor.keyContacts ?? []),
    lastVerified: new Date(),
  };
}

export const maxDuration = 300;

const BodySchema = z.union([
  z.object({
    step: z.literal("search"),
    investorHint: z.string().optional(),
  }),
  z.object({
    step: z.literal("structure"),
    runId: z.string(),
    hint: z.string(),
    findings: z.string().min(1),
    citedUrls: z.array(z.string()).default([]),
  }),
  z.object({
    step: z.literal("auto").optional(),
    investorHint: z.string().optional(),
  }),
  z.null().transform(() => ({ step: "auto" as const })),
  z.undefined().transform(() => ({ step: "auto" as const })),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;
  const rawBody = await req.json().catch(() => ({ step: "auto" }));
  const parsed = BodySchema.safeParse(rawBody);

  const body = parsed.success ? parsed.data : { step: "auto" as const };

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      founders: true,
      capTable: true,
      financingAsks: true,
      matches: true,
      competitors: true,
    },
  });
  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  // Ensure competitor discovery is populated for competitor conflict checks
  let competitors = deal.competitors;
  let resolvedIndustry = deal.industry;
  let resolvedSubIndustries = deal.subIndustries;

  if (competitors.length === 0) {
    try {
      const compResult = await researchStartupCompetitors({
        companyName: deal.companyName,
        stage: deal.stage,
        primaryVertical: deal.primaryVertical,
        industryHint: deal.industry || undefined,
        descriptionOrDeckSummary: deal.documents.map((d) => d.fileName).join(", "),
        jurisdiction: deal.legalEntityJurisdiction || undefined,
      });
      resolvedIndustry = compResult.industry;
      resolvedSubIndustries = compResult.subIndustries;

      await db.$transaction(async (tx) => {
        await tx.startupDeal.update({
          where: { id: dealId },
          data: { industry: resolvedIndustry, subIndustries: resolvedSubIndustries },
        });
        if (compResult.competitors.length > 0) {
          await tx.startupCompetitor.createMany({
            data: compResult.competitors.map((c) => ({
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
      competitors = await db.startupCompetitor.findMany({ where: { dealId } });
    } catch (err) {
      console.warn("Auto competitor discovery during research warning:", err);
    }
  }

  const ask = deal.financingAsks[0];
  const targetRaise = ask?.targetRaiseUsd ?? null;
  const location = deal.legalEntityJurisdiction || "Global";
  const raiseDescription = targetRaise ? `seeking ~$${targetRaise.toLocaleString()}` : "seeking capital";
  const instrumentDescription = ask?.instrumentType ? `on a ${ask.instrumentType}` : "funding round";
  const defaultHint =
    `A venture capital fund, angel syndicate, or accelerator for a ${deal.stage} stage ` +
    `${deal.primaryVertical} startup located in ${location} ${raiseDescription} ${instrumentDescription}`;

  const competitorNames = competitors.map((c) => c.name);
  const compContext = competitorNames.length > 0
    ? `Known market rivals for conflict detection: ${competitorNames.join(", ")}.`
    : "";
  const industryContext = resolvedIndustry ? `Target Industry: ${resolvedIndustry}.` : "";

  const defaultContext =
    `Startup "${deal.companyName}" (${deal.stage} stage in ${deal.primaryVertical}, based in ${location}) ` +
    `has an active funding round with low match density. ${industryContext} ${compContext} ` +
    `Determine if the investor is currently actively deploying into this industry (past 12-24m) and check if they have backed any direct competitors.`;

  // STEP 1 ONLY: Search
  if (body.step === "search") {
    const hint = body.investorHint || defaultHint;
    await db.startupDeal.update({ where: { id: dealId }, data: { status: "RESEARCHING" } });

    const run = await db.startupResearchRun.create({
      data: {
        dealId,
        triggeredBy: "system:low_match_density",
        inputSummary: `${hint}\n\n${defaultContext}`,
        status: "RUNNING",
      },
    });

    try {
      const { findings, citedUrls } = await researchVCInvestorFindings(hint, defaultContext);
      return NextResponse.json({ runId: run.id, hint, findings, citedUrls });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.startupResearchRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          outputSummary: `Research search failed: ${message}`,
          finishedAt: new Date(),
        },
      });
      return NextResponse.json({ error: `Investor research search failed: ${message}` }, { status: 500 });
    }
  }

  // STEP 2 ONLY: Structure
  if (body.step === "structure") {
    const run = await db.startupResearchRun.findUnique({ where: { id: body.runId } });
    if (!run || run.dealId !== dealId) {
      return NextResponse.json({ error: "Research run not found on this deal" }, { status: 404 });
    }

    try {
      const investor = await structureVCInvestorFindings(body.hint, {
        findings: body.findings,
        citedUrls: body.citedUrls,
      });

      // Filter out non-VC / non-startup equity organizations (DFIs, sovereign grant funds, commercial real estate developers)
      const nonVCPattern = /does not invest in (?:startups|equity|early-stage)|only (?:funds large-scale infrastructure|provides grants to non-profit|engaged in commercial real estate)/i;
      const gatingNotes = `${investor.gatingFactor || ""} ${investor.notes || ""}`;
      if (nonVCPattern.test(gatingNotes) || (investor.targetStages && investor.targetStages.length === 0)) {
        await db.startupResearchRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCEEDED",
            outputSummary: `Researched "${investor.name}", but identified as ineligible non-VC / sovereign grant / real-estate fund. Not added to startup investor catalog.`,
            finishedAt: new Date(),
          },
        });
        await db.startupDeal.update({ where: { id: dealId }, data: { status: "READY_TO_MATCH" } });
        return NextResponse.json({
          investorId: null,
          investorName: investor.name,
          excludedNonVC: true,
          reason: investor.gatingFactor || "Entity does not invest in startups or venture rounds.",
        });
      }

      const sanitized = sanitizeInvestorData(investor);
      const docsReq = Array.isArray(investor.documentsRequired) ? investor.documentsRequired : [];

      await db.startupInvestor.upsert({
        where: { id: investor.id },
        create: {
          ...sanitized,
          documentsRequired: {
            create: docsReq.map((doc) => ({
              code: doc.code,
              note: doc.note ?? null,
            })),
          },
        },
        update: {
          ...sanitized,
          documentsRequired: {
            deleteMany: {},
            create: docsReq.map((doc) => ({
              code: doc.code,
              note: doc.note ?? null,
            })),
          },
        },
      });

      await db.startupResearchRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          outputSummary: `Added/updated investor "${investor.name}" (${investor.id}).`,
          finishedAt: new Date(),
        },
      });

      await db.startupDeal.update({ where: { id: dealId }, data: { status: "READY_TO_MATCH" } });

      return NextResponse.json({
        investorId: investor.id,
        investorName: investor.name,
        investorType: investor.type,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.startupResearchRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          outputSummary: `Research structuring failed: ${message}`,
          finishedAt: new Date(),
        },
      });
      await db.startupDeal.update({ where: { id: dealId }, data: { status: "READY_TO_MATCH" } });
      return NextResponse.json({ error: `Investor structuring failed: ${message}` }, { status: 500 });
    }
  }

  // AUTO FLOW: End-to-end Search + Structure + Immediate Syndicate Matching
  const hint = ("investorHint" in body && body.investorHint) ? body.investorHint : defaultHint;
  await db.startupDeal.update({ where: { id: dealId }, data: { status: "RESEARCHING" } });

  const run = await db.startupResearchRun.create({
    data: {
      dealId,
      triggeredBy: "user:interactive_research",
      inputSummary: `${hint}\n\n${defaultContext}`,
      status: "RUNNING",
    },
  });

  try {
    // 1. Search
    const { findings, citedUrls } = await researchVCInvestorFindings(hint, defaultContext);

    // 2. Structure
    const investor = await structureVCInvestorFindings(hint, { findings, citedUrls });

    const nonVCPattern = /does not invest in (?:startups|equity|early-stage)|only (?:funds large-scale infrastructure|provides grants to non-profit|engaged in commercial real estate)/i;
    const gatingNotes = `${investor.gatingFactor || ""} ${investor.notes || ""}`;
    if (nonVCPattern.test(gatingNotes) || (investor.targetStages && investor.targetStages.length === 0)) {
      await db.startupResearchRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          outputSummary: `Researched "${investor.name}", but identified as ineligible non-VC / sovereign grant / real-estate fund. Not added to startup investor catalog.`,
          finishedAt: new Date(),
        },
      });
      await db.startupDeal.update({ where: { id: dealId }, data: { status: "READY_TO_MATCH" } });
      return NextResponse.json({
        ok: true,
        investorId: null,
        investorName: investor.name,
        excludedNonVC: true,
        findings,
        citedUrls,
      });
    }

    const sanitized = sanitizeInvestorData(investor);
    const docsReq = Array.isArray(investor.documentsRequired) ? investor.documentsRequired : [];

    await db.startupInvestor.upsert({
      where: { id: investor.id },
      create: {
        ...sanitized,
        documentsRequired: {
          create: docsReq.map((doc) => ({
            code: doc.code,
            note: doc.note ?? null,
          })),
        },
      },
      update: {
        ...sanitized,
        documentsRequired: {
          deleteMany: {},
          create: docsReq.map((doc) => ({
            code: doc.code,
            note: doc.note ?? null,
          })),
        },
      },
    });

    await db.startupResearchRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        outputSummary: `Discovered and verified investor "${investor.name}" (${investor.id}).`,
        finishedAt: new Date(),
      },
    });

    // 3. Immediately synthesize syndicate matches with newly discovered investor
    const extractions = deal.documents
      .map((d) => d.extractedRaw)
      .filter(Boolean) as unknown as StartupDocumentExtraction[];

    const reconciliation = reconcileStartupExtractions(deal.id, deal.companyName, extractions);
    const spec = reconciliation.startupDealSpec;

    if (spec) {
      if (competitors.length > 0) {
        spec.competitors = competitors.map((c) => ({
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
      if (resolvedIndustry) spec.industry = resolvedIndustry;
      if (resolvedSubIndustries && resolvedSubIndustries.length > 0) spec.subIndustries = resolvedSubIndustries;

      const allInvestors = await db.startupInvestor.findMany({
        include: { documentsRequired: true },
      });

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

    await db.startupDeal.update({ where: { id: dealId }, data: { status: "COMPLETE" } });

    return NextResponse.json({
      ok: true,
      investorId: investor.id,
      investorName: investor.name,
      investorType: investor.type,
      findings,
      citedUrls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.startupResearchRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        outputSummary: `Research failed: ${message}`,
        finishedAt: new Date(),
      },
    });
    await db.startupDeal.update({ where: { id: dealId }, data: { status: "READY_TO_MATCH" } });
    return NextResponse.json({ error: `Investor research failed: ${message}` }, { status: 500 });
  }
}
