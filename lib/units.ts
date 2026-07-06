/** Aviation display units: OpenSky reports metres and m/s. */

export function metersToFeet(m: number): number {
  return m * 3.28084;
}

export function msToKnots(ms: number): number {
  return ms * 1.94384;
}

export function msToFpm(ms: number): number {
  return ms * 196.85;
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatAltitude(meters: number | null): string {
  if (meters === null) return "—";
  return `${formatInt(metersToFeet(meters))} ft`;
}

export function formatSpeed(ms: number | null): string {
  if (ms === null) return "—";
  return `${formatInt(msToKnots(ms))} kt`;
}

export function formatVerticalRate(ms: number | null): string {
  if (ms === null) return "—";
  const fpm = msToFpm(ms);
  if (Math.abs(fpm) < 64) return "level";
  return `${fpm > 0 ? "+" : "−"}${formatInt(Math.abs(fpm))} fpm`;
}

export function formatHeading(deg: number | null): string {
  if (deg === null) return "—";
  return `${String(Math.round(deg) % 360).padStart(3, "0")}°`;
}

export function formatAge(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 0) return "0 s";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  return `${m} min ${Math.round(seconds % 60)} s`;
}
