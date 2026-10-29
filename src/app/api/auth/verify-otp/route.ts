import { NextResponse, type NextRequest } from "next/server";
import {
  verifyGoogleChatOtp,
  OTP_CHALLENGE_COOKIE,
  OTP_SESSION_COOKIE,
  SITE_AUTH_COOKIE,
  expectedCookieValue,
  SESSION_EXPIRY_MS,
} from "@/lib/site-auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Please enter a valid 6-digit numeric verification code." },
      { status: 400 },
    );
  }

  const challengeCookie = req.cookies.get(OTP_CHALLENGE_COOKIE)?.value;
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  if (!challengeCookie) {
    return NextResponse.json(
      { error: "No active verification challenge found or code expired. Please request a new code." },
      { status: 401 },
    );
  }

  const result = await verifyGoogleChatOtp(code, challengeCookie);

  if (!result.ok || !result.sessionToken) {
    // Invalidate challenge cookie on failure to prevent brute-force attempts
    const failureResponse = NextResponse.json(
      { error: result.error || "Incorrect verification code. Please request a new code." },
      { status: 401 },
    );

    failureResponse.cookies.set(OTP_CHALLENGE_COOKIE, "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return failureResponse;
  }

  // Verification successful! Issue 12-hour session cookie and clear challenge cookie
  const successResponse = NextResponse.json({
    ok: true,
    authenticated: true,
  });

  successResponse.cookies.set(OTP_SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_EXPIRY_MS / 1000), // 12 hours
  });

  const expectedPassword = await expectedCookieValue();
  if (expectedPassword) {
    successResponse.cookies.set(SITE_AUTH_COOKIE, expectedPassword, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_EXPIRY_MS / 1000), // 12 hours
    });
  }

  successResponse.cookies.set(OTP_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return successResponse;
}
