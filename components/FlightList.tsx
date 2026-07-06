"use client";

import { useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getMapController } from "@/lib/store";
import { formatAltitude, formatSpeed } from "@/lib/units";
import type { AircraftState } from "@/lib/types";
import { filteredListAtom, searchQueryAtom, selectedIcaoAtom } from "@/state/atoms";
import Panel from "./ui/Panel";

const ROW_HEIGHT = 52;

/** Searchable, virtualized sidebar of aircraft in the current viewport. */
export default function FlightList() {
  const flights = useAtomValue(filteredListAtom);
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [selectedIcao, setSelected] = useAtom(selectedIcaoAtom);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flights.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const select = (a: AircraftState) => {
    setSelected(a.icao24);
    getMapController()?.flyTo(a.lon, a.lat);
  };

  return (
    // v1 is desktop-first: on small screens the sidebar would cover the map, so it's hidden.
    <Panel className="absolute bottom-3 left-3 top-14 z-10 hidden w-72 flex-col md:flex">
      <div className="border-b border-white/10 p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search callsign, hex, country…"
          spellCheck={false}
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
        />
        <div className="mt-1.5 px-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {flights.length.toLocaleString("en-US")} in view
        </div>
      </div>
      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const a = flights[row.index];
            const isSelected = a.icao24 === selectedIcao;
            return (
              <button
                key={a.icao24}
                onClick={() => select(a)}
                className={`absolute left-0 top-0 flex w-full flex-col justify-center gap-0.5 border-b border-white/5 px-3 text-left transition-colors ${
                  isSelected ? "bg-cyan-400/10" : "hover:bg-white/5"
                }`}
                style={{ height: ROW_HEIGHT, transform: `translateY(${row.start}px)` }}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className={`font-mono text-sm font-medium tracking-wider ${
                      isSelected ? "text-cyan-300" : "text-slate-100"
                    }`}
                  >
                    {a.callsign ?? a.icao24.toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{a.icao24}</span>
                </div>
                <div className="flex items-baseline justify-between font-mono text-[11px] tabular-nums text-slate-400">
                  <span>{formatAltitude(a.baroAltitude ?? a.geoAltitude)}</span>
                  <span>{formatSpeed(a.velocity)}</span>
                  <span className="max-w-24 truncate text-slate-500">
                    {a.typeCode ?? a.registration ?? "—"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {flights.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500">
            No aircraft match this view.
          </div>
        )}
      </div>
    </Panel>
  );
}
