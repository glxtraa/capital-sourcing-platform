import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { researchNewProvider } from "@/agents/research-agent";

/**
 * Step 3 of the pipeline — the productionized `capital-provider-research`
 * skill, Mode B, triggered automatically by match-providers.ts when a deal
 * comes back with zero eligible providers. Closes the loop by re-firing
 * `deal/matching.requested` once the database has been enriched — this is
 * the actual feedback mechanism, not just a one-shot research call.
 */
export const researchProviders = inngest.createFunction(
  { id: "research-providers", retries: 1 }, // web-search-heavy; don't retry aggressively
  { event: "provider/research.requested" },
  async ({ event, step }) => {
    const { dealId, hint, context, researchAttempt } = event.data;

    const run = await step.run("log-run-start", () =>
      db.researchRun.create({
        data: {
          dealId,
          kind: "PROVIDER_RESEARCH_NEW",
          triggeredBy: "system:zero_eligible_providers",
          inputSummary: `${hint}\n\n${context}`,
        },
      }),
    );

    try {
      const provider = await step.run("research-new-provider", () =>
        researchNewProvider(hint, context),
      );

      await step.run("upsert-provider", async () => {
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
            documentsRequired: {
              deleteMany: {},
              create: provider.documentsRequired,
            },
          },
        });
      });

      await step.run("log-run-success", () =>
        db.researchRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCEEDED",
            outputSummary: `Added/updated provider "${provider.name}" (${provider.id}).`,
            finishedAt: new Date(),
          },
        }),
      );
    } catch (err) {
      await step.run("log-run-failure", () =>
        db.researchRun.update({
          where: { id: run.id },
          data: {
            status: "NEEDS_HUMAN_INPUT",
            outputSummary: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
            finishedAt: new Date(),
          },
        }),
      );
      // Fall through to re-matching anyway — worst case it comes back with
      // zero eligible again and (below the attempt cap) tries once more;
      // at the cap, the deal surfaces to a human instead of looping.
    }

    // The feedback loop closes here: go match again now that the provider
    // table has (hopefully) grown.
    await step.sendEvent("rematch-after-research", {
      name: "deal/matching.requested",
      data: { dealId, researchAttempt },
    });

    return { dealId, researchAttempt };
  },
);
