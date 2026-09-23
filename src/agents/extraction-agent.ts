import { readFileSync } from "fs";
import { join } from "path";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenRouterClient, EXTRACTION_MODEL, pdfParserPlugin } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { DocumentExtractionSchema, type DocumentExtraction } from "@/dsl/schema";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/extraction.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(DocumentExtractionSchema, "DocumentExtraction");

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

  // The "file" content part is an OpenRouter-specific extension (not in
  // OpenAI's own content-part union), so the PDF branch is built as a
  // plain object and cast once at the end, rather than fighting the SDK's
  // discriminated per-role union type part-by-part.
  const userMessage = (
    isPdf
      ? {
          role: "user",
          content: [
            { type: "text", text: `Document filename: ${fileName}\n\nExtract this document per the system prompt.` },
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
          content: `Document filename: ${fileName}\n\nExtract this document per the system prompt.\n\n${fileBuffer.toString("utf-8")}`,
        }
  ) as ChatCompletionMessageParam;

  const params: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: EXTRACTION_MODEL,
    response_format: RESPONSE_FORMAT,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, userMessage],
    ...(isPdf ? { plugins: pdfParserPlugin() } : {}),
  };

  const response = await client.chat.completions.create(params);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Extraction agent returned no content for ${fileName}. Raw response: ${JSON.stringify(response)}`);
  }

  // Validate before returning — never trust the model's JSON blindly, even
  // in strict json_schema mode. This is the same "never fabricate/never
  // trust without validation" discipline the manual skills enforce.
  return DocumentExtractionSchema.parse(JSON.parse(content));
}
