"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2, Globe } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui/primitives";

interface VcInvestorReconControlsProps {
  investors: Array<{
    id: string;
    name: string;
    type: string;
    confidence: string;
    lastVerified?: string | Date | null;
  }>;
}

export function VcInvestorReconControls({ investors }: VcInvestorReconControlsProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAllSelected = selectedIds.length === investors.length && investors.length > 0;

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(investors.map((inv) => inv.id));
    }
  }

  function toggleInvestor(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleRunResearch(targetIds?: string[]) {
    const idsToRun = targetIds ?? (selectedIds.length > 0 ? selectedIds : undefined);
    setIsRunning(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/vc-investors/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorIds: idsToRun }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger VC investor research");

      setStatusMessage({
        type: "success",
        text: `Successfully re-researched ${data.updatedCount} investor(s). Page snapshots, partner links, and live verification updated.`,
      });
      router.refresh();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Error running VC investor research.",
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card className="border-violet-200 dark:border-violet-900/60 bg-violet-50/30 dark:bg-violet-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Autonomous VC Thesis &amp; Investor Recon
              </span>
              <span className="rounded bg-violet-200/70 dark:bg-violet-900/60 px-1.5 py-0.2 text-[10px] font-bold text-violet-900 dark:text-violet-200">
                Live Spider &amp; Cache Engine
              </span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Trigger background web spiders to re-crawl VC portfolio websites, verify partner links, and refresh immutable thesis snapshots.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleRunResearch(selectedIds)}
                disabled={isRunning}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 text-xs font-semibold shadow-xs"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Re-researching ({selectedIds.length})…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-research Selected ({selectedIds.length})
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRunResearch(undefined)}
              disabled={isRunning}
              className="gap-1.5 text-xs font-semibold border-violet-300 dark:border-violet-800 text-violet-900 dark:text-violet-200 hover:bg-violet-100/60"
            >
              {isRunning && selectedIds.length === 0 ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Refreshing All Investors…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-research All ({investors.length})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Selection bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-violet-200/60 dark:border-violet-900/40 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="font-semibold text-violet-800 dark:text-violet-300 hover:underline select-none"
            >
              {isAllSelected ? "Deselect All" : "Select All Investors"}
            </button>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {selectedIds.length} of {investors.length} investor(s) selected
            </span>
          </div>

          {/* Quick checkbox pill row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {investors.map((inv) => {
              const isChecked = selectedIds.includes(inv.id);
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => toggleInvestor(inv.id)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium border transition-colors select-none ${
                    isChecked
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="h-3 w-3 rounded text-violet-600 pointer-events-none"
                  />
                  <span className="truncate max-w-[120px]">{inv.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                : "bg-red-100 text-red-900 dark:bg-red-950/80 dark:text-red-200 border border-red-300 dark:border-red-800"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
