/**
 * LOCAL utility — not part of the deployed app. Reverse of import-legacy-providers.ts.
 *
 * Pulls what the live app learned back into the manual system's files:
 *   1. Provider table -> merged into providers.json. New ids are appended (tagged
 *      `source: "app-research"` so the research agents re-verify them); existing ids are
 *      never overwritten — differences are only reported, so hand edits are safe.
 *   2. Deals (+ parties, asks, risk flags, matches, term sheets, research runs) -> deals.json
 *
 * Usage:
 *   npm run export:providers -- [--dry-run] [--providers path/to/providers.json] [--deals-out path/to/deals.json]
 *
 * Defaults write to ../Capital_Sourcing_System/providers_db/providers.json (backed up to
 * providers.json.bak-<timestamp> first) and ../TISI_FM_Data_Room_2608/Capital_Sourcing/app_export/deals.json.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";
import { providerToLegacy } from "../src/lib/provider-legacy";

resolveDatabaseUrl();
const db = new PrismaClient();

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: string) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const dryRun = flag("--dry-run");
const providersPath = resolve(opt("--providers", "../Capital_Sourcing_System/providers_db/providers.json"));
const dealsOut = resolve(opt("--deals-out", "../TISI_FM_Data_Room_2608/Capital_Sourcing/app_export/deals.json"));

const loadProviders = () => db.provider.findMany({ include: { documentsRequired: true }, orderBy: { id: "asc" } });

const toLegacy = providerToLegacy;

const COMPARE = [
  "name", "type", "product", "recourse", "seller_jurisdictions", "obligor_jurisdictions", "currencies",
  "min_ticket_usd", "max_ticket_usd", "gating_factor", "fee_notes", "application_url", "confidence", "notes",
] as const;

async function main() {
  const file = JSON.parse(readFileSync(providersPath, "utf-8")) as { providers: Record<string, unknown>[] } & Record<string, unknown>;
  const existing = new Map(file.providers.map((p) => [p.id as string, p]));
  const rows = await loadProviders();

  const added: string[] = [];
  const differs: string[] = [];
  for (const row of rows) {
    const next = toLegacy(row);
    const cur = existing.get(row.id);
    if (!cur) {
      file.providers.push({ ...next, source: "app-research" });
      added.push(`${row.id} (${next.name}) — ${next.confidence}`);
      continue;
    }
    const changed = COMPARE.filter((k) => JSON.stringify(cur[k] ?? null) !== JSON.stringify(next[k] ?? null));
    if (changed.length) differs.push(`${row.id}: ${changed.join(", ")}`);
  }

  console.log(`App DB: ${rows.length} providers. File had ${existing.size}.`);
  console.log(`\nNEW in app (${added.length}):\n${added.map((a) => "  + " + a).join("\n") || "  none"}`);
  console.log(`\nDiffer from file, NOT overwritten (${differs.length}):\n${differs.map((a) => "  ~ " + a).join("\n") || "  none"}`);

  const deals = await db.deal.findMany({
    include: {
      documents: true, parties: true, financingAsks: true, riskFlags: true,
      providerMatches: { include: { provider: { select: { name: true } } } },
      researchRuns: true, termSheets: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nDeals in app: ${deals.length}`);

  if (dryRun) return console.log("\n--dry-run: nothing written.");

  if (added.length) {
    const bak = `${providersPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(providersPath, bak);
    writeFileSync(providersPath, JSON.stringify(file, null, 2) + "\n");
    console.log(`\nWrote ${providersPath} (backup: ${bak})`);
  } else {
    console.log("\nproviders.json unchanged.");
  }
  mkdirSync(dirname(dealsOut), { recursive: true });
  writeFileSync(dealsOut, JSON.stringify({ exported_at: new Date().toISOString(), deals }, null, 2) + "\n");
  console.log(`Wrote ${dealsOut}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
