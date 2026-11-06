import { NextResponse } from "next/server";
import { listAgentTrials } from "@/lib/agent-trial-tracker";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId") ?? undefined;
  const runId = searchParams.get("runId") ?? undefined;
  const assetClass = searchParams.get("assetClass") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const limitStr = searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 50;

  try {
    const trials = await listAgentTrials({ dealId, runId, assetClass, status, limit });
    return NextResponse.json({ trials });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
