/**
 * Comprehensive Field-Level Specification & Instructions Registry across all
 * three asset classes (Startup VC, Commodity Trade Finance, Invoice Factoring).
 *
 * Distinguishes:
 * 1. STRICT ENUM (Standard): Exact fixed values in Zod schema
 * 2. CONTROLLED TAXONOMY + ALIASES: Standard canonical list with alias normalization (e.g. jurisdiction)
 * 3. PROVENANCE-ANCHORED METRIC: Financial or legal numbers with taint tracking
 * 4. FREE TEXT (Document-Derived): Domain descriptive text or sub-industry tags
 */

import { VC_STANDARD_JURISDICTIONS } from "@/dsl/vc/vc-jurisdictions";

export type FieldClassification =
  | "STRICT_ENUM"
  | "CONTROLLED_TAXONOMY"
  | "PROVENANCE_METRIC"
  | "FREE_TEXT";

export interface FieldDocumentation {
  name: string;
  label: string;
  classification: FieldClassification;
  description: string;
  allowedValues?: readonly string[];
  examples?: string[];
  notes?: string;
}

export const VC_DEAL_SPEC_FIELDS: FieldDocumentation[] = [
  {
    name: "stage",
    label: "Financing Stage",
    classification: "STRICT_ENUM",
    description: "The venture round being raised. Matches against investor targetStages.",
    allowedValues: ["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "GROWTH"],
    notes: "Strict enum. Used by matching engine to filter investors whose fund mandates exclude this stage.",
  },
  {
    name: "primaryVertical",
    label: "Primary Industry Sector",
    classification: "STRICT_ENUM",
    description: "The macro venture vertical classifying the company's product offering.",
    allowedValues: [
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
    ],
    notes: "Strict enum. Must match one of the 12 institutional VC verticals.",
  },
  {
    name: "legalEntityJurisdiction",
    label: "Holding Legal Entity Jurisdiction",
    classification: "CONTROLLED_TAXONOMY",
    description:
      "The legal incorporation domicile of the top-level holding company issuing shares or SAFEs. Evaluated against investor mandate constraints.",
    allowedValues: VC_STANDARD_JURISDICTIONS,
    examples: [
      "Delaware (US) [NVCA / YC Post-Money SAFE standard]",
      "United Kingdom [BVCA / EIS / ASA standard]",
      "Singapore [VIMA standard]",
      "Hong Kong [Common Law APAC gateway]",
      "Cayman Islands [Offshore holding / Web3 foundation]",
    ],
    notes:
      "CONTROLLED TAXONOMY: Accepts one of the 16 global venture standards OR free text (e.g. 'London, UK' or 'Berlin, Germany'). The matcher normalizes aliases automatically, and investors with 'Any / Global' match all jurisdictions.",
  },
  {
    name: "industry",
    label: "Industry Domain & Core Narrative",
    classification: "FREE_TEXT",
    description:
      "A rich descriptive sentence or paragraph defining the company's exact operational domain and value proposition.",
    examples: [
      "Cross-Border Trade Finance Infrastructure & RWA Tokenization",
      "Blockchain-based water replenishment accounting, verification & ESG registry layer under the VWBA standard",
    ],
    notes:
      "FREE TEXT (Document-Derived): Sourced directly from company documents or refined by human operators. Injects semantic context into VC thesis resonance scoring and Hayate commercial prospect discovery.",
  },
  {
    name: "subIndustries",
    label: "Sub-Industry & Market Domain Tags",
    classification: "FREE_TEXT",
    description:
      "Specific niche market tags, technical methodologies, or business models that define where the company operates.",
    examples: [
      "For Blue Lifeline: ['Water Replenishment', 'Water Accounting', 'VWBA 2.0 Verification', 'ESG Water Credits']",
      "For Trade3: ['Commodities Trade Finance', 'Private Credit Tokenization', 'Cross-Border Factoring', 'RWA Debt Pools']",
    ],
    notes:
      "FREE TEXT (Array of Strings): Sourced from pitch deck / business plan. If automated extraction erroneously tags unrelated themes (such as carbon removal on a water company), human operators can edit this list and commit a named DSL revision.",
  },
  {
    name: "targetCustomerProfile",
    label: "Target Customer Profile (ICP)",
    classification: "FREE_TEXT",
    description:
      "Description of the ideal customer persona, buyer titles, or enterprise segments targeted for sales.",
    examples: [
      "Enterprise sustainability officers, Fortune 500 beverage and semiconductor manufacturers with water stewardship mandates",
      "Mid-market commodity trading houses and import-export originators seeking non-bank debt liquidity",
    ],
    notes: "FREE TEXT: Used by Agent Hayate to source verified commercial target accounts and decision-maker contacts.",
  },
  {
    name: "businessModel",
    label: "Monetization & Business Model",
    classification: "FREE_TEXT",
    description: "Revenue mechanics (e.g. annual SaaS subscription, basis-point volume fee, issuance take-rate).",
    examples: [
      "SaaS license + 1.5% verification & registry transaction fee per volumetric replenishment credit issued",
      "0.75% origination fee on funded trade facilities + 20 bps ongoing monitoring fee",
    ],
    notes: "FREE TEXT: Derived from financial plans and executive summaries.",
  },
  {
    name: "targetRaiseUsd",
    label: "Target Financing Raise (USD)",
    classification: "PROVENANCE_METRIC",
    description: "The capital amount currently being raised in this round.",
    examples: ["$500,000", "$2,000,000", "$5,000,000"],
    notes:
      "PROVENANCE-ANCHORED METRIC: Protected by Taint Tracking. Sourced from pitch deck or financial model and compared against investor min/max check sizes.",
  },
  {
    name: "valuationCapUsd",
    label: "Valuation Cap / Pre-Money Valuation (USD)",
    classification: "PROVENANCE_METRIC",
    description: "Valuation cap for SAFE/Note or pre-money valuation for priced preferred round.",
    examples: ["$12,000,000", "$20,000,000"],
    notes: "PROVENANCE-ANCHORED METRIC: Used to calculate post-money dilution in Agent Daiki's syndicate blueprint.",
  },
  {
    name: "instrumentType",
    label: "Financing Instrument Type",
    classification: "STRICT_ENUM",
    description: "The legal security contract being issued to investors.",
    allowedValues: [
      "POST_MONEY_SAFE",
      "PRE_MONEY_SAFE",
      "CONVERTIBLE_NOTE",
      "PRICED_PREFERRED_EQUITY",
      "ACCELERATOR_STANDARD_TERMS",
    ],
    notes: "Strict enum. Y Combinator Post-Money SAFE is the seed venture standard.",
  },
  {
    name: "foundersOwnershipPct",
    label: "Founders Aggregate Equity (%)",
    classification: "PROVENANCE_METRIC",
    description: "Percentage of common equity held by active founding team members.",
    examples: ["85.0%", "72.5%"],
    notes:
      "PROVENANCE-ANCHORED METRIC: Verified from cap table document. Audited cap tables take precedence over pitch deck claims.",
  },
];

export const TRADE_DEAL_SPEC_FIELDS: FieldDocumentation[] = [
  {
    name: "corridor",
    label: "Trade Corridor",
    classification: "STRICT_ENUM",
    description: "Geographic origin to destination maritime or cross-border trade route.",
    allowedValues: [
      "LATAM_TO_US",
      "LATAM_TO_EU",
      "LATAM_TO_ASIA",
      "AFRICA_TO_EU",
      "AFRICA_TO_ASIA",
      "ASIA_TO_US",
      "ASIA_TO_EU",
      "INTRA_EUROPE",
      "INTRA_NORTH_AMERICA",
      "OTHER_CROSS_BORDER",
    ],
    notes: "Strict enum. Trade funders enforce strict geographic corridor risk limits.",
  },
  {
    name: "incoterm",
    label: "Incoterm (ICC Rule)",
    classification: "STRICT_ENUM",
    description: "International Commercial Term governing point of title, insurance, and risk transfer.",
    allowedValues: ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"],
    notes: "Strict enum. Dictates required trade documents (e.g. FOB requires Ocean Bill of Lading).",
  },
  {
    name: "commodityName",
    label: "Commodity Description",
    classification: "FREE_TEXT",
    description: "Exact specification, grade, and classification of the physical cargo.",
    examples: ["Copper Cathodes Grade A (99.9935% Purity)", "Arabica Green Coffee Beans Grade 1"],
    notes: "FREE TEXT: Checked against funder prohibited commodity lists (e.g. coal, conflict minerals).",
  },
  {
    name: "amountUsd",
    label: "Cargo / Invoice Value (USD)",
    classification: "PROVENANCE_METRIC",
    description: "Total commercial invoice value for the contract leg.",
    examples: ["$1,500,000", "$3,500,000"],
    notes: "PROVENANCE-ANCHORED METRIC: Verified against commercial invoice, SPA contract, and inspection assay.",
  },
  {
    name: "tenorDays",
    label: "Financing Tenor (Days)",
    classification: "PROVENANCE_METRIC",
    description: "Number of days from cargo dispatch or invoice issuance to buyer settlement.",
    examples: ["60 days", "90 days", "120 days"],
    notes: "PROVENANCE-ANCHORED METRIC: Matched against funder max allowed tenor.",
  },
  {
    name: "jurisdiction",
    label: "Counterparty Jurisdiction",
    classification: "CONTROLLED_TAXONOMY",
    description: "Country of incorporation for supplier, trader, or buyer entity.",
    examples: ["United States", "United Kingdom", "Switzerland", "Singapore", "Chile", "Brazil"],
    notes: "CONTROLLED TAXONOMY: Checked against sanction lists, FATF gray lists, and funder country eligibility.",
  },
];

export const INVOICE_DEAL_SPEC_FIELDS: FieldDocumentation[] = [
  {
    name: "parties[].role",
    label: "Party Role",
    classification: "STRICT_ENUM",
    description: "Counterparty legal status in the transaction.",
    allowedValues: ["BORROWER", "OBLIGOR", "SUPPLIER", "INTERMEDIARY", "GUARANTOR"],
    notes: "Zod: z.enum(['BORROWER', 'OBLIGOR', 'SUPPLIER', 'INTERMEDIARY', 'GUARANTOR']). Controls credit risk gating.",
  },
  {
    name: "parties[].legalName",
    label: "Party Legal Entity Name",
    classification: "PROVENANCE_METRIC",
    description: "Registered corporate legal entity name extracted from contracts or incorporation certificates.",
    examples: ["Pacific Trade Logistics Ltd.", "Nippon Retail Corp."],
    notes: "Zod: z.string().min(1). Provenance-anchored with verbatim quote and source document pointer.",
  },
  {
    name: "parties[].jurisdiction",
    label: "Party Incorporation Jurisdiction",
    classification: "CONTROLLED_TAXONOMY",
    description: "Legal domicile of the party. Normalized automatically across standard aliases (e.g. 'HK' == 'Hong Kong').",
    examples: ["Hong Kong", "Japan", "Singapore", "United States", "United Kingdom"],
    notes: "CONTROLLED TAXONOMY: Equates 'HK', 'Hong Kong', 'HKSAR' and checks provider geographic appetite.",
  },
  {
    name: "parties[].publicRating",
    label: "Public Credit Rating",
    classification: "PROVENANCE_METRIC",
    description: "External statutory or commercial credit score (e.g. S&P, Moody's, JCR, Teikoku).",
    examples: ["JCR A+", "S&P BBB-", "A2"],
    notes: "Optional string verified against financial filings or debtor credit summaries.",
  },
  {
    name: "parties[].primaryRightHolderName",
    label: "Chain-of-Title Concession Holder",
    classification: "CONTROLLED_TAXONOMY",
    description: "Primary licence/quota holder when counterparty is an INTERMEDIARY broker or trading entity.",
    examples: ["PT Mining Concession Holder"],
    notes: "Applicable only when role === 'INTERMEDIARY'. Triggers CHAIN_OF_TITLE risk flag if unverified.",
  },
  {
    name: "structureType",
    label: "Receivables Facility Structure",
    classification: "STRICT_ENUM",
    description: "The legal debt facility mechanics.",
    allowedValues: [
      "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
      "PRE_SHIPMENT_PROCUREMENT_FINANCE",
      "PRE_EXPORT_BORROWING_BASE",
      "ENTERPRISE_SCF_REVERSE_FACTORING",
    ],
    notes: "Zod: z.enum([...]). Dictates provider matching rules and security documentation.",
  },
  {
    name: "amount",
    label: "Facility / Invoice Amount",
    classification: "PROVENANCE_METRIC",
    description: "Gross invoice nominal value.",
    examples: ["$250,000", "$1,000,000"],
    notes: "Zod: z.number(). Provenance-anchored metric verified against invoice documents.",
  },
  {
    name: "advanceRatePct",
    label: "Requested Advance Rate (%)",
    classification: "PROVENANCE_METRIC",
    description: "Percentage of gross invoice funded upfront.",
    examples: ["80.0%", "85.0%", "90.0%"],
    notes: "Zod: z.number().min(0).max(100). Providers typically cap advance rates between 75% and 90%.",
  },
  {
    name: "tenorDaysMax",
    label: "Facility Tenor (Days)",
    classification: "PROVENANCE_METRIC",
    description: "Target payment duration or payment window from invoice issue to maturity.",
    examples: ["60 days", "90 days", "120 days"],
    notes: "Zod: z.number().int(). Matched against provider tenor limits.",
  },
];
