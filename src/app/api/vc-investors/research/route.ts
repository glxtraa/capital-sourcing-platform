import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cachePageCited } from "@/lib/page-cache";
import { testSourceLinks } from "@/lib/link-verifier";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const investorIds: string[] | undefined = Array.isArray(body?.investorIds) && body.investorIds.length > 0
      ? body.investorIds
      : undefined;

    // 1. Fetch targeted VC investors
    const investors = await db.startupInvestor.findMany({
      where: investorIds ? { id: { in: investorIds } } : undefined,
      include: { documentsRequired: true },
    });

    if (investors.length === 0) {
      return NextResponse.json({ error: "No VC investors found matching criteria." }, { status: 404 });
    }

    // 2. Log research run in StartupResearchRun
    const run = await db.startupResearchRun.create({
      data: {
        triggeredBy: investorIds ? `Targeted Re-run (${investorIds.length} investors)` : `Full VC Refresh (${investors.length} investors)`,
        status: "RUNNING",
        inputSummary: investorIds ? `Re-running research on: ${investorIds.join(", ")}` : "Re-running all registered VC investors.",
      },
    });

    const results: Array<{ id: string; name: string; status: "UPDATED" | "UNCHANGED" | "ERROR"; error?: string }> = [];

    // 3. Re-run research for each VC investor
    for (const inv of investors) {
      try {
        const primaryUrl = inv.websiteUrl || inv.applicationUrl || inv.sources?.[0];
        let cachedSnapshot = "";

        if (primaryUrl) {
          const cached = await cachePageCited(primaryUrl, { forceRefresh: true, timeoutMs: 9000 });
          if (cached && cached.content) {
            cachedSnapshot = cached.content.slice(0, 4000);
          }
        }

        // Test links and portfolio references
        const rawUrls: string[] = [];
        if (inv.websiteUrl) rawUrls.push(inv.websiteUrl);
        if (inv.applicationUrl) rawUrls.push(inv.applicationUrl);
        if (Array.isArray(inv.sources)) rawUrls.push(...inv.sources);

        const candidateUrls = Array.from(new Set(rawUrls.filter(Boolean))).slice(0, 6);
        const linkAudit = await testSourceLinks(candidateUrls, 4, 3000);

        // Update VC Investor record
        await db.startupInvestor.update({
          where: { id: inv.id },
          data: {
            confidence: cachedSnapshot ? "VERIFIED_SITE" : inv.confidence,
            sourceLinksAudit: linkAudit as any,
            lastVerified: new Date(),
          },
        });

        results.push({ id: inv.id, name: inv.name, status: "UPDATED" });
      } catch (err: any) {
        results.push({ id: inv.id, name: inv.name, status: "ERROR", error: err?.message || "Unknown error" });
      }
    }

    // 4. Complete run log
    await db.startupResearchRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outputSummary: `Processed ${results.length} investor(s): ${results.filter((r) => r.status === "UPDATED").length} updated, ${results.filter((r) => r.status === "ERROR").length} errors.`,
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
    return NextResponse.json({ error: err?.message || "Failed to re-run VC investor research." }, { status: 500 });
  }
}
