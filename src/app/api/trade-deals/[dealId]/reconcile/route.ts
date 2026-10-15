import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reconcileTradeExtractions } from "@/agents/trade/trade-reconciliation";
import type { TradeDocumentExtraction } from "@/dsl/trade";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: { documents: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Trade deal not found" }, { status: 404 });
  }

  const extractedDocs = deal.documents.filter((d) => !!d.extractedRaw);
  if (extractedDocs.length === 0) {
    return NextResponse.json(
      {
        error: "Cannot reconcile: none of the uploaded documents have been extracted yet.",
      },
      { status: 409 },
    );
  }

  const extractions = extractedDocs.map(
    (d) => d.extractedRaw as unknown as TradeDocumentExtraction,
  );

  const reconciliation = reconcileTradeExtractions(deal.id, deal.name, extractions);

  if (!reconciliation.tradeDealSpec) {
    return NextResponse.json({ error: "Failed to produce trade deal spec" }, { status: 500 });
  }

  const spec = reconciliation.tradeDealSpec;

  // Persist reconciled data atomically
  await db.$transaction(async (tx) => {
    // 1. Clean existing children
    await tx.tradeParty.deleteMany({ where: { dealId } });
    await tx.contractLeg.deleteMany({ where: { dealId } });
    await tx.tradeRiskFlag.deleteMany({ where: { dealId } });

    // 2. Persist parties
    await tx.tradeParty.createMany({
      data: [
        {
          dealId,
          role: "SUPPLIER",
          legalName: spec.supplier.legalName,
          jurisdiction: spec.supplier.jurisdiction,
          concessionOrLicenseId: spec.supplier.concessionOrLicenseNumber,
          concessionVerified: spec.supplier.licenseVerified,
        },
        {
          dealId,
          role: "TRADER",
          legalName: spec.trader.legalName,
          jurisdiction: spec.trader.jurisdiction,
          concessionOrLicenseId: spec.trader.concessionOrLicenseNumber,
          concessionVerified: spec.trader.licenseVerified,
        },
        {
          dealId,
          role: "BUYER",
          legalName: spec.buyer.legalName,
          jurisdiction: spec.buyer.jurisdiction,
          concessionOrLicenseId: spec.buyer.concessionOrLicenseNumber,
          concessionVerified: spec.buyer.licenseVerified,
        },
      ],
    });

    // 3. Persist paired legs
    await tx.contractLeg.createMany({
      data: [
        {
          dealId,
          legType: "SUPPLY_LEG",
          contractReference: spec.supplyContract.contractReference,
          sellerName: spec.supplier.legalName,
          buyerName: spec.trader.legalName,
          incoterm: spec.supplyContract.incoterm,
          port: spec.supplyContract.port,
          paymentType: spec.supplyContract.paymentType,
          tenorDays: spec.supplyContract.tenorDays,
          amountUsd: spec.supplyContract.contractAmountUsd,
          commodityName: spec.commodity.name,
          quantity: spec.commodity.contractQuantity,
          unit: spec.commodity.unit,
          unitPrice: spec.commodity.unitPriceUsd,
        },
        {
          dealId,
          legType: "OFFTAKE_LEG",
          contractReference: spec.offtakeContract.contractReference,
          sellerName: spec.trader.legalName,
          buyerName: spec.buyer.legalName,
          incoterm: spec.offtakeContract.incoterm,
          port: spec.offtakeContract.port,
          paymentType: spec.offtakeContract.paymentType,
          tenorDays: spec.offtakeContract.tenorDays,
          amountUsd: spec.offtakeContract.contractAmountUsd,
          commodityName: spec.commodity.name,
          quantity: spec.commodity.contractQuantity,
          unit: spec.commodity.unit,
          unitPrice: spec.commodity.unitPriceUsd,
        },
      ],
    });

    // 4. Persist risk flags
    if (spec.riskFlags.length > 0) {
      await tx.tradeRiskFlag.createMany({
        data: spec.riskFlags.map((rf) => ({
          dealId,
          category: rf.category,
          severity: rf.severity,
          description: rf.description,
        })),
      });
    }

    // 5. Update deal status
    await tx.tradeDeal.update({
      where: { id: dealId },
      data: {
        status: reconciliation.readyForMatching ? "READY_TO_MATCH" : "RECONCILING",
        corridor: spec.corridor,
      },
    });
  });

  return NextResponse.json({
    dealId,
    readyForMatching: reconciliation.readyForMatching,
    spec,
  });
}
