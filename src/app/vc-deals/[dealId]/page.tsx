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
  const [deal, allInvestors] = await Promise.all([
    db.startupDeal.findUnique({
      where: { id: dealId },
      include: {
        documents: { orderBy: { uploadedAt: "asc" } },
        founders: true,
        capTable: true,
        financingAsks: true,
        riskFlags: { orderBy: { severity: "desc" } },
        competitors: { orderBy: { createdAt: "asc" } },
        commercialProspects: {
          include: {
            contacts: { orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        },
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
    }),
    db.startupInvestor.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
          <a
            href={`/api/export/deal/${deal.id}?format=xlsx`}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Download multi-tab deal spreadsheet for Google Sheets or Excel"
          >
            <span>📊 Export Deal Sheet (.xlsx)</span>
          </a>
          <VcDealActions
            dealId={deal.id}
            hasMatches={deal.matches.length > 0}
            hasExtracted={deal.status !== "UPLOADING" || deal.founders.length > 0 || deal.financingAsks.length > 0}
            hasIntel={deal.competitors.length > 0 && deal.commercialProspects.length > 0}
            hasBenchmark={deal.syndicateBlueprints.length > 0}
          />
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
      <VcDealWorkspaceTabs deal={deal} allInvestors={allInvestors} />
    </div>
  );
}
