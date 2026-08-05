# 09 — Build plan

Six phases plus a research phase. Each ends with a working, committed site that passes the
regression checklist. **Do not interleave phases.**

Run locally with `python3 -m http.server 8000` — `file://` breaks `/data` loading and every
fetch-based verification below.

---

## Phase 0 — Source verification and the CORS spike

*No production code. Output is knowledge and one document.*

| # | Task |
|---|---|
| 0.1 | Walk `https://maps.iberiagov.net/server/rest/services/?f=sitemap` and every folder; enumerate `Elevation` and `DamageAssessment`, which weren't catalogued |
| 0.2 | Pull layer metadata for every candidate in `07 §A`: fields + aliases, geometry type, extent, record count |
| 0.3 | **CORS spike.** From a page served at `localhost:8000`, `fetch()` a `/query?f=geojson&where=1=1&resultRecordCount=1` against both servers. Record exact results. Also test an `<img>` load of a `/export` URL. Write the results into a scratch note — everything downstream branches on them |
| 0.4 | Enumerate the CPRA `cimsgeo3.coastal.louisiana.gov/arcgis/rest/services` tree |
| 0.5 | Retrieve the Iberia parish factsheet **manually** (robots.txt disallows automated fetch); transcribe the CPRA project list |
| 0.6 | Work through MP-DAP (`mpdap.coastal.la.gov`) for the Iberia extent; record formats, sizes, and download URLs |
| 0.7 | Open **`https://mpdv.coastal.la.gov/#map=8.66/29.5211/-91.51`**. (a) Inspect network traffic to identify the underlying services, tile URLs, style JSON, and scenario/time parameter names — the fractional-zoom hash suggests MapLibre/Mapbox GL, so expect vector tiles, not ArcGIS image export. (b) Run its guided tour end to end and transcribe each step per the prerequisite in `05-SPEC`. Flag immediately if the layers are vector tiles — that's a scope question for `04-SPEC §2`, not something to improvise |
| 0.8 | Derive the real parish centroid, envelope, and boundary GeoJSON from `Govt_Units/Updated_Parish_Boundary` |
| 0.9 | Resolve the privacy and licensing questions in `07 §E`; record decisions and who made them |
| 0.10 | Write `data/gis/sources.json` and generate `docs/GIS-DATA-SOURCES.md` |

**Gate:** report CORS results and the final layer shortlist to the human before Phase 3.
The layer strategy (`esriDynamic` vs `esriFeature` vs harvested `geojson`) is decided here,
not guessed at later.

**Commit:** `docs(gis): source inventory and access verification`

---

## Phase 1 — Multi-experience schema and loader

Spec: `03-SPEC §1–2`.

| # | Task | Files |
|---|---|---|
| 1.1 | `projectExperiences()` normaliser + `convertExperience()` with the `gis` branch | `js/content-loader.js` |
| 1.2 | `ex.experiences[]` on config; keep `ex.media` as the alias to `experiences[0]` | `js/content-loader.js` |
| 1.3 | Load `gisMap` / `gisTour` / `gisSources` documents into `cfg.gisMaps` / `cfg.gisTours` | `js/content-loader.js` |
| 1.4 | Add the `gis` group to the manifest (empty for now) | `data/manifest.json` |
| 1.5 | Keep `js/config.js` structurally in sync | `js/config.js` |

**Acceptance:** with no other changes, every one of the 16 projects still opens with the
same media. `window.DTS_CONFIG.examples.energy.experiences` is a one-item array whose
contents equal the old `media`. Console clean.

**Commit:** `feat(content): projects can declare multiple experiences`

---

## Phase 2 — The tabbed stage

Spec: `03-SPEC §3–4`.

| # | Task | Files |
|---|---|---|
| 2.1 | Add `#exStageTabs` + `#exStageSlot` inside `#exampleStage` | `index.html` |
| 2.2 | Narrow `.example-stage iframe` → `.example-stage-slot iframe` **everywhere** (check `06`, `08`, `09`, `11`) | `css/06,08,09,11-*.css` |
| 2.3 | Tab strip styles, full tablist keyboard pattern | `css/06-example-window.css`, `js/app.js` |
| 2.4 | `showExperience()`, `mountTreedis()`, `mountVideo()`, `suspendExperience()` | `js/app.js` |
| 2.5 | Rewrite `exampleMediaUrl()` / `exampleOpenUrl()` to read the active experience | `js/app.js` |
| 2.6 | `&exp=` in `currentURLParams()` / `applyStateFromURL()`; `replaceState` on tab switch | `js/app.js` |
| 2.7 | Temporary test: give one existing project a second experience, verify, then revert | — |

**Acceptance:** `03-SPEC §5` criteria 1–7. Specifically: `[treedis] TourReady` appears
**once** across a full switch-away-and-back cycle, and video audio stops on switch away.

**Commit:** `feat(ui): tabbed multi-experience project stage`

---

## Phase 3 — The GIS engine

Spec: `04-SPEC`. The biggest phase; split the commits.

| # | Task | Files |
|---|---|---|
| 3.1 | Vendor Leaflet 1.9.4 + esri-leaflet 3.x; write the lazy loader with an error state | `vendor/leaflet/*`, `js/gis/gis-loader.js` |
| 3.2 | `DTSGis.mount()`, map init, view/bounds, basemaps, the full public API surface | `js/gis/gis-viewer.js` |
| 3.3 | Layer factory for all six `sourceType`s, each wrapped in its own try/catch | `js/gis/gis-viewer.js`, `js/gis/gis-esri.js` |
| 3.4 | Parish boundary clip + dim mask | `js/gis/gis-viewer.js` |
| 3.5 | Map chrome restyled to site tokens — controls, popups, attribution, scale | `css/15-gis.css`, `index.html` (link) |
| 3.6 | Layer panel, basemap switcher, legend | `js/gis/gis-tools.js` |
| 3.7 | Identify / popups | `js/gis/gis-tools.js`, `js/gis/gis-esri.js` |
| 3.8 | Attribute table, filter/query builder | `js/gis/gis-tools.js` |
| 3.9 | Measure, draw, coordinates, search, geolocate, bookmarks | `js/gis/gis-tools.js` |
| 3.10 | Swipe compare, time slider | `js/gis/gis-tools.js` |
| 3.11 | Print/export image, export data, share-state encoding | `js/gis/gis-tools.js` |
| 3.12 | `mountGis()` in the switcher; instance cache with LRU cap; `invalidateSize()` on every fullscreen and resize event | `js/app.js` |
| 3.13 | `tools/gis-harvest.mjs` + first harvested layers | `tools/`, `data/gis/layers/` |
| 3.14 | Build `data/gis/maps/iberia-coastal.json` by hand for now (CMS comes in Phase 5) | `data/gis/maps/` |

**Acceptance:** the map mounts in the stage with real Iberia layers; every tool in
`mapDoc.tools` works on desktop and on a 360px phone; a killed layer source degrades to
"Unavailable right now" without taking the map down; bundle under 200 KB gzipped and
nothing map-related loads on a non-GIS project; `prefers-reduced-motion` respected;
keyboard operation complete.

**Commits:** one per logical group — `feat(gis): map engine and layer sources`,
`feat(gis): layer panel, legend and identify`, `feat(gis): measure, draw and query tools`,
`feat(gis): swipe, timeline and export`, `feat(gis): Iberia Parish map configuration`

---

## Phase 4 — Guided tours

Spec: `05-SPEC`.

| # | Task | Files |
|---|---|---|
| 4.1 | Tour player: card UI (desktop dock + mobile bottom sheet), step application | `js/gis/gis-tour.js`, `css/15-gis.css` |
| 4.2 | Highlight rendering + clearing | `js/gis/gis-tour.js` |
| 4.3 | Off-script detection and the "back to step" affordance | `js/gis/gis-tour.js` |
| 4.4 | Tour state in the share parameter; restore mid-tour | `js/gis/gis-viewer.js` |
| 4.5 | Launcher button; once-per-session autostart via `sessionStorage` | `js/gis/gis-tools.js` |
| 4.6 | Keyboard, focus management, live-region announcements | `js/gis/gis-tour.js` |
| 4.7 | Author `data/gis/tours/iberia-coastal-intro.json` | `data/gis/tours/` |

**Acceptance:** `05-SPEC §5` criteria 1–8.

**Commit:** `feat(gis): guided tours`

---

## Phase 5 — CMS

Spec: `06-SPEC`.

| # | Task | Files |
|---|---|---|
| 5.1 | New field builders: `fNumber`, `fRange`, `fListOrdered`, `fKeyValue`, `fDocPicker` | `js/admin.js` |
| 5.2 | `experiencesEditor()` replacing `mediaEditor()`, with editor-triggered legacy migration | `js/admin.js` |
| 5.3 | GIS nav group; `addGisMap()` / `deleteGisMap()` with reference guards | `js/admin.js` |
| 5.4 | Map editor: view, boundary, basemaps, groups, tools, bookmarks | `js/admin.js` |
| 5.5 | Layer editor incl. **Test connection** and **Load fields from service** | `js/admin.js` |
| 5.6 | Tour editor incl. **Capture current view** | `js/admin.js` |
| 5.7 | Sources editor + markdown generator | `js/admin.js` |
| 5.8 | Live preview map panel, debounced re-mount | `js/admin.js`, `css/13-admin.css` |
| 5.9 | Export includes `data/gis/layers/*.geojson`, failing loudly if any is missing | `js/admin.js` |

**Acceptance:** `06-SPEC §9` criteria 1–7. The hard one: an editor builds a five-step tour
by driving the preview map, saves a draft, previews, exports, and the exported `data/`
folder dropped into the repo reproduces exactly what they saw.

**Verification:** per `CLAUDE.md`'s "Verification approach" (added after the Phase 4
gate) — code-level checks and direct service/data checks first; live browser testing
only for what's genuinely undecidable otherwise, and preferably run by the human, not
the agent. Close this phase's gate with a manual testing document in the same shape as
`docs/plans/gis/GIS-FULL-SYSTEM-TESTING.md` (working name:
`GIS-PHASE5-CMS-TESTING.md`) covering `06-SPEC §9`'s 7 criteria plus the regression
checklist below, for the human to run through and report back — not an agent-driven
Claude-in-Chrome pass.

**Commit:** `feat(admin): GIS maps, layers and guided tours in the CMS`

---

## Phase 6 — The GFC project

Spec: `08-SPEC`. **Build it through the Admin Board.**

| # | Task |
|---|---|
| 6.1 | Verify the sector card slider handles five cards; fix it if not |
| 6.2 | Add the Coastal Resilience card to `data/sectors/government.json` |
| 6.3 | Create `data/projects/gfc.json` via the board, with both experiences |
| 6.4 | Finalise `iberia-coastal` map layers against Phase 0's verified list |
| 6.5 | Finalise the seven-step tour |
| 6.6 | **Get PI sign-off on the public copy** (see `08-SPEC` ⚠️) |
| 6.7 | Finalise `docs/GIS-DATA-SOURCES.md` with every layer actually shipped |

**Acceptance:** `08-SPEC §6` criteria 1–10.

**Commit:** `feat(content): Gulf Futures Challenge — Iberia Parish project`

---

## Regression checklist

Run at the end of **every** phase. From the repo README, plus the new surface.

**Existing behaviour**
- [ ] Home ↔ each of the four sectors switches cleanly
- [ ] One example window opens per sector, content correct
- [ ] "Try a Digital Twin" reveal opens and closes; **the tour does not reload**
- [ ] A lead form sends; with the Web3Forms key removed, the mailto fallback fires
- [ ] Sign-in with `demo` / `1234` opens the client portal
- [ ] Admin sign-in → edit → save draft → preview → discard round-trips
- [ ] Mobile drawer and sector swipe work
- [ ] Vision Pro CTA appears in Safari
- [ ] Browser back/forward through home → sector → project → close is correct
- [ ] Console clean on load, on every view, and on every overlay

**New surface**
- [ ] All 16 legacy projects render identically to `main`
- [ ] Tab strip hidden for single-experience projects, no layout shift
- [ ] Treedis session survives tab switching
- [ ] Video audio stops when its tab is left
- [ ] Deep links: `?category=…`, `…&project=…`, `…&exp=…`, `…&map=…`
- [ ] Map re-measures on fullscreen enter and exit, and on window resize
- [ ] Nothing GIS-related downloads on the home view or on a non-GIS project
- [ ] A dead layer source degrades gracefully; the map still works
- [ ] Keyboard-only path through tabs, layer panel, popups, and tour
- [ ] 360px phone: tab strip scrolls, panels are bottom sheets, map is usable
- [ ] `prefers-reduced-motion` honoured across tabs, map, and tour

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CORS blocked on one or both GIS servers | Medium | High — kills live interactive layers | Phase 0 spike; `esriDynamic` image layers need no CORS; harvest to GeoJSON for anything that must be interactive |
| CPRA master-plan data not obtainable at parish scale | Medium | Medium — weakens the "50 years" story | MP-DAP is built for download; fall back to the parish factsheet's project list, which is qualitative but authoritative |
| Iberia server is small; harvest load causes problems | Low | High — relationship damage | Throttle hard, identify the UA, schedule not on-demand, contact the parish GIS office first |
| `localStorage` quota blown by the admin draft | Medium | High — CMS silently fails | GeoJSON never enters the document set; add a size check on `saveDraft()` with a clear error |
| Sector slider breaks with 5 cards | Medium | Low | Checked in Phase 6.1 |
| Tainted canvas defeats image export | Medium | Low | Print fallback, decided in Phase 3.11 |
| Bundle weight degrades the project window | Low | Medium | Budget in `04 §9`; measure at the end of Phase 3 |
| GFC copy published without sign-off | Low | High | Gate 6.6; ship with `illustrative:true` until cleared |
| Specs drift from repo reality | High | Low | Plan-mode prompt requires reconciling against the repo first |
