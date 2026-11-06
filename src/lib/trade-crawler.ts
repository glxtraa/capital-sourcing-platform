import { cachePageCited } from "@/lib/page-cache";
import { normalizeUrl } from "@/lib/link-verifier";

export interface CrawledExtractionResult {
  url: string;
  pageTitle: string;
  cachedContent: string;
  snippet: string;
  exactQuotes: {
    ticketSize?: string;
    advancesOrPricing?: string;
    jurisdictions?: string;
    mandateOrGating?: string;
  };
  verifiedTokensFound: string[];
}

/**
 * Filter out raw binary bytecode or unparsed PDF stream markers.
 */
function sanitizeCleanSnippet(text: string): string {
  if (!text) return "";
  if (text.includes("obj >/Filter") || text.includes("/FlateDecode") || text.includes("endobj") || /[\x00-\x08\x0E-\x1F]/.test(text)) {
    return "";
  }
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Clean textual candidate quote by ensuring it is bounded and verbatim present in the snapshot.
 */
function findVerbatimSentence(content: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[0]) {
      const candidate = match[0].replace(/\s+/g, " ").trim();
      // Ensure candidate is substantive and not binary garbage
      if (candidate.length < 8 || sanitizeCleanSnippet(candidate) === "") continue;
      // Ensure candidate is present in content (case-insensitive substring check)
      const idx = content.toLowerCase().indexOf(candidate.toLowerCase());
      if (idx !== -1) {
        // Return exact casing from source content
        return content.slice(idx, idx + candidate.length).trim();
      }
    }
  }
  return undefined;
}

/**
 * Strict Trade Site Crawler:
 * Crawls target URLs, traverses primary and secondary sub-routes (e.g. /trade-loans, /tariffs, /products),
 * caches full page text, and deterministically extracts verifiable verbatim quotes.
 */
export async function crawlTradeFunderSite(
  primaryUrl: string,
  secondaryUrls: string[] = []
): Promise<CrawledExtractionResult | null> {
  const allUrls = [primaryUrl, ...secondaryUrls]
    .map((u) => normalizeUrl(u))
    .filter((u) => Boolean(u && u.startsWith("http") && !u.includes("example.com")));
  if (allUrls.length === 0) return null;

  let bestResult: CrawledExtractionResult | null = null;

  for (const targetUrl of allUrls.slice(0, 3)) {
    try {
      const cached = await cachePageCited(targetUrl, { forceRefresh: true, timeoutMs: 9000 });
      if (!cached || !cached.content) continue;

      const content = cached.content;
      const pageTitle = cached.title || "Official Portal";

      // 1. Ticket bounds pattern (e.g. limits from SGD 100K to 300K, Max ticket $5M, loans up to S$150K)
      const ticketQuote = findVerbatimSentence(content, [
        /[^\n.!?]*(?:limits from|facility with limits|loan size|loans up to|ticket bounds|facility limit)[^\n.!?]*/i,
        /[^\n.!?]*(?:SGD\s*\d+[KkMm]?|USD\s*\d+[KkMm]?|\$\d+[KkMm]?\s*to\s*\$?\d+[KkMm]?)[^\n.!?]*/i,
      ]);

      // 2. Pricing / Advance / Repayment patterns
      const pricingQuote = findVerbatimSentence(content, [
        /[^\n.!?]*(?:finance your invoices\s*\d+%\s*upfront|repay in\s*\d+\s*equal|advance rate of|discount of\s*\d+(?:\.\d+)?%)[^\n.!?]*/i,
        /[^\n.!?]*(?:SOFR\s*[+-]\s*\d+\s*(?:bps|%)|interest from\s*\d+(?:\.\d+)?%|facility fee)[^\n.!?]*/i,
      ]);

      // 3. Jurisdiction / Entity patterns
      const jurisdictionQuote = findVerbatimSentence(content, [
        /[^\n.!?]*(?:Enterprise Singapore|participating financial institution|Singapore Citizen|Pte Ltd|registered in|licensed by)[^\n.!?]*/i,
        /[^\n.!?]*(?:jurisdictions accepted|cross-border trade across|domiciled in)[^\n.!?]*/i,
      ]);

      // 4. Mandate / Gating factor patterns
      const mandateQuote = findVerbatimSentence(content, [
        /[^\n.!?]*(?:excludes?|not suitable for|requires? minimum|mandatory|operating history of)[^\n.!?]*/i,
        /[^\n.!?]*(?:bills of lading|letter of credit|collateral|credit insurance)[^\n.!?]*/i,
      ]);

      const foundQuotes = [ticketQuote, pricingQuote, jurisdictionQuote, mandateQuote].filter(Boolean) as string[];
      const candidateSnippet = foundQuotes[0] || cached.snippet || content.slice(0, 250).replace(/\n/g, " ");
      const snippet = sanitizeCleanSnippet(candidateSnippet) || "Source route verified and indexed.";

      const result: CrawledExtractionResult = {
        url: targetUrl,
        pageTitle,
        cachedContent: content.slice(0, 8000),
        snippet,
        exactQuotes: {
          ticketSize: ticketQuote,
          advancesOrPricing: pricingQuote,
          jurisdictions: jurisdictionQuote,
          mandateOrGating: mandateQuote,
        },
        verifiedTokensFound: foundQuotes,
      };

      if (!bestResult || foundQuotes.length > bestResult.verifiedTokensFound.length) {
        bestResult = result;
      }

      // If we found at least 2 strong verbatim quotes, stop crawling further
      if (foundQuotes.length >= 2) break;
    } catch {
      // Continue to next candidate URL
    }
  }

  return bestResult;
}
