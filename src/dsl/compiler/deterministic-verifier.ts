import { SourceCorpus, normalizeTextForMatching } from "./source-corpus";
import type {
  GroundedFieldInspection,
  DslCompilerDiagnostic,
  IndexedSource,
  SourceSlice,
} from "./types";

/**
 * Builds numeric regex variants to match numbers formatted in diverse ways:
 * e.g., 12000000 -> ["12000000", "12,000,000", "12.0m", "12m", "12 million", "12,000k"]
 * e.g., 85 -> ["85", "85%", "85.0%", "85 percent", "0.85"]
 */
export function buildNumericRegexes(num: number): RegExp[] {
  const regexes: RegExp[] = [];
  const absNum = Math.abs(num);

  // Exact raw number
  const rawStr = absNum.toString();
  regexes.push(new RegExp(`\\b${rawStr}\\b`, "i"));

  // Comma formatted (e.g. 12,000,000 or 250,000)
  const commaStr = absNum.toLocaleString("en-US");
  if (commaStr !== rawStr) {
    const escapedComma = commaStr.replace(/,/g, "[,\\s]?");
    regexes.push(new RegExp(`\\b${escapedComma}\\b`, "i"));
  }

  // Millions notation (e.g. 12M, $12m, 12.0M, 12 million, 1.5M, 1.5 million)
  if (absNum >= 100000) {
    const inMillions = absNum / 1000000;
    const mStr = Number.isInteger(inMillions) ? inMillions.toString() : inMillions.toFixed(1).replace(/\.0$/, "");
    regexes.push(new RegExp(`\\b${mStr}(?:\\.0+)?\\s*(?:m|million|m\\b)`, "i"));
    regexes.push(new RegExp(`\\$?\\s*${mStr}(?:\\.0+)?\\s*(?:m|million)`, "i"));

    // Thousands notation (e.g. 250k, 250 thousand, 250.0k)
    const inThousands = absNum / 1000;
    const kStr = Number.isInteger(inThousands) ? inThousands.toString() : inThousands.toFixed(1).replace(/\.0$/, "");
    regexes.push(new RegExp(`\\b${kStr}(?:\\.0+)?\\s*(?:k|thousand|thous)\\b`, "i"));
  }

  // Percentage notation (e.g. 85 -> 85%, 85.0%, 0.85)
  if (absNum <= 100) {
    regexes.push(new RegExp(`\\b${absNum}(?:\\.0+)?\\s*%`, "i"));
    regexes.push(new RegExp(`\\b${absNum}(?:\\.0+)?\\s*percent`, "i"));
    const decimal = (absNum / 100).toFixed(2);
    regexes.push(new RegExp(`\\b${decimal}\\b`, "i"));
  }

  return regexes;
}

/**
 * Builds entity name matching regexes, stripping corporate suffixes:
 * e.g. "Favorite Medium Asia Limited" matches "favorite medium asia"
 */
export function buildEntityNameRegex(name: string): RegExp {
  const stripped = name
    .toLowerCase()
    .replace(/\b(pte\.?|ltd\.?|limited|inc\.?|incorporated|corp\.?|corporation|llc|gmbh|s\.?a\.?|co\.?)\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "\\s+");

  return new RegExp(`\\b${stripped}\\b`, "i");
}

/**
 * Checks for role contradiction in party quote:
 * e.g. if claimed role is BORROWER, but quote says "('Lender')" or "as Buyer", returns an error.
 */
function checkRoleContradiction(
  roleExpected: string | undefined,
  quote: string
): string | null {
  if (!roleExpected) return null;
  const q = quote.toLowerCase();

  if (roleExpected === "BORROWER") {
    if (/\b(?:as\s+)?lender\b/i.test(q) && !/\b(?:as\s+)?borrower\b/i.test(q)) {
      return "Quote explicitly designates this party as 'Lender', contradicting claimed role 'BORROWER'.";
    }
    if (/\b(?:as\s+)?buyer\b/i.test(q) && !/\b(?:as\s+)?seller\b/i.test(q)) {
      return "Quote explicitly designates this party as 'Buyer', contradicting claimed role 'BORROWER' (Seller).";
    }
  }

  if (roleExpected === "OBLIGOR") {
    if (/\b(?:as\s+)?borrower\b/i.test(q) && !/\b(?:as\s+)?obligor|buyer|debtor\b/i.test(q)) {
      return "Quote designates this party as 'Borrower', contradicting claimed role 'OBLIGOR'.";
    }
  }

  return null;
}

/**
 * Runs the 5-Gate Deterministic Verifier on a single grounded field extraction.
 */
export function verifyGroundedField(
  field: GroundedFieldInspection,
  corpus: SourceCorpus
): DslCompilerDiagnostic[] {
  const diagnostics: DslCompilerDiagnostic[] = [];
  const { jsonPath, value, provenance, expectedType, roleExpected } = field;

  // Null or empty array values need no provenance
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    return diagnostics;
  }

  // =========================================================================
  // Gate 1: Provenance Metadata Completeness Check
  // =========================================================================
  if (!provenance) {
    diagnostics.push({
      jsonPath,
      code: "MISSING_PROVENANCE_METADATA",
      message: `Extracted value (${JSON.stringify(value)}) is missing required provenance metadata (sourceRef, location, verbatimQuote).`,
      extractedValue: value,
      suggestedFix: "Provide sourceRef, location, and verbatimQuote, or set value to null if not in document.",
    });
    return diagnostics;
  }

  const { sourceRef, location, verbatimQuote, derivation } = provenance;

  if (!sourceRef || !sourceRef.trim()) {
    diagnostics.push({
      jsonPath,
      code: "MISSING_PROVENANCE_METADATA",
      message: `Extracted field at ${jsonPath} has an empty 'sourceRef'.`,
      claimedLocation: location,
      claimedQuote: verbatimQuote,
      extractedValue: value,
    });
    return diagnostics;
  }

  if (!location || !location.trim() || /^(n\/?a|unknown|unspecified)$/i.test(location.trim())) {
    diagnostics.push({
      jsonPath,
      code: "LOCATION_COORDINATE_NOT_FOUND",
      message: `Extracted field at ${jsonPath} has an invalid or placeholder location coordinate: '${location}'.`,
      claimedSource: sourceRef,
      claimedQuote: verbatimQuote,
      extractedValue: value,
      suggestedFix: "Specify the exact Page number, Slide number, or Sheet name.",
    });
    return diagnostics;
  }

  if (!verbatimQuote || verbatimQuote.trim().length < 3) {
    diagnostics.push({
      jsonPath,
      code: "MISSING_PROVENANCE_METADATA",
      message: `Extracted field at ${jsonPath} has an empty or trivial 'verbatimQuote'.`,
      claimedSource: sourceRef,
      claimedLocation: location,
      extractedValue: value,
      suggestedFix: "Copy the exact character-for-character substring proving this value.",
    });
    return diagnostics;
  }

  // =========================================================================
  // Gate 2: Source Existence Check
  // =========================================================================
  const source: IndexedSource | null = corpus.getSource(sourceRef);
  if (!source) {
    // Check if it's in the search findings auxiliary corpus
    const fallbackSource = corpus.getSource("SEARCH_ENGINE_FINDINGS");
    if (!fallbackSource) {
      diagnostics.push({
        jsonPath,
        code: "SOURCE_NOT_FOUND_IN_CORPUS",
        message: `Claimed source '${sourceRef}' does not exist in the deal's corpus of uploaded documents or crawled web URLs. Available sources: [${corpus.listSources().join(", ")}]`,
        claimedSource: sourceRef,
        claimedLocation: location,
        claimedQuote: verbatimQuote,
        extractedValue: value,
        suggestedFix: `Choose from one of the actual available documents: [${corpus.listSources().join(", ")}]`,
      });
      return diagnostics;
    }
  }

  const activeSource: IndexedSource = source || corpus.getSource("SEARCH_ENGINE_FINDINGS")!;

  // =========================================================================
  // Gate 3: Location Coordinate Resolution Check
  // =========================================================================
  // Check for hallucinated clauses (e.g. "Clause 1.2" on a pitch deck that has no clauses)
  const clauseMatch = location.match(/\b(clause|article|section|schedule)\s*([0-9A-Za-z.]+)\b/i);
  if (clauseMatch) {
    const clauseTerm = clauseMatch[0].toLowerCase();
    const clauseNum = clauseMatch[2].toLowerCase();
    const normFullText = normalizeTextForMatching(activeSource.fullText);
    const hasClauseTerm = normFullText.includes(clauseTerm) || normFullText.includes(clauseNum);
    if (!hasClauseTerm) {
      diagnostics.push({
        jsonPath,
        code: "LOCATION_COORDINATE_NOT_FOUND",
        message: `Claimed location coordinate '${location}' refers to '${clauseMatch[0]}', but no such clause or section exists in '${activeSource.sourceRef}'.`,
        claimedSource: sourceRef,
        claimedLocation: location,
        claimedQuote: verbatimQuote,
        extractedValue: value,
        suggestedFix: "Do not fabricate clause numbers. Cite the exact Page or Slide number instead.",
      });
      return diagnostics;
    }
  }

  const { targetSlice } = corpus.resolveLocationSlice(activeSource, location);

  // =========================================================================
  // Gate 4: Deterministic Quote-in-Location Regex / Token Check
  // =========================================================================
  const normQuote = normalizeTextForMatching(verbatimQuote);

  // 4a. Check in targetSlice
  let quoteFoundInTarget = false;
  if (targetSlice) {
    const normSlice = normalizeTextForMatching(targetSlice.text);
    quoteFoundInTarget = normSlice.includes(normQuote);
  }

  if (!quoteFoundInTarget) {
    // 4b. Check if quote appears elsewhere in the document
    const crossCheck = corpus.findQuoteAcrossSource(activeSource, verbatimQuote);
    if (crossCheck.found && crossCheck.sliceId) {
      diagnostics.push({
        jsonPath,
        code: "WRONG_LOCATION_COORDINATE",
        message: `Claimed quote was not found at location '${location}', but was found in '${crossCheck.sliceId}'. Update the location coordinate to '${crossCheck.sliceId}'.`,
        claimedSource: sourceRef,
        claimedLocation: location,
        claimedQuote: verbatimQuote,
        extractedValue: value,
        suggestedFix: `Update location to '${crossCheck.sliceId}'.`,
      });
      return diagnostics;
    } else {
      diagnostics.push({
        jsonPath,
        code: "QUOTE_NOT_FOUND_IN_SOURCE",
        message: `Claimed verbatimQuote does not exist anywhere in '${activeSource.sourceRef}'. (Quote: "${verbatimQuote}")`,
        claimedSource: sourceRef,
        claimedLocation: location,
        claimedQuote: verbatimQuote,
        extractedValue: value,
        suggestedFix: "Copy the exact text as written in the source document without paraphrasing.",
      });
      return diagnostics;
    }
  }

  // =========================================================================
  // Gate 5: Deterministic Value-in-Quote Regex Check
  // =========================================================================
  if (derivation === "VERBATIM_EXTRACTED") {
    // 5a. Role Contradiction check
    const roleContradiction = checkRoleContradiction(roleExpected, verbatimQuote);
    if (roleContradiction) {
      diagnostics.push({
        jsonPath,
        code: "ROLE_CONTRADICTS_QUOTE",
        message: roleContradiction,
        claimedSource: sourceRef,
        claimedLocation: location,
        claimedQuote: verbatimQuote,
        extractedValue: value,
        suggestedFix: "Correct the party role or extract the true counterparty.",
      });
      return diagnostics;
    }

    // 5b. Numeric value check
    if (typeof value === "number") {
      const numRegexes = buildNumericRegexes(value);
      const matchesAnyNum = numRegexes.some((rx) => rx.test(verbatimQuote));
      if (!matchesAnyNum) {
        diagnostics.push({
          jsonPath,
          code: "VALUE_NOT_SUPPORTED_BY_QUOTE",
          message: `Extracted numeric value '${value}' is not present in verbatimQuote ("${verbatimQuote}").`,
          claimedSource: sourceRef,
          claimedLocation: location,
          claimedQuote: verbatimQuote,
          extractedValue: value,
          suggestedFix: "If this number is not explicitly in the quote, set derivation to 'COMPUTED_FROM_QUOTE' or set value to null.",
        });
        return diagnostics;
      }
    }

    // 5c. String / Entity name check
    if (typeof value === "string" && value.length > 2 && expectedType !== "jurisdiction") {
      const entityRx = buildEntityNameRegex(value);
      const matchesEntity = entityRx.test(verbatimQuote);
      if (!matchesEntity) {
        // Also check if any word of the value is in the quote
        const words = value.split(/\s+/).filter((w) => w.length > 3);
        const hasKeyword = words.some((w) => verbatimQuote.toLowerCase().includes(w.toLowerCase()));
        if (!hasKeyword) {
          diagnostics.push({
            jsonPath,
            code: "VALUE_NOT_SUPPORTED_BY_QUOTE",
            message: `Extracted entity string '${value}' is not mentioned in verbatimQuote ("${verbatimQuote}").`,
            claimedSource: sourceRef,
            claimedLocation: location,
            claimedQuote: verbatimQuote,
            extractedValue: value,
          });
          return diagnostics;
        }
      }
    }
  }

  return diagnostics;
}
