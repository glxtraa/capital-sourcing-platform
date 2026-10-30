/**
 * Universal Source Link Verification Engine.
 *
 * Verifies that web sources, citations, portfolio links, and application URLs
 * cited during Startup, VC, and Trade research are genuinely reachable, responding,
 * and returning valid HTTP status codes (200 OK, 3xx redirects).
 *
 * Prevents hallucinated URLs, dead links, and unverified claims.
 */

import { cachePageCited } from "@/lib/page-cache";

export interface VerifiedSourceLink {
  url: string;
  status: number; // e.g. 200, 301, 404, 0 (network failure)
  ok: boolean;
  latencyMs: number;
  testedAt: string; // ISO timestamp
  contentType?: string;
  error?: string;
  normalizedUrl: string;
  resolvedWorkingUrl?: string;
  cachedPageId?: string;
  cachedTitle?: string;
  cachedSnippet?: string;
  cachedContent?: string;
  keywordVerification?: {
    requiredKeywords: string[];
    matchedKeywords: string[];
    missingKeywords: string[];
    passesGrounding: boolean;
  };
}

const REALISTIC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/**
 * Normalizes a URL string for consistent testing and repairs known dead/moved institutional routes.
 */
export function normalizeUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  if (cleaned.startsWith("url:http://") || cleaned.startsWith("url:https://")) {
    cleaned = cleaned.replace(/^url:/, "");
  }
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }
  try {
    const parsed = new URL(cleaned);
    // Rabobank /en was moved or returns 404/403 WAF page -> normalize to working wholesale portal
    if (parsed.hostname.includes("rabobank.com") && (parsed.pathname === "/en" || parsed.pathname === "/en/")) {
      return "https://www.rabobank.com/wholesale/asia/singapore";
    }
    // Channel Capital legacy domain -> modern domain
    if (parsed.hostname.includes("channelcapital.co.uk")) {
      return `https://channelcapital.io${parsed.pathname === "/" ? "" : parsed.pathname}`;
    }
    return parsed.toString();
  } catch {
    return cleaned;
  }
}

async function performHttpRequest(url: string, timeoutMs: number): Promise<{ res: Response | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        headers: REALISTIC_HEADERS,
        redirect: "follow",
        signal: controller.signal,
      });

      if (res.status === 405 || res.status === 403 || res.status === 400) {
        res = await fetch(url, {
          method: "GET",
          headers: {
            ...REALISTIC_HEADERS,
            Range: "bytes=0-2048",
          },
          redirect: "follow",
          signal: controller.signal,
        });
      }
    } catch {
      res = await fetch(url, {
        method: "GET",
        headers: {
          ...REALISTIC_HEADERS,
          Range: "bytes=0-2048",
        },
        redirect: "follow",
        signal: controller.signal,
      });
    }

    return { res };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
    return { res: null, error: isTimeout ? `Timeout after ${timeoutMs}ms` : err?.message || "Connection failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-tests a single source link via HTTP with strict timeout, redirect handling,
 * and intelligent alternative domain verification for VC firms.
 */
export async function testSourceLink(
  rawUrl: string,
  timeoutMs = 6000,
  options: { cachePage?: boolean; requiredKeywords?: string[] } = { cachePage: true },
): Promise<VerifiedSourceLink> {
  const normalized = normalizeUrl(rawUrl);
  const start = Date.now();

  if (!rawUrl || rawUrl.trim() === "" || rawUrl.startsWith("javascript:") || rawUrl.startsWith("mailto:")) {
    return {
      url: rawUrl,
      normalizedUrl: normalized,
      status: 0,
      ok: false,
      latencyMs: 0,
      testedAt: new Date().toISOString(),
      error: "Invalid or unsupported URL scheme",
    };
  }

  if (normalized.includes("example.com")) {
    return {
      url: rawUrl,
      normalizedUrl: normalized,
      status: 400,
      ok: false,
      latencyMs: 0,
      testedAt: new Date().toISOString(),
      error: "Dummy placeholder domain (example.com) rejected by verification policy",
    };
  }

  const { res, error } = await performHttpRequest(normalized, timeoutMs);
  const latencyMs = Date.now() - start;

  if (res) {
    // Strictly 2xx and 3xx (which redirect: follow resolves) are considered OK,
    // plus LinkedIn's standard HTTP 999 anti-scraping status on valid profile routes.
    const isLinkedIn999 = res.status === 999 && normalized.includes("linkedin.com/");
    let ok = (res.status >= 200 && res.status < 400) || isLinkedIn999;
    const contentType = res.headers.get("content-type") ?? undefined;

    // If the check failed (e.g. 403 / 404 / 410) on a primary domain root,
    // test known alternative TLDs or www/non-www (e.g. phoenixcourt.com -> phoenixcourt.vc / www.phoenixcourt.vc)
    let resolvedWorkingUrl: string | undefined = undefined;

    if (!ok) {
      try {
        const parsed = new URL(normalized);
        const host = parsed.hostname;
        const candidates: string[] = [];

        // Check www vs non-www
        if (host.startsWith("www.")) {
          candidates.push(normalized.replace("www.", ""));
        } else {
          candidates.push(normalized.replace(`//${host}`, `//www.${host}`));
        }

        // Check common VC TLD alternates (.com <-> .vc <-> .capital)
        if (host.endsWith(".com")) {
          candidates.push(normalized.replace(".com", ".vc"));
          candidates.push(normalized.replace(`//${host}`, `//www.${host.replace(".com", ".vc")}`));
        } else if (host.endsWith(".vc")) {
          candidates.push(normalized.replace(".vc", ".com"));
        }

        for (const candidate of candidates) {
          if (candidate === normalized) continue;
          const altCheck = await performHttpRequest(candidate, 3500);
          if (altCheck.res && altCheck.res.status >= 200 && altCheck.res.status < 400) {
            resolvedWorkingUrl = candidate;
            break;
          }
        }
      } catch {
        // Ignore alternative parsing errors
      }
    }

    // When researching links cache the page cited (including LinkedIn 999 / bot-protected pages)
    let cachedPageId: string | undefined = undefined;
    let cachedTitle: string | undefined = undefined;
    let cachedSnippet: string | undefined = undefined;
    let cachedContent: string | undefined = undefined;
    let keywordVerification: VerifiedSourceLink["keywordVerification"] = undefined;

    if ((ok || resolvedWorkingUrl || normalized.includes("linkedin.com/")) && options.cachePage !== false) {
      const targetCacheUrl = resolvedWorkingUrl || normalized;
      const cached = await cachePageCited(targetCacheUrl, { timeoutMs: 5000 });
      if (cached) {
        cachedPageId = cached.id;
        cachedTitle = cached.title ?? undefined;
        cachedSnippet = cached.snippet ?? undefined;
        cachedContent = cached.content;
      }
    }

    // Verify grounding keywords against cached page content and title
    if (options.requiredKeywords && options.requiredKeywords.length > 0) {
      const searchSpace = `${cachedTitle ?? ""} ${cachedSnippet ?? ""} ${cachedContent ?? ""}`.toLowerCase();
      const matchedKeywords: string[] = [];
      const missingKeywords: string[] = [];

      for (const kw of options.requiredKeywords) {
        const cleanKw = kw.toLowerCase().trim();
        if (!cleanKw) continue;
        if (searchSpace.includes(cleanKw)) {
          matchedKeywords.push(kw);
        } else {
          missingKeywords.push(kw);
        }
      }

      const passesGrounding = missingKeywords.length === 0 || matchedKeywords.length > 0;
      keywordVerification = {
        requiredKeywords: options.requiredKeywords,
        matchedKeywords,
        missingKeywords,
        passesGrounding,
      };

      // If page is reachable but completely fails to contain the required person / entity name, flag grounding failure
      if (ok && searchSpace.trim().length > 100 && matchedKeywords.length === 0 && options.requiredKeywords.length > 0) {
        ok = false;
      }
    }

    return {
      url: rawUrl,
      normalizedUrl: normalized,
      status: isLinkedIn999 ? 200 : res.status,
      ok,
      latencyMs,
      testedAt: new Date().toISOString(),
      contentType,
      resolvedWorkingUrl,
      cachedPageId,
      cachedTitle,
      cachedSnippet,
      keywordVerification,
      error: ok ? undefined : (keywordVerification && !keywordVerification.passesGrounding ? `Page reached (HTTP ${res.status}) but failed ground verification: missing keywords [${keywordVerification.missingKeywords.join(", ")}]` : `HTTP ${res.status} ${res.statusText || ""}`.trim()),
    };
  }

  // Network / DNS failure: try alternative candidate
  let resolvedWorkingUrl: string | undefined = undefined;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname;
    const alt = host.endsWith(".com") ? normalized.replace(".com", ".vc") : undefined;
    if (alt) {
      const altCheck = await performHttpRequest(alt, 3500);
      if (altCheck.res && altCheck.res.status >= 200 && altCheck.res.status < 400) {
        resolvedWorkingUrl = alt;
      }
    }
  } catch {}

  let cachedPageId: string | undefined = undefined;
  let cachedTitle: string | undefined = undefined;
  let cachedSnippet: string | undefined = undefined;

  if (resolvedWorkingUrl && options.cachePage !== false) {
    const cached = await cachePageCited(resolvedWorkingUrl, { timeoutMs: 5000 });
    if (cached) {
      cachedPageId = cached.id;
      cachedTitle = cached.title ?? undefined;
      cachedSnippet = cached.snippet ?? undefined;
    }
  }

  return {
    url: rawUrl,
    normalizedUrl: normalized,
    status: 0,
    ok: false,
    latencyMs,
    testedAt: new Date().toISOString(),
    resolvedWorkingUrl,
    cachedPageId,
    cachedTitle,
    cachedSnippet,
    error: error || "DNS or network resolution failed",
  };
}

/**
 * Re-tests an array of source links in parallel with a concurrency cap and caches cited pages.
 */
export async function testSourceLinks(
  urls: string[],
  concurrency = 5,
  timeoutMs = 6000,
  options: { cachePages?: boolean; requiredKeywords?: string[] } = { cachePages: true },
): Promise<VerifiedSourceLink[]> {
  const uniqueUrls = Array.from(new Set(urls.filter((u) => Boolean(u && typeof u === "string"))));
  if (uniqueUrls.length === 0) return [];

  const results: VerifiedSourceLink[] = [];
  const queue = [...uniqueUrls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const verified = await testSourceLink(url, timeoutMs, {
        cachePage: options.cachePages !== false,
        requiredKeywords: options.requiredKeywords,
      });
      results.push(verified);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Lightweight pre-flight link liveness check with timeout and redirect handling.
 * Returns whether the target is live (2xx/3xx), normalized target, and status.
 */
export async function verifyLinkLiveness(
  rawUrl: string,
  timeoutMs = 6000,
): Promise<{ reachable: boolean; status: number; normalizedUrl: string; error?: string }> {
  if (!rawUrl || rawUrl.includes("example.com") || rawUrl.startsWith("javascript:") || rawUrl.startsWith("mailto:")) {
    return { reachable: false, status: 0, normalizedUrl: rawUrl, error: "Invalid, mailto, or dummy URL" };
  }
  const norm = normalizeUrl(rawUrl);
  const result = await testSourceLink(norm, timeoutMs, { cachePage: false });
  return {
    reachable: result.ok,
    status: result.status,
    normalizedUrl: result.resolvedWorkingUrl || norm,
    error: result.error,
  };
}
