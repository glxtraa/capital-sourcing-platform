"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { isBlockingRiskFlag } from "@/dsl/provenance";

export interface RiskFlagItem {
  id: string;
  category: string;
  severity: number;
  description: string;
  resolved?: boolean | null;
  resolvedAt?: Date | string | null;
  verificationStatus?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: Date | string | null;
  verificationNotes?: string | null;
  sourceFileName?: string | null;
  evidenceSnippet?: string | null;
}

export interface RiskFlagVerificationCardProps {
  dealId: string;
  assetClass: "INVOICE" | "TRADE" | "VC";
  flag: RiskFlagItem;
  provenanceFiles?: string[];
}

export function RiskFlagVerificationCard({
  dealId,
  assetClass,
  flag,
  provenanceFiles = [],
}: RiskFlagVerificationCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(flag.verificationStatus || "UNVERIFIED");
  const [notes, setNotes] = useState<string>(flag.verificationNotes || "");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const apiBase =
    assetClass === "INVOICE"
      ? `/api/deals/${dealId}/risk-flags/${flag.id}`
      : assetClass === "TRADE"
      ? `/api/trade-deals/${dealId}/risk-flags/${flag.id}`
      : `/api/vc-deals/${dealId}/risk-flags/${flag.id}`;

  const isBlocking = isBlockingRiskFlag({
    ...flag,
    verificationStatus: status,
  });

  const isSecurityFlag =
    flag.category === "PROMPT_INJECTION_SUSPECTED" ||
    flag.category === "TAINTED_CLAIM_CONFLICT" ||
    flag.category === "UNANCHORED_EXTRACTION";

  async function updateVerification(
    nextStatus: "HUMAN_VERIFIED_SAFE" | "WAIVED_WITH_NOTES" | "HUMAN_CONFIRMED_RISK" | "UNVERIFIED",
  ) {
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationStatus: nextStatus,
          verificationNotes: notes.trim() || null,
          verifiedBy: "Human Operator",
        }),
      });
      if (res.ok) {
        setStatus(nextStatus);
        setShowNoteInput(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const allSourceFiles = Array.from(
    new Set([
      ...(flag.sourceFileName ? [flag.sourceFileName] : []),
      ...provenanceFiles,
    ]),
  );

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isBlocking
          ? "border-[#ff6b4a]/60 bg-red-50/40 dark:border-red-900/70 dark:bg-red-950/20"
          : status === "HUMAN_VERIFIED_SAFE" || status === "WAIVED_WITH_NOTES"
          ? "border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {isSecurityFlag ? (
            <ShieldAlert className="h-4 w-4 text-[#ff6b4a] shrink-0" />
          ) : (
            <AlertTriangle
              className={`h-4 w-4 shrink-0 ${
                flag.severity >= 4 ? "text-red-600" : "text-amber-500"
              }`}
            />
          )}
          <Badge
            tone={
              flag.severity >= 4 || isSecurityFlag
                ? "red"
                : flag.severity >= 3
                ? "amber"
                : "neutral"
            }
          >
            Severity {flag.severity}/5
          </Badge>
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
            {flag.category.replaceAll("_", " ")}
          </span>

          {/* Verification Status Badge */}
          {status === "HUMAN_VERIFIED_SAFE" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              <ShieldCheck className="h-3 w-3" />
              HUMAN VERIFIED SAFE
            </span>
          )}
          {status === "WAIVED_WITH_NOTES" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
              <CheckCircle2 className="h-3 w-3" />
              WAIVED WITH NOTES
            </span>
          )}
          {status === "HUMAN_CONFIRMED_RISK" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-200 px-2.5 py-0.5 text-[10px] font-bold text-red-900 dark:bg-red-900 dark:text-red-100">
              <XCircle className="h-3 w-3" />
              CONFIRMED BLOCKER
            </span>
          )}
          {isBlocking && status === "UNVERIFIED" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6b4a] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
              BLOCKS MATCHING — HUMAN VERIFY REQUIRED
            </span>
          )}
        </div>

        {/* Human Verification Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => updateVerification("HUMAN_VERIFIED_SAFE")}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              status === "HUMAN_VERIFIED_SAFE"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-neutral-900 dark:text-emerald-300"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verify Safe
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => setShowNoteInput(!showNoteInput)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              status === "WAIVED_WITH_NOTES"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Waive with Note
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => updateVerification("HUMAN_CONFIRMED_RISK")}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              status === "HUMAN_CONFIRMED_RISK"
                ? "border-red-600 bg-red-600 text-white"
                : "border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-neutral-900 dark:text-red-400"
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            Confirm Blocker
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
        {flag.description}
      </p>

      {/* Evidence Snippet & Provenance Pointer */}
      {(flag.evidenceSnippet || allSourceFiles.length > 0) && (
        <div className="mt-2.5 rounded-lg border border-neutral-200/80 bg-white/80 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-950/50 space-y-1.5">
          {allSourceFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
              <FileText className="h-3.5 w-3.5 text-neutral-400" />
              <span className="font-semibold">Provenance Source:</span>
              {allSourceFiles.map((f) => (
                <span
                  key={f}
                  className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
          {flag.evidenceSnippet && (
            <div className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 bg-amber-50/60 dark:bg-amber-950/30 border-l-2 border-[#ff6b4a] pl-2.5 py-1">
              &ldquo;{flag.evidenceSnippet}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Existing Verification Note */}
      {flag.verificationNotes && !showNoteInput && (
        <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 italic">
          <span className="font-semibold not-italic">Reviewer Note:</span> {flag.verificationNotes}
        </div>
      )}

      {/* Expandable Waive Note Input */}
      {showNoteInput && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <input
            type="text"
            placeholder="Enter audit rationale for waiving or overriding this flag..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
          />
          <Button
            size="sm"
            disabled={saving}
            onClick={() => updateVerification("WAIVED_WITH_NOTES")}
            className="text-xs"
          >
            Save Waiver &amp; Unlock
          </Button>
        </div>
      )}
    </div>
  );
}
