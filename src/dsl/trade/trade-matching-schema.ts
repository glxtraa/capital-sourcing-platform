import { z } from "zod";
import { CriterionAcquisitionMethodSchema } from "../provenance";

export const FunderSideProvenanceSchema = z.object({
  ruleSummary: z.string(),
  acquisitionMethod: CriterionAcquisitionMethodSchema,
  howObtainedExplanation: z.string(),
  sourceUrl: z.string().nullable().optional(),
  sourcePageTitle: z.string().nullable().optional(),
  verbatimQuote: z.string().nullable().optional(),
  surroundingContext: z.string().nullable().optional(),
  quoteVerifiedInCache: z.boolean().optional(),
});
export type FunderSideProvenance = z.infer<typeof FunderSideProvenanceSchema>;

export const LegCriteriaStatusSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["pass", "fail", "warning"]),
  detail: z.string(),
  funderSide: FunderSideProvenanceSchema.nullable().optional(),
});
export type LegCriteriaStatus = z.infer<typeof LegCriteriaStatusSchema>;

export const UmbrellaMatchSchema = z.object({
  funderId: z.string(),
  funderName: z.string(),
  verdict: z.enum(["GOOD", "POSSIBLE", "POOR", "EXCLUDED"]),
  isTier1: z.boolean(),
  rationale: z.string(),
  criteria: z.array(LegCriteriaStatusSchema),
  missingDocuments: z.array(z.string()),
});
export type UmbrellaMatch = z.infer<typeof UmbrellaMatchSchema>;

export const ModularLegMatchSchema = z.object({
  leg: z.enum(["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG"]),
  funderId: z.string(),
  funderName: z.string(),
  verdict: z.enum(["GOOD", "POSSIBLE", "EXCLUDED"]),
  rationale: z.string(),
  criteria: z.array(LegCriteriaStatusSchema),
  missingDocuments: z.array(z.string()).optional(),
});
export type ModularLegMatch = z.infer<typeof ModularLegMatchSchema>;

export const TradeMatchingOptionsSchema = z.object({
  relaxInferredBlockers: z.boolean().default(false).describe("When enabled, candidates failing only unverified AI inferences are treated as POSSIBLE with warning rather than EXCLUDED"),
});
export type TradeMatchingOptions = z.infer<typeof TradeMatchingOptionsSchema>;

export const TradeMatchingResultSchema = z.object({
  dealId: z.string(),
  matchedAt: z.string(),

  // Matching Options Applied
  optionsApplied: TradeMatchingOptionsSchema.optional(),

  // Tier 1 Results
  umbrellaMatches: z.array(UmbrellaMatchSchema),
  umbrellaMatchesAvailable: z.boolean(),

  // Tier 2 Fallback Results
  modularMatches: z.object({
    supplierLegMatches: z.array(ModularLegMatchSchema),
    traderLegMatches: z.array(ModularLegMatchSchema),
    buyerLegMatches: z.array(ModularLegMatchSchema),
  }),

  // Recommendation
  recommendedRoute: z.enum(["PURSUE_UMBRELLA", "ASSEMBLE_MODULAR_SYNDICATE"]),
  synthesisSummary: z.string(),
});
export type TradeMatchingResult = z.infer<typeof TradeMatchingResultSchema>;
