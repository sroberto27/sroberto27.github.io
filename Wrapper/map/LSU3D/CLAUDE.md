# LSU3D — "Death Valley Experience" — working notes for Claude

MapLibre GL JS map + guided-tour web app for **LSU Football gameday recruiting
visits**. Static site: vanilla HTML/CSS/JS, **no build step, no framework, no
backend, no package.json**. Served as static files from the
`sroberto27.github.io` GitHub Pages repo.

App lives at `Wrapper/map/LSU3D/` inside the monorepo. The public URL is
`https://sroberto27.github.io/Wrapper/map/LSU3D/` (see
`docs/WEBSITE-STATE.md`). Pages builds from **`main` at the repo root** —
confirmed by 22 deploys through it, no longer an open question.

`../LSU/` is the older Leaflet build this was forked from. It is untouched and
still independently deployable — it is the rollback target, not dead code.

---

## Status

**Phases 1 and 2 are built, committed and live. Phase 3 (CMS on Cloudflare +
Supabase) is PAUSED by decision** while we wait for real information from LSU.
It is not blocked on code.

The app runs entirely on placeholder content - the sample gameday has invented
times, `opponent: "TBD"` and blank phone numbers, `assets/` is empty, and no
Treedis capture exists. **A CMS manages content that exists, and there is none
yet.** `docs/LSU-INFORMATION-REQUEST.md` is the questionnaire that unblocks it.

**Do not start CMS, Supabase or Cloudflare work until those answers arrive.**
When they do, run `/cms-build` (or
`docs/plans/CMS-IMPLEMENTATION-PROMPT.md`) - it opens with a gate listing
exactly what must be answered first.
When they do, copy `../dts/dts3/` - it is a complete working implementation of
this exact architecture (Cloudflare Pages + Functions + R2 + Supabase with RLS,
plus a `js/admin.js` mini-CMS that drafts to localStorage, previews live, and
exports the data folder). Settled already: **staff authenticate; recruits and
families must never need an account.** Per-recruit privacy means signed
expiring links, not recruit logins.

---

## Read first

- **`docs/WEBSITE-STATE.md`** — the cold-read reference. How the app works
  today: stack, every subsystem, the loading sequence, Treedis + Google 3D
  integration, VR/WebXR, mobile architecture, and an explicit list of what does
  **not** exist yet (router/deep-links, analytics, CMS, My Gameday, Live Visit,
  kiosk, service worker, Supabase). Start here.
- **`README.md`** — the migration story: why 3D has two renderers, why the old
  LiDAR pipeline was removed, Google Photorealistic 3D Tiles setup/cost/fallback,
  and the "what's still placeholder" list. Accurate and current.
- **`docs/plans/GAMEDAY-EVOLUTION-PROMPT.md`** — the multi-phase planning brief
  for turning this into a full gameday experience (My Gameday, Live Visit Mode,
  GPS, QR/NFC deep links, staff analytics, kiosk mode, CMS; then a "make it
  fast" pass; then a GitHub Pages → Cloudflare + Supabase migration). Run it in
  **Plan Mode**. The plan it produces goes in
  `docs/plans/GAMEDAY-EVOLUTION-PLAN.md`.
- **`docs/LSU-INFORMATION-REQUEST.md`** - what we need from LSU before the CMS
  can be built, and before a real recruit sees this. Written for athletics
  staff, not developers.
- **`docs/TEST-PLAN.md`** — the hand-run acceptance checklist for all three
  phases (Pass / Fail / Not tested per row). Filled in by the user; triaged via
  `docs/plans/FULL-TEST-PROMPT.md` or `/full-test`. **Never mark a row passed on
  the strength of reading code** — results come from a real run.
- `docs/DATA-SCHEMA.md` — the contract for every file under `data/`, including
  the `stop_key` slugs that printed QR codes depend on. `docs/CONTENT-EDITING.md`
  is the staff-facing version.
- `docs/LSU_Mobile_4G_Audit_Prompt.md` — an earlier, narrower perf-audit brief
  (bundle deferral, responsive layout, network awareness). Superseded in scope
  by Phase 2 of the evolution prompt but still a useful reference for the
  mobile/slow-4G concerns.

---

## Non-negotiable (do not break without a stated reason)

- **Script and CSS load order in `index.html`.** The 16 `js/NN-*.js` files load
  as plain `<script>` tags (not modules) and share one script scope — later
  files read globals (`map`, `config`, `el`, `tourStops`, `tourIndex`,
  `selectedFeature`, …) defined by earlier ones. `js/14-redesign.js` loads last
  and *wraps* several functions (`updateTourbar`, `renderDetails`,
  `openStreetView`) by reassignment. Reordering breaks all of this. CSS files
  are numbered and later files intentionally override earlier ones. (Note the
  gap: there is no `css/06-*` and no `js/15-*` — normal, not missing.)
- **`js/03-tour-bridge.js` message-type strings and the 2s ping cadence.**
  That is Treedis's postMessage contract, not ours: `Ping` / `Navigate` /
  `RequestSweeps` out, `TourReady` / `PoseChanged` / `SweepsChanged` / tag
  events in, plus the 600ms defer after `TourReady`.
- **One Treedis iframe, ever** (`#tour-frame`). `preloadTreedisIframe()` sets
  `src` exactly once and every later call is a no-op. A second iframe resets the
  session and the bridge handshake.
- **The `window.CAMPUS_CONFIG` shape and the flat lookup maps** the data
  adapter builds on it (`categoryMap`, `descriptionMap`, `imageMap`,
  `happensHereMap`, `addressMap`, `explorableMap`, `treedisMaps`). `js/01-utils.js`
  getters (`getCategory`, `getDescription`, …) read these by lowercased name
  key. Extend; don't reshape.
- **`js/00-data-adapter.js` is the only place that knows the data is JSON.**
  It is the deliberate seam a future CMS/Supabase provider slots into — keep it
  that way; don't scatter `fetch()` of content through the app.
- **The service worker's scope is `/Wrapper/map/LSU3D/` and must stay there.**
  `sw.js` lives in this app's folder on purpose. The same origin also serves
  `../LSU/`, `../NewIberia/`, `../dts/` and others as separate deployed apps —
  a worker registered at the origin root would intercept all of them. Never
  move `sw.js` up a directory. It ships with
  `config.gameday.enableServiceWorker: false`; `?sw=off` is the no-deploy
  rescue for a device stuck on a bad build.
- **`config.local.js` is gitignored and never deploys.** It is only a
  keep-the-key-out-of-git-history convenience. The Google Maps API key in
  `config.js` is *already public* (committed, served to every visitor) — its
  real protection is the HTTP-referrer restriction + billing cap in Google
  Cloud Console. Don't "fix" this by moving the key around; it doesn't help.

---

## Commit conventions

- **No `Co-Authored-By` trailer, and no "Claude" / "Anthropic" /
  "AI-generated" / "Generated with" attribution anywhere in a commit subject or
  body.** This overrides the harness's default git workflow for this repo.
- The commit author is the repo's configured git identity. Don't pass
  `--author`.
- **Before every `git commit`, show the proposed subject and body and wait for a
  go-ahead.** Every session, not just the one where this was first asked.
- Existing commits that already carry an AI trailer are left alone unless
  explicitly asked to rewrite history.

---

## Local dev

```bash
cd Wrapper/map/LSU3D
python -m http.server 8000
# open http://localhost:8000
```

Serving over http is **required** — all data loads via `fetch()` of
`data/*.geojson` and `data/*.json`. There is no `file://` fallback in this build
(the legacy `data/*.js` shim path referenced in some comments does not exist
here). Deploying is a `git push`; there is nothing to build.

---

## Conventions

- Vanilla JS, zero runtime dependencies of our own. Third-party libs load from
  CDN in `index.html`: `maplibre-gl@4` (always), and — only when 3D + Google
  tiles are both enabled — `three@0.183.0` + `3d-tiles-renderer@0.5.1` via the
  `<script type="importmap">` in `<head>`, loaded through dynamic `import()` in
  `js/16-google-tiles.js`.
- New scripts are plain IIFEs or flat top-level code in the shared scope,
  matching the existing `js/NN-*.js` numbering. If you add one, add its
  `<script>` tag in `index.html` in the right numeric position.
- Content an editor might reasonably want to change (stop titles, descriptions,
  order, times, images, contacts, Treedis IDs) belongs in `data/*.json`, read
  through `js/00-data-adapter.js` — not hard-coded in JS.
- `config.js` holds *structural* wiring (map layers, CRS, data-file paths,
  Treedis plumbing, layer styles, camera presets). Per-location *content* lives
  in `data/locations.json` / `data/treedis-sweeps.json`.
- MapLibre uses `[lng, lat]`. The old Leaflet build used `[lat, lng]`. Every
  coordinate under `config.map3d` is `[lng, lat]`; double-check when hand-editing.

---

## Testing checklist (run after any change)

- Splash → app reveal; start-screen modal appears on first load
- 2D map loads with DOTD aerial imagery; campus framed correctly
- Click a tour stop on the map → details panel opens, camera flies
- Left rail locations list → click a row → same selection path
- Tour bar arrows + `←`/`→` keys step through all 10 stops
- Guided-tour pill / rail tour card progress stays in sync
- Co-located stops (3–5 at Ops Facility, 8–9 at the stadium) show as a cluster
  pin that expands
- 2D/3D toggle: terrain loads lazily, buildings extrude; if a Google key is
  configured, Google tiles take over and the "3D: Google / Simple" badge is
  correct; kill the key → falls back cleanly
- "Explore" CTA only shows on stops with a Treedis sweep (currently none →
  expect it hidden everywhere; the info-only panel is correct)
- Reference-overlay (OSM labels) toggle, imagery on/off toggle
- Learn tab switches to the "coming soon" placeholder and back
- Burger menu: "How to use" reopens the coachmark; the two settings toggles
  persist across reload (localStorage)
- Mobile width (~375px) and tablet (~768/1024px): rail becomes a bottom sheet,
  details becomes a drag sheet, tour stepper appears inside details
- Browser back/forward steps through visited stops, and `?stop=` deep links
  open a specific stop (`js/17-router.js`)
- Console clean on load and on every panel open

There is no automated test suite. Verify by reading the code and tracing the
real call path first; use live browser testing sparingly and say explicitly
which claims are "confirmed by reading code" vs "confirmed in a browser."

`node scripts/validate-data.mjs` must be clean after any change under `data/`,
and `node scripts/run-tests.mjs` must be green after any change under `js/`.

**Adding a file under `js/` or `css/` means adding it to `sw.js`'s precache
list too.** `scripts/tests/service-worker.test.mjs` fails if they drift — this
project has no build step, so that list is typed by hand, and a forgotten
entry breaks silently for cached visitors only.

### What the Node tests can and cannot tell you

`scripts/tests/*.test.mjs` load the real `js/*.js` files into a Node vm
against a stubbed DOM and a stubbed map. They prove **logic**: a slug
resolves, a wrapper still calls through to the original, a bad route is
rejected, handlers fire in the right order.

They are blind to everything visual — contrast, stacking order, whether one
panel is covering another, mobile layout. Every one of those has already
shipped as a real bug in this app while the tests were green. **Green means
"the logic holds", never "it works"**, and any claim about appearance or
layout needs `docs/TEST-PLAN.md` run in a real browser.

When fixing a bug, add a test that **fails against the previous commit** and
verify that it does. A test that passes before and after proves nothing.

### Keeping the test plan current

**Any new user-facing feature adds rows to `docs/TEST-PLAN.md` in the same
commit.** A new URL parameter, mode, panel, control, or data field means new
rows, written with the exact URL or steps needed to reach it. A feature that
ships without test rows is not finished.

The same applies to changes that alter how an *existing* feature behaves —
caching, offline behaviour, or a data-saver mode changes what the existing rows
should expect, so revise them rather than only appending new ones.

Nothing updates that file automatically. This rule is the only thing keeping it
honest, and a stale test plan is worse than none because it reads as coverage
that isn't there.

---

## Working style for the gameday evolution

- The evolution prompt is **Plan Mode first** — inspect, don't implement, until
  the plan is approved. It explicitly forbids code changes, commits, installs,
  Supabase resources, and DNS changes on the planning pass.
- The current GitHub Pages build is the behavioral baseline. Don't redesign
  working systems (map, tour state, Treedis bridge, 2D/3D toggle) without a
  clear reason.
- New features (My Gameday, Live Visit, GPS, deep links, kiosk, analytics)
  should reuse the existing tour-state model (`tourStops` / `tourIndex` /
  `goToStop()` / `selectFeature()`), not add a parallel navigation system.
- Keep the `data provider → local JSON today → Supabase later` seam
  (`js/00-data-adapter.js`) intact. Don't make the frontend depend on Supabase
  before Phase 1 and Phase 2 are done.
- Centralize deployment-specific URLs and flags in `config.js` — don't embed
  them through app logic.
