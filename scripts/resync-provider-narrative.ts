/**
 * ONE-OFF cleanup utility — NOT part of the normal seed flow.
 *
 * import-legacy-providers.ts is deliberately idempotent (`update: {}`) so it
 * never clobbers live-app edits on re-run. That's the right default, but it
 * means it can't be used to push a correction to already-seeded rows.
 *
 * This script exists for exactly one purpose: several Provider rows were
 * originally researched during one specific client's deal-intake session and
 * had that client's name/facts written directly into gatingFactor/notes/
 * applicationProcess/documentsRequired[].note (e.g. "...until CBS names the
 * actual counterparty..."). Since Provider is a single shared table matched
 * against every deal, that text was surfacing verbatim in unrelated clients'
 * match results. providers.json has since been rewritten to be generic: this
 * script re-syncs ONLY the narrative/text fields (not jurisdictions,
 * currencies, ticket sizes, etc.) from the corrected JSON onto matching
 * existing rows by id, then should be deleted — it is not meant to be run
 * again as part of normal operation.
 *
 * Usage: npx tsx scripts/resync-provider-narrative.ts [path/to/providers.json]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";

resolveDatabaseUrl();
const db = new PrismaClient();

interface LegacyProvider {
  id: string;
  gating_factor?: string | null;
  fee_notes?: string | null;
  application_process?: string | null;
  contact?: string | null;
  time_to_term_sheet?: string | null;
  notes?: string | null;
  documents_required?: { code: string; note?: string | null }[];
}

async function main() {
  const path = resolve(
    process.argv[2] ?? "../Capital_Sourcing_System/providers_db/providers.json",
  );
  console.log(`Reading corrected provider database from ${path}`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { providers: LegacyProvider[] };

  let updated = 0;
  let skipped = 0;
  for (const p of raw.providers) {
    const existing = await db.provider.findUnique({ where: { id: p.id } });
    if (!existing) {
      console.log(`  skip ${p.id} (not in DB yet — normal seed will create it)`);
      skipped++;
      continue;
    }

    await db.provider.update({
      where: { id: p.id },
      data: {
        gatingFactor: p.gating_factor ?? null,
        feeNotes: p.fee_notes ?? null,
        applicationProcess: p.application_process ?? null,
        contact: p.contact ?? null,
        timeToTermSheet: p.time_to_term_sheet ?? null,
        notes: p.notes ?? null,
      },
    });

    // documentsRequired notes are a separate child table -- replace them too
    // so a corrected `note` (e.g. the DBS/BCA entries) actually lands.
    if (p.documents_required) {
      await db.providerDocumentRequirement.deleteMany({ where: { providerId: p.id } });
      await db.providerDocumentRequirement.createMany({
        data: p.documents_required.map((d) => ({
          providerId: p.id,
          code: d.code,
          note: d.note ?? null,
        })),
      });
    }

    console.log(`  resynced ${p.id}`);
    updated++;
  }

  console.log(`Done. ${updated} rows resynced, ${skipped} skipped (not yet seeded).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
