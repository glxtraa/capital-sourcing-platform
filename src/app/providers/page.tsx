import { db } from "@/lib/db";
import { Card, CardContent, Badge, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const CONFIDENCE_TONE = { VERIFIED_SITE: "green", VERIFIED_SECONDARY: "blue", UNVERIFIED_NEEDS_CHECK: "amber" } as const;

export default async function ProvidersPage() {
  const providers = await db.provider.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Capital providers</h1>
        <p className="text-sm text-neutral-500">
          The shared, cross-deal database — banks, specialist factors, marketplaces, and trade
          finance funds researched (or auto-researched by the feedback loop) so far. Run{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            npx tsx scripts/import-legacy-providers.ts
          </code>{" "}
          to seed this from the manual system&apos;s <code>providers.json</code> before your
          first deal.
        </p>
      </div>

      {providers.length === 0 ? (
        <EmptyState
          title="No providers yet"
          description="Seed the database with the migration script, or let a deal's matching pipeline research new ones automatically."
        />
      ) : (
        <div className="grid gap-3">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.name}</p>
                  <div className="flex gap-1.5">
                    <Badge tone="neutral">{p.type.replaceAll("_", " ")}</Badge>
                    <Badge tone={CONFIDENCE_TONE[p.confidence]}>{p.confidence.replaceAll("_", " ")}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{p.product}</p>
                {p.gatingFactor && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Gating: {p.gatingFactor}</p>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  Seller: {p.sellerJurisdictions.join(", ") || "—"} · Obligor: {p.obligorJurisdictions.join(", ") || "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
