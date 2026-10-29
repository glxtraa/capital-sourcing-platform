import { NextResponse, type NextRequest } from "next/server";
import { requestGoogleChatOtp, OTP_CHALLENGE_COOKIE, OTP_EXPIRY_MS } from "@/lib/site-auth";

export async function POST(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "unknown";

  const result = await requestGoogleChatOtp(clientIp);

  if (!result.ok || !result.signedChallenge) {
    return NextResponse.json(
      { error: result.error || "Failed to generate OTP challenge." },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    sent: true,
    expiresInSeconds: result.expiresInSeconds ?? 300,
    isDevFallback: result.isDevFallback ?? false,
  });

  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  response.cookies.set(OTP_CHALLENGE_COOKIE, result.signedChallenge, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(OTP_EXPIRY_MS / 1000), // 300s
  });

  return response;
}
