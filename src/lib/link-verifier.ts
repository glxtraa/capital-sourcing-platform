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
 * Normalizes a URL string for consistent testing.
 */
export function normalizeUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }
  try {
    const parsed = new URL(cleaned);
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
  options: { cachePage?: boolean } = { cachePage: true },
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

  const { res, error } = await performHttpRequest(normalized, timeoutMs);
  const latencyMs = Date.now() - start;

  if (res) {
    // Strictly 2xx and 3xx (which redirect: follow resolves) are considered OK.
    // 403 Forbidden or 404 Not Found are NOT verified.
    const ok = res.status >= 200 && res.status < 400;
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

    // When researching links cache the page cited
    let cachedPageId: string | undefined = undefined;
    let cachedTitle: string | undefined = undefined;
    let cachedSnippet: string | undefined = undefined;

    if ((ok || resolvedWorkingUrl) && options.cachePage !== false) {
      const targetCacheUrl = resolvedWorkingUrl || normalized;
      const cached = await cachePageCited(targetCacheUrl, { timeoutMs: 5000 });
      if (cached) {
        cachedPageId = cached.id;
        cachedTitle = cached.title ?? undefined;
        cachedSnippet = cached.snippet ?? undefined;
      }
    }

    return {
      url: rawUrl,
      normalizedUrl: normalized,
      status: res.status,
      ok,
      latencyMs,
      testedAt: new Date().toISOString(),
      contentType,
      resolvedWorkingUrl,
      cachedPageId,
      cachedTitle,
      cachedSnippet,
      error: ok ? undefined : `HTTP ${res.status} ${res.statusText || ""}`.trim(),
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
  options: { cachePages?: boolean } = { cachePages: true },
): Promise<VerifiedSourceLink[]> {
  const uniqueUrls = Array.from(new Set(urls.filter((u) => Boolean(u && typeof u === "string"))));
  if (uniqueUrls.length === 0) return [];

  const results: VerifiedSourceLink[] = [];
  const queue = [...uniqueUrls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const verified = await testSourceLink(url, timeoutMs, { cachePage: options.cachePages !== false });
      results.push(verified);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
