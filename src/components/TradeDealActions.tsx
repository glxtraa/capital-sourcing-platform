"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function TradeDealActions({
  dealId,
  hasMatches,
}: {
  dealId: string;
  hasMatches: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"extract" | "reconcile" | "match" | "benchmark" | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sequentially extracts any unextracted (or all) documents, then reconciles
  async function runExtract() {
    setPending("extract");
    setError(null);
    try {
      const dealRes = await fetch(`/api/trade-deals/${dealId}`);
      if (!dealRes.ok) throw new Error("Failed to load this deal's documents.");
      const deal = await dealRes.json();
      const documents: { id: string; fileName: string; extractedRaw: unknown }[] =
        deal.documents ?? [];
      if (documents.length === 0) throw new Error("No trade documents uploaded yet.");

      // If any documents failed or haven't been extracted, extract them first;
      // otherwise, re-run extraction across all documents.
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

      router.refresh();
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

  async function runMatch() {
    setPending("match");
    setError(null);
    try {
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

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matching failed.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function runBenchmark() {
    setPending("benchmark");
    setError(null);
    try {
      const res = await fetch(`/api/trade-deals/${dealId}/benchmark`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to benchmark term sheet.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Benchmarking failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={runExtract} disabled={pending !== null}>
          {pending === "extract" ? (progressLabel ?? "Extracting…") : "Run extraction"}
        </Button>
        <Button variant="outline" onClick={runReconcile} disabled={pending !== null}>
          {pending === "reconcile" ? "Reconciling contracts…" : "Reconcile contracts"}
        </Button>
        <Button variant="outline" onClick={runMatch} disabled={pending !== null}>
          {pending === "match" ? "Matching funders…" : hasMatches ? "Re-run matching" : "Run funder matching"}
        </Button>
        <Button
          onClick={runBenchmark}
          disabled={!hasMatches || pending !== null}
          className="bg-purple-700 hover:bg-purple-800 text-white"
        >
          {pending === "benchmark" ? "Benchmarking term sheet…" : "Generate term sheet"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
