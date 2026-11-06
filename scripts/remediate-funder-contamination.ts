import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";
import { matchAllProviders, buildMatchInputs } from "../src/lib/matching";
import { matchTradeDeal } from "../src/lib/trade-matching";
import { matchStartupDeal } from "../src/lib/vc-matching";
import { reconcileTradeExtractions } from "../src/agents/trade/trade-reconciliation";
import { reconcileStartupExtractions } from "../src/agents/vc/vc-reconciliation";
import type { TradeDocumentExtraction } from "../src/dsl/trade/trade-extraction-schema";
import type { StartupDocumentExtraction } from "../src/dsl/vc";

resolveDatabaseUrl();
const db = new PrismaClient();

async function main() {
  console.log("=== STARTING CROSS-ASSET CONTAMINATION REMEDIATION ===");

  // 1. COMMODITY FUNDERS TO MIGRATE FROM db.provider -> db.tradeFunder
  const commodityMigrateIds = [
    "bca-coal-smelter-syndicate",
    "bri-supply-chain-financing",
    "boc-commodity-business-centers",
    "chinese-state-banks-trade-finance-sg",
    "dbs-sg-commodity-trade-finance",
    "ing-trade-solutions",
    "ocbc-sg-commodity-trade-finance",
    "scipion-capital",
    "standard-chartered-commodity-trade-finance",
    "tradeflow-capital",
    "terra-trade-trade-finance-platform",
    "00000000-0000-0000-0000-000000000000", // TransAsia Private Capital
  ];

  // Specific migration mappings into db.tradeFunder
  const tradeFunderSpecs: Record<string, {
    targetId: string;
    name: string;
    type: string;
    corridors: string[];
    commodities: string[];
    legs: string[];
    offersUmbrella: boolean;
    supplierJur: string[];
    traderJur: string[];
    buyerJur: string[];
    minTicket?: number;
    maxTicket?: number;
    gatingFactor?: string;
    notes?: string;
  }> = {
    "bca-coal-smelter-syndicate": {
      targetId: "bca-commodity-trade-desk",
      name: "Bank Central Asia (BCA) — Coal & Smelter Financing Desk",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "OTHER_CROSS_BORDER"],
      commodities: ["Thermal Coal", "Alumina", "Metals"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG"],
      offersUmbrella: false,
      supplierJur: ["Indonesia"],
      traderJur: ["Indonesia", "Singapore"],
      buyerJur: ["Indonesia", "China", "Asia"],
      gatingFactor: "Joined a 5-bank syndicate financing an Adaro captive-coal aluminum smelter; smaller coal book than Mandiri/BNI.",
      notes: "Relevant for captive power and smelter commodity supply chains.",
    },
    "bri-supply-chain-financing": {
      targetId: "bri-commodity-trade-finance",
      name: "Bank Rakyat Indonesia (BRI) — Commodity Supply Chain Financing",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL"],
      commodities: ["Thermal Coal", "Crude Palm Oil", "Agri Commodities"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG"],
      offersUmbrella: false,
      supplierJur: ["Indonesia"],
      traderJur: ["Indonesia"],
      buyerJur: ["Indonesia", "Asia"],
      gatingFactor: "Historically largest cumulative Indonesian coal lender. Named SCF product with defined 30/60/90-day tenors.",
      notes: "Pre-export borrowing base & vendor financing for mining/commodity operations.",
    },
    "boc-commodity-business-centers": {
      targetId: "boc-commodity-business-centers",
      name: "Bank of China — Global Commodity Business Centers",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "LATAM_SEAFOOD_ASIA", "OTHER_CROSS_BORDER"],
      commodities: ["Thermal Coal", "Metals", "Crude Palm Oil", "Grains", "Seafood"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG", "UMBRELLA"],
      offersUmbrella: true,
      supplierJur: ["Singapore", "Indonesia", "Global"],
      traderJur: ["Singapore", "Hong Kong", "China", "London"],
      buyerJur: ["China", "Global"],
      gatingFactor: "Dedicated commodity desks (Singapore, London, New York, Shanghai); strong for China-linked flows.",
    },
    "chinese-state-banks-trade-finance-sg": {
      targetId: "chinese-state-banks-trade-desk-sg",
      name: "Chinese State Banks Trade Desk (ICBC, CCB, BOC Singapore)",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Thermal Coal", "Crude Palm Oil", "Base Metals", "Agricultural Commodities"],
      legs: ["TRADER_LEG", "BUYER_LEG"],
      offersUmbrella: false,
      supplierJur: ["Indonesia", "Southeast Asia"],
      traderJur: ["Singapore", "Hong Kong"],
      buyerJur: ["China", "Asia"],
      gatingFactor: "State bank commodity trade finance via Singapore branches expanding appetite in Asian corridors.",
    },
    "dbs-sg-commodity-trade-finance": {
      targetId: "dbs-sg-commodity-desk",
      name: "DBS Bank Singapore — Structured Commodity & Trade Finance",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Thermal Coal", "Metals", "Crude Palm Oil", "Energy"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG", "UMBRELLA"],
      offersUmbrella: true,
      supplierJur: ["Singapore", "Indonesia", "Global"],
      traderJur: ["Singapore"],
      buyerJur: ["Global"],
      gatingFactor: "Structured commodity facilities, pre-export finance, inventory/warehouse facilities for commodity trading houses.",
    },
    "ing-trade-solutions": {
      targetId: "ing-commodity-trade-desk",
      name: "ING — Commodity Trade & Energy Desks",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Agri Commodities", "Energy", "Metals"],
      legs: ["TRADER_LEG", "BUYER_LEG", "UMBRELLA"],
      offersUmbrella: true,
      supplierJur: ["Singapore", "Global"],
      traderJur: ["Singapore", "Europe"],
      buyerJur: ["Europe", "Global"],
      gatingFactor: "Specialist commodity desks covering energy, metals, and agri/softs with digital trade execution.",
    },
    "ocbc-sg-commodity-trade-finance": {
      targetId: "ocbc-sg-commodity-desk",
      name: "OCBC Singapore — Structured Trade & Commodity Finance",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Thermal Coal", "Crude Palm Oil", "Rubber", "Metals"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG", "UMBRELLA"],
      offersUmbrella: true,
      supplierJur: ["Singapore", "Indonesia", "Malaysia"],
      traderJur: ["Singapore"],
      buyerJur: ["Asia", "Global"],
      gatingFactor: "Active documentary trade finance book and structured commodity finance desk.",
    },
    "scipion-capital": {
      targetId: "scipion-commodity-trade-fund",
      name: "Scipion Capital — Commodity Trade Finance Fund",
      type: "SPECIALIST_TRADE_FUND",
      corridors: ["SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Agricultural Commodities", "Minerals", "Metals"],
      legs: ["TRADER_LEG", "BUYER_LEG"],
      offersUmbrella: false,
      supplierJur: ["Global"],
      traderJur: ["United Kingdom", "Singapore", "Switzerland"],
      buyerJur: ["Global"],
      gatingFactor: "London-based structured commodity trade finance; targets transactions below bank lending radar.",
    },
    "standard-chartered-commodity-trade-finance": {
      targetId: "standard-chartered-commodity-desk",
      name: "Standard Chartered — Structured & Commodity Trade Finance",
      type: "COMMODITY_TRADE_FINANCE_BANK",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Thermal Coal", "Crude Palm Oil", "Metals", "Soft Commodities"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG", "UMBRELLA"],
      offersUmbrella: true,
      supplierJur: ["Singapore", "Indonesia", "Global"],
      traderJur: ["Singapore", "Hong Kong", "London"],
      buyerJur: ["Asia", "Africa", "Middle East", "Global"],
      gatingFactor: "Large syndicated-facility scale institution; strong Asia-Africa-Middle East corridor focus.",
    },
    "tradeflow-capital": {
      targetId: "tradeflow-capital-singapore",
      name: "TradeFlow Capital Management (Singapore)",
      type: "SPECIALIST_TRADE_FUND",
      corridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "LATAM_SEAFOOD_ASIA", "OTHER_CROSS_BORDER"],
      commodities: ["Bulk Commodities", "Thermal Coal", "Crude Palm Oil", "Grains", "Frozen Seafood"],
      legs: ["SUPPLIER_LEG", "TRADER_LEG"],
      offersUmbrella: false,
      supplierJur: ["Global"],
      traderJur: ["Singapore", "Global"],
      buyerJur: ["Global"],
      gatingFactor: "Non-bank physical-risk underwriting model for bulk commodities (pre-shipment & procurement).",
    },
    "terra-trade-trade-finance-platform": {
      targetId: "terratrade-agri-desk",
      name: "TerraTrade — Commodity & Agri Trade Desk",
      type: "SPECIALIST_TRADE_FUND",
      corridors: ["SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
      commodities: ["Agri Commodities", "Coffee", "Spices", "Grains"],
      legs: ["SUPPLIER_LEG", "BUYER_LEG"],
      offersUmbrella: false,
      supplierJur: ["South Asia", "Southeast Asia", "Hong Kong"],
      traderJur: ["Hong Kong", "Singapore"],
      buyerJur: ["OECD countries", "Global"],
      gatingFactor: "Receivables purchase and pre-shipment advance platform for physical agricultural exports.",
    },
    "00000000-0000-0000-0000-000000000000": {
      targetId: "transasia-private-capital",
      name: "TransAsia Private Capital Limited",
      type: "SPECIALIST_TRADE_FUND",
      corridors: ["SEA_AGRI_GLOBAL", "IDN_COAL_ASIA", "OTHER_CROSS_BORDER"],
      commodities: ["Bulk Commodities", "Agri Commodities", "Metals"],
      legs: ["TRADER_LEG", "BUYER_LEG"],
      offersUmbrella: false,
      supplierJur: ["APAC"],
      traderJur: ["Hong Kong", "Singapore", "APAC"],
      buyerJur: ["APAC", "Global"],
      gatingFactor: "Secured, self-liquidating trade credit structures backed by ring-fenced operating assets.",
    },
  };

  console.log("\n1. Migrating commodity funders into db.tradeFunder...");
  for (const [sourceId, spec] of Object.entries(tradeFunderSpecs)) {
    const existing = await db.tradeFunder.findUnique({ where: { id: spec.targetId } });
    if (!existing) {
      await db.tradeFunder.create({
        data: {
          id: spec.targetId,
          name: spec.name,
          type: spec.type as never,
          offersUmbrellaFacility: spec.offersUmbrella,
          supportedLegs: spec.legs as never,
          supportedCorridors: spec.corridors as never,
          supportedCommodities: spec.commodities,
          excludedCommodities: [],
          acceptedSupplierJurisdictions: spec.supplierJur,
          acceptedTraderJurisdictions: spec.traderJur,
          acceptedBuyerJurisdictions: spec.buyerJur,
          minTicketUsd: spec.minTicket ?? 1000000,
          maxTicketUsd: spec.maxTicket ?? 50000000,
          indicativePricingGuidance: "SOFR + 350-550 bps / bilateral tariff model",
          gatingFactor: spec.gatingFactor,
          confidence: "VERIFIED_SECONDARY",
          lastVerified: new Date(),
          sources: ["https://tr3.io/capital-sourcing"],
          notes: spec.notes,
        },
      });
      console.log(`  ✓ Created TradeFunder: ${spec.targetId} (${spec.name})`);
    } else {
      console.log(`  - TradeFunder already exists: ${spec.targetId}`);
    }
  }

  // Consolidate BNI in db.tradeFunder
  const bniLegacyDesk = await db.tradeFunder.findUnique({ where: { id: "bni-commodity-trade-desk" } });
  if (bniLegacyDesk) {
    await db.tradeFunder.update({
      where: { id: "bni-structured-trade-finance" },
      data: {
        supportedLegs: ["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG", "UMBRELLA"],
        supportedCorridors: ["IDN_COAL_ASIA", "SEA_AGRI_GLOBAL", "OTHER_CROSS_BORDER"],
        supportedCommodities: ["Thermal Coal", "Coking Coal", "Crude Palm Oil", "Nickel Ore", "Rubber", "Coffee", "Rice"],
      },
    });
    // Remove duplicate bni-commodity-trade-desk
    await db.tradeFunderDocumentRequirement.deleteMany({ where: { funderId: "bni-commodity-trade-desk" } });
    await db.tradeFunderMatchModel.deleteMany({ where: { funderId: "bni-commodity-trade-desk" } });
    await db.tradeFunder.delete({ where: { id: "bni-commodity-trade-desk" } });
    console.log("  ✓ Consolidated BNI desks into bni-structured-trade-finance in db.tradeFunder");
  }

  // 2. DELETE COMMODITY & RETREATED FUNDERS FROM db.provider
  console.log("\n2. Removing commodity, closed, and retreated records from db.provider...");
  const deleteFromProviderIds = [
    ...commodityMigrateIds,
    "abn-amro-socgen-bnp-commodity-retreat",
    "kimura-capital-closed",
    "bank-mandiri-coal",
    "bni-structured-trade-finance",
  ];

  for (const pid of deleteFromProviderIds) {
    await db.providerMatch.deleteMany({ where: { providerId: pid } });
    await db.providerOnboarding.deleteMany({ where: { providerId: pid } });
    await db.providerDocumentRequirement.deleteMany({ where: { providerId: pid } });
    await db.researchTask.deleteMany({ where: { providerId: pid } });
    await db.providerCandidate.updateMany({ where: { promotedProviderId: pid }, data: { promotedProviderId: null } });
    const del = await db.provider.deleteMany({ where: { id: pid } });
    if (del.count > 0) {
      console.log(`  ✓ Deleted ${del.count} record from db.provider: ${pid}`);
    }
  }

  // Update candidate promo link for TransAsia
  await db.providerCandidate.updateMany({
    where: { name: "TransAsia Private Capital Limited" },
    data: { promotedProviderId: "transasia-private-capital" },
  });

  // 3. BACKFILL & CLEAN REMAINING INVOICE PROVIDERS IN db.provider
  console.log("\n3. Backfilling explicit structures for legitimate Invoice Factoring providers...");
  const invoiceProviders = await db.provider.findMany();
  for (const p of invoiceProviders) {
    let structures: string[] = ["POST_SHIPMENT_RECEIVABLES_DISCOUNTING"];
    if (p.id === "boc-hk-supply-chain-finance" || p.id === "enterprise-scf-platforms" || p.id === "smbc-receivables-finance") {
      structures = ["ENTERPRISE_SCF_REVERSE_FACTORING"];
    } else if (p.id === "sy-holdings") {
      structures = ["POST_SHIPMENT_RECEIVABLES_DISCOUNTING", "ENTERPRISE_SCF_REVERSE_FACTORING"];
    } else if (p.id === "ecom-registry-ecom-datafin") {
      structures = ["POST_SHIPMENT_RECEIVABLES_DISCOUNTING"];
    }
    await db.provider.update({
      where: { id: p.id },
      data: {
        financingStructuresSupported: structures as never,
        type: p.id === "ecom-registry-ecom-datafin" ? "PRIVATE_CREDIT_FUND" : p.type,
      },
    });
    console.log(`  ✓ Updated ${p.id}: structures=${JSON.stringify(structures)}`);
  }

  // 4. CLEAN DUPLICATE & INELIGIBLE STARTUP INVESTORS (db.startupInvestor)
  console.log("\n4. Cleaning ineligible non-VC organizations and duplicates from db.startupInvestor...");
  const nonVCInvestorIds = [
    "barnwell-capital-llc",
    "kfw-dev-bank",
    "climate-investment-funds",
    "startupinvestor-global-environment-facility",
    "citi-foundation",
    "sustainable-development-investment-partnership",
    "sdip-001",
    "sdip-sustainable-development-investment-partnership",
    "startup-investor-tnc",
    "ford-foundation-2024",
    "rockefeller-foundation",
  ];

  for (const iid of nonVCInvestorIds) {
    await db.startupInvestorMatch.deleteMany({ where: { investorId: iid } });
    await db.startupInvestorDocumentRequirement.deleteMany({ where: { investorId: iid } });
    const del = await db.startupInvestor.deleteMany({ where: { id: iid } });
    if (del.count > 0) {
      console.log(`  ✓ Deleted non-VC/DFI record from db.startupInvestor: ${iid}`);
    }
  }

  // Merge duplicates in db.startupInvestor:
  // A. Green Angel Ventures
  const gaDups = ["startupinvestor-greenangelventures", "green-angel-syndicate-green-angel-ventures"];
  for (const dup of gaDups) {
    await db.startupInvestorMatch.deleteMany({ where: { investorId: dup } });
    await db.startupInvestorDocumentRequirement.deleteMany({ where: { investorId: dup } });
    await db.startupInvestor.deleteMany({ where: { id: dup } });
  }
  await db.startupInvestor.update({
    where: { id: "green-angel-ventures" },
    data: {
      preferredSectors: ["CLIMATETECH"],
      targetStages: ["PRE_SEED", "SEED", "SERIES_A"],
    },
  });
  console.log("  ✓ Merged Green Angel Ventures into canonical green-angel-ventures");

  // B. Titan Fund
  await db.startupInvestorMatch.deleteMany({ where: { investorId: "titan-fund-hk-web3-seed" } });
  await db.startupInvestorDocumentRequirement.deleteMany({ where: { investorId: "titan-fund-hk-web3-seed" } });
  await db.startupInvestor.deleteMany({ where: { id: "titan-fund-hk-web3-seed" } });
  await db.startupInvestor.update({
    where: { id: "titan-fund-hk-web3-crypto-vc" },
    data: {
      preferredSectors: ["WEB3_CRYPTO", "FINTECH", "GENERATIVE_AI_APPS", "CONSUMER", "DEV_TOOLS", "MARKETPLACE_PLATFORM"],
      targetStages: ["PRE_SEED", "SEED", "SERIES_A", "SERIES_B"],
    },
  });
  console.log("  ✓ Merged Titan Fund into canonical titan-fund-hk-web3-crypto-vc");

  // C. Accel
  await db.startupInvestorMatch.deleteMany({ where: { investorId: "accel-seed-venture" } });
  await db.startupInvestorDocumentRequirement.deleteMany({ where: { investorId: "accel-seed-venture" } });
  await db.startupInvestor.deleteMany({ where: { id: "accel-seed-venture" } });
  console.log("  ✓ Deduplicated Accel into canonical accel-institutional");

  // D. Sequoia Capital (keep sequoia-capital & sequoia-scout-program; delete duplicate sequoia-seed-fund)
  await db.startupInvestorMatch.deleteMany({ where: { investorId: "sequoia-seed-fund" } });
  await db.startupInvestorDocumentRequirement.deleteMany({ where: { investorId: "sequoia-seed-fund" } });
  await db.startupInvestor.deleteMany({ where: { id: "sequoia-seed-fund" } });
  console.log("  ✓ Deduplicated Sequoia Capital into canonical sequoia-capital");

  // Deduplicate preferredSectors and targetStages on all remaining startup investors
  const remainingInvestors = await db.startupInvestor.findMany();
  for (const inv of remainingInvestors) {
    const uniqStages = Array.from(new Set(inv.targetStages));
    const uniqSectors = Array.from(new Set(inv.preferredSectors));
    const uniqJur = Array.from(new Set(inv.acceptedJurisdictions));
    await db.startupInvestor.update({
      where: { id: inv.id },
      data: {
        targetStages: uniqStages as never,
        preferredSectors: uniqSectors as never,
        acceptedJurisdictions: uniqJur,
      },
    });
  }
  console.log(`  ✓ Cleaned array duplicates across ${remainingInvestors.length} remaining startup investors`);

  // 5. CLEAN LEGACY DUPLICATE PT KEM DEAL FROM db.deal (Invoice Deals)
  console.log("\n5. Cleaning legacy PT KEM duplicate from db.deal (Invoice table)...");
  const legacyKem = await db.deal.findUnique({ where: { id: "cmv6m7wbq0000lf06vcrvhnm2" } });
  if (legacyKem) {
    await db.providerMatch.deleteMany({ where: { dealId: "cmv6m7wbq0000lf06vcrvhnm2" } });
    await db.riskFlag.deleteMany({ where: { dealId: "cmv6m7wbq0000lf06vcrvhnm2" } });
    await db.financingAsk.deleteMany({ where: { dealId: "cmv6m7wbq0000lf06vcrvhnm2" } });
    await db.party.deleteMany({ where: { dealId: "cmv6m7wbq0000lf06vcrvhnm2" } });
    await db.uploadedDocument.deleteMany({ where: { dealId: "cmv6m7wbq0000lf06vcrvhnm2" } });
    await db.dealDslRevision.deleteMany({ where: { dealId: "cmv6m7wbq0000lf06vcrvhnm2" } });
    await db.deal.delete({ where: { id: "cmv6m7wbq0000lf06vcrvhnm2" } });
    console.log("  ✓ Deleted legacy duplicate PT KEM COAL from db.deal");
  }

  // 6. RE-RUN MATCHING ACROSS ALL 3 ASSET CLASSES
  console.log("\n6. Re-matching all Invoice Factoring deals...");
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

  console.log("\n7. Re-matching Commodity Trade Finance deal (PT KEM)...");
  const tradeFunders = await db.tradeFunder.findMany({ include: { documentsRequired: true } });
  const tradeDeal = await db.tradeDeal.findUnique({
    where: { id: "cmv6mz5su0000jv06eafonv6i" },
    include: { parties: true, contractLegs: true, financingAsks: true, documents: true },
  });
  if (tradeDeal) {
    const extractions = tradeDeal.documents.map((d) => d.extractedRaw).filter(Boolean) as unknown as TradeDocumentExtraction[];
    const recon = reconcileTradeExtractions(tradeDeal.id, tradeDeal.name, extractions);
    const spec = recon.tradeDealSpec;
    if (spec) {
      const matchRes = matchTradeDeal(spec, tradeFunders, tradeDeal.documents);
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
      console.log(`  ✓ Re-matched Trade Deal "${tradeDeal.name}": evaluated ${tradeFunders.length} trade funders (${matchRes.umbrellaMatches.filter(m => m.verdict === 'GOOD').length} Tier 1 umbrella)`);
    }
  }

  console.log("\n8. Re-matching Startup VC deals...");
  const cleanInvestors = await db.startupInvestor.findMany({ include: { documentsRequired: true } });
  const vcDeals = await db.startupDeal.findUnique({
    where: { id: "cmv9nnfld0000l6066ed7mbvo" }, // Trade3
    include: { documents: true, competitors: true, financingAsks: true },
  });
  if (vcDeals) {
    const extractions = vcDeals.documents.map((d) => d.extractedRaw).filter(Boolean) as unknown as StartupDocumentExtraction[];
    const recon = reconcileStartupExtractions(vcDeals.id, vcDeals.companyName, extractions);
    const spec = recon.startupDealSpec;
    if (spec) {
      const matchRes = matchStartupDeal(spec, cleanInvestors, vcDeals.documents);
      await db.startupInvestorMatch.deleteMany({ where: { dealId: vcDeals.id } });
      const allCandidates = [
        ...matchRes.leadCandidates,
        ...matchRes.coInvestorCandidates,
        ...matchRes.angelCandidates,
        ...matchRes.acceleratorOptions,
      ];
      const unique = Array.from(new Map(allCandidates.map((c) => [c.investorId, c])).values());
      await db.startupInvestorMatch.createMany({
        data: unique.map((c) => ({
          dealId: vcDeals.id,
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
      console.log(`  ✓ Re-matched Startup VC Deal "${vcDeals.companyName}": evaluated ${cleanInvestors.length} clean investors`);
    }
  }

  console.log("\n=== CROSS-ASSET CONTAMINATION REMEDIATION COMPLETE! ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
