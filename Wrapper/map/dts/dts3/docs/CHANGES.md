# Changelog

Newest first.

## GIS Phase 3 task 3.5 — map chrome

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.5. CSS-only; nothing new is wired into
`index.html`/`app.js` yet.

- `css/15-gis.css`: restyles Leaflet's default white/boxy chrome to the site's dark/gold
  tokens — the zoom control bar, popups (content wrapper, tip, close button), the
  attribution control, and the scale bar — plus visible `--gold-bright` focus rings on
  every control and link (04-SPEC §10). `index.html` links it last in the stylesheet
  order, after `14-intro.css`.
- `js/gis/gis-viewer.js`: `createInstance()` now adds a `dts-gis-map` class to the mount
  container (removed again in `destroy()`) so `15-gis.css` has something to scope to.
  Also adds `L.control.scale()` on mount — the scale bar is always-on map chrome per
  04-SPEC §6, not a gated tool, so it belongs with the other init-time controls rather
  than waiting for `gis-tools.js`.
- **Real bug found and fixed by live testing, not by inspection alone:** every selector
  in `15-gis.css` is anchored on the compound `.dts-gis-map.leaflet-container` (both
  classes, no space), not plain `.dts-gis-map`. `js/gis/gis-loader.js` injects
  `leaflet.css` into `<head>` lazily, *after* this file, and several of Leaflet's own
  rules (`.leaflet-container a`, `.leaflet-container .leaflet-control-attribution`,
  `.leaflet-container a.leaflet-popup-close-button`) match at the exact same
  specificity as a plain `.dts-gis-map` equivalent — a tie that source order decides,
  and Leaflet loads later. A first pass of this file used plain `.dts-gis-map` and
  silently lost every one of those ties (link color, attribution background, close
  button color all stayed Leaflet's defaults) until a live check caught the zoom
  control showing the browser's default blue focus outline instead of gold.
- Verified live in Chrome against a temporary, not-committed test harness mounting
  `DTSGis` with the real, CORS-verified Iberia Parish boundary layer
  (`Govt_Units/Updated_Parish_Boundary`) from `data/gis/sources.json`: zoom control,
  scale bar, attribution, and a sample popup all render in the site's dark-glass/gold
  language; keyboard `Tab` shows the gold focus ring on the zoom control; console clean.
  Harness deleted before committing, same pattern as prior phases' temporary test data.

## GIS Phase 3a — map engine and layer sources

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 3 tasks 3.1-3.4 / `04-SPEC-gis-engine.md`.
Phase 3 is split into several commits per the plan; this is the first ("map engine and
layer sources"). No wiring into `index.html`/`app.js` yet -- that's task 3.12
(`mountGis()` in the switcher), still to come. Vendoring vs CDN (04-SPEC §2) was
confirmed with the human before starting.

- `vendor/leaflet/`: Leaflet 1.9.4 + esri-leaflet 3.0.19, SHA-256-verified against
  jsdelivr's package metadata; versions/hashes/licenses in `vendor/leaflet/README.md`.
- `js/gis/gis-loader.js`: idempotent `DTSGisLoader.load()` -- injects the vendored
  CSS/JS only on first call, rejects cleanly (not a hang) on failure. Verified a plain
  page load makes zero `vendor/`/`gis` requests.
- `js/gis/gis-viewer.js` -- `window.DTSGis`: map init, view/bounds (`maxBounds` +
  `restrictToBounds`), basemaps (`tileXYZ`, `esriImage`), the layer factory dispatcher,
  the parish boundary dim mask, and the full §5 public API (`setView`,
  `setLayerVisible/Opacity`, `setBasemap`, `highlight/clearHighlight`, `startTour/
  tourNext/tourPrev/exitTour`, `getState/applyState`, lifecycle, `on`).
- `js/gis/gis-esri.js` -- `window.DTSGisEsri`: `buildDynamic` (esriDynamic, image
  overlay, no client query) and `buildFeature` (esriFeature, with a `query()` that
  carries the parish envelope per §8 defence 2). `esriImage`/`geojson`/`tileXYZ`/`wms`
  are simple enough to build inline in `gis-viewer.js`.
- Each layer builds independently and asynchronously into the registry so one slow or
  broken source never blocks the map or the others (§11); a `requesterror` listener on
  each esri-leaflet layer catches runtime fetch failures, since those surface as an
  event, not a constructor throw, as an earlier version of this code assumed. Layers
  outside their declared zoom range are removed from the map on `zoomend`, not just
  hidden (§9).
- Parish boundary dim mask (§8 defence 3): once the `mapDoc.boundary.layerId` layer
  loads, its real ring geometry (recursively flattened from Polygon/MultiPolygon
  `getLatLngs()`) becomes the hole in a world-covering `evenodd`-fill donut polygon, in
  its own pane above ordinary data layers. Independent of that layer's own visibility
  toggle -- the mask is static map chrome, not a togglable layer.
- **Design departure from the spec, deliberate:** `startTour`/`tourNext`/`tourPrev`/
  `exitTour` are fully implemented in `gis-viewer.js` now (applying each step's
  `view`/`layers`/`highlight` per `05-SPEC-guided-tours.md §1`), not left as stubs for
  the later guided-tours phase. Re-read that spec to get the step schema right first.
  The rationale: §5 says the tour player "drives the map exclusively through this API,"
  which reads as the engine owning step application and the player (a later phase)
  owning presentation only (card UI, keyboard, off-script pill, autoAdvance timing).
- Verified live in Chrome against real, CORS-verified Iberia Parish ArcGIS services
  (not synthetic fixtures): all six `sourceType`s build and render; a bad service URL
  and an unsupported `sourceType` both degrade to "unavailable" without affecting other
  layers; bounds/zoom-range enforcement, state round-trip, and the dim mask all checked
  against the real parish boundary layer. Found and fixed two real bugs this way before
  they shipped: esri-leaflet's `FeatureLayer` has no `layerId` option (the sublayer id
  must be part of the URL, or every query silently hits the wrong endpoint), and
  animated `setView` calls stall in this session's automated-Chrome test harness
  (confirmed as a harness/rAF-throttling artifact, not a product bug, by reproducing it
  against bare Leaflet with no DTSGis code involved).

## GIS Phase 2 — the tabbed stage

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 2 / `03-SPEC-multi-experience.md §3-5`.

- `index.html`: `#exStageTabs` (tablist) and `#exStageSlot` (mount point) added
  inside `#exampleStage`, as siblings of the existing loading veil and seam.
- `css/06-example-window.css`: `.example-stage` is now a column flex container;
  `.example-stage iframe` narrowed to `.example-stage-slot iframe`, plus an
  explicit `[hidden]` override (author CSS otherwise beats the UA `[hidden]`
  rule, so a suspended-but-not-removed iframe would keep rendering); tab strip
  styles; a placeholder style for the not-yet-built GIS pane. Checked
  `08-responsive.css`, `09-mobile.css`, `11-desktop.css` — none had a
  conflicting `.example-stage iframe` selector to update.
- `js/app.js`: `showExperience()`/`activeExperience()` switcher,
  `mountTreedis()`/`mountVideo()`/`mountSharedShowcase()`/`mountGis()` (the last
  a placeholder — the real GIS engine lands in a later phase),
  `suspendExperience()`, `syncStageTabs()` with a full keyboard-operable
  tablist (roving tabindex; arrows move focus, Home/End jump, Enter/Space
  activates), delegated so rebuilding the tab buttons doesn't cost re-wiring.
  `exampleMediaUrl()`/`exampleOpenUrl()` replaced per spec §3.4;
  `currentURLParams()`/`applyStateFromURL()`/`restoreInitialStateFromURL()`
  carry `&exp=` (only emitted for 2+ experiences); tab switches use
  `replaceState`, never `pushState`.
- **Design departure from the spec, deliberate:** each experience gets its own
  persistent iframe (`exampleMediaFrame-<expId>`), not one `#exampleMediaFrame`
  reused across a project's tabs. A project mixing a Treedis tour with a video
  would otherwise fight over one iframe's `src` — reassigning it on every tab
  switch would force the tour to reload and re-run the TourBridge handshake on
  every return visit, which fails the phase's own "no reload on switch back"
  acceptance criterion. Suspending hides a tour's frame (never reloads it) and
  blanks a video's `src` (actually stops its audio).
- **Scope decision, confirmed with the user:** skipped the spec's proposed
  optimization of borrowing the shared showcase iframe whenever an
  experience's `tourUrl` happens to match `cfg.treedis.tourUrl`. One live
  project (Properties & Places) has exactly that match with a null `sweepId`;
  borrowing would make it show whatever pose the shared iframe already has
  instead of a deterministic fresh load, breaking this phase's own
  byte-identical-for-legacy-projects criterion. Every experience with its own
  `tourUrl` always gets its dedicated frame, matching today's behavior
  exactly. Revisit as a deliberate, separately-tested change later if wanted.
- **Deferred, not done:** the spec's optional `:has(.example-stage-tabs)`
  stage-height growth for 2+ experience projects — needs matching overrides in
  both `08-responsive.css` and `11-desktop.css` to actually win at every
  breakpoint (source order means only touching `06` has no effect at
  desktop width), out of proportion for a cosmetic nicety with zero real
  multi-experience content until Phase 6. The tab strip still renders inside
  today's stage height with no clipping, just a slightly shorter slot.
- Verified live in Chrome (`python -m http.server 8000`): temporarily gave the
  `energy` project a second (video) experience per the spec's own suggested
  test step, confirmed the tab strip, tab switching, keyboard operation (found
  and fixed a real bug here — rebuilding the tab buttons on every switch was
  dropping keyboard focus to `<body>`; `syncStageTabs()` now re-focuses the new
  active tab when the strip owned focus), `&exp=` deep links, single-step
  browser back after several tab switches (confirms `replaceState`), and — via
  the console — that switching a Treedis tab away and back fires no new
  `TourReady`. Reverted the test data before committing. Also spot-checked a
  legacy single-experience project (`campus`) renders with no tab strip and no
  `&exp=` param, and that "Try a Digital Twin" still opens/closes cleanly.

## GIS Phase 1 — multi-experience schema and loader

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 1 / `03-SPEC-multi-experience.md §1-2`.
No UI change — loader/schema only.

- `js/content-loader.js`: added `projectExperiences(p)` (normalises a project's
  `experiences[]` or legacy `media` into a uniform list) and `convertExperience(m, i)`
  (replaces `convertMedia()`; adds a `gis` branch alongside `treedis`/`video`, still drops
  unknown `_type`s silently).
- `buildConfig()`'s project loop now sets `ex.experiences = projectExperiences(p)
  .map(convertExperience).filter(Boolean)` and keeps `ex.media` as a live alias to
  `experiences[0]` — every existing `ex.media` reader in `js/app.js` keeps working
  unchanged.
- `buildConfig()` now also loads `gisMap`/`gisTour` documents straight through into
  `cfg.gisMaps`/`cfg.gisTours`, keyed by id — a deliberate exception to the flattening
  convention; the GIS engine (Phase 3) reads its own schema directly.
- `data/manifest.json`: added the (currently empty) `gis` document group.
- `js/config.js`: structural sync only — added empty `gisMaps`/`gisTours`.
- Verified against real `/data` content with a Node-based replay of `buildConfig()`
  (browser extension unavailable this pass): all 16 existing projects produce
  behaviorally identical `media` (`type`/`tourUrl`/`embedUrl`/`watchUrl`), and
  `energy.experiences` is the expected one-item array. A live in-browser console/UI
  check (`python -m http.server 8000`) is still recommended before Phase 2 starts.

## GIS Phase 0 — source verification and CORS spike

No production code; research only, per `docs/plans/gis/09-BUILD-PLAN.md` Phase 0.

- CORS spike: both `maps.iberiagov.net` and `cimsgeo3.coastal.louisiana.gov`
  return permissive, origin-reflecting CORS headers on real `/query` and
  `/exportImage` calls — `esriFeature` can be the default sourceType on both
  servers, not just the `esriDynamic`/harvest fallback.
- Enumerated both ArcGIS service trees; catalogued candidate layers for the
  Boundaries/Water/Flood/Infrastructure/Coastal-projects/Coastal-change/Imagery
  groups in `08-SPEC-gfc-project.md`'s composition table.
- Confirmed MPDV runs on MapLibre GL JS with vector tiles (not ArcGIS image
  export) — resolves the scope question flagged in `07-SPEC §C`/`04-SPEC §2`.
- Transcribed MPDV's 10-step guided tour via static bundle analysis (no live
  browser session available this pass — visual/interaction details still need
  a live spot-check before Phase 4).
- Derived the parish's WGS84 envelope and an approximate centroid from
  `Govt_Units/Updated_Parish_Boundary`.
- Flagged five open items needing a human, not more automation: Iberia/CPRA
  terms-of-use confirmation (no published ToS found for either), manual
  retrieval of the robots.txt-blocked parish factsheet, and product-level calls
  on the Parcels and Nursing-Homes layers (real PII / vulnerable-population
  sensitivity respectively).
- Output: `data/gis/sources.json` (committed) and `docs/GIS-DATA-SOURCES.md`
  (gitignored, local reference only — `docs/` is excluded from this repo).

## Code reorganization (maintainability pass)

No functional changes. The site behaves exactly as before.

- Moved all JavaScript into `js/` and renamed for clarity:
  `script.js → js/app.js`, `dts-clients.js → js/clients.js`,
  `dts-tour-bridge.js → js/tour-bridge.js`; `config.js`,
  `smoke-depth.js`, and `vision-pro-spatial.js` moved as-is.
- Split `styles.css` into 12 ordered files under `css/`
  (`01-base.css` … `12-smoke.css`). Files load in numeric order and
  later files intentionally override earlier ones, preserving the
  original cascade exactly.
- `index.html` updated to load the new stylesheet and script paths;
  all markup, IDs, and asset references are unchanged.
- Comments rewritten across all files to be short and professional;
  references to internal design files and iteration history removed.
- New `README.md` for developer onboarding.
- All referenced imagery consolidated into `assets/`; HTML/CSS paths
  updated accordingly.

## Hex-cluster alignment fix

- `.hex` aspect ratio corrected to `1/0.8660254` (true regular
  flat-top hexagon) so diagonal edges sit at exactly 60°.
- Positions recomputed for exact edge contact between different-width
  neighbours; residual joint gap is sub-pixel.
- Base unit enlarged: `--hexu` is now `clamp(132px,12.5vw,360px)`
  (tablet breakpoint scaled to match).

## Content pass — real projects, live experiences, and videos

Populated all 16 sub-vertical example windows from the project link
inventory and the DTS portfolio.

- New per-example fields in `config.js → examples`:
  - `media` — the window's main experience pane (`treedis` tour or
    `vimeo` embed).
  - `links` — related tours/videos shown as "More from this project".
  - `gallery` — real project imagery in `assets/portfolio/`.
  - `capturedWith` / `platform` — accurate chips per project.
- Three formerly illustrative windows now carry real projects:
  Healthcare Training, Healthcare Facilities, Sustainability.
  Heritage remains illustrative; Safety & Emergency has copy but no
  inventory media.
- `openExample` loads the example's own media into a dedicated
  `#exampleMediaFrame` (torn down on close so video stops); the
  shared showcase iframe + sweep navigation remain the fallback.
  "Enter Twin" and the open-in-tab button target the active
  example's own tour/video.
- Only public/unlisted links are used; private, inactive, and
  sensitive items were excluded. Unlisted Vimeo links embed with
  their `h=` hash; non-embeddable share slugs appear as external
  links only.
- New brand motto ("The World as Interface") and expanded
  question-bar prompts/answers.

## Desktop layout pass (1920×1080, holds 1024–1920)

- Sector copy aligned across all four categories; new sub-verticals
  Healthcare Facilities (Industry) and Civic Services (Government);
  `navSub` and dock `short` labels added.
- Home: evidence row restyled (spread layout, gold dots); light
  question bar; light cookie card. The hexagon cluster and
  arrow-burst CTA remain unchanged.
- Contact panel: plain centred desktop layout with uppercase CTAs.
- Access Your Twin: wide desktop popup — brand block left, form
  card right.
- Example window: near-fullscreen layout with gold CTAs, chip rows,
  PROJECT EVIDENCE band, media mosaic, "More from {Sector}" cards,
  back-to-top FAB.
- Projects window: full-screen mosaic. Client portal: desktop shell
  with horizontal nav, asymmetric HOME tile grid, 3-up APPS grid.
- Tokens: `--bg #070E18`, `--bg-2 #0A1525`, `--gold #C49A2A`.

## Mobile layout pass (360×780, holds 320–480)

- Sector accents unified: education `#E9B44C`, industry `#2E8BFF`,
  government `#34598F`, community `#D27049`.
- Nav drawer: left slide-in panel listing the four sectors; the
  active item is a full-width accent bar.
- Home hero: hexagon cluster and evidence bullets now shown on
  phones; light question bar with quoted rotating placeholder.
- Category screens: sector-named "VIEW {SECTOR} PROJECTS" button,
  right-edge "Contact & Info" tab, dock-tab rail, sector pager.
- New sector projects window and post-login client portal (HOME
  tiles, All APPS cards, tile menu).
- Contact panel: centred PLAN / PROPOSE / PILOT steps. Lead-form
  modals rebuilt with paired fields and uppercase gold submits;
  success state is the "REQUEST SENT" toast.
- Access Your Twin rebuilt as the "Welcome Back!" login; the demo
  directory was repopulated (`demo` / `1234`).

## Initial wiring pass

- Fixed the boot crash (config global renamed to `DTS_CONFIG`).
- 16 example windows populated (overview + example project +
  evidence tabs + CTAs); three flagged as illustrative.
- Access Your Twin sign-in + dashboard added (Google Sheet directory,
  see `js/clients.js`).
- Question bar answers the FAQ prompts inline.
- Evidence filters open the active sector's lead example focused on
  that proof type.
