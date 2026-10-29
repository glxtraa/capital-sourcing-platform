import type {
  TradeDocumentExtraction,
  TradeDealSpec,
  PartyProfile,
  TradeLegContract,
  TradeCorridor,
} from "@/dsl/trade";
import { resolveDocumentTaint } from "@/dsl/provenance";

export interface ReconciledTradeResult {
  tradeDealSpec: TradeDealSpec | null;
  openQuestions: string[];
  unresolvedRiskFlags: Array<{
    category: string;
    severity: number;
    description: string;
    sourceFileName?: string | null;
    evidenceSnippet?: string | null;
  }>;
  readyForMatching: boolean;
}

/**
 * Deterministically merges and reconciles multi-document trade extractions.
 *
 * Enforces Taint Tracking precedence: AUDITED_PROOF documents take priority
 * over UNVERIFIED_CLAIM documents, and any contradiction between an
 * UNVERIFIED_CLAIM and AUDITED_PROOF emits a TAINTED_CLAIM_CONFLICT risk flag.
 */
export function reconcileTradeExtractions(
  dealId: string,
  dealName: string,
  extractions: Array<TradeDocumentExtraction & { _taintOverride?: string | null }>,
  policyMap?: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM">,
): ReconciledTradeResult {
  const openQuestions: string[] = [];
  const riskFlags: Array<{
    category: string;
    severity: number;
    description: string;
    sourceFileName?: string | null;
    evidenceSnippet?: string | null;
  }> = [];

  // Annotate and sort extractions so AUDITED_PROOF comes first when selecting primary contracts/parties
  const annotated = extractions.map((ext) => ({
    ext,
    taint: resolveDocumentTaint(
      ext.documentTypes,
      ext._taintOverride ?? ext.extractionProvenance?.taint,
      policyMap,
    ),
    fileName: ext.extractionProvenance?.sourceFileName || "Trade Document",
  }));

  const sortedExtractions = [...annotated].sort((a, b) => {
    const score = (t: string) => (t === "AUDITED_PROOF" || t === "HUMAN_VERIFIED" ? 0 : 1);
    return score(a.taint) - score(b.taint);
  });

  // 1. Identify primary corridor
  const corridorCounts = new Map<TradeCorridor, number>();
  for (const { ext } of sortedExtractions) {
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

  // Detect TAINTED_CLAIM_CONFLICT between UNVERIFIED_CLAIM and AUDITED_PROOF on commercial value
  for (const leg of ["SUPPLY_LEG", "OFFTAKE_LEG"] as const) {
    const legDocs = annotated.filter((a) => a.ext.tradeLeg === leg);
    const proofDoc = legDocs.find((a) => a.taint === "AUDITED_PROOF");
    const claimDoc = legDocs.find((a) => a.taint === "UNVERIFIED_CLAIM");
    if (
      proofDoc?.ext.commercialParameters?.totalValueUsd != null &&
      claimDoc?.ext.commercialParameters?.totalValueUsd != null &&
      Math.abs(
        proofDoc.ext.commercialParameters.totalValueUsd -
          claimDoc.ext.commercialParameters.totalValueUsd,
      ) > 1000
    ) {
      riskFlags.push({
        category: "TAINTED_CLAIM_CONFLICT",
        severity: 4,
        description: `Tainted Claim Conflict on ${leg}: Unverified document "${claimDoc.fileName}" claims value $${claimDoc.ext.commercialParameters.totalValueUsd.toLocaleString()} USD vs Audited Proof "${proofDoc.fileName}" ($${proofDoc.ext.commercialParameters.totalValueUsd.toLocaleString()} USD). Audited Proof value selected.`,
        sourceFileName: claimDoc.fileName,
        evidenceSnippet: `Claim (${claimDoc.fileName}): $${claimDoc.ext.commercialParameters.totalValueUsd.toLocaleString()} vs Proof (${proofDoc.fileName}): $${proofDoc.ext.commercialParameters.totalValueUsd.toLocaleString()}`,
      });
    }
  }

  // 2. Identify Paired Contracts (preferring AUDITED_PROOF)
  const supplyEntry = sortedExtractions.find((e) => e.ext.tradeLeg === "SUPPLY_LEG");
  const offtakeEntry = sortedExtractions.find((e) => e.ext.tradeLeg === "OFFTAKE_LEG");
  const supplyDoc = supplyEntry?.ext;
  const offtakeDoc = offtakeEntry?.ext;

  // 3. Extract Core Counterparties with Document Provenance & Taint
  let supplierParty: (typeof extractions[0]["parties"][0] & { provenanceDoc?: string; provenanceTime?: string; provenanceModel?: string; taint?: string }) | undefined;
  let traderParty: (typeof extractions[0]["parties"][0] & { provenanceDoc?: string; provenanceTime?: string; provenanceModel?: string; taint?: string }) | undefined;
  let buyerParty: (typeof extractions[0]["parties"][0] & { provenanceDoc?: string; provenanceTime?: string; provenanceModel?: string; taint?: string }) | undefined;

  for (const { ext, taint } of sortedExtractions) {
    for (const p of ext.parties) {
      if (p.role === "SUPPLIER" && !supplierParty) {
        supplierParty = {
          ...p,
          provenanceDoc: ext.extractionProvenance?.sourceFileName,
          provenanceTime: ext.extractionProvenance?.extractedAt,
          provenanceModel: ext.extractionProvenance?.modelUsed,
          taint,
        };
      }
      if (p.role === "TRADER" && !traderParty) {
        traderParty = {
          ...p,
          provenanceDoc: ext.extractionProvenance?.sourceFileName,
          provenanceTime: ext.extractionProvenance?.extractedAt,
          provenanceModel: ext.extractionProvenance?.modelUsed,
          taint,
        };
      }
      if (p.role === "BUYER" && !buyerParty) {
        buyerParty = {
          ...p,
          provenanceDoc: ext.extractionProvenance?.sourceFileName,
          provenanceTime: ext.extractionProvenance?.extractedAt,
          provenanceModel: ext.extractionProvenance?.modelUsed,
          taint,
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
    taint: supplierParty?.taint ?? supplyEntry?.taint ?? "UNVERIFIED_CLAIM",
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
    taint: traderParty?.taint ?? supplyEntry?.taint ?? "UNVERIFIED_CLAIM",
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
    taint: buyerParty?.taint ?? offtakeEntry?.taint ?? "UNVERIFIED_CLAIM",
    extractionTimestamp: buyerParty?.provenanceTime ?? offtakeDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: buyerParty?.provenanceModel ?? offtakeDoc?.extractionProvenance?.modelUsed ?? null,
  };

  // 4. Reconcile Paired Contract Terms with Provenance & Taint
  const supplyContract: TradeLegContract = {
    contractReference: "SUPPLY-LEG-01",
    incoterm: supplyDoc?.commercialParameters?.incoterm ?? null,
    port: supplyDoc?.commercialParameters?.loadingPortOrTerminal ?? null,
    paymentType: supplyDoc?.commercialParameters?.paymentType ?? null,
    tenorDays: 0,
    contractAmountUsd: supplyDoc?.commercialParameters?.totalValueUsd ?? 0,
    sourceDocument: supplyDoc?.extractionProvenance?.sourceFileName ?? null,
    taint: supplyEntry?.taint ?? "UNVERIFIED_CLAIM",
    extractionTimestamp: supplyDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: supplyDoc?.extractionProvenance?.modelUsed ?? null,
  };

  const offtakeContract: TradeLegContract = {
    contractReference: "OFFTAKE-LEG-01",
    incoterm: offtakeDoc?.commercialParameters?.incoterm ?? null,
    port: offtakeDoc?.commercialParameters?.dischargePortOrTerminal ?? null,
    paymentType: offtakeDoc?.commercialParameters?.paymentType ?? null,
    tenorDays: offtakeDoc?.commercialParameters?.paymentType?.includes("90D") ? 90 : (offtakeDoc?.commercialParameters?.paymentType?.includes("60D") ? 60 : 0),
    contractAmountUsd: offtakeDoc?.commercialParameters?.totalValueUsd ?? 0,
    sourceDocument: offtakeDoc?.extractionProvenance?.sourceFileName ?? null,
    taint: offtakeEntry?.taint ?? "UNVERIFIED_CLAIM",
    extractionTimestamp: offtakeDoc?.extractionProvenance?.extractedAt ?? null,
    modelUsed: offtakeDoc?.extractionProvenance?.modelUsed ?? null,
  };

  // 5. Commodity & Tolerance Reconciliation
  const supplyQty = supplyDoc?.commoditySpecs?.volume ?? 0;
  const offtakeQty = offtakeDoc?.commoditySpecs?.volume ?? 0;
  const supplyTol = supplyDoc?.commoditySpecs?.tolerancePct ?? null;
  const offtakeTol = offtakeDoc?.commoditySpecs?.tolerancePct ?? null;
  const toleranceDelta = supplyTol != null && offtakeTol != null ? Math.abs(supplyTol - offtakeTol) : 0;

  if (toleranceDelta > 0 && supplyTol != null && offtakeTol != null) {
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
