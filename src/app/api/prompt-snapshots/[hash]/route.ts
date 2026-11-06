import { NextResponse, type NextRequest } from "next/server";
import { getPromptSnapshot } from "@/lib/prompt-cache";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await context.params;
    if (!hash) {
      return NextResponse.json({ error: "Missing prompt hash" }, { status: 400 });
    }

    const snapshot = await getPromptSnapshot(hash);
    if (!snapshot) {
      return NextResponse.json(
        { error: `Prompt snapshot not found for hash: ${hash}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
