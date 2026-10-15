import { matchTradeDeal } from "../src/lib/trade-matching";
import { SEED_TRADE_FUNDERS } from "./seed-trade-funders";
import type { TradeDealSpec } from "../src/dsl/trade";
import type { TradeFunder, UploadedTradeDocument } from "@prisma/client";

function testPhase4MatchingCascade() {
  console.log("Starting Phase 4 Two-Tier Matching Cascade Unit Test...");

  const mockDealSpec: TradeDealSpec = {
    dealId: "test-deal-coal-01",
    dealName: "Meridian / Guangdong Coastal 50k MT Coal",
    corridor: "IDN_COAL_ASIA",
    supplier: {
      id: "supplier-01",
      legalName: "PT Sumber Batubara Kalimantan",
      jurisdiction: "Indonesia",
      role: "SUPPLIER",
      concessionOrLicenseNumber: "IUP-OP-540/012",
      licenseVerified: true,
    },
    trader: {
      id: "trader-01",
      legalName: "Meridian Commodities Pte Ltd",
      jurisdiction: "Singapore",
      role: "TRADER",
      concessionOrLicenseNumber: "IUP-OPK-821",
      licenseVerified: true,
    },
    buyer: {
      id: "buyer-01",
      legalName: "Guangdong Coastal Power Generation",
      jurisdiction: "China",
      role: "BUYER",
      licenseVerified: true,
    },
    supplyContract: {
      contractReference: "SUPPLY-01",
      incoterm: "FOB",
      port: "Taboneo",
      paymentType: "LC_AT_SIGHT",
      tenorDays: 0,
      contractAmountUsd: 3500000,
    },
    offtakeContract: {
      contractReference: "OFFTAKE-01",
      incoterm: "CFR",
      port: "Guangzhou",
      paymentType: "LC_USANCE_90D",
      tenorDays: 90,
      contractAmountUsd: 4100000,
    },
    commodity: {
      name: "Indonesian Steam Coal 4200 GAR",
      contractQuantity: 50000,
      unit: "MT",
      unitPriceUsd: 82,
      qualityAssay: { GAR: "4200 kcal/kg" },
    },
    reconciliationAudit: {
      volumeToleranceDelta: 5,
      specReconciled: true,
      specNotes: "Volume reconciled within 5% tolerance",
      cashflowGapDays: 90,
      grossMarginUsd: 600000,
      grossMarginPct: 17.14,
    },
    corridorAudits: {
      concessionChainVerified: true,
      sustainabilityCertVerified: false,
      coldChainSanitaryClearance: false,
    },
    riskFlags: [],
    readyForMatching: true,
  };

  const mockFunders = SEED_TRADE_FUNDERS.map((f) => ({
    ...f,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastVerified: f.lastVerified ? new Date(f.lastVerified) : null,
    minTicketUsd: f.minTicketUsd ?? null,
    maxTicketUsd: f.maxTicketUsd ?? null,
    typicalMinAnnualTurnoverUsd: f.typicalMinAnnualTurnoverUsd ?? null,
    maxAdvanceRatePct: f.maxAdvanceRatePct ?? null,
    indicativePricingGuidance: f.indicativePricingGuidance ?? null,
    gatingFactor: f.gatingFactor ?? null,
    notes: f.notes ?? null,
    documentsRequired: f.documentsRequired.map((d, idx) => ({
      id: `req-${idx}`,
      funderId: f.id,
      code: d.code,
      note: d.note ?? null,
    })),
  })) as unknown as (TradeFunder & { documentsRequired: { code: string; note: string | null }[] })[];

  const mockDocs: UploadedTradeDocument[] = [
    {
      id: "doc-1",
      dealId: "test-deal-coal-01",
      fileName: "supply_contract.pdf",
      blobUrl: "https://blob/1",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      tradeLeg: "SUPPLY_LEG",
      documentTypes: ["TRADE_SUPPLY_CONTRACT", "TRADE_MINING_IUP_CONCESSION"],
      extractedRaw: null,
      uploadedAt: new Date(),
    },
    {
      id: "doc-2",
      dealId: "test-deal-coal-01",
      fileName: "offtake_contract.pdf",
      blobUrl: "https://blob/2",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      tradeLeg: "OFFTAKE_LEG",
      documentTypes: ["TRADE_OFFTAKE_CONTRACT"],
      extractedRaw: null,
      uploadedAt: new Date(),
    },
    {
      id: "doc-3",
      dealId: "test-deal-coal-01",
      fileName: "lhv_report.pdf",
      blobUrl: "https://blob/3",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      tradeLeg: "INSPECTION_SURVEY",
      documentTypes: ["TRADE_LHV_SURVEYOR_REPORT", "TRADE_SIMPONI_ROYALTY_RECEIPT"],
      extractedRaw: null,
      uploadedAt: new Date(),
    },
  ];

  const result = matchTradeDeal(mockDealSpec, mockFunders, mockDocs);

  console.log("Matching result produced at:", result.matchedAt);
  console.log("Recommended Route:", result.recommendedRoute);
  console.log("Umbrella Matches Found:", result.umbrellaMatches.length);

  const goodUmbrella = result.umbrellaMatches.filter((m) => m.verdict === "GOOD");
  console.log("Eligible (Tier 1) Umbrella Funders:", goodUmbrella.map((m) => m.funderName));

  const supplierLegs = result.modularMatches.supplierLegMatches.filter((m) => m.verdict === "POSSIBLE");
  const traderLegs = result.modularMatches.traderLegMatches.filter((m) => m.verdict === "POSSIBLE");
  const buyerLegs = result.modularMatches.buyerLegMatches.filter((m) => m.verdict === "POSSIBLE");

  console.log(`Modular Leg Candidates: Supplier (${supplierLegs.length}), Trader (${traderLegs.length}), Buyer (${buyerLegs.length})`);

  if (!result.umbrellaMatchesAvailable) {
    throw new Error("Expected umbrella matches to be available for BNI and Mandiri on coal corridor");
  }
  if (result.recommendedRoute !== "PURSUE_UMBRELLA") {
    throw new Error("Expected PURSUE_UMBRELLA recommendation");
  }

  console.log("\n✅ Phase 4 Two-Tier Matching Cascade Test Passed Successfully!");
}

testPhase4MatchingCascade();
