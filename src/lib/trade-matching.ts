import type { TradeFunder, UploadedTradeDocument } from "@prisma/client";
import type {
  TradeDealSpec,
  TradeMatchingResult,
  UmbrellaMatch,
  ModularLegMatch,
  LegCriteriaStatus,
} from "@/dsl/trade";

function matchesJurisdiction(acceptedList: string[], target: string | null): boolean {
  if (!target) return true;
  const t = target.toLowerCase().replace(/[_-]/g, " ").trim();
  if (acceptedList.some((j) => {
    const norm = j.toLowerCase().replace(/[_-]/g, " ").trim();
    return norm === "any" || norm === "global" || norm === "all";
  })) {
    return true;
  }
  const hkTerms = ["hong kong", "hk", "hongkong", "hksar"];
  const sgTerms = ["singapore", "sg"];
  return acceptedList.some((j) => {
    const item = j.toLowerCase().replace(/[_-]/g, " ").trim();
    if (item === t) return true;
    if (item.includes(t) || t.includes(item)) return true;
    if (hkTerms.some((u) => t.includes(u)) && hkTerms.some((u) => item.includes(u))) return true;
    if (sgTerms.some((u) => t.includes(u)) && sgTerms.some((u) => item.includes(u))) return true;
    return false;
  });
}

function matchesCommodity(
  supportedCommodities: string[],
  excludedCommodities: string[],
  commodityName: string,
): { ok: boolean; reason: string } {
  const commLower = commodityName.toLowerCase();

  const isExcluded = excludedCommodities.some((e) => commLower.includes(e.toLowerCase()));
  if (isExcluded) {
    return { ok: false, reason: `Commodity "${commodityName}" is explicitly excluded under policy.` };
  }

  if (supportedCommodities.some((c) => c.toLowerCase() === "any" || commLower.includes(c.toLowerCase()))) {
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
 * Executes two-tier trade finance matching:
 * Tier 1: Evaluates single Umbrella Facility candidates.
 * Tier 2: Evaluates Modular Leg candidates (Supplier, Trader, Buyer).
 */
export function matchTradeDeal(
  spec: TradeDealSpec,
  funders: (TradeFunder & { documentsRequired: { code: string; note: string | null }[] })[],
  uploadedDocs: UploadedTradeDocument[],
): TradeMatchingResult {
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
        },
        {
          key: "supplierJurisdiction",
          label: "Supplier Jurisdiction",
          status: supplierOk ? "pass" : "fail",
          detail: supplierOk ? `Accepted supplier origin: ${spec.supplier.jurisdiction}` : `Origin ${spec.supplier.jurisdiction} not accepted`,
        },
        {
          key: "traderJurisdiction",
          label: "Trader Jurisdiction",
          status: traderOk ? "pass" : "fail",
          detail: traderOk ? `Accepted trader hub: ${spec.trader.jurisdiction}` : `Trader jurisdiction ${spec.trader.jurisdiction} not accepted`,
        },
        {
          key: "buyerJurisdiction",
          label: "Buyer Jurisdiction",
          status: buyerOk ? "pass" : "fail",
          detail: buyerOk ? `Accepted buyer destination: ${spec.buyer.jurisdiction}` : `Destination ${spec.buyer.jurisdiction} not accepted`,
        },
        {
          key: "commodity",
          label: "Commodity Policy",
          status: commodityResult.ok ? "pass" : "fail",
          detail: commodityResult.reason,
        },
        {
          key: "ticketSize",
          label: "Facility Ticket Size",
          status: ticketResult.ok ? "pass" : "fail",
          detail: ticketResult.reason,
        },
      ];

      if (funder.gatingFactor) {
        criteria.push({
          key: "gatingFactor",
          label: "Institutional Gating Factor",
          status: "warning",
          detail: funder.gatingFactor,
        });
      }

      const allPassed = criteria.filter((c) => c.status !== "warning").every((c) => c.status === "pass");
      const verdict = allPassed ? "GOOD" : "EXCLUDED";

      umbrellaMatches.push({
        funderId: funder.id,
        funderName: funder.name,
        verdict,
        isTier1: allPassed,
        rationale: allPassed
          ? `Covers full buy-to-sell cycle for ${spec.corridor} with ticket $${dealVolumeUsd.toLocaleString()}.`
          : `Excluded: ${criteria.filter((c) => c.status === "fail").map((c) => c.detail).join("; ")}`,
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
  };
}
