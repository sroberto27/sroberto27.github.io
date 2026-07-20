# SCSU Virtual Campus

An interactive web map of the South Carolina State University campus. A 2D Leaflet map is paired with embedded Treedis 3D street-view tours. The app has two modes:

- **Explore** — browse the campus map, click buildings and tour stops, and drop into 360° street-view sweeps.
- **Learn** — a course catalog that links classroom content to immersive VR experiences.

Desktop, tablet, mobile, and WebXR headsets (Meta Quest) are all supported. There is no framework and no build step — plain HTML, CSS, and JavaScript.

---

## Quick start

The app is a static site. To run it locally:

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000/map.html
```

Opening `map.html` directly from disk (`file://`) also works: when `fetch()` fails, the app falls back to the `data/*.js` shim scripts, which carry the same data.

To deploy, copy the tree to any static host (GitHub Pages, Netlify, S3, nginx). The entry point is conventionally renamed `index.html`.

---

## Project structure

```
/
├── map.html                 # HTML shell (deployed as index.html)
├── config.js                # structural settings (map, Treedis, styles)
├── js/                      # application code, 14 numbered files
├── css/                     # styles, 11 numbered files
├── assets/                  # map tiles, icons, location photos, course art
│   └── tiles/{z}/{x}/{y}.png
└── data/                    # geometry + editorial content
    ├── buildings.geojson    # building footprints (EPSG:4326)
    ├── tours.geojson        # tour-stop polygons (EPSG:4326)
    ├── locations.json       # per-location content (source of truth)
    ├── treedis-sweeps.json  # per-location sweep IDs (desktop / vr)
    ├── courses.json         # Learn-mode course catalog
    └── *.js                 # legacy shims — file:// fallback only
```

### JavaScript (`js/`)

The 14 files are plain `<script>` tags, **not** ES modules: every top-level `const`, `let`, and `function` is a shared global. The split is organizational only, but the numeric order encodes the dependency chain — later files use state and helpers declared by earlier ones. **Do not reorder or renumber the script tags.**

| File | Owns |
|------|------|
| `00-data-adapter.js` | Fetches the JSON content files and flattens them into the lookup maps the app reads (`descriptionMap`, `treedisMaps`, `SCSU_DATA.courses`, …). The only module that knows the JSON shape. |
| `01-utils.js` | XR/VR detection and Treedis profile selection, coordinate reprojection, and the name-keyed lookup helpers (`getDescription`, `getTreedisEntry`, `hasSweep`, …). |
| `02-state.js` | The Leaflet `map` + panes, the `el` object of DOM references, `isMobile()`, layer style helpers, and all module-level mutable state. |
| `03-tour-bridge.js` | `TourBridge` — the `postMessage` wrapper around the Treedis iframe (Navigate / Ping outbound, TourReady / PoseChanged inbound). |
| `04-street-view.js` | Street-view overlay: open/close, the loading veil with escalating messaging, pending-sweep queueing while Treedis boots, and sweep navigation from UI actions. |
| `05-map-helpers.js` | Map constraints, campus fit/reset helpers, debounced refresh. |
| `06-details-panel.js` | `renderDetails()` and its sub-renderers (chips, image, explorable list, address links), plus `selectFeature()` / `clearSelection()` and the panel open/close/mode logic. |
| `07-layer-builders.js` | GeoJSON layer construction, feature event binding, image-bounds math, numbered tour pins. |
| `08-tourbar.js` | The guided-tour bar (labels, counters, prev/next), shared between the desktop sidebar footer and the mobile bar. |
| `09-sidebar-search.js` | Locations sidebar (Featured + All tabs, sorting), mobile drawer, details-sheet drag, mobile search toggle, and the search renderer. First file with top-level event bindings. |
| `10-event-wiring.js` | Remaining event listeners (Explore CTA, tour arrows, keyboard shortcuts, fullscreen, help) and the dev-only image alignment tool. |
| `11-boot.js` | Data loading, asset preloading, Treedis warm-up, and the `boot()` startup sequence. |
| `12-start-screen.js` | Welcome modal, 3-step coachmark walkthrough, nav-instructions modal, preference persistence. Ends with `boot()` — this call actually starts the app. |
| `13-learn-mode.js` | Self-contained IIFE for the Learn-mode course catalog. |

### CSS (`css/`)

11 files loaded in order via `<link>` tags. Order matters: later files override earlier ones through the cascade.

| File | Covers |
|------|--------|
| `01-base.css` | Custom properties (palette, typography, sizes), splash screen, app grid. |
| `02-header.css` | Metabar, Explore/Learn pill, burger slide-in panel. |
| `03-sidebar.css` | Shell layout, locations sidebar, tabs, sort row, off-campus badges. |
| `04-map-details.css` | Map area, details panel, persistent footer bar, address block, tourbar. |
| `05-leaflet-responsive.css` | Leaflet overrides, tour pins, all mobile (≤880px) rules. |
| `06-align-tool.css` | Image alignment dev tool (legacy single-image mode only). |
| `07-streetview-xr.css` | Street-view overlay and VR-mode rules. |
| `08-start-coachmark.css` | Start screen and coachmark spotlight system. |
| `09-burger-settings.css` | Burger panel settings group and toggle switches. |
| `10-nav-instructions.css` | 3D navigation instructions modal (mouse / touch / VR variants). |
| `11-learn-mode.css` | Learn-mode catalog, detail view, action bar, responsive variants. |

---

## How the app boots

Load order in `map.html`:

```
leaflet.css → css/01 … css/11

leaflet.js → data/*.js shims → config.js → js/00 … js/13
```

1. The `data/*.js` shims seed `window.CAMPUS_CONFIG` / `window.SCSU_DATA`; `config.js` merges structural settings on top.
2. At script load, `js/01-utils.js` inspects the user agent and tentatively picks a Treedis profile (`desktop` or `vr`).
3. `boot()` (in `js/11-boot.js`, invoked from `js/12`) confirms VR via `navigator.xr.isSessionSupported('immersive-vr')`, starts the hidden Treedis iframe, and fetches all data in parallel:
   - geometry from `data/*.geojson`
   - content via `js/00-data-adapter.js` from `data/*.json`
   - any fetch that fails falls back to the shim data, so `file://` still works.
4. Layers, pins, sidebar lists, and the search index are built; images are preloaded (with a hard cap so the splash can't hang); then the app is revealed and the welcome modal shows.
5. Selecting a location renders the details panel from the lookup maps. Pressing **Explore** resolves the sweep ID for the active profile and posts a `Navigate` message into the Treedis iframe. While street view is open, the sidebar, search, and tour arrows drive the 3D camera instead of the map.

### Treedis dual profile

Two Treedis models exist — one for desktop/tablet/mobile, one for VR headsets — with different sweep IDs. Both are configured under `config.treedis.profiles`; sweep IDs live in `data/treedis-sweeps.json` under `desktop` and `vr` keys. The boot code picks the profile and repoints `config.treedisMap` plus the `treedis.modelId` / `tourUrl` aliases.

---

## Editing content

Content is separated from code so copy changes never touch app logic. In production (http/https), the **JSON files are the source of truth**:

| File | What to edit |
|------|--------------|
| `data/locations.json` | One document per location: `category`, `description`, `image`, `address`, `happensHere`, `departments`, `explorable`. Optional fields are simply omitted. The `key` must match the GeoJSON `name`, lower-cased. |
| `data/treedis-sweeps.json` | One document per location/sub-location: `key`, optional `parentName`, and per-profile `desktop` / `vr` objects with `sweepId` and optional `transitionTime` / `rotation`. |
| `data/courses.json` | Learn-mode courses: code, title, lede, overview, curriculum, image, EON launch URLs (`eon.desktopUrl`, `eon.vrUrl`), and `immersive` notes. |

The legacy `data/*.js` shims mirror this content for `file://` use. If you edit the JSON, keep the shims in sync (or accept that disk-opened pages show older content). The JSON URLs can later be repointed to a CMS/API in `config.dataFiles` — only `js/00-data-adapter.js` knows the shape.

### Common tasks

**Change a description, photo, or category** — edit the location's document in `data/locations.json`.

**Map a building to a 3D sweep** — add its entry to `data/treedis-sweeps.json` with sweep IDs for both profiles. Buildings without a sweep automatically render an info-only details panel (no Explore button).

**Add a tour stop** — add/modify a polygon in `data/tours.geojson` with properties `name`, `tour_group` (usually `mainTour`), and `order_num`; then add its content and sweep entries as above.

**Add an off-campus tour stop** — same as a tour stop, plus `off_campus: true` and optionally `off_campus_distance` (e.g. `"20 mi from campus"`). Draw the polygon as a small directional indicator (arrow) inside the campus bounds pointing toward the real site. The amber styling, ↗ pin, "OFF-CAMPUS STOP" tag, sidebar distance badge, and "Open in Maps" address links (add the address in `locations.json`) all activate automatically from the `off_campus` property.

**Add a course** — append a document to `data/courses.json`. Without an EON URL the "Begin Course" button is disabled with a "coming soon" title.

---

## Configuration (`config.js`)

Structural settings only. Common edits:

- **Map view** — `tiles.initialCenter`, `tiles.initialZoom`, `tiles.bounds`, `tiles.minZoom` / `maxZoom`.
- **Tile path** — `tiles.url` (default `assets/tiles/{z}/{x}/{y}.png`, pre-rendered from QGIS).
- **Treedis models** — `treedis.profiles.desktop` / `.vr` (`modelId`, `tourUrl`, `homeSweepId`). `treedis.origin` is shared and used to validate `postMessage` senders.
- **Layer colors** — `styles.buildings` / `styles.tours` plus hover, selected, and off-campus variants.

---

## User preferences

Two settings persist in `localStorage` and are exposed both in their modals ("Don't show this again") and in the burger menu (positive-worded switches):

- `scsu:showStartScreen` — welcome modal on boot.
- `scsu:showNavInstructions` — 3D navigation instructions on the first street-view open of a session.

The alignment tool (legacy image mode) stores its tuning under `scsu-map.align.v1`.

---

## Tech stack

- **Leaflet 1.9.4** (CDN) — base map and vector layers.
- **Treedis SDK** — 3D tours, embedded as an iframe from `https://spaces.dtsxr.com`, driven via `postMessage`.
- **WebXR Device API** — VR profile detection.
- **Vanilla JS + CSS** — no framework, no build pipeline.
- **Fonts** — Inter and EB Garamond (Google Fonts), with a self-hosted Minion slot via the `--serif` token in `css/01-base.css`.

## Browser support

- Modern Chromium, Firefox, and Safari on desktop and mobile.
- Meta Quest Browser (Quest 2 / 3 / Pro) — auto-routed to the VR Treedis model.

## Credits

- Developed by [sroberto27](https://sroberto27.github.io/)
- Campus imagery: SC_2023_RGB WMTS.
- © South Carolina State University.
