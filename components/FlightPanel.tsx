"use client";

import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  formatAge,
  formatAltitude,
  formatHeading,
  formatSpeed,
  formatVerticalRate,
} from "@/lib/units";
import { selectedAircraftAtom, selectedIcaoAtom } from "@/state/atoms";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import DataRow from "./ui/DataRow";
import Panel from "./ui/Panel";

/** Detail panel for the selected flight. Subscribes only to selectedAircraftAtom. */
export default function FlightPanel() {
  const aircraft = useAtomValue(selectedAircraftAtom);
  const setSelected = useSetAtom(selectedIcaoAtom);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);

  // Tick once a second so the position-age readout stays live between polls.
  useEffect(() => {
    if (!aircraft) return;
    const id = setInterval(() => setNowS(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, [aircraft]);

  if (!aircraft) return null;

  const vRate = aircraft.verticalRate ?? 0;
  const positionAge =
    aircraft.positionTime !== null ? Math.max(0, nowS - aircraft.positionTime) : null;

  return (
    <Panel className="absolute right-3 top-14 z-10 w-72">
      <div className="flex items-start justify-between border-b border-white/10 p-3">
        <div>
          <div className="font-mono text-lg font-semibold tracking-wider text-slate-50">
            {aircraft.callsign ?? aircraft.icao24.toUpperCase()}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{aircraft.originCountry}</div>
        </div>
        <Button aria-label="Close flight details" onClick={() => setSelected(null)}>
          ✕
        </Button>
      </div>
      <div className="px-3 py-2">
        <DataRow label="Altitude">{formatAltitude(aircraft.baroAltitude ?? aircraft.geoAltitude)}</DataRow>
        <DataRow label="Ground speed">{formatSpeed(aircraft.velocity)}</DataRow>
        <DataRow
          label="Vertical rate"
          valueClassName={vRate > 0.5 ? "text-cyan-300" : vRate < -0.5 ? "text-amber-300" : ""}
        >
          {formatVerticalRate(aircraft.verticalRate)}
        </DataRow>
        <DataRow label="Heading">{formatHeading(aircraft.track)}</DataRow>
        <DataRow label="Position age">{formatAge(positionAge)}</DataRow>
        <DataRow label="ICAO 24">{aircraft.icao24.toUpperCase()}</DataRow>
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <Badge tone={aircraft.onGround ? "amber" : "cyan"}>
          {aircraft.onGround ? "On ground" : "Airborne"}
        </Badge>
        {vRate > 0.5 && !aircraft.onGround && <Badge tone="cyan">Climbing</Badge>}
        {vRate < -0.5 && !aircraft.onGround && <Badge tone="amber">Descending</Badge>}
      </div>
    </Panel>
  );
}
