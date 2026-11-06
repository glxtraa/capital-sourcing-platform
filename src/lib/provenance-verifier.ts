import { resolveDocumentTaint, type ProvenancePointer, type TaintLevel } from "@/dsl/provenance";

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\bignore\s+(all\s+|any\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|constraints)\b/i,
    label: "Instruction override directive ('ignore previous instructions')",
  },
  {
    pattern: /\b(disregard|forget)\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts)\b/i,
    label: "Instruction override directive ('disregard prior instructions')",
  },
  {
    pattern: /\byou\s+are\s+now\s+(a|an|acting\s+as)\b/i,
    label: "Persona hijacking directive ('you are now...')",
  },
  {
    pattern: /\b(override|force|set)\s+(the\s+)?(verdict|tier|severity|readyForMatching|concessionVerified|primaryRightHolderVerified)\s+(to|=)\b/i,
    label: "DSL state manipulation directive ('override verdict/tier/severity')",
  },
  {
    pattern: /\bclassify\s+(this\s+deal|every\s+investor|all\s+funders|all\s+providers)\s+as\s+(GOOD|TIER_1|ELIGIBLE)\b/i,
    label: "Matching manipulation directive ('classify as GOOD/TIER_1')",
  },
  {
    pattern: /<\/?(system_prompt|untrusted_document|instructions|developer_message)>/i,
    label: "XML boundary breakout tag",
  },
  {
    pattern: /\bdo\s+not\s+(emit|report|create|flag)\s+any\s+risk\s*flags?\b/i,
    label: "Risk flag suppression directive",
  },
];

export interface DetectedSecurityFlag {
  category: "PROMPT_INJECTION_SUSPECTED" | "TAINTED_CLAIM_CONFLICT" | "UNANCHORED_EXTRACTION";
  severity: number;
  description: string;
  sourceFileName: string;
  evidenceSnippet: string;
}

/**
 * Scans raw document text (if available) and all string values inside an extracted JSON object
 * for indirect prompt injection or DSL manipulation directives.
 */
export function scanForPromptInjection(
  fileName: string,
  extractedObject: unknown,
  rawText?: string | null,
): DetectedSecurityFlag[] {
  const flags: DetectedSecurityFlag[] = [];
  const seenLabels = new Set<string>();

  const stringsToScan: string[] = [];
  if (rawText && typeof rawText === "string") {
    stringsToScan.push(rawText);
  }

  function collectStrings(val: unknown) {
    if (typeof val === "string") {
      stringsToScan.push(val);
    } else if (Array.isArray(val)) {
      for (const item of val) collectStrings(item);
    } else if (val && typeof val === "object") {
      for (const v of Object.values(val as Record<string, unknown>)) {
        collectStrings(v);
      }
    }
  }
  collectStrings(extractedObject);

  for (const text of stringsToScan) {
    for (const { pattern, label } of INJECTION_PATTERNS) {
      const match = pattern.exec(text);
      if (match && !seenLabels.has(label)) {
        seenLabels.add(label);
        const start = Math.max(0, match.index - 40);
        const end = Math.min(text.length, match.index + match[0].length + 60);
        const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
        flags.push({
          category: "PROMPT_INJECTION_SUSPECTED",
          severity: 5,
          description: `[Security Gate] Suspected prompt injection or instruction override in "${fileName}": ${label}. Human verification required before matching.`,
          sourceFileName: fileName,
          evidenceSnippet: snippet,
        });
      }
    }
  }

  return flags;
}

function normalizeForQuoteMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministically checks whether `verbatimQuote` exists inside `parsedSourceText`
 * (when `parsedSourceText` is available, e.g. from spreadsheets, CSVs, or text files).
 * For binary PDFs sent directly to remote OCR, `parsedSourceText` is null so
 * `quoteVerifiedInText` returns `null` (avoiding false positives on binary streams).
 */
export function verifyVerbatimQuoteInText(
  verbatimQuote: string | null | undefined,
  parsedSourceText?: string | null,
): boolean | null {
  if (!parsedSourceText) {
    return null;
  }
  if (!verbatimQuote || verbatimQuote.trim().length < 4) {
    return false;
  }
  const normSource = normalizeForQuoteMatch(parsedSourceText);
  const normQuote = normalizeForQuoteMatch(verbatimQuote.replace(/^["“”']+|["“”']+$/g, ""));
  if (normSource.includes(normQuote)) {
    return true;
  }
  // Also check first 6 words in sequence in case of table cell formatting differences
  const words = normQuote.split(" ").filter(Boolean);
  if (words.length >= 4) {
    const prefix = words.slice(0, Math.min(6, words.length)).join(" ");
    if (normSource.includes(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a canonical `ProvenancePointer` for a document extraction pass.
 */
export function buildDocumentProvenancePointer(params: {
  fileName: string;
  documentTypes: string[];
  taintOverride?: string | null;
  policyMap?: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM">;
  pageOrSheet?: string | null;
  verbatimQuote?: string | null;
  parsedSourceText?: string | null;
}): { pointer: ProvenancePointer; taint: TaintLevel } {
  const taint = resolveDocumentTaint(
    params.documentTypes,
    params.taintOverride,
    params.policyMap,
  );
  const quoteVerifiedInText = verifyVerbatimQuoteInText(
    params.verbatimQuote,
    params.parsedSourceText,
  );

  return {
    taint,
    pointer: {
      sourceFileName: params.fileName,
      documentTypes: params.documentTypes,
      taint,
      pageOrSheet: params.pageOrSheet ?? null,
      verbatimQuote: params.verbatimQuote ?? null,
      quoteVerifiedInText,
    },
  };
}
