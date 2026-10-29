import { readFileSync } from "fs";
import { join } from "path";
import { compileGroundedDsl, SourceCorpus, type GroundedFieldInspection } from "@/dsl/compiler";
import { parseSpreadsheet } from "@/lib/spreadsheet-parser";
import {
  StartupDocumentExtractionSchema,
  VC_DOCUMENT_TAXONOMY,
  type StartupDocumentExtraction,
} from "@/dsl/vc";
import { scanForPromptInjection } from "@/lib/provenance-verifier";
import type { LlmExecutionActor } from "@/dsl/provenance";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/vc-extraction.md"),
  "utf-8",
);

const TAXONOMY_HINT =
  `VC Document Taxonomy codes to classify this document against for documentTypes ` +
  `(select one or more that apply): ` +
  `${VC_DOCUMENT_TAXONOMY.join(", ")}.`;

/**
 * Runs one grounded extraction pass over a single uploaded startup document (pitch deck, cap table, model, etc.).
 * Fully verified using DSL Compiler v3 against the source corpus.
 */
export async function extractFromVCDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<StartupDocumentExtraction> {
  const isPdf = mimeType === "application/pdf";
  const lowerName = fileName.toLowerCase();
  const isSpreadsheet =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv") ||
    mimeType === "text/csv" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel";

  const corpus = new SourceCorpus();
  let userMessageContent: any;
  let parsedSourceTextForVerification: string | null = null;

  if (isPdf) {
    await corpus.addPdfBuffer(fileName, fileBuffer);
    userMessageContent = [
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
    ];
  } else if (isSpreadsheet) {
    corpus.addSpreadsheetBuffer(fileName, fileBuffer, mimeType);
    const parsedSpreadsheet = await parseSpreadsheet(fileBuffer, fileName, mimeType);
    parsedSourceTextForVerification = parsedSpreadsheet.combinedMarkdown;
    const hintText = parsedSpreadsheet.detectedDocTypeHint
      ? `\nAuto-detected spreadsheet format: ${parsedSpreadsheet.detectedDocTypeHint}`
      : "";

    userMessageContent =
      `Document filename: ${fileName} (${parsedSpreadsheet.sourceType} Workbook, ${parsedSpreadsheet.sheetCount} sheet(s))\n` +
      `${hintText}\n\n` +
      `Extract startup funding, cap table, and operating metrics per the system prompt.\n\n${TAXONOMY_HINT}\n\n` +
      `### SPREADSHEET CONTENT:\n\n${parsedSpreadsheet.combinedMarkdown}`;
  } else {
    parsedSourceTextForVerification = fileBuffer.toString("utf-8");
    corpus.addTextDocument(fileName, parsedSourceTextForVerification);
    userMessageContent =
      `Document filename: ${fileName}\n\n` +
      `Extract startup funding and data room parameters per the system prompt.\n\n${TAXONOMY_HINT}\n\n` +
      `${parsedSourceTextForVerification}`;
  }

  const compilation = await compileGroundedDsl<StartupDocumentExtraction>({
    schema: StartupDocumentExtractionSchema,
    schemaName: "StartupDocumentExtraction",
    systemPrompt: SYSTEM_PROMPT,
    userMessageContent,
    corpus,
    isPdf,
    agentPersona: {
      id: "daiki",
      displayName: "Daiki (大輝) — Venture Capital Thesis Architect",
      templateId: "VC_EXTRACTION_PROMPT_V1",
      processStage: "SINGLE_DOC_EXTRACTION",
    },
    inspectGroundedFields: (dto) => {
      const inspections: GroundedFieldInspection[] = [];

      // Inspect financing ask
      if (dto.financingAsk) {
        const ask = dto.financingAsk;
        const loc = ask.pageOrSheet || "Page 1";
        const quote = ask.verbatimQuote || "";

        if (ask.targetRaiseUsd !== null && ask.targetRaiseUsd !== undefined) {
          inspections.push({
            jsonPath: "$.financingAsk.targetRaiseUsd",
            value: ask.targetRaiseUsd,
            expectedType: "number",
            provenance: {
              sourceRef: fileName,
              location: loc,
              verbatimQuote: quote,
              derivation: "VERBATIM_EXTRACTED",
            },
          });
        }

        if (ask.valuationCapUsd !== null && ask.valuationCapUsd !== undefined) {
          inspections.push({
            jsonPath: "$.financingAsk.valuationCapUsd",
            value: ask.valuationCapUsd,
            expectedType: "number",
            provenance: {
              sourceRef: fileName,
              location: loc,
              verbatimQuote: quote,
              derivation: "VERBATIM_EXTRACTED",
            },
          });
        }
      }

      // Inspect traction metrics
      if (dto.traction) {
        const t = dto.traction;
        const loc = t.pageOrSheet || "Page 1";
        const quote = t.verbatimQuote || "";

        if (t.arrUsd !== null && t.arrUsd !== undefined) {
          inspections.push({
            jsonPath: "$.traction.arrUsd",
            value: t.arrUsd,
            expectedType: "number",
            provenance: {
              sourceRef: fileName,
              location: loc,
              verbatimQuote: quote,
              derivation: "VERBATIM_EXTRACTED",
            },
          });
        }
      }

      return inspections;
    },
    nullifyUnverifiedField: (dto, diag) => {
      if (diag.jsonPath === "$.financingAsk.valuationCapUsd") {
        if (dto.financingAsk) dto.financingAsk.valuationCapUsd = null;
      }
      if (diag.jsonPath === "$.financingAsk.targetRaiseUsd") {
        if (dto.financingAsk) dto.financingAsk.targetRaiseUsd = null;
      }
      if (diag.jsonPath === "$.traction.arrUsd") {
        if (dto.traction) dto.traction.arrUsd = null;
      }
    },
  });

  const parsed = compilation.data;
  (parsed as unknown as { _llmActor?: LlmExecutionActor })._llmActor = compilation.llmActor;

  parsed.riskFlags = (parsed.riskFlags ?? []).map((rf) => ({
    ...rf,
    sourceFileName: rf.sourceFileName || fileName,
  }));

  for (const diag of compilation.diagnostics) {
    parsed.riskFlags.push({
      category: "UNANCHORED_EXTRACTION",
      severity: 4,
      description: `[Compiler Rejection] ${diag.message}`,
      sourceFileName: fileName,
      evidenceSnippet: diag.claimedQuote || null,
    });
  }

  const securityFlags = scanForPromptInjection(fileName, parsed, parsedSourceTextForVerification);
  for (const sf of securityFlags) {
    parsed.riskFlags.push(sf);
  }

  return parsed;
}
