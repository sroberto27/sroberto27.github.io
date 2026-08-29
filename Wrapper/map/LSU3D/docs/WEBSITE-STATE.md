# LSU3D "Death Valley Experience" — State of Knowledge

**Written to be read cold.** If you are a new session or picking this up for the
first time, read this before reading source files from scratch. It synthesizes
the current implementation and points at the authoritative files.

For *why* the architecture is the way it is (the Leaflet → MapLibre migration,
the removed LiDAR pipeline, Google 3D Tiles cost/fallback), `README.md` is the
authority. This file describes *what is here now* and — just as important for
planning work — *what is not here yet*.

---

## 0. Status — read this first

**Phase 1 (Make It Useful) and Phase 2 (Make It Fast) are built, committed and
LIVE.** Phase 3 (a CMS on Cloudflare + Supabase) is **deliberately paused**,
waiting on real information from LSU — see `docs/LSU-INFORMATION-REQUEST.md`.

| | State |
|---|---|
| Phase 1 | Done — deep links, My Gameday, geolocation, Live Visit, kiosk, analytics bus, content contract |
| Phase 2 | Done — basemap 19x smaller, service worker built and shipped **switched off** |
| Phase 3 | **Paused by decision.** Not blocked on code |

### Why Phase 3 is paused

Not for technical reasons. The app runs entirely on placeholder content: the
sample gameday has invented times, `opponent: "TBD"` and blank phone numbers;
`assets/` is empty; no Treedis capture exists. **A CMS is a tool for editing
content that exists, and there is none yet.** Building the editor against a
placeholder schema risks designing for a shape real LSU data will not have.

`docs/LSU-INFORMATION-REQUEST.md` is the questionnaire that unblocks it.

### When it resumes, copy the sibling project

`../dts/dts3/` is a **complete working implementation of this exact
architecture** — Cloudflare Pages + Functions + R2 buckets + Supabase with RLS
migrations, and a `js/admin.js` mini-CMS. Its editing model is: edit in the
board, save a draft to localStorage with live preview, export the data folder,
replace `data/` and push. Later `functions/api/publish.js` writes to R2 with a
real publish endpoint, gated by `requireSiteAdmin`.

Read it before designing anything. It carries lessons only learned by doing —
that file documents hitting Cloudflare's 50-subrequest limit on a full publish
and having to rewrite it diff-based.

**Auth shape, decided:** staff authenticate (Supabase, a `site_role` claim);
**recruits and families must never need an account.** For per-recruit privacy the
answer is signed expiring links validated by a Function, not recruit logins.

---

## 1. What this app is

A single-page map + guided-tour experience for **LSU Football gameday recruiting
visits**. A recruit and their family can preview the visit beforehand and
revisit it afterward; staff can show it on office and facility displays.

The core experience today:

- A MapLibre GL JS map of the LSU football/gameday campus footprint, with a
  **2D ⇄ 3D toggle** on one map instance.
- A **10-stop guided tour** ("the gameday journey") — Lot 414 arrival → charter
  bus → Football Operations Facility → indoor tailgate → registration → Tiger
  Walk → Lawton Room → field-level warmups → kickoff in Tiger Stadium →
  postgame at Nicholson Gateway.
- A left **rail** (desktop) / **bottom sheet** (mobile) listing stops and
  places, with search and category filter chips.
- A **details panel** per stop: tag, title, department/category subtitle,
  description, "what happens here" chips, hero image, address + map links.
- An **immersive "street view"** overlay (Treedis iframe) launched per stop —
  **wired but dormant** (no LSU Treedis model exists yet; see §7).
- A 3D mode that is either **flat extruded OSM buildings** (always available) or
  **Google Photorealistic 3D Tiles** (opt-in, billed; see §8).
- A **"Learn" tab** — a "coming soon" placeholder.
- A first-run **start screen** + **coachmark** walkthrough, and a **burger menu**
  with two persisted settings toggles.

---

## 2. Tech stack and deploy model

**No build step. No framework. No backend. No `package.json`.** Vanilla
HTML + CSS + JS served as static files.

| Layer | What | Where |
|---|---|---|
| Markup | one `index.html` (~990 lines) | `index.html` |
| Styles | 15 numbered CSS files, load in order, later overrides earlier | `css/` |
| App JS | 22 numbered `NN-*.js` files, plain `<script>` tags, **one shared scope** | `js/` |
| Config | `config.js` (structural wiring) + gitignored `config.local.js` (local key override) | repo root of the app |
| Data | 2 GeoJSON + 2 JSON files, plus `data/gamedays/*.json` fetched on demand | `data/` |
| Map engine | MapLibre GL JS 4, from unpkg CDN | `index.html` `<script>` |
| 3D (opt-in) | three.js 0.183.0 + `3d-tiles-renderer` 0.5.1, from unpkg, via importmap + dynamic `import()` | `js/16-google-tiles.js` |
| Fonts | Google Fonts (Inter, Oswald) | `index.html` `<link>` |

**Deployment = `git push`.** The repo `sroberto27.github.io` is a GitHub Pages
**user site**; this app is one folder inside it. Public URL:
`https://sroberto27.github.io/Wrapper/map/LSU3D/`.

- Pages builds from **`main` at the repo root** - confirmed empirically by 22
  successful deploys through it. No `CNAME`, no `.github/workflows/`.
- Every folder in this monorepo is simultaneously live. `../LSU/` (Leaflet
  build), `../NewIberia/`, `../dts/dts3/` etc. are all separate deployed apps.
- There is **no staging environment** for LSU3D today. (The sibling `dts/dts3`
  project has a Cloudflare Pages dev URL; LSU3D does not.)

### Runtime globals worth knowing

- `window.CAMPUS_CONFIG` — the config object (`config.js` seeds it; the data
  adapter augments it with flat lookup maps). Aliased as `const config` in
  `js/01-utils.js`.
- `map` — the single `maplibregl.Map` instance (`js/02-state.js`).
- `el` — cached DOM refs (`js/02-state.js`).
- `TourBridge` — the Treedis postMessage bridge singleton (`js/03-tour-bridge.js`).
- `tourStops`, `tourIndex`, `selectedFeature`, `is3DMode`, `active3DRenderer`,
  `streetViewActive` — module-level mutable state in `js/02-state.js`.
- `window.__captureView()` — dev helper: prints the current camera as a
  paste-ready `config.js` snippet.
- `window.setAppMode("explore" | "learn")`, `window.__niApplyCategoryFilter`,
  `window.__niOnListRendered` — cross-file hooks.
- **Phase 1 services** (all on `window`, all defined in `js/15`–`21`):
  `Core` (`onReady`, `track`, `store`, geo math), `track()` as a bare global,
  `Router`, `Gameday`, `Geo`, `LiveVisit`, `Kiosk`.
- `window.onAppReady()` — fired once at the end of `boot()` (guarded with
  `typeof`), the hook every Phase 1 feature initialises from. **`boot()` is
  called at parse time, before scripts 12+ have executed**, so nothing in boot
  may assume a later module loaded, and `Core.onReady()` supports late
  registration for the same reason.

---

## 3. File-by-file map of `js/`

Loaded in this exact order (see `index.html` bottom). They share one scope.

| File | Lines | Responsibility |
|---|---|---|
| `00-data-adapter.js` | 205 | **The data seam.** `loadDataJSON()` fetches `locations.json` + `treedis-sweeps.json` (+ optional `courses.json`) and rebuilds the flat lookup maps on `CAMPUS_CONFIG`. "When a CMS lands, replace `loadDataJSON()` with `loadDataFromCMS()` and nothing else changes." |
| `01-utils.js` | 339 | `const config`. **XR/VR detection** (`isXRUserAgent()`, `detectXRAsync()`, `applyTreedisProfile()`, `maybeUpgradeToVRProfile()`, `isVRMode()`) and the desktop/vr Treedis profile switch. Name helpers: `cleanName`, `getCategory`, `getDescription`, `getHappensHere`, `getDepartments`, `getImage`, `getExplorable`, `getAddress`, `getTreedisEntry`, `hasSweep`, `escapeHTML`. |
| `02-state.js` | 396 | Constructs `map`. `LAYER_IDS` / `SOURCE_IDS` constants. `el` DOM refs. `isMobile()` (`max-width: 880px`). Style-expression builders (`styleVariantFor`, `styleExpressionsFor` — MapLibre `case`/`match` expressions keyed on `feature-state` + baked `__styleVariant`). `boundsOfFeature`, `centerOfBounds`, `padBounds`. All module-level state vars. A permanent `map.on("error")` logger. |
| `03-tour-bridge.js` | 129 | `TourBridge` singleton: postMessage protocol with the Treedis iframe. Ping every 2s until `TourReady`, then flush a pending sweep after a 600ms defer. Handles `PoseChanged` → `syncWrapperToSweep()`. |
| `04-street-view.js` | 414 | Street-view overlay controller. `preloadTreedisIframe()` (sets `#tour-frame` src once from `config.treedis.tourUrl`), `openStreetView()`, `closeStreetView()`, `navigateStreetViewToLayer()`, `syncWrapperToSweep()`, sub-location handling, loading veil, touch guard. |
| `05-map-helpers.js` | 167 | `refreshMapConstraints()` / `resetCampusView()` (maxBounds + minZoom clamping). **`set3DMode(on)`** — the 2D/3D toggle: lazy terrain-source add, `easeTo({pitch})`, fill ⇄ fill-extrusion visibility swap, then `applySimplified3DFallback()` + `activateGoogleTilesMode()`. `applyMap2DStartView()`. `window.__captureView()`. |
| `06-details-panel.js` | 496 | `openDetails()`/`closeDetails()`/`setDetailsMode()` (mobile half/full sheet). `renderDetails()` — builds the whole panel incl. address links (Google / Apple / `geo:`), explorable sub-list, "what happens here" chips, image. **`selectFeature(sel, kind, {focus})`** — the one seam every selection path goes through: sets feature-state, renders + opens details, flies the camera (2D `fitBounds` or 3D `easeTo` with optional per-stop `cam3d` preset), syncs list + tour index + pins + street view. `clearSelection()`. |
| `07-layer-builders.js` | 333 | `prepGeoJSON()` (bakes numeric `id`, `__styleVariant`, `__height` onto every feature). `addSourceAndLayers()` (one GeoJSON source + a **fill / fill-extrusion layer pair** per collection; note `fill-extrusion-opacity` must be a flat constant — feature-state there silently rejects the whole layer). `bindLayerEvents()` (delegated hover/click). **`buildTourPins()`** — numbered `maplibregl.Marker` pins; **co-located stops collapse into one expandable cluster pin** (3–5 at Ops, 8–9 at stadium share footprints). `highlightActivePin()`. |
| `08-tourbar.js` | 153 | Tour state machine render: `updateTourbar()`, `renderTourDots()`, `renderRailTourCard()`. `goToStop(i)`, `tourPrevAction()`, `tourNextAction()`. |
| `09-sidebar-search.js` | 654 | The rail locations list (`renderLocationsList`, `renderAllLocationsList`), the "All" tab with alpha/department sort, search + autocomplete over `allFeatures`, mobile drawer open/close, search panel. |
| `10-event-wiring.js` | 217 | All DOM event binding: tour buttons, Explore CTA, VR button (shows an `alert()` with the tour URL), close buttons, fit button, search input, Explore/Learn mode pills, resize, help button (`alert()`), fullscreen toggle, 2D/3D toggle, **keyboard shortcuts** (`←`/`→` tour, `Esc` closes panels), bare-map-click → `clearSelection()`. |
| `11-boot.js` | 434 | `boot()`. `tryFetchGeoJSON()` (uses `cache: "no-cache"`). `loadAllData()` (parallel geometry + content fetch). `waitForMapLoad()`. Image preloader with per-asset timeout + splash progress. `warmHomeSweep()` (waits up to 60s for `TourReady`, then warms the home sweep). Adds background → imagery → reference-overlay → buildings → tours layers in paint order. Computes `dataBounds` / `imageBounds`. Builds pins, lists, search index. 15s splash hard-cap. Reveals app → shows start screen. |
| `12-start-screen.js` | 852 | First-run start-screen modal + the coachmark step-through walkthrough. Two localStorage-persisted settings (`show start screen`, `show nav instructions`) wired to the burger-menu toggles. |
| `13-learn-mode.js` | 39 | Just wires the Explore/Learn pill to show/hide the `#learnShell` "coming soon" placeholder. `window.setAppMode()`. |
| `14-redesign.js` | 528 | **Loads last; wraps functions by reassignment.** The "map-first redesign" glue: filter chips from categories, mobile PEEK sheet, guided-tour pill + rail card wiring, the **dashed gold route line** between stop centroids, custom map controls (zoom / locate / layers / 3D / recenter) replacing MapLibre defaults, Share / Google-Maps / Add-to-tour actions on the details panel (wraps `renderDetails`), and the **street-view picture-in-picture mini-map** (a second non-interactive `maplibregl.Map`). |
| `15-core-services.js` | 330 | **Phase 1 spine.** `Core.onReady()` (fired by `boot()`), the `track()` analytics bus + swappable sink (no-op in production), namespaced `Core.store` localStorage that never throws, and geo math (`haversineFt`, `bearingDeg`, `compassPoint`, `walkMinutes`, `formatDistance`). No DOM, wraps nothing. |
| `16-google-tiles.js` | 742 | The only three.js code that ships. `activateGoogleTilesMode()` / `deactivateGoogleTilesMode()`. A MapLibre `type:'custom'` layer wrapping `3d-tiles-renderer`'s `GoogleCloudAuthPlugin`, sharing MapLibre's WebGL context. Auto-fallback to flat extrusion on missing/invalid key, root-tileset load error, or timeout. `sessionStorage` flag so a failed session doesn't retry. Mode badge. |

| `17-router.js` | 400 | Query-param router: `?stop= / ?g= / ?n= / ?mode= / ?autoplay= / ?src=`. `slugify()` + `stop_key` lookup, `history.pushState` per selection, `popstate`, unknown-param stripping, the toast. Wraps `selectFeature`, `clearSelection`, `renderDetails` (Share now shares a deep link). |
| `18-gameday.js` | 400 | My Gameday. Loads `data/gamedays/<id>.json` via the adapter when `?g=` is present; decorates the existing `#railTour` card with greeting/countdown/now-next/contacts, adds times to the checklist and an instruction to the details panel. Persists visited stops. Wraps `updateTourbar`, `renderDetails`, `selectFeature`. |
| `19-geolocation.js` | 300 | `Geo`: one-shot `locate()`, `requestWatch()`/`releaseWatch()` (Live Visit only, stops on tab hide), marker + geographic accuracy-ring polygon, `toStop()` / `nearestStop()`. Denial is remembered and never re-prompted; coordinates are never stored or sent. |
| `20-live-visit.js` | 290 | Live Visit Mode (`?mode=live`). Mobile-first top bar: you-are-here, current stop, next + distance/bearing/walk time, progress, call-staff, exit. A view over Gameday + Geo + tour state — owns no navigation. |
| `21-kiosk.js` | 300 | Kiosk mode (`?mode=kiosk[&autoplay=1]`). Auto-advance timer over `goToStop()`, loop, pause-on-touch, idle reset, oversized controls, fullscreen on first gesture, Esc / triple-corner-tap exit. |

*(There is no `css/06-*.css` — a numbering gap, not a missing file. The `js/15-*.js` gap was filled by `15-core-services.js` in Phase 1.)*

---

## 4. Map architecture

- **One `maplibregl.Map`**, style built entirely from our own sources
  (`style: {version: 8, sources: {}, layers: []}`). `pitch: 0` = 2D,
  `easeTo({pitch: 60})` = 3D. Same instance, same markers, same selection — no
  two-map sync.
- **Paint order = layer add order** (`js/11-boot.js`): `background` (neutral
  ground) → `imagery` (DOTD aerial) → `reference-overlay` (OSM labels, hidden by
  default) → `buildings` fill + fill-extrusion pair → `tours` fill +
  fill-extrusion pair → `route-line` (added by `14-redesign.js`, hidden until a
  tour runs). `maplibregl.Marker` pins are always topmost (DOM).
- **Imagery**: Louisiana DOTD 2025 6-inch aerial, a *dynamic* ImageServer
  (`exportImage` REST op) hit per-tile via MapLibre's `{bbox-epsg-3857}`
  template - no Esri plugin. `bandIds=0,1,2` drops the near-IR band.
  **Served as `format=jpg` at 512px since Phase 2** - it was `png32` at 256px,
  measured at 156 KB per tile against 17 KB for the same tile as JPEG. That was
  ~95% of the page weight (~5.5 MB per viewport, now ~0.29 MB). `maxZoom` is 20,
  not 21, because ground resolution is `2^zoom * tileSize`.
- **Reference overlay**: raw `tile.openstreetmap.org` raster tiles (the only
  open source with building/POI labels). **PLACEHOLDER** — OSM's tile policy
  discourages production traffic; swap for a keyed provider before real recruit
  traffic.
- **Terrain**: AWS public Terrarium DEM tiles, added **lazily on first 3D
  entry** only.
- **Selection / hover**: `map.setFeatureState({selected/hover})` + one
  declarative paint expression per property (`js/02-state.js:
  styleExpressionsFor()`). No imperative per-feature styling.
- **Extent / camera**: `config.map3d.bounds` → `imageBounds` → `setMaxBounds()`
  + `setMinZoom()`. `map2dStartView` and `google3DStartView` are fixed camera
  poses (retune with `__captureView()`).

---

## 5. Tour architecture (the thing new features must reuse)

**State lives in three module-level vars in `js/02-state.js`:**

- `tourStops` — `[{ feature, featureId, order, pinNode }]`, sorted by
  `order_num`, built by `buildTourPins()` from `data/tours.geojson`.
- `tourIndex` — current stop index, or `-1` when no tour is running.
- `selectedFeature` — `{ sourceId, kind, featureId, feature } | null`.

**The one selection seam:** `selectFeature(sel, kind, {focus})` in
`js/06-details-panel.js`. Every path — map click, rail list row, search result,
tour arrow, PEEK card, cluster pin — calls it. It renders the details panel,
flies the camera, sets `tourIndex` from `tourStops.findIndex(...)`, and updates
the tour bar, pins, and (if open) the Treedis camera.

**Tour navigation:** `goToStop(i)` → `selectFeature(...)`. `tourPrevAction()` /
`tourNextAction()` clamp and delegate. Bound to desktop + mobile arrow buttons
and the `←`/`→` keys.

**Render targets** (all driven by `updateTourbar()`, which `14-redesign.js`
wraps to also sync the route line, rail card, mobile stepper, and mini-map):
the sidebar-footer counter, the mobile `.tourbar`, the bottom-center
guided-tour pill (progress dots), and the desktop rail tour card (Stop X of Y,
gold progress bar, clickable checklist).

**Data:** `data/tours.geojson` — 10 Polygon features, `properties`:
`fid`, `name`, `tour_group` (`"mainTour"`), `order_num` (1–10),
`description` (all `null`), optional `cam3d: {bearing, pitch, zoom}` (only stop
9 has one). Stops 3/4/5 and 8/9 share identical footprint polygons on purpose.
Coordinates come from `docs/death_valley_stops*.csv` (LSU Athletics gameday-ops
input) — several flagged `derived` / `pending` confidence, not `verified`.

**Per-stop content:** `data/locations.json` — matched to GeoJSON features by
**lowercased `name`** (via the `key` field). Fields: `id`, `key`, `name`,
`category` (`ROUTE` | `FACILITY`), `description`, optional `happensHere[]`,
optional `address`, `image` (all empty today).

---

## 6. Phase 1 gameday features (built) and what still does NOT exist

**Phase 1 of the gameday evolution has been implemented** — see
`docs/plans/GAMEDAY-EVOLUTION-PLAN.md` for the approved plan and
`docs/DATA-SCHEMA.md` / `docs/CONTENT-EDITING.md` for the data contract.

### Built

| System | State |
|---|---|
| **URL routing / deep links** | `js/17-router.js`. Query params only (no hash, no clean paths, so no server rewrites): `?stop=`, `?g=`, `?n=`, `?mode=live\|kiosk`, `?autoplay=1`, `?src=qr\|nfc\|email\|sms\|web`. Selection `pushState`s, so browser back/forward now step through visited stops. Unknown params are stripped; an unknown stop shows a toast and opens the full map. Share copies the deep link. |
| **Stable stop slugs** | `stop_key` on every feature in `data/tours.geojson` (`lawton-room`, `tiger-walk-victory-hill`, …). This is what a printed QR code carries, so **a stop_key can never change once codes exist.** Falls back to `slugify(name)` when absent. |
| **Analytics** | `js/15-core-services.js` — first-party `track(event, props)` bus with a swappable sink. **Production sink is a no-op: nothing leaves the device**, no third-party script, no cookie, no cross-visit id, so no consent banner is required. `?debug=1` attaches a console sink. `sessionId` is sessionStorage-scoped. Fixed event vocabulary in `docs/plans/GAMEDAY-EVOLUTION-PLAN.md` §D. |
| **My Gameday** | `js/18-gameday.js`. Inert unless `?g=<id>`. Loads `data/gamedays/<id>.json` through `js/00-data-adapter.js: loadGamedayJSON()`; decorates the existing `#railTour` card (greeting, kickoff countdown, now/next, contacts) and adds times to its checklist plus an instruction block to the details panel. Visited stops persist in localStorage. **Not a second stop list** — it layers times onto `tourStops`. |
| **Live Visit Mode** | `js/20-live-visit.js`, `?mode=live` or the "I'm on campus" button. Mobile-first top bar; hides browse chrome; reads Gameday + Geo + tour state and moves via `goToStop()`. |
| **GPS / "You are here"** | `js/19-geolocation.js`. Persistent marker + geographic accuracy-ring polygon. On-demand one-shot by default; `watchPosition` **only** while Live Visit is open, stopped on `visibilitychange`/`pagehide`. Denial is remembered and never re-prompted. Fixes worse than `config.gameday.poorAccuracyM` are shown as approximate and suppress distance readouts. Coordinates are never persisted and never sent anywhere. |
| **Kiosk / presentation mode** | `js/21-kiosk.js`, `?mode=kiosk[&autoplay=1]`. Timer over `goToStop()`, loop, pause-on-touch, idle reset to stop 1, oversized controls, Esc / triple-corner-tap exit. Fullscreen needs a user gesture (browser rule), so the first tap does it. |
| **Content contract + validator** | `docs/DATA-SCHEMA.md`, `docs/CONTENT-EDITING.md`, and `scripts/validate-data.mjs` (run by hand: `node scripts/validate-data.mjs`; **not** a build step). It catches misspelled stop keys, bad times, a missing timezone, and personal data in a public gameday file. |
| **Feature flags** | `config.gameday.enable*` — the fastest rollback if a feature misbehaves in front of a recruit. Timings (kiosk dwell/idle, arrival radius, accuracy threshold) live there too. |

### Still does NOT exist

| System | Current state |
|---|---|
| **Staff analytics dashboard** | The bus and event vocabulary exist; there is **no UI and no storage**. With the no-op sink, no data is retained anywhere. Needs a backend. |
| **Real CMS** | `data/*.json` is hand-edited and git is the version history. No login, roles, drafts, publishing, scheduling, preview, or media upload. |
| **Auth / staff access control** | Fully public static site. Kiosk mode's exit gesture is a convenience, not a permission boundary — nothing privileged sits behind it. |
| **Per-recruit private content** | `?g=` ids are guessable and every file in `data/` is world-readable. Gameday files therefore carry **role + published department line only**, never a personal name, mobile or email (enforced by the validator). Real privacy needs auth. |
| **Service worker / PWA** | **BUILT, shipped OFF.** `sw.js` + `js/22-service-worker.js`, gated by `config.gameday.enableServiceWorker: false`. Scope is `/Wrapper/map/LSU3D/` only - the origin also serves `../LSU/`, `../NewIberia/`, `../dts/`. Kill switches: flip the flag, or `?sw=off` with no deploy. |
| **Data Saver / network awareness** | **Nothing.** No code reads `navigator.connection`, `effectiveType`, or `saveData`. Phase 2. |
| **Bundling / minification** | None, and **deliberately deferred**: it is unknown whether GitHub Pages serves HTTP/2 (local curl could not test it; TEST-PLAN H17 records it). Under HTTP/2, bundling 22 files buys little. Payload is not the problem - all first-party JS+CSS is ~120 KB gzipped. |
| **Walking routes** | Distance and direction are straight-line (haversine + bearing). No routing API — deliberate: no key, no dependency, no per-request cost. Whether real walking routes are needed is **NEEDS CONFIRMATION**. |
| **Cloudflare / Supabase / CMS** | **Paused by decision**, pending `docs/LSU-INFORMATION-REQUEST.md`. Architecture settled: copy `../dts/dts3/`. Staff authenticate; recruits never do. |
| **Image assets** | `assets/Icons/logo.png` still 404s and degrades gracefully. `config.imageMap` is empty, so every stop shows the placeholder frame. |
| **Real Treedis model** | See §7 — unchanged; config keys empty, iframe never loads. |
| **Real gameday data** | `data/gamedays/sample-gameday.json` is a **placeholder** — every time is illustrative and both contact numbers are blank. Real dates, times and numbers are NEEDS CONFIRMATION with LSU staff. |

## 7. Treedis integration (wired, dormant)

- **One shared model** for the whole tour; each stop is a *sweep* inside it, not
  a separate embed. One iframe (`#tour-frame`), one `TourBridge`.
- `config.treedis` has `profiles.desktop` and `profiles.vr`, each with
  `modelId` / `tourUrl` / `homeSweepId` — **all empty strings / null today**.
  `config.treedis.origin` is `""` (so inbound-message origin validation is
  skipped). `defaultTransitionTime: 0`.
- `data/treedis-sweeps.json` — one entry per stop, every `sweepId` is `null`.
- Because `tourUrl` is empty, `preloadTreedisIframe()` logs a warning and never
  sets `src`; the iframe stays blank. `hasSweep(name)` is false for every stop,
  so the "Explore" CTA and VR row are hidden everywhere — the details panel is
  info-only. This is the correct graceful state until a real capture exists.
- **To go live:** fill `config.treedis.profiles.*` (`modelId`, `tourUrl`,
  `homeSweepId`) and `origin`, then fill each stop's `sweepId` in
  `data/treedis-sweeps.json`. No code change needed.
- The VR button (`#vrBtn`) currently just shows a `window.alert()` with the tour
  URL and instructions.

---

## 8. Google Photorealistic 3D Tiles

- Off unless `config.map3d.googleTilesEnabled` **and** `googleApiKey` are set.
  **In this repo `config.js` ships with `googleTilesEnabled: true` and a real
  key** (`AIzaSy…`) — see `README.md` for the referrer-restriction + billing-cap
  reasoning. The key is public static JS regardless; `config.local.js` only
  keeps it out of git history for local forks.
- Rendered via `3d-tiles-renderer` + three.js inside a MapLibre `type:'custom'`
  layer sharing the WebGL context. Loaded via dynamic `import()` **only** when
  3D mode is entered and Google tiles are configured — a 2D-only user never
  fetches three.js.
- **Fallback is automatic and layered:** entering 3D always shows the flat
  extruded-building view first; Google tiles replace it async once the root
  tileset settles; any failure (bad key, quota, network, `googleTilesMaxWaitMs`
  20s timeout, `googleTilesQuietMs` debounce) falls back to the flat view and
  won't retry that session. The `#mode3DBadge` shows "3D: Google" / "3D: Simple".
- **Each Google tiles session is billed** (Map Tiles API). On slow connections a
  session can be paid for but never finish — this is the central concern of
  `docs/LSU_Mobile_4G_Audit_Prompt.md` and Phase 2 of the evolution plan.

---

## 9. VR / WebXR

- **Detection only — there is no in-app WebXR renderer.** `js/01-utils.js` does
  defense-in-depth headset detection: a sync UA-token check
  (`OculusBrowser|Quest|Pico|" VR "`) at module load, plus an async
  `navigator.xr.isSessionSupported("immersive-vr")` confirmation from `boot()`,
  gated by `isPlausibleHeadsetUA()` so a desktop PC with SteamVR/WMR installed
  isn't misclassified.
- The only effect of "VR mode" is: pick the `treedis.profiles.vr` config
  profile (different model/sweeps) and add `body.xr-mode` for CSS. The immersive
  experience itself is Treedis's, viewed in the headset's browser — the app
  doesn't start an `immersive-vr` session itself.

---

## 10. Mobile architecture

- Breakpoint: `matchMedia("(max-width: 880px)")` → `isMobile()`.
- The rail (`#locations`) becomes a **bottom sheet** with a grabber; the details
  panel (`#details`) becomes a **draggable half/full sheet**
  (`setDetailsMode("half"|"full")`); they are mutually exclusive.
- Tour navigation on mobile is a compact stepper *inside* the details sheet
  (`#detailsTourStepper`), not the desktop rail card.
- A floating search pill, a mobile filter-chip row, and a PEEK sheet of
  horizontal photo cards (`renderPeekCards()`).
- **Not yet audited on real devices** — per `docs/LSU_Mobile_4G_Audit_Prompt.md`,
  every screenshot in this project's history has been desktop-width. Responsive
  layout correctness and slow-4G behavior are unverified.

---

## 11. Loading sequence (`boot()` in `js/11-boot.js`)

1. `await maybeUpgradeToVRProfile()` (async WebXR check), set `body.xr-mode`.
2. `preloadTreedisIframe()` — no-op today (empty `tourUrl`).
3. `Promise.all([loadAllData(), waitForMapLoad()])` — parallel: fetch
   `buildings.geojson` + `tours.geojson` + `loadDataJSON()` (content) / wait for
   MapLibre `load`.
4. Add layers in paint order; build extrusion pairs; compute bounds; apply
   `map2dStartView`; `refreshMapConstraints()`.
5. `buildTourPins()`, `renderLocationsList()`, `renderAllLocationsList()`, build
   the search index (`allFeatures`).
6. Preload per-location images (`config.imageMap` — empty today) with a 15s
   hard-cap race.
7. Detached: `warmHomeSweep()` (waits ≤60s for `TourReady`).
8. `requestAnimationFrame` → reveal `#app`, hide `#splash`, then show the start
   screen after 220ms, then call `onAppReady()` — which applies the deep link,
   loads a `?g=` itinerary, and enters `?mode=live` / `?mode=kiosk` if asked.

Nothing here is code-split or deferred beyond three.js/Google-tiles and the
lazy terrain source. All 16 JS files and 11 CSS files load on first paint.

---

## 12. Known technical debt relevant to the evolution work

- **No routing layer** — deep links, kiosk auto-start, and shareable stop URLs
  all need one built from scratch. `history` / hash state must be reconciled
  with `selectFeature()` / `goToStop()` without creating a second navigation
  system.
- **`js/14-redesign.js` wraps functions by reassignment** (`updateTourbar`,
  `renderDetails`, `openStreetView`). Any new module that also needs to hook
  those must load *after* it and follow the same wrap-don't-replace pattern, or
  the load order breaks.
- **Content is split across `config.js` and `data/*.json`** with no schema
  validation. `locations.json` matches geometry by lowercased `name` string —
  fragile if a stop is renamed. Normalizing to clean, versioned JSON is the
  pre-CMS step Phase 1 calls for.
- **`cache: "no-cache"` on every data fetch** (`tryFetchGeoJSON`,
  `tryFetchJSON`) — fine for a hand-edited prototype, wrong for versioned assets
  behind a CDN. Phase 2 item.
- **`assets/` is empty** — the logo/seal references 404. Real image assets and
  an optimization pipeline don't exist.
- **OSM tile server** used directly for the label overlay — needs a keyed
  provider before production.
- **Google Maps API key is committed in `config.js`.** Intentional (see
  `README.md`) but worth restating for any security review.
- **No baseline tag.** `git tag` is empty. The evolution plan's rollback
  strategy needs a `baseline/github-pages-YYYY-MM-DD` tag created before Phase 1
  work starts. Recent LSU3D commits: `bf3954bf` (3D zoom control sizing + tour
  pins), `fa0c9908` (enable Google tiles in prod), `2f749e43` (initial LSU3D +
  LSU Leaflet build).
- **No tests, no CI, no lint.**

---

## 13. Where to go next

| You want to… | Read |
|---|---|
| Understand *why* 3D / LiDAR / Google tiles are the way they are | `README.md` |
| Plan the gameday evolution (Phase 1 / Phase 2 / migration) | `docs/plans/GAMEDAY-EVOLUTION-PROMPT.md`, run in Plan Mode |
| Work the narrower mobile / slow-4G perf audit | `docs/LSU_Mobile_4G_Audit_Prompt.md` |
| See the tour-stop source data + confidence flags | `docs/death_valley_stops.csv`, `docs/death_valley_stops_updated.csv`, `docs/death_valley_stops.geojson` |
| See the journey visualization | `docs/LSU_Death_Valley_Journey_Map.svg` |
| Know the working rules and do-not-break list | `CLAUDE.md` |
| See a sibling project that already did a Cloudflare + Supabase migration | `../dts/dts3/` (`CLAUDE.md`, `docs/WEBSITE-STATE.md`) — reference only, not shared infra |
