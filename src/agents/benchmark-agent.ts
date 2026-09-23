import { readFileSync } from "fs";
import { join } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, AGENT_MODEL } from "@/lib/anthropic";
import { zodToToolSchema } from "@/lib/zod-tool";
import { TermSheetOutputSchema, type TermSheetOutput } from "@/dsl/termsheet-schema";
import type { Deal, Party, FinancingAsk, RiskFlag, Provider, ProviderMatch } from "@prisma/client";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "src/agents/prompts/benchmark.md"), "utf-8");

const TOOL: Anthropic.Tool = {
  name: "record_term_sheet",
  description: "Record the lender-facing benchmark and recommended term sheet.",
  input_schema: zodToToolSchema(TermSheetOutputSchema),
};

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
  const client = getAnthropicClient();

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

  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "record_term_sheet" },
    messages: [
      {
        role: "user",
        content:
          "Here is the deal and its already-matched provider alternatives. Produce the " +
          "benchmark table and recommended term sheet per the system prompt.\n\n" +
          dealSummary,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Benchmark agent did not return a tool_use block.");
  }
  return TermSheetOutputSchema.parse(toolUse.input);
}
