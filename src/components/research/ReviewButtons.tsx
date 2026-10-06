"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { driveBatch } from "./drive-batch";

export function OnboardingReviewButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/research/onboarding/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Failed.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => act("accept")} disabled={busy}>
        Accept
      </Button>
      <Button variant="outline" onClick={() => act("reject")} disabled={busy}>
        Reject
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function CandidateButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "promote" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/candidates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed.");
      if (action === "promote") {
        await driveBatch(body.batchId, (_p, l) => setStatus(l));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => act("promote")} disabled={busy}>
        {busy ? "Working…" : "Add to provider database"}
      </Button>
      <Button variant="outline" onClick={() => act("reject")} disabled={busy}>
        Reject
      </Button>
      {status && busy && <span className="text-xs text-neutral-500">{status}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
