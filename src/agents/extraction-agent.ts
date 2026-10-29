import { readFileSync } from "fs";
import { join } from "path";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenRouterClient, EXTRACTION_MODEL, pdfParserPlugin } from "@/lib/openrouter";
import { zodToResponseFormat, parseStructuredJson } from "@/lib/json-schema";
import { DocumentExtractionSchema, STANDARD_DOCUMENT_TAXONOMY, type DocumentExtraction } from "@/dsl/schema";
import { scanForPromptInjection, verifyVerbatimQuoteInText } from "@/lib/provenance-verifier";
import { computePromptSha256, savePromptSnapshot } from "@/lib/prompt-cache";
import type { LlmExecutionActor } from "@/dsl/provenance";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/extraction.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(DocumentExtractionSchema, "DocumentExtraction");

// Injected into the user message (rather than hardcoded in the prompt file)
// so it can never drift out of sync with the taxonomy providers' own
// documentsRequired entries are drawn from.
const TAXONOMY_HINT =
  `Standard Document Taxonomy codes to classify this document against for documentTypes ` +
  `(use one or more that apply; only introduce a new code if genuinely none fit): ` +
  `${STANDARD_DOCUMENT_TAXONOMY.join(", ")}.`;

/**
 * Runs one extraction pass over a single uploaded document.
 *
 * PDFs go through OpenRouter's universal `file-parser` plugin (mistral-ocr
 * engine by default — see src/lib/openrouter.ts) rather than a native
 * document content block: none of this app's default open-weight models
 * read PDFs natively the way Claude/Gemini do, so OpenRouter parses the
 * PDF server-side (OCR included) and hands the extraction model text/
 * markdown regardless of which model is configured. This matters for
 * exactly the documents this system was built against — bilingual
 * Chinese/Indonesian contracts with tables, stamps, and handwritten
 * signatures that a naive client-side text extractor mangles.
 */
export async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<DocumentExtraction> {
  const client = getOpenRouterClient();
  const isPdf = mimeType === "application/pdf";
  const rawTextForVerification = isPdf ? null : fileBuffer.toString("utf-8");

  // The "file" content part is an OpenRouter-specific extension (not in
  // OpenAI's own content-part union), so the PDF branch is built as a
  // plain object and cast once at the end, rather than fighting the SDK's
  // discriminated per-role union type part-by-part.
  const userMessage = (
    isPdf
      ? {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Document filename: ${fileName}\n\nExtract this document per the system prompt. ` +
                `Respond ONLY with a single valid JSON object matching the DocumentExtraction schema.\n\n${TAXONOMY_HINT}`,
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
          content:
            `Document filename: ${fileName}\n\nExtract this document per the system prompt. ` +
            `Respond ONLY with a single valid JSON object matching the DocumentExtraction schema.\n\n${TAXONOMY_HINT}\n\n${rawTextForVerification}`,
        }
  ) as ChatCompletionMessageParam;

  // OpenRouter's shared mistral-ocr pool occasionally returns HTTP 400/429
  // "Failed to parse the file: The document parsing engine is currently rate
  // limited. Please retry shortly." when extracting multiple PDFs in a row.
  // Additionally, some OpenRouter sub-providers for open-weight models may
  // emit Markdown (`## Extracted...`) instead of strict JSON when combined
  // with the `file-parser` plugin. We:
  //   1. Pass `provider: { require_parameters: true }` so OpenRouter only
  //      routes to providers that enforce `response_format` (`json_schema`).
  //   2. Validate the JSON inside the retry loop; if a model returns non-JSON
  //      or rate-limits, retry and fall back to `google/gemini-2.5-flash` +
  //      `cloudflare-ai` on the later attempts so extraction always succeeds.
  const configuredEngine = process.env.OPENROUTER_PDF_ENGINE ?? "mistral-ocr";
  const attempts: { model: string; pdfEngine?: string; delayBeforeMs: number }[] = [
    { model: EXTRACTION_MODEL, pdfEngine: configuredEngine, delayBeforeMs: 0 },
    { model: EXTRACTION_MODEL, pdfEngine: configuredEngine, delayBeforeMs: 3000 },
    { model: "google/gemini-2.5-flash", pdfEngine: configuredEngine, delayBeforeMs: 5000 },
    { model: "google/gemini-2.5-flash", pdfEngine: "cloudflare-ai", delayBeforeMs: 6000 },
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
        templateId: "INVOICE_EXTRACTION_PROMPT_V1",
        agentPersonaId: "makoto",
        agentDisplayName: "Makoto (誠) — Invoice Credit Auditor",
        systemPrompt: SYSTEM_PROMPT,
        taxonomyOrSchemaHint: TAXONOMY_HINT,
        modelSlug: model,
        firstRecordedAt: new Date().toISOString(),
      });

      const response: ChatCompletion = await client.chat.completions.create(params);
      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`Extraction agent returned no content for ${fileName}. Raw response: ${JSON.stringify(response)}`);
      }
      const parsed = parseStructuredJson(content, DocumentExtractionSchema);

      // Attach LLM Actor telemetry to extraction
      const llmActor: LlmExecutionActor = {
        actorType: "LLM_AGENT",
        agentPersonaId: "makoto",
        agentDisplayName: "Makoto (誠) — Invoice Credit Auditor",
        processStage: "SINGLE_DOC_EXTRACTION",
        modelSlug: response.model || model,
        ocrEngine: isPdf ? (pdfEngine || "mistral-ocr") : "native-text",
        promptTemplateId: "INVOICE_EXTRACTION_PROMPT_V1",
        promptSha256,
        temperature: 0,
        openRouterGenerationId: response.id || null,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        latencyMs,
        processedAt: new Date().toISOString(),
      };
      (parsed as unknown as { _llmActor?: LlmExecutionActor })._llmActor = llmActor;

      // Attach sourceFileName to all risk flags
      parsed.riskFlags = (parsed.riskFlags ?? []).map((rf) => ({
        ...rf,
        sourceFileName: rf.sourceFileName || fileName,
      }));

      // Run deterministic prompt-injection scanner
      const securityFlags = scanForPromptInjection(fileName, parsed, rawTextForVerification);
      for (const sf of securityFlags) {
        parsed.riskFlags.push(sf);
      }

      // Verify verbatim quotes when raw text is available locally
      if (rawTextForVerification) {
        for (const ask of parsed.financingAsks ?? []) {
          if (ask.verbatimQuote && verifyVerbatimQuoteInText(ask.verbatimQuote, rawTextForVerification) === false) {
            parsed.riskFlags.push({
              category: "UNANCHORED_EXTRACTION",
              severity: 4,
              description: `Financing ask quote "${ask.verbatimQuote.slice(0, 80)}" could not be verified verbatim in "${fileName}".`,
              sourceFileName: fileName,
              evidenceSnippet: ask.verbatimQuote,
            });
          }
        }
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
