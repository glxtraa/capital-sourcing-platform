import { db } from "@/lib/db";

export interface RecordPromptImprovementInput {
  agentType: "INVOICE_RESEARCH" | "TRADE_RESEARCH" | "VC_RESEARCH" | "EXTRACTION";
  promptId: string;
  triggerEvent: "DSL_GROUNDING_GATE_REJECTION" | "LINK_AUDIT_FAILURE" | "SCHEMA_VALIDATION_FAILURE";
  failedInput?: string | null;
  rejectionReason: string;
  suggestedRule: string;
  contextJson?: Record<string, any> | null;
}

/**
 * Persists an autonomous prompt improvement suggestion when an agent extraction
 * fails DSL grounding gates or deterministic link checks.
 *
 * This allows prompt engineers and automated prompt-optimizer loops to inspect
 * failure patterns across real executions without breaking the user experience.
 */
export async function recordPromptImprovementSuggestion(input: RecordPromptImprovementInput) {
  try {
    return await db.promptImprovementSuggestion.create({
      data: {
        agentType: input.agentType,
        promptId: input.promptId,
        triggerEvent: input.triggerEvent,
        failedInput: input.failedInput ?? null,
        rejectionReason: input.rejectionReason,
        suggestedRule: input.suggestedRule,
        contextJson: input.contextJson ? JSON.parse(JSON.stringify(input.contextJson)) : undefined,
        status: "OPEN",
      },
    });
  } catch (err) {
    console.warn("[prompt-improvement] Failed to record suggestion:", err);
    return null;
  }
}

export async function listPromptImprovementSuggestions(options: {
  agentType?: string;
  status?: string;
  limit?: number;
} = {}) {
  const where: any = {};
  if (options.agentType) where.agentType = options.agentType;
  if (options.status) where.status = options.status;

  return db.promptImprovementSuggestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
}
