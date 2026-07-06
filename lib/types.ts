/** Altitude band used for icon colouring: amber = ground, cyan = low/climbing, white = cruise. */
export type AltitudeBand = "ground" | "low" | "cruise";

/** Normalised state for a single aircraft, merged across polls. Metric units throughout. */
export interface AircraftState {
  icao24: string;
  callsign: string | null;
  registration: string | null;
  /** ICAO type designator, e.g. "A320", "B738". */
  typeCode: string | null;
  /** Country of registration derived from the ICAO address block, when known. */
  originCountry: string | null;
  /** Last reported longitude/latitude (degrees). */
  lon: number;
  lat: number;
  /** Barometric altitude in metres, 0 on ground, null when unreported. */
  baroAltitude: number | null;
  /** Geometric (GPS) altitude in metres. */
  geoAltitude: number | null;
  onGround: boolean;
  /** Ground speed in m/s. */
  velocity: number | null;
  /** True track in degrees clockwise from north. */
  track: number | null;
  /** Vertical rate in m/s (positive = climbing). */
  verticalRate: number | null;
  /** Unix seconds of the last position report. */
  positionTime: number | null;
  /** Unix seconds of the last message of any kind. */
  lastContact: number;
  /** Local ms timestamp when this state was ingested — origin for dead reckoning. */
  seenAt: number;
  /** Easing state so aircraft glide toward corrected positions instead of snapping. */
  easeFromLon: number;
  easeFromLat: number;
  easeStart: number;
}

export type FeedStatus = "connecting" | "live" | "retrying" | "down";

export interface FeedState {
  status: FeedStatus;
  /** Local ms timestamp of the last successful fetch, null before first data. */
  lastSuccessAt: number | null;
  /** Seconds until the next retry attempt while backing off. */
  retryInSeconds: number | null;
}

export interface Viewport {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

export function altitudeBand(a: AircraftState): AltitudeBand {
  if (a.onGround) return "ground";
  const alt = a.baroAltitude ?? a.geoAltitude;
  if (alt === null || alt < 100) return "ground";
  return alt < 6000 ? "low" : "cruise";
}
