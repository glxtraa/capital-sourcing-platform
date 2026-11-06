import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { deleteDealDocument } from "@/lib/blob";

export async function GET(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      parties: true,
      contractLegs: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      matches: { include: { funder: { include: { documentsRequired: true } } }, orderBy: { verdict: "asc" } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 1 },
      researchRuns: { orderBy: { startedAt: "desc" } },
    },
  });

  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: { documents: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Trade deal not found" }, { status: 404 });
  }

  if (deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (deal.documents.length > 0) {
    await Promise.allSettled(
      deal.documents.map((doc) => {
        if (!doc.blobUrl) return Promise.resolve();
        return deleteDealDocument(doc.blobUrl).catch((err) => {
          console.warn(`Failed to delete blob for doc ${doc.id} (${doc.blobUrl}):`, err);
        });
      })
    );
  }

  await db.tradeDeal.delete({
    where: { id: dealId },
  });

  return NextResponse.json({ ok: true, deletedId: dealId });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: {
      parties: true,
      contractLegs: true,
      financingAsks: true,
      documents: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Trade deal not found" }, { status: 404 });
  }

  if (deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { name, corridor, parties, contractLegs, financingAsks } = body;

  await db.$transaction(async (tx) => {
    // 1. Update basic deal details
    await tx.tradeDeal.update({
      where: { id: dealId },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(corridor ? { corridor } : {}),
      },
    });

    // 2. Update parties if supplied
    if (Array.isArray(parties)) {
      await tx.tradeParty.deleteMany({ where: { dealId } });
      await tx.tradeParty.createMany({
        data: parties.map((p: any) => ({
          dealId,
          legalName: p.legalName || "Unknown Party",
          role: p.role || "BUYER",
          jurisdiction: p.country || p.jurisdiction || "Global",
        })),
      });
    }

    // 3. Update contract legs if supplied
    if (Array.isArray(contractLegs)) {
      await tx.contractLeg.deleteMany({ where: { dealId } });
      await tx.contractLeg.createMany({
        data: contractLegs.map((l: any) => ({
          dealId,
          legType: l.legRole || l.legType || "SUPPLY_LEG",
          contractReference: l.contractReference || "CR-" + Math.floor(Math.random() * 10000),
          sellerName: l.sellerName || "Supplier",
          buyerName: l.buyerName || "Trader",
          incoterm: l.incoterm || "FOB",
          port: l.port || "Origin Port",
          paymentType: l.paymentType || "LC",
          commodityName: l.goodsDescription || l.commodityName || "Commodity Cargo",
          quantity: typeof l.quantity === "number" ? l.quantity : 1000,
          unit: l.unit || "MT",
          unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : 1000,
          amountUsd: typeof l.pricingAmountUsd === "number" ? l.pricingAmountUsd : (l.amountUsd ?? 1000000),
          tenorDays: typeof l.paymentTermsDays === "number" ? l.paymentTermsDays : (l.tenorDays ?? 30),
        })),
      });
    }

    // 4. Update financing asks if supplied
    if (Array.isArray(financingAsks)) {
      await tx.tradeFinancingAskModel.deleteMany({ where: { dealId } });
      await tx.tradeFinancingAskModel.createMany({
        data: financingAsks.map((a: any) => ({
          dealId,
          targetEntityName: a.targetEntityName || "Trader",
          instrument: a.facilityStructure || a.instrument || "RECEIVABLES",
          amountUsd: typeof a.requestedAmountUsd === "number" ? a.requestedAmountUsd : (a.amountUsd ?? 1000000),
          advanceRatePct: typeof a.advanceRatePct === "number" ? a.advanceRatePct : 85,
          tenorDaysMin: typeof a.tenorDaysMin === "number" ? a.tenorDaysMin : 30,
          tenorDaysMax: typeof a.tenorDays === "number" ? a.tenorDays : (a.tenorDaysMax ?? 90),
        })),
      });
    }
  });

  // Re-run matching automatically
  try {
    const updatedDeal = await db.tradeDeal.findUnique({
      where: { id: dealId },
      include: {
        parties: true,
        contractLegs: true,
        financingAsks: true,
        documents: true,
      },
    });

    if (updatedDeal) {
      const { matchTradeDeal } = await import("@/lib/trade-matching");
      const { reconcileTradeExtractions } = await import("@/agents/trade/trade-reconciliation");
      const extractions = updatedDeal.documents.map((d) => d.extractedRaw).filter(Boolean) as any[];
      const recon = reconcileTradeExtractions(dealId, updatedDeal.name, extractions);
      if (recon.tradeDealSpec) {
        const funders = await db.tradeFunder.findMany({ include: { documentsRequired: true } });
        const matchResult = matchTradeDeal(recon.tradeDealSpec, funders, updatedDeal.documents);

        const matchesToCreate = [
          ...matchResult.umbrellaMatches.map((m) => ({
            dealId,
            funderId: m.funderId,
            isUmbrella: true,
            verdict: m.verdict,
            rationale: m.rationale,
            isTier1: m.isTier1,
          })),
          ...matchResult.modularMatches.supplierLegMatches
            .map((m) => ({
              dealId,
              funderId: m.funderId,
              isUmbrella: false,
              verdict: m.verdict,
              rationale: `[Supplier Leg] ${m.rationale}`,
              isTier1: false,
            })),
          ...matchResult.modularMatches.traderLegMatches
            .map((m) => ({
              dealId,
              funderId: m.funderId,
              isUmbrella: false,
              verdict: m.verdict,
              rationale: `[Trader Leg] ${m.rationale}`,
              isTier1: false,
            })),
          ...matchResult.modularMatches.buyerLegMatches
            .map((m) => ({
              dealId,
              funderId: m.funderId,
              isUmbrella: false,
              verdict: m.verdict,
              rationale: `[Buyer Leg] ${m.rationale}`,
              isTier1: false,
            })),
        ];

        // Deduplicate by funderId (prioritize GOOD > POSSIBLE > EXCLUDED, and Umbrella > Modular)
        const scoreVerdict = (v: string) => (v === "GOOD" ? 3 : v === "POSSIBLE" ? 2 : 1);
        const matchMap = new Map<string, typeof matchesToCreate[0]>();
        for (const item of matchesToCreate) {
          const existing = matchMap.get(item.funderId);
          if (!existing) {
            matchMap.set(item.funderId, item);
          } else {
            const scoreExisting = scoreVerdict(existing.verdict) + (existing.isUmbrella ? 1 : 0);
            const scoreNew = scoreVerdict(item.verdict) + (item.isUmbrella ? 1 : 0);
            if (scoreNew > scoreExisting) {
              matchMap.set(item.funderId, item);
            }
          }
        }
        const uniqueMatches = Array.from(matchMap.values());

        await db.$transaction(async (tx) => {
          await tx.tradeFunderMatchModel.deleteMany({ where: { dealId } });
          if (uniqueMatches.length > 0) {
            await tx.tradeFunderMatchModel.createMany({ data: uniqueMatches });
          }
        });
      }
    }
  } catch (err) {
    console.warn("Notice: auto-match refresh on trade deal edit:", err);
  }

  const finalDeal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: {
      parties: true,
      contractLegs: true,
      financingAsks: true,
      documents: true,
      matches: { include: { funder: true } },
    },
  });

  return NextResponse.json(finalDeal);
}
