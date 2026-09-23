import { inngest, MAX_AUTO_RESEARCH_ATTEMPTS } from "@/inngest/client";
import { db } from "@/lib/db";
import { matchAllProviders } from "@/lib/matching";

/**
 * Step 2 of the pipeline — the productionized `deal-intake` Step 2/3
 * (match against the provider database, write the shortlist). This is
 * also the function that DECIDES whether the feedback loop needs to fire:
 * if the mechanical match returns nothing eligible, that's very likely a
 * database coverage gap (as it was for both CBS Ventures and PT Kalmindo
 * Energi Mandiri in the manual runs this system is built from) rather than
 * a market-reality finding, so it hands off to the research agent instead
 * of just reporting "no options."
 */
export const matchProviders = inngest.createFunction(
  { id: "match-providers", retries: 2 },
  { event: "deal/matching.requested" },
  async ({ event, step }) => {
    const { dealId, researchAttempt = 0 } = event.data;

    await step.run("mark-matching", () =>
      db.deal.update({ where: { id: dealId }, data: { status: "MATCHING" } }),
    );

    const { deal, financingAsks, providers } = await step.run("load-deal-and-providers", async () => {
      const deal = await db.deal.findUniqueOrThrow({
        where: { id: dealId },
        include: { parties: true, financingAsks: true },
      });
      const providers = await db.provider.findMany();
      return { deal, financingAsks: deal.financingAsks, providers };
    });

    const borrower = deal.parties.find((p) => p.role === "BORROWER");
    const obligor = deal.parties.find((p) => p.role === "OBLIGOR");
    const primaryAsk = financingAsks[0]; // a deal can have >1 ask; matching runs per-ask in a fuller build

    const results = await step.run("run-mechanical-match", () =>
      matchAllProviders(
        providers,
        {
          borrowerJurisdiction: borrower?.jurisdiction ?? null,
          obligorJurisdiction: obligor?.jurisdiction ?? null,
        },
        { amount: primaryAsk?.amount ?? null, structureType: primaryAsk?.structureType ?? "UNKNOWN" },
      ),
    );

    const eligibleCount = results.filter((r) => r.eligibleOnPaper).length;

    if (eligibleCount === 0 && researchAttempt < MAX_AUTO_RESEARCH_ATTEMPTS) {
      // The feedback loop: no eligible providers found -> ask the research
      // agent to go find some, then come back and match again. This is the
      // literal implementation of "feedback to the AI agent in case more
      // research is done."
      await step.run("mark-researching", () =>
        db.deal.update({ where: { id: dealId }, data: { status: "RESEARCHING" } }),
      );
      await step.sendEvent("request-research", {
        name: "provider/research.requested",
        data: {
          dealId,
          hint: `A capital provider for a ${primaryAsk?.structureType ?? "UNKNOWN"} deal, ` +
            `borrower jurisdiction ${borrower?.jurisdiction ?? "unknown"}, ` +
            `obligor jurisdiction ${obligor?.jurisdiction ?? "unknown"}, ` +
            `ticket size ~${primaryAsk?.amount ?? "unknown"} ${primaryAsk?.currency ?? ""}`,
          context: `Deal "${deal.name}" — zero eligible providers found on attempt ${researchAttempt + 1}.`,
          researchAttempt: researchAttempt + 1,
        },
      });
      return { dealId, eligibleCount, handedOffToResearch: true };
    }

    // Write ProviderMatch rows. In a fuller build this step also calls an
    // LLM (mirroring deal-intake's "don't stop at the mechanical script's
    // output — reason about gating factors" rule) to write the per-match
    // `rationale` and set `verdict`/`isTier1` with real judgment instead of
    // just eligibleOnPaper. Left as a straightforward mechanical mapping
    // here to keep this function's scope legible; wire in a reasoning step
    // the same way match-providers already calls the mechanical matcher.
    await step.run("write-matches", async () => {
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
    });

    return { dealId, eligibleCount, handedOffToResearch: false };
  },
);
