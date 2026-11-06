"use client";

import { useState } from "react";
import { X, Building2, Globe, ShieldCheck, Mail, Phone, ExternalLink, FileText, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { resolveZodDslDefinition } from "@/dsl/zod-registry";

export interface ProviderInspectorModalProps {
  provider: {
    id: string;
    name: string;
    type: string;
    product: string;
    recourse?: string | null;
    sellerJurisdictions: string[];
    obligorJurisdictions: string[];
    currencies: string[];
    minTicketUsd?: number | null;
    maxTicketUsd?: number | null;
    gatingFactor?: string | null;
    feeNotes?: string | null;
    applicationProcess?: string | null;
    applicationUrl?: string | null;
    contact?: string | null;
    confidence: string;
    sources: string[];
    documentsRequired?: Array<{ code: string; note?: string | null }>;
    onboardings?: Array<any>;
  };
  onClose: () => void;
}

export function ProviderInspectorModal({ provider, onClose }: ProviderInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "onboarding" | "zod">("profile");
  const [isReResearching, setIsReResearching] = useState(false);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);

  async function handleReResearchSingle() {
    setIsReResearching(true);
    setResearchNotice(null);
    try {
      const res = await fetch("/api/providers/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerIds: [provider.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to re-run research");
      setResearchNotice("Provider research refreshed successfully! Page cache and live verification updated.");
    } catch (err: any) {
      setResearchNotice("Error: " + (err?.message || "Failed to re-run research"));
    } finally {
      setIsReResearching(false);
    }
  }

  const latestOnboarding = provider.onboardings?.[0];
  const contacts = (latestOnboarding?.contacts as Array<{ channel: string; value: string; purpose: string; sourceUrl: string }>) || [];
  const formFields = (latestOnboarding?.formFields as Array<{ label: string; required?: boolean; step?: string }>) || [];
  const steps = (latestOnboarding?.steps as string[]) || [];

  const zodDefinition = resolveZodDslDefinition({ dslType: "INVOICE_DEAL_SPEC", assetClass: "INVOICE" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate">
                  {provider.name}
                </h3>
                <Badge tone="blue">{provider.type.replaceAll("_", " ")}</Badge>
                <Badge tone={provider.confidence === "VERIFIED_SITE" ? "green" : "neutral"}>
                  {provider.confidence.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 font-mono truncate">
                ID: {provider.id} · Product: {provider.product}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReResearchSingle}
              disabled={isReResearching}
              className="text-xs gap-1.5 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100/50"
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

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 px-6 text-xs font-semibold bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === "profile"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            1. Underwriting Mandate &amp; Jurisdictions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("onboarding")}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === "onboarding"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            2. Contact Channels &amp; Application Onboarding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("zod")}
            className={`border-b-2 py-3 px-3 transition-colors ${
              activeTab === "zod"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            3. Underlying Zod DSL Schema
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Ticket Size Range</span>
                  <p className="mt-1 font-semibold text-neutral-800 dark:text-neutral-200">
                    {provider.minTicketUsd ? `$${(provider.minTicketUsd / 1_000).toFixed(0)}k` : "Any"} -{" "}
                    {provider.maxTicketUsd ? `$${(provider.maxTicketUsd / 1_000_000).toFixed(1)}M` : "Uncapped"}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Recourse</span>
                  <p className="mt-1 font-semibold text-neutral-800 dark:text-neutral-200">
                    {provider.recourse ? provider.recourse.replaceAll("_", " ") : "Bilateral"}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Currencies</span>
                  <p className="mt-1 font-semibold text-neutral-800 dark:text-neutral-200">
                    {provider.currencies.join(", ") || "USD, EUR, GBP"}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                  <span className="font-semibold text-neutral-500 uppercase text-[10px]">Pricing &amp; Fees</span>
                  <p className="mt-1 font-semibold text-neutral-800 dark:text-neutral-200">
                    {provider.feeNotes || "Market factoring discount"}
                  </p>
                </div>
              </div>

              {/* Jurisdictions */}
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-3">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-500" />
                  Eligible Domiciles &amp; Jurisdictions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-neutral-500 font-semibold uppercase text-[10px]">Seller / Borrower Jurisdictions</span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {provider.sellerJurisdictions.map((j) => (
                        <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold uppercase text-[10px]">Obligor / Debtor Jurisdictions</span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {provider.obligorJurisdictions.map((j) => (
                        <span key={j} className="rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Required Documents */}
              {provider.documentsRequired && provider.documentsRequired.length > 0 && (
                <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Standard Required Documents</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.documentsRequired.map((d) => (
                      <span key={d.code} className="rounded-md border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30 px-2 py-1 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                        {d.code} {d.note ? `(${d.note})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "onboarding" && (
            <div className="space-y-4">
              {/* Primary Contact Channels */}
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-3">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Verified Contact &amp; Intake Channels</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {provider.contact && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
                      <Mail className="h-4 w-4 text-purple-600 shrink-0" />
                      <span className="font-mono text-neutral-800 dark:text-neutral-200">{provider.contact}</span>
                    </div>
                  )}
                  {provider.applicationUrl && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
                      <ExternalLink className="h-4 w-4 text-blue-600 shrink-0" />
                      <a href={provider.applicationUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                        {provider.applicationUrl}
                      </a>
                    </div>
                  )}
                  {contacts.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
                      {c.channel === "PHONE" ? <Phone className="h-4 w-4 text-emerald-600 shrink-0" /> : <Mail className="h-4 w-4 text-purple-600 shrink-0" />}
                      <span className="font-mono text-neutral-800 dark:text-neutral-200">{c.value} ({c.purpose})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Onboarding Steps & Form Fields */}
              {formFields.length > 0 && (
                <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-3">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Researched Application Form Fields ({formFields.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {formFields.map((f, i) => (
                      <span key={i} className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-[11px] text-neutral-700 dark:text-neutral-300">
                        {f.label} {f.required ? "*" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {provider.sources && provider.sources.length > 0 && (
                <div className="text-[11px] text-neutral-500">
                  <span className="font-semibold">Sources: </span>
                  {provider.sources.map((s, i) => (
                    <a key={i} href={s} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline mr-2 inline-flex items-center gap-0.5">
                      {s.replace(/^https?:\/\//, "").slice(0, 30)}… <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "zod" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Runtime Zod TypeScript DSL</h4>
                  <p className="text-xs text-neutral-500">{zodDefinition.title} — {zodDefinition.summary}</p>
                </div>
                <Badge tone="purple">Read-Only DSL Schema</Badge>
              </div>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-xs">
                <CodeMirror
                  value={zodDefinition.code}
                  height="360px"
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
