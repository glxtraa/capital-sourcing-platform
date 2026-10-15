import { NextResponse } from "next/server";
import { getCachedPage, cachePageCited } from "@/lib/page-cache";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const url = searchParams.get("url");
  const refresh = searchParams.get("refresh") === "true";

  if (!id && !url) {
    return NextResponse.json(
      { error: "Provide either an 'id' or 'url' query parameter." },
      { status: 400 }
    );
  }

  try {
    if (refresh && url) {
      const refreshed = await cachePageCited(url, { forceRefresh: true, timeoutMs: 8000 });
      if (!refreshed) {
        return NextResponse.json({ error: `Could not fetch and cache page for ${url}` }, { status: 502 });
      }
      return NextResponse.json(refreshed);
    }

    let cached = await getCachedPage({ id: id ?? undefined, url: url ?? undefined });

    // If not cached yet and url was provided, fetch and cache on-demand
    if (!cached && url) {
      cached = await cachePageCited(url, { timeoutMs: 8000 });
    }

    if (!cached) {
      return NextResponse.json(
        { error: "Cached page snapshot not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(cached);
  } catch (err: any) {
    console.error("Error in /api/research/cache:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve cached page." },
      { status: 500 }
    );
  }
}
