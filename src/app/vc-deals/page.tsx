import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { Card, CardContent, Button, EmptyState, Badge } from "@/components/ui/primitives";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { VcPipelineExplainer } from "@/components/VcPipelineExplainer";
import { StartupDealStatus, StartupStage, StartupSector } from "@prisma/client";
import { Sparkles, Plus, TrendingUp, Users, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<StartupStage, string> = {
  PRE_SEED: "Pre-Seed",
  SEED: "Seed",
  SERIES_A: "Series A",
  SERIES_B: "Series B",
  GROWTH: "Growth",
};

const SECTOR_LABELS: Record<StartupSector, string> = {
  B2B_SAAS: "B2B SaaS",
  FINTECH: "Fintech",
  AI_ML_INFRASTRUCTURE: "AI/ML Infra",
  GENERATIVE_AI_APPS: "GenAI Apps",
  CLIMATETECH: "ClimateTech",
  HEALTHTECH_BIOTECH: "HealthTech",
  DEV_TOOLS: "DevTools",
  CYBERSECURITY: "Cybersecurity",
  MARKETPLACE_PLATFORM: "Marketplace",
  HARDWARE_ROBOTICS: "Robotics",
  WEB3_CRYPTO: "Web3",
  CONSUMER: "Consumer",
};

const STATUS_TONES: Record<StartupDealStatus, "neutral" | "green" | "amber" | "blue" | "purple"> = {
  UPLOADING: "neutral",
  EXTRACTING: "blue",
  RECONCILING: "blue",
  READY_TO_MATCH: "green",
  MATCHING: "blue",
  RESEARCHING: "purple",
  BENCHMARKING: "purple",
  COMPLETE: "green",
  ARCHIVED: "neutral",
};

export default async function VcDealsPage() {
  const orgId = await getCurrentOrgId();
  const startupDeals = await db.startupDeal.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          matches: true,
          founders: true,
          financingAsks: true,
        },
      },
      founders: true,
      financingAsks: true,
      capTable: true,
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Startup VC Funding Deals
            </h1>
            <Badge tone="green">Syndicate Matching Engine</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
            Match funding-seeking startups with Lead VCs, Angel Platforms, Strategic Domain Angels, and Accelerators in a systematic, multi-tier syndicate structure.
          </p>
        </div>
        <Link href="/vc-deals/new">
          <Button className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5">
            <Plus className="h-4 w-4" />
            <span>New VC Deal</span>
          </Button>
        </Link>
      </div>

      {/* Deals List */}
      {startupDeals.length === 0 ? (
        <EmptyState
          title="No startup VC deals yet"
          description='Click "New VC Deal" to ingest pitch decks, cap table spreadsheets, or Google Sheets models and synthesize syndicate matches.'
        />
      ) : (
        <div className="grid gap-3">
          {startupDeals.map((deal) => {
            const ask = deal.financingAsks[0];
            const targetRaise = ask?.targetRaiseUsd ?? null;
            const valuationCap = ask?.valuationCapUsd;

            return (
              <Card key={deal.id} className="transition-all hover:border-emerald-300 dark:hover:border-emerald-800">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <Link href={`/vc-deals/${deal.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-neutral-900 hover:underline dark:text-neutral-100">
                        {deal.companyName}
                      </p>
                      <Badge tone="green">{STAGE_LABELS[deal.stage] ?? deal.stage}</Badge>
                      <Badge tone="blue">{SECTOR_LABELS[deal.primaryVertical] ?? deal.primaryVertical}</Badge>
                      {deal.legalEntityJurisdiction && (
                        <span className="text-xs text-neutral-400">· {deal.legalEntityJurisdiction}</span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                      <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        Target: {targetRaise ? `$${targetRaise.toLocaleString()} USD` : "Unspecified"}
                      </span>
                      {valuationCap && (
                        <span>Cap: ${valuationCap.toLocaleString()} USD</span>
                      )}
                      <span>·</span>
                      <span>
                        {deal._count.documents} document{deal._count.documents === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>
                        {deal._count.matches} syndicate match{deal._count.matches === 1 ? "" : "es"}
                      </span>
                    </div>

                    {deal.founders.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-400">
                        Founders: {deal.founders.map((f) => `${f.name} (${f.role})`).join(", ")}
                      </p>
                    )}
                  </Link>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={STATUS_TONES[deal.status] ?? "neutral"}>
                      {deal.status.replaceAll("_", " ")}
                    </Badge>
                    <DeleteDealButton
                      dealId={deal.id}
                      dealName={deal.companyName}
                      variant="icon"
                      redirectOnDelete={false}
                      isVc={true}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Systematic 4-Tier Syndicate Matching Architecture Explainer */}
      <VcPipelineExplainer />
    </div>
  );
}
