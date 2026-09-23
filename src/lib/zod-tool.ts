import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Converts a Zod schema into the JSON-Schema shape Anthropic's tool-use
 * API expects for `input_schema`, using Zod v4's native `toJSONSchema`
 * (no third-party converter needed/compatible — zod-to-json-schema targets
 * Zod v3's internals and breaks against v4).
 */
export function zodToToolSchema(schema: z.ZodType): Anthropic.Tool["input_schema"] {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  // Anthropic's schema validator is strict about extra top-level keys —
  // drop the meta key zod adds that Anthropic doesn't expect.
  delete jsonSchema.$schema;
  return jsonSchema as Anthropic.Tool["input_schema"];
}
