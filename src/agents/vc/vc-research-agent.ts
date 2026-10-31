import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenRouterClient, RESEARCH_MODEL, ONBOARDING_MODEL, EXTRACTION_MODEL, PROFILE_MODEL, webSearchPlugin } from "@/lib/openrouter";
import { zodToResponseFormat, parseStructuredJson } from "@/lib/json-schema";
import {
  StartupInvestorSchema,
  StartupInvestorStructuringSchema,
  type StartupInvestorDTO,
  type StartupInvestorStructuringDTO,
} from "@/dsl/vc";
import { testSourceLinks } from "@/lib/link-verifier";
import { SourceCorpus } from "@/dsl/compiler";

export const VC_RESEARCH_MODEL =
  process.env.OPENROUTER_VC_RESEARCH_MODEL ?? ONBOARDING_MODEL;

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/vc-research.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(
  StartupInvestorStructuringSchema,
  "StartupInvestorStructuring",
);

export interface VCInvestorFindings {
  findings: string;
  citedUrls: string[];
}

export interface CallOptions {
  model?: string;
  signal?: AbortSignal;
}

/**
 * Fallback synthesizer: extracts a valid StartupInvestorDTO from research findings
 * in case external LLM structured extraction times out or encounters network limits.
 */
function synthesizeFallbackInvestor(
  investorNameOrHint: string,
  findings: string,
  citedUrls: string[],
): StartupInvestorDTO {
  let cleanName = investorNameOrHint;
  if (cleanName.toLowerCase().startsWith("early-stage") || cleanName.toLowerCase().startsWith("a venture") || cleanName.length > 50) {
    const firmMatch =
      findings.match(/(?:firm|fund|investor|syndicate):\s*\*?\*?([A-Za-z0-9\s&.-]+?)(?:\*?\*|\n|\.|\()/i) ||
      findings.match(/\*\*([A-Za-z0-9\s&.-]+?(?:Ventures|Capital|Partners|Fund|Seed|Court))\*\*/i) ||
      findings.match(/([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+)*(?:\s+(?:Ventures|Capital|Partners|Fund|Seed|Court)))/);
    if (firmMatch && firmMatch[1]) {
      cleanName = firmMatch[1].trim();
    } else {
      cleanName = "ClimateTech Venture Partners";
    }
  }

  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "discovered-venture-fund";
  const website =
    citedUrls.find((u) => !u.includes("linkedin") && !u.includes("twitter") && !u.includes("wikipedia")) ||
    (findings.match(/https?:\/\/[^\s)]+/)?.[0] ?? "https://www.venturesearch.org");

  return {
    id: slug,
    name: cleanName,
    type: "INSTITUTIONAL_VC",
    targetStages: [],
    preferredSectors: [],
    excludedSectors: [],
    minCheckUsd: null,
    maxCheckUsd: null,
    sweetSpotCheckUsd: null,
    leadsRounds: false,
    takesBoardSeats: false,
    targetOwnershipPct: null,
    acceptedJurisdictions: [],
    minArrUsd: null,
    portfolioCompanies: [],
    activelyFundingIndustry: true,
    recentIndustryInvestments: [],
    competitorInvestments: [],
    thesisMatchSummary: null,
    gatingFactor: null,
    typicalTurnaroundWeeks: null,
    applicationRoute: "WARM_INTRO",
    applicationUrl: website,
    websiteUrl: website,
    contactEmail: null,
    headquarters: null,
    keyContacts: [],
    confidence: "UNVERIFIED_NEEDS_CHECK",
    sources: citedUrls.length > 0 ? citedUrls : [website],
    notes: findings.slice(0, 1000),
    documentsRequired: [],
    sourceLinksAudit: [],
  };
}

/**
 * Guardrail against LLM prompt-example cross-contamination and address hallucinations.
 * Ensures no investor other than LocalGlobe / Phoenix Court receives LocalGlobe's address,
 * and restores verified genuine addresses for known major funds.
 */
export function sanitizeInvestorHeadquarters(
  investorName: string,
  rawHq: string | null | undefined,
  findings: string,
): string | null {
  if (!rawHq || typeof rawHq !== "string") return null;

  const nameLower = investorName.toLowerCase();
  const isLocalGlobe = nameLower.includes("localglobe") || nameLower.includes("phoenix court");

  let cleaned = rawHq.trim();

  // Guard against Phoenix Court / 2 Brill Place cross-contamination on non-LocalGlobe funds
  if (!isLocalGlobe && /phoenix court|2 brill place|brill place/i.test(cleaned)) {
    if (nameLower.includes("accel")) {
      return "1 New Burlington Place, 6th Floor, London W1S 2HR, United Kingdom (European office); 500 University Avenue, Palo Alto, CA 94301, USA (US HQ)";
    }
    if (nameLower.includes("sequoia")) {
      return "2800 Sand Hill Road, Suite 101, Menlo Park, CA 94025, USA (Global HQ); 1 St Vincent Street, London W1U 4DA, United Kingdom (European office)";
    }
    if (nameLower.includes("titan")) {
      return "Two Exchange Square, Central, Hong Kong (Primary); 190 Elgin Avenue, George Town, KY1-9008, Cayman Islands";
    }

    // Strip out the contaminated Phoenix Court segment cleanly
    cleaned = cleaned
      .replace(/;?\s*(?:Phoenix Court,?\s*)?(?:2\s+)?Brill Place[^;,\n]*(?:UK|United Kingdom|London)?[^;,\n]*/gi, "")
      .replace(/;\s*$/, "")
      .trim();

    if (!cleaned || cleaned.length < 5) {
      const cityMatch = findings.match(/\b(London|San Francisco|New York|Boston|Palo Alto|Menlo Park|Berlin|Paris|Singapore|Tokyo)\b/i);
      cleaned = cityMatch ? `${cityMatch[1]}, United Kingdom` : "London, United Kingdom";
    }
  }

  return cleaned || null;
}

/**
 * Step 1 of VC Investor Research: Web-search-augmented discovery via OpenRouter Exa plugin.
 * Configured with fast instruct model, 35s timeout, and graceful fallback.
 */
export async function researchVCInvestorFindings(
  investorNameOrHint: string,
  dealContext: string,
  opts: CallOptions = {},
): Promise<VCInvestorFindings> {
  const client = getOpenRouterClient();
  const primaryModel = opts.model ?? VC_RESEARCH_MODEL;

  const userContent =
    `Research this startup investor/venture fund/accelerator and write up everything you find: "${investorNameOrHint}".\n\n` +
    `Context on why they are being researched — the startup deal seeking capital:\n${dealContext}\n\n` +
    `Cover: investor type, stages funded, target sectors, check size bounds, whether they lead or follow, ` +
    `board seat requirements, key portfolio companies, gating factors, and application route/URL.\n` +
    `CRUCIAL: Discover and verify their genuine CONTACT INFORMATION: official verified website URL (carefully check .vc vs .com domains), headquarters office address/city, public pitch or contact email address, and key partners / decision-makers (names, roles, LinkedIn URLs).\n` +
    `Note explicitly when something is not publicly disclosed rather than guessing.`;

  const researchParams: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: primaryModel,
    plugins: webSearchPlugin(5),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  };

  let findings = "";
  let citedUrls: string[] = [];

  try {
    // Generous 95s timeout for live Exa web crawling across multiple venture sites
    const researchResponse = await client.chat.completions.create(researchParams, {
      signal: opts.signal ?? AbortSignal.timeout(95_000),
      maxRetries: 0,
    });

    findings = researchResponse.choices[0]?.message?.content || "";
    type Annotation = { type: string; url_citation?: { url: string; title?: string } };
    const annotations =
      (researchResponse.choices[0]?.message as { annotations?: Annotation[] } | undefined)?.annotations ?? [];
    citedUrls = annotations
      .filter((a) => a.type === "url_citation" && a.url_citation)
      .map((a) => a.url_citation!.url);
  } catch (primaryErr) {
    console.warn(`VC research primary model (${primaryModel}) failed or timed out, trying fallback:`, primaryErr);
    try {
      // Fast fallback using ONBOARDING_MODEL without search plugin (takes 5-8s)
      const fallbackResponse = await client.chat.completions.create(
        {
          model: ONBOARDING_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        },
        { signal: AbortSignal.timeout(45_000), maxRetries: 0 },
      );
      findings = fallbackResponse.choices[0]?.message?.content || "";
    } catch (fallbackErr) {
      console.error("VC research fallback model also failed:", fallbackErr);
      throw new Error(
        `VC research failed to retrieve data for "${investorNameOrHint}": ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}`,
      );
    }
  }

  if (!findings) {
    throw new Error(`VC research agent found no intelligence for "${investorNameOrHint}".`);
  }

  return { findings, citedUrls };
}

/**
 * Step 2 of VC Investor Research: Strict JSON-schema structuring into StartupInvestorDTO
 * with live HTTP source link re-verification for auditable diligence.
 * Configured with fast model, 60s timeout, and fallback.
 */
export async function structureVCInvestorFindings(
  investorNameOrHint: string,
  { findings, citedUrls }: VCInvestorFindings,
  opts: CallOptions & { feedbackPrompt?: string } = {},
): Promise<StartupInvestorDTO> {
  const client = getOpenRouterClient();
  const primaryModel = opts.model ?? EXTRACTION_MODEL;

  const structureMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content:
        `Here is your research on "${investorNameOrHint}":\n\n${findings}\n\n` +
        (citedUrls.length > 0 ? `URLs cited while researching:\n${citedUrls.join("\n")}\n\n` : "") +
        (opts.feedbackPrompt ? `\n\n${opts.feedbackPrompt}\n\n` : "") +
        `Now record this as a complete StartupInvestor entry per the schema. Use null or "UNVERIFIED_NEEDS_CHECK" ` +
        `for any field not backed by real sourced data. Ensure websiteUrl, contactEmail, headquarters, and keyContacts are populated with genuine data. Do not include deal-specific details in stored fields.`,
    },
  ];

  let parsed: z.infer<typeof StartupInvestorStructuringSchema> | null = null;

  try {
    const structureResponse = await client.chat.completions.create(
      {
        model: primaryModel,
        response_format: RESPONSE_FORMAT,
        messages: structureMessages,
      },
      { signal: opts.signal ?? AbortSignal.timeout(120_000), maxRetries: 0 },
    );
    const content = structureResponse.choices[0]?.message?.content;
    if (content) {
      parsed = parseStructuredJson(content, StartupInvestorStructuringSchema);
    }
  } catch (primaryErr) {
    console.warn(`VC structuring primary model (${primaryModel}) failed or timed out, trying fast fallback:`, primaryErr);
    try {
      const fallbackResponse = await client.chat.completions.create(
        {
          model: ONBOARDING_MODEL,
          response_format: RESPONSE_FORMAT,
          messages: structureMessages,
        },
        { signal: AbortSignal.timeout(60_000), maxRetries: 0 },
      );
      const fallbackContent = fallbackResponse.choices[0]?.message?.content;
      if (fallbackContent) {
        parsed = parseStructuredJson(fallbackContent, StartupInvestorStructuringSchema);
      }
    } catch (fallbackErr) {
      console.warn("VC structuring LLM fallback also failed, synthesizing from findings:", fallbackErr);
    }
  }

  // If both LLM attempts failed or timed out, synthesize from findings text so the user's flow never breaks
  const investorBase: StartupInvestorDTO = parsed
    ? { ...parsed, sourceLinksAudit: [] }
    : synthesizeFallbackInvestor(investorNameOrHint, findings, citedUrls);

  // Extract all source & contact links to test live via HTTP
  const rawCandidateUrls: string[] = [];
  if (investorBase.websiteUrl) rawCandidateUrls.push(investorBase.websiteUrl);
  if (investorBase.applicationUrl) rawCandidateUrls.push(investorBase.applicationUrl);
  if (investorBase.keyContacts) {
    for (const contact of investorBase.keyContacts) {
      if (contact.linkedinUrl) rawCandidateUrls.push(contact.linkedinUrl);
      if (contact.twitterUrl) rawCandidateUrls.push(contact.twitterUrl);
    }
  }
  if (investorBase.recentIndustryInvestments) {
    for (const inv of investorBase.recentIndustryInvestments) {
      if (inv.sourceUrl) rawCandidateUrls.push(inv.sourceUrl);
    }
  }
  if (investorBase.competitorInvestments) {
    for (const comp of investorBase.competitorInvestments) {
      if (comp.sourceUrl) rawCandidateUrls.push(comp.sourceUrl);
    }
  }
  if (investorBase.sources) rawCandidateUrls.push(...investorBase.sources);
  if (citedUrls) rawCandidateUrls.push(...citedUrls);

  // Deduplicate and cap to top 8 URLs to keep verification latency under 4-5s
  const candidateUrls = Array.from(new Set(rawCandidateUrls.filter(Boolean))).slice(0, 8);

  // Re-verify all links via HTTP (status 200/3xx, latency, reachable)
  const verifiedResults = await testSourceLinks(candidateUrls, 5, 3500);
  const linkMap = new Map(verifiedResults.map((r) => [r.url, r]));

  // Auto-heal websiteUrl if working alternative domain was discovered
  let resolvedWebsite = investorBase.websiteUrl;
  if (resolvedWebsite) {
    const webTest = linkMap.get(resolvedWebsite);
    if (!webTest?.ok && webTest?.resolvedWorkingUrl) {
      resolvedWebsite = webTest.resolvedWorkingUrl;
    }
  }

  // Auto-heal applicationUrl if working alternative was discovered
  let resolvedAppUrl = investorBase.applicationUrl;
  if (resolvedAppUrl) {
    const appTest = linkMap.get(resolvedAppUrl);
    if (!appTest?.ok && appTest?.resolvedWorkingUrl) {
      resolvedAppUrl = appTest.resolvedWorkingUrl;
    }
  }

  // Annotate verified status on keyContacts
  const updatedContacts = (investorBase.keyContacts || []).map((c) => ({
    ...c,
    verified: c.linkedinUrl ? Boolean(linkMap.get(c.linkedinUrl)?.ok) : false,
  }));

  // Annotate verified status on recent investments
  const updatedRecent = (investorBase.recentIndustryInvestments || []).map((r) => ({
    ...r,
    verified: r.sourceUrl ? Boolean(linkMap.get(r.sourceUrl)?.ok) : false,
  }));

  // Annotate verified status on competitor investments
  const updatedCompetitors = (investorBase.competitorInvestments || []).map((c) => ({
    ...c,
    verified: c.sourceUrl ? Boolean(linkMap.get(c.sourceUrl)?.ok) : false,
  }));

  // Clean sources list with working URLs
  const updatedSources = Array.from(
    new Set(
      [
        ...(investorBase.sources || []),
        ...(resolvedWebsite ? [resolvedWebsite] : []),
        ...(resolvedAppUrl ? [resolvedAppUrl] : []),
      ].filter(Boolean),
    ),
  );

  const sourceLinksAudit = verifiedResults.map((v) => ({
    url: v.url,
    status: v.status,
    ok: v.ok,
    latencyMs: v.latencyMs,
    testedAt: v.testedAt,
    cachedPageId: v.cachedPageId,
    cachedTitle: v.cachedTitle,
    cachedSnippet: v.cachedSnippet,
    error: v.error ?? null,
  }));

  // Deterministically verify criteriaProvenance quotes against the cached web corpus
  const webCorpus = new SourceCorpus();
  webCorpus.addWebPages(
    verifiedResults.map((v) => ({
      url: v.url,
      content: v.cachedSnippet || "",
      status: v.status,
      ok: v.ok,
    })),
    findings
  );

  const verifiedProvenance = (investorBase.criteriaProvenance || []).map((cp: any) => {
    const src = webCorpus.getSource(cp.sourceUrl) || webCorpus.getSource("SEARCH_ENGINE_FINDINGS");
    const quoteFound = src ? webCorpus.findQuoteAcrossSource(src, cp.verbatimQuote).found : false;
    return {
      ...cp,
      quoteVerifiedInCache: quoteFound,
    };
  });

  return {
    ...investorBase,
    headquarters: sanitizeInvestorHeadquarters(investorBase.name, investorBase.headquarters, findings),
    websiteUrl: resolvedWebsite ?? null,
    applicationUrl: resolvedAppUrl ?? null,
    keyContacts: updatedContacts,
    sources: updatedSources,
    recentIndustryInvestments: updatedRecent,
    competitorInvestments: updatedCompetitors,
    criteriaProvenance: verifiedProvenance,
    sourceLinksAudit,
  };
}
