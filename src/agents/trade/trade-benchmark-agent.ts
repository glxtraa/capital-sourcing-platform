import { readFileSync } from "fs";
import { join } from "path";
import { getOpenRouterClient, BENCHMARK_MODEL } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import {
  AgentStructuringOutputSchema,
  type TradeTermSheetOutput,
  type DeterministicFacilityTerms,
  type TradeDealSpec,
  type TradeMatchingResult,
} from "@/dsl/trade";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/trade-benchmark.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(
  AgentStructuringOutputSchema,
  "AgentStructuringOutput",
);

export interface TradeBenchmarkInput {
  spec: TradeDealSpec;
  matchingResult: TradeMatchingResult;
  funderSourcesMap?: Record<string, { sources: string[]; contact?: string | null }>;
}

/**
 * Calculates 100% deterministic facility terms using pure mathematical formulas
 * derived strictly from extracted contracts and matched parameters.
 */
export function calculateDeterministicFacilityTerms(
  spec: TradeDealSpec,
  matchingResult: TradeMatchingResult,
  leadFunderId: string,
  leadFunderName: string,
  recommendedFacilityType: "SINGLE_UMBRELLA_FACILITY" | "SYNTHETIC_THREE_LEG_SYNDICATE",
  spreadBpsParam?: number,
  advanceRatePctParam?: number,
  leadSources: string[] = [],
  leadContact?: string | null,
): DeterministicFacilityTerms {
  // 1. Collateral Base & Advance Rate
  const eligibleCollateralBaseUsd = spec.supplyContract.contractAmountUsd > 0
    ? spec.supplyContract.contractAmountUsd
    : spec.offtakeContract.contractAmountUsd;

  const advanceRatePct = advanceRatePctParam && advanceRatePctParam > 0
    ? advanceRatePctParam
    : 85.0;

  const totalFacilityAmountUsd = Math.round(eligibleCollateralBaseUsd * (advanceRatePct / 100));

  // 2. Tenor Math
  const cashflowGapDays = Math.max(0, spec.reconciliationAudit.cashflowGapDays);
  const maximumTenorDays = Math.max(cashflowGapDays + 15, 30);

  // 3. Pricing Math
  const baseRateName = "3M Term SOFR";
  const baseRatePcnt = 4.85;
  const spreadBps = spreadBpsParam && spreadBpsParam > 0 ? spreadBpsParam : 350;
  const blendedPricingPcnt = Number((baseRatePcnt + spreadBps / 100).toFixed(2));
  const pricingFormula = `${baseRateName} (${baseRatePcnt.toFixed(2)}%) + ${spreadBps} bps = ${blendedPricingPcnt.toFixed(2)}% p.a.`;

  // 4. Margin Economics
  const supplyAmount = spec.supplyContract.contractAmountUsd;
  const offtakeAmount = spec.offtakeContract.contractAmountUsd;
  const grossTraderMarginUsd = Math.round(offtakeAmount - supplyAmount);
  const grossTraderMarginPct = supplyAmount > 0
    ? Number(((grossTraderMarginUsd / supplyAmount) * 100).toFixed(2))
    : 0;

  const estimatedFinancingCostUsd = Math.round(
    totalFacilityAmountUsd * (blendedPricingPcnt / 100) * (maximumTenorDays / 360)
  );

  const netTraderMarginUsd = Math.round(grossTraderMarginUsd - estimatedFinancingCostUsd);
  const netTraderMarginPct = supplyAmount > 0
    ? Number(((netTraderMarginUsd / supplyAmount) * 100).toFixed(2))
    : 0;

  return {
    leadFunderId,
    leadFunderName,
    leadFunderSources: leadSources,
    leadFunderContact: leadContact ?? null,
    facilityType: recommendedFacilityType,
    eligibleCollateralBaseUsd,
    advanceRatePct,
    totalFacilityAmountUsd,
    cashflowGapDays,
    maximumTenorDays,
    baseRateName,
    baseRatePcnt,
    spreadBps,
    blendedPricingPcnt,
    pricingFormula,
    grossTraderMarginUsd,
    grossTraderMarginPct,
    estimatedFinancingCostUsd,
    netTraderMarginUsd,
    netTraderMarginPct,
    mathAuditTrail: {
      supplyContractRef: spec.supplyContract.contractReference,
      supplyAmountSourceDoc: spec.supplyContract.sourceDocument ?? "Supply Contract",
      offtakeContractRef: spec.offtakeContract.contractReference,
      offtakeAmountSourceDoc: spec.offtakeContract.sourceDocument ?? "Offtake Contract",
      calculatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Executes Trade Benchmark & Term Sheet Structuring.
 * Deterministic math is executed strictly via calculateDeterministicFacilityTerms.
 * The LLM formulates qualitative credit committee items (security packages, CPs, and benchmark rows).
 */
export async function runTradeBenchmark(
  input: TradeBenchmarkInput,
): Promise<TradeTermSheetOutput> {
  const client = getOpenRouterClient();

  const dealSummary = JSON.stringify(
    {
      dealId: input.spec.dealId,
      dealName: input.spec.dealName,
      corridor: input.spec.corridor,
      commodity: input.spec.commodity,
      supplier: input.spec.supplier,
      trader: input.spec.trader,
      buyer: input.spec.buyer,
      supplyContract: input.spec.supplyContract,
      offtakeContract: input.spec.offtakeContract,
      reconciliationAudit: input.spec.reconciliationAudit,
      corridorAudits: input.spec.corridorAudits,
      riskFlags: input.spec.riskFlags,
      matchingResult: {
        umbrellaMatches: input.matchingResult.umbrellaMatches,
        umbrellaMatchesAvailable: input.matchingResult.umbrellaMatchesAvailable,
        modularMatches: input.matchingResult.modularMatches,
        recommendedRoute: input.matchingResult.recommendedRoute,
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
        content:
          "Here is the reconciled trade finance transaction and its matched funder alternatives. " +
          "Produce the benchmark comparison table, credit committee pricing assessment, and qualitative facility structure.\n\n" +
          dealSummary,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Trade benchmark agent returned no content.");
  }

  const agentOutput = AgentStructuringOutputSchema.parse(JSON.parse(content));

  // Lead funder source metadata resolution
  const leadMeta = input.funderSourcesMap?.[agentOutput.selectedLeadFunderId];

  // 100% Deterministic Financial & Facility Mathematics
  const deterministicTerms = calculateDeterministicFacilityTerms(
    input.spec,
    input.matchingResult,
    agentOutput.selectedLeadFunderId,
    agentOutput.leadFunderName,
    agentOutput.recommendedFacilityType,
    agentOutput.spreadBps,
    agentOutput.advanceRatePct,
    leadMeta?.sources ?? [],
    leadMeta?.contact ?? null,
  );

  // Lineage / Provenance
  const sourceDocs = Array.from(
    new Set(
      [
        input.spec.supplyContract.sourceDocument,
        input.spec.offtakeContract.sourceDocument,
        input.spec.supplier.sourceDocument,
        input.spec.buyer.sourceDocument,
      ].filter(Boolean) as string[],
    ),
  );

  return {
    dealId: input.spec.dealId,
    dealName: input.spec.dealName,
    corridor: input.spec.corridor,
    benchmarkTable: agentOutput.benchmarkTable,
    deterministicTerms,
    facilityStructure: agentOutput.facilityStructure,
    provenance: {
      generatedAt: new Date().toISOString(),
      modelUsed: BENCHMARK_MODEL,
      sourceDocumentsUsed: sourceDocs,
      leadFunderCitations: leadMeta?.sources ?? [],
    },
  };
}
