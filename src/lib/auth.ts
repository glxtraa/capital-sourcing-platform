/**
 * STUB — replace before any real deployment with confidential deal data.
 *
 * This scaffold intentionally ships without a wired auth provider so the
 * rest of the pipeline (extraction, matching, the feedback loop) can be
 * built and tested end-to-end without also standing up an identity system
 * first. Every API route below scopes data by `orgId`, so swapping this
 * stub for a real provider is a one-function change, not a schema change.
 *
 * Recommended real implementation: Clerk or Auth.js (NextAuth), both of
 * which deploy cleanly on Vercel. Whichever you pick, replace this
 * function's body with a call to that provider's session/JWT reader, and
 * make sure it throws (not defaults) when there's no authenticated session.
 */
export async function getCurrentOrgId(): Promise<string> {
  return process.env.DEMO_ORG_ID ?? "demo-org";
}
