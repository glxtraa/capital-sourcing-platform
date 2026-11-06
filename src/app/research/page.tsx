import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { ResearchControls } from "@/components/research/ResearchControls";
import { TradeFunderReconControls } from "@/components/research/TradeFunderReconControls";
import { VcInvestorReconControls } from "@/components/research/VcInvestorReconControls";
import { FactoringProviderReconControls } from "@/components/research/FactoringProviderReconControls";
import { CandidateButtons, OnboardingReviewButtons } from "@/components/research/ReviewButtons";

export const dynamic = "force-dynamic";

type WorkspaceId = "startups" | "trade" | "factoring";

type Contact = { channel: string; value: string; purpose: string; sourceUrl: string };
type FormField = { label: string; required: boolean | null; step: string | null; note: string | null };
type Doc = { code: string; note: string | null };

const FACTORING_TABS = [
  { key: "onboarding", label: "Contact & application" },
  { key: "candidates", label: "New providers" },
  { key: "log", label: "Run log" },
] as const;

const STARTUP_TABS = [
  { key: "investors", label: "VC Investor Thesis & Audit" },
  { key: "deals", label: "Competitor & Commercial ICP Recon" },
  { key: "cache", label: "Verified Web Snapshot Cache" },
  { key: "log", label: "Startup Agent Run Log" },
] as const;

const TRADE_TABS = [
  { key: "funders", label: "Trade Funder Desk & Pricing Audit" },
  { key: "corridors", label: "Corridor & Counterparty Recon" },
  { key: "log", label: "Trade Agent Run Log" },
] as const;

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieWs = cookieStore.get("tr3_last_workspace")?.value;

  const rawWs = params.workspace || cookieWs || "startups";
  const workspace: WorkspaceId =
    rawWs === "startups" || rawWs === "trade" || rawWs === "factoring" ? rawWs : "startups";

  if (workspace === "startups") {
    const activeTab = params.tab && STARTUP_TABS.some((t) => t.key === params.tab) ? params.tab : "investors";
    return <StartupResearchView activeTab={activeTab} />;
  }

  if (workspace === "trade") {
    const activeTab = params.tab && TRADE_TABS.some((t) => t.key === params.tab) ? params.tab : "funders";
    return <TradeResearchView activeTab={activeTab} />;
  }

  const activeTab = params.tab && FACTORING_TABS.some((t) => t.key === params.tab) ? params.tab : "onboarding";
  return <FactoringResearchView activeTab={activeTab} />;
}

/* ============================================================================
 * 1. STARTUP & VC INTELLIGENCE RECON (workspace === "startups")
 * ========================================================================== */

async function StartupResearchView({ activeTab }: { activeTab: string }) {
  const [investorCount, dealCount, competitorCount, prospectCount, cacheCount, runCount] = await Promise.all([
    db.startupInvestor.count(),
    db.startupDeal.count(),
    db.startupCompetitor.count(),
    db.startupCommercialProspect.count(),
    db.researchPageCache.count(),
    db.startupResearchRun.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-800 dark:bg-violet-950/70 dark:text-violet-300">
              Startup Hub · Asset-Isolated Recon
            </span>
            <span className="text-xs text-slate-400">
              {investorCount} VC Funds · {competitorCount} Competitors · {prospectCount} Commercial ICPs · {cacheCount} Cached Snapshots
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Startup &amp; VC Intelligence Recon</h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Audit verified VC investor theses, partner contacts, portfolio conflict checks, startup competitor landscapes,
            and commercial B2B customer/partner leads — backed by immutable web page snapshots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/vc-deals"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            ← Startup Deals
          </Link>
          <Link
            href="/vc-investors"
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-500"
          >
            Manage VC Directory →
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200 text-sm dark:border-slate-800">
        {STARTUP_TABS.map((t) => {
          const count =
            t.key === "investors"
              ? investorCount
              : t.key === "deals"
                ? dealCount
                : t.key === "cache"
                  ? cacheCount
                  : runCount;
          return (
            <Link
              key={t.key}
              href={`/research?workspace=startups&tab=${t.key}`}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 transition-colors ${
                activeTab === t.key
                  ? "border-violet-600 font-semibold text-violet-700 dark:border-violet-400 dark:text-violet-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>{t.label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {activeTab === "investors" && <StartupInvestorReconTab />}
      {activeTab === "deals" && <StartupDealCompetitorAndIcpTab />}
      {activeTab === "cache" && <StartupPageCacheTab />}
      {activeTab === "log" && <StartupRunLogTab />}
    </div>
  );
}

async function StartupInvestorReconTab() {
  const investors = await db.startupInvestor.findMany({
    orderBy: [{ activelyFundingIndustry: "desc" }, { updatedAt: "desc" }],
  });

  if (investors.length === 0) {
    return (
      <EmptyState
        title="No VC investors profiled yet"
        description="Visit VC Investors or a Startup Deal workspace to run live VC thesis and partner recon."
      />
    );
  }

  return (
    <div className="space-y-4">
      <VcInvestorReconControls investors={investors.map((inv) => ({ id: inv.id, name: inv.name, type: inv.type, confidence: inv.confidence, lastVerified: inv.lastVerified }))} />
      <div className="grid gap-4">
      {investors.map((inv) => {
        const recentInvestments = Array.isArray(inv.recentIndustryInvestments)
          ? (inv.recentIndustryInvestments as Array<{
              companyName?: string;
              dealYear?: string | number;
              roundStage?: string;
              sector?: string;
              sourceUrl?: string;
            }>)
          : [];
        const contacts = Array.isArray(inv.keyContactsJson)
          ? (inv.keyContactsJson as Array<{
              name?: string;
              role?: string;
              email?: string;
              linkedinUrl?: string;
            }>)
          : [];

        return (
          <Card key={inv.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/vc-investors`}
                      className="text-base font-bold text-slate-900 hover:text-violet-600 dark:text-white dark:hover:text-violet-400"
                    >
                      {inv.name}
                    </Link>
                    {inv.websiteUrl && (
                      <a
                        href={inv.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-violet-600 underline dark:text-violet-400"
                      >
                        Website ↗
                      </a>
                    )}
                    {inv.websiteUrl && (
                      <a
                        href={`/api/page-cache?url=${encodeURIComponent(inv.websiteUrl)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Cached Snapshot
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {inv.headquarters ?? "Global"} · Stages: {inv.targetStages.join(", ")} · Check:{" "}
                    {inv.minCheckUsd ? `$${(inv.minCheckUsd / 1e6).toFixed(1)}M` : "—"} –{" "}
                    {inv.maxCheckUsd ? `$${(inv.maxCheckUsd / 1e6).toFixed(1)}M` : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={inv.activelyFundingIndustry ? "green" : "amber"}>
                    {inv.activelyFundingIndustry ? "ACTIVELY DEPLOYING" : "SELECTIVE / PAUSED"}
                  </Badge>
                  <Badge>{inv.type.replaceAll("_", " ")}</Badge>
                  <Badge tone={inv.confidence === "VERIFIED_SITE" ? "green" : "blue"}>
                    {inv.confidence.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>

              {inv.thesisMatchSummary && (
                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <strong className="font-semibold text-slate-900 dark:text-white">Verified Thesis Summary: </strong>
                  {inv.thesisMatchSummary}
                </p>
              )}

              <div className="grid gap-4 text-xs md:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-slate-400">
                    Recent Industry Deals ({recentInvestments.length})
                  </p>
                  {recentInvestments.length === 0 ? (
                    <p className="text-slate-400">No recent industry deals logged yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {recentInvestments.slice(0, 4).map((ri, idx) => (
                        <li key={idx} className="flex flex-wrap items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{ri.companyName}</span>
                          {ri.roundStage && <span className="text-slate-400">({ri.roundStage})</span>}
                          {ri.dealYear && <span className="text-slate-400">· {ri.dealYear}</span>}
                          {ri.sourceUrl && (
                            <a
                              href={`/api/page-cache?url=${encodeURIComponent(ri.sourceUrl)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-violet-600 underline"
                            >
                              [Cached Proof]
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-slate-400">
                    Partner &amp; Investment Team Contacts ({contacts.length})
                  </p>
                  {contacts.length === 0 ? (
                    <p className="text-slate-400">No partner contacts extracted yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {contacts.slice(0, 4).map((c, idx) => (
                        <li key={idx} className="flex flex-wrap items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{c.name}</span>
                          {c.role && <span className="text-slate-400">· {c.role}</span>}
                          {c.linkedinUrl && (
                            <>
                              <a
                                href={c.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-600 underline"
                              >
                                LinkedIn ↗
                              </a>
                              <a
                                href={`/api/page-cache?url=${encodeURIComponent(c.linkedinUrl)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-violet-50 px-1 py-0.2 text-[10px] font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                              >
                                Cached Profile
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}

async function StartupDealCompetitorAndIcpTab() {
  const deals = await db.startupDeal.findMany({
    include: {
      competitors: { orderBy: { createdAt: "desc" } },
      commercialProspects: {
        include: { contacts: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (deals.length === 0) {
    return <EmptyState title="No startup deals yet" description="Create a startup deal to run competitor and commercial ICP recon." />;
  }

  return (
    <div className="grid gap-4">
      {deals.map((deal) => (
        <Card key={deal.id}>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link
                  href={`/vc-deals/${deal.id}`}
                  className="text-base font-bold text-slate-900 hover:text-violet-600 dark:text-white"
                >
                  {deal.companyName}
                </Link>
                <p className="text-xs text-slate-500">
                  {deal.stage} · {deal.primaryVertical.replaceAll("_", " ")} · {deal.legalEntityJurisdiction}
                  {deal.industry ? ` · ${deal.industry}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="blue">{deal.competitors.length} Competitors</Badge>
                <Badge tone="green">{deal.commercialProspects.length} Commercial ICP Accounts</Badge>
                <Link
                  href={`/vc-deals/${deal.id}`}
                  className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                >
                  Open Deal Workspace →
                </Link>
              </div>
            </div>

            <div className="grid gap-4 text-xs md:grid-cols-2">
              <div className="space-y-1.5 rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
                <p className="font-semibold uppercase tracking-wider text-slate-400">
                  Discovered Competitors ({deal.competitors.length})
                </p>
                {deal.competitors.length === 0 ? (
                  <p className="text-slate-400">No competitors discovered yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {deal.competitors.map((comp) => (
                      <li key={comp.id} className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 pb-1 last:border-none dark:border-slate-800/60">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{comp.name}</span>{" "}
                          <span className="text-[10px] text-slate-400">({comp.overlapDegree})</span>
                          {comp.knownInvestors.length > 0 && (
                            <p className="text-[11px] text-slate-500">Backed by: {comp.knownInvestors.join(", ")}</p>
                          )}
                        </div>
                        {comp.sourceUrl && (
                          <a
                            href={`/api/page-cache?url=${encodeURIComponent(comp.sourceUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            Cached Snapshot
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
                <p className="font-semibold uppercase tracking-wider text-slate-400">
                  Commercial Target Accounts &amp; Contacts ({deal.commercialProspects.length})
                </p>
                {deal.commercialProspects.length === 0 ? (
                  <p className="text-slate-400">No commercial prospects generated yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {deal.commercialProspects.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 pb-1 last:border-none dark:border-slate-800/60">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>{" "}
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            ({p.category.replaceAll("_", " ")})
                          </span>
                          <p className="text-[11px] text-slate-500">
                            {p.contacts.length} executive contact{p.contacts.length === 1 ? "" : "s"} identified
                          </p>
                        </div>
                        {p.sourceUrl && (
                          <a
                            href={`/api/page-cache?url=${encodeURIComponent(p.sourceUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            Cached Snapshot
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function StartupPageCacheTab() {
  const snapshots = await db.researchPageCache.findMany({
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      url: true,
      title: true,
      snippet: true,
      httpStatus: true,
      byteSize: true,
      cachedAt: true,
    },
  });

  if (snapshots.length === 0) {
    return <EmptyState title="No cached snapshots yet" description="Verified web pages from VC, competitor, and LinkedIn recon appear here." />;
  }

  return (
    <div className="grid gap-2.5">
      {snapshots.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {s.title || s.url}
                </p>
                <Badge tone={s.httpStatus >= 200 && s.httpStatus < 400 ? "green" : "blue"}>
                  HTTP {s.httpStatus}
                </Badge>
              </div>
              <p className="truncate text-xs text-slate-400">{s.url}</p>
              {s.snippet && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{s.snippet}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/api/page-cache?url=${encodeURIComponent(s.url)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-500"
              >
                View Cached Snapshot
              </a>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Live URL ↗
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function StartupRunLogTab() {
  const runs = await db.startupResearchRun.findMany({
    include: { deal: { select: { id: true, companyName: true } } },
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  if (runs.length === 0) {
    return <EmptyState title="No Startup agent runs logged yet" />;
  }

  return (
    <div className="grid gap-3">
      {runs.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-1.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  {r.triggeredBy}
                </span>
                {r.deal && (
                  <Link
                    href={`/vc-deals/${r.deal.id}`}
                    className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 hover:underline dark:bg-violet-950/60 dark:text-violet-300"
                  >
                    {r.deal.companyName}
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === "DONE" || r.status === "COMPLETED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>
                  {r.status}
                </Badge>
                <span className="text-xs text-slate-400">{r.startedAt.toLocaleString()}</span>
              </div>
            </div>
            {r.inputSummary && <p className="text-xs text-slate-500">Input: {r.inputSummary}</p>}
            {r.outputSummary && <p className="text-xs text-slate-700 dark:text-slate-300">{r.outputSummary}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================================
 * 2. TRADE FINANCE INTELLIGENCE RECON (workspace === "trade")
 * ========================================================================== */

async function TradeResearchView({ activeTab }: { activeTab: string }) {
  const [funderCount, dealCount, runCount] = await Promise.all([
    db.tradeFunder.count(),
    db.tradeDeal.count(),
    db.tradeResearchRun.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
              Trade Finance · Asset-Isolated Recon
            </span>
            <span className="text-xs text-slate-400">
              {funderCount} Commodity &amp; Trade Funders · {dealCount} Active Corridor Deals
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Trade Finance &amp; Commodity Funder Recon</h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Verify commodity trade finance desks, SOFR margin guidance, umbrella SBLC / LC appetite, and cross-border
            corridor eligibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/trade-deals"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            ← Trade Deals
          </Link>
          <Link
            href="/trade-funders"
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-500"
          >
            Manage Trade Funders →
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200 text-sm dark:border-slate-800">
        {TRADE_TABS.map((t) => {
          const count = t.key === "funders" ? funderCount : t.key === "corridors" ? dealCount : runCount;
          return (
            <Link
              key={t.key}
              href={`/research?workspace=trade&tab=${t.key}`}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 transition-colors ${
                activeTab === t.key
                  ? "border-amber-600 font-semibold text-amber-700 dark:border-amber-400 dark:text-amber-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>{t.label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {activeTab === "funders" && <TradeFunderAuditTab />}
      {activeTab === "corridors" && <TradeCorridorReconTab />}
      {activeTab === "log" && <TradeRunLogTab />}
    </div>
  );
}

async function TradeFunderAuditTab() {
  const funders = await db.tradeFunder.findMany({
    orderBy: [{ offersUmbrellaFacility: "desc" }, { name: "asc" }],
  });

  if (funders.length === 0) {
    return <EmptyState title="No trade funders registered yet" />;
  }

  return (
    <div className="space-y-4">
      <TradeFunderReconControls funders={funders.map((f) => ({ id: f.id, name: f.name, type: f.type, confidence: f.confidence, lastVerified: f.lastVerified }))} />
      <div className="grid gap-3">
      {funders.map((f) => (
        <Card key={f.id}>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/trade-funders?inspect=${f.id}`} className="font-bold text-slate-900 hover:text-amber-600 dark:text-white">
                  {f.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {f.type.replaceAll("_", " ")} · Ticket:{" "}
                  {f.minTicketUsd ? `$${(f.minTicketUsd / 1e6).toFixed(1)}M` : "—"} –{" "}
                  {f.maxTicketUsd ? `$${(f.maxTicketUsd / 1e6).toFixed(1)}M` : "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.offersUmbrellaFacility && <Badge tone="green">Umbrella End-to-End</Badge>}
                <Badge tone={f.confidence === "VERIFIED_SITE" ? "green" : "blue"}>
                  {f.confidence.replaceAll("_", " ")}
                </Badge>
              </div>
            </div>
            {f.indicativePricingGuidance && (
              <p className="text-xs text-slate-700 dark:text-slate-300">
                <strong>Pricing Guidance:</strong> {f.indicativePricingGuidance}
              </p>
            )}
            {f.rateEvidenceSnippet && (
              <p className="rounded bg-amber-50/70 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <strong>Rate Evidence:</strong> {f.rateEvidenceSnippet}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Corridors: {f.supportedCorridors.join(", ")} · Commodities: {f.supportedCommodities.join(", ")}
            </p>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}

async function TradeCorridorReconTab() {
  const deals = await db.tradeDeal.findMany({
    include: {
      parties: true,
      contractLegs: true,
      matches: { include: { funder: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (deals.length === 0) {
    return <EmptyState title="No trade corridor deals yet" />;
  }

  return (
    <div className="grid gap-3">
      {deals.map((d) => (
        <Card key={d.id}>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/trade-deals/${d.id}`} className="font-bold text-slate-900 hover:text-amber-600 dark:text-white">
                  {d.name}
                </Link>
                <p className="text-xs text-slate-500">
                  Corridor: {d.corridor.replaceAll("_", " ")} · Status: {d.status}
                </p>
              </div>
              <Link
                href={`/trade-deals/${d.id}`}
                className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
              >
                Open Trade Workspace →
              </Link>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Parties: {d.parties.map((p) => `${p.legalName} (${p.role})`).join(" · ") || "None extracted"}
            </p>
            <p className="text-xs text-slate-500">
              Contract Legs: {d.contractLegs.length} · Matched Funders: {d.matches.length}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function TradeRunLogTab() {
  const runs = await db.tradeResearchRun.findMany({
    include: { deal: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  if (runs.length === 0) {
    return <EmptyState title="No Trade Finance agent runs logged yet" />;
  }

  return (
    <div className="grid gap-3">
      {runs.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-1 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{r.triggeredBy}</span>
                {r.deal && (
                  <Link href={`/trade-deals/${r.deal.id}`} className="text-xs text-amber-700 underline">
                    {r.deal.name}
                  </Link>
                )}
              </div>
              <Badge tone={r.status === "DONE" || r.status === "COMPLETED" ? "green" : "amber"}>{r.status}</Badge>
            </div>
            {r.inputSummary && <p className="text-xs text-slate-500">Input: {r.inputSummary}</p>}
            {r.outputSummary && <p className="text-xs text-slate-700 dark:text-slate-300">{r.outputSummary}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================================
 * 3. INVOICE FACTORING INTELLIGENCE RECON (workspace === "factoring")
 * ========================================================================== */

async function FactoringResearchView({ activeTab }: { activeTab: string }) {
  const [allProviders, providerCount, openBatch, pendingOnboarding, pendingCandidates] = await Promise.all([
    db.provider.findMany({ orderBy: { name: "asc" } }),
    db.provider.count(),
    db.researchBatch.findFirst({ where: { finishedAt: null }, orderBy: { createdAt: "desc" } }),
    db.providerOnboarding.count({ where: { status: "PENDING_REVIEW" } }),
    db.providerCandidate.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
            Invoice Factoring · Asset-Isolated Recon
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Factoring Provider Intelligence Recon</h1>
        <p className="max-w-3xl text-sm text-neutral-500">
          Batch-research how to contact each receivables/factoring provider and what its application needs (official sources
          only), and look for new providers — family offices, private credit and platforms — based on your deals&apos;
          jurisdictions. Results are proposals: nothing changes in the provider database until you accept it.
        </p>
      </div>

      <FactoringProviderReconControls providers={allProviders.map((p) => ({ id: p.id, name: p.name, type: p.type, confidence: p.confidence, lastVerified: p.lastVerified }))} />
      <ResearchControls providerCount={providerCount} openBatchId={openBatch?.id ?? null} />

      <nav className="flex gap-1 border-b border-neutral-200 text-sm dark:border-neutral-800">
        {FACTORING_TABS.map((t) => {
          const n = t.key === "onboarding" ? pendingOnboarding : t.key === "candidates" ? pendingCandidates : 0;
          return (
            <Link
              key={t.key}
              href={`/research?workspace=factoring&tab=${t.key}`}
              className={`-mb-px border-b-2 px-3 py-2 ${
                activeTab === t.key
                  ? "border-indigo-600 font-semibold text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                  : "border-transparent text-neutral-500"
              }`}
            >
              {t.label}
              {n > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {activeTab === "candidates" ? <Candidates /> : activeTab === "log" ? <RunLog /> : <Onboarding />}
    </div>
  );
}

async function Onboarding() {
  const rows = await db.providerOnboarding.findMany({
    where: { status: { in: ["PENDING_REVIEW", "ACCEPTED"] } },
    include: { provider: { select: { name: true, applicationUrl: true, contact: true } } },
    orderBy: [{ status: "asc" }, { researchedAt: "desc" }],
  });
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No onboarding research yet"
        description="Click “Run research” above to research contact channels and application requirements for every provider."
      />
    );
  }
  return (
    <div className="grid gap-3">
      {rows.map((r) => {
        const contacts = r.contacts as Contact[];
        const fields = r.formFields as FormField[];
        const docs = r.documentsToPrepare as Doc[];
        const steps = [...new Set(fields.map((f) => f.step ?? "Form"))];
        return (
          <Card key={r.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{r.provider.name}</p>
                  <p className="text-xs text-neutral-400">Researched {r.researchedAt.toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={r.status === "ACCEPTED" ? "green" : "amber"}>{r.status.replace("_", " ")}</Badge>
                  <Badge>{r.applicationRoute.replaceAll("_", " ")}</Badge>
                  <Badge
                    tone={
                      r.confidence === "VERIFIED_SITE"
                        ? "green"
                        : r.confidence === "VERIFIED_SECONDARY"
                          ? "blue"
                          : "amber"
                    }
                  >
                    {r.confidence.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-neutral-400">Official contacts</p>
                  {contacts.length === 0 && <p className="text-neutral-500">None verified.</p>}
                  {contacts.map((c, i) => (
                    <p key={i}>
                      <span className="text-xs text-neutral-400">
                        {c.channel} · {c.purpose.replace("_", " ").toLowerCase()}
                      </span>{" "}
                      {c.channel === "WEB_FORM" ? (
                        <a className="underline" href={c.value} target="_blank" rel="noreferrer">
                          {c.value}
                        </a>
                      ) : (
                        c.value
                      )}
                    </p>
                  ))}
                  {r.applicationUrl && (
                    <p>
                      <span className="text-xs text-neutral-400">APPLICATION</span>{" "}
                      <a className="underline" href={r.applicationUrl} target="_blank" rel="noreferrer">
                        {r.applicationUrl}
                      </a>
                      {r.accountRequiredBeforeForm != null && (
                        <span className="text-xs text-neutral-500">
                          {" "}
                          · account {r.accountRequiredBeforeForm ? "required first" : "not required first"}
                        </span>
                      )}
                    </p>
                  )}
                  {r.typicalTurnaround && <p className="text-neutral-500">Turnaround: {r.typicalTurnaround}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-neutral-400">Steps</p>
                  {r.steps.length === 0 && <p className="text-neutral-500">Not published.</p>}
                  <ol className="list-decimal space-y-0.5 pl-4">
                    {r.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {(fields.length > 0 || r.formFieldsVisibility !== "FULL") && (
                <div className="text-sm">
                  <p className="text-xs font-semibold uppercase text-neutral-400">
                    Form fields to gather beforehand{" "}
                    <span className="font-normal normal-case">
                      (
                      {r.formFieldsVisibility === "FULL"
                        ? "full form visible"
                        : r.formFieldsVisibility === "PARTIAL"
                          ? "only part of the form was visible"
                          : "form fields not visible publicly"}
                      )
                    </span>
                  </p>
                  {steps.map((step) => (
                    <div key={step} className="mt-1">
                      <p className="text-xs text-neutral-500">{step}</p>
                      <ul className="flex flex-wrap gap-1.5 pt-0.5">
                        {fields
                          .filter((f) => (f.step ?? "Form") === step)
                          .map((f, i) => (
                            <li
                              key={i}
                              title={f.note ?? undefined}
                              className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800"
                            >
                              {f.label}
                              {f.required ? " *" : ""}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {docs.length > 0 && (
                <p className="text-sm">
                  <span className="text-xs font-semibold uppercase text-neutral-400">Documents to prepare </span>
                  {docs.map((d) => d.code).join(", ")}
                </p>
              )}
              {r.eligibilityChecks.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Check first: {r.eligibilityChecks.join(" · ")}
                </p>
              )}
              {r.notes && <p className="whitespace-pre-line text-xs text-neutral-500">{r.notes}</p>}
              {r.sources.length > 0 && (
                <p className="break-all text-xs text-neutral-400">Sources: {r.sources.join(" · ")}</p>
              )}
              {r.status === "PENDING_REVIEW" && <OnboardingReviewButtons id={r.id} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function Candidates() {
  const rows = await db.providerCandidate.findMany({
    where: { status: { not: "REJECTED" } },
    orderBy: [{ status: "asc" }, { discoveredAt: "desc" }],
  });
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No new providers found yet"
        description="Run research with “Also look for new providers” ticked. Discovery uses the jurisdictions, currencies and structures in your deals."
      />
    );
  }
  return (
    <div className="grid gap-3">
      {rows.map((c) => (
        <Card key={c.id}>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {c.name}{" "}
                {c.websiteUrl && (
                  <a
                    href={c.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-normal text-neutral-500 underline"
                  >
                    {c.domain}
                  </a>
                )}
              </p>
              <div className="flex gap-1.5">
                <Badge>{c.suggestedType.replaceAll("_", " ")}</Badge>
                {c.status === "PROMOTED" && (
                  <Link
                    href={`/providers${c.promotedProviderId ? `?inspect=${c.promotedProviderId}` : ""}`}
                    className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                  >
                    In provider database →
                  </Link>
                )}
              </div>
            </div>
            <p className="text-sm">{c.description}</p>
            <p className="text-sm text-neutral-500">Why surfaced: {c.whySurfaced}</p>
            {c.jurisdictionsHint.length > 0 && (
              <p className="text-xs text-neutral-400">Jurisdictions: {c.jurisdictionsHint.join(", ")}</p>
            )}
            <p className="break-all text-xs text-neutral-400">Sources: {c.sources.join(" · ")}</p>
            {c.status === "PENDING_REVIEW" && <CandidateButtons id={c.id} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RunLog() {
  const batches = await db.researchBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { tasks: { orderBy: { createdAt: "asc" } } },
  });
  if (batches.length === 0) return <EmptyState title="No batches yet" />;
  return (
    <div className="grid gap-3">
      {batches.map((b) => {
        const failed = b.tasks.filter((t) => t.status === "FAILED");
        const done = b.tasks.filter((t) => t.status === "DONE").length;
        return (
          <Card key={b.id}>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{b.label}</p>
                <div className="flex gap-1.5">
                  <Badge>{b.triggeredBy}</Badge>
                  <Badge tone={b.finishedAt ? "green" : "amber"}>{b.finishedAt ? "finished" : "unfinished"}</Badge>
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Started {b.createdAt.toLocaleString()} · {done}/{b.tasks.length} done · {failed.length} failed
              </p>
              {failed.map((t) => (
                <p key={t.id} className="text-xs text-red-600">
                  {t.subject}: {t.error}
                </p>
              ))}
              <details className="text-xs text-neutral-500">
                <summary className="cursor-pointer">Tasks</summary>
                <ul className="mt-1 space-y-0.5">
                  {b.tasks.map((t) => (
                    <li key={t.id} className="border-t border-neutral-100 pt-1 first:border-none first:pt-0 dark:border-neutral-800">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {t.kind} · {t.subject}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400">
                          Status: {t.status}
                        </span>
                      </div>
                      {t.resultSummary && (
                        <p className="text-neutral-600 dark:text-neutral-300 mt-0.5">{t.resultSummary}</p>
                      )}
                      {t.findings && (
                        <details className="mt-1 text-[11px] text-neutral-500">
                          <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline">
                            View research findings &amp; citations
                          </summary>
                          <div className="mt-1 rounded bg-neutral-50 p-2 font-mono text-[10px] text-neutral-700 whitespace-pre-wrap dark:bg-neutral-900 dark:text-neutral-300 max-h-48 overflow-y-auto">
                            {t.findings}
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
