import { readFileSync } from "fs";
import { join } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, AGENT_MODEL, WEB_SEARCH_TOOL } from "@/lib/anthropic";
import { zodToToolSchema } from "@/lib/zod-tool";
import { ProviderSchema, type ProviderDTO } from "@/dsl/provider-schema";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "src/agents/prompts/research.md"), "utf-8");

const RECORD_PROVIDER_TOOL: Anthropic.Tool = {
  name: "record_provider",
  description: "Record the researched/updated provider record.",
  input_schema: zodToToolSchema(ProviderSchema),
};

/**
 * Mode B of the productionized `capital-provider-research` skill: research
 * and return a brand-new provider record. The caller (an Inngest function —
 * see src/inngest/functions/research-providers.ts) is responsible for
 * upserting the result into the database; this function only researches.
 *
 * Runs an agentic loop (the model can call web_search repeatedly) rather
 * than a single completion, because real research — the kind that produced
 * this system's actual database entries — takes multiple searches per
 * provider (product pages, application flows, press coverage for fee
 * data). max_turns bounds runaway loops.
 */
export async function researchNewProvider(
  providerNameOrHint: string,
  dealContext: string,
  maxTurns = 8,
): Promise<ProviderDTO> {
  const client = getAnthropicClient();

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `Research this capital provider and record a full entry: "${providerNameOrHint}".\n\n` +
        `Context on why it's being added — the deal that surfaced the need for it:\n${dealContext}`,
    },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [WEB_SEARCH_TOOL, RECORD_PROVIDER_TOOL],
      messages,
    });

    const providerToolUse = response.content.find(
      (b) => b.type === "tool_use" && b.name === "record_provider",
    );
    if (providerToolUse && providerToolUse.type === "tool_use") {
      return ProviderSchema.parse(providerToolUse.input);
    }

    // Model wants to keep researching (web_search calls) or hasn't finished
    // — feed its turn back in and let the SDK/API handle web_search
    // execution server-side (Anthropic's hosted web search tool does not
    // require the caller to execute the search itself).
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "end_turn") {
      messages.push({
        role: "user",
        content: "Please call record_provider now with everything you've found so far.",
      });
    }
  }

  throw new Error(
    `Research agent did not produce a provider record for "${providerNameOrHint}" within ${maxTurns} turns.`,
  );
}
