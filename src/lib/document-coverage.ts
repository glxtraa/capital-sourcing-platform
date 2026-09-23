/**
 * Checks a provider's documentsRequired list against what's actually been
 * uploaded to a deal, using the Standard Document Taxonomy code(s) the
 * extraction agent classified each UploadedDocument against (see
 * documentTypes on DocumentExtractionSchema / UploadedDocument). Purely a
 * lookup — no LLM call here, since the classification already happened at
 * extraction time.
 */
export interface DocumentRequirementStatus {
  code: string;
  note: string | null;
  satisfied: boolean;
  matchingFileNames: string[];
}

export function computeDocumentCoverage(
  requirements: { code: string; note: string | null }[],
  documents: { fileName: string; documentTypes: string[] }[],
): DocumentRequirementStatus[] {
  return requirements.map((req) => {
    const matches = documents.filter((d) => d.documentTypes.includes(req.code));
    return {
      code: req.code,
      note: req.note,
      satisfied: matches.length > 0,
      matchingFileNames: matches.map((d) => d.fileName),
    };
  });
}
