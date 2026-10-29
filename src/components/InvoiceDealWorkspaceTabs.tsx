"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Calculator,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  History,
  Check,
  X,
  TriangleAlert,
  Edit3,
  FileCode,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { EditInvoiceDealModal } from "@/components/EditInvoiceDealModal";
import { DocumentExtractionModal } from "@/components/DocumentExtractionModal";
import { AgentDslModal } from "@/components/AgentDslModal";
import { DealPipelineStepper } from "@/components/DealPipelineStepper";
import { TaintPolicyDrawer } from "@/components/TaintPolicyDrawer";
import { RiskFlagVerificationCard } from "@/components/RiskFlagVerificationCard";
import { isBlockingRiskFlag, resolveDocumentTaint } from "@/dsl/provenance";
import { DealExecutionTimeline } from "@/components/DealExecutionTimeline";
import { TabDslInspectorPanel } from "@/components/dsl/TabDslInspectorPanel";
import { INVOICE_DEAL_SPEC_FIELDS } from "@/dsl/field-documentation";
import {
  computePartyProvenance,
  computeFinancingAskProvenance,
  computeRiskFlagProvenance,
  computeOpenQuestionProvenance,
} from "@/lib/deal-provenance";
import { matchProvider, buildMatchInputs, type CriterionStatus } from "@/lib/matching";
import { computeDocumentCoverage } from "@/lib/document-coverage";
import { MatchCriteriaAndDocsChecklist } from "@/components/MatchCriteriaAndDocsChecklist";
import { TabSectionNav, CardNextSectionCue, scrollToSectionWithHighlight } from "@/components/navigation/TabSectionNav";
import { ProvenancePill, ProvenanceXRayDrawer, DataLineageMatrix } from "@/components/provenance";
import { synthesizeFieldLineageFromDsl, type FieldLineageNode } from "@/dsl/provenance";
import { InvoiceProviderDealResearchCard } from "@/components/InvoiceProviderDealResearchCard";

const RISK_SEVERITY_TONE = (severity: number): "red" | "amber" | "neutral" =>
  severity >= 4 ? "red" : severity >= 3 ? "amber" : "neutral";

const VERDICT_TONE = { GOOD: "green", POSSIBLE: "blue", POOR: "amber", EXCLUDED: "neutral" } as const;

const CRITERION_ICON: Record<CriterionStatus, ReactNode> = {
  pass: <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="pass" />,
  fail: <X className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="fail" />,
  warning: <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-label="warning" />,
};

export interface InvoiceDealWorkspaceTabsProps {
  deal: {
    id: string;
    name: string;
    status: string;
    reviewerNotes: string | null;
    documents: any[];
    parties: any[];
    financingAsks: any[];
    riskFlags: any[];
    providerMatches: any[];
    termSheets: any[];
    researchRuns: any[];
  };
}

export function InvoiceDealWorkspaceTabs({ deal }: InvoiceDealWorkspaceTabsProps) {
  const router = useRouter();
  const blockingRisks = deal.riskFlags.filter((r) => isBlockingRiskFlag(r));

  const [activeTab, setActiveTab] = useState<"documents" | "spec" | "matches" | "termsheet">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["documents", "spec", "matches", "termsheet"].includes(tabParam)) {
        return tabParam as "documents" | "spec" | "matches" | "termsheet";
      }
    }
    return deal.documents.length === 0
      ? "documents"
      : blockingRisks.length > 0
      ? "spec"
      : deal.termSheets.length > 0
      ? "termsheet"
      : deal.providerMatches.length > 0
      ? "matches"
      : "spec";
  });

  const switchTab = (tab: "documents" | "spec" | "matches" | "termsheet") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const jumpToWindow = (tabKey: string, sectionId?: string) => {
    let mappedTab: "documents" | "spec" | "matches" | "termsheet" = "documents";
    if (tabKey === "dataroom") mappedTab = "documents";
    else if (tabKey === "spec") mappedTab = "spec";
    else if (tabKey === "matching") mappedTab = "matches";
    else if (tabKey === "blueprint") mappedTab = "termsheet";

    switchTab(mappedTab);
    if (sectionId) {
      setTimeout(() => scrollToSectionWithHighlight(sectionId), 120);
    }
  };
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [isDslModalOpen, setIsDslModalOpen] = useState(false);
  const [isTaintPolicyOpen, setIsTaintPolicyOpen] = useState(false);
  const [relaxInferredInvoice, setRelaxInferredInvoice] = useState(false);
  const [selectedDocForExtraction, setSelectedDocForExtraction] = useState<{
    id: string;
    fileName: string;
    documentTypes: string[];
    extractedRaw: any;
  } | null>(null);

  const latestTermSheet = deal.termSheets[0];
  const [selectedXRayNode, setSelectedXRayNode] = useState<FieldLineageNode | null>(null);

  const invoiceLineage = useMemo(() => {
    return synthesizeFieldLineageFromDsl({
      dealId: deal.id,
      parties: deal.parties,
      financingAsks: deal.financingAsks,
      documents: deal.documents,
    });
  }, [deal]);
  const { dealInput: dealMatchInput, askInput: askMatchInput } = buildMatchInputs(
    deal.parties,
    deal.financingAsks,
  );

  const matchesByVerdict = {
    GOOD: deal.providerMatches.filter((m) => m.verdict === "GOOD"),
    POSSIBLE: deal.providerMatches.filter((m) => m.verdict === "POSSIBLE"),
    POOR: deal.providerMatches.filter((m) => m.verdict === "POOR"),
    EXCLUDED: deal.providerMatches.filter((m) => m.verdict === "EXCLUDED"),
  };

  const steps = [
    {
      id: "documents",
      stepNumber: 1,
      label: "Documents & Taint Policy",
      agentBadge: "INGEST & TAINT",
      milestoneRange: "M1–M2",
      topButtonHint: "1. Extract & Spec",
      completed: deal.documents.length > 0,
      count: deal.documents.length,
    },
    {
      id: "spec",
      stepNumber: 2,
      label: "Extracted Spec & Risk Gate",
      agentBadge: "誠 MAKOTO DSL",
      milestoneRange: "M3–M4",
      topButtonHint: "1. Extract & Spec",
      completed: (deal.parties.length > 0 || deal.financingAsks.length > 0) && blockingRisks.length === 0,
      count: deal.parties.length,
      warningCount: blockingRisks.length,
    },
    {
      id: "matches",
      stepNumber: 3,
      label: "Provider Matches",
      agentBadge: "LENDER CASCADE",
      milestoneRange: "M5",
      topButtonHint: "2. Match Providers",
      completed: deal.providerMatches.length > 0,
      count: deal.providerMatches.length,
      locked: blockingRisks.length > 0,
    },
    {
      id: "termsheet",
      stepNumber: 4,
      label: "Lender Term Sheet",
      agentBadge: "BENCHMARK ENGINE",
      milestoneRange: "M6",
      topButtonHint: "3. Benchmark Terms",
      completed: deal.termSheets.length > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Shared 4-Stage Guided Pipeline Stepper */}
      <DealPipelineStepper
        assetLabel="Invoice Factoring"
        steps={steps}
        activeStepId={activeTab}
        onSelectStep={(id) => switchTab(id as any)}
        onOpenDslModal={() => setIsDslModalOpen(true)}
        onOpenTaintPolicy={() => setIsTaintPolicyOpen(true)}
        blockingRiskCount={blockingRisks.length}
      />

      {/* Interactive Deal Execution & Verification Progress Timeline */}
      <DealExecutionTimeline
        assetClass="INVOICE"
        dealId={deal.id}
        currentTab={activeTab}
        onSelectTab={(tabKey, sectionId) => jumpToWindow(tabKey, sectionId)}
        docCount={deal.documents.length}
        hasReconciledSpec={deal.parties.length > 0 || deal.financingAsks.length > 0}
        unresolvedRiskCount={blockingRisks.length}
        matchCount={deal.providerMatches.length}
        benchmarkCount={deal.termSheets?.length || 0}
      />

      {/* TAB 1: TERM SHEET */}
      {activeTab === "termsheet" && (
        <div className="space-y-6">
          {latestTermSheet ? (
            <Card id="section-invoice-termsheet">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lender Benchmark &amp; Indicative Term Sheet</CardTitle>
                  <Badge tone="green">Generated Term Sheet</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-blue-50/50 p-4 dark:bg-blue-950/20 text-sm text-neutral-700 dark:text-neutral-300 border border-blue-200/50 dark:border-blue-900/40 leading-relaxed">
                  <span className="font-semibold text-blue-900 dark:text-blue-200 block mb-1">Market Leverage Assessment:</span>
                  {latestTermSheet.leverageAssessment}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-800/50">
                  <div className="rounded-lg bg-white p-3 shadow-2xs dark:bg-neutral-800">
                    <span className="text-xs font-semibold text-neutral-400 uppercase">Proposed Rate</span>
                    <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {latestTermSheet.proposedRatePct != null ? `${latestTermSheet.proposedRatePct}% p.a.` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-2xs dark:bg-neutral-800">
                    <span className="text-xs font-semibold text-neutral-400 uppercase">Advance Rate</span>
                    <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {latestTermSheet.advanceRatePct != null ? `${latestTermSheet.advanceRatePct}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-2xs dark:bg-neutral-800">
                    <span className="text-xs font-semibold text-neutral-400 uppercase">Tenor</span>
                    <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {latestTermSheet.tenorDaysMin ?? "?"}-{latestTermSheet.tenorDaysMax ?? "?"}d
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-2xs dark:bg-neutral-800">
                    <span className="text-xs font-semibold text-neutral-400 uppercase">Currency</span>
                    <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {latestTermSheet.currency ?? "USD"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-2">
                      Rate Rationale
                    </span>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {latestTermSheet.rateRationale}
                    </p>
                  </div>

                  <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-2">
                      Security &amp; Conditions Precedent
                    </span>
                    <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <p>{latestTermSheet.securityTerms}</p>
                      <p>{latestTermSheet.conditionsPrecedent}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Calculator className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                <h4 className="font-semibold text-sm">No Term Sheet Generated Yet</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Click the <strong>Generate term sheet</strong> action button above once you have matched capital providers.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: PROVIDER MATCHES */}
      {activeTab === "matches" && (
        <div className="space-y-6">
          <InvoiceProviderDealResearchCard
            dealId={deal.id}
            dealName={deal.name}
            borrowerJurisdiction={dealMatchInput.borrowerJurisdiction}
            obligorJurisdiction={dealMatchInput.obligorJurisdiction}
            onResearchComplete={() => router.refresh()}
          />

          <Card id="section-invoice-matches">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Capital Provider Matches</CardTitle>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Evaluated against published underwriting parameters and verified rate schedules.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRelaxInferredInvoice(!relaxInferredInvoice)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                      relaxInferredInvoice
                        ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800 shadow-xs"
                        : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                    }`}
                    title="When enabled, providers whose only failures are unverified AI scope inferences are upgraded to POSSIBLE."
                  >
                    <Sparkles className={`h-3 w-3 ${relaxInferredInvoice ? "text-purple-600 dark:text-purple-400 fill-purple-600/20" : "text-neutral-400"}`} />
                    <span>Relax Inferred Blockers</span>
                  </button>
                  <Badge tone="blue">{deal.providerMatches.length} Matches</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {deal.providerMatches.length === 0 ? (
                <EmptyState
                  title="No matches yet"
                  description='Once the deal spec looks right, click "Run matching" above.'
                />
              ) : (
                <div className="space-y-6">
                  {(["GOOD", "POSSIBLE", "POOR", "EXCLUDED"] as const).map((verdict) =>
                    matchesByVerdict[verdict].length === 0 ? null : (
                      <div key={verdict}>
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          {verdict} Matches ({matchesByVerdict[verdict].length})
                        </h4>
                        <ul className="space-y-3">
                          {matchesByVerdict[verdict].map((m) => {
                            const criteria = matchProvider(m.provider, dealMatchInput, askMatchInput).criteria;
                            const docCoverage = computeDocumentCoverage(m.provider.documentsRequired, deal.documents);
                            const missingDocCount = docCoverage.filter((d) => !d.satisfied).length;
                            const failed = criteria.filter((c) => c.status === "fail");
                            const isRelaxed = relaxInferredInvoice && failed.length > 0 && failed.every((c) => c.funderSide?.acquisitionMethod === "AGENT_INFERRED_FROM_SCOPE" || c.funderSide?.acquisitionMethod === "UNPUBLISHED_DESK_ESTIMATE");
                            const effectiveVerdict = isRelaxed ? "POSSIBLE" : m.verdict;

                            return (
                              <li key={m.id} className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800 hover:shadow-2xs transition-shadow">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                                      {m.provider.name}
                                    </span>
                                    {isRelaxed && (
                                      <Badge tone="purple" className="text-[10px] flex items-center gap-1 font-bold">
                                        <Sparkles className="h-3 w-3" /> Relaxed Match
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge tone={VERDICT_TONE[effectiveVerdict as keyof typeof VERDICT_TONE] ?? "neutral"}>
                                    {effectiveVerdict}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{m.rationale}</p>
                                {m.provider.applicationUrl && (
                                  <a
                                    href={m.provider.applicationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    Application portal &rarr;
                                  </a>
                                )}

                                <MatchCriteriaAndDocsChecklist
                                  criteria={criteria}
                                  documentsRequired={m.provider.documentsRequired || []}
                                  uploadedDocs={deal.documents || []}
                                  assetLabel="funder"
                                  funderName={m.provider.name}
                                  defaultOpen={m.verdict === "EXCLUDED"}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: DEAL SPEC & RISKS */}
      {activeTab === "spec" && (
        <div className="space-y-6">
          <TabSectionNav
            sections={[
              {
                id: "section-invoice-spec",
                label: "Extracted Parties",
                count: deal.parties.length,
              },
              {
                id: "section-invoice-asks",
                label: "Financing Asks",
                count: deal.financingAsks.length,
              },
              {
                id: "section-invoice-risks",
                label: "Human Risk Gate",
                count: deal.riskFlags.length,
                isWarning: blockingRisks.length > 0,
                badgeText: blockingRisks.length > 0 ? `${blockingRisks.length} Verify` : "Clear",
              },
              {
                id: "section-invoice-dsl-inspector",
                label: "Tab DSL Inspector & Versions",
                badgeText: "DSL Spec",
              },
            ]}
          />

          {/* Open Questions */}
          {deal.reviewerNotes && (
            <Card className="border-amber-200 bg-amber-50/20 dark:border-amber-900/40">
              <CardHeader>
                <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Open Questions from Document Extraction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                <ul className="space-y-2">
                  {deal.reviewerNotes
                    .split("\n")
                    .map((q) => q.trim())
                    .filter(Boolean)
                    .map((q, idx) => {
                      const sources = computeOpenQuestionProvenance(q, deal.documents);
                      return (
                        <li key={idx} className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200/40 pb-2 last:border-b-0 last:pb-0">
                          <span className="text-xs">{q}</span>
                          {sources.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {sources.map((docName) => (
                                <span
                                  key={docName}
                                  className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                >
                                  {docName}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Parties */}
          <Card id="section-invoice-spec">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Deal Spec &mdash; Extracted Parties &amp; Terms</CardTitle>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Counterparties, jurisdictions, borrowing entity, and creditworthiness ratings.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditDealOpen(true)}
                className="gap-1.5 text-xs text-blue-700 hover:text-blue-800 border-blue-300 dark:border-blue-800 dark:text-blue-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Deal Spec
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {deal.parties.length === 0 ? (
                <p className="text-sm text-neutral-500">No parties extracted yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-neutral-500 uppercase tracking-wider">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Role</th>
                        <th className="pb-2 pr-4 font-medium">Legal Name</th>
                        <th className="pb-2 pr-4 font-medium">Jurisdiction</th>
                        <th className="pb-2 pr-4 font-medium">Rating</th>
                        <th className="pb-2 pr-4 font-medium">Chain-of-Title</th>
                        <th className="pb-2 font-medium">Source Document(s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {deal.parties.map((p, pIdx) => {
                        const prov = computePartyProvenance(p, deal.documents);
                        return (
                          <tr key={p.id} className="align-top">
                            <td className="py-2.5 pr-4">
                              <Badge tone={p.role === "INTERMEDIARY" ? "amber" : "neutral"}>{p.role}</Badge>
                            </td>
                            <td className="py-2.5 pr-4 font-semibold text-neutral-900 dark:text-neutral-100">
                              <div className="flex items-center gap-1.5">
                                <span>{p.legalName}</span>
                                <ProvenancePill
                                  node={invoiceLineage[`$.parties[${pIdx}].legalName`] || invoiceLineage[`$.parties.${p.role}.legalName`]}
                                  onInspect={() => setSelectedXRayNode(invoiceLineage[`$.parties[${pIdx}].legalName`] || invoiceLineage[`$.parties.${p.role}.legalName`])}
                                />
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1.5">
                                <span>{p.jurisdiction ?? "—"}</span>
                                {p.jurisdiction && (
                                  <ProvenancePill
                                    node={invoiceLineage[`$.parties[${pIdx}].jurisdiction`] || invoiceLineage[`$.parties.${p.role}.jurisdiction`]}
                                    onInspect={() => setSelectedXRayNode(invoiceLineage[`$.parties[${pIdx}].jurisdiction`] || invoiceLineage[`$.parties.${p.role}.jurisdiction`])}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1.5">
                                <span>{p.publicRating ?? "—"}</span>
                                {p.publicRating && (
                                  <ProvenancePill
                                    node={invoiceLineage[`$.parties[${pIdx}].publicRating`] || invoiceLineage[`$.parties.${p.role}.publicRating`]}
                                    onInspect={() => setSelectedXRayNode(invoiceLineage[`$.parties[${pIdx}].publicRating`] || invoiceLineage[`$.parties.${p.role}.publicRating`])}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              {p.role === "INTERMEDIARY" ? (
                                p.primaryRightHolderVerified ? (
                                  <Badge tone="green">Verified: {p.primaryRightHolderName}</Badge>
                                ) : (
                                  <Badge tone="red">
                                    Unverified: {p.primaryRightHolderName ?? "unknown"}
                                  </Badge>
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2.5">
                              {prov.documents.length === 0 ? (
                                <span className="text-neutral-400">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {prov.documents.map((docName) => {
                                    const matchedDoc = deal.documents.find(
                                      (d) => d.fileName === docName || d.fileName.toLowerCase() === docName.toLowerCase()
                                    );
                                    return matchedDoc ? (
                                      <a
                                        key={docName}
                                        href={`/api/deals/${deal.id}/documents/${matchedDoc.id}/file`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-600 hover:text-blue-800 hover:underline dark:bg-neutral-800 dark:text-blue-400"
                                        title={`Open source document: ${docName}`}
                                      >
                                        <span>{docName}</span>
                                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                      </a>
                                    ) : (
                                      <span
                                        key={docName}
                                        className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                      >
                                        {docName}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <CardNextSectionCue nextSectionId="section-invoice-asks" nextSectionLabel="Financing Asks" />
            </CardContent>
          </Card>

          {/* Financing Asks */}
          <Card id="section-invoice-asks">
            <CardHeader>
              <CardTitle>Financing Asks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deal.financingAsks.length === 0 ? (
                <p className="text-sm text-neutral-500">No financing ask extracted yet.</p>
              ) : (
                <div className="space-y-3">
                  {deal.financingAsks.map((ask, askIdx) => {
                    const prov = computeFinancingAskProvenance(ask, deal.documents);
                    return (
                      <div key={ask.id} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-800/40">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge tone="blue">{ask.structureType.replaceAll("_", " ")}</Badge>
                            {ask.recurring && <Badge tone="neutral">recurring</Badge>}
                          </div>
                          {prov.documents.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-xs text-neutral-400">Source:</span>
                              {prov.documents.map((docName) => {
                                const matchedDoc = deal.documents.find(
                                  (d) => d.fileName === docName || d.fileName.toLowerCase() === docName.toLowerCase()
                                );
                                return matchedDoc ? (
                                  <a
                                    key={docName}
                                    href={`/api/deals/${deal.id}/documents/${matchedDoc.id}/file`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded bg-neutral-200/70 px-1.5 py-0.5 font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline dark:bg-neutral-700 dark:text-blue-400"
                                    title={`Open source document: ${docName}`}
                                  >
                                    <span>{docName}</span>
                                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                  </a>
                                ) : (
                                  <span
                                    key={docName}
                                    className="rounded bg-neutral-200/70 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                                  >
                                    {docName}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <dt className="text-xs text-neutral-500">Amount</dt>
                            <dd className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                              <span>{ask.amount ? `${ask.amount.toLocaleString()} ${ask.currency ?? ""}` : "—"}</span>
                              {ask.amount != null && (
                                <ProvenancePill
                                  node={invoiceLineage[`$.financingAsks[${askIdx}].amount`]}
                                  onInspect={() => setSelectedXRayNode(invoiceLineage[`$.financingAsks[${askIdx}].amount`])}
                                />
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-neutral-500">Advance Rate</dt>
                            <dd className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                              <span>{ask.advanceRatePct != null ? `${ask.advanceRatePct}%` : "—"}</span>
                              {ask.advanceRatePct != null && (
                                <ProvenancePill
                                  node={invoiceLineage[`$.financingAsks[${askIdx}].advanceRatePct`]}
                                  onInspect={() => setSelectedXRayNode(invoiceLineage[`$.financingAsks[${askIdx}].advanceRatePct`])}
                                />
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-neutral-500">Tenor</dt>
                            <dd className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                              <span>{ask.tenorDaysMin ?? "?"}-{ask.tenorDaysMax ?? "?"} days</span>
                              {(ask.tenorDaysMin != null || ask.tenorDaysMax != null) && (
                                <ProvenancePill
                                  node={invoiceLineage[`$.financingAsks[${askIdx}].tenorDays`]}
                                  onInspect={() => setSelectedXRayNode(invoiceLineage[`$.financingAsks[${askIdx}].tenorDays`])}
                                />
                              )}
                              {ask.tenorNote && <span className="text-amber-600 text-xs"> (provisional)</span>}
                            </dd>
                          </div>
                        </dl>
                        {ask.tenorNote && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{ask.tenorNote}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              <CardNextSectionCue nextSectionId="section-invoice-risks" nextSectionLabel="Extracted Risk Flags & Human Verification Gate" />
            </CardContent>
          </Card>

          {/* Risk Flags & Human Verification Gate */}
          <Card id="section-invoice-risks">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Extracted Risk Flags &amp; Human Verification Gate</CardTitle>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    High-severity, taint-conflict, or prompt-injection flags must be verified or waived by a human operator before Capital Matching can proceed.
                  </p>
                </div>
                {blockingRisks.length > 0 && (
                  <Badge tone="red">{blockingRisks.length} Blocking Match</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {deal.riskFlags.length === 0 ? (
                <p className="text-sm text-neutral-500">None flagged.</p>
              ) : (
                <div className="space-y-3">
                  {deal.riskFlags.map((r) => {
                    const sources = computeRiskFlagProvenance(r, deal.documents);
                    return (
                      <RiskFlagVerificationCard
                        key={r.id}
                        dealId={deal.id}
                        assetClass="INVOICE"
                        flag={r}
                        provenanceFiles={sources}
                      />
                    );
                  })}
                </div>
              )}
              <CardNextSectionCue nextSectionId="section-invoice-dsl-inspector" nextSectionLabel="Tab DSL Inspector & Version History" />
            </CardContent>
          </Card>

          {/* Unified Tab 2 DSL Specifications, Persistent Versions & Field Guide */}
          <div id="section-invoice-dsl-inspector">
            <TabDslInspectorPanel
              assetClass="INVOICE"
              dealId={deal.id}
              dealName={deal.name}
              tabKey="spec"
              tabLabel="2. Extracted Deal Spec & Risk Gate"
              items={[
                {
                  id: "invoice-spec",
                  dslType: "INVOICE_DEAL_SPEC",
                  title: "Parties, Receivables & Financing Asks Spec",
                  subtitle: `${deal.parties.length} parties · ${deal.financingAsks.length} financing asks`,
                  payload: {
                    name: deal.name,
                    parties: deal.parties,
                    financingAsks: deal.financingAsks,
                    riskFlags: deal.riskFlags,
                  },
                  fieldsDoc: INVOICE_DEAL_SPEC_FIELDS,
                  onSavePayload: async () => {
                    router.refresh();
                  },
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* TAB 1: DOCUMENTS & EXTRACTION HISTORY */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <TabSectionNav
            sections={[
              {
                id: "section-invoice-documents",
                label: "Uploaded Documents & Taint",
                count: deal.documents.length,
              },
              {
                id: "section-invoice-extractions",
                label: "Upload Dropzone",
              },
              {
                id: "section-invoice-provenance",
                label: "Data Lineage & Traceability",
              },
              ...(deal.researchRuns.length > 0
                ? [
                    {
                      id: "section-invoice-research",
                      label: "Agent Research Runs",
                      count: deal.researchRuns.length,
                    },
                  ]
                : []),
            ]}
          />

          <Card id="section-invoice-documents">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Uploaded Documents ({deal.documents.length})</CardTitle>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Documents classified as <strong>AUDITED_PROOF</strong> automatically override conflicting claims from <strong>UNVERIFIED_CLAIM</strong> decks or teasers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTaintPolicyOpen(true)}
                    className="text-xs gap-1.5"
                  >
                    Configure Taint Policy
                  </Button>
                  <Badge tone="neutral">Extraction Audit</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {deal.documents.length === 0 ? (
                <p className="text-sm text-neutral-500">No documents uploaded.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {deal.documents.map((d) => {
                    const rawObj =
                      d.extractedFieldsRaw && typeof d.extractedFieldsRaw === "object" && !Array.isArray(d.extractedFieldsRaw)
                        ? (d.extractedFieldsRaw as Record<string, unknown>)
                        : null;
                    const docTaint = resolveDocumentTaint(
                      d.documentTypes ?? [],
                      d.taintOverride,
                    );
                    const history = Array.isArray(rawObj?._history)
                      ? (rawObj._history as {
                          runNumber: number;
                          extractedAt: string;
                          extraction: {
                            documentSummary?: string;
                            parties?: { role: string; legalName: string; jurisdiction?: string | null }[];
                            financingAsks?: { structureType: string; amount?: number | null; currency?: string | null }[];
                            riskFlags?: { category: string; severity: number; description: string }[];
                            documentTypes?: string[];
                            openQuestions?: string[];
                          };
                        }[])
                      : rawObj
                        ? [
                            {
                              runNumber: 1,
                              extractedAt: new Date(d.uploadedAt).toISOString(),
                              extraction: rawObj as {
                                documentSummary?: string;
                                parties?: { role: string; legalName: string; jurisdiction?: string | null }[];
                                financingAsks?: { structureType: string; amount?: number | null; currency?: string | null }[];
                                riskFlags?: { category: string; severity: number; description: string }[];
                                documentTypes?: string[];
                                openQuestions?: string[];
                              },
                            },
                          ]
                        : [];

                    return (
                      <li key={d.id} className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{d.fileName}</span>
                            <Badge tone={docTaint === "AUDITED_PROOF" ? "green" : "amber"}>
                              {docTaint}
                            </Badge>
                            {d.documentTypes.map((code: string) => (
                              <Badge key={code} tone="neutral">
                                {code}
                              </Badge>
                            ))}
                            {history.length > 0 ? (
                              <Badge tone="green">
                                {history.length} run{history.length === 1 ? "" : "s"}
                              </Badge>
                            ) : (
                              <Badge tone="amber">Pending</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedDocForExtraction({
                                  id: d.id,
                                  fileName: d.fileName,
                                  documentTypes: d.documentTypes,
                                  extractedRaw: d.extractedFieldsRaw,
                                })
                              }
                              className="h-7 text-[11px] px-2 gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                              title="View or Edit Raw Extracted JSON"
                            >
                              <FileCode className="h-3 w-3 text-blue-600" />
                              View / Edit JSON
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedDocForExtraction({
                                  id: d.id,
                                  fileName: d.fileName,
                                  documentTypes: d.documentTypes,
                                  extractedRaw: d.extractedFieldsRaw,
                                })
                              }
                              className="h-7 text-[11px] px-2 gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                              title="Re-run AI Extraction for this invoice document"
                            >
                              <RefreshCw className="h-3 w-3 text-emerald-600" />
                              Re-run
                            </Button>
                            <a
                              href={`/api/deals/${deal.id}/documents/${d.id}/file`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              title="Open source document file"
                            >
                              <ExternalLink className="h-3 w-3" /> View File
                            </a>
                            <span className="text-xs text-neutral-400">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>

                        {typeof rawObj?.documentSummary === "string" && rawObj.documentSummary && (
                          <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            {rawObj.documentSummary}
                          </p>
                        )}

                        {history.length > 0 && (
                          <details className="mt-2.5">
                            <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                              View extraction history ({history.length} run{history.length === 1 ? "" : "s"})
                            </summary>
                            <div className="mt-2 space-y-2 border-l-2 border-neutral-200 pl-3 text-xs dark:border-neutral-700">
                              {history.map((entry) => (
                                <div key={entry.runNumber} className="space-y-1 rounded bg-neutral-50 p-2 dark:bg-neutral-800/60">
                                  <div className="flex items-center justify-between font-medium">
                                    <span>Run #{entry.runNumber}</span>
                                    <span className="text-neutral-400">
                                      {new Date(entry.extractedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {entry.extraction.documentSummary && (
                                    <p className="text-neutral-600 dark:text-neutral-300">
                                      {entry.extraction.documentSummary}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div id="section-invoice-extractions" className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <UploadDropzone existingDealId={deal.id} />
              </div>
            </CardContent>
          </Card>

          <CardNextSectionCue nextSectionId="section-invoice-provenance" nextSectionLabel="Data Lineage & Traceability Matrix" />

          {/* Full Lineage & Provenance Audit Table */}
          <Card id="section-invoice-provenance">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Data Provenance &amp; Verification Trail</CardTitle>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Every data point entering the deterministic DSL is strictly tracked across 5 causal hops: source evidence, LLM telemetry, merge arbitration, human governance, and downstream funder gates.
                  </p>
                </div>
                <Badge tone="purple">Full Traceability</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataLineageMatrix
                fieldLineage={invoiceLineage}
                onInspectNode={(node) => setSelectedXRayNode(node)}
              />
            </CardContent>
          </Card>

          {/* Research & Agent Runs */}
          {deal.researchRuns.length > 0 && (
            <Card id="section-invoice-research">
              <CardHeader>
                <CardTitle>Extraction &amp; Agent Run Logs ({deal.researchRuns.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {deal.researchRuns.map((r: any) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                            {r.kind.replaceAll("_", " ")}
                          </span>
                          <span className="text-neutral-400">
                            {new Date(r.startedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">
                          {r.outputSummary ?? r.inputSummary ?? "…"}
                        </p>
                      </div>
                      <Badge tone={r.status === "SUCCEEDED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>
                        {r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 dark:border-red-900/50 dark:bg-red-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-red-950 dark:text-red-200">Danger Zone</h3>
                <p className="text-xs text-red-700/80 dark:text-red-400">
                  Permanently delete this deal and all of its uploaded documents, extracted spec, matches, and research history.
                </p>
              </div>
              <DeleteDealButton dealId={deal.id} dealName={deal.name} variant="danger-zone" />
            </div>
          </div>
        </div>
      )}

      {/* Taint Policy Drawer */}
      <TaintPolicyDrawer
        isOpen={isTaintPolicyOpen}
        onClose={() => setIsTaintPolicyOpen(false)}
        assetClass="INVOICE"
        documents={deal.documents}
      />

      {/* Edit Deal Spec Modal */}
      {isEditDealOpen && (
        <EditInvoiceDealModal deal={deal} onClose={() => setIsEditDealOpen(false)} />
      )}

      {/* View / Edit Extraction JSON Modal */}
      {selectedDocForExtraction && (
        <DocumentExtractionModal
          dealId={deal.id}
          document={selectedDocForExtraction}
          dealType="invoice"
          onClose={() => setSelectedDocForExtraction(null)}
        />
      )}

      {/* Agent DSL Modal */}
      {isDslModalOpen && (
        <AgentDslModal
          isOpen={isDslModalOpen}
          agentName="Invoice Credit Extraction & Dilution Engine"
          agentFlow="MAKOTO-INVOICE-V2-PROVENANCE"
          description="Audited debtor credit profile, taint-reconciled dilution risk reserves, recourse terms, and matched invoice discounting facilities."
          dslInput={{
            dealId: deal.id,
            name: deal.name,
            status: deal.status,
            blockingRiskCount: blockingRisks.length,
            parties: deal.parties,
            financingAsks: deal.financingAsks,
            riskFlags: deal.riskFlags,
          }}
          agentOutput={deal.providerMatches}
          onClose={() => setIsDslModalOpen(false)}
          onEditParameters={() => {
            setIsDslModalOpen(false);
            setIsEditDealOpen(true);
          }}
        />
      )}

      {/* Split-Screen Provenance X-Ray Drawer */}
      <ProvenanceXRayDrawer
        isOpen={Boolean(selectedXRayNode)}
        onClose={() => setSelectedXRayNode(null)}
        node={selectedXRayNode}
        dealId={deal.id}
        assetClass="INVOICE"
      />
    </div>
  );
}
