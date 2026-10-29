"use client";

import { useState } from "react";
import { Card, CardContent, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { ExternalLink, Edit3, Globe, Building2, Search, CheckCircle2, Mail, MapPin } from "lucide-react";
import { EditVcInvestorModal } from "@/components/EditVcInvestorModal";

const ARCHETYPE_LABELS: Record<string, { label: string; tone: "green" | "blue" | "purple" | "amber" | "neutral" }> = {
  INSTITUTIONAL_VC: { label: "Institutional VC", tone: "green" },
  ANGEL_PLATFORM_SYNDICATE: { label: "Angel Platform & Syndicate", tone: "blue" },
  ANGEL_OPERATOR: { label: "Angel & Operator", tone: "purple" },
  VC_PLATFORM_SCOUT: { label: "Scout & Venture Platform", tone: "blue" },
  ACCELERATOR_INCUBATOR: { label: "Accelerator & Incubator", tone: "amber" },
};

interface VcInvestorDirectoryProps {
  investors: Array<{
    id: string;
    name: string;
    type: string;
    targetStages: string[];
    preferredSectors: string[];
    acceptedJurisdictions: string[];
    minCheckUsd: number | null;
    maxCheckUsd: number | null;
    sweetSpotCheckUsd: number | null;
    leadsRounds: boolean;
    takesBoardSeats: boolean;
    activelyFundingIndustry: boolean;
    applicationRoute: string;
    applicationUrl: string | null;
    websiteUrl?: string | null;
    contactEmail?: string | null;
    headquarters?: string | null;
    keyContactsJson?: any;
    confidence: string;
    gatingFactor: string | null;
    notes: string | null;
    portfolioCompanies: string[];
    documentsRequired: Array<{ code: string }>;
  }>;
}

export function VcInvestorDirectory({ investors }: VcInvestorDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvestorForEdit, setSelectedInvestorForEdit] = useState<any | null>(null);

  const filtered = investors.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.name.toLowerCase().includes(q) ||
      inv.type.toLowerCase().includes(q) ||
      inv.preferredSectors.some((s) => s.toLowerCase().includes(q)) ||
      inv.targetStages.some((s) => s.toLowerCase().includes(q)) ||
      inv.acceptedJurisdictions.some((j) => j.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by firm name, sector, stage, or accepted jurisdiction (e.g. Delaware, Singapore, Fintech)..."
          className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-4 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:border-emerald-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching investors found"
          description={`No providers matched '${searchQuery}'. Try adjusting your search query.`}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((inv) => {
            const archetype = ARCHETYPE_LABELS[inv.type] ?? { label: inv.type, tone: "neutral" };
            return (
              <Card key={inv.id} className="transition-all hover:border-emerald-300 dark:hover:border-emerald-800">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm sm:text-base">
                          {inv.name}
                        </h3>
                        <Badge tone={archetype.tone}>{archetype.label}</Badge>
                        {inv.leadsRounds && <Badge tone="green">Leads Rounds</Badge>}
                        {inv.takesBoardSeats && <Badge tone="neutral">Takes Board Seat</Badge>}
                        {inv.activelyFundingIndustry ? (
                          <Badge tone="green">Actively Deploying</Badge>
                        ) : (
                          <Badge tone="amber">Inactive / Stale</Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvestorForEdit(inv)}
                          className="h-6 text-[11px] px-2 gap-1 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300"
                          title="Edit investor parameters, valid jurisdictions & thesis"
                        >
                          <Edit3 className="h-3 w-3 text-emerald-600" />
                          Edit Parameters
                        </Button>
                      </div>
                      {inv.notes && (
                        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl">
                          {inv.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge tone={inv.confidence.includes("VERIFIED") ? "green" : "neutral"}>
                        {inv.confidence.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t border-neutral-100 pt-3 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <div>
                      <span className="font-medium text-neutral-500">Ticket Range:</span>
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {inv.minCheckUsd ? `$${(inv.minCheckUsd / 1000).toFixed(0)}k` : "$0"} -{" "}
                        {inv.maxCheckUsd ? `$${(inv.maxCheckUsd / 1000000).toFixed(1)}M` : "Open"}
                      </p>
                      {inv.sweetSpotCheckUsd && (
                        <span className="text-[11px] text-emerald-600">
                          Sweet spot: ${(inv.sweetSpotCheckUsd / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="font-medium text-neutral-500">Target Stages:</span>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">
                        {inv.targetStages.map((s) => s.replaceAll("_", " ")).join(", ") || "Any"}
                      </p>
                    </div>

                    <div>
                      <span className="font-medium text-neutral-500">Application Route:</span>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">
                        {inv.applicationRoute.replaceAll("_", " ")}
                      </p>
                      {inv.applicationUrl && (
                        <a
                          href={inv.applicationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline mt-0.5"
                        >
                          Application Link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <div>
                      <span className="font-medium text-neutral-500">Target Sectors:</span>
                      <p className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {inv.preferredSectors.map((s) => s.replaceAll("_", " ")).slice(0, 3).join(", ")}
                        {inv.preferredSectors.length > 3 ? ` +${inv.preferredSectors.length - 3}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Verified Contact & Headquarters */}
                  {(inv.headquarters || inv.contactEmail || inv.websiteUrl) && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                      {inv.headquarters && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                          <span className="font-medium">{inv.headquarters}</span>
                        </span>
                      )}
                      {inv.contactEmail && (
                        <a
                          href={`mailto:${inv.contactEmail}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline font-mono"
                        >
                          <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                          <span>{inv.contactEmail}</span>
                        </a>
                      )}
                      {inv.websiteUrl && (
                        <a
                          href={inv.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400 font-medium"
                        >
                          <Globe className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span>Official Portal</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Accepted Jurisdictions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 dark:border-neutral-800">
                    <span className="font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                      <Globe className="h-3 w-3 text-blue-500" />
                      Accepted Jurisdictions:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {inv.acceptedJurisdictions?.length ? (
                        inv.acceptedJurisdictions.map((j) => (
                          <span
                            key={j}
                            className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-mono"
                          >
                            {j}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-neutral-400 italic">Any / Unrestricted</span>
                      )}
                    </div>
                  </div>

                  {/* Portfolio Companies & Required Docs */}
                  {(inv.portfolioCompanies.length > 0 || inv.documentsRequired.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 dark:border-neutral-800">
                      {inv.portfolioCompanies.length > 0 && (
                        <div>
                          <span className="font-medium text-neutral-600 dark:text-neutral-300">
                            Key Portfolio:{" "}
                          </span>
                          <span>{inv.portfolioCompanies.join(", ")}</span>
                        </div>
                      )}
                      {inv.documentsRequired.length > 0 && (
                        <div>
                          <span className="font-medium text-neutral-600 dark:text-neutral-300">
                            Required Docs:{" "}
                          </span>
                          <span>{inv.documentsRequired.map((d) => d.code.replace("VC_", "")).join(", ")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Investor Modal */}
      {selectedInvestorForEdit && (
        <EditVcInvestorModal
          investor={selectedInvestorForEdit}
          onClose={() => setSelectedInvestorForEdit(null)}
        />
      )}
    </div>
  );
}
