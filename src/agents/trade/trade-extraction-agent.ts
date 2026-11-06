import { readFileSync } from "fs";
import { join } from "path";
import { compileGroundedDsl, SourceCorpus, type GroundedFieldInspection } from "@/dsl/compiler";
import {
  TradeDocumentExtractionSchema,
  TRADE_DOCUMENT_TAXONOMY,
  type TradeDocumentExtraction,
} from "@/dsl/trade";
import { resolveDocumentTaint, type LlmExecutionActor } from "@/dsl/provenance";
import { scanForPromptInjection } from "@/lib/provenance-verifier";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/trade-extraction.md"),
  "utf-8",
);

const TAXONOMY_HINT =
  `Trade Document Taxonomy codes to classify this document against for documentTypes ` +
  `(select one or more that apply): ` +
  `${TRADE_DOCUMENT_TAXONOMY.join(", ")}.`;

/**
 * Runs one grounded extraction pass over a single uploaded trade finance document.
 * Deterministically verified against the source corpus using DSL Compiler v3.
 */
export async function extractFromTradeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<TradeDocumentExtraction> {
  const isPdf = mimeType === "application/pdf";
  const rawTextForVerification = isPdf ? null : fileBuffer.toString("utf-8");

  const corpus = new SourceCorpus();
  if (isPdf) {
    await corpus.addPdfBuffer(fileName, fileBuffer);
  } else {
    corpus.addTextDocument(fileName, fileBuffer.toString("utf-8"));
  }

  const userMessageContent = isPdf
    ? [
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
      ]
    : `Document filename: ${fileName}\n\nExtract trade finance parameters per the system prompt.\n\nRespond ONLY with a single valid JSON object matching the TradeDocumentExtraction schema.\n\n${TAXONOMY_HINT}\n\n${rawTextForVerification}`;

  const compilation = await compileGroundedDsl<TradeDocumentExtraction>({
    schema: TradeDocumentExtractionSchema,
    schemaName: "TradeDocumentExtraction",
    systemPrompt: SYSTEM_PROMPT,
    userMessageContent,
    corpus,
    isPdf,
    agentPersona: {
      id: "minato",
      displayName: "Minato (湊) — Maritime & Trade Parser",
      templateId: "TRADE_EXTRACTION_PROMPT_V2",
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
            roleExpected: p.role as any,
            provenance: {
              sourceRef: fileName,
              location: "Page 1",
              verbatimQuote: p.legalName,
              derivation: "VERBATIM_EXTRACTED",
            },
          });
        }
      }

      // Inspect Commercial Parameters
      if (dto.commercialParameters?.totalValueUsd !== null && dto.commercialParameters?.totalValueUsd !== undefined) {
        inspections.push({
          jsonPath: "$.commercialParameters.totalValueUsd",
          value: dto.commercialParameters.totalValueUsd,
          expectedType: "number",
          provenance: {
            sourceRef: fileName,
            location: dto.extractionProvenance?.pageOrSheet || "Page 1",
            verbatimQuote: dto.extractionProvenance?.verbatimQuote || "",
            derivation: "VERBATIM_EXTRACTED",
          },
        });
      }

      return inspections;
    },
    nullifyUnverifiedField: (dto, diag) => {
      if (diag.jsonPath.includes(".totalValueUsd")) {
        if (dto.commercialParameters) dto.commercialParameters.totalValueUsd = null;
      }
    },
  });

  const parsed = compilation.data;
  const taint = resolveDocumentTaint(parsed.documentTypes);

  (parsed as unknown as { _llmActor?: LlmExecutionActor })._llmActor = compilation.llmActor;

  parsed.extractionProvenance = {
    sourceFileName: fileName,
    extractedAt: new Date().toISOString(),
    modelUsed: compilation.llmActor.modelSlug,
    ocrEngineUsed: isPdf ? (process.env.OPENROUTER_PDF_ENGINE ?? "mistral-ocr") : "none",
    taint,
    verbatimQuote: parsed.extractionProvenance?.verbatimQuote ?? null,
    pageOrSheet: parsed.extractionProvenance?.pageOrSheet ?? null,
    quoteVerifiedInText: compilation.diagnostics.length === 0,
  };

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

  const securityFlags = scanForPromptInjection(fileName, parsed, rawTextForVerification);
  for (const sf of securityFlags) {
    parsed.riskFlags.push(sf);
  }

  return parsed;
}

