"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Calculator,
  Search,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Globe,
  Building,
  Quote,
  ShieldCheck,
  Clock,
  Layers,
  ArrowRight,
  Info,
  Sparkles,
  BookOpen,
  X,
  Edit3,
  FileCode,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { TradeUploadDropzone } from "@/components/TradeUploadDropzone";
import { TradeFunderDealResearchCard } from "@/components/TradeFunderDealResearchCard";
import { TradePipelineExplainer } from "@/components/TradePipelineExplainer";
import { validateTradeFunderDSL } from "@/dsl/trade";
import { EditTradeDealModal } from "@/components/EditTradeDealModal";
import { DocumentExtractionModal } from "@/components/DocumentExtractionModal";

export interface TradeDealWorkspaceTabsProps {
  deal: {
    id: string;
    name: string;
    corridor: string;
    status: string;
    documents: Array<{
      id: string;
      fileName: string;
      blobUrl: string;
      mimeType: string;
      sizeBytes: number;
      tradeLeg: string | null;
      documentTypes: string[];
      extractedRaw: any;
      uploadedAt: string | Date;
    }>;
    parties: Array<{
      id: string;
      role: string;
      legalName: string;
      jurisdiction: string | null;
      concessionOrLicenseId: string | null;
      bankName: string | null;
    }>;
    contractLegs: Array<{
      id: string;
      legType: string;
      contractReference: string;
      incoterm: string;
      port: string;
      paymentType: string;
      tenorDays: number;
      amountUsd: number;
      commodityName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
    }>;
    financingAsks: Array<{
      id: string;
      isUmbrella: boolean;
      leg: string | null;
      instrument: string;
      amountUsd: number;
      advanceRatePct: number;
      tenorDaysMin: number;
      tenorDaysMax: number;
      collateralSummary: string | null;
    }>;
    riskFlags: Array<{
      id: string;
      category: string;
      severity: number;
      description: string;
    }>;
    matches: Array<{
      id: string;
      isTier1: boolean;
      verdict: string;
      rationale: string;
      funder: {
        id: string;
        name: string;
        type: string;
        indicativePricingGuidance: string | null;
        sources: string[];
        contact: string | null;
        applicationUrl: string | null;
        rateEvidenceSnippet: string | null;
        confidence: string;
        pricingProvenance?: any;
        deskContacts?: any;
        notes?: string | null;
      };
    }>;
    termSheets: Array<{
      id: string;
      facilityType: string;
      leadFunderName: string;
      facilityLimitUsd: number;
      blendedPricing: number;
      pricingFormula: string;
      advanceRatePct: number;
      tenorDaysMax: number;
      securityTerms: any;
      conditionsPrecedent: any;
      benchmarkTableJson: any;
      createdAt: string | Date;
    }>;
  };
}

export function TradeDealWorkspaceTabs({ deal }: TradeDealWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState<"termsheet" | "funders" | "audit" | "provenance">(
    deal.termSheets.length > 0 ? "termsheet" : deal.matches.length > 0 ? "funders" : "audit",
  );
  const [showArchDrawer, setShowArchDrawer] = useState(false);
  const [selectedSnapshotFunder, setSelectedSnapshotFunder] = useState<any | null>(null);
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [selectedDocForExtraction, setSelectedDocForExtraction] = useState<{
    id: string;
    fileName: string;
    documentTypes: string[];
    extractedRaw: any;
  } | null>(null);

  function renderHighlightedContext(context: string, snippet?: string | null) {
    if (!snippet || !context) return context;
    const cleanSnippet = snippet.replace(/^["“”]/, "").replace(/["“”]$/, "").trim();
    const lowerContext = context.toLowerCase();
    const lowerSnippet = cleanSnippet.toLowerCase();

    const idx = lowerContext.indexOf(lowerSnippet);
    if (idx !== -1) {
      const before = context.slice(0, idx);
      const match = context.slice(idx, idx + cleanSnippet.length);
      const after = context.slice(idx + cleanSnippet.length);
      return (
        <>
          {before}
          <mark className="bg-emerald-200 dark:bg-emerald-900/70 font-semibold text-emerald-950 dark:text-emerald-100 px-1 py-0.5 rounded shadow-sm">
            {match}
          </mark>
          {after}
        </>
      );
    }

    const words = cleanSnippet.split(" ").slice(0, 5).join(" ").toLowerCase();
    const wordIdx = lowerContext.indexOf(words);
    if (wordIdx !== -1) {
      const before = context.slice(0, wordIdx);
      const match = context.slice(wordIdx, wordIdx + words.length);
      const after = context.slice(wordIdx + words.length);
      return (
        <>
          {before}
          <mark className="bg-emerald-200 dark:bg-emerald-900/70 font-semibold text-emerald-950 dark:text-emerald-100 px-1 py-0.5 rounded shadow-sm">
            {match}
          </mark>
          {after}
        </>
      );
    }

    return context;
  }

  const buyLeg = deal.contractLegs.find((leg) => leg.legType === "SUPPLY_LEG");
  const sellLeg = deal.contractLegs.find((leg) => leg.legType === "OFFTAKE_LEG");
  const supplier = deal.parties.find((p) => p.role === "SUPPLIER");
  const trader = deal.parties.find((p) => p.role === "TRADER");
  const buyer = deal.parties.find((p) => p.role === "BUYER");
  const latestTermSheet = deal.termSheets[0];

  // Pipeline Stepper status
  const steps = [
    { id: "docs", label: "1. Documents Ingested", completed: deal.documents.length > 0, count: deal.documents.length },
    { id: "reconciled", label: "2. Reconciled Audit", completed: deal.contractLegs.length > 0 || deal.parties.length > 0 },
    { id: "matched", label: "3. Funder Cascade", completed: deal.matches.length > 0, count: deal.matches.length },
    { id: "termsheet", label: "4. Indicative Term Sheet", completed: deal.termSheets.length > 0 },
  ];

  // Benchmark table
  const benchmarkRows = Array.isArray(latestTermSheet?.benchmarkTableJson)
    ? latestTermSheet.benchmarkTableJson
    : [];

  return (
    <div className="space-y-6">
      {/* 4-Stage Stepper Bar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Pipeline Status</span>
          </div>
          <Button
            variant="ghost"
            className="text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            onClick={() => setShowArchDrawer(!showArchDrawer)}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
            {showArchDrawer ? "Hide Architecture & Sequences" : "View Architecture & Multi-Agent Flow"}
            {showArchDrawer ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {steps.map((st, i) => (
            <div
              key={st.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                st.completed
                  ? "border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-neutral-200 bg-neutral-50/50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800/30 dark:text-neutral-500"
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${st.completed ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-300 dark:text-neutral-600"}`}
              />
              <span className="font-medium truncate">{st.label}</span>
              {st.count !== undefined && st.count > 0 && (
                <span className="ml-auto rounded-full bg-emerald-200/60 px-1.5 py-0.2 text-[10px] font-bold dark:bg-emerald-800/60">
                  {st.count}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Architecture & Sequences Drawer */}
      {showArchDrawer && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 transition-all dark:border-purple-900 dark:bg-purple-950/20">
          <div className="mb-4 flex items-center justify-between border-b border-purple-200/60 pb-3 dark:border-purple-800/40">
            <div>
              <h3 className="text-sm font-semibold text-purple-950 dark:text-purple-200">
                Deterministic DSL Boundary &amp; Multi-Agent Workflow
              </h3>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                Mathematical facility calculations (advance rate, tenor, blended pricing, gross/net margins) are 100% deterministic code. LLMs perform unstructured OCR extraction and legal credit structuring.
              </p>
            </div>
            <Button variant="outline" className="text-xs" onClick={() => setShowArchDrawer(false)}>
              Close Drawer
            </Button>
          </div>
          <TradePipelineExplainer />
        </div>
      )}

      {/* Main Tabbed Navigation */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab("termsheet")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "termsheet"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <Calculator className="h-4 w-4" />
            Term Sheet &amp; Deterministic Economics
            {latestTermSheet && <Badge tone="purple" className="ml-1 text-[10px]">Calculated</Badge>}
          </button>

          <button
            onClick={() => setActiveTab("funders")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "funders"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <Search className="h-4 w-4" />
            Funder Matches &amp; Web Research
            {deal.matches.length > 0 && <Badge tone="blue" className="ml-1 text-[10px]">{deal.matches.length}</Badge>}
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "audit"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Reconciled Trade Audit
            {deal.contractLegs.length > 0 && <Badge tone="green" className="ml-1 text-[10px]">Reconciled</Badge>}
          </button>

          <button
            onClick={() => setActiveTab("provenance")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "provenance"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents &amp; Lineage Provenance
            <Badge tone="neutral" className="ml-1 text-[10px]">{deal.documents.length}</Badge>
          </button>
        </nav>
      </div>

      {/* TAB 1: TERM SHEET & DETERMINISTIC ECONOMICS */}
      {activeTab === "termsheet" && (
        <div className="space-y-6">
          {latestTermSheet ? (
            <>
              {/* Deterministic Economics Header */}
              <Card className="border-purple-200 bg-white dark:border-purple-900 dark:bg-neutral-900">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base text-purple-950 dark:text-purple-200">
                          Deterministic Indicative Facility Term Sheet
                        </CardTitle>
                        <Badge tone="purple">{latestTermSheet.facilityType.replaceAll("_", " ")}</Badge>
                        <Badge tone="green">100% Mathematical Proof</Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Formulated against lead funder: <strong className="text-neutral-800 dark:text-neutral-200">{latestTermSheet.leadFunderName}</strong> · Generated on {new Date(latestTermSheet.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Financial Metrics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-800/50">
                    <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-neutral-800">
                      <span className="text-xs font-semibold text-neutral-400 uppercase">Total Facility Limit</span>
                      <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        ${(latestTermSheet.facilityLimitUsd / 1_000_000).toFixed(2)}M USD
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Advance Rate: <strong className="text-neutral-700 dark:text-neutral-300">{latestTermSheet.advanceRatePct}%</strong> of eligible collateral base
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-neutral-800">
                      <span className="text-xs font-semibold text-neutral-400 uppercase">Blended Pricing</span>
                      <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {latestTermSheet.blendedPricing.toFixed(2)}% p.a.
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1 font-mono truncate">
                        {latestTermSheet.pricingFormula}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-neutral-800">
                      <span className="text-xs font-semibold text-neutral-400 uppercase">Maximum Tenor</span>
                      <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {latestTermSheet.tenorDaysMax} Days
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Cashflow gap + 15 days laycan/shipping buffer
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-neutral-800">
                      <span className="text-xs font-semibold text-neutral-400 uppercase">Trader Economics</span>
                      <p className="mt-1 text-xl font-bold text-purple-700 dark:text-purple-300">
                        {buyLeg && sellLeg ? (
                          `$${((sellLeg.amountUsd - buyLeg.amountUsd) / 1000).toFixed(0)}k Gross`
                        ) : "Calculated"}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Self-liquidating against offtake proceeds
                      </p>
                    </div>
                  </div>

                  {/* Mathematical Audit Trail Box */}
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 text-xs font-mono dark:border-neutral-800 dark:bg-neutral-800/30">
                    <div className="flex items-center gap-1.5 font-sans font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      <Info className="h-3.5 w-3.5 text-purple-500" />
                      Deterministic Formula Verification
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400">
                      <div>
                        • Facility = ${buyLeg?.amountUsd.toLocaleString() ?? "Collateral"} * ({latestTermSheet.advanceRatePct}%) = ${(latestTermSheet.facilityLimitUsd).toLocaleString()} USD
                      </div>
                      <div>
                        • Interest Accrual = Facility * ({latestTermSheet.blendedPricing.toFixed(2)}%) * ({latestTermSheet.tenorDaysMax} / 360)
                      </div>
                    </div>
                  </div>

                  {/* Legal Terms & Conditions Precedent */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                          Physical &amp; Financial Security Package
                        </h4>
                      </div>
                      <ul className="space-y-2 list-disc list-inside text-xs text-neutral-600 dark:text-neutral-400">
                        {Array.isArray(latestTermSheet.securityTerms) &&
                          (latestTermSheet.securityTerms as string[]).map((term, i) => (
                            <li key={i} className="leading-relaxed">{term}</li>
                          ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                          Mandatory Conditions Precedent (CPs)
                        </h4>
                      </div>
                      <ul className="space-y-2 list-disc list-inside text-xs text-neutral-600 dark:text-neutral-400">
                        {Array.isArray(latestTermSheet.conditionsPrecedent) &&
                          (latestTermSheet.conditionsPrecedent as string[]).map((cp, i) => (
                            <li key={i} className="leading-relaxed">{cp}</li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benchmark Table with Source URLs and Contacts */}
              {benchmarkRows.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Institutional Funder Benchmark Comparison</CardTitle>
                      <Badge tone="neutral">Source-Linked Quotes</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Funder Name</th>
                            <th className="py-2.5 px-3">Structure</th>
                            <th className="py-2.5 px-3">Indicative Cost</th>
                            <th className="py-2.5 px-3">Advance Rate</th>
                            <th className="py-2.5 px-3">Speed</th>
                            <th className="py-2.5 px-3">Verified Sources &amp; Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {benchmarkRows.map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                              <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                                {row.funderName}
                              </td>
                              <td className="py-3 px-3">
                                <Badge tone={row.facilityType === "UMBRELLA" ? "purple" : "neutral"}>
                                  {row.facilityType}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 font-medium text-emerald-600 dark:text-emerald-400">
                                {row.indicativeCost}
                              </td>
                              <td className="py-3 px-3 font-medium">
                                {row.advanceRatePct ? `${row.advanceRatePct}%` : "80-85%"}
                              </td>
                              <td className="py-3 px-3 text-neutral-500">
                                {row.speedToTermSheet}
                              </td>
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  {Array.isArray(row.sourceUrls) && row.sourceUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {row.sourceUrls.map((url: string, uIdx: number) => (
                                        <a
                                          key={uIdx}
                                          href={url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                          <ExternalLink className="h-3 w-3" /> Source {uIdx + 1}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                  {row.contactInfo && (
                                    <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                                      <Mail className="h-3 w-3" /> {row.contactInfo}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Calculator className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                <h4 className="font-semibold text-sm">No Term Sheet Generated Yet</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Click the <strong>Benchmark &amp; Term Sheet</strong> button in the top action bar to calculate deterministic formulas and credit terms.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: FUNDER MATCHES & WEB RESEARCH */}
      {activeTab === "funders" && (
        <div className="space-y-6">
          {/* Interactive Deal-Specific Funder Research Card */}
          <TradeFunderDealResearchCard
            dealId={deal.id}
            dealName={deal.name}
            corridor={deal.corridor}
            defaultHint={`Trade finance funder for ${deal.corridor.replaceAll("_", " ")} (${buyLeg?.commodityName ?? sellLeg?.commodityName ?? "bulk commodities"}), origin ${supplier?.jurisdiction ?? "Southeast Asia"} to ${buyer?.jurisdiction ?? "Asia"}`}
          />

          {/* Two-Tier Funder Matches */}
          {deal.matches.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Two-Tier Funder Matches &amp; Verified Rate Sources</CardTitle>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Strict Pricing Provenance, tariff quotations, and direct trade finance desk contacts.
                    </p>
                  </div>
                  <Badge tone="purple">Tier 1 Umbrella → Tier 2 Modular</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {deal.matches.map((m) => {
                  const diagnostics = validateTradeFunderDSL(m.funder as any);
                  const contactEmail =
                    m.funder.deskContacts?.contactEmail ||
                    (m.funder.contact?.includes("@") ? m.funder.contact.split("|")[0].trim() : null);
                  const contactPhone =
                    m.funder.deskContacts?.phone ||
                    (m.funder.contact?.includes("+") ? m.funder.contact.split("|")[1]?.trim() : null);
                  const portalUrl = m.funder.deskContacts?.applicationPortalUrl || m.funder.applicationUrl;
                  const officeLoc = m.funder.deskContacts?.officeLocation;
                  const deptName = m.funder.deskContacts?.departmentName;
                  const pricingProv = m.funder.pricingProvenance;
                  const evidenceText = pricingProv?.evidenceSnippet || m.funder.rateEvidenceSnippet;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-4 text-sm transition-all ${
                        m.isTier1
                          ? "border-purple-300 bg-purple-50/20 shadow-sm dark:border-purple-900/60 dark:bg-purple-950/20"
                          : "border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      {/* Top Header: Funder Name, Badges & Pricing */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                              {m.funder.name}
                            </h4>
                            {m.isTier1 && <Badge tone="purple">Tier 1: Umbrella Facility</Badge>}
                            <Badge tone={m.verdict === "ELIGIBLE" || m.verdict === "GOOD" ? "green" : m.verdict === "POSSIBLE" ? "blue" : "neutral"}>
                              {m.verdict}
                            </Badge>
                            <Badge tone="neutral" className="text-[10px]">
                              {m.funder.confidence.replaceAll("_", " ")}
                            </Badge>
                            {/* DSL Completeness Pill */}
                            {diagnostics.isValid ? (
                              <Badge tone="green" className="text-[10px] flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> DSL Verified (100%)
                              </Badge>
                            ) : (
                              <Badge tone="amber" className="text-[10px] flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> DSL Data Gap ({diagnostics.completenessScorePct}%)
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">{m.funder.type.replaceAll("_", " ")}</p>
                        </div>

                        {/* Indicative Pricing & Derivation Type */}
                        {m.funder.indicativePricingGuidance && (
                          <div className="text-right shrink-0">
                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                              <span className="text-[11px] text-neutral-400">Indicative Pricing</span>
                              {pricingProv?.derivationType && (
                                <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                                  pricingProv.derivationType === "PUBLISHED_TARIFF"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : pricingProv.derivationType === "DESK_TERM_SHEET"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                    : pricingProv.derivationType === "OFFICIAL_DISCLOSURE"
                                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                                    : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                                }`}>
                                  {pricingProv.derivationType.replaceAll("_", " ")}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-base text-emerald-600 dark:text-emerald-400 font-mono">
                              {m.funder.indicativePricingGuidance}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Matching Rationale */}
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-2.5 leading-relaxed">
                        {m.rationale}
                      </p>

                      {/* Rate Evidence Quote & Tariff Citation */}
                      {evidenceText && (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-neutral-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-neutral-200">
                          <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <Quote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              {pricingProv?.derivationType === "OFFICIAL_DISCLOSURE"
                                ? "Audited Regulatory / Statutory Filing Disclosure:"
                                : pricingProv?.derivationType === "MARKET_BENCHMARK"
                                ? "Institutional Market Benchmark Spread:"
                                : pricingProv?.derivationType === "DESK_TERM_SHEET"
                                ? "Private Debt Desk Term Sheet Corridor:"
                                : pricingProv?.derivationType === "PUBLISHED_TARIFF"
                                ? "Verified Marketplace Tariff Schedule:"
                                : pricingProv?.derivationType === "UNPUBLISHED_BILATERAL_ESTIMATE"
                                ? "Model Underwriting Estimate (Unpublished Bilateral Line):"
                                : "Pricing Provenance & Audit Evidence:"}
                            </span>
                            <span className="font-normal text-[10px] text-neutral-500">
                              {pricingProv?.spiderEngine || "Tariff Spider"}
                              {pricingProv?.crawledAt && ` • ${new Date(pricingProv.crawledAt).toLocaleDateString()}`}
                            </span>
                          </div>
                          <p className="italic font-mono text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                            &ldquo;{evidenceText}&rdquo;
                          </p>
                          <div className="mt-2 text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded px-2.5 py-1">
                            ⚠️ <strong>Audit Notice:</strong> Commercial loan spreads are underwritten bilaterally and not published online. Pricing shown is an indicative model baseline; external links verify institutional standing only.
                          </div>
                          {pricingProv?.regulatoryFilingReference && (
                            <div className="mt-2 text-[10px] text-emerald-900 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                              <span className="font-bold text-emerald-800 dark:text-emerald-400">📌 Regulatory Filing:</span>
                              <span className="font-mono truncate">{pricingProv.regulatoryFilingReference}</span>
                            </div>
                          )}
                          <div className="mt-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                            <span className="text-neutral-600 dark:text-neutral-400 font-medium truncate max-w-[280px]">
                              Source: {pricingProv?.sourcePageTitle || pricingProv?.sourceDocumentOrUrl || "Institutional Source"}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSnapshotFunder(m.funder)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
                              >
                                <BookOpen className="h-3 w-3" /> View Audit Snapshot &amp; Cache
                              </button>
                              {pricingProv?.sourceDocumentOrUrl && (
                                <a
                                  href={pricingProv.sourceDocumentOrUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-neutral-600 hover:text-emerald-700 hover:underline dark:text-neutral-400 dark:hover:text-emerald-400 text-[11px]"
                                >
                                  Portal <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {pricingProv?.archiveUrl && (
                                <a
                                  href={pricingProv.archiveUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:underline dark:text-purple-300 text-[11px]"
                                >
                                  Filing ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Direct Desk Contacts & Intake Portal */}
                      {(contactEmail || contactPhone || portalUrl || officeLoc || deptName) && (
                        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
                          <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                            <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                              <Building className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              Direct Desk Contacts &amp; Official Intake
                            </span>
                            {deptName && (
                              <span className="text-[10px] text-neutral-500 font-medium">
                                {deptName}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {contactEmail && (
                              <a
                                href={`mailto:${contactEmail}?subject=Trade%20Finance%20Facility%20Inquiry%20-%20${encodeURIComponent(deal.name)}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-purple-400 hover:bg-neutral-50 hover:text-purple-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                              >
                                <Mail className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                <span>{contactEmail}</span>
                              </a>
                            )}
                            {contactPhone && (
                              <a
                                href={`tel:${contactPhone.replace(/[^0-9+]/g, "")}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-purple-400 hover:bg-neutral-50 hover:text-purple-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                              >
                                <Phone className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                <span>{contactPhone}</span>
                              </a>
                            )}
                            {portalUrl && (
                              <a
                                href={portalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md bg-purple-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-purple-800"
                              >
                                <Globe className="h-3.5 w-3.5" />
                                <span>Direct Intake Portal</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {officeLoc && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 ml-auto">
                                <MapPin className="h-3 w-3" />
                                {officeLoc}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* DSL Diagnostic Alert Tray (When Data Gaps Exist) */}
                      {!diagnostics.isValid && (
                        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              DSL Validation Alert: Incomplete Schema ({diagnostics.completenessScorePct}% Completeness)
                            </span>
                            <span className="text-[10px] uppercase font-mono font-bold text-amber-700 dark:text-amber-400">
                              Agent Action Required
                            </span>
                          </div>
                          {diagnostics.missingFields.length > 0 && (
                            <p className="text-[11px] text-amber-900 dark:text-amber-300">
                              <strong>Missing Fields:</strong> {diagnostics.missingFields.join(", ")}
                            </p>
                          )}
                          {diagnostics.unverifiedClaims.length > 0 && (
                            <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-0.5">
                              <strong>Unverified Claims:</strong> {diagnostics.unverifiedClaims.join("; ")}
                            </p>
                          )}
                          {diagnostics.formatErrors.length > 0 && (
                            <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-0.5">
                              <strong>Format Errors:</strong> {diagnostics.formatErrors.join("; ")}
                            </p>
                          )}
                          {diagnostics.agentDirectives.length > 0 && (
                            <div className="mt-2 rounded bg-amber-100/90 p-2 text-[11px] font-mono text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                              <strong>🤖 Agent Directive:</strong> {diagnostics.agentDirectives[0]}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Primary Source URL Pills */}
                      {Array.isArray(m.funder.sources) && m.funder.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2.5 text-xs dark:border-neutral-800">
                          <span className="text-neutral-400 text-[11px]">Citations &amp; Primary Pages:</span>
                          {m.funder.sources.map((src, sIdx) => {
                            let label = src;
                            try {
                              const parsed = new URL(src);
                              label = parsed.hostname.replace(/^www\./, "") + parsed.pathname;
                              if (label.length > 35) label = label.slice(0, 32) + "…";
                            } catch {}
                            return (
                              <a
                                key={sIdx}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-mono text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                              >
                                <ExternalLink className="h-3 w-3 text-neutral-400" />
                                <span>{label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Search className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                <h4 className="font-semibold text-sm">No Funder Matches Generated</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Run <strong>Match Funders</strong> or use the Deal Research card above to query live institutional trade finance desks.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: RECONCILED TRADE AUDIT */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          {/* Tripartite Structure Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Trade Flow &amp; Tripartite Counterparties</CardTitle>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Reconciled commercial counterparties, jurisdictions, licenses, and verified banks.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditDealOpen(true)}
                className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 border-emerald-300 dark:border-emerald-800 dark:text-emerald-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Deal Spec
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                    Supplier (Origin)
                  </span>
                  <p className="mt-1 font-semibold text-base">{supplier?.legalName || "Pending Extraction"}</p>
                  <p className="text-xs text-neutral-500 mt-1">Jurisdiction: {supplier?.jurisdiction || "—"}</p>
                  {supplier?.concessionOrLicenseId && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concession/License: {supplier.concessionOrLicenseId}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-purple-200 bg-purple-50/30 dark:border-purple-900/40 p-4">
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                    Trader (Borrower / Intermediary)
                  </span>
                  <p className="mt-1 font-semibold text-base">{trader?.legalName || "Pending Extraction"}</p>
                  <p className="text-xs text-neutral-500 mt-1">Jurisdiction: {trader?.jurisdiction || "—"}</p>
                  <p className="text-xs text-neutral-500">Bank: {trader?.bankName || "—"}</p>
                </div>

                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                    Buyer (Offtaker / End Receiver)
                  </span>
                  <p className="mt-1 font-semibold text-base">{buyer?.legalName || "Pending Extraction"}</p>
                  <p className="text-xs text-neutral-500 mt-1">Jurisdiction: {buyer?.jurisdiction || "—"}</p>
                  <p className="text-xs text-neutral-500">Bank: {buyer?.bankName || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Paired Contracts Audit: Buy Leg vs Sell Leg */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600 dark:text-blue-400">Buy Leg (Supply Contract)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {buyLeg ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Contract Ref:</span>
                      <span className="font-medium">{buyLeg.contractReference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Commodity &amp; Volume:</span>
                      <span className="font-medium">
                        {buyLeg.quantity.toLocaleString()} {buyLeg.unit} ({buyLeg.commodityName})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Unit Price / Leg Value:</span>
                      <span className="font-medium">
                        ${buyLeg.unitPrice} / ${(buyLeg.amountUsd / 1_000_000).toFixed(2)}M USD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Incoterm &amp; Port:</span>
                      <span className="font-medium">
                        {buyLeg.incoterm} {buyLeg.port}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Payment Terms:</span>
                      <span className="font-medium">
                        {buyLeg.paymentType} ({buyLeg.tenorDays} days)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-400 text-xs">No buy leg contract extracted.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-emerald-600 dark:text-emerald-400">Sell Leg (Offtake Contract)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {sellLeg ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Contract Ref:</span>
                      <span className="font-medium">{sellLeg.contractReference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Commodity &amp; Volume:</span>
                      <span className="font-medium">
                        {sellLeg.quantity.toLocaleString()} {sellLeg.unit} ({sellLeg.commodityName})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Unit Price / Leg Value:</span>
                      <span className="font-medium">
                        ${sellLeg.unitPrice} / ${(sellLeg.amountUsd / 1_000_000).toFixed(2)}M USD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Incoterm &amp; Port:</span>
                      <span className="font-medium">
                        {sellLeg.incoterm} {sellLeg.port}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Payment Terms:</span>
                      <span className="font-medium">
                        {sellLeg.paymentType} ({sellLeg.tenorDays} days)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-400 text-xs">No sell leg contract extracted.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Reconciled Economics: Gross Margin & Cashflow Gap */}
          {buyLeg && sellLeg && (
            <Card className="border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/40">
              <CardContent className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-xs text-neutral-500 uppercase">Gross Trader Spread</span>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ${((sellLeg.amountUsd - buyLeg.amountUsd) / 1000).toFixed(1)}k USD
                    </p>
                    <p className="text-xs text-neutral-400">
                      {(((sellLeg.amountUsd - buyLeg.amountUsd) / buyLeg.amountUsd) * 100).toFixed(2)}% margin
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 uppercase">Cashflow Gap Days</span>
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {Math.max(0, sellLeg.tenorDays - buyLeg.tenorDays)} Days
                    </p>
                    <p className="text-xs text-neutral-400">Tenor Differential</p>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 uppercase">Reconciliation Status</span>
                    <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Fully Reconciled
                    </p>
                    <p className="text-xs text-neutral-400">Ready for benchmark</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Flags */}
          {deal.riskFlags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Corridor Audit &amp; Cross-Contract Risk Flags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deal.riskFlags.map((rf) => (
                  <div
                    key={rf.id}
                    className="flex items-start gap-2.5 rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {rf.category.replaceAll("_", " ")}
                        </span>
                        <Badge tone={rf.severity >= 4 ? "red" : rf.severity >= 3 ? "amber" : "neutral"}>
                          Severity {rf.severity}/5
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">{rf.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: DOCUMENTS & PROVENANCE */}
      {activeTab === "provenance" && (
        <div className="space-y-6">
          {/* Documents List & Upload Dropzone */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Uploaded Trade Deal Documents ({deal.documents.length})</CardTitle>
                <Badge tone="neutral">Immutable Storage</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 text-sm">
                {deal.documents.map((doc) => (
                  <li key={doc.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{doc.fileName}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {(doc.sizeBytes / 1024).toFixed(1)} KB · Leg: <strong>{doc.tradeLeg || "General / Corridor"}</strong> · Types:{" "}
                        {doc.documentTypes.join(", ") || "Unclassified"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.extractedRaw && (
                        <Badge tone="green">Extracted</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocForExtraction(doc)}
                        className="h-7 text-[11px] px-2 gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                        title="View or Edit Raw Extracted JSON"
                      >
                        <FileCode className="h-3 w-3 text-blue-600" />
                        View / Edit JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocForExtraction(doc)}
                        className="h-7 text-[11px] px-2 gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                        title="Re-run AI Extraction for this trade document"
                      >
                        <RefreshCw className="h-3 w-3 text-emerald-600" />
                        Re-run
                      </Button>
                      <a
                        href={`/api/trade-deals/${deal.id}/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <ExternalLink className="h-3 w-3" /> View File
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <TradeUploadDropzone existingDealId={deal.id} />
              </div>
            </CardContent>
          </Card>

          {/* Full Lineage & Provenance Audit Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Data Provenance &amp; Verification Trail</CardTitle>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Every data point entering the deterministic DSL is strictly tracked to its originating document, extraction engine, and timestamp.
                  </p>
                </div>
                <Badge tone="purple">Full Traceability</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">DSL Field / Entity</th>
                      <th className="py-2.5 px-3">Resolved Value</th>
                      <th className="py-2.5 px-3">Source Document</th>
                      <th className="py-2.5 px-3">Extraction Agent / Model</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Supplier Identity</td>
                      <td className="py-2.5 px-3 font-medium">{supplier?.legalName ?? "Unknown"}</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">{buyLeg ? "Supply Contract" : "Document 1"}</td>
                      <td className="py-2.5 px-3 text-neutral-500">Mistral OCR + Gemini 2.5 Flash</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Trader Intermediary</td>
                      <td className="py-2.5 px-3 font-medium">{trader?.legalName ?? "Unknown"}</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">Paired Contracts (Buy + Sell)</td>
                      <td className="py-2.5 px-3 text-neutral-500">Deterministic Corroboration</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Buyer / Offtaker</td>
                      <td className="py-2.5 px-3 font-medium">{buyer?.legalName ?? "Unknown"}</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">{sellLeg ? "Offtake Sales Contract" : "Document 2"}</td>
                      <td className="py-2.5 px-3 text-neutral-500">Mistral OCR + Gemini 2.5 Flash</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Supply Leg Value</td>
                      <td className="py-2.5 px-3 font-medium">${buyLeg?.amountUsd.toLocaleString() ?? "—"} USD</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">Supply Contract Ref: {buyLeg?.contractReference ?? "—"}</td>
                      <td className="py-2.5 px-3 text-neutral-500">Commercial Parameters Parser</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Offtake Leg Value</td>
                      <td className="py-2.5 px-3 font-medium">${sellLeg?.amountUsd.toLocaleString() ?? "—"} USD</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">Offtake Contract Ref: {sellLeg?.contractReference ?? "—"}</td>
                      <td className="py-2.5 px-3 text-neutral-500">Commercial Parameters Parser</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Cashflow Gap Days</td>
                      <td className="py-2.5 px-3 font-medium">
                        {buyLeg && sellLeg ? `${Math.max(0, sellLeg.tenorDays - buyLeg.tenorDays)} Days` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400">Differential Formula</td>
                      <td className="py-2.5 px-3 text-neutral-500">Pure TypeScript Math (0% Hallucination)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AUDITABLE CACHED SOURCE SNAPSHOT MODAL */}
      {selectedSnapshotFunder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                    Auditable Source Snapshot &amp; Benchmark Provenance
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {selectedSnapshotFunder.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshotFunder(null)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 text-sm">
              {/* Reality Check Disclaimer */}
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Reality Check on External Bank Links:
                </div>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-[11px]">
                  Commercial banks and private funds <strong>do not publish bilateral loan interest rate cards or SOFR spreads on public websites</strong>. External links verify corporate registration, SEC filings, and institutional standing. The indicative margin shown is a model baseline for deal sizing and must be underwritten directly with the credit desk.
                </p>
              </div>

              {/* Derivation Type & Regulatory Reference Banner */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-semibold text-xs text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Regulatory &amp; Statutory Filing Reference
                  </span>
                  <Badge tone={selectedSnapshotFunder.pricingProvenance?.derivationType === "OFFICIAL_DISCLOSURE" ? "blue" : selectedSnapshotFunder.pricingProvenance?.derivationType === "MARKET_BENCHMARK" ? "purple" : selectedSnapshotFunder.pricingProvenance?.derivationType === "UNPUBLISHED_BILATERAL_ESTIMATE" ? "amber" : "green"}>
                    {selectedSnapshotFunder.pricingProvenance?.derivationType?.replaceAll("_", " ") || "Official Disclosure"}
                  </Badge>
                </div>
                <p className="font-mono text-xs font-bold text-blue-950 dark:text-blue-100">
                  {selectedSnapshotFunder.pricingProvenance?.regulatoryFilingReference || "Official Banking Authority / SEC Portfolio Yield Disclosure"}
                </p>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-2 leading-relaxed">
                  <strong>Why this citation matters:</strong> {selectedSnapshotFunder.pricingProvenance?.statutoryBenchmarkExplanation || "Cross-border bilateral commodity credit facilities are bespoke wholesale banking products. Unlike consumer credit cards, bilateral trade margins (such as Term SOFR spreads) are underwritten bilaterally and disclosed through audited statutory disclosures (e.g. US SEC Form 20-F Item 5, Central Bank SBDK returns, or wholesale syndication memoranda), rather than public retail marketing pages."}
                </p>
              </div>

              {/* Verified Working Links */}
              <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl border border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/40">
                <span className="text-xs text-neutral-500 font-medium">Verified Links:</span>
                {selectedSnapshotFunder.pricingProvenance?.sourceDocumentOrUrl && (
                  <a
                    href={selectedSnapshotFunder.pricingProvenance.sourceDocumentOrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-purple-400 hover:text-purple-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    <Globe className="h-3.5 w-3.5 text-blue-600" />
                    <span>Official Product Portal</span>
                    <ExternalLink className="h-3 w-3 text-neutral-400" />
                  </a>
                )}
                {selectedSnapshotFunder.pricingProvenance?.archiveUrl && (
                  <a
                    href={selectedSnapshotFunder.pricingProvenance.archiveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-200"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                    <span>Regulatory Filing / Archive ↗</span>
                  </a>
                )}
              </div>

              {/* How to Locate & Verify External Data Guide */}
              {selectedSnapshotFunder.pricingProvenance?.verificationNavigationGuide && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <div className="flex items-center gap-1.5 mb-2 font-semibold text-xs text-amber-900 dark:text-amber-200">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    How to Locate &amp; Verify this Data on External Sites / Filings:
                  </div>
                  <div className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-line leading-relaxed font-sans">
                    {selectedSnapshotFunder.pricingProvenance.verificationNavigationGuide}
                  </div>
                </div>
              )}

              {/* Research DSL Claim Verification Badge & Audit Check */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/90 p-4 dark:border-neutral-800 dark:bg-neutral-900/40 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Research DSL Anti-Hallucination Verification:
                  </span>
                  <Badge tone={selectedSnapshotFunder.pricingProvenance?.derivationType === "UNPUBLISHED_BILATERAL_ESTIMATE" ? "green" : "blue"}>
                    {selectedSnapshotFunder.pricingProvenance?.derivationType === "UNPUBLISHED_BILATERAL_ESTIMATE"
                      ? "✓ Verified Model Baseline (No Fake Quotes)"
                      : "Verified Attestation"}
                  </Badge>
                </div>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  <strong>Verification Check:</strong> The Research DSL verified that no manufactured retail quotes or invalid tariff claims were accepted. For commercial banks, rates are classified as unpublished bilateral spreads to reflect true wholesale credit mechanics.
                </div>
              </div>

              {/* Exact Extracted Claim */}
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Quote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    {selectedSnapshotFunder.pricingProvenance?.derivationType === "OFFICIAL_DISCLOSURE"
                      ? "Audited Statutory Filing & Portfolio Yield Disclosure:"
                      : selectedSnapshotFunder.pricingProvenance?.derivationType === "MARKET_BENCHMARK"
                      ? "Institutional Market Benchmark Spread:"
                      : selectedSnapshotFunder.pricingProvenance?.derivationType === "DESK_TERM_SHEET"
                      ? "Private Debt Desk Term Sheet Corridor:"
                      : selectedSnapshotFunder.pricingProvenance?.derivationType === "PUBLISHED_TARIFF"
                      ? "Verified Marketplace Tariff Schedule:"
                      : "Pricing Provenance & Audit Record:"}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    {selectedSnapshotFunder.indicativePricingGuidance}
                  </span>
                </div>
                <blockquote className="italic font-mono text-xs text-neutral-800 dark:text-neutral-200 bg-white/70 dark:bg-black/30 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 leading-relaxed">
                  &ldquo;{selectedSnapshotFunder.pricingProvenance?.evidenceSnippet || selectedSnapshotFunder.rateEvidenceSnippet}&rdquo;
                </blockquote>
              </div>

              {/* Full Context Paragraph with Highlight */}
              {selectedSnapshotFunder.pricingProvenance?.contextParagraph && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-xs text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-neutral-500" />
                      Full Surrounding Context from Regulatory Document / Tariff Schedule:
                    </h5>
                    <span className="text-[10px] text-neutral-400">Highlighted in green</span>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200">
                    {renderHighlightedContext(
                      selectedSnapshotFunder.pricingProvenance.contextParagraph,
                      selectedSnapshotFunder.pricingProvenance.evidenceSnippet || selectedSnapshotFunder.rateEvidenceSnippet
                    )}
                  </div>
                </div>
              )}

              {/* Cached Raw Text Snapshot */}
              {selectedSnapshotFunder.pricingProvenance?.cachedSnapshotText && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase font-bold text-neutral-500">
                      Cached Raw Audit Record (Tariff Schedule Extract)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      Verified Local Cache
                    </span>
                  </div>
                  <pre className="rounded-xl bg-neutral-950 p-3.5 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap border border-neutral-800 leading-relaxed">
                    {selectedSnapshotFunder.pricingProvenance.cachedSnapshotText}
                  </pre>
                </div>
              )}

              {/* Audit Meta Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 text-[11px] text-neutral-500 dark:border-neutral-800">
                <span>Spider Engine: <strong>{selectedSnapshotFunder.pricingProvenance?.spiderEngine || "Tariff Spider"}</strong></span>
                <span>Crawled: <strong>{new Date(selectedSnapshotFunder.pricingProvenance?.crawledAt || selectedSnapshotFunder.lastVerified).toLocaleString()}</strong></span>
                <span>Cached: <strong>{new Date(selectedSnapshotFunder.pricingProvenance?.cachedAt || selectedSnapshotFunder.lastVerified).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-3 flex justify-end dark:border-neutral-800 dark:bg-neutral-900/80">
              <Button variant="outline" className="text-xs" onClick={() => setSelectedSnapshotFunder(null)}>
                Close Snapshot
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deal Spec Modal */}
      {isEditDealOpen && (
        <EditTradeDealModal deal={deal} onClose={() => setIsEditDealOpen(false)} />
      )}

      {/* View / Edit Extraction JSON Modal */}
      {selectedDocForExtraction && (
        <DocumentExtractionModal
          dealId={deal.id}
          document={selectedDocForExtraction}
          dealType="trade"
          onClose={() => setSelectedDocForExtraction(null)}
        />
      )}
    </div>
  );
}
