import { NextResponse, type NextRequest } from "next/server";
import { strToU8, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { toCsv, CSV_BOM } from "@/lib/csv";
import { EXPORT_TABLES, currentOrg } from "@/lib/export-tables";
import { providersToLegacyFile } from "@/lib/provider-legacy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/export/all?format=zip|json|xlsx&workspace=startups|trade|factoring
 *   xlsx: multi-tab Excel spreadsheet compatible with Google Sheets & Excel.
 *   zip  (default): every table as CSV and JSON, plus providers.json in the legacy layout.
 *   json: one JSON object keyed by table.
 */
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "zip";
  const workspace = req.nextUrl.searchParams.get("workspace");
  const orgId = await currentOrg();
  const stamp = new Date().toISOString().slice(0, 10);

  const tablesToExport = workspace
    ? EXPORT_TABLES.filter((t) => t.workspace === workspace)
    : EXPORT_TABLES;

  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of tablesToExport) data[t.key] = await t.rows(orgId);

  const filenamePrefix = workspace ? `${workspace}-master-sheet` : "capital-sourcing-export";

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    for (const t of tablesToExport) {
      const rows = data[t.key] || [];
      const flatRows = rows.map((r) => {
        const flat: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          if (v === null || v === undefined) {
            flat[k] = "";
          } else if (v instanceof Date) {
            flat[k] = v.toISOString();
          } else if (typeof v === "object") {
            flat[k] = JSON.stringify(v);
          } else {
            flat[k] = v;
          }
        }
        return flat;
      });

      // Excel sheet name max length is 31 chars and cannot contain certain chars
      const sheetName = t.label
        .replace(/[:\\/?*\[\]]/g, " ")
        .slice(0, 31)
        .trim();

      const ws = XLSX.utils.json_to_sheet(flatRows.length > 0 ? flatRows : [{ Status: "No records found" }]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenamePrefix}-${stamp}.xlsx"`,
      },
    });
  }

  if (format === "json") {
    return new NextResponse(
      JSON.stringify({ exported_at: new Date().toISOString(), workspace: workspace ?? "all", tables: data }, null, 2) + "\n",
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenamePrefix}-${stamp}.json"`,
        },
      }
    );
  }
  if (format !== "zip") return NextResponse.json({ error: "format must be zip, json, or xlsx" }, { status: 400 });

  const files: Record<string, Uint8Array> = {};
  for (const [key, rows] of Object.entries(data)) {
    files[`csv/${key}.csv`] = strToU8(CSV_BOM + toCsv(rows));
    files[`json/${key}.json`] = strToU8(JSON.stringify(rows, null, 2) + "\n");
  }
  const providers = await db.provider.findMany({ include: { documentsRequired: true }, orderBy: { id: "asc" } });
  files["providers.json"] = strToU8(JSON.stringify(providersToLegacyFile(providers), null, 2) + "\n");

  const zip = zipSync(files);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="capital-sourcing-export-${stamp}.zip"`,
    },
  });
}

