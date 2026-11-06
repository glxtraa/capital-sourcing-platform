import { z } from "zod";
import type { LlmExecutionActor } from "@/dsl/provenance";

export type DerivationType = "VERBATIM_EXTRACTED" | "COMPUTED_FROM_QUOTE" | "UNPUBLISHED_ESTIMATE";

export interface ProvenanceAttestation {
  sourceRef: string;
  location: string;
  verbatimQuote: string;
  derivation: DerivationType;
  howObtainedExplanation?: string;
  crawledAt?: string;
}

export const ProvenanceAttestationSchema = z.object({
  sourceRef: z
    .string()
    .min(1)
    .describe("Exact uploaded document filename (e.g. 'P&L_2025.xlsx', 'Deal_Agreement.pdf') or full HTTP/HTTPS URL (e.g. 'https://example.com/rates')"),
  location: z
    .string()
    .min(1)
    .describe(
      "Exact coordinate: for PDFs use 'Page N' or 'Page N, Clause X.Y' or 'Slide N'; " +
      "for Spreadsheets use 'Sheet: <SheetName>, Row <R>' or '<SheetName>!<CellRange>'; " +
      "for Web URLs use 'Section: <Heading>' or 'Paragraph <N>'."
    ),
  verbatimQuote: z
    .string()
    .min(3)
    .describe(
      "Exact, character-for-character substring copied from the source at `location` " +
      "that contains and proves the extracted value. Never paraphrase, alter, or synthesize."
    ),
  derivation: z
    .enum(["VERBATIM_EXTRACTED", "COMPUTED_FROM_QUOTE", "UNPUBLISHED_ESTIMATE"])
    .default("VERBATIM_EXTRACTED")
    .describe(
      "Use VERBATIM_EXTRACTED when the value is explicitly written in verbatimQuote. " +
      "Use COMPUTED_FROM_QUOTE only when converting units/annualizing a figure explicitly present in verbatimQuote."
    ),
  howObtainedExplanation: z.string().optional(),
  crawledAt: z.string().optional(),
});

export type DslVerificationErrorCode =
  | "MISSING_PROVENANCE_METADATA"
  | "SOURCE_NOT_FOUND_IN_CORPUS"
  | "LOCATION_COORDINATE_NOT_FOUND"
  | "WRONG_LOCATION_COORDINATE"
  | "QUOTE_NOT_FOUND_IN_SOURCE"
  | "VALUE_NOT_SUPPORTED_BY_QUOTE"
  | "ROLE_CONTRADICTS_QUOTE";

export interface DslCompilerDiagnostic {
  jsonPath: string;
  code: DslVerificationErrorCode;
  message: string;
  claimedSource?: string;
  claimedLocation?: string;
  claimedQuote?: string;
  extractedValue?: any;
  suggestedFix?: string;
}

export interface SourceSlice {
  sliceId: string; // e.g. "Page 3", "Sheet: Cap Table", "Heading: Challenge Overview"
  text: string;
  pageNumber?: number;
  sheetName?: string;
  heading?: string;
  metadata?: Record<string, any>;
}

export type SourceType = "PDF" | "SPREADSHEET" | "TEXT" | "WEB_URL";

export interface IndexedSource {
  sourceRef: string; // Document filename or normalized URL
  sourceType: SourceType;
  fullText: string;
  slices: SourceSlice[];
  urlAuditStatus?: {
    ok: boolean;
    status: number;
    latencyMs?: number;
  };
}

export interface GroundedFieldInspection {
  jsonPath: string;
  value: any;
  provenance: ProvenanceAttestation | null;
  expectedType?: "string" | "number" | "boolean" | "role" | "jurisdiction";
  roleExpected?: "BORROWER" | "OBLIGOR" | "LENDER" | "SUPPLIER" | "INTERMEDIARY" | "GUARANTOR" | string;
}

export interface CompilationResult<T> {
  data: T;
  diagnostics: DslCompilerDiagnostic[];
  compilerAttempts: number;
  verifiedFieldsCount: number;
  rejectedClaimsCount: number;
  rawLlmResponse?: any;
  llmActor: LlmExecutionActor;
  fieldLineage: Record<string, any>;
}
