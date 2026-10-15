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
    userMessage = {
      role: "user",
      content:
        `Document filename: ${fileName}\n\n` +
        `Extract startup funding and data room parameters per the system prompt.\n\n${TAXONOMY_HINT}\n\n` +
        `${fileBuffer.toString("utf-8")}`,
    };
  }

  const params: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: EXTRACTION_MODEL,
    response_format: RESPONSE_FORMAT,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, userMessage],
    ...(isPdf ? { plugins: pdfParserPlugin() } : {}),
  };

  const response = await client.chat.completions.create(params);
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`VC extraction agent returned no content for ${fileName}.`);
  }

  return StartupDocumentExtractionSchema.parse(JSON.parse(content));
}
