import { NextResponse, type NextRequest } from "next/server";

/**
 * Same-origin proxy for point+radius ADS-B queries. The upstream aggregators
 * don't send CORS headers (and meter direct browser calls hard), so the
 * browser polls this route instead.
 *
 * Responses carry s-maxage=8 and the client rounds its query params, so on
 * Vercel the CDN answers most polls and each area costs roughly one upstream
 * request per cache window regardless of visitor count.
 */
const UPSTREAMS = [
  (lat: number, lon: number, dist: number) =>
    `https://api.adsb.lol/v2/point/${lat}/${lon}/${dist}`,
  (lat: number, lon: number, dist: number) =>
    `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
];

const CACHE_TTL_MS = 8_000;
const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_CACHE_ENTRIES = 200;

const cache = new Map<string, { at: number; body: string }>();

export async function GET(req: NextRequest): Promise<NextResponse> {
  const lat = clamp(Number(req.nextUrl.searchParams.get("lat")), -90, 90);
  const lon = clamp(Number(req.nextUrl.searchParams.get("lon")), -180, 180);
  const dist = clamp(Number(req.nextUrl.searchParams.get("dist")), 25, 250);
  if (lat === null || lon === null || dist === null) {
    return NextResponse.json(
      { error: "lat, lon and dist query params are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = `${lat},${lon},${dist}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return jsonResponse(hit.body);
  }

  for (const upstream of UPSTREAMS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(upstream(lat, lon, dist), {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const body = await res.text();
      if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
      cache.set(key, { at: Date.now(), body });
      return jsonResponse(body);
    } catch {
      // fall through to the next upstream
    } finally {
      clearTimeout(timeout);
    }
  }

  // Serve slightly stale data over an error if we have any.
  if (hit) return jsonResponse(hit.body);
  return NextResponse.json(
    { error: "ADS-B upstreams are unreachable" },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

function clamp(n: number, min: number, max: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
}

function jsonResponse(body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=8, stale-while-revalidate=30",
    },
  });
}
