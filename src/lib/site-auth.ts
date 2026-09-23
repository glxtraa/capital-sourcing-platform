/**
 * A deliberately simple, app-wide password gate — not a real auth system
 * (that's `src/lib/auth.ts`'s job, still stubbed to a single `demo-org`).
 * The goal here is narrower: this app is deployed publicly on Vercel and
 * every request that reaches a real page or API route can trigger paid
 * OpenRouter calls and Blob storage writes. One shared password behind a
 * cookie is enough to stop a stranger from
 * finding the URL and burning through your API budget; it is NOT enough
 * to protect genuinely confidential deal documents from a determined
 * attacker — see auth.ts's own comment for what that would take.
 *
 * Uses Web Crypto (`crypto.subtle`) rather than Node's `crypto` module so
 * the same hashing logic works in both the Edge middleware runtime and
 * ordinary Node.js API routes.
 */

export const SITE_AUTH_COOKIE = "site_auth";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The value the cookie should hold if the visitor supplied the right password. */
export async function expectedCookieValue(): Promise<string | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null; // gate is off if no password is configured
  return sha256Hex(password);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return false;
  return candidate === password;
}
