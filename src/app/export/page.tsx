import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent } from "@/components/ui/primitives";
import { EXPORT_TABLES, currentOrg, type ExportTable } from "@/lib/export-tables";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type WorkspaceId = "startups" | "trade" | "factoring";

const linkClass =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 transition-colors";

const WORKSPACE_METADATA: Record<
  WorkspaceId,
  { label: string; tone: string; description: string; badge: string }
> = {
  startups: {
    label: "Startup Hub Export Pack",
    tone: "violet",
    badge: "Startup Hub · Isolated Data Pack",
    description:
      "Download verified startup deal profiles, founder teams, cap tables & dilution models, competitor intelligence, commercial ICP customer/partner accounts, VC investor matches, syndicate blueprints, and DSL version revisions.",
  },
  trade: {
    label: "Trade Finance Export Pack",
    tone: "amber",
    badge: "Trade Finance · Isolated Data Pack",
    description:
      "Download bilateral trade contracts, counterparty registries, commodity assay specs, financing asks, verified trade risk flags, trade funder desk appetite, and facility term sheet benchmarks.",
  },
  factoring: {
    label: "Invoice Factoring Export Pack",
    tone: "indigo",
    badge: "Invoice Factoring · Isolated Data Pack",
    description:
      "Download factoring deals, obligor/borrower parties, invoices, risk flags, provider directory, provider matches, and pricing benchmarks.",
  },
};

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieWs = cookieStore.get("tr3_last_workspace")?.value;

  const rawWs = params.workspace || cookieWs || "startups";
  const activeWorkspace: WorkspaceId =
    rawWs === "startups" || rawWs === "trade" || rawWs === "factoring" ? rawWs : "startups";

  const meta = WORKSPACE_METADATA[activeWorkspace];
  const orgId = await currentOrg();

  // Filter tables by active workspace
  const workspaceTables = EXPORT_TABLES.filter((t) => t.workspace === activeWorkspace);
  const counts = await Promise.all(workspaceTables.map((t) => t.count(orgId)));

  // Query individual startup deals if in startups workspace
  const startupDeals =
    activeWorkspace === "startups"
      ? await db.startupDeal.findMany({
          where: { orgId },
          include: {
            founders: true,
            capTable: true,
            competitors: true,
            commercialProspects: { include: { contacts: true } },
            matches: true,
            syndicateBlueprints: true,
            riskFlags: true,
          },
          orderBy: { companyName: "asc" },
        })
      : [];

  // Group tables by their category
  const groups = Array.from(new Set(workspaceTables.map((t) => t.group)));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                activeWorkspace === "startups"
                  ? "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300"
                  : activeWorkspace === "trade"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                    : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300"
              }`}
            >
              {meta.badge}
            </span>
            <span className="text-xs text-neutral-400">
              {workspaceTables.length} tables available
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{meta.label}</h1>
          <p className="max-w-2xl text-sm text-neutral-500">{meta.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/export/all?workspace=${activeWorkspace}&format=xlsx`}
            className={`${linkClass} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 font-semibold`}
            title="Download multi-tab formatted Excel / Google Sheets workbook"
          >
            <span>📊 Large Google Sheet (.xlsx)</span>
          </a>
          <a
            href={`/api/export/all?workspace=${activeWorkspace}&format=zip`}
            className={`${linkClass} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900`}
          >
            Download {meta.label} (.zip)
          </a>
          <a href={`/api/export/all?workspace=${activeWorkspace}&format=json`} className={linkClass}>
            Consolidated JSON
          </a>
        </div>
      </div>

      {/* Google Sheets Import Notice */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[11px] uppercase tracking-wider bg-emerald-200/80 dark:bg-emerald-900 px-2 py-0.5 rounded text-emerald-900 dark:text-emerald-200">
            Google Sheets Ready
          </span>
          <span>
            Click <strong>📊 Large Google Sheet (.xlsx)</strong> to download a formatted workbook with separate tabs for every table. Upload it to <strong>Google Drive</strong> and double-click to open directly in Google Sheets (or use <em>File &gt; Import &gt; Upload</em> in Google Sheets).
          </span>
        </div>
      </div>

      {/* Quick Asset Class Switcher Bar */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
        <span className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Scope Data Pack:
        </span>
        {(["startups", "trade", "factoring"] as const).map((ws) => (
          <Link
            key={ws}
            href={`/export?workspace=${ws}`}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeWorkspace === ws
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {ws === "startups" ? "🚀 Startup Hub" : ws === "trade" ? "🚢 Trade Finance" : "🧾 Invoice Factoring"}
          </Link>
        ))}
      </div>

      {/* Individual Startup Deal Data Packs Section */}
      {activeWorkspace === "startups" && startupDeals.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Individual Startup Deal Data Packs ({startupDeals.length})
              </h2>
              <p className="text-xs text-neutral-500">
                Download verified diligence packages, cap tables, competitors, commercial ICPs, executive leads, and syndicate blueprints isolated per startup deal.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {startupDeals.map((deal) => {
              const contactCount = deal.commercialProspects.reduce((acc, p) => acc + p.contacts.length, 0);
              return (
                <Card key={deal.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/vc-deals/${deal.id}`}
                          className="font-bold text-base text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {deal.companyName}
                        </Link>
                        <span className="rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold">
                          {deal.stage.replaceAll("_", " ")}
                        </span>
                        <span className="rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 px-1.5 py-0.5 text-[10px] font-mono">
                          {deal.primaryVertical.replaceAll("_", " ")}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {deal.legalEntityJurisdiction}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                        <span>{deal.founders.length} Founders</span>
                        <span>·</span>
                        <span>{deal.competitors.length} Rivals (Hikari)</span>
                        <span>·</span>
                        <span>{deal.commercialProspects.length} ICPs &amp; {contactCount} Leads</span>
                        <span>·</span>
                        <span>{deal.matches.length} Matches</span>
                        {deal.syndicateBlueprints.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Blueprint Modeled</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/export/deal/${deal.id}?format=xlsx`}
                        className={`${linkClass} bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-semibold`}
                        title="Download multi-tab deal spreadsheet for Google Sheets or Excel"
                      >
                        📊 Deal Sheet (.xlsx)
                      </a>
                      <a
                        href={`/api/export/deal/${deal.id}?format=json`}
                        className={linkClass}
                        title="Download complete hierarchical deal JSON"
                      >
                        📄 Deal JSON
                      </a>
                      <a
                        href={`/api/export/deal/${deal.id}?format=zip`}
                        className={linkClass}
                        title="Download all deal tables as CSV collection"
                      >
                        🗂️ Deal ZIP
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Global Categorized Tables Section */}
      {groups.map((group) => {
        const groupTables = workspaceTables
          .map((t, idx) => ({ t, count: counts[idx] }))
          .filter(({ t }) => t.group === group);

        if (groupTables.length === 0) return null;

        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{group}</h2>
            <div className="grid gap-3">
              {groupTables.map(({ t, count }) => (
                <TableCard key={t.key} table={t} count={count} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}


function TableCard({ table, count }: { table: ExportTable; count: number }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">
            {table.label} <span className="text-sm font-normal text-neutral-400">· {count} rows</span>
          </p>
          <p className="text-sm text-neutral-500">{table.description}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/export/${table.key}?format=csv`} className={linkClass}>
            CSV
          </a>
          <a href={`/api/export/${table.key}?format=json`} className={linkClass}>
            JSON
          </a>
          {table.key === "providers" && (
            <a href="/api/export/providers?format=legacy" className={linkClass}>
              providers.json
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
