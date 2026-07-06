import type { FeedQuery } from "./feed";
import type { AircraftState, Viewport } from "./types";

/**
 * The single mutable source of truth for aircraft state.
 * The poller writes to it, the MapLibre render loop reads from it every frame,
 * and Jotai atoms take cheap snapshots of it on each poll — so a data refresh
 * never forces React to touch the map layer.
 */
export const aircraftStore = new Map<string, AircraftState>();

/**
 * Latest viewport, mirrored outside React so the poller can read it at fetch
 * time without subscribing to atom updates.
 */
let liveViewport: Viewport | null = null;

export function setLiveViewport(v: Viewport): void {
  liveViewport = v;
}

const NM_PER_DEG = 60;

/** The point+radius query covering the current viewport (radius in nautical miles). */
export function viewportFeedQuery(): FeedQuery | null {
  const v = liveViewport;
  if (!v) return null;
  const lat = (v.north + v.south) / 2;
  const lon = (v.east + v.west) / 2;
  const latSpanNm = (v.north - v.south) * NM_PER_DEG;
  const lonSpanNm =
    (v.east - v.west) * NM_PER_DEG * Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  // Half the viewport diagonal, padded so edge aircraft are already loaded.
  const radiusNm = 0.55 * Math.hypot(latSpanNm, lonSpanNm);
  return { lat, lon: ((lon + 540) % 360) - 180, radiusNm };
}

/** Imperative handle to the live map, for fly-to from React without re-renders. */
export interface MapController {
  flyTo: (lon: number, lat: number) => void;
}

let mapController: MapController | null = null;

export function setMapController(c: MapController | null): void {
  mapController = c;
}

export function getMapController(): MapController | null {
  return mapController;
}
