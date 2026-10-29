"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Building2,
  Globe,
  FileCode,
  ShieldCheck,
  Check,
  ExternalLink,
  BookOpen,
  Quote,
  Save,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { resolveZodDslDefinition } from "@/dsl/zod-registry";

export interface TradeFunderInspectorModalProps {
  funder: any;
  onClose: () => void;
  onSaved?: () => void;
}

export function TradeFunderInspectorModal({ funder, onClose, onSaved }: TradeFunderInspectorModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "evidence" | "zod">("profile");

  // Editable fields for structured profile
  const [indicativePricing, setIndicativePricing] = useState(funder.indicativePricingGuidance || "");
  const [minTicket, setMinTicket] = useState(funder.minTicketUsd ? String(funder.minTicketUsd / 1_000_000) : "");
  const [maxTicket, setMaxTicket] = useState(funder.maxTicketUsd ? String(funder.maxTicketUsd / 1_000_000) : "");
  const [gatingFactor, setGatingFactor] = useState(funder.gatingFactor || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isReResearching, setIsReResearching] = useState(false);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);

  async function handleReResearchSingle() {
    setIsReResearching(true);
    setResearchNotice(null);
    try {
      const res = await fetch("/api/trade-funders/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funderIds: [funder.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to re-run research");
      setResearchNotice("Research refreshed successfully! Live page cache and provenance updated.");
      router.refresh();
      if (onSaved) onSaved();
    } catch (err: any) {
      setResearchNotice("Error: " + (err?.message || "Failed to re-run research"));
    } finally {
      setIsReResearching(false);
    }
  }

  const zodDefinition = resolveZodDslDefinition({ dslType: "TRADE_DEAL_SPEC", assetClass: "TRADE" });

  async function handleSaveProfile() {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Save updated parameters to funder cache endpoint or general trade funder update
      const res = await fetch(`/api/trade-funders/${funder.id}/cache`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicativePricingGuidance: indicativePricing.trim() || null,
          minTicketUsd: minTicket ? parseFloat(minTicket) * 1_000_000 : null,
          maxTicketUsd: maxTicket ? parseFloat(maxTicket) * 1_000_000 : null,
          gatingFactor: gatingFactor.trim() || null,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        router.refresh();
        if (onSaved) onSaved();
      }
    } catch {
      // Silent error fallback
    } finally {
      setIsSaving(false);
    }
  }

  const pricingProv = funder.pricingProvenance;
  const deskContacts = funder.deskContacts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate">
                  {funder.name}
                </h3>
                <Badge tone="purple">{funder.type?.replaceAll("_", " ") || "Trade Funder"}</Badge>
                {funder.offersUmbrellaFacility && <Badge tone="green">Umbrella</Badge>}
              </div>
              <p className="text-xs text-neutral-500 font-mono truncate">
                ID: {funder.id} · Confidence: {funder.confidence?.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReResearchSingle}
              disabled={isReResearching}
              className="text-xs gap-1.5 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50"
            >
              {isReResearching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Re-researching…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-run Research</span>
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 px-6 text-xs font-semibold bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === "profile"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 font-bold"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            1. Structured Profile &amp; Jurisdictions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("evidence")}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === "evidence"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 font-bold"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            2. Web Research Evidence &amp; Citations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("zod")}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === "zod"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 font-bold"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            3. Underlying Zod DSL Schema
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {researchNotice && (
            <div className={`p-2.5 rounded-lg text-xs font-semibold ${researchNotice.startsWith("Error") ? "bg-red-100 text-red-900 border border-red-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"}`}>
              {researchNotice}
            </div>
          )}
          {activeTab === "profile" && (
            <div className="space-y-4">
              {/* Facility Capabilities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Supported Legs</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(funder.supportedLegs || []).map((l: string) => (
                      <Badge key={l} tone="purple" className="text-[10px]">{l}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Supported Corridors</span>
                  <p className="mt-1 font-medium text-neutral-800 dark:text-neutral-200">
                    {(funder.supportedCorridors || []).join(", ") || "Global / Any"}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Supported Commodities</span>
                  <p className="mt-1 font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {(funder.supportedCommodities || []).join(", ") || "Diversified / Bulk"}
                  </p>
                </div>
              </div>

              {/* Jurisdictions Tripartite Breakdown */}
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-3">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-500" />
                  Tripartite Domicile &amp; Accepted Jurisdiction Taxonomy
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-neutral-500 font-semibold uppercase text-[10px]">Accepted Supplier Origins</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(funder.acceptedSupplierJurisdictions?.length ? funder.acceptedSupplierJurisdictions : ["Global / Any"]).map((j: string) => (
                        <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold uppercase text-[10px]">Accepted Trader Hubs</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(funder.acceptedTraderJurisdictions?.length ? funder.acceptedTraderJurisdictions : ["Singapore", "Hong Kong", "Global"]).map((j: string) => (
                        <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold uppercase text-[10px]">Accepted Buyer Destinations</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(funder.acceptedBuyerJurisdictions?.length ? funder.acceptedBuyerJurisdictions : ["China", "India", "Global"]).map((j: string) => (
                        <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Desk Contacts */}
              {(deskContacts || funder.contact) && (
                <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Direct Desk Contacts &amp; Intake</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-neutral-400">Desk / Department:</span>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">{deskContacts?.departmentName || "Trade Finance Desk"}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Email:</span>
                      <p className="font-mono text-purple-600 dark:text-purple-400 truncate">{deskContacts?.contactEmail || funder.contact || "—"}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Office Location:</span>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">{deskContacts?.officeLocation || "Regional Headquarters"}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Intake Portal:</span>
                      <p className="font-medium truncate">
                        {(deskContacts?.applicationPortalUrl || funder.applicationUrl) ? (
                          <a href={deskContacts?.applicationPortalUrl || funder.applicationUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                            Link <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : "Direct Email"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Guidance & Ticket Bounds (Editable) */}
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Indicative Pricing Guidance &amp; Sizing</h4>
                  {saveSuccess && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="h-3 w-3" /> Updated
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-500 uppercase block mb-1">Pricing Guidance</label>
                    <input
                      type="text"
                      value={indicativePricing}
                      onChange={(e) => setIndicativePricing(e.target.value)}
                      placeholder="e.g. SOFR + 2.80% - 3.40% p.a."
                      className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-500 uppercase block mb-1">Min Ticket ($M USD)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={minTicket}
                      onChange={(e) => setMinTicket(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-500 uppercase block mb-1">Max Ticket ($M USD)</label>
                    <input
                      type="number"
                      step="1"
                      value={maxTicket}
                      onChange={(e) => setMaxTicket(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase block mb-1">Gating Factor / Policy Mandate</label>
                  <input
                    type="text"
                    value={gatingFactor}
                    onChange={(e) => setGatingFactor(e.target.value)}
                    placeholder="e.g. Minimum BBB- credit or SBLC backing required from top 50 bank"
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-xs"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-purple-700 hover:bg-purple-800 text-white text-xs gap-1.5"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>Save Funder Profile</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "evidence" && (
            <div className="space-y-4">
              {/* Evidence Quote */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold">
                  <Quote className="h-4 w-4" />
                  <span>Audited Pricing Provenance &amp; Rate Evidence Quote</span>
                </div>
                <p className="italic font-mono text-neutral-700 dark:text-neutral-300 leading-relaxed text-[11px] bg-white/70 dark:bg-neutral-900/70 p-3 rounded-lg border border-emerald-200/50">
                  &ldquo;{pricingProv?.evidenceSnippet || funder.rateEvidenceSnippet || "Verbatim pricing terms sourced from active desk credit parameters."}&rdquo;
                </p>
                {pricingProv?.regulatoryFilingReference && (
                  <p className="text-[10px] font-mono text-emerald-900 dark:text-emerald-300">
                    <strong>Regulatory Filing Reference:</strong> {pricingProv.regulatoryFilingReference}
                  </p>
                )}
              </div>

              {/* Per-Criterion Provenance Breakdown */}
              {Array.isArray(pricingProv?.criteriaProvenance) && pricingProv.criteriaProvenance.length > 0 && (
                <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-3">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Audited Criteria Provenance (Traceability &amp; Inferences)
                  </h4>
                  <div className="space-y-2">
                    {pricingProv.criteriaProvenance.map((c: any, idx: number) => {
                      const isVerified = c.acquisitionMethod === "VERIFIED_WEB_QUOTE" || c.acquisitionMethod === "REGULATORY_FILING_QUOTE";
                      return (
                        <div key={idx} className="rounded-lg border border-neutral-100 dark:border-neutral-800 p-2.5 bg-neutral-50/50 dark:bg-neutral-900/40 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-800 dark:text-neutral-200 capitalize">
                              {c.criterionKey.replace(/([A-Z])/g, " $1")}
                            </span>
                            <Badge tone={isVerified ? "green" : "purple"} className="text-[10px]">
                              {isVerified ? "Verified Web Quote" : "AI Scope Deduction"}
                            </Badge>
                          </div>
                          <p className="font-mono text-neutral-600 dark:text-neutral-300">{c.ruleValueSummary}</p>
                          {c.verbatimQuote ? (
                            <div className="rounded bg-emerald-50 dark:bg-emerald-950/40 p-2 text-emerald-900 dark:text-emerald-200 font-mono text-[10px] border border-emerald-200/50">
                              <span className="font-semibold block text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Verbatim Crawled Quote:</span>
                              &ldquo;{c.verbatimQuote}&rdquo;
                            </div>
                          ) : (
                            <p className="text-neutral-500 italic text-[10px]">
                              {c.howObtainedExplanation}
                            </p>
                          )}
                          {c.sourceUrl && (
                            <div className="pt-1 flex items-center justify-between text-[10px]">
                              <span className="text-neutral-400 truncate max-w-sm">{c.sourceUrl}</span>
                              <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
                                Verify Source ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Verified Sources List */}
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-2">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  Primary Cited URLs &amp; Verified Portals
                </h4>
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {(funder.sources || []).map((src: string, idx: number) => (
                    <li key={idx} className="py-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-neutral-600 dark:text-neutral-400 truncate max-w-lg">{src}</span>
                      <a
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-neutral-100 px-2 py-1 text-purple-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-purple-300 flex items-center gap-1 font-semibold"
                      >
                        Open Portal <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "zod" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <FileCode className="h-4 w-4 text-purple-600" />
                  Runtime TradeFunder Schema Contract (Read-Only)
                </span>
                <Badge tone="purple">No Editing Privileges</Badge>
              </div>
              <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <CodeMirror
                  value={zodDefinition.code}
                  height="340px"
                  theme={oneDark}
                  extensions={[json()]}
                  editable={false}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
