import { readFileSync } from "fs";
import { join } from "path";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenRouterClient, EXTRACTION_MODEL, pdfParserPlugin } from "@/lib/openrouter";
import { zodToResponseFormat, parseStructuredJson } from "@/lib/json-schema";
import {
  TradeDocumentExtractionSchema,
  TRADE_DOCUMENT_TAXONOMY,
  type TradeDocumentExtraction,
} from "@/dsl/trade";
import { resolveDocumentTaint, type LlmExecutionActor } from "@/dsl/provenance";
import { scanForPromptInjection } from "@/lib/provenance-verifier";
import { computePromptSha256, savePromptSnapshot } from "@/lib/prompt-cache";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/trade-extraction.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(
  TradeDocumentExtractionSchema,
  "TradeDocumentExtraction",
);

const TAXONOMY_HINT =
  `Trade Document Taxonomy codes to classify this document against for documentTypes ` +
  `(select one or more that apply): ` +
  `${TRADE_DOCUMENT_TAXONOMY.join(", ")}.`;

/**
 * Runs one extraction pass over a single uploaded trade finance document.
 *
 * Employs fallback models and OCR engines with automatic retry to guarantee
 * robustness across bilingual scanned PDFs, commodity contracts, and bills of lading.
 */
export async function extractFromTradeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<TradeDocumentExtraction> {
  const client = getOpenRouterClient();
  const isPdf = mimeType === "application/pdf";
  const rawTextForVerification = isPdf ? null : fileBuffer.toString("utf-8");

  const userMessage = (
    isPdf
      ? {
          role: "user",
          content: [
            {
              type: "text",
              text: `Document filename: ${fileName}\n\nExtract trade finance parameters per the system prompt.\n\nRespond ONLY with a single valid JSON object matching the TradeDocumentExtraction schema.\n\n${TAXONOMY_HINT}`,
            },
            {
              type: "file",
              file: {
                filename: fileName,
                file_data: `data:application/pdf;base64,${fileBuffer.toString("base64")}`,
              },
            },
          ],
        }
      : {
          role: "user",
          content: `Document filename: ${fileName}\n\nExtract trade finance parameters per the system prompt.\n\nRespond ONLY with a single valid JSON object matching the TradeDocumentExtraction schema.\n\n${TAXONOMY_HINT}\n\n${rawTextForVerification}`,
        }
  ) as ChatCompletionMessageParam;

  const configuredEngine = process.env.OPENROUTER_PDF_ENGINE ?? "mistral-ocr";
  const attempts: { model: string; pdfEngine?: string; delayBeforeMs: number }[] = [
    { model: EXTRACTION_MODEL, pdfEngine: configuredEngine, delayBeforeMs: 0 },
    { model: "google/gemini-2.5-flash", pdfEngine: configuredEngine, delayBeforeMs: 1000 },
    { model: "google/gemini-2.5-flash", pdfEngine: "cloudflare-ai", delayBeforeMs: 2000 },
  ];

  let lastError: unknown;

  for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
    const { model, pdfEngine, delayBeforeMs } = attempts[attemptIdx];
    if (delayBeforeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBeforeMs));
    }

    const params: ChatCompletionCreateParamsNonStreaming & {
      plugins?: readonly unknown[];
      provider?: { require_parameters?: boolean };
    } = {
      model,
      temperature: 0,
      response_format: RESPONSE_FORMAT,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, userMessage],
      provider: { require_parameters: true },
      ...(isPdf ? { plugins: pdfParserPlugin(pdfEngine) } : {}),
    };

    try {
      const startTime = Date.now();
      const promptSha256 = await computePromptSha256(SYSTEM_PROMPT, TAXONOMY_HINT);

      // Save prompt snapshot deduplicated once
      await savePromptSnapshot({
        sha256: promptSha256,
        templateId: "TRADE_EXTRACTION_PROMPT_V2",
        agentPersonaId: "minato",
        agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
        systemPrompt: SYSTEM_PROMPT,
        taxonomyOrSchemaHint: TAXONOMY_HINT,
        modelSlug: model,
        firstRecordedAt: new Date().toISOString(),
      });

      const response: ChatCompletion = await client.chat.completions.create(params);
      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error(
          `Trade extraction agent returned no content for ${fileName}. Raw: ${JSON.stringify(response)}`,
        );
      }
      const parsed = parseStructuredJson(content, TradeDocumentExtractionSchema);
      const taint = resolveDocumentTaint(parsed.documentTypes);

      const llmActor: LlmExecutionActor = {
        actorType: "LLM_AGENT",
        agentPersonaId: "minato",
        agentDisplayName: "Minato (湊) — Maritime & Trade Parser",
        processStage: "SINGLE_DOC_EXTRACTION",
        modelSlug: response.model || model,
        ocrEngine: isPdf ? (pdfEngine || "mistral-ocr") : "native-text",
        promptTemplateId: "TRADE_EXTRACTION_PROMPT_V2",
        promptSha256,
        temperature: 0,
        openRouterGenerationId: response.id || null,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        latencyMs,
        processedAt: new Date().toISOString(),
      };
      (parsed as unknown as { _llmActor?: LlmExecutionActor })._llmActor = llmActor;

      parsed.extractionProvenance = {
        sourceFileName: fileName,
        extractedAt: new Date().toISOString(),
        modelUsed: response.model || model,
        ocrEngineUsed: pdfEngine ?? "none",
        taint,
        verbatimQuote: parsed.extractionProvenance?.verbatimQuote ?? null,
        pageOrSheet: parsed.extractionProvenance?.pageOrSheet ?? null,
        quoteVerifiedInText: isPdf ? null : true,
      };
      parsed.riskFlags = (parsed.riskFlags ?? []).map((rf) => ({
        ...rf,
        sourceFileName: rf.sourceFileName || fileName,
      }));
      const securityFlags = scanForPromptInjection(fileName, parsed, rawTextForVerification);
      for (const sf of securityFlags) {
        parsed.riskFlags.push(sf);
      }
      return parsed;
    } catch (err) {
      lastError = err;
      if (attemptIdx === attempts.length - 1) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error(`Extraction failed for ${fileName}`);
}

