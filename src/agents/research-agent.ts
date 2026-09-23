import { readFileSync } from "fs";
import { join } from "path";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenRouterClient, RESEARCH_MODEL, webSearchPlugin } from "@/lib/openrouter";
import { zodToResponseFormat } from "@/lib/json-schema";
import { ProviderSchema, type ProviderDTO } from "@/dsl/provider-schema";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "src/agents/prompts/research.md"), "utf-8");
const RESPONSE_FORMAT = zodToResponseFormat(ProviderSchema, "Provider");

/**
 * Mode B of the productionized `capital-provider-research` skill, in two
 * steps rather than a manually-managed multi-turn tool-call loop:
 *
 *   1. A web-search-augmented call (OpenRouter's `web` plugin — works with
 *      any model, unlike Claude's own hosted search tool, by routing
 *      through Exa) that researches freely and writes up findings in
 *      plain text, with citations attached as message annotations.
 *   2. A second, plain call that structures those findings into the
 *      Provider schema via strict JSON-schema mode.
 *
 * Splitting research from structuring (rather than forcing both in one
 * call) is deliberate: not every OpenRouter model/engine combination
 * reliably honors `response_format` and the `web` plugin simultaneously,
 * and separating them means the citations OpenRouter returns as
 * annotations can be fed back in explicitly for the structuring step to
 * cite properly in `sources`.
 */
export async function researchNewProvider(
  providerNameOrHint: string,
  dealContext: string,
): Promise<ProviderDTO> {
  const client = getOpenRouterClient();

  const researchParams: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: RESEARCH_MODEL,
    plugins: webSearchPlugin(8),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Research this capital provider and write up everything you find: "${providerNameOrHint}".\n\n` +
          `Context on why it's being added — the deal that surfaced the need for it:\n${dealContext}\n\n` +
          `Cover: what it is, seller/obligor jurisdictions it accepts, financing structures it ` +
          `supports, ticket size bounds, the gating factor, fee structure, document requirements, ` +
          `application process, and a direct application URL. Note explicitly when something isn't ` +
          `publicly disclosed rather than guessing.`,
      },
    ],
  };

  const researchResponse = await client.chat.completions.create(researchParams);
  const findings = researchResponse.choices[0]?.message?.content;
  if (!findings) {
    throw new Error(`Research agent found nothing for "${providerNameOrHint}". Raw response: ${JSON.stringify(researchResponse)}`);
  }

  type Annotation = { type: string; url_citation?: { url: string; title?: string } };
  const annotations = (researchResponse.choices[0]?.message as { annotations?: Annotation[] } | undefined)?.annotations ?? [];
  const citedUrls = annotations
    .filter((a) => a.type === "url_citation" && a.url_citation)
    .map((a) => a.url_citation!.url);

  const structureResponse = await client.chat.completions.create({
    model: RESEARCH_MODEL,
    response_format: RESPONSE_FORMAT,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Here is your research on "${providerNameOrHint}":\n\n${findings}\n\n` +
          (citedUrls.length > 0 ? `URLs you cited while researching:\n${citedUrls.join("\n")}\n\n` : "") +
          `Now record this as a complete Provider entry per the schema. Every field must be filled — ` +
          `use null or "UNVERIFIED_NEEDS_CHECK" for anything you don't have real, sourced data for. ` +
          `Never fabricate a fee, minimum, or document requirement.`,
      },
    ],
  });

  const content = structureResponse.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Research agent failed to structure findings for "${providerNameOrHint}".`);
  }
  return ProviderSchema.parse(JSON.parse(content));
}
