import { displayedPosition, type LonLat } from "./interpolate";
import { countryFromIcao24 } from "./country";
import type { AircraftState } from "./types";

/**
 * Live ADS-B data via the same-origin proxy (app/api/adsb), which fans a
 * CDN-cached query out to community aggregators. Queries are point+radius
 * (max 250 nm), so the feed follows the map viewport rather than snapshotting
 * the whole planet.
 *
 * Query params are rounded (centre to 0.25°, radius to 25 nm) so nearby
 * visitors share the same CDN cache entry instead of each paying an upstream
 * request.
 */
const API_BASE = "/api/adsb";

export const POLL_INTERVAL_MS = 10_000;
/** Minimum spacing between fetches, across remounts and move-triggered pokes. */
const MIN_FETCH_SPACING_MS = 1_500;
const MAX_RADIUS_NM = 250;
const FETCH_TIMEOUT_MS = 15_000;
const BACKOFF_START_MS = 15_000;
const BACKOFF_MAX_MS = 120_000;

/** Last fetch attempt across all poller instances (dev remounts included). */
let lastGlobalFetchAt = 0;

/** Aircraft not seen in any poll for this long are dropped from the store. */
const EXPIRE_MS = 60_000;

const FT_TO_M = 0.3048;
const KT_TO_MS = 0.514444;
const FPM_TO_MS = 0.00508;

interface RawAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  lat?: number;
  lon?: number;
  seen?: number;
  seen_pos?: number;
}

function parseAircraft(raw: RawAircraft[], nowMs: number): AircraftState[] {
  const parsed: AircraftState[] = [];
  const nowS = nowMs / 1000;
  for (const a of raw) {
    if (typeof a.lat !== "number" || typeof a.lon !== "number" || !a.hex) continue;
    const icao24 = a.hex.replace("~", "").toLowerCase();
    const callsign = a.flight?.trim() ?? "";
    const onGround = a.alt_baro === "ground";
    const baroAlt = typeof a.alt_baro === "number" ? a.alt_baro * FT_TO_M : null;
    const rate = a.baro_rate ?? a.geom_rate;
    parsed.push({
      icao24,
      callsign: callsign.length > 0 ? callsign : null,
      registration: a.r ?? null,
      typeCode: a.t ?? null,
      originCountry: countryFromIcao24(icao24),
      lon: a.lon,
      lat: a.lat,
      baroAltitude: onGround ? 0 : baroAlt,
      geoAltitude: typeof a.alt_geom === "number" ? a.alt_geom * FT_TO_M : null,
      onGround,
      velocity: typeof a.gs === "number" ? a.gs * KT_TO_MS : null,
      track: typeof a.track === "number" ? a.track : null,
      verticalRate: typeof rate === "number" ? rate * FPM_TO_MS : null,
      positionTime: nowS - (a.seen_pos ?? 0),
      lastContact: nowS - (a.seen ?? 0),
      seenAt: nowMs,
      easeFromLon: a.lon,
      easeFromLat: a.lat,
      easeStart: 0,
    });
  }
  return parsed;
}

/**
 * Merge a poll result into the live store in place.
 * Existing aircraft keep gliding: their current displayed position becomes the
 * easing origin so the correction plays out over ~1s instead of snapping.
 * Returns the icao24s that were expired (not seen for 60s).
 */
export function mergeStates(
  store: Map<string, AircraftState>,
  incoming: AircraftState[],
  nowMs: number,
): string[] {
  const scratch: LonLat = { lon: 0, lat: 0 };
  for (const next of incoming) {
    const prev = store.get(next.icao24);
    if (prev) {
      displayedPosition(prev, nowMs, scratch);
      next.easeFromLon = scratch.lon;
      next.easeFromLat = scratch.lat;
      next.easeStart = nowMs;
    }
    store.set(next.icao24, next);
  }
  const expired: string[] = [];
  for (const [icao24, a] of store) {
    if (nowMs - a.seenAt > EXPIRE_MS) {
      store.delete(icao24);
      expired.push(icao24);
    }
  }
  return expired;
}

export interface FeedQuery {
  lat: number;
  lon: number;
  /** Requested coverage radius in nautical miles; clamped to the API max. */
  radiusNm: number;
}

export interface PollerHandlers {
  store: Map<string, AircraftState>;
  /** Where to fetch around — derived from the current map viewport. */
  getQuery: () => FeedQuery | null;
  onData: (fetchedAtMs: number) => void;
  onStatus: (status: "live" | "retrying" | "down", retryInSeconds: number | null) => void;
  onExpired: (icao24s: string[]) => void;
}

let activePoke: (() => void) | null = null;

/** Ask the running poller to refresh soon (e.g. after the map moved to a new area). */
export function pokeFeed(): void {
  activePoke?.();
}

/**
 * Start polling. Fetches every 10s while healthy; on failure keeps the last
 * data (the render loop continues dead reckoning) and retries with exponential
 * backoff. Returns a stop function.
 */
export function startPolling(handlers: PollerHandlers): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = BACKOFF_START_MS;
  let failures = 0;

  async function poll(): Promise<void> {
    if (stopped) return;
    const query = handlers.getQuery();
    if (!query) {
      // Map not ready yet; check again shortly.
      timer = setTimeout(poll, 250);
      return;
    }
    // Keep well under the API's rate limit even across remounts and pokes.
    const sinceLast = Date.now() - lastGlobalFetchAt;
    if (sinceLast < MIN_FETCH_SPACING_MS) {
      timer = setTimeout(poll, MIN_FETCH_SPACING_MS - sinceLast);
      return;
    }
    lastGlobalFetchAt = Date.now();
    // Round the query so all visitors looking at the same area hit one CDN entry;
    // the radius padding in viewportFeedQuery more than absorbs the rounding.
    const radius = Math.min(Math.ceil(Math.max(query.radiusNm, 50) / 25) * 25, MAX_RADIUS_NM);
    const lat = (Math.round(query.lat * 4) / 4).toFixed(2);
    const lon = (Math.round(query.lon * 4) / 4).toFixed(2);
    const url = `${API_BASE}?lat=${lat}&lon=${lon}&dist=${radius}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`feed responded ${res.status}`);
      const json = (await res.json()) as { ac: RawAircraft[] | null };
      if (stopped) return;
      const now = Date.now();
      const expired = mergeStates(handlers.store, parseAircraft(json.ac ?? [], now), now);
      if (expired.length > 0) handlers.onExpired(expired);
      backoffMs = BACKOFF_START_MS;
      failures = 0;
      handlers.onData(now);
      handlers.onStatus("live", null);
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    } catch {
      if (stopped) return;
      failures += 1;
      const wait = backoffMs;
      backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
      handlers.onStatus(failures >= 3 ? "down" : "retrying", Math.round(wait / 1000));
      timer = setTimeout(poll, wait);
    } finally {
      clearTimeout(timeout);
    }
  }

  activePoke = () => {
    if (stopped || failures > 0) return; // while backing off, keep the scheduled retry
    const wait = Math.max(0, lastGlobalFetchAt + MIN_FETCH_SPACING_MS - Date.now());
    if (timer) clearTimeout(timer);
    timer = setTimeout(poll, wait);
  };

  void poll();
  return () => {
    stopped = true;
    activePoke = null;
    if (timer) clearTimeout(timer);
  };
}
