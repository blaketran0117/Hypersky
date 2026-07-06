import { atom } from "jotai";
import type { AircraftState, FeedState, Viewport } from "@/lib/types";

/**
 * Snapshot of the aircraft store, replaced on each poll (~every 10s).
 * Entries share object identity with the live store in lib/store.ts;
 * only the Map wrapper is new, which is what triggers derived recomputes.
 */
export const aircraftMapAtom = atom<Map<string, AircraftState>>(new Map());

/** Current map bounds + zoom, updated (throttled) as the map moves. */
export const viewportAtom = atom<Viewport | null>(null);

/** Currently selected aircraft id, or null. */
export const selectedIcaoAtom = atom<string | null>(null);

/** Sidebar search text. */
export const searchQueryAtom = atom("");

/** Data feed health, drives the freshness indicator. */
export const feedAtom = atom<FeedState>({
  status: "connecting",
  lastSuccessAt: null,
  retryInSeconds: null,
});

/** Aircraft inside the current viewport — the culled set the sidebar and stats use. */
export const visibleAircraftAtom = atom<AircraftState[]>((get) => {
  const aircraft = get(aircraftMapAtom);
  const viewport = get(viewportAtom);
  if (!viewport) return [];
  const { west, south, east, north } = viewport;
  const wholeWorld = east - west >= 360;
  const visible: AircraftState[] = [];
  for (const a of aircraft.values()) {
    if (a.lat < south || a.lat > north) continue;
    if (!wholeWorld) {
      let x = a.lon;
      while (x < west) x += 360;
      if (x > east) continue;
    }
    visible.push(a);
  }
  return visible;
});

/** Visible aircraft matching the search query, sorted for the sidebar. */
export const filteredListAtom = atom<AircraftState[]>((get) => {
  const visible = get(visibleAircraftAtom);
  const query = get(searchQueryAtom).trim().toUpperCase();
  const matches = query
    ? visible.filter(
        (a) =>
          (a.callsign !== null && a.callsign.toUpperCase().includes(query)) ||
          a.icao24.toUpperCase().includes(query) ||
          (a.registration !== null && a.registration.toUpperCase().includes(query)) ||
          (a.typeCode !== null && a.typeCode.toUpperCase().includes(query)) ||
          (a.originCountry !== null && a.originCountry.toUpperCase().includes(query)),
      )
    : visible;
  return [...matches].sort((a, b) => {
    if (a.callsign === null) return b.callsign === null ? a.icao24.localeCompare(b.icao24) : 1;
    if (b.callsign === null) return -1;
    return a.callsign.localeCompare(b.callsign);
  });
});

/** Full state of the selected aircraft, refreshed as new polls land. */
export const selectedAircraftAtom = atom<AircraftState | null>((get) => {
  const icao24 = get(selectedIcaoAtom);
  if (icao24 === null) return null;
  return get(aircraftMapAtom).get(icao24) ?? null;
});

/** Counts for the stats bar, isolated so it never re-renders for anything else. */
export const statsAtom = atom((get) => ({
  tracked: get(aircraftMapAtom).size,
  inView: get(visibleAircraftAtom).length,
}));
