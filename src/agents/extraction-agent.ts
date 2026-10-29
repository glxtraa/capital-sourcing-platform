import { readFileSync } from "fs";
import { join } from "path";
import { compileGroundedDsl, SourceCorpus, type GroundedFieldInspection } from "@/dsl/compiler";
import { DocumentExtractionSchema, STANDARD_DOCUMENT_TAXONOMY, type DocumentExtraction } from "@/dsl/schema";
import { scanForPromptInjection } from "@/lib/provenance-verifier";
import type { LlmExecutionActor } from "@/dsl/provenance";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/extraction.md"),
  "utf-8",
);

// Injected into the user message (rather than hardcoded in the prompt file)
// so it can never drift out of sync with the taxonomy providers' own
// documentsRequired entries are drawn from.
const TAXONOMY_HINT =
  `Standard Document Taxonomy codes to classify this document against for documentTypes ` +
  `(use one or more that apply; only introduce a new code if genuinely none fit): ` +
  `${STANDARD_DOCUMENT_TAXONOMY.join(", ")}.`;

/**
 * Runs one grounded extraction pass over a single uploaded document.
 * Deterministically verified against the source corpus using DSL Compiler v3.
 */
export async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<DocumentExtraction> {
  const isPdf = mimeType === "application/pdf";
  const rawTextForVerification = isPdf ? null : fileBuffer.toString("utf-8");

  // Build the source corpus for deterministic compiler verification
  const corpus = new SourceCorpus();
  if (isPdf) {
    await corpus.addPdfBuffer(fileName, fileBuffer);
  } else if (
    fileName.toLowerCase().endsWith(".xlsx") ||
    fileName.toLowerCase().endsWith(".xls") ||
    fileName.toLowerCase().endsWith(".csv")
  ) {
    corpus.addSpreadsheetBuffer(fileName, fileBuffer, mimeType);
  } else {
    corpus.addTextDocument(fileName, fileBuffer.toString("utf-8"));
  }

  const userMessageContent = isPdf
    ? [
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
      ]
    : `Document filename: ${fileName}\n\nExtract this document per the system prompt. ` +
      `Respond ONLY with a single valid JSON object matching the DocumentExtraction schema.\n\n${TAXONOMY_HINT}\n\n${rawTextForVerification}`;

  const compilation = await compileGroundedDsl<DocumentExtraction>({
    schema: DocumentExtractionSchema,
    schemaName: "DocumentExtraction",
    systemPrompt: SYSTEM_PROMPT,
    userMessageContent,
    corpus,
    isPdf,
    agentPersona: {
      id: "makoto",
      displayName: "Makoto (誠) — Invoice Credit Auditor",
      templateId: "INVOICE_EXTRACTION_PROMPT_V1",
      processStage: "SINGLE_DOC_EXTRACTION",
    },
    inspectGroundedFields: (dto) => {
      const inspections: GroundedFieldInspection[] = [];

      // Inspect Parties
      if (dto.parties && Array.isArray(dto.parties)) {
        for (let i = 0; i < dto.parties.length; i++) {
          const p = dto.parties[i];
          inspections.push({
            jsonPath: `$.parties[${i}].legalName`,
            value: p.legalName,
            roleExpected: p.role,
            provenance: {
              sourceRef: p.sourceDocuments?.[0] || fileName,
              location: p.pageOrSheet || "Page 1",
              verbatimQuote: p.verbatimQuote || "",
              derivation: "VERBATIM_EXTRACTED",
            },
          });
        }
      }

      // Inspect Financing Asks
      if (dto.financingAsks && Array.isArray(dto.financingAsks)) {
        for (let i = 0; i < dto.financingAsks.length; i++) {
          const ask = dto.financingAsks[i];
          if (ask.amount !== null && ask.amount !== undefined) {
            inspections.push({
              jsonPath: `$.financingAsks[${i}].amount`,
              value: ask.amount,
              expectedType: "number",
              provenance: {
                sourceRef: fileName,
                location: ask.pageOrSheet || "Page 1",
                verbatimQuote: ask.verbatimQuote || "",
                derivation: "VERBATIM_EXTRACTED",
              },
            });
          }
          if (ask.advanceRatePct !== null && ask.advanceRatePct !== undefined) {
            inspections.push({
              jsonPath: `$.financingAsks[${i}].advanceRatePct`,
              value: ask.advanceRatePct,
              expectedType: "number",
              provenance: {
                sourceRef: fileName,
                location: ask.pageOrSheet || "Page 1",
                verbatimQuote: ask.verbatimQuote || "",
                derivation: "VERBATIM_EXTRACTED",
              },
            });
          }
        }
      }

      return inspections;
    },
    nullifyUnverifiedField: (dto, diag) => {
      if (diag.jsonPath.includes(".amount")) {
        const match = diag.jsonPath.match(/\$\.financingAsks\[(\d+)\]/);
        if (match && dto.financingAsks) {
          const idx = parseInt(match[1], 10);
          if (dto.financingAsks[idx]) dto.financingAsks[idx].amount = null;
        }
      }
      if (diag.jsonPath.includes(".advanceRatePct")) {
        const match = diag.jsonPath.match(/\$\.financingAsks\[(\d+)\]/);
        if (match && dto.financingAsks) {
          const idx = parseInt(match[1], 10);
          if (dto.financingAsks[idx]) dto.financingAsks[idx].advanceRatePct = null;
        }
      }
      if (diag.jsonPath.startsWith("$.parties")) {
        const match = diag.jsonPath.match(/\$\.parties\[(\d+)\]/);
        if (match && dto.parties) {
          const idx = parseInt(match[1], 10);
          dto.parties.splice(idx, 1);
        }
      }
    },
  });

  const parsed = compilation.data;
  (parsed as unknown as { _llmActor?: LlmExecutionActor })._llmActor = compilation.llmActor;

  // Attach sourceFileName to all risk flags
  parsed.riskFlags = (parsed.riskFlags ?? []).map((rf) => ({
    ...rf,
    sourceFileName: rf.sourceFileName || fileName,
  }));

  // Append compiler diagnostics as risk flags if any unanchored extractions occurred
  for (const diag of compilation.diagnostics) {
    parsed.riskFlags.push({
      category: "UNANCHORED_EXTRACTION",
      severity: 4,
      description: `[Compiler Rejection] ${diag.message}`,
      sourceFileName: fileName,
      evidenceSnippet: diag.claimedQuote || null,
    });
  }

  // Run deterministic prompt-injection scanner
  const securityFlags = scanForPromptInjection(fileName, parsed, rawTextForVerification);
  for (const sf of securityFlags) {
    parsed.riskFlags.push(sf);
  }

  return parsed;
}
