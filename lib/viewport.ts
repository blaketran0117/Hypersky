import type { Viewport } from "./types";

/** Expand bounds by a fraction of their span so aircraft at the edges keep animating. */
export function withMargin(v: Viewport, fraction: number): Viewport {
  const lonSpan = v.east - v.west;
  const latSpan = v.north - v.south;
  return {
    west: v.west - lonSpan * fraction,
    east: v.east + lonSpan * fraction,
    south: Math.max(-90, v.south - latSpan * fraction),
    north: Math.min(90, v.north + latSpan * fraction),
    zoom: v.zoom,
  };
}

/** Bounds-in test that copes with MapLibre's unwrapped longitudes and the antimeridian. */
export function isInBounds(lon: number, lat: number, v: Viewport): boolean {
  if (lat < v.south || lat > v.north) return false;
  if (v.east - v.west >= 360) return true;
  // Normalise into the same wrap window as the bounds.
  let x = lon;
  while (x < v.west) x += 360;
  while (x > v.west + 360) x -= 360;
  return x <= v.east;
}
