import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { TradeDealActions } from "@/components/TradeDealActions";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { TradeDealWorkspaceTabs } from "@/components/TradeDealWorkspaceTabs";

export const dynamic = "force-dynamic";

export default async function TradeDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await db.tradeDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      parties: true,
      contractLegs: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      matches: { include: { funder: true }, orderBy: { createdAt: "desc" } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!deal) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{deal.name}</h1>
            <Badge tone="purple">{deal.corridor.replaceAll("_", " ")}</Badge>
            <Badge tone={deal.status === "COMPLETE" ? "green" : "blue"}>
              {deal.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            {deal.documents.length} document{deal.documents.length === 1 ? "" : "s"} ·{" "}
            {deal.contractLegs.length} paired contract{deal.contractLegs.length === 1 ? "" : "s"} ·{" "}
            {deal.matches.length} funder match{deal.matches.length === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TradeDealActions dealId={deal.id} hasMatches={deal.matches.length > 0} />
          <DeleteDealButton
            dealId={deal.id}
            dealName={deal.name}
            variant="outline"
            redirectOnDelete={true}
            isTrade={true}
          />
        </div>
      </div>

      {/* Structured 4-Stage Tabbed Workspace */}
      <TradeDealWorkspaceTabs deal={deal} />
    </div>
  );
}
