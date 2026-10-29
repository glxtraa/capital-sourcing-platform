import { z } from "zod";
import {
  StartupStageSchema,
  StartupSectorSchema,
  StartupInstrumentSchema,
  FounderExtractionSchema,
  CapTableExtractionSchema,
  TractionExtractionSchema,
  AskExtractionSchema,
  RiskFlagExtractionSchema,
  StartupCompetitorExtractionSchema,
  StartupCommercialProspectSchema,
} from "./vc-extraction-schema";
import { StartupJurisdictionSchema } from "./vc-jurisdictions";

export const StartupDealSpecSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  stage: StartupStageSchema,
  primaryVertical: StartupSectorSchema,
  industry: z.string().nullable().optional(),
  subIndustries: z.array(z.string()).default([]),
  legalEntityJurisdiction: StartupJurisdictionSchema.nullable().optional(),

  founders: z.array(FounderExtractionSchema),
  competitors: z.array(StartupCompetitorExtractionSchema).default([]),
  commercialProspects: z.array(StartupCommercialProspectSchema).default([]),
  traction: TractionExtractionSchema,
  capTable: CapTableExtractionSchema,
  financingAsk: AskExtractionSchema,

  reconciliationAudit: z.object({
    dataRoomDiscrepancies: z.array(z.string()).default([]),
    metricsValidatedAgainstFinancialModel: z.boolean().default(false),
    capTableReconciled: z.boolean().default(false),
    impliedRunwayExtensionMonths: z.number().nullable().optional(),
    impliedPostMoneyValuationUsd: z.number().nullable().optional(),
    founderDilutionPct: z.number().nullable().optional(),
  }),

  competitorAudit: z
    .object({
      totalIdentified: z.number().default(0),
      directCompetitorsCount: z.number().default(0),
      verifiedSourcesCount: z.number().default(0),
      conflictingInvestorsIdentified: z.array(z.string()).default([]),
      auditSummary: z.string().default(""),
    })
    .default({
      totalIdentified: 0,
      directCompetitorsCount: 0,
      verifiedSourcesCount: 0,
      conflictingInvestorsIdentified: [],
      auditSummary: "",
    }),

  commercialAudit: z
    .object({
      totalIdentified: z.number().default(0),
      targetCustomersCount: z.number().default(0),
      strategicPartnersCount: z.number().default(0),
      verifiedSourcesCount: z.number().default(0),
      auditSummary: z.string().default(""),
    })
    .default({
      totalIdentified: 0,
      targetCustomersCount: 0,
      strategicPartnersCount: 0,
      verifiedSourcesCount: 0,
      auditSummary: "",
    }),

  riskFlags: z.array(RiskFlagExtractionSchema).default([]),
  readyForMatching: z.boolean(),
});
export type StartupDealSpec = z.infer<typeof StartupDealSpecSchema>;
