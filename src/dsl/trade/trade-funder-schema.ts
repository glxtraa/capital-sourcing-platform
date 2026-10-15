import { z } from "zod";
import { TradeCorridor } from "./trade-extraction-schema";

export const TradeFunderType = z.enum([
  "COMMODITY_TRADE_FINANCE_BANK",
  "SPECIALIST_TRADE_FUND",
  "PRIVATE_CREDIT_FUND",
  "TRADING_HOUSE_FINANCE_DESK",
  "SPECIALIST_FACTOR_FORFAITER",
  "ECA_OR_DEVELOPMENT_BANK"
]);
export type TradeFunderType = z.infer<typeof TradeFunderType>;

export const PricingProvenanceSchema = z.object({
  derivationType: z.enum([
    "PUBLISHED_TARIFF",
    "DESK_TERM_SHEET",
    "MARKET_BENCHMARK",
    "BROKER_SURVEY",
    "OFFICIAL_DISCLOSURE",
    "UNPUBLISHED_BILATERAL_ESTIMATE"
  ]).default("UNPUBLISHED_BILATERAL_ESTIMATE"),
  evidenceSnippet: z.string().describe("Verbatim excerpt or quoted text from the page/tariff confirming the rate"),
  sourceDocumentOrUrl: z.string().describe("Direct URL or document path where evidence was found"),
  sourcePageTitle: z.string().optional().describe("Clean title of the page or document"),
  crawledAt: z.string().optional().describe("ISO timestamp when spider crawled the page"),
  spiderEngine: z.string().default("Web-Search + LLM Extractor"),
  regulatoryFilingReference: z.string().optional().describe("Regulatory filing or official disclosure reference (e.g. SEC Form 20-F, OJK SBDK Filing, Central Bank Return)"),
  contextParagraph: z.string().optional().describe("Full surrounding paragraph / section containing the rate evidence in complete context"),
  cachedSnapshotText: z.string().optional().describe("Full cached raw text snapshot of the crawled source section"),
  archiveUrl: z.string().optional().describe("Permanent archive or secondary reference link (e.g. SEC EDGAR, Wayback Machine, Investor Relations)"),
  cachedAt: z.string().optional().describe("ISO timestamp when this snapshot was cached locally"),
  verificationNavigationGuide: z.string().optional().describe("Step-by-step guidance on how to navigate the cited regulatory filing or bank portal to locate benchmark disclosures"),
  statutoryBenchmarkExplanation: z.string().optional().describe("Explanation of why this rate is structured as an institutional benchmark rather than a retail web price"),
});
export type PricingProvenance = z.infer<typeof PricingProvenanceSchema>;

export const DeskContactsSchema = z.object({
  departmentName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  applicationPortalUrl: z.string().nullable().optional(),
  officeLocation: z.string().nullable().optional(),
});
export type DeskContacts = z.infer<typeof DeskContactsSchema>;

export const ClaimVerificationStatus = z.enum([
  "VERIFIED_IN_SOURCE",
  "FAILED_SNIPPET_NOT_FOUND",
  "FAILED_URL_UNREACHABLE",
  "UNPUBLISHED_ESTIMATE_VERIFIED",
  "NOT_RUN"
]);
export type ClaimVerificationStatus = z.infer<typeof ClaimVerificationStatus>;

export const ClaimVerificationSchema = z.object({
  status: ClaimVerificationStatus.default("NOT_RUN"),
  isHallucinationRisk: z.boolean().default(false),
  confidenceScore: z.number().int().min(0).max(100).default(100),
  sourceUrlTested: z.string().optional(),
  httpStatus: z.number().optional(),
  matchedKeywords: z.array(z.string()).default([]),
  missingKeywords: z.array(z.string()).default([]),
  details: z.string().default(""),
  verifiedAt: z.string().optional(),
});
export type ClaimVerification = z.infer<typeof ClaimVerificationSchema>;

export const FunderValidationDiagnosticSchema = z.object({
  isValid: z.boolean(),
  completenessScorePct: z.number().int().min(0).max(100),
  missingFields: z.array(z.string()).default([]),
  formatErrors: z.array(z.string()).default([]),
  unverifiedClaims: z.array(z.string()).default([]),
  agentDirectives: z.array(z.string()).default([]),
  claimVerification: ClaimVerificationSchema.optional(),
});
export type FunderValidationDiagnostic = z.infer<typeof FunderValidationDiagnosticSchema>;

export const TradeFunderSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  type: TradeFunderType,

  // Facility Scope
  offersUmbrellaFacility: z.boolean().describe("Can fund entire buy-to-sell cycle under one facility"),
  supportedLegs: z.array(z.enum(["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG", "UMBRELLA"])),

  // Corridors & Commodities
  supportedCorridors: z.array(TradeCorridor),
  supportedCommodities: z.array(z.string()),
  excludedCommodities: z.array(z.string()).describe("e.g. ['Thermal Coal' if strict ESG policy]"),

  // Accepted Geographic Jurisdictions
  acceptedSupplierJurisdictions: z.array(z.string()),
  acceptedTraderJurisdictions: z.array(z.string()),
  acceptedBuyerJurisdictions: z.array(z.string()),

  // Ticket Bounds
  minTicketUsd: z.number().nullable().optional(),
  maxTicketUsd: z.number().nullable().optional(),
  typicalMinAnnualTurnoverUsd: z.number().nullable().optional(),
  maxAdvanceRatePct: z.number().nullable().optional(),

  // Pricing Guidance & Strict Provenance
  indicativePricingGuidance: z.string().nullable().optional().describe("e.g. 'SOFR + 350-450 bps'"),
  rateEvidenceSnippet: z.string().nullable().optional().describe("Exact quote or excerpt validating the indicative pricing/rate"),
  pricingProvenance: PricingProvenanceSchema.nullable().optional(),

  // Direct Desk Contacts
  contact: z.string().nullable().optional().describe("Desk email, contact phone, or intake head"),
  applicationUrl: z.string().nullable().optional().describe("Direct web link to funder intake / portal"),
  deskContacts: DeskContactsSchema.nullable().optional(),

  // Security & Document Checklist
  requiredCollateral: z.array(z.string()),
  documentsRequired: z.array(z.object({
    code: z.string(),
    note: z.string().nullable().optional(),
  })),

  gatingFactor: z.string().nullable().optional(),
  confidence: z.enum(["VERIFIED_SITE", "VERIFIED_SECONDARY", "UNVERIFIED_NEEDS_CHECK"]),
  lastVerified: z.string().nullable().optional(),
  sources: z.array(z.string()).describe("Clickable URLs and primary references for funder data"),
  notes: z.string().nullable().optional(),

  // DSL Validation Diagnostic Output
  validationDiagnostics: FunderValidationDiagnosticSchema.optional(),
});
export type TradeFunderDTO = z.infer<typeof TradeFunderSchema>;

/**
 * Validates a TradeFunder record against the DSL rules.
 * Generates actionable missing-field gaps, formatting errors, and agent directives
 * so research and structuring agents immediately know what needs further research.
 */
export function validateTradeFunderDSL(funder: Partial<TradeFunderDTO>): FunderValidationDiagnostic {
  const missingFields: string[] = [];
  const formatErrors: string[] = [];
  const unverifiedClaims: string[] = [];
  const agentDirectives: string[] = [];

  // 1. Mandatory Core Identity
  if (!funder.name || funder.name.trim().length === 0) {
    missingFields.push("name");
  }
  if (!funder.id || !/^[a-z0-9-]+$/.test(funder.id)) {
    formatErrors.push("id must be a lowercase kebab-case slug (e.g. 'bni-trade-desk')");
  }

  // 2. Pricing & Evidence Provenance Check (Anti-Hallucination Guardrails)
  if (funder.indicativePricingGuidance && funder.indicativePricingGuidance.trim().length > 0) {
    const isCommercialBankOrFund =
      funder.type === "COMMODITY_TRADE_FINANCE_BANK" ||
      funder.type === "SPECIALIST_TRADE_FUND" ||
      funder.type === "PRIVATE_CREDIT_FUND";
    const derivation = funder.pricingProvenance?.derivationType;
    const snippet = funder.rateEvidenceSnippet || funder.pricingProvenance?.evidenceSnippet || "";

    // Guardrail A: Commercial banks do not publish bilateral spread tariffs online
    if (isCommercialBankOrFund && derivation === "PUBLISHED_TARIFF") {
      unverifiedClaims.push(
        `Commercial banks and private funds do not publish bilateral loan spreads on public retail tariffs. ` +
        `'derivationType' must be 'UNPUBLISHED_BILATERAL_ESTIMATE' or 'OFFICIAL_DISCLOSURE' (e.g. SEC 20-F / Central Bank filing), not 'PUBLISHED_TARIFF'.`
      );
      agentDirectives.push(`Update ${funder.name} pricing derivationType to 'UNPUBLISHED_BILATERAL_ESTIMATE' and remove any claim of an online retail tariff card.`);
    }

    // Guardrail B: Detect fabricated quote patterns
    const isFabricatedQuotePattern =
      /bilateral (trade )?lines:\s*sofr/i.test(snippet) ||
      /natural resources & energy desk indicative facility/i.test(snippet) ||
      /indicative facility margin for bulk coal/i.test(snippet);
    if (isFabricatedQuotePattern && derivation !== "UNPUBLISHED_BILATERAL_ESTIMATE") {
      unverifiedClaims.push(
        `Synthesized quote detected: '${snippet.slice(0, 80)}...'. ` +
        `Do not fabricate 'verbatim quotes' from public bank websites. If this is an indicative spread model, derivationType MUST be 'UNPUBLISHED_BILATERAL_ESTIMATE'.`
      );
      agentDirectives.push(`Rephrase rateEvidenceSnippet to state explicitly that the spread is an unpublished bilateral model estimate.`);
    }

    // Guardrail C: Confidence alignment
    if (funder.confidence === "VERIFIED_SITE" && derivation === "UNPUBLISHED_BILATERAL_ESTIMATE") {
      formatErrors.push("Funder confidence cannot be 'VERIFIED_SITE' when pricing is an unpublished bilateral estimate. Must be 'UNVERIFIED_NEEDS_CHECK'.");
    }

    if (!funder.rateEvidenceSnippet && !funder.pricingProvenance?.evidenceSnippet) {
      unverifiedClaims.push("indicativePricingGuidance is stated without rateEvidenceSnippet or pricingProvenance.evidenceSnippet quote");
      agentDirectives.push(`Provide evidence statement or note 'Unpublished Bilateral Rate: ...' for ${funder.name}.`);
    }
    if (!funder.pricingProvenance?.sourceDocumentOrUrl) {
      missingFields.push("pricingProvenance.sourceDocumentOrUrl");
    }
  } else {
    missingFields.push("indicativePricingGuidance");
    agentDirectives.push(`Research indicative SOFR margin or usance discount rate for ${funder.name}.`);
  }

  // 3. Desk Contact & Intake Verification
  const hasEmail = Boolean(funder.contact?.includes("@") || funder.deskContacts?.contactEmail?.includes("@"));
  const hasPhone = Boolean(funder.deskContacts?.phone || (funder.contact && /\+?[0-9\s-]{7,}/.test(funder.contact)));
  const hasPortal = Boolean(
    funder.applicationUrl?.startsWith("http") ||
    funder.deskContacts?.applicationPortalUrl?.startsWith("http")
  );

  if (!hasEmail && !hasPhone && !hasPortal) {
    missingFields.push("deskContacts (no email, phone, or application portal)");
    agentDirectives.push(`Spider ${funder.name} for structured trade finance desk intake email, phone number, or online client portal.`);
  }

  // 4. Source URL Format Verification
  if (!funder.sources || funder.sources.length === 0) {
    missingFields.push("sources");
    agentDirectives.push(`Record at least one verified primary source URL for ${funder.name}.`);
  } else {
    for (const url of funder.sources) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        formatErrors.push(`Invalid source URL format: '${url}' (must begin with http:// or https://)`);
      }
    }
  }

  // 5. Calculate Completeness Score
  let score = 100;
  score -= missingFields.length * 15;
  score -= formatErrors.length * 10;
  score -= unverifiedClaims.length * 15;
  const completenessScorePct = Math.max(0, Math.min(100, score));

  return {
    isValid: missingFields.length === 0 && formatErrors.length === 0 && unverifiedClaims.length === 0,
    completenessScorePct,
    missingFields,
    formatErrors,
    unverifiedClaims,
    agentDirectives,
  };
}
