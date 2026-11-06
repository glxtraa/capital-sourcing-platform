"use client";

import { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Clock,
  Layers,
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";

interface CachedPageModalProps {
  url?: string | null;
  id?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface CachedPageData {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  content: string;
  snippet: string | null;
  httpStatus: number;
  contentType: string | null;
  byteSize: number;
  fetchLatencyMs: number;
  cachedAt: string;
}

export function CachedPageModal({ url, id, isOpen, onClose }: CachedPageModalProps) {
  const [data, setData] = useState<CachedPageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || (!url && !id)) {
      setData(null);
      setError(null);
      return;
    }

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const query = id ? `id=${encodeURIComponent(id)}` : `url=${encodeURIComponent(url!)}`;
        const res = await fetch(`/api/research/cache?${query}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}: Failed to load cached snapshot`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err?.message || "Failed to load cached snapshot.");
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [isOpen, url, id]);

  if (!isOpen) return null;

  async function handleRefresh() {
    if (!url && !data?.url) return;
    setRefreshing(true);
    setError(null);
    try {
      const targetUrl = url || data?.url;
      const res = await fetch(`/api/research/cache?url=${encodeURIComponent(targetUrl!)}&refresh=true`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to refresh snapshot from live site.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleCopy() {
    if (!data?.content) return;
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeUrl = url || data?.url || "";
  let host = activeUrl;
  try {
    host = new URL(activeUrl).hostname.replace(/^www\./, "");
  } catch {}

  const formattedDate = data?.cachedAt
    ? new Date(data.cachedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  const sizeKb = data?.byteSize ? (data.byteSize / 1024).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div
        className="relative w-full max-w-3xl rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80">
          <div className="flex items-center gap-2.5 truncate pr-3">
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
              <FileText className="h-4 w-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>Cached Audit Snapshot</span>
                <span className="text-xs font-normal text-neutral-500 font-mono">({host})</span>
              </h3>
              <p className="text-[11px] text-neutral-500 truncate">{activeUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Open live URL in new tab"
              >
                <span>Live Site</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Audit Metadata Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-2 text-xs bg-neutral-50/40 dark:border-neutral-800/80 dark:bg-neutral-900/40">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">
            {data && (
              <>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold ${
                    data.httpStatus >= 200 && data.httpStatus < 300
                      ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  ✓ HTTP {data.httpStatus}
                </span>

                {formattedDate && (
                  <span className="inline-flex items-center gap-1 text-neutral-500 font-sans">
                    <Clock className="h-3 w-3" />
                    <span>Cached {formattedDate}</span>
                  </span>
                )}

                {sizeKb && <span className="text-neutral-400">· {sizeKb} KB</span>}
                {data.fetchLatencyMs > 0 && <span className="text-neutral-400">· {data.fetchLatencyMs}ms</span>}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!data?.content}
              className="h-7 text-xs gap-1 px-2.5"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy Snapshot"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="h-7 text-xs gap-1 px-2.5 text-neutral-600 dark:text-neutral-300"
              title="Re-crawl and update cached page snapshot"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              Re-crawl
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-600" />
              <p className="text-xs text-neutral-500">Retrieving verified page snapshot...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Failed to retrieve cached page</span>
              </div>
              <p>{error}</p>
              <Button type="button" size="sm" variant="outline" onClick={handleRefresh}>
                Retry Live Fetch
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-3.5">
              {/* Page Title */}
              {data.title && (
                <div>
                  <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {data.title}
                  </h4>
                </div>
              )}

              {/* Salient Snippet Preview Box */}
              {data.snippet && (
                <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 space-y-1">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block font-mono">
                    Audited Excerpt
                  </span>
                  <p className="leading-relaxed italic">&ldquo;{data.snippet}&rdquo;</p>
                </div>
              )}

              {/* Clean Readable Markdown Snapshot */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold block">
                  Complete Cached Page Body (Text Extract):
                </span>
                <pre className="rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-xs font-mono text-neutral-200 leading-relaxed overflow-x-auto whitespace-pre-wrap dark:border-neutral-800 max-h-[500px]">
                  {data.content}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
