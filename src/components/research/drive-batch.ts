export interface BatchProgress {
  queued: number;
  searched: number;
  done: number;
  failed: number;
  total: number;
  done_: boolean;
}

interface StepResponse {
  ran: { kind: string; subject: string; outcome: string; detail?: string } | null;
  progress: BatchProgress;
  error?: string;
}

/**
 * Calls the step route until the batch is drained. One request = one model
 * call (see lib/research-runner.ts), so each fits Vercel Hobby's 60s cap.
 * Task-level failures are recorded on the task and retried server-side;
 * this only stops on an HTTP-level error or when told to.
 */
export async function driveBatch(
  batchId: string,
  onUpdate: (progress: BatchProgress, label: string) => void,
  shouldStop: () => boolean = () => false,
): Promise<BatchProgress> {
  let last: BatchProgress | null = null;
  for (let i = 0; i < 600; i++) {
    if (shouldStop() && last) return last;
    const res = await fetch(`/api/research/batches/${batchId}/step`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as StepResponse;
    if (!res.ok) throw new Error(body.error ?? `Step request failed (${res.status}).`);
    last = body.progress;
    const r = body.ran;
    onUpdate(
      body.progress,
      r ? `${r.outcome === "retry" ? "Retrying" : r.outcome === "failed" ? "Failed" : r.outcome === "searched" ? "Searched" : "Finished"}: ${r.subject}` : "Wrapping up…",
    );
    if (body.progress.done_) return body.progress;
  }
  throw new Error("Stopped after 600 steps; re-run to continue.");
}
