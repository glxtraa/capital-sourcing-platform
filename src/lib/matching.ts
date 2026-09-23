import type { FinancingAsk } from "@prisma/client";

/**
 * Deliberately a narrow structural type (just the fields this file reads)
 * rather than Prisma's generated `Provider` type: this function is called
 * both directly (real `Date` objects) and from inside an Inngest step
 * (where step outputs round-trip through JSON, turning every `Date` into a
 * `string` — Inngest's durability guarantee requires everything crossing a
 * step boundary to be serializable). A narrow type that only names what's
 * actually used here is satisfied by both shapes without fighting Prisma's
 * generated type field-by-field.
 */
interface MatchableProvider {
  id: string;
  sellerJurisdictions: string[];
  obligorJurisdictions: string[];
  minTicketUsd: number | null;
  maxTicketUsd: number | null;
  typicalMinAnnualVolumeUsd: number | null;
  financingStructuresSupported: string[];
  gatingFactor: string | null;
  lastVerified: Date | string | null;
}

/**
 * TypeScript port of Capital_Sourcing_System/scripts/query_providers.py,
 * extended with the financing-structure-type check that script didn't have
 * (it predates the PT KEM deal, which is what surfaced the need for it).
 *
 * This is a MECHANICAL pre-filter only — same caveat as the Python original
 * and the deal-intake skill's Step 2: a "false" here can mean "genuinely
 * ineligible" or "gated on a fact this function can't evaluate" (e.g. "does
 * the obligor already run a buyer-enrolled SCF program?"). The UI must
 * surface `reasons` so a human (or the research agent) can tell which.
 */

export interface MatchResult {
  providerId: string;
  eligibleOnPaper: boolean;
  reasons: string[];
}

function jurisdictionOk(providerList: string[], value: string | null): boolean {
  if (!value) return true;
  if (providerList.some((j) => j.toLowerCase() === "any")) return true;
  return providerList.some((j) => j.toLowerCase().includes(value.toLowerCase()));
}

function ticketOk(
  provider: MatchableProvider,
  amountUsd: number | null,
): { ok: boolean; reason: string } {
  if (amountUsd == null) return { ok: true, reason: "no ticket size given" };
  if (provider.minTicketUsd != null && amountUsd < provider.minTicketUsd) {
    return { ok: false, reason: `below published min ticket $${provider.minTicketUsd.toLocaleString()}` };
  }
  if (provider.maxTicketUsd != null && amountUsd > provider.maxTicketUsd) {
    return { ok: false, reason: `above published max ticket $${provider.maxTicketUsd.toLocaleString()}` };
  }
  if (provider.typicalMinAnnualVolumeUsd != null && amountUsd < provider.typicalMinAnnualVolumeUsd) {
    return {
      ok: false,
      reason:
        `below typical min ANNUAL VOLUME $${provider.typicalMinAnnualVolumeUsd.toLocaleString()} ` +
        `(gates on yearly turnover, not per-invoice size — consider aggregating multiple invoices/quarters)`,
    };
  }
  return { ok: true, reason: "no disqualifying ticket-size rule found (many providers don't publish minimums — confirm directly)" };
}

export function matchProvider(
  provider: MatchableProvider,
  deal: {
    borrowerJurisdiction: string | null;
    obligorJurisdiction: string | null;
  },
  ask: Pick<FinancingAsk, "amount" | "structureType">,
): MatchResult {
  const reasons: string[] = [];

  const sellerOk = jurisdictionOk(provider.sellerJurisdictions, deal.borrowerJurisdiction);
  if (!sellerOk) reasons.push(`seller jurisdiction "${deal.borrowerJurisdiction}" not in provider's accepted list`);

  const obligorOk = jurisdictionOk(provider.obligorJurisdictions, deal.obligorJurisdiction);
  if (!obligorOk) reasons.push(`obligor jurisdiction "${deal.obligorJurisdiction}" not in provider's accepted list`);

  const { ok: ticketIsOk, reason: ticketReason } = ticketOk(provider, ask.amount);
  reasons.push(ticketReason);

  const structureOk =
    provider.financingStructuresSupported.length === 0 || // not yet reviewed for this field — don't fail on it
    provider.financingStructuresSupported.includes(ask.structureType as never);
  if (!structureOk) {
    reasons.push(
      `provider's known financing_structures_supported does not include ${ask.structureType} — ` +
        `re-check the provider's actual product description before ruling this out entirely, ` +
        `this field is known-incomplete for older entries`,
    );
  }

  const eligibleOnPaper = sellerOk && obligorOk && ticketIsOk && structureOk;

  if (provider.gatingFactor) reasons.push(`gating factor on file: ${provider.gatingFactor}`);
  const lastVerifiedMs = provider.lastVerified ? new Date(provider.lastVerified).getTime() : null;
  if (!lastVerifiedMs || Date.now() - lastVerifiedMs > 90 * 24 * 3600 * 1000) {
    reasons.push("STALE: last_verified is missing or >90 days old — consider a research-refresh run before relying on this");
  }

  return { providerId: provider.id, eligibleOnPaper, reasons };
}

export function matchAllProviders(
  providers: MatchableProvider[],
  deal: { borrowerJurisdiction: string | null; obligorJurisdiction: string | null },
  ask: Pick<FinancingAsk, "amount" | "structureType">,
): MatchResult[] {
  return providers
    .map((p) => matchProvider(p, deal, ask))
    .sort((a, b) => Number(b.eligibleOnPaper) - Number(a.eligibleOnPaper));
}
