"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { FileText, Layers, Search, Calculator, Zap, Loader2 } from "lucide-react";

export function TradeDealActions({
  dealId,
  hasMatches,
  hasReconciled = false,
  hasBenchmark = false,
}: {
  dealId: string;
  hasMatches: boolean;
  hasReconciled?: boolean;
  hasBenchmark?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"extract" | "reconcile" | "match" | "benchmark" | "full" | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextStep: "extract" | "reconcile" | "match" | "benchmark" | "complete" = !hasReconciled
    ? "extract"
    : !hasMatches
      ? "match"
      : !hasBenchmark
        ? "benchmark"
        : "complete";

  async function executeExtract(skipRefresh = false) {
    const dealRes = await fetch(`/api/trade-deals/${dealId}`);
    if (!dealRes.ok) throw new Error("Failed to load this deal's documents.");
    const deal = await dealRes.json();
    const documents: { id: string; fileName: string; extractedRaw: unknown }[] =
      deal.documents ?? [];
    if (documents.length === 0) throw new Error("No trade documents uploaded yet.");

    const unextractedDocs = documents.filter((d) => d.extractedRaw == null);
    const docsToExtract = unextractedDocs.length > 0 ? unextractedDocs : documents;
    const isRerun = unextractedDocs.length === 0;

    const failedFiles: { file: string; reason: string }[] = [];
    let successCount = 0;

    for (let i = 0; i < docsToExtract.length; i++) {
      setProgressLabel(
        `${isRerun ? "Re-extracting" : "Extracting"} ${docsToExtract[i].fileName} (${i + 1}/${docsToExtract.length})…`,
      );
      try {
        const res = await fetch(`/api/trade-deals/${dealId}/documents/${docsToExtract[i].id}/extract`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          failedFiles.push({
            file: docsToExtract[i].fileName,
            reason: body.error ?? `HTTP ${res.status}`,
          });
        } else {
          successCount++;
        }
      } catch (err) {
        failedFiles.push({
          file: docsToExtract[i].fileName,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (successCount > 0) {
      setProgressLabel("Reconciling paired contracts & margin…");
      const reconcileRes = await fetch(`/api/trade-deals/${dealId}/reconcile`, { method: "POST" });
      if (!reconcileRes.ok) {
        const body = await reconcileRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reconcile contracts after extraction.");
      }
    }

    if (failedFiles.length > 0) {
      setError(
        `Extracted ${successCount} document${successCount === 1 ? "" : "s"}. ${failedFiles.length} document${failedFiles.length === 1 ? "" : "s"} failed: ${failedFiles.map((f) => `${f.file} (${f.reason})`).join(", ")}`,
      );
    }

    if (!skipRefresh) router.refresh();
  }

  async function runExtract() {
    setPending("extract");
    setError(null);
    try {
      await executeExtract(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function runReconcile() {
    setPending("reconcile");
    setError(null);
    try {
      setProgressLabel("Reconciling supply & offtake legs…");
      const res = await fetch(`/api/trade-deals/${dealId}/reconcile`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reconcile trade deal.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconciliation failed.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  const MAX_AUTO_RESEARCH_ATTEMPTS = 3;

  async function postJson<T>(url: string, body?: unknown, fallbackError = "Request failed."): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? fallbackError);
    return data as T;
  }

  async function executeMatch(skipRefresh = false) {
    setProgressLabel("Matching against the trade funder database…");
    const initial = await postJson<{ eligibleCount?: number; umbrellaCount?: number }>(
      `/api/trade-deals/${dealId}/match`,
      undefined,
      "Failed to run matching.",
    );

    let eligibleCount = initial.eligibleCount ?? 0;
    let lastResearchError: string | null = null;

    for (let attempt = 1; eligibleCount === 0 && attempt <= MAX_AUTO_RESEARCH_ATTEMPTS; attempt++) {
      try {
        setProgressLabel(
          `No matching funders — autonomous research (${attempt}/${MAX_AUTO_RESEARCH_ATTEMPTS}): searching global trade desks…`,
        );
        const found = await postJson<{ runId: string; hint: string; findings: string; citedUrls: string[] }>(
          `/api/trade-deals/${dealId}/research`,
          { step: "search" },
          "Trade funder web research failed.",
        );

        setProgressLabel(
          `No matching funders — autonomous research (${attempt}/${MAX_AUTO_RESEARCH_ATTEMPTS}): structuring funder appetite…`,
        );
        await postJson(`/api/trade-deals/${dealId}/research`, { step: "structure", ...found }, "Trade funder structuring failed.");
      } catch (e) {
        lastResearchError = e instanceof Error ? e.message : String(e);
      }

      setProgressLabel("Re-evaluating matches against expanded funder catalog…");
      const next = await postJson<{ eligibleCount?: number }>(
        `/api/trade-deals/${dealId}/match`,
        undefined,
        "Failed to run matching.",
      );
      eligibleCount = next.eligibleCount ?? 0;
    }

    if (eligibleCount === 0 && lastResearchError) {
      setError(`Automatic research attempted but encountered: ${lastResearchError}`);
    }

    if (!skipRefresh) router.refresh();
  }

  async function runMatch() {
    setPending("match");
    setError(null);
    try {
      await executeMatch(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matching failed.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function executeBenchmark(skipRefresh = false) {
    setProgressLabel("Generating blended SOFR facility term sheet…");
    const res = await fetch(`/api/trade-deals/${dealId}/benchmark`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to benchmark term sheet.");
    }
    if (!skipRefresh) router.refresh();
  }

  async function runBenchmark() {
    setPending("benchmark");
    setError(null);
    try {
      await executeBenchmark(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Benchmarking failed.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function runFullPipeline() {
    setPending("full");
    setError(null);
    try {
      if (nextStep === "extract") {
        await executeExtract(true);
      }
      if (nextStep === "extract" || nextStep === "match") {
        await executeMatch(true);
      }
      await executeBenchmark(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Full pipeline interrupted.");
      router.refresh();
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Step 1: Extract Cargo Docs (S1·M2) */}
        <Button
          variant={nextStep === "extract" ? "default" : "outline"}
          size="sm"
          onClick={runExtract}
          disabled={pending !== null}
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "extract"
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-2 ring-amber-400/50"
              : "border-emerald-300/80 dark:border-emerald-800/70"
          }`}
          title="Stage 1 (M2): Extract OCR & assay parameters from trade documents"
        >
          {pending === "extract" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>1. Extract Docs</span>
          <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1 py-0.2 font-mono text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
            S1·M2
          </span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 2: Reconcile Contracts (S2·M3) */}
        <Button
          variant="outline"
          size="sm"
          onClick={runReconcile}
          disabled={pending !== null}
          className="text-xs gap-1.5 h-8 border-blue-300/80 dark:border-blue-800/70"
          title="Stage 2 (M3-M4): Reconcile bilateral supply & offtake contract legs and verify maritime gates"
        >
          {pending === "reconcile" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          )}
          <span>2. Reconcile Legs</span>
          <span className="rounded bg-blue-100 dark:bg-blue-950 px-1 py-0.2 font-mono text-[9px] font-bold text-blue-800 dark:text-blue-300">
            S2·M3
          </span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 3: Match Funders (S3·M5) */}
        <Button
          variant={nextStep === "match" ? "default" : "outline"}
          size="sm"
          onClick={runMatch}
          disabled={pending !== null}
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "match"
              ? "bg-purple-600 hover:bg-purple-700 text-white shadow-xs ring-2 ring-purple-400/50"
              : "border-purple-300/80 dark:border-purple-800/70"
          }`}
          title="Stage 3 (M5): Match against commodity trade desks & run autonomous web research"
        >
          {pending === "match" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          )}
          <span>{hasMatches ? "3. Re-Match" : "3. Match Funders"}</span>
          <span className="rounded bg-purple-100 dark:bg-purple-950 px-1 py-0.2 font-mono text-[9px] font-bold text-purple-800 dark:text-purple-300">
            S3·M5
          </span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 4: Term Sheet Benchmark (S4·M6) */}
        <Button
          variant={nextStep === "benchmark" ? "default" : "outline"}
          size="sm"
          onClick={runBenchmark}
          disabled={!hasMatches || pending !== null}
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "benchmark"
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-2 ring-amber-400/50"
              : "border-indigo-300/80 dark:border-indigo-800/70"
          }`}
          title="Stage 4 (M6): Generate blended SOFR facility term sheet benchmark"
        >
          {pending === "benchmark" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calculator className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          )}
          <span>4. Benchmark Facility</span>
          <span className="rounded bg-indigo-100 dark:bg-indigo-950 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-800 dark:text-indigo-300">
            S4·M6
          </span>
          {nextStep === "benchmark" && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold uppercase">
              ⏳ Next
            </span>
          )}
        </Button>

        {nextStep !== "complete" && (
          <Button
            variant="default"
            size="sm"
            onClick={runFullPipeline}
            disabled={pending !== null}
            className="text-xs gap-1.5 h-8 bg-[#1a1f3a] hover:bg-[#252c50] text-[#10b981] border border-[#10b981]/40 shadow-xs ml-1"
            title="Run all remaining uncompleted trade finance pipeline stages end-to-end"
          >
            {pending === "full" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#10b981]" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-[#ff6b4a]" />
            )}
            <span>{pending === "full" ? (progressLabel ?? "Running Pipeline…") : "Run Remaining Pipeline"}</span>
          </Button>
        )}
      </div>
      {pending && pending !== "full" && progressLabel && (
        <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400 animate-pulse">{progressLabel}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
