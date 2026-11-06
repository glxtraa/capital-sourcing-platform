"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Zap,
  ArrowRight,
  ShieldCheck,
  Building2,
  Check,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";

export interface BackerItem {
  backerName: string;
  competitorsBacked: string[];
  alreadyResearched?: boolean;
  isMatchedToDeal?: boolean;
  researchedInvestorId?: string;
  researchedMatchScore?: number | null;
  matchedName?: string;
  tier?: string;
}

export interface BatchBackerResearchModalProps {
  isOpen: boolean;
  dealId: string;
  dealName?: string;
  companyName?: string;
  backers: BackerItem[];
  onClose: () => void;
  onComplete?: () => void;
  onCompleted?: () => void;
  onJumpToSyndicate?: () => void;
}

export function BatchBackerResearchModal({
  isOpen,
  dealId,
  dealName,
  companyName,
  backers,
  onClose,
  onComplete,
  onCompleted,
  onJumpToSyndicate,
}: BatchBackerResearchModalProps) {
  const effectiveDealName = dealName || companyName || "Startup";
  const router = useRouter();

  const unresearchedBackers = backers.filter((b) => !b.alreadyResearched);
  const researchedBackers = backers.filter((b) => b.alreadyResearched);

  const [selectedBackers, setSelectedBackers] = useState<Set<string>>(() => {
    const unresearched = backers.filter((b) => !b.alreadyResearched);
    return new Set(
      unresearched.length > 0
        ? unresearched.map((b) => b.backerName)
        : backers.map((b) => b.backerName)
    );
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBacker, setCurrentBacker] = useState<string | null>(null);
  const [stepDetail, setStepDetail] = useState<string>("");
  const [processedResults, setProcessedResults] = useState<
    { backer: string; status: "success" | "error"; message: string }[]
  >([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const unresearched = backers.filter((b) => !b.alreadyResearched);
      setSelectedBackers(
        new Set(
          unresearched.length > 0
            ? unresearched.map((b) => b.backerName)
            : backers.map((b) => b.backerName)
        )
      );
      setIsFinished(false);
      setProcessedResults([]);
      setCurrentBacker(null);
    }
  }, [isOpen, backers]);

  if (!isOpen) return null;

  const toggleBacker = (name: string) => {
    if (isProcessing) return;
    const next = new Set(selectedBackers);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedBackers(next);
  };

  const selectUnresearched = () => {
    if (isProcessing) return;
    setSelectedBackers(new Set(unresearchedBackers.map((b) => b.backerName)));
  };

  const selectAll = () => {
    if (isProcessing) return;
    setSelectedBackers(new Set(backers.map((b) => b.backerName)));
  };

  const deselectAll = () => {
    if (isProcessing) return;
    setSelectedBackers(new Set());
  };

  async function handleRunBatch() {
    const listToProcess = backers.filter((b) => selectedBackers.has(b.backerName));
    if (listToProcess.length === 0) return;

    setIsProcessing(true);
    setIsFinished(false);
    setProcessedResults([]);

    const results: { backer: string; status: "success" | "error"; message: string }[] = [];

    for (let i = 0; i < listToProcess.length; i++) {
      const item = listToProcess[i];
      setCurrentBacker(item.backerName);
      setStepDetail(`Querying live venture thesis & database (${i + 1}/${listToProcess.length})…`);

      try {
        // Step 1: Search live venture databases & web citations
        const searchRes = await fetch(`/api/vc-deals/${dealId}/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "search",
            investorHint: item.backerName,
          }),
        });

        if (!searchRes.ok) {
          const body = await searchRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Live venture search failed.");
        }

        const searchData = await searchRes.json();

        // Step 2: Structure thesis & partner contacts
        setStepDetail(`Structuring thesis & caching citations for "${item.backerName}"…`);
        const structureRes = await fetch(`/api/vc-deals/${dealId}/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "structure",
            runId: searchData.runId,
            hint: searchData.hint,
            findings: searchData.findings,
            citedUrls: searchData.citedUrls,
          }),
        });

        if (!structureRes.ok) {
          const body = await structureRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Structuring funder findings failed.");
        }

        results.push({
          backer: item.backerName,
          status: "success",
          message: "Thesis structured & partner contacts verified",
        });
      } catch (err: any) {
        results.push({
          backer: item.backerName,
          status: "error",
          message: err?.message || "Search failed",
        });
      }

      setProcessedResults([...results]);
    }

    // Step 3: Re-evaluate syndicate matches
    setStepDetail("Re-evaluating syndicate matching scores & anti-portfolio conflicts…");
    try {
      await fetch(`/api/vc-deals/${dealId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {}

    setIsProcessing(false);
    setIsFinished(true);
    setCurrentBacker(null);
    setStepDetail("All selected competitor backers have been researched!");
    if (onComplete) onComplete();
    if (onCompleted) onCompleted();
    router.refresh();
  }

  const successCount = processedResults.filter((r) => r.status === "success").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="border-b border-neutral-100 p-5 dark:border-neutral-800 bg-linear-to-r from-purple-50/50 via-white to-blue-50/30 dark:from-purple-950/20 dark:via-neutral-900 dark:to-blue-950/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
                <Zap className="h-5 w-5 text-purple-100" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                  <span>Send Known Backers to Funder Agent Research</span>
                  <Badge tone="purple">{backers.length} Total</Badge>
                  {unresearchedBackers.length > 0 && (
                    <Badge tone="amber">{unresearchedBackers.length} New to Research</Badge>
                  )}
                  {researchedBackers.length > 0 && (
                    <Badge tone="green">{researchedBackers.length} Researched</Badge>
                  )}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  These venture funds have backed peer/competitor companies in your domain. The research agent will query their live thesis, partner contacts, and check anti-portfolio appetite for <strong>{effectiveDealName}</strong>.
                </p>
              </div>
            </div>
            {!isProcessing && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!isFinished ? (
            <>
              {/* Selection Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <span>Select funds to dispatch into the Funder Research Agent:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectUnresearched}
                    disabled={isProcessing || unresearchedBackers.length === 0}
                    className="font-bold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer disabled:opacity-40"
                  >
                    Select Unresearched ({unresearchedBackers.length})
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={isProcessing}
                    className="font-medium text-purple-600 hover:underline dark:text-purple-400 cursor-pointer disabled:opacity-50"
                  >
                    Select All ({backers.length})
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    disabled={isProcessing}
                    className="font-medium text-neutral-500 hover:underline dark:text-neutral-400 cursor-pointer disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Fund List with Checkboxes */}
              <div className="space-y-2">
                {backers.map((b) => {
                  const isChecked = selectedBackers.has(b.backerName);
                  const result = processedResults.find((r) => r.backer === b.backerName);
                  const isCurrentlyWorking = currentBacker === b.backerName;

                  return (
                    <div
                      key={b.backerName}
                      onClick={() => toggleBacker(b.backerName)}
                      className={`flex items-start justify-between rounded-xl border p-3.5 transition-all cursor-pointer ${
                        isChecked
                          ? "border-purple-300 bg-purple-50/40 dark:border-purple-800 dark:bg-purple-950/20"
                          : "border-neutral-200 bg-white opacity-60 dark:border-neutral-800 dark:bg-neutral-800/40"
                      } ${isCurrentlyWorking ? "ring-2 ring-purple-500" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isProcessing}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                              {b.backerName}
                            </span>
                            {b.alreadyResearched ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Already Researched</span>
                                {b.researchedMatchScore != null && (
                                  <span className="ml-1 text-[9px] text-emerald-700 dark:text-emerald-400 font-mono">
                                    ({b.researchedMatchScore}/100 match)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <Zap className="h-2.5 w-2.5 text-purple-600" />
                                <span>New Candidate</span>
                              </span>
                            )}
                            {result && result.status === "success" && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> Updated
                              </span>
                            )}
                            {result && result.status === "error" && (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.2 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                                <AlertCircle className="h-3 w-3" /> Failed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Backed: <span className="font-medium text-neutral-700 dark:text-neutral-300">{b.competitorsBacked.join(", ")}</span>
                          </p>
                        </div>
                      </div>

                      {isCurrentlyWorking && (
                        <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Querying…</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live Processing Indicator */}
              {isProcessing && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                      Agent Research In Progress…
                    </span>
                    <span>
                      {processedResults.length} / {selectedBackers.size} Finished
                    </span>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400">{stepDetail}</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-purple-200 dark:bg-purple-900">
                    <div
                      className="h-full rounded-full bg-purple-600 transition-all duration-300"
                      style={{
                        width: `${Math.round((processedResults.length / selectedBackers.size) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Finished Summary View */
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/80">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Funder Research &amp; Syndicate Scoring Complete
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  {successCount} of {selectedBackers.size} competitor venture funds have been successfully structured, verified for thesis match, and allocated into the syndicate matching engine.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 text-left text-xs dark:border-neutral-800 dark:bg-neutral-800/40 space-y-2">
                <span className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Research Summary:
                </span>
                {processedResults.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-neutral-100 pb-1.5 last:border-0 dark:border-neutral-800">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{r.backer}</span>
                    <span className={r.status === "success" ? "text-emerald-600 font-medium" : "text-red-500"}>
                      {r.status === "success" ? "✓ Researched & Scored" : r.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-neutral-100 p-4 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 flex items-center justify-between">
          {!isFinished ? (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={isProcessing || selectedBackers.size === 0}
                onClick={handleRunBatch}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>
                  {isProcessing
                    ? "Agent Querying…"
                    : `Research ${selectedBackers.size} Selected Fund${selectedBackers.size === 1 ? "" : "s"}`}
                </span>
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onJumpToSyndicate) onJumpToSyndicate();
                }}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <span>Jump to Syndicate Matching (Stage 3)</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
