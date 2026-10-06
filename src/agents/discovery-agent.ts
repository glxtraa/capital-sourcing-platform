import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenRouterClient, ONBOARDING_MODEL, webSearchPlugin } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { hostOf, normalizeName, registrableDomain } from "@/lib/domains";
import type { Findings } from "./onboarding-agent";
import { readPageText } from "@/lib/form-inspector";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "src/agents/prompts/discovery.md"), "utf-8");
const requestOptions = () => ({ signal: AbortSignal.timeout(50_000), maxRetries: 0 });

export type DiscoveryCategory = "FAMILY_OFFICE" | "PRIVATE_CREDIT" | "PLATFORM";

export const CATEGORY_LABEL: Record<DiscoveryCategory, string> = {
  FAMILY_OFFICE: "family offices / private lenders with a published deal-submission route",
  PRIVATE_CREDIT: "private credit and trade-finance funds, non-bank direct lenders, factors",
  PLATFORM: "invoice-financing marketplaces, SCF platforms and fintech receivables lenders",
};

/** Only jurisdictions/currencies/structure types derived from deals -- never names or amounts. */
export interface DiscoveryContext {
  sellerJurisdictions: string[];
  obligorJurisdictions: string[];
  currencies: string[];
  structureTypes: string[];
}

export const DiscoverySchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string(),
        websiteUrl: z.string(),
        suggestedType: z.enum([
          "FAMILY_OFFICE",
          "PRIVATE_CREDIT_FUND",
          "MARKETPLACE",
          "SPECIALIST_FACTOR",
          "TRADE_FINANCE_FUND",
          "ENTERPRISE_SCF_PLATFORM",
          "BANK",
        ]),
        description: z.string().describe("What it is and what it lends/invests in, from its own materials"),
        whySurfaced: z.string().describe("Which of the given jurisdictions/currencies/structures its published material supports"),
        jurisdictionsHint: z.array(z.string()),
        sources: z.array(z.string()),
      }),
    )
    .max(8),
});
export type DiscoveryDTO = z.infer<typeof DiscoverySchema>;
const RESPONSE_FORMAT = zodToResponseFormat(DiscoverySchema, "DiscoveryResult");

const NOT_OFFICIAL = /(^|\.)(linkedin|facebook|twitter|x|instagram|youtube|crunchbase|wikipedia|medium|reddit|tradedb|zoominfo|pitchbook|dealroom|glassdoor|bloomberg|reuters|yelp)\./i;
const FINANCE_WORDS = /factoring|receivable|invoice|trade finance|supply chain finance|working capital|lending|credit|loan|financ/i;
const HEDGED = /\b(inferred|implied|implicit|likely|presumably|indirect(ly)?|via (its )?global reach|may support|appears to)\b/i;

const list = (a: string[]) => (a.length ? a.join(", ") : "not specified");

export async function searchDiscovery(
  category: DiscoveryCategory,
  ctx: DiscoveryContext,
  knownNames: string[],
): Promise<Findings> {
  const client = getOpenRouterClient();
  const params: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: ONBOARDING_MODEL,
    plugins: webSearchPlugin(6),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Category: ${category} — ${CATEGORY_LABEL[category]}.\n\n` +
          `Jurisdictions that matter — seller/borrower: ${list(ctx.sellerJurisdictions)}; obligor/buyer: ${list(ctx.obligorJurisdictions)}.\n` +
          `Currencies: ${list(ctx.currencies)}. Financing structures: ${list(ctx.structureTypes)}.\n\n` +
          `Already known (do not report these): ${knownNames.join("; ") || "none"}.\n\n` +
          `Find up to 8 providers in this category not on that list. For each give the official website, ` +
          `what it lends/invests in, and which of the jurisdictions/currencies/structures its own ` +
          `published material supports. Quote only what you actually read.`,
      },
    ],
  };
  const res = await client.chat.completions.create(params, requestOptions());
  const findings = res.choices[0]?.message?.content;
  if (!findings) throw new Error(`Discovery search returned nothing for ${category}.`);
  type Annotation = { type: string; url_citation?: { url: string } };
  const annotations = (res.choices[0]?.message as { annotations?: Annotation[] } | undefined)?.annotations ?? [];
  const citedUrls = annotations.filter((a) => a.type === "url_citation" && a.url_citation).map((a) => a.url_citation!.url);
  return { findings, citedUrls };
}

export async function structureDiscovery(
  category: DiscoveryCategory,
  { findings, citedUrls }: Findings,
  known: { names: Set<string>; domains: Set<string>; providerNames?: string[] },
): Promise<DiscoveryDTO["candidates"]> {
  const client = getOpenRouterClient();
  const res = await client.chat.completions.create(
    {
      model: ONBOARDING_MODEL,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Your ${category} research:\n\n${findings}\n\n` +
            (citedUrls.length ? `URLs cited:\n${citedUrls.join("\n")}\n\n` : "") +
            `Record the candidates per the schema. Only providers that appear in the research with an ` +
            `official website; no invented entries. Return an empty list if none qualify.`,
        },
      ],
    },
    requestOptions(),
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error(`Discovery structuring returned nothing for ${category}.`);
  const parsed = DiscoverySchema.parse(JSON.parse(content));

  const haystack = findings.toLowerCase();
  const seen = new Set<string>();
  const shortlisted = parsed.candidates.filter((c) => {
    const host = hostOf(c.websiteUrl);
    const domain = registrableDomain(host);
    const key = normalizeName(c.name);
    if (!domain || !/^https:\/\//i.test(c.websiteUrl) || NOT_OFFICIAL.test(host + ".")) return false;
    if (!haystack.includes(domain.split(".")[0])) return false; // must actually appear in the research
    if (c.sources.length === 0) return false;
    if (known.names.has(key) || known.domains.has(domain) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Independently read each candidate's own site: it must load and talk about finance. A site that
  // blocks bots (non-OK response) is kept but flagged, never silently trusted.
  const checked = await Promise.all(
    shortlisted.map(async (c) => {
      const page = await readPageText(c.websiteUrl);
      return { c, page };
    }),
  );
  const out: DiscoveryDTO["candidates"] = [];
  for (const { c, page } of checked) {
    if (page.ok && !FINANCE_WORDS.test(page.text)) continue; // loads, but is not a finance site
    const flags: string[] = [];
    flags.push(page.ok ? "Site checked: reachable and finance-related." : `⚠ Site could not be checked (${page.error}).`);
    if (HEDGED.test(c.whySurfaced)) flags.push("⚠ Eligibility is inferred, not stated by the provider — verify before pursuing.");
    const firstWord = (n: string) => n.toLowerCase().match(/[a-z0-9]{3,}/)?.[0] ?? "";
    const dup = (known.providerNames ?? []).find((n) => firstWord(n) !== "" && firstWord(n) === firstWord(c.name));
    if (dup) flags.push(`⚠ Possible duplicate of existing provider "${dup}".`);
    out.push({ ...c, whySurfaced: `${flags.join(" ")} ${c.whySurfaced}` });
  }
  return out;
}
