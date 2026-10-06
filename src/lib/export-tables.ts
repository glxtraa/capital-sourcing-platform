/**
 * Registry of every table the /export page and /api/export routes can
 * download. Each entry returns plain rows (Prisma results) -- CSV/JSON
 * serialization lives in src/lib/csv.ts. Deal-scoped tables are filtered by
 * the current org; Provider and the research tables are shared across orgs.
 *
 * UploadedDocument's blobUrl is deliberately left out: those are links to
 * confidential deal documents and a data export has no need to carry them.
 */
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";

export interface ExportTable {
  key: string;
  label: string;
  description: string;
  group: "Providers" | "Deals" | "Research";
  count: (orgId: string) => Promise<number>;
  rows: (orgId: string) => Promise<Record<string, unknown>[]>;
}

const dealScope = (orgId: string) => ({ deal: { orgId } });

export const EXPORT_TABLES: ExportTable[] = [
  {
    key: "providers",
    label: "Providers",
    description: "The shared capital-provider database (documents required are included as a JSON column).",
    group: "Providers",
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
    label: "Provider document requirements",
    description: "One row per document a provider requires (taxonomy code + note).",
    group: "Providers",
    count: () => db.providerDocumentRequirement.count(),
    rows: () => db.providerDocumentRequirement.findMany({ orderBy: [{ providerId: "asc" }, { code: "asc" }] }),
  },
  {
    key: "provider-onboarding",
    label: "Provider onboarding research",
    description: "Contact channels, application route, form fields and steps found per provider, with review status.",
    group: "Providers",
    count: () => db.providerOnboarding.count(),
    rows: () => db.providerOnboarding.findMany({ orderBy: [{ providerId: "asc" }, { researchedAt: "desc" }] }),
  },
  {
    key: "provider-candidates",
    label: "Discovered provider candidates",
    description: "New providers surfaced by discovery research, pending review or promoted.",
    group: "Providers",
    count: () => db.providerCandidate.count(),
    rows: () => db.providerCandidate.findMany({ orderBy: { discoveredAt: "desc" } }),
  },
  {
    key: "deals",
    label: "Deals",
    description: "One row per deal.",
    group: "Deals",
    count: (orgId) => db.deal.count({ where: { orgId } }),
    rows: (orgId) => db.deal.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
  },
  {
    key: "parties",
    label: "Deal parties",
    description: "Borrowers, obligors, suppliers, intermediaries and guarantors extracted per deal.",
    group: "Deals",
    count: (orgId) => db.party.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.party.findMany({ where: dealScope(orgId), orderBy: [{ dealId: "asc" }, { role: "asc" }] }),
  },
  {
    key: "financing-asks",
    label: "Financing asks",
    description: "Structure type, amount, currency, tenor per deal.",
    group: "Deals",
    count: (orgId) => db.financingAsk.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.financingAsk.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "risk-flags",
    label: "Risk flags",
    description: "Risks flagged during extraction.",
    group: "Deals",
    count: (orgId) => db.riskFlag.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.riskFlag.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "documents",
    label: "Uploaded documents",
    description: "File metadata, document-type classification and raw extraction per file (no file links).",
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
    label: "Provider matches",
    description: "Which providers matched which deal, with verdict and rationale.",
    group: "Deals",
    count: (orgId) => db.providerMatch.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.providerMatch.findMany({ where: dealScope(orgId), orderBy: [{ dealId: "asc" }, { verdict: "asc" }] }),
  },
  {
    key: "term-sheets",
    label: "Term sheets",
    description: "Lender-benchmark output per deal.",
    group: "Deals",
    count: (orgId) => db.termSheet.count({ where: dealScope(orgId) }),
    rows: (orgId) => db.termSheet.findMany({ where: dealScope(orgId), orderBy: { createdAt: "asc" } }),
  },
  {
    key: "agent-runs",
    label: "Agent run log",
    description: "Extraction, matching, research and benchmark runs per deal.",
    group: "Research",
    count: (orgId) => db.researchRun.count({ where: { OR: [{ dealId: null }, dealScope(orgId)] } }),
    rows: (orgId) =>
      db.researchRun.findMany({ where: { OR: [{ dealId: null }, dealScope(orgId)] }, orderBy: { startedAt: "asc" } }),
  },
  {
    key: "research-batches",
    label: "Research batches",
    description: "Batch research jobs (onboarding, discovery, profiling).",
    group: "Research",
    count: () => db.researchBatch.count(),
    rows: () => db.researchBatch.findMany({ orderBy: { createdAt: "asc" } }),
  },
  {
    key: "research-tasks",
    label: "Research tasks",
    description: "One row per task in a batch, with status, attempts and errors.",
    group: "Research",
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
