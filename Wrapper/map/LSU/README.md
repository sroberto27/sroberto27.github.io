# LSU Death Valley Experience — prototype

Forked from `../NewIberiaPro` for LSU Football recruiting: a guided 10-stop
gameday-journey map (Lot 414 → Tiger Stadium kickoff → postgame) with Treedis
360° experiences dropped in per stop. Base imagery is Louisiana DOTD's 2025 6"
aerial ImageServer, rendered dynamically via `esri-leaflet`.

## Run it

    cd LSU
    python -m http.server 8000
    # open http://localhost:8000

Serve over http — the JSON/GeoJSON data files load via `fetch()`. There is no
`file://` shim fallback in this project (matches NewIberiaPro's own
convention — see its README).

## What's placeholder and needs replacing

1. **`data/tours.geojson`** — all 10 stops are small (~15m) placeholder boxes
   at desk-research coordinates. Replace with QGIS-traced footprints (Export
   → Save Features As → GeoJSON, EPSG:4326). **Keep the `name` property
   exactly matching the keys in `data/locations.json` and
   `data/treedis-sweeps.json`** — that's the join key the whole app reads by.
2. **`data/locations.json`** — copy/category placeholders per stop. Real
   photos go in the `image` field (currently empty — falls back to a
   placeholder frame automatically).
3. **Treedis** (`config.js` → `treedis.profiles.*` and
   `data/treedis-sweeps.json`) — no real LSU Treedis model exists yet, so
   `modelId`/`tourUrl`/`origin` are empty and every stop's `sweepId` is
   `null`. Every stop currently renders as a graceful info-only panel (no
   Explore CTA, no VR badge) — that's expected. Once a real Treedis capture
   exists: fill in `config.treedis.profiles.desktop/vr.modelId` + `tourUrl` +
   `origin`, then fill in each stop's `sweepId` in
   `data/treedis-sweeps.json`.
4. **Street/label overlay** (`config.js` → `referenceOverlay`) — currently
   the public `tile.openstreetmap.org` server, chosen because it's the only
   open-data source with building- and business-level POI labels (not just
   roads/city names). OSM's tile usage policy discourages heavy production
   traffic on that public server — swap for a paid provider (MapTiler /
   Stadia Maps / Thunderforest all serve the same OSM data with an API key)
   before this goes in front of real recruits.
5. **Aerial imagery coverage** (`config.js` → `esriImagery`) — coverage over
   LSU campus was confirmed via a manual ArcGIS Online Map Viewer check, not
   an automated one; re-verify after your first real render, especially near
   the edges of `tiles.bounds`.
6. **`config.js` → `tiles.bounds` / `initialCenter` / `initialZoom`** — a
   desk-research approximation of the core gameday footprint (Lot 414 through
   Nicholson Gateway). Tighten once real stop geometry exists.
7. **Deck background gradient** (`css/01-base.css` → `--ni-bg-gradient`) —
   approximate values from the build brief; the PDF's exact gradient stops
   couldn't be sampled in this environment (no PDF-page-rendering tool
   available). Worth eyedropping the real deck pages directly.
8. **`assets/Icons/logo.png` / `logo-white.svg`** — no LSU seal/wordmark
   asset was provided, so these paths intentionally point at nothing; the
   app already falls back gracefully (an inline "LSU" monogram in the
   sidebar, a hidden `<img>` everywhere else). Drop in real LSU brand assets
   at these paths whenever they're available — no code changes needed.
9. **Learn tab** — a static "coming soon" placeholder for now
   (`js/13-learn-mode.js`, `css/11-learn-mode.css`). The deck's stats block,
   Before/During/After framing, and avatar-guide content aren't built yet.

## Architecture notes (for whoever picks this up next)

- Tour stops are **Polygon** features in `data/tours.geojson`, not points —
  the pin-placement and route-line code compute each stop's position from its
  polygon's centroid (`layer.getBounds().getCenter()`), which only works on
  polygon/path layers. Don't switch to Point geometry without also updating
  `js/07-layer-builders.js`, `js/06-details-panel.js`, and
  `js/14-redesign.js`.
- `data/tours.geojson`'s `name` property (lowercased) is the join key into
  `data/locations.json` and `data/treedis-sweeps.json` — there's no
  per-feature `id`/`category`/`treedis_scene_id` on the tour polygon itself.
- The `All / Route / Facility` filter chips are generated automatically from
  the `category` values in `locations.json` — no chip markup to maintain.
- The dashed route line between stops is drawn automatically at runtime from
  stop order (`js/14-redesign.js: buildRouteLine()`) — there's no separate
  route file to keep in sync.
