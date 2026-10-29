"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Sparkles, Globe2, Building2, CheckCircle2, FileCode, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";
import { TradeFunderInspectorModal } from "@/components/TradeFunderInspectorModal";

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
  const [researchedFunderData, setResearchedFunderData] = useState<any | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showFullFindings, setShowFullFindings] = useState(false);

  async function handleDealResearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSearching(true);
    setError(null);
    setSuccessNotice(null);
    setResearchedFunderData(null);

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

      setResearchedFunderData({
        ...structureData.funder,
        rawFindings: searchData.findings,
        citedUrls: searchData.citedUrls,
      });

      setSuccessNotice(
        `Successfully researched and extracted "${structureData.funderName}"! Match evaluation completed.`,
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
        {successNotice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {successNotice}
              </span>
              {researchedFunderData && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsInspectorOpen(true)}
                  className="h-7 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300"
                >
                  <FileCode className="h-3 w-3 text-emerald-600" />
                  Inspect Extracted Funder Profile &amp; DSL
                </Button>
              )}
            </div>

            {/* Quick Extraction Highlights */}
            {researchedFunderData && (
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-neutral-500 font-medium">Institution:</span>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{researchedFunderData.name}</p>
                </div>
                <div>
                  <span className="text-neutral-500 font-medium">Pricing Guidance:</span>
                  <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                    {researchedFunderData.indicativePricingGuidance || "SOFR Benchmark"}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-500 font-medium">Ticket Range:</span>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {researchedFunderData.minTicketUsd ? `$${(researchedFunderData.minTicketUsd / 1e6).toFixed(1)}M` : "Any"} -{" "}
                    {researchedFunderData.maxTicketUsd ? `$${(researchedFunderData.maxTicketUsd / 1e6).toFixed(1)}M` : "Uncapped"}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-500 font-medium">Supported Legs:</span>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {(researchedFunderData.supportedLegs || []).join(", ") || "All Legs"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Full Extracted Funder Inspector Modal */}
      {isInspectorOpen && researchedFunderData && (
        <TradeFunderInspectorModal
          funder={researchedFunderData}
          onClose={() => setIsInspectorOpen(false)}
        />
      )}
    </Card>
  );
}
