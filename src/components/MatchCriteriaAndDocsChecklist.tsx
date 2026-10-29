"use client";

import { useState, type ReactNode } from "react";
import { Check, X, TriangleAlert, FileText, ExternalLink, ShieldCheck, Sparkles, BookOpen } from "lucide-react";
import type { FunderSideCriterionProvenance } from "@/dsl/provenance";
import { CriterionSourceInspectorModal } from "@/components/CriterionSourceInspectorModal";

export type CriterionStatus = "pass" | "fail" | "warning";

export interface CriterionItem {
  key: string;
  label: string;
  status: CriterionStatus;
  detail: string;
  funderSide?: FunderSideCriterionProvenance | null;
}

export interface DocumentCoverageItem {
  code: string;
  note?: string | null;
  satisfied: boolean;
  matchingFileNames: string[];
}

const CRITERION_ICON: Record<CriterionStatus, ReactNode> = {
  pass: <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-label="pass" />,
  fail: <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" aria-label="fail" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-label="warning" />,
};

export function MatchCriteriaAndDocsChecklist({
  criteria,
  documentsRequired = [],
  uploadedDocs = [],
  assetLabel = "funder",
  funderName = "Funder",
  defaultOpen = false,
}: {
  criteria: CriterionItem[];
  documentsRequired?: Array<{ code: string; note?: string | null }>;
  uploadedDocs?: Array<{ fileName: string; documentTypes: string[] }>;
  assetLabel?: string;
  funderName?: string;
  defaultOpen?: boolean;
}) {
  const [inspectingCriterion, setInspectingCriterion] = useState<CriterionItem | null>(null);

  // Compute document coverage dynamically
  const uploadedDocTypeMap = new Map<string, string[]>();
  for (const doc of uploadedDocs) {
    for (const code of doc.documentTypes || []) {
      const list = uploadedDocTypeMap.get(code) || [];
      list.push(doc.fileName);
      uploadedDocTypeMap.set(code, list);
    }
  }

  const coverageItems: DocumentCoverageItem[] = documentsRequired.map((req) => {
    const matchingFiles = uploadedDocTypeMap.get(req.code) || [];
    return {
      code: req.code,
      note: req.note ?? null,
      satisfied: matchingFiles.length > 0,
      matchingFileNames: matchingFiles,
    };
  });

  const missingDocCount = coverageItems.filter((d) => !d.satisfied).length;
  const failedCriteriaCount = criteria.filter((c) => c.status === "fail").length;

  return (
    <>
      <details
        open={defaultOpen}
        className="mt-3 group rounded-lg border border-neutral-200/80 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40 text-xs overflow-hidden transition-all"
      >
        <summary className="flex flex-wrap items-center justify-between px-3.5 py-2 cursor-pointer font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 select-none transition-colors">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[11px] text-neutral-800 dark:text-neutral-200">
              View match criteria &amp; document checklist
            </span>
            {failedCriteriaCount > 0 && (
              <span className="rounded-full bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 px-1.5 py-0.2 text-[10px] font-mono font-bold text-red-700 dark:text-red-300">
                {failedCriteriaCount} failed
              </span>
            )}
            {missingDocCount > 0 && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                {missingDocCount} doc{missingDocCount === 1 ? "" : "s"} needed
              </span>
            )}
          </div>
          <span className="text-[10px] text-neutral-400 group-open:hidden">Expand details ▾</span>
          <span className="text-[10px] text-neutral-400 hidden group-open:inline">Collapse ▴</span>
        </summary>

        <div className="p-3.5 border-t border-neutral-200/70 dark:border-neutral-800 space-y-4">
          {/* Table 1: Criteria Pass / Fail / Warning Matrix with Provenance Callouts */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[11px] uppercase tracking-wider text-neutral-500">
                Mandate &amp; Eligibility Criteria Evaluation ({criteria.length})
              </p>
              <span className="text-[10px] text-neutral-400 italic">
                Click any row or source badge to inspect verbatim quotes and live evidence
              </span>
            </div>

            <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="w-8 py-1.5 pl-3 pr-1 font-medium">Status</th>
                    <th className="py-1.5 pr-4 font-medium">Criterion</th>
                    <th className="py-1.5 pr-4 font-medium">Evaluation Decision</th>
                    <th className="py-1.5 pr-3 font-medium">Source Evidence &amp; Traceability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                  {criteria.map((c) => {
                    const fSide = c.funderSide;
                    const isDirectQuote = fSide?.acquisitionMethod === "VERIFIED_WEB_QUOTE" || fSide?.acquisitionMethod === "REGULATORY_FILING_QUOTE";
                    const isInference = fSide?.acquisitionMethod === "AGENT_INFERRED_FROM_SCOPE";

                    return (
                      <tr
                        key={c.key}
                        className="align-top hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 cursor-pointer transition-colors"
                        onClick={() => setInspectingCriterion(c)}
                      >
                        <td className="py-2.5 pl-3 pr-1">{CRITERION_ICON[c.status]}</td>
                        <td className="py-2.5 pr-4 font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap text-[11px]">
                          {c.label}
                        </td>
                        <td className="py-2.5 pr-4 text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
                          {c.detail}
                        </td>
                        <td className="py-2.5 pr-3 text-[11px]">
                          {fSide ? (
                            <div className="space-y-1">
                              {/* Acquisition Method Pill */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isDirectQuote ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.2 text-[10px] font-bold">
                                    <ShieldCheck className="h-2.5 w-2.5" /> Verified Quote
                                  </span>
                                ) : isInference ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-1.5 py-0.2 text-[10px] font-bold">
                                    <Sparkles className="h-2.5 w-2.5" /> AI Scope Inference
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 px-1.5 py-0.2 text-[10px] font-medium">
                                    {fSide.acquisitionMethod.replaceAll("_", " ")}
                                  </span>
                                )}

                                {fSide.sourceUrl && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium">
                                    Inspect Source <ExternalLink className="h-2.5 w-2.5" />
                                  </span>
                                )}
                              </div>

                              {/* Verbatim Quote Snippet (When Proven) */}
                              {fSide.verbatimQuote ? (
                                <p className="italic text-[10.5px] text-neutral-700 dark:text-neutral-300 bg-neutral-100/70 dark:bg-neutral-900/60 p-1.5 rounded border border-neutral-200/60 dark:border-neutral-800 font-serif leading-snug">
                                  “{fSide.verbatimQuote.length > 90 ? `${fSide.verbatimQuote.slice(0, 90)}…` : fSide.verbatimQuote}”
                                </p>
                              ) : (
                                <p className="text-[10px] text-neutral-400 italic">
                                  Evaluated from licensed operational scope &amp; ticket thresholds.
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">
                              Standard intake criteria check
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Required Documents Coverage Checklist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[11px] uppercase tracking-wider text-neutral-500">
                Documents Required for this {assetLabel.toUpperCase()} ({coverageItems.length})
              </p>
              {missingDocCount === 0 && coverageItems.length > 0 && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> All Required Documents Uploaded
                </span>
              )}
            </div>

            {coverageItems.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic">
                No specific document codes mandated beyond standard onboarding KYC.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="w-8 py-1.5 pl-3 pr-1 font-medium">Status</th>
                      <th className="py-1.5 pr-4 font-medium">Document Code</th>
                      <th className="py-1.5 pr-4 font-medium">Compliance Note</th>
                      <th className="py-1.5 pr-3 font-medium">Data Room Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                    {coverageItems.map((d) => (
                      <tr key={d.code} className="align-top hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                        <td className="py-2 pl-3 pr-1">
                          {d.satisfied ? CRITERION_ICON.pass : CRITERION_ICON.fail}
                        </td>
                        <td className="py-2 pr-4 font-mono font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap text-[11px]">
                          {d.code}
                        </td>
                        <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 text-[11px]">
                          {d.note ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-[11px]">
                          {d.satisfied ? (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <FileText className="h-3 w-3 shrink-0" />
                              Present: {d.matchingFileNames.join(", ")}
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Still needs to be added to Data Room
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </details>

      {/* Source & Quote Verification Modal */}
      {inspectingCriterion && (
        <CriterionSourceInspectorModal
          criterionLabel={inspectingCriterion.label}
          verdictStatus={inspectingCriterion.status}
          evaluationDetail={inspectingCriterion.detail}
          funderName={funderName}
          funderSide={inspectingCriterion.funderSide}
          onClose={() => setInspectingCriterion(null)}
        />
      )}
    </>
  );
}
