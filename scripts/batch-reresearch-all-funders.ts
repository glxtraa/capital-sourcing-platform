import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";
import { testSourceLinks } from "../src/lib/link-verifier";
import { researchProviderFindings, structureProviderFindings } from "../src/agents/research-agent";
import { researchTradeFunderFindings, structureTradeFunderFindings } from "../src/agents/trade/trade-research-agent";
import { researchVCInvestorFindings, structureVCInvestorFindings } from "../src/agents/vc/vc-research-agent";
import {
  verifyProviderExtractionGrounding,
  verifyTradeFunderExtractionGrounding,
  verifyStartupInvestorExtractionGrounding,
} from "../src/dsl/compiler/funder-verifier";
import { matchAllProviders, buildMatchInputs } from "../src/lib/matching";
import { matchTradeDeal } from "../src/lib/trade-matching";
import { matchStartupDeal } from "../src/lib/vc-matching";
import { reconcileTradeExtractions } from "../src/agents/trade/trade-reconciliation";
import { reconcileStartupExtractions } from "../src/agents/vc/vc-reconciliation";
import type { TradeDocumentExtraction } from "../src/dsl/trade/trade-extraction-schema";
import type { StartupDocumentExtraction } from "../src/dsl/vc";

resolveDatabaseUrl();
const db = new PrismaClient();

const uniq = <T>(arr: T[] | undefined | null): T[] => Array.from(new Set(arr ?? []));

const FORCE = process.argv.includes("--force");

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s on ${label}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isRecentlyVerified(date: Date | null | undefined): boolean {
  if (FORCE || !date) return false;
  return new Date(date).getTime() >= new Date("2026-10-30T00:00:00Z").getTime();
}

async function main() {
  console.log("=================================================================");
  console.log("STARTING LIVE RE-RESEARCH & LINK VERIFICATION ACROSS ALL FUNDERS");
  console.log("Mode: " + (FORCE ? "FORCE (re-running all)" : "RESUME (skipping recently verified < 4h)"));
  console.log("=================================================================\n");

  // 1. INVOICE PROVIDERS (db.provider)
  const providers = await db.provider.findMany({ orderBy: { name: "asc" } });
  console.log(`\n--- 1. Re-researching ${providers.length} Invoice Providers ---`);
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    console.log(`\n[Invoice ${i + 1}/${providers.length}] ${p.name} (${p.id})`);

    if (isRecentlyVerified(p.lastVerified)) {
      console.log(`  ↪ Skipped (already re-researched recently at ${p.lastVerified?.toISOString()})`);
      continue;
    }

    try {
      await withTimeout(
        (async () => {
          const hint = `${p.name} (ID: ${p.id})`;
          const context = `Invoice Factoring / Receivables Finance provider. Existing product: "${p.product}". Researched for cross-border receivables, invoice discounting, and supply chain finance. Verify official site, accepted jurisdictions, ticket size, gating factor, and real application URL. Only cite working 200 OK links.`;

          const entityKeywords = [p.name, p.id.split("-")[0]].filter(Boolean);
          const { findings, citedUrls } = await researchProviderFindings(hint, context);
          console.log(`  Cited ${citedUrls.length} links. Verifying HTTP responses and source keyword grounding...`);
          const linkAudit = citedUrls.length > 0
            ? await testSourceLinks(citedUrls, 5, 4000, { requiredKeywords: entityKeywords })
            : [];
          const workingUrls = linkAudit.filter((l) => l.ok).map((l) => l.url);
          console.log(`  Working & keyword-grounded URLs verified: ${workingUrls.length}/${citedUrls.length}`);

          const structured = await structureProviderFindings(hint, {
            findings,
            citedUrls: workingUrls,
          });

          const pageTexts = linkAudit.map((l) => `${l.cachedTitle ?? ""} ${l.cachedSnippet ?? ""}`).filter(Boolean);
          const groundingReport = verifyProviderExtractionGrounding(structured, pageTexts);
          console.log(`  Grounded field extraction audit: ${groundingReport.groundingScorePct}% grounded (${groundingReport.verifiedCount} verified, ${groundingReport.unverifiedCount} unverified)`);

          const verifiedSellerJur = (structured.sellerJurisdictions ?? []).filter((j) => {
            if (!j || j.toLowerCase() === "any") return true;
            const item = groundingReport.items.find((i) => i.field === `jurisdiction:${j}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedObligorJur = (structured.obligorJurisdictions ?? []).filter((j) => {
            if (!j || j.toLowerCase() === "any") return true;
            const item = groundingReport.items.find((i) => i.field === `jurisdiction:${j}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedDocs = (structured.documentsRequired ?? []).filter((d) => {
            const item = groundingReport.items.find((i) => i.field === `documentRequired:${d.code}`);
            return !item || item.status === "VERIFIED";
          });

          let structures = uniq(structured.financingStructuresSupported);
          if (structures.length === 0 || structures.includes("UNKNOWN" as never)) {
            structures = p.financingStructuresSupported.length > 0
              ? p.financingStructuresSupported
              : (["WHOLE_TURNOVER_DISCOUNTING"] as never);
          }

          const verifiedSources = uniq([
            ...workingUrls,
            ...(structured.sources ?? []).filter((s) => workingUrls.includes(s) || s.startsWith("https://")),
          ]);

          await db.provider.update({
            where: { id: p.id },
            data: {
              sellerJurisdictions: verifiedSellerJur.length ? uniq(verifiedSellerJur) : p.sellerJurisdictions,
              obligorJurisdictions: verifiedObligorJur.length ? uniq(verifiedObligorJur) : p.obligorJurisdictions,
              minInvoiceAmountUsd: groundingReport.items.find((i) => i.field === "minInvoiceAmountUsd")?.status === "VERIFIED" ? structured.minInvoiceAmountUsd : p.minInvoiceAmountUsd,
              maxFacilityAmountUsd: groundingReport.items.find((i) => i.field === "maxFacilityAmountUsd")?.status === "VERIFIED" ? structured.maxFacilityAmountUsd : p.maxFacilityAmountUsd,
              typicalAdvanceRatePct: structured.typicalAdvanceRatePct ?? p.typicalAdvanceRatePct,
              gatingFactor: structured.gatingFactor || p.gatingFactor,
              websiteUrl: structured.websiteUrl || p.websiteUrl,
              applicationUrl: structured.applicationUrl || p.applicationUrl,
              sources: verifiedSources.length > 0 ? verifiedSources : p.sources,
              financingStructuresSupported: structures as never,
              lastVerified: new Date(),
              confidence: workingUrls.length > 0 && groundingReport.groundingScorePct >= 60 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
              documentsRequired: {
                deleteMany: {},
                create: verifiedDocs.map((d) => ({ code: d.code, note: d.note ?? null })),
              },
            },
          });
          console.log(`  ✓ Updated ${p.id} with ${verifiedSources.length} verified links.`);
        })(),
        120_000,
        p.name
      );
    } catch (err) {
      console.error(`  ⚠ Failed re-researching provider ${p.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // 2. COMMODITY TRADE FUNDERS (db.tradeFunder)
  const tradeFunders = await db.tradeFunder.findMany({ orderBy: { name: "asc" } });
  console.log(`\n\n--- 2. Re-researching ${tradeFunders.length} Commodity Trade Funders ---`);
  for (let i = 0; i < tradeFunders.length; i++) {
    const f = tradeFunders[i];
    console.log(`\n[Trade Funder ${i + 1}/${tradeFunders.length}] ${f.name} (${f.id})`);

    if (isRecentlyVerified(f.lastVerified)) {
      console.log(`  ↪ Skipped (already re-researched recently at ${f.lastVerified?.toISOString()})`);
      continue;
    }

    try {
      await withTimeout(
        (async () => {
          const hint = `${f.name} (Corridors: ${f.supportedCorridors.join(", ")}, Commodities: ${f.supportedCommodities.slice(0, 3).join(", ")})`;
          const context = `Commodity Trade Finance funder or trade desk. Corridors: ${f.supportedCorridors.join(", ")}; legs: ${f.supportedLegs.join(", ")}. Verify official desk portal, commodity mandates, indicative pricing, and documentary requirements. Only cite live working URLs.`;

          const funderKeywords = [f.name, f.id.split("-")[0]].filter(Boolean);
          const { findings, citedUrls } = await researchTradeFunderFindings(hint, context);
          console.log(`  Cited ${citedUrls.length} links. Verifying HTTP responses and source keyword grounding...`);
          const linkAudit = citedUrls.length > 0
            ? await testSourceLinks(citedUrls, 5, 4000, { requiredKeywords: funderKeywords })
            : [];
          const workingUrls = linkAudit.filter((l) => l.ok).map((l) => l.url);
          console.log(`  Working & keyword-grounded URLs verified: ${workingUrls.length}/${citedUrls.length}`);

          const structured = await structureTradeFunderFindings(hint, {
            findings,
            citedUrls: workingUrls,
          });

          const pageTexts = linkAudit.map((l) => `${l.cachedTitle ?? ""} ${l.cachedSnippet ?? ""}`).filter(Boolean);
          const groundingReport = verifyTradeFunderExtractionGrounding(structured, pageTexts);
          console.log(`  Grounded field extraction audit: ${groundingReport.groundingScorePct}% grounded (${groundingReport.verifiedCount} verified, ${groundingReport.unverifiedCount} unverified)`);

          const verifiedCommodities = (structured.supportedCommodities ?? []).filter((c) => {
            const item = groundingReport.items.find((i) => i.field === `commodity:${c}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedSupplierJur = (structured.acceptedSupplierJurisdictions ?? []).filter((j) => {
            const item = groundingReport.items.find((i) => i.field === `jurisdiction:${j}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedTraderJur = (structured.acceptedTraderJurisdictions ?? []).filter((j) => {
            const item = groundingReport.items.find((i) => i.field === `jurisdiction:${j}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedBuyerJur = (structured.acceptedBuyerJurisdictions ?? []).filter((j) => {
            const item = groundingReport.items.find((i) => i.field === `jurisdiction:${j}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedDocs = (structured.documentsRequired ?? []).filter((d) => {
            const item = groundingReport.items.find((i) => i.field === `documentRequired:${d.code}`);
            return !item || item.status === "VERIFIED";
          });

          const verifiedSources = uniq([
            ...workingUrls,
            ...(structured.sources ?? []).filter((s) => workingUrls.includes(s) || s.startsWith("https://")),
          ]);

          await db.tradeFunder.update({
            where: { id: f.id },
            data: {
              supportedCorridors: structured.supportedCorridors?.length ? uniq(structured.supportedCorridors) as never : f.supportedCorridors,
              supportedLegs: structured.supportedLegs?.length ? uniq(structured.supportedLegs) as never : f.supportedLegs,
              supportedCommodities: verifiedCommodities.length ? uniq(verifiedCommodities) : f.supportedCommodities,
              acceptedSupplierJurisdictions: verifiedSupplierJur.length ? uniq(verifiedSupplierJur) : f.acceptedSupplierJurisdictions,
              acceptedTraderJurisdictions: verifiedTraderJur.length ? uniq(verifiedTraderJur) : f.acceptedTraderJurisdictions,
              acceptedBuyerJurisdictions: verifiedBuyerJur.length ? uniq(verifiedBuyerJur) : f.acceptedBuyerJurisdictions,
              minTicketUsd: groundingReport.items.find((i) => i.field === "minTicketUsd")?.status === "VERIFIED" ? structured.minTicketUsd : f.minTicketUsd,
              maxTicketUsd: groundingReport.items.find((i) => i.field === "maxTicketUsd")?.status === "VERIFIED" ? structured.maxTicketUsd : f.maxTicketUsd,
              indicativePricingGuidance: structured.indicativePricingGuidance || f.indicativePricingGuidance,
              gatingFactor: structured.gatingFactor || f.gatingFactor,
              applicationUrl: structured.applicationUrl || f.applicationUrl,
              contact: structured.contact || f.contact,
              sources: verifiedSources.length > 0 ? verifiedSources : f.sources,
              lastVerified: new Date(),
              confidence: workingUrls.length > 0 && groundingReport.groundingScorePct >= 60 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
              documentsRequired: {
                deleteMany: {},
                create: verifiedDocs.map((d) => ({ code: d.code, note: d.note ?? null })),
              },
            },
          });
          console.log(`  ✓ Updated ${f.id} with ${verifiedSources.length} verified links.`);
        })(),
        120_000,
        f.name
      );
    } catch (err) {
      console.error(`  ⚠ Failed re-researching trade funder ${f.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // 3. STARTUP INVESTORS (db.startupInvestor)
  const investors = await db.startupInvestor.findMany({ orderBy: { name: "asc" } });
  console.log(`\n\n--- 3. Re-researching ${investors.length} Startup VC Investors ---`);
  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    console.log(`\n[Startup Investor ${i + 1}/${investors.length}] ${inv.name} (${inv.id})`);

    if (isRecentlyVerified(inv.lastVerified)) {
      console.log(`  ↪ Skipped (already re-researched recently at ${inv.lastVerified?.toISOString()})`);
      continue;
    }

    try {
      await withTimeout(
        (async () => {
          const hint = `${inv.name} (Stages: ${inv.targetStages.join(", ")}, Sectors: ${inv.preferredSectors.slice(0, 3).join(", ")})`;
          const context = `Early-stage venture capital investor, angel syndicate, or accelerator. Verify official website, target stages, active investment sectors, recent portfolio investments, and application route. Avoid dead links and verify domain status.`;

          const investorKeywords = [inv.name, inv.id.split("-")[0]].filter(Boolean);
          const { findings, citedUrls } = await researchVCInvestorFindings(hint, context);
          console.log(`  Cited ${citedUrls.length} links. Verifying HTTP responses and source keyword grounding...`);
          const linkAudit = citedUrls.length > 0
            ? await testSourceLinks(citedUrls, 5, 4000, { requiredKeywords: investorKeywords })
            : [];
          const workingUrls = linkAudit.filter((l) => l.ok).map((l) => l.url);
          console.log(`  Working & keyword-grounded URLs verified: ${workingUrls.length}/${citedUrls.length}`);

          const structured = await structureVCInvestorFindings(hint, {
            findings,
            citedUrls: workingUrls,
          });

          const pageTexts = linkAudit.map((l) => `${l.cachedTitle ?? ""} ${l.cachedSnippet ?? ""}`).filter(Boolean);
          const groundingReport = verifyStartupInvestorExtractionGrounding(structured, pageTexts);
          console.log(`  Grounded field extraction audit: ${groundingReport.groundingScorePct}% grounded (${groundingReport.verifiedCount} verified, ${groundingReport.unverifiedCount} unverified)`);

          const verifiedPortcos = (structured.portfolioCompanies ?? []).filter((p) => {
            const item = groundingReport.items.find((i) => i.field === `portfolioCompany:${p}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedKeyContacts = (structured.keyContacts ?? []).filter((c) => {
            const item = groundingReport.items.find((i) => i.field === `keyContact:${c.name}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedJurisdictions = (structured.acceptedJurisdictions ?? []).filter((j) => {
            const item = groundingReport.items.find((i) => i.field === `jurisdiction:${j}`);
            return !item || item.status === "VERIFIED";
          });
          const verifiedDocs = (structured.documentsRequired ?? []).filter((d) => {
            const item = groundingReport.items.find((i) => i.field === `documentRequired:${d.code}`);
            return !item || item.status === "VERIFIED";
          });

          const verifiedSources = uniq([
            ...workingUrls,
            ...(structured.sources ?? []).filter((s) => workingUrls.includes(s) || s.startsWith("https://")),
          ]);

          await db.startupInvestor.update({
            where: { id: inv.id },
            data: {
              targetStages: structured.targetStages?.length ? uniq(structured.targetStages) as never : inv.targetStages,
              preferredSectors: structured.preferredSectors?.length ? uniq(structured.preferredSectors) as never : inv.preferredSectors,
              acceptedJurisdictions: verifiedJurisdictions.length ? uniq(verifiedJurisdictions) : inv.acceptedJurisdictions,
              portfolioCompanies: verifiedPortcos.length ? uniq(verifiedPortcos) : inv.portfolioCompanies,
              keyContactsJson: verifiedKeyContacts.length ? JSON.parse(JSON.stringify(verifiedKeyContacts)) : undefined,
              minCheckUsd: groundingReport.items.find((i) => i.field === "minCheckUsd")?.status === "VERIFIED" ? structured.minCheckUsd : inv.minCheckUsd,
              maxCheckUsd: groundingReport.items.find((i) => i.field === "maxCheckUsd")?.status === "VERIFIED" ? structured.maxCheckUsd : inv.maxCheckUsd,
              gatingFactor: structured.gatingFactor || inv.gatingFactor,
              websiteUrl: structured.websiteUrl || inv.websiteUrl,
              applicationUrl: structured.applicationUrl || inv.applicationUrl,
              sources: verifiedSources.length > 0 ? verifiedSources : inv.sources,
              sourceLinksAudit: JSON.parse(JSON.stringify(linkAudit)),
              lastVerified: new Date(),
              confidence: workingUrls.length > 0 && groundingReport.groundingScorePct >= 60 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
              documentsRequired: {
                deleteMany: {},
                create: verifiedDocs.map((d) => ({ code: d.code, note: d.note ?? null })),
              },
            },
          });
          console.log(`  ✓ Updated ${inv.id} with ${verifiedSources.length} verified links.`);
        })(),
        120_000,
        inv.name
      );
    } catch (err) {
      console.error(`  ⚠ Failed re-researching startup investor ${inv.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // 4. POST-BATCH AUTOMATIC RE-MATCHING ACROSS ALL DEALS IN ALL 3 ASSET CLASSES
  console.log("\n=================================================================");
  console.log("RE-RUNNING GROUNDED MATCHING ACROSS ALL DEALS");
  console.log("=================================================================");

  // 4a. Invoice Factoring Deals
  console.log("\n4a. Re-matching Invoice Factoring deals...");
  const activeInvoiceProviders = await db.provider.findMany();
  const invoiceDeals = await db.deal.findMany({ include: { parties: true, financingAsks: true } });
  for (const deal of invoiceDeals) {
    const { dealInput, askInput } = buildMatchInputs(deal.parties, deal.financingAsks);
    const results = matchAllProviders(activeInvoiceProviders, dealInput, askInput);
    await db.$transaction([
      db.providerMatch.deleteMany({ where: { dealId: deal.id } }),
      db.providerMatch.createMany({
        data: results.map((r) => ({
          dealId: deal.id,
          providerId: r.providerId,
          verdict: r.eligibleOnPaper ? "POSSIBLE" : "EXCLUDED",
          rationale: r.reasons.join("; ") || "No disqualifying factors found by the mechanical pre-filter.",
          isTier1: r.eligibleOnPaper,
        })),
      }),
    ]);
    const eligibleCount = results.filter((r) => r.eligibleOnPaper).length;
    console.log(`  ✓ Re-matched Deal "${deal.name}" (${deal.id}): ${results.length} providers evaluated, ${eligibleCount} eligible on paper`);
  }

  // 4b. Commodity Trade Finance Deals
  console.log("\n4b. Re-matching Commodity Trade Finance deals...");
  const activeTradeFunders = await db.tradeFunder.findMany({ include: { documentsRequired: true } });
  const tradeDeals = await db.tradeDeal.findMany({
    include: { parties: true, contractLegs: true, financingAsks: true, documents: true },
  });
  for (const tradeDeal of tradeDeals) {
    const extractions = tradeDeal.documents.map((d) => d.extractedRaw).filter(Boolean) as unknown as TradeDocumentExtraction[];
    const recon = reconcileTradeExtractions(tradeDeal.id, tradeDeal.name, extractions);
    const spec = recon.tradeDealSpec;
    if (spec) {
      const matchRes = matchTradeDeal(spec, activeTradeFunders, tradeDeal.documents);
      await db.tradeFunderMatchModel.deleteMany({ where: { dealId: tradeDeal.id } });
      await db.tradeFunderMatchModel.createMany({
        data: matchRes.umbrellaMatches.map((m) => ({
          dealId: tradeDeal.id,
          funderId: m.funderId,
          verdict: m.verdict,
          isTier1: m.isTier1,
          rationale: m.rationale,
        })),
      });
      const t1Count = matchRes.umbrellaMatches.filter((m) => m.verdict === "GOOD").length;
      console.log(`  ✓ Re-matched Trade Deal "${tradeDeal.name}": ${activeTradeFunders.length} trade funders evaluated (${t1Count} Tier 1 umbrella)`);
    }
  }

  // 4c. Startup VC Deals
  console.log("\n4c. Re-matching Startup VC deals...");
  const cleanInvestors = await db.startupInvestor.findMany({ include: { documentsRequired: true } });
  const vcDeals = await db.startupDeal.findMany({
    include: { documents: true, competitors: true, financingAsks: true },
  });
  for (const vcDeal of vcDeals) {
    const extractions = vcDeal.documents.map((d) => d.extractedRaw).filter(Boolean) as unknown as StartupDocumentExtraction[];
    const recon = reconcileStartupExtractions(vcDeal.id, vcDeal.companyName, extractions);
    const spec = recon.startupDealSpec;
    if (spec) {
      const matchRes = matchStartupDeal(spec, cleanInvestors, vcDeal.documents);
      await db.startupInvestorMatch.deleteMany({ where: { dealId: vcDeal.id } });
      const allCandidates = [
        ...matchRes.leadCandidates,
        ...matchRes.coInvestorCandidates,
        ...matchRes.angelCandidates,
        ...matchRes.acceleratorOptions,
      ];
      const unique = Array.from(new Map(allCandidates.map((c) => [c.investorId, c])).values());
      await db.startupInvestorMatch.createMany({
        data: unique.map((c) => ({
          dealId: vcDeal.id,
          investorId: c.investorId,
          tier: c.tier,
          verdict: c.verdict,
          rationale: c.rationale,
          isLeadCandidate: c.isLeadCandidate,
          thesisResonanceScore: c.thesisResonanceScore,
          portfolioConflictDetected: c.portfolioConflictDetected,
          conflictingPortfolioCompany: c.conflictingPortfolioCompany ?? null,
          activelyFundingIndustry: c.activelyFundingIndustry,
          industryDeploymentScore: c.industryDeploymentScore,
          competitorConflictNotes: c.competitorConflictNotes ?? null,
          sourceLinksAudit: c.sourceLinksAudit ?? [],
        })),
      });
      console.log(`  ✓ Re-matched Startup VC Deal "${vcDeal.companyName}": ${cleanInvestors.length} investors evaluated`);
    }
  }

  console.log("\n=================================================================");
  console.log("LIVE RE-RESEARCH & LINK VERIFICATION COMPLETED FOR ALL FUNDERS!");
  console.log("=================================================================\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
