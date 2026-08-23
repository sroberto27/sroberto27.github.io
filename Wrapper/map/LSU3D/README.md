# LSU Death Valley Experience — MapLibre 3D prototype

MapLibre GL JS rebuild of `../LSU/` (the working 2D Leaflet build), adding a
2D/3D toggle: `pitch: 0` is the same 2D experience as before, `pitch: 60`
tilts the same map instance into 3D. Same data, same sidebar/search/tour
widget, same selected-stop state — see "Architecture notes" below for what
actually changed under the hood.

**3D has two renderers**, chosen automatically (`js/05-map-helpers.js`:
`set3DMode()`):

- **Simplified fallback (always available, the default)** — every OSM
  building footprint extruded to one flat height
  (`config.js` → `map3d.buildingDefaultHeight`, 14m). No LiDAR, no per-
  building measurement, no mesh — flat-roofed boxes. This is permanent,
  low-maintenance safety-net infrastructure, not a placeholder waiting to
  be replaced.
- **Google Photorealistic 3D Tiles (opt-in, billed, off by default)** —
  real captured 3D geometry + imagery for the whole campus, rendered via
  NASA-AMMOS's open-source `3d-tiles-renderer` + three.js
  (`js/16-google-tiles.js`). Requires a Google Cloud API key; see
  "Google Photorealistic 3D Tiles" below before enabling it anywhere
  shared. Falls back to the simplified view automatically on any
  failure — missing/invalid key, load error, or timeout — never a blank
  or broken 3D view.

An earlier version of this project used a LiDAR-derived pipeline (PDAL
point-cloud heights + a reconstructed Tiger Stadium mesh) instead of the
flat fallback above. It was removed: it was the ceiling of what free
public LiDAR/orthophoto data can do at building scale (flat boxes, a
stadium mesh that read as a rounded blob, no wall texture), and Google's
tiles are the real fix for that gap, not a further tuning pass on LiDAR.
See git history if you need to look at that pipeline again.

**`../LSU/` (the Leaflet build) is untouched and still deployable.** This is
a sibling-folder rebuild, not an in-place migration — see "Rollback" below.

## Run it

    cd LSU3D
    python -m http.server 8000
    # open http://localhost:8000

Serve over http — the JSON/GeoJSON data files load via `fetch()`. No
`file://` fallback (matches the Leaflet build's own convention).

## What shipped

- **Engine**: MapLibre GL JS (no more Leaflet / `esri-leaflet`). DOTD 6"
  aerial imagery is a hand-built raster source against the ImageServer's
  `exportImage` REST operation, using MapLibre's `{bbox-epsg-3857}` template
  — no Esri plugin dependency at all now.
- **2D/3D toggle** (`#toggle3DBtn`, next to the layers button) — same map
  instance, `map.easeTo({pitch, bearing})`. Terrain (AWS's public Terrarium
  DEM tiles) loads lazily on first 3D entry, not on page load.
- **Buildings — flat extruded fallback**:
  - `data/buildings.geojson`: 126 OSM building footprints for LSU campus
    (Overpass API export — LSU's campus is well-mapped in OSM) plus 3
    hand-traced Tiger Stadium "bowl" bands (fids 127–129; Tiger Stadium
    itself isn't in OSM's `building=*` data). No `height`/`building:levels`
    tags exist on this data.
  - Every building extrudes to one flat height —
    `config.js` → `map3d.buildingDefaultHeight` (14m) — via
    `js/07-layer-builders.js: addSourceAndLayers()`/`prepGeoJSON()`. No
    per-building measurement of any kind; this is deliberately as simple
    as possible, since it's the always-on safety net whenever Google
    tiles (below) aren't active.
- **Google Photorealistic 3D Tiles** (`js/16-google-tiles.js`) — opt-in,
  off by default. A MapLibre custom layer wrapping NASA-AMMOS's
  `3d-tiles-renderer`, using its `GoogleCloudAuthPlugin` against Google's
  Map Tiles API. Reuses the same "share MapLibre's WebGL context inside a
  `type:'custom'` layer" pattern the old stadium-mesh loader proved out.
  Auto-falls-back to the flat extrusion above on a missing/invalid key, a
  root-tileset load error, or an 8s timeout (`config.js` →
  `map3d.googleTilesFallbackTimeoutMs`) — see "Google Photorealistic 3D
  Tiles" below for setup and cost.
- **Selection model rebuilt on MapLibre's feature-state** — replaces
  Leaflet's imperative `layer.setStyle()` entirely (see Architecture
  notes). Verified: click-to-select, camera fly, hover, tour-pill sync, and
  the dashed route line all work identically to the Leaflet build in both
  2D and 3D.
- **Reference overlay** (OSM streets/building/POI labels) — same toggle
  button, now a `setLayoutProperty()` visibility swap instead of
  add/removeLayer.

## Google Photorealistic 3D Tiles — setup, cost, and fallback behavior

Off by default (`config.js` → `map3d.googleTilesEnabled: false`). To turn it
on locally:

1. In Google Cloud Console: create/select a project, enable billing, enable
   the **Map Tiles API**, accept the Maps Platform ToS + Map Tiles API
   Policies, create an API key, **restrict it** (HTTP referrer to your
   actual domain, restricted to the Map Tiles API only), and set a
   **daily quota cap**. Do this before enabling anywhere shared — this is
   billed usage (Google's Map Tiles API Enterprise SKU; check the current
   rate in Cloud Console).
2. Copy `config.local.example.js` to `config.local.js` (same folder,
   gitignored) and fill in the real key.
3. Reload — `js/16-google-tiles.js` picks it up automatically once both
   `googleTilesEnabled` and `googleApiKey` are set.

**This only keeps the key out of git history.** Once deployed, `config.js`/
`config.local.js` are still public static JS served to every visitor — the
actual protection is the key's HTTP-referrer restriction and quota cap in
Cloud Console, not secrecy.

**Fallback**: if the key is missing/empty, the app never even attempts to
contact Google (zero network calls — the default state for every fresh
clone). If a key is set but the tileset fails to load — invalid key, quota
exceeded, network failure — `js/16-google-tiles.js` falls back to the flat
extruded-building view automatically (via a `load-error` event on the root
tileset, or an 8s watchdog timeout if no clear error fires) and won't retry
within the same session (only on a full page reload). The `#mapControls`
rail shows a small "3D: Google" / "3D: Simple" badge so it's never
ambiguous which one is active.

## What's still placeholder / follow-up work

1. No `height`/`building:levels` tags exist in `data/buildings.geojson`, so
   the flat-extrusion fallback uses one constant height for every building
   regardless of its real footprint size. A future Overpass re-export
   requesting those tags would let the fallback vary height per building —
   deliberately out of scope for now (the fallback only needs to be
   functional, not impressive, since Google's tiles are the intended
   default 3D experience once configured).
2. `data/tours.geojson`'s 10 stops now use real coordinates from
   `docs/death_valley_stops.csv` (LSU Athletics gameday ops input), not
   desk-research guesses — but the CSV itself flags several as
   `pending`/`derived` confidence rather than `verified` (exact bus
   staging spot in Lot 414, registration room, Tiger Walk guest drop
   point, field-level access gate), and those caveats are carried
   straight into each stop's description in `data/locations.json` so
   they're visible in the app until confirmed on-site. Everything else
   already flagged in the Leaflet build's own README still applies
   unchanged: Treedis has no
   real model/sweeps yet (`config.js` → `treedis.*`, all `sweepId: null` —
   still renders as a graceful info-only panel, no code change needed once
   real sweeps exist), the OSM reference-overlay tile server needs a paid
   provider before production traffic, the deck's exact background
   gradient wasn't sampled (no PDF-page-rendering tool in this
   environment), no LSU seal/logo asset exists yet (falls back gracefully
   already — just drop files in at `assets/Icons/`), and the Learn tab is
   a "coming soon" placeholder.
3. **WebGL on the Operations Facility / Lawton Room kiosk hardware** —
   unconfirmed (see the plan). MapLibre GL JS requires WebGL 1; if those
   kiosks turn out not to support it, that's a hardware/deployment
   question independent of this build. Google's 3D Tiles add a heavier
   Three.js/tiles-renderer payload on top of this — test the actual
   kiosk hardware, not just a dev machine, before enabling Google tiles
   there.
4. The "All" tab building list now includes Tiger Stadium's 3 bowl bands
   as 3 separate named rows ("Tiger Stadium — Upper Deck" / "— Main Bowl" /
   "— Lower Bowl") — harmless but a little odd in the list UI; worth
   filtering those out of the sidebar list (keep them map-only) as a small
   polish pass.

## Rollback

`../LSU/` (the Leaflet build) was never modified during this work and is
still fully deployable as-is. If anything here needs to be backed out, no
rollback action is needed — just keep serving `../LSU/` instead of this
folder. Cutover (replacing `LSU/`'s content with this build, or promoting
this folder) is a deliberate future step, not done as part of this work —
see the plan's §5/§6 for the reasoning (this repo is a static multi-folder
site where every folder is simultaneously live).

## Architecture notes (for whoever picks this up next)

- **No more Leaflet panes** — layer paint order is controlled by
  `addSource`/`addLayer` call order (`js/11-boot.js`,
  `js/07-layer-builders.js`): imagery → reference overlay → buildings →
  tour stops → route line. `maplibregl.Marker` pins are always topmost
  (absolutely-positioned DOM, same as the old pin layer).
- **Selection/hover no longer call `layer.setStyle()`** — MapLibre paints
  a whole layer with ONE declarative expression per paint property.
  `js/02-state.js: styleExpressionsFor()` builds `case`/`match` expressions
  keyed on `feature-state` (`hover`/`selected`, set via
  `map.setFeatureState()`) and a baked-in `__styleVariant` property
  (route/facility/off-campus). This is the single biggest structural
  change from the Leaflet build — see that function's comments before
  touching styling.
- **`fill-extrusion-opacity` does NOT support data-driven/feature-state
  expressions in MapLibre** (only `-color`/`-height`/`-base` do) — this
  bit us during Tier 1: passing a `feature-state` expression there makes
  `map.addLayer()` silently reject the ENTIRE layer with no thrown
  exception (only a `map.on('error', ...)` event, which nothing listened
  for until this was debugged). `js/02-state.js` now has a permanent
  `map.on('error', ...)` logger specifically so this class of bug surfaces
  loudly next time instead of just "the layer never appears." Extrusion
  opacity is a flat constant (0.85) for exactly this reason.
- **Tour stops are still Polygon features** (unchanged from the Leaflet
  build) — `js/02-state.js: boundsOfFeature()`/`centerOfBounds()` replace
  Leaflet's `layer.getBounds()` by scanning the raw GeoJSON ring.
- Every feature (buildings + tour stops) gets a stable numeric `id`
  (`fid`, or array index as fallback) baked in by
  `js/07-layer-builders.js: prepGeoJSON()` — required for
  `map.setFeatureState()` to work at all.
- **There is no offline data-prep pipeline anymore.** An earlier version
  of this project had one (PDAL against public LiDAR for per-building
  heights, plus a separate mesh-reconstruction pipeline for a Tiger
  Stadium model) — it was removed entirely, not hidden, when Google
  Photorealistic 3D Tiles replaced it as the real 3D experience (see the
  top of this README). If you're looking for it, check git history; don't
  resurrect it as a "cheap 3D" option — it was removed because it wasn't
  good enough, not because it was unmaintained.
- **`js/16-google-tiles.js`** is the only three.js/3D-tiles code that ships
  to the browser now. Both three.js and `3d-tiles-renderer` are loaded via
  dynamic `import()` (not `<script>` tags — three.js r150+ dropped its old
  UMD builds) resolved through the `<script type="importmap">` in
  `index.html`'s `<head>`, and only fire when 3D mode is entered AND
  Google tiles are configured (`config.map3d.googleTilesEnabled` +
  `googleApiKey`) — a user who stays in 2D, or whose config doesn't opt
  into Google tiles, never fetches either library. It shares MapLibre's
  WebGL context via a `type:'custom'` layer, the same pattern the
  removed stadium-mesh loader proved out: `new THREE.WebGLRenderer({
  canvas: mapInstance.getCanvas(), context: gl, antialias: true })` inside
  `onAdd`, plus the same MapLibre-projection-matrix handling in `render`.
  Falls back to the flat extruded-building layer
  (`js/07-layer-builders.js`) on any failure — see "Google Photorealistic
  3D Tiles" above for the exact trigger conditions.
