import { readFileSync } from "fs";
import { join } from "path";
import { getOpenRouterClient, BENCHMARK_MODEL } from "@/lib/openrouter";
import { zodToResponseFormat, parseStructuredJson } from "@/lib/json-schema";
import {
  VCTermSheetOutputSchema,
  type VCTermSheetOutput,
  type StartupDealSpec,
  type SyndicateRoundMatchingResult,
} from "@/dsl/vc";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/vc-benchmark.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(
  VCTermSheetOutputSchema,
  "VCTermSheetOutput",
);

export interface VCBenchmarkInput {
  spec: StartupDealSpec;
  matchingResult: SyndicateRoundMatchingResult;
}

/**
 * Executes Startup VC Benchmark & Syndicate Term Sheet Structuring.
 * Formulates valuation benchmark percentiles, pro-forma cap table dilution,
 * standard governance covenants, and syndicate composition plans.
 */
export async function runVCBenchmark(
  input: VCBenchmarkInput,
): Promise<VCTermSheetOutput> {
  const client = getOpenRouterClient();

  const dealSummary = JSON.stringify(
    {
      dealId: input.spec.dealId,
      companyName: input.spec.companyName,
      stage: input.spec.stage,
      primaryVertical: input.spec.primaryVertical,
      legalEntityJurisdiction: input.spec.legalEntityJurisdiction,
      founders: input.spec.founders,
      traction: input.spec.traction,
      capTable: input.spec.capTable,
      financingAsk: input.spec.financingAsk,
      reconciliationAudit: input.spec.reconciliationAudit,
      riskFlags: input.spec.riskFlags,
      matchingResult: {
        leadCandidatesCount: input.matchingResult.leadCandidates.filter((c) => c.verdict === "GOOD").length,
        topLeads: input.matchingResult.leadCandidates.slice(0, 3).map((c) => ({
          name: c.investorName,
          verdict: c.verdict,
          rationale: c.rationale,
        })),
        coInvestorsCount: input.matchingResult.coInvestorCandidates.filter((c) => c.verdict === "GOOD").length,
        angelsCount: input.matchingResult.angelCandidates.filter((c) => c.verdict === "GOOD").length,
        acceleratorsCount: input.matchingResult.acceleratorOptions.filter((c) => c.verdict === "GOOD").length,
        syndicateFeasibilityScorePct: input.matchingResult.syndicateFeasibilityScorePct,
      },
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
        content: `Here is the startup deal and its syndicate matching alternatives. Produce the market valuation benchmark and syndicate term sheet per the system prompt.\n\n${dealSummary}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("VC Benchmark agent returned no content.");
  }

  return parseStructuredJson(content, VCTermSheetOutputSchema);
}
