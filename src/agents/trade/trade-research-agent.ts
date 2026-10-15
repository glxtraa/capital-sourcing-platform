import { readFileSync } from "fs";
import { join } from "path";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenRouterClient, RESEARCH_MODEL, webSearchPlugin } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { TradeFunderSchema, validateTradeFunderDSL, type TradeFunderDTO } from "@/dsl/trade";
import { verifyTradeFunderClaims } from "@/lib/trade-claim-verifier";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/agents/prompts/trade-research.md"),
  "utf-8",
);

const RESPONSE_FORMAT = zodToResponseFormat(TradeFunderSchema, "TradeFunder");

export interface TradeFunderFindings {
  findings: string;
  citedUrls: string[];
}

/**
 * Step 1: Web-search augmented research for trade finance funders.
 * Uses OpenRouter `web` plugin to query banks, commodity funds, and private credit appetite.
 */
export async function researchTradeFunderFindings(
  funderNameOrHint: string,
  tradeDealContext: string,
): Promise<TradeFunderFindings> {
  const client = getOpenRouterClient();

  const researchParams: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: RESEARCH_MODEL,
    plugins: webSearchPlugin(8),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Research this trade finance funder / desk: "${funderNameOrHint}".\n\n` +
          `Context on why it's needed (the trade corridor and deal ask):\n${tradeDealContext}\n\n` +
          `Investigate thoroughly:\n` +
          `1. Institution type and whether it offers an UMBRELLA facility or discrete legs (Supplier / Trader / Buyer).\n` +
          `2. Indicative Pricing Guidance: Exact quoted fees, SOFR spread (bps), LC issuance rates, or advance discount. Provide the exact excerpt or quotation text validating the pricing and the specific URL/tariff document.\n` +
          `3. Desk Contacts: Department name, desk email, phone number, physical office, and direct online intake portal URL.\n` +
          `4. Supported trade corridors & commodities, commodity exclusions, accepted jurisdictions (supplier/trader/buyer), ticket bounds, and required collateral package (BLs, LC assignment, escrow).\n` +
          `Leave unconfirmed details as null or not disclosed.`,
      },
    ],
  };

  const response = await client.chat.completions.create(researchParams);
  const findings = response.choices[0]?.message?.content;
  if (!findings) {
    throw new Error(`Trade research agent found nothing for "${funderNameOrHint}".`);
  }

  type Annotation = { type: string; url_citation?: { url: string; title?: string } };
  const annotations =
    (response.choices[0]?.message as { annotations?: Annotation[] } | undefined)?.annotations ?? [];
  const citedUrls = annotations
    .filter((a) => a.type === "url_citation" && a.url_citation)
    .map((a) => a.url_citation!.url);

  return { findings, citedUrls };
}

/**
 * Step 2: Structure research findings into strict TradeFunderDTO schema.
 * Runs deterministic DSL validation to identify any missing fields, format errors, or unverified claims.
 */
export async function structureTradeFunderFindings(
  funderNameOrHint: string,
  { findings, citedUrls }: TradeFunderFindings,
): Promise<TradeFunderDTO> {
  const client = getOpenRouterClient();

  const structureResponse = await client.chat.completions.create({
    model: RESEARCH_MODEL,
    response_format: RESPONSE_FORMAT,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Here is the research on "${funderNameOrHint}":\n\n${findings}\n\n` +
          (citedUrls.length > 0 ? `Citations:\n${citedUrls.join("\n")}\n\n` : "") +
          `Structure this into a complete TradeFunder entry per the schema. ` +
          `Fill every field truthfully. Do not fabricate fees or minimums. ` +
          `Ensure the record is general to this institution and not tied to one confidential deal.`,
      },
    ],
  });

  const content = structureResponse.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Failed to structure trade funder findings for "${funderNameOrHint}".`);
  }

  const parsed = TradeFunderSchema.parse(JSON.parse(content));
  parsed.validationDiagnostics = await verifyTradeFunderClaims(parsed);

  // Auto-correction guardrail: if the research agent hallucinated a published tariff or dead link,
  // automatically downgrade it so corrupted data never pollutes downstream matching!
  if (parsed.validationDiagnostics.claimVerification?.isHallucinationRisk) {
    if (parsed.pricingProvenance?.derivationType === "PUBLISHED_TARIFF") {
      parsed.pricingProvenance.derivationType = "UNPUBLISHED_BILATERAL_ESTIMATE";
    }
    parsed.confidence = "UNVERIFIED_NEEDS_CHECK";
  }

  return parsed;
}
