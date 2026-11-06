"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Sparkles, Building2, CheckCircle2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";
import { AgentTrialsAuditDrawer } from "@/components/AgentTrialsAuditDrawer";

export function InvoiceProviderDealResearchCard({
  dealId,
  dealName,
  borrowerJurisdiction,
  obligorJurisdiction,
  defaultHint,
  onResearchComplete,
}: {
  dealId: string;
  dealName: string;
  borrowerJurisdiction?: string | null;
  obligorJurisdiction?: string | null;
  defaultHint?: string;
  onResearchComplete?: () => void;
}) {
  const router = useRouter();
  const [providerQuery, setProviderQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showTrialsDrawer, setShowTrialsDrawer] = useState(false);

  const fallbackHint =
    defaultHint ||
    `Invoice factoring provider or receivables financier for borrower in ${borrowerJurisdiction || "any"} and obligor in ${obligorJurisdiction || "any"}`;

  async function handleDealResearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSearching(true);
    setError(null);
    setSuccessNotice(null);

    const queryToUse = providerQuery.trim() || fallbackHint;

    try {
      setStepLabel(`Querying live factoring directories & institutional sources for "${queryToUse}"…`);
      const searchRes = await fetch(`/api/deals/${dealId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "search", funderHint: queryToUse }),
      });

      if (!searchRes.ok) {
        const body = await searchRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Web search failed.");
      }
      const searchData = await searchRes.json();

      setStepLabel(`Structuring provider criteria, recourse options, and jurisdiction limits…`);
      const structureRes = await fetch(`/api/deals/${dealId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "structure",
          runId: searchData.runId,
          hint: searchData.hint,
          findings: searchData.findings,
          citedUrls: searchData.citedUrls,
        }),
      });

      if (!structureRes.ok) {
        const body = await structureRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Structuring provider findings failed.");
      }
      const structureData = await structureRes.json();

      setStepLabel(`Evaluating newly researched provider "${structureData.providerName}" against deal…`);
      await fetch(`/api/deals/${dealId}/match`, { method: "POST" });

      setSuccessNotice(
        `Successfully researched and added "${structureData.providerName}" to the factoring provider catalog! Match evaluation completed.`,
      );
      setProviderQuery("");
      router.refresh();
      if (onResearchComplete) onResearchComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider research failed.");
    } finally {
      setIsSearching(false);
      setStepLabel(null);
    }
  }

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 dark:border-indigo-900/60 dark:from-neutral-900 dark:to-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <CardTitle>Autonomous Factoring Provider Research for this Deal</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="blue">Live Web + LLM Agent</Badge>
            <button
              type="button"
              onClick={() => setShowTrialsDrawer(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-indigo-200 dark:border-indigo-800 bg-white/80 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors shadow-xs"
            >
              <History className="h-3.5 w-3.5 text-indigo-500" />
              <span>Trials &amp; Grounding Audit</span>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Target a specific factoring institution (e.g. <em>&quot;Stenn International invoice facility&quot;</em>, <em>&quot;Bibby Financial Services cross-border factoring&quot;</em>)
          or search by market criteria for <strong>{dealName}</strong> ({borrowerJurisdiction || "Global"} → {obligorJurisdiction || "Global"}).
        </p>

        <form onSubmit={handleDealResearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={providerQuery}
              onChange={(e) => setProviderQuery(e.target.value)}
              placeholder={`Search specific provider or leave empty to auto-discover for this corridor…`}
              disabled={isSearching}
              className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <Button
            type="submit"
            disabled={isSearching}
            className="shrink-0 bg-indigo-700 text-xs hover:bg-indigo-800 text-white gap-1.5"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Researching…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Research &amp; Match</span>
              </>
            )}
          </Button>
        </form>

        {stepLabel && (
          <div className="flex items-center gap-2 rounded-md bg-indigo-100/70 p-2 text-xs text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            <span>{stepLabel}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setShowTrialsDrawer(true)}
              className="underline font-semibold shrink-0 text-red-800 dark:text-red-200 hover:text-red-950"
            >
              View Failure Trials ({">"})
            </button>
          </div>
        )}
        {successNotice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        <AgentTrialsAuditDrawer
          dealId={dealId}
          assetClass="INVOICE"
          isOpen={showTrialsDrawer}
          onClose={() => setShowTrialsDrawer(false)}
        />
      </CardContent>
    </Card>
  );
}
