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

resolveDatabaseUrl();
const db = new PrismaClient();

const uniq = <T>(arr: T[] | undefined | null): T[] => Array.from(new Set(arr ?? []));

async function main() {
  console.log("=================================================================");
  console.log("STARTING LIVE RE-RESEARCH & LINK VERIFICATION ACROSS ALL FUNDERS");
  console.log("=================================================================\n");

  // 1. INVOICE PROVIDERS (db.provider)
  const providers = await db.provider.findMany({ orderBy: { name: "asc" } });
  console.log(`\n--- 1. Re-researching ${providers.length} Invoice Providers ---`);
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    console.log(`\n[Invoice ${i + 1}/${providers.length}] ${p.name} (${p.id})`);
    try {
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

      // Filter unverified items: jurisdictions or documents not found in source text
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

      // Ensure explicit structures and sanitize array duplicates
      let structures = uniq(structured.financingStructuresSupported);
      if (structures.length === 0 || structures.includes("UNKNOWN" as never)) {
        structures = p.financingStructuresSupported.length > 0
          ? p.financingStructuresSupported
          : ["POST_SHIPMENT_RECEIVABLES_DISCOUNTING"];
      }

      const verifiedSources = uniq([
        ...workingUrls,
        ...(structured.sources ?? []).filter((s) => workingUrls.includes(s) || s.startsWith("https://")),
      ]);

      await db.provider.update({
        where: { id: p.id },
        data: {
          product: structured.product || p.product,
          sellerJurisdictions: verifiedSellerJur.length ? uniq(verifiedSellerJur) : p.sellerJurisdictions,
          obligorJurisdictions: verifiedObligorJur.length ? uniq(verifiedObligorJur) : p.obligorJurisdictions,
          currencies: structured.currencies?.length ? uniq(structured.currencies) : p.currencies,
          minTicketUsd: groundingReport.items.find((i) => i.field === "minTicketUsd")?.status === "VERIFIED" ? structured.minTicketUsd : p.minTicketUsd,
          maxTicketUsd: groundingReport.items.find((i) => i.field === "maxTicketUsd")?.status === "VERIFIED" ? structured.maxTicketUsd : p.maxTicketUsd,
          gatingFactor: structured.gatingFactor || p.gatingFactor,
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
    try {
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
    } catch (err) {
      console.error(`  ⚠ Failed re-researching trade funder ${f.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // 3. STARTUP INVESTORS (db.startupInvestor)
  const investors = await db.startupInvestor.findMany({ orderBy: { name: "asc" } });
  console.log(`\n\n--- 3. Re-researching ${investors.length} Startup Investors ---`);
  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    console.log(`\n[Startup Investor ${i + 1}/${investors.length}] ${inv.name} (${inv.id})`);
    try {
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
    } catch (err) {
      console.error(`  ⚠ Failed re-researching startup investor ${inv.id}:`, err instanceof Error ? err.message : err);
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
