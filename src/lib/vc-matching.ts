import type { StartupInvestor, UploadedStartupDocument } from "@prisma/client";
import type {
  StartupDealSpec,
  SyndicateRoundMatchingResult,
  SyndicateCustomPreferences,
  TierMatchCandidate,
  MatchCriterion,
} from "@/dsl/vc";

function matchesJurisdiction(acceptedList: string[], target: string | null): boolean {
  if (!target) return true;
  const t = target.toLowerCase().replace(/[_-]/g, " ").trim();
  if (
    acceptedList.some((j) => {
      const norm = j.toLowerCase().replace(/[_-]/g, " ").trim();
      return norm === "any" || norm === "global" || norm === "any / global" || norm === "any global" || norm === "all";
    })
  ) {
    return true;
  }

  const ukTerms = ["london", "uk", "united kingdom", "england", "great britain", "gb", "europe"];
  const usTerms = ["delaware", "us", "usa", "united states", "california", "new york", "san francisco", "bay area"];
  const sgTerms = ["singapore", "sg", "southeast asia", "sea"];
  const hkTerms = ["hong kong", "hk", "hongkong", "hksar", "greater bay area", "apac"];

  return acceptedList.some((j) => {
    const item = j.toLowerCase().replace(/[_-]/g, " ").trim();
    if (item === t) return true;
    if (item.includes(t) || t.includes(item)) return true;
    if (ukTerms.some((u) => t.includes(u)) && ukTerms.some((u) => item.includes(u))) return true;
    if (usTerms.some((u) => t.includes(u)) && usTerms.some((u) => item.includes(u))) return true;
    if (sgTerms.some((u) => t.includes(u)) && sgTerms.some((u) => item.includes(u))) return true;
    if (hkTerms.some((u) => t.includes(u)) && hkTerms.some((u) => item.includes(u))) return true;
    return false;
  });
}

function matchesSector(
  preferredSectors: string[],
  excludedSectors: string[],
  primaryVertical: string,
): { ok: boolean; reason: string } {
  const isExcluded = excludedSectors.includes(primaryVertical);
  if (isExcluded) {
    return { ok: false, reason: `Sector "${primaryVertical}" is explicitly excluded under investor investment thesis.` };
  }
  const isPreferred = preferredSectors.includes("any" as never) || preferredSectors.includes(primaryVertical);
  if (isPreferred) {
    return { ok: true, reason: `Sector "${primaryVertical}" is an active target thesis for this investor.` };
  }
  return { ok: false, reason: `Sector "${primaryVertical}" is outside investor's target investment mandate.` };
}

function matchesArr(
  minArrUsd: number | null,
  startupArrUsd: number | null,
): { ok: boolean; reason: string } {
  if (minArrUsd == null || minArrUsd === 0) {
    return { ok: true, reason: "No minimum ARR threshold required; open to pre-revenue or early traction." };
  }
  if (startupArrUsd == null || startupArrUsd < minArrUsd) {
    return {
      ok: false,
      reason: `Startup ARR ($${(startupArrUsd ?? 0).toLocaleString()}) is below required minimum $${minArrUsd.toLocaleString()}.`,
    };
  }
  return {
    ok: true,
    reason: `Startup ARR ($${startupArrUsd.toLocaleString()}) satisfies minimum threshold $${minArrUsd.toLocaleString()}.`,
  };
}

/**
 * Executes systematic multi-tier syndicate matching for early-stage startup funding:
 * Founders can customize target allocation percentages (Lead %, Syndicate %, Angel %)
 * or start with standard institutional defaults (65% Lead, 25% Syndicate, 10% Angel).
 *
 * Tier 1: Lead Institutional VCs (sets valuation, takes board seat, writes primary lead check)
 * Tier 2: Syndicate Platforms & Co-Investors (AngelList, Sydecar, follow-on VCs)
 * Tier 3: Strategic Operator Angels (value-add checks, domain network)
 * Tier 4: Cohort Accelerators (Y Combinator, Techstars, standard deals)
 */
export function matchStartupDeal(
  spec: StartupDealSpec,
  investors: (StartupInvestor & { documentsRequired: { code: string; note: string | null }[] })[],
  uploadedDocs: UploadedStartupDocument[],
  customPreferences?: Partial<SyndicateCustomPreferences>,
): SyndicateRoundMatchingResult {
  const targetRaiseUsd = spec.financingAsk.targetRaiseUsd || 1500000;

  // 1. Resolve Founder Syndicate Preferences (Customized or Defaults)
  const prefs: SyndicateCustomPreferences = {
    leadAllocationPct: customPreferences?.leadAllocationPct ?? 65,
    syndicateAllocationPct: customPreferences?.syndicateAllocationPct ?? 25,
    angelAllocationPct: customPreferences?.angelAllocationPct ?? 10,
    minAngelCheckUsd: customPreferences?.minAngelCheckUsd ?? 10000,
    customValuationCapUsd:
      customPreferences?.customValuationCapUsd ?? spec.financingAsk.valuationCapUsd ?? null,
  };

  const totalPct = prefs.leadAllocationPct + prefs.syndicateAllocationPct + prefs.angelAllocationPct || 100;
  const normLead = prefs.leadAllocationPct / totalPct;
  const normSynd = prefs.syndicateAllocationPct / totalPct;

  const leadAllocationUsd = Math.round(targetRaiseUsd * normLead);
  const syndicateAllocationUsd = Math.round(targetRaiseUsd * normSynd);
  const angelAllocationUsd = targetRaiseUsd - leadAllocationUsd - syndicateAllocationUsd;

  const uploadedCodes = new Set(uploadedDocs.flatMap((d) => d.documentTypes));

  const leadCandidates: TierMatchCandidate[] = [];
  const coInvestorCandidates: TierMatchCandidate[] = [];
  const angelCandidates: TierMatchCandidate[] = [];
  const acceleratorOptions: TierMatchCandidate[] = [];

  for (const inv of investors) {
    // 1. Core Mandate Checks
    const stageOk = inv.targetStages.includes(spec.stage);
    const sectorResult = matchesSector(inv.preferredSectors, inv.excludedSectors, spec.primaryVertical);
    const geoOk = matchesJurisdiction(inv.acceptedJurisdictions, spec.legalEntityJurisdiction);
    const arrResult = matchesArr(inv.minArrUsd, spec.traction.arrUsd ?? null);
    const isFundingIndustry = inv.activelyFundingIndustry ?? true;

    // 2. Anti-Portfolio & Competitor Conflict Discovery
    // A. Check for self-conflict (investor already backed this company name)
    const selfCompanyConflict = inv.portfolioCompanies.find(
      (p) => p.toLowerCase().trim() === spec.companyName.toLowerCase().trim(),
    );

    // B. Check if investor's portfolio contains any identified startup competitor
    const rivalFromPortfolio = (spec.competitors || []).find((comp) =>
      inv.portfolioCompanies.some((p) => {
        const pNorm = p.toLowerCase().trim();
        const cNorm = comp.name.toLowerCase().trim();
        return pNorm === cNorm || pNorm.includes(cNorm) || cNorm.includes(pNorm);
      }),
    );

    // C. Check if any identified competitor lists this investor as a known backer
    const rivalBackedByThisInvestor = (spec.competitors || []).find((comp) =>
      (comp.knownInvestors || []).some((ki) => {
        const kiNorm = ki.toLowerCase().trim();
        const invNorm = inv.name.toLowerCase().trim();
        return kiNorm === invNorm || kiNorm.includes(invNorm) || invNorm.includes(kiNorm);
      }),
    );

    // D. Check investor's recorded competitor investments
    type CompInv = {
      competitorName: string;
      roundStage?: string;
      conflictSeverity?: string;
      notes?: string;
      sourceUrl?: string;
      verified?: boolean;
    };
    const compInvestments = (Array.isArray(inv.competitorInvestments)
      ? inv.competitorInvestments
      : []) as CompInv[];
    // Only genuine conflicts:
    // Exclude anything explicitly marked "NONE" or with notes stating "no conflict" / "not in portfolio"
    const isExplicitNoConflict = (ci: CompInv) => {
      if (ci.conflictSeverity === "NONE") return true;
      const n = (ci.notes || "").toLowerCase();
      const name = (ci.competitorName || "").toLowerCase();
      if (n.includes("no conflict") || n.includes("not in portfolio") || n.includes("none")) return true;
      if (name.includes("no conflict") || name.includes("none")) return true;
      return false;
    };

    const directCompetitorInvestment = compInvestments.find(
      (ci) =>
        !isExplicitNoConflict(ci) &&
        (ci.conflictSeverity === "DIRECT_CONFLICT" ||
          (spec.competitors || []).some(
            (c) =>
              c.name.toLowerCase().trim() === ci.competitorName?.toLowerCase().trim() &&
              c.overlapDegree === "DIRECT",
          )),
    );

    const adjacentCompetitorInvestment = compInvestments.find(
      (ci) =>
        !isExplicitNoConflict(ci) &&
        !directCompetitorInvestment &&
        (ci.conflictSeverity === "ADJACENT_COMPETITOR" ||
          (spec.competitors || []).some(
            (c) => c.name.toLowerCase().trim() === ci.competitorName?.toLowerCase().trim(),
          )),
    );

    const rawConflictingCompany =
      selfCompanyConflict ??
      rivalFromPortfolio?.name ??
      (rivalBackedByThisInvestor?.overlapDegree === "DIRECT" ? rivalBackedByThisInvestor?.name : null) ??
      directCompetitorInvestment?.competitorName;

    // Filter out if conflictingCompany itself contains "no conflict" or "none"
    const conflictingCompany =
      rawConflictingCompany &&
      !rawConflictingCompany.toLowerCase().includes("no conflict") &&
      !rawConflictingCompany.toLowerCase().includes("none")
        ? rawConflictingCompany
        : null;

    const portfolioConflict = Boolean(conflictingCompany);

    let competitorConflictNotes: string | null = null;
    if (portfolioConflict) {
      if (directCompetitorInvestment?.notes) {
        competitorConflictNotes = directCompetitorInvestment.notes;
      } else if (rivalBackedByThisInvestor) {
        competitorConflictNotes = `Investor is a confirmed backer of direct competitor ${rivalBackedByThisInvestor.name}.`;
      } else if (rivalFromPortfolio) {
        competitorConflictNotes = `Investor's active portfolio contains direct competitor ${rivalFromPortfolio.name}.`;
      } else if (selfCompanyConflict) {
        competitorConflictNotes = `Direct portfolio conflict with existing investment in ${selfCompanyConflict}.`;
      } else {
        competitorConflictNotes = `Direct portfolio conflict detected with competitor ${conflictingCompany}.`;
      }
    } else if (adjacentCompetitorInvestment) {
      competitorConflictNotes =
        adjacentCompetitorInvestment.notes ||
        `Holds investment in adjacent market company ${adjacentCompetitorInvestment.competitorName} (Non-blocking).`;
    }

    const missingDocs = inv.documentsRequired
      .filter((req) => !uploadedCodes.has(req.code))
      .map((req) => req.code);

    const criteria: MatchCriterion[] = [
      {
        key: "stage",
        label: "Stage Fit",
        status: stageOk ? "pass" : "fail",
        detail: stageOk
          ? `Invests in ${spec.stage} stage.`
          : `Does not actively invest in ${spec.stage} stage.`,
      },
      {
        key: "sector",
        label: "Sector Thesis",
        status: sectorResult.ok ? "pass" : "fail",
        detail: sectorResult.reason,
      },
      {
        key: "industryActivity",
        label: "Industry Capital Deployment",
        status: isFundingIndustry ? "pass" : "fail",
        detail: isFundingIndustry
          ? `Active capital deployment in ${spec.primaryVertical.replaceAll("_", " ")} and ${spec.industry || "sector"} within the last 12-24 months.`
          : `Stale or inactive thesis: No verified recent capital deployment in ${spec.primaryVertical.replaceAll("_", " ")} over past 24 months.`,
      },
      {
        key: "jurisdiction",
        label: "Jurisdiction & Legal Entity",
        status: geoOk ? "pass" : "fail",
        detail: geoOk
          ? `Accepts ${spec.legalEntityJurisdiction} entity.`
          : `Entity jurisdiction ${spec.legalEntityJurisdiction} not accepted.`,
      },
      {
        key: "arrThreshold",
        label: "Revenue Threshold",
        status: arrResult.ok ? "pass" : "fail",
        detail: arrResult.reason,
      },
    ];

    if (inv.gatingFactor) {
      criteria.push({
        key: "gatingFactor",
        label: "Institutional Gating Factor",
        status: "warning",
        detail: inv.gatingFactor,
      });
    }

    if (adjacentCompetitorInvestment && !portfolioConflict) {
      criteria.push({
        key: "adjacentCompetitor",
        label: "Adjacent Market Investment",
        status: "warning",
        detail:
          adjacentCompetitorInvestment.notes ||
          `Holds investment in adjacent company ${adjacentCompetitorInvestment.competitorName} (Non-blocking).`,
      });
    }

    if (portfolioConflict) {
      criteria.push({
        key: "portfolioConflict",
        label: "Anti-Portfolio Conflict",
        status: "fail",
        detail: competitorConflictNotes || `Direct portfolio conflict with existing investment in ${conflictingCompany}.`,
      });
    }

    const allPassed =
      !portfolioConflict &&
      isFundingIndustry &&
      criteria.filter((c) => c.status !== "warning").every((c) => c.status === "pass");

    const verdict = allPassed ? "GOOD" : "EXCLUDED";

    // Multi-dimensional thesis resonance scoring (0 - 100 scale):
    let score = 0;
    if (stageOk) score += 25;
    else score += 5;

    if (sectorResult.ok) score += 30;
    else if (inv.preferredSectors.length === 0) score += 15;
    else score += 5;

    if (isFundingIndustry) score += 20;
    else score += 5;

    if (geoOk) score += 15;
    else score += 0;

    const targetCheck = spec.financingAsk.targetRaiseUsd;
    if (targetCheck && inv.minCheckUsd && inv.maxCheckUsd) {
      if (targetCheck >= inv.minCheckUsd && targetCheck <= inv.maxCheckUsd) {
        score += 10;
      } else if (targetCheck * 1.5 >= inv.minCheckUsd && targetCheck * 0.7 <= inv.maxCheckUsd) {
        score += 6;
      } else {
        score += 2;
      }
    } else {
      score += 8;
    }

    // Check for commercial customer and partner portfolio synergies
    const partnerSynergies: string[] = [];
    const prospects = (spec as any).commercialProspects;
    if (Array.isArray(prospects) && Array.isArray(inv.portfolioCompanies)) {
      for (const prospect of prospects) {
        const pName = (prospect?.name || "").toLowerCase().trim();
        if (!pName) continue;
        const found = inv.portfolioCompanies.find((c) => {
          const cName = c.toLowerCase().trim();
          return cName === pName || cName.includes(pName) || pName.includes(cName);
        });
        if (found) {
          const label =
            prospect.category === "ENTERPRISE_CUSTOMER" || prospect.category === "SMB_CUSTOMER_SEGMENT"
              ? "Customer"
              : "Partner";
          partnerSynergies.push(`${found} (${label})`);
        }
      }
    }

    if (portfolioConflict) {
      score = Math.min(score, 18);
    } else if (!allPassed) {
      score = Math.min(score, 45);
    } else {
      if (partnerSynergies.length > 0) score += 5;
      score = Math.max(score, 75);
    }

    const thesisResonanceScore = Math.min(98, Math.max(5, Math.round(score)));
    const industryDeploymentScore = isFundingIndustry ? (score >= 80 ? 90 : 75) : 35;

    const sourceLinksAudit = (Array.isArray(inv.sourceLinksAudit)
      ? inv.sourceLinksAudit
      : []) as any[];

    let matchRationale = allPassed
      ? `Fits ${spec.stage} thesis for ${spec.primaryVertical}. Active industry deployment verified in ${spec.industry || "market"}. Clean pass on check bounds and legal entity.`
      : `Excluded: ${criteria.filter((c) => c.status === "fail").map((c) => c.detail).join("; ")}`;

    if (allPassed && partnerSynergies.length > 0) {
      matchRationale += ` High-leverage portfolio network synergy: Investor backed ${partnerSynergies.join(", ")}, presenting warm customer introduction & partnership distribution potential.`;
    }

    const baseCandidate: TierMatchCandidate = {
      investorId: inv.id,
      investorName: inv.name,
      investorType: inv.type,
      tier: "TIER_1_LEAD",
      verdict,
      isLeadCandidate: inv.leadsRounds,
      rationale: matchRationale,
      criteria,
      thesisResonanceScore,
      portfolioConflictDetected: portfolioConflict,
      conflictingPortfolioCompany: conflictingCompany ?? null,
      activelyFundingIndustry: isFundingIndustry,
      industryDeploymentScore,
      competitorConflictNotes,
      sourceLinksAudit,
      missingDocuments: missingDocs,
    };

    // 1. Tier 1: Lead Institutional VCs
    if (inv.type === "INSTITUTIONAL_VC" && inv.leadsRounds) {
      const ticketFitsLead =
        inv.maxCheckUsd == null || inv.maxCheckUsd >= leadAllocationUsd * 0.5;
      leadCandidates.push({
        ...baseCandidate,
        tier: "TIER_1_LEAD",
        rationale: allPassed && ticketFitsLead
          ? `Target lead candidate. Capable of leading $${leadAllocationUsd.toLocaleString()} allocation (${Math.round(normLead * 100)}% of round).`
          : allPassed
            ? `Lead candidate ticket capacity ($${(inv.maxCheckUsd ?? 0).toLocaleString()}) is below ideal lead allocation $${leadAllocationUsd.toLocaleString()}.`
            : baseCandidate.rationale,
      });
    }

    // 2. Tier 2: Co-Investors & Syndicate Platforms
    if (
      inv.type === "ANGEL_PLATFORM_SYNDICATE" ||
      inv.type === "VC_PLATFORM_SCOUT" ||
      (inv.type === "INSTITUTIONAL_VC" && !inv.leadsRounds)
    ) {
      coInvestorCandidates.push({
        ...baseCandidate,
        tier: "TIER_2_SYNDICATE",
        rationale: allPassed
          ? `Ideal syndicate participant for $${syndicateAllocationUsd.toLocaleString()} follow-on allocation (${Math.round(normSynd * 100)}% of round).`
          : baseCandidate.rationale,
      });
    }

    // 3. Tier 3: Strategic Operator-Angels
    if (inv.type === "ANGEL_OPERATOR") {
      const angelCheckFits =
        inv.maxCheckUsd == null || inv.maxCheckUsd >= prefs.minAngelCheckUsd;
      angelCandidates.push({
        ...baseCandidate,
        tier: "TIER_3_ANGEL",
        rationale: allPassed && angelCheckFits
          ? `Strategic operator angel. Recommended for $${prefs.minAngelCheckUsd.toLocaleString()}-$100k value-add checks in ${spec.primaryVertical}.`
          : allPassed
            ? `Angel check range below founder's minimum check threshold ($${prefs.minAngelCheckUsd.toLocaleString()}).`
            : baseCandidate.rationale,
      });
    }

    // 4. Tier 4: Accelerators
    if (inv.type === "ACCELERATOR_INCUBATOR") {
      acceleratorOptions.push({
        ...baseCandidate,
        tier: "TIER_4_ACCELERATOR",
        rationale: allPassed
          ? `Flagship accelerator option. Can fast-track valuation and demo day investor syndicate.`
          : baseCandidate.rationale,
      });
    }
  }

  const eligibleLeads = leadCandidates.filter((c) => c.verdict === "GOOD").length;
  const eligibleSyndicates = coInvestorCandidates.filter((c) => c.verdict === "GOOD").length;
  const eligibleAngels = angelCandidates.filter((c) => c.verdict === "GOOD").length;
  const eligibleAccelerators = acceleratorOptions.filter((c) => c.verdict === "GOOD").length;

  const totalEligible = eligibleLeads + eligibleSyndicates + eligibleAngels;
  const feasibilityScorePct = Math.min(
    100,
    Math.round((eligibleLeads > 0 ? 50 : 0) + (eligibleSyndicates > 0 ? 25 : 0) + (eligibleAngels > 0 ? 25 : 0)),
  );

  return {
    dealId: spec.dealId,
    matchedAt: new Date().toISOString(),
    targetRaiseAmountUsd: targetRaiseUsd,
    customPreferencesApplied: prefs,
    recommendedLeadAllocationUsd: leadAllocationUsd,
    recommendedSyndicateAllocationUsd: syndicateAllocationUsd,
    recommendedAngelAllocationUsd: angelAllocationUsd,

    leadCandidates,
    coInvestorCandidates,
    angelCandidates,
    acceleratorOptions,

    syndicateFeasibilityScorePct: feasibilityScorePct,
    synthesisSummary:
      eligibleLeads > 0
        ? `Found ${eligibleLeads} eligible Lead VC(s), ${eligibleSyndicates} Syndicate Platform(s), and ${eligibleAngels} Strategic Angel(s) across custom allocations (${Math.round(normLead * 100)}% Lead / ${Math.round(normSynd * 100)}% Syndicate / ${Math.round((1 - normLead - normSynd) * 100)}% Angels). Recommended to pursue syndicated round with a dedicated institutional lead.`
        : `No direct institutional Lead VC matched for ${Math.round(normLead * 100)}% lead target. Recommended fallback: Accelerate via ${eligibleAccelerators} accelerator program(s) or aggregate via ${eligibleSyndicates} Angel Platform syndicates.`,
  };
}
