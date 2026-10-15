"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Sparkles, Globe2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";

export function TradeFunderDealResearchCard({
  dealId,
  dealName,
  corridor,
  defaultHint,
}: {
  dealId: string;
  dealName: string;
  corridor: string;
  defaultHint: string;
}) {
  const router = useRouter();
  const [funderQuery, setFunderQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  async function handleDealResearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSearching(true);
    setError(null);
    setSuccessNotice(null);

    const queryToUse = funderQuery.trim() || defaultHint;

    try {
      // Step 1: Web search across trade desks, commodity banks, and private credit
      setStepLabel(`Querying global trade desks & search engines for "${queryToUse}"…`);
      const searchRes = await fetch(`/api/trade-deals/${dealId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "search", funderHint: queryToUse }),
      });

      if (!searchRes.ok) {
        const body = await searchRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Web search failed.");
      }
      const searchData = await searchRes.json();

      // Step 2: Structure findings into TradeFunder schema
      setStepLabel(`Structuring credit appetite, ticket limits, and collateral terms into catalog…`);
      const structureRes = await fetch(`/api/trade-deals/${dealId}/research`, {
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

      // Step 3: Automatically evaluate and match against this deal
      setStepLabel(`Evaluating newly researched funder "${structureData.funderName}" against deal…`);
      await fetch(`/api/trade-deals/${dealId}/match`, { method: "POST" });

      setSuccessNotice(
        `Successfully researched and added "${structureData.funderName}" to the Trade Funder catalog and updated matches!`,
      );
      setFunderQuery("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deal-specific research failed.");
    } finally {
      setIsSearching(false);
      setStepLabel(null);
    }
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-white to-purple-50/40 dark:border-purple-900/60 dark:from-neutral-900 dark:to-purple-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <CardTitle>Autonomous Trade Funder Research for this Deal</CardTitle>
          </div>
          <Badge tone="purple">Live Web + LLM Agent</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Target a specific institution desk (e.g. <em>&quot;DBS Singapore Coal Desk&quot;</em>, <em>&quot;Sumitomo Mitsui Banking Corp trade facility&quot;</em>)
          or search by market criteria for <strong>{dealName}</strong> ({corridor.replaceAll("_", " ")}).
        </p>

        <form onSubmit={handleDealResearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={funderQuery}
              onChange={(e) => setFunderQuery(e.target.value)}
              placeholder={`Search specific desk or leave empty to auto-discover for ${corridor.replaceAll("_", " ")}…`}
              disabled={isSearching}
              className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-purple-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <Button
            type="submit"
            disabled={isSearching}
            className="shrink-0 bg-purple-700 text-xs hover:bg-purple-800 text-white gap-1.5"
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
          <div className="flex items-center gap-2 rounded-md bg-purple-100/70 p-2 text-xs text-purple-900 dark:bg-purple-950/60 dark:text-purple-300">
            <Globe2 className="h-3.5 w-3.5 animate-spin" />
            <span>{stepLabel}</span>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {successNotice && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{successNotice}</p>}
      </CardContent>
    </Card>
  );
}
