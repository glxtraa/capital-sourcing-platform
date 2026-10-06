/** Minimal RFC-4180 CSV serializer for Prisma rows (Dates, arrays, JSON). */

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (Array.isArray(value) && value.every((v) => v === null || typeof v !== "object")) text = value.join("; ");
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns: string[] = [];
  for (const row of rows) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k);
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Prepended so Excel opens UTF-8 (e.g. JPY/CJK text) correctly. */
export const CSV_BOM = "﻿";
