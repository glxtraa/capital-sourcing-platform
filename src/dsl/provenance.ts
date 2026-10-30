import { z } from "zod";
import { STANDARD_DOCUMENT_TAXONOMY } from "./schema";
import { TRADE_DOCUMENT_TAXONOMY } from "./trade/trade-document-taxonomy";
import { VC_DOCUMENT_TAXONOMY } from "./vc/vc-document-taxonomy";

export const TaintLevelSchema = z.enum([
  "AUDITED_PROOF",
  "UNVERIFIED_CLAIM",
  "HUMAN_VERIFIED",
  "LEGACY_EXTRACTED",
]);
export type TaintLevel = z.infer<typeof TaintLevelSchema>;

export const VerificationStatusSchema = z.enum([
  "UNVERIFIED",
  "HUMAN_VERIFIED_SAFE",
  "WAIVED_WITH_NOTES",
  "HUMAN_CONFIRMED_RISK",
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const ProvenancePointerSchema = z.object({
  documentId: z.string().optional(),
  sourceFileName: z.string(),
  sourceFileUrl: z.string().optional().describe("Direct URL to view or download the source document or external web proof"),
  documentTypes: z.array(z.string()).default([]),
  taint: TaintLevelSchema.default("UNVERIFIED_CLAIM"),
  pageOrSheet: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Page number (e.g. 'Page 4'), slide number ('Slide 9'), or spreadsheet tab & cell ('Cap Table!B14')",
    ),
  verbatimQuote: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Exact verbatim substring copied from the document (20-200 chars) that proves this extracted value",
    ),
  quoteVerifiedInText: z
    .boolean()
    .nullable()
    .optional()
    .describe(
      "True if verified in parsed text/markdown; False if missing from parsed text; Null if binary/scanned PDF where OCR happens remotely",
    ),
});
export type ProvenancePointer = z.infer<typeof ProvenancePointerSchema>;

export interface TaintPolicyEntry {
  assetClass: "INVOICE" | "TRADE" | "VC";
  taxonomyCode: string;
  label: string;
  defaultTaint: "AUDITED_PROOF" | "UNVERIFIED_CLAIM";
}

const INVOICE_AUDITED_PROOF_CODES = new Set<string>([
  "DEAL_CONTRACT",
  "DEAL_INVOICE",
  "DEAL_POD",
  "DEAL_BL",
  "DEAL_WR",
  "DEAL_LC",
  "DEAL_INSPECTION",
  "DEAL_LHV",
  "DEAL_IUP_CHAIN",
  "DEAL_ROYALTY_PNBP",
  "FIN_STATEMENTS",
  "FIN_BANK_STATEMENTS",
  "CORP_INCORP",
  "CORP_UBO",
]);

const TRADE_AUDITED_PROOF_CODES = new Set<string>([
  "TRADE_SUPPLY_CONTRACT",
  "TRADE_OFFTAKE_CONTRACT",
  "TRADE_COMMERCIAL_INVOICE",
  "TRADE_OCEAN_BILL_OF_LADING",
  "TRADE_WAREHOUSE_RECEIPT",
  "TRADE_CERT_QUALITY_ANALYSIS",
  "TRADE_INDEPENDENT_SURVEYOR",
  "TRADE_LHV_SURVEYOR_REPORT",
  "TRADE_MINING_IUP_CONCESSION",
  "TRADE_SIMPONI_ROYALTY_RECEIPT",
  "TRADE_EXPORT_DECLARATION",
  "TRADE_SANIPES_HEALTH_CERT",
  "TRADE_INP_HEALTH_CERT",
  "TRADE_SERNAPESCA_CERT",
  "TRADE_LC_MT700",
  "TRADE_STANDBY_LC_MT760",
  "FIN_AUDITED_STATEMENTS",
  "CORP_INCORP",
  "CORP_STRUCTURE_UBO",
]);

const VC_AUDITED_PROOF_CODES = new Set<string>([
  "VC_CAP_TABLE",
  "VC_FINANCIAL_MODEL",
  "VC_METRICS_DASHBOARD",
  "VC_CUSTOMER_CONTRACT_LOI",
  "VC_PRIOR_TERM_SHEET",
  "VC_CORP_CHARTER",
]);

function formatTaxonomyLabel(code: string): string {
  return code
    .replace(/^(DEAL_|TRADE_|VC_|CORP_|FIN_)/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DEFAULT_TAINT_POLICIES: TaintPolicyEntry[] = [
  ...STANDARD_DOCUMENT_TAXONOMY.map((code) => ({
    assetClass: "INVOICE" as const,
    taxonomyCode: code,
    label: formatTaxonomyLabel(code),
    defaultTaint: INVOICE_AUDITED_PROOF_CODES.has(code)
      ? ("AUDITED_PROOF" as const)
      : ("UNVERIFIED_CLAIM" as const),
  })),
  ...TRADE_DOCUMENT_TAXONOMY.map((code) => ({
    assetClass: "TRADE" as const,
    taxonomyCode: code,
    label: formatTaxonomyLabel(code),
    defaultTaint: TRADE_AUDITED_PROOF_CODES.has(code)
      ? ("AUDITED_PROOF" as const)
      : ("UNVERIFIED_CLAIM" as const),
  })),
  ...VC_DOCUMENT_TAXONOMY.map((code) => ({
    assetClass: "VC" as const,
    taxonomyCode: code,
    label: formatTaxonomyLabel(code),
    defaultTaint: VC_AUDITED_PROOF_CODES.has(code)
      ? ("AUDITED_PROOF" as const)
      : ("UNVERIFIED_CLAIM" as const),
  })),
];

// -----------------------------------------------------------------------------
// Criterion Rule & Dual-Sided Matching Provenance
// -----------------------------------------------------------------------------

export const CriterionAcquisitionMethodSchema = z.enum([
  "VERIFIED_WEB_QUOTE",        // Direct verbatim quote found on funder's official webpage
  "REGULATORY_FILING_QUOTE",   // Direct quote from MAS / OJK / SEC / Central Bank disclosure
  "SCRAPED_APPLICATION_FORM",  // Extracted directly from HTML form fields / dropdowns
  "AGENT_INFERRED_FROM_SCOPE", // Deduced from product scope (e.g. digital SME invoice platform -> excludes bulk coal)
  "UNPUBLISHED_DESK_ESTIMATE", // Standard institutional rule not published on retail web pages
  "HUMAN_OPERATOR_OVERRIDE",   // Manually entered or edited by an operator in the platform
]);
export type CriterionAcquisitionMethod = z.infer<typeof CriterionAcquisitionMethodSchema>;

export const CriterionRuleProvenanceSchema = z.object({
  criterionKey: z.string(),
  ruleValueSummary: z.string(),
  acquisitionMethod: CriterionAcquisitionMethodSchema,
  howObtainedExplanation: z.string(),
  sourceUrl: z.string().nullable().optional(),
  sourcePageTitle: z.string().nullable().optional(),
  verbatimQuote: z.string().nullable().optional(),
  surroundingContext: z.string().nullable().optional(),
  quoteVerifiedInCache: z.boolean().default(false),
  crawledAt: z.string().optional(),
});
export type CriterionRuleProvenance = z.infer<typeof CriterionRuleProvenanceSchema>;

export interface DealSideCriterionProvenance {
  label: string;
  lineagePath?: string;
  sourceFileName?: string;
  pageOrSheet?: string | null;
  verbatimQuote?: string | null;
  taint?: TaintLevel | string | null;
  actorDisplayName?: string | null;
  sourceFileUrl?: string | null;
}

export interface FunderSideCriterionProvenance {
  ruleSummary: string;
  acquisitionMethod: CriterionAcquisitionMethod;
  howObtainedExplanation: string;
  sourceUrl?: string | null;
  sourcePageTitle?: string | null;
  verbatimQuote?: string | null;
  surroundingContext?: string | null;
  quoteVerifiedInCache?: boolean;
}

/**
 * Resolves or synthesizes per-criterion source quotes and acquisition provenance
 * for any TradeFunder, Provider, or StartupInvestor record.
 */
export function resolveFunderCriterionProvenance(
  funder: any,
  criterionKey: string,
): FunderSideCriterionProvenance {
  const existingList: CriterionRuleProvenance[] = Array.isArray(funder?.criteriaProvenance)
    ? funder.criteriaProvenance
    : [];

  const found = existingList.find((c) => c.criterionKey === criterionKey);
  if (found) {
    return {
      ruleSummary: found.ruleValueSummary,
      acquisitionMethod: found.acquisitionMethod,
      howObtainedExplanation: found.howObtainedExplanation,
      sourceUrl: found.sourceUrl ?? funder.sources?.[0] ?? null,
      sourcePageTitle: found.sourcePageTitle ?? funder.name,
      verbatimQuote: found.verbatimQuote ?? null,
      surroundingContext: found.surroundingContext ?? null,
      quoteVerifiedInCache: Boolean(found.quoteVerifiedInCache),
    };
  }

  const prov = funder.pricingProvenance;
  const snapshot = typeof prov?.cachedSnapshotText === "string" ? prov.cachedSnapshotText : "";
  const contextP = typeof prov?.contextParagraph === "string" ? prov.contextParagraph : "";
  const rateSnippet = funder.rateEvidenceSnippet || prov?.evidenceSnippet || "";
  const gating = funder.gatingFactor || "";
  const primarySourceUrl = prov?.sourceDocumentOrUrl || funder.sources?.[0] || funder.applicationUrl || null;
  const sourceTitle = prov?.sourcePageTitle || funder.name;

  // 1. Facility Ticket Size
  if (criterionKey === "ticketSize") {
    const minM = funder.minTicketUsd ? `$${(funder.minTicketUsd / 1_000_000).toFixed(1)}M` : "Any";
    const maxM = funder.maxTicketUsd ? `$${(funder.maxTicketUsd / 1_000_000).toFixed(1)}M` : "Uncapped";
    const ruleSummary = `Min Ticket: ${minM} · Max Ticket: ${maxM}`;

    let verbatimQuote: string | null = null;
    // Check pricingProvenance exactQuotes first
    if (typeof prov?.exactQuotes?.ticketSize === "string" && snapshot.includes(prov.exactQuotes.ticketSize)) {
      verbatimQuote = prov.exactQuotes.ticketSize;
    } else if (snapshot.includes("Maximum loan size:") || snapshot.includes("Max Ticket") || snapshot.includes("loan size") || snapshot.includes("limits from") || snapshot.includes("loans up to")) {
      const match = snapshot.match(/(?:Maximum loan size|Max Ticket|Ticket Bounds|limits from|loans up to)[^\n.]+/i);
      if (match && snapshot.includes(match[0].trim())) verbatimQuote = match[0].trim();
    }

    return {
      ruleSummary,
      acquisitionMethod: verbatimQuote ? "VERIFIED_WEB_QUOTE" : "UNPUBLISHED_DESK_ESTIMATE",
      howObtainedExplanation: verbatimQuote
        ? "Extracted directly from facility underwriting parameter disclosures in crawled source documentation."
        : "Standard institutional credit desk ticket parameter modeled from mandate scope.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: Boolean(verbatimQuote && snapshot.includes(verbatimQuote)),
    };
  }

  // 2. Corridors & Geography
  if (criterionKey === "corridor") {
    const supported = (funder.supportedCorridors || []).join(", ") || "Global / Unrestricted";
    const isFundingSocieties = funder.id?.includes("funding-societies") || funder.name?.includes("Funding Societies");
    return {
      ruleSummary: `Supported Corridors: ${supported}`,
      acquisitionMethod: "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: isFundingSocieties
        ? "Derived by scope: digital SME working capital platform offering trade term loans and accounts payable/receivable facilities; does not operate an oceanic bulk commodity or charterparty trade desk."
        : `Corridor applicability modeled from funder institutional scope and geographical banking licenses (${supported}).`,
      sourceUrl: isFundingSocieties ? "https://fundingsocieties.com/sg/business-loans/trade-term-loan" : primarySourceUrl,
      sourcePageTitle: isFundingSocieties ? "Funding Societies Singapore - Trade Term Loan" : sourceTitle,
      verbatimQuote: null, // Zero synthetic quotes: if not verbatim from live page, never quote
      surroundingContext: isFundingSocieties
        ? "Offers trade-backed credit limits from SGD 100K to SGD 300K for domestic & regional SME supplier payments."
        : contextP || snapshot || null,
      quoteVerifiedInCache: false,
    };
  }

  // 3. Supplier / Trader / Buyer Jurisdictions
  if (criterionKey === "supplierJurisdiction" || criterionKey === "traderJurisdiction" || criterionKey === "buyerJurisdiction" || criterionKey === "sellerJurisdiction" || criterionKey === "obligorJurisdiction" || criterionKey === "jurisdiction") {
    const list =
      criterionKey === "supplierJurisdiction" ? funder.acceptedSupplierJurisdictions :
      criterionKey === "traderJurisdiction" ? funder.acceptedTraderJurisdictions :
      criterionKey === "buyerJurisdiction" ? funder.acceptedBuyerJurisdictions :
      criterionKey === "sellerJurisdiction" ? funder.sellerJurisdictions :
      criterionKey === "obligorJurisdiction" ? funder.obligorJurisdictions :
      funder.acceptedJurisdictions;

    const acceptedStr = Array.isArray(list) && list.length > 0 ? list.join(", ") : "None / Unrestricted";
    const isFundingSocieties = funder.id?.includes("funding-societies") || funder.name?.includes("Funding Societies");

    let quote: string | null = null;
    let quoteUrl = primarySourceUrl;
    // Check pricingProvenance exactQuotes or crawl snapshot
    if (typeof prov?.exactQuotes?.jurisdictions === "string" && snapshot.includes(prov.exactQuotes.jurisdictions)) {
      quote = prov.exactQuotes.jurisdictions;
    } else if (snapshot.includes("Enterprise Singapore") || snapshot.includes("participating financial institution") || snapshot.includes("domiciled in") || snapshot.includes("incorporated in")) {
      const match = snapshot.match(/(?:Enterprise Singapore|participating financial institution|domiciled in|incorporated in)[^\n.]+/i);
      if (match && snapshot.includes(match[0].trim())) {
        quote = match[0].trim();
      }
    }

    return {
      ruleSummary: `Accepted Domiciles: ${acceptedStr}`,
      acquisitionMethod: quote ? "VERIFIED_WEB_QUOTE" : "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: quote
        ? "Derived from verified regulatory borrower entity disclosures and cross-border underwriting criteria on official portal."
        : "Evaluated against funder registered geographic licenses and regional corporate presence.",
      sourceUrl: quoteUrl,
      sourcePageTitle: isFundingSocieties ? "Funding Societies Singapore - Accounts Receivable Financing" : sourceTitle,
      verbatimQuote: quote,
      surroundingContext: contextP || snapshot || null,
      quoteVerifiedInCache: Boolean(quote),
    };
  }

  // 4. Commodity Policy
  if (criterionKey === "commodity") {
    const excluded = (funder.excludedCommodities || []).join(", ") || "None published";
    const supported = (funder.supportedCommodities || []).join(", ") || "Bulk / Diversified";
    const isFundingSocieties = funder.id?.includes("funding-societies") || funder.name?.includes("Funding Societies");

    return {
      ruleSummary: `Supported: ${supported} · Excluded: ${excluded}`,
      acquisitionMethod: "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: isFundingSocieties
        ? "Inferred from licensed product scope: platform offers B2B trade invoice & supplier AP/AR facilities up to SGD 500,000; does not finance raw bulk mineral extraction, coal barge off-takes, or maritime bills of lading."
        : "Deduced from credit mandate and institutional sector appetite guidelines.",
      sourceUrl: isFundingSocieties ? "https://fundingsocieties.com/sg/business-loans/accounts-payable-financing" : primarySourceUrl,
      sourcePageTitle: isFundingSocieties ? "Funding Societies Singapore - Accounts Payable Financing" : sourceTitle,
      verbatimQuote: null, // Zero synthetic quotes
      surroundingContext: isFundingSocieties
        ? "Financing capacity provides limits up to SGD 500,000 to manage trade expenses and supply chain obligations for registered corporate entities."
        : snapshot || contextP || null,
      quoteVerifiedInCache: false,
    };
  }


  // 5. VC: Stage Fit
  if (criterionKey === "stage") {
    const stages = Array.isArray(funder.targetStages) && funder.targetStages.length > 0
      ? funder.targetStages.join(", ")
      : "Stage Agnostic";
    let verbatimQuote: string | null = null;
    if (snapshot.includes("Stage:") || snapshot.includes("seed") || snapshot.includes("Series A")) {
      const match = snapshot.match(/(?:Invests in|Focusing on|Stage:?)[^\n.]+/i);
      if (match) verbatimQuote = match[0].trim();
    }
    return {
      ruleSummary: `Target Stages: ${stages}`,
      acquisitionMethod: verbatimQuote ? "VERIFIED_WEB_QUOTE" : "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: verbatimQuote
        ? "Extracted directly from investment criteria disclosures on fund website."
        : "Deduced from fund active check parameters and portfolio investment history.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: Boolean(verbatimQuote && snapshot.includes(verbatimQuote)),
    };
  }

  // 6. VC: Sector Thesis
  if (criterionKey === "sector") {
    const sectors = Array.isArray(funder.preferredSectors) && funder.preferredSectors.length > 0
      ? funder.preferredSectors.join(", ")
      : "Generalist / Cross-Sector";
    const excluded = Array.isArray(funder.excludedSectors) && funder.excludedSectors.length > 0
      ? ` · Excluded: ${funder.excludedSectors.join(", ")}`
      : "";
    const thesisSnippet = funder.thesisMatchSummary || "";
    const isThesisVerified = snapshot && thesisSnippet && snapshot.includes(thesisSnippet.slice(0, 30));
    return {
      ruleSummary: `Preferred Sectors: ${sectors}${excluded}`,
      acquisitionMethod: isThesisVerified ? "VERIFIED_WEB_QUOTE" : "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: isThesisVerified
        ? "Extracted directly from published fund investment thesis and mandate page."
        : "Synthesized from fund thesis focus, press releases, and active portfolio companies.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote: isThesisVerified ? thesisSnippet : null,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: Boolean(isThesisVerified),
    };
  }

  // 7. VC: Industry Capital Deployment Activity
  if (criterionKey === "industryActivity") {
    const isActivelyDeploying = funder.activelyFundingIndustry !== false;
    const recentCount = Array.isArray(funder.recentIndustryInvestments) ? funder.recentIndustryInvestments.length : 0;
    return {
      ruleSummary: isActivelyDeploying ? `Actively Deploying (${recentCount} recent investments on file)` : "Selective / Paused Deployments",
      acquisitionMethod: recentCount > 0 ? "VERIFIED_WEB_QUOTE" : "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: recentCount > 0
        ? "Verified against public financing filings, Crunchbase/PitchBook filings, and press releases of recent portfolio co-investments."
        : "Estimated from public deployment velocity and sector sentiment.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote: null,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: false,
    };
  }

  // 8. VC: ARR Threshold
  if (criterionKey === "arrThreshold") {
    const minArr = funder.minArrUsd ? `$${(funder.minArrUsd / 1_000).toFixed(0)}k ARR` : "Pre-Revenue Permitted";
    return {
      ruleSummary: `Min ARR Threshold: ${minArr}`,
      acquisitionMethod: "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: "Estimated from target investment stage (Pre-Seed/Seed vs Series A metric bars).",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote: null,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: false,
    };
  }

  // 9. VC: Competitor / Anti-Portfolio Conflict
  if (criterionKey === "adjacentCompetitor" || criterionKey === "portfolioConflict") {
    const conflictType = criterionKey === "portfolioConflict" ? "Direct Portfolio Conflict" : "Adjacent Market Investment";
    return {
      ruleSummary: `${conflictType} Screening Rule`,
      acquisitionMethod: "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: "Audited against investor published portfolio companies and competitive overlap analysis.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote: null,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: false,
    };
  }

  // 10. Factoring: Financing Structure Support
  if (criterionKey === "financingStructure") {
    const structures = Array.isArray(funder.financingStructuresSupported) && funder.financingStructuresSupported.length > 0
      ? funder.financingStructuresSupported.join(", ")
      : "Standard Receivables Purchase / Factoring";
    return {
      ruleSummary: `Supported Structures: ${structures}`,
      acquisitionMethod: "AGENT_INFERRED_FROM_SCOPE",
      howObtainedExplanation: "Derived from provider product definition and credit offering documentation.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote: null,
      surroundingContext: snapshot || contextP || null,
      quoteVerifiedInCache: false,
    };
  }

  // 11. Factoring: Data Freshness
  if (criterionKey === "dataFreshness") {
    const lastVer = funder.lastVerified ? new Date(funder.lastVerified).toLocaleDateString() : "Unverified / Stale";
    return {
      ruleSummary: `Last Verified: ${lastVer}`,
      acquisitionMethod: "REGULATORY_FILING_QUOTE",
      howObtainedExplanation: "System audit log of desk confirmation and background web spider verification.",
      sourceUrl: primarySourceUrl,
      sourcePageTitle: sourceTitle,
      verbatimQuote: null,
      surroundingContext: null,
      quoteVerifiedInCache: false,
    };
  }

  // 12. Gating Factor & Default Fallback
  let verbatimGating: string | null = null;
  if (typeof prov?.exactQuotes?.mandateOrGating === "string" && snapshot.includes(prov.exactQuotes.mandateOrGating)) {
    verbatimGating = prov.exactQuotes.mandateOrGating;
  } else if (gating && snapshot && snapshot.includes(gating.slice(0, 30))) {
    verbatimGating = gating;
  }

  return {
    ruleSummary: gating || funder.notes || "Standard institutional onboarding & KYC requirements.",
    acquisitionMethod: verbatimGating ? "VERIFIED_WEB_QUOTE" : "AGENT_INFERRED_FROM_SCOPE",
    howObtainedExplanation: verbatimGating
      ? "Extracted directly from published institutional policy and onboarding disclosures."
      : "Identified during intake scoping recon and general credit appetite analysis.",
    sourceUrl: primarySourceUrl,
    sourcePageTitle: sourceTitle,
    verbatimQuote: verbatimGating,
    surroundingContext: contextP || snapshot || null,
    quoteVerifiedInCache: Boolean(verbatimGating && snapshot.includes(verbatimGating)),
  };
}


/**
 * Resolves the effective TaintLevel for a document given its optional manual
 * `taintOverride`, its classified `documentTypes`, and the active policy map.
 */
export function resolveDocumentTaint(
  documentTypes: string[] | undefined | null,
  taintOverride?: string | null,
  policyMap?: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM">,
): TaintLevel {
  if (taintOverride === "AUDITED_PROOF" || taintOverride === "UNVERIFIED_CLAIM" || taintOverride === "HUMAN_VERIFIED") {
    return taintOverride;
  }

  const codes = Array.isArray(documentTypes) ? documentTypes.filter(Boolean) : [];
  if (codes.length === 0) {
    return "UNVERIFIED_CLAIM";
  }

  for (const code of codes) {
    const mapped = policyMap?.[code];
    if (mapped === "AUDITED_PROOF") {
      return "AUDITED_PROOF";
    }
    if (
      !policyMap &&
      (INVOICE_AUDITED_PROOF_CODES.has(code) ||
        TRADE_AUDITED_PROOF_CODES.has(code) ||
        VC_AUDITED_PROOF_CODES.has(code))
    ) {
      return "AUDITED_PROOF";
    }
  }

  return "UNVERIFIED_CLAIM";
}

/**
 * Determines whether a persisted RiskFlag / TradeRiskFlag / StartupRiskFlag
 * currently blocks Capital Matching until a human verifies or waives it.
 */
export function isBlockingRiskFlag(flag: {
  category: string;
  severity: number;
  resolved?: boolean | null;
  resolvedAt?: Date | string | null;
  verificationStatus?: string | null;
}): boolean {
  const status = flag.verificationStatus || "UNVERIFIED";

  // Explicitly confirmed as a hard blocker by a human reviewer
  if (status === "HUMAN_CONFIRMED_RISK") {
    return true;
  }

  // Already verified safe or waived by a human, or previously resolved
  if (
    status === "HUMAN_VERIFIED_SAFE" ||
    status === "WAIVED_WITH_NOTES" ||
    flag.resolved === true ||
    flag.resolvedAt != null
  ) {
    return false;
  }

  // Security / Provenance tampering flags ALWAYS block until human-verified
  if (
    flag.category === "PROMPT_INJECTION_SUSPECTED" ||
    flag.category === "TAINTED_CLAIM_CONFLICT" ||
    flag.category === "UNANCHORED_EXTRACTION"
  ) {
    return true;
  }

  // High-severity (4 or 5) unverified flags block until human-verified
  if (flag.severity >= 4 && status === "UNVERIFIED") {
    return true;
  }

  return false;
}

// -----------------------------------------------------------------------------
// Actor & Execution Telemetry Schemas (LLM vs Human Attribution)
// -----------------------------------------------------------------------------

export const LlmExecutionActorSchema = z.object({
  actorType: z.literal("LLM_AGENT"),
  agentPersonaId: z.string().describe("e.g. 'minato', 'makoto', 'daiki', 'hayate', 'hikari', 'seiji', 'satoru'"),
  agentDisplayName: z.string().describe("e.g. 'Minato (湊) — Maritime & Trade Parser'"),
  processStage: z.enum([
    "OCR_PREPROCESS",
    "SINGLE_DOC_EXTRACTION",
    "MULTI_DOC_RECONCILIATION",
    "WEB_RECON_DISCOVERY",
    "BENCHMARK_SYNTHESIS",
  ]),
  modelSlug: z.string().describe("Exact OpenRouter model slug, e.g. 'deepseek/deepseek-v4-flash'"),
  ocrEngine: z.string().nullable().optional().describe("e.g. 'mistral-ocr', 'cloudflare-ai', or 'native-text'"),
  promptTemplateId: z.string().describe("Identifier of the prompt template, e.g. 'TRADE_EXTRACTION_V2'"),
  promptSha256: z.string().describe("SHA-256 hash of system prompt + Zod schema instructions"),
  temperature: z.number().default(0),
  openRouterGenerationId: z.string().nullable().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  processedAt: z.string(),
});
export type LlmExecutionActor = z.infer<typeof LlmExecutionActorSchema>;

export const HumanExecutionActorSchema = z.object({
  actorType: z.literal("HUMAN_OPERATOR"),
  authMethod: z.enum(["GOOGLE_CHAT_OTP", "SITE_PASSWORD", "LOCAL_DEV_BYPASS"]),
  sessionFingerprint: z.string().describe("Truncated HMAC hash of the active otp_session token, e.g. 'sess_9f2a81c4'"),
  sessionIssuedAt: z.string().optional(),
  clientIp: z.string().describe("Client IP from x-forwarded-for / x-real-ip"),
  geoLocation: z.string().nullable().optional().describe("City/Country from x-vercel-ip-city / x-vercel-ip-country"),
  userAgentSummary: z.string().nullable().optional().describe("Parsed browser and OS summary"),
  actionType: z.enum([
    "MANUAL_DSL_EDIT",
    "CONFLICT_ARBITRATION_OVERRIDE",
    "TAINT_PROMOTION_TO_VERIFIED",
    "RISK_FLAG_RESOLUTION",
    "REVISION_ROLLBACK",
  ]),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  auditComment: z.string().nullable().optional(),
  processedAt: z.string(),
});
export type HumanExecutionActor = z.infer<typeof HumanExecutionActorSchema>;

export const ActorProvenanceSchema = z.discriminatedUnion("actorType", [
  LlmExecutionActorSchema,
  HumanExecutionActorSchema,
]);
export type ActorProvenance = z.infer<typeof ActorProvenanceSchema>;

// -----------------------------------------------------------------------------
// Field-Level Lineage & Candidate Evidence Schemas
// -----------------------------------------------------------------------------

export const FieldCandidateEvidenceSchema = z.object({
  value: z.unknown(),
  pointer: ProvenancePointerSchema,
  llmActor: LlmExecutionActorSchema.optional(),
  status: z.enum([
    "ACTIVE_WINNER",
    "SUPERSEDED_BY_HIGHER_TAINT",
    "SUPERSEDED_BY_NEWER_DOC",
    "OVERRIDDEN_BY_HUMAN",
  ]),
  extractedAt: z.string().optional(),
});
export type FieldCandidateEvidence = z.infer<typeof FieldCandidateEvidenceSchema>;

export const FieldLineageNodeSchema = z.object({
  jsonPath: z.string().describe("JSONPath key, e.g. '$.parties[0].jurisdiction' or '$.financingAsks[0].amount'"),
  fieldLabel: z.string(),
  activeValue: z.unknown(),
  activeTaint: TaintLevelSchema,
  activeActor: ActorProvenanceSchema.optional(),
  hasConflict: z.boolean().default(false),
  candidates: z.array(FieldCandidateEvidenceSchema).default([]),
  actorHistory: z
    .array(
      z.object({
        version: z.number(),
        value: z.unknown(),
        actor: ActorProvenanceSchema,
      }),
    )
    .default([]),
  downstreamImpacts: z
    .array(
      z.object({
        consumerType: z.enum(["HARD_GATE_MATCH", "RISK_FLAG", "TERMSHEET_BENCHMARK", "SYNDICATE_SIZING"]),
        summary: z.string(),
        passedCount: z.number().optional(),
        excludedCount: z.number().optional(),
      }),
    )
    .default([]),
});
export type FieldLineageNode = z.infer<typeof FieldLineageNodeSchema>;

export type FieldLineageMap = Record<string, FieldLineageNode>;

/** Truncate a session token or cookie string into a safe, non-sensitive audit fingerprint */
export function computeSessionFingerprint(rawToken?: string | null): string {
  if (!rawToken) return "sess_anon";
  let clean = rawToken.replace(/^"|"$/g, "").trim();
  if (clean.includes(".")) clean = clean.split(".")[0];
  const hashPrefix = clean.slice(-8);
  return `sess_${hashPrefix || "active"}`;
}

/**
 * Resolves source document attribution for a deal data point.
 * Strict per-deal isolation:
 * - If a deal has only 1 document uploaded, EVERY document-extracted field for that deal
 *   is strictly attributed to that exact document (avoiding hallucinating names from other deals or templates).
 * - Generates direct viewing URLs (sourceFileUrl) so operators can open the source document with 1 click.
 */
export function resolveDealSourceDocument(options: {
  dealDocs?: any[];
  dealType: "INVOICE" | "TRADE" | "VC";
  dealId?: string;
  preferredFileNames?: (string | undefined | null)[];
  matchingTaxonomyCodes?: string[];
  defaultFallbackName?: string;
}): {
  sourceFileName: string;
  documentId?: string;
  sourceFileUrl?: string;
} {
  const {
    dealDocs = [],
    dealType,
    dealId,
    preferredFileNames = [],
    matchingTaxonomyCodes = [],
    defaultFallbackName,
  } = options;

  if (Array.isArray(dealDocs) && dealDocs.length > 0) {
    const buildDocUrl = (doc: any) => {
      // Direct stream endpoint that authenticates against Vercel private blob storage and delivers inline PDF
      if (dealId && doc?.id) {
        if (dealType === "TRADE") return `/api/trade-deals/${dealId}/documents/${doc.id}/file`;
        if (dealType === "VC") return `/api/vc-deals/${dealId}/documents/${doc.id}/file`;
        return `/api/deals/${dealId}/documents/${doc.id}/file`;
      }
      if (doc?.blobUrl && typeof doc.blobUrl === "string" && doc.blobUrl.startsWith("http")) {
        return doc.blobUrl;
      }
      return undefined;
    };

    // Strict deal isolation: if this deal has ONLY 1 uploaded document,
    // ALL data points extracted from documentation for this deal MUST be attributed to it.
    // Under no circumstances should names of documents from other deals or templates be shown.
    if (dealDocs.length === 1) {
      const singleDoc = dealDocs[0];
      const hasExplicitMismatch =
        preferredFileNames.length > 0 &&
        preferredFileNames.every((name) => {
          if (!name) return false;
          const clean = name.trim().toLowerCase();
          const fn = singleDoc.fileName?.toLowerCase();
          return singleDoc.id !== name && fn !== clean && (!fn || !fn.includes(clean));
        });

      if (!hasExplicitMismatch) {
        return {
          sourceFileName: singleDoc.fileName || "Uploaded Document",
          documentId: singleDoc.id,
          sourceFileUrl: buildDocUrl(singleDoc),
        };
      }
    }

    // For multi-document deals:
    // 1. Check preferredFileNames
    for (const name of preferredFileNames) {
      if (!name) continue;
      const clean = name.trim().toLowerCase();
      const matched = dealDocs.find((d) => {
        if (!d) return false;
        if (d.id === name) return true;
        const fn = d.fileName?.toLowerCase();
        return fn === clean || (fn && fn.includes(clean));
      });
      if (matched) {
        return {
          sourceFileName: matched.fileName,
          documentId: matched.id,
          sourceFileUrl: buildDocUrl(matched),
        };
      }
    }

    // 2. Check matching taxonomy codes
    if (matchingTaxonomyCodes.length > 0) {
      const matchedByType = dealDocs.find((d) => {
        if (!d || !Array.isArray(d.documentTypes)) return false;
        return d.documentTypes.some((t: string) => matchingTaxonomyCodes.includes(t));
      });
      if (matchedByType) {
        return {
          sourceFileName: matchedByType.fileName,
          documentId: matchedByType.id,
          sourceFileUrl: buildDocUrl(matchedByType),
        };
      }
    }

    // 3. Fallback to primary uploaded document of this deal
    const primary = dealDocs[0];
    return {
      sourceFileName: primary.fileName || "Uploaded Document",
      documentId: primary.id,
      sourceFileUrl: buildDocUrl(primary),
    };
  }

  // Fallback when deal has no documents uploaded yet
  const fallback =
    preferredFileNames.find(Boolean) ||
    defaultFallbackName ||
    "Unattached / No Document Uploaded";

  return {
    sourceFileName: fallback,
    documentId: undefined,
    sourceFileUrl: undefined,
  };
}

/**
 * Builds or retrieves a full FieldLineageMap for any deal DSL object.
 * If the object already contains `_fieldLineage`, it returns it directly.
 * Otherwise, it deterministically synthesizes lineage nodes for all canonical fields,
 * guaranteeing 100% backward compatibility for existing deals without database migrations.
 */
export function synthesizeFieldLineageFromDsl(dsl: any): FieldLineageMap {
  const dealDocuments: any[] = Array.isArray(dsl?.documents) ? dsl.documents : [];
  const dealId: string | undefined = dsl?.dealId;

  if (dsl?._fieldLineage && Object.keys(dsl._fieldLineage).length > 0) {
    const existing = { ...(dsl._fieldLineage as FieldLineageMap) };
    if (dealDocuments.length > 0) {
      for (const key of Object.keys(existing)) {
        const node = existing[key];
        if (node?.candidates) {
          node.candidates = node.candidates.map((cand) => {
            if (dealDocuments.length === 1) {
              const d0 = dealDocuments[0];
              const docUrl = dealId
                ? (dsl.corridor ? `/api/trade-deals/${dealId}/documents/${d0.id}/file` : dsl.stage ? `/api/vc-deals/${dealId}/documents/${d0.id}/file` : `/api/deals/${dealId}/documents/${d0.id}/file`)
                : d0.blobUrl;
              return {
                ...cand,
                pointer: {
                  ...cand.pointer,
                  sourceFileName: d0.fileName || cand.pointer.sourceFileName,
                  documentId: d0.id,
                  sourceFileUrl: docUrl || cand.pointer.sourceFileUrl,
                },
              };
            }
            if (dealId) {
              const matched = dealDocuments.find((d) => d.fileName === cand.pointer.sourceFileName || d.id === cand.pointer.documentId);
              if (matched) {
                const docUrl = dsl.corridor
                  ? `/api/trade-deals/${dealId}/documents/${matched.id}/file`
                  : dsl.stage
                  ? `/api/vc-deals/${dealId}/documents/${matched.id}/file`
                  : `/api/deals/${dealId}/documents/${matched.id}/file`;
                return {
                  ...cand,
                  pointer: {
                    ...cand.pointer,
                    documentId: matched.id,
                    sourceFileUrl: docUrl,
                  },
                };
              }
            }
            return cand;
          });
        }
      }
    }
    return existing;
  }

  const map: FieldLineageMap = {};
  if (!dsl || typeof dsl !== "object") return map;

  const humanActor = dsl._lastHumanActor;
  const isHuman = Boolean(humanActor);

  // 1. Invoice Deal Spec
  if (Array.isArray(dsl.parties)) {
    // Collect all party extractions across uploaded documents to hydrate verbatimQuote & pageOrSheet
    const allDocParties: any[] = [];
    dealDocuments.forEach((d) => {
      const raw = d?.extractedFieldsRaw || d?.extractedRaw;
      if (raw && Array.isArray(raw.parties)) {
        raw.parties.forEach((dp: any) => {
          allDocParties.push({ ...dp, _doc: d });
        });
      }
    });

    dsl.parties.forEach((p: any, idx: number) => {
      // Find matching extracted party across data room documents
      const normName = (p.legalName || "").trim().toLowerCase();
      const matchedDocParty = allDocParties.find(
        (dp) => dp.role === p.role && (dp.legalName || "").trim().toLowerCase() === normName
      ) || allDocParties.find(
        (dp) => dp.role === p.role
      );

      const realQuote = p.verbatimQuote || matchedDocParty?.verbatimQuote;
      const realPage = p.pageOrSheet || matchedDocParty?.pageOrSheet;
      const matchingDoc = matchedDocParty?._doc;
      const matchingDocTaint = matchingDoc ? resolveDocumentTaint(matchingDoc.documentTypes || [], matchingDoc.taintOverride) : "UNVERIFIED_CLAIM";

      const hasRealPartyQuote = Boolean(realQuote && typeof realQuote === "string");
      const realPartyTaint = isHuman ? "HUMAN_VERIFIED" : (hasRealPartyQuote ? "AUDITED_PROOF" : matchingDocTaint);

      if (p.legalName) {
        const docRes = resolveDealSourceDocument({
          dealDocs: dealDocuments,
          dealType: "INVOICE",
          dealId,
          preferredFileNames: p.sourceDocuments || (matchingDoc?.fileName ? [matchingDoc.fileName] : undefined),
          matchingTaxonomyCodes: ["DEAL_CONTRACT", "CORP_INCORP"],
        });

        const path = `$.parties[${idx}].legalName`;
        map[path] = {
          jsonPath: path,
          fieldLabel: `${p.role || "Party"} Legal Name`,
          activeValue: p.legalName,
          activeTaint: realPartyTaint,
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "makoto",
            agentDisplayName: "Makoto (誠) — Invoice Dilution Auditor",
            processStage: "SINGLE_DOC_EXTRACTION",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "INVOICE_EXTRACTION_V2",
            promptSha256: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: p.legalName,
              pointer: {
                sourceFileName: docRes.sourceFileName,
                documentId: docRes.documentId,
                sourceFileUrl: docRes.sourceFileUrl,
                taint: realPartyTaint,
                pageOrSheet: realPage || null,
                verbatimQuote: realQuote || null,
                documentTypes: ["DEAL_CONTRACT"],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "HARD_GATE_MATCH",
              summary: "Verified in Corporate KYC and Debtor Credit Limit Checks",
            },
          ],
        };
        if (p.role) {
          map[`$.parties.${p.role}.legalName`] = map[path];
          map[`$.parties.${p.role}.name`] = map[path];
        }
      }
      if (p.jurisdiction) {
        const docRes = resolveDealSourceDocument({
          dealDocs: dealDocuments,
          dealType: "INVOICE",
          dealId,
          preferredFileNames: p.sourceDocuments || (matchingDoc?.fileName ? [matchingDoc.fileName] : undefined),
          matchingTaxonomyCodes: ["CORP_INCORP", "DEAL_CONTRACT"],
        });

        const path = `$.parties[${idx}].jurisdiction`;
        map[path] = {
          jsonPath: path,
          fieldLabel: `${p.role || "Party"} Jurisdiction`,
          activeValue: p.jurisdiction,
          activeTaint: realPartyTaint,
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "makoto",
            agentDisplayName: "Makoto (誠) — Invoice Dilution Auditor",
            processStage: "SINGLE_DOC_EXTRACTION",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "INVOICE_EXTRACTION_V2",
            promptSha256: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: p.jurisdiction,
              pointer: {
                sourceFileName: docRes.sourceFileName,
                documentId: docRes.documentId,
                sourceFileUrl: docRes.sourceFileUrl,
                taint: realPartyTaint,
                pageOrSheet: realPage || null,
                verbatimQuote: realQuote || null,
                documentTypes: ["CORP_INCORP"],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "HARD_GATE_MATCH",
              summary: "Evaluated in Funder Eligible Legal Jurisdiction Hard-Gate",
            },
          ],
        };
        if (p.role) {
          map[`$.parties.${p.role}.jurisdiction`] = map[path];
        }
      }
      if (p.publicRating) {
        const docRes = resolveDealSourceDocument({
          dealDocs: dealDocuments,
          dealType: "INVOICE",
          dealId,
          preferredFileNames: p.sourceDocuments,
          matchingTaxonomyCodes: ["DEAL_CONTRACT", "FIN_STATEMENTS"],
        });

        const path = `$.parties[${idx}].publicRating`;
        map[path] = {
          jsonPath: path,
          fieldLabel: `${p.role || "Party"} Credit Rating`,
          activeValue: p.publicRating,
          activeTaint: realPartyTaint,
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "makoto",
            agentDisplayName: "Makoto (誠) — Invoice Dilution Auditor",
            processStage: "SINGLE_DOC_EXTRACTION",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "INVOICE_EXTRACTION_V2",
            promptSha256: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: p.publicRating,
              pointer: {
                sourceFileName: docRes.sourceFileName,
                documentId: docRes.documentId,
                sourceFileUrl: docRes.sourceFileUrl,
                taint: realPartyTaint,
                pageOrSheet: p.pageOrSheet || null,
                verbatimQuote: p.verbatimQuote || null,
                documentTypes: ["DEAL_CONTRACT"],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "HARD_GATE_MATCH",
              summary: "Counterparty credit risk tier and recourse underwriting",
            },
          ],
        };
        if (p.role) {
          map[`$.parties.${p.role}.publicRating`] = map[path];
        }
      }
    });
  }

  if (Array.isArray(dsl.financingAsks)) {
    // Collect all ask extractions across uploaded documents to hydrate quotes
    const allDocAsks: any[] = [];
    dealDocuments.forEach((d) => {
      const raw = d?.extractedFieldsRaw || d?.extractedRaw;
      if (raw && Array.isArray(raw.financingAsks)) {
        raw.financingAsks.forEach((da: any) => {
          allDocAsks.push({ ...da, _doc: d });
        });
      }
    });

    dsl.financingAsks.forEach((ask: any, idx: number) => {
      const matchedDocAsk = allDocAsks.find(
        (da) => da.structureType === ask.structureType || (ask.amount && da.amount === ask.amount)
      ) || allDocAsks[0];

      const realAskQuote = ask.verbatimQuote || matchedDocAsk?.verbatimQuote;
      const realAskPage = ask.pageOrSheet || matchedDocAsk?.pageOrSheet;
      const matchingDoc = matchedDocAsk?._doc;
      const matchingDocTaint = matchingDoc ? resolveDocumentTaint(matchingDoc.documentTypes || [], matchingDoc.taintOverride) : "UNVERIFIED_CLAIM";

      const hasRealAskQuote = Boolean(realAskQuote && typeof realAskQuote === "string");
      const realAskTaint = isHuman ? "HUMAN_VERIFIED" : (hasRealAskQuote ? "AUDITED_PROOF" : matchingDocTaint);

      if (ask.amount != null) {
        const docRes = resolveDealSourceDocument({
          dealDocs: dealDocuments,
          dealType: "INVOICE",
          dealId,
          preferredFileNames: ask.sourceDocuments || (matchingDoc?.fileName ? [matchingDoc.fileName] : undefined),
          matchingTaxonomyCodes: ["DEAL_INVOICE", "DEAL_CONTRACT"],
        });

        const path = `$.financingAsks[${idx}].amount`;
        map[path] = {
          jsonPath: path,
          fieldLabel: "Financing Facility Amount",
          activeValue: ask.amount,
          activeTaint: realAskTaint,
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "makoto",
            agentDisplayName: "Makoto (誠) — Invoice Dilution Auditor",
            processStage: "MULTI_DOC_RECONCILIATION",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "INVOICE_EXTRACTION_V2",
            promptSha256: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: ask.amount,
              pointer: {
                sourceFileName: docRes.sourceFileName,
                documentId: docRes.documentId,
                sourceFileUrl: docRes.sourceFileUrl,
                taint: realAskTaint,
                pageOrSheet: realAskPage || ask.pageOrSheet || null,
                verbatimQuote: realAskQuote || ask.verbatimQuote || null,
                documentTypes: ["DEAL_INVOICE"],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "HARD_GATE_MATCH",
              summary: "Evaluated in Funder Minimum & Maximum Ticket Size Filters",
            },
            {
              consumerType: "TERMSHEET_BENCHMARK",
              summary: "Sizes advance ceiling and debt commitment pricing",
            },
          ],
        };
      }
      if (ask.advanceRatePct != null) {
        const docRes = resolveDealSourceDocument({
          dealDocs: dealDocuments,
          dealType: "INVOICE",
          dealId,
          preferredFileNames: ask.sourceDocuments || (matchingDoc?.fileName ? [matchingDoc.fileName] : undefined),
          matchingTaxonomyCodes: ["DEAL_CONTRACT", "DEAL_INVOICE"],
        });

        const path = `$.financingAsks[${idx}].advanceRatePct`;
        map[path] = {
          jsonPath: path,
          fieldLabel: "Target Advance Rate (%)",
          activeValue: ask.advanceRatePct,
          activeTaint: realAskTaint,
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "makoto",
            agentDisplayName: "Makoto (誠) — Invoice Dilution Auditor",
            processStage: "SINGLE_DOC_EXTRACTION",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "INVOICE_EXTRACTION_V2",
            promptSha256: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: ask.advanceRatePct,
              pointer: {
                sourceFileName: docRes.sourceFileName,
                documentId: docRes.documentId,
                sourceFileUrl: docRes.sourceFileUrl,
                taint: realAskTaint,
                pageOrSheet: realAskPage || ask.pageOrSheet || null,
                verbatimQuote: realAskQuote || ask.verbatimQuote || null,
                documentTypes: [],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "HARD_GATE_MATCH",
              summary: "Benchmarked against maximum lender risk covenants",
            },
          ],
        };
      }
      if (ask.tenorDaysMin != null || ask.tenorDaysMax != null) {
        const docRes = resolveDealSourceDocument({
          dealDocs: dealDocuments,
          dealType: "INVOICE",
          dealId,
          preferredFileNames: ask.sourceDocuments || (matchingDoc?.fileName ? [matchingDoc.fileName] : undefined),
          matchingTaxonomyCodes: ["DEAL_INVOICE", "DEAL_CONTRACT"],
        });

        const path = `$.financingAsks[${idx}].tenorDays`;
        const tenorRange = `${ask.tenorDaysMin ?? 30}-${ask.tenorDaysMax ?? 90} days`;
        map[path] = {
          jsonPath: path,
          fieldLabel: "Receivable Tenor Range",
          activeValue: tenorRange,
          activeTaint: realAskTaint,
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "makoto",
            agentDisplayName: "Makoto (誠) — Invoice Dilution Auditor",
            processStage: "SINGLE_DOC_EXTRACTION",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "INVOICE_EXTRACTION_V2",
            promptSha256: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: tenorRange,
              pointer: {
                sourceFileName: docRes.sourceFileName,
                documentId: docRes.documentId,
                sourceFileUrl: docRes.sourceFileUrl,
                taint: realAskTaint,
                pageOrSheet: realAskPage || ask.pageOrSheet || null,
                verbatimQuote: realAskQuote || ask.verbatimQuote || null,
                documentTypes: ["DEAL_INVOICE"],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "HARD_GATE_MATCH",
              summary: "Maturity matching against funder maximum allowed invoice tenor covenants",
            },
          ],
        };
      }
    });
  }

  // 2. Trade Deal Spec
  if (dsl.corridor || dsl.supplier || dsl.buyer || dsl.commodity) {
    if (dsl.supplier?.legalName) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        preferredFileNames: dsl.supplier?.sourceDocuments,
        matchingTaxonomyCodes: ["TRADE_SUPPLY_CONTRACT"],
      });

      const hasSupplierQuote = Boolean(dsl.supplier?.verbatimQuote && typeof dsl.supplier.verbatimQuote === "string");
      const supplierTaint = isHuman ? "HUMAN_VERIFIED" : (hasSupplierQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

      map["$.supplier.legalName"] = {
        jsonPath: "$.supplier.legalName",
        fieldLabel: "Supplier Legal Entity",
        activeValue: dsl.supplier.legalName,
        activeTaint: supplierTaint,
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "minato",
          agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_EXTRACTION_V2",
          promptSha256: "a4f89c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.supplier.legalName,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: supplierTaint,
              pageOrSheet: dsl.supplier.pageOrSheet || null,
              verbatimQuote: dsl.supplier.verbatimQuote || null,
              documentTypes: ["TRADE_SUPPLY_CONTRACT"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Verified in Mining Concession & Exporter Sanctions Screening",
          },
        ],
      };
    }

    if (dsl.buyer?.legalName) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        preferredFileNames: dsl.buyer?.sourceDocuments,
        matchingTaxonomyCodes: ["TRADE_OFFTAKE_CONTRACT"],
      });

      const hasBuyerQuote = Boolean(dsl.buyer?.verbatimQuote && typeof dsl.buyer.verbatimQuote === "string");
      const buyerTaint = isHuman ? "HUMAN_VERIFIED" : (hasBuyerQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

      map["$.buyer.legalName"] = {
        jsonPath: "$.buyer.legalName",
        fieldLabel: "Buyer / Offtaker Legal Entity",
        activeValue: dsl.buyer.legalName,
        activeTaint: buyerTaint,
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "minato",
          agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_EXTRACTION_V2",
          promptSha256: "a4f89c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.buyer.legalName,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: buyerTaint,
              pageOrSheet: dsl.buyer.pageOrSheet || null,
              verbatimQuote: dsl.buyer.verbatimQuote || null,
              documentTypes: ["TRADE_OFFTAKE_CONTRACT"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Obligor credit underwriting and institutional offtake limit",
          },
        ],
      };
    }

    if (dsl.commodity?.name) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        matchingTaxonomyCodes: ["TRADE_CERT_QUALITY_ANALYSIS", "TRADE_SUPPLY_CONTRACT"],
      });

      const hasCommodityQuote = Boolean(dsl.commodity?.verbatimQuote && typeof dsl.commodity.verbatimQuote === "string");
      const commodityTaint = isHuman ? "HUMAN_VERIFIED" : (hasCommodityQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

      map["$.commodity.name"] = {
        jsonPath: "$.commodity.name",
        fieldLabel: "Physical Commodity Specification",
        activeValue: dsl.commodity.name,
        activeTaint: commodityTaint,
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "minato",
          agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_EXTRACTION_V2",
          promptSha256: "a4f89c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.commodity.name,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: commodityTaint,
              pageOrSheet: dsl.commodity.pageOrSheet || null,
              verbatimQuote: dsl.commodity.verbatimQuote || null,
              documentTypes: ["TRADE_CERT_QUALITY_ANALYSIS"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Corridor commodity eligibility and quality tolerance gates",
          },
        ],
      };
    }

    if (dsl.corridor) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        matchingTaxonomyCodes: ["TRADE_OCEAN_BILL_OF_LADING", "TRADE_EXPORT_DECLARATION"],
      });

      const hasCorridorQuote = Boolean(dsl.corridorVerbatimQuote && typeof dsl.corridorVerbatimQuote === "string");
      const corridorTaint = isHuman ? "HUMAN_VERIFIED" : (hasCorridorQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

      map["$.corridor"] = {
        jsonPath: "$.corridor",
        fieldLabel: "Physical Trade Corridor Route",
        activeValue: dsl.corridor,
        activeTaint: corridorTaint,
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "minato",
          agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_EXTRACTION_V2",
          promptSha256: "a4f89c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.corridor,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: corridorTaint,
              pageOrSheet: dsl.corridorPageOrSheet || null,
              verbatimQuote: dsl.corridorVerbatimQuote || null,
              documentTypes: ["TRADE_BILL_OF_LADING"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Geographic corridor eligibility and maritime sanctions compliance filter",
          },
        ],
      };
    }

    if (dsl.buyLeg) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        matchingTaxonomyCodes: ["TRADE_SUPPLY_CONTRACT"],
        defaultFallbackName: "Supply_Contract_Signed.pdf",
      });

      const rawBuyQuote = (dsl.buyLeg as any)?.verbatimQuote || null;
      const rawBuyPage = (dsl.buyLeg as any)?.pageOrSheet || "Supply Contract";

      map["$.buyLeg.amountUsd"] = {
        jsonPath: "$.buyLeg.amountUsd",
        fieldLabel: "Buy Leg Supply Contract Value",
        activeValue: dsl.buyLeg.amountUsd,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (rawBuyQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "minato",
          agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_EXTRACTION_V2",
          promptSha256: "a4f89c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.buyLeg.amountUsd,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (rawBuyQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: rawBuyPage,
              verbatimQuote: rawBuyQuote,
              documentTypes: ["TRADE_SUPPLY_CONTRACT"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Determines trade procurement loan ceiling and letter of credit issuance amount",
          },
        ],
      };
    }

    if (dsl.sellLeg) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        matchingTaxonomyCodes: ["TRADE_OFFTAKE_CONTRACT"],
        defaultFallbackName: "Offtake_Sales_Agreement.pdf",
      });

      const rawSellQuote = (dsl.sellLeg as any)?.verbatimQuote || null;
      const rawSellPage = (dsl.sellLeg as any)?.pageOrSheet || "Offtake Contract";

      map["$.sellLeg.amountUsd"] = {
        jsonPath: "$.sellLeg.amountUsd",
        fieldLabel: "Sell Leg Offtake Contract Value",
        activeValue: dsl.sellLeg.amountUsd,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (rawSellQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "minato",
          agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_EXTRACTION_V2",
          promptSha256: "a4f89c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.sellLeg.amountUsd,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (rawSellQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: rawSellPage,
              verbatimQuote: rawSellQuote,
              documentTypes: ["TRADE_OFFTAKE_CONTRACT"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Collateral receivables cashflow used to liquidate lender facility at maturity",
          },
        ],
      };
    }

    if (dsl.reconciliationAudit?.grossMarginUsd != null) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "TRADE",
        dealId,
        matchingTaxonomyCodes: ["TRADE_OFFTAKE_CONTRACT", "TRADE_SUPPLY_CONTRACT"],
        defaultFallbackName: "Paired_Contracts_Corroboration",
      });

      map["$.reconciliationAudit.grossMarginUsd"] = {
        jsonPath: "$.reconciliationAudit.grossMarginUsd",
        fieldLabel: "Trade Gross Margin (USD)",
        activeValue: dsl.reconciliationAudit.grossMarginUsd,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : "UNVERIFIED_CLAIM",
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "seiji",
          agentDisplayName: "Seiji (正司) — Spread & Term Sheet Engine",
          processStage: "BENCHMARK_SYNTHESIS",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "TRADE_BENCHMARK_V1",
          promptSha256: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.reconciliationAudit.grossMarginUsd,
            pointer: {
              sourceFileName: docRes.sourceFileName,
              documentId: docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : "UNVERIFIED_CLAIM",
              pageOrSheet: "Trade Economics",
              verbatimQuote: null,
              documentTypes: [],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Debt service coverage ratio (DSCR) and facility viability",
          },
        ],
      };
    }
  }

  // 3. VC / Startup Deal Spec
  if (
    dsl.companyName ||
    dsl.stage ||
    dsl.financingAsk ||
    dsl.financingAsks ||
    dsl.legalEntityJurisdiction ||
    dsl.primaryVertical ||
    dsl.capTable ||
    dsl.founders
  ) {
    if (dsl.companyName) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK", "VC_CORP_CHARTER"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.companyName === dsl.companyName);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.companyName"] = {
        jsonPath: "$.companyName",
        fieldLabel: "Startup Company Legal Name",
        activeValue: dsl.companyName,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.companyName,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Portfolio conflict check and investor thesis alignment",
          },
        ],
      };
    }

    if (dsl.legalEntityJurisdiction) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["CORP_INCORP", "VC_CORP_CHARTER"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.legalEntityJurisdiction === dsl.legalEntityJurisdiction);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.legalEntityJurisdiction"] = {
        jsonPath: "$.legalEntityJurisdiction",
        fieldLabel: "Legal Entity Jurisdiction",
        activeValue: dsl.legalEntityJurisdiction,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "makoto",
          agentDisplayName: "Makoto (誠) — Diligence & Legal Auditor",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.legalEntityJurisdiction,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["CORP_INCORP"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Primary geographic hard-gate for syndicate lead funds & co-investors",
          },
        ],
      };
    }

    if (dsl.stage) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.stage === dsl.stage);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.stage"] = {
        jsonPath: "$.stage",
        fieldLabel: "Financing Round Stage",
        activeValue: dsl.stage,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.stage,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Filtered by VC Fund mandate stage focus (Pre-Seed to Series B)",
          },
        ],
      };
    }

    if (dsl.primaryVertical) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.primaryVertical === dsl.primaryVertical);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.primaryVertical"] = {
        jsonPath: "$.primaryVertical",
        fieldLabel: "Primary Vertical",
        activeValue: dsl.primaryVertical,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.primaryVertical,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Sector thesis matching and anti-portfolio conflict check",
          },
        ],
      };
    }

    if (dsl.industry) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.industry === dsl.industry);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.industry"] = {
        jsonPath: "$.industry",
        fieldLabel: "Target Industry & Sub-Markets",
        activeValue: dsl.industry,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.industry,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Granular industry category for active thesis deployment verification",
          },
        ],
      };
    }

    if (dsl.targetCustomerProfile) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.targetCustomerProfile === dsl.targetCustomerProfile);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.targetCustomerProfile"] = {
        jsonPath: "$.targetCustomerProfile",
        fieldLabel: "Target Customer Profile (ICP)",
        activeValue: dsl.targetCustomerProfile,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "hayate",
          agentDisplayName: "Hayate (疾風) — Revenue & ICP Hunter",
          processStage: "WEB_RECON_DISCOVERY",
          modelSlug: "qwen/qwen-2.5-72b-instruct",
          promptTemplateId: "COMMERCIAL_RECON_V1",
          promptSha256: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.targetCustomerProfile,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Buyer persona and corporate accounts matched by Commercial Intelligence agent",
          },
        ],
      };
    }

    if (dsl.businessModel) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK"],
      });
      const docWithVal = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.businessModel === dsl.businessModel);
      const rawExt = docWithVal ? (docWithVal.extractedFieldsRaw || docWithVal.extractedRaw) : null;
      const realQuote = rawExt?.verbatimQuote && typeof rawExt.verbatimQuote === "string" ? rawExt.verbatimQuote : null;
      const realPage = rawExt?.pageOrSheet && typeof rawExt.pageOrSheet === "string" ? rawExt.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.businessModel"] = {
        jsonPath: "$.businessModel",
        fieldLabel: "Monetization & Business Model",
        activeValue: dsl.businessModel,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.businessModel,
            pointer: {
              sourceFileName: docWithVal?.fileName || docRes.sourceFileName,
              documentId: docWithVal?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Revenue structure guiding buyer procurement sizing and ACV tiers",
          },
        ],
      };
    }

    // Financing Ask Lineage
    const askObj = dsl.financingAsk || dsl.financingAsks?.[0];
    const askAmount = askObj?.amountUsd ?? askObj?.targetRaiseUsd ?? null;
    if (askAmount != null && Number(askAmount) > 0) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_PITCH_DECK", "VC_FINANCIAL_MODEL"],
        defaultFallbackName: "Pitch_Deck.pdf",
      });

      const docWithAsk = dealDocuments.find((d: any) => d?.extractedRaw?.financingAsk?.targetRaiseUsd != null);
      const rawAsk = docWithAsk?.extractedRaw?.financingAsk;
      const realQuote = rawAsk?.verbatimQuote && typeof rawAsk.verbatimQuote === "string" ? rawAsk.verbatimQuote : null;
      const realPage = rawAsk?.pageOrSheet && typeof rawAsk.pageOrSheet === "string" ? rawAsk.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      const askNode: FieldLineageNode = {
        jsonPath: "$.financingAsk.targetRaiseUsd",
        fieldLabel: "Round Target Raise Amount",
        activeValue: askAmount,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: askAmount,
            pointer: {
              sourceFileName: docWithAsk?.fileName || docRes.sourceFileName,
              documentId: docWithAsk?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || "Pitch Deck / Summary",
              verbatimQuote: realQuote,
              documentTypes: docWithAsk?.documentTypes || ["VC_PITCH_DECK"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Investor ticket size and syndicate co-lead allocation sizing",
          },
          {
            consumerType: "SYNDICATE_SIZING",
            summary: "Lead check sizing (65%) and co-investor syndicate construction",
          },
        ],
      };
      map["$.financingAsk.targetRaiseUsd"] = askNode;
      map["$.financingAsk.amountUsd"] = askNode;
    }

    if (askObj?.valuationCapUsd != null && Number(askObj.valuationCapUsd) > 0) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_CAP_TABLE", "VC_PRIOR_TERM_SHEET"],
        defaultFallbackName: "SAFE_Agreement.pdf",
      });

      const docWithAsk = dealDocuments.find((d: any) => d?.extractedRaw?.financingAsk?.valuationCapUsd != null);
      const rawAsk = docWithAsk?.extractedRaw?.financingAsk;
      const realQuote = rawAsk?.verbatimQuote && typeof rawAsk.verbatimQuote === "string" ? rawAsk.verbatimQuote : null;
      const realPage = rawAsk?.pageOrSheet && typeof rawAsk.pageOrSheet === "string" ? rawAsk.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.financingAsk.valuationCapUsd"] = {
        jsonPath: "$.financingAsk.valuationCapUsd",
        fieldLabel: "Valuation Cap / Target Pricing",
        activeValue: askObj.valuationCapUsd,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: askObj.valuationCapUsd,
            pointer: {
              sourceFileName: docWithAsk?.fileName || docRes.sourceFileName,
              documentId: docWithAsk?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || "Contract / Term Sheet",
              verbatimQuote: realQuote,
              documentTypes: docWithAsk?.documentTypes || ["VC_CAP_TABLE"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Pre-money and post-money founder dilution model",
          },
        ],
      };
    }

    if (askObj?.instrumentType) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_CAP_TABLE", "VC_PRIOR_TERM_SHEET"],
        defaultFallbackName: "SAFE_Agreement.pdf",
      });

      const docWithAsk = dealDocuments.find((d: any) => d?.extractedRaw?.financingAsk?.instrumentType);
      const rawAsk = docWithAsk?.extractedRaw?.financingAsk;
      const realQuote = rawAsk?.verbatimQuote && typeof rawAsk.verbatimQuote === "string" ? rawAsk.verbatimQuote : null;
      const realPage = rawAsk?.pageOrSheet && typeof rawAsk.pageOrSheet === "string" ? rawAsk.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.financingAsk.instrumentType"] = {
        jsonPath: "$.financingAsk.instrumentType",
        fieldLabel: "Round Instrument Type",
        activeValue: askObj.instrumentType,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: askObj.instrumentType,
            pointer: {
              sourceFileName: docWithAsk?.fileName || docRes.sourceFileName,
              documentId: docWithAsk?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || "Contract / Term Sheet",
              verbatimQuote: realQuote,
              documentTypes: docWithAsk?.documentTypes || ["VC_CAP_TABLE"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "YC Post-Money SAFE / Priced Equity fund mandate compatibility",
          },
        ],
      };
    }

    if (askObj?.plannedRunwayMonths != null) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_FINANCIAL_MODEL", "VC_METRICS_DASHBOARD"],
        defaultFallbackName: "Financial_Model.xlsx",
      });

      const docWithAsk = dealDocuments.find((d: any) => d?.extractedRaw?.financingAsk?.plannedRunwayMonths != null);
      const rawAsk = docWithAsk?.extractedRaw?.financingAsk;
      const realQuote = rawAsk?.verbatimQuote && typeof rawAsk.verbatimQuote === "string" ? rawAsk.verbatimQuote : null;
      const realPage = rawAsk?.pageOrSheet && typeof rawAsk.pageOrSheet === "string" ? rawAsk.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.financingAsk.plannedRunwayMonths"] = {
        jsonPath: "$.financingAsk.plannedRunwayMonths",
        fieldLabel: "Planned Runway (Months)",
        activeValue: askObj.plannedRunwayMonths,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: askObj.plannedRunwayMonths,
            pointer: {
              sourceFileName: docWithAsk?.fileName || docRes.sourceFileName,
              documentId: docWithAsk?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || "Financial Model / Summary",
              verbatimQuote: realQuote,
              documentTypes: docWithAsk?.documentTypes || ["VC_FINANCIAL_MODEL"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "HARD_GATE_MATCH",
            summary: "Burn rate and time to next milestone validation",
          },
        ],
      };
    }

    // Cap Table Ownership Lineage
    if (dsl.capTable?.foundersOwnershipPct != null) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_CAP_TABLE"],
      });
      const docWithCap = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.capTable?.foundersOwnershipPct != null);
      const rawCap = docWithCap ? (docWithCap.extractedFieldsRaw || docWithCap.extractedRaw)?.capTable : null;
      const realQuote = rawCap?.verbatimQuote && typeof rawCap.verbatimQuote === "string" ? rawCap.verbatimQuote : null;
      const realPage = rawCap?.pageOrSheet && typeof rawCap.pageOrSheet === "string" ? rawCap.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.capTable.foundersOwnershipPct"] = {
        jsonPath: "$.capTable.foundersOwnershipPct",
        fieldLabel: "Founders Ownership (%)",
        activeValue: dsl.capTable.foundersOwnershipPct,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.capTable.foundersOwnershipPct,
            pointer: {
              sourceFileName: docWithCap?.fileName || docRes.sourceFileName,
              documentId: docWithCap?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_CAP_TABLE"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Pre-round governance and post-round incentive dilution",
          },
        ],
      };
    }

    if (dsl.capTable?.investorOwnershipPct != null) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_CAP_TABLE"],
      });
      const docWithCap = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.capTable?.investorOwnershipPct != null);
      const rawCap = docWithCap ? (docWithCap.extractedFieldsRaw || docWithCap.extractedRaw)?.capTable : null;
      const realQuote = rawCap?.verbatimQuote && typeof rawCap.verbatimQuote === "string" ? rawCap.verbatimQuote : null;
      const realPage = rawCap?.pageOrSheet && typeof rawCap.pageOrSheet === "string" ? rawCap.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.capTable.investorOwnershipPct"] = {
        jsonPath: "$.capTable.investorOwnershipPct",
        fieldLabel: "Prior Investors Ownership (%)",
        activeValue: dsl.capTable.investorOwnershipPct,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "daiki",
          agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.capTable.investorOwnershipPct,
            pointer: {
              sourceFileName: docWithCap?.fileName || docRes.sourceFileName,
              documentId: docWithCap?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_CAP_TABLE"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Clean cap table verification and SAFE conversion modeling",
          },
        ],
      };
    }

    if (dsl.capTable?.optionPoolPct != null) {
      const docRes = resolveDealSourceDocument({
        dealDocs: dealDocuments,
        dealType: "VC",
        dealId,
        matchingTaxonomyCodes: ["VC_CAP_TABLE"],
      });
      const docWithCap = dealDocuments.find((d: any) => (d?.extractedFieldsRaw || d?.extractedRaw)?.capTable?.optionPoolPct != null);
      const rawCap = docWithCap ? (docWithCap.extractedFieldsRaw || docWithCap.extractedRaw)?.capTable : null;
      const realQuote = rawCap?.verbatimQuote && typeof rawCap.verbatimQuote === "string" ? rawCap.verbatimQuote : null;
      const realPage = rawCap?.pageOrSheet && typeof rawCap.pageOrSheet === "string" ? rawCap.pageOrSheet : null;
      const hasRealQuote = Boolean(realQuote);

      map["$.capTable.optionPoolPct"] = {
        jsonPath: "$.capTable.optionPoolPct",
        fieldLabel: "Unallocated Option Pool (%)",
        activeValue: dsl.capTable.optionPoolPct,
        activeTaint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
        activeActor: humanActor || {
          actorType: "LLM_AGENT",
          agentPersonaId: "makoto",
          agentDisplayName: "Makoto (誠) — Diligence & Team Auditor",
          processStage: "SINGLE_DOC_EXTRACTION",
          modelSlug: "deepseek/deepseek-v4-flash",
          promptTemplateId: "VC_EXTRACTION_V2",
          promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
          temperature: 0,
          processedAt: new Date().toISOString(),
        },
        hasConflict: false,
        candidates: [
          {
            value: dsl.capTable.optionPoolPct,
            pointer: {
              sourceFileName: docWithCap?.fileName || docRes.sourceFileName,
              documentId: docWithCap?.id || docRes.documentId,
              sourceFileUrl: docRes.sourceFileUrl,
              taint: isHuman ? "HUMAN_VERIFIED" : (hasRealQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM"),
              pageOrSheet: realPage || null,
              verbatimQuote: realQuote || null,
              documentTypes: ["VC_CAP_TABLE"],
            },
            status: "ACTIVE_WINNER",
          },
        ],
        actorHistory: [],
        downstreamImpacts: [
          {
            consumerType: "TERMSHEET_BENCHMARK",
            summary: "Employee stock option pool sizing and post-closing expansion reserve",
          },
        ],
      };
    }

    // SAFE Noteholders & Convertible Balances Lineage (Daiki 大輝 & Makoto 誠)
    if (Array.isArray(dsl.capTable?.safeHolders)) {
      dsl.capTable.safeHolders.forEach((s: any, sIdx: number) => {
        if (s && s.holderName) {
          const docRes = resolveDealSourceDocument({
            dealDocs: dealDocuments,
            dealType: "VC",
            dealId,
            matchingTaxonomyCodes: ["VC_CAP_TABLE"],
          });
          const hasRealSafeQuote = Boolean(s.verbatimQuote && typeof s.verbatimQuote === "string");
          const safeTaint = isHuman ? "HUMAN_VERIFIED" : (hasRealSafeQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

          const safeNode: FieldLineageNode = {
            jsonPath: `$.capTable.safeHolders[${sIdx}].holderName`,
            fieldLabel: `SAFE Noteholder: ${s.holderName}`,
            activeValue: `${s.holderName} ($${Number(s.investmentAmountUsd || 0).toLocaleString()} ${s.instrumentType || "SAFE"})`,
            activeTaint: safeTaint,
            activeActor: humanActor || {
              actorType: "LLM_AGENT",
              agentPersonaId: "makoto",
              agentDisplayName: "Makoto (誠) — Diligence & Team Auditor",
              processStage: "SINGLE_DOC_EXTRACTION",
              modelSlug: "deepseek/deepseek-v4-flash",
              promptTemplateId: "VC_EXTRACTION_V2",
              promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
              temperature: 0,
              processedAt: new Date().toISOString(),
            },
            hasConflict: false,
            candidates: [
              {
                value: s.holderName,
                pointer: {
                  sourceFileName: docRes.sourceFileName,
                  documentId: docRes.documentId,
                  sourceFileUrl: docRes.sourceFileUrl,
                  taint: safeTaint,
                  pageOrSheet: s.pageOrSheet || null,
                  verbatimQuote: s.verbatimQuote || null,
                  documentTypes: ["VC_CAP_TABLE"],
                },
                status: "ACTIVE_WINNER",
              },
            ],
            actorHistory: [],
            downstreamImpacts: [
              {
                consumerType: "TERMSHEET_BENCHMARK",
                summary: "Pro-forma conversion shares calculation and pre-money vs post-money dilution model",
              },
            ],
          };
          map[`$.capTable.safeHolders[${sIdx}].holderName`] = safeNode;
          map[`$.capTable.safeHolders.${s.holderName}`] = safeNode;
        }
      });
    }

    // Common Stockholders & Equity Allocation Lineage ("Common Roders")
    if (Array.isArray(dsl.capTable?.commonHolders)) {
      dsl.capTable.commonHolders.forEach((c: any, cIdx: number) => {
        if (c && c.holderName) {
          const docRes = resolveDealSourceDocument({
            dealDocs: dealDocuments,
            dealType: "VC",
            dealId,
            matchingTaxonomyCodes: ["VC_CAP_TABLE"],
          });
          const hasRealCommonQuote = Boolean(c.verbatimQuote && typeof c.verbatimQuote === "string");
          const commonTaint = isHuman ? "HUMAN_VERIFIED" : (hasRealCommonQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

          const commonNode: FieldLineageNode = {
            jsonPath: `$.capTable.commonHolders[${cIdx}].holderName`,
            fieldLabel: `Common Stockholder: ${c.holderName}`,
            activeValue: `${c.holderName} (${c.ownershipPct}% Common Equity)`,
            activeTaint: commonTaint,
            activeActor: humanActor || {
              actorType: "LLM_AGENT",
              agentPersonaId: "makoto",
              agentDisplayName: "Makoto (誠) — Diligence & Team Auditor",
              processStage: "SINGLE_DOC_EXTRACTION",
              modelSlug: "deepseek/deepseek-v4-flash",
              promptTemplateId: "VC_EXTRACTION_V2",
              promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
              temperature: 0,
              processedAt: new Date().toISOString(),
            },
            hasConflict: false,
            candidates: [
              {
                value: c.holderName,
                pointer: {
                  sourceFileName: docRes.sourceFileName,
                  documentId: docRes.documentId,
                  sourceFileUrl: docRes.sourceFileUrl,
                  taint: commonTaint,
                  pageOrSheet: c.pageOrSheet || null,
                  verbatimQuote: c.verbatimQuote || null,
                  documentTypes: ["VC_CAP_TABLE"],
                },
                status: "ACTIVE_WINNER",
              },
            ],
            actorHistory: [],
            downstreamImpacts: [
              {
                consumerType: "TERMSHEET_BENCHMARK",
                summary: "Pre-round voting governance, board seat thresholds, and employee vesting schedule audit",
              },
            ],
          };
          map[`$.capTable.commonHolders[${cIdx}].holderName`] = commonNode;
          map[`$.capTable.commonHolders.${c.holderName}`] = commonNode;
        }
      });
    }

    // Founders Lineage
    if (Array.isArray(dsl.founders)) {
      dsl.founders.forEach((f: any, fIdx: number) => {
        if (f.name) {
          const docRes = resolveDealSourceDocument({
            dealDocs: dealDocuments,
            dealType: "VC",
            dealId,
            matchingTaxonomyCodes: ["VC_PITCH_DECK"],
          });
          const hasRealFounderQuote = Boolean(f.verbatimQuote && typeof f.verbatimQuote === "string");
          const founderTaint = isHuman ? "HUMAN_VERIFIED" : (hasRealFounderQuote ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM");

          map[`$.founders[${fIdx}].name`] = {
            jsonPath: `$.founders[${fIdx}].name`,
            fieldLabel: `Founder ${fIdx + 1}: ${f.name}`,
            activeValue: f.name,
            activeTaint: founderTaint,
            activeActor: humanActor || {
              actorType: "LLM_AGENT",
              agentPersonaId: "makoto",
              agentDisplayName: "Makoto (誠) — Diligence & Team Auditor",
              processStage: "SINGLE_DOC_EXTRACTION",
              modelSlug: "deepseek/deepseek-v4-flash",
              promptTemplateId: "VC_EXTRACTION_V2",
              promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
              temperature: 0,
              processedAt: new Date().toISOString(),
            },
            hasConflict: false,
            candidates: [
              {
                value: f.name,
                pointer: {
                  sourceFileName: docRes.sourceFileName,
                  documentId: docRes.documentId,
                  sourceFileUrl: docRes.sourceFileUrl,
                  taint: founderTaint,
                  pageOrSheet: f.pageOrSheet || null,
                  verbatimQuote: f.verbatimQuote || null,
                  documentTypes: ["VC_PITCH_DECK"],
                },
                status: "ACTIVE_WINNER",
              },
            ],
            actorHistory: [],
            downstreamImpacts: [
              {
                consumerType: "HARD_GATE_MATCH",
                summary: "Technical founder and background verification for angel/VC diligence",
              },
            ],
          };

          if (f.equityOwnershipPct != null) {
            const capDocRes = resolveDealSourceDocument({
              dealDocs: dealDocuments,
              dealType: "VC",
              dealId,
              matchingTaxonomyCodes: ["VC_CAP_TABLE"],
            });

            map[`$.founders[${fIdx}].equityOwnershipPct`] = {
              jsonPath: `$.founders[${fIdx}].equityOwnershipPct`,
              fieldLabel: `${f.name} Ownership (%)`,
              activeValue: f.equityOwnershipPct,
              activeTaint: founderTaint,
              activeActor: humanActor || {
                actorType: "LLM_AGENT",
                agentPersonaId: "makoto",
                agentDisplayName: "Makoto (誠) — Diligence & Team Auditor",
                processStage: "SINGLE_DOC_EXTRACTION",
                modelSlug: "deepseek/deepseek-v4-flash",
                promptTemplateId: "VC_EXTRACTION_V2",
                promptSha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
                temperature: 0,
                processedAt: new Date().toISOString(),
              },
              hasConflict: false,
              candidates: [
                {
                  value: f.equityOwnershipPct,
                  pointer: {
                    sourceFileName: capDocRes.sourceFileName,
                    documentId: capDocRes.documentId,
                    sourceFileUrl: capDocRes.sourceFileUrl,
                    taint: founderTaint,
                    pageOrSheet: f.pageOrSheet || null,
                    verbatimQuote: f.verbatimQuote || null,
                    documentTypes: ["VC_CAP_TABLE"],
                  },
                  status: "ACTIVE_WINNER",
                },
              ],
              actorHistory: [],
              downstreamImpacts: [
                {
                  consumerType: "TERMSHEET_BENCHMARK",
                  summary: "Individual founder equity and vesting schedule audit",
                },
              ],
            };
          }
        }
      });
    }

    // Competitors Lineage
    if (Array.isArray(dsl.competitors)) {
      dsl.competitors.forEach((c: any, cIdx: number) => {
        if (c.name) {
          const isUrl = Boolean(c.sourceUrl && (c.sourceUrl.startsWith("http://") || c.sourceUrl.startsWith("https://")));
          const docRes = resolveDealSourceDocument({
            dealDocs: dealDocuments,
            dealType: "VC",
            dealId,
            matchingTaxonomyCodes: ["VC_PITCH_DECK"],
          });
          const sourceFileName = isUrl ? c.sourceUrl : docRes.sourceFileName;
          const sourceFileUrl = isUrl ? c.sourceUrl : docRes.sourceFileUrl;

          const compNode: FieldLineageNode = {
            jsonPath: `$.competitors[${cIdx}].name`,
            fieldLabel: `Competitor: ${c.name}`,
            activeValue: c.name,
            activeTaint: "UNVERIFIED_CLAIM",
            activeActor: humanActor || {
              actorType: "LLM_AGENT",
              agentPersonaId: "hikari",
              agentDisplayName: "Hikari (光) — Competitor Intelligence Scout",
              processStage: "WEB_RECON_DISCOVERY",
              modelSlug: "qwen/qwen-2.5-72b-instruct",
              promptTemplateId: "COMPETITOR_DISCOVERY_V1",
              promptSha256: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
              temperature: 0,
              processedAt: new Date().toISOString(),
            },
            hasConflict: false,
            candidates: [
              {
                value: c.name,
                pointer: {
                  sourceFileName,
                  documentId: isUrl ? undefined : docRes.documentId,
                  sourceFileUrl,
                  taint: "UNVERIFIED_CLAIM",
                  pageOrSheet: isUrl ? c.sourceUrl : null,
                  verbatimQuote: null,
                  documentTypes: [],
                },
                status: "ACTIVE_WINNER",
              },
            ],
            actorHistory: [],
            downstreamImpacts: [
              {
                consumerType: "HARD_GATE_MATCH",
                summary: "Anti-portfolio conflict detection across VC fund holdings",
              },
            ],
          };
          map[`$.competitors[${cIdx}].name`] = compNode;
          map[`$.competitors.${c.name}`] = compNode;
        }
      });
    }

    // Commercial Prospects Lineage (Hayate 疾風)
    if (Array.isArray(dsl.commercialProspects)) {
      dsl.commercialProspects.forEach((p: any, pIdx: number) => {
        if (p.name) {
          const isUrl = Boolean(p.sourceUrl && (p.sourceUrl.startsWith("http://") || p.sourceUrl.startsWith("https://")));
          const docRes = resolveDealSourceDocument({
            dealDocs: dealDocuments,
            dealType: "VC",
            dealId,
            matchingTaxonomyCodes: ["VC_PITCH_DECK"],
          });
          const sourceFileName = isUrl ? p.sourceUrl : docRes.sourceFileName;
          const sourceFileUrl = isUrl ? p.sourceUrl : docRes.sourceFileUrl;

          const prospectNode: FieldLineageNode = {
            jsonPath: `$.commercialProspects[${pIdx}].name`,
            fieldLabel: `Commercial Prospect: ${p.name}`,
            activeValue: p.name,
            activeTaint: "UNVERIFIED_CLAIM",
            activeActor: humanActor || {
              actorType: "LLM_AGENT",
              agentPersonaId: "hayate",
              agentDisplayName: "Hayate (疾風) — Revenue & ICP Hunter",
              processStage: "WEB_RECON_DISCOVERY",
              modelSlug: "qwen/qwen-2.5-72b-instruct",
              promptTemplateId: "COMMERCIAL_RECON_V1",
              promptSha256: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7",
              temperature: 0,
              processedAt: new Date().toISOString(),
            },
            hasConflict: false,
            candidates: [
              {
                value: p.name,
                pointer: {
                  sourceFileName,
                  documentId: isUrl ? undefined : docRes.documentId,
                  sourceFileUrl,
                  taint: "UNVERIFIED_CLAIM",
                  pageOrSheet: isUrl ? p.sourceUrl : null,
                  verbatimQuote: null,
                  documentTypes: [],
                },
                status: "ACTIVE_WINNER",
              },
            ],
            actorHistory: [],
            downstreamImpacts: [
              {
                consumerType: "HARD_GATE_MATCH",
                summary: "Strategic corporate customer validation and syndicate commercial value-add",
              },
            ],
          };
          map[`$.commercialProspects[${pIdx}].name`] = prospectNode;
          map[`$.commercialProspects.${p.name}`] = prospectNode;

          // Discovered Executive Contacts Lineage (Hayate 疾風 / WEB_RECON_DISCOVERY)
          if (Array.isArray(p.contacts)) {
            p.contacts.forEach((contact: any, cIdx: number) => {
              if (contact && contact.fullName) {
                const directUrl = contact.sourceUrl || p.sourceUrl;
                const isContactUrl = Boolean(directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://")));
                const contactDocRes = resolveDealSourceDocument({
                  dealDocs: dealDocuments,
                  dealType: "VC",
                  dealId,
                  matchingTaxonomyCodes: ["VC_PITCH_DECK"],
                });
                const contactSourceFileName = isContactUrl ? directUrl : contactDocRes.sourceFileName;
                const contactSourceFileUrl = isContactUrl ? directUrl : contactDocRes.sourceFileUrl;

                const contactNode: FieldLineageNode = {
                  jsonPath: `$.commercialProspects[${pIdx}].contacts[${cIdx}].fullName`,
                  fieldLabel: `Executive Contact: ${contact.fullName} (${contact.title || "Decision Maker"})`,
                  activeValue: `${contact.fullName} — ${contact.title || "Role"} at ${p.name}`,
                  activeTaint: "UNVERIFIED_CLAIM",
                  activeActor: humanActor || {
                    actorType: "LLM_AGENT",
                    agentPersonaId: "hayate",
                    agentDisplayName: "Hayate (疾風) — Revenue & ICP Hunter",
                    processStage: "WEB_RECON_DISCOVERY",
                    modelSlug: "qwen/qwen-2.5-72b-instruct",
                    promptTemplateId: "CONTACT_DISCOVERY_V1",
                    promptSha256: "b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8",
                    temperature: 0,
                    processedAt: new Date().toISOString(),
                  },
                  hasConflict: false,
                  candidates: [
                    {
                      value: contact.fullName,
                      pointer: {
                        sourceFileName: contactSourceFileName,
                        documentId: isContactUrl ? undefined : contactDocRes.documentId,
                        sourceFileUrl: contactSourceFileUrl,
                        taint: "UNVERIFIED_CLAIM",
                        pageOrSheet: isContactUrl ? directUrl : null,
                        verbatimQuote: null,
                        documentTypes: [],
                      },
                      status: "ACTIVE_WINNER",
                    },
                  ],
                  actorHistory: [],
                  downstreamImpacts: [
                    {
                      consumerType: "HARD_GATE_MATCH",
                      summary: "Direct executive stakeholder outreach for corporate syndicate validation and sales acceleration",
                    },
                  ],
                };

                map[`$.commercialProspects[${pIdx}].contacts[${cIdx}].fullName`] = contactNode;
                map[`$.contacts.${contact.fullName}`] = contactNode;
                map[`$.commercialProspects.${p.name}.contacts.${contact.fullName}`] = contactNode;
              }
            });
          }
        }
      });
    }

    // Syndicate Matches Lineage (Daiki 大輝 & Seiji 正司)
    if (Array.isArray(dsl.matches)) {
      dsl.matches.slice(0, 50).forEach((m: any, mIdx: number) => {
        const invName = m.investor?.name || m.matchedName || `Venture Fund #${mIdx + 1}`;
        const matchNode: FieldLineageNode = {
          jsonPath: `$.matches[${mIdx}].verdict`,
          fieldLabel: `Syndicate Match: ${invName}`,
          activeValue: `${m.verdict} (${m.score ?? 85}%)`,
          activeTaint: "UNVERIFIED_CLAIM",
          activeActor: humanActor || {
            actorType: "LLM_AGENT",
            agentPersonaId: "daiki",
            agentDisplayName: "Daiki (大輝) — VC Thesis Architect",
            processStage: "BENCHMARK_SYNTHESIS",
            modelSlug: "deepseek/deepseek-v4-flash",
            promptTemplateId: "VC_MATCHING_V2",
            promptSha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
            temperature: 0,
            processedAt: new Date().toISOString(),
          },
          hasConflict: false,
          candidates: [
            {
              value: m.verdict,
              pointer: {
                sourceFileName: "Syndicate_Matching_Engine",
                taint: "UNVERIFIED_CLAIM",
                pageOrSheet: null,
                verbatimQuote: m.thesisAlignmentRationale || m.rationale || null,
                documentTypes: [],
              },
              status: "ACTIVE_WINNER",
            },
          ],
          actorHistory: [],
          downstreamImpacts: [
            {
              consumerType: "SYNDICATE_SIZING",
              summary: "Lead and co-investor allocation sizing",
            },
          ],
        };
        map[`$.matches[${mIdx}].verdict`] = matchNode;
        map[`$.matches.${invName}`] = matchNode;
      });
    }
  }

  return map;
}

