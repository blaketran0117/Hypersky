"use client";

import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pokeFeed } from "@/lib/feed";
import { setLiveViewport, setMapController } from "@/lib/store";
import { selectedIcaoAtom, viewportAtom } from "@/state/atoms";
import { AircraftLayer } from "./AircraftLayer";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const VIEWPORT_THROTTLE_MS = 200;

// Start over the Benelux/Rhine corridor: LHR, CDG, AMS and FRA all sit inside
// one 250 nm feed query, so first paint is dense with traffic.
const INITIAL_CENTER: [number, number] = [4.9, 50.1];
const INITIAL_ZOOM = 5.6;

/**
 * MapLibre lifecycle wrapper. The map and the aircraft swarm live entirely in
 * refs — this component renders a single div and never re-renders on data.
 */
export default function FlightMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<AircraftLayer | null>(null);
  const setViewport = useSetAtom(viewportAtom);
  const setSelected = useSetAtom(selectedIcaoAtom);
  const selectedIcao = useAtomValue(selectedIcaoAtom);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    async function init() {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 1,
        maxZoom: 13,
        attributionControl: { compact: true, customAttribution: "Data: adsb.lol / adsb.fi" },
      });

      // The basemap style occasionally references sprite icons it doesn't ship
      // (e.g. "circle-11"); register a transparent stand-in to keep the console clean.
      map.on("styleimagemissing", (e) => {
        if (!map || map.hasImage(e.id)) return;
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      let lastViewportPush = 0;
      const pushViewport = () => {
        if (!map) return;
        const b = map.getBounds();
        const v = {
          west: b.getWest(),
          south: b.getSouth(),
          east: b.getEast(),
          north: b.getNorth(),
          zoom: map.getZoom(),
        };
        setLiveViewport(v);
        setViewport(v);
      };

      map.on("move", () => {
        const now = performance.now();
        if (now - lastViewportPush < VIEWPORT_THROTTLE_MS) return;
        lastViewportPush = now;
        pushViewport();
      });
      map.on("moveend", () => {
        pushViewport();
        // The feed is viewport-scoped: ask it to cover the new area promptly.
        pokeFeed();
      });

      map.on("load", () => {
        if (cancelled || !map) return;
        const layer = new AircraftLayer(map);
        layerRef.current = layer;
        layer.onAircraftClick((icao24) => setSelected(icao24));
        setMapController({
          flyTo: (lon, lat) => {
            const m = map;
            if (!m) return;
            m.flyTo({ center: [lon, lat], zoom: Math.max(m.getZoom(), 7), speed: 1.6 });
          },
        });
        pushViewport();
      });
    }

    void init();

    return () => {
      cancelled = true;
      setMapController(null);
      layerRef.current?.dispose();
      layerRef.current = null;
      map?.remove();
      map = null;
    };
  }, [setSelected, setViewport]);

  useEffect(() => {
    layerRef.current?.setSelected(selectedIcao);
  }, [selectedIcao]);

  // MapLibre's own CSS forces `position: relative` on the container, so the
  // absolute positioning lives on a wrapper and the container just fills it.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
