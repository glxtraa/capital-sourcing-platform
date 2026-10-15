import { z } from "zod";

export const StartupStageSchema = z.enum([
  "PRE_SEED",
  "SEED",
  "SERIES_A",
  "SERIES_B",
  "GROWTH",
]);
export type StartupStage = z.infer<typeof StartupStageSchema>;

export const StartupSectorSchema = z.enum([
  "B2B_SAAS",
  "FINTECH",
  "AI_ML_INFRASTRUCTURE",
  "GENERATIVE_AI_APPS",
  "CLIMATETECH",
  "HEALTHTECH_BIOTECH",
  "DEV_TOOLS",
  "CYBERSECURITY",
  "MARKETPLACE_PLATFORM",
  "HARDWARE_ROBOTICS",
  "WEB3_CRYPTO",
  "CONSUMER",
]);
export type StartupSector = z.infer<typeof StartupSectorSchema>;

export const StartupInstrumentSchema = z.enum([
  "POST_MONEY_SAFE",
  "PRE_MONEY_SAFE",
  "CONVERTIBLE_NOTE",
  "PRICED_PREFERRED_EQUITY",
  "ACCELERATOR_STANDARD_TERMS",
]);
export type StartupInstrument = z.infer<typeof StartupInstrumentSchema>;

export const FounderExtractionSchema = z.object({
  name: z.string(),
  role: z.string().describe("e.g. CEO, CTO, CPO, Co-Founder"),
  isTechnical: z.boolean().default(false),
  isRepeatFounder: z.boolean().default(false),
  equityOwnershipPct: z.number().nullable().optional(),
  vestingConfirmed: z.boolean().default(true),
  linkedinUrl: z.string().nullable().optional(),
  priorExits: z.array(z.string()).default([]),
});
export type FounderExtraction = z.infer<typeof FounderExtractionSchema>;

export const SafeHolderExtractionSchema = z.object({
  id: z.string().optional(),
  holderName: z.string().describe("Investor, fund, angel, or accelerator name holding the SAFE/note"),
  investmentAmountUsd: z.number().describe("Investment principal / SAFE balance in USD"),
  instrumentType: z.string().default("POST_MONEY_SAFE").describe("e.g. POST_MONEY_SAFE, PRE_MONEY_SAFE, CONVERTIBLE_NOTE, MFN_SAFE"),
  valuationCapUsd: z.number().nullable().optional().describe("Valuation cap in USD if applicable"),
  discountPct: z.number().nullable().optional().describe("Discount percentage e.g. 20"),
  dateOrNotes: z.string().nullable().optional().describe("Date issued or key note"),
});
export type SafeHolderExtraction = z.infer<typeof SafeHolderExtractionSchema>;

export const CommonHolderExtractionSchema = z.object({
  id: z.string().optional(),
  holderName: z.string().describe("Founder, employee, early advisor, or option pool"),
  roleOrRelationship: z.string().describe("e.g. CEO / Co-Founder, CTO, Lead Engineer, ESOP Pool"),
  shareCount: z.number().nullable().optional().describe("Number of common shares held"),
  ownershipPct: z.number().describe("Percentage of common equity"),
  vestingTerms: z.string().nullable().optional().describe("e.g. 4-year monthly with 1-year cliff"),
});
export type CommonHolderExtraction = z.infer<typeof CommonHolderExtractionSchema>;

export const CapTableExtractionSchema = z.object({
  foundersOwnershipPct: z.number().nullable().optional(),
  investorOwnershipPct: z.number().nullable().optional(),
  optionPoolPct: z.number().nullable().optional(),
  safesNotesOutstandingUsd: z.number().nullable().optional(),
  safeHolders: z.array(SafeHolderExtractionSchema).optional().default([]),
  commonHolders: z.array(CommonHolderExtractionSchema).optional().default([]),
  hasDeadEquity: z.boolean().default(false),
  deadEquityNotes: z.string().nullable().optional(),
});
export type CapTableExtraction = z.infer<typeof CapTableExtractionSchema>;

export const TractionExtractionSchema = z.object({
  arrUsd: z.number().nullable().optional(),
  mrrUsd: z.number().nullable().optional(),
  momGrowthRatePct: z.number().nullable().optional(),
  grossMarginPct: z.number().nullable().optional(),
  netMonthlyBurnUsd: z.number().nullable().optional(),
  cashRunwayMonths: z.number().nullable().optional(),
  activeCustomersCount: z.number().int().nullable().optional(),
  customerLoiPipelineUsd: z.number().nullable().optional(),
  netRevenueRetentionPct: z.number().nullable().optional(),
});
export type TractionExtraction = z.infer<typeof TractionExtractionSchema>;

export const AskExtractionSchema = z.object({
  targetRaiseUsd: z.number().nullable().optional(),
  instrumentType: StartupInstrumentSchema.default("POST_MONEY_SAFE"),
  valuationCapUsd: z.number().nullable().optional(),
  discountPct: z.number().nullable().optional(),
  plannedRunwayMonths: z.number().int().default(18),
  leadCommitted: z.boolean().default(false),
  committedAmountUsd: z.number().default(0),
});
export type AskExtraction = z.infer<typeof AskExtractionSchema>;

export const RiskFlagExtractionSchema = z.object({
  category: z.string(),
  severity: z.number().int().min(1).max(5),
  description: z.string(),
});
export type RiskFlagExtraction = z.infer<typeof RiskFlagExtractionSchema>;

export const StartupCompetitorExtractionSchema = z.object({
  name: z.string(),
  websiteUrl: z.string().nullable().optional(),
  description: z.string().describe("What the competitor does and their product positioning"),
  overlapDegree: z.enum(["DIRECT", "INDIRECT", "ADJACENT"]).default("DIRECT"),
  knownInvestors: z.array(z.string()).default([]),
  differentiation: z.string().nullable().optional().describe("Key advantage or differentiator of our startup vs this competitor"),
  sourceUrl: z.string().nullable().optional(),
  sourceVerified: z.boolean().default(false),
  sourceHttpStatus: z.number().int().nullable().optional(),
});
export type StartupCompetitorExtraction = z.infer<typeof StartupCompetitorExtractionSchema>;

export const StartupDocumentExtractionSchema = z.object({
  documentSummary: z.string().describe("1-2 sentences summarizing what this document is"),
  documentTypes: z.array(z.string()).optional().default([]),
  companyName: z.string().nullable().optional(),
  stage: StartupStageSchema.nullable().optional(),
  primaryVertical: StartupSectorSchema.nullable().optional(),
  industry: z.string().nullable().optional().describe("Specific sub-industry / niche domain description"),
  subIndustries: z.array(z.string()).optional().default([]),
  legalEntityJurisdiction: z.string().nullable().optional().describe("e.g. Delaware (US), United Kingdom, Singapore, Hong Kong, Cayman Islands"),
  founders: z.array(FounderExtractionSchema).optional().default([]),
  competitors: z.array(StartupCompetitorExtractionSchema).optional().default([]),
  traction: TractionExtractionSchema.nullable().optional(),
  capTable: CapTableExtractionSchema.nullable().optional(),
  financingAsk: AskExtractionSchema.nullable().optional(),
  riskFlags: z.array(RiskFlagExtractionSchema).optional().default([]),
  openQuestions: z.array(z.string()).optional().default([]),
});
export type StartupDocumentExtraction = z.infer<typeof StartupDocumentExtractionSchema>;
