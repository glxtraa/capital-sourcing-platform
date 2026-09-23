"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import type { DealStatus } from "@prisma/client";

const MAX_AUTO_RESEARCH_ATTEMPTS = 3;

export function DealActions({ dealId, status, hasMatches }: { dealId: string; status: DealStatus; hasMatches: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"extract" | "match" | "benchmark" | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Same per-document-then-finalize sequence as UploadDropzone (see that
  // component's own comment for why) -- this route needs its own copy of
  // the current document list first since, unlike UploadDropzone, it isn't
  // the one that just uploaded the files.
  async function runExtract() {
    setPending("extract");
    setError(null);
    try {
      const dealRes = await fetch(`/api/deals/${dealId}`);
      if (!dealRes.ok) throw new Error("Failed to load this deal's documents.");
      const deal = await dealRes.json();
      const documents: { id: string; fileName: string; extractedFieldsRaw: unknown; documentTypes: string[] }[] =
        deal.documents ?? [];
      if (documents.length === 0) throw new Error("No documents uploaded yet.");

      // Skip documents already extracted with a document-type classification
      // on file -- makes this safe to re-run after a partial failure without
      // redoing already-successful (and billed) work, while still picking up
      // anything that's never been processed OR was processed before
      // documentTypes existed (empty array either way).
      const pendingDocs = documents.filter((d) => d.extractedFieldsRaw == null || d.documentTypes.length === 0);
      for (let i = 0; i < pendingDocs.length; i++) {
        setProgressLabel(`Extracting ${pendingDocs[i].fileName} (${i + 1}/${pendingDocs.length})…`);
        const res = await fetch(`/api/deals/${dealId}/documents/${pendingDocs[i].id}/extract`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Extraction failed for ${pendingDocs[i].fileName}.`);
        }
      }

      setProgressLabel("Finalizing deal spec…");
      const finalizeRes = await fetch(`/api/deals/${dealId}/extract`, { method: "POST" });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to finalize the deal spec.");
      }
      router.refresh();
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

  // Matching plus the "zero eligible providers -> research a new one ->
  // match again" feedback loop, driven from here one short request at a time
  // (match, then research-search, then research-structure, then match
  // again...) rather than one long server request -- see match/route.ts and
  // research/route.ts for why (Vercel Hobby's 60s function cap).
  async function runMatch() {
    setPending("match");
    setError(null);
    setNotice(null);
    try {
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
          // The failed attempt is already logged on the deal's agent run log
          // by the route itself; keep going so a transient failure on one
          // attempt doesn't forfeit the remaining ones.
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
      setProgressLabel(null);
    }
  }

  async function runBenchmark() {
    setPending("benchmark");
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/benchmark`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to run the lender benchmark.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  // Extraction and matching are both safe to (re-)run any time -- each
  // always recomputes from current DB state -- so neither button is gated on
  // the persisted `status`. If a run is genuinely in flight in THIS tab,
  // `pending` already disables them; gating on status as well would lock a
  // deal that a killed/timed-out request left stuck in EXTRACTING/MATCHING/
  // RESEARCHING with no way to retry, which is exactly the failure these
  // buttons exist to recover from.

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={runExtract} disabled={pending !== null}>
          {pending === "extract" ? (progressLabel ?? "Extracting…") : "Run extraction"}
        </Button>
        <Button variant="outline" onClick={runMatch} disabled={pending !== null}>
          {pending === "match"
            ? (progressLabel ?? "Matching…")
            : status === "COMPLETE"
              ? "Re-run matching"
              : "Run matching"}
        </Button>
        <Button
          variant="outline"
          onClick={runBenchmark}
          disabled={!hasMatches || pending !== null}
          title={!hasMatches ? "Run matching first — nothing to benchmark against yet." : "Benchmark this deal for a new lender"}
        >
          {pending === "benchmark" ? "Running… (usually under 30s)" : "Run lender benchmark"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-amber-600 dark:text-amber-400">{notice}</p>}
    </div>
  );
}
