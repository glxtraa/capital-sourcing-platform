/**
 * Utility functions for normalizing fund names and detecting whether a venture fund / backer
 * has already been researched by the Funder Agent and matched to a deal or recorded in the platform database.
 */

export function normalizeFundName(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(the|fund|funds|capital|ventures|venture|partners|management|investments|investment|growth|seed|vc|llc|lp|group|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FundResearchStatus {
  isResearched: boolean;
  isMatchedToDeal: boolean;
  investorId?: string;
  matchedName?: string;
  matchScore?: number | null;
  tier?: string;
}

export function checkFundResearchStatus(
  fundName: string,
  matches: Array<{
    tier?: string;
    thesisResonanceScore?: number | null;
    investor: { id: string; name: string };
  }> = [],
  allInvestors: Array<{ id: string; name: string }> = [],
): FundResearchStatus {
  if (!fundName || typeof fundName !== "string") {
    return { isResearched: false, isMatchedToDeal: false };
  }

  const clean = fundName.trim().toLowerCase();
  if (clean.length === 0) return { isResearched: false, isMatchedToDeal: false };

  const norm = normalizeFundName(fundName);

  // 1. Check deal matches (already matched to this specific deal)
  for (const m of matches) {
    if (!m?.investor?.name) continue;
    const invName = m.investor.name.toLowerCase().trim();
    const invNorm = normalizeFundName(m.investor.name);

    // Exact or normalized match
    if (invName === clean || (norm.length >= 3 && invNorm === norm)) {
      return {
        isResearched: true,
        isMatchedToDeal: true,
        investorId: m.investor.id,
        matchedName: m.investor.name,
        matchScore: m.thesisResonanceScore,
        tier: m.tier,
      };
    }

    // Substring match for substantial names
    if (clean.length >= 4 && invName.length >= 4) {
      if (invName.includes(clean) || clean.includes(invName)) {
        return {
          isResearched: true,
          isMatchedToDeal: true,
          investorId: m.investor.id,
          matchedName: m.investor.name,
          matchScore: m.thesisResonanceScore,
          tier: m.tier,
        };
      }
    }
  }

  // 2. Check platform-wide database of investors
  for (const inv of allInvestors) {
    if (!inv?.name) continue;
    const invName = inv.name.toLowerCase().trim();
    const invNorm = normalizeFundName(inv.name);

    if (invName === clean || (norm.length >= 3 && invNorm === norm)) {
      return {
        isResearched: true,
        isMatchedToDeal: false,
        investorId: inv.id,
        matchedName: inv.name,
      };
    }

    if (clean.length >= 4 && invName.length >= 4) {
      if (invName.includes(clean) || clean.includes(invName)) {
        return {
          isResearched: true,
          isMatchedToDeal: false,
          investorId: inv.id,
          matchedName: inv.name,
        };
      }
    }
  }

  return { isResearched: false, isMatchedToDeal: false };
}
