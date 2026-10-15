import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { VcDealActions } from "@/components/VcDealActions";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { VcDealWorkspaceTabs } from "@/components/VcDealWorkspaceTabs";

export const dynamic = "force-dynamic";

export default async function VcDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      founders: true,
      capTable: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      competitors: { orderBy: { createdAt: "asc" } },
      commercialProspects: { orderBy: { createdAt: "asc" } },
      matches: {
        include: {
          investor: {
            include: { documentsRequired: true },
          },
        },
        orderBy: [{ isLeadCandidate: "desc" }, { thesisResonanceScore: "desc" }],
      },
      syndicateBlueprints: { orderBy: { createdAt: "desc" }, take: 1 },
      researchRuns: { orderBy: { startedAt: "desc" } },
    },
  });

  if (!deal) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {deal.companyName}
            </h1>
            <Badge tone="green">{deal.stage.replaceAll("_", " ")}</Badge>
            <Badge tone="blue">{deal.primaryVertical.replaceAll("_", " ")}</Badge>
            <Badge tone={deal.status === "COMPLETE" ? "green" : "neutral"}>
              {deal.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {deal.legalEntityJurisdiction} · {deal.documents.length} document{deal.documents.length === 1 ? "" : "s"} ·{" "}
            {deal.matches.length} syndicate match{deal.matches.length === 1 ? "" : "es"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VcDealActions dealId={deal.id} hasMatches={deal.matches.length > 0} />
          <DeleteDealButton
            dealId={deal.id}
            dealName={deal.companyName}
            variant="outline"
            redirectOnDelete={true}
            isVc={true}
          />
        </div>
      </div>

      {/* Structured Interactive Workspace */}
      <VcDealWorkspaceTabs deal={deal} />
    </div>
  );
}
