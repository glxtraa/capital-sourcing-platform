/**
 * Site Authentication & Google Chat OTP Gate
 *
 * Implements a dual protection gate for TRADE3 Capital Sourcing Platform:
 * 1. Primary: 6-digit one-time verification code (OTP) dispatched via incoming Google Chat Webhook.
 * 2. Fallback: Optional shared master password gate (SITE_PASSWORD).
 *
 * Built entirely with standard Web Crypto (`crypto.subtle`) for 100% compatibility across
 * Next.js Edge proxy/middleware, Turbopack, and Node.js server runtimes.
 */

export const SITE_AUTH_COOKIE = "site_auth";
export const OTP_CHALLENGE_COOKIE = "otp_challenge";
export const OTP_SESSION_COOKIE = "otp_session";

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const SESSION_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours

function getAuthSecret(): string {
  return (
    process.env.OTP_SECRET ||
    process.env.SITE_PASSWORD ||
    process.env.DATABASE_URL ||
    "trade3-capital-sourcing-platform-otp-secret-key-2026"
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getAuthSecret()) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signData(plainText: string): Promise<string> {
  const key = await getHmacKey();
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(plainText);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes as unknown as BufferSource);
  return `${toBase64Url(payloadBytes)}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySignedData(signedPayload: string): Promise<{ valid: boolean; data?: string }> {
  if (!signedPayload || typeof signedPayload !== "string") return { valid: false };
  const clean = signedPayload.replace(/^"|"$/g, "").trim();
  const parts = clean.split(".");
  if (parts.length !== 2) return { valid: false };

  try {
    const [payloadB64, sigB64] = parts;
    const payloadBytes = fromBase64Url(payloadB64);
    const sigBytes = fromBase64Url(sigB64);
    const key = await getHmacKey();

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      payloadBytes as unknown as BufferSource,
    );
    if (!valid) return { valid: false };

    const dec = new TextDecoder();
    return { valid: true, data: dec.decode(payloadBytes) };
  } catch {
    return { valid: false };
  }
}

/** Check if Google Chat Webhook URL is set in environment */
export function getGoogleChatWebhookUrl(): string {
  return (process.env.GOOGLE_CHAT_WEBHOOK_URL || "").trim();
}

export function isWebhookConfigured(): boolean {
  return Boolean(getGoogleChatWebhookUrl());
}

/** The gate is active if a webhook is set, a password is set, or if running in production */
export function isAuthGateEnabled(): boolean {
  if (getGoogleChatWebhookUrl() || process.env.SITE_PASSWORD) return true;
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") return true;
  return false;
}

/** Generate a 6-digit random numeric OTP */
function generate6DigitOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

/** Request an OTP to be sent via Google Chat Webhook */
export async function requestGoogleChatOtp(clientIp?: string): Promise<{
  ok: boolean;
  signedChallenge?: string;
  expiresInSeconds?: number;
  isDevFallback?: boolean;
  error?: string;
}> {
  const otpCode = generate6DigitOtp();
  const otpHash = await sha256Hex(otpCode);
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const webhookUrl = getGoogleChatWebhookUrl();
  const safeIp = clientIp || "unknown";

  const isDev = process.env.NODE_ENV !== "production";

  if (webhookUrl) {
    try {
      const chatMessage = {
        text: `🔐 *TRADE3 Capital Sourcing Platform — Login OTP*\n\nYour 6-digit verification code is: *${otpCode}*\n\n• *Expires in:* 5 minutes\n• *Requested IP:* \`${safeIp}\`\n• *Time:* ${new Date().toUTCString()}`,
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(chatMessage),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Google Chat Webhook dispatch failed:", res.status, errText);
        return {
          ok: false,
          error: `Google Chat webhook rejected notification (HTTP ${res.status}). Verify your GOOGLE_CHAT_WEBHOOK_URL in environment settings.`,
        };
      }
    } catch (err: any) {
      console.error("Failed to reach Google Chat webhook:", err);
      return {
        ok: false,
        error: `Network error reaching Google Chat: ${err?.message || "Unknown error"}`,
      };
    }
  } else {
    // If webhook is not configured:
    if (isDev) {
      console.log(`\n========================================================`);
      console.log(`🔐 [LOCAL DEV OTP GATE] Verification Code: ${otpCode}`);
      console.log(`• Expires in: 5 minutes (${new Date(expiresAt).toLocaleTimeString()})`);
      console.log(`• Configure GOOGLE_CHAT_WEBHOOK_URL in .env.local to receive via Google Chat`);
      console.log(`========================================================\n`);
    } else {
      return {
        ok: false,
        error: "GOOGLE_CHAT_WEBHOOK_URL is not configured in Vercel environment variables.",
      };
    }
  }

  const challengePayload = JSON.stringify({ otpHash, expiresAt });
  const signedChallenge = await signData(challengePayload);

  return {
    ok: true,
    signedChallenge,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    isDevFallback: !webhookUrl,
  };
}

/** Verify user-submitted 6-digit OTP against the signed challenge token */
export async function verifyGoogleChatOtp(
  code: string,
  signedChallenge: string,
): Promise<{
  ok: boolean;
  sessionToken?: string;
  error?: string;
}> {
  const cleanCode = String(code || "").trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "Please enter a valid 6-digit numeric verification code." };
  }

  const verified = await verifySignedData(signedChallenge);
  if (!verified.valid || !verified.data) {
    return { ok: false, error: "Verification challenge expired or invalid. Please request a new code." };
  }

  let challengeData: { otpHash: string; expiresAt: number };
  try {
    challengeData = JSON.parse(verified.data);
  } catch {
    return { ok: false, error: "Malformed verification challenge. Please request a new code." };
  }

  if (!challengeData.expiresAt || Date.now() > challengeData.expiresAt) {
    return { ok: false, error: "Verification code has expired. Please request a new code." };
  }

  const inputHash = await sha256Hex(cleanCode);
  if (inputHash !== challengeData.otpHash) {
    return { ok: false, error: "Incorrect verification code. Please check Google Chat and try again." };
  }

  // Valid OTP! Issue signed session token
  const sessionPayload = JSON.stringify({
    authenticated: true,
    authMethod: "GOOGLE_CHAT_OTP",
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
  });

  const sessionToken = await signData(sessionPayload);
  return { ok: true, sessionToken };
}

/** Verify whether an existing session cookie is valid and not expired */
export async function verifySessionCookie(cookieValue?: string): Promise<boolean> {
  if (!cookieValue) return false;
  const clean = cookieValue.replace(/^"|"$/g, "").trim();
  let verified = await verifySignedData(clean);
  if (!verified.valid && clean.includes("%")) {
    try {
      verified = await verifySignedData(decodeURIComponent(clean));
    } catch {}
  }
  if (!verified.valid || !verified.data) return false;

  try {
    const session = JSON.parse(verified.data);
    return Boolean(session?.authenticated && session?.expiresAt && Date.now() < session.expiresAt);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Backwards-compatible password gate helpers (SITE_PASSWORD)
// -----------------------------------------------------------------------------

export async function expectedCookieValue(): Promise<string | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;
  return sha256Hex(password);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return false;
  return candidate === password;
}

/** Create a signed session token for password-based login */
export async function createPasswordSessionToken(): Promise<string> {
  const sessionPayload = JSON.stringify({
    authenticated: true,
    authMethod: "SITE_PASSWORD",
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
  });
  return signData(sessionPayload);
}
