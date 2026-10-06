import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { ResearchControls } from "@/components/research/ResearchControls";
import { CandidateButtons, OnboardingReviewButtons } from "@/components/research/ReviewButtons";

export const dynamic = "force-dynamic";

type Contact = { channel: string; value: string; purpose: string; sourceUrl: string };
type FormField = { label: string; required: boolean | null; step: string | null; note: string | null };
type Doc = { code: string; note: string | null };

const TABS = [
  { key: "onboarding", label: "Contact & application" },
  { key: "candidates", label: "New providers" },
  { key: "log", label: "Run log" },
] as const;

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "onboarding" } = await searchParams;

  const [providerCount, openBatch, pendingOnboarding, pendingCandidates] = await Promise.all([
    db.provider.count(),
    db.researchBatch.findFirst({ where: { finishedAt: null }, orderBy: { createdAt: "desc" } }),
    db.providerOnboarding.count({ where: { status: "PENDING_REVIEW" } }),
    db.providerCandidate.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Provider research</h1>
        <p className="max-w-3xl text-sm text-neutral-500">
          Batch-research how to contact each provider and what its application needs (official sources only), and look for new
          providers — family offices, private credit and platforms — based on your deals&apos; jurisdictions. Results are
          proposals: nothing changes in the provider database until you accept it.
        </p>
      </div>

      <ResearchControls providerCount={providerCount} openBatchId={openBatch?.id ?? null} />

      <nav className="flex gap-1 border-b border-neutral-200 text-sm dark:border-neutral-800">
        {TABS.map((t) => {
          const n = t.key === "onboarding" ? pendingOnboarding : t.key === "candidates" ? pendingCandidates : 0;
          return (
            <Link
              key={t.key}
              href={`/research?tab=${t.key}`}
              className={`-mb-px border-b-2 px-3 py-2 ${tab === t.key ? "border-neutral-900 font-medium dark:border-white" : "border-transparent text-neutral-500"}`}
            >
              {t.label}
              {n > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">{n}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "candidates" ? <Candidates /> : tab === "log" ? <RunLog /> : <Onboarding />}
    </div>
  );
}

async function Onboarding() {
  const rows = await db.providerOnboarding.findMany({
    where: { status: { in: ["PENDING_REVIEW", "ACCEPTED"] } },
    include: { provider: { select: { name: true, applicationUrl: true, contact: true } } },
    orderBy: [{ status: "asc" }, { researchedAt: "desc" }],
  });
  if (rows.length === 0) {
    return <EmptyState title="No onboarding research yet" description="Click “Run research” above to research contact channels and application requirements for every provider." />;
  }
  return (
    <div className="grid gap-3">
      {rows.map((r) => {
        const contacts = r.contacts as Contact[];
        const fields = r.formFields as FormField[];
        const docs = r.documentsToPrepare as Doc[];
        const steps = [...new Set(fields.map((f) => f.step ?? "Form"))];
        return (
          <Card key={r.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{r.provider.name}</p>
                  <p className="text-xs text-neutral-400">Researched {r.researchedAt.toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={r.status === "ACCEPTED" ? "green" : "amber"}>{r.status.replace("_", " ")}</Badge>
                  <Badge>{r.applicationRoute.replaceAll("_", " ")}</Badge>
                  <Badge tone={r.confidence === "VERIFIED_SITE" ? "green" : r.confidence === "VERIFIED_SECONDARY" ? "blue" : "amber"}>
                    {r.confidence.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-neutral-400">Official contacts</p>
                  {contacts.length === 0 && <p className="text-neutral-500">None verified.</p>}
                  {contacts.map((c, i) => (
                    <p key={i}>
                      <span className="text-xs text-neutral-400">{c.channel} · {c.purpose.replace("_", " ").toLowerCase()}</span>{" "}
                      {c.channel === "WEB_FORM" ? <a className="underline" href={c.value} target="_blank" rel="noreferrer">{c.value}</a> : c.value}
                    </p>
                  ))}
                  {r.applicationUrl && (
                    <p>
                      <span className="text-xs text-neutral-400">APPLICATION</span>{" "}
                      <a className="underline" href={r.applicationUrl} target="_blank" rel="noreferrer">{r.applicationUrl}</a>
                      {r.accountRequiredBeforeForm != null && <span className="text-xs text-neutral-500"> · account {r.accountRequiredBeforeForm ? "required first" : "not required first"}</span>}
                    </p>
                  )}
                  {r.typicalTurnaround && <p className="text-neutral-500">Turnaround: {r.typicalTurnaround}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-neutral-400">Steps</p>
                  {r.steps.length === 0 && <p className="text-neutral-500">Not published.</p>}
                  <ol className="list-decimal space-y-0.5 pl-4">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
              </div>

              {(fields.length > 0 || r.formFieldsVisibility !== "FULL") && (
                <div className="text-sm">
                  <p className="text-xs font-semibold uppercase text-neutral-400">
                    Form fields to gather beforehand{" "}
                    <span className="font-normal normal-case">
                      ({r.formFieldsVisibility === "FULL" ? "full form visible" : r.formFieldsVisibility === "PARTIAL" ? "only part of the form was visible" : "form fields not visible publicly"})
                    </span>
                  </p>
                  {steps.map((step) => (
                    <div key={step} className="mt-1">
                      <p className="text-xs text-neutral-500">{step}</p>
                      <ul className="flex flex-wrap gap-1.5 pt-0.5">
                        {fields.filter((f) => (f.step ?? "Form") === step).map((f, i) => (
                          <li key={i} title={f.note ?? undefined} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                            {f.label}{f.required ? " *" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {docs.length > 0 && (
                <p className="text-sm">
                  <span className="text-xs font-semibold uppercase text-neutral-400">Documents to prepare </span>
                  {docs.map((d) => d.code).join(", ")}
                </p>
              )}
              {r.eligibilityChecks.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">Check first: {r.eligibilityChecks.join(" · ")}</p>
              )}
              {r.notes && <p className="whitespace-pre-line text-xs text-neutral-500">{r.notes}</p>}
              {r.sources.length > 0 && (
                <p className="break-all text-xs text-neutral-400">Sources: {r.sources.join(" · ")}</p>
              )}
              {r.status === "PENDING_REVIEW" && <OnboardingReviewButtons id={r.id} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function Candidates() {
  const rows = await db.providerCandidate.findMany({
    where: { status: { not: "REJECTED" } },
    orderBy: [{ status: "asc" }, { discoveredAt: "desc" }],
  });
  if (rows.length === 0) {
    return <EmptyState title="No new providers found yet" description="Run research with “Also look for new providers” ticked. Discovery uses the jurisdictions, currencies and structures in your deals." />;
  }
  return (
    <div className="grid gap-3">
      {rows.map((c) => (
        <Card key={c.id}>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {c.name}{" "}
                {c.websiteUrl && <a href={c.websiteUrl} target="_blank" rel="noreferrer" className="text-xs font-normal text-neutral-500 underline">{c.domain}</a>}
              </p>
              <div className="flex gap-1.5">
                <Badge>{c.suggestedType.replaceAll("_", " ")}</Badge>
                {c.status === "PROMOTED" && <Badge tone="green">In provider database</Badge>}
              </div>
            </div>
            <p className="text-sm">{c.description}</p>
            <p className="text-sm text-neutral-500">Why surfaced: {c.whySurfaced}</p>
            {c.jurisdictionsHint.length > 0 && <p className="text-xs text-neutral-400">Jurisdictions: {c.jurisdictionsHint.join(", ")}</p>}
            <p className="break-all text-xs text-neutral-400">Sources: {c.sources.join(" · ")}</p>
            {c.status === "PENDING_REVIEW" && <CandidateButtons id={c.id} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RunLog() {
  const batches = await db.researchBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { tasks: { orderBy: { createdAt: "asc" } } },
  });
  if (batches.length === 0) return <EmptyState title="No batches yet" />;
  return (
    <div className="grid gap-3">
      {batches.map((b) => {
        const failed = b.tasks.filter((t) => t.status === "FAILED");
        const done = b.tasks.filter((t) => t.status === "DONE").length;
        return (
          <Card key={b.id}>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{b.label}</p>
                <div className="flex gap-1.5">
                  <Badge>{b.triggeredBy}</Badge>
                  <Badge tone={b.finishedAt ? "green" : "amber"}>{b.finishedAt ? "finished" : "unfinished"}</Badge>
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Started {b.createdAt.toLocaleString()} · {done}/{b.tasks.length} done · {failed.length} failed
              </p>
              {failed.map((t) => (
                <p key={t.id} className="text-xs text-red-600">{t.subject}: {t.error}</p>
              ))}
              <details className="text-xs text-neutral-500">
                <summary className="cursor-pointer">Tasks</summary>
                <ul className="mt-1 space-y-0.5">
                  {b.tasks.map((t) => (
                    <li key={t.id}>{t.kind} · {t.subject} · {t.status}{t.resultSummary ? ` — ${t.resultSummary}` : ""}</li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
