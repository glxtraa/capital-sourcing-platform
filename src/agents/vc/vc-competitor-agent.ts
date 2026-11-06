import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenRouterClient, ONBOARDING_MODEL, webSearchPlugin } from "@/lib/openrouter";
import { parseStructuredJson, zodToResponseFormat } from "@/lib/json-schema";
import { z } from "zod";
import { testSourceLinks, type VerifiedSourceLink } from "@/lib/link-verifier";
import {
  StartupCompetitorExtractionSchema,
  type StartupCompetitorExtraction,
} from "@/dsl/vc";

export const COMPETITOR_MODEL =
  process.env.OPENROUTER_COMPETITOR_MODEL ?? ONBOARDING_MODEL;

const CompetitorsListResponseSchema = z.object({
  industrySummary: z
    .string()
    .describe("Specific description of the market category and competitive landscape based on the startup's documents"),
  subIndustries: z
    .array(z.string())
    .describe("Specific sub-segments reflecting the startup's actual domain"),
  competitors: z.array(StartupCompetitorExtractionSchema),
});

const RESPONSE_FORMAT = zodToResponseFormat(
  CompetitorsListResponseSchema,
  "CompetitorsListResponse",
);

export interface CompetitorResearchParams {
  companyName: string;
  stage?: string;
  primaryVertical: string;
  industryHint?: string;
  subIndustries?: string[];
  targetCustomerProfile?: string;
  businessModel?: string;
  documentContext?: string;
  deckCompetitors?: StartupCompetitorExtraction[];
  descriptionOrDeckSummary?: string;
  jurisdiction?: string;
}

export interface CompetitorResearchResult {
  dslInput?: {
    companyName: string;
    stage?: string;
    primaryVertical: string;
    industryHint?: string;
    subIndustries?: string[];
    targetCustomerProfile?: string;
    businessModel?: string;
    descriptionOrDeckSummary?: string;
    jurisdiction?: string;
  };
  industry: string;
  subIndustries: string[];
  competitors: (StartupCompetitorExtraction & { linkVerification?: VerifiedSourceLink })[];
  verifiedLinks: VerifiedSourceLink[];
  auditSummary: string;
}

/**
 * Discovers direct and indirect competitors for a startup based strictly on its
 * uploaded pitch deck and data room documents.
 *
 * Uses live web search grounded in document excerpts, identifies venture funds
 * that backed those competitors, and re-verifies cited URLs via live HTTP testing.
 */
export async function researchStartupCompetitors(
  params: CompetitorResearchParams,
): Promise<CompetitorResearchResult> {
  const queryHint = params.industryHint || params.primaryVertical.replaceAll("_", " ");
  const documentExcerpt =
    params.documentContext && params.documentContext.trim().length > 0
      ? params.documentContext.trim()
      : params.descriptionOrDeckSummary && params.descriptionOrDeckSummary.trim().length > 0
      ? params.descriptionOrDeckSummary.trim()
      : `Startup ${params.companyName} raising capital in the ${params.primaryVertical} sector.`;

  let structured: z.infer<typeof CompetitorsListResponseSchema>;

  try {
    const client = getOpenRouterClient();

    const userContent =
      `Startup Seeking Venture Capital Funding:\n` +
      `- Company Name: "${params.companyName}"\n` +
      `- Primary Vertical: ${params.primaryVertical}\n` +
      `- Industry / Market: ${params.industryHint || "Extract from data room documents"}\n` +
      (params.subIndustries && params.subIndustries.length > 0
        ? `- Sub-industries: ${params.subIndustries.join(", ")}\n`
        : "") +
      (params.targetCustomerProfile
        ? `- Target Customer Profile (ICP): ${params.targetCustomerProfile}\n`
        : "") +
      (params.businessModel
        ? `- Business / Revenue Model: ${params.businessModel}\n`
        : "") +
      `- Legal Entity Jurisdiction: ${params.jurisdiction || "Global"}\n\n` +
      `Startup Data Room & Pitch Deck Information (Source of Truth):\n` +
      `${documentExcerpt}\n\n` +
      (params.deckCompetitors && params.deckCompetitors.length > 0
        ? `Competitors Already Disclosed in Startup Data Room:\n` +
          params.deckCompetitors.map((c) => `- ${c.name}: ${c.description || ""}`).join("\n") +
          `\n\n`
        : "") +
      `Task:\n` +
      `1. Read the uploaded pitch deck and data room documentation to understand what this company actually does, its core product, value proposition, and customer base.\n` +
      `2. Identify 3 to 6 REAL companies that are direct or indirect commercial competitors to ${params.companyName} in this exact product/problem space.\n` +
      `3. For each competitor, provide their official website URL, what they do, known venture capital funds or angel investors who backed them (for VC anti-portfolio conflict detection), and key differentiation vs ${params.companyName}.\n` +
      `4. Provide REAL, publicly reachable source links (e.g. company homepages, Crunchbase profiles, TechCrunch funding announcements).\n` +
      `5. Provide an accurate market category description and 2-4 sub-industry tags reflecting the startup's actual domain as described in its documents.`;

    const searchParams: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
      model: COMPETITOR_MODEL,
      plugins: webSearchPlugin(6),
      messages: [
        {
          role: "system",
          content:
            "You are a Venture Capital Market Intelligence Agent specializing in competitive landscape mapping and anti-portfolio conflict detection. " +
            "Discover real commercial competitors based strictly on the startup's uploaded documents and product domain. Never invent fictitious companies or fake URLs.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    };

    // Step 1: Web search grounded in startup document context
    let searchFindings = "";
    try {
      const searchRes = await client.chat.completions.create(searchParams, {
        signal: AbortSignal.timeout(30_000),
        maxRetries: 0,
      });
      searchFindings = searchRes.choices[0]?.message?.content || "";
    } catch (searchErr) {
      console.warn("Live web search timed out or encountered an issue, proceeding to document-grounded structuring:", searchErr);
    }

    // Step 2: Structuring grounded strictly in startup data room documents
    const structurePrompt = searchFindings
      ? `Research findings on competitors for ${params.companyName}:\n\n${searchFindings}\n\nStartup Data Room Documentation:\n${documentExcerpt}`
      : `Based strictly on the following data room documents for "${params.companyName}" (${params.primaryVertical}):\n\n${documentExcerpt}\n\n` +
        `Identify 3 to 5 real commercial competitors or alternative solutions that compete for this exact customer problem and product category. ` +
        `Extract official website URLs, descriptions, known venture investors, and differentiation.`;

    try {
      const structureRes = await client.chat.completions.create(
        {
          model: COMPETITOR_MODEL,
          response_format: RESPONSE_FORMAT,
          messages: [
            {
              role: "system",
              content:
                "Extract structured competitor profiles from the research into the provided JSON schema. " +
                "Ensure competitors directly address the startup's problem domain from its documents. " +
                "List known investors accurately for anti-portfolio conflict checking.",
            },
            {
              role: "user",
              content: structurePrompt,
            },
          ],
        },
        {
          signal: AbortSignal.timeout(25_000),
          maxRetries: 0,
        },
      );

      const structuredContent = structureRes.choices[0]?.message?.content;
      if (!structuredContent) {
        throw new Error(`Empty response structuring competitors for "${params.companyName}".`);
      }

      structured = parseStructuredJson(structuredContent, CompetitorsListResponseSchema);
    } catch (structureErr) {
      console.warn("Structuring failed or timed out, synthesizing directly from startup document context:", structureErr);
      structured = {
        industrySummary: params.industryHint || queryHint,
        subIndustries: params.subIndustries || [],
        competitors: params.deckCompetitors || [],
      };
    }
  } catch (clientErr) {
    console.warn("OpenRouter client unavailable or failed, using startup data room extractions:", clientErr);
    structured = {
      industrySummary: params.industryHint || queryHint,
      subIndustries: params.subIndustries || [],
      competitors: params.deckCompetitors || [],
    };
  }

  // Preserve deal's own industry & sub-industries from its documents
  if (params.industryHint && params.industryHint.trim().length > 0) {
    structured.industrySummary = params.industryHint.trim();
  }
  if (params.subIndustries && params.subIndustries.length > 0) {
    structured.subIndustries = params.subIndustries;
  }

  // If no competitors were discovered and deck had disclosed competitors, include them
  if ((!structured.competitors || structured.competitors.length === 0) && params.deckCompetitors && params.deckCompetitors.length > 0) {
    structured.competitors = params.deckCompetitors;
  }

  // Collect all URLs to re-test
  const urlsToTest: string[] = [];
  for (const comp of (structured.competitors || [])) {
    if (comp.websiteUrl) urlsToTest.push(comp.websiteUrl);
    if (comp.sourceUrl) urlsToTest.push(comp.sourceUrl);
  }

  // Re-verify every single source link via HTTP with fast concurrency & 3000ms timeout
  const verifiedLinks = urlsToTest.length > 0 ? await testSourceLinks(urlsToTest, 6, 3000) : [];
  const linkMap = new Map(verifiedLinks.map((v) => [v.url, v]));

  // Annotate competitors with verified status and auto-healed working URLs
  const verifiedCompetitors = (structured.competitors || []).map((comp) => {
    const primaryTest =
      (comp.sourceUrl ? linkMap.get(comp.sourceUrl) : undefined) ||
      (comp.websiteUrl ? linkMap.get(comp.websiteUrl) : undefined) ||
      undefined;

    const isVerified = primaryTest ? primaryTest.ok : false;
    const httpStatus = primaryTest ? primaryTest.status : null;
    const workingUrl = primaryTest?.resolvedWorkingUrl || comp.websiteUrl;

    return {
      ...comp,
      websiteUrl: workingUrl,
      sourceVerified: isVerified,
      sourceHttpStatus: httpStatus,
      linkVerification: primaryTest,
    };
  });

  const directCount = verifiedCompetitors.filter((c) => c.overlapDegree === "DIRECT").length;
  const verifiedLinksCount = verifiedLinks.filter((l) => l.ok).length;

  const auditSummary =
    `Identified ${verifiedCompetitors.length} competitors (${directCount} direct rivals). ` +
    `Tested ${verifiedLinks.length} source links (${verifiedLinksCount} HTTP verified reachable).`;

  const dslInput = {
    companyName: params.companyName,
    stage: params.stage,
    primaryVertical: params.primaryVertical,
    industryHint: params.industryHint,
    descriptionOrDeckSummary: documentExcerpt,
    jurisdiction: params.jurisdiction,
  };

  return {
    dslInput,
    industry: structured.industrySummary,
    subIndustries: structured.subIndustries || [],
    competitors: verifiedCompetitors,
    verifiedLinks,
    auditSummary,
  };
}
