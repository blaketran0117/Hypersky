"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { startPolling } from "@/lib/opensky";
import { aircraftStore } from "@/lib/store";
import { aircraftMapAtom, feedAtom, selectedIcaoAtom } from "@/state/atoms";

/**
 * Headless component that runs the OpenSky poller for the lifetime of the page.
 * On each poll it mutates the shared aircraft store (read by the map's rAF loop)
 * and publishes a snapshot to Jotai for the React side of the app.
 */
export default function DataFeed() {
  const setAircraftMap = useSetAtom(aircraftMapAtom);
  const setFeed = useSetAtom(feedAtom);
  const setSelected = useSetAtom(selectedIcaoAtom);

  useEffect(() => {
    const stop = startPolling({
      store: aircraftStore,
      onData: (fetchedAtMs) => {
        setAircraftMap(new Map(aircraftStore));
        setFeed({ status: "live", lastSuccessAt: fetchedAtMs, retryInSeconds: null });
      },
      onStatus: (status, retryInSeconds) => {
        if (status === "live") return; // onData already reported success
        setFeed((prev) => ({ ...prev, status, retryInSeconds }));
      },
      onExpired: (icao24s) => {
        setSelected((current) => (current !== null && icao24s.includes(current) ? null : current));
      },
    });
    return stop;
  }, [setAircraftMap, setFeed, setSelected]);

  return null;
}
