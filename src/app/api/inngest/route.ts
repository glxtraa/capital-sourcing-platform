import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { extractDeal } from "@/inngest/functions/extract-deal";
import { matchProviders } from "@/inngest/functions/match-providers";
import { researchProviders } from "@/inngest/functions/research-providers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [extractDeal, matchProviders, researchProviders],
});
