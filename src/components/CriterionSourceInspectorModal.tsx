"use client";

import { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  Quote,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Sparkles,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import type { CriterionAcquisitionMethod, FunderSideCriterionProvenance } from "@/dsl/provenance";

export interface CriterionSourceInspectorModalProps {
  criterionLabel: string;
  verdictStatus: "pass" | "fail" | "warning";
  evaluationDetail: string;
  funderName: string;
  funderSide?: FunderSideCriterionProvenance | null;
  onClose: () => void;
}

const METHOD_CONFIG: Record<
  CriterionAcquisitionMethod,
  { label: string; badgeClass: string; isDirectProof: boolean; description: string }
> = {
  VERIFIED_WEB_QUOTE: {
    label: "Direct Verified Quote",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    isDirectProof: true,
    description: "Verbatim text copied directly from funder's official website, product sheet, or published policy document.",
  },
  REGULATORY_FILING_QUOTE: {
    label: "Regulatory Filing Disclosure",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800",
    isDirectProof: true,
    description: "Direct excerpt from official regulatory filing (e.g. MAS, OJK, SEC, Central Bank disclosure).",
  },
  SCRAPED_APPLICATION_FORM: {
    label: "Application Portal Field",
    badgeClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800",
    isDirectProof: true,
    description: "Extracted directly from structured fields, dropdown options, or inputs on the funder's intake form.",
  },
  AGENT_INFERRED_FROM_SCOPE: {
    label: "AI Inference from Scope",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-bold",
    isDirectProof: false,
    description: "NOT a verbatim quote. Deduced by underwriting AI based on the funder's licensed product capabilities and ticket limits.",
  },
  UNPUBLISHED_DESK_ESTIMATE: {
    label: "Unpublished Desk Estimate",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    isDirectProof: false,
    description: "Standard institutional credit desk rule modeled from industry norms, not published on retail webpages.",
  },
  HUMAN_OPERATOR_OVERRIDE: {
    label: "Operator Override",
    badgeClass: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700",
    isDirectProof: true,
    description: "Manually entered or adjusted by a human credit analyst in the capital sourcing platform.",
  },
};

export function CriterionSourceInspectorModal({
  criterionLabel,
  verdictStatus,
  evaluationDetail,
  funderName,
  funderSide,
  onClose,
}: CriterionSourceInspectorModalProps) {
  const method = funderSide?.acquisitionMethod || "AGENT_INFERRED_FROM_SCOPE";
  const cfg = METHOD_CONFIG[method] || METHOD_CONFIG.AGENT_INFERRED_FROM_SCOPE;

  const [cachedContent, setCachedContent] = useState<string | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);

  useEffect(() => {
    if (!funderSide?.sourceUrl) return;

    let isMounted = true;
    setLoadingCache(true);
    setCacheError(null);

    fetch(`/api/research/cache?url=${encodeURIComponent(funderSide.sourceUrl)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setCachedContent(data.markdownText || data.rawText || funderSide.surroundingContext || null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setCacheError("Live cached snapshot unavailable; displaying captured context snippet.");
          setCachedContent(funderSide.surroundingContext || null);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingCache(false);
      });

    return () => {
      isMounted = false;
    };
  }, [funderSide?.sourceUrl, funderSide?.surroundingContext]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Criterion Traceability &amp; Source Verification
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold border uppercase tracking-wide ${
                  verdictStatus === "pass"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : verdictStatus === "fail"
                    ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300"
                    : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                }`}
              >
                {verdictStatus}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              {funderName} · Criterion: <strong className="text-neutral-800 dark:text-neutral-200">{criterionLabel}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-neutral-700 dark:text-neutral-300">
          {/* Method Alert Box */}
          <div
            className={`rounded-xl border p-4 ${
              cfg.isDirectProof
                ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                : "bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {cfg.isDirectProof ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      Provenance: {cfg.label}
                    </span>
                    {!cfg.isDirectProof && (
                      <span className="rounded bg-purple-200 dark:bg-purple-900 px-1.5 py-0.2 text-[10px] font-bold text-purple-900 dark:text-purple-200">
                        AI INFERENCE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {cfg.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rule Evaluation Summary */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50/50 dark:bg-neutral-950/40 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              System Evaluation Decision
            </p>
            <p className="text-xs leading-relaxed font-medium text-neutral-800 dark:text-neutral-200">
              {evaluationDetail}
            </p>
            {funderSide?.ruleSummary && (
              <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Mandate Rule Parameter:</span>
                <span className="font-mono bg-neutral-200/70 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                  {funderSide.ruleSummary}
                </span>
              </div>
            )}
          </div>

          {/* Direct Verbatim Quote (Prioritized When Proven) */}
          {funderSide?.verbatimQuote ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] uppercase tracking-wider">
                <Quote className="h-4 w-4 shrink-0" />
                Verified Verbatim Quote from Official Source
              </div>
              <blockquote className="border-l-4 border-emerald-500 pl-3 py-1 italic font-serif text-[13px] text-neutral-900 dark:text-neutral-100 bg-white/60 dark:bg-neutral-900/60 rounded-r-md">
                “{funderSide.verbatimQuote}”
              </blockquote>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-[11px] uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No Direct Verbatim Quote Published on Public Marketing Webpage
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                The funder does not publish an explicit textual exclusion or criteria sentence for this condition.
                This decision is derived strictly from the funder&apos;s licensed business scope, maximum ticket thresholds, and accepted corporate domiciles.
              </p>
            </div>
          )}

          {/* Acquisition Explanation */}
          {funderSide?.howObtainedExplanation && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                How Was This Obtained / Researched?
              </p>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {funderSide.howObtainedExplanation}
              </p>
            </div>
          )}

          {/* Official Source Link & Cached Webpage Text */}
          <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Source Document / Portal Link
              </span>
              {funderSide?.sourceUrl && (
                <a
                  href={funderSide.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Open Live Source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {funderSide?.sourceUrl ? (
              <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-800/40 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 truncate">
                {funderSide.sourceUrl}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400 italic">
                Direct URL reference not recorded. Funder ingested from internal credit desk registry.
              </p>
            )}

            {/* Cached Snapshot Text */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <FileSearch className="h-3.5 w-3.5" /> Crawled Context Snapshot
                </span>
                {loadingCache && (
                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Fetching cache...
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed select-text">
                {cachedContent || (
                  <span className="text-neutral-400 italic font-sans">
                    {cacheError || "No snapshot stored in database for this source."}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-3.5 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <span className="text-[11px] text-neutral-500">
            TR3 Capital Sourcing Traceability Engine · Multi-Asset Parity
          </span>
          <Button variant="outline" onClick={onClose} className="text-xs">
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  );
}
