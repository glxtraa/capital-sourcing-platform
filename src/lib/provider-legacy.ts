/**
 * Provider table row -> the manual system's providers.json entry shape.
 * Shared by scripts/export-providers.ts (CLI) and the /api/export routes so
 * both produce identical output. Reverse of scripts/import-legacy-providers.ts.
 */
import type { Provider, ProviderDocumentRequirement } from "@prisma/client";

export type ProviderWithDocs = Provider & { documentsRequired: ProviderDocumentRequirement[] };

const lower = (s: string) => s.toLowerCase();
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function providerToLegacy(p: ProviderWithDocs) {
  return {
    id: p.id,
    name: p.name,
    type: lower(p.type),
    product: p.product,
    recourse: p.recourse,
    seller_jurisdictions: p.sellerJurisdictions,
    obligor_jurisdictions: p.obligorJurisdictions,
    currencies: p.currencies,
    min_ticket_usd: p.minTicketUsd,
    max_ticket_usd: p.maxTicketUsd,
    typical_min_annual_volume_usd: p.typicalMinAnnualVolumeUsd,
    gating_factor: p.gatingFactor,
    fee_notes: p.feeNotes,
    documents_required: p.documentsRequired.map((d) => ({ code: d.code, note: d.note })),
    application_process: p.applicationProcess,
    application_url: p.applicationUrl,
    contact: p.contact,
    time_to_term_sheet: p.timeToTermSheet,
    confidence: lower(p.confidence),
    last_verified: iso(p.lastVerified),
    sources: p.sources,
    notes: p.notes,
    financing_structures_supported: p.financingStructuresSupported.length
      ? p.financingStructuresSupported.map(lower)
      : null,
  };
}

export function providersToLegacyFile(providers: ProviderWithDocs[]) {
  return {
    schema_version: "1.0",
    exported_at: new Date().toISOString(),
    providers: providers.map(providerToLegacy),
  };
}
