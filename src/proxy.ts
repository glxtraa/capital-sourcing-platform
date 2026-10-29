import { NextResponse, type NextRequest } from "next/server";
import {
  SITE_AUTH_COOKIE,
  OTP_SESSION_COOKIE,
  expectedCookieValue,
  verifySessionCookie,
  isAuthGateEnabled,
} from "@/lib/site-auth";

/**
 * Runs on every request except the ones excluded by `config.matcher` below.
 * Protects the workspace with:
 * 1. 6-digit Google Chat Webhook OTP session (OTP_SESSION_COOKIE)
 * 2. Master site password (SITE_AUTH_COOKIE)
 *
 * If the gate is not enabled (no webhook or password configured and not on Vercel),
 * it allows immediate pass-through.
 */
export async function proxy(request: NextRequest) {
  // If no auth mechanism is configured and not running in production, allow open development access
  if (!isAuthGateEnabled()) {
    return NextResponse.next();
  }

  // 1. Check valid OTP session cookie (12-hour encrypted session)
  const otpSessionCookie = request.cookies.get(OTP_SESSION_COOKIE)?.value;
  if (otpSessionCookie && (await verifySessionCookie(otpSessionCookie))) {
    return NextResponse.next();
  }

  // 2. Check valid static password cookie (30-day SHA-256 cookie)
  const expectedPasswordCookie = await expectedCookieValue();
  if (expectedPasswordCookie) {
    const siteAuthCookie = request.cookies.get(SITE_AUTH_COOKIE)?.value;
    if (siteAuthCookie === expectedPasswordCookie) {
      return NextResponse.next();
    }
  }

  // Unauthenticated: reject API requests or redirect browser to /login
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
     * - /api/auth: OTP status, request, verify, and logout endpoints.
     * - /api/site-auth: the password login check endpoint.
     * - /api/cron: Vercel Cron calls, authenticated by CRON_SECRET.
     * - /login: the login entry page itself.
     * - Next.js internals and common static assets.
     */
    "/((?!api/auth|api/site-auth|api/cron|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
