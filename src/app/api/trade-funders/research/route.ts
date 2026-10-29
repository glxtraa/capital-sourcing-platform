import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crawlTradeFunderSite } from "@/lib/trade-crawler";
import { resolveFunderCriterionProvenance } from "@/dsl/provenance";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const funderIds: string[] | undefined = Array.isArray(body?.funderIds) && body.funderIds.length > 0
      ? body.funderIds
      : undefined;

    // 1. Fetch targeted funders (all or selected subset)
    const funders = await db.tradeFunder.findMany({
      where: funderIds ? { id: { in: funderIds } } : undefined,
      include: { documentsRequired: true },
    });

    if (funders.length === 0) {
      return NextResponse.json({ error: "No funders found matching criteria." }, { status: 404 });
    }

    // 2. Create a research run log
    const run = await db.tradeResearchRun.create({
      data: {
        triggeredBy: funderIds ? `Targeted Re-run (${funderIds.length} funders)` : `Full Refresh (${funders.length} funders)`,
        status: "RUNNING",
        inputSummary: funderIds ? `Re-running strict research on: ${funderIds.join(", ")}` : "Re-running all registered trade funders with strict crawler.",
      },
    });

    const results: Array<{ id: string; name: string; status: "UPDATED" | "UNCHANGED" | "ERROR"; error?: string }> = [];

    // 3. Strict Crawl and Verified Information Extraction for each funder
    for (const f of funders) {
      try {
        const primaryUrl = f.sources?.[0] || f.applicationUrl || "";
        const secondaryUrls = (f.sources || []).slice(1);
        if (f.applicationUrl && !secondaryUrls.includes(f.applicationUrl)) {
          secondaryUrls.push(f.applicationUrl);
        }

        const crawlResult = await crawlTradeFunderSite(primaryUrl, secondaryUrls);

        const cachedSnapshot = crawlResult?.cachedContent || (f.pricingProvenance as any)?.cachedSnapshotText || "";
        const pageTitle = crawlResult?.pageTitle || f.name;
        const exactQuotes = crawlResult?.exactQuotes || {};
        const rateEvidenceSnippet = crawlResult?.snippet || f.rateEvidenceSnippet || "";

        // Generate per-criterion provenance rules backed strictly by verified quotes or explicit inference
        const criteriaKeys = [
          "ticketSize",
          "corridor",
          "supplierJurisdiction",
          "traderJurisdiction",
          "buyerJurisdiction",
          "commodity",
          "gatingFactor",
        ];

        const criteriaProvenance = criteriaKeys.map((key) => {
          const prov = resolveFunderCriterionProvenance(
            {
              ...f,
              pricingProvenance: {
                cachedSnapshotText: cachedSnapshot,
                evidenceSnippet: rateEvidenceSnippet,
                sourceDocumentOrUrl: crawlResult?.url || primaryUrl,
                sourcePageTitle: pageTitle,
                exactQuotes,
              },
            },
            key
          );

          return {
            criterionKey: key,
            ruleValueSummary: prov.ruleSummary,
            acquisitionMethod: prov.acquisitionMethod,
            howObtainedExplanation: prov.howObtainedExplanation,
            sourceUrl: prov.sourceUrl || crawlResult?.url || primaryUrl || null,
            sourcePageTitle: prov.sourcePageTitle || pageTitle,
            verbatimQuote: prov.verbatimQuote || null,
            surroundingContext: prov.surroundingContext || cachedSnapshot || null,
            quoteVerifiedInCache: Boolean(prov.quoteVerifiedInCache),
            crawledAt: new Date().toISOString(),
          };
        });

        // Determine derivation type: Only PUBLISHED_TARIFF if a verified rate quote was physically found in snapshot
        const hasVerifiedRate = Boolean(
          exactQuotes.advancesOrPricing && cachedSnapshot.includes(exactQuotes.advancesOrPricing)
        );

        const derivationType = hasVerifiedRate
          ? "PUBLISHED_TARIFF"
          : "UNPUBLISHED_BILATERAL_ESTIMATE";

        // Determine cleansed pricing guidance: never persist unanchored SOFR quotes without verbatim proof
        let resolvedPricingGuidance = f.indicativePricingGuidance;
        if (hasVerifiedRate && exactQuotes.advancesOrPricing) {
          resolvedPricingGuidance = exactQuotes.advancesOrPricing;
        } else if (
          !resolvedPricingGuidance ||
          resolvedPricingGuidance === "pricingGuidance" ||
          resolvedPricingGuidance.toLowerCase().includes("sofr +")
        ) {
          resolvedPricingGuidance =
            "Unpublished Bilateral Wholesale Facility — Rates individually negotiated per transaction based on obligor credit and collateral.";
        }

        // Clean sources: keep only valid URLs without example.com or known dead endpoints
        const validSources = (f.sources || []).filter(
          (s) => Boolean(s) && !s.includes("example.com") && !s.includes("solution-financing") && !s.includes("EXTERNAL-TF-List-of-Charges-2026-ID-EN.pdf")
        );

        // Update funder in DB
        await db.tradeFunder.update({
          where: { id: f.id },
          data: {
            sources: validSources.length ? validSources : f.sources,
            indicativePricingGuidance: resolvedPricingGuidance,
            rateEvidenceSnippet: rateEvidenceSnippet || f.rateEvidenceSnippet,
            pricingProvenance: {
              ...(typeof f.pricingProvenance === "object" && f.pricingProvenance !== null ? f.pricingProvenance : {}),
              derivationType,
              evidenceSnippet: rateEvidenceSnippet,
              sourceDocumentOrUrl: crawlResult?.url || primaryUrl,
              sourcePageTitle: pageTitle,
              cachedSnapshotText: cachedSnapshot,
              exactQuotes,
              criteriaProvenance,
              crawledAt: new Date().toISOString(),
              spiderEngine: "Trade Desk Recon Spider v2.7 (Strict Pre-Flight & Verifiable Quotation Engine)",
            },
            confidence: crawlResult?.verifiedTokensFound.length ? "VERIFIED_SITE" : f.confidence,
            lastVerified: new Date(),
          },
        });

        results.push({ id: f.id, name: f.name, status: "UPDATED" });
      } catch (err: any) {
        results.push({ id: f.id, name: f.name, status: "ERROR", error: err?.message || "Unknown error" });
      }
    }

    // 4. Update run log to COMPLETED
    await db.tradeResearchRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        outputSummary: `Strictly crawled and audited ${results.length} funder(s): ${results.filter((r) => r.status === "UPDATED").length} updated with verifiable information, ${results.filter((r) => r.status === "ERROR").length} errors.`,
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
    return NextResponse.json({ error: err?.message || "Failed to strictly crawl trade funders." }, { status: 500 });
  }
}
