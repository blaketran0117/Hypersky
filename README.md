# Hypersky

**Live flight tracking, built for speed.**

Hypersky is a real-time flight tracking console: hundreds of live aircraft
rendered as a single WebGL layer, gliding smoothly across a dark world map at
60fps. No login, no ads, no API keys — open the URL, see the sky.

> 📸 _Screenshot placeholder — add `docs/screenshot.png` after deploying._

## Features

- **Live map** — aircraft around your view as directional icons, colored by altitude band (amber = ground, cyan = climbing/low, white = cruise)
- **Smooth motion** — positions arrive every ~10s; dead-reckoning interpolation animates aircraft between updates at display refresh rate
- **Flight details** — click any aircraft: callsign, type, registration, altitude, ground speed, vertical rate, heading, position age
- **Searchable sidebar** — virtualized list of aircraft in view; click to select and fly to
- **Stats bar** — aircraft tracked / in view, live data-freshness indicator
- **Resilient** — feed outages keep the app running on extrapolated positions with visible status and exponential-backoff retry

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| State | Jotai |
| Styling | TailwindCSS |
| Map | MapLibre GL JS + OpenFreeMap dark tiles |
| Data | airplanes.live ADS-B API |
| Virtualized list | TanStack Virtual |

## Architecture

```
app/
  page.tsx                 main view (map + panels)
components/
  Map/FlightMap.tsx        MapLibre lifecycle wrapper (renders one div, never re-renders on data)
  Map/AircraftLayer.ts     GeoJSON source mgmt + rAF interpolation loop (no React)
  Map/planeIcon.ts         canvas-rendered aircraft icons, one per altitude band
  DataFeed.tsx             headless poller: ADS-B feed → store + atoms
  FlightPanel.tsx          selected flight details
  FlightList.tsx           virtualized, searchable sidebar
  StatsBar.tsx             global counts + data freshness
  ui/                      Panel, Badge, DataRow, Button
state/atoms.ts             Jotai atoms + derived selectors
lib/
  feed.ts                  API client, polling, diffing, expiry, rate-limit guard
  interpolate.ts           dead-reckoning math + correction easing
  store.ts                 shared mutable aircraft store (poller writes, rAF loop reads)
  country.ts               ICAO address block → country of registration
  viewport.ts, units.ts, types.ts
```

### Data source

The v1 spec called for OpenSky Network's global `/states/all` snapshot. That
turned out to be undeployable: OpenSky firewalls hosting-provider IP ranges at
the TCP level (verified from Vercel Node and Edge runtimes and several other
datacenter vantage points), and even its authenticated free tier (4,000
credits/day at 4 credits per global query) can only sustain ~2.8 hours of 10s
polling per day — nowhere near an always-on public site.

Hypersky instead uses [airplanes.live](https://airplanes.live/), a community
ADS-B aggregator with an open-CORS, keyless API. Every visitor's **browser
fetches directly** — there is no backend, no shared quota, and the app deploys
as a fully static site. The trade-off: queries are point+radius (max 250 nm),
so the feed follows the map viewport instead of snapshotting the planet. The
poller derives its query from the current bounds, refetches promptly after the
map settles somewhere new, and stays well under the API's rate limit with a
global fetch-spacing guard (the limiter imposes a 60s lockout whose 429s carry
no CORS headers, so the client backs off blind in steps sized to clear it).

### Data flow

1. `DataFeed` polls the feed every 10s around the viewport center; map
   movement pokes the poller for a prompt (but rate-limit-safe) refresh.
2. Each poll is diffed into a shared `Map<icao24, AircraftState>`: existing
   aircraft updated, new ones added, anything unseen for 60s expired.
3. The same poll publishes a snapshot to `aircraftMapAtom`; derived atoms
   (visible set, filtered list, counts, selected aircraft) recompute from there.
4. On failure: exponential backoff (30s → 120s), the map keeps extrapolating
   from last known state, and the stats bar shows the degraded feed status.

## Performance decisions

**Aircraft are not React components.** The entire swarm is one MapLibre
GeoJSON source feeding one symbol layer — effectively a single draw call.
React owns the chrome around the map (panels, list, stats); a
`requestAnimationFrame` loop owns the swarm and writes straight to the map
source, outside the React render cycle. A poll updating hundreds of aircraft
re-renders exactly three subscribed components (panel, list, stats bar) —
never the map layer.

**Dead reckoning + easing.** Data arrives every ~10s, so per frame each
aircraft's position is extrapolated along its last known track and speed.
When a fresh report lands, aircraft ease toward the corrected position over
~1s (smoothstep) instead of snapping.

**Viewport culling.** Only aircraft inside the current bounds (plus a 15%
margin) are interpolated and pushed into the GeoJSON source each update. The
derived `visibleAircraftAtom` applies the same culling for the sidebar and
counts, so list rendering cost tracks what's on screen, not the whole store.

**Adaptive geometry cadence.** `setData()` re-tiles the source in the map's
worker, so the swarm is refreshed at a rate matched to perceptible motion:
every frame when zoomed in (≥z7, where aircraft visibly move), 100–250ms when
zoomed out (where per-frame deltas are sub-pixel). Camera movement is
unaffected — panning and zooming always render at full frame rate from
already-uploaded geometry.

**Fine-grained subscriptions.** Jotai atoms isolate re-renders: the detail
panel subscribes only to the selected aircraft, the stats bar only to counts,
the sidebar only to the filtered visible list. The sidebar itself is
virtualized (TanStack Virtual), so a thousand aircraft in view means ~15 DOM rows.

**Bounded memory.** Aircraft unseen for 60s are deleted from the store, the
selected-flight trail is capped at 150 points, and the interpolation loop
reuses scratch objects instead of allocating per aircraft per frame.

### Measuring

- **React re-renders:** React DevTools Profiler while a poll lands — only
  `FlightPanel`/`FlightList`/`StatsBar` commit; `FlightMap` renders once at mount.
- **Frame rate:** Chrome Performance panel while panning over a dense region.
- **Memory:** heap snapshots 30 minutes apart; the aircraft store stays
  bounded by the feed coverage thanks to 60s expiry.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API keys required.

## Deploying

Zero-config on [Vercel](https://vercel.com): import the repo and deploy. The
app is fully static — all live data is fetched by the visitor's browser.

## Data attribution

Live aircraft data from [airplanes.live](https://airplanes.live/)
(free for non-commercial use). Basemap © [OpenFreeMap](https://openfreemap.org/),
© [OpenMapTiles](https://openmaptiles.org/), data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
