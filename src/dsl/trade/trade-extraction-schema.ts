import { z } from "zod";

export const TradeCorridor = z.enum([
  "IDN_COAL_ASIA",           // Indonesian Coal -> China/India/SE Asia
  "SEA_AGRI_GLOBAL",         // SE Asian Palm/Rubber/Coffee -> Global/Asia
  "LATAM_SEAFOOD_ASIA",      // LatAm Shrimp/Squid/Salmon -> China/Japan/Korea
  "OTHER_CROSS_BORDER"
]);
export type TradeCorridor = z.infer<typeof TradeCorridor>;

export const TradeLegClassification = z.enum([
  "SUPPLY_LEG",              // Supplier <-> Trader (Procurement contract)
  "OFFTAKE_LEG",             // Trader <-> Buyer (Sales contract)
  "MARITIME_LOGISTICS",      // Charter Party, Bill of Lading, NOR, Cargo manifest
  "COLD_CHAIN_LOGISTICS",    // Reefer temperature datalogs, pre-cooling certs
  "INSPECTION_SURVEY",       // Draft survey, COA, LHV, SGS, Intertek
  "CONCESSION_REGULATORY",   // Mining IUP-OP, IUP-OPK, SIMPONI PNBP, Health Cert
  "FINANCIAL_INSTRUMENT",    // MT700 LC, MT760 SBLC, Bank Guarantee, Insurance
  "CORPORATE_KYC"            // Incorp, UBO, Audited Financials
]);
export type TradeLegClassification = z.infer<typeof TradeLegClassification>;

export const Incoterm2020 = z.enum([
  "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"
]);
export type Incoterm2020 = z.infer<typeof Incoterm2020>;

export const TradePaymentType = z.enum([
  "LC_AT_SIGHT",
  "LC_USANCE_30D",
  "LC_USANCE_60D",
  "LC_USANCE_90D",
  "LC_USANCE_120D",
  "BACK_TO_BACK_LC",
  "TRANSFERABLE_LC",
  "STANDBY_LC_MT760",
  "DOCUMENTS_AGAINST_PAYMENT_DP",
  "DOCUMENTS_AGAINST_ACCEPTANCE_DA",
  "TELEGRAPHIC_TRANSFER_ADVANCE",
  "TELEGRAPHIC_TRANSFER_ON_BL",
  "OPEN_ACCOUNT_NET_30_60"
]);
export type TradePaymentType = z.infer<typeof TradePaymentType>;

export const TradeDocumentExtractionSchema = z.object({
  documentSummary: z.string(),
  corridor: TradeCorridor,
  tradeLeg: TradeLegClassification,
  documentTypes: z.array(z.string()).describe("Matched TRADE_DOCUMENT_TAXONOMY codes"),

  parties: z.array(z.object({
    role: z.enum(["SUPPLIER", "TRADER", "BUYER", "CARRIER", "SURVEYOR", "CONCESSION_HOLDER", "ISSUING_BANK"]),
    legalName: z.string(),
    jurisdiction: z.string().nullable().optional(),
    permitOrLicenseId: z.string().nullable().optional().describe("e.g. IUP-OP, IUP-OPK, SANIPES plant approval code"),
  })),

  commercialParameters: z.object({
    incoterm: Incoterm2020.nullable().optional(),
    loadingPortOrTerminal: z.string().nullable().optional(),
    dischargePortOrTerminal: z.string().nullable().optional(),
    paymentType: TradePaymentType.nullable().optional(),
    advanceDepositPct: z.number().nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    totalValueUsd: z.number().nullable().optional(),
  }).nullable().optional(),

  commoditySpecs: z.object({
    commodityName: z.string(),
    volume: z.number().nullable().optional(),
    volumeUnit: z.enum(["MT", "BBL", "KG", "LBS", "TEU"]).nullable().optional(),
    tolerancePct: z.number().nullable().optional().describe("+/- % tolerance"),
    qualityParameters: z.record(z.string(), z.string()).default({}).describe(
      "e.g. { 'GAR': '4200 kcal', 'Moisture': '32%' } or { 'Size': '21/25', 'Glazing': '10%' }"
    ),
  }).nullable().optional(),

  specializedVerifications: z.object({
    coalLhvSurveyorReportPresent: z.boolean().default(false),
    coalSimponiRoyaltyPaid: z.boolean().default(false),
    rspoOrIspoCertified: z.boolean().default(false),
    coldChainContinuousOk: z.boolean().default(false),
    healthCertSanitaryApproved: z.boolean().default(false),
  }).default({
    coalLhvSurveyorReportPresent: false,
    coalSimponiRoyaltyPaid: false,
    rspoOrIspoCertified: false,
    coldChainContinuousOk: false,
    healthCertSanitaryApproved: false,
  }),

  riskFlags: z.array(z.object({
    category: z.enum([
      "CHAIN_OF_TITLE_GAP",
      "QUANTITY_OR_TOLERANCE_MISMATCH",
      "PAYMENT_TERM_DESYNCHRONIZATION",
      "COLD_CHAIN_TEMPERATURE_ABUSE",
      "SANCTION_FLAG",
      "DOUBLE_PLEDGE_INDICATOR",
      "MISSING_MANDATORY_PERMIT"
    ]),
    severity: z.number().int().min(1).max(5),
    description: z.string(),
  })),

  openQuestions: z.array(z.string()).default([]),

  // Traceability & Lineage Metadata
  extractionProvenance: z.object({
    sourceFileName: z.string().default(""),
    extractedAt: z.string().default(""),
    modelUsed: z.string().default(""),
    ocrEngineUsed: z.string().default(""),
  }).optional(),
});
export type TradeDocumentExtraction = z.infer<typeof TradeDocumentExtractionSchema>;
