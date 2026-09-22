# SLiVR — implementation plan (Phases 0–5 prototype, Phase 6 post-prototype)

## Latest acceptance status - 2026-09-22 (D077)

Owner explicitly reports all earlier instructed tests PASS, including D076 mini-map and provider-failure/storage/reload/export/import checks. Carry these owner-reported results forward; environment metadata remain unspecified. Phase 2 remains OPEN because basic bookmark save/restore is not implemented and capability-dependent evidence remains unresolved. Phase 1 formal acceptance awaits explicit E1 allocation resolution; no new exception approved. Latest automated verification is 363 PASS. See [exact remaining obligations](research/PHASE_2_ACCEPTANCE_REVIEW.md) and [next CLI prompt](docs/NEXT_CLI_PROMPT.md). Historical status entries below retain their original evidence scope.

## Current execution status - 2026-09-20

**Phase 0 COMPLETE with owner-approved bounded acceptance exceptions.**
326 automated tests pass; all eight manual checklist items passed, including
the screenshot-supported Three.js demonstration. Catalog/deployment checks pass.
See [Phase 0 closeout](research/PHASE_0_CLOSEOUT.md) for build identity, evidence,
provider matrix and approved retest conditions. The live storage/schema checks
are assigned to Phase 1; remaining device/provider variants to the next deployment;
Treedis administrative metadata and raw capability reports to Phase 2 before
provider-dependent claims/features. Unknown results remain unknown.

**Phase 1 started: owner-requested map framing, numbered markers and co-located pin groups (D062), plus reference-style map controls, Recenter and catalog navigation (D063).** Other Phase 1 work remains pending. The context and
planning decisions below are historical; D057 supersedes the original dedicated,
uncommitted Google-key requirement, and D058 approves both read-only code sources.

**Explore UI increment (D067):** single discovery/dossier panel, collapse/restore, narrow-screen sheet, shell-owned catalog/help drawer and retained browse state implemented. See [UI interaction design](docs/UI_INTERACTION_DESIGN.md). Tests 204-205 cover automated behavior. The owner reports critical manual checklist items 1-12 PASS; item 13 (forced map-library failure) is NOT TESTED. Browser/device/build metadata and screenshots were not supplied; see the D067 owner-results entry in docs/FULL-SYSTEM-TESTING.md. This is not Phase 1 completion. The D063 catalog navigation strip is superseded by this panel.

## Acceptance review status - 2026-09-22 (D071)

Phase 1 remains OPEN. Final automated verification: 353 PASS, zero FAIL;
catalog/deployment checks pass with the retained catalog alias warning. D070
test 218 live retesting and inherited D061 real-browser catalog/storage checks
are BLOCKED because no browser surface is connected. Owner checklist 15-16
remain NOT TESTED. Historical presentation failures are preserved.

[Acceptance review and E1 closeout proposal](research/PHASE_1_ACCEPTANCE_REVIEW.md)
separates test 44's delivered Phase 1 actions from Phase 3 candidate/comparison
and Phase 4 shot actions. E1 is not approved and does not waive other gates.
[Phase 2 reconnaissance](research/PHASE_2_RECONNAISSANCE.md) records both reference
inspections, remaining bookmark/context contracts and capability prerequisites.
HTTP-only checks reached 11/11 entries; no new rendering/arrival/pose evidence.
The diagnostic no longer infers bookmark restoration from pose receipt. Viewer
loading/navigation/lifecycle and provider configuration remain unchanged.
Dependent bookmark implementation has not begun; assessment editor/actions stay
Phase 3 under D068. No phase completion, new exception, commit or push.

## Phase 1 continuation status - 2026-09-21 (D069)

Implemented on the existing shell: all ten discovery filter dimensions, debounced multi-field description search, area/capture/recent sorting, zoom-dependent nearby pin groups, full public dossier sections and practical fields, combined evidence/source disclosures, and public-link copy with fallback. D068 assessment summary/action placement and ownership contracts are defined in docs/UI_INTERACTION_DESIGN.md; the editor and working entry actions remain Phase 3. Catalog/schema/provider configuration and user changes are preserved.

Phase 1 remains IN PROGRESS pending live exit evidence. No browser surface is available; new live checks and inherited Phase 0 catalog/storage browser obligations are BLOCKED. Full test 44 candidate/compare/shot integration remains NOT TESTED until Phase 3/4 dependencies exist; no nonfunctional buttons were added and no exception is presumed. See the D069 Part C/J execution record for exact results and retest conditions.

## Approved scope addition — 2026-09-21 (D068)

Scouting Assessments (F06-SA) are approved within Phase 3 Project Workspace, after candidate creation and before requirement evaluation/comparison. [SCOUTING_ASSESSMENTS_PLAN.md](SCOUTING_ASSESSMENTS_PLAN.md) defines records, shared editor, source reuse, migration/import and failure contracts. This is planning approval only; current implementation status and earlier evidence remain unchanged. Tests 206–215 extend essential exit gates. Advanced field capture and sensor/offline phone tools remain Phase 7; no new mode or product family is added.

## Context

`E:\sroberto27.github.io\SLiVR` currently holds only specifications and research records — no application code (`git ls-files SLiVR` returns 0 tracked files). The approved guide `SLIVR_ARCHITECTURE_AND_FEATURES.md` v0.19 calls for a static, no-build, map-centred film **location scouting and shot planning** web application for Lafayette, Louisiana, adapting proven behaviour from the read-only LSU3D campus map at `E:\sroberto27.github.io\Wrapper\map\LSU3D` while discarding its recruitment purpose, Baton Rouge content and LSU assumptions.

The problem: a scout's evidence is scattered across a spreadsheet, eleven Treedis tour URLs, public web pages and a shot-diagram image. Nothing connects *why a place fits the scene* to *what has been observed*, *what is still unknown* and *how the shot could work*. The prototype's outcome is a defensible scouting decision carried end to end — discover → dossier → immersive inspection → candidate comparison → shot design → export — with unknowns preserved as unknowns.

This plan covers essential **Phases 0–5** in dependency order, then **Phase 6 (Treedis Research Mode)** as a separate post-prototype workstream. Every phase maps to stable test IDs in `docs/FULL-SYSTEM-TESTING.md` (183 tests, Parts A–J) and to the records under `research/`.

**Decisions confirmed during planning (2026-09-19):**
- `SLiVR/docs/` and `SLiVR/outputs/` are **never committed** (SLiVR-scoped `.gitignore`), so private references are absent from the published site rather than merely unlinked.
- Routes are **hash routes** — `…/SLiVR/#/location/LOC-001` — preserving the approved path grammar on a static host with no rewrites.
- The user **administers the six Treedis experiences** (capture metadata and rights are obtainable in Phase 0) and **will supply a Google Maps 3D Tiles key** (a new key, never the LSU3D one).

---

## 1. Understanding and scope boundary

**Product.** A static web application with four persistent modes — `Explore`, `Projects`, `Immersive`, `Shot Designer` — sharing one store, one set of stable domain IDs and one save-status surface.

**Users.** Location scouts, directors/DPs and producers doing remote screening and early shot planning; a reviewer reading an exported packet.

**Geography.** Catalog 1.1.0 has 18 records across seven operational areas (D064, including future LaSEL / Antoun Hall), envelope ≈ lat 30.200–30.255, lon −92.050 to −92.005 (a padded planning region, not a legal, property or capture boundary).

| Area | Current | Future | Experiences |
|---|---:|---:|---|
| AREA-01 Downtown Core | 7 | 0 | `5eb11a1b` ×6 + `a872109b` (Magnolia Pantry) |
| AREA-02 Sterling Grove / North Sterling | 1 | 0 | `6af20e40` (Givens House) |
| AREA-03 Johnston St / Moncus / Blackham | 2 | 1 | `62704853` (Play N Trade), `4c37c871` (Moncus Park) |
| AREA-04 Northside / Clara Street | 1 | 0 | `a21e99a0` (former Truman) |
| AREA-05 Cajundome / South Campus | 0 | 4 | — |
| AREA-06 UL Main Campus | 0 | 1 | — |

LOC-001…LOC-011 are current Treedis; LOC-012…LOC-017 are future candidates. The six `5eb11a1b` records stay six separate catalog records with their own addresses, entry sweeps and authority questions.

**Five required families (first prototype):** Location Atlas (F01), Location Dossiers (F02), Immersive Scout + basic bookmarks (F03/F04), Project Workspace (F05/F06), Shot Designer Core (F08–F12), plus F19 capture metadata (read-only) and F20 reliability/accessibility/portability as baseline.

**Explicitly out of the prototype:** F07 visit planner, F13 sun/weather, F14 logistics map, F15 permissions/costs, F16 technical-scout handoff, F17 wrap, F18 collaboration, F19 management UI, the F20 dedicated phone field toolkit, and F21 Treedis Research Mode. No accounts, backend, cloud sync or shared workspace. No field anywhere for contracts, insurance, access codes or private contacts (test 83).

**Read-only reference rule (D044, D053).** LSU3D and Experimental/SCSU are inspected, never written, staged, formatted, deployed over or cleaned. Adapt their existing code into SLiVR's module system; conceptual similarity alone is not reuse. LSU3D supplies existing map behavior; Experimental supplies the working Treedis wrapper and immersive street viewer. Record required deviations, and add new code where the approved architecture needs behavior with no counterpart. Campus content, coordinates, branding, credentials and command files are not copied into application source. Every commit contains only `SLiVR/` paths, verified before commit and before push (tests 1, 2).

**Truth rules that constrain every surface.** `Need validation` and `Information has not been found` are preserved verbatim and never rendered as a favourable claim. Operator ≠ property owner ≠ filming authority ≠ public contact. Public hours ≠ production availability. A capture ≠ filming permission. Aerial imagery ≠ measured geometry. A virtual visit ≠ a completed technical scout.

---

## 2. Source reuse matrix

**All-phase source amendment, 2026-09-20 (D058).** Both
`E:\sroberto27.github.io\Wrapper\map\LSU3D` and
`E:\sroberto27.github.io\Wrapper\map\Experimental` (SCSU) are approved
read-only code ground-truth and refactoring sources for every phase. Inspect
both for relevant implementations before writing new code. This matrix is an
existing inventory, not a restriction to LSU3D. Extend it with SCSU counterparts
as each work package is planned. Select proven behavior compatible with SLiVR,
record the source project/file/line and rationale, and keep all edits in SLiVR.
SCSU remains the preferred Treedis source, but may supply other features too.


**Treedis source amendment, 2026-09-20 (D053).** The two LSU3D Treedis rows below
remain as the historical defect analysis, but their implementation source is now
Experimental/SCSU: `js/03-tour-bridge.js` for commands and the 600 ms readiness
delay, `js/04-street-view.js` for queued sweep/orientation, four 1500 ms arrival
attempts and shared-session reuse, and `map.html:299-306` for the iframe surface.
SLiVR retains exact origin/source/payload validation, bounded load/navigation
timeouts and disposal. Independent experiences use a new frame identity; shared
entries reuse a responsive session. These differences implement the approved
multiple-model lifecycle, not a replacement viewer design.

Verified by tracing LSU3D's runtime modules, data files and test suites. LSU3D is a classic-script app: 22 `<script src>` tags in one shared global scope, with later files **reassigning earlier global functions** (`14-redesign.js:142` wraps `updateTourbar`, `17-router.js:328` wraps `selectFeature`, `12-start-screen.js:885` wraps `openStreetView`). That wrapper chain is the single thing this plan most deliberately does **not** carry forward.

| LSU3D source | Verified behaviour | Adapt into SLiVR | Must change | Must not copy | Evidence |
|---|---|---|---|---|---|
| `js/15-core-services.js` | IIFE → `window.Core`; ready-queue with late registration and `safely()` isolation; prefixed `localStorage` helper that never throws; haversine/bearing/format helpers | **High reuse.** Ready-queue idea → `app/store.js` subscription; storage helper → `slivr:`-prefixed wrapper; distance maths → `spatial/geo.js` | Metric-first with unit conversion at boundaries; drop `walkMinutes` (a 3.3 ft/s *gameday-crowd* pace, invalid here) | The analytics ring-buffer + sink. SLiVR ships **no** telemetry in Phases 0–5 (D013, test 139/183) | `15-core-services.js:46-88, 196-254, 258-336`; suite `core-services.test.mjs` 35 passing |
| `js/17-router.js` | Query-param routing (`?stop=`) chosen *because GitHub Pages cannot rewrite*; slug helpers; `applyingRoute` re-entrancy guard; fixed key order in `buildSearch()`; `popstate` handling; non-blocking unknown-route toast | **High reuse of structure.** Re-entrancy guard, deterministic serialisation, unknown-ID recoverable state, `Core.onReady(applyInitialRoute)` ordering → `app/router.js` | Hash form `#/location/LOC-001`; IDs not slugs (catalog IDs are already stable); no name parameter | The recruit-name parameter and its privacy rationale; share title string | `17-router.js:8-17, 44, 159-193, 271-322, 373-388`; suite `router.test.mjs` 47 passing |
| `js/07-layer-builders.js` | `prepGeoJSON()` bakes a **stable numeric feature id** so `setFeatureState` works; source + fill/fill-extrusion layer pair; delegated `mousemove/mouseleave/click` per layer; co-located pins grouped by `center.toFixed(6)` and expanded on hover/focus/**tap** | **Adapt.** Numeric-id baking, feature-state hover/select, marker element pattern, touch-safe cluster expansion → `map/layers.js`, `map/markers.js` | Add an `unbind`/teardown path (LSU3D never unregisters layer events); replace name-string style lookup with an explicit `captureStatus` property | LSU palette, `isParkFeature()` regex on a content file, ROUTE/FACILITY vocabulary | `07-layer-builders.js:27-44, 78-115, 120-169, 209, 284-298`; documented gotcha at `:147-154` (`fill-extrusion-opacity` rejects expressions and silently kills the layer) |
| `js/05-map-helpers.js` | `cameraForBounds` → `setMaxBounds`/`setMinZoom`; shared debounce; `window.__captureView()` prints a paste-ready camera snippet | **Adapt.** Constraint logic and `__captureView` (genuinely useful for authoring region config) | Decouple from the Google-tiles activation call; navigation camera must never write authored shot-camera state | LSU bounds, `bearing: 200` "facing the river" preset | `05-map-helpers.js:10-56, 69-140, 161-172` |
| `config.js` imagery block | DOTD ImageServer via `exportImage` + MapLibre's `{bbox-epsg-3857}` token — **no esri-leaflet needed**; measured `jpg 17,177 B / 0.18 s` vs `png32 156,115 B / 0.28 s`; `size=512` + `tileSize:512` + `maxZoom:20` (52,382 B vs 68,708 B for four 256s) | **Adapt the exact request shape and the measurements** into `map/imagery.js` | Add the real primary→fallback failover LSU3D lacks; add content (not status-code) validation | LSU bounds/centre/zoom presets; OSM tiles as a production overlay (flagged prototype-only at `config.js:89-93`) | `config.js:44-79, 95-99`; `11-boot.js:219-256` |
| `js/16-google-tiles.js` | The hard-won part: **two three.js cameras** — a draw camera fed MapLibre's view-projection, and a separate real `PerspectiveCamera` handed to `tiles.setCamera()` because `3d-tiles-renderer` reads `projectionMatrix.elements[5]` for screen-space error, making refinement bearing-dependent otherwise; ECEF→ENU→mercator anchoring at a local origin; **activation-generation counter** checked after every `await`; `waitForGoogleTilesReady` with a `quietMs` debounce plus a `maxWaitMs` ceiling; sticky session-scoped failure flag | **Adapt the maths and the lifecycle discipline** into `shot-workspace/three-bridge.js` and the optional Google layer. The generation-counter pattern becomes the template for the Treedis adapter | Add **WebGL context-loss handling** and a real dispose path (both absent); authored objects live in SLiVR's scene model, never bound to tile internals | `config.js:173` — a **live, committed Google Maps API key**, duplicated in `config.local.js:23`. Never copy the key or the "it's public anyway" pattern | `16-google-tiles.js:52, 147-209, 246-255, 383-529, 543-600, 611-685`; zero hits repo-wide for `webglcontextlost`/`dispose()` |
| `js/03-tour-bridge.js` | Treedis `postMessage` bridge. Documented protocol: **out** `Ping`, `Navigate{sweepId, transitionTime, rotation}`, `RequestSweeps`; **in** `TourReady`, `PoseChanged`, `SweepsChanged`, `Tag*`. 2 s ping loop; 600 ms deferred flush after `TourReady` | **Keep only the ~6-message protocol shape** as the starting vocabulary for `immersive/treedis-messages.js` | Everything else is rewritten — see the defect list below | The transport layer wholesale | `03-tour-bridge.js:10-20, 27-40, 44-93, 121-127` |
| `js/04-street-view.js` | Iframe overlay; queue-until-ready `pendingSweep`; escalating loading copy on timers; 4×1500 ms verify-by-polling retry loop; close is presentational only — the iframe is never unloaded | **Keep two ideas:** queue-until-ready, and escalating loading copy | Rewrite the retry loop (acks, not polling a private field); add real disposal on leave (test 65) | Reaching into `TourBridge._currentSweepId`; name-string sweep→stop matching | `04-street-view.js:12-24, 86-167, 179-191, 194-245, 269-333` |
| `js/00-data-adapter.js` | The "one adapter owns the shape decision" seam — explicitly the CMS swap point; tolerant loading (`tryFetchJSON` returns `null` on `!ok` **or on a `text/html` body**, guarding against parsing a 404 page) | **Adapt the seam** into `data/catalog-repo.js`, and the `text/html` guard verbatim | Join on stable IDs, not lowercased display names | `window.SCSU_DATA`; the vestigial `file://` shim prose | `00-data-adapter.js:19-20, 38-49, 60-123` |
| `scripts/validate-data.mjs` | Error/warning split with positional locators (`stops[2]`, `sweeps[1].desktop`); a swapped-lng/lat heuristic; **privacy assertions as hard errors** (`contacts[].name`/`email` rejected because "this file is public"); exit 1 on error, 0 with warnings | **High reuse of the design** → `tools/validate-catalog.mjs` | SLiVR schemas, referential integrity, coordinate-envelope and evidence-provenance checks | LSU slug fixtures; the `slugify` duplication (SLiVR joins on IDs, so no slug contract to keep in sync) | `validate-data.mjs:25-52, 97-107, 131-133, 213-222, 253-263` |
| `scripts/run-tests.mjs`, `scripts/tests/*` | 195 passing across 5 suites. One child process per suite; contract is exit code + a `/^\d+ passed, \d+ failed$/m` line. Browserless execution via `node:vm` + hand-written DOM shims. **Two text-diff structural tests**: `service-worker.test.mjs` regex-diffs `sw.js`'s precache list against `index.html`'s `src`/`href` list; `coachmark.test.mjs` asserts every walkthrough selector exists in the HTML and isn't `display:none` | **Adapt the structural-diff idea** (the right compensating control for a no-build project) and the "green means the logic holds, never that it works" discipline | SLiVR is ES modules, so domain/spatial/exports tests `import()` directly under `node --test` — no `vm` needed. Keep `vm`/text-diff only for precache-list drift and forbidden-string scans | The literal LSU bbox baked into `modules.test.mjs:139-143` | `run-tests.mjs:11-15, 33-57`; `service-worker.test.mjs:34-46`; `coachmark.test.mjs:38-65` |
| `sw.js` | Scope-safe by directory placement; `lsu3d-` cache-name prefix so eviction only deletes its own; `NEVER_CACHE` host list (`maps.dotd.la.gov`, `treedis.com`, `tile.googleapis.com`, …) — *"a terms problem as well as a staleness one"*; kill-switch files served network-first because *"a kill switch that needs two attempts is not a kill switch"*; ships **off** by default | **Adapt** all of the above into a Phase 5 `sw.js` | Cache name `slivr-shell-v{n}`; scope `/SLiVR/`; SLiVR's own never-cache list | — | `sw.js:19-24, 44-45, 115-122, 146-147, 203-216`; `config.js:266` |
| `js/22-service-worker.js` | Registration/kill-switch driver. **Defect:** `navigator.serviceWorker.getRegistrations()` at `:50` is origin-wide, so the removal path would unregister a sibling app's worker | Adapt the kill-switch and deferred-registration discipline | **Filter by `reg.scope` before `unregister()`** | The origin-wide enumeration — this is exactly what test 8 forbids | `22-service-worker.js:42-96` |
| `js/02-state.js`, `js/14-redesign.js`, `js/09-sidebar-search.js`, `js/06-details-panel.js`, `js/11-boot.js`, `index.html` | Selection fans out through one `selectFeature()` seam (`06-details-panel.js:381-480`) that imperatively calls nine consumers; search is an uncapped linear substring scan with **no debounce** and an 8-result cap; details bind by `name.toLowerCase()` into flat config maps; two `innerHTML` interpolations are unescaped (`09-sidebar-search.js:56`, `06-details-panel.js:275-281`) | **Keep only the principle:** one authoritative selection transition | Replace with explicit actions + subscriptions; debounce search; bind by ID; escape or use `textContent` everywhere | The wrapper chain, the LSU bounds fallback, all branding/copy | `02-state.js:330-396`; `06-details-panel.js:381-480`; `09-sidebar-search.js:504-644`; `10-event-wiring.js:101` |

**Defects in the LSU3D Treedis bridge that the SLiVR adapter must fix** (each maps to a test):

1. Origin check is *effectively off* — `config.treedis.origin` is `""`, so `expected` is `null` and the guard short-circuits; every `window.message` from any frame is accepted (`03:47-49`). → tests **55**, **59**.
2. No `event.source` check — any same-origin frame can spoof `TourReady`/`PoseChanged`. → test **55**.
3. Outbound `postMessage(cmd, "*")` (`03:126`). SLiVR posts to the exact Treedis origin. → test **55**.
4. No payload schema validation; `data.sweep || data.sweepId` flows straight into UI mutation. Note the `||` idiom would also discard a legitimate `0`. → tests **55**, **56**.
5. The message listener is `.bind(this)`'d inline and never stored; there is **no `destroy()` on `TourBridge` at all** (zero `removeEventListener("message"` in the repo). → tests **65**, **129**.
6. `initialize()` is not idempotent; a second call adds a second listener and a second interval. → tests **57**, **129**.
7. The 2 s ping loop has no cap, no backoff and no give-up state; a second independent 100 ms poll runs up to 60 s in `11-boot.js:107-143`. → test **58**.
8. **No generation or cancellation token** — the 600 ms deferred flush fires even if the user closed the overlay. (The correct pattern exists in the same codebase, at `16-google-tiles.js:52`.) → tests **52**, **57**.
9. No `Navigate` ack and no error message type; failure is indistinguishable from slow network. → tests **54**, **58**, **59**.
10. The overlay close never unloads the iframe or tears down the bridge, so a Treedis session lives for the whole page. → test **65**.

**A material caveat:** LSU3D's `data/treedis-sweeps.json` has **every `sweepId: null`** and `config.js` ships `modelId: ""`, `tourUrl: ""`. The bridge has therefore *never been exercised against a live Treedis model*. Its message vocabulary is copied from Treedis documentation, not proven behaviour — which is precisely why test 28 (capability reconnaissance) is a Phase 0 gate item and why the adapter is built against a configurable message map with a URL-reload fallback.

---

## 3. Target application structure

No bundler, no framework, no TypeScript. `index.html` loads one ES-module entry plus an import map pinning **exact** versions (LSU3D pins `maplibre-gl@4` — a floating major — while its service worker cache-firsts that URL "as immutable"; SLiVR pins patch-exact).

```text
SLiVR/
  .gitignore                     docs/  outputs/  config/runtime.js
  index.html                     app shell + import map
  manifest.webmanifest           SLiVR-scoped identity
  sw.js                          Phase 5 only; scope /SLiVR/, cache slivr-shell-v{n}
  config/
    runtime.example.js           committed template
    runtime.js                   GITIGNORED — Google key, optional toggles
  src/
    app/        main.js  shell.js  router.js  store.js  actions.js  capabilities.js
                save-status.js  errors.js
    domain/     ids.js  schema.js  location.js  capture.js  project.js  scene-brief.js
                candidate.js  bookmark.js  shot-scene.js  shot.js  variant.js
    data/       catalog-repo.js  workspace-repo.js  idb.js  migrations.js
                transfer.js  conflicts.js
    map/        maplibre-adapter.js  region-config.js  imagery.js  layers.js
                markers.js  filters.js  search.js
    immersive/  treedis-adapter.js  treedis-messages.js  capability.js  bookmarks.js
    spatial/    units.js  geo.js  frames.js  calibration.js  optics.js
    shot-workspace/ scene-model.js  commands.js  selection.js  view-plan.js
                view-3d.js  three-bridge.js  paths.js  preview.js  background.js
    scouting/   brief-form.js  comparison.js  decision.js
    exports/    project-json.js  diagram-png.js  shotlist-csv.js  packet-html.js
                emergency.js  filenames.js
    ui/         panel.js  fields.js  evidence-badge.js  status-chip.js  dialog.js
                a11y.js  toast.js
  styles/       00-tokens.css 10-shell.css 20-explore.css 30-immersive.css
                40-projects.css 50-shot-designer.css 90-print.css
  data/         catalog/{locations,captures,areas,sources,scout-details}.v1.json
                catalog/manifest.json   region/lafayette.region.json
  tests/        *.test.mjs (node --test)  fixtures/
  tools/        build-catalog.mjs  validate-catalog.mjs  check-deploy-scope.mjs
                probe-imagery.mjs
  docs/         PRIVATE — gitignored, never deployed
  outputs/      PRIVATE — gitignored, never deployed
  research/     committed (contains no private content)
```

### Module responsibilities and dependency direction

Dependencies point **inward only**: `ui` → `app` → `scouting`/`shot-workspace`/`map`/`immersive` → `domain`/`spatial`/`data`. `domain` and `spatial` import nothing from the application, which is what makes them testable under plain `node --test`.

- **`app/store.js`** — one authoritative state object plus `subscribe(selector, fn)`. All mutation flows through `actions.js`. Adapters *emit* events; they never write state. This is the structural answer to LSU3D's nine-call `selectFeature()` fan-out plus wrapper chain, and it is what makes tests 34 (synchronised selection, no feedback loops) and 74 (edit from either surface, updates once) achievable rather than accidental.
- **`app/router.js`** — hash routes `#/explore`, `#/location/{locationId}`, `#/immersive/{locationId}[?bookmark=]`, `#/project/{projectId}`, `#/project/{projectId}/scene/{sceneId}`, `#/shot/{shotSceneId}`. Deterministic serialisation, an `applyingRoute` re-entrancy guard (adapted from `17-router.js:44`), `hashchange`/`popstate` handling, and a recoverable not-found state for unknown IDs. Routes carry record IDs only, never private content.
- **`app/capabilities.js`** — one runtime capability object (`webgl`, `indexedDB`, `googleTiles`, `canvasReadback`, `treedis.*`) that feature modules consult instead of assuming provider behaviour.
- **`domain/schema.js`** — small dependency-free validators returning `{ok, errors:[{path, reason}]}`. Every persisted and imported record passes through them **before** any write (tests 13, 19).
- **`data/*`** — the only modules touching IndexedDB, behind an async record API, so a later authenticated backend replaces one file.
- **`map/*`** — MapLibre behind `maplibre-adapter.js`; every URL, year, attribution and bound lives in `region-config.js` / `imagery.js`.
- **`spatial/*`** — pure maths: units, WGS84↔local ENU, calibration transforms, lens FOV. The home of every number that appears in an exit gate.
- **`shot-workspace/scene-model.js`** — one scene graph; `view-plan.js` (Canvas2D top-down) and `view-3d.js` (Three.js) are *readers*. Neither owns geometry — that is what makes test 85 (synchronised views) and test 99 (provider failure cannot remove authored state) structural rather than hopeful.
- **`exports/*`** — pure functions from records to string/Blob, unit-testable without a browser.

### Deliberately absent abstractions

No plugin system, no generic entity registry, no event bus for future collaboration, no adapter interface for providers that do not exist. The extension points that *are* created — repository adapter, provider capability object, region config, export registry — each have two or more concrete users inside Phases 0–5.

---

## 4. Data model and migration

### 4.1 Public catalog (read-only, versioned, derived)

`tools/build-catalog.mjs` reads the private workbook and emits committed JSON. The workbook stays local; the catalog is its **filtered public projection**. The xlsx is parsed with `node:zlib`/`zipfile` + the built-in XML reader — no dependency install, consistent with the no-build rule.

`data/catalog/manifest.json` → `{ catalogVersion: "1.0.0", generatedAt, sourceWorkbook, researchSnapshot: "2026-09-19", counts: {locations:17, current:11, future:6, areas:6} }`.

| Record | Key fields | Workbook sheet |
|---|---|---|
| `Area` | `id` (AREA-01…06), name, description, currentCount, futureCount, priority, validationBeforeCommitment, sourceIds | Area Coverage |
| `Location` | `id` (LOC-001…017), name, areaId, captureStatus (`current`\|`future`), venueType, coverageSummary, address, position{lon,lat,evidence}, operator, propertyAuthority, ownershipStatus, publicHours{text,evidence}, publicPhone, accessContact, website, filmingAccess, researchStatus, sourceIds | Locations |
| `ScoutDetail` | `locationId` + 18 practical fields (parking, loading, basecamp, power, restrooms, accessibility, ambient sound, traffic, light/orientation, security, catering, filming rules, permits, availability, hazards, on-site priorities, immersive notes), sourceIds, recordStatus | Scout Details |
| `Capture` | `id` (CAP-001…017), locationId, state, grouping, experienceId, sweepId, startX, startY, url, captureDate, coverageNotes, validationStatus | Capture Inventory |
| `Source` | `id` (SRC-…), locationIds, title, publisher, type, url, accessed, factsSupported, authorityLimitation | Sources |

**Transformation rules**, enforced by `tools/validate-catalog.mjs` and mirrored in `tests/catalog.test.mjs`:

- `Need validation` and `Information has not been found` are carried through **verbatim** and rendered as explicit unknown states. Never mapped to `null`, `""`, `false` or a default (tests 9, 40, 42).
- `captureStatus` derives only from the workbook's *Capture status* column. Research status (`Partially verified` / `Need validation`) is a **separate** field that never overwrites it (test 33).
- `position.evidence` preserves provenance verbatim (`Nominatim geocode; validate survey-grade position`, `Library of Congress HABS coordinate`) and drives the approximate-coordinate label (test 40).
- `startX`/`startY` keep full supplied precision as numbers. `0` is a valid value throughout the stack — validators use `Number.isFinite(v)`, never truthiness (the `||` defect at `03-tour-bridge.js:87`). Test **56**.
- Future candidates get `experienceId: null` and a `state:"future"` Capture with no sweep. **No tour URL is ever synthesised** (test 43).
- **Published** fields: name, area, venue type, address, coordinates + evidence, coverage summary, public hours + evidence, public phone, website, operator, ownership-status wording, filming-access wording, research status, source register, scout-detail practical fields. **Never published:** the workbook itself, and anything later marked restricted. The prototype has no field at all for sensitive documents (test 83).
- Validation rejects: missing/duplicate IDs; non-finite or out-of-envelope coordinates; a swapped-axis heuristic (adapted from `validate-data.mjs:103-105`); unknown `areaId`/`locationId`/`sourceId` references; `captureStatus:"current"` without a resolvable experience+sweep; and any `experienceId` absent from the region-config allowlist. Error/warning split with positional locators and exit-1-on-error, following `validate-data.mjs:25-29, 253-263`. Test **13**.

### 4.2 Workspace (IndexedDB, local only)

Database `slivr-workspace`, version 1. All `localStorage` keys use the `slivr:` prefix; cache names `slivr-*`. (LSU3D's own `lsu:showStartScreen` is *not* app-scoped and shares the origin with its siblings — the concrete mistake test 8 exists to prevent.)

| Store | Indexes | Contents |
|---|---|---|
| `meta` | — | `schemaVersion`, `catalogVersion`, `appVersion`, `lastOpened` |
| `projects` | `updatedAt` | name, productionType, description, status, `timeZone:"America/Chicago"`, timestamps |
| `scenes` | `projectId` | scene brief: number, title, storyLocation, intExt, dayNight, description, character/period, requiredSpaces, cast/extras/vehicles, equipment, crewSize, mustHave[], preferred[], rejectionConditions[], openQuestions[], notes |
| `candidates` | `projectId`, `sceneId`, `locationId`, `[projectId+sceneId]` | status, addedAt, rationale, strengths, concerns, missingInfo, requirementAssessments[], decisionNotes |
| `bookmarks` | `projectId`, `locationId`, `captureId`, `candidateId` | experienceId, sweepId, supported view fields, name, note, createdAt, captureVersionRef, adapterCapabilityVersion |
| `shotScenes` | `projectId`, `sceneId`, `candidateId`, `locationId` | frame origin, northOffsetDeg, units, background ref, calibration state, activeVariantId, revision, frameVersion |
| `sceneObjects` | `shotSceneId`, `[shotSceneId+type]` | type, transform, per-type props |
| `paths` | `shotSceneId`, `ownerObjectId` | control points, interpolation, duration |
| `shots` | `shotSceneId`, `variantId`, `order` | shot number, camera, shot type, lens/aspect, description, movement, duration, status, notes |
| `variants` | `shotSceneId` | name, createdAt, revision, snapshot ref |
| `assets` | `shotSceneId` | **owned** floor-plan/reference image Blob + provenance + original dimensions |

Catalog IDs come from the workbook (`LOC-`, `CAP-`, `AREA-`, `SRC-`). Workspace IDs are `{prefix}_{crypto.randomUUID()}` (`prj_`, `scn_`, `cnd_`, `bkm_`, `sht_`, `obj_`, `pth_`, `shot_`, `var_`, `ast_`). **Display names are never foreign keys** — LSU3D joins `tours.geojson` → `locations.json` → `treedis-sweeps.json` on a lowercased display name, so a rename silently breaks the sweep mapping.

**Autosave.** Debounced per aggregate, ordered by a per-record `revision`; a completing older write is discarded when the revision has advanced (test 80). Status surface: `Saving… / Saved locally / Save failed`, with retry plus *Export emergency JSON* (tests 21, 116, 122).

**Recalibration safety.** Changing a scene's calibration increments `frameVersion`; existing variants and review snapshots keep their original frame version, and migration is an explicit user action (test 111).

### 4.2.1 Planned assessment schema extension (D068)

Phase 3 adds `scoutAssessments`, immutable `scoutAssessmentRevisions`, and project-owned `scoutMedia`, with versioned templates and candidate requirement links to exact assessment revisions/questions. Extend schema validation, IDs, migrations, conflict remapping, deletion, transfer and emergency export together. Keep persistence behind the existing repository. The [assessment plan](SCOUTING_ASSESSMENTS_PLAN.md) defines ownership, legacy false/zero ambiguity, missing-media reporting and backward migration; no database version is bumped by this planning change.

### 4.3 JSON transfer

Envelope: `{ schemaVersion: "1.0.0", appVersion, exportedAt, catalogVersion, kind: "slivr-project", payload: {...}, assetsInline?: [...] }`.

- Import order: parse → validate the whole envelope → resolve references → detect ID conflicts → **then** write in one transaction. No partial mutation on failure (test 19).
- Unsupported `schemaVersion` is a classified rejection naming the version, never a silent partial load.
- Conflicts (test 20): **Cancel** writes nothing; **Add as copy** regenerates every payload ID with references rewritten consistently; **Replace** deletes only the named project's owned records.
- Catalog references are `{locationId, captureId, catalogVersion}`. A differing `catalogVersion` imports successfully and surfaces a "catalog version differs" note — it never rewrites catalog facts.
- Provider imagery is never embedded; only *owned* assets are inlined with provenance.
- `exports/emergency.js` serialises the same envelope from memory with no IndexedDB access.

### 4.4 Coordinates, calibration and evidence

- Catalog/geographic: WGS84 lon/lat decimal degrees.
- Shot scene: local **ENU metres**, `origin {lon, lat, groundElevationM, elevationDatum}` + `northOffsetDeg` (0 ⇒ scene +Y is true north). `spatial/frames.js` uses a local tangent-plane approximation and documents its validity radius.
- Heights separated: `groundElevationM` (datum recorded) → `floorElevationM` (relative to ground) → object `heightM` / camera `mountHeightM` (above its floor).
- Stored metric; ft/in only at input/output boundaries (`spatial/units.js`).
- Calibration record: `{id, sourceFrame, destFrame, axisConvention, unitScale, translation, rotationDeg, controlPoints[], method, date, residualEstimate, accuracyMode}`, `accuracyMode ∈ {schematic, approximatelyAligned, measuredCalibrated}`. The achieved residual is displayed, not just the badge (test 110).
- Fact evidence: `{value, unit, source (SRC id), method, observedAt, observer, verification ∈ {reported, observedRemotely, verifiedOnSite, needValidation, notFound}, visibility}`. Absence never renders as "no restriction".

---

## 5. Provider feasibility matrix

**Evidence correction, 2026-09-20 (D055):** the URL-entry fallback below is a
candidate recovery path, not a guarantee that loading "always works." A valid
entry URL and an iframe `load` event establish neither a rendered tour nor arrival
at its sweep. L033 remains open; new tests 185–199 cover client behavior with
deterministic doubles and do not establish provider availability.

| Provider | Category | Expected capability | Phase 0 validation | Fallback | Evidence |
|---|---|---|---|---|---|
| **DOTD 2025 Various 6-Inch RGBI** (primary) | Verifiable | MapLibre raster source: `exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=jpg&f=image&bandIds=0,1,2`, `tileSize:512`, `maxzoom:20` (the exact form proven in `config.js:68-78`) | One request per operational area (6 points), inspecting **pixel content** — decode and reject uniform/near-black responses. Run in `tools/probe-imagery.mjs` **and** live in-browser; record endpoint, bbox, date, bytes, screenshot | 2024 Lafayette service → neutral background layer | Tests **22**, **24** |
| **DOTD 2024 Lafayette 6-Inch RGBI** (fallback) | Verifiable | Same request shape, Lafayette extent | Block the primary host; confirm equivalent coverage renders with the fallback year in the attribution | Neutral background + status message | Test **23** |
| **DOTD MapServer layer 187** | **Confirmed negative** | 2026 6-inch, but published extent and sample requests returned no-data over this inventory | Configuration + network inspection: never the configured Lafayette primary; an all-black response must never silently substitute | n/a | Test **25** |
| **Google Photorealistic 3D Tiles** | User-supplied credential (**confirmed available**) | Optional exterior 3D context. Key lives in gitignored `config/runtime.js`, **a new key referrer-restricted to the SLiVR path** | Exercise with key, missing key, denied request, slow response, disabled config. Reuse LSU3D's dual-camera LOD maths and generation guard; **add** WebGL context-loss handling and disposal | Aerial / imported plan / blank-grid workspace; authored objects unaffected | Tests **7**, **26**, **99** |
| **Treedis viewer — 11 supplied entries** | Verified inventory; unverified runtime | **Verified from evidence:** experience IDs, sweep IDs, start X/Y and exact URLs; six share `5eb11a1b`. **Unverified:** whether the configured provider host permits iframe embedding from this origin, whether the documented `Ping`/`Navigate`/`TourReady`/`PoseChanged`/`SweepsChanged` protocol actually responds, whether sweep switching works without reload, and whether pose is emitted. LSU3D's bridge was **never run against a live model** (all `sweepId: null`, `tourUrl: ""`) | Embed all 11 URLs; per entry record load success, inbound message origin/type/shape, sweep navigation without reload, pose availability, failure behaviour. **Because the user administers these experiences**, also retrieve capture date, coverage and reuse rights, and check whether Treedis offers a supported SDK/embed configuration | **URL-parameter entry with a full iframe load always works** — the supplied URLs encode experience+sweep+x+y. No-reload sweep switching, pose-linked mini-map orientation and screenshots are capability-gated enhancements | Tests **28**, **29**; produces the Phase 0 provider-capability matrix |
| **Treedis administrative REST API** | Out of scope | Not used in Phases 0–5 | — | — | Documented |
| **Three.js `0.183.0` + `3d-tiles-renderer@0.5.1`** | Verifiable | Exact import-map pins; camera/actor/frustum scene with known transforms and FOV | Node fixtures for FOV and ENU transforms; a browser spike rendering camera + actor + frustum | Plan-only editing on WebGL loss | Tests **27**, **95–98** |
| **MapLibre GL JS** (patch-pinned) | Verifiable | Raster sources, markers/clustering, GeoJSON, feature-state selection | Boot on the Lafayette envelope with DOTD imagery and all 17 markers | List-only Explore | Tests **31**, **46** |
| **Browser canvas read-back** | Unconfirmed | Only needed if the imagery content check runs in-browser | Attempt `crossOrigin="anonymous"`; if CORS is refused the canvas is tainted | The Node probe supplies pixel evidence; the browser check degrades to load/error only | Recorded with test **22** |

**Provider host, recorded 2026-09-20.** The catalog records `https://spaces.dtsxr.com`, not the provider's
primary `https://my.treedis.com`. Both serve byte-identical tour documents for the same experiences. The
primary host failed to fetch its own tour data while embedded (L033), and the working reference project
embeds the white-label host, so the catalog follows the reference. Whether the change resolves the failure
is Need validation. The region configures the other host as an alias, and the `viewerOrigin` diagnostic
selects it, so the two can be compared without editing the catalog.

A provider uncertainty becomes a Phase 0 validation task with a fallback. Exactly one can block a gate: **if the configured provider host refuses iframe embedding from this origin, or refuses to serve tour data inside a frame**, the Phase 2 exit gate cannot be demonstrated as specified (see §10).

---

## 6. Phase-by-phase implementation plan

### Phase 0 — Foundation and feasibility

**User-visible outcome.** A running SLiVR shell at `…/SLiVR/#/explore` with the four mode buttons, a Lafayette map on DOTD imagery, all 17 catalog records loaded and listed, a local project that survives reload and round-trips through JSON, and a diagnostics page recording what each provider actually did.

**Dependencies/inputs.** The workbook; the Treedis inventory text; the architecture guide; LSU3D and Experimental/SCSU as read-only code references.

**Work, in dependency order.**
1. `.gitignore` (`docs/`, `outputs/`, `config/runtime.js`); `index.html` shell with import map; `styles/00-tokens.css` + `10-shell.css`; neutral filmmaking visual system, no LSU branding.
2. `spatial/units.js`, `spatial/geo.js`, `spatial/frames.js`, `spatial/optics.js` — pure maths first, because they are the only Phase 0 deliverables with numeric exit criteria.
3. `domain/ids.js`, `domain/schema.js` and the record modules.
4. `tools/build-catalog.mjs` → the five catalog JSON files + manifest; `tools/validate-catalog.mjs`.
5. `data/idb.js`, `workspace-repo.js`, `migrations.js`, `transfer.js`, `conflicts.js`; `exports/emergency.js`.
6. `app/store.js`, `actions.js`, `router.js`, `shell.js`, `capabilities.js`, `save-status.js`.
7. `map/region-config.js`, `imagery.js`, `maplibre-adapter.js` + `tools/probe-imagery.mjs`.
8. Provider spikes: minimal Three.js camera/actor/frustum scene; optional Google-tiles activation behind the runtime key; `immersive/treedis-adapter.js` reconnaissance harness rendering all 11 entries with a message log.
9. `tools/check-deploy-scope.mjs`; research-record updates.

**Data/schema.** Catalog v1.0.0 created; IndexedDB v1 created; JSON envelope v1.0.0 defined.

**Automated tests** (`node --test`): FOV fixtures (36.0 × 24.0 mm gate @ 50 mm ⇒ H 39.598°, V 26.991°; Super-35 24.89 mm @ 35 mm ⇒ H 39.152°); ENU round-trip and zero-rotation identity; unit conversions; catalog integrity (17 records, 11/6 split, six areas, referential integrity, verbatim unknown strings, no synthesised future tours); schema rejection cases; JSON round-trip and malformed/future-version rejection; ID-conflict outcomes; filename sanitisation; a structural text-diff asserting no committed file contains a Google key pattern or an LSU identifier.

**Manual acceptance.** Open `#/explore` in a fresh tab; see the Lafayette envelope on 2025 DOTD imagery with attribution; switch all four modes; open `#/location/LOC-003` directly; create a project, reload, confirm it returns; export and re-import into a clean profile; open `#/location/LOC-999` and recover.

**Loading/empty/error/fallback.** Catalog fetch failure → explicit error with retry, never a partially loaded catalog. Imagery failure → fallback source, then neutral background (LSU3D's `#8A9A78` background-layer idea, `11-boot.js:219-225`). IndexedDB unavailable → app runs read-only with a visible banner and emergency export enabled.

**Exit-gate evidence.** Catalog reconciliation report vs the workbook; IndexedDB + JSON round-trip diffs showing identical IDs and relationships; per-area DOTD content-probe results with images; the provider-capability matrix with per-entry Treedis findings including negatives; FOV/transform test output; research records naming every approved feature; a `git diff` proving zero LSU3D files changed.

**Test IDs.** Part A **1–10** (standing); Part B **11–30**. Automated: 11, 12, 13, 16, 17, 18, 19, 20, 27 (fixtures). Live browser/device: 14, 15, 21, 22, 23, 24, 25, 26, 28, 29. Documentation: 30.

**Risks & rollback.** Treedis embedding refusal (see §10 B1) → record per-entry BLOCKED with a retest condition, proceed with the URL-reload path. DOTD CORS refusal for canvas read-back → Node probe carries the evidence. Rollback is trivial: Phase 0 adds only new files under `SLiVR/`.

---

### Phase 1 — Location Atlas and Dossiers (F01, F02, F19 metadata)

**Assessment preparation (D068).** Define active-project assessment summary/action placement and preserve the catalog/workspace boundary. The working editor and entry actions are delivered together in Phase 3; do not ship a nonfunctional placeholder action.

**Outcome.** A synchronised map/list with search, filters, sorting and clustering across all 18 records, and a full dossier with visible evidence and validation states.

**Depends on** Phase 0 catalog, store, router, map adapter.

**Modules.** `map/layers.js`, `markers.js`, `filters.js`, `search.js`; `ui/panel.js`, `fields.js`, `evidence-badge.js`; `scouting`-adjacent dossier view; `styles/20-explore.css`.

**Work order.** Markers + feature-state selection (numeric-id baking per `07-layer-builders.js:27-44`) → list rendering bound to the same selection action → debounced multi-field search (name, address, area, venue type, visual/practical tags; LSU3D has *no* debounce at `10-event-wiring.js:101`) → deterministic filter composition (area, capture, interior/exterior, venue type, historic/contemporary, known public hours, immersive coverage, access status, validation status, completeness) → sorting (name, area, capture availability, recently viewed; optional straight-line distance **never** labelled travel time) → clustering with touch-safe expansion → dossier sections → project actions carrying stable IDs → failure states.

**Automated tests.** Filter composition truth table; search field coverage and case/spacing tolerance; sort stability; dossier section completeness per record; a guard asserting no dossier renderer can convert an unknown string into a favourable value; catalog immutability (a project write never mutates a catalog record).

**Manual acceptance.** Find LOC-003 from map and from list; confirm the same selection; filter to future candidates and confirm the seven show a future state with no tour action; open LOC-012's dossier and confirm no fabricated sweep; copy a location link and open it in a fresh tab.

**States.** WebGL/map init failure → list + dossier remain fully keyboard-operable. Both DOTD services blocked → neutral background, retry control, no stale imagery. Zero results → explanation + clear-filters without reload.

**Exit evidence.** All 18 findable/selectable/linkable; map↔list synchronisation with no feedback loop; capture status and research completeness visibly distinct; approximate/missing/unvalidated facts visible; provider failures leave list and dossier usable.

**Test IDs.** **31–49**. Automated: 32, 35, 36, 37, 39, 45, 48. Live: 31, 33, 34, 38, 40, 41, 42, 43, 44, 46, 47, 49.

---

### Phase 2 — Immersive Scout (F03, F04 basic)

**Assessment preparation (D068).** Make supported bookmark records usable as project/location/capture evidence references. Phase 3 adds the collapsible shared assessment editor; no additional provider capability is assumed. Test 208 covers the integrated handoff at delivery.

**Outcome.** Entering the correct supplied sweep from a dossier, moving among the six downtown entries inside `5eb11a1b`, switching to independent experiences without stale state, saving and restoring bookmarks, and recovering from failures.

**Depends on** Phase 0 capability matrix and Phase 1 dossier actions.

**Modules.** `immersive/treedis-adapter.js`, `treedis-messages.js`, `capability.js`, `bookmarks.js`; `styles/30-immersive.css`.

**Adapter contract.**
- One controlled session; a monotonic **generation token** bumped on every open, navigate and dispose, re-checked after every `await` and in every timer callback (pattern lifted from `16-google-tiles.js:52`).
- States `notLoaded | loading | ready | navigating | unavailable | unauthorized | timedOut | failed`, each with retry and/or return actions.
- Inbound validation: `event.origin` equals the origin the frame was actually pointed at, which is the region's configured host and not necessarily the provider's primary one, **and** `event.source === iframe.contentWindow` **and** a known `type` from the configurable message map **and** payload shape checks using `Number.isFinite`, so a legitimate `0` survives.
- Outbound `postMessage` targets the exact Treedis origin, never `"*"`.
- Configurable timeout → `timedOut` with retry; bounded ping attempts with backoff and an explicit give-up (LSU3D pings forever and separately polls for 60 s).
- `dispose()` removes the listener, clears every timer, blanks the iframe `src` and removes the node. Repeated open/close does not grow iframe, listener or timer counts.
- A `capability` object drives the UI: `canNavigateWithoutReload`, `emitsPose`, `reportsSweeps`, `supportsScreenshot`. Anything unsupported degrades to URL-parameter entry with a full load.

**Automated tests** (adapter against a scripted fake iframe/`postMessage` harness — no live provider): every lifecycle transition; rejection of wrong origin, wrong source window, unknown type, malformed payload and stale generation; `0` preserved through validation; three-way rapid switching where only the final selection becomes active; timeout→retry→return; dispose leaves no listeners or timers; bookmark serialisation round-trip; unsupported-capability restore path.

**Manual acceptance.** Open LOC-001 (Carpe Diem) from its dossier; move to LOC-005 (Rock'n'Bowl) inside the same experience; switch to LOC-009 (Magnolia Pantry, `a872109b`); then LOC-011 (Moncus Park, `4c37c871`); return to Explore and confirm centre/zoom/filters/selection intact; save a bookmark, reload the browser, restore it.

**Exit evidence.** Six downtown records remain distinct; switching among downtown, Magnolia and one non-downtown model works; stale events provably cannot overwrite the active selection; timeouts and failures offer retry or return; a bookmark restores the intended view when supported and explains clearly when it cannot.

**Test IDs.** **50–67**. Automated (harness): 54, 55, 56, 57, 58, 60, 62, 65. Live: 50, 51, 52, 53, 59, 61, 63, 64, 66, 67.

---

### Phase 3 — Project Workspace (F05, F06 including F06-SA)

**Approved work-order amendment (D068).** Project CRUD → scene briefs → candidate creation → dated scouting assessments → requirement evaluation → comparison → preferred/backup decision. Add domain/template and repository support, then the shared Projects/dossier/Immersive editor, attachments and panorama viewing, bookmark/requirement evidence, revision-aware comparison, canonical transfer and previewed legacy import. Proposed modules: `src/domain/scout-assessment.js`, `src/scouting/assessment-template.js`, `assessment-editor.js`, `assessment-evidence.js`, `assessment-media.js`, and `src/data/checklist-import.js`; extend existing persistence/transfer modules rather than creating another database. Implement [the detailed contract](SCOUTING_ASSESSMENTS_PLAN.md) and satisfy **206–212, 214–215**, existing Phase 3 tests and Part J before closure. Private contacts, sensor capture and permission management remain excluded.

**Outcome.** Local productions with multiple scene requirements, candidates with decision states, side-by-side comparison, preferred + backup choices with rationale, autosave and validated JSON transfer.

**Depends on** Phase 0 persistence; Phase 1 dossier actions; Phase 2 bookmarks.

**Modules.** `scouting/brief-form.js`, `comparison.js`, `decision.js`; `ui/fields.js`, `dialog.js`; `styles/40-projects.css`.

**Work order.** Project CRUD → scene briefs → candidate creation from Atlas and Dossier (idempotent: adding the same location twice yields one relationship) → status workflow (`discovered, under review, shortlisted, preferred, backup, rejected, withdrawn`) → requirement ratings (`strong fit, acceptable, concern, fails requirement, unknown`, where **unknown is computationally distinct and never scores favourably**) → comparison grid ≥3 candidates → decision record with preferred/backups/rationale/open questions/reopening → bookmark and shot-scene linking → autosave ordering → deletion confirmation with referential reporting.

**Automated tests.** Status transitions; unknown-never-favourable invariant; candidate uniqueness per (project, scene, location); decision reopen preserves history; autosave revision ordering (older completion cannot overwrite newer); project JSON round-trip with multiple scenes/candidates/decisions/bookmarks/a linked shot scene; delete affects only the named project's owned records; a schema guard asserting no sensitive-document field exists.

**Manual acceptance.** Create a project with two scenes; add three candidates with known, unknown and conflicting evidence; compare; choose preferred + backup with rationale; reload; export; import into a clean profile; reopen the decision and revise one criterion.

**Exit evidence.** Two-plus candidates compared for one scene with unknowns preserved; preferred and backup chosen and reopened with evidence intact; reload and JSON transfer preserve IDs and relationships; a forced persistence failure keeps the working state and offers emergency JSON.

**Test IDs.** **68–84**. Automated: 69, 70, 71, 72, 75, 76, 80, 82, 83, 84. Live: 68, 73, 74, 77, 78, 79, 81.

---

### Phase 4 — Shot Designer Core (F08–F12)

**Assessment dependency (D068).** Display selected assessment findings and owned references beside shot planning; preserve evidence revision and calibration boundaries. Test **213**, affected Phase 4 tests and Part J are required.

**Outcome.** A synchronised overhead 2D plan and perspective 3D view over one scene model, with the approved object set, camera/lens controls with FOV cone and frustum, editable paths, deterministic preview, shot list and variants, floor-plan import and calibration, undo/redo, autosave, PNG diagram and shot-list CSV.

**Depends on** `spatial/*` (Phase 0), Phase 3 candidate linkage.

**Modules.** `shot-workspace/*`, `exports/diagram-png.js`, `exports/shotlist-csv.js`, `styles/50-shot-designer.css`.

**Key structural choice.** The plan view is a **Canvas2D renderer over the scene model**, not MapLibre. A DOTD aerial background is a *single georeferenced `exportImage` request for the scene bbox*, drawn as an image. This keeps the editor independent of map/provider availability, makes PNG export a direct re-render at higher resolution, and is what makes test 99 (provider failure cannot remove authored camera state) structural. The 3D view is Three.js reading the same model, with optional Google tiles as background only.

**Work order.** Scene model + command stack (undo/redo) → selection → plan view → 3D view → the object set (camera, actor/stand-in, vehicle, prop, position mark, direction arrow, annotation, simple wall/set boundary) → transforms by drag **and** numeric fields → grid/snap → camera optics (`FOV = 2·atan(activeGate / (2·focal))`, horizontal from effective gate width after crop, vertical from effective gate height; custom sensor values supported) → coverage cone + frustum from one camera record → paths with control points → deterministic preview honouring reduced motion → shot list sharing one record with the diagram → variants → background modes (DOTD aerial, optional Google 3D, imported owned image, blank grid) → known-distance calibration with accuracy labels → PNG + CSV export.

**Automated tests.** FOV fixtures incl. crop and aspect; invalid zero/negative gate rejection; rotation normalisation at 0°/±180°/±360° with no axis flip or NaN; transform round-trips through save/reload; command-stack undo-to-initial and redo-to-final without touching unrelated objects; autosave/undo interleaving restores the last committed revision; duplicate assigns new IDs; delete reports linked shots/paths and leaves no orphans; calibration scale stability and an independent check distance; preview determinism (identical inputs ⇒ identical positions/timing); CSV headers/encoding/quoting and **formula-injection neutralisation**; filename sanitisation.

**Manual acceptance.** Recreate the supplied downtown reference: magenta Cam A and blue Cam B, each with numbered setup marks along its own path, actor stand-ins with direction arrows, and the two shot descriptions. Save, reload, undo, create a variant, restore it, export PNG and CSV. The reference image is an **oblique** Google Maps screenshot held privately — it is a workflow reference only, is never shipped as an asset, and nothing is treated as measured or georeferenced.

**States.** Google 3D off/failed → aerial/plan/blank grid, editing unaffected. WebGL loss → plan view remains editable with an explicit message. Imported plan starts `schematic` until calibrated.

**Exit evidence.** The downtown structure recreated with ≥2 cameras plus actors/marks/paths; FOV, transform and unit tests passing with recorded values; a known-distance plan retaining scale and calibration status through save/reload; variants preserved; PNG and CSV legible and identifying location, orientation, units, date and revision without claiming unverified precision.

**Test IDs.** **85–112**, plus **118**, **119**, **121** brought forward for the two exports delivered here. Automated: 89, 90, 91, 92, 93, 95, 96, 98, 101, 102, 104, 105, 106, 108, 111, 119, 121. Live: 85, 86, 87, 88, 94, 97, 99, 100, 103, 107, 109, 110, 112, 118.

---


**Binding reuse obligations for this phase (D044, recorded 2026-09-20).** These were
identified by the first reference comparison and must be adopted, not re-derived. Each
names the file to start from.

- **Photorealistic 3D renders inside MapLibre's own WebGL context**, as a
  `type: "custom"` layer, not as a separate canvas over the map — `js/16-google-tiles.js`.
  A second context means a second depth buffer and no shared camera, and the reference
  records that this pattern was proven before it was adopted.
- **Every awaited step in an asynchronous 3D activation is guarded by an incrementing
  generation counter** — `js/16-google-tiles.js:46-47`. Leaving 3D mid-load must not let
  a stale activation clobber a newer one. The same file also caches the dynamic imports,
  records an outright failure so the session stops retrying, and covers the map with a
  veil until the tile loader has gone quiet, so a coarse intermediate frame is never
  shown as though it were finished.
- **The camera projection maths is derived, not guessed** — the reference states its
  ECEF/ENU geo-referencing was verified against the package source and the upstream
  examples, and documents why a view-projection matrix cannot be substituted for a
  projection matrix. Start from that derivation.
- **Disposal and WebGL context loss are SLiVR additions.** The reference deliberately
  disposes nothing, and says so. This phase adds both, which is a deviation under
  reason 1 rather than an oversight to copy.

### Phase 5 — Integrated prototype and release validation (F20 baseline)

**Assessment integration (D068).** Finish selected assessment sections in print-ready packets and canonical JSON/media ZIP export/import. Verify clean-profile recovery, missing-media reports, accessibility, provider failure and storage failure under tests **208–215**, affected phase tests and Part J. The end-to-end trace now includes assessment creation after candidate creation and before comparison; earlier execution evidence does not cover this addition.

**Outcome.** The complete workflow connected, the four exports plus emergency recovery finished, routing/context transitions hardened, resources disposed, accessibility and tablet behaviour verified, deployment and isolation documented.

**Modules.** `exports/packet-html.js`, `project-json.js` completion, `styles/90-print.css`, `sw.js` + registration driver, `ui/a11y.js` hardening, `tools/check-deploy-scope.mjs`.

**Work order.** Save-before-transition for all mode switches → history traversal correctness → resource disposal/suspension per mode → print-ready packet with user-selected sections → export filename policy → accessibility pass (keyboard, focus, contrast, non-colour status encoding, reduced motion) → tablet layout → service worker (scope `/SLiVR/`, cache `slivr-shell-v1`, a SLiVR never-cache list covering `maps.dotd.la.gov`, `spaces.dtsxr.com`, `tile.googleapis.com`, kill-switch files network-first, ships **off** by default, and **`getRegistrations()` filtered by `reg.scope` before any `unregister()`**) → deployment scope check → research-record close-out.

**Automated tests.** Packet HTML section selection and escaping; filename collisions across a representative set; a precache-list ↔ `index.html` text-diff (adapting `service-worker.test.mjs:34-46`); a deploy-scope test asserting no tracked path under `SLiVR/` matches the private allowlist and no committed file contains a credential pattern or LSU identifier.

**Manual acceptance.** The full §7 trace end to end, then Back/Forward through the whole path, then the four exports, then a repeat with DOTD blocked, Google disabled, Treedis blocked, WebGL lost and IndexedDB failing.

**Exit evidence.** Complete workflow without data loss; history and mode switching preserve context; all empty/loading/error/fallback states work; desktop and tablet checks pass; research records match released behaviour; no participant data collected; private references absent from the deployed site; LSU3D and neighbouring apps undisturbed.

**Test IDs.** **113–132**, Part H **133–140**, and the full Part J sweep **172–183**.

---

### Phase 6 — Treedis Research Mode (post-prototype; F21, D014)

**Not in the Phases 0–5 scope, not in the prototype gate, and not started until Phases 0–5 are complete.** Controlled by `research/TREEDIS_RESEARCH_MODE_PLAN.md`. The supplied `docs/TreedisResearch mode information.txt` is design input and prototype material — its SCSU filenames, IDs, assumptions and generated scripts are not copied as production code.

**Trust boundary and data flow.**

```text
 ┌── Participant device ──────────────────────────────────────┐
 │  SLiVR public app (unchanged path)                         │
 │    └─ study launcher ── verifies signed launch             │
 │                      ── shows disclosure, records consent  │
 │                      ── only then builds research iframe   │
 │  ┌─ research iframe ─────────────────────────────────────┐ │
 │  │  research origin (NOT the public origin)              │ │
 │  │   ← proxied Treedis HTML + ONE injected probe bundle  │ │
 │  │   probe: wraps requestSession + session frame callback│ │
 │  └───────────────────────────────────────────────────────┘ │
 └──────────────┬─────────────────────────────────────────────┘
                │ bounded, schema-validated event batches
 ┌──────────────▼── Research origin (dedicated) ──────────────┐
 │  proxy: upstream allowlist → configured Treedis host only  │
 │  collector: launch claim + origin + schema + rate + size   │
 │  private store: immutable raw batches, no public read      │
 └──────────────┬─────────────────────────────────────────────┘
                │ controlled analyst access only
 ┌──────────────▼── Analysis ─────────────────────────────────┐
 │  validate → concatenate by sequence → report gaps/dupes    │
 │  → derived measures from versioned scripts → checksum      │
 └────────────────────────────────────────────────────────────┘
```

Trust boundaries crossed: participant device → research origin (authorisation + consent + schema); research origin → Treedis (allowlist only); raw store → analysis (read-only, audited). The public SLiVR origin never talks to the research service.

**Event/manifest outline.** Session manifest: `{protocol_id, consent_version, study_launch_id, probe_version, schema_version, artifact_version, experience_id, entry_id, capture_version, xr_reference_space, sample_config, device_context, browser_context, clock_anchor}`. Event families: session, viewer (head pose), controller, input, hand (opt-in), Treedis safe-listed lifecycle, SLiVR study markers, quality diagnostics. Every row carries `event_sequence` on one session-relative monotonic timeline. Head orientation is labelled **head direction**, never eye gaze or attention.

**Authorisation/consent state machine.**
`off` → (valid signed launch) → `launch-verified` → (disclosure shown) → `consent-pending` → `consented` → `record-only` → (separate approval + assignment) → `condition` ; any of expired launch, declined consent, withdrawal, collector failure, overhead breach or capability mismatch → `off` (direct Treedis, no recording, tour still usable). `inventory` is a researcher-only branch off `consented` that records but changes nothing.

**Record-only vs manipulation acceptance matrix.**

| Property | `record-only` (6A) | `inventory` | `condition` (6B) |
|---|---|---|---|
| Manipulation hooks installed | No (test 166) | No (test 167) | Yes, named targets only (169) |
| Stimulus changed | Never | Never | Only declared targets |
| Extra approval | Study + security | + researcher capability | + manipulation approval + disclosure |
| Logged | Passive families | + bounded handle metadata | + assignment, trigger, result, rollback |
| Rollback | n/a | n/a | Two-level, tested (171) |
| Fail-safe | Tour usable (159) | Tour usable | Missing target/controller failure is fail-safe (170) |

**Work packages** follow the ten in the plan document: authorisation feasibility → threat model/data contract → proxy proof → probe proof → collector proof → SLiVR integration → Quest/live pilot → analysis reproducibility → optional manipulation gate → study-readiness review.

**Test IDs.** Part I **141–171**, plus the affected Part J regression. Phase 6 does not gate Phases 0–5.

---

## 7. Integrated acceptance trace

The single path proved end to end in Phase 5 (test 113) and swept in Part J:

1. `#/explore` opens the Lafayette envelope on 2025 DOTD imagery with attribution; all 17 markers present; capture and future states visually distinct.
2. Filter to Downtown Core + current capture; select **LOC-001 Carpe Diem** from the list; the map highlights the same record; the dossier opens with `#/location/LOC-001`.
3. The dossier shows the shared-experience relationship without merging LOC-001 into `5eb11a1b`; ownership reads `Need validation`; hours are labelled public hours, not availability.
4. *Add as candidate* → new project "Downtown Pilot", scene SC-12 INT/EXT NIGHT; record the unknown access issue as an open question.
5. *Enter Immersive* → `#/immersive/LOC-001` loads sweep `sebf1e31m9u7dk7twchgfz1mc` at x 4.479 / y 76.060; breadcrumb shows the catalog location, not the experience.
6. Move to **LOC-005 Rock'n'Bowl** inside the same experience — location identity, address and notes change; where the provider supports it, without a full reload.
7. Save a bookmark with a note; switch to **LOC-009 Magnolia Pantry** (`a872109b`) — pending navigation is cancelled, the prior session disposed, and no late event from `5eb11a1b` can alter the new state.
8. Return to LOC-001 with no stale sweep; back to Explore with centre, zoom, filters and selection intact.
9. Add **LOC-004 Spoonbill** and **LOC-006 Borden's** as candidates; compare all three side by side; unknowns stay unknown and score nothing.
10. Mark LOC-001 **preferred** and LOC-006 **backup** with rationale and remaining questions.
11. *Create shot design* from the preferred candidate → `#/shot/{id}` with a DOTD aerial background for the scene bbox.
12. Place magenta **Cam A** and blue **Cam B**, actor stand-ins, numbered marks, direction arrows and the two shot descriptions; set gate 36.0 × 24.0 mm and 50 mm → H 39.598° / V 26.991° shown in the cone and frustum.
13. Draw distinct camera and actor paths; run the deterministic preview; switch 2D↔3D and Explore↔Immersive↔Shot Designer without losing the design.
14. Save, reload, undo an edit, create variant **B**, restore variant **A**.
15. Export **project JSON**, **PNG diagram** (title block: project, scene, location, shot, camera/lens, aspect, date, revision, units, calibration status, north arrow, DOTD attribution), **shot-list CSV**, and the **print-ready packet** with candidate decision, validation gaps, dossier summary, bookmark links, diagram, shot list and the outstanding access/logistics questions from the catalog.
16. Import the JSON into a clean browser profile and confirm identical IDs and relationships.

---

## 8. Verification strategy

`docs/FULL-SYSTEM-TESTING.md` is the controlling living checklist. It is updated **in the same work package** as the code, before completion is claimed. No result is pre-marked; only the executor records PASS; FAIL, BLOCKED and NOT TESTED are preserved; existing IDs are never renumbered — new coverage gets new IDs appended.

**Automated layer** (`node --test`, zero dependencies, following LSU3D's "green means the logic holds, never that it works" framing at `run-tests.mjs:11-15`):
- *Domain & spatial:* optics fixtures, ENU transforms, zero/negative/wrap rotations, unit conversion, plan-scale calibration.
- *Schema & transfer:* validation rejection cases, JSON round trips, ID conflicts, migration behaviour, catalog integrity and unknown-string preservation.
- *Persistence:* a fake-IndexedDB double exercising quota/write/transaction failure and autosave revision ordering.
- *Adapters:* the Treedis message harness (origin, source, type, payload, generation, zero-preservation, disposal); an imagery-source builder test asserting the exact `exportImage` parameters.
- *Exports:* CSV quoting/encoding/formula-neutralisation, filename sanitisation, JSON completeness, packet escaping.
- *Structural text-diffs* (the right compensating control in a no-build project): precache list ↔ `index.html`; a forbidden-string scan for credential patterns and LSU identifiers; a deploy-scope assertion that no tracked `SLiVR/` path is private.

**Live layer** (recorded separately, with build, browser/device, catalog/schema/provider versions): everything involving real rendering, real providers, real input and real failure injection — routing and direct-open, map/list synchronisation, all Treedis entries, WebGL loss, provider blocking, clustering, accessibility, tablet, print/PDF, console/network cleanliness, service-worker install/update/uninstall and neighbour isolation.

**Explicitly cross-cut every phase:** ID/reference and schema round-trip preservation; coordinate/axis/scale/FOV correctness; selection consistency across map, list and shot list; model-switch races and disposal; deterministic movement and undo/redo; save-failure recovery; local-only status and explicit export selection; slow network, WebGL loss and provider failure; export legibility and provenance; and SLiVR cache/storage isolation on the shared `sroberto27.github.io` origin.

---

## 9. Research traceability and evaluation readiness

Each phase closes by updating all five records plus the test document.

| Feature | Research rationale (hypothesis, not finding) | Candidate construct | Observable measure | Phase |
|---|---|---|---|---|
| F01 Atlas | Geographic overview may reduce discovery effort | Discovery efficiency | `task_time_s`, filter actions, locations inspected, `recovery_success` after map failure | 1 |
| F02 Dossiers | Structured evidence + visible unknowns may improve assessment completeness and confidence calibration | Evidence use, calibration | `assessment_completeness`, `unknowns_identified`, `unsupported_assumption_count`, `confidence_calibration` | 1 |
| F03 Immersive | Photographic immersion may improve remote spatial understanding | Spatial understanding | `orientation_error_deg`, `spatial_recall_score`, viewpoints visited | 2 |
| F04 Bookmarks | Externalised spatial evidence may improve recall and communication | Externalisation | Bookmark create/restore success, revisit time, failed restores | 2 |
| F05/F06 Workspace | Explicit criteria and side-by-side evidence may reduce omission and premature commitment | Decision traceability | `decision_rationale_quality`, candidates compared, unknowns preserved | 3 |
| F08–F12 Shot Designer | Linking location evidence to editable blocking may improve feasibility reasoning | Feasibility reasoning | `shot_plan_completeness`, `fov_error_deg`, `plan_scale_error_pct`, transform errors | 4 |
| F19 Capture metadata | Capture provenance is necessary to interpret immersive evidence | Provenance | Missing-metadata count, stale-capture flags, broken-entry rate | 1 |
| F20 Reliability | Recoverability and inclusive operation affect observed usability of everything else | Robustness | `recovery_success`, `mode_context_loss`, `json_roundtrip_loss`, keyboard task completion | 0–5 |

**Per-phase record updates.** Feature register: status, modules, interface state, evidence level, limitations. Decision record: append-only; new IDs for planning decisions — **D016 hash routing** (alternatives: History+404.html, query params as in LSU3D; rationale: direct-open and shareable links must work on a static host at a sub-path), **D017 private references gitignored** (alternative: commit and publish, or a separate origin; consequence: `docs/`/`outputs/` live outside version control and need their own backup), **D018 Canvas2D plan view independent of MapLibre** (alternative: MapLibre with a custom overlay; rationale: provider-independent editing and deterministic PNG export). Change log: build/version, affected feature IDs, schema/measurement changes, evidence links, **including negative and failed results** such as any Treedis entry that will not embed. Measurement dictionary: updated before any measure changes. Limitations register: L004 (provider latency mistaken for usability), L009 (approximate spatial data), L013 (providers change independently) get concrete Phase 0/2/4 evidence; new entries added as discovered.

**Evidence levels stay separate.** Phases 0–5 produce **design rationale** and **technical validation** only. No human-participant evidence exists and none may be described. Reproducibility metadata recorded with every technical result: app build, catalog version, capture version, provider capability version, device/browser, and the exact fallback state in effect.

**Privacy boundary.** No analytics, no event logging, no telemetry in Phases 0–5 (test 139). LSU3D's analytics ring-buffer is deliberately *not* ported. Any future study mode is explicit, visible, opt-in, locally reviewable/exportable, pseudonymous, and gated behind a separately reviewed protocol with the applicable institutional/ethics determination, consent, retention/access rules and data minimisation.

---

## 10. Risks and decisions

**A. Confirmed constraints (settled by the guide or this planning session — not reopened).**
Static/no-build ES modules; MapLibre; DOTD 2025 primary with 2024 Lafayette fallback and layer 187 excluded; optional Google 3D from external runtime configuration; isolated Treedis adapter; Three.js for authored scenes; IndexedDB + versioned JSON; read-only versioned catalog; desktop-first with tablet support; 17 records / six areas; no backend or accounts; Phase 6 after the prototype; hash routing (D016); private references gitignored (D017).

**B. Phase 0 validation tasks (each has a fallback; none is assumed).**
- **B1 — Treedis iframe embedding.** Framing itself is now evidenced: on 2026-09-20 the viewer document loaded and started inside the frame. What failed was the provider's own tour-data requests from inside that frame (L033), so the risk has moved rather than closed, and LSU3D's bridge has still never run against a live model. *Fallback:* URL-parameter entry with a full load. *Escalation:* if no entry embeds at all, the Phase 2 exit gate is BLOCKED with a documented retest condition — the one genuine gate risk in the plan. Because the user administers these experiences, an embed/allowlist setting or a supported SDK path may resolve it directly.
- **B2 — Treedis message protocol.** The `Ping`/`Navigate`/`TourReady`/`PoseChanged`/`SweepsChanged` vocabulary comes from documentation, not observed behaviour. *Fallback:* the adapter's configurable message map plus URL reload.
- **B3 — Capture dates, coverage and reuse rights.** Currently `Information has not been found` for all 11. Obtainable now that the user administers the experiences; results become a catalog v1.1 update with recorded provenance, not a silent edit.
- **B4 — DOTD content coverage and CORS.** Pixel-content validation per area; canvas read-back may be blocked, in which case the Node probe carries the evidence.
- **B5 — Google 3D key scoping.** A **new** key referrer-restricted to the SLiVR path, in gitignored `config/runtime.js`. Never the LSU3D key (committed in plaintext at `config.js:173` and referrer-locked to the LSU3D path).
- **B6 — Shared-origin isolation.** `sroberto27.github.io` also serves LSU3D, NewIberia and DTS. Storage is per-origin, so every SLiVR key, database and cache is `slivr`-prefixed, the worker is scoped to `/SLiVR/`, and `getRegistrations()` results are filtered by `reg.scope` before any `unregister()`.
- **B7 — Ownership and authority validation.** 13 of 17 records need ownership/authority validation. These stay visible unknowns; they are not prototype blockers.

**C. Implementation choices resolved within the approved architecture (no user input needed).**
Canvas2D plan view rather than MapLibre in the editor (D018); patch-exact CDN pins; `node --test` with direct ES-module imports instead of LSU3D's `vm` harness, keeping the text-diff structural tests; command-pattern undo/redo; per-aggregate debounced autosave with revision ordering; `tools/build-catalog.mjs` parsing the xlsx with built-ins; CSV formula-injection neutralisation; the eleven-store IndexedDB layout; and *not* porting the analytics service.

**D. Genuine blockers requiring user input — none remain.** The three open questions (private-reference handling, route form, provider access) were answered during planning. B1 is the only item that could become a blocker, and only after Phase 0 evidence shows it is one.

---

## 11. Implementation start point

**First work package after approval: `Phase 0.1 — Catalog, schemas and spatial core`.** It is the deepest dependency in the graph, needs no provider access, and produces the numeric evidence several exit gates depend on.

Files created (all under `SLiVR/`):
- `.gitignore` — `docs/`, `outputs/`, `config/runtime.js`
- `src/spatial/units.js`, `geo.js`, `frames.js`, `optics.js`
- `src/domain/ids.js`, `schema.js`, `location.js`, `capture.js`
- `tools/build-catalog.mjs`, `tools/validate-catalog.mjs`
- `data/catalog/{locations,captures,areas,sources,scout-details}.v1.json` + `manifest.json`
- `data/region/lafayette.region.json` (envelope, default view, imagery primary/fallback URLs + attribution, experience-ID allowlist, time zone)
- `tests/optics.test.mjs`, `frames.test.mjs`, `units.test.mjs`, `schema.test.mjs`, `catalog.test.mjs`

**Completion checklist for Phase 0.1:**
- [ ] `node --test tests/` passes with zero failures and the count recorded.
- [ ] FOV fixtures match hand-computed references within a documented tolerance (36.0 × 24.0 mm @ 50 mm ⇒ H 39.598° / V 26.991°; Super-35 24.89 mm @ 35 mm ⇒ H 39.152°), including a crop case and rejection of zero/negative gate values.
- [ ] ENU round-trip returns the origin within tolerance; zero rotation is exactly identity; a known 100 m offset reproduces to the documented precision.
- [ ] `node tools/validate-catalog.mjs` reports 0 errors, prints its warning list, and exits 0.
- [ ] The catalog contains exactly 17 locations (11 current / 6 future), 17 captures, 6 areas, and every `sourceId`/`areaId`/`locationId` reference resolves.
- [ ] Every `Need validation` and `Information has not been found` cell appears verbatim in the JSON; a test asserts none was coerced.
- [ ] The six `5eb11a1b` records are six separate locations with distinct addresses and sweep IDs; the six future candidates have `experienceId: null` and no synthesised URL.
- [ ] Coordinates fall inside the configured envelope; the swapped-axis heuristic finds nothing.
- [ ] `git status --porcelain SLiVR` shows only intended new paths; `git status` under `Wrapper/map/LSU3D` is unchanged from the pre-work baseline.
- [ ] No committed file matches the credential or LSU-identifier scans.
- [ ] `docs/FULL-SYSTEM-TESTING.md` updated: tests 11–13 and 27 annotated with the automated evidence actually produced, and **nothing marked PASS that was not executed**.
- [ ] `research/RESEARCH_CHANGELOG.md` and `DECISION_RECORD.md` updated with the build identifier and decisions D016–D018.

No commit is made unless explicitly requested; if requested, the staged path list is inspected and every path must begin with `SLiVR/`, the commit subject is short and professional, and no AI attribution or `Co-authored-by` trailer is added.

### Current catalog and map increment - 2026-09-20 (D064-D065)

Catalog 1.1.0 supersedes the initial 17-record inventory: 18 locations, 11 current
and 7 future, across 7 operational areas. The owner supplied 13 coordinate
corrections (including Moncus Park) and approved LaSEL / Antoun Hall as LOC-018.
The reviewed workbook and all generated JSON agree. Selection from list, pin,
search or catalog navigation now centers the map; Recenter fits the inventory.
Tests 201-203 and the 338-test automated run cover this increment; live checks
remain pending. The original Phase 0 scope/checklists above are historical.

### D070 UI follow-up - 2026-09-21

Owner-approved correction implemented: floating desktop panel over imagery, fully wrapping location names with metadata below, circular count badges and click-to-fit member bounds. Panel-aware camera padding and reduced-motion/cancellation/coincident-group behavior have automated coverage. 352 tests PASS; catalog/deployment checks clean except retained alias warning. Owner's prior functional passes include reported visual defects and do not certify this new build. Live test 218 remains BLOCKED; 15/16 from the owner checklist remain NOT TESTED pending clarification. Phase 1 stays open. See FULL-SYSTEM-TESTING.md for the exact build and Part C/J boundaries.


### D072 owner-requested location handoff - 2026-09-22

Fixed the top Explore button dropping Immersive location context: it now opens
and centers the currently selected location's pin/dossier through existing
selection actions, preserving discovery filters/scroll and viewer teardown.
The explicit return-to-selected-pin behavior takes priority over the general
Explore index. Exact prior-camera restoration and provider-walking location
mapping remain outside this correction. 355 automated PASS, live 221 BLOCKED
(no browser connected). D071 phase gates/E1 proposal remain unchanged; no
bookmark implementation, schema change, phase close, commit or push.


### D073 owner-requested Immersive mini-map - 2026-09-22

Added a compact selected-location map above the captured-location list, with
Show/Hide on all screen sizes and Open Explore. Desktop starts expanded; narrow
screens start collapsed below the tour. Uses existing MapLibre/imagery/pins with
failover/attribution and disposal on collapse/exit; no provider configuration or
Treedis lifecycle change. Stable 222 has automated coverage; 360 tests PASS.
Browser presentation is BLOCKED; Phase 1/E1 and dependent bookmark gates remain
unchanged. No commit or push.


### D074 bidirectional mode-context correction - 2026-09-22

Top Immersive now opens the location selected in Explore search/list or on the
map, complementing D072's reverse path. No-selection picker and future-location
no-capture behavior remain supported. Test 223 and final 362 automated PASS;
live BLOCKED. No provider/schema change, phase close, commit or push.

Owner clarifies that Projects and Shot Designer must also preserve context in
both directions with Explore/Immersive at Phase 3/4 delivery. Carry stable
project/scene/candidate/shot-scene and location/capture IDs, retain return state,
and ask for explicit target choice where ambiguous. Do not infer a private
workspace target from location alone or create records when changing tabs.
Extend tests 44, 77-79, 179, 208/213 at delivery; currently NOT TESTED. Keep D068
assessment editor/actions in Phase 3 and current acceptance gates unchanged.


### 2026-09-22 - D075

D075 implements interactive mini-map capture pins, zoom, Center, streets, configured 3D and temporary Enlarge/Restore. Show/Hide remains on every screen. Outside interaction returns normal size. Automated stable 224 PASS; desktop/touch/provider behavior requires live testing. Phase 1 and 2 remain OPEN; no prerequisite waiver or bookmark implementation.


### 2026-09-22 - D076

D076 mini-map presentation correction delivered: internal single-row SVG controls and transparent pin backgrounds. Stable 222/224 automated behavior retained. Live desktop/phone presentation retest remains required; phases and acceptance gates unchanged.
