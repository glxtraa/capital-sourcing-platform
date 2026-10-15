import { z } from "zod";

export const LegCriteriaStatusSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["pass", "fail", "warning"]),
  detail: z.string(),
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
});
export type ModularLegMatch = z.infer<typeof ModularLegMatchSchema>;

export const TradeMatchingResultSchema = z.object({
  dealId: z.string(),
  matchedAt: z.string(),

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
