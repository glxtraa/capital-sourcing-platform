/**
 * Registry of authoritative TypeScript/Zod DSL Schema Code Definitions.
 * Allows users to inspect the exact underlying Zod schemas without editing privileges.
 */

export interface ZodDslSchemaDefinition {
  id: string;
  title: string;
  assetClass: "INVOICE" | "TRADE" | "VC" | "SHARED";
  summary: string;
  code: string;
}

export const ZOD_DSL_DEFINITIONS: Record<string, ZodDslSchemaDefinition> = {
  // 1. INVOICE DEAL SPEC & EXTRACTION
  INVOICE_DEAL_SPEC: {
    id: "INVOICE_DEAL_SPEC",
    title: "Invoice Deal Spec & Extracted Parties Zod Schema",
    assetClass: "INVOICE",
    summary: "Runtime Zod schema validating extracted counterparties, financing asks, risk flags, and credit ratings for invoice factoring.",
    code: `import { z } from "zod";

export const FinancingStructureType = z.enum([
  "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
  "PRE_SHIPMENT_PROCUREMENT_FINANCE",
  "PRE_EXPORT_BORROWING_BASE",
  "ENTERPRISE_SCF_REVERSE_FACTORING",
  "UNKNOWN",
]);

export const PartyRole = z.enum([
  "BORROWER",
  "OBLIGOR",
  "SUPPLIER",
  "INTERMEDIARY",
  "GUARANTOR",
]);

export const PartySchema = z.object({
  role: PartyRole,
  legalName: z.string().min(1),
  jurisdiction: z.string().nullable().optional()
    .describe("Incorporation domicile. Normalized across HK/Hong Kong/SG/Japan/US aliases."),
  isListed: z.boolean().nullable().optional(),
  publicRating: z.string().nullable().optional()
    .describe("Statutory or credit agency rating (e.g. S&P BBB+, JCR A, Moody's A3)"),
  bankName: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  primaryRightHolderName: z.string().nullable().optional()
    .describe("Only for role === 'INTERMEDIARY'. Primary license/concession holder."),
  primaryRightHolderVerified: z.boolean().default(false),
  sourceDocuments: z.array(z.string()).default([]),
  verbatimQuote: z.string().nullable().optional(),
  pageOrSheet: z.string().nullable().optional(),
});

export const FinancingAskSchema = z.object({
  structureType: FinancingStructureType,
  structureTypeConfidence: z.enum([
    "sourced_from_client_framing",
    "inferred_from_contract_terms",
    "low_confidence_guess"
  ]).nullable().optional(),
  amount: z.number().nullable().optional(),
  currency: z.string().length(3).nullable().optional().describe("ISO 4217, e.g. USD, IDR, JPY"),
  advanceRatePct: z.number().min(0).max(100).nullable().optional(),
  tenorDaysMin: z.number().int().nullable().optional(),
  tenorDaysMax: z.number().int().nullable().optional(),
  tenorNote: z.string().nullable().optional(),
  recurring: z.boolean().default(false),
});

export const InvoiceDealSpecSchema = z.object({
  parties: z.array(PartySchema).min(1),
  financingAsks: z.array(FinancingAskSchema).min(1),
  riskFlags: z.array(z.object({
    category: z.string(),
    severity: z.number().min(1).max(5),
    description: z.string(),
  })).default([]),
  readyForMatching: z.boolean().default(false),
});`,
  },

  INVOICE_EXTRACTION: {
    id: "INVOICE_EXTRACTION",
    title: "Invoice Document Extraction Zod Schema",
    assetClass: "INVOICE",
    summary: "Schema parsed by LLM extraction agents when reading unstructured invoice PDFs and financial statements.",
    code: `import { z } from "zod";
import { PartySchema, FinancingAskSchema } from "@/dsl/schema";

export const InvoiceDocumentExtractionSchema = z.object({
  documentSummary: z.string().describe("1-3 sentence factual summary of the document"),
  documentTypes: z.array(z.string()).describe("Taxonomy codes, e.g. DEAL_CONTRACT, CORP_INCORP, INVOICE_COPY"),
  parties: z.array(PartySchema),
  financingAsks: z.array(FinancingAskSchema),
  riskFlags: z.array(z.object({
    category: z.string(),
    severity: z.number().int().min(1).max(5),
    description: z.string(),
  })),
  openQuestions: z.array(z.string()).default([]),
});`,
  },

  // 2. TRADE COMMODITY SPEC & EXTRACTION
  TRADE_DEAL_SPEC: {
    id: "TRADE_DEAL_SPEC",
    title: "Trade Commodity Deal Spec Zod Schema",
    assetClass: "TRADE",
    summary: "Runtime Zod schema validating bilateral physical trade contracts, paired legs, gross margin reconciliation, and Incoterm discharge ports.",
    code: `import { z } from "zod";

export const Incoterm2020 = z.enum([
  "FOB", "CIF", "CFR", "FAS", "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP"
]);

export const TradeCorridor = z.enum([
  "IDN_COAL_ASIA",
  "SEA_AGRI_GLOBAL",
  "LATAM_SEAFOOD_ASIA",
  "OTHER_CROSS_BORDER"
]);

export const TradeLegContractSchema = z.object({
  role: z.enum(["SUPPLIER_LEG", "BUYER_LEG", "TRADER_INTERMEDIARY"]),
  contractRef: z.string().optional(),
  counterpartyName: z.string(),
  commodityName: z.string(),
  quantity: z.number().positive(),
  unit: z.enum(["MT", "BARRELS", "CONTAINERS", "LBS", "KG"]),
  unitPriceUsd: z.number().positive(),
  amountUsd: z.number().positive(),
  incoterm: Incoterm2020,
  loadingPort: z.string(),
  dischargePort: z.string(),
  paymentTerms: z.string().describe("e.g. 100% at sight Irrevocable LC, 90 days Usance LC"),
});

export const TradeDealSpecSchema = z.object({
  dealName: z.string(),
  corridor: TradeCorridor,
  supplier: z.object({
    legalName: z.string(),
    jurisdiction: z.string(),
    role: z.literal("SUPPLIER"),
  }),
  buyer: z.object({
    legalName: z.string(),
    jurisdiction: z.string(),
    role: z.literal("BUYER"),
  }),
  trader: z.object({
    legalName: z.string(),
    jurisdiction: z.string(),
    role: z.literal("TRADER"),
  }).optional(),
  commodity: z.object({
    name: z.string(),
    contractQuantity: z.number().positive(),
    unit: z.string(),
    originCountry: z.string(),
  }),
  reconciliationAudit: z.object({
    buyLegUsd: z.number().nullable().optional(),
    sellLegUsd: z.number().nullable().optional(),
    grossMarginUsd: z.number().nullable().optional(),
    marginPositive: z.boolean(),
  }),
  financingAsks: z.array(z.object({
    amount: z.number().positive(),
    advanceRatePct: z.number().min(0).max(100),
  })),
});`,
  },

  TRADE_EXTRACTION: {
    id: "TRADE_EXTRACTION",
    title: "Trade Document Extraction & Commodity Specs Zod Schema",
    assetClass: "TRADE",
    summary: "Schema parsed by maritime & commodity contract parsing agents (Minato 湊) for multi-leg trade validation.",
    code: `import { z } from "zod";

export const TradeDocumentExtractionSchema = z.object({
  documentSummary: z.string(),
  documentType: z.enum([
    "SUPPLY_CONTRACT", "OFFTAKE_CONTRACT", "BILL_OF_LADING",
    "SURVEYOR_REPORT", "LETTER_OF_CREDIT", "MINING_PERMIT_CHAIN", "OTHER"
  ]),
  parties: z.array(z.object({
    role: z.enum(["SUPPLIER", "TRADER", "BUYER", "INSPECTOR", "CARRIER"]),
    legalName: z.string(),
    jurisdiction: z.string().nullable().optional(),
    taxOrRegistrationId: z.string().nullable().optional(),
  })),
  commercialParameters: z.object({
    contractAmountUsd: z.number().nullable().optional(),
    unitPriceUsd: z.number().nullable().optional(),
    quantityMetricTons: z.number().nullable().optional(),
    incoterm: z.string().nullable().optional(),
    dischargePort: z.string().nullable().optional(),
    paymentTerms: z.string().nullable().optional(),
  }),
  commoditySpecs: z.object({
    commodityType: z.string().nullable().optional(),
    calorificValueKcalKg: z.number().nullable().optional(),
    moisturePct: z.number().nullable().optional(),
    sulfurPct: z.number().nullable().optional(),
    specificationsSummary: z.string().nullable().optional(),
  }),
});`,
  },

  // 3. STARTUP VENTURE CAPITAL SPEC & EXTRACTION
  STARTUP_DEAL_SPEC: {
    id: "STARTUP_DEAL_SPEC",
    title: "Startup VC Deal Spec Zod Schema",
    assetClass: "VC",
    summary: "Runtime Zod schema validating venture round parameters, Cap Table ownership, runway, and financing ask structures.",
    code: `import { z } from "zod";

export const StartupStageSchema = z.enum([
  "PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "GROWTH"
]);

export const StartupSectorSchema = z.enum([
  "B2B_SAAS", "FINTECH", "AI_ML_INFRASTRUCTURE", "GENERATIVE_AI_APPS",
  "CLIMATETECH", "HEALTHTECH_BIOTECH", "DEV_TOOLS_CYBERSECURITY",
  "HARDWARE_ROBOTICS_DEFENSE", "CONSUMER_MARKETPLACE", "OTHER"
]);

export const StartupInstrumentSchema = z.enum([
  "POST_MONEY_SAFE", "PRE_MONEY_SAFE", "CONVERTIBLE_NOTE",
  "PRICED_PREFERRED_EQUITY", "COMMON_EQUITY", "VENTURE_DEBT"
]);

export const StartupDealSpecSchema = z.object({
  companyName: z.string().min(1),
  stage: StartupStageSchema,
  primaryVertical: StartupSectorSchema,
  industry: z.string().nullable().optional(),
  subIndustries: z.array(z.string()).default([]),
  targetCustomerProfile: z.string().nullable().optional(),
  businessModel: z.string().nullable().optional(),
  legalEntityJurisdiction: z.string().describe("Normalized across 16 global standards (e.g. Delaware, UK, Singapore, Hong Kong)"),
  financingAsk: z.object({
    amountUsd: z.number().positive(),
    valuationCapUsd: z.number().positive().nullable().optional(),
    instrumentType: StartupInstrumentSchema,
    plannedRunwayMonths: z.number().positive().nullable().optional(),
  }),
  capTable: z.object({
    foundersOwnershipPct: z.number().min(0).max(100),
    investorsOwnershipPct: z.number().min(0).max(100),
    optionPoolPct: z.number().min(0).max(100),
    safesIssuedTotalUsd: z.number().min(0).default(0),
  }),
});`,
  },

  VC_EXTRACTION: {
    id: "VC_EXTRACTION",
    title: "Startup Pitch Deck & Cap Table Extraction Zod Schema",
    assetClass: "VC",
    summary: "Schema parsed by extraction agents (Makoto 誠) when evaluating pitch decks, financial models, and cap tables.",
    code: `import { z } from "zod";

export const StartupDocumentExtractionSchema = z.object({
  companyName: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  primaryVertical: z.string().nullable().optional(),
  legalEntityJurisdiction: z.string().nullable().optional(),
  financingAsk: z.object({
    amountUsd: z.number().nullable().optional(),
    valuationCapUsd: z.number().nullable().optional(),
    instrumentType: z.string().nullable().optional(),
    plannedRunwayMonths: z.number().nullable().optional(),
  }).nullable().optional(),
  founders: z.array(z.object({
    name: z.string(),
    title: z.string().optional(),
    ownershipPct: z.number().optional(),
    isKeyPerson: z.boolean().default(true),
  })).default([]),
  capTableSummary: z.object({
    foundersOwnershipPct: z.number().optional(),
    investorsOwnershipPct: z.number().optional(),
    optionPoolPct: z.number().optional(),
  }).nullable().optional(),
  competitorsMentioned: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    differentiation: z.string().optional(),
  })).default([]),
});`,
  },

  // 4. VENTURE MATCHING & SYNDICATE BLUEPRINT
  SYNDICATE_BLUEPRINT: {
    id: "SYNDICATE_BLUEPRINT",
    title: "Venture Syndicate Blueprint Zod Schema",
    assetClass: "VC",
    summary: "Output schema for Daiki (大輝) multi-tier syndicate allocation models and round tranching.",
    code: `import { z } from "zod";

export const SyndicateRoundMatchingResultSchema = z.object({
  targetRaiseUsd: z.number().positive(),
  valuationBenchmarkPercentiles: z.object({
    p25Usd: z.number(),
    medianUsd: z.number(),
    p75Usd: z.number(),
    recommendedCapUsd: z.number(),
  }),
  tierAllocations: z.object({
    leadCandidate: z.object({
      targetAllocationUsd: z.number(),
      allocationPct: z.number(),
      topMatches: z.array(z.string()),
    }),
    syndicateRound: z.object({
      targetAllocationUsd: z.number(),
      allocationPct: z.number(),
      topMatches: z.array(z.string()),
    }),
    angelCohort: z.object({
      targetAllocationUsd: z.number(),
      allocationPct: z.number(),
      topMatches: z.array(z.string()),
    }),
  }),
  dilutionMatrix: z.object({
    postMoneyValuationUsd: z.number(),
    founderDilutionPct: z.number(),
    optionPoolExpansionPct: z.number(),
  }),
});`,
  },

  // 5. DATA LINEAGE PROVENANCE
  PROVENANCE_LINEAGE: {
    id: "PROVENANCE_LINEAGE",
    title: "Data Provenance & Traceability Node Zod Schema",
    assetClass: "SHARED",
    summary: "Runtime schema backing the Provenance Matrix, Taint Precedence, and X-Ray source evidence pointers.",
    code: `import { z } from "zod";

export const DataTaintPolicy = z.enum([
  "AUDITED_PROOF",
  "UNVERIFIED_CLAIM",
  "CONFLICTED_SUSPECT",
  "HUMAN_VERIFIED"
]);

export const ProvenancePointerSchema = z.object({
  sourceFileName: z.string(),
  documentId: z.string().optional(),
  sourceFileUrl: z.string().optional(),
  taint: DataTaintPolicy,
  pageOrSheet: z.string().nullable().optional(),
  verbatimQuote: z.string().nullable().optional(),
  documentTypes: z.array(z.string()).default([]),
});

export const FieldLineageNodeSchema = z.object({
  jsonPath: z.string(),
  fieldLabel: z.string(),
  activeValue: z.unknown(),
  activeTaint: DataTaintPolicy,
  hasConflict: z.boolean().default(false),
  candidates: z.array(z.object({
    value: z.unknown(),
    pointer: ProvenancePointerSchema,
    status: z.enum(["ACTIVE_WINNER", "SUPERSEDED_BY_HIGHER_TAINT", "CONFLICT_FLAGGED"]),
  })),
  actorHistory: z.array(z.object({
    actorType: z.enum(["LLM_AGENT", "HUMAN_OPERATOR", "DETERMINISTIC_RULES"]),
    displayName: z.string(),
    timestamp: z.string(),
    actionTaken: z.string(),
  })),
});`,
  },
};

/**
 * Resolves the corresponding Zod DSL definition by agent flow, DSL type, or tab key.
 */
export function resolveZodDslDefinition(options: {
  dslType?: string;
  agentFlow?: string;
  assetClass?: "INVOICE" | "TRADE" | "VC" | "STARTUP";
  dealType?: "invoice" | "trade" | "vc";
}): ZodDslSchemaDefinition {
  const { dslType, agentFlow, assetClass, dealType } = options;
  const flowStr = (agentFlow || "").toUpperCase();
  const typeStr = (dslType || "").toUpperCase();
  const clsStr = (assetClass || dealType || "").toUpperCase();

  if (typeStr.includes("INVOICE") || flowStr.includes("INVOICE") || clsStr === "INVOICE") {
    if (typeStr.includes("EXTRACTION") || flowStr.includes("EXTRACTION")) {
      return ZOD_DSL_DEFINITIONS.INVOICE_EXTRACTION;
    }
    return ZOD_DSL_DEFINITIONS.INVOICE_DEAL_SPEC;
  }

  if (typeStr.includes("TRADE") || flowStr.includes("TRADE") || clsStr === "TRADE") {
    if (typeStr.includes("EXTRACTION") || flowStr.includes("EXTRACTION")) {
      return ZOD_DSL_DEFINITIONS.TRADE_EXTRACTION;
    }
    return ZOD_DSL_DEFINITIONS.TRADE_DEAL_SPEC;
  }

  if (typeStr.includes("BLUEPRINT") || flowStr.includes("SYNDICATE")) {
    return ZOD_DSL_DEFINITIONS.SYNDICATE_BLUEPRINT;
  }

  if (typeStr.includes("EXTRACTION") || flowStr.includes("EXTRACTION")) {
    return ZOD_DSL_DEFINITIONS.VC_EXTRACTION;
  }

  return ZOD_DSL_DEFINITIONS.STARTUP_DEAL_SPEC;
}
