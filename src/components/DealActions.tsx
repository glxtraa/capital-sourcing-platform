"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { FileText, Search, Calculator, Zap, Loader2, CheckCircle2, Play } from "lucide-react";
import type { DealStatus } from "@prisma/client";

const MAX_AUTO_RESEARCH_ATTEMPTS = 3;

export function DealActions({
  dealId,
  status,
  hasMatches,
  hasDocs = true,
  hasExtracted = false,
  hasBenchmark = false,
}: {
  dealId: string;
  status: DealStatus;
  hasMatches: boolean;
  hasDocs?: boolean;
  hasExtracted?: boolean;
  hasBenchmark?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"extract" | "match" | "benchmark" | "full" | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Determine which step is the recommended next step
  const nextStep: "extract" | "match" | "benchmark" | "complete" = !hasExtracted && status === "UPLOADING"
    ? "extract"
    : !hasMatches
      ? "match"
      : !hasBenchmark
        ? "benchmark"
        : "complete";

  async function executeExtract(skipRefresh = false) {
    const dealRes = await fetch(`/api/deals/${dealId}`);
    if (!dealRes.ok) throw new Error("Failed to load this deal's documents.");
    const deal = await dealRes.json();
    const documents: { id: string; fileName: string; extractedFieldsRaw: unknown; documentTypes: string[] }[] =
      deal.documents ?? [];
    if (documents.length === 0) throw new Error("No documents uploaded yet.");

    const unextractedDocs = documents.filter((d) => d.extractedFieldsRaw == null || d.documentTypes.length === 0);
    const docsToExtract = unextractedDocs.length > 0 ? unextractedDocs : documents;
    const isRerun = unextractedDocs.length === 0;

    for (let i = 0; i < docsToExtract.length; i++) {
      setProgressLabel(
        `${isRerun ? "Re-extracting" : "Extracting"} ${docsToExtract[i].fileName} (${i + 1}/${docsToExtract.length})…`,
      );
      const res = await fetch(`/api/deals/${dealId}/documents/${docsToExtract[i].id}/extract`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Extraction failed for ${docsToExtract[i].fileName}.`);
      }
    }

    setProgressLabel("Finalizing & merging deal spec…");
    const finalizeRes = await fetch(`/api/deals/${dealId}/extract`, { method: "POST" });
    if (!finalizeRes.ok) {
      const body = await finalizeRes.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to finalize the deal spec.");
    }
    if (!skipRefresh) router.refresh();
  }

  async function runExtract() {
    setPending("extract");
    setError(null);
    try {
      await executeExtract(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

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
    setProgressLabel("Matching against the provider database…");
    let { eligibleCount } = await postJson<{ eligibleCount: number }>(
      `/api/deals/${dealId}/match`,
      undefined,
      "Failed to run matching.",
    );

    let lastResearchError: string | null = null;
    for (let attempt = 1; eligibleCount === 0 && attempt <= MAX_AUTO_RESEARCH_ATTEMPTS; attempt++) {
      try {
        setProgressLabel(`No eligible providers — researching a new one (${attempt}/${MAX_AUTO_RESEARCH_ATTEMPTS}): searching the web…`);
        const found = await postJson<{ runId: string; hint: string; findings: string; citedUrls: string[] }>(
          `/api/deals/${dealId}/research`,
          { step: "search" },
          "Provider research failed.",
        );
        setProgressLabel(`No eligible providers — researching a new one (${attempt}/${MAX_AUTO_RESEARCH_ATTEMPTS}): recording findings…`);
        await postJson(`/api/deals/${dealId}/research`, { step: "structure", ...found }, "Provider research failed.");
      } catch (e) {
        lastResearchError = e instanceof Error ? e.message : String(e);
      }
      setProgressLabel("Re-matching with the updated provider database…");
      ({ eligibleCount } = await postJson<{ eligibleCount: number }>(
        `/api/deals/${dealId}/match`,
        undefined,
        "Failed to run matching.",
      ));
    }

    if (eligibleCount === 0) {
      setNotice(
        "No provider is eligible on paper for this deal" +
          (lastResearchError ? ` (last automatic research attempt failed: ${lastResearchError})` : " even after automatic research") +
          ". Review the criteria in the match list below, or check the agent run log.",
      );
    }
    if (!skipRefresh) router.refresh();
  }

  async function runMatch() {
    setPending("match");
    setError(null);
    setNotice(null);
    try {
      await executeMatch(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function executeBenchmark(skipRefresh = false) {
    setProgressLabel("Generating lender benchmark term sheet…");
    const res = await fetch(`/api/deals/${dealId}/benchmark`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to run the lender benchmark.");
    }
    if (!skipRefresh) router.refresh();
  }

  async function runBenchmark() {
    setPending("benchmark");
    setError(null);
    try {
      await executeBenchmark(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function runFullPipeline() {
    setPending("full");
    setError(null);
    setNotice(null);
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
        {/* Step 1-2: Extract & Reconcile (M2 -> M3) */}
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
          title="Stage 1-2 (M2 → M3): Extract uploaded invoices and reconcile counterparty deal spec"
        >
          {pending === "extract" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>1. Extract &amp; Spec</span>
          <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1 py-0.2 font-mono text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
            S1·M2-M3
          </span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 3: Provider Matching (M5) */}
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
          title="Stage 3 (M5): Run deterministic lender cascade & autonomous web research"
        >
          {pending === "match" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          )}
          <span>{hasMatches ? "2. Re-Match" : "2. Match Providers"}</span>
          <span className="rounded bg-purple-100 dark:bg-purple-950 px-1 py-0.2 font-mono text-[9px] font-bold text-purple-800 dark:text-purple-300">
            S3·M5
          </span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 4: Lender Benchmark (M6) */}
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
          title={!hasMatches ? "Run matching (M5) first" : "Stage 4 (M6): Generate advance rate & pricing term sheet benchmark"}
        >
          {pending === "benchmark" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calculator className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          )}
          <span>3. Benchmark Terms</span>
          <span className="rounded bg-indigo-100 dark:bg-indigo-950 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-800 dark:text-indigo-300">
            S4·M6
          </span>
          {nextStep === "benchmark" && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold uppercase">
              ⏳ Next
            </span>
          )}
        </Button>

        {/* Smart 1-Click Auto-Advance / Full Pipeline */}
        {nextStep !== "complete" && (
          <Button
            variant="default"
            size="sm"
            onClick={runFullPipeline}
            disabled={pending !== null}
            className="text-xs gap-1.5 h-8 bg-[#1a1f3a] hover:bg-[#252c50] text-[#10b981] border border-[#10b981]/40 shadow-xs ml-1"
            title="Automatically run all remaining uncompleted pipeline stages end-to-end"
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
        <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 animate-pulse">{progressLabel}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>}
    </div>
  );
}
