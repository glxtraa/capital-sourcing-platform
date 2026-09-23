import type { DocumentExtraction, Party, FinancingAsk, RiskFlag } from "@/dsl/schema";

export interface MergedDealSpec {
  parties: Party[];
  financingAsks: FinancingAsk[];
  riskFlags: RiskFlag[];
  openQuestions: string[];
  readyForMatching: boolean;
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
  const financingAsks: FinancingAsk[] = [];
  const riskFlags: RiskFlag[] = [];
  const openQuestions: string[] = [];

  for (const extraction of extractions) {
    for (const party of extraction.parties) {
      const key = party.legalName.trim().toLowerCase();
      const existing = partiesByName.get(key) ?? [];
      existing.push(party);
      partiesByName.set(key, existing);
    }
    financingAsks.push(...extraction.financingAsks);
    riskFlags.push(...extraction.riskFlags);
    openQuestions.push(...extraction.openQuestions);
  }

  const parties: Party[] = [];
  for (const [name, versions] of partiesByName) {
    if (versions.length === 1) {
      parties.push(versions[0]);
      continue;
    }
    // Prefer the version with the most non-null fields as the "primary"
    // record, but flag any material disagreement across documents.
    const primary = versions.reduce((best, v) =>
      Object.values(v).filter((x) => x != null).length >
      Object.values(best).filter((x) => x != null).length
        ? v
        : best,
    );
    const disagreements = versions.filter(
      (v) =>
        v.jurisdiction && primary.jurisdiction && v.jurisdiction !== primary.jurisdiction,
    );
    if (disagreements.length > 0) {
      riskFlags.push({
        category: "QUANTITY_OR_TERM_MISMATCH",
        severity: 3,
        description: `Party "${name}" has conflicting jurisdiction across source documents: ${[
          primary.jurisdiction,
          ...disagreements.map((d) => d.jurisdiction),
        ]
          .filter(Boolean)
          .join(" vs. ")}. Resolve before matching.`,
      });
    }
    parties.push({
      ...primary,
      sourceDocuments: versions.flatMap((v) => v.sourceDocuments),
    });
  }

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
