import * as XLSX from "xlsx";

export interface ParsedSheet {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  markdownTable: string;
  rawRows: Array<Record<string, unknown>>;
}

export interface SpreadsheetParseResult {
  sourceType: "EXCEL" | "CSV" | "GOOGLE_SHEETS";
  fileName: string;
  sheetCount: number;
  sheets: ParsedSheet[];
  combinedMarkdown: string;
  detectedDocTypeHint?: "VC_CAP_TABLE" | "VC_FINANCIAL_MODEL" | "VC_METRICS_DASHBOARD";
}

/**
 * Checks if a given input string or URL is a Google Sheets URL.
 */
export function isGoogleSheetsUrl(urlOrText: string): boolean {
  return /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i.test(urlOrText.trim());
}

/**
 * Converts a standard Google Sheets sharing/edit URL into a direct CSV export URL.
 * Example:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?gid=0#gid=0
 * -> https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=0
 */
export function convertGoogleSheetsToExportUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return url;
  const sheetId = match[1];

  const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Fetches and parses a public or organization-shared Google Sheet into structured spreadsheet data.
 */
export async function fetchAndParseGoogleSheet(googleSheetUrl: string): Promise<SpreadsheetParseResult> {
  const exportUrl = convertGoogleSheetsToExportUrl(googleSheetUrl);
  const res = await fetch(exportUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CapitalSourcingPlatform/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Google Sheet from ${exportUrl}: HTTP ${res.status} ${res.statusText}. Please ensure the sheet is set to 'Anyone with the link can view' or export as CSV/Excel.`,
    );
  }

  const csvText = await res.text();
  const buffer = Buffer.from(csvText, "utf-8");
  const result = parseCsvBuffer(buffer, "google_sheet_export.csv");
  result.sourceType = "GOOGLE_SHEETS";
  return result;
}

/**
 * Parses an Excel (.xlsx, .xls) Buffer into structured markdown and tabular data.
 */
export function parseExcelBuffer(buffer: Buffer, fileName: string): SpreadsheetParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: ParsedSheet[] = [];
  const markdownParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to JSON rows
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const csvContent = XLSX.utils.sheet_to_csv(sheet);

    // Build Markdown representation
    const mdTable = convertCsvToMarkdown(csvContent, 50); // cap preview to 50 rows per sheet to prevent token explosion

    sheets.push({
      sheetName,
      rowCount: rows.length,
      columnCount: rows[0] ? Object.keys(rows[0]).length : 0,
      markdownTable: mdTable,
      rawRows: rows.slice(0, 50),
    });

    markdownParts.push(`### Sheet: ${sheetName}\n\n${mdTable}\n`);
  }

  const combinedMarkdown = markdownParts.join("\n---\n\n");
  const detectedDocTypeHint = detectTaxonomyHint(combinedMarkdown);

  return {
    sourceType: "EXCEL",
    fileName,
    sheetCount: sheets.length,
    sheets,
    combinedMarkdown,
    detectedDocTypeHint,
  };
}

/**
 * Parses a CSV Buffer or Text into structured markdown and tabular data.
 */
export function parseCsvBuffer(buffer: Buffer, fileName: string): SpreadsheetParseResult {
  const csvText = buffer.toString("utf-8");
  const workbook = XLSX.read(csvText, { type: "string" });
  const sheetName = workbook.SheetNames[0] || "Sheet1";
  const sheet = workbook.Sheets[sheetName];

  const rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }) : [];
  const mdTable = convertCsvToMarkdown(csvText, 100);

  const sheets: ParsedSheet[] = [
    {
      sheetName,
      rowCount: rows.length,
      columnCount: rows[0] ? Object.keys(rows[0]).length : 0,
      markdownTable: mdTable,
      rawRows: rows.slice(0, 100),
    },
  ];

  const detectedDocTypeHint = detectTaxonomyHint(csvText);

  return {
    sourceType: "CSV",
    fileName,
    sheetCount: 1,
    sheets,
    combinedMarkdown: `### CSV: ${fileName}\n\n${mdTable}`,
    detectedDocTypeHint,
  };
}

/**
 * Dispatches parsing based on file extension, MIME type, or Google Sheets URL.
 */
export async function parseSpreadsheet(
  input: Buffer | string,
  fileName: string,
  mimeType?: string,
): Promise<SpreadsheetParseResult> {
  if (typeof input === "string" && isGoogleSheetsUrl(input)) {
    return fetchAndParseGoogleSheet(input);
  }

  const buffer = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".csv") || mimeType === "text/csv") {
    return parseCsvBuffer(buffer, fileName);
  }

  return parseExcelBuffer(buffer, fileName);
}

/**
 * Helper to convert CSV string into a formatted GitHub Markdown table.
 */
function convertCsvToMarkdown(csvText: string, maxRows: number = 50): string {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return "_[Empty Table]_";

  const rows = lines.slice(0, maxRows).map((line) => {
    // Basic CSV splitting handling quoted values
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });

  const header = rows[0] || [];
  const separator = header.map(() => "---");
  const dataRows = rows.slice(1);

  const formatRow = (cells: string[]) => `| ${cells.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`;

  const mdLines = [
    formatRow(header),
    formatRow(separator),
    ...dataRows.map((r) => formatRow(r)),
  ];

  if (lines.length > maxRows) {
    mdLines.push(`\n_...[Truncated: showing first ${maxRows} of ${lines.length} rows]..._`);
  }

  return mdLines.join("\n");
}

/**
 * Heuristically detects whether a spreadsheet looks like a Cap Table, Financial Model, or Metrics Dashboard.
 */
function detectTaxonomyHint(content: string): "VC_CAP_TABLE" | "VC_FINANCIAL_MODEL" | "VC_METRICS_DASHBOARD" | undefined {
  const lower = content.toLowerCase();

  const capTableKeywords = ["shareholder", "ownership", "shares", "dilution", "options", "option pool", "safe", "preferred", "common stock", "vesting", "founder shares"];
  const capMatches = capTableKeywords.filter((k) => lower.includes(k)).length;

  const finModelKeywords = ["ebitda", "gross margin", "burn rate", "runway", "cogs", "opex", "headcount", "p&l", "net income", "monthly projections"];
  const finMatches = finModelKeywords.filter((k) => lower.includes(k)).length;

  const metricsKeywords = ["arr", "mrr", "churn", "cac", "ltv", "retention", "mom growth", "nrr", "active users"];
  const metricMatches = metricsKeywords.filter((k) => lower.includes(k)).length;

  if (capMatches >= 3 && capMatches >= finMatches && capMatches >= metricMatches) {
    return "VC_CAP_TABLE";
  }
  if (finMatches >= 3 && finMatches >= metricMatches) {
    return "VC_FINANCIAL_MODEL";
  }
  if (metricMatches >= 2) {
    return "VC_METRICS_DASHBOARD";
  }

  return undefined;
}
