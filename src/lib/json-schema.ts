import { z } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

type JSONSchemaObject = Record<string, unknown>;

/**
 * OpenAI-compatible "strict" JSON Schema mode (what OpenRouter's
 * `structured_outputs`-capable models honor) requires every property
 * listed in `properties` to also appear in `required` — including
 * nullable ones (nullability is how you express "optional" in strict
 * mode: the field must always be present, but its value can be null) —
 * and every object needs `additionalProperties: false`. Zod v4's native
 * `toJSONSchema` gets most of this right already but doesn't force
 * `required` to include fields that used `.default(...)` (those come out
 * as optional, which strict mode rejects), so this walks the tree and
 * fixes that up.
 */
function forceStrict(schema: JSONSchemaObject): JSONSchemaObject {
  if (Array.isArray(schema)) {
    return schema.map((s) => forceStrict(s as JSONSchemaObject)) as unknown as JSONSchemaObject;
  }
  if (typeof schema !== "object" || schema === null) return schema;

  const result: JSONSchemaObject = {};
  for (const [key, value] of Object.entries(schema)) {
    result[key] = typeof value === "object" && value !== null ? forceStrict(value as JSONSchemaObject) : value;
  }

  if (result.type === "object" && result.properties && typeof result.properties === "object") {
    result.required = Object.keys(result.properties as JSONSchemaObject);
    result.additionalProperties = false;
  }

  return result;
}

/**
 * Converts a Zod schema into an OpenRouter/OpenAI-compatible
 * `response_format` value using Zod v4's native `toJSONSchema` (no
 * third-party converter — see the git history of this file's predecessor,
 * zod-tool.ts, for why: zod-to-json-schema targets Zod v3's internals and
 * silently breaks against v4).
 */
export function zodToResponseFormat(
  schema: z.ZodType,
  name: string,
): ChatCompletionCreateParamsNonStreaming["response_format"] {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as JSONSchemaObject;
  delete jsonSchema.$schema;
  const strict = forceStrict(jsonSchema);

  return {
    type: "json_schema",
    json_schema: {
      name,
      strict: true,
      schema: strict,
    },
  };
}
