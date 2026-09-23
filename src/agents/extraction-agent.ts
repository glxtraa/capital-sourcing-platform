import { readFileSync } from "fs";
import { join } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, AGENT_MODEL } from "@/lib/anthropic";
import { zodToToolSchema } from "@/lib/zod-tool";
import { DocumentExtractionSchema, type DocumentExtraction } from "@/dsl/schema";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/extraction.md"),
  "utf-8",
);

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extraction",
  description: "Record the structured extraction for this document.",
  input_schema: zodToToolSchema(DocumentExtractionSchema),
};

/**
 * Runs one extraction pass over a single uploaded document.
 *
 * Uses Claude's native document support (PDFs are sent as base64 `document`
 * content blocks — the model reads the actual layout/tables/stamps, not a
 * pre-OCR'd text dump) rather than a separate PDF-parsing library. This
 * matters for exactly the kind of documents this system has actually
 * processed: bilingual Chinese/Indonesian contracts with tables, stamps,
 * and handwritten signatures that a naive text extractor mangles.
 *
 * @param fileBuffer raw bytes of the uploaded file
 * @param mimeType e.g. "application/pdf"
 * @param fileName for context in the prompt
 */
export async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<DocumentExtraction> {
  const client = getAnthropicClient();

  const isPdf = mimeType === "application/pdf";
  const contentBlock: Anthropic.Messages.ContentBlockParam = isPdf
    ? {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: fileBuffer.toString("base64"),
        },
      }
    : {
        type: "text",
        text: fileBuffer.toString("utf-8"),
      };

  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Document filename: ${fileName}\n\nExtract this document per the system prompt.`,
          },
          contentBlock,
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Extraction agent did not return a tool_use block for ${fileName}`);
  }

  // Validate before returning — never trust the model's JSON blindly, even
  // with forced tool use. This is the same "never fabricate/never trust
  // without validation" discipline the manual skills enforce on themselves.
  return DocumentExtractionSchema.parse(toolUse.input);
}
