import { db } from "@/lib/db";
import { Card, CardContent, Badge, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function TradeFundersPage() {
  const funders = await db.tradeFunder.findMany({
    orderBy: { name: "asc" },
    include: { documentsRequired: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Trade Finance Funders</h1>
        <p className="text-sm text-neutral-500">
          Global and regional trade desks, commodity banks, and private debt funds providing
          Umbrella Facilities and leg-specific financing (supplier pre-export, in-transit repo, buyer usance).
        </p>
      </div>

      {funders.length === 0 ? (
        <EmptyState
          title="No trade funders yet"
          description="Run scripts/seed-trade-funders.ts to seed initial banks (BNI, Mandiri, Rabobank, Channel Capital, Bladex, Incomlend), or auto-research new ones on deal matching."
        />
      ) : (
        <div className="grid gap-4">
          {funders.map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{f.name}</p>
                      {f.offersUmbrellaFacility && (
                        <Badge tone="purple">Umbrella Facility Available</Badge>
                      )}
                      <Badge tone="blue">{f.type.replaceAll("_", " ")}</Badge>
                    </div>
                    {f.indicativePricingGuidance && (
                      <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        Indicative: {f.indicativePricingGuidance}
                      </p>
                    )}
                  </div>
                  <Badge tone={f.confidence === "VERIFIED_DESK" ? "green" : "neutral"}>
                    {f.confidence.replaceAll("_", " ")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <div>
                    <span className="font-medium text-neutral-500">Supported Legs:</span>
                    <p>{f.supportedLegs.join(", ") || "All"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">Corridors:</span>
                    <p>{f.supportedCorridors.join(", ") || "Global"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">Commodities:</span>
                    <p>{f.supportedCommodities.join(", ") || "Diversified"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">Ticket Range:</span>
                    <p>
                      {f.minTicketUsd ? `$${(f.minTicketUsd / 1_000_000).toFixed(1)}M` : "Any"} -{" "}
                      {f.maxTicketUsd ? `$${(f.maxTicketUsd / 1_000_000).toFixed(1)}M` : "Uncapped"}
                    </p>
                  </div>
                </div>

                {f.gatingFactor && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Gating requirement:</span> {f.gatingFactor}
                  </p>
                )}

                {f.documentsRequired.length > 0 && (
                  <div className="text-xs text-neutral-500">
                    <span className="font-medium">Key compliance documents:</span>{" "}
                    {f.documentsRequired.map((d) => d.code).join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
