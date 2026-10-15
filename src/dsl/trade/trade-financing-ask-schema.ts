import { z } from "zod";

export const IndividualLegAskSchema = z.object({
  leg: z.enum(["SUPPLIER_LEG", "TRADER_LEG", "BUYER_LEG"]),
  targetEntity: z.string().describe("Party who is the obligor for this loan"),
  instrumentNeeded: z.enum([
    "PRE_SHIPMENT_PO_ADVANCE",
    "RED_CLAUSE_LC",
    "BACK_TO_BACK_LC_ISSUANCE",
    "IN_TRANSIT_INVENTORY_REPO",
    "WAREHOUSE_RECEIPT_FINANCING",
    "POST_SHIPMENT_USANCE_DISCOUNTING",
    "IMPORT_TRUST_RECEIPT_LOAN"
  ]),
  amountUsd: z.number(),
  advanceRatePct: z.number().min(0).max(100),
  tenorDaysMin: z.number().int(),
  tenorDaysMax: z.number().int(),
  primaryCollateral: z.string(),
  selfLiquidatingMechanism: z.string(),
});
export type IndividualLegAsk = z.infer<typeof IndividualLegAskSchema>;

export const TradeFinancingAsksSchema = z.object({
  dealId: z.string(),
  
  // Umbrella Ask (Prioritized)
  umbrellaAsk: z.object({
    preferred: z.boolean().default(true),
    totalFacilityAmountUsd: z.number(),
    targetStructure: z.string().describe("Unified Borrowing Base / Structured Commodity Trade Finance Facility"),
    allInTenorDays: z.number().int(),
    collateralPackage: z.array(z.string()),
  }),

  // Modular Asks (Fallback / Alternative)
  modularAsks: z.array(IndividualLegAskSchema),
});
export type TradeFinancingAsks = z.infer<typeof TradeFinancingAsksSchema>;
