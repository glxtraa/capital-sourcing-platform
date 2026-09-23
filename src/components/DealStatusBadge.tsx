import { Badge } from "@/components/ui/primitives";
import type { DealStatus } from "@prisma/client";

const STATUS_CONFIG: Record<DealStatus, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" }> = {
  UPLOADING: { label: "Uploading", tone: "neutral" },
  EXTRACTING: { label: "Extracting…", tone: "blue" },
  NEEDS_REVIEW: { label: "Needs review", tone: "amber" },
  READY: { label: "Ready to match", tone: "blue" },
  MATCHING: { label: "Matching…", tone: "blue" },
  RESEARCHING: { label: "Researching new providers…", tone: "amber" },
  COMPLETE: { label: "Complete", tone: "green" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
