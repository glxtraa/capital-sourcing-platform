"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { ExternalLink, Edit3, Globe, Building2, Search, CheckCircle2, Mail, Phone, MapPin, FileCode, Quote } from "lucide-react";
import { TradeFunderInspectorModal } from "@/components/TradeFunderInspectorModal";

interface TradeFunderDirectoryProps {
  funders: Array<{
    id: string;
    name: string;
    type: string;
    offersUmbrellaFacility: boolean;
    supportedLegs: string[];
    supportedCorridors: string[];
    supportedCommodities: string[];
    excludedCommodities: string[];
    acceptedSupplierJurisdictions: string[];
    acceptedTraderJurisdictions: string[];
    acceptedBuyerJurisdictions: string[];
    minTicketUsd: number | null;
    maxTicketUsd: number | null;
    indicativePricingGuidance: string | null;
    gatingFactor: string | null;
    confidence: string;
    contact?: string | null;
    applicationUrl?: string | null;
    rateEvidenceSnippet?: string | null;
    pricingProvenance?: any;
    deskContacts?: any;
    sources: string[];
    documentsRequired: Array<{ code: string; note?: string | null }>;
  }>;
}

export function TradeFunderDirectory({ funders }: TradeFunderDirectoryProps) {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFunderForInspect, setSelectedFunderForInspect] = useState<any | null>(null);

  useEffect(() => {
    const inspectId = searchParams.get("inspect");
    if (inspectId) {
      const found = funders.find((f) => f.id === inspectId);
      if (found) setSelectedFunderForInspect(found);
    }
  }, [searchParams, funders]);

  const filtered = funders.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q) ||
      f.supportedCorridors.some((c) => c.toLowerCase().includes(q)) ||
      f.supportedCommodities.some((comm) => comm.toLowerCase().includes(q)) ||
      f.acceptedSupplierJurisdictions.some((j) => j.toLowerCase().includes(q)) ||
      f.acceptedTraderJurisdictions.some((j) => j.toLowerCase().includes(q)) ||
      f.acceptedBuyerJurisdictions.some((j) => j.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter trade desks by institution name, corridor (e.g. ID_TO_CN_COAL), commodity, or accepted jurisdiction (e.g. Singapore, Indonesia)..."
          className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-4 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:border-purple-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching trade funders found"
          description={`No funders matched '${searchQuery}'. Try adjusting your search query.`}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((f) => (
            <Card key={f.id} className="transition-all hover:border-purple-300 dark:hover:border-purple-800">
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm sm:text-base">
                        {f.name}
                      </h3>
                      {f.offersUmbrellaFacility && (
                        <Badge tone="purple">Umbrella Facility Available</Badge>
                      )}
                      <Badge tone="blue">{f.type.replaceAll("_", " ")}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFunderForInspect(f)}
                        className="h-6 text-[11px] px-2 gap-1 text-purple-700 hover:text-purple-900 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40"
                        title="Inspect full extracted fields, rate evidence, accepted jurisdictions, and runtime Zod DSL"
                      >
                        <FileCode className="h-3 w-3 text-purple-600" />
                        Inspect / Edit Extracted Profile &amp; DSL
                      </Button>
                    </div>

                    {f.indicativePricingGuidance && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                          Pricing: {f.indicativePricingGuidance}
                        </p>
                        {f.indicativePricingGuidance.toLowerCase().includes("bilateral") ? (
                          <Badge tone="purple" className="text-[10px] px-1.5 py-0">Bilateral Underwriting</Badge>
                        ) : (
                          <Badge tone="green" className="text-[10px] px-1.5 py-0">Published Rate</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <Badge tone={f.confidence === "VERIFIED_DESK" || f.confidence === "VERIFIED_SITE" ? "green" : "neutral"}>
                      {f.confidence.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <div>
                    <span className="font-medium text-neutral-500">Supported Legs:</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {f.supportedLegs.join(", ") || "All Legs"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">Corridors:</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {f.supportedCorridors.join(", ") || "Global"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">Commodities:</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {f.supportedCommodities.join(", ") || "Diversified / Bulk"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">Ticket Range:</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {f.minTicketUsd ? `$${(f.minTicketUsd / 1_000_000).toFixed(1)}M` : "Any"} -{" "}
                      {f.maxTicketUsd ? `$${(f.maxTicketUsd / 1_000_000).toFixed(1)}M` : "Uncapped"}
                    </p>
                  </div>
                </div>

                {/* Accepted Jurisdictions Tripartite Breakdown */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 dark:border-neutral-800">
                  <span className="font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                    <Globe className="h-3 w-3 text-blue-500" />
                    Accepted Jurisdictions:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-neutral-400">Supplier:</span>
                    {(f.acceptedSupplierJurisdictions?.length ? f.acceptedSupplierJurisdictions : ["Global"]).slice(0, 3).map((j) => (
                      <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1 py-0.2 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                        {j}
                      </span>
                    ))}
                    <span className="text-[10px] text-neutral-400 ml-1">Trader:</span>
                    {(f.acceptedTraderJurisdictions?.length ? f.acceptedTraderJurisdictions : ["Singapore", "HK"]).slice(0, 2).map((j) => (
                      <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1 py-0.2 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                        {j}
                      </span>
                    ))}
                    <span className="text-[10px] text-neutral-400 ml-1">Buyer:</span>
                    {(f.acceptedBuyerJurisdictions?.length ? f.acceptedBuyerJurisdictions : ["China", "Global"]).slice(0, 2).map((j) => (
                      <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1 py-0.2 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                        {j}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rate Evidence Quote */}
                {f.rateEvidenceSnippet && (
                  <div className="rounded-lg bg-emerald-50/60 p-2.5 text-xs text-neutral-800 dark:bg-emerald-950/20 dark:text-neutral-200 border border-emerald-200/50 flex items-start gap-2">
                    <Quote className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="italic font-mono text-[11px] leading-relaxed">
                      &ldquo;{f.rateEvidenceSnippet}&rdquo;
                    </p>
                  </div>
                )}

                {/* Direct Desk Contacts & Portal */}
                {((f.deskContacts?.contactEmail || f.contact) || (f.deskContacts?.applicationPortalUrl || f.applicationUrl) || f.deskContacts?.phone) && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-[11px] dark:border-neutral-800">
                    <span className="font-semibold text-neutral-600 dark:text-neutral-400">Desk Contacts:</span>
                    {(f.deskContacts?.contactEmail || (f.contact?.includes("@") ? f.contact : null)) && (
                      <a
                        href={`mailto:${f.deskContacts?.contactEmail || f.contact}`}
                        className="inline-flex items-center gap-1 font-mono text-purple-700 dark:text-purple-300 hover:underline"
                      >
                        <Mail className="h-3 w-3 text-purple-600" />
                        <span>{f.deskContacts?.contactEmail || f.contact}</span>
                      </a>
                    )}
                    {f.deskContacts?.phone && (
                      <span className="inline-flex items-center gap-1 font-mono text-neutral-600 dark:text-neutral-400">
                        <Phone className="h-3 w-3 text-neutral-500" />
                        <span>{f.deskContacts.phone}</span>
                      </span>
                    )}
                    {(f.deskContacts?.applicationPortalUrl || f.applicationUrl) && (
                      <a
                        href={f.deskContacts?.applicationPortalUrl || f.applicationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                      >
                        Intake Portal <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* Required Documents */}
                {f.documentsRequired.length > 0 && (
                  <div className="text-[11px] text-neutral-500 pt-1">
                    <span className="font-semibold text-neutral-600 dark:text-neutral-400">Required Documents: </span>
                    <span className="font-mono text-purple-700 dark:text-purple-300">
                      {f.documentsRequired.map((d) => d.code).join(", ")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Extracted Funder Inspector Modal */}
      {selectedFunderForInspect && (
        <TradeFunderInspectorModal
          funder={selectedFunderForInspect}
          onClose={() => setSelectedFunderForInspect(null)}
        />
      )}
    </div>
  );
}
