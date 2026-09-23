import { NextResponse, type NextRequest } from "next/server";
import { SITE_AUTH_COOKIE, expectedCookieValue } from "@/lib/site-auth";

/**
 * Runs on every request except the ones excluded by `config.matcher` below.
 * If SITE_PASSWORD isn't set, this is a no-op (see site-auth.ts) — the app
 * stays exactly as open as it was before. If it is set, every page and API
 * route (other than the login flow and Inngest's own callback) requires a
 * cookie matching sha256(SITE_PASSWORD).
 */
export async function middleware(request: NextRequest) {
  const expected = await expectedCookieValue();
  if (!expected) return NextResponse.next(); // no password configured -> gate disabled

  const cookie = request.cookies.get(SITE_AUTH_COOKIE)?.value;
  if (cookie === expected) return NextResponse.next();

  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");
  if (isApiRequest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Everything EXCEPT:
     * - /api/inngest: Inngest's own servers call this directly (already
     *   authenticated via its own signing key, not a browser cookie) --
     *   gating it here would break the extraction/matching/research pipeline.
     * - /api/site-auth: the login-check endpoint itself.
     * - /login: the password entry page itself.
     * - Next.js internals and common static assets.
     */
    "/((?!api/inngest|api/site-auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
