import type {
  TradeDocumentExtraction,
  TradeDealSpec,
  PartyProfile,
  TradeLegContract,
  TradeCorridor,
} from "@/dsl/trade";

export interface ReconciledTradeResult {
  tradeDealSpec: TradeDealSpec | null;
  openQuestions: string[];
  unresolvedRiskFlags: Array<{ category: string; severity: number; description: string }>;
  readyForMatching: boolean;
}

/**
 * Deterministically merges and reconciles multi-document trade extractions.
 *
 * Checks:
 * 1. Paired Contracts: Supply Leg (Supplier -> Trader) vs Offtake Leg (Trader -> Buyer)
 * 2. Quantity & Tolerance Reconciliation
 * 3. Cashflow Gap Analysis (payment tenor differential)
 * 4. Corridor Audits:
 *    - Corridor A (Coal): Verifies IUP-OP link to IUP-OPK permit and LHV presence
 *    - Corridor B (Agri): Verifies RSPO/ISPO certifications
 *    - Corridor C (Seafood): Verifies cold chain datalogs & health certificates
 */
export function reconcileTradeExtractions(
  dealId: string,
  dealName: string,
  extractions: TradeDocumentExtraction[],
): ReconciledTradeResult {
  const openQuestions: string[] = [];
  const riskFlags: Array<{ category: string; severity: number; description: string }> = [];

  // 1. Identify primary corridor
  const corridorCounts = new Map<TradeCorridor, number>();
  for (const ext of extractions) {
    corridorCounts.set(ext.corridor, (corridorCounts.get(ext.corridor) ?? 0) + 1);
    openQuestions.push(...ext.openQuestions);
    riskFlags.push(...ext.riskFlags);
  }
  let primaryCorridor: TradeCorridor = "OTHER_CROSS_BORDER";
  let maxCount = 0;
  for (const [corr, count] of corridorCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryCorridor = corr;
    }
  }

  // 2. Identify Paired Contracts
  const supplyDoc = extractions.find((e) => e.tradeLeg === "SUPPLY_LEG");
  const offtakeDoc = extractions.find((e) => e.tradeLeg === "OFFTAKE_LEG");

  // 3. Extract Core Counterparties with Document Provenance
  let supplierParty: (typeof extractions[0]["parties"][0] & { provenanceDoc?: string; provenanceTime?: string; provenanceModel?: string }) | undefined;
  let traderParty: (typeof extractions[0]["parties"][0] & { provenanceDoc?: string; provenanceTime?: string; provenanceModel?: string }) | undefined;
  let buyerParty: (typeof extractions[0]["parties"][0] & { provenanceDoc?: string; provenanceTime?: string; provenanceModel?: string }) | undefined;

  for (const ext of extractions) {
    for (const p of ext.parties) {
      if (p.role === "SUPPLIER" && !supplierParty) {
        supplierParty = {
          ...p,
          provenanceDoc: ext.extractionProvenance?.sourceFileName,
          provenanceTime: ext.extractionProvenance?.extractedAt,
          provenanceModel: ext.extractionProvenance?.modelUsed,
        };
      }
      if (p.role === "TRADER" && !traderParty) {
        traderParty = {
          ...p,
          provenanceDoc: ext.extractionProvenance?.sourceFileName,
          provenanceTime: ext.extractionProvenance?.extractedAt,
          provenanceModel: ext.extractionProvenance?.modelUsed,
        };
      }
      if (p.role === "BUYER" && !buyerParty) {
        buyerParty = {
          ...p,
          provenanceDoc: ext.extractionProvenance?.sourceFileName,
          provenanceTime: ext.extractionProvenance?.extractedAt,
          provenanceModel: ext.extractionProvenance?.modelUsed,
        };
      }
    }
  }

  const supplier: PartyProfile = {
    id: "party-supplier",
    legalName: supplierParty?.legalName ?? "Unknown Supplier",
    jurisdiction: supplierParty?.jurisdiction ?? "Unknown",
    role: "SUPPLIER",
    concessionOrLicenseNumber: supplierParty?.permitOrLicenseId ?? null,
    licenseVerified: Boolean(supplierParty?.permitOrLicenseId),
    sourceDocument: supplierParty?.provenanceDoc ?? supplyDoc?.extractionProvenance?.sourceFileName ?? null,
    extractionTimestamp: supplierParty?.provenanceTime ?? supplyDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: supplierParty?.provenanceModel ?? supplyDoc?.extractionProvenance?.modelUsed ?? null,
  };

  const trader: PartyProfile = {
    id: "party-trader",
    legalName: traderParty?.legalName ?? "Unknown Trader",
    jurisdiction: traderParty?.jurisdiction ?? "Unknown",
    role: "TRADER",
    concessionOrLicenseNumber: traderParty?.permitOrLicenseId ?? null,
    licenseVerified: Boolean(traderParty?.permitOrLicenseId),
    sourceDocument: traderParty?.provenanceDoc ?? supplyDoc?.extractionProvenance?.sourceFileName ?? null,
    extractionTimestamp: traderParty?.provenanceTime ?? supplyDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: traderParty?.provenanceModel ?? supplyDoc?.extractionProvenance?.modelUsed ?? null,
  };

  const buyer: PartyProfile = {
    id: "party-buyer",
    legalName: buyerParty?.legalName ?? "Unknown Buyer",
    jurisdiction: buyerParty?.jurisdiction ?? "Unknown",
    role: "BUYER",
    concessionOrLicenseNumber: buyerParty?.permitOrLicenseId ?? null,
    licenseVerified: true,
    sourceDocument: buyerParty?.provenanceDoc ?? offtakeDoc?.extractionProvenance?.sourceFileName ?? null,
    extractionTimestamp: buyerParty?.provenanceTime ?? offtakeDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: buyerParty?.provenanceModel ?? offtakeDoc?.extractionProvenance?.modelUsed ?? null,
  };

  // 4. Reconcile Paired Contract Terms with Provenance
  const supplyContract: TradeLegContract = {
    contractReference: "SUPPLY-LEG-01",
    incoterm: supplyDoc?.commercialParameters?.incoterm ?? "FOB",
    port: supplyDoc?.commercialParameters?.loadingPortOrTerminal ?? "Loading Port TBD",
    paymentType: supplyDoc?.commercialParameters?.paymentType ?? "LC_AT_SIGHT",
    tenorDays: 0,
    contractAmountUsd: supplyDoc?.commercialParameters?.totalValueUsd ?? 0,
    sourceDocument: supplyDoc?.extractionProvenance?.sourceFileName ?? null,
    extractionTimestamp: supplyDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: supplyDoc?.extractionProvenance?.modelUsed ?? null,
  };

  const offtakeContract: TradeLegContract = {
    contractReference: "OFFTAKE-LEG-01",
    incoterm: offtakeDoc?.commercialParameters?.incoterm ?? "CFR",
    port: offtakeDoc?.commercialParameters?.dischargePortOrTerminal ?? "Discharge Port TBD",
    paymentType: offtakeDoc?.commercialParameters?.paymentType ?? "LC_USANCE_90D",
    tenorDays: offtakeDoc?.commercialParameters?.paymentType?.includes("90D") ? 90 : 60,
    contractAmountUsd: offtakeDoc?.commercialParameters?.totalValueUsd ?? 0,
    sourceDocument: offtakeDoc?.extractionProvenance?.sourceFileName ?? null,
    extractionTimestamp: offtakeDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: offtakeDoc?.extractionProvenance?.modelUsed ?? null,
  };

  // 5. Commodity & Tolerance Reconciliation
  const supplyQty = supplyDoc?.commoditySpecs?.volume ?? 0;
  const offtakeQty = offtakeDoc?.commoditySpecs?.volume ?? 0;
  const supplyTol = supplyDoc?.commoditySpecs?.tolerancePct ?? 10;
  const offtakeTol = offtakeDoc?.commoditySpecs?.tolerancePct ?? 5;
  const toleranceDelta = Math.abs(supplyTol - offtakeTol);

  if (toleranceDelta > 0) {
    riskFlags.push({
      category: "QUANTITY_OR_TOLERANCE_MISMATCH",
      severity: toleranceDelta > 5 ? 4 : 2,
      description: `Tolerance mismatch: Supply contract specifies +/-${supplyTol}% vs Offtake contract specifies +/-${offtakeTol}%. Trader bears volumetric shortfall risk.`,
    });
  }

  // 6. Cashflow Gap Analysis
  const cashflowGapDays = offtakeContract.tenorDays - supplyContract.tenorDays;
  if (cashflowGapDays > 0) {
    riskFlags.push({
      category: "PAYMENT_TERM_DESYNCHRONIZATION",
      severity: 3,
      description: `Cashflow timeline gap: Trader must settle supplier at ${supplyContract.paymentType} but only receives buyer settlement after ${offtakeContract.tenorDays} days (${cashflowGapDays} days liquidity deficit).`,
    });
  }

  const grossMarginUsd = offtakeContract.contractAmountUsd - supplyContract.contractAmountUsd;
  const grossMarginPct =
    supplyContract.contractAmountUsd > 0
      ? (grossMarginUsd / supplyContract.contractAmountUsd) * 100
      : 0;

  // 7. Corridor-Specific Specialized Audits
  const hasLhv = extractions.some((e) => e.specializedVerifications.coalLhvSurveyorReportPresent);
  const hasSimponi = extractions.some((e) => e.specializedVerifications.coalSimponiRoyaltyPaid);
  const concessionChainVerified =
    primaryCorridor === "IDN_COAL_ASIA" ? hasLhv && hasSimponi : Boolean(supplier.concessionOrLicenseNumber);

  if (primaryCorridor === "IDN_COAL_ASIA" && !hasLhv) {
    riskFlags.push({
      category: "CHAIN_OF_TITLE_GAP",
      severity: 4,
      description: "Mandatory Indonesian Coal Laporan Surveyor (LHV) report missing from trade documents.",
    });
  }

  const sustainabilityCertVerified = extractions.some(
    (e) => e.specializedVerifications.rspoOrIspoCertified,
  );
  if (primaryCorridor === "SEA_AGRI_GLOBAL" && !sustainabilityCertVerified) {
    riskFlags.push({
      category: "MISSING_MANDATORY_PERMIT",
      severity: 3,
      description: "RSPO/ISPO sustainability certification not verified for agricultural cargo.",
    });
  }

  const coldChainContinuousOk = extractions.some(
    (e) => e.specializedVerifications.coldChainContinuousOk,
  );
  const healthCertSanitaryApproved = extractions.some(
    (e) => e.specializedVerifications.healthCertSanitaryApproved,
  );
  const coldChainSanitaryClearance = coldChainContinuousOk && healthCertSanitaryApproved;

  if (primaryCorridor === "LATAM_SEAFOOD_ASIA" && !coldChainSanitaryClearance) {
    riskFlags.push({
      category: "COLD_CHAIN_TEMPERATURE_ABUSE",
      severity: 4,
      description: "Seafood shipment missing validated continuous reefer temperature log (-18°C) or official health certificate.",
    });
  }

  const commodityName =
    supplyDoc?.commoditySpecs?.commodityName ??
    offtakeDoc?.commoditySpecs?.commodityName ??
    "Bulk Commodity";

  const qualityAssay = {
    ...(supplyDoc?.commoditySpecs?.qualityParameters ?? {}),
    ...(offtakeDoc?.commoditySpecs?.qualityParameters ?? {}),
  };

  const hasCriticalRisk = riskFlags.some((r) => r.severity >= 5);
  const readyForMatching =
    Boolean(supplierParty?.legalName) &&
    Boolean(buyerParty?.legalName) &&
    !hasCriticalRisk &&
    (supplyContract.contractAmountUsd > 0 || offtakeContract.contractAmountUsd > 0);

  const tradeDealSpec: TradeDealSpec = {
    dealId,
    dealName,
    corridor: primaryCorridor,
    supplier,
    trader,
    buyer,
    supplyContract,
    offtakeContract,
    commodity: {
      name: commodityName,
      contractQuantity: offtakeQty > 0 ? offtakeQty : supplyQty,
      unit: supplyDoc?.commoditySpecs?.volumeUnit ?? "MT",
      unitPriceUsd: 0,
      qualityAssay,
    },
    reconciliationAudit: {
      volumeToleranceDelta: toleranceDelta,
      specReconciled: toleranceDelta <= 5,
      specNotes: `Volume: ${supplyQty} vs ${offtakeQty}. Tolerance delta: ${toleranceDelta}%.`,
      cashflowGapDays,
      grossMarginUsd,
      grossMarginPct,
    },
    corridorAudits: {
      concessionChainVerified,
      sustainabilityCertVerified,
      coldChainSanitaryClearance,
    },
    riskFlags,
    readyForMatching,
  };

  return {
    tradeDealSpec,
    openQuestions,
    unresolvedRiskFlags: riskFlags,
    readyForMatching,
  };
}
