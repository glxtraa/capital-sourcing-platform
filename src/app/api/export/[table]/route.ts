import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toCsv, CSV_BOM } from "@/lib/csv";
import { getExportTable, currentOrg } from "@/lib/export-tables";
import { providersToLegacyFile } from "@/lib/provider-legacy";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/:table?format=csv|json|legacy
 * `legacy` is only valid for `providers`: the providers.json layout the
 * manual system's skills read, ready to drop into providers_db/.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table: key } = await params;
  const table = getExportTable(key);
  if (!table) return NextResponse.json({ error: `unknown table "${key}"` }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "legacy") {
    if (key !== "providers") return NextResponse.json({ error: "legacy format is only available for providers" }, { status: 400 });
    const providers = await db.provider.findMany({ include: { documentsRequired: true }, orderBy: { id: "asc" } });
    return new NextResponse(JSON.stringify(providersToLegacyFile(providers), null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="providers.json"`,
      },
    });
  }

  const rows = await table.rows(await currentOrg());
  if (format === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${key}-${stamp}.json"`,
      },
    });
  }
  if (format === "csv") {
    return new NextResponse(CSV_BOM + toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${key}-${stamp}.csv"`,
      },
    });
  }
  return NextResponse.json({ error: "format must be csv, json or legacy" }, { status: 400 });
}
