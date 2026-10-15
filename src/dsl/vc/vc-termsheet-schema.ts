import { z } from "zod";
import { StartupInstrumentSchema } from "./vc-extraction-schema";

export const VCTermSheetOutputSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  targetInstrument: StartupInstrumentSchema,
  recommendedValuationCapUsd: z.number(),
  valuationBenchmarkPercentiles: z.object({
    p25Usd: z.number(),
    medianUsd: z.number(),
    p75Usd: z.number(),
  }),
  recommendedDiscountPct: z.number().nullable().optional(),
  expectedFounderDilutionPct: z.number(),
  optionPoolExpansionRequiredPct: z.number().default(10),

  proFormaCapTable: z.array(
    z.object({
      stakeholderGroup: z.string(),
      preRoundPct: z.number(),
      postRoundPct: z.number(),
      notes: z.string().nullable().optional(),
    }),
  ),

  governanceTerms: z.object({
    boardSeats: z.string().describe("e.g. 2 Founder + 1 Lead VC for priced round, or None for SAFE"),
    protectiveProvisions: z.array(z.string()),
    proRataRights: z.string(),
    informationRights: z.string(),
  }),

  syndicateConstruction: z.object({
    leadInvestorAllocationUsd: z.number(),
    coInvestorsAllocationUsd: z.number(),
    angelsAllocationUsd: z.number(),
    targetClosingWeeks: z.number(),
  }),

  benchmarkComparisonTable: z.array(
    z.object({
      categoryOrInvestor: z.string(),
      typicalCheckUsd: z.number(),
      typicalValuationCapUsd: z.number(),
      speedToTermSheetWeeks: z.number(),
      keyProsAndCons: z.string(),
    }),
  ),

  leverageAssessment: z.string().describe("Evaluation of founder bargaining power against current capital supply"),
});
export type VCTermSheetOutput = z.infer<typeof VCTermSheetOutputSchema>;
