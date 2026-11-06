import { db } from "@/lib/db";
import { ProviderDirectoryClient } from "@/components/ProviderDirectoryClient";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const providers = await db.provider.findMany({
    include: {
      documentsRequired: true,
      onboardings: {
        where: { status: "ACCEPTED" },
        orderBy: { researchedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Capital providers</h1>
        <p className="text-sm text-neutral-500">
          The shared, cross-deal database — banks, specialist factors, marketplaces, and trade
          finance funds researched (or auto-researched by the feedback loop) so far.
        </p>
      </div>

      <ProviderDirectoryClient providers={providers} />
    </div>
  );
}
