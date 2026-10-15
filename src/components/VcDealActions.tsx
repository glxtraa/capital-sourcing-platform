"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { RefreshCw, Sparkles, Scale, Search, Loader2, CheckCircle2 } from "lucide-react";

export function VcDealActions({
  dealId,
  hasMatches,
}: {
  dealId: string;
  hasMatches: boolean;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAction(
    actionName: string,
    endpoint: string,
    body?: Record<string, any>
  ) {
    setLoadingAction(actionName);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed to run ${actionName}`);
      }

      setSuccessMessage(`${actionName} completed!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to execute ${actionName}`;
      if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setErrorMessage(`Network connection dropped or timed out during ${actionName}. Please retry.`);
      } else {
        setErrorMessage(msg);
      }
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleResearch() {
    setLoadingAction("AI Research");
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Step 1: Search live venture sources
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

      // Step 2: Structure investor thesis, contacts, and cache cited pages
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

      // Step 3: Re-evaluate syndicate matching
      await fetch(`/api/vc-deals/${dealId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setSuccessMessage(`Researched & verified "${structData.investorName || "new funder"}"! Matches updated.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to execute AI Research";
      if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setErrorMessage("Network dropped or timed out during research. Please retry.");
      } else {
        setErrorMessage(msg);
      }
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {successMessage && (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {successMessage}
        </span>
      )}
      {errorMessage && (
        <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
          {errorMessage}
        </span>
      )}

      {/* Reconcile */}
      <Button
        variant="outline"
        size="sm"
        disabled={!!loadingAction}
        onClick={() => handleAction("Reconcile", `/api/vc-deals/${dealId}/reconcile`)}
        className="text-xs gap-1.5 h-8 border-neutral-300 dark:border-neutral-700"
      >
        {loadingAction === "Reconcile" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Reconcile Spec
      </Button>

      {/* Match Syndicate */}
      <Button
        variant="default"
        size="sm"
        disabled={!!loadingAction}
        onClick={() => handleAction("Syndicate Match", `/api/vc-deals/${dealId}/match`, {})}
        className="text-xs gap-1.5 h-8 bg-emerald-700 hover:bg-emerald-800 text-white"
      >
        {loadingAction === "Syndicate Match" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {hasMatches ? "Re-Run Match" : "Match Syndicate"}
      </Button>

      {/* Benchmark Term Sheet */}
      <Button
        variant="outline"
        size="sm"
        disabled={!!loadingAction}
        onClick={() => handleAction("Benchmark", `/api/vc-deals/${dealId}/benchmark`)}
        className="text-xs gap-1.5 h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      >
        {loadingAction === "Benchmark" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Scale className="h-3.5 w-3.5" />
        )}
        Benchmark Terms
      </Button>

      {/* Research New Investors */}
      <Button
        variant="outline"
        size="sm"
        disabled={!!loadingAction}
        onClick={handleResearch}
        className="text-xs gap-1.5 h-8 border-purple-300 text-purple-800 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30"
      >
        {loadingAction === "AI Research" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Researching Investors…</span>
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5" />
            <span>Research Investors</span>
          </>
        )}
      </Button>
    </div>
  );
}
