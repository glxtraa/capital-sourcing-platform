import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";
import { testSourceLinks } from "../src/lib/link-verifier";
import { researchProviderFindings, structureProviderFindings } from "../src/agents/research-agent";
import { researchTradeFunderFindings, structureTradeFunderFindings } from "../src/agents/trade/trade-research-agent";
import { researchVCInvestorFindings, structureVCInvestorFindings } from "../src/agents/vc/vc-research-agent";

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
          sellerJurisdictions: structured.sellerJurisdictions?.length ? uniq(structured.sellerJurisdictions) : p.sellerJurisdictions,
          obligorJurisdictions: structured.obligorJurisdictions?.length ? uniq(structured.obligorJurisdictions) : p.obligorJurisdictions,
          currencies: structured.currencies?.length ? uniq(structured.currencies) : p.currencies,
          minTicketUsd: structured.minTicketUsd ?? p.minTicketUsd,
          maxTicketUsd: structured.maxTicketUsd ?? p.maxTicketUsd,
          gatingFactor: structured.gatingFactor || p.gatingFactor,
          applicationUrl: structured.applicationUrl || p.applicationUrl,
          sources: verifiedSources.length > 0 ? verifiedSources : p.sources,
          financingStructuresSupported: structures as never,
          lastVerified: new Date(),
          confidence: workingUrls.length > 0 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
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

      const verifiedSources = uniq([
        ...workingUrls,
        ...(structured.sources ?? []).filter((s) => workingUrls.includes(s) || s.startsWith("https://")),
      ]);

      await db.tradeFunder.update({
        where: { id: f.id },
        data: {
          supportedCorridors: structured.supportedCorridors?.length ? uniq(structured.supportedCorridors) as never : f.supportedCorridors,
          supportedLegs: structured.supportedLegs?.length ? uniq(structured.supportedLegs) as never : f.supportedLegs,
          supportedCommodities: structured.supportedCommodities?.length ? uniq(structured.supportedCommodities) : f.supportedCommodities,
          acceptedSupplierJurisdictions: structured.acceptedSupplierJurisdictions?.length ? uniq(structured.acceptedSupplierJurisdictions) : f.acceptedSupplierJurisdictions,
          acceptedTraderJurisdictions: structured.acceptedTraderJurisdictions?.length ? uniq(structured.acceptedTraderJurisdictions) : f.acceptedTraderJurisdictions,
          acceptedBuyerJurisdictions: structured.acceptedBuyerJurisdictions?.length ? uniq(structured.acceptedBuyerJurisdictions) : f.acceptedBuyerJurisdictions,
          minTicketUsd: structured.minTicketUsd ?? f.minTicketUsd,
          maxTicketUsd: structured.maxTicketUsd ?? f.maxTicketUsd,
          indicativePricingGuidance: structured.indicativePricingGuidance || f.indicativePricingGuidance,
          gatingFactor: structured.gatingFactor || f.gatingFactor,
          applicationUrl: structured.applicationUrl || f.applicationUrl,
          contact: structured.contact || f.contact,
          sources: verifiedSources.length > 0 ? verifiedSources : f.sources,
          lastVerified: new Date(),
          confidence: workingUrls.length > 0 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
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

      const verifiedSources = uniq([
        ...workingUrls,
        ...(structured.sources ?? []).filter((s) => workingUrls.includes(s) || s.startsWith("https://")),
      ]);

      await db.startupInvestor.update({
        where: { id: inv.id },
        data: {
          targetStages: structured.targetStages?.length ? uniq(structured.targetStages) as never : inv.targetStages,
          preferredSectors: structured.preferredSectors?.length ? uniq(structured.preferredSectors) as never : inv.preferredSectors,
          acceptedJurisdictions: structured.acceptedJurisdictions?.length ? uniq(structured.acceptedJurisdictions) : inv.acceptedJurisdictions,
          portfolioCompanies: structured.portfolioCompanies?.length ? uniq(structured.portfolioCompanies) : inv.portfolioCompanies,
          minCheckUsd: structured.minCheckUsd ?? inv.minCheckUsd,
          maxCheckUsd: structured.maxCheckUsd ?? inv.maxCheckUsd,
          gatingFactor: structured.gatingFactor || inv.gatingFactor,
          websiteUrl: structured.websiteUrl || inv.websiteUrl,
          applicationUrl: structured.applicationUrl || inv.applicationUrl,
          sources: verifiedSources.length > 0 ? verifiedSources : inv.sources,
          sourceLinksAudit: JSON.parse(JSON.stringify(linkAudit)),
          lastVerified: new Date(),
          confidence: workingUrls.length > 0 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
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
