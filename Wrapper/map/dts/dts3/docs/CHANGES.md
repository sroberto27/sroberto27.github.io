# Changelog

Newest first.

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
