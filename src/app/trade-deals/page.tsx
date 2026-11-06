import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { Card, CardContent, Button, EmptyState, Badge } from "@/components/ui/primitives";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { TradePipelineExplainer } from "@/components/TradePipelineExplainer";
import { TradeCorridorEnum } from "@prisma/client";

export const dynamic = "force-dynamic";

const CORRIDOR_LABELS: Record<TradeCorridorEnum, string> = {
  IDN_COAL_ASIA: "Indonesian Coal -> Asia",
  SEA_AGRI_GLOBAL: "SE Asian Agri -> Global",
  LATAM_SEAFOOD_ASIA: "LATAM Seafood -> Asia",
  OTHER_CROSS_BORDER: "Cross-Border Trade",
};

const STATUS_TONES: Record<string, "neutral" | "green" | "amber" | "blue" | "purple"> = {
  UPLOADING: "neutral",
  EXTRACTING: "blue",
  RECONCILING: "blue",
  DIAGNOSING: "amber",
  READY_TO_MATCH: "green",
  MATCHING: "blue",
  RESEARCHING: "purple",
  BENCHMARKING: "purple",
  COMPLETE: "green",
  ARCHIVED: "neutral",
};

export default async function TradeDealsPage() {
  const orgId = await getCurrentOrgId();
  const tradeDeals = await db.tradeDeal.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          matches: true,
          contractLegs: true,
          parties: true,
        },
      },
      parties: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Trade Finance Deals</h1>
            <Badge tone="purple">Multi-Party Trade Engine</Badge>
          </div>
          <p className="text-sm text-neutral-500">
            Structure tripartite trade flows (Supplier $\rightarrow$ Trader $\rightarrow$ Buyer), reconcile paired contracts,
            and match Umbrella or Modular leg facilities across specialized commodity corridors.
          </p>
        </div>
        <Link href="/trade-deals/new">
          <Button>New trade deal</Button>
        </Link>
      </div>

      {tradeDeals.length === 0 ? (
        <EmptyState
          title="No trade deals yet"
          description='Click "New trade deal" to upload paired purchase/sales contracts, bills of lading, and trade licenses.'
        />
      ) : (
        <div className="grid gap-3">
          {tradeDeals.map((deal) => {
            const supplier = deal.parties.find((p) => p.role === "SUPPLIER")?.legalName;
            const trader = deal.parties.find((p) => p.role === "TRADER")?.legalName;
            const buyer = deal.parties.find((p) => p.role === "BUYER")?.legalName;

            return (
              <Card key={deal.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4">
                  <Link href={`/trade-deals/${deal.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">
                        {deal.name}
                      </p>
                      <Badge tone="blue">{CORRIDOR_LABELS[deal.corridor] ?? deal.corridor}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">
                      {deal._count.documents} document{deal._count.documents === 1 ? "" : "s"} ·{" "}
                      {deal._count.contractLegs} contract leg{deal._count.contractLegs === 1 ? "" : "s"} ·{" "}
                      {deal._count.matches} funder match{deal._count.matches === 1 ? "" : "es"}
                    </p>
                    {(supplier || trader || buyer) && (
                      <p className="mt-1 text-xs text-neutral-400">
                        {supplier ? `Supplier: ${supplier}` : ""}
                        {trader ? ` · Trader: ${trader}` : ""}
                        {buyer ? ` · Buyer: ${buyer}` : ""}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={STATUS_TONES[deal.status] ?? "neutral"}>
                      {deal.status.replaceAll("_", " ")}
                    </Badge>
                    <DeleteDealButton
                      dealId={deal.id}
                      dealName={deal.name}
                      variant="icon"
                      redirectOnDelete={false}
                      isTrade={true}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 5-Step Pipeline Explainer & Architecture Review Infographic */}
      <TradePipelineExplainer />
    </div>
  );
}
