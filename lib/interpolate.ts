import type { AircraftState } from "./types";

const METERS_PER_DEG_LAT = 111_320;
const DEG_TO_RAD = Math.PI / 180;

/** How long an aircraft eases toward its corrected position after new data arrives. */
export const EASE_MS = 1_000;

/** Stop extrapolating beyond this horizon so stale aircraft don't fly off the map. */
const MAX_EXTRAPOLATION_S = 300;

export interface LonLat {
  lon: number;
  lat: number;
}

/**
 * Dead reckoning: project a position forward along its track.
 * velocity is ground speed in m/s, track is degrees clockwise from north.
 */
export function deadReckon(
  lon: number,
  lat: number,
  velocity: number,
  track: number,
  dtSeconds: number,
  out: LonLat,
): LonLat {
  const dt = Math.min(Math.max(dtSeconds, 0), MAX_EXTRAPOLATION_S);
  if (velocity <= 0 || dt === 0) {
    out.lon = lon;
    out.lat = lat;
    return out;
  }
  const rad = track * DEG_TO_RAD;
  const dNorth = velocity * Math.cos(rad) * dt;
  const dEast = velocity * Math.sin(rad) * dt;
  const newLat = lat + dNorth / METERS_PER_DEG_LAT;
  const latScale = Math.max(Math.cos(newLat * DEG_TO_RAD), 0.01);
  let newLon = lon + dEast / (METERS_PER_DEG_LAT * latScale);
  if (newLon > 180) newLon -= 360;
  else if (newLon < -180) newLon += 360;
  out.lat = Math.max(-89, Math.min(89, newLat));
  out.lon = newLon;
  return out;
}

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * The position an aircraft should be drawn at right now: dead-reckoned from its
 * last report, blended from where it was displayed when the report arrived.
 */
export function displayedPosition(a: AircraftState, nowMs: number, out: LonLat): LonLat {
  deadReckon(a.lon, a.lat, a.velocity ?? 0, a.track ?? 0, (nowMs - a.seenAt) / 1000, out);
  const sinceEase = nowMs - a.easeStart;
  if (sinceEase < EASE_MS) {
    // Skip blending across the antimeridian; a rare visible snap beats a wrap-around streak.
    if (Math.abs(out.lon - a.easeFromLon) < 180) {
      const k = smoothstep(sinceEase / EASE_MS);
      out.lon = a.easeFromLon + (out.lon - a.easeFromLon) * k;
      out.lat = a.easeFromLat + (out.lat - a.easeFromLat) * k;
    }
  }
  return out;
}
