import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { TradeFunderDirectory } from "@/components/TradeFunderDirectory";

export const dynamic = "force-dynamic";

export default async function TradeFundersPage() {
  const funders = await db.tradeFunder.findMany({
    orderBy: { name: "asc" },
    include: { documentsRequired: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Trade Finance Funders &amp; Desks
            </h1>
            <Badge tone="purple">{funders.length} Registered Funders</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500 max-w-3xl">
            Global and regional commodity trade desks, banks, and private debt funds providing Umbrella Facilities
            and modular financing legs (supplier pre-export, in-transit repo, buyer usance) with verified rate evidence and accepted tripartite jurisdictions.
          </p>
        </div>
      </div>

      <TradeFunderDirectory funders={funders} />
    </div>
  );
}
