/**
 * One-off LOCAL migration utility — not part of the deployed app.
 *
 * Reads the manual system's Capital_Sourcing_System/providers_db/providers.json
 * (31 real, researched provider entries as of 2026-09-23 — see that file's
 * own history for how each one was sourced) and seeds this app's Provider
 * table with it, so the platform launches with real data instead of an
 * empty table.
 *
 * Usage:
 *   npx tsx scripts/import-legacy-providers.ts [path/to/providers.json]
 *
 * Defaults to ../Capital_Sourcing_System/providers_db/providers.json (this
 * project's actual sibling folder in the environment it was built in) —
 * pass an explicit path if you're running this after copying the file
 * elsewhere, e.g. once this platform folder is its own standalone repo.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";

resolveDatabaseUrl();
const db = new PrismaClient();

const SNAKE_TO_CAMEL_TYPE: Record<string, string> = {
  bank: "BANK",
  specialist_factor: "SPECIALIST_FACTOR",
  marketplace: "MARKETPLACE",
  enterprise_scf_platform: "ENTERPRISE_SCF_PLATFORM",
  trade_finance_fund: "TRADE_FINANCE_FUND",
};

const SNAKE_TO_CAMEL_CONFIDENCE: Record<string, string> = {
  verified_site: "VERIFIED_SITE",
  verified_secondary: "VERIFIED_SECONDARY",
  unverified_needs_check: "UNVERIFIED_NEEDS_CHECK",
};

// The legacy file's `financing_structures_supported` values (added partway
// through the manual system's life, so many entries don't have it) already
// use the same UPPER_SNAKE names as the FinancingStructureType enum below —
// this map exists mainly for the lowercase/legacy `type` and `confidence`
// fields, which never changed casing.
const STRUCTURE_MAP: Record<string, string> = {
  post_shipment_receivables_discounting: "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
  pre_shipment_procurement_finance: "PRE_SHIPMENT_PROCUREMENT_FINANCE",
  pre_export_borrowing_base: "PRE_EXPORT_BORROWING_BASE",
  enterprise_scf_reverse_factoring: "ENTERPRISE_SCF_REVERSE_FACTORING",
};

interface LegacyProvider {
  id: string;
  name: string;
  type: string;
  product: string;
  recourse?: string | null;
  seller_jurisdictions: string[];
  obligor_jurisdictions: string[];
  currencies: string[];
  min_ticket_usd?: number | null;
  max_ticket_usd?: number | null;
  typical_min_annual_volume_usd?: number | null;
  gating_factor?: string | null;
  fee_notes?: string | null;
  documents_required?: { code: string; note?: string | null }[];
  application_process?: string | null;
  application_url?: string | null;
  contact?: string | null;
  time_to_term_sheet?: string | null;
  confidence: string;
  last_verified?: string | null;
  sources?: string[];
  notes?: string | null;
  financing_structures_supported?: string[] | null;
}

async function main() {
  const path = resolve(
    process.argv[2] ?? "../Capital_Sourcing_System/providers_db/providers.json",
  );
  console.log(`Reading legacy provider database from ${path}`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { providers: LegacyProvider[] };

  console.log(`Found ${raw.providers.length} legacy provider entries. Importing...`);

  for (const p of raw.providers) {
    const type = SNAKE_TO_CAMEL_TYPE[p.type];
    const confidence = SNAKE_TO_CAMEL_CONFIDENCE[p.confidence];
    if (!type) throw new Error(`Unknown provider type "${p.type}" for ${p.id}`);
    if (!confidence) throw new Error(`Unknown confidence "${p.confidence}" for ${p.id}`);

    await db.provider.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        type: type as never,
        product: p.product,
        recourse: p.recourse ?? null,
        sellerJurisdictions: p.seller_jurisdictions,
        obligorJurisdictions: p.obligor_jurisdictions,
        currencies: p.currencies,
        minTicketUsd: p.min_ticket_usd ?? null,
        maxTicketUsd: p.max_ticket_usd ?? null,
        typicalMinAnnualVolumeUsd: p.typical_min_annual_volume_usd ?? null,
        gatingFactor: p.gating_factor ?? null,
        feeNotes: p.fee_notes ?? null,
        applicationProcess: p.application_process ?? null,
        applicationUrl: p.application_url ?? null,
        contact: p.contact ?? null,
        timeToTermSheet: p.time_to_term_sheet ?? null,
        confidence: confidence as never,
        lastVerified: p.last_verified ? new Date(p.last_verified) : null,
        sources: p.sources ?? [],
        notes: p.notes ?? null,
        financingStructuresSupported: (p.financing_structures_supported ?? [])
          .map((s) => STRUCTURE_MAP[s])
          .filter(Boolean) as never,
        documentsRequired: {
          create: (p.documents_required ?? []).map((d) => ({ code: d.code, note: d.note ?? null })),
        },
      },
      update: {}, // idempotent — re-running this script never overwrites live-app edits
    });
    console.log(`  imported ${p.id}`);
  }

  console.log(`Done. ${raw.providers.length} providers in the database.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
