/**
 * Registry of every table the /export page and /api/export routes can
 * download. Each entry returns plain rows (Prisma results) -- CSV/JSON
 * serialization lives in src/lib/csv.ts. Deal-scoped tables are filtered by
 * the current org; Provider/Investor tables are shared across orgs.
 */
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";

export interface ExportTable {
  key: string;
  label: string;
  description: string;
  workspace: "startups" | "trade" | "factoring";
  group: "Deals" | "Capital Directory" | "Intelligence & Recon" | "Execution & Contracts";
  count: (orgId: string) => Promise<number>;
  rows: (orgId: string) => Promise<Record<string, unknown>[]>;
}

const dealScope = (orgId: string) => ({ deal: { orgId } });

export const EXPORT_TABLES: ExportTable[] = [
  /* =========================================================================
   * STARTUP HUB TABLES (workspace: "startups")
   * ========================================================================= */
  {
    key: "startup-deals",
    label: "Startup Deals",
    description: "Core company profile, stage, vertical, jurisdiction and status.",
    workspace: "startups",
    group: "Deals",
    count: (orgId) => db.startupDeal.count({ where: { orgId } }),
    rows: (orgId) => db.startupDeal.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } }),
  },
  {
    key: "startup-founders",
    label: "Founders & Execs",
    description: "Founder names, roles, technical status, equity ownership and LinkedIn URLs.",
    workspace: "startups",
    group: "Deals",
    count: (orgId) => db.startupFounder.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.startupFounder.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "startup-cap-tables",
    label: "Cap Table & Dilution",
    description: "Founder/investor/pool ownership percentages, SAFEs outstanding, and dead equity notes.",
    workspace: "startups",
    group: "Deals",
    count: (orgId) => db.startupCapTable.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.startupCapTable.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "startup-competitors",
    label: "Competitor Intelligence (光 Hikari)",
    description: "Direct/indirect competitors, backed-by investors, differentiation, and cached proof URLs.",
    workspace: "startups",
    group: "Intelligence & Recon",
    count: (orgId) => db.startupCompetitor.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.startupCompetitor.findMany({ where: dealScope(orgId), orderBy: { createdAt: "desc" } }),
  },
  {
    key: "startup-commercial-prospects",
    label: "Commercial ICP Accounts (疾風 Hayate)",
    description: "Target enterprise customers and channel partners, ACV tiers, and strategic rationale.",
    workspace: "startups",
    group: "Intelligence & Recon",
    count: (orgId) => db.startupCommercialProspect.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.startupCommercialProspect.findMany({ where: dealScope(orgId), orderBy: { createdAt: "desc" } }),
  },
  {
    key: "startup-prospect-contacts",
    label: "Executive Persona Leads",
    description: "Decision-maker and champion leads with verified LinkedIn profiles and email patterns.",
    workspace: "startups",
    group: "Intelligence & Recon",
    count: (orgId) => db.startupProspectContact.count({ where: { prospect: dealScope(orgId) } }),
    rows: (orgId) => db.startupProspectContact.findMany({ where: { prospect: dealScope(orgId) }, orderBy: { createdAt: "desc" } }),
  },
  {
    key: "vc-investors",
    label: "VC Investor Directory",
    description: "Shared directory of VC funds, stages, check sizes, theses, and team contacts.",
    workspace: "startups",
    group: "Capital Directory",
    count: () => db.startupInvestor.count(),
    rows: () => db.startupInvestor.findMany({ orderBy: { name: "asc" } }),
  },
  {
    key: "startup-investor-matches",
    label: "VC Investor Matches",
    description: "Syndicate and lead matches per startup deal with tier, thesis resonance, and conflict checks.",
    workspace: "startups",
    group: "Capital Directory",
    count: (orgId) => db.startupInvestorMatch.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.startupInvestorMatch.findMany({ where: dealScope(orgId), orderBy: [{ dealId: "asc" }, { tier: "asc" }] }),
  },
  {
    key: "vc-syndicate-blueprints",
    label: "Syndicate Blueprints (大輝 Daiki)",
    description: "Target raise, lead vs syndicate allocations, valuation caps, and dilution models.",
    workspace: "startups",
    group: "Execution & Contracts",
    count: (orgId) => db.startupSyndicateBlueprint.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.startupSyndicateBlueprint.findMany({ where: dealScope(orgId), orderBy: { createdAt: "desc" } }),
  },
  {
    key: "deal-dsl-revisions",
    label: "Deal DSL Version History",
    description: "Persistent revisions, author notes, and diff snapshots for all deal DSL payloads.",
    workspace: "startups",
    group: "Execution & Contracts",
    count: () => db.dealDslRevision.count(),
    rows: () => db.dealDslRevision.findMany({ orderBy: { createdAt: "desc" } }),
  },

  /* =========================================================================
   * TRADE FINANCE TABLES (workspace: "trade")
   * ========================================================================= */
  {
    key: "trade-deals",
    label: "Trade Deals",
    description: "Corridor, status, counterparty overview and cross-border trade metadata.",
    workspace: "trade",
    group: "Deals",
    count: (orgId) => db.tradeDeal.count({ where: { orgId } }),
    rows: (orgId) => db.tradeDeal.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } }),
  },
  {
    key: "trade-parties",
    label: "Trade Counterparties",
    description: "Suppliers, traders, buyers, jurisdictions, and concession/bank coordinates.",
    workspace: "trade",
    group: "Deals",
    count: (orgId) => db.tradeParty.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.tradeParty.findMany({ where: dealScope(orgId), orderBy: [{ dealId: "asc" }, { role: "asc" }] }),
  },
  {
    key: "trade-contract-legs",
    label: "Bilateral Contract Legs",
    description: "Supply and offtake legs, incoterms, ports, payment terms, tenor, and commodity specs.",
    workspace: "trade",
    group: "Deals",
    count: (orgId) => db.contractLeg.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.contractLeg.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "trade-financing-asks",
    label: "Trade Financing Asks",
    description: "Umbrella vs leg-specific structures, amounts, advance rates, and tenors.",
    workspace: "trade",
    group: "Deals",
    count: (orgId) => db.tradeFinancingAskModel.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.tradeFinancingAskModel.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "trade-risk-flags",
    label: "Trade Risk Flags",
    description: "Maritime, assay, sanctions, and performance risks with human verification status.",
    workspace: "trade",
    group: "Intelligence & Recon",
    count: (orgId) => db.tradeRiskFlag.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.tradeRiskFlag.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "trade-funders",
    label: "Trade Funder Database",
    description: "Commodity lenders, umbrella SBLC appetites, indicative pricing, and desk contacts.",
    workspace: "trade",
    group: "Capital Directory",
    count: () => db.tradeFunder.count(),
    rows: () => db.tradeFunder.findMany({ orderBy: { name: "asc" } }),
  },
  {
    key: "trade-funder-matches",
    label: "Trade Funder Matches",
    description: "Matched commodity desks per deal with corridor, commodity fit, and rationales.",
    workspace: "trade",
    group: "Capital Directory",
    count: (orgId) => db.tradeFunderMatchModel.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.tradeFunderMatchModel.findMany({ where: dealScope(orgId), orderBy: { createdAt: "desc" } }),
  },
  {
    key: "trade-term-sheets",
    label: "Trade Term Sheets",
    description: "Benchmarked facility limits, blended SOFR margins, formulas, and security terms.",
    workspace: "trade",
    group: "Execution & Contracts",
    count: (orgId) => db.tradeTermSheetModel.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.tradeTermSheetModel.findMany({ where: dealScope(orgId), orderBy: { createdAt: "desc" } }),
  },

  /* =========================================================================
   * INVOICE FACTORING TABLES (workspace: "factoring")
   * ========================================================================= */
  {
    key: "providers",
    label: "Factoring Providers",
    description: "The shared capital-provider database (documents required are included as a JSON column).",
    workspace: "factoring",
    group: "Capital Directory",
    count: () => db.provider.count(),
    rows: async () => {
      const rows = await db.provider.findMany({ include: { documentsRequired: true }, orderBy: { name: "asc" } });
      return rows.map(({ documentsRequired, ...p }) => ({
        ...p,
        documentsRequired: documentsRequired.map((d) => ({ code: d.code, note: d.note })),
      }));
    },
  },
  {
    key: "provider-documents",
    label: "Provider Document Requirements",
    description: "One row per document a provider requires (taxonomy code + note).",
    workspace: "factoring",
    group: "Capital Directory",
    count: () => db.providerDocumentRequirement.count(),
    rows: () => db.providerDocumentRequirement.findMany({ orderBy: [{ providerId: "asc" }, { code: "asc" }] }),
  },
  {
    key: "provider-onboarding",
    label: "Provider Onboarding Research",
    description: "Contact channels, application route, form fields and steps found per provider, with review status.",
    workspace: "factoring",
    group: "Intelligence & Recon",
    count: () => db.providerOnboarding.count(),
    rows: () => db.providerOnboarding.findMany({ orderBy: [{ providerId: "asc" }, { researchedAt: "desc" }] }),
  },
  {
    key: "provider-candidates",
    label: "Discovered Provider Candidates",
    description: "New providers surfaced by discovery research, pending review or promoted.",
    workspace: "factoring",
    group: "Intelligence & Recon",
    count: () => db.providerCandidate.count(),
    rows: () => db.providerCandidate.findMany({ orderBy: { discoveredAt: "desc" } }),
  },
  {
    key: "deals",
    label: "Factoring Deals",
    description: "One row per receivables/factoring deal.",
    workspace: "factoring",
    group: "Deals",
    count: (orgId) => db.deal.count({ where: { orgId } }),
    rows: (orgId) => db.deal.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
  },
  {
    key: "parties",
    label: "Factoring Deal Parties",
    description: "Borrowers, obligors, suppliers, intermediaries and guarantors extracted per deal.",
    workspace: "factoring",
    group: "Deals",
    count: (orgId) => db.party.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.party.findMany({ where: dealScope(orgId), orderBy: [{ dealId: "asc" }, { role: "asc" }] }),
  },
  {
    key: "financing-asks",
    label: "Factoring Financing Asks",
    description: "Structure type, amount, currency, tenor per deal.",
    workspace: "factoring",
    group: "Deals",
    count: (orgId) => db.financingAsk.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.financingAsk.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "risk-flags",
    label: "Factoring Risk Flags",
    description: "Risks flagged during extraction.",
    workspace: "factoring",
    group: "Intelligence & Recon",
    count: (orgId) => db.riskFlag.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.riskFlag.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "documents",
    label: "Uploaded Documents",
    description: "File metadata, document-type classification and raw extraction per file (no file links).",
    workspace: "factoring",
    group: "Deals",
    count: (orgId) => db.uploadedDocument.count({ where: dealScope(orgId) }),
    rows: async (orgId) => {
      const rows = await db.uploadedDocument.findMany({ where: dealScope(orgId), orderBy: { uploadedAt: "asc" } });
      return rows.map((d) => {
        const copy: Record<string, unknown> = { ...d };
        delete copy.blobUrl;
        return copy;
      });
    },
  },
  {
    key: "provider-matches",
    label: "Provider Matches",
    description: "Which providers matched which deal, with verdict and rationale.",
    workspace: "factoring",
    group: "Capital Directory",
    count: (orgId) => db.providerMatch.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.providerMatch.findMany({ where: dealScope(orgId), orderBy: [{ dealId: "asc" }, { verdict: "asc" }] }),
  },
  {
    key: "term-sheets",
    label: "Term Sheets",
    description: "Lender-benchmark output per deal.",
    workspace: "factoring",
    group: "Execution & Contracts",
    count: (orgId) => db.termSheet.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.termSheet.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "agent-runs",
    label: "Agent Run Log",
    description: "Extraction, matching, research and benchmark runs per deal.",
    workspace: "factoring",
    group: "Intelligence & Recon",
    count: (orgId) => db.researchRun.count({ where: { OR: [{ dealId: null }, dealScope(orgId)] } }),
    rows: (orgId) =>
      db.researchRun.findMany({ where: { OR: [{ dealId: null }, dealScope(orgId)] }, orderBy: { startedAt: "asc" } }),
  },
  {
    key: "research-batches",
    label: "Research Batches",
    description: "Batch research jobs (onboarding, discovery, profiling).",
    workspace: "factoring",
    group: "Intelligence & Recon",
    count: () => db.researchBatch.count(),
    rows: () => db.researchBatch.findMany({ orderBy: { createdAt: "asc" } }),
  },
  {
    key: "research-tasks",
    label: "Research Tasks",
    description: "One row per task in a batch, with status, attempts and errors.",
    workspace: "factoring",
    group: "Intelligence & Recon",
    count: () => db.researchTask.count(),
    rows: () => db.researchTask.findMany({ orderBy: { createdAt: "asc" } }),
  },
];

export function getExportTable(key: string): ExportTable | undefined {
  return EXPORT_TABLES.find((t) => t.key === key);
}

export async function currentOrg() {
  return getCurrentOrgId();
}
