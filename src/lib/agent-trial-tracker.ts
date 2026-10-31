import { db } from "@/lib/db";

export interface RecordAgentTrialInput {
  runId?: string | null;
  dealId?: string | null;
  assetClass: "INVOICE" | "TRADE" | "VC";
  stage: "RESEARCH_STRUCTURE" | "RESEARCH_SEARCH" | "DOCUMENT_EXTRACTION" | "DSL_GROUNDING_GATE";
  trialNumber: number;
  status: "SUCCESS" | "FAILED_GATE" | "FAILED_SCHEMA" | "FAILED_HTTP" | "RETRYING";
  entityName?: string | null;
  inputSummary?: string | null;
  extractedPayload?: Record<string, any> | null;
  failureReason?: string | null;
  promptFeedback?: string | null;
  diagnosticsJson?: Record<string, any> | null;
  modelSlug?: string | null;
  durationMs?: number | null;
}

/**
 * Persists an individual trial/attempt executed by an AI agent.
 * Tracks what was attempted, what was extracted, why it failed or succeeded,
 * and what feedback was generated for the next attempt.
 */
export async function recordAgentTrial(input: RecordAgentTrialInput) {
  try {
    return await db.agentExecutionTrial.create({
      data: {
        runId: input.runId ?? null,
        dealId: input.dealId ?? null,
        assetClass: input.assetClass,
        stage: input.stage,
        trialNumber: input.trialNumber,
        status: input.status,
        entityName: input.entityName ?? null,
        inputSummary: input.inputSummary ?? null,
        extractedPayload: input.extractedPayload ? JSON.parse(JSON.stringify(input.extractedPayload)) : undefined,
        failureReason: input.failureReason ?? null,
        promptFeedback: input.promptFeedback ?? null,
        diagnosticsJson: input.diagnosticsJson ? JSON.parse(JSON.stringify(input.diagnosticsJson)) : undefined,
        modelSlug: input.modelSlug ?? null,
        durationMs: input.durationMs ?? null,
      },
    });
  } catch (err) {
    console.warn("[agent-trial-tracker] Failed to record trial:", err);
    return null;
  }
}

export async function listAgentTrials(options: {
  dealId?: string;
  runId?: string;
  assetClass?: string;
  status?: string;
  limit?: number;
} = {}) {
  const where: any = {};
  if (options.dealId) where.dealId = options.dealId;
  if (options.runId) where.runId = options.runId;
  if (options.assetClass) where.assetClass = options.assetClass;
  if (options.status) where.status = options.status;

  return db.agentExecutionTrial.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
}
