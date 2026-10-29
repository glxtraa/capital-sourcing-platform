import { NextResponse } from "next/server";
import {
  OTP_SESSION_COOKIE,
  OTP_CHALLENGE_COOKIE,
  SITE_AUTH_COOKIE,
} from "@/lib/site-auth";

export async function POST() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const response = NextResponse.json({ ok: true, loggedOut: true });

  const clearCookieOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  response.cookies.set(OTP_SESSION_COOKIE, "", clearCookieOpts);
  response.cookies.set(OTP_CHALLENGE_COOKIE, "", clearCookieOpts);
  response.cookies.set(SITE_AUTH_COOKIE, "", clearCookieOpts);

  return response;
}
