"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DealStatus } from "@prisma/client";

const IN_PROGRESS: DealStatus[] = ["UPLOADING", "EXTRACTING", "MATCHING", "RESEARCHING"];

/**
 * While a deal is mid-pipeline (extraction/matching/research running as
 * Inngest steps server-side), poll for status changes and refresh the
 * server-rendered page — cheap and reliable, and avoids standing up a
 * websocket/SSE channel just for this prototype's UX.
 */
export function DealStatusPoller({ dealId, status }: { dealId: string; status: DealStatus }) {
  const router = useRouter();

  useEffect(() => {
    if (!IN_PROGRESS.includes(status)) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [dealId, status, router]);

  return null;
}
