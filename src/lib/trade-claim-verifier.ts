import {
  type TradeFunderDTO,
  type FunderValidationDiagnostic,
  type ClaimVerification,
  validateTradeFunderDSL
} from "@/dsl/trade";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SEC_USER_AGENT = "CapitalSourcingPlatform/1.0 (compliance@capital-sourcing.com)";

/**
 * Normalizes text for robust token and substring matching.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts salient numerical and domain keywords from an evidence snippet or guidance string.
 * e.g., "SOFR + 350-475 bps" -> ["sofr", "350", "475", "bps"]
 */
function extractSalientKeywords(snippet: string): string[] {
  const clean = snippet.toLowerCase();
  const tokens = clean.match(/\b([0-9]+(?:\.[0-9]+)?%?|[a-z]{3,})\b/g) || [];
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "are", "under", "this", "that", "per", "p.a.", "annum", "lines", "facility"
  ]);
  return Array.from(new Set(tokens.filter((t) => !stopWords.has(t))));
}

/**
 * Safely fetches a URL with proper headers, redirects, and a strict timeout.
 */
async function fetchPageText(url: string, timeoutMs = 7000): Promise<{ ok: boolean; status: number; text: string; error?: string }> {
  try {
    const isSec = url.includes("sec.gov");
    const res = await fetch(url, {
      headers: {
        "User-Agent": isSec ? SEC_USER_AGENT : BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, text: "", error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    return { ok: true, status: res.status, text: normalizeText(html) };
  } catch (err: any) {
    return { ok: false, status: 0, text: "", error: err?.message || "Network timeout or connection error" };
  }
}

/**
 * Active Research DSL Claim Verifier:
 * Inspects funder claims against real page content to prevent synthetic quotes and hallucinations.
 */
export async function verifyTradeFunderClaims(
  funder: Partial<TradeFunderDTO>,
  options: { checkNetwork?: boolean } = { checkNetwork: true }
): Promise<FunderValidationDiagnostic> {
  // 1. Run baseline synchronous DSL checks
  const diagnostic = validateTradeFunderDSL(funder);

  const derivation = funder.pricingProvenance?.derivationType;
  const targetUrl = funder.pricingProvenance?.sourceDocumentOrUrl || funder.sources?.[0];
  const snippet = funder.rateEvidenceSnippet || funder.pricingProvenance?.evidenceSnippet || "";

  const claimVerification: ClaimVerification = {
    status: "NOT_RUN",
    isHallucinationRisk: false,
    confidenceScore: diagnostic.completenessScorePct,
    matchedKeywords: [],
    missingKeywords: [],
    details: "",
    verifiedAt: new Date().toISOString(),
  };

  // Case A: Acknowledged Unpublished Bilateral Rate
  if (derivation === "UNPUBLISHED_BILATERAL_ESTIMATE") {
    claimVerification.status = "UNPUBLISHED_ESTIMATE_VERIFIED";
    claimVerification.isHallucinationRisk = false;
    claimVerification.details =
      "Truthful acknowledgment: bilateral credit spread is designated as an unpublished model baseline. No synthetic quotes claimed.";

    return {
      ...diagnostic,
      claimVerification,
    };
  }

  // If no URL or network checking disabled, return baseline diagnostic
  if (!targetUrl || !options.checkNetwork) {
    return {
      ...diagnostic,
      claimVerification,
    };
  }

  claimVerification.sourceUrlTested = targetUrl;

  // Case B: Live URL Reachability and Ground-Truth Attestation
  const fetchResult = await fetchPageText(targetUrl);
  claimVerification.httpStatus = fetchResult.status;

  if (!fetchResult.ok) {
    // URL is unreachable or dead
    claimVerification.status = "FAILED_URL_UNREACHABLE";
    claimVerification.isHallucinationRisk = true;
    claimVerification.details = `Source link '${targetUrl}' could not be verified: ${fetchResult.error}.`;

    diagnostic.unverifiedClaims.push(
      `Unreachable Source: ${targetUrl} returned ${fetchResult.error}. Ensure source link is an active, live URL.`
    );
    diagnostic.agentDirectives.push(`Replace broken or unreachable link '${targetUrl}' with a verified working portal URL.`);
    diagnostic.isValid = false;
    diagnostic.completenessScorePct = Math.max(0, diagnostic.completenessScorePct - 25);

    return {
      ...diagnostic,
      claimVerification,
    };
  }

  // Case C: Check if snippet / keywords exist on the page
  const pageText = fetchResult.text;
  const salientKeywords = extractSalientKeywords(snippet);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of salientKeywords) {
    if (pageText.includes(kw)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  claimVerification.matchedKeywords = matched;
  claimVerification.missingKeywords = missing;

  // Numerical tokens are crucial (e.g. 350, 475, 0.8)
  const numericalTokens = salientKeywords.filter((k) => /[0-9]/.test(k));
  const missingNumbers = numericalTokens.filter((k) => !matched.includes(k));

  if (derivation === "PUBLISHED_TARIFF" && missingNumbers.length > 0) {
    // Agent claimed a published tariff, but the numbers do NOT exist on the page!
    claimVerification.status = "FAILED_SNIPPET_NOT_FOUND";
    claimVerification.isHallucinationRisk = true;
    claimVerification.details = `Hallucination Alert: Quoted numerical rate tokens [${missingNumbers.join(
      ", "
    )}] were not found in the content of ${targetUrl}.`;

    diagnostic.unverifiedClaims.push(
      `Hallucinated Claim: Agent claimed a published tariff with terms [${missingNumbers.join(
        ", "
      )}], but these were not found on ${targetUrl}.`
    );
    diagnostic.agentDirectives.push(
      `Do not claim 'PUBLISHED_TARIFF' when specific rate tokens are absent from the cited webpage. Reclassify as 'UNPUBLISHED_BILATERAL_ESTIMATE' or cite an official statutory filing.`
    );
    diagnostic.isValid = false;
    diagnostic.completenessScorePct = Math.max(0, diagnostic.completenessScorePct - 35);

    return {
      ...diagnostic,
      claimVerification,
    };
  }

  // All checks passed
  claimVerification.status = "VERIFIED_IN_SOURCE";
  claimVerification.isHallucinationRisk = false;
  claimVerification.confidenceScore = 100;
  claimVerification.details = `Verified in source: Matched ${matched.length}/${salientKeywords.length} salient keywords on ${targetUrl}.`;

  return {
    ...diagnostic,
    claimVerification,
  };
}
