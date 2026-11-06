import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cachePageCited } from "@/lib/page-cache";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerIds: string[] | undefined = Array.isArray(body?.providerIds) && body.providerIds.length > 0
      ? body.providerIds
      : undefined;

    // 1. Fetch targeted Factoring providers
    const providers = await db.provider.findMany({
      where: providerIds ? { id: { in: providerIds } } : undefined,
      include: { documentsRequired: true },
    });

    if (providers.length === 0) {
      return NextResponse.json({ error: "No factoring providers found matching criteria." }, { status: 404 });
    }

    // 2. Log in ResearchRun
    const run = await db.researchRun.create({
      data: {
        kind: "PROVIDER_RESEARCH_REFRESH",
        triggeredBy: providerIds ? `Targeted Re-run (${providerIds.length} providers)` : `Full Refresh (${providers.length} providers)`,
        status: "RUNNING",
        inputSummary: providerIds ? `Re-running research on: ${providerIds.join(", ")}` : "Re-running all registered factoring providers.",
      },
    });

    const results: Array<{ id: string; name: string; status: "UPDATED" | "UNCHANGED" | "ERROR"; error?: string }> = [];

    // 3. Re-crawl and cache live snapshots
    for (const p of providers) {
      try {
        const primaryUrl = p.applicationUrl || p.sources?.[0];
        let cachedSnapshot = "";

        if (primaryUrl) {
          const cached = await cachePageCited(primaryUrl, { forceRefresh: true, timeoutMs: 9000 });
          if (cached && cached.content) {
            cachedSnapshot = cached.content.slice(0, 4000);
          }
        }

        // Update provider record
        await db.provider.update({
          where: { id: p.id },
          data: {
            confidence: cachedSnapshot ? "VERIFIED_SITE" : p.confidence,
            lastVerified: new Date(),
          },
        });

        results.push({ id: p.id, name: p.name, status: "UPDATED" });
      } catch (err: any) {
        results.push({ id: p.id, name: p.name, status: "ERROR", error: err?.message || "Unknown error" });
      }
    }

    // 4. Complete run log
    await db.researchRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outputSummary: `Processed ${results.length} factoring provider(s): ${results.filter((r) => r.status === "UPDATED").length} updated, ${results.filter((r) => r.status === "ERROR").length} errors.`,
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      totalProcessed: results.length,
      updatedCount: results.filter((r) => r.status === "UPDATED").length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to re-run factoring provider research." }, { status: 500 });
  }
}
