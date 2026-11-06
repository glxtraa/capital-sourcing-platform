import { z } from "zod";

export const BenchmarkRowSchema = z.object({
  funderId: z.string(),
  funderName: z.string(),
  facilityType: z.enum(["UMBRELLA", "SUPPLIER_ONLY", "TRADER_ONLY", "BUYER_ONLY"]),
  availableToday: z.boolean(),
  indicativeCost: z.string(),
  advanceRatePct: z.number().nullable().optional(),
  speedToTermSheet: z.string(),
  sourceUrls: z.array(z.string()).default([]),
  contactInfo: z.string().nullable().optional(),
});
export type BenchmarkRow = z.infer<typeof BenchmarkRowSchema>;

/**
 * 100% Deterministic Mathematical Terms for the Facility.
 * Calculated directly by pure code formulas from extracted contract inputs & matched funder parameters:
 * - totalFacilityAmountUsd = Supply Leg Contract Amount * (advanceRatePct / 100)
 * - advanceRatePct = matched funder advance rate or corridor policy default (85%)
 * - maximumTenorDays = Cashflow Gap Days + Shipping Buffer (max(cashflowGapDays + 15, 30))
 * - blendedPricingPcnt = SOFR Benchmark + Margin Bps / 100
 * - estimatedFinancingCostUsd = (totalFacilityAmountUsd * blendedPricingPcnt / 100) * (maximumTenorDays / 360)
 * - netTraderMarginUsd = grossMarginUsd - estimatedFinancingCostUsd
 */
export const DeterministicFacilityTermsSchema = z.object({
  leadFunderId: z.string(),
  leadFunderName: z.string(),
  leadFunderSources: z.array(z.string()).default([]),
  leadFunderContact: z.string().nullable().optional(),
  facilityType: z.enum(["SINGLE_UMBRELLA_FACILITY", "SYNTHETIC_THREE_LEG_SYNDICATE"]),

  // Core Math
  eligibleCollateralBaseUsd: z.number().describe("Underlying commodity supply contract value"),
  advanceRatePct: z.number().describe("Calculated from funder parameter or 85% standard"),
  totalFacilityAmountUsd: z.number().describe("eligibleCollateralBaseUsd * (advanceRatePct / 100)"),
  cashflowGapDays: z.number().int().describe("Offtake tenor - Supply tenor"),
  maximumTenorDays: z.number().int().describe("cashflowGapDays + 15 days laycan/shipping buffer"),

  // Pricing & Return Math
  baseRateName: z.string().default("3M Term SOFR"),
  baseRatePcnt: z.number().default(4.85),
  spreadBps: z.number().describe("Funder spread in basis points (e.g. 350)"),
  blendedPricingPcnt: z.number().describe("baseRatePcnt + spreadBps / 100"),
  pricingFormula: z.string().describe("Explicit formula string: e.g. '3M Term SOFR (4.85%) + 350 bps = 8.35% p.a.'"),

  // Margin Economics
  grossTraderMarginUsd: z.number().describe("Offtake amount - Supply amount"),
  grossTraderMarginPct: z.number(),
  estimatedFinancingCostUsd: z.number().describe("Interest accrued over tenor"),
  netTraderMarginUsd: z.number().describe("Gross margin minus interest cost"),
  netTraderMarginPct: z.number(),

  // Data Lineage & Provenance for Deterministic Calculations
  mathAuditTrail: z.object({
    supplyContractRef: z.string(),
    supplyAmountSourceDoc: z.string(),
    offtakeContractRef: z.string(),
    offtakeAmountSourceDoc: z.string(),
    calculatedAt: z.string(),
  }),
});
export type DeterministicFacilityTerms = z.infer<typeof DeterministicFacilityTermsSchema>;

/**
 * Legal & Credit Committee Terms structured by the LLM Agent against the deterministic inputs.
 */
export const QualitativeFacilityStructureSchema = z.object({
  marketPricingPowerAssessment: z.string().describe("Credit committee pricing leverage and corridor risk commentary"),
  securityPackage: z.array(z.string()).describe("Pledged physical and financial collateral items"),
  conditionsPrecedent: z.array(z.string()).describe("Mandatory drawdown conditions precedent"),
  riskMitigants: z.array(z.string()).default([]),
});
export type QualitativeFacilityStructure = z.infer<typeof QualitativeFacilityStructureSchema>;

/**
 * Schema specifically for LLM generation: qualitative terms + benchmark table.
 * Mathematical facility calculations are computed deterministically in code.
 */
export const AgentStructuringOutputSchema = z.object({
  benchmarkTable: z.array(BenchmarkRowSchema),
  facilityStructure: QualitativeFacilityStructureSchema,
  recommendedFacilityType: z.enum(["SINGLE_UMBRELLA_FACILITY", "SYNTHETIC_THREE_LEG_SYNDICATE"]),
  selectedLeadFunderId: z.string(),
  leadFunderName: z.string(),
  spreadBps: z.number().int().default(350).describe("Spread in bps over SOFR"),
  advanceRatePct: z.number().default(85).describe("Recommended advance rate %"),
});
export type AgentStructuringOutput = z.infer<typeof AgentStructuringOutputSchema>;

/**
 * Full Trade Term Sheet DSL combining deterministic calculations and structured agent terms.
 */
export const TradeTermSheetOutputSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  corridor: z.string(),

  // Benchmark Comparisons
  benchmarkTable: z.array(BenchmarkRowSchema),

  // 100% Deterministic Financial & Facility Mathematics
  deterministicTerms: DeterministicFacilityTermsSchema,

  // Credit Committee Terms formulated by Agent to match the deterministic terms
  facilityStructure: QualitativeFacilityStructureSchema,

  // Full Lineage & Metadata
  provenance: z.object({
    generatedAt: z.string(),
    modelUsed: z.string(),
    sourceDocumentsUsed: z.array(z.string()),
    leadFunderCitations: z.array(z.string()),
  }),
});
export type TradeTermSheetOutput = z.infer<typeof TradeTermSheetOutputSchema>;
