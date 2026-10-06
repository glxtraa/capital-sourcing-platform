import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createBatch, getSetting, setSetting, stepBatch } from "@/lib/research-runner";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CONCURRENCY = 3; // parallel steps per invocation -- each is one <=50s model call
const MIN_DAYS_BETWEEN_SWEEPS = 6;

/**
 * Vercel Cron target (vercel.json). Excluded from the site-password proxy
 * (see proxy.ts) and authenticated with CRON_SECRET instead -- Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. A no-op unless the "cronEnabled"
 * switch on the Research page is on (default off).
 *
 * Each run drains a few tasks of the active batch, or starts a new
 * stale/missing-provider sweep (+ discovery) if the last one is over 6 days old.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((await getSetting("cronEnabled")) !== "true") return NextResponse.json({ skipped: "disabled" });

  let batch = await db.researchBatch.findFirst({ where: { finishedAt: null }, orderBy: { createdAt: "desc" } });
  if (!batch) {
    const latest = await db.researchBatch.findFirst({ where: { triggeredBy: "cron" }, orderBy: { createdAt: "desc" } });
    if (latest && Date.now() - latest.createdAt.getTime() < MIN_DAYS_BETWEEN_SWEEPS * 86_400_000) {
      return NextResponse.json({ skipped: "last sweep is recent" });
    }
    const created = await createBatch({ triggeredBy: "cron", mode: "stale", includeDiscovery: true });
    if (!created) return NextResponse.json({ skipped: "nothing to research" });
    batch = await db.researchBatch.findUniqueOrThrow({ where: { id: created.batchId } });
  }

  const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => stepBatch(batch.id)));
  await setSetting("lastCronRun", new Date().toISOString());
  return NextResponse.json({ batchId: batch.id, ran: results.map((r) => r.ran), progress: results[results.length - 1].progress });
}
