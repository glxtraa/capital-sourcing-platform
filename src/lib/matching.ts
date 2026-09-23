import type { FinancingAsk, Party } from "@prisma/client";

/**
 * Deliberately a narrow structural type (just the fields this file reads)
 * rather than Prisma's generated `Provider` type, so this stays easy to
 * call with either a real Prisma row or a plain object built from one
 * (e.g. after a JSON round-trip) without fighting the generated type
 * field-by-field. `lastVerified` accepts both `Date` and `string` for the
 * same reason.
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

export type CriterionStatus = "pass" | "fail" | "warning";

/**
 * One row of the "why did/didn't this provider match" breakdown shown in the
 * UI as a table. `pass`/`fail` are the four hard eligibility checks that feed
 * `eligibleOnPaper`; `warning` rows (gating factor, data freshness) are
 * informational — they don't affect eligibility but are worth a human's
 * attention before actually pursuing this provider.
 */
export interface MatchCriterion {
  key: string;
  label: string;
  status: CriterionStatus;
  detail: string;
}

export interface MatchResult {
  providerId: string;
  eligibleOnPaper: boolean;
  criteria: MatchCriterion[];
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
  const criteria: MatchCriterion[] = [];

  const sellerOk = jurisdictionOk(provider.sellerJurisdictions, deal.borrowerJurisdiction);
  if (!sellerOk) reasons.push(`seller jurisdiction "${deal.borrowerJurisdiction}" not in provider's accepted list`);
  criteria.push({
    key: "sellerJurisdiction",
    label: "Seller/borrower jurisdiction",
    status: sellerOk ? "pass" : "fail",
    detail: sellerOk
      ? deal.borrowerJurisdiction
        ? `"${deal.borrowerJurisdiction}" is in the provider's accepted list`
        : "no borrower jurisdiction on file yet — not checked"
      : `"${deal.borrowerJurisdiction}" not in provider's accepted list`,
  });

  const obligorOk = jurisdictionOk(provider.obligorJurisdictions, deal.obligorJurisdiction);
  if (!obligorOk) reasons.push(`obligor jurisdiction "${deal.obligorJurisdiction}" not in provider's accepted list`);
  criteria.push({
    key: "obligorJurisdiction",
    label: "Obligor jurisdiction",
    status: obligorOk ? "pass" : "fail",
    detail: obligorOk
      ? deal.obligorJurisdiction
        ? `"${deal.obligorJurisdiction}" is in the provider's accepted list`
        : "no obligor jurisdiction on file yet — not checked"
      : `"${deal.obligorJurisdiction}" not in provider's accepted list`,
  });

  const { ok: ticketIsOk, reason: ticketReason } = ticketOk(provider, ask.amount);
  reasons.push(ticketReason);
  criteria.push({ key: "ticketSize", label: "Ticket size", status: ticketIsOk ? "pass" : "fail", detail: ticketReason });

  const structureUnreviewed = provider.financingStructuresSupported.length === 0;
  const structureOk =
    structureUnreviewed || // not yet reviewed for this field — don't fail on it
    provider.financingStructuresSupported.includes(ask.structureType as never);
  if (!structureOk) {
    reasons.push(
      `provider's known financing_structures_supported does not include ${ask.structureType} — ` +
        `re-check the provider's actual product description before ruling this out entirely, ` +
        `this field is known-incomplete for older entries`,
    );
  }
  criteria.push({
    key: "financingStructure",
    label: "Financing structure",
    status: structureUnreviewed ? "warning" : structureOk ? "pass" : "fail",
    detail: structureUnreviewed
      ? "provider's financing_structures_supported not yet reviewed for this field — don't assume support or exclusion either way"
      : structureOk
        ? `supports ${String(ask.structureType).replaceAll("_", " ")}`
        : `known financing_structures_supported does not include ${String(ask.structureType).replaceAll("_", " ")} — re-check the provider's actual product description before ruling this out entirely`,
  });

  const eligibleOnPaper = sellerOk && obligorOk && ticketIsOk && structureOk;

  if (provider.gatingFactor) {
    reasons.push(`gating factor on file: ${provider.gatingFactor}`);
    criteria.push({
      key: "gatingFactor",
      label: "Gating factor on file",
      status: "warning",
      detail: provider.gatingFactor,
    });
  }
  const lastVerifiedMs = provider.lastVerified ? new Date(provider.lastVerified).getTime() : null;
  const isStale = !lastVerifiedMs || Date.now() - lastVerifiedMs > 90 * 24 * 3600 * 1000;
  if (isStale) {
    reasons.push("STALE: last_verified is missing or >90 days old — consider a research-refresh run before relying on this");
  }
  criteria.push({
    key: "dataFreshness",
    label: "Data freshness",
    status: isStale ? "warning" : "pass",
    detail: isStale
      ? "last_verified is missing or >90 days old — consider a research-refresh run before relying on this"
      : `verified ${new Date(lastVerifiedMs!).toLocaleDateString()}`,
  });

  return { providerId: provider.id, eligibleOnPaper, criteria, reasons };
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

/**
 * The deal-side inputs matchProvider/matchAllProviders need, derived from a
 * deal's extracted parties and financing asks. Shared by the match route,
 * the research route (which builds its search hint from the same values),
 * and the deal page (which recomputes the criteria table live) so the three
 * can't drift apart. A deal can have more than one ask; matching runs
 * against the first, same as before this was extracted.
 */
export function buildMatchInputs(
  parties: Pick<Party, "role" | "jurisdiction">[],
  financingAsks: Pick<FinancingAsk, "amount" | "structureType" | "currency">[],
) {
  const borrower = parties.find((p) => p.role === "BORROWER");
  const obligor = parties.find((p) => p.role === "OBLIGOR");
  const primaryAsk = financingAsks[0];
  return {
    dealInput: {
      borrowerJurisdiction: borrower?.jurisdiction ?? null,
      obligorJurisdiction: obligor?.jurisdiction ?? null,
    },
    askInput: {
      amount: primaryAsk?.amount ?? null,
      structureType: primaryAsk?.structureType ?? ("UNKNOWN" as const),
    },
    currency: primaryAsk?.currency ?? null,
  };
}
