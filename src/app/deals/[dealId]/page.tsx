import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DealStatusPoller } from "@/components/DealStatusPoller";
import { DealActions } from "@/components/DealActions";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { InvoiceDealWorkspaceTabs } from "@/components/InvoiceDealWorkspaceTabs";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      parties: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      providerMatches: { include: { provider: { include: { documentsRequired: true } } } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 1 },
      researchRuns: { orderBy: { startedAt: "desc" } },
    },
  });
  if (!deal) notFound();

  return (
    <div className="space-y-6">
      <DealStatusPoller dealId={deal.id} status={deal.status} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{deal.name}</h1>
            <DealStatusBadge status={deal.status} />
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            {deal.documents.length} document{deal.documents.length === 1 ? "" : "s"} uploaded ·{" "}
            {deal.parties.length} part{deal.parties.length === 1 ? "y" : "ies"} ·{" "}
            {deal.providerMatches.length} provider match{deal.providerMatches.length === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DealActions dealId={deal.id} status={deal.status} hasMatches={deal.providerMatches.length > 0} />
          <DeleteDealButton dealId={deal.id} dealName={deal.name} variant="outline" redirectOnDelete={true} />
        </div>
      </div>

      {/* 4-Stage Tabbed Workspace UI */}
      <InvoiceDealWorkspaceTabs deal={deal} />
    </div>
  );
}
