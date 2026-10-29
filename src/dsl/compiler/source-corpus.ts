import { extractText } from "unpdf";
import { parseExcelBuffer, parseCsvBuffer, type SpreadsheetParseResult } from "@/lib/spreadsheet-parser";
import type { SourceSlice, IndexedSource, SourceType } from "./types";

export class SourceCorpus {
  private sources: Map<string, IndexedSource> = new Map();

  /**
   * Returns all indexed source references.
   */
  public listSources(): string[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Case-insensitive, basename-aware source lookup.
   */
  public getSource(ref: string): IndexedSource | null {
    if (!ref) return null;
    const cleanRef = ref.trim().toLowerCase();

    // 1. Exact match
    if (this.sources.has(cleanRef)) {
      return this.sources.get(cleanRef)!;
    }

    // 2. Basename match (e.g. 'path/to/doc.pdf' matches 'doc.pdf')
    const baseName = cleanRef.split("/").pop() || cleanRef;
    for (const [key, src] of this.sources.entries()) {
      const keyBase = key.split("/").pop() || key;
      if (keyBase === baseName || keyBase.includes(baseName) || baseName.includes(keyBase)) {
        return src;
      }
    }

    // 3. Normalized URL match (ignore trailing slash or http vs https)
    try {
      const urlA = new URL(ref);
      const hostPathA = (urlA.hostname + urlA.pathname).replace(/\/$/, "").toLowerCase();
      for (const [key, src] of this.sources.entries()) {
        try {
          const urlB = new URL(key);
          const hostPathB = (urlB.hostname + urlB.pathname).replace(/\/$/, "").toLowerCase();
          if (hostPathA === hostPathB) {
            return src;
          }
        } catch {
          // not a URL
        }
      }
    } catch {
      // not a URL
    }

    return null;
  }

  /**
   * Adds an already indexed source.
   */
  public addIndexedSource(src: IndexedSource) {
    this.sources.set(src.sourceRef.trim().toLowerCase(), src);
  }

  /**
   * Indexes a PDF from a Buffer.
   * Dual-layer: runs local unpdf extraction + incorporates OpenRouter OCR annotations text if provided.
   */
  public async addPdfBuffer(
    fileName: string,
    buffer: Buffer,
    openRouterAnnotationsText?: string | null
  ): Promise<IndexedSource> {
    const slices: SourceSlice[] = [];
    let fullText = "";

    try {
      const uint8 = new Uint8Array(buffer);
      const parsed = await extractText(uint8);
      const pageTexts: string[] = Array.isArray(parsed.text) ? parsed.text : [String(parsed.text || "")];

      for (let i = 0; i < pageTexts.length; i++) {
        const pageNum = i + 1;
        const pageContent = pageTexts[i] || "";
        slices.push({
          sliceId: `Page ${pageNum}`,
          pageNumber: pageNum,
          text: pageContent,
        });
        fullText += `\n--- Page ${pageNum} ---\n${pageContent}\n`;
      }
    } catch (err) {
      console.warn(`[SourceCorpus] Local PDF text extraction failed for ${fileName}:`, err);
    }

    // If local extraction got very little text (e.g. scanned PDF/image deck) and OpenRouter OCR text is provided:
    if (openRouterAnnotationsText && openRouterAnnotationsText.length > fullText.length) {
      // Parse page markers if OpenRouter OCR produced "--- Page N ---" or "# Page N"
      const pageSplitRegex = /(?:^|\n)(?:---|#+)?\s*Page\s+(\d+)\s*(?:---|#+)?\n/gi;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      let lastPage = 1;
      const ocrSlices: SourceSlice[] = [];

      while ((match = pageSplitRegex.exec(openRouterAnnotationsText)) !== null) {
        if (lastIndex < match.index) {
          const chunk = openRouterAnnotationsText.slice(lastIndex, match.index).trim();
          if (chunk) {
            ocrSlices.push({
              sliceId: `Page ${lastPage}`,
              pageNumber: lastPage,
              text: chunk,
            });
          }
        }
        lastPage = parseInt(match[1], 10);
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < openRouterAnnotationsText.length) {
        const chunk = openRouterAnnotationsText.slice(lastIndex).trim();
        if (chunk) {
          ocrSlices.push({
            sliceId: `Page ${lastPage}`,
            pageNumber: lastPage,
            text: chunk,
          });
        }
      }

      if (ocrSlices.length > 0) {
        slices.length = 0;
        slices.push(...ocrSlices);
      }
      fullText = openRouterAnnotationsText;
    }

    const indexed: IndexedSource = {
      sourceRef: fileName,
      sourceType: "PDF",
      slices,
      fullText,
    };
    this.addIndexedSource(indexed);
    return indexed;
  }

  /**
   * Indexes a spreadsheet (Excel or CSV).
   */
  public addSpreadsheetBuffer(
    fileName: string,
    buffer: Buffer,
    mimeType?: string
  ): IndexedSource {
    const isCsv =
      fileName.toLowerCase().endsWith(".csv") ||
      mimeType?.includes("csv") ||
      mimeType?.includes("text/plain");

    const parsed: SpreadsheetParseResult = isCsv
      ? parseCsvBuffer(buffer, fileName)
      : parseExcelBuffer(buffer, fileName);

    const slices: SourceSlice[] = [];
    for (const sheet of parsed.sheets) {
      slices.push({
        sliceId: `Sheet: ${sheet.sheetName}`,
        sheetName: sheet.sheetName,
        text: sheet.markdownTable,
        metadata: {
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
          rawRows: sheet.rawRows,
        },
      });
    }

    const indexed: IndexedSource = {
      sourceRef: fileName,
      sourceType: "SPREADSHEET",
      slices,
      fullText: parsed.combinedMarkdown,
    };
    this.addIndexedSource(indexed);
    return indexed;
  }

  /**
   * Indexes a plain text or markdown document.
   * Recognizes '--- Page N ---' markers and markdown headings.
   */
  public addTextDocument(fileName: string, text: string): IndexedSource {
    const slices: SourceSlice[] = [];
    const lines = text.split("\n");
    let currentSlice: SourceSlice = { sliceId: "Document", text: "" };

    for (const line of lines) {
      const pageMarker = line.match(/(?:^|\n)(?:---|#+)?\s*Page\s+(\d+)\s*(?:---|#+)?/i);
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);

      if (pageMarker) {
        if (currentSlice.text.trim()) slices.push(currentSlice);
        const pageNum = parseInt(pageMarker[1], 10);
        currentSlice = {
          sliceId: `Page ${pageNum}`,
          pageNumber: pageNum,
          text: line + "\n",
        };
      } else if (headingMatch && !currentSlice.pageNumber) {
        if (currentSlice.text.trim()) slices.push(currentSlice);
        currentSlice = {
          sliceId: `Heading: ${headingMatch[1].trim()}`,
          heading: headingMatch[1].trim(),
          text: line + "\n",
        };
      } else {
        currentSlice.text += line + "\n";
      }
    }
    if (currentSlice.text.trim()) slices.push(currentSlice);

    const indexed: IndexedSource = {
      sourceRef: fileName,
      sourceType: "TEXT",
      slices: slices.length > 0 ? slices : [{ sliceId: "Document", text }],
      fullText: text,
    };
    this.addIndexedSource(indexed);
    return indexed;
  }

  /**
   * Indexes Web Pages and search engine findings.
   */
  public addWebPages(
    pages: Array<{
      url: string;
      content?: string;
      markdown?: string;
      title?: string;
      status?: number;
      ok?: boolean;
    }>,
    rawSearchFindings?: string
  ): IndexedSource[] {
    const results: IndexedSource[] = [];

    for (const p of pages) {
      if (!p.url) continue;
      const fullText = p.markdown || p.content || "";
      const slices: SourceSlice[] = [];

      // Break page by markdown headings or paragraphs
      const sections = fullText.split(/\n(?=#{1,3}\s+)/);
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i].trim();
        if (!sec) continue;
        const headingMatch = sec.match(/^#{1,3}\s+([^\n]+)/);
        slices.push({
          sliceId: headingMatch ? `Section: ${headingMatch[1].trim()}` : `Paragraph ${i + 1}`,
          heading: headingMatch ? headingMatch[1].trim() : undefined,
          text: sec,
        });
      }

      const indexed: IndexedSource = {
        sourceRef: p.url,
        sourceType: "WEB_URL",
        slices: slices.length > 0 ? slices : [{ sliceId: "Full Page", text: fullText }],
        fullText,
        urlAuditStatus: {
          ok: p.ok ?? (p.status ? p.status >= 200 && p.status < 300 : true),
          status: p.status ?? 200,
        },
      };

      this.addIndexedSource(indexed);
      results.push(indexed);
    }

    // If search findings exist, add as an auxiliary indexed source for snippet fallback
    if (rawSearchFindings && rawSearchFindings.trim()) {
      this.addIndexedSource({
        sourceRef: "SEARCH_ENGINE_FINDINGS",
        sourceType: "TEXT",
        slices: [{ sliceId: "Search Snippets", text: rawSearchFindings }],
        fullText: rawSearchFindings,
      });
    }

    return results;
  }

  /**
   * Resolves a claimed location string (e.g. 'Page 3', 'Slide 4', 'Sheet: P&L')
   * to a target slice in the source.
   */
  public resolveLocationSlice(
    source: IndexedSource,
    locationStr: string
  ): { targetSlice: SourceSlice | null; resolvedLocation: string; candidates: SourceSlice[] } {
    if (!locationStr) {
      return { targetSlice: null, resolvedLocation: "", candidates: source.slices };
    }

    const loc = locationStr.trim().toLowerCase();

    // 1. PDF Page or Slide (e.g. "Page 4", "Slide 4", "p. 4", "p.4", "Page 4, Clause 1.2")
    const pageMatch = loc.match(/(?:page|slide|p\.?)\s*(\d+)/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      const match = source.slices.find((s) => s.pageNumber === pageNum);
      if (match) {
        return { targetSlice: match, resolvedLocation: `Page ${pageNum}`, candidates: [match] };
      }
    }

    // 2. Spreadsheet Sheet (e.g. "Sheet: Cap Table", "Cap Table!A1", "Cap Table")
    if (source.sourceType === "SPREADSHEET") {
      const sheetMatch = loc.match(/sheet\s*:\s*([^,]+)/i);
      const sheetName = (sheetMatch ? sheetMatch[1] : loc.split("!")[0]).trim();
      const match = source.slices.find(
        (s) => s.sheetName && s.sheetName.toLowerCase() === sheetName.toLowerCase()
      );
      if (match) {
        return { targetSlice: match, resolvedLocation: `Sheet: ${match.sheetName}`, candidates: [match] };
      }
    }

    // 3. Heading / Section match
    for (const slice of source.slices) {
      if (slice.heading && loc.includes(slice.heading.toLowerCase())) {
        return { targetSlice: slice, resolvedLocation: slice.sliceId, candidates: [slice] };
      }
      if (slice.sliceId.toLowerCase().includes(loc) || loc.includes(slice.sliceId.toLowerCase())) {
        return { targetSlice: slice, resolvedLocation: slice.sliceId, candidates: [slice] };
      }
    }

    return { targetSlice: null, resolvedLocation: locationStr, candidates: source.slices };
  }

  /**
   * Searches for a quote across ALL slices of a source.
   * Useful when an agent claimed Page 2, but the text is actually on Page 7.
   */
  public findQuoteAcrossSource(
    source: IndexedSource,
    quote: string
  ): { found: boolean; sliceId?: string; matchSnippet?: string } {
    if (!quote || quote.length < 3) return { found: false };

    const normQuote = normalizeTextForMatching(quote);
    for (const slice of source.slices) {
      const normSlice = normalizeTextForMatching(slice.text);
      if (normSlice.includes(normQuote)) {
        return { found: true, sliceId: slice.sliceId };
      }
    }

    // Fallback: check fullText
    const normFull = normalizeTextForMatching(source.fullText);
    if (normFull.includes(normQuote)) {
      return { found: true, sliceId: "Full Document" };
    }

    return { found: false };
  }
}

/**
 * Normalizes text for robust deterministic matching:
 * - strips markdown formatting artifacts (pipes, bolding, hashes)
 * - normalizes whitespace and smart quotes
 */
export function normalizeTextForMatching(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // em/en dashes
    .replace(/[|*#_`~]/g, " ") // markdown formatting characters
    .replace(/\s+/g, " ")
    .trim();
}
