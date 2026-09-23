import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Lazily-constructed singleton so the app can build/boot without
 * ANTHROPIC_API_KEY set (e.g. `next build` on Vercel before env vars are
 * configured) — it only throws once something actually tries to call the
 * model.
 */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it in your Vercel project's Environment " +
          "Variables (or .env.local for local dev) — see README.md.",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Model used for every agent in this app. Centralized so upgrading the
 * model (or swapping in a cheaper one for high-volume refresh jobs) is a
 * one-line change. See https://docs.claude.com for current model IDs.
 */
export const AGENT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

/**
 * Claude's web search tool definition, used by the research agent
 * (the productionized `capital-provider-research` skill) to look up real
 * capital-provider terms rather than guessing. Requires the API key's
 * account to have web search enabled.
 */
export const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
};
