"use client";

import { useState, type ReactNode } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DeleteDealButton } from "@/components/DeleteDealButton";
import { EditInvoiceDealModal } from "@/components/EditInvoiceDealModal";
import { DocumentExtractionModal } from "@/components/DocumentExtractionModal";
import {
  computePartyProvenance,
  computeFinancingAskProvenance,
  computeRiskFlagProvenance,
  computeOpenQuestionProvenance,
} from "@/lib/deal-provenance";
import { matchProvider, buildMatchInputs, type CriterionStatus } from "@/lib/matching";
import { computeDocumentCoverage } from "@/lib/document-coverage";

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
  const [activeTab, setActiveTab] = useState<"termsheet" | "matches" | "spec" | "documents">(
    deal.termSheets.length > 0 ? "termsheet" : deal.providerMatches.length > 0 ? "matches" : "spec",
  );
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [selectedDocForExtraction, setSelectedDocForExtraction] = useState<{
    id: string;
    fileName: string;
    documentTypes: string[];
    extractedRaw: any;
  } | null>(null);

  const latestTermSheet = deal.termSheets[0];
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
    { id: "docs", label: "1. Upload Documents", completed: deal.documents.length > 0, count: deal.documents.length },
    { id: "spec", label: "2. Extracted Spec & Risk", completed: deal.parties.length > 0 || deal.financingAsks.length > 0 },
    { id: "matches", label: "3. Provider Matches", completed: deal.providerMatches.length > 0, count: deal.providerMatches.length },
    { id: "termsheet", label: "4. Lender Term Sheet", completed: deal.termSheets.length > 0 },
  ];

  return (
    <div className="space-y-6">
      {/* 4-Stage Stepper Header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Invoice Workflow Pipeline
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {steps.map((st) => (
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

      {/* Navigation Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab("termsheet")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "termsheet"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <Calculator className="h-4 w-4" />
            Lender Term Sheet
            {latestTermSheet && <Badge tone="green" className="ml-1 text-[10px]">Active</Badge>}
          </button>

          <button
            onClick={() => setActiveTab("matches")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "matches"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <Search className="h-4 w-4" />
            Provider Matches
            {deal.providerMatches.length > 0 && <Badge tone="blue" className="ml-1 text-[10px]">{deal.providerMatches.length}</Badge>}
          </button>

          <button
            onClick={() => setActiveTab("spec")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "spec"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Extracted Deal Spec &amp; Risks
            {deal.parties.length > 0 && <Badge tone="neutral" className="ml-1 text-[10px]">{deal.parties.length} Parties</Badge>}
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-sm font-medium transition-colors ${
              activeTab === "documents"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents &amp; History
            <Badge tone="neutral" className="ml-1 text-[10px]">{deal.documents.length}</Badge>
          </button>
        </nav>
      </div>

      {/* TAB 1: TERM SHEET */}
      {activeTab === "termsheet" && (
        <div className="space-y-6">
          {latestTermSheet ? (
            <Card>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Capital Provider Matches</CardTitle>
                <Badge tone="blue">{deal.providerMatches.length} Matches</Badge>
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
                            return (
                              <li key={m.id} className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800 hover:shadow-2xs transition-shadow">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                                    {m.provider.name}
                                  </span>
                                  <Badge tone={VERDICT_TONE[m.verdict as keyof typeof VERDICT_TONE] ?? "neutral"}>
                                    {m.verdict}
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

                                <details className="mt-3 group border-t border-neutral-100 pt-2 dark:border-neutral-800">
                                  <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                                    View match criteria &amp; document checklist
                                    {missingDocCount > 0 && (
                                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                                        ({missingDocCount} document{missingDocCount === 1 ? "" : "s"} needed)
                                      </span>
                                    )}
                                  </summary>

                                  <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="text-neutral-500">
                                        <tr>
                                          <th className="w-6 pb-1 pr-2 font-medium"></th>
                                          <th className="pb-1 pr-4 font-medium">Criterion</th>
                                          <th className="pb-1 font-medium">Detail</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {criteria.map((c) => (
                                          <tr key={c.key} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                                            <td className="py-1.5 pr-2">{CRITERION_ICON[c.status]}</td>
                                            <td className="py-1.5 pr-4 whitespace-nowrap font-medium">{c.label}</td>
                                            <td className="py-1.5 text-neutral-600 dark:text-neutral-400">{c.detail}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {docCoverage.length > 0 && (
                                    <div className="mt-3 overflow-x-auto">
                                      <p className="mb-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                        Documents required for this provider:
                                      </p>
                                      <table className="w-full text-left text-xs">
                                        <thead className="text-neutral-500">
                                          <tr>
                                            <th className="w-6 pb-1 pr-2 font-medium"></th>
                                            <th className="pb-1 pr-4 font-medium">Code</th>
                                            <th className="pb-1 pr-4 font-medium">Note</th>
                                            <th className="pb-1 font-medium">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {docCoverage.map((d) => (
                                            <tr key={d.code} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                                              <td className="py-1.5 pr-2">
                                                {d.satisfied ? CRITERION_ICON.pass : CRITERION_ICON.fail}
                                              </td>
                                              <td className="py-1.5 pr-4 whitespace-nowrap font-mono text-[11px]">{d.code}</td>
                                              <td className="py-1.5 pr-4 text-neutral-600 dark:text-neutral-400">{d.note ?? "—"}</td>
                                              <td className="py-1.5 text-neutral-600 dark:text-neutral-400">
                                                {d.satisfied
                                                  ? `Present: ${d.matchingFileNames.join(", ")}`
                                                  : "Still needs to be added"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </details>
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
          <Card>
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
            <CardContent>
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
                      {deal.parties.map((p) => {
                        const prov = computePartyProvenance(p, deal.documents);
                        return (
                          <tr key={p.id} className="align-top">
                            <td className="py-2.5 pr-4">
                              <Badge tone={p.role === "INTERMEDIARY" ? "amber" : "neutral"}>{p.role}</Badge>
                            </td>
                            <td className="py-2.5 pr-4 font-semibold text-neutral-900 dark:text-neutral-100">{p.legalName}</td>
                            <td className="py-2.5 pr-4">{p.jurisdiction ?? "—"}</td>
                            <td className="py-2.5 pr-4">{p.publicRating ?? "—"}</td>
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
                                  {prov.documents.map((docName) => (
                                    <span
                                      key={docName}
                                      className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                    >
                                      {docName}
                                    </span>
                                  ))}
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
            </CardContent>
          </Card>

          {/* Financing Asks */}
          <Card>
            <CardHeader>
              <CardTitle>Financing Asks</CardTitle>
            </CardHeader>
            <CardContent>
              {deal.financingAsks.length === 0 ? (
                <p className="text-sm text-neutral-500">No financing ask extracted yet.</p>
              ) : (
                <div className="space-y-3">
                  {deal.financingAsks.map((ask) => {
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
                              {prov.documents.map((docName) => (
                                <span
                                  key={docName}
                                  className="rounded bg-neutral-200/70 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                                >
                                  {docName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <dt className="text-xs text-neutral-500">Amount</dt>
                            <dd className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {ask.amount ? `${ask.amount.toLocaleString()} ${ask.currency ?? ""}` : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-neutral-500">Advance Rate</dt>
                            <dd className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {ask.advanceRatePct != null ? `${ask.advanceRatePct}%` : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-neutral-500">Tenor</dt>
                            <dd className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {ask.tenorDaysMin ?? "?"}-{ask.tenorDaysMax ?? "?"} days
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
            </CardContent>
          </Card>

          {/* Risk Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Extracted Risk Flags</CardTitle>
            </CardHeader>
            <CardContent>
              {deal.riskFlags.length === 0 ? (
                <p className="text-sm text-neutral-500">None flagged.</p>
              ) : (
                <ul className="space-y-2">
                  {deal.riskFlags.map((r) => {
                    const sources = computeRiskFlagProvenance(r, deal.documents);
                    return (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 pb-2 text-xs last:border-b-0 last:pb-0 dark:border-neutral-800">
                        <div className="flex items-start gap-2">
                          <Badge tone={RISK_SEVERITY_TONE(r.severity)}>{r.category.replaceAll("_", " ")}</Badge>
                          <span className="text-neutral-700 dark:text-neutral-300">{r.description}</span>
                        </div>
                        {sources.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sources.map((docName) => (
                              <span
                                key={docName}
                                className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
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
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: DOCUMENTS & EXTRACTION HISTORY */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Uploaded Documents ({deal.documents.length})</CardTitle>
                <Badge tone="neutral">Extraction Audit</Badge>
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
                              extractedAt: d.uploadedAt.toISOString(),
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

              <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <UploadDropzone existingDealId={deal.id} />
              </div>
            </CardContent>
          </Card>

          {/* Research & Agent Runs */}
          {deal.researchRuns.length > 0 && (
            <Card>
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
    </div>
  );
}
