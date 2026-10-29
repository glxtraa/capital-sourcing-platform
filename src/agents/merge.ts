import type { DocumentExtraction, Party, FinancingAsk, RiskFlag } from "@/dsl/schema";
import {
  resolveDocumentTaint,
  isBlockingRiskFlag,
  type FieldLineageMap,
  type FieldLineageNode,
  type FieldCandidateEvidence,
  type LlmExecutionActor,
} from "@/dsl/provenance";

export interface MergedDealSpec {
  parties: Party[];
  financingAsks: FinancingAsk[];
  riskFlags: RiskFlag[];
  openQuestions: string[];
  readyForMatching: boolean;
  _fieldLineage?: FieldLineageMap;
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
    verbatimQuote: incoming.verbatimQuote ?? base.verbatimQuote ?? null,
    pageOrSheet: incoming.pageOrSheet ?? base.pageOrSheet ?? null,
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
        verbatimQuote: incoming.verbatimQuote ?? base.verbatimQuote ?? null,
        pageOrSheet: incoming.pageOrSheet ?? base.pageOrSheet ?? null,
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
 * Enforces Taint Tracking precedence: AUDITED_PROOF documents take priority
 * over UNVERIFIED_CLAIM documents, and any contradiction between an
 * UNVERIFIED_CLAIM and AUDITED_PROOF emits a TAINTED_CLAIM_CONFLICT risk flag.
 */
export function mergeExtractions(
  extractions: Array<DocumentExtraction & { _taintOverride?: string | null; _fileName?: string; _llmActor?: any }>,
  policyMap?: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM">,
): MergedDealSpec {
  // Sort extractions so AUDITED_PROOF documents are merged last (and win over UNVERIFIED_CLAIM)
  const annotated = extractions.map((ext) => ({
    ext,
    taint: resolveDocumentTaint(ext.documentTypes, ext._taintOverride, policyMap),
    fileName: ext._fileName || ext.parties?.[0]?.sourceDocuments?.[0] || "Uploaded Document",
    llmActor: ext._llmActor,
  }));

  const sortedExtractions = [...annotated].sort((a, b) => {
    const score = (t: string) => (t === "AUDITED_PROOF" || t === "HUMAN_VERIFIED" ? 1 : 0);
    return score(a.taint) - score(b.taint);
  });

  const partiesByName = new Map<string, Array<{ party: Party; taint: string; fileName: string }>>();
  let financingAsks: FinancingAsk[] = [];
  const rawRiskFlags: RiskFlag[] = [];
  const openQuestionsSet = new Set<string>();

  // Check for amount conflicts between UNVERIFIED_CLAIM and AUDITED_PROOF financing asks
  const claimAsks = annotated.filter((a) => a.taint === "UNVERIFIED_CLAIM").flatMap((a) =>
    a.ext.financingAsks.map((ask) => ({ ask, fileName: a.fileName })),
  );
  const proofAsks = annotated.filter((a) => a.taint === "AUDITED_PROOF").flatMap((a) =>
    a.ext.financingAsks.map((ask) => ({ ask, fileName: a.fileName })),
  );

  for (const c of claimAsks) {
    for (const p of proofAsks) {
      if (
        c.ask.amount != null &&
        p.ask.amount != null &&
        Math.abs(c.ask.amount - p.ask.amount) > 1000
      ) {
        rawRiskFlags.push({
          category: "TAINTED_CLAIM_CONFLICT",
          severity: 4,
          description: `Tainted Claim Conflict: Unverified document "${c.fileName}" claims financing amount ${c.ask.currency || "USD"} ${c.ask.amount.toLocaleString()}, whereas Audited Proof "${p.fileName}" states ${p.ask.currency || "USD"} ${p.ask.amount.toLocaleString()}. Audited Proof value selected.`,
          sourceFileName: c.fileName,
          evidenceSnippet: `Claim (${c.fileName}): ${c.ask.amount.toLocaleString()} vs Proof (${p.fileName}): ${p.ask.amount.toLocaleString()}`,
        });
      }
    }
  }

  for (const { ext, taint, fileName } of sortedExtractions) {
    for (const party of ext.parties) {
      const key = party.legalName.trim().toLowerCase();
      const existing = partiesByName.get(key) ?? [];
      existing.push({ party, taint, fileName });
      partiesByName.set(key, existing);
    }
    financingAsks = mergeFinancingAskList(financingAsks, ext.financingAsks);
    rawRiskFlags.push(...ext.riskFlags);
    for (const q of ext.openQuestions) {
      if (q.trim()) openQuestionsSet.add(q.trim());
    }
  }

  const parties: Party[] = [];
  for (const [name, versions] of partiesByName) {
    if (versions.length === 1) {
      parties.push(versions[0].party);
      continue;
    }
    // Sort so AUDITED_PROOF versions come after UNVERIFIED_CLAIM versions (incoming overwrites base in mergeTwoPartyRecords)
    const sorted = [...versions].sort((a, b) => {
      const taintRank = (t: string) => (t === "AUDITED_PROOF" || t === "HUMAN_VERIFIED" ? 2 : 1);
      const diff = taintRank(a.taint) - taintRank(b.taint);
      if (diff !== 0) return diff;
      return (
        Object.values(a.party).filter((x) => x != null).length -
        Object.values(b.party).filter((x) => x != null).length
      );
    });
    const mergedParty = sorted.map((v) => v.party).reduce((acc, v) => mergeTwoPartyRecords(acc, v));

    const jurisdictions = Array.from(
      new Set(versions.map((v) => v.party.jurisdiction).filter((j): j is string => Boolean(j))),
    );
    if (jurisdictions.length > 1) {
      const hasTaintSplit =
        versions.some((v) => v.taint === "AUDITED_PROOF") &&
        versions.some((v) => v.taint === "UNVERIFIED_CLAIM");
      rawRiskFlags.push({
        category: hasTaintSplit ? "TAINTED_CLAIM_CONFLICT" : "QUANTITY_OR_TERM_MISMATCH",
        severity: 4,
        description: `Party "${name}" has conflicting jurisdiction across source documents: ${jurisdictions.join(
          " vs. ",
        )}. Human verification required before matching.`,
        sourceFileName: versions.map((v) => v.fileName).join(", "),
        evidenceSnippet: versions
          .filter((v) => v.party.jurisdiction)
          .map((v) => `${v.fileName} (${v.taint}): ${v.party.jurisdiction}`)
          .join(" | "),
      });
    }
    parties.push(mergedParty);
  }

  const riskFlags = dedupeRiskFlags(rawRiskFlags);
  const openQuestions = Array.from(openQuestionsSet);

  // Construct comprehensive FieldLineageMap
  const fieldLineage: FieldLineageMap = {};

  parties.forEach((p, idx) => {
    const key = p.legalName.trim().toLowerCase();
    const docVersions = partiesByName.get(key) ?? [];
    const winnerDoc = docVersions[docVersions.length - 1];

    const legalNamePath = `$.parties[${idx}].legalName`;
    fieldLineage[legalNamePath] = {
      jsonPath: legalNamePath,
      fieldLabel: `${p.role} Legal Name`,
      activeValue: p.legalName,
      activeTaint: (winnerDoc?.taint as any) || "UNVERIFIED_CLAIM",
      activeActor: (winnerDoc as any)?.llmActor,
      hasConflict: docVersions.length > 1,
      candidates: docVersions.map((v) => ({
        value: v.party.legalName,
        pointer: {
          sourceFileName: v.fileName,
          taint: v.taint as any,
          pageOrSheet: v.party.pageOrSheet || null,
          verbatimQuote: v.party.verbatimQuote || null,
          documentTypes: [],
        },
        llmActor: (v as any).llmActor,
        status: v === winnerDoc ? "ACTIVE_WINNER" : "SUPERSEDED_BY_HIGHER_TAINT",
      })),
      actorHistory: [],
      downstreamImpacts: [
        {
          consumerType: "HARD_GATE_MATCH",
          summary: `Used in KYC, sanction checks, and debtor concentration for ${p.role}`,
        },
      ],
    };

    if (p.jurisdiction) {
      const jurPath = `$.parties[${idx}].jurisdiction`;
      const jurCandidates = docVersions.filter((v) => Boolean(v.party.jurisdiction));
      const hasJurConflict = new Set(jurCandidates.map((c) => c.party.jurisdiction)).size > 1;
      fieldLineage[jurPath] = {
        jsonPath: jurPath,
        fieldLabel: `${p.role} Jurisdiction`,
        activeValue: p.jurisdiction,
        activeTaint: (winnerDoc?.taint as any) || "UNVERIFIED_CLAIM",
        activeActor: (winnerDoc as any)?.llmActor,
        hasConflict: hasJurConflict,
        candidates: jurCandidates.map((v) => ({
          value: v.party.jurisdiction,
          pointer: {
            sourceFileName: v.fileName,
            taint: v.taint as any,
            pageOrSheet: v.party.pageOrSheet || null,
            verbatimQuote: v.party.verbatimQuote || null,
            documentTypes: [],
          },
          llmActor: (v as any).llmActor,
          status: v.party.jurisdiction === p.jurisdiction ? "ACTIVE_WINNER" : "SUPERSEDED_BY_HIGHER_TAINT",
        })),
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: `Evaluated in Funder Geographic Mandate Gate (${p.jurisdiction})`,
          },
        ],
      };
    }
  });

  financingAsks.forEach((ask, idx) => {
    if (ask.amount != null) {
      const amtPath = `$.financingAsks[${idx}].amount`;
      const askCandidates = annotated.flatMap((a) =>
        a.ext.financingAsks
          .filter((subAsk) => subAsk.amount != null)
          .map((subAsk) => ({
            value: subAsk.amount,
            fileName: a.fileName,
            taint: a.taint,
            llmActor: a.llmActor,
            pageOrSheet: subAsk.pageOrSheet,
            verbatimQuote: subAsk.verbatimQuote,
          }))
      );
      const hasAmtConflict = new Set(askCandidates.map((c) => c.value)).size > 1;
      const winner = askCandidates.find((c) => c.value === ask.amount) || askCandidates[0];

      fieldLineage[amtPath] = {
        jsonPath: amtPath,
        fieldLabel: "Financing Facility Amount",
        activeValue: ask.amount,
        activeTaint: (winner?.taint as any) || "UNVERIFIED_CLAIM",
        activeActor: winner?.llmActor,
        hasConflict: hasAmtConflict,
        candidates: askCandidates.map((c) => ({
          value: c.value,
          pointer: {
            sourceFileName: c.fileName,
            taint: c.taint as any,
            pageOrSheet: c.pageOrSheet || null,
            verbatimQuote: c.verbatimQuote || null,
            documentTypes: [],
          },
          llmActor: c.llmActor,
          status: c.value === ask.amount ? "ACTIVE_WINNER" : "SUPERSEDED_BY_HIGHER_TAINT",
        })),
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Evaluated in Funder Minimum & Maximum Ticket Size Gates",
          },
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Determines debt sizing, facility ceiling, and advance tranche calculations",
          },
        ],
      };
    }

    if (ask.advanceRatePct != null) {
      const advPath = `$.financingAsks[${idx}].advanceRatePct`;
      fieldLineage[advPath] = {
        jsonPath: advPath,
        fieldLabel: "Target Advance Rate (%)",
        activeValue: ask.advanceRatePct,
        activeTaint: "UNVERIFIED_CLAIM",
        hasConflict: false,
        candidates: [
          {
            value: ask.advanceRatePct,
            pointer: {
              sourceFileName: annotated[0]?.fileName || "Uploaded Document",
              taint: (annotated[0]?.taint as any) || "UNVERIFIED_CLAIM",
              pageOrSheet: ask.pageOrSheet || null,
              verbatimQuote: ask.verbatimQuote || null,
              documentTypes: [],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Matched against maximum lender advance rate covenants",
          },
        ],
      };
    }
  });

  const hasCriticalUnresolvedRisk = riskFlags.some((r) => isBlockingRiskFlag(r));
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
    _fieldLineage: fieldLineage,
  };
}
