import type {
  StartupDocumentExtraction,
  StartupDealSpec,
  FounderExtraction,
  SafeHolderExtraction,
  CommonHolderExtraction,
  StartupStage,
  StartupSector,
} from "@/dsl/vc";
import { resolveDocumentTaint } from "@/dsl/provenance";

export interface ReconciledStartupResult {
  startupDealSpec: StartupDealSpec | null;
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
 * Deterministically merges and reconciles multi-document startup data room extractions.
 *
 * Enforces Taint Tracking precedence: AUDITED_PROOF documents (financial models, cap tables,
 * charters, term sheets, or any taxonomy code configured as AUDITED_PROOF in DocumentTaintPolicy)
 * take priority over UNVERIFIED_CLAIM documents (pitch decks, one-pagers).
 */
export function reconcileStartupExtractions(
  dealId: string,
  dealName: string,
  extractions: Array<StartupDocumentExtraction & { _taintOverride?: string | null; _fileName?: string }>,
  policyMap?: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM">,
): ReconciledStartupResult {
  const openQuestions: string[] = [];
  const riskFlags: Array<{
    category: string;
    severity: number;
    description: string;
    sourceFileName?: string | null;
    evidenceSnippet?: string | null;
  }> = [];
  const discrepancies: string[] = [];

  const annotated = extractions.map((ext) => ({
    ext,
    taint: resolveDocumentTaint(ext.documentTypes, ext._taintOverride, policyMap),
    fileName: ext._fileName || ext.riskFlags?.[0]?.sourceFileName || "Data Room Document",
  }));

  // Sort so AUDITED_PROOF documents come first when finding primary values
  const sorted = [...annotated].sort((a, b) => {
    const score = (t: string) => (t === "AUDITED_PROOF" || t === "HUMAN_VERIFIED" ? 0 : 1);
    return score(a.taint) - score(b.taint);
  });

  for (const { ext } of sorted) {
    openQuestions.push(...ext.openQuestions);
    riskFlags.push(...ext.riskFlags);
  }

  // 1. Identify primary company metadata (preferring AUDITED_PROOF)
  const companyName =
    sorted.find((e) => Boolean(e.ext.companyName))?.ext.companyName ?? dealName;

  const stageCounts = new Map<StartupStage, number>();
  for (const { ext } of sorted) {
    if (ext.stage) {
      stageCounts.set(ext.stage, (stageCounts.get(ext.stage) ?? 0) + 1);
    }
  }
  let primaryStage: StartupStage = "SEED";
  let maxStageCount = 0;
  for (const [s, count] of stageCounts) {
    if (count > maxStageCount) {
      maxStageCount = count;
      primaryStage = s;
    }
  }

  const verticalCounts = new Map<StartupSector, number>();
  for (const { ext } of sorted) {
    if (ext.primaryVertical) {
      verticalCounts.set(ext.primaryVertical, (verticalCounts.get(ext.primaryVertical) ?? 0) + 1);
    }
  }
  let primaryVertical: StartupSector = "B2B_SAAS";
  let maxVertCount = 0;
  for (const [v, count] of verticalCounts) {
    if (count > maxVertCount) {
      maxVertCount = count;
      primaryVertical = v;
    }
  }

  const legalJurisdiction =
    sorted.find((e) => Boolean(e.ext.legalEntityJurisdiction))?.ext.legalEntityJurisdiction ?? null;

  // 2. Aggregate and Deduplicate Founders (AUDITED_PROOF first so its equityOwnershipPct wins)
  const foundersMap = new Map<string, FounderExtraction>();
  for (const { ext } of sorted) {
    for (const founder of ext.founders) {
      const key = founder.name.toLowerCase().trim();
      const existing = foundersMap.get(key);
      if (!existing) {
        foundersMap.set(key, founder);
      } else {
        foundersMap.set(key, {
          name: existing.name || founder.name,
          role: existing.role || founder.role,
          isTechnical: existing.isTechnical || founder.isTechnical,
          isRepeatFounder: existing.isRepeatFounder || founder.isRepeatFounder,
          equityOwnershipPct: existing.equityOwnershipPct ?? founder.equityOwnershipPct,
          vestingConfirmed: existing.vestingConfirmed && founder.vestingConfirmed,
          linkedinUrl: existing.linkedinUrl ?? founder.linkedinUrl,
          priorExits: Array.from(new Set([...existing.priorExits, ...founder.priorExits])),
        });
      }
    }
  }
  const founders = Array.from(foundersMap.values());

  // 3. Reconcile Financials & Traction using Taint Tracking (AUDITED_PROOF vs UNVERIFIED_CLAIM)
  const proofTractionEntry =
    sorted.find((e) => e.taint === "AUDITED_PROOF" && e.ext.traction?.arrUsd != null) ??
    sorted.find((e) => e.ext.documentTypes.includes("VC_FINANCIAL_MODEL"));
  const claimTractionEntry =
    sorted.find((e) => e.taint === "UNVERIFIED_CLAIM" && e.ext.traction?.arrUsd != null) ??
    sorted.find((e) => e.ext.documentTypes.includes("VC_PITCH_DECK"));

  const modelDoc = proofTractionEntry?.ext;
  const deckDoc = claimTractionEntry?.ext;

  const arrFromModel = modelDoc?.traction?.arrUsd ?? null;
  const arrFromDeck = deckDoc?.traction?.arrUsd ?? null;

  if (
    arrFromModel != null &&
    arrFromDeck != null &&
    proofTractionEntry !== claimTractionEntry &&
    Math.abs(arrFromModel - arrFromDeck) > 50000
  ) {
    const diff = Math.abs(arrFromModel - arrFromDeck);
    const disc = `Tainted Claim Conflict: Unverified Claim (${claimTractionEntry?.fileName || "Pitch Deck"}) states ARR $${arrFromDeck.toLocaleString()} vs Audited Proof (${proofTractionEntry?.fileName || "Financial Model"}) ARR $${arrFromModel.toLocaleString()} (delta $${diff.toLocaleString()}). Audited Proof value selected.`;
    discrepancies.push(disc);
    riskFlags.push({
      category: "TAINTED_CLAIM_CONFLICT",
      severity: 4,
      description: disc,
      sourceFileName: claimTractionEntry?.fileName || null,
      evidenceSnippet: `Claim (${claimTractionEntry?.fileName}): $${arrFromDeck.toLocaleString()} ARR vs Proof (${proofTractionEntry?.fileName}): $${arrFromModel.toLocaleString()} ARR`,
    });
  }

  const resolvedArr = arrFromModel ?? arrFromDeck ?? sorted.find((e) => e.ext.traction?.arrUsd != null)?.ext.traction?.arrUsd ?? null;
  const resolvedMrr = modelDoc?.traction?.mrrUsd ?? deckDoc?.traction?.mrrUsd ?? sorted.find((e) => e.ext.traction?.mrrUsd != null)?.ext.traction?.mrrUsd ?? null;
  const resolvedGrowth = modelDoc?.traction?.momGrowthRatePct ?? deckDoc?.traction?.momGrowthRatePct ?? null;
  const resolvedBurn = modelDoc?.traction?.netMonthlyBurnUsd ?? deckDoc?.traction?.netMonthlyBurnUsd ?? null;
  const resolvedRunway = modelDoc?.traction?.cashRunwayMonths ?? deckDoc?.traction?.cashRunwayMonths ?? null;

  // Runway Emergency Check
  if (resolvedRunway != null && resolvedRunway <= 3) {
    riskFlags.push({
      category: "CRITICAL_RUNWAY_IMBALANCE",
      severity: 5,
      description: `Critical cash runway warning: Only ${resolvedRunway} month(s) of cash remaining. High urgency for round closing.`,
    });
  }

  // 4. Reconcile Cap Table (preferring AUDITED_PROOF)
  const capDoc =
    sorted.find((e) => e.taint === "AUDITED_PROOF" && e.ext.capTable?.foundersOwnershipPct != null)?.ext ??
    extractions.find((e) => e.documentTypes.includes("VC_CAP_TABLE"));
  const foundersOwnership = capDoc?.capTable?.foundersOwnershipPct ?? sorted.find((e) => e.ext.capTable?.foundersOwnershipPct != null)?.ext.capTable?.foundersOwnershipPct ?? null;
  const investorOwnership = capDoc?.capTable?.investorOwnershipPct ?? sorted.find((e) => e.ext.capTable?.investorOwnershipPct != null)?.ext.capTable?.investorOwnershipPct ?? null;
  const optionPoolPct = capDoc?.capTable?.optionPoolPct ?? sorted.find((e) => e.ext.capTable?.optionPoolPct != null)?.ext.capTable?.optionPoolPct ?? null;
  const safesOutstanding = capDoc?.capTable?.safesNotesOutstandingUsd ?? 0;
  const hasDeadEquity = extractions.some((e) => e.capTable?.hasDeadEquity);

  if (hasDeadEquity) {
    riskFlags.push({
      category: "DEAD_EQUITY_ON_CAP_TABLE",
      severity: 4,
      description: "Dead equity detected: Inactive departed co-founder or non-contributing stakeholder holds significant cap table allocation.",
    });
  }

  if (optionPoolPct != null && optionPoolPct < 10) {
    riskFlags.push({
      category: "NON_STANDARD_GOVERNANCE_STRUCTURE",
      severity: 2,
      description: `Unallocated employee option pool is low (${optionPoolPct}%). Incoming lead investors will likely require a pre-money expansion to 10-15%.`,
    });
  }

  // 4b. Reconcile SAFE Holders & Common Holders across extractions
  const safeHoldersMap = new Map<string, SafeHolderExtraction>();
  for (const ext of extractions) {
    if (ext.capTable?.safeHolders && Array.isArray(ext.capTable.safeHolders)) {
      for (const sh of ext.capTable.safeHolders) {
        if (!sh.holderName) continue;
        const key = sh.holderName.toLowerCase().trim();
        if (!safeHoldersMap.has(key)) {
          safeHoldersMap.set(key, { ...sh, id: sh.id || `safe-${safeHoldersMap.size + 1}` });
        } else {
          const existing = safeHoldersMap.get(key)!;
          safeHoldersMap.set(key, {
            ...existing,
            investmentAmountUsd: Math.max(existing.investmentAmountUsd, sh.investmentAmountUsd),
            valuationCapUsd: sh.valuationCapUsd ?? existing.valuationCapUsd,
            discountPct: sh.discountPct ?? existing.discountPct,
            instrumentType: sh.instrumentType || existing.instrumentType,
            dateOrNotes: sh.dateOrNotes || existing.dateOrNotes,
          });
        }
      }
    }
  }

  // Common Holders reconciliation
  const commonHoldersMap = new Map<string, CommonHolderExtraction>();
  for (const ext of extractions) {
    if (ext.capTable?.commonHolders && Array.isArray(ext.capTable.commonHolders)) {
      for (const ch of ext.capTable.commonHolders) {
        if (!ch.holderName) continue;
        const key = ch.holderName.toLowerCase().trim();
        if (!commonHoldersMap.has(key)) {
          commonHoldersMap.set(key, { ...ch, id: ch.id || `common-${commonHoldersMap.size + 1}` });
        }
      }
    }
  }

  // Fallback: If no explicit commonHolders extracted, synthesize from founders + option pool
  if (commonHoldersMap.size === 0 && founders.length > 0) {
    for (const f of founders) {
      commonHoldersMap.set(f.name.toLowerCase(), {
        id: `common-${commonHoldersMap.size + 1}`,
        holderName: f.name,
        roleOrRelationship: `${f.role || "Founder"} (Co-Founder)`,
        shareCount: null,
        ownershipPct: f.equityOwnershipPct || 0,
        vestingTerms: f.vestingConfirmed ? "4-year monthly with 1-year cliff" : "Unvested",
      });
    }
    if (optionPoolPct != null && optionPoolPct > 0) {
      commonHoldersMap.set("unallocated option pool", {
        id: `common-${commonHoldersMap.size + 1}`,
        holderName: "Unallocated Employee Stock Option Pool (ESOP)",
        roleOrRelationship: "Option Pool",
        shareCount: null,
        ownershipPct: optionPoolPct,
        vestingTerms: "Reserved for future employee equity grants",
      });
    }
  }

  const safeHolders = Array.from(safeHoldersMap.values());
  const commonHolders = Array.from(commonHoldersMap.values());

  const totalSafeSum = safeHolders.reduce((acc, s) => acc + (s.investmentAmountUsd || 0), 0);
  const resolvedSafesOutstanding = Math.max(safesOutstanding, totalSafeSum);

  // 5. Financing Ask & Valuation
  const askDoc = extractions.find((e) => e.financingAsk?.targetRaiseUsd != null);
  const targetRaise = askDoc?.financingAsk?.targetRaiseUsd ?? null;
  const valuationCap = askDoc?.financingAsk?.valuationCapUsd ?? null;
  const instrument = askDoc?.financingAsk?.instrumentType ?? null;

  // Valuation Disconnect Check
  if (primaryStage === "PRE_SEED" && valuationCap != null && valuationCap > 12000000 && (resolvedArr == null || resolvedArr < 100000)) {
    riskFlags.push({
      category: "VALUATION_TRACTION_DISCONNECT",
      severity: 3,
      description: `Target valuation cap ($${valuationCap.toLocaleString()}) is aggressive for Pre-Seed stage with limited reported revenue.`,
    });
  }

  // Technical Founder Check
  const hasTechnicalFounder = founders.some((f) => f.isTechnical);
  if (founders.length > 0 && !hasTechnicalFounder) {
    riskFlags.push({
      category: "NON_STANDARD_GOVERNANCE_STRUCTURE",
      severity: 2,
      description: "No dedicated technical co-founder identified among leadership team.",
    });
  }

  // Dilution calculation
  const impliedPostMoney = valuationCap ?? (targetRaise ? targetRaise * 5 : null);
  const founderDilution = impliedPostMoney && impliedPostMoney > 0 && targetRaise != null ? (targetRaise / impliedPostMoney) * 100 : null;
  const impliedRunwayExtension =
    resolvedBurn && resolvedBurn > 0 && targetRaise != null
      ? Math.round(targetRaise / resolvedBurn)
      : (askDoc?.financingAsk?.plannedRunwayMonths ?? null);

  const hasCriticalRisk = riskFlags.some((r) => r.severity >= 5);
  const readyForMatching =
    Boolean(companyName) &&
    targetRaise != null &&
    targetRaise > 0 &&
    founders.length > 0 &&
    !hasCriticalRisk;

  // 6. Industry & Competitors Aggregation
  const resolvedIndustry =
    extractions.find((e) => Boolean(e.industry))?.industry ??
    (primaryVertical ? primaryVertical.replaceAll("_", " ") : null);

  const subIndustriesSet = new Set<string>();
  for (const ext of extractions) {
    if (Array.isArray(ext.subIndustries)) {
      for (const sub of ext.subIndustries) {
        if (sub && sub.trim()) subIndustriesSet.add(sub.trim());
      }
    }
  }

  const competitorsMap = new Map<string, any>();
  for (const ext of extractions) {
    if (Array.isArray(ext.competitors)) {
      for (const comp of ext.competitors) {
        const key = comp.name.toLowerCase().trim();
        if (!competitorsMap.has(key)) {
          competitorsMap.set(key, comp);
        } else {
          const existing = competitorsMap.get(key)!;
          competitorsMap.set(key, {
            ...existing,
            description: existing.description || comp.description,
            knownInvestors: Array.from(new Set([...existing.knownInvestors, ...(comp.knownInvestors || [])])),
            differentiation: existing.differentiation || comp.differentiation,
            sourceUrl: existing.sourceUrl || comp.sourceUrl,
            sourceVerified: existing.sourceVerified || comp.sourceVerified,
          });
        }
      }
    }
  }
  const competitors = Array.from(competitorsMap.values());
  const directCompetitors = competitors.filter((c) => c.overlapDegree === "DIRECT");
  const verifiedSourcesCount = competitors.filter((c) => c.sourceVerified).length;

  // 7. Commercial Prospects Aggregation
  const commercialMap = new Map<string, any>();
  for (const ext of extractions) {
    if (Array.isArray(ext.commercialProspects)) {
      for (const prospect of ext.commercialProspects) {
        const key = prospect.name.toLowerCase().trim();
        if (!commercialMap.has(key)) {
          commercialMap.set(key, prospect);
        } else {
          const existing = commercialMap.get(key)!;
          commercialMap.set(key, {
            ...existing,
            buyerPersona: existing.buyerPersona || prospect.buyerPersona,
            useCaseFit: existing.useCaseFit || prospect.useCaseFit,
            strategicSynergy: existing.strategicSynergy || prospect.strategicSynergy,
            sourceUrl: existing.sourceUrl || prospect.sourceUrl,
            sourceVerified: existing.sourceVerified || prospect.sourceVerified,
          });
        }
      }
    }
  }
  const commercialProspects = Array.from(commercialMap.values());
  const targetCustomersCount = commercialProspects.filter(
    (p) => p.category === "ENTERPRISE_CUSTOMER" || p.category === "SMB_CUSTOMER_SEGMENT",
  ).length;
  const strategicPartnersCount = commercialProspects.filter(
    (p) =>
      p.category === "STRATEGIC_CHANNEL_PARTNER" ||
      p.category === "INTEGRATION_ALLIANCE" ||
      p.category === "DATA_OR_SUPPLY_PARTNER",
  ).length;
  const verifiedCommercialSourcesCount = commercialProspects.filter((p) => p.sourceVerified).length;

  const startupDealSpec: StartupDealSpec = {
    dealId,
    companyName,
    stage: primaryStage,
    primaryVertical,
    industry: resolvedIndustry,
    subIndustries: Array.from(subIndustriesSet),
    legalEntityJurisdiction: legalJurisdiction,

    founders,
    competitors,
    commercialProspects,
    traction: {
      arrUsd: resolvedArr,
      mrrUsd: resolvedMrr,
      momGrowthRatePct: resolvedGrowth,
      grossMarginPct: modelDoc?.traction?.grossMarginPct ?? deckDoc?.traction?.grossMarginPct ?? null,
      netMonthlyBurnUsd: resolvedBurn,
      cashRunwayMonths: resolvedRunway,
      activeCustomersCount: deckDoc?.traction?.activeCustomersCount ?? null,
      customerLoiPipelineUsd: deckDoc?.traction?.customerLoiPipelineUsd ?? null,
      netRevenueRetentionPct: deckDoc?.traction?.netRevenueRetentionPct ?? null,
    },
    capTable: {
      foundersOwnershipPct: foundersOwnership,
      investorOwnershipPct: investorOwnership,
      optionPoolPct,
      safesNotesOutstandingUsd: resolvedSafesOutstanding,
      safeHolders,
      commonHolders,
      hasDeadEquity,
      deadEquityNotes: hasDeadEquity ? "Requires cleanup prior to institutional priced round" : null,
    },
    financingAsk: {
      targetRaiseUsd: targetRaise,
      instrumentType: instrument,
      valuationCapUsd: valuationCap,
      discountPct: askDoc?.financingAsk?.discountPct ?? null,
      plannedRunwayMonths: impliedRunwayExtension,
      leadCommitted: askDoc?.financingAsk?.leadCommitted ?? false,
      committedAmountUsd: askDoc?.financingAsk?.committedAmountUsd ?? 0,
    },

    reconciliationAudit: {
      dataRoomDiscrepancies: discrepancies,
      metricsValidatedAgainstFinancialModel: Boolean(modelDoc),
      capTableReconciled: Boolean(capDoc),
      impliedRunwayExtensionMonths: impliedRunwayExtension,
      impliedPostMoneyValuationUsd: impliedPostMoney,
      founderDilutionPct: founderDilution != null ? Math.round(founderDilution * 10) / 10 : null,
    },

    competitorAudit: {
      totalIdentified: competitors.length,
      directCompetitorsCount: directCompetitors.length,
      verifiedSourcesCount,
      conflictingInvestorsIdentified: Array.from(
        new Set(competitors.flatMap((c) => c.knownInvestors || [])),
      ),
      auditSummary:
        competitors.length > 0
          ? `Identified ${competitors.length} competitors (${directCompetitors.length} direct). Backed by ${Array.from(new Set(competitors.flatMap((c) => c.knownInvestors || []))).length} distinct venture funds.`
          : "No competitors yet identified. Ready for competitor discovery agent pass.",
    },

    commercialAudit: {
      totalIdentified: commercialProspects.length,
      targetCustomersCount,
      strategicPartnersCount,
      verifiedSourcesCount: verifiedCommercialSourcesCount,
      auditSummary:
        commercialProspects.length > 0
          ? `Mapped ${commercialProspects.length} commercial prospects (${targetCustomersCount} target customer accounts, ${strategicPartnersCount} strategic partners).`
          : "No customer or partner prospects yet mapped. Ready for commercial intelligence pass.",
    },

    riskFlags,
    readyForMatching,
  };

  return {
    startupDealSpec,
    openQuestions,
    unresolvedRiskFlags: riskFlags,
    readyForMatching,
  };
}
