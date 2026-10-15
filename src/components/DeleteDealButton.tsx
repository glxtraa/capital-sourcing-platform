"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface DeleteDealButtonProps {
  dealId: string;
  dealName: string;
  variant?: "danger-zone" | "icon" | "outline";
  redirectOnDelete?: boolean;
  className?: string;
  isTrade?: boolean;
  isVc?: boolean;
}

export function DeleteDealButton({
  dealId,
  dealName,
  variant = "danger-zone",
  redirectOnDelete = true,
  className,
  isTrade = false,
  isVc = false,
}: DeleteDealButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "danger-zone" ? (
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsOpen(true)}
          className={cn("gap-2 text-xs sm:text-sm", className)}
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete this deal</span>
        </Button>
      ) : variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-neutral-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400",
            className,
          )}
          title={`Delete "${dealName}"`}
          aria-label={`Delete "${dealName}"`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className={cn(
            "gap-2 border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30",
            className,
          )}
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete deal</span>
        </Button>
      )}

      {isOpen && (
        <DeleteDealModal
          dealId={dealId}
          dealName={dealName}
          redirectOnDelete={redirectOnDelete}
          isTrade={isTrade}
          isVc={isVc}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

interface DeleteDealModalProps {
  dealId: string;
  dealName: string;
  redirectOnDelete: boolean;
  onClose: () => void;
  isTrade?: boolean;
  isVc?: boolean;
}

export function DeleteDealModal({
  dealId,
  dealName,
  redirectOnDelete,
  onClose,
  isTrade = false,
  isVc = false,
}: DeleteDealModalProps) {
  const router = useRouter();
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Require typing the exact deal name to enable deletion
  const isConfirmed = typedConfirmation.trim() === dealName.trim();

  useEffect(() => {
    // Focus the confirmation input when modal opens
    inputRef.current?.focus();

    // Close on escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onClose]);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      const endpoint = isVc ? `/api/vc-deals/${dealId}` : isTrade ? `/api/trade-deals/${dealId}` : `/api/deals/${dealId}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete deal. Please try again.");
      }

      onClose();

      if (redirectOnDelete) {
        router.push(isVc ? "/vc-deals" : isTrade ? "/trade-deals" : "/deals");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-deal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isDeleting) onClose();
        }}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl dark:border-red-900/60 dark:bg-neutral-900">
        {/* Header Banner */}
        <div className="border-b border-red-100 bg-red-50/70 px-6 py-4 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-deal-title" className="text-base font-semibold text-red-950 dark:text-red-100">
                  Delete deal permanently
                </h3>
                <p className="text-xs text-red-700/90 dark:text-red-300/80">
                  This action cannot be undone
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <p>
              You are about to permanently delete <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">{dealName}</strong>.
            </p>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
              <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                The following data will be permanently removed:
              </p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li>All uploaded documents and private blob storage files</li>
                <li>Extracted parties, financing asks, and risk flags</li>
                <li>Capital provider matches, scoring criteria, and notes</li>
                <li>Research runs and diligence history</li>
                <li>Generated term sheets and benchmark comparisons</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label
              htmlFor="confirm-deal-name"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
              To confirm deletion, please type <span className="font-mono font-semibold text-neutral-900 dark:text-white select-all bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">{dealName}</span> below:
            </label>
            <input
              id="confirm-deal-name"
              ref={inputRef}
              type="text"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              disabled={isDeleting}
              placeholder={dealName}
              autoComplete="off"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-red-500 dark:focus:ring-red-500/20"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isConfirmed || isDeleting}
              className="w-full sm:w-auto gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deleting deal…</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Permanently delete this deal</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
