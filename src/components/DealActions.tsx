"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import type { DealStatus } from "@prisma/client";

export function DealActions({ dealId, status, hasMatches }: { dealId: string; status: DealStatus; hasMatches: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"extract" | "match" | "benchmark" | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function runMatch() {
    setPending("match");
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/match`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to run matching.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
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

  // Extraction is safe to (re-)run any time there are documents to read —
  // it always recomputes from scratch, so this doubles as the recovery path
  // for a deal stuck mid-pipeline (e.g. a request that hit the platform's
  // hard function-duration ceiling before its own status update ran). Never
  // gate this on the persisted `status`: if it's genuinely running right
  // now in THIS tab, `pending` already disables the button; gating on
  // status as well would lock a stuck deal in EXTRACTING forever with no
  // way to retry from the UI, which is exactly the failure mode this
  // button exists to recover from.
  // Same reasoning as extraction above: match/route.ts also always
  // recomputes from current DB state and is safe to re-run any time, so
  // this must not gate on MATCHING/RESEARCHING either -- those are exactly
  // the statuses a timed-out run would leave a deal stuck in.

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={runExtract} disabled={pending !== null}>
          {pending === "extract" ? (progressLabel ?? "Extracting…") : "Run extraction"}
        </Button>
        <Button variant="outline" onClick={runMatch} disabled={pending !== null}>
          {pending === "match"
            ? "Matching… (can take a minute if new providers need researching)"
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
    </div>
  );
}
