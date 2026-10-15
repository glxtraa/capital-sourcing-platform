import { z } from "zod";
import { StartupInvestorTypeSchema } from "./vc-investor-schema";

export const CriterionStatusSchema = z.enum(["pass", "fail", "warning"]);
export type CriterionStatus = z.infer<typeof CriterionStatusSchema>;

export const MatchCriterionSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: CriterionStatusSchema,
  detail: z.string(),
});
export type MatchCriterion = z.infer<typeof MatchCriterionSchema>;

export const MatchTierSchema = z.enum([
  "TIER_1_LEAD",
  "TIER_2_SYNDICATE",
  "TIER_3_ANGEL",
  "TIER_4_ACCELERATOR",
]);
export type MatchTier = z.infer<typeof MatchTierSchema>;

export const TierMatchCandidateSchema = z.object({
  investorId: z.string(),
  investorName: z.string(),
  investorType: StartupInvestorTypeSchema,
  tier: MatchTierSchema,
  verdict: z.enum(["GOOD", "POSSIBLE", "POOR", "EXCLUDED"]),
  isLeadCandidate: z.boolean(),
  rationale: z.string(),
  criteria: z.array(MatchCriterionSchema),
  thesisResonanceScore: z.number().min(0).max(100).default(75),
  portfolioConflictDetected: z.boolean().default(false),
  conflictingPortfolioCompany: z.string().nullable().optional(),
  activelyFundingIndustry: z.boolean().default(true),
  industryDeploymentScore: z.number().default(85),
  competitorConflictNotes: z.string().nullable().optional(),
  sourceLinksAudit: z
    .array(
      z.object({
        url: z.string(),
        status: z.number().int(),
        ok: z.boolean(),
        latencyMs: z.number(),
        testedAt: z.string(),
      }),
    )
    .default([]),
  missingDocuments: z.array(z.string()).default([]),
});
export type TierMatchCandidate = z.infer<typeof TierMatchCandidateSchema>;

/**
 * Customizable Founder Syndicate Preferences.
 * Defaults:
 * - Lead VC: 65% of round
 * - Syndicate / Platforms: 25% of round
 * - Strategic Angels: 10% of round
 * - Minimum Angel Check: $10,000
 */
export const SyndicateCustomPreferencesSchema = z.object({
  leadAllocationPct: z.number().min(0).max(100).default(65),
  syndicateAllocationPct: z.number().min(0).max(100).default(25),
  angelAllocationPct: z.number().min(0).max(100).default(10),
  minAngelCheckUsd: z.number().default(10000),
  customValuationCapUsd: z.number().nullable().optional(),
});
export type SyndicateCustomPreferences = z.infer<typeof SyndicateCustomPreferencesSchema>;

export const SyndicateRoundMatchingResultSchema = z.object({
  dealId: z.string(),
  matchedAt: z.string(),
  targetRaiseAmountUsd: z.number(),

  // Proportions applied
  customPreferencesApplied: SyndicateCustomPreferencesSchema,
  recommendedLeadAllocationUsd: z.number(),
  recommendedSyndicateAllocationUsd: z.number(),
  recommendedAngelAllocationUsd: z.number(),

  leadCandidates: z.array(TierMatchCandidateSchema),
  coInvestorCandidates: z.array(TierMatchCandidateSchema),
  angelCandidates: z.array(TierMatchCandidateSchema),
  acceleratorOptions: z.array(TierMatchCandidateSchema),

  syndicateFeasibilityScorePct: z.number(),
  synthesisSummary: z.string(),
});
export type SyndicateRoundMatchingResult = z.infer<typeof SyndicateRoundMatchingResultSchema>;
