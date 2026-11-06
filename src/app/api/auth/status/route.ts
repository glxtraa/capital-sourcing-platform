import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthGateEnabled,
  isWebhookConfigured,
  verifySessionCookie,
  OTP_SESSION_COOKIE,
  SITE_AUTH_COOKIE,
  expectedCookieValue,
} from "@/lib/site-auth";

export async function GET(req: NextRequest) {
  const otpCookie = req.cookies.get(OTP_SESSION_COOKIE)?.value;
  let isAuthenticated = await verifySessionCookie(otpCookie);

  if (!isAuthenticated) {
    const passwordCookie = req.cookies.get(SITE_AUTH_COOKIE)?.value;
    const expected = await expectedCookieValue();
    if (passwordCookie && expected && passwordCookie === expected) {
      isAuthenticated = true;
    }
  }

  return NextResponse.json({
    authenticated: isAuthenticated,
    otpRequired: isAuthGateEnabled(),
    webhookConfigured: isWebhookConfigured(),
    passwordConfigured: Boolean(process.env.SITE_PASSWORD),
  });
}
