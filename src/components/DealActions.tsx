"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import type { DealStatus } from "@prisma/client";

export function DealActions({ dealId, status, hasMatches }: { dealId: string; status: DealStatus; hasMatches: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"match" | "benchmark" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runMatch() {
    setPending("match");
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/match`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start matching.");
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

  const canMatch = status === "NEEDS_REVIEW" || status === "READY" || status === "COMPLETE";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={runMatch} disabled={!canMatch || pending !== null}>
          {pending === "match" ? "Starting…" : status === "COMPLETE" ? "Re-run matching" : "Run matching"}
        </Button>
        <Button
          variant="outline"
          onClick={runBenchmark}
          disabled={!hasMatches || pending !== null}
          title={!hasMatches ? "Run matching first — nothing to benchmark against yet." : "Benchmark this deal for a new lender"}
        >
          {pending === "benchmark" ? "Running…" : "Run lender benchmark"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
