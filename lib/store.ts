import type { AircraftState } from "./types";

/**
 * The single mutable source of truth for aircraft state.
 * The poller writes to it, the MapLibre render loop reads from it every frame,
 * and Jotai atoms take cheap snapshots of it on each poll — so a data refresh
 * never forces React to touch the map layer.
 */
export const aircraftStore = new Map<string, AircraftState>();

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
