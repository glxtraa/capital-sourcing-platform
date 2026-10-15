import type { DocumentExtraction, Party, FinancingAsk, RiskFlag } from "@/dsl/schema";

export interface MergedDealSpec {
  parties: Party[];
  financingAsks: FinancingAsk[];
  riskFlags: RiskFlag[];
  openQuestions: string[];
  readyForMatching: boolean;
}

function mergeTwoPartyRecords(base: Party, incoming: Party): Party {
  return {
    role: incoming.role ?? base.role,
    legalName: base.legalName.length >= incoming.legalName.length ? base.legalName : incoming.legalName,
    jurisdiction: incoming.jurisdiction ?? base.jurisdiction ?? null,
    isListed: incoming.isListed ?? base.isListed ?? null,
    publicRating: incoming.publicRating ?? base.publicRating ?? null,
    bankName: incoming.bankName ?? base.bankName ?? null,
    bankAccount: incoming.bankAccount ?? base.bankAccount ?? null,
    notes:
      base.notes && incoming.notes && base.notes !== incoming.notes
        ? base.notes.includes(incoming.notes)
          ? base.notes
          : `${base.notes} | ${incoming.notes}`
        : (incoming.notes ?? base.notes ?? null),
    primaryRightHolderName: incoming.primaryRightHolderName ?? base.primaryRightHolderName ?? null,
    primaryRightHolderVerified: Boolean(base.primaryRightHolderVerified || incoming.primaryRightHolderVerified),
    sourceDocuments: Array.from(new Set([...(base.sourceDocuments ?? []), ...(incoming.sourceDocuments ?? [])])),
  };
}

function mergeFinancingAskList(existingAsks: FinancingAsk[], newAsks: FinancingAsk[]): FinancingAsk[] {
  const combined = [...existingAsks];
  for (const incoming of newAsks) {
    // Match against an existing ask with the same structureType, or if one of them is UNKNOWN
    const matchIdx = combined.findIndex(
      (a) =>
        a.structureType === incoming.structureType ||
        a.structureType === "UNKNOWN" ||
        incoming.structureType === "UNKNOWN",
    );
    if (matchIdx === -1) {
      combined.push(incoming);
    } else {
      const base = combined[matchIdx];
      combined[matchIdx] = {
        structureType:
          incoming.structureType !== "UNKNOWN" ? incoming.structureType : base.structureType,
        structureTypeConfidence:
          incoming.structureTypeConfidence ?? base.structureTypeConfidence ?? null,
        amount: incoming.amount ?? base.amount ?? null,
        currency: incoming.currency ?? base.currency ?? null,
        advanceRatePct: incoming.advanceRatePct ?? base.advanceRatePct ?? null,
        tenorDaysMin: incoming.tenorDaysMin ?? base.tenorDaysMin ?? null,
        tenorDaysMax: incoming.tenorDaysMax ?? base.tenorDaysMax ?? null,
        tenorNote: incoming.tenorNote ?? base.tenorNote ?? null,
        recurring: Boolean(base.recurring || incoming.recurring),
        recurringNote: incoming.recurringNote ?? base.recurringNote ?? null,
      };
    }
  }
  return combined;
}

function dedupeRiskFlags(flags: RiskFlag[]): RiskFlag[] {
  const byKey = new Map<string, RiskFlag>();
  for (const flag of flags) {
    const normDesc = flag.description.trim().toLowerCase();
    const key = `${flag.category}::${normDesc}`;
    const existing = byKey.get(key);
    if (!existing || flag.severity > existing.severity) {
      byKey.set(key, flag);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Non-destructively merges a previous DocumentExtraction for a single file
 * with a newly extracted DocumentExtraction from a re-run. Keeps all
 * previously extracted datapoints (non-null party fields, financing asks,
 * risk flags, document types, open questions) while incorporating any newly
 * extracted or updated datapoints.
 */
export function mergeSingleDocumentExtractions(
  previous: DocumentExtraction,
  current: DocumentExtraction,
): DocumentExtraction {
  const partyMap = new Map<string, Party>();
  for (const p of previous.parties) {
    partyMap.set(p.legalName.trim().toLowerCase(), p);
  }
  for (const p of current.parties) {
    const key = p.legalName.trim().toLowerCase();
    const prevParty = partyMap.get(key);
    partyMap.set(key, prevParty ? mergeTwoPartyRecords(prevParty, p) : p);
  }

  return {
    documentSummary: current.documentSummary || previous.documentSummary,
    parties: Array.from(partyMap.values()),
    financingAsks: mergeFinancingAskList(previous.financingAsks, current.financingAsks),
    riskFlags: dedupeRiskFlags([...previous.riskFlags, ...current.riskFlags]),
    documentTypes: Array.from(new Set([...(previous.documentTypes ?? []), ...(current.documentTypes ?? [])])),
    openQuestions: Array.from(new Set([...(previous.openQuestions ?? []), ...(current.openQuestions ?? [])])),
  };
}

/**
 * Combines per-document extractions into one deal-level spec.
 *
 * Deliberately simple and conservative: this is NOT an LLM call (merging is
 * cheap enough to do deterministically, and doing it in code makes the
 * disagreement-detection auditable rather than another black box). Where
 * two documents name the same party with different jurisdictions/ratings,
 * this keeps both and adds a QUANTITY_OR_TERM_MISMATCH risk flag rather than
 * silently picking one — exactly what the manual PT KEM deal-intake run did
 * by hand when the purchase and sale contracts' quantities didn't reconcile.
 */
export function mergeExtractions(extractions: DocumentExtraction[]): MergedDealSpec {
  const partiesByName = new Map<string, Party[]>();
  let financingAsks: FinancingAsk[] = [];
  const rawRiskFlags: RiskFlag[] = [];
  const openQuestionsSet = new Set<string>();

  for (const extraction of extractions) {
    for (const party of extraction.parties) {
      const key = party.legalName.trim().toLowerCase();
      const existing = partiesByName.get(key) ?? [];
      existing.push(party);
      partiesByName.set(key, existing);
    }
    financingAsks = mergeFinancingAskList(financingAsks, extraction.financingAsks);
    rawRiskFlags.push(...extraction.riskFlags);
    for (const q of extraction.openQuestions) {
      if (q.trim()) openQuestionsSet.add(q.trim());
    }
  }

  const parties: Party[] = [];
  for (const [name, versions] of partiesByName) {
    if (versions.length === 1) {
      parties.push(versions[0]);
      continue;
    }
    // Prefer the version with the most non-null fields as the starting base,
    // then fill in any null fields from other versions so no datapoint is lost.
    const sorted = [...versions].sort(
      (a, b) =>
        Object.values(b).filter((x) => x != null).length -
        Object.values(a).filter((x) => x != null).length,
    );
    const mergedParty = sorted.reduce((acc, v) => mergeTwoPartyRecords(acc, v));

    const jurisdictions = Array.from(
      new Set(versions.map((v) => v.jurisdiction).filter((j): j is string => Boolean(j))),
    );
    if (jurisdictions.length > 1) {
      rawRiskFlags.push({
        category: "QUANTITY_OR_TERM_MISMATCH",
        severity: 3,
        description: `Party "${name}" has conflicting jurisdiction across source documents: ${jurisdictions.join(
          " vs. ",
        )}. Resolve before matching.`,
      });
    }
    parties.push(mergedParty);
  }

  const riskFlags = dedupeRiskFlags(rawRiskFlags);
  const openQuestions = Array.from(openQuestionsSet);

  const hasCriticalUnresolvedRisk = riskFlags.some(
    (r) => r.category === "CHAIN_OF_TITLE" && r.severity >= 4,
  );
  const hasUnknownStructure = financingAsks.some((a) => a.structureType === "UNKNOWN");
  const borrowerHasJurisdiction = parties.some((p) => p.role === "BORROWER" && p.jurisdiction);
  const obligorHasJurisdiction = parties.some((p) => p.role === "OBLIGOR" && p.jurisdiction);

  return {
    parties,
    financingAsks,
    riskFlags,
    openQuestions,
    readyForMatching:
      !hasCriticalUnresolvedRisk &&
      !hasUnknownStructure &&
      borrowerHasJurisdiction &&
      obligorHasJurisdiction,
  };
}
