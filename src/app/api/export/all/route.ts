import { NextResponse, type NextRequest } from "next/server";
import { strToU8, zipSync } from "fflate";
import { db } from "@/lib/db";
import { toCsv, CSV_BOM } from "@/lib/csv";
import { EXPORT_TABLES, currentOrg } from "@/lib/export-tables";
import { providersToLegacyFile } from "@/lib/provider-legacy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/export/all?format=zip|json
 *   zip  (default): every table as CSV and JSON, plus providers.json in the legacy layout.
 *   json: one JSON object keyed by table.
 */
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "zip";
  const orgId = await currentOrg();
  const stamp = new Date().toISOString().slice(0, 10);

  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of EXPORT_TABLES) data[t.key] = await t.rows(orgId);

  if (format === "json") {
    return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), tables: data }, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="capital-sourcing-export-${stamp}.json"`,
      },
    });
  }
  if (format !== "zip") return NextResponse.json({ error: "format must be zip or json" }, { status: 400 });

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
