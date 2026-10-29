import { readFileSync } from "fs";
import { join } from "path";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenRouterClient, EXTRACTION_MODEL, pdfParserPlugin } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { parseSpreadsheet } from "@/lib/spreadsheet-parser";
import {
  StartupDocumentExtractionSchema,
  VC_DOCUMENT_TAXONOMY,
  type StartupDocumentExtraction,
} from "@/dsl/vc";
import { scanForPromptInjection, verifyVerbatimQuoteInText } from "@/lib/provenance-verifier";
import { computePromptSha256, savePromptSnapshot } from "@/lib/prompt-cache";
import type { LlmExecutionActor } from "@/dsl/provenance";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/vc-extraction.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(
  StartupDocumentExtractionSchema,
  "StartupDocumentExtraction",
);

const TAXONOMY_HINT =
  `VC Document Taxonomy codes to classify this document against for documentTypes ` +
  `(select one or more that apply): ` +
  `${VC_DOCUMENT_TAXONOMY.join(", ")}.`;

/**
 * Runs one extraction pass over a single uploaded startup document (pitch deck, cap table, model, etc.).
 *
 * Supports:
 * - PDFs: OpenRouter universal file-parser OCR (mistral-ocr) for visual pitch decks.
 * - Excel (.xlsx, .xls), CSV (.csv), Google Sheets: Native server-side parsing to structured Markdown tables.
 */
export async function extractFromVCDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<StartupDocumentExtraction> {
  const client = getOpenRouterClient();
  const isPdf = mimeType === "application/pdf";
  const lowerName = fileName.toLowerCase();
  const isSpreadsheet =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv") ||
    mimeType === "text/csv" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel";

  let userMessage: ChatCompletionMessageParam;
  let parsedSourceTextForVerification: string | null = null;

  if (isPdf) {
    userMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: `Document filename: ${fileName}\n\nExtract startup funding and data room parameters per the system prompt.\n\n${TAXONOMY_HINT}`,
        },
        {
          type: "file",
          file: {
            filename: fileName,
            file_data: `data:application/pdf;base64,${fileBuffer.toString("base64")}`,
          },
        },
      ],
    };
  } else if (isSpreadsheet) {
    const parsedSpreadsheet = await parseSpreadsheet(fileBuffer, fileName, mimeType);
    parsedSourceTextForVerification = parsedSpreadsheet.combinedMarkdown;
    const hintText = parsedSpreadsheet.detectedDocTypeHint
      ? `\nAuto-detected spreadsheet format: ${parsedSpreadsheet.detectedDocTypeHint}`
      : "";

    userMessage = {
      role: "user",
      content:
        `Document filename: ${fileName} (${parsedSpreadsheet.sourceType} Workbook, ${parsedSpreadsheet.sheetCount} sheet(s))\n` +
        `${hintText}\n\n` +
        `Extract startup funding, cap table, and operating metrics per the system prompt.\n\n${TAXONOMY_HINT}\n\n` +
        `### SPREADSHEET CONTENT:\n\n${parsedSpreadsheet.combinedMarkdown}`,
    };
  } else {
    parsedSourceTextForVerification = fileBuffer.toString("utf-8");
    userMessage = {
      role: "user",
      content:
        `Document filename: ${fileName}\n\n` +
        `Extract startup funding and data room parameters per the system prompt.\n\n${TAXONOMY_HINT}\n\n` +
        `${parsedSourceTextForVerification}`,
    };
  }

  const params: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: EXTRACTION_MODEL,
    temperature: 0,
    response_format: RESPONSE_FORMAT,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, userMessage],
    ...(isPdf ? { plugins: pdfParserPlugin() } : {}),
  };

  const startTime = Date.now();
  const promptSha256 = await computePromptSha256(SYSTEM_PROMPT, TAXONOMY_HINT);

  // Save prompt snapshot deduplicated once
  await savePromptSnapshot({
    sha256: promptSha256,
    templateId: "VC_EXTRACTION_PROMPT_V1",
    agentPersonaId: "daiki",
    agentDisplayName: "Daiki (大輝) — Venture Capital Thesis Architect",
    systemPrompt: SYSTEM_PROMPT,
    taxonomyOrSchemaHint: TAXONOMY_HINT,
    modelSlug: EXTRACTION_MODEL,
    firstRecordedAt: new Date().toISOString(),
  });

  const response = await client.chat.completions.create(params);
  const latencyMs = Date.now() - startTime;
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`VC extraction agent returned no content for ${fileName}.`);
  }

  const parsed = StartupDocumentExtractionSchema.parse(JSON.parse(content));

  const llmActor: LlmExecutionActor = {
    actorType: "LLM_AGENT",
    agentPersonaId: "daiki",
    agentDisplayName: "Daiki (大輝) — Venture Capital Thesis Architect",
    processStage: "SINGLE_DOC_EXTRACTION",
    modelSlug: response.model || EXTRACTION_MODEL,
    ocrEngine: isPdf ? (process.env.OPENROUTER_PDF_ENGINE ?? "mistral-ocr") : isSpreadsheet ? "spreadsheet-parser" : "native-text",
    promptTemplateId: "VC_EXTRACTION_PROMPT_V1",
    promptSha256,
    temperature: 0,
    openRouterGenerationId: response.id || null,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    latencyMs,
    processedAt: new Date().toISOString(),
  };
  (parsed as unknown as { _llmActor?: LlmExecutionActor })._llmActor = llmActor;

  parsed.riskFlags = (parsed.riskFlags ?? []).map((rf) => ({
    ...rf,
    sourceFileName: rf.sourceFileName || fileName,
  }));

  const securityFlags = scanForPromptInjection(fileName, parsed, parsedSourceTextForVerification);
  for (const sf of securityFlags) {
    parsed.riskFlags.push(sf);
  }

  if (parsedSourceTextForVerification && parsed.traction?.verbatimQuote) {
    if (verifyVerbatimQuoteInText(parsed.traction.verbatimQuote, parsedSourceTextForVerification) === false) {
      parsed.riskFlags.push({
        category: "UNANCHORED_EXTRACTION",
        severity: 4,
        description: `Traction quote "${parsed.traction.verbatimQuote.slice(0, 80)}" could not be verified verbatim in "${fileName}".`,
        sourceFileName: fileName,
        evidenceSnippet: parsed.traction.verbatimQuote,
      });
    }
  }

  return parsed;
}
