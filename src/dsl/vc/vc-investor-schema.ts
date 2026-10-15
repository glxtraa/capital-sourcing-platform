import { z } from "zod";
import { StartupStageSchema, StartupSectorSchema } from "./vc-extraction-schema";
import { StartupJurisdictionSchema, VC_STANDARD_JURISDICTIONS } from "./vc-jurisdictions";

export const StartupInvestorTypeSchema = z.enum([
  "INSTITUTIONAL_VC",
  "ANGEL_OPERATOR",
  "ANGEL_PLATFORM_SYNDICATE",
  "VC_PLATFORM_SCOUT",
  "ACCELERATOR_INCUBATOR",
]);
export type StartupInvestorType = z.infer<typeof StartupInvestorTypeSchema>;

export const KeyContactSchema = z.object({
  name: z.string().describe("Full name of partner, investment director, or scout"),
  role: z.string().describe("e.g. General Partner, Founding Partner, Principal, Deal Lead"),
  email: z.string().nullable().optional().describe("Direct email address if publicly disclosed or null"),
  linkedinUrl: z.string().nullable().optional().describe("Personal LinkedIn profile URL"),
  twitterUrl: z.string().nullable().optional().describe("X / Twitter handle or profile link"),
  verified: z.boolean().default(false),
});
export type KeyContact = z.infer<typeof KeyContactSchema>;

export const StartupInvestorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "stable lowercase-kebab slug"),
  name: z.string().min(1),
  type: StartupInvestorTypeSchema,
  targetStages: z.array(StartupStageSchema),
  preferredSectors: z.array(StartupSectorSchema),
  excludedSectors: z.array(StartupSectorSchema).optional().default([]),
  minCheckUsd: z.number().nullable().optional(),
  maxCheckUsd: z.number().nullable().optional(),
  sweetSpotCheckUsd: z.number().nullable().optional(),
  leadsRounds: z.boolean().optional().default(false),
  takesBoardSeats: z.boolean().optional().default(false),
  targetOwnershipPct: z.number().nullable().optional(),
  acceptedJurisdictions: z
    .array(StartupJurisdictionSchema)
    .optional()
    .default(["Delaware (US)", "Any / Global"])
    .describe(
      `Recognized VC jurisdictions: ${VC_STANDARD_JURISDICTIONS.join(", ")}. Defines acceptable corporate holding entity domiciles.`
    ),
  minArrUsd: z.number().nullable().optional(),
  portfolioCompanies: z.array(z.string()).optional().default([]),

  // Advanced VC Research Parameters
  activelyFundingIndustry: z
    .boolean()
    .optional()
    .default(true)
    .describe("Is the investor currently actively funding deals in the startup's target industry/vertical?"),
  recentIndustryInvestments: z
    .array(
      z.object({
        companyName: z.string(),
        dealYearOrDate: z.string().optional(),
        roundStage: z.string().optional(),
        sector: z.string().optional(),
        sourceUrl: z.string().optional(),
        verified: z.boolean().default(false),
      }),
    )
    .optional()
    .default([]),
  competitorInvestments: z
    .array(
      z.object({
        competitorName: z.string(),
        roundStage: z.string().optional(),
        dealYear: z.string().optional(),
        conflictSeverity: z.enum(["DIRECT_CONFLICT", "ADJACENT_COMPETITOR", "NONE"]).default("NONE"),
        notes: z.string().default(""),
        sourceUrl: z.string().optional(),
        verified: z.boolean().default(false),
      }),
    )
    .optional()
    .default([]),
  thesisMatchSummary: z.string().nullable().optional(),
  sourceLinksAudit: z
    .array(
      z.object({
        url: z.string(),
        status: z.number().int(),
        ok: z.boolean(),
        latencyMs: z.number(),
        testedAt: z.string(),
        cachedPageId: z.string().optional(),
        cachedTitle: z.string().optional(),
        cachedSnippet: z.string().optional(),
        error: z.string().optional(),
      }),
    )
    .optional()
    .default([]),

  gatingFactor: z.string().nullable().optional(),
  typicalTurnaroundWeeks: z.number().int().nullable().optional(),
  applicationRoute: z.enum(["OPEN_PORTAL", "SCOUT_FORM", "WARM_INTRO", "ACCELERATOR_COHORT"]).optional().default("WARM_INTRO"),
  applicationUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional().describe("Official firm website URL (e.g. https://www.phoenixcourt.vc/)"),
  contactEmail: z.string().nullable().optional().describe("General contact, pitch inbox, or partner email address"),
  headquarters: z.string().nullable().optional().describe("Office address, city or country of primary fund operations"),
  keyContacts: z.array(KeyContactSchema).optional().default([]).describe("Key partners, investment directors, or sector leads"),
  confidence: z.enum(["VERIFIED_SITE", "VERIFIED_SECONDARY", "UNVERIFIED_NEEDS_CHECK"]).optional().default("VERIFIED_SECONDARY"),
  sources: z.array(z.string()).optional().default([]),
  notes: z.string().nullable().optional(),
  documentsRequired: z.array(
    z.object({
      code: z.string(),
      note: z.string().nullable().optional(),
    }),
  ).optional().default([]),
});
export type StartupInvestorDTO = z.infer<typeof StartupInvestorSchema>;
export type StartupInvestorInput = z.input<typeof StartupInvestorSchema>;

export const StartupInvestorStructuringSchema = StartupInvestorSchema.omit({
  sourceLinksAudit: true,
});
export type StartupInvestorStructuringDTO = z.infer<typeof StartupInvestorStructuringSchema>;
