import { z } from "zod";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletion,
} from "openai/resources/chat/completions";
import { getOpenRouterClient, pdfParserPlugin, EXTRACTION_MODEL } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { computePromptSha256, savePromptSnapshot } from "@/lib/prompt-cache";
import type { LlmExecutionActor } from "@/dsl/provenance";
import { SourceCorpus } from "./source-corpus";
import { verifyGroundedField } from "./deterministic-verifier";
import type {
  CompilationResult,
  DslCompilerDiagnostic,
  GroundedFieldInspection,
} from "./types";

export interface GroundedDslInspectionHook<T> {
  (dto: T): GroundedFieldInspection[];
}

export interface GroundedDslNullifierHook<T> {
  (dto: T, diagnostic: DslCompilerDiagnostic): void;
}

export interface CompileGroundedDslOptions<T> {
  schema: z.ZodType<T>;
  schemaName: string;
  systemPrompt: string;
  userMessageContent: string | Array<any>;
  corpus: SourceCorpus;
  agentPersona: {
    id: string;
    displayName: string;
    templateId: string;
    processStage: LlmExecutionActor["processStage"];
  };
  model?: string;
  isPdf?: boolean;
  maxRetries?: number; // Redo attempts when verifier fails. Default: 2
  inspectGroundedFields: GroundedDslInspectionHook<T>;
  nullifyUnverifiedField?: GroundedDslNullifierHook<T>;
}

/**
 * Compiles and deterministically verifies LLM extractions against the source corpus.
 * If any extracted field fails source/quote/numeric verification, the compiler
 * rejects the output and provides diagnostic feedback to the AI agent to redo the work.
 */
export async function compileGroundedDsl<T>(
  options: CompileGroundedDslOptions<T>
): Promise<CompilationResult<T>> {
  const {
    schema,
    schemaName,
    systemPrompt,
    userMessageContent,
    corpus,
    agentPersona,
    model = EXTRACTION_MODEL,
    isPdf = false,
    maxRetries = 2,
    inspectGroundedFields,
    nullifyUnverifiedField,
  } = options;

  const client = getOpenRouterClient();
  const configuredEngine = process.env.OPENROUTER_PDF_ENGINE ?? "mistral-ocr";

  const userMessage: ChatCompletionMessageParam = (
    typeof userMessageContent === "string"
      ? { role: "user", content: userMessageContent }
      : { role: "user", content: userMessageContent }
  ) as ChatCompletionMessageParam;

  const conversation: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    userMessage,
  ];

  let currentAttempt = 0;
  let finalData: T | null = null;
  let finalDiagnostics: DslCompilerDiagnostic[] = [];
  let lastResponse: any = null;
  let promptSha256 = "";
  let latencyMs = 0;
  let verifiedCount = 0;
  let rejectedCount = 0;
  const fieldLineageMap: Record<string, any> = {};

  while (currentAttempt <= maxRetries) {
    currentAttempt++;

    const modelToUse =
      currentAttempt > 2
        ? "google/gemini-2.5-flash"
        : model;

    const pdfEngineToUse =
      currentAttempt > 2 ? "cloudflare-ai" : configuredEngine;

    const responseFormat = zodToResponseFormat(schema, schemaName);

    const params: ChatCompletionCreateParamsNonStreaming & {
      plugins?: readonly unknown[];
      provider?: { require_parameters?: boolean };
    } = {
      model: modelToUse,
      temperature: 0,
      response_format: responseFormat,
      messages: conversation,
      provider: { require_parameters: true },
      ...(isPdf ? { plugins: pdfParserPlugin(pdfEngineToUse) } : {}),
    };

    const startTime = Date.now();
    promptSha256 = await computePromptSha256(systemPrompt, schemaName);

    await savePromptSnapshot({
      sha256: promptSha256,
      templateId: agentPersona.templateId,
      agentPersonaId: agentPersona.id,
      agentDisplayName: agentPersona.displayName,
      systemPrompt,
      taxonomyOrSchemaHint: schemaName,
      modelSlug: modelToUse,
      firstRecordedAt: new Date().toISOString(),
    });

    const response: ChatCompletion = await client.chat.completions.create(params);
    latencyMs = Date.now() - startTime;
    lastResponse = response;

    const rawChoice = response.choices?.[0];
    const rawContent = rawChoice?.message?.content;
    if (!rawContent) {
      throw new Error(`[compileGroundedDsl] Model returned empty content on attempt ${currentAttempt}.`);
    }

    // Capture OpenRouter file-parser OCR annotation if available and add to corpus
    const annotations = (rawChoice?.message as any)?.annotations;
    if (Array.isArray(annotations)) {
      for (const ann of annotations) {
        if (ann.type === "file" && typeof ann.text === "string" && ann.text.length > 50) {
          // If we had a PDF source, enrich it with OCR text
          for (const srcRef of corpus.listSources()) {
            const src = corpus.getSource(srcRef);
            if (src && src.sourceType === "PDF") {
              await corpus.addPdfBuffer(srcRef, Buffer.alloc(0), ann.text);
            }
          }
        }
      }
    }

    // Clean JSON content if wrapped in markdown code fences
    let trimmed = rawContent.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      trimmed = fenceMatch[1].trim();
    } else {
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        trimmed = trimmed.slice(firstBrace, lastBrace + 1);
      }
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch (parseErr: any) {
      if (currentAttempt <= maxRetries) {
        console.warn(`[compileGroundedDsl] Pass ${currentAttempt} JSON parse failed: ${parseErr.message}`);
        conversation.push({ role: "assistant", content: rawContent });
        conversation.push({
          role: "user",
          content:
            `[DSL COMPILER v3.0 — JSON SYNTAX ERROR]\n` +
            `Your previous response could not be parsed as valid JSON: ${parseErr.message}\n\n` +
            `REQUIRED ACTION:\n` +
            `Emit ONLY a single, properly closed and escaped JSON object matching the ${schemaName} schema. Do not include markdown preamble.`,
        });
        continue;
      }
      throw parseErr;
    }

    // Validate with Zod schema with self-healing feedback
    const parseResult = schema.safeParse(parsedJson);
    if (!parseResult.success) {
      if (currentAttempt <= maxRetries) {
        const errorDetails = parseResult.error.issues
          .map((iss) => `- Field: \`${iss.path.join(".")}\` (${iss.code}): ${iss.message}`)
          .join("\n");

        console.warn(
          `[compileGroundedDsl] Pass ${currentAttempt} schema validation failed for '${schemaName}'. Sending schema redo turn to agent.`
        );

        conversation.push({ role: "assistant", content: rawContent });
        conversation.push({
          role: "user",
          content:
            `[DSL COMPILER v3.0 — SCHEMA VALIDATION FAILED]\n` +
            `Your previous output violated the ${schemaName} schema definition:\n\n` +
            `${errorDetails}\n\n` +
            `REQUIRED ACTION:\n` +
            `Emit a single valid JSON object strictly matching the schema:\n` +
            `- Ensure all fields are the correct types (e.g. documentSummary must be a string, not an object; riskFlags severity must be a number 1-5; parties must have legalName as string).\n` +
            `- Never omit required fields or invent extra wrapper objects.`,
        });
        continue;
      }
      throw parseResult.error;
    }

    const parsedData = parseResult.data;

    // Run the 5-Gate Deterministic Verifier across grounded fields
    const inspectedFields = inspectGroundedFields(parsedData);
    const stepDiagnostics: DslCompilerDiagnostic[] = [];

    for (const field of inspectedFields) {
      const fieldDiags = verifyGroundedField(field, corpus);
      if (fieldDiags.length > 0) {
        stepDiagnostics.push(...fieldDiags);
        rejectedCount += fieldDiags.length;
      } else if (field.value !== null && field.value !== undefined) {
        verifiedCount++;
        // Record verified lineage
        fieldLineageMap[field.jsonPath] = {
          verified: true,
          taint: "AUDITED_PROOF",
          quoteVerifiedInText: true,
          location: field.provenance?.location,
          sourceRef: field.provenance?.sourceRef,
          verbatimQuote: field.provenance?.verbatimQuote,
          compilerPass: currentAttempt,
        };
      }
    }

    // If 0 diagnostics, compilation succeeded!
    if (stepDiagnostics.length === 0) {
      finalData = parsedData;
      finalDiagnostics = [];
      break;
    }

    // Diagnostics found! If we still have retries, send a compiler rejection turn back to the LLM agent
    if (currentAttempt <= maxRetries) {
      console.warn(
        `[compileGroundedDsl] Pass ${currentAttempt} rejected for '${schemaName}': ${stepDiagnostics.length} field(s) failed verification. Sending redo message to agent.`
      );

      const rejectionDetails = stepDiagnostics
        .map((d, idx) => {
          return `${idx + 1}. Path: \`${d.jsonPath}\`\n` +
            `   - Extracted Value: ${JSON.stringify(d.extractedValue)}\n` +
            `   - Claimed Source: ${d.claimedSource || "N/A"}\n` +
            `   - Claimed Location: ${d.claimedLocation || "N/A"}\n` +
            `   - Claimed Quote: ${d.claimedQuote ? `"${d.claimedQuote}"` : "N/A"}\n` +
            `   - COMPILER ERROR [${d.code}]: ${d.message}\n` +
            (d.suggestedFix ? `   - SUGGESTED FIX: ${d.suggestedFix}\n` : "");
        })
        .join("\n");

      const compilerRejectionPrompt =
        `[DSL COMPILER v3.0 — GROUND-TRUTH VERIFICATION FAILED]\n` +
        `Your previous extraction was rejected by the deterministic source verifier for ${stepDiagnostics.length} field(s):\n\n` +
        `${rejectionDetails}\n\n` +
        `REQUIRED ACTION:\n` +
        `Redo the extraction and emit the corrected single valid JSON object:\n` +
        `- If a value genuinely exists in the source, provide the EXACT location (Page/Slide/Sheet) and copy-paste the EXACT character-for-character verbatimQuote containing that value.\n` +
        `- If a value does NOT exist in the source document, you MUST set the value to null (or omit the unverified item). Never guess, extrapolate, or use default numbers.\n` +
        `- Never invent clauses or sections (e.g. do not invent 'Clause 1.2' on a pitch deck that has no clauses).`;

      // Append assistant message and rejection message to conversation
      conversation.push({ role: "assistant", content: rawContent });
      conversation.push({ role: "user", content: compilerRejectionPrompt });
    } else {
      // Reached max retries: apply terminal sanitization if nullifier provided
      console.warn(
        `[compileGroundedDsl] Pass ${currentAttempt} reached max retries. Applying terminal nullification to ${stepDiagnostics.length} unverified field(s).`
      );
      finalData = parsedData;
      finalDiagnostics = stepDiagnostics;

      if (nullifyUnverifiedField && finalData) {
        for (const diag of stepDiagnostics) {
          try {
            nullifyUnverifiedField(finalData, diag);
          } catch (nullifyErr) {
            console.error(`[compileGroundedDsl] Failed to nullify field at ${diag.jsonPath}:`, nullifyErr);
          }
        }
      }
    }
  }

  if (!finalData) {
    throw new Error(`[compileGroundedDsl] Failed to compile data for ${schemaName}.`);
  }

  const llmActor: LlmExecutionActor = {
    actorType: "LLM_AGENT",
    agentPersonaId: agentPersona.id,
    agentDisplayName: agentPersona.displayName,
    processStage: agentPersona.processStage,
    modelSlug: model,
    promptTemplateId: agentPersona.templateId,
    promptSha256,
    temperature: 0,
    latencyMs,
    processedAt: new Date().toISOString(),
  };

  return {
    data: finalData,
    diagnostics: finalDiagnostics,
    compilerAttempts: currentAttempt,
    verifiedFieldsCount: verifiedCount,
    rejectedClaimsCount: rejectedCount,
    rawLlmResponse: lastResponse,
    llmActor,
    fieldLineage: fieldLineageMap,
  };
}
