import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Check, X, TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from "@/components/ui/primitives";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DealStatusPoller } from "@/components/DealStatusPoller";
import { DealActions } from "@/components/DealActions";
import { matchProvider, buildMatchInputs, type CriterionStatus } from "@/lib/matching";
import { computeDocumentCoverage } from "@/lib/document-coverage";

export const dynamic = "force-dynamic";

const RISK_SEVERITY_TONE = (severity: number): "red" | "amber" | "neutral" =>
  severity >= 4 ? "red" : severity >= 3 ? "amber" : "neutral";

const VERDICT_TONE = { GOOD: "green", POSSIBLE: "blue", POOR: "amber", EXCLUDED: "neutral" } as const;

const CRITERION_ICON: Record<CriterionStatus, ReactNode> = {
  pass: <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="pass" />,
  fail: <X className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="fail" />,
  warning: <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-label="warning" />,
};

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      parties: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      providerMatches: { include: { provider: { include: { documentsRequired: true } } } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 1 },
      researchRuns: { orderBy: { startedAt: "desc" } },
    },
  });
  if (!deal) notFound();

  const latestTermSheet = deal.termSheets[0];
  const matchesByVerdict = {
    GOOD: deal.providerMatches.filter((m) => m.verdict === "GOOD"),
    POSSIBLE: deal.providerMatches.filter((m) => m.verdict === "POSSIBLE"),
    POOR: deal.providerMatches.filter((m) => m.verdict === "POOR"),
    EXCLUDED: deal.providerMatches.filter((m) => m.verdict === "EXCLUDED"),
  };

  // Same inputs match/route.ts used when it last persisted these rows —
  // recomputed live here so the criteria table always reflects the deal's
  // and provider's CURRENT data, not a stale snapshot from whenever "Run
  // matching" last ran.
  const { dealInput: dealMatchInput, askInput: askMatchInput } = buildMatchInputs(deal.parties, deal.financingAsks);

  return (
    <div className="space-y-6">
      <DealStatusPoller dealId={deal.id} status={deal.status} />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{deal.name}</h1>
            <DealStatusBadge status={deal.status} />
          </div>
          <p className="text-sm text-neutral-500">
            {deal.documents.length} document{deal.documents.length === 1 ? "" : "s"} uploaded
          </p>
        </div>
        <DealActions dealId={deal.id} status={deal.status} hasMatches={deal.providerMatches.length > 0} />
      </div>

      {deal.reviewerNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Open questions from extraction</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
            {deal.reviewerNotes}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.documents.length === 0 ? (
            <p className="text-sm text-neutral-500">No documents uploaded.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {deal.documents.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>{d.fileName}</span>
                  <span className="text-neutral-400">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deal spec — parties</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.parties.length === 0 ? (
            <p className="text-sm text-neutral-500">No parties extracted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium">Legal name</th>
                    <th className="pb-2 pr-4 font-medium">Jurisdiction</th>
                    <th className="pb-2 pr-4 font-medium">Rating</th>
                    <th className="pb-2 font-medium">Chain-of-title</th>
                  </tr>
                </thead>
                <tbody>
                  {deal.parties.map((p) => (
                    <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 pr-4">
                        <Badge tone={p.role === "INTERMEDIARY" ? "amber" : "neutral"}>{p.role}</Badge>
                      </td>
                      <td className="py-2 pr-4">{p.legalName}</td>
                      <td className="py-2 pr-4">{p.jurisdiction ?? "—"}</td>
                      <td className="py-2 pr-4">{p.publicRating ?? "—"}</td>
                      <td className="py-2">
                        {p.role === "INTERMEDIARY" ? (
                          p.primaryRightHolderVerified ? (
                            <Badge tone="green">Verified: {p.primaryRightHolderName}</Badge>
                          ) : (
                            <Badge tone="red">
                              Unverified — sources from {p.primaryRightHolderName ?? "unknown primary right-holder"}
                            </Badge>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financing ask</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.financingAsks.length === 0 ? (
            <p className="text-sm text-neutral-500">No financing ask extracted yet.</p>
          ) : (
            <div className="space-y-3">
              {deal.financingAsks.map((ask) => (
                <div key={ask.id} className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{ask.structureType.replaceAll("_", " ")}</Badge>
                    {ask.recurring && <Badge tone="neutral">recurring</Badge>}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
                    <div>
                      <dt className="text-neutral-500">Amount</dt>
                      <dd>{ask.amount ? `${ask.amount.toLocaleString()} ${ask.currency ?? ""}` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Advance rate</dt>
                      <dd>{ask.advanceRatePct != null ? `${ask.advanceRatePct}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Tenor</dt>
                      <dd>
                        {ask.tenorDaysMin ?? "?"}-{ask.tenorDaysMax ?? "?"} days
                        {ask.tenorNote && <span className="text-amber-600"> (provisional)</span>}
                      </dd>
                    </div>
                  </dl>
                  {ask.tenorNote && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{ask.tenorNote}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk flags</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.riskFlags.length === 0 ? (
            <p className="text-sm text-neutral-500">None flagged.</p>
          ) : (
            <ul className="space-y-2">
              {deal.riskFlags.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <Badge tone={RISK_SEVERITY_TONE(r.severity)}>{r.category.replaceAll("_", " ")}</Badge>
                  <span>{r.description}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider matches</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.providerMatches.length === 0 ? (
            <EmptyState
              title="No matches yet"
              description='Once the deal spec looks right, click "Run matching" above.'
            />
          ) : (
            <div className="space-y-4">
              {(["GOOD", "POSSIBLE", "POOR", "EXCLUDED"] as const).map((verdict) =>
                matchesByVerdict[verdict].length === 0 ? null : (
                  <div key={verdict}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {verdict} ({matchesByVerdict[verdict].length})
                    </h4>
                    <ul className="space-y-2">
                      {matchesByVerdict[verdict].map((m) => {
                        const criteria = matchProvider(m.provider, dealMatchInput, askMatchInput).criteria;
                        const docCoverage = computeDocumentCoverage(m.provider.documentsRequired, deal.documents);
                        const missingDocCount = docCoverage.filter((d) => !d.satisfied).length;
                        return (
                          <li key={m.id} className="rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{m.provider.name}</span>
                              <Badge tone={VERDICT_TONE[m.verdict]}>{m.verdict}</Badge>
                            </div>
                            <p className="mt-1 text-neutral-500">{m.rationale}</p>
                            {m.provider.applicationUrl && (
                              <a
                                href={m.provider.applicationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                              >
                                {m.provider.applicationUrl}
                              </a>
                            )}

                            <details className="mt-2 group">
                              <summary className="cursor-pointer text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                                Match criteria &amp; documents
                                {missingDocCount > 0 && (
                                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                                    ({missingDocCount} document{missingDocCount === 1 ? "" : "s"} still needed)
                                  </span>
                                )}
                              </summary>

                              <div className="mt-2 overflow-x-auto">
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
                                        <td className="py-1.5 pr-4 whitespace-nowrap">{c.label}</td>
                                        <td className="py-1.5 text-neutral-600 dark:text-neutral-400">{c.detail}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {docCoverage.length > 0 && (
                                <div className="mt-3 overflow-x-auto">
                                  <p className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                    Documents required
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

      {latestTermSheet && (
        <Card>
          <CardHeader>
            <CardTitle>Lender benchmark & term sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-neutral-700 dark:text-neutral-300">{latestTermSheet.leverageAssessment}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <dt className="text-neutral-500">Proposed rate</dt>
                <dd className="font-medium">
                  {latestTermSheet.proposedRatePct != null ? `${latestTermSheet.proposedRatePct}% p.a.` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Advance rate</dt>
                <dd className="font-medium">
                  {latestTermSheet.advanceRatePct != null ? `${latestTermSheet.advanceRatePct}%` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Tenor</dt>
                <dd className="font-medium">
                  {latestTermSheet.tenorDaysMin ?? "?"}-{latestTermSheet.tenorDaysMax ?? "?"} days
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Currency</dt>
                <dd className="font-medium">{latestTermSheet.currency ?? "—"}</dd>
              </div>
            </dl>
            <div>
              <p className="font-medium">Rate rationale</p>
              <p className="text-neutral-600 dark:text-neutral-400">{latestTermSheet.rateRationale}</p>
            </div>
            <div>
              <p className="font-medium">Security & conditions precedent</p>
              <p className="text-neutral-600 dark:text-neutral-400">{latestTermSheet.securityTerms}</p>
              <p className="text-neutral-600 dark:text-neutral-400">{latestTermSheet.conditionsPrecedent}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {deal.researchRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent run log</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {deal.researchRuns.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>
                    {r.kind.replaceAll("_", " ")} — {r.outputSummary ?? r.inputSummary ?? "…"}
                  </span>
                  <Badge tone={r.status === "SUCCEEDED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
