/* eslint-disable @next/next/no-html-link-for-pages -- file downloads from API routes, not page navigations */
import { Card, CardContent } from "@/components/ui/primitives";
import { EXPORT_TABLES, currentOrg, type ExportTable } from "@/lib/export-tables";

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

export default async function ExportPage() {
  const orgId = await currentOrg();
  const counts = await Promise.all(EXPORT_TABLES.map((t) => t.count(orgId)));
  const groups = ["Providers", "Deals", "Research"] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Export data</h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            Download any table as CSV or JSON, or everything at once. The provider table also comes in the{" "}
            <code>providers.json</code> layout the sourcing skills read, so you can drop it straight into{" "}
            <code>providers_db/</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/all?format=zip" className={`${linkClass} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900`}>
            Download everything (.zip)
          </a>
          <a href="/api/export/all?format=json" className={linkClass}>
            One JSON file
          </a>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{group}</h2>
          <div className="grid gap-3">
            {EXPORT_TABLES.map((t, i) => ({ t, n: counts[i] }))
              .filter(({ t }) => t.group === group)
              .map(({ t, n }) => (
                <TableCard key={t.key} table={t} count={n} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TableCard({ table, count }: { table: ExportTable; count: number }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
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
