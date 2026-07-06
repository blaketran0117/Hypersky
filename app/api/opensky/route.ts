import { NextResponse } from "next/server";

/**
 * Proxy for OpenSky /states/all — the API doesn't send CORS headers for
 * third-party origins, so the browser can't call it directly.
 *
 * Responses carry s-maxage=8, so on Vercel the CDN answers most polls and the
 * whole deployment makes at most ~one upstream request per cache window,
 * regardless of visitor count. A module-level cache covers the local/dev case.
 */
const UPSTREAM = "https://opensky-network.org/api/states/all";
const CACHE_TTL_MS = 8_000;
const UPSTREAM_TIMEOUT_MS = 15_000;

let cached: { at: number; body: string } | null = null;

export async function GET(): Promise<NextResponse> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return jsonResponse(cached.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(UPSTREAM, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = await res.text();
    cached = { at: Date.now(), body };
    return jsonResponse(body);
  } catch {
    // Serve slightly stale data over an error page if we have any.
    if (cached) return jsonResponse(cached.body);
    return NextResponse.json(
      { error: "OpenSky is unreachable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function jsonResponse(body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=8, stale-while-revalidate=30",
    },
  });
}
