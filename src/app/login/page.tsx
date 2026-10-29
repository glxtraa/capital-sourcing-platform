"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  MessageSquare,
  Lock,
  KeyRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { APP_VERSION } from "@/lib/version";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const decodedNext = rawNext ? decodeURIComponent(rawNext) : null;
  const targetUrl =
    !decodedNext || decodedNext === "/" || decodedNext === "/login" || decodedNext.startsWith("/login?")
      ? "/deals"
      : decodedNext;

  // Auth gate status
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [isOtpGateActive, setIsOtpGateActive] = useState(true);

  // OTP flow state
  const [hasRequestedOtp, setHasRequestedOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isDevFallbackNotice, setIsDevFallbackNotice] = useState(false);

  // Master password fallback state
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{
    type: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial auth status check
  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await fetch("/api/auth/status");
        if (!res.ok) throw new Error("Status check failed");
        const data = await res.json();

        if (!isMounted) return;

        if (data.authenticated) {
          window.location.replace(targetUrl);
          return;
        }

        setWebhookConfigured(Boolean(data.webhookConfigured));
        setPasswordConfigured(Boolean(data.passwordConfigured));
        setIsOtpGateActive(Boolean(data.otpRequired));

        // If no webhook is configured, automatically open the password fallback accordion
        if (!data.webhookConfigured && data.passwordConfigured) {
          setShowPasswordFallback(true);
        }
      } catch (err) {
        console.warn("Unable to check auth status:", err);
      } finally {
        if (isMounted) setCheckingAuth(false);
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [targetUrl]);

  // 2. Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 3. Request 6-digit OTP code to Google Chat
  const handleRequestOtp = useCallback(async () => {
    setStatusMsg(null);
    setIsRequestingOtp(true);
    setIsDevFallbackNotice(false);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatusMsg({
          type: "error",
          text: data.error || "Failed to dispatch verification code to Google Chat.",
        });
        setIsRequestingOtp(false);
        return;
      }

      setHasRequestedOtp(true);
      setCountdown(60); // 60s cooldown before resend
      if (data.isDevFallback) {
        setIsDevFallbackNotice(true);
        setStatusMsg({
          type: "info",
          text: "Local development mode: 6-digit verification code was printed to your server terminal console.",
        });
      } else {
        setStatusMsg({
          type: "success",
          text: "6-digit verification code sent to your Google Chat space. Enter it below (expires in 5 minutes).",
        });
      }

      // Auto-focus input
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    } catch {
      setStatusMsg({
        type: "error",
        text: "Network error reaching server. Please check your connection and try again.",
      });
    } finally {
      setIsRequestingOtp(false);
    }
  }, []);

  // 4. Verify 6-digit OTP code
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setStatusMsg({
        type: "error",
        text: "Please enter the complete 6-digit numeric verification code.",
      });
      otpInputRef.current?.focus();
      return;
    }

    setStatusMsg(null);
    setIsVerifyingOtp(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatusMsg({
          type: "error",
          text: data.error || "Incorrect verification code. Please request a new code in Google Chat.",
        });
        setOtpCode("");
        setIsVerifyingOtp(false);
        otpInputRef.current?.focus();
        return;
      }

      setStatusMsg({
        type: "success",
        text: "Authentication verified! Unlocking Trade3 Capital Sourcing Platform…",
      });

      // Perform immediate hard window location navigation so browser applies fresh session cookies on full HTTP request
      setTimeout(() => {
        window.location.replace(targetUrl);
      }, 100);
    } catch {
      setStatusMsg({
        type: "error",
        text: "Verification failed due to a network error. Please try again.",
      });
      setIsVerifyingOtp(false);
    }
  };

  // 5. Submit master password fallback
  const handleMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    setStatusMsg(null);
    setIsPasswordSubmitting(true);

    try {
      const res = await fetch("/api/site-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: masterPassword }),
      });

      if (!res.ok) {
        setStatusMsg({
          type: "error",
          text: "Incorrect master password.",
        });
        setIsPasswordSubmitting(false);
        return;
      }

      setStatusMsg({
        type: "success",
        text: "Master password verified! Redirecting to platform…",
      });

      setTimeout(() => {
        window.location.replace(targetUrl);
      }, 100);
    } catch {
      setStatusMsg({
        type: "error",
        text: "Something went wrong verifying the master password.",
      });
      setIsPasswordSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-neutral-500">
          <RefreshCw className="h-6 w-6 animate-spin text-[#ff6b4a]" />
          <p className="text-xs font-medium">Checking workspace authentication…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center p-4">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 group mb-1.5">
          <span className="text-2xl font-black tracking-wider text-[#1a1f3a] dark:text-white">
            TRADE<span className="text-[#ff6b4a]">3</span>
          </span>
          <span className="text-xs uppercase font-bold tracking-widest text-neutral-400 border-l border-neutral-300 dark:border-neutral-700 pl-2">
            Capital Sourcing
          </span>
          <span className="rounded-full bg-[#1a1f3a] px-2 py-0.5 font-mono text-[10px] font-bold text-[#10b981] border border-[#10b981]/30">
            {APP_VERSION}
          </span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Enterprise Deal Sourcing &amp; Autonomous Japanese Agent Platform
        </p>
      </div>

      <Card className="w-full max-w-md border-neutral-200/90 dark:border-[#2a3052] bg-white dark:bg-[#151829] shadow-xl overflow-hidden">
        {/* Card Header with Gate Status */}
        <CardHeader className="bg-neutral-50/70 dark:bg-[#1a1f3a]/50 border-b border-neutral-200/80 dark:border-[#2a3052] pb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#ff6b4a]/10 dark:bg-[#ff6b4a]/20 p-2.5 text-[#ff6b4a] border border-[#ff6b4a]/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-[#1a1f3a] dark:text-white">
                  Protected Workspace
                </CardTitle>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Google Chat OTP
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Two-factor verification delivered to your team space
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          {/* Explanation Text */}
          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
            To safeguard proprietary pipeline data, LLM credits, and Japanese agent operations,
            request a 6-digit one-time code sent directly to your configured <strong>Google Chat</strong> space.
          </p>

          {/* Webhook Not Configured Warning */}
          {!webhookConfigured && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Google Chat Webhook Not Configured</p>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  Add <code className="font-mono bg-amber-200/50 dark:bg-slate-800 px-1 py-0.5 rounded">GOOGLE_CHAT_WEBHOOK_URL</code> to
                  your Vercel or <code className="font-mono bg-amber-200/50 dark:bg-slate-800 px-1 py-0.5 rounded">.env.local</code> settings.
                  In local dev, generated codes are logged directly to your terminal.
                </p>
              </div>
            </div>
          )}

          {/* Status Message Banner */}
          {statusMsg && (
            <div
              className={`rounded-xl p-3 text-xs flex items-start gap-2.5 transition-all animate-in fade-in duration-150 ${
                statusMsg.type === "error"
                  ? "bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300"
                  : statusMsg.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : statusMsg.type === "warning"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300"
                  : "bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300"
              }`}
            >
              {statusMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />}
              {statusMsg.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />}
              <div className="flex-1 space-y-1">
                <span className="leading-relaxed">{statusMsg.text}</span>
                {statusMsg.type === "success" && (
                  <button
                    type="button"
                    onClick={() => window.location.replace(targetUrl)}
                    className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 underline hover:no-underline cursor-pointer pt-0.5"
                  >
                    Click here to enter immediately &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Dev Terminal Notice Card */}
          {isDevFallbackNotice && (
            <div className="rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] border border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Terminal className="h-3.5 w-3.5" />
                <span>Local Terminal Dev Mode Active</span>
              </div>
              <p className="text-slate-400 text-[10px]">
                Check your server console terminal for:
                <br />
                <span className="text-slate-200 font-semibold">🔐 [LOCAL DEV OTP GATE] Verification Code: XXXXXX</span>
              </p>
            </div>
          )}

          {/* Step 1: Request OTP CTA */}
          <div className="space-y-3">
            {!hasRequestedOtp ? (
              <Button
                type="button"
                onClick={handleRequestOtp}
                disabled={isRequestingOtp}
                variant="coral"
                className="w-full py-2.5 font-semibold text-xs gap-2"
              >
                {isRequestingOtp ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Dispatching OTP to Google Chat…</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    <span>Send 6-Digit OTP to Google Chat</span>
                  </>
                )}
              </Button>
            ) : (
              /* Step 2: Verification Input Form */
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="otp-code-input"
                      className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300"
                    >
                      Enter 6-Digit Verification Code
                    </label>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      <Clock className="h-3 w-3 text-neutral-400" />
                      Expires in 5m
                    </span>
                  </div>

                  <input
                    ref={otpInputRef}
                    id="otp-code-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="\d{6}"
                    placeholder="000000"
                    autoComplete="one-time-code"
                    value={otpCode}
                    onChange={(e) => {
                      const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtpCode(numericOnly);
                    }}
                    className="w-full rounded-xl border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-4 py-2.5 text-center font-mono text-2xl font-bold tracking-[0.45em] text-neutral-900 dark:text-white outline-none transition-colors focus:border-[#ff6b4a] focus:bg-white dark:focus:bg-neutral-950 placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={isVerifyingOtp || otpCode.length !== 6}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Verify &amp; Unlock Platform</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={countdown > 0 || isRequestingOtp}
                    onClick={handleRequestOtp}
                    className="py-2.5 text-xs whitespace-nowrap"
                    title={countdown > 0 ? `Wait ${countdown}s before resending` : "Request a fresh code"}
                  >
                    {countdown > 0 ? (
                      <span className="font-mono text-[11px]">{countdown}s</span>
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Master Password Accordion Fallback */}
          {(passwordConfigured || !webhookConfigured) && (
            <div className="pt-3 border-t border-neutral-200/70 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowPasswordFallback(!showPasswordFallback)}
                className="w-full flex items-center justify-between text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Or unlock using master site password</span>
                </span>
                {showPasswordFallback ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showPasswordFallback && (
                <form
                  onSubmit={handleMasterPassword}
                  className="mt-2.5 space-y-2 animate-in fade-in duration-150"
                >
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      placeholder="Enter master password"
                      className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-900 dark:text-white outline-none focus:border-[#1a1f3a] dark:focus:border-[#ff6b4a]"
                    />
                    <Button
                      type="submit"
                      disabled={isPasswordSubmitting || !masterPassword}
                      variant="navy"
                      size="sm"
                      className="text-xs px-3"
                    >
                      {isPasswordSubmitting ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Footnote */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
        <Lock className="h-3 w-3" />
        <span>HMAC-SHA256 encrypted challenge token • 12-hour session cookie</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[75vh] items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-[#ff6b4a]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
