import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  MapMouseEvent,
} from "maplibre-gl";
import { displayedPosition, type LonLat } from "@/lib/interpolate";
import { aircraftStore } from "@/lib/store";
import { altitudeBand } from "@/lib/types";
import { createPlaneImage } from "./planeIcon";

const SOURCE_ID = "aircraft";
const TRAIL_SOURCE_ID = "aircraft-trail";
const ICON_LAYER_ID = "aircraft-icons";
const GLOW_LAYER_ID = "aircraft-glow";
const TRAIL_LAYER_ID = "aircraft-trail-line";

export const BAND_COLORS = {
  ground: "#f59e0b",
  low: "#22d3ee",
  cruise: "#f8fafc",
} as const;

const TRAIL_SAMPLE_MS = 400;
const TRAIL_MAX_POINTS = 150;

/**
 * Owns the aircraft swarm entirely outside React: one GeoJSON source feeding one
 * symbol layer (a single draw call for every plane), positions advanced by dead
 * reckoning in a requestAnimationFrame loop.
 *
 * setData() re-tiles the source, so the swarm geometry is refreshed at a rate
 * matched to what motion is actually perceptible at the current zoom — while
 * camera movement (pan/zoom) always renders at full frame rate on the GPU.
 */
export class AircraftLayer {
  private map: MapLibreMap;
  private rafId = 0;
  private lastSetData = 0;
  private selectedIcao: string | null = null;
  private trail: [number, number][] = [];
  private lastTrailSample = 0;
  private scratch: LonLat = { lon: 0, lat: 0 };
  private disposed = false;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.addImages();
    this.addSourcesAndLayers();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private addImages(): void {
    for (const [band, color] of Object.entries(BAND_COLORS)) {
      this.map.addImage(`plane-${band}`, createPlaneImage(color), { pixelRatio: 2 });
    }
  }

  private addSourcesAndLayers(): void {
    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    this.map.addSource(SOURCE_ID, {
      type: "geojson",
      data: empty,
      // Point data needs no clip buffer or simplification — skip that worker cost.
      buffer: 0,
      tolerance: 0,
    });
    this.map.addSource(TRAIL_SOURCE_ID, { type: "geojson", data: empty });

    this.map.addLayer({
      id: TRAIL_LAYER_ID,
      type: "line",
      source: TRAIL_SOURCE_ID,
      paint: {
        "line-color": "#38bdf8",
        "line-width": 1.5,
        "line-opacity": 0.55,
      },
    });

    this.map.addLayer({
      id: GLOW_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 12, 10, 26],
        "circle-color": "#7dd3fc",
        "circle-blur": 1,
        "circle-opacity": 0.5,
      },
    });

    this.map.addLayer({
      id: ICON_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "icon-image": ["concat", "plane-", ["get", "band"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.34, 6, 0.55, 10, 0.9],
        "icon-rotate": ["get", "heading"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }

  /**
   * Swarm geometry refresh cadence. Zoomed out, per-frame position deltas are
   * far below one pixel, so re-tiling 60×/s is pure waste; zoomed in, aircraft
   * visibly move and get per-frame updates.
   */
  private updateIntervalMs(zoom: number): number {
    if (zoom >= 7) return 0;
    if (zoom >= 5) return 100;
    return 250;
  }

  private loop(now: number): void {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const zoom = this.map.getZoom();
    const interval = this.updateIntervalMs(zoom);
    if (now - this.lastSetData < interval) return;
    this.lastSetData = now;

    const nowMs = Date.now();
    const bounds = this.map.getBounds();
    const lonSpan = bounds.getEast() - bounds.getWest();
    const latSpan = bounds.getNorth() - bounds.getSouth();
    const west = bounds.getWest() - lonSpan * 0.15;
    const east = bounds.getEast() + lonSpan * 0.15;
    const south = Math.max(-90, bounds.getSouth() - latSpan * 0.15);
    const north = Math.min(90, bounds.getNorth() + latSpan * 0.15);
    const wholeWorld = east - west >= 360;

    const features: GeoJSON.Feature[] = [];
    for (const a of aircraftStore.values()) {
      const isSelected = a.icao24 === this.selectedIcao;
      // Viewport culling: only aircraft in view (plus margin) are interpolated.
      if (!isSelected) {
        if (a.lat < south || a.lat > north) continue;
        if (!wholeWorld) {
          let x = a.lon;
          while (x < west) x += 360;
          if (x > east) continue;
        }
      }
      displayedPosition(a, nowMs, this.scratch);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [this.scratch.lon, this.scratch.lat] },
        properties: {
          id: a.icao24,
          heading: a.track ?? 0,
          band: altitudeBand(a),
        },
      });
      if (isSelected && nowMs - this.lastTrailSample >= TRAIL_SAMPLE_MS) {
        this.lastTrailSample = nowMs;
        this.trail.push([this.scratch.lon, this.scratch.lat]);
        if (this.trail.length > TRAIL_MAX_POINTS) this.trail.shift();
        this.updateTrailSource();
      }
    }

    const source = this.map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features });
  }

  private updateTrailSource(): void {
    const source = this.map.getSource(TRAIL_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(
      this.trail.length >= 2
        ? {
            type: "Feature",
            geometry: { type: "LineString", coordinates: this.trail },
            properties: {},
          }
        : { type: "FeatureCollection", features: [] },
    );
  }

  setSelected(icao24: string | null): void {
    this.selectedIcao = icao24;
    this.trail = [];
    this.lastTrailSample = 0;
    this.updateTrailSource();
    this.map.setFilter(GLOW_LAYER_ID, ["==", ["get", "id"], icao24 ?? ""]);
  }

  /** Wire click/hover on the icon layer. Returns the clicked aircraft id, or null for empty map. */
  onAircraftClick(handler: (icao24: string | null) => void): void {
    this.map.on("click", (e: MapMouseEvent) => {
      const hits = this.map.queryRenderedFeatures(e.point, { layers: [ICON_LAYER_ID] });
      const first = hits[0] as MapGeoJSONFeature | undefined;
      handler(first ? String(first.properties.id) : null);
    });
    this.map.on("mousemove", (e: MapMouseEvent) => {
      const hits = this.map.queryRenderedFeatures(e.point, { layers: [ICON_LAYER_ID] });
      this.map.getCanvas().style.cursor = hits.length > 0 ? "pointer" : "";
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
  }
}
