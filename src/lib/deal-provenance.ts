import type { UploadedDocument, Party, FinancingAsk, RiskFlag } from "@prisma/client";
import type { DocumentExtraction } from "@/dsl/schema";

interface DocWithParsedExtractions {
  fileName: string;
  extractions: DocumentExtraction[];
}

function parseDocExtractions(documents: UploadedDocument[]): DocWithParsedExtractions[] {
  const result: DocWithParsedExtractions[] = [];

  for (const doc of documents) {
    if (!doc.extractedFieldsRaw || typeof doc.extractedFieldsRaw !== "object" || Array.isArray(doc.extractedFieldsRaw)) {
      continue;
    }
    const raw = doc.extractedFieldsRaw as Record<string, unknown>;
    const extractions: DocumentExtraction[] = [];

    // Include current merged extraction on the document
    if (Array.isArray(raw.parties) || Array.isArray(raw.financingAsks) || Array.isArray(raw.riskFlags)) {
      extractions.push({
        documentSummary: typeof raw.documentSummary === "string" ? raw.documentSummary : "",
        parties: Array.isArray(raw.parties) ? (raw.parties as DocumentExtraction["parties"]) : [],
        financingAsks: Array.isArray(raw.financingAsks)
          ? (raw.financingAsks as DocumentExtraction["financingAsks"])
          : [],
        riskFlags: Array.isArray(raw.riskFlags) ? (raw.riskFlags as DocumentExtraction["riskFlags"]) : [],
        documentTypes: Array.isArray(raw.documentTypes) ? (raw.documentTypes as string[]) : [],
        openQuestions: Array.isArray(raw.openQuestions) ? (raw.openQuestions as string[]) : [],
      });
    }

    // Also include any historical runs so provenance is never lost
    if (Array.isArray(raw._history)) {
      for (const entry of raw._history as { extraction?: DocumentExtraction }[]) {
        if (entry?.extraction) {
          extractions.push(entry.extraction);
        }
      }
    }

    if (extractions.length > 0) {
      result.push({ fileName: doc.fileName, extractions });
    }
  }

  return result;
}

export interface PartyProvenance {
  documents: string[];
  fieldSources: {
    role: string[];
    jurisdiction: string[];
    publicRating: string[];
    primaryRightHolderName: string[];
  };
}

export interface FinancingAskProvenance {
  documents: string[];
  fieldSources: {
    structureType: string[];
    amount: string[];
    advanceRatePct: string[];
    tenor: string[];
  };
}

export function computePartyProvenance(party: Party, documents: UploadedDocument[]): PartyProvenance {
  const parsedDocs = parseDocExtractions(documents);
  const normTarget = party.legalName.trim().toLowerCase();

  const docsSet = new Set<string>();
  const roleSet = new Set<string>();
  const jurisdictionSet = new Set<string>();
  const ratingSet = new Set<string>();
  const rightHolderSet = new Set<string>();

  for (const { fileName, extractions } of parsedDocs) {
    for (const ext of extractions) {
      for (const p of ext.parties ?? []) {
        if (p.legalName?.trim().toLowerCase() === normTarget) {
          docsSet.add(fileName);
          if (p.role === party.role) roleSet.add(fileName);
          if (party.jurisdiction && p.jurisdiction === party.jurisdiction) jurisdictionSet.add(fileName);
          if (party.publicRating && p.publicRating === party.publicRating) ratingSet.add(fileName);
          if (party.primaryRightHolderName && p.primaryRightHolderName === party.primaryRightHolderName) {
            rightHolderSet.add(fileName);
          }
        }
      }
    }
  }

  return {
    documents: Array.from(docsSet),
    fieldSources: {
      role: Array.from(roleSet),
      jurisdiction: Array.from(jurisdictionSet),
      publicRating: Array.from(ratingSet),
      primaryRightHolderName: Array.from(rightHolderSet),
    },
  };
}

export function computeFinancingAskProvenance(
  ask: FinancingAsk,
  documents: UploadedDocument[],
): FinancingAskProvenance {
  const parsedDocs = parseDocExtractions(documents);

  const docsSet = new Set<string>();
  const structureSet = new Set<string>();
  const amountSet = new Set<string>();
  const advanceRateSet = new Set<string>();
  const tenorSet = new Set<string>();

  for (const { fileName, extractions } of parsedDocs) {
    for (const ext of extractions) {
      for (const a of ext.financingAsks ?? []) {
        const sameStructure =
          a.structureType === ask.structureType ||
          a.structureType === "UNKNOWN" ||
          ask.structureType === "UNKNOWN";
        if (!sameStructure) continue;

        docsSet.add(fileName);
        if (a.structureType === ask.structureType) structureSet.add(fileName);
        if (ask.amount != null && a.amount === ask.amount) amountSet.add(fileName);
        if (ask.advanceRatePct != null && a.advanceRatePct === ask.advanceRatePct) advanceRateSet.add(fileName);
        if (
          (ask.tenorDaysMin != null && a.tenorDaysMin === ask.tenorDaysMin) ||
          (ask.tenorDaysMax != null && a.tenorDaysMax === ask.tenorDaysMax)
        ) {
          tenorSet.add(fileName);
        }
      }
    }
  }

  return {
    documents: Array.from(docsSet),
    fieldSources: {
      structureType: Array.from(structureSet),
      amount: Array.from(amountSet),
      advanceRatePct: Array.from(advanceRateSet),
      tenor: Array.from(tenorSet),
    },
  };
}

export function computeRiskFlagProvenance(flag: RiskFlag, documents: UploadedDocument[]): string[] {
  const parsedDocs = parseDocExtractions(documents);
  const normDesc = flag.description.trim().toLowerCase();
  const docsSet = new Set<string>();

  for (const { fileName, extractions } of parsedDocs) {
    for (const ext of extractions) {
      for (const r of ext.riskFlags ?? []) {
        if (r.category === flag.category && r.description?.trim().toLowerCase() === normDesc) {
          docsSet.add(fileName);
        }
      }
    }
  }

  if (docsSet.size === 0 && flag.description.includes("conflicting jurisdiction across source documents")) {
    return ["Cross-document merge"];
  }

  return Array.from(docsSet);
}

export function computeOpenQuestionProvenance(
  question: string,
  documents: UploadedDocument[],
): string[] {
  const parsedDocs = parseDocExtractions(documents);
  const normQ = question.trim().toLowerCase();
  const docsSet = new Set<string>();

  for (const { fileName, extractions } of parsedDocs) {
    for (const ext of extractions) {
      for (const q of ext.openQuestions ?? []) {
        if (q.trim().toLowerCase() === normQ) {
          docsSet.add(fileName);
        }
      }
    }
  }

  return Array.from(docsSet);
}
