"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, Badge, EmptyState, Button } from "@/components/ui/primitives";
import { FileCode, Globe, Mail, Phone, ExternalLink, Search } from "lucide-react";
import { ProviderInspectorModal } from "@/components/ProviderInspectorModal";

const CONFIDENCE_TONE = {
  VERIFIED_SITE: "green",
  VERIFIED_SECONDARY: "blue",
  UNVERIFIED_NEEDS_CHECK: "amber",
} as const;

export interface ProviderDirectoryClientProps {
  providers: any[];
}

export function ProviderDirectoryClient({ providers }: ProviderDirectoryClientProps) {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  useEffect(() => {
    const inspectId = searchParams.get("inspect");
    if (inspectId) {
      const found = providers.find((p) => p.id === inspectId);
      if (found) setSelectedProvider(found);
    }
  }, [searchParams, providers]);

  const filtered = providers.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.product.toLowerCase().includes(q) ||
      p.sellerJurisdictions.some((j: string) => j.toLowerCase().includes(q)) ||
      p.obligorJurisdictions.some((j: string) => j.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter invoice factoring providers by name, product, or jurisdiction..."
          className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-4 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No providers found"
          description={`No capital providers matched '${searchQuery}'.`}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="transition-all hover:border-indigo-300 dark:hover:border-indigo-800">
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-base text-neutral-900 dark:text-neutral-100">{p.name}</p>
                    <Badge tone="neutral">{p.type.replaceAll("_", " ")}</Badge>
                    <Badge tone={CONFIDENCE_TONE[p.confidence as keyof typeof CONFIDENCE_TONE] ?? "neutral"}>
                      {p.confidence.replaceAll("_", " ")}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProvider(p)}
                      className="h-6 text-[11px] px-2 gap-1 text-indigo-700 hover:text-indigo-900 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                    >
                      <FileCode className="h-3 w-3 text-indigo-600" />
                      Inspect Profile, Onboarding &amp; DSL
                    </Button>
                  </div>
                  {p.minTicketUsd != null && (
                    <span className="text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-400">
                      ${(p.minTicketUsd / 1_000).toFixed(0)}k – {p.maxTicketUsd ? `$${(p.maxTicketUsd / 1_000_000).toFixed(1)}M` : "Uncapped"}
                    </span>
                  )}
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-400">{p.product}</p>

                {p.gatingFactor && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Gating Factor:</strong> {p.gatingFactor}
                  </p>
                )}

                {/* Jurisdictions and Channels */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-blue-500" />
                    <span>Seller: <strong>{p.sellerJurisdictions.join(", ") || "Any"}</strong> · Obligor: <strong>{p.obligorJurisdictions.join(", ") || "Any"}</strong></span>
                  </div>

                  <div className="flex items-center gap-3">
                    {p.contact && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Mail className="h-3 w-3 text-purple-600" /> {p.contact}
                      </span>
                    )}
                    {p.applicationUrl && (
                      <a
                        href={p.applicationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                      >
                        Portal <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedProvider && (
        <ProviderInspectorModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
}
