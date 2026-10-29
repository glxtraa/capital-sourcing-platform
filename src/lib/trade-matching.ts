import type { TradeFunder, UploadedTradeDocument } from "@prisma/client";
import { isJurisdictionAccepted } from "@/lib/jurisdiction-normalizer";
import { resolveFunderCriterionProvenance } from "@/dsl/provenance";
import type {
  TradeDealSpec,
  TradeMatchingResult,
  UmbrellaMatch,
  ModularLegMatch,
  LegCriteriaStatus,
} from "@/dsl/trade";

function matchesJurisdiction(acceptedList: string[], target: string | null): boolean {
  return isJurisdictionAccepted(acceptedList, target, { allowEmptyAsUnrestricted: false });
}

// Multilingual commodity synonym & English alias map
const COMMODITY_SYNONYMS: Record<string, string[]> = {
  coal: ["batubara", "batu bara", "thermal coal", "coking coal", "met coal", "anthracite", "lignite"],
  crude_palm_oil: ["cpo", "kelapa sawit", "sawit", "palm oil"],
  shrimp: ["camaron", "camarón", "langostino", "white shrimp", "vaname"],
  squid: ["pota", "calamar", "calamar gigante", "giant squid"],
  copper: ["cobre", "concentrado de cobre", "copper cathode", "copper concentrate"],
  nickel: ["nikel", "bijih nikel", "nickel ore", "ferronickel"],
};

function normalizeCommodityTokens(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const tokens = new Set([clean, ...clean.split(/\s+/).filter(Boolean)]);

  for (const [canonical, aliases] of Object.entries(COMMODITY_SYNONYMS)) {
    if (aliases.some((a) => clean.includes(a) || a.includes(clean))) {
      tokens.add(canonical);
      for (const alias of aliases) tokens.add(alias);
    }
  }

  return Array.from(tokens);
}

function matchesCommodity(
  supportedCommodities: string[],
  excludedCommodities: string[],
  commodityName: string,
): { ok: boolean; reason: string } {
  const commTokens = normalizeCommodityTokens(commodityName);

  const isExcluded = excludedCommodities.some((e) => {
    const eTokens = normalizeCommodityTokens(e);
    return commTokens.some((ct) => eTokens.some((et) => ct.includes(et) || et.includes(ct)));
  });

  if (isExcluded) {
    return { ok: false, reason: `Commodity "${commodityName}" (classified as coal/extractive) is explicitly excluded under policy.` };
  }

  if (supportedCommodities.some((c) => {
    const sTokens = normalizeCommodityTokens(c);
    return c.toLowerCase() === "any" || commTokens.some((ct) => sTokens.some((st) => ct.includes(st) || st.includes(ct)));
  })) {
    return { ok: true, reason: `Commodity "${commodityName}" is in funder's accepted catalog.` };
  }

  return {
    ok: true,
    reason: `Commodity "${commodityName}" not explicitly excluded; preliminary match pending credit committee review.`,
  };
}

function matchesTicket(
  funder: TradeFunder,
  amountUsd: number,
): { ok: boolean; reason: string } {
  if (funder.minTicketUsd != null && amountUsd < funder.minTicketUsd) {
    return {
      ok: false,
      reason: `Deal volume $${amountUsd.toLocaleString()} is below min ticket $${funder.minTicketUsd.toLocaleString()}`,
    };
  }
  if (funder.maxTicketUsd != null && amountUsd > funder.maxTicketUsd) {
    return {
      ok: false,
      reason: `Deal volume $${amountUsd.toLocaleString()} exceeds max facility limit $${funder.maxTicketUsd.toLocaleString()}`,
    };
  }
  return { ok: true, reason: "Ticket size within funder's facility limits." };
}

/**
 * Evaluates trade finance matching criteria for a single funder against a deal spec.
 */
export function evaluateTradeFunderCriteria(
  funder: TradeFunder,
  spec: {
    corridor: string;
    supplierJurisdiction?: string | null;
    traderJurisdiction?: string | null;
    buyerJurisdiction?: string | null;
    commodityName?: string | null;
    dealVolumeUsd?: number | null;
  },
): LegCriteriaStatus[] {
  const corridorOk = funder.supportedCorridors.includes(spec.corridor as any);
  const supplierOk = matchesJurisdiction(funder.acceptedSupplierJurisdictions, spec.supplierJurisdiction ?? null);
  const traderOk = matchesJurisdiction(funder.acceptedTraderJurisdictions, spec.traderJurisdiction ?? null);
  const buyerOk = matchesJurisdiction(funder.acceptedBuyerJurisdictions, spec.buyerJurisdiction ?? null);
  const commodityResult = matchesCommodity(
    funder.supportedCommodities,
    funder.excludedCommodities,
    spec.commodityName || "bulk commodity",
  );
  const ticketResult = matchesTicket(funder, spec.dealVolumeUsd || 5000000);

  const criteria: LegCriteriaStatus[] = [
    {
      key: "corridor",
      label: "Trade Corridor",
      status: corridorOk ? "pass" : "fail",
      detail: corridorOk ? `Supported corridor ${spec.corridor}` : `Funder does not cover corridor ${spec.corridor}`,
      funderSide: resolveFunderCriterionProvenance(funder, "corridor"),
    },
    {
      key: "supplierJurisdiction",
      label: "Supplier Jurisdiction",
      status: supplierOk ? "pass" : "fail",
      detail: supplierOk
        ? `Accepted supplier origin: ${spec.supplierJurisdiction || "Verified"}`
        : `Origin ${spec.supplierJurisdiction || "Unknown"} not accepted`,
      funderSide: resolveFunderCriterionProvenance(funder, "supplierJurisdiction"),
    },
    {
      key: "traderJurisdiction",
      label: "Trader Jurisdiction",
      status: traderOk ? "pass" : "fail",
      detail: traderOk
        ? `Accepted trader domicile: ${spec.traderJurisdiction || "Verified"}`
        : `Domicile ${spec.traderJurisdiction || "Unknown"} not accepted`,
      funderSide: resolveFunderCriterionProvenance(funder, "traderJurisdiction"),
    },
    {
      key: "buyerJurisdiction",
      label: "Buyer Jurisdiction",
      status: buyerOk ? "pass" : "fail",
      detail: buyerOk
        ? `Accepted buyer destination: ${spec.buyerJurisdiction || "Verified"}`
        : `Destination ${spec.buyerJurisdiction || "Unknown"} not accepted`,
      funderSide: resolveFunderCriterionProvenance(funder, "buyerJurisdiction"),
    },
    {
      key: "commodity",
      label: "Commodity Policy",
      status: commodityResult.ok ? "pass" : "fail",
      detail: commodityResult.reason,
      funderSide: resolveFunderCriterionProvenance(funder, "commodity"),
    },
    {
      key: "ticketSize",
      label: "Facility Ticket Size",
      status: ticketResult.ok ? "pass" : "fail",
      detail: ticketResult.reason,
      funderSide: resolveFunderCriterionProvenance(funder, "ticketSize"),
    },
  ];

  if (funder.gatingFactor) {
    criteria.push({
      key: "gatingFactor",
      label: "Institutional Gating Factor",
      status: "warning",
      detail: funder.gatingFactor,
      funderSide: resolveFunderCriterionProvenance(funder, "gatingFactor"),
    });
  }

  return criteria;
}

/**
 * Executes two-tier trade finance matching:
 * Tier 1: Evaluates single Umbrella Facility candidates.
 * Tier 2: Evaluates Modular Leg candidates (Supplier, Trader, Buyer).
 */
export function matchTradeDeal(
  spec: TradeDealSpec,
  funders: (TradeFunder & { documentsRequired: { code: string; note: string | null }[] })[],
  uploadedDocs: UploadedTradeDocument[],
  options?: { relaxInferredBlockers?: boolean },
): TradeMatchingResult {
  const relaxInferred = Boolean(options?.relaxInferredBlockers);
  const dealVolumeUsd = spec.offtakeContract.contractAmountUsd || spec.supplyContract.contractAmountUsd || 5000000;
  const uploadedCodes = new Set(uploadedDocs.flatMap((d) => d.documentTypes));

  const umbrellaMatches: UmbrellaMatch[] = [];
  const supplierLegMatches: ModularLegMatch[] = [];
  const traderLegMatches: ModularLegMatch[] = [];
  const buyerLegMatches: ModularLegMatch[] = [];

  for (const funder of funders) {
    const corridorOk = funder.supportedCorridors.includes(spec.corridor);
    const supplierOk = matchesJurisdiction(funder.acceptedSupplierJurisdictions, spec.supplier.jurisdiction);
    const traderOk = matchesJurisdiction(funder.acceptedTraderJurisdictions, spec.trader.jurisdiction);
    const buyerOk = matchesJurisdiction(funder.acceptedBuyerJurisdictions, spec.buyer.jurisdiction);
    const commodityResult = matchesCommodity(funder.supportedCommodities, funder.excludedCommodities, spec.commodity.name);
    const ticketResult = matchesTicket(funder, dealVolumeUsd);

    const missingDocs = funder.documentsRequired
      .filter((req) => !uploadedCodes.has(req.code))
      .map((req) => req.code);

    // 1. Evaluate Tier 1: Umbrella Facility
    if (funder.offersUmbrellaFacility && funder.supportedLegs.includes("UMBRELLA")) {
      const criteria: LegCriteriaStatus[] = [
        {
          key: "corridor",
          label: "Trade Corridor",
          status: corridorOk ? "pass" : "fail",
          detail: corridorOk ? `Supported corridor ${spec.corridor}` : `Funder does not cover corridor ${spec.corridor}`,
          funderSide: resolveFunderCriterionProvenance(funder, "corridor"),
        },
        {
          key: "supplierJurisdiction",
          label: "Supplier Jurisdiction",
          status: supplierOk ? "pass" : "fail",
          detail: supplierOk ? `Accepted supplier origin: ${spec.supplier.jurisdiction}` : `Origin ${spec.supplier.jurisdiction} not accepted`,
          funderSide: resolveFunderCriterionProvenance(funder, "supplierJurisdiction"),
        },
        {
          key: "traderJurisdiction",
          label: "Trader Jurisdiction",
          status: traderOk ? "pass" : "fail",
          detail: traderOk ? `Accepted trader hub: ${spec.trader.jurisdiction}` : `Trader jurisdiction ${spec.trader.jurisdiction} not accepted`,
          funderSide: resolveFunderCriterionProvenance(funder, "traderJurisdiction"),
        },
        {
          key: "buyerJurisdiction",
          label: "Buyer Jurisdiction",
          status: buyerOk ? "pass" : "fail",
          detail: buyerOk ? `Accepted buyer destination: ${spec.buyer.jurisdiction}` : `Destination ${spec.buyer.jurisdiction} not accepted`,
          funderSide: resolveFunderCriterionProvenance(funder, "buyerJurisdiction"),
        },
        {
          key: "commodity",
          label: "Commodity Policy",
          status: commodityResult.ok ? "pass" : "fail",
          detail: commodityResult.reason,
          funderSide: resolveFunderCriterionProvenance(funder, "commodity"),
        },
        {
          key: "ticketSize",
          label: "Facility Ticket Size",
          status: ticketResult.ok ? "pass" : "fail",
          detail: ticketResult.reason,
          funderSide: resolveFunderCriterionProvenance(funder, "ticketSize"),
        },
      ];

      if (funder.gatingFactor) {
        criteria.push({
          key: "gatingFactor",
          label: "Institutional Gating Factor",
          status: "warning",
          detail: funder.gatingFactor,
          funderSide: resolveFunderCriterionProvenance(funder, "gatingFactor"),
        });
      }

      // Check whether failures are hard proven blockers or purely soft inferred
      const failingCriteria = criteria.filter((c) => c.status === "fail");
      const hasHardBlocker = failingCriteria.some((c) => {
        const method = c.funderSide?.acquisitionMethod;
        return method === "VERIFIED_WEB_QUOTE" || method === "REGULATORY_FILING_QUOTE" || method === "HUMAN_OPERATOR_OVERRIDE";
      });

      let verdict: "GOOD" | "POSSIBLE" | "POOR" | "EXCLUDED" = "EXCLUDED";
      let isTier1 = false;

      if (failingCriteria.length === 0) {
        verdict = "GOOD";
        isTier1 = true;
      } else if (relaxInferred && !hasHardBlocker) {
        // Relax: passes all verified hard rules; failures are only AI inferences
        verdict = "POSSIBLE";
        isTier1 = false;
      }

      umbrellaMatches.push({
        funderId: funder.id,
        funderName: funder.name,
        verdict,
        isTier1,
        rationale: verdict === "GOOD"
          ? `Covers full buy-to-sell cycle for ${spec.corridor} with ticket $${dealVolumeUsd.toLocaleString()}.`
          : verdict === "POSSIBLE"
          ? `Relaxed Match: Passes verified parameters; flagged on inferred policy (${failingCriteria.map((c) => c.label).join(", ")}).`
          : `Excluded: ${failingCriteria.map((c) => c.detail).join("; ")}`,
        criteria,
        missingDocuments: missingDocs,
      });
    }

    // 2. Evaluate Tier 2: Modular Legs
    // Leg 1: Supplier Leg (Pre-shipment advance / PO finance)
    if (funder.supportedLegs.includes("SUPPLIER_LEG")) {
      const isEligible = corridorOk && supplierOk && commodityResult.ok;
      supplierLegMatches.push({
        leg: "SUPPLIER_LEG",
        funderId: funder.id,
        funderName: funder.name,
        verdict: isEligible ? "POSSIBLE" : "EXCLUDED",
        rationale: isEligible
          ? `Available for pre-shipment advance in ${spec.supplier.jurisdiction}.`
          : "Supplier origin or commodity not accepted.",
        criteria: [
          { key: "supplierJurisdiction", label: "Supplier Origin", status: supplierOk ? "pass" : "fail", detail: String(spec.supplier.jurisdiction) },
          { key: "commodity", label: "Commodity", status: commodityResult.ok ? "pass" : "fail", detail: commodityResult.reason },
        ],
        missingDocuments: missingDocs,
      });
    }

    // Leg 2: Trader Leg (In-transit B2B LC / Repo)
    if (funder.supportedLegs.includes("TRADER_LEG")) {
      const isEligible = corridorOk && traderOk && commodityResult.ok && ticketResult.ok;
      traderLegMatches.push({
        leg: "TRADER_LEG",
        funderId: funder.id,
        funderName: funder.name,
        verdict: isEligible ? "POSSIBLE" : "EXCLUDED",
        rationale: isEligible
          ? `Supports in-transit cargo repo and B2B LC for trader in ${spec.trader.jurisdiction}.`
          : "Trader jurisdiction or ticket bounds not satisfied.",
        criteria: [
          { key: "traderJurisdiction", label: "Trader Hub", status: traderOk ? "pass" : "fail", detail: String(spec.trader.jurisdiction) },
          { key: "ticket", label: "Ticket", status: ticketResult.ok ? "pass" : "fail", detail: ticketResult.reason },
        ],
        missingDocuments: missingDocs,
      });
    }

    // Leg 3: Buyer Leg (Post-shipment Usance / Import Loan)
    if (funder.supportedLegs.includes("BUYER_LEG")) {
      const isEligible = buyerOk && commodityResult.ok;
      buyerLegMatches.push({
        leg: "BUYER_LEG",
        funderId: funder.id,
        funderName: funder.name,
        verdict: isEligible ? "POSSIBLE" : "EXCLUDED",
        rationale: isEligible
          ? `Discounts buyer receivables or usance LCs in ${spec.buyer.jurisdiction}.`
          : "Buyer jurisdiction or credit criteria not met.",
        criteria: [
          { key: "buyerJurisdiction", label: "Buyer Destination", status: buyerOk ? "pass" : "fail", detail: String(spec.buyer.jurisdiction) },
        ],
        missingDocuments: missingDocs,
      });
    }
  }

  const eligibleUmbrellaCount = umbrellaMatches.filter((m) => m.verdict === "GOOD").length;
  const umbrellaMatchesAvailable = eligibleUmbrellaCount > 0;

  return {
    dealId: spec.dealId,
    matchedAt: new Date().toISOString(),
    umbrellaMatches,
    umbrellaMatchesAvailable,
    modularMatches: {
      supplierLegMatches,
      traderLegMatches,
      buyerLegMatches,
    },
    recommendedRoute: umbrellaMatchesAvailable ? "PURSUE_UMBRELLA" : "ASSEMBLE_MODULAR_SYNDICATE",
    synthesisSummary: umbrellaMatchesAvailable
      ? `Found ${eligibleUmbrellaCount} eligible Umbrella Facility funder(s). Recommended to pursue unified borrowing base.`
      : `No single umbrella funder eligible. Fallback to Modular Syndicate: Supplier (${supplierLegMatches.filter((m) => m.verdict === "POSSIBLE").length}), Trader (${traderLegMatches.filter((m) => m.verdict === "POSSIBLE").length}), Buyer (${buyerLegMatches.filter((m) => m.verdict === "POSSIBLE").length}).`,
    optionsApplied: { relaxInferredBlockers: relaxInferred },
  };
}
