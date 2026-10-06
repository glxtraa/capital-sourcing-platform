"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { driveBatch, type BatchProgress } from "./drive-batch";

interface Settings {
  cronEnabled: boolean;
  cronConfigured: boolean;
  lastCronRun: string | null;
}

export function ResearchControls({ providerCount, openBatchId }: { providerCount: number; openBatchId: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"stale" | "all">("stale");
  const [discovery, setDiscovery] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    fetch("/api/research/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  async function drive(batchId: string) {
    setRunning(true);
    setError(null);
    try {
      await driveBatch(batchId, (p, l) => {
        setProgress(p);
        setLabel(l);
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  async function start() {
    setError(null);
    const res = await fetch("/api/research/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, includeDiscovery: discovery }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not start the batch.");
    await drive(body.batchId);
  }

  async function toggleCron(next: boolean) {
    const res = await fetch("/api/research/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cronEnabled: next }),
    });
    if (res.ok) setSettings((s) => (s ? { ...s, cronEnabled: next } : s));
  }

  const pct = progress && progress.total ? Math.round(((progress.done + progress.failed) / progress.total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-neutral-500">Providers to research</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "stale" | "all")}
            disabled={running}
            className="rounded-lg border border-neutral-300 bg-transparent px-2.5 py-2 text-sm dark:border-neutral-700"
          >
            <option value="stale">Missing or older than 30 days</option>
            <option value="all">All {providerCount} providers</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={discovery} onChange={(e) => setDiscovery(e.target.checked)} disabled={running} />
          Also look for new providers
        </label>
        <Button onClick={start} disabled={running}>
          {running ? "Researching…" : "Run research"}
        </Button>
        {openBatchId && !running && (
          <Button variant="outline" onClick={() => drive(openBatchId)}>
            Resume unfinished batch
          </Button>
        )}
      </div>

      {(running || progress) && progress && (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-neutral-500">
            {progress.done} done · {progress.failed} failed · {progress.queued + progress.searched} remaining of {progress.total}
            {running && label ? ` — ${label}` : ""}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-neutral-500">
        Each provider takes two web-search model calls (about 30–90 seconds in total). Keep this tab open while it runs; closing it
        pauses the batch, and &ldquo;Resume unfinished batch&rdquo; continues where it stopped.
      </p>

      <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings?.cronEnabled ?? false}
            disabled={!settings}
            onChange={(e) => toggleCron(e.target.checked)}
          />
          <span>
            <span className="font-medium">Scheduled research (daily cron)</span>
            <span className="block text-xs text-neutral-500">
              Off by default. When on, a daily Vercel Cron advances the active batch a few steps, and starts a new sweep of
              stale providers plus discovery if the last one is over 6 days old. On Vercel Hobby this is slow (a few model calls
              per day) — use the button above for a full sweep.
              {settings && !settings.cronConfigured && " CRON_SECRET is not set, so scheduled runs will be rejected until you add it in Vercel."}
              {settings?.lastCronRun && ` Last run: ${new Date(settings.lastCronRun).toLocaleString()}.`}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
