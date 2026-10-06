/**
 * Batch research engine. A batch is a set of ResearchTasks; `stepBatch` claims
 * ONE task and performs ONE model call (a web-search step or a structuring
 * step) so every request fits Vercel Hobby's 60s function cap. The browser
 * (ResearchControls) or the cron route calls it repeatedly until the batch is
 * drained. Safe to call concurrently and to retry: tasks are claimed with an
 * atomic lock that goes stale after 90s.
 *
 * Nothing here overwrites existing Provider data -- onboarding results and
 * discovered candidates are stored as proposals for a human to review.
 */
import type { ResearchTask } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { normalizeName, hostOf, registrableDomain } from "@/lib/domains";
import { searchOnboarding, structureOnboarding, type OnboardingSubject } from "@/agents/onboarding-agent";
import {
  searchDiscovery,
  structureDiscovery,
  type DiscoveryCategory,
  type DiscoveryContext,
} from "@/agents/discovery-agent";
import { researchProviderFindings, structureProviderFindings } from "@/agents/research-agent";
import { PROFILE_MODEL } from "@/lib/openrouter";

const LOCK_TTL_MS = 90_000;
const MAX_ATTEMPTS = 3;
const STALE_AFTER_DAYS = 30;
const CATEGORIES: DiscoveryCategory[] = ["FAMILY_OFFICE", "PRIVATE_CREDIT", "PLATFORM"];

// --- settings ---------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  return (await db.appSetting.findUnique({ where: { key } }))?.value ?? null;
}
export async function setSetting(key: string, value: string) {
  await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// --- batch creation -----------------------------------------------------------

/** Jurisdictions/currencies/structures across the org's deals. No names or amounts, ever. */
export async function buildDiscoveryContext(): Promise<DiscoveryContext> {
  const orgId = await getCurrentOrgId();
  const [parties, asks] = await Promise.all([
    db.party.findMany({ where: { deal: { orgId }, role: { in: ["BORROWER", "OBLIGOR"] } }, select: { role: true, jurisdiction: true } }),
    db.financingAsk.findMany({ where: { deal: { orgId } }, select: { currency: true, structureType: true } }),
  ]);
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  return {
    sellerJurisdictions: uniq(parties.filter((p) => p.role === "BORROWER").map((p) => p.jurisdiction)),
    obligorJurisdictions: uniq(parties.filter((p) => p.role === "OBLIGOR").map((p) => p.jurisdiction)),
    currencies: uniq(asks.map((a) => a.currency)),
    structureTypes: uniq(asks.map((a) => (a.structureType === "UNKNOWN" ? null : a.structureType))),
  };
}

export interface CreateBatchOptions {
  triggeredBy: "user" | "cron";
  mode: "all" | "stale" | "selected";
  providerIds?: string[];
  includeDiscovery: boolean;
}

/** Returns null when there is nothing to do (e.g. every provider was researched recently). */
export async function createBatch(opts: CreateBatchOptions) {
  let providers = await db.provider.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (opts.mode === "selected") {
    const ids = new Set(opts.providerIds ?? []);
    providers = providers.filter((p) => ids.has(p.id));
  } else if (opts.mode === "stale") {
    const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000);
    const fresh = await db.providerOnboarding.findMany({
      where: { researchedAt: { gte: cutoff }, status: { not: "REJECTED" } },
      select: { providerId: true },
    });
    const freshIds = new Set(fresh.map((f) => f.providerId));
    providers = providers.filter((p) => !freshIds.has(p.id));
  }

  let discoveryTasks: { category: DiscoveryCategory; context: DiscoveryContext }[] = [];
  if (opts.includeDiscovery) {
    const context = await buildDiscoveryContext();
    discoveryTasks = CATEGORIES.map((category) => ({ category, context }));
  }
  if (providers.length === 0 && discoveryTasks.length === 0) return null;

  const batch = await db.researchBatch.create({
    data: {
      label: `${opts.mode === "all" ? "All providers" : opts.mode === "stale" ? "Stale/missing providers" : "Selected providers"}${opts.includeDiscovery ? " + discovery" : ""}`,
      triggeredBy: opts.triggeredBy,
    },
  });
  await db.researchTask.createMany({
    data: [
      ...providers.map((p) => ({ batchId: batch.id, kind: "ONBOARDING" as const, providerId: p.id, subject: p.name })),
      ...discoveryTasks.map((d) => ({
        batchId: batch.id,
        kind: "DISCOVERY" as const,
        subject: d.category,
        payload: JSON.parse(JSON.stringify({ category: d.category, context: d.context })),
      })),
    ],
  });
  return { batchId: batch.id, taskCount: providers.length + discoveryTasks.length };
}

export async function createProfileBatch(candidateId: string) {
  const candidate = await db.providerCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return null;
  const batch = await db.researchBatch.create({ data: { label: `Profile ${candidate.name}`, triggeredBy: "user" } });
  await db.researchTask.create({
    data: { batchId: batch.id, kind: "PROFILE", candidateId, subject: candidate.name },
  });
  return { batchId: batch.id, taskCount: 1 };
}

// --- progress -----------------------------------------------------------------

export async function batchProgress(batchId: string) {
  const grouped = await db.researchTask.groupBy({ by: ["status"], where: { batchId }, _count: true });
  const counts = { queued: 0, searched: 0, done: 0, failed: 0 };
  for (const g of grouped) counts[g.status.toLowerCase() as keyof typeof counts] = g._count;
  return { ...counts, total: counts.queued + counts.searched + counts.done + counts.failed, done_: counts.queued + counts.searched === 0 };
}

// --- stepping -----------------------------------------------------------------

async function claimNext(batchId: string): Promise<ResearchTask | null> {
  const staleBefore = new Date(Date.now() - LOCK_TTL_MS);
  const unlocked = { OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }] };
  const candidates = await db.researchTask.findMany({
    where: { batchId, status: { in: ["QUEUED", "SEARCHED"] }, ...unlocked },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    take: 5,
  });
  for (const c of candidates) {
    const claimed = await db.researchTask.updateMany({
      where: { id: c.id, status: c.status, ...unlocked },
      data: { lockedAt: new Date() },
    });
    if (claimed.count === 1) return { ...c, lockedAt: new Date() };
  }
  return null;
}

export interface StepResult {
  ran: { kind: string; subject: string; outcome: "searched" | "done" | "retry" | "failed"; detail?: string } | null;
  progress: Awaited<ReturnType<typeof batchProgress>>;
}

export async function stepBatch(batchId: string): Promise<StepResult> {
  const task = await claimNext(batchId);
  if (!task) {
    const progress = await batchProgress(batchId);
    if (progress.done_) await db.researchBatch.updateMany({ where: { id: batchId, finishedAt: null }, data: { finishedAt: new Date() } });
    return { ran: null, progress };
  }

  let ran: NonNullable<StepResult["ran"]>;
  try {
    const out = await runTask(task);
    await db.researchTask.update({ where: { id: task.id }, data: { ...out.update, lockedAt: null, attempts: 0, error: null } });
    ran = { kind: task.kind, subject: task.subject, outcome: out.update.status === "DONE" ? "done" : "searched", detail: out.update.resultSummary ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = task.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    await db.researchTask.update({
      where: { id: task.id },
      data: { lockedAt: null, attempts, error: message.slice(0, 2000), ...(failed ? { status: "FAILED" as const } : {}) },
    });
    ran = { kind: task.kind, subject: task.subject, outcome: failed ? "failed" : "retry", detail: message.slice(0, 300) };
  }

  const progress = await batchProgress(batchId);
  if (progress.done_) await db.researchBatch.updateMany({ where: { id: batchId, finishedAt: null }, data: { finishedAt: new Date() } });
  return { ran, progress };
}

type TaskUpdate = { status: "SEARCHED" | "DONE"; findings?: string; citedUrls?: string[]; resultSummary?: string };

async function runTask(task: ResearchTask): Promise<{ update: TaskUpdate }> {
  if (task.kind === "ONBOARDING") return runOnboarding(task);
  if (task.kind === "DISCOVERY") return runDiscovery(task);
  return runProfile(task);
}

async function runOnboarding(task: ResearchTask): Promise<{ update: TaskUpdate }> {
  const provider = await db.provider.findUnique({ where: { id: task.providerId ?? "" } });
  if (!provider) throw new Error(`Provider ${task.providerId} no longer exists.`);
  const subject: OnboardingSubject = {
    name: provider.name,
    type: provider.type,
    product: provider.product,
    applicationUrl: provider.applicationUrl,
    sources: provider.sources,
  };

  if (task.status === "QUEUED") {
    const { findings, citedUrls } = await searchOnboarding(subject);
    return { update: { status: "SEARCHED", findings, citedUrls } };
  }
  const dto = await structureOnboarding(subject, { findings: task.findings ?? "", citedUrls: task.citedUrls });
  await db.$transaction([
    db.providerOnboarding.updateMany({
      where: { providerId: provider.id, status: "PENDING_REVIEW" },
      data: { status: "SUPERSEDED" },
    }),
    db.providerOnboarding.create({
      data: {
        providerId: provider.id,
        taskId: task.id,
        applicationRoute: dto.applicationRoute,
        applicationUrl: dto.applicationUrl,
        accountRequiredBeforeForm: dto.accountRequiredBeforeForm,
        formFieldsVisibility: dto.formFieldsVisibility,
        contacts: dto.contacts,
        formFields: dto.formFields,
        documentsToPrepare: dto.documentsToPrepare,
        steps: dto.steps,
        eligibilityChecks: dto.eligibilityChecks,
        typicalTurnaround: dto.typicalTurnaround,
        confidence: dto.confidence,
        sources: dto.sources,
        notes: dto.notes,
      },
    }),
  ]);
  return {
    update: {
      status: "DONE",
      resultSummary: `${dto.applicationRoute}; ${dto.contacts.length} contact(s); ${dto.formFields.length} form field(s)`,
    },
  };
}

async function runDiscovery(task: ResearchTask): Promise<{ update: TaskUpdate }> {
  const payload = task.payload as { category: DiscoveryCategory; context: DiscoveryContext } | null;
  if (!payload) throw new Error("Discovery task has no payload.");

  const [providers, candidates] = await Promise.all([
    db.provider.findMany({ select: { name: true, applicationUrl: true, sources: true } }),
    db.providerCandidate.findMany({ select: { name: true, domain: true } }),
  ]);

  if (task.status === "QUEUED") {
    const known = [...providers.map((p) => p.name), ...candidates.map((c) => c.name)];
    const { findings, citedUrls } = await searchDiscovery(payload.category, payload.context, known);
    return { update: { status: "SEARCHED", findings, citedUrls } };
  }

  const knownNames = new Set([...providers.map((p) => normalizeName(p.name)), ...candidates.map((c) => normalizeName(c.name))]);
  const knownDomains = new Set(
    [
      ...providers.flatMap((p) => [p.applicationUrl, ...p.sources]).map((u) => (u ? registrableDomain(hostOf(u)) : "")),
      ...candidates.map((c) => c.domain ?? ""),
    ].filter(Boolean),
  );
  const found = await structureDiscovery(
    payload.category,
    { findings: task.findings ?? "", citedUrls: task.citedUrls },
    { names: knownNames, domains: knownDomains, providerNames: providers.map((p) => p.name) },
  );
  const created = await db.providerCandidate.createMany({
    skipDuplicates: true,
    data: found.map((c) => ({
      name: c.name,
      normalizedName: normalizeName(c.name),
      websiteUrl: c.websiteUrl,
      domain: registrableDomain(hostOf(c.websiteUrl)),
      suggestedType: c.suggestedType,
      description: c.description,
      whySurfaced: c.whySurfaced,
      jurisdictionsHint: c.jurisdictionsHint,
      sources: c.sources,
      taskId: task.id,
    })),
  });
  return { update: { status: "DONE", resultSummary: `${created.count} new candidate(s) from ${found.length} verified` } };
}

async function runProfile(task: ResearchTask): Promise<{ update: TaskUpdate }> {
  const candidate = await db.providerCandidate.findUnique({ where: { id: task.candidateId ?? "" } });
  if (!candidate) throw new Error("Candidate no longer exists.");
  const hint = `${candidate.name}${candidate.websiteUrl ? ` (${candidate.websiteUrl})` : ""}`;

  if (task.status === "QUEUED") {
    const { findings, citedUrls } = await researchProviderFindings(
      hint,
      "A newly discovered provider being added to the shared database. Research it as a provider-level record only.",
      { model: PROFILE_MODEL, signal: AbortSignal.timeout(52_000) },
    );
    return { update: { status: "SEARCHED", findings, citedUrls } };
  }

  const provider = await structureProviderFindings(
    hint,
    { findings: task.findings ?? "", citedUrls: task.citedUrls },
    { model: PROFILE_MODEL, signal: AbortSignal.timeout(52_000) },
  );
  const existing = await db.provider.findUnique({ where: { id: provider.id } });
  if (!existing) {
    await db.provider.create({
      data: {
        ...provider,
        lastVerified: provider.lastVerified ? new Date(provider.lastVerified) : null,
        documentsRequired: { create: provider.documentsRequired },
      },
    });
  }
  await db.providerCandidate.update({ where: { id: candidate.id }, data: { status: "PROMOTED", promotedProviderId: provider.id } });
  // Chain straight into onboarding research for the new provider, in the same batch.
  await db.researchTask.create({
    data: { batchId: task.batchId, kind: "ONBOARDING", providerId: provider.id, subject: provider.name },
  });
  return {
    update: {
      status: "DONE",
      resultSummary: existing ? `Provider ${provider.id} already existed; linked, not overwritten` : `Created provider ${provider.id}`,
    },
  };
}
