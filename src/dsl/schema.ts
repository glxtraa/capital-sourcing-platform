/**
 * The Deal Spec DSL.
 *
 * This is the "DSL-like template" the extraction agent must fill in from a
 * borrower's unstructured documents. It is deliberately the SAME shape as
 * prisma/schema.prisma's Deal/Party/FinancingAsk/RiskFlag models — this file
 * is the runtime-validated boundary between "whatever the LLM produced" and
 * "what we're willing to write into the database."
 *
 * Design rule: every field the extraction agent can't confidently determine
 * should be `null`/omitted with a `confidence` note nearby, never guessed.
 * This mirrors the manual system's hard rule ("never fabricate a fee,
 * minimum, or document requirement") applied to deal extraction instead of
 * provider research.
 */
import { z } from "zod";

export const FinancingStructureType = z.enum([
  "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
  "PRE_SHIPMENT_PROCUREMENT_FINANCE",
  "PRE_EXPORT_BORROWING_BASE",
  "ENTERPRISE_SCF_REVERSE_FACTORING",
  "UNKNOWN",
]);
export type FinancingStructureType = z.infer<typeof FinancingStructureType>;

export const PartyRole = z.enum([
  "BORROWER",
  "OBLIGOR",
  "SUPPLIER",
  "INTERMEDIARY",
  "GUARANTOR",
]);
export type PartyRole = z.infer<typeof PartyRole>;

export const RiskFlagCategory = z.enum([
  "CHAIN_OF_TITLE",
  "CURRENCY_MISMATCH",
  "QUANTITY_OR_TERM_MISMATCH",
  "DOCUMENTARY_FRAUD_PATTERN",
  "STALE_DEADLINE",
  "MISSING_DOCUMENT",
  "OTHER",
]);
export type RiskFlagCategory = z.infer<typeof RiskFlagCategory>;

export const PartySchema = z.object({
  role: PartyRole,
  legalName: z.string().min(1),
  jurisdiction: z.string().nullable().optional(),
  isListed: z.boolean().nullable().optional(),
  publicRating: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  /**
   * Chain-of-title fields — only meaningful when role === "INTERMEDIARY".
   * Populate whenever a party holds a transport/trading/sale permit on a
   * licensed resource (mining, agriculture concession, quota, etc.) rather
   * than the primary right itself. See PT KEM's worked example: its coal
   * supplier held an IUP-OPK (transport/sale only) and sourced from a
   * separate mining-IUP holder — the extraction agent found this by reading
   * the permit numbers explicitly named in the contract, not by inference.
   */
  primaryRightHolderName: z.string().nullable().optional(),
  primaryRightHolderVerified: z.boolean().default(false),
  /** Which source document(s) this party's data came from, for audit. */
  sourceDocuments: z.array(z.string()).default([]),
});
export type Party = z.infer<typeof PartySchema>;

export const FinancingAskSchema = z.object({
  structureType: FinancingStructureType,
  structureTypeConfidence: z
    .enum(["sourced_from_client_framing", "inferred_from_contract_terms", "low_confidence_guess"])
    .nullable()
    .optional()
    .describe(
      "How the structure type was determined — e.g. the borrower explicitly said " +
        "'fund me between buying and selling' (sourced_from_client_framing), or it was " +
        "inferred from payment-term mismatches across two contracts (inferred_from_contract_terms).",
    ),
  amount: z.number().nullable().optional(),
  currency: z.string().length(3).nullable().optional().describe("ISO 4217, e.g. USD, IDR, JPY"),
  advanceRatePct: z.number().min(0).max(100).nullable().optional(),
  tenorDaysMin: z.number().int().nullable().optional(),
  tenorDaysMax: z.number().int().nullable().optional(),
  tenorNote: z
    .string()
    .nullable()
    .optional()
    .describe("Say explicitly if a tenor figure is provisional pending a fact not yet known " +
      "(e.g. PT KEM's shipping transit time was never stated in any contract)."),
  recurring: z.boolean().default(false),
  recurringNote: z.string().nullable().optional(),
});
export type FinancingAsk = z.infer<typeof FinancingAskSchema>;

export const RiskFlagSchema = z.object({
  category: RiskFlagCategory,
  severity: z.number().int().min(1).max(5),
  description: z.string().min(1),
});
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

/**
 * What one extraction pass over ONE uploaded document should return. The
 * merge step (see agents/extraction-agent.ts) combines several of these
 * (one per file) into a single DealSpec, preferring the highest-confidence
 * value whenever two documents disagree and recording the disagreement as a
 * QUANTITY_OR_TERM_MISMATCH risk flag rather than silently picking one.
 */
export const DocumentExtractionSchema = z.object({
  documentSummary: z.string().describe("One or two sentences: what this document is."),
  parties: z.array(PartySchema),
  financingAsks: z.array(FinancingAskSchema),
  riskFlags: z.array(RiskFlagSchema),
  /**
   * Which Standard Document Taxonomy code(s) (see STANDARD_DOCUMENT_TAXONOMY
   * below) this document satisfies, e.g. a sale contract -> ["DEAL_CONTRACT"],
   * a certificate of incorporation -> ["CORP_INCORP"]. Used to check which of
   * a matched provider's required documents are already covered by what's
   * been uploaded to this deal. Prefer an existing taxonomy code; only
   * introduce a new SCREAMING_SNAKE_CASE code if genuinely none fit.
   */
  documentTypes: z.array(z.string()).default([]),
  /** Raw notes the agent wants a human or a later pass to see verbatim. */
  openQuestions: z.array(z.string()).default([]),
});
export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

/**
 * The merged, deal-level spec — this is the actual "DSL document" a human
 * reviews and edits in the UI before matching runs. Structurally identical
 * to the manual system's `Capital_Sourcing/deal_profile.json` files, just
 * schema-validated instead of hand-written.
 */
export const DealSpecSchema = z.object({
  dealId: z.string(),
  name: z.string(),
  parties: z.array(PartySchema),
  financingAsks: z.array(FinancingAskSchema),
  riskFlags: z.array(RiskFlagSchema),
  readyForMatching: z
    .boolean()
    .describe(
      "False if any financingAsk has structureType UNKNOWN, any party critical to " +
        "matching (BORROWER, OBLIGOR) is missing a jurisdiction, or an unresolved " +
        "CHAIN_OF_TITLE risk flag exists with severity >= 4.",
    ),
});
export type DealSpec = z.infer<typeof DealSpecSchema>;

/** Standard Document Taxonomy codes — kept as a plain string union rather
 * than a closed enum so `capital-provider-research`-equivalent agent runs
 * can introduce a new jurisdiction-specific code (as happened with
 * DEAL_LHV/DEAL_IUP_CHAIN/DEAL_ROYALTY_PNBP for Indonesian coal) without a
 * schema migration. This list is the SEED set, ported verbatim from
 * Capital_Sourcing_System/providers_db/schema.md. */
export const STANDARD_DOCUMENT_TAXONOMY = [
  "CORP_INCORP",
  "CORP_STRUCTURE",
  "CORP_UBO",
  "ID_DIRECTOR",
  "ID_ADDRESS",
  "FIN_STATEMENTS",
  "FIN_BANK_STATEMENTS",
  "DEAL_INVOICE",
  "DEAL_CONTRACT",
  "DEAL_POD",
  "DEAL_OBLIGOR_INFO",
  "DEAL_AGING",
  "BANK_ACCOUNT",
  "AML_SOF",
  "APP_FORM",
  "CREDIT_APP",
  "GUARANTEE",
  "DEAL_BL",
  "DEAL_WR",
  "DEAL_LC",
  "DEAL_COO",
  "DEAL_INSPECTION",
  "DEAL_INSURANCE",
  "DEAL_IUP_CHAIN",
  "DEAL_LHV",
  "DEAL_ROYALTY_PNBP",
  "DEAL_DRAFT_SURVEY",
  "DEAL_SHIPPING_INSTRUCTION",
] as const;
export type StandardDocumentCode = (typeof STANDARD_DOCUMENT_TAXONOMY)[number] | string;
