import * as XLSX from "xlsx";
import { reconcileStartupExtractions } from "../src/agents/vc/vc-reconciliation";
import { matchStartupDeal } from "../src/lib/vc-matching";
import {
  parseExcelBuffer,
  parseCsvBuffer,
  convertGoogleSheetsToExportUrl,
} from "../src/lib/spreadsheet-parser";
import { SEED_VC_INVESTORS } from "./seed-vc-investors";
import { testSourceLink, testSourceLinks } from "../src/lib/link-verifier";
import type { StartupDocumentExtraction } from "../src/dsl/vc";
import type { StartupInvestor, UploadedStartupDocument } from "@prisma/client";

async function runVCEndToEndTest() {
  console.log("================================================================================");
  console.log("Starting Startup VC Funding End-to-End Test Suite");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: SPREADSHEET PARSING (Excel, CSV, Google Sheets)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 1: Spreadsheet Parsing Engine (Excel .xlsx, CSV, Google Sheets)");
  console.log("--------------------------------------------------------------------------------");

  // A. Excel Workbook with multiple sheets (Cap Table + Monthly Projections)
  const wb = XLSX.utils.book_new();
  const capTableData = [
    { Shareholder: "Elena Rostova", Role: "CEO", Shares: 4500000, OwnershipPct: 45.0, Class: "Common Stock" },
    { Shareholder: "Marcus Vance", Role: "CTO", Shares: 4500000, OwnershipPct: 45.0, Class: "Common Stock" },
    { Shareholder: "Unallocated Pool", Role: "ESOP", Shares: 1000000, OwnershipPct: 10.0, Class: "Option Pool" },
  ];
  const wsCap = XLSX.utils.json_to_sheet(capTableData);
  XLSX.utils.book_append_sheet(wb, wsCap, "CapTable");

  const modelData = [
    { Month: "Jan 2026", MRR: 90000, ARR: 1080000, Burn: 70000, Cash: 650000 },
    { Month: "Feb 2026", MRR: 95000, ARR: 1140000, Burn: 72000, Cash: 578000 },
    { Month: "Mar 2026", MRR: 100000, ARR: 1200000, Burn: 75000, Cash: 503000 },
  ];
  const wsModel = XLSX.utils.json_to_sheet(modelData);
  XLSX.utils.book_append_sheet(wb, wsModel, "FinancialProjections");

  const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const excelResult = parseExcelBuffer(excelBuffer, "NexusAI_DataRoom_Model.xlsx");

  console.log(`✓ Parsed Excel Workbook: ${excelResult.fileName} (${excelResult.sheetCount} sheets)`);
  console.log(`  - Sheet 1: ${excelResult.sheets[0].sheetName} (${excelResult.sheets[0].rowCount} rows)`);
  console.log(`  - Sheet 2: ${excelResult.sheets[1].sheetName} (${excelResult.sheets[1].rowCount} rows)`);
  console.log(`  - Auto-detected Document Type: ${excelResult.detectedDocTypeHint}`);
  if (excelResult.detectedDocTypeHint !== "VC_CAP_TABLE") {
    throw new Error(`Expected taxonomy hint VC_CAP_TABLE, got ${excelResult.detectedDocTypeHint}`);
  }

  // B. CSV Parsing
  const mockCsv = "Metric,Q1 2026,Q2 2026,Q3 2026\nARR,$1.2M,$1.6M,$2.1M\nGross Margin,82%,84%,85%\nNet Burn,$75k,$80k,$85k\n";
  const csvBuffer = Buffer.from(mockCsv, "utf-8");
  const csvResult = parseCsvBuffer(csvBuffer, "Operating_Metrics.csv");
  console.log(`✓ Parsed CSV: ${csvResult.fileName} (${csvResult.sheets[0].rowCount} data rows)`);

  // C. Google Sheets URL Resolution
  const sampleGSheetUrl = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?gid=12345#gid=12345";
  const exportUrl = convertGoogleSheetsToExportUrl(sampleGSheetUrl);
  console.log(`✓ Google Sheets URL Conversion:`);
  console.log(`  Input:  ${sampleGSheetUrl}`);
  console.log(`  Output: ${exportUrl}`);
  if (!exportUrl.includes("export?format=csv&gid=12345")) {
    throw new Error("Failed to format Google Sheets export URL");
  }
  console.log("✓ TEST 1 PASSED: Spreadsheet parsing engine verified!\n");

  // ---------------------------------------------------------------------------
  // TEST 2: MULTI-DOCUMENT RECONCILIATION
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 2: Multi-Document Reconciliation Engine");
  console.log("--------------------------------------------------------------------------------");

  const pitchDeckExtraction: StartupDocumentExtraction = {
    documentSummary: "Investor presentation pitch deck covering problem, architecture, traction, and ask.",
    documentTypes: ["VC_PITCH_DECK"],
    companyName: "NexusAI Technologies",
    stage: "SEED",
    primaryVertical: "AI_ML_INFRASTRUCTURE",
    legalEntityJurisdiction: "Delaware (US)",
    founders: [
      {
        name: "Elena Rostova",
        role: "CEO & Co-Founder",
        isTechnical: false,
        isRepeatFounder: true,
        equityOwnershipPct: 45,
        vestingConfirmed: true,
        linkedinUrl: "https://linkedin.com/in/elena-rostova",
        priorExits: ["Acquired by Datadog in 2021"],
      },
      {
        name: "Marcus Vance",
        role: "CTO & Co-Founder",
        isTechnical: true,
        isRepeatFounder: false,
        equityOwnershipPct: 45,
        vestingConfirmed: true,
        linkedinUrl: "https://linkedin.com/in/marcus-vance",
        priorExits: [],
      },
    ],
    industry: "AI / ML Infrastructure & Developer Tools",
    subIndustries: ["Model Serving APIs", "Vector Indexing"],
    competitors: [],
    commercialProspects: [
      {
        name: "Datadog",
        websiteUrl: "https://datadoghq.com",
        category: "STRATEGIC_CHANNEL_PARTNER",
        buyerPersona: "Head of Infrastructure Alliances",
        useCaseFit: "Telemetry integration for model monitoring",
        estimatedAcvTier: "100K_TO_250K",
        strategicSynergy: "Co-selling to enterprise DevOps teams",
        sourceUrl: "https://datadoghq.com",
        sourceVerified: true,
        sourceHttpStatus: 200,
      },
    ],
    traction: {
      arrUsd: 1200000,
      mrrUsd: 100000,
      momGrowthRatePct: 18,
      grossMarginPct: 82,
      netMonthlyBurnUsd: 75000,
      cashRunwayMonths: 8,
      activeCustomersCount: 28,
      customerLoiPipelineUsd: 2400000,
      netRevenueRetentionPct: 125,
    },
    financingAsk: {
      targetRaiseUsd: 2500000,
      instrumentType: "POST_MONEY_SAFE",
      valuationCapUsd: 18000000,
      discountPct: 20,
      plannedRunwayMonths: 24,
      leadCommitted: false,
      committedAmountUsd: 0,
    },
    riskFlags: [],
    openQuestions: [],
  };

  const financialModelExtraction: StartupDocumentExtraction = {
    documentSummary: "Detailed monthly financial model parsed from Excel.",
    documentTypes: ["VC_FINANCIAL_MODEL"],
    companyName: "NexusAI Technologies Inc.",
    stage: "SEED",
    primaryVertical: "AI_ML_INFRASTRUCTURE",
    legalEntityJurisdiction: "Delaware (US)",
    subIndustries: [],
    competitors: [],
    commercialProspects: [],
    founders: [],
    traction: {
      arrUsd: 1200000,
      mrrUsd: 100000,
      momGrowthRatePct: 18,
      grossMarginPct: 84,
      netMonthlyBurnUsd: 75000,
      cashRunwayMonths: 8,
      activeCustomersCount: 28,
      customerLoiPipelineUsd: null,
      netRevenueRetentionPct: 128,
    },
    capTable: null,
    financingAsk: null,
    riskFlags: [],
    openQuestions: [],
  };

  const capTableExtraction: StartupDocumentExtraction = {
    documentSummary: "Detailed capitalization table parsed from CapTable Excel sheet.",
    documentTypes: ["VC_CAP_TABLE"],
    companyName: "NexusAI Technologies Inc.",
    stage: "SEED",
    primaryVertical: "AI_ML_INFRASTRUCTURE",
    legalEntityJurisdiction: "Delaware (US)",
    subIndustries: [],
    competitors: [],
    commercialProspects: [],
    founders: [],

    capTable: {
      foundersOwnershipPct: 80,
      investorOwnershipPct: 10,
      optionPoolPct: 10,
      safesNotesOutstandingUsd: 500000,
      safeHolders: [
        {
          holderName: "Seed Angel Syndicate",
          investmentAmountUsd: 500000,
          instrumentType: "POST_MONEY_SAFE",
          valuationCapUsd: 12000000,
          discountPct: 20,
          dateOrNotes: "Pre-seed SAFE",
        },
      ],
      commonHolders: [
        {
          holderName: "Elena Rostova",
          roleOrRelationship: "CEO / Co-Founder",
          shareCount: 5000000,
          ownershipPct: 45,
          vestingTerms: "4-year monthly, 1-year cliff",
        },
        {
          holderName: "Marcus Vance",
          roleOrRelationship: "CTO / Co-Founder",
          shareCount: 4000000,
          ownershipPct: 35,
          vestingTerms: "4-year monthly, 1-year cliff",
        },
      ],
      hasDeadEquity: false,
      deadEquityNotes: null,
    },
    riskFlags: [],
    openQuestions: [],
  };

  const reconciliationResult = reconcileStartupExtractions(
    "deal-nexus-ai-01",
    "NexusAI Seed Round",
    [pitchDeckExtraction, financialModelExtraction, capTableExtraction],
  );

  console.log(`✓ Reconciled Company: ${reconciliationResult.startupDealSpec?.companyName}`);
  console.log(`✓ Stage / Vertical: ${reconciliationResult.startupDealSpec?.stage} / ${reconciliationResult.startupDealSpec?.primaryVertical}`);
  console.log(`✓ Target Raise: $${reconciliationResult.startupDealSpec?.financingAsk.targetRaiseUsd?.toLocaleString()}`);
  console.log(`✓ Valuation Cap: $${reconciliationResult.startupDealSpec?.financingAsk.valuationCapUsd?.toLocaleString()}`);
  console.log(`✓ Implied Dilution: ${reconciliationResult.startupDealSpec?.reconciliationAudit.founderDilutionPct}%`);
  console.log(`✓ Ready for Matching: ${reconciliationResult.readyForMatching}`);

  if (!reconciliationResult.startupDealSpec) {
    throw new Error("Reconciliation failed to produce a StartupDealSpec");
  }
  console.log("✓ TEST 2 PASSED: Reconciliation verified!\n");

  // ---------------------------------------------------------------------------
  // TEST 3: SYSTEMATIC MATCHING - DEFAULT ALLOCATIONS (65% Lead, 25% Synd, 10% Angel)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 3: Syndicate Matching with DEFAULT Allocations (65% Lead / 25% Synd / 10% Angel)");
  console.log("--------------------------------------------------------------------------------");

  const mockDbInvestors: (StartupInvestor & { documentsRequired: { code: string; note: string | null }[] })[] =
    SEED_VC_INVESTORS.map((inv) => ({
      id: inv.id,
      name: inv.name,
      type: inv.type,
      targetStages: inv.targetStages,
      preferredSectors: inv.preferredSectors,
      excludedSectors: inv.excludedSectors ?? [],
      minCheckUsd: inv.minCheckUsd ?? null,
      maxCheckUsd: inv.maxCheckUsd ?? null,
      sweetSpotCheckUsd: inv.sweetSpotCheckUsd ?? null,
      leadsRounds: inv.leadsRounds ?? false,
      takesBoardSeats: inv.takesBoardSeats ?? false,
      targetOwnershipPct: inv.targetOwnershipPct ?? null,
      acceptedJurisdictions: inv.acceptedJurisdictions ?? ["Delaware (US)", "any"],
      minArrUsd: inv.minArrUsd ?? null,
      portfolioCompanies: inv.portfolioCompanies ?? [],
      gatingFactor: inv.gatingFactor ?? null,
      typicalTurnaroundWeeks: inv.typicalTurnaroundWeeks ?? null,
      applicationRoute: inv.applicationRoute ?? "WARM_INTRO",
      applicationUrl: inv.applicationUrl ?? null,
      websiteUrl: inv.websiteUrl ?? null,
      contactEmail: inv.contactEmail ?? null,
      headquarters: inv.headquarters ?? null,
      keyContactsJson: (inv.keyContacts ?? []) as any,
      confidence: inv.confidence ?? "VERIFIED_SECONDARY",
      sources: inv.sources ?? [],
      notes: inv.notes ?? null,
      lastVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      activelyFundingIndustry: inv.activelyFundingIndustry ?? true,
      recentIndustryInvestments: (inv.recentIndustryInvestments ?? []) as any,
      competitorInvestments: (inv.competitorInvestments ?? []) as any,
      thesisMatchSummary: inv.thesisMatchSummary ?? null,
      sourceLinksAudit: (inv.sourceLinksAudit ?? []) as any,
      documentsRequired: (inv.documentsRequired || []).map((doc, idx) => ({
        id: `doc-req-${idx}`,
        investorId: inv.id,
        code: doc.code,
        note: doc.note ?? null,
      })),
    }));

  const mockUploadedDocuments: UploadedStartupDocument[] = [
    {
      id: "doc-1",
      dealId: "deal-nexus-ai-01",
      fileName: "NexusAI_Pitch_Deck.pdf",
      blobUrl: "https://blob.vercel-storage.com/nexus-deck.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4200000,
      documentTypes: ["VC_PITCH_DECK"],
      extractedRaw: null,
      uploadedAt: new Date(),
    },
    {
      id: "doc-2",
      dealId: "deal-nexus-ai-01",
      fileName: "NexusAI_Financial_Model.xlsx",
      blobUrl: "https://blob.vercel-storage.com/nexus-model.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 850000,
      documentTypes: ["VC_FINANCIAL_MODEL"],
      extractedRaw: null,
      uploadedAt: new Date(),
    },
    {
      id: "doc-3",
      dealId: "deal-nexus-ai-01",
      fileName: "NexusAI_Cap_Table.xlsx",
      blobUrl: "https://blob.vercel-storage.com/nexus-cap.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 320000,
      documentTypes: ["VC_CAP_TABLE"],
      extractedRaw: null,
      uploadedAt: new Date(),
    },
  ];

  const defaultMatching = matchStartupDeal(
    reconciliationResult.startupDealSpec,
    mockDbInvestors,
    mockUploadedDocuments,
  );

  console.log(`Target Raise: $${defaultMatching.targetRaiseAmountUsd.toLocaleString()}`);
  console.log(`  - Lead (65% default):      $${defaultMatching.recommendedLeadAllocationUsd.toLocaleString()}`);
  console.log(`  - Syndicate (25% default): $${defaultMatching.recommendedSyndicateAllocationUsd.toLocaleString()}`);
  console.log(`  - Angels (10% default):    $${defaultMatching.recommendedAngelAllocationUsd.toLocaleString()}`);

  if (defaultMatching.recommendedLeadAllocationUsd !== 1625000) {
    throw new Error(`Expected Lead $1,625,000, got ${defaultMatching.recommendedLeadAllocationUsd}`);
  }
  if (defaultMatching.recommendedSyndicateAllocationUsd !== 625000) {
    throw new Error(`Expected Syndicate $625,000, got ${defaultMatching.recommendedSyndicateAllocationUsd}`);
  }
  if (defaultMatching.recommendedAngelAllocationUsd !== 250000) {
    throw new Error(`Expected Angels $250,000, got ${defaultMatching.recommendedAngelAllocationUsd}`);
  }
  console.log("✓ TEST 3 PASSED: Default allocations verified!\n");

  // ---------------------------------------------------------------------------
  // TEST 4: SYSTEMATIC MATCHING - FOUNDER CUSTOM ALLOCATIONS (50% Lead, 30% Synd, 20% Angel)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 4: Syndicate Matching with FOUNDER CUSTOM ALLOCATIONS (50% Lead / 30% Synd / 20% Angel)");
  console.log("--------------------------------------------------------------------------------");

  const customPreferences = {
    leadAllocationPct: 50,
    syndicateAllocationPct: 30,
    angelAllocationPct: 20,
    minAngelCheckUsd: 25000,
  };

  const customMatching = matchStartupDeal(
    reconciliationResult.startupDealSpec,
    mockDbInvestors,
    mockUploadedDocuments,
    customPreferences,
  );

  console.log(`Target Raise: $${customMatching.targetRaiseAmountUsd.toLocaleString()}`);
  console.log(`  - Lead (50% custom):      $${customMatching.recommendedLeadAllocationUsd.toLocaleString()}`);
  console.log(`  - Syndicate (30% custom): $${customMatching.recommendedSyndicateAllocationUsd.toLocaleString()}`);
  console.log(`  - Angels (20% custom):    $${customMatching.recommendedAngelAllocationUsd.toLocaleString()}`);
  console.log(`  - Min Angel Check:        $${customMatching.customPreferencesApplied.minAngelCheckUsd.toLocaleString()}`);

  if (customMatching.recommendedLeadAllocationUsd !== 1250000) {
    throw new Error(`Expected Lead $1,250,000, got ${customMatching.recommendedLeadAllocationUsd}`);
  }
  if (customMatching.recommendedSyndicateAllocationUsd !== 750000) {
    throw new Error(`Expected Syndicate $750,000, got ${customMatching.recommendedSyndicateAllocationUsd}`);
  }
  if (customMatching.recommendedAngelAllocationUsd !== 500000) {
    throw new Error(`Expected Angels $500,000, got ${customMatching.recommendedAngelAllocationUsd}`);
  }
  console.log(`Synthesis Summary:\n${customMatching.synthesisSummary}`);
  console.log("✓ TEST 4 PASSED: Founder custom allocations verified!\n");

  // ---------------------------------------------------------------------------
  // TEST 5: COMPETITOR CONFLICT DETECTION, ACTIVE INDUSTRY DEPLOYMENT & SOURCE RE-TESTING
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 5: Competitor Conflict Detection, Active Industry Checks & Link Verification");
  console.log("--------------------------------------------------------------------------------");

  // A. Link Verifier Testing
  console.log("  Testing live HTTP link verification engine...");
  const validLink = await testSourceLink("https://github.com", 5000);
  console.log(`  ✓ Valid URL test: ${validLink.url} -> status ${validLink.status}, reachable: ${validLink.ok}, latency: ${validLink.latencyMs}ms`);
  if (!validLink.ok) {
    throw new Error(`Expected github.com to be reachable, got error: ${validLink.error}`);
  }

  const deadLink = await testSourceLink("https://this-domain-does-not-exist-xyz987654.org", 3000);
  console.log(`  ✓ Invalid URL test: ${deadLink.url} -> status ${deadLink.status}, reachable: ${deadLink.ok}, error: ${deadLink.error}`);
  if (deadLink.ok) {
    throw new Error("Expected non-existent domain to fail reachability check");
  }

  // B. Competitor Conflict Detection
  console.log("  Testing anti-portfolio competitor conflict detection...");
  const specWithCompetitor = {
    ...reconciliationResult.startupDealSpec,
    competitors: [
      {
        name: "Linear",
        websiteUrl: "https://linear.app",
        description: "Issue tracking and project management tool for modern software teams.",
        overlapDegree: "DIRECT" as const,
        knownInvestors: ["Sequoia Capital (Seed & Early Stage)"],
        differentiation: "Our startup has AI agent autonomous execution whereas Linear is manual issue tracking.",
        sourceUrl: "https://techcrunch.com/linear-funding",
        sourceVerified: true,
        sourceHttpStatus: 200,
      },
    ],
  };

  const matchingWithConflict = matchStartupDeal(
    specWithCompetitor,
    mockDbInvestors,
    mockUploadedDocuments,
  );

  const sequoiaMatch = matchingWithConflict.leadCandidates.find((c) => c.investorId === "sequoia-seed-fund");
  if (!sequoiaMatch) {
    throw new Error("Sequoia seed fund not found in candidates");
  }
  console.log(`  ✓ Sequoia Conflict Detection:`);
  console.log(`    - Portfolio Conflict Detected: ${sequoiaMatch.portfolioConflictDetected}`);
  console.log(`    - Conflicting Company:         ${sequoiaMatch.conflictingPortfolioCompany}`);
  console.log(`    - Conflict Notes:              ${sequoiaMatch.competitorConflictNotes}`);
  console.log(`    - Verdict:                     ${sequoiaMatch.verdict}`);

  if (!sequoiaMatch.portfolioConflictDetected) {
    throw new Error("Expected Sequoia to be flagged with portfolioConflictDetected: true due to Linear investment!");
  }
  if (sequoiaMatch.verdict !== "EXCLUDED") {
    throw new Error(`Expected Sequoia verdict to be EXCLUDED, got ${sequoiaMatch.verdict}`);
  }

  // C. Inactive Industry Thesis Testing
  console.log("  Testing inactive industry deployment check...");
  const investorsWithInactive = mockDbInvestors.map((inv) =>
    inv.id === "first-round-capital" ? { ...inv, activelyFundingIndustry: false } : inv,
  );

  const matchingWithInactive = matchStartupDeal(
    reconciliationResult.startupDealSpec,
    investorsWithInactive,
    mockUploadedDocuments,
  );

  const firstRoundMatch = matchingWithInactive.leadCandidates.find((c) => c.investorId === "first-round-capital");
  if (!firstRoundMatch) {
    throw new Error("First Round Capital not found in candidates");
  }
  console.log(`  ✓ First Round Inactive Thesis Check:`);
  console.log(`    - Actively Funding Industry:   ${firstRoundMatch.activelyFundingIndustry}`);
  console.log(`    - Industry Deployment Score:   ${firstRoundMatch.industryDeploymentScore}`);
  console.log(`    - Verdict:                     ${firstRoundMatch.verdict}`);

  if (firstRoundMatch.activelyFundingIndustry !== false) {
    throw new Error("Expected activelyFundingIndustry to be false");
  }
  if (firstRoundMatch.verdict !== "EXCLUDED") {
    throw new Error(`Expected First Round verdict to be EXCLUDED due to stale thesis, got ${firstRoundMatch.verdict}`);
  }

  console.log("✓ TEST 5 PASSED: Competitor conflict detection, active thesis checks, and link verifier verified!\n");

  console.log("================================================================================");
  console.log("✓ ALL 5 TESTS PASSED: Excel/CSV/Sheets, Syndicate Matching, Competitor Anti-Portfolio & Link Verification!");
  console.log("================================================================================");
}

runVCEndToEndTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
