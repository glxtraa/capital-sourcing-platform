import { NextResponse } from "next/server";
import {
  SITE_AUTH_COOKIE,
  OTP_SESSION_COOKIE,
  checkPassword,
  expectedCookieValue,
  createPasswordSessionToken,
} from "@/lib/site-auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  if (!password || !(await checkPassword(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const value = await expectedCookieValue();
  const sessionToken = await createPasswordSessionToken();
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_AUTH_COOKIE, value!, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  response.cookies.set(OTP_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
