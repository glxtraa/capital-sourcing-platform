import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  researchTradeFunderFindings,
  structureTradeFunderFindings,
} from "@/agents/trade/trade-research-agent";

export const maxDuration = 300;

const BodySchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("search"),
    funderHint: z.string().optional(),
  }),
  z.object({
    step: z.literal("structure"),
    runId: z.string(),
    hint: z.string(),
    findings: z.string().min(1),
    citedUrls: z.array(z.string()).default([]),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { step: 'search' } or { step: 'structure', ... }" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: { parties: true, contractLegs: true, financingAsks: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Trade deal not found" }, { status: 404 });
  }

  if (body.step === "search") {
    const supplierParty = deal.parties.find((p) => p.role === "SUPPLIER");
    const buyerParty = deal.parties.find((p) => p.role === "BUYER");
    const offtakeLeg = deal.contractLegs.find((l) => l.legType === "OFFTAKE_LEG");

    const hint =
      body.funderHint ??
      `A trade finance funder for ${deal.corridor} (${offtakeLeg?.commodityName ?? "bulk commodities"}), ` +
      `origin ${supplierParty?.jurisdiction ?? "unknown"} to destination ${buyerParty?.jurisdiction ?? "unknown"}, ` +
      `ticket ~USD ${(offtakeLeg?.amountUsd ?? 5000000).toLocaleString()}`;

    const context = `Trade Deal "${deal.name}" (Corridor: ${deal.corridor}) requires trade finance matching.`;

    await db.tradeDeal.update({ where: { id: dealId }, data: { status: "RESEARCHING" } });

    const run = await db.tradeResearchRun.create({
      data: {
        dealId,
        triggeredBy: "system:trade_funder_gap",
        inputSummary: `${hint}\n\n${context}`,
      },
    });

    try {
      const { findings, citedUrls } = await researchTradeFunderFindings(hint, context);
      return NextResponse.json({ runId: run.id, hint, findings, citedUrls });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.tradeResearchRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          outputSummary: `Trade funder search failed: ${message}`,
          finishedAt: new Date(),
        },
      });
      return NextResponse.json(
        { error: `Trade funder search failed: ${message}` },
        { status: 500 },
      );
    }
  }

  // Step 2: Structure
  const run = await db.tradeResearchRun.findUnique({ where: { id: body.runId } });
  if (!run || run.dealId !== dealId) {
    return NextResponse.json({ error: "Research run not found for deal" }, { status: 404 });
  }

  try {
    const funder = await structureTradeFunderFindings(body.hint, {
      findings: body.findings,
      citedUrls: body.citedUrls,
    });

    const lastVerified = funder.lastVerified ? new Date(funder.lastVerified) : new Date();

    await db.tradeFunder.upsert({
      where: { id: funder.id },
      create: {
        id: funder.id,
        name: funder.name,
        type: funder.type,
        offersUmbrellaFacility: funder.offersUmbrellaFacility,
        supportedLegs: funder.supportedLegs,
        supportedCorridors: funder.supportedCorridors,
        supportedCommodities: funder.supportedCommodities,
        excludedCommodities: funder.excludedCommodities,
        acceptedSupplierJurisdictions: funder.acceptedSupplierJurisdictions,
        acceptedTraderJurisdictions: funder.acceptedTraderJurisdictions,
        acceptedBuyerJurisdictions: funder.acceptedBuyerJurisdictions,
        minTicketUsd: funder.minTicketUsd ?? null,
        maxTicketUsd: funder.maxTicketUsd ?? null,
        indicativePricingGuidance: funder.indicativePricingGuidance ?? null,
        gatingFactor: funder.gatingFactor ?? null,
        confidence: funder.confidence,
        lastVerified,
        sources: funder.sources,
        contact: funder.contact ?? funder.deskContacts?.contactEmail ?? null,
        applicationUrl: funder.applicationUrl ?? funder.deskContacts?.applicationPortalUrl ?? null,
        rateEvidenceSnippet: funder.rateEvidenceSnippet ?? funder.pricingProvenance?.evidenceSnippet ?? null,
        pricingProvenance: funder.pricingProvenance ? JSON.parse(JSON.stringify(funder.pricingProvenance)) : undefined,
        deskContacts: funder.deskContacts ? JSON.parse(JSON.stringify(funder.deskContacts)) : undefined,
        notes: funder.notes ?? null,
        documentsRequired: {
          create: funder.documentsRequired.map((d) => ({ code: d.code, note: d.note ?? null })),
        },
      },
      update: {
        name: funder.name,
        type: funder.type,
        offersUmbrellaFacility: funder.offersUmbrellaFacility,
        supportedLegs: funder.supportedLegs,
        supportedCorridors: funder.supportedCorridors,
        supportedCommodities: funder.supportedCommodities,
        excludedCommodities: funder.excludedCommodities,
        acceptedSupplierJurisdictions: funder.acceptedSupplierJurisdictions,
        acceptedTraderJurisdictions: funder.acceptedTraderJurisdictions,
        acceptedBuyerJurisdictions: funder.acceptedBuyerJurisdictions,
        minTicketUsd: funder.minTicketUsd ?? null,
        maxTicketUsd: funder.maxTicketUsd ?? null,
        indicativePricingGuidance: funder.indicativePricingGuidance ?? null,
        gatingFactor: funder.gatingFactor ?? null,
        confidence: funder.confidence,
        lastVerified,
        sources: funder.sources,
        contact: funder.contact ?? funder.deskContacts?.contactEmail ?? null,
        applicationUrl: funder.applicationUrl ?? funder.deskContacts?.applicationPortalUrl ?? null,
        rateEvidenceSnippet: funder.rateEvidenceSnippet ?? funder.pricingProvenance?.evidenceSnippet ?? null,
        pricingProvenance: funder.pricingProvenance ? JSON.parse(JSON.stringify(funder.pricingProvenance)) : undefined,
        deskContacts: funder.deskContacts ? JSON.parse(JSON.stringify(funder.deskContacts)) : undefined,
        notes: funder.notes ?? null,
        documentsRequired: {
          deleteMany: {},
          create: funder.documentsRequired.map((d) => ({ code: d.code, note: d.note ?? null })),
        },
      },
    });

    await db.tradeResearchRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        outputSummary: `Added/updated trade funder "${funder.name}" (${funder.id})`,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ funderId: funder.id, funderName: funder.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.tradeResearchRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        outputSummary: `Trade funder structuring failed: ${message}`,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: `Trade funder structuring failed: ${message}` },
      { status: 500 },
    );
  }
}
