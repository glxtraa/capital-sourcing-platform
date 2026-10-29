"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import {
  RefreshCw,
  Sparkles,
  Scale,
  Search,
  Loader2,
  CheckCircle2,
  FileText,
  Compass,
  Zap,
} from "lucide-react";

export function VcDealActions({
  dealId,
  hasMatches,
  hasExtracted = false,
  hasIntel = false,
  hasBenchmark = false,
}: {
  dealId: string;
  hasMatches: boolean;
  hasExtracted?: boolean;
  hasIntel?: boolean;
  hasBenchmark?: boolean;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextStep: "extract" | "intel" | "match" | "benchmark" | "complete" = !hasExtracted
    ? "extract"
    : !hasIntel
      ? "intel"
      : !hasMatches
        ? "match"
        : !hasBenchmark
          ? "benchmark"
          : "complete";

  async function executeExtract(skipRefresh = false) {
    setProgressLabel("Loading startup data room documents…");
    const dealRes = await fetch(`/api/vc-deals/${dealId}`);
    if (!dealRes.ok) throw new Error("Failed to load startup deal documents.");
    const deal = await dealRes.json();
    const documents: { id: string; fileName: string; extractedRaw: unknown }[] = deal.documents ?? [];

    if (documents.length > 0) {
      const unextracted = documents.filter((d) => d.extractedRaw == null);
      const docsToRun = unextracted.length > 0 ? unextracted : documents;
      for (let i = 0; i < docsToRun.length; i++) {
        setProgressLabel(`Extracting ${docsToRun[i].fileName} (${i + 1}/${docsToRun.length})…`);
        const res = await fetch(`/api/vc-deals/${dealId}/documents/${docsToRun[i].id}/extract`, {
          method: "POST",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed to extract ${docsToRun[i].fileName}`);
        }
      }
    }

    setProgressLabel("Reconciling Deal Spec & Cap Table (M3)…");
    const recRes = await fetch(`/api/vc-deals/${dealId}/reconcile`, { method: "POST" });
    if (!recRes.ok) {
      const err = await recRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to reconcile startup Deal Spec");
    }

    if (!skipRefresh) router.refresh();
  }

  async function executeMarketIntel(skipRefresh = false) {
    setProgressLabel("M5: Mapping competitors & anti-portfolio rivals (光 Hikari)…");
    const compRes = await fetch(`/api/vc-deals/${dealId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!compRes.ok) {
      const err = await compRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to run Hikari Competitor Discovery");
    }

    setProgressLabel("M6: Generating target ICP enterprise accounts (疾風 Hayate)…");
    const commRes = await fetch(`/api/vc-deals/${dealId}/commercial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!commRes.ok) {
      const err = await commRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to run Hayate Commercial ICP Discovery");
    }

    setProgressLabel("M7: Extracting executive buyer persona contacts…");
    const contactRes = await fetch(`/api/vc-deals/${dealId}/commercial/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!contactRes.ok) {
      const err = await contactRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to extract decision-maker contacts");
    }

    if (!skipRefresh) router.refresh();
  }

  async function executeMatch(skipRefresh = false) {
    setProgressLabel("M8: Matching Lead, Syndicate & Angel investors (大輝 Daiki)…");
    const res = await fetch(`/api/vc-deals/${dealId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to run Syndicate Match");
    }
    if (!skipRefresh) router.refresh();
  }

  async function executeBenchmark(skipRefresh = false) {
    setProgressLabel("M9: Modeling Pro-Forma SAFE Dilution & Valuation Cap Terms…");
    const res = await fetch(`/api/vc-deals/${dealId}/benchmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to run Benchmark Terms");
    }
    if (!skipRefresh) router.refresh();
  }

  async function runStep(stepKey: string, fn: () => Promise<void>, doneMsg: string) {
    setLoadingAction(stepKey);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await fn();
      setSuccessMessage(doneMsg);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to execute ${stepKey}`;
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setLoadingAction(null);
      setProgressLabel(null);
    }
  }

  async function handleResearch() {
    setLoadingAction("AI Research");
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      setProgressLabel("Searching live global venture & syndicate databases…");
      const searchRes = await fetch(`/api/vc-deals/${dealId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "search" }),
      });
      if (!searchRes.ok) {
        const err = await searchRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Live venture search step failed");
      }
      const searchData = await searchRes.json();

      setProgressLabel("Structuring investor thesis, check size & verified citations…");
      const structRes = await fetch(`/api/vc-deals/${dealId}/research`, {
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
      if (!structRes.ok) {
        const err = await structRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Structuring funder findings failed");
      }
      const structData = await structRes.json();

      setProgressLabel("Re-scoring syndicate match tiers…");
      await fetch(`/api/vc-deals/${dealId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setSuccessMessage(`Researched & verified "${structData.investorName || "new funder"}"!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to execute AI Research";
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setLoadingAction(null);
      setProgressLabel(null);
    }
  }

  async function handleFullPipeline() {
    setLoadingAction("Full Pipeline");
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      if (!hasExtracted) {
        await executeExtract(true);
      }
      if (!hasIntel) {
        await executeMarketIntel(true);
      }
      if (!hasMatches) {
        await executeMatch(true);
      }
      await executeBenchmark(false);
      setSuccessMessage("Full Startup Venture Pipeline (M1 → M9) completed!");
      setTimeout(() => setSuccessMessage(null), 4500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Full pipeline interrupted";
      setErrorMessage(msg);
      router.refresh();
    } finally {
      setLoadingAction(null);
      setProgressLabel(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Step 1: Extract & Reconcile Spec (S1-S2 · M2-M3) */}
        <Button
          variant={nextStep === "extract" ? "default" : "outline"}
          size="sm"
          disabled={!!loadingAction}
          onClick={() => runStep("Extract", () => executeExtract(false), "Extraction & Spec Reconciliation complete!")}
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "extract"
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-2 ring-amber-400/50"
              : "border-emerald-300/80 dark:border-emerald-800/70"
          }`}
          title="Stage 1-2 (M2 → M3): Extract pitch deck/cap table docs & reconcile Startup Deal Spec"
        >
          {loadingAction === "Extract" ? (
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

        {/* Step 2: Market Intel — Competitors + ICPs + Contacts (S2 · M5-M7) */}
        <Button
          variant={nextStep === "intel" ? "default" : "outline"}
          size="sm"
          disabled={!!loadingAction}
          onClick={() =>
            runStep("Intel", () => executeMarketIntel(false), "Competitors (M5), ICPs (M6) & Contacts (M7) discovered!")
          }
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "intel"
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs ring-2 ring-blue-400/50"
              : "border-blue-300/80 dark:border-blue-800/70"
          }`}
          title="Stage 2 (M5 → M7): Run Hikari Competitor Discovery, Hayate Commercial ICPs, and Executive Contacts"
        >
          {loadingAction === "Intel" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Compass className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          )}
          <span>2. Rivals &amp; ICP Leads</span>
          <span className="rounded bg-blue-100 dark:bg-blue-950 px-1 py-0.2 font-mono text-[9px] font-bold text-blue-800 dark:text-blue-300">
            S2·M5-M7
          </span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 3: Match Syndicate + Research (S3 · M8) */}
        <Button
          variant={nextStep === "match" ? "default" : "outline"}
          size="sm"
          disabled={!!loadingAction}
          onClick={() => runStep("Syndicate Match", () => executeMatch(false), "Syndicate matching updated!")}
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "match"
              ? "bg-purple-600 hover:bg-purple-700 text-white shadow-xs ring-2 ring-purple-400/50"
              : "border-purple-300/80 dark:border-purple-800/70"
          }`}
          title="Stage 3 (M8): Match Lead, Syndicate & Angel funds via Daiki VC Engine"
        >
          {loadingAction === "Syndicate Match" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          )}
          <span>{hasMatches ? "3. Re-Match" : "3. Match Syndicate"}</span>
          <span className="rounded bg-purple-100 dark:bg-purple-950 px-1 py-0.2 font-mono text-[9px] font-bold text-purple-800 dark:text-purple-300">
            S3·M8
          </span>
        </Button>

        {/* Optional Live Funder Discovery (S3 · M8+) */}
        <Button
          variant="outline"
          size="sm"
          disabled={!!loadingAction}
          onClick={handleResearch}
          className="text-xs gap-1 h-8 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30"
          title="Stage 3 (M8): Live web search to discover & onboard new VC funds matching this thesis"
        >
          {loadingAction === "AI Research" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          <span>+ Web Funders</span>
        </Button>

        <span className="text-neutral-300 dark:text-neutral-700 text-xs font-bold">→</span>

        {/* Step 4: Benchmark Dilution & Terms (S4 · M9) */}
        <Button
          variant={nextStep === "benchmark" ? "default" : "outline"}
          size="sm"
          disabled={!!loadingAction}
          onClick={() => runStep("Benchmark", () => executeBenchmark(false), "Pro-Forma Dilution & Valuation Benchmark generated!")}
          className={`text-xs gap-1.5 h-8 ${
            nextStep === "benchmark"
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-2 ring-amber-400/50"
              : "border-indigo-300/80 dark:border-indigo-800/70"
          }`}
          title="Stage 4 (M9): Compute Pro-Forma SAFE Conversion, Founder Dilution & Valuation Cap Benchmark"
        >
          {loadingAction === "Benchmark" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Scale className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          )}
          <span>4. Benchmark Terms</span>
          <span className="rounded bg-indigo-100 dark:bg-indigo-950 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-800 dark:text-indigo-300">
            S4·M9
          </span>
          {nextStep === "benchmark" && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold uppercase">
              ⏳ Next
            </span>
          )}
        </Button>

        {/* 1-Click Auto-Pilot Full Pipeline */}
        {nextStep !== "complete" && (
          <Button
            variant="default"
            size="sm"
            disabled={!!loadingAction}
            onClick={handleFullPipeline}
            className="text-xs gap-1.5 h-8 bg-[#1a1f3a] hover:bg-[#252c50] text-[#10b981] border border-[#10b981]/40 shadow-xs ml-1"
            title="Run all remaining uncompleted milestones (M2 → M9) automatically end-to-end"
          >
            {loadingAction === "Full Pipeline" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#10b981]" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-[#ff6b4a]" />
            )}
            <span>{loadingAction === "Full Pipeline" ? "Running Pipeline…" : "Run Remaining Pipeline"}</span>
          </Button>
        )}
      </div>

      {progressLabel && (
        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
          {progressLabel}
        </p>
      )}
      {successMessage && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {successMessage}
        </span>
      )}
      {errorMessage && (
        <span className="inline-block text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
