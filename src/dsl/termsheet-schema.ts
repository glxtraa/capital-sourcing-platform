import { z } from "zod";

export const BenchmarkRowSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  availableToBorrowerToday: z.boolean(),
  availabilityNote: z.string(),
  indicativeCost: z.string().describe("Free text, e.g. '6-10% p.a.' or 'not disclosed — estimate: ...'"),
  isEstimate: z.boolean().describe("True if indicativeCost is a reasoned estimate rather than a sourced figure"),
  speedNote: z.string(),
});
export type BenchmarkRow = z.infer<typeof BenchmarkRowSchema>;

export const TermSheetOutputSchema = z.object({
  benchmarkTable: z.array(BenchmarkRowSchema),
  leverageAssessment: z
    .string()
    .describe("Does the borrower have real, funded, available alternatives right now, or not — and what that implies for pricing power."),
  proposedRatePct: z.number().nullable().optional(),
  rateRationale: z.string(),
  advanceRatePct: z.number().nullable().optional(),
  tenorDaysMin: z.number().int().nullable().optional(),
  tenorDaysMax: z.number().int().nullable().optional(),
  tenorNote: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  securityTerms: z.string(),
  conditionsPrecedent: z.string(),
});
export type TermSheetOutput = z.infer<typeof TermSheetOutputSchema>;
