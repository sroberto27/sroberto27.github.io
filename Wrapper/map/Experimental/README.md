# SCSU Virtual Campus

An interactive web map of the South Carolina State University campus, pairing a 2D Leaflet map with embedded Treedis 3D street-view tours. The app supports two modes — **Explore** (walk the campus, click buildings, drop into 360° sweeps) and **Learn** (a course catalog that links classroom content to immersive VR experiences). Desktop, tablet, mobile, and WebXR headsets (Meta Quest) are all first-class targets.

\---

## Features

* **Interactive Leaflet map** rendered from local tiles (zoom 15–20) over a 2023 RGB aerial of Orangeburg, SC.# SCSU Virtual Campus

An interactive web map of the South Carolina State University campus, pairing a 2D Leaflet map with embedded Treedis 3D street-view tours. The app supports two modes — **Explore** (walk the campus, click buildings, drop into 360° sweeps) and **Learn** (a course catalog that links classroom content to immersive VR experiences). Desktop, tablet, mobile, and WebXR headsets (Meta Quest) are all first-class targets.

\---

## Features

* **Interactive Leaflet map** rendered from local tiles (zoom 15–20) over a 2023 RGB aerial of Orangeburg, SC.
* **Building \& tour layers** loaded from GeoJSON, with hover previews, tooltips, and a clickable locations sidebar.
* **Treedis 3D sweeps** embedded via iframe — click a building or tour stop to drop into 360° street view at the right sweep ID.
* **Dual Treedis profiles** — separate desktop (`8e4ca3fc`) and VR (`scsu-campus-ade0f346`) models, auto-selected at boot by user-agent inspection and `navigator.xr.isSessionSupported('immersive-vr')`.
* **Learn mode** — a course catalog (currently `NRM 342 Agronomy \\\& Soils`) that pairs syllabus-style content with deep links into the immersive VR experience.
* **File:// fallback** — the app works without a server: GeoJSON is also shipped as `data/\\\*.js` shims that assign onto `window.SCSU\\\_DATA`, so opening the HTML directly from disk still boots.
* **Splash / progress screen, burger menu, search, and align tools** built in.

\---

## Repository layout

The application code lives in three folders — `js/` (13 numbered scripts), `css/` (11 numbered stylesheets), and `data/` (geometry + per-location content) — with `map.html` and `config.js` at the root. See the *Deployment* section below for the full tree.

|File|Purpose|
|-|-|
|`map.html`|HTML shell — splash screen, app chrome, metabar, sidebar, Leaflet container, Treedis iframe slot. Deploys as `index.html`.|
|`js/`|Main application, split across 13 numbered files (\~3,800 lines total) that load in order via plain `<script>` tags. The split is purely organizational — every file shares the same global scope as if they were one file. See *JS file layout* below for what each file owns.|
|`config.js`|Structural settings — brand strings, tile config, map bounds, Treedis SDK plumbing, Leaflet layer styles, UI flags. Loaded *after* the data files so it can merge into `window.CAMPUS\\\_CONFIG`.|
|`css/`|All visual styling, split across 11 numbered files (\~3,500 lines total) that load in order via `<link>` tags. Order matters because of the CSS cascade — later files override earlier ones, mirroring the original single-file order.|
|`buildings.geojson`|Building footprint polygons (EPSG:4326). Source of truth when served over HTTP.|
|`tours.geojson`|Tour-stop polygons (EPSG:4326).|
|`locations.js`|Per-location content — `descriptionMap`, `imageMap`, `categoryMap`, `happensHereMap`, `explorableMap`. Edit this file to change copy without touching app plumbing.|
|`treedis-sweeps.js`|Per-location sweep IDs, split into `desktop` and `vr` profile tables.|
|`courses.js`|Learn-mode course catalog.|

### JS file layout

The `js/` directory holds 13 numbered files. They are plain `<script>`s (not ES modules), so every top-level `const`, `let`, and `function` is a global shared across files — the split is purely about giving each topic its own file. Loading is strictly in numeric order; see *Loading order* below for why.

|File|Purpose|
|-|-|
|`01-utils.js`|XR / VR detection, Treedis profile selection, EPSG:3857 → 4326 reprojection, name/category/description/image/explorable lookup helpers, `escapeHTML`.|
|`02-state.js`|Creates the Leaflet `map` and its panes, the `el` object of DOM references, the `mqMobile` media query, `isMobile()`, `styleFor()` / `hoverStyleFor()`, and every module-level `let` of mutable state (selected layer, tour stops, drawer mode, align state, etc.).|
|`03-tour-bridge.js`|`TourBridge` — the `postMessage` wrapper around the Treedis iframe. Handles Ping / Navigate / RequestSweeps outbound and TourReady / PoseChanged / SweepsChanged / Tag\\\* events inbound.|
|`04-street-view.js`|`openStreetView()` / `closeStreetView()`, the loading-veil escalation timers (8s → "slow connection" copy, 25s → Cancel button), pending-sweep queueing while Treedis is still booting, and `navigateStreetViewToLayer()` / `openSubLocationInStreetView()`.|
|`05-map-helpers.js`|`refreshMapConstraints()`, `getCampusCoverZoom()`, `getCampusOffsetCenter()`, `resetCampusView()`, `scheduleMapRefresh()`.|
|`06-details-panel.js`|`renderDetails()` and its sub-renderers (`renderHappensHere`, `renderImage`, `renderExplorable`), plus `selectFeature()` / `clearSelection()` and the open/close/mode switching for the right-side panel.|
|`07-layer-builders.js`|`bindEvents()`, `buildLayer()`, `computeImageBounds()`, `buildTourPins()`, `highlightActivePin()`.|
|`08-tourbar.js`|`updateTourbar()`, `goToStop()`, `tourPrevAction()`, `tourNextAction()` — shared between the desktop sidebar footer and the mobile tour bar.|
|`09-sidebar-search.js`|Desktop locations list, "All buildings" tab, mobile drawer, mobile details drag/slide, mobile search toggle, and the search input + results renderer. This is the first file with top-level event bindings — it requires `el` and `mqMobile` from `02`.|
|`10-event-wiring.js`|Most remaining event listeners: explore CTA, VR button, tour-arrow buttons, fullscreen, help, etc., plus the dev-only image-alignment tool UI (the `alignUI` object, `nudge()`, `scaleBy()`, copy/save handlers).|
|`11-boot.js`|`loadAllData()`, the `preloadImage` / `waitForTreedisReady` / `warmHomeSweep` / `preloadAllAssets` helpers, the `addBaseTileLayer()` helper, and the `boot()` function that wires everything together at startup.|
|`12-start-screen.js`|First-run welcome modal, the 3-step coachmark walkthrough, the "Don't show again" preference plumbing, the navigation-instructions modal, and the burger-panel Settings reset. Ends with `boot().catch(...)` — this is what actually kicks the app off.|
|`13-learn-mode.js`|Self-contained IIFE for the Learn-mode course catalog (list + detail view). Reads `window.SCSU\\\_DATA.courses` and degrades gracefully if `data/courses.js` is missing.|

### CSS file layout

The `css/` directory holds 11 numbered files, loaded in order via `<link>` tags. CSS has no scope, only the cascade — later rules override earlier ones — so order matters and matches the original single-file order.

|File|Purpose|
|-|-|
|`01-base.css`|CSS custom properties (palette, typography, structural sizes), splash / title screen, top-level app grid.|
|`02-header.css`|Metabar (top header), Explore / Learn mode-toggle pill, burger slide-in panel.|
|`03-sidebar.css`|`.shell` layout, locations sidebar (dark theme), list rows, category headers.|
|`04-map-details.css`|Map area, right-side details panel (chips, sub-list, explore CTA), persistent button bar, tour-arrow buttons, bottom tourbar.|
|`05-leaflet-responsive.css`|Leaflet overrides, desktop breakpoints, and the full mobile (≤ 880px) layout.|
|`06-align-tool.css`|Image-alignment dev tool (kept as-is; only used when `mapMode !== "tiles"`).|
|`07-streetview-xr.css`|Treedis street-view overlay and XR / VR mode rules (street view takes over the details column on Quest).|
|`08-start-coachmark.css`|First-run start screen, coachmark spotlight + card system, "Don't show again" checkbox styling.|
|`09-burger-settings.css`|Burger panel — Settings group and toggle-switch styling.|
|`10-nav-instructions.css`|3D street-view onboarding modal.|
|`11-learn-mode.css`|Learn-mode course catalog — list, detail view, action bar, all responsive variants.|

### Loading order

The HTML loads stylesheets and scripts in this order, which matters for both reasons:

* **CSS** — later files override earlier ones via the cascade, so the `css/01..11` order mirrors the original single-file order.
* **JS** — the data files seed `window.CAMPUS\\\_CONFIG` / `window.SCSU\\\_DATA`, `config.js` merges into them, and then the 13 numbered `js/` files load in order. Because they're plain `<script>` tags (not modules), every file shares the same global script scope; each one can call functions and read state defined by any earlier-loaded file.

```
leaflet.css  →  css/01-base.css → … → css/11-learn-mode.css

leaflet.js  →  data/buildings.js, data/tours.js, data/courses.js,
              data/locations.js, data/treedis-sweeps.js
           →  config.js
           →  js/01-utils.js → js/02-state.js → … → js/13-learn-mode.js
```

The `js/01..13` numeric order is not cosmetic — it encodes the dependency chain. For example, `js/09-sidebar-search.js` has top-level `el.locationsToggle.addEventListener(...)` calls; those require `el` from `js/02-state.js` to already exist at parse time. Renumbering or reordering the script tags will break the page.

\---

## Data flow

1. **At module load** `js/01-utils.js` inspects the user agent for `OculusBrowser`, `Quest`, or `VR` tokens and tentatively picks a Treedis profile.
2. **At boot** `js/11-boot.js` confirms with `navigator.xr.isSessionSupported('immersive-vr')` and upgrades to the VR profile if WebXR is available. `config.treedis.modelId` and `config.treedis.tourUrl` are rewritten to the active profile; the legacy `treedisMap` alias is repointed to the matching sweep table.
3. **Geometry** is loaded by `fetch()` from `data/buildings.geojson` and `data/tours.geojson`. If `fetch` fails (e.g. `file://` origin), the app falls back to `window.SCSU\\\_DATA.buildings` / `.tours` populated by `data/buildings.js` and `data/tours.js`.
4. **Per-location overrides** — when a feature is selected, the app looks up its `name` (case-insensitively) in `descriptionMap`, `imageMap`, `categoryMap`, etc. to render the details panel.
5. **3D drop-in** — selecting a location resolves its sweep ID in the active-profile `treedisMaps` and posts a message into the Treedis iframe to move to that sweep.

\---

## Configuration

All structural settings live in `config.js`. Common edits:

* **Map view** — `tiles.initialCenter`, `tiles.initialZoom`, `tiles.bounds`, `tiles.minZoom` / `maxZoom`.
* **Tile path** — `tiles.url` (default `assets/tiles/{z}/{x}/{y}.png`). Tiles are expected pre-rendered (the comment notes they came from QGIS).
* **Treedis models** — `treedis.profiles.desktop` and `treedis.profiles.vr`. The `origin` (`https://spaces.dtsxr.com`) is shared by both and used for `postMessage` safety.
* **Layer colors** — `styles.buildings`, `styles.tours`, plus `\\\*Hover` and `selected` variants.

Per-location *content* (descriptions, images, sweep IDs, course catalog) lives in the `data/\\\*.js` files so non-technical editors can change copy without touching app plumbing.

\---

## Deployment

The repo layout matches the deployed layout (the entry point is conventionally renamed `index.html`). Lay it out like this on the server:

```
/
├── index.html              ← rename of map.html
├── config.js
├── js/
│   ├── 01-utils.js
│   ├── 02-state.js
│   ├── 03-tour-bridge.js
│   ├── 04-street-view.js
│   ├── 05-map-helpers.js
│   ├── 06-details-panel.js
│   ├── 07-layer-builders.js
│   ├── 08-tourbar.js
│   ├── 09-sidebar-search.js
│   ├── 10-event-wiring.js
│   ├── 11-boot.js
│   ├── 12-start-screen.js
│   └── 13-learn-mode.js
├── css/
│   ├── 01-base.css
│   ├── 02-header.css
│   ├── 03-sidebar.css
│   ├── 04-map-details.css
│   ├── 05-leaflet-responsive.css
│   ├── 06-align-tool.css
│   ├── 07-streetview-xr.css
│   ├── 08-start-coachmark.css
│   ├── 09-burger-settings.css
│   ├── 10-nav-instructions.css
│   └── 11-learn-mode.css
├── assets/
│   ├── tiles/…/{z}/{x}/{y}.png…
│   ├── Icons/…
│   ├── Locations/…
│   └── courses/…
└── data/
    ├── buildings.geojson
    ├── tours.geojson
    ├── courses.js
    ├── locations.js
    └── treedis-sweeps.js
```

Any static host (GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront, plain nginx) works. Total wire size is roughly the same as before — the split adds ~1 KB of header comments and ~1 KB of HTTP overhead per extra file, which is negligible against the ~140 KB of JS and ~100 KB of CSS being served.

\---

## Tech stack

* **Leaflet 1.9.4** (CDN) — base map and vector layers.
* **Treedis SDK** — 3D street-view tours, embedded as an iframe at `https://spaces.dtsxr.com`.
* **WebXR Device API** — VR-profile detection.
* **Vanilla JS + CSS** — no framework, no build pipeline.
* **Fonts** — JetBrains Mono, Inter, EB Garamond (Google Fonts), with a self-hosted Minion Pro / Minion 3 slot via `--serif` in `css/01-base.css`.

\---

## Browser support

* Modern Chromium, Firefox, and Safari on desktop and mobile.
* Meta Quest Browser (Quest 2 / 3 / Pro) — auto-routed to the VR Treedis model.


\---

## Credits

* Developed by [sroberto27](https://sroberto27.github.io/)
* Campus imagery: SC\_2023\_RGB WMTS.
* © South Carolina State University.

* **Building \& tour layers** loaded from GeoJSON, with hover previews, tooltips, and a clickable locations sidebar.
* **Treedis 3D sweeps** embedded via iframe — click a building or tour stop to drop into 360° street view at the right sweep ID.
* **Dual Treedis profiles** — separate desktop (`8e4ca3fc`) and VR (`scsu-campus-ade0f346`) models, auto-selected at boot by user-agent inspection and `navigator.xr.isSessionSupported('immersive-vr')`.
* **Learn mode** — a course catalog (currently `NRM 342 Agronomy \\\& Soils`) that pairs syllabus-style content with deep links into the immersive VR experience.
* **File:// fallback** — the app works without a server: GeoJSON is also shipped as `data/\\\*.js` shims that assign onto `window.SCSU\\\_DATA`, so opening the HTML directly from disk still boots.
* **Splash / progress screen, burger menu, search, and align tools** built in.

\---

## Repository layout

The repo is flat, but the app expects the data files under `data/` and the entry point named `index.html` when deployed. See the *Deployment* section below.

|File|Purpose|
|-|-|
|`map.html`|HTML shell — splash screen, app chrome, metabar, sidebar, Leaflet container, Treedis iframe slot. Deploys as `index.html`.|
|`app.js`|Main application (\~3,800 lines). Boots the map, wires sidebar interactions, manages Treedis postMessage bridging, handles XR detection, runs the Learn-mode UI.|
|`config.js`|Structural settings — brand strings, tile config, map bounds, Treedis SDK plumbing, Leaflet layer styles, UI flags. Loaded *after* the data files so it can merge into `window.CAMPUS\\\_CONFIG`.|
|`mapstyles.css`|All visual styling.|
|`buildings.geojson`|Building footprint polygons (EPSG:4326). Source of truth when served over HTTP.|
|`tours.geojson`|Tour-stop polygons (EPSG:4326).|
|`locations.js`|Per-location content — `descriptionMap`, `imageMap`, `categoryMap`, `happensHereMap`, `explorableMap`. Edit this file to change copy without touching app plumbing.|
|`treedis-sweeps.js`|Per-location sweep IDs, split into `desktop` and `vr` profile tables.|
|`courses.js`|Learn-mode course catalog.|

### Loading order

The HTML loads scripts in this order, which matters because the data files seed `window.CAMPUS\\\_CONFIG` / `window.SCSU\\\_DATA` before `config.js` merges into them and `app.js` reads the result:

```
leaflet.js  →  data/buildings.js, data/tours.js, data/courses.js,
              data/locations.js, data/treedis-sweeps.js
           →  config.js
           →  app.js
```

\---

## Data flow

1. **At module load** `app.js` inspects the user agent for `OculusBrowser`, `Quest`, or `VR` tokens and tentatively picks a Treedis profile.
2. **At boot** it confirms with `navigator.xr.isSessionSupported('immersive-vr')` and upgrades to the VR profile if WebXR is available. `config.treedis.modelId` and `config.treedis.tourUrl` are rewritten to the active profile; the legacy `treedisMap` alias is repointed to the matching sweep table.
3. **Geometry** is loaded by `fetch()` from `data/buildings.geojson` and `data/tours.geojson`. If `fetch` fails (e.g. `file://` origin), the app falls back to `window.SCSU\\\_DATA.buildings` / `.tours` populated by `data/buildings.js` and `data/tours.js`.
4. **Per-location overrides** — when a feature is selected, the app looks up its `name` (case-insensitively) in `descriptionMap`, `imageMap`, `categoryMap`, etc. to render the details panel.
5. **3D drop-in** — selecting a location resolves its sweep ID in the active-profile `treedisMaps` and posts a message into the Treedis iframe to move to that sweep.

\---

## Configuration

All structural settings live in `config.js`. Common edits:

* **Map view** — `tiles.initialCenter`, `tiles.initialZoom`, `tiles.bounds`, `tiles.minZoom` / `maxZoom`.
* **Tile path** — `tiles.url` (default `assets/tiles/{z}/{x}/{y}.png`). Tiles are expected pre-rendered (the comment notes they came from QGIS).
* **Treedis models** — `treedis.profiles.desktop` and `treedis.profiles.vr`. The `origin` (`https://spaces.dtsxr.com`) is shared by both and used for `postMessage` safety.
* **Layer colors** — `styles.buildings`, `styles.tours`, plus `\\\*Hover` and `selected` variants.

Per-location *content* (descriptions, images, sweep IDs, course catalog) lives in the `data/\\\*.js` files so non-technical editors can change copy without touching app plumbing.

\---

## Deployment

The repo is flat for ease of editing, but the HTML references everything under `data/` and the entry point is conventionally `index.html`. Lay it out like this on the server:

```
/
├── index.html              ← rename of map.html
├── app.js
├── config.js
├── mapstyles.css
├── assets/
│   ├── tiles/#.../{z}/{x}/{y}.png...
│   └── Icons/…
│   └── Locations/…
│   └── courses/…
└── data/
    ├── buildings.geojson
    ├── tours.geojson
    ├── courses.js
    ├── locations.js
    └── treedis-sweeps.js
```

Any static host (GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront, plain nginx) works.

\---

## Tech stack

* **Leaflet 1.9.4** (CDN) — base map and vector layers.
* **Treedis SDK** — 3D street-view tours, embedded as an iframe at `https://spaces.dtsxr.com`.
* **WebXR Device API** — VR-profile detection.
* **Vanilla JS + CSS** — no framework, no build pipeline.
* **Fonts** — JetBrains Mono, Inter, EB Garamond (Google Fonts), with a self-hosted Minion Pro / Minion 3 slot via `--serif` in `mapstyles.css`.

\---

## Browser support

* Modern Chromium, Firefox, and Safari on desktop and mobile.
* Meta Quest Browser (Quest 2 / 3 / Pro) — auto-routed to the VR Treedis model.


\---

## Credits

* Developed by [sroberto27](https://sroberto27.github.io/)
* Campus imagery: SC\_2023\_RGB WMTS.
* © South Carolina State University.
