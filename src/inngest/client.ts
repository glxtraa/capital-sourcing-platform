import { EventSchemas, Inngest } from "inngest";

/**
 * Why Inngest (or an equivalent durable-workflow runner like Trigger.dev)
 * instead of a plain API route: the feedback loop this app needs —
 * extract -> match -> "not enough providers, go research" -> re-match —
 * can take minutes (multiple web searches per new provider) and needs to
 * retry/resume individual steps without re-running the whole thing. A
 * single Vercel serverless function has a hard execution timeout and no
 * built-in step memoization; Inngest gives both, and its functions still
 * deploy as ordinary Vercel serverless functions (see src/app/api/inngest/route.ts).
 */

type Events = {
  "deal/documents.uploaded": { data: { dealId: string } };
  "deal/extraction.completed": { data: { dealId: string; readyForMatching: boolean } };
  "deal/matching.requested": { data: { dealId: string; researchAttempt?: number } };
  "provider/research.requested": {
    data: {
      dealId: string;
      hint: string;
      context: string;
      researchAttempt: number;
    };
  };
};

export const inngest = new Inngest({
  id: "capital-sourcing-platform",
  schemas: new EventSchemas().fromRecord<Events>(),
});

/** Cap on how many research->rematch cycles one deal can trigger
 * automatically before it's kicked back to a human — prevents a
 * pathological deal (e.g. a jurisdiction/structure combination that
 * genuinely has no providers) from looping forever. */
export const MAX_AUTO_RESEARCH_ATTEMPTS = 3;
