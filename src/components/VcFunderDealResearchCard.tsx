"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Sparkles, Building2, CheckCircle2, Globe, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";

export function VcFunderDealResearchCard({
  dealId,
  companyName,
  stage,
  vertical,
  jurisdiction,
  defaultHint,
  onResearchComplete,
}: {
  dealId: string;
  companyName: string;
  stage: string;
  vertical: string;
  jurisdiction: string;
  defaultHint?: string;
  onResearchComplete?: () => void;
}) {
  const router = useRouter();
  const [funderQuery, setFunderQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const calculatedDefaultHint =
    defaultHint ||
    `Early-stage venture capital fund or angel syndicate for a ${stage.replaceAll("_", " ")} ${vertical.replaceAll("_", " ")} startup domiciled in ${jurisdiction}`;

  async function handleDealResearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSearching(true);
    setError(null);
    setSuccessNotice(null);

    const queryToUse = funderQuery.trim() || calculatedDefaultHint;

    try {
      // Step 1: Search live venture sources & funder portfolios
      setStepLabel(`Step 1/3: Querying live venture databases & web citations for "${queryToUse}"…`);

      const searchRes = await fetch(`/api/vc-deals/${dealId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "search",
          investorHint: queryToUse,
        }),
      });

      if (!searchRes.ok) {
        const body = await searchRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Live venture search failed.");
      }

      const searchData = await searchRes.json();

      // Step 2: Structure investor thesis, contacts, and cache cited pages
      setStepLabel(`Step 2/3: Structuring thesis, verifying partner contacts & caching cited source pages…`);

      const structureRes = await fetch(`/api/vc-deals/${dealId}/research`, {
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
        throw new Error(body.error ?? "Structuring funder findings failed.");
      }

      const structureData = await structureRes.json();
      const discoveredName = structureData.investorName || queryToUse;

      // Step 3: Re-synthesize syndicate match with newly verified funder
      setStepLabel(`Step 3/3: Re-synthesizing deal syndicate match with newly verified funder "${discoveredName}"…`);

      const matchRes = await fetch(`/api/vc-deals/${dealId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!matchRes.ok) {
        const body = await matchRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Syndicate matching re-evaluation failed.");
      }

      setSuccessNotice(
        `Discovered & verified "${discoveredName}"! Added to funder database and re-synthesized syndicate matches.`
      );
      setFunderQuery("");
      router.refresh();
      if (onResearchComplete) onResearchComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Network connection dropped or timed out while querying venture databases. Please check your connection and retry.");
      } else {
        setError(msg || "Venture research failed.");
      }
    } finally {
      setIsSearching(false);
      setStepLabel(null);
    }
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-white via-purple-50/20 to-purple-100/30 dark:border-purple-900/60 dark:from-neutral-900 dark:via-purple-950/20 dark:to-neutral-900 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <CardTitle className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Autonomous Investor &amp; Funder Research
              </CardTitle>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Research new VC funds, angel syndicates, or scouts even after initial matching has completed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge tone="purple" className="text-[10px]">
              Live Web + Exa + Link Caching
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          Target a specific firm by name (e.g. <em>&quot;Speedinvest&quot;</em>, <em>&quot;Index Ventures seed fund&quot;</em>, <em>&quot;Balderton Capital&quot;</em>, <em>&quot;Tiny VC&quot;</em>)
          or describe funder criteria for <strong>{companyName}</strong> ({stage.replaceAll("_", " ")} · {vertical.replaceAll("_", " ")} · {jurisdiction}).
        </p>

        <form onSubmit={handleDealResearch} className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={funderQuery}
                onChange={(e) => setFunderQuery(e.target.value)}
                placeholder={`e.g. "${calculatedDefaultHint}"...`}
                disabled={isSearching}
                className="w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:border-purple-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <Button
              type="submit"
              disabled={isSearching}
              className="h-9 px-4 text-xs gap-1.5 shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Researching…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Research &amp; Match Funder</span>
                </>
              )}
            </Button>
          </div>

          {stepLabel && (
            <div className="flex items-center gap-2 text-xs font-mono text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-md border border-purple-200 dark:border-purple-900">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-purple-600" />
              <span className="truncate">{stepLabel}</span>
            </div>
          )}

          {successNotice && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-md border border-red-200 dark:border-red-800">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-neutral-500">
          <span className="font-semibold text-neutral-600 dark:text-neutral-400">Quick Searches:</span>
          {["LocalGlobe (UK Seed)", "Index Ventures (Fintech)", "Point Nine (SaaS)", "Speedinvest (European Pre-Seed)"].map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => {
                setFunderQuery(hint);
              }}
              className="rounded-full bg-white dark:bg-neutral-800 px-2 py-0.5 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
            >
              + {hint}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
