"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DealStatus } from "@prisma/client";

const IN_PROGRESS: DealStatus[] = ["UPLOADING", "EXTRACTING", "MATCHING", "RESEARCHING"];

/**
 * While a deal is mid-pipeline, poll for status changes and refresh the
 * server-rendered page — cheap and reliable, and avoids standing up a
 * websocket/SSE channel just for this prototype's UX. Extraction/matching
 * now run synchronously within the request the action button itself
 * fires (see the extract/match routes), so the button's own response
 * already tells that tab when it's done; this poller mainly covers a
 * second tab/session watching the same deal update live in the meantime.
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
