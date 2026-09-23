import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildMatchInputs } from "@/lib/matching";
import { researchProviderFindings, structureProviderFindings } from "@/agents/research-agent";

/**
 * One step of "research a new provider because matching found none", per
 * request. Both steps are real model latency (a web-search-augmented
 * generation, then a large structured-output generation) and together can
 * exceed Vercel Hobby's 60s hard function cap, so the caller
 * (DealActions.runMatch) drives them one request at a time:
 *
 *   { step: "search" }    -> creates the ResearchRun, runs the web-search
 *                            call, returns { runId, hint, findings, citedUrls }
 *   { step: "structure", runId, hint, findings, citedUrls }
 *                         -> structures the findings, upserts the Provider,
 *                            marks the run SUCCEEDED
 *
 * Either step marks the ResearchRun NEEDS_HUMAN_INPUT and returns a 500 with
 * the real error if it fails, so a failed attempt is visible in the agent
 * run log rather than silent. Findings pass through the client between the
 * two steps (rather than being stored server-side) purely to avoid a schema
 * migration for a temporary scratch value; they only ever feed a prompt for
 * a provider record the same signed-in user is already allowed to add.
 */
export const maxDuration = 60;

const BodySchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("search") }),
  z.object({
    step: z.literal("structure"),
    runId: z.string(),
    hint: z.string(),
    findings: z.string().min(1),
    citedUrls: z.array(z.string()).default([]),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "body must be { step: 'search' } or { step: 'structure', ... }" }, { status: 400 });
  }
  const body = parsed.data;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { parties: true, financingAsks: true },
  });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  if (body.step === "search") {
    const { dealInput, askInput, currency } = buildMatchInputs(deal.parties, deal.financingAsks);
    const hint =
      `A capital provider for a ${askInput.structureType} deal, ` +
      `borrower jurisdiction ${dealInput.borrowerJurisdiction ?? "unknown"}, ` +
      `obligor jurisdiction ${dealInput.obligorJurisdiction ?? "unknown"}, ` +
      `ticket size ~${askInput.amount ?? "unknown"} ${currency ?? ""}`;
    const context = `Deal "${deal.name}" — the current provider database has zero eligible providers for it.`;

    await db.deal.update({ where: { id: dealId }, data: { status: "RESEARCHING" } });
    const run = await db.researchRun.create({
      data: {
        dealId,
        kind: "PROVIDER_RESEARCH_NEW",
        triggeredBy: "system:zero_eligible_providers",
        inputSummary: `${hint}\n\n${context}`,
      },
    });

    try {
      const { findings, citedUrls } = await researchProviderFindings(hint, context);
      return NextResponse.json({ runId: run.id, hint, findings, citedUrls });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.researchRun.update({
        where: { id: run.id },
        data: { status: "NEEDS_HUMAN_INPUT", outputSummary: `Research search failed: ${message}`, finishedAt: new Date() },
      });
      return NextResponse.json({ error: `Provider research (search step) failed: ${message}` }, { status: 500 });
    }
  }

  const run = await db.researchRun.findUnique({ where: { id: body.runId } });
  if (!run || run.dealId !== dealId || run.kind !== "PROVIDER_RESEARCH_NEW") {
    return NextResponse.json({ error: "research run not found on this deal" }, { status: 404 });
  }

  try {
    const provider = await structureProviderFindings(body.hint, {
      findings: body.findings,
      citedUrls: body.citedUrls,
    });
    const lastVerified = provider.lastVerified ? new Date(provider.lastVerified) : null;
    await db.provider.upsert({
      where: { id: provider.id },
      create: { ...provider, lastVerified, documentsRequired: { create: provider.documentsRequired } },
      update: {
        ...provider,
        lastVerified,
        documentsRequired: { deleteMany: {}, create: provider.documentsRequired },
      },
    });
    await db.researchRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        outputSummary: `Added/updated provider "${provider.name}" (${provider.id}).`,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ providerId: provider.id, providerName: provider.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.researchRun.update({
      where: { id: run.id },
      data: { status: "NEEDS_HUMAN_INPUT", outputSummary: `Research structuring failed: ${message}`, finishedAt: new Date() },
    });
    return NextResponse.json({ error: `Provider research (structure step) failed: ${message}` }, { status: 500 });
  }
}
