import { displayedPosition, type LonLat } from "./interpolate";
import type { AircraftState, OpenSkyResponse } from "./types";

/** Same-origin proxy (app/api/opensky) — OpenSky doesn't allow cross-origin browser calls. */
const OPENSKY_URL = "/api/opensky";

/** Anonymous OpenSky data refreshes every 10s; polling faster only burns rate limit. */
export const POLL_INTERVAL_MS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;
const BACKOFF_START_MS = 15_000;
const BACKOFF_MAX_MS = 120_000;

/** Aircraft not seen in any poll for this long are dropped from the store. */
const EXPIRE_MS = 60_000;

/** Parse the raw positional arrays into typed states, skipping aircraft without a position. */
export function parseStates(json: OpenSkyResponse, nowMs: number): AircraftState[] {
  if (!json.states) return [];
  const parsed: AircraftState[] = [];
  for (const s of json.states) {
    const lon = s[5];
    const lat = s[6];
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    const callsign = typeof s[1] === "string" ? s[1].trim() : "";
    parsed.push({
      icao24: String(s[0]),
      callsign: callsign.length > 0 ? callsign : null,
      originCountry: String(s[2] ?? ""),
      positionTime: typeof s[3] === "number" ? s[3] : null,
      lastContact: typeof s[4] === "number" ? s[4] : 0,
      lon,
      lat,
      baroAltitude: typeof s[7] === "number" ? s[7] : null,
      onGround: s[8] === true,
      velocity: typeof s[9] === "number" ? s[9] : null,
      track: typeof s[10] === "number" ? s[10] : null,
      verticalRate: typeof s[11] === "number" ? s[11] : null,
      geoAltitude: typeof s[13] === "number" ? s[13] : null,
      seenAt: nowMs,
      easeFromLon: lon,
      easeFromLat: lat,
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

export interface PollerHandlers {
  onData: (fetchedAtMs: number) => void;
  onStatus: (status: "live" | "retrying" | "down", retryInSeconds: number | null) => void;
  store: Map<string, AircraftState>;
  onExpired: (icao24s: string[]) => void;
}

/**
 * Start polling OpenSky. Fetches every 10s while healthy; on failure keeps the
 * last data (the render loop continues dead reckoning) and retries with
 * exponential backoff. Returns a stop function.
 */
export function startPolling(handlers: PollerHandlers): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = BACKOFF_START_MS;
  let failures = 0;

  async function poll(): Promise<void> {
    if (stopped) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(OPENSKY_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`OpenSky responded ${res.status}`);
      const json = (await res.json()) as OpenSkyResponse;
      if (stopped) return;
      const now = Date.now();
      const expired = mergeStates(handlers.store, parseStates(json, now), now);
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

  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
