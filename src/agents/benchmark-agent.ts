import { readFileSync } from "fs";
import { join } from "path";
import { getOpenRouterClient, BENCHMARK_MODEL } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { TermSheetOutputSchema, type TermSheetOutput } from "@/dsl/termsheet-schema";
import type { Deal, Party, FinancingAsk, RiskFlag, Provider, ProviderMatch } from "@prisma/client";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "src/agents/prompts/benchmark.md"), "utf-8");
const RESPONSE_FORMAT = zodToResponseFormat(TermSheetOutputSchema, "TermSheetOutput");

export interface BenchmarkInput {
  deal: Deal;
  parties: Party[];
  financingAsks: FinancingAsk[];
  riskFlags: RiskFlag[];
  matches: (ProviderMatch & { provider: Provider })[];
}

/**
 * The productionized `lender-benchmark` skill. Called on-demand from the
 * UI (a lender persona clicking "benchmark this deal"), not part of the
 * automatic extraction -> matching pipeline, since not every deal needs it
 * and it's written for a different reader (see prompts/benchmark.md).
 */
export async function runLenderBenchmark(input: BenchmarkInput): Promise<TermSheetOutput> {
  const client = getOpenRouterClient();

  const dealSummary = JSON.stringify(
    {
      dealName: input.deal.name,
      parties: input.parties,
      financingAsks: input.financingAsks,
      riskFlags: input.riskFlags,
      matchedProviders: input.matches.map((m) => ({
        id: m.provider.id,
        name: m.provider.name,
        verdict: m.verdict,
        rationale: m.rationale,
        feeNotes: m.provider.feeNotes,
        notes: m.provider.notes,
        gatingFactor: m.provider.gatingFactor,
        minTicketUsd: m.provider.minTicketUsd,
        maxTicketUsd: m.provider.maxTicketUsd,
        timeToTermSheet: m.provider.timeToTermSheet,
      })),
    },
    null,
    2,
  );

  const response = await client.chat.completions.create({
    model: BENCHMARK_MODEL,
    response_format: RESPONSE_FORMAT,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Here is the deal and its already-matched provider alternatives. Produce the " +
          "benchmark table and recommended term sheet per the system prompt.\n\n" +
          dealSummary,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Benchmark agent returned no content.");
  }
  return TermSheetOutputSchema.parse(JSON.parse(content));
}
