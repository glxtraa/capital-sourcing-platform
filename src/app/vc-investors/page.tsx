import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { VcInvestorDirectory } from "@/components/VcInvestorDirectory";

export const dynamic = "force-dynamic";

export default async function VcInvestorsPage() {
  const investors = await db.startupInvestor.findMany({
    orderBy: { name: "asc" },
    include: {
      documentsRequired: true,
      _count: {
        select: {
          matches: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              VC &amp; Startup Capital Providers
            </h1>
            <Badge tone="green">{investors.length} Verified Providers</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
            Researched database of Institutional VCs, Angel Platforms, Scout Programs, Domain Angels, and Accelerators with verified check sizes, thesis parameters, and anti-portfolio portfolios.
          </p>
        </div>
      </div>

      <VcInvestorDirectory investors={investors} />
    </div>
  );
}
