import OpenAI from "openai";

/**
 * OpenRouter exposes an OpenAI-compatible API, so the official `openai`
 * package works unmodified against it — just point `baseURL` at OpenRouter
 * and use an OPENROUTER_API_KEY instead of an OpenAI one. This is the only
 * client this app needs: OpenRouter fronts every model below (and hundreds
 * more) behind one key, which is the whole reason this app moved off a
 * single provider's own SDK — see README.md "Model choice" for the
 * reasoning behind each default below.
 */
let client: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it in your Vercel project's Environment " +
          "Variables (or .env.local for local dev) — see README.md.",
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        // OpenRouter asks for these so usage shows up correctly on
        // openrouter.ai/activity and in their rate-limit accounting — not
        // required, but free to set and worth having.
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://github.com",
        "X-Title": "Capital Sourcing Platform",
      },
    });
  }
  return client;
}

/**
 * One open-weight model per agent, each independently overridable — see
 * README.md for the live-pricing comparison this selection was based on
 * (checked against openrouter.ai/api/v1/models, not memorized pricing,
 * since it changes constantly). All three support OpenRouter's
 * `structured_outputs` (strict JSON schema mode, see src/lib/json-schema.ts)
 * and `tools`.
 *
 * - EXTRACTION: the highest-stakes task (filling a complex nested schema
 *   accurately from real, sometimes bilingual, sometimes OCR'd contracts) —
 *   defaults to a model with a large context window and strong general
 *   reasoning rather than the single cheapest option.
 * - RESEARCH: needs to synthesize several search results into one
 *   structured record — defaults to a strong, still-cheap reasoning model.
 * - BENCHMARK: low-volume (one call per on-demand "benchmark this deal"
 *   click), so this default leans toward writing quality over squeezing
 *   out the last fraction of a cent.
 */
export const EXTRACTION_MODEL = process.env.OPENROUTER_EXTRACTION_MODEL ?? "deepseek/deepseek-v4-flash";
export const RESEARCH_MODEL = process.env.OPENROUTER_RESEARCH_MODEL ?? "qwen/qwen3-235b-a22b-2507";
export const BENCHMARK_MODEL = process.env.OPENROUTER_BENCHMARK_MODEL ?? "openai/gpt-oss-120b";

/**
 * OpenRouter's universal PDF-parsing plugin — works even for text-only
 * models with no native file/vision support (which is the point: none of
 * the open-weight defaults above have native PDF reading the way Claude or
 * Gemini do). `mistral-ocr` costs $2/1,000 pages but handles scanned pages,
 * stamps, and tables far better than the free `cloudflare-ai` engine — the
 * real documents this system processes (bilingual contracts with stamps
 * and handwritten signatures) are exactly the case that matters here, and
 * the cost is trivial (a 10-page contract costs $0.02). Set
 * OPENROUTER_PDF_ENGINE=cloudflare-ai to use the free engine instead.
 */
export function pdfParserPlugin() {
  return [
    {
      id: "file-parser",
      pdf: { engine: process.env.OPENROUTER_PDF_ENGINE ?? "mistral-ocr" },
    },
  ] as const;
}

/**
 * OpenRouter's web-search plugin — works with any model (falls back to
 * Exa as the search engine for models without native search, i.e. every
 * open-weight model). Equivalent to appending `:online` to the model slug;
 * spelled out here so `max_results` is explicit and easy to tune.
 */
export function webSearchPlugin(maxResults = 6) {
  return [{ id: "web", max_results: maxResults }] as const;
}
