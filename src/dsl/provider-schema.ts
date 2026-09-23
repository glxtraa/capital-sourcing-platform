/**
 * Zod mirror of the Provider model — what the research agent (the
 * productionized `capital-provider-research` skill) must emit, whether
 * refreshing an existing row or proposing a brand-new provider.
 */
import { z } from "zod";
import { FinancingStructureType } from "./schema";

export const ProviderType = z.enum([
  "BANK",
  "SPECIALIST_FACTOR",
  "MARKETPLACE",
  "ENTERPRISE_SCF_PLATFORM",
  "TRADE_FINANCE_FUND",
]);

export const ProviderConfidence = z.enum([
  "VERIFIED_SITE",
  "VERIFIED_SECONDARY",
  "UNVERIFIED_NEEDS_CHECK",
]);

export const ProviderDocumentRequirementSchema = z.object({
  code: z.string(),
  note: z.string().nullable(),
});

export const ProviderSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "stable lowercase-kebab slug, never reused after deletion")
    .describe('e.g. "incomlend", "bni-structured-trade-finance"'),
  name: z.string(),
  type: ProviderType,
  product: z.string(),
  recourse: z.enum(["recourse", "non_recourse", "both", "not_applicable"]).nullable(),
  sellerJurisdictions: z.array(z.string()).describe('"any" is a literal member when unrestricted'),
  obligorJurisdictions: z.array(z.string()),
  currencies: z.array(z.string()),
  minTicketUsd: z.number().nullable(),
  maxTicketUsd: z.number().nullable(),
  typicalMinAnnualVolumeUsd: z.number().nullable(),
  gatingFactor: z
    .string()
    .nullable()
    .describe("The #1 reason a deal gets excluded, if any — there is almost always one; find it."),
  feeNotes: z.string().nullable(),
  documentsRequired: z.array(ProviderDocumentRequirementSchema),
  applicationProcess: z.string().nullable(),
  applicationUrl: z.string().nullable(),
  contact: z.string().nullable(),
  timeToTermSheet: z.string().nullable(),
  confidence: ProviderConfidence,
  lastVerified: z.string().nullable().describe("ISO date"),
  sources: z.array(z.string()),
  notes: z.string().nullable(),
  financingStructuresSupported: z.array(FinancingStructureType).default([]),
});
export type ProviderDTO = z.infer<typeof ProviderSchema>;
