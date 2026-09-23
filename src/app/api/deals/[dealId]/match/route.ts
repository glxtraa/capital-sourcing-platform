import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchAllProviders } from "@/lib/matching";
import { researchNewProvider } from "@/agents/research-agent";

/**
 * Matching plus the feedback loop, run directly and synchronously — see
 * extract/route.ts for why this app no longer uses a background job
 * system. This single request does what used to be two separate Inngest
 * functions ping-ponging events at each other: run the mechanical filter;
 * if it finds zero eligible providers (a likely database coverage gap, not
 * a market-reality finding — this happened for real with both CBS
 * Ventures and PT Kalmindo Energi Mandiri), research a new one and try
 * again, up to MAX_AUTO_RESEARCH_ATTEMPTS times before giving up and
 * surfacing whatever's found to a human.
 *
 * This can legitimately take a while (each research attempt is a real web
 * search + two LLM calls) — maxDuration is set generously, and the route
 * is safe to re-run if it ever times out: it always recomputes everything
 * from the current state rather than assuming partial progress.
 */
export const maxDuration = 300;

const MAX_AUTO_RESEARCH_ATTEMPTS = 3;

export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  await db.deal.update({ where: { id: dealId }, data: { status: "MATCHING" } });

  const fullDeal = await db.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: { parties: true, financingAsks: true },
  });
  const borrower = fullDeal.parties.find((p) => p.role === "BORROWER");
  const obligor = fullDeal.parties.find((p) => p.role === "OBLIGOR");
  const primaryAsk = fullDeal.financingAsks[0]; // a deal can have >1 ask; matching runs per-ask in a fuller build

  const dealMatchInput = {
    borrowerJurisdiction: borrower?.jurisdiction ?? null,
    obligorJurisdiction: obligor?.jurisdiction ?? null,
  };
  const askMatchInput = {
    amount: primaryAsk?.amount ?? null,
    structureType: primaryAsk?.structureType ?? "UNKNOWN",
  };

  let providers = await db.provider.findMany();
  let results = matchAllProviders(providers, dealMatchInput, askMatchInput);
  let researchAttempts = 0;

  while (
    results.filter((r) => r.eligibleOnPaper).length === 0 &&
    researchAttempts < MAX_AUTO_RESEARCH_ATTEMPTS
  ) {
    researchAttempts++;
    await db.deal.update({ where: { id: dealId }, data: { status: "RESEARCHING" } });

    const hint =
      `A capital provider for a ${askMatchInput.structureType} deal, ` +
      `borrower jurisdiction ${dealMatchInput.borrowerJurisdiction ?? "unknown"}, ` +
      `obligor jurisdiction ${dealMatchInput.obligorJurisdiction ?? "unknown"}, ` +
      `ticket size ~${askMatchInput.amount ?? "unknown"} ${primaryAsk?.currency ?? ""}`;
    const context = `Deal "${fullDeal.name}" — zero eligible providers found on attempt ${researchAttempts}.`;

    const run = await db.researchRun.create({
      data: {
        dealId,
        kind: "PROVIDER_RESEARCH_NEW",
        triggeredBy: "system:zero_eligible_providers",
        inputSummary: `${hint}\n\n${context}`,
      },
    });

    try {
      const provider = await researchNewProvider(hint, context);
      await db.provider.upsert({
        where: { id: provider.id },
        create: {
          ...provider,
          lastVerified: provider.lastVerified ? new Date(provider.lastVerified) : null,
          documentsRequired: { create: provider.documentsRequired },
        },
        update: {
          ...provider,
          lastVerified: provider.lastVerified ? new Date(provider.lastVerified) : null,
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
    } catch (err) {
      await db.researchRun.update({
        where: { id: run.id },
        data: {
          status: "NEEDS_HUMAN_INPUT",
          outputSummary: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
          finishedAt: new Date(),
        },
      });
      // Fall through and re-match anyway -- worst case it's still zero
      // eligible and (below the attempt cap) tries once more.
    }

    await db.deal.update({ where: { id: dealId }, data: { status: "MATCHING" } });
    providers = await db.provider.findMany();
    results = matchAllProviders(providers, dealMatchInput, askMatchInput);
  }

  const eligibleCount = results.filter((r) => r.eligibleOnPaper).length;

  // Write ProviderMatch rows. In a fuller build this step also calls an
  // LLM (mirroring deal-intake's "don't stop at the mechanical script's
  // output -- reason about gating factors" rule) to write the per-match
  // `rationale` and set `verdict`/`isTier1` with real judgment instead of
  // just eligibleOnPaper. Left as a straightforward mechanical mapping
  // here to keep this route's scope legible.
  await db.providerMatch.deleteMany({ where: { dealId } });
  await db.providerMatch.createMany({
    data: results.map((r) => ({
      dealId,
      providerId: r.providerId,
      verdict: r.eligibleOnPaper ? "POSSIBLE" : "EXCLUDED",
      rationale: r.reasons.join("; ") || "No disqualifying factors found by the mechanical pre-filter.",
      isTier1: r.eligibleOnPaper,
    })),
  });
  await db.deal.update({ where: { id: dealId }, data: { status: "COMPLETE" } });

  return NextResponse.json({ dealId, eligibleCount, researchAttempts });
}
