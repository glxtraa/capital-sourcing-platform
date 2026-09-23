import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { extractDeal } from "@/inngest/functions/extract-deal";
import { matchProviders } from "@/inngest/functions/match-providers";
import { researchProviders } from "@/inngest/functions/research-providers";
import { resolveInngestSigningKey } from "@/lib/env";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [extractDeal, matchProviders, researchProviders],
  // Explicit rather than relying on the SDK's own INNGEST_SIGNING_KEY
  // auto-read — see src/lib/env.ts.
  signingKey: resolveInngestSigningKey(),
});
