import { reconcileTradeExtractions } from "@/agents/trade/trade-reconciliation";
import type { TradeDocumentExtraction } from "@/dsl/trade";

function runReconciliationTest() {
  console.log("Starting Trade Reconciliation Unit Test...");

  const mockSupplyExtraction: TradeDocumentExtraction = {
    documentSummary: "Indonesian Coal Supply Contract FOB Taboneo",
    corridor: "IDN_COAL_ASIA",
    tradeLeg: "SUPPLY_LEG",
    documentTypes: ["TRADE_SUPPLY_CONTRACT", "TRADE_MINING_IUP_CONCESSION"],
    parties: [
      {
        role: "SUPPLIER",
        legalName: "PT Sumber Batubara Kalimantan",
        jurisdiction: "Indonesia",
        permitOrLicenseId: "IUP-OP-540/012/DISTAMBEN",
      },
      {
        role: "TRADER",
        legalName: "Meridian Commodities Pte Ltd",
        jurisdiction: "Singapore",
        permitOrLicenseId: "IUP-OPK-821/TRADING",
      },
    ],
    commercialParameters: {
      incoterm: "FOB",
      loadingPortOrTerminal: "Taboneo Anchorage",
      paymentType: "LC_AT_SIGHT",
      currency: "USD",
      totalValueUsd: 3500000,
    },
    commoditySpecs: {
      commodityName: "Indonesian Steam Coal 4200 GAR",
      volume: 50000,
      volumeUnit: "MT",
      tolerancePct: 10,
      qualityParameters: {
        GAR: "4200 kcal/kg",
        TotalMoisture: "34%",
        Ash: "6%",
      },
    },
    specializedVerifications: {
      coalLhvSurveyorReportPresent: true,
      coalSimponiRoyaltyPaid: true,
      rspoOrIspoCertified: false,
      coldChainContinuousOk: false,
      healthCertSanitaryApproved: false,
    },
    riskFlags: [],
    openQuestions: [],
  };

  const mockOfftakeExtraction: TradeDocumentExtraction = {
    documentSummary: "Coal Offtake Sales Contract CFR Guangzhou",
    corridor: "IDN_COAL_ASIA",
    tradeLeg: "OFFTAKE_LEG",
    documentTypes: ["TRADE_OFFTAKE_CONTRACT"],
    parties: [
      {
        role: "TRADER",
        legalName: "Meridian Commodities Pte Ltd",
        jurisdiction: "Singapore",
      },
      {
        role: "BUYER",
        legalName: "Guangdong Coastal Power Generation Co.",
        jurisdiction: "China",
      },
    ],
    commercialParameters: {
      incoterm: "CFR",
      dischargePortOrTerminal: "Guangzhou Port",
      paymentType: "LC_USANCE_90D",
      currency: "USD",
      totalValueUsd: 4100000,
    },
    commoditySpecs: {
      commodityName: "Indonesian Steam Coal 4200 GAR",
      volume: 50000,
      volumeUnit: "MT",
      tolerancePct: 5, // 5% vs 10% tolerance mismatch!
      qualityParameters: {
        GAR: "4200 kcal/kg",
      },
    },
    specializedVerifications: {
      coalLhvSurveyorReportPresent: true,
      coalSimponiRoyaltyPaid: true,
      rspoOrIspoCertified: false,
      coldChainContinuousOk: false,
      healthCertSanitaryApproved: false,
    },
    riskFlags: [],
    openQuestions: [],
  };

  const result = reconcileTradeExtractions(
    "test-deal-coal-01",
    "Meridian / Guangdong Power 50k MT Coal",
    [mockSupplyExtraction, mockOfftakeExtraction],
  );

  console.log("Ready for matching:", result.readyForMatching);
  console.log("Primary Corridor:", result.tradeDealSpec?.corridor);
  console.log("Gross Margin USD:", result.tradeDealSpec?.reconciliationAudit.grossMarginUsd);
  console.log("Cashflow Gap Days:", result.tradeDealSpec?.reconciliationAudit.cashflowGapDays);
  console.log("Risk Flags Found:", result.tradeDealSpec?.riskFlags.length);

  if (!result.tradeDealSpec) {
    throw new Error("Reconciliation failed: tradeDealSpec is null");
  }
  if (result.tradeDealSpec.corridor !== "IDN_COAL_ASIA") {
    throw new Error("Wrong corridor detected");
  }
  if (result.tradeDealSpec.reconciliationAudit.grossMarginUsd !== 600000) {
    throw new Error("Gross margin mismatch");
  }
  if (result.tradeDealSpec.reconciliationAudit.cashflowGapDays !== 90) {
    throw new Error("Cashflow gap mismatch");
  }

  console.log("✅ Trade Reconciliation Unit Test Passed Successfully!");
}

runReconciliationTest();
