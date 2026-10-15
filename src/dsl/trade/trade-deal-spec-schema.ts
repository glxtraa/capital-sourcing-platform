import { z } from "zod";
import { TradeCorridor, Incoterm2020, TradePaymentType } from "./trade-extraction-schema";

export const PartyProfileSchema = z.object({
  id: z.string(),
  legalName: z.string(),
  jurisdiction: z.string(),
  role: z.enum(["SUPPLIER", "TRADER", "BUYER"]),
  concessionOrLicenseNumber: z.string().nullable().optional(),
  licenseVerified: z.boolean().default(false),
  bankName: z.string().nullable().optional(),
  swiftBic: z.string().nullable().optional(),
  publicRating: z.string().nullable().optional(),
  sourceDocument: z.string().nullable().optional(),
  extractionTimestamp: z.string().nullable().optional(),
  modelUsed: z.string().nullable().optional(),
});
export type PartyProfile = z.infer<typeof PartyProfileSchema>;

export const TradeLegContractSchema = z.object({
  contractReference: z.string(),
  incoterm: Incoterm2020,
  port: z.string(),
  paymentType: TradePaymentType,
  tenorDays: z.number().int(),
  contractAmountUsd: z.number(),
  laycanWindow: z.object({
    start: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
  }).nullable().optional(),
  sourceDocument: z.string().nullable().optional(),
  extractionTimestamp: z.string().nullable().optional(),
  modelUsed: z.string().nullable().optional(),
});
export type TradeLegContract = z.infer<typeof TradeLegContractSchema>;

export const TradeDealSpecSchema = z.object({
  dealId: z.string(),
  dealName: z.string(),
  corridor: TradeCorridor,

  // Reconciled Counterparties
  supplier: PartyProfileSchema,
  trader: PartyProfileSchema,
  buyer: PartyProfileSchema,

  // Paired Contracts
  supplyContract: TradeLegContractSchema.describe("Leg 1: Supplier -> Trader"),
  offtakeContract: TradeLegContractSchema.describe("Leg 2: Trader -> Buyer"),

  // Physical Commodity Parameters
  commodity: z.object({
    name: z.string(),
    hsCode: z.string().nullable().optional(),
    contractQuantity: z.number(),
    unit: z.string(),
    unitPriceUsd: z.number(),
    qualityAssay: z.record(z.string(), z.string()),
  }),

  // Reconciliation Audit
  reconciliationAudit: z.object({
    volumeToleranceDelta: z.number().describe("Difference in tolerance between buy and sell contracts"),
    specReconciled: z.boolean(),
    specNotes: z.string(),
    cashflowGapDays: z.number().describe("Working capital gap between paying supplier and receiving buyer payment"),
    grossMarginUsd: z.number(),
    grossMarginPct: z.number(),
  }),

  // Corridor Specific Checks
  corridorAudits: z.object({
    concessionChainVerified: z.boolean().describe("IUP-OP to IUP-OPK link clean (Corridor A)"),
    sustainabilityCertVerified: z.boolean().describe("RSPO/ISPO verified (Corridor B)"),
    coldChainSanitaryClearance: z.boolean().describe("Reefer temp logs & SANIPES/INP/SERNAPESCA cert verified (Corridor C)"),
  }),

  riskFlags: z.array(z.object({
    category: z.string(),
    severity: z.number().int().min(1).max(5),
    description: z.string(),
  })),

  readyForMatching: z.boolean(),
});
export type TradeDealSpec = z.infer<typeof TradeDealSpecSchema>;
