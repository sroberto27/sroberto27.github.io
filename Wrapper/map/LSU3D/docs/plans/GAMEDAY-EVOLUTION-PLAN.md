# LSU3D Gameday Evolution — Phase 1 Plan ("Make It Useful")

## Context

`Wrapper/map/LSU3D/` is today a working, public, zero-build static site: a
MapLibre map + a 10-stop guided tour of the LSU gameday recruiting journey. It
is a *preview* experience. It is not yet useful **during** a real visit, and it
tells staff nothing about how it is used.

Phase 1 closes that gap with seven features (My Gameday, Live Visit Mode, GPS,
QR/NFC deep links, staff analytics, kiosk mode, a content-management layer).
The constraint that shapes everything below: all of it must keep working on
GitHub Pages with no build step and no backend, while being structured so the
later migration to a hosted backend is a provider swap rather than a rewrite.

**Scope of this plan: Phase 1 only.** Phase 2 ("Make It Fast") and the
Cloudflare/Supabase migration are **entirely out of scope** and get their own
plans later. No migration work happens in Phase 1 — no schema, no resource, no
dependency, no code path, no decision about the destination. What §G contains
instead is a short list of **design rules** we follow while building, so a
later migration is a provider swap rather than a rewrite. Those rules are good
practice on their own merits, cost nothing now, and commit us to nothing.

**Decisions already made** (from the pre-plan questions):

| Decision | Choice |
|---|---|
| Personalization source | Staff-authored `data/gamedays/<id>.json`, selected by `?g=<id>`; optional `&n=<first name>` |
| Analytics in Phase 1 | First-party event bus with a no-op/console sink. No third-party JS, no cookies, no consent banner |
| Deep-link shape | Query params (`?stop=…&mode=…&g=…`) |
| Sequencing | Shared foundations first, then features |

---

## A. Current-State Audit

`docs/WEBSITE-STATE.md` is an accurate, current cold-read audit — this section
does not repeat it. What follows is only the subset Phase 1 actually touches,
with the exact seams.

### The seams Phase 1 attaches to

| Seam | File / symbol | Why it matters |
|---|---|---|
| **The single selection funnel** | `js/06-details-panel.js:381` `selectFeature(sel, kind, {focus})` | Every selection path (map click, rail row, search, tour arrow, PEEK card, cluster pin) goes through it. It sets `tourIndex` from `tourStops.findIndex(...)`, renders details, flies the camera, calls `updateTourbar()` + `highlightActivePin()`. **This is where the router, analytics, and My Gameday all hook in — nothing new needs its own navigation.** |
| **Tour state** | `js/02-state.js` → `tourStops[]`, `tourIndex`, `selectedFeature` | `tourStops[i] = { feature, featureId, order, pinNode }`, sorted by `order_num`, built in `buildTourPins()` (`js/07-layer-builders.js`). |
| **Tour navigation** | `js/08-tourbar.js` → `goToStop(i)`, `tourPrevAction()`, `tourNextAction()`, `updateTourbar()` | `goToStop()` is a thin wrapper over `selectFeature()`. Kiosk auto-advance and Live Visit "next stop" both drive `goToStop()`. |
| **Render fan-out** | `updateTourbar()` | Already the one function that re-renders every tour surface (pill dots, rail card, mobile stepper, route line, mini-map). New surfaces (My Gameday progress, Live Visit header) hook here. |
| **The data seam** | `js/00-data-adapter.js` → `loadDataJSON()`, `tryFetchJSON()`, `config.dataFiles` | The only place that knows content is JSON. Gameday itineraries load through here, not through a scattered `fetch()`. |
| **The wrap pattern** | `js/14-redesign.js:357` reassigns `renderDetails`; also wraps `updateTourbar`, `openStreetView` | Any new module that hooks those must load **after** `14-redesign.js` and wrap-not-replace. |
| **Existing geolocation** | `js/14-redesign.js:270–294` `#locateBtn` | One-shot `getCurrentPosition()` → `flyTo`. No marker, no accuracy, no denial UX. Phase 1 replaces the handler body, keeps the button. |
| **Existing fullscreen** | `#fullscreenBtn`, `js/10-event-wiring.js` | Kiosk mode reuses it rather than adding a second fullscreen path. |
| **Existing play button** | `#tourPlayBtn`, `js/14-redesign.js:84` | Already in the DOM; kiosk autoplay reuses it. |
| **Settings persistence** | `js/12-start-screen.js:78–90` — localStorage get/set wrapped in try/catch | Copy this exact defensive pattern; do not add a second storage helper. |

### Load-order facts that constrain the design

- 16 classic `<script>` tags, one shared scope, `index.html:970–988`. Order:
  `config.js` → `00`…`14` → `16`. **There is no `js/15-*.js` — the slot is free
  and it lands exactly where a wrapper module needs to be (after `14`).**
- `js/11-boot.js` calls `boot()` **at parse time**, before scripts 12–16 have
  executed. `boot()` is `async`, so later scripts run during its `await`s. This
  is why `11-boot.js` guards with `typeof showStartScreen === "function"`.
  **Every new module must follow the same guard discipline, and boot must not
  assume a new module exists.**
- CSS: 11 files, later overrides earlier. `css/06-*` is a free gap; new UI CSS
  goes at the **end** (`13`, `14`, `15`) so it wins, not in the gap.

### Debt Phase 1 must work around (not fix wholesale)

- **`locations.json` joins geometry by lowercased `name`.** Renaming a stop
  silently breaks its content. Phase 1 adds an explicit `stop_key` to
  `data/tours.geojson` and prefers it, falling back to the name key — additive,
  no break.
- **`description` is `null` on all 10 GeoJSON features**; real copy lives in
  `locations.json`. Correct — leave it.
- **`assets/` and `scripts/` are empty**; `assets/Icons/logo.png` 404s and
  degrades gracefully. Not a Phase 1 blocker.
- **No git tag exists.** `git tag` returns nothing. A baseline tag is step zero.
- **Uncommitted working tree** — `CLAUDE.md`, `docs/WEBSITE-STATE.md`,
  `docs/plans/`, `.claude/` are all untracked, plus large unrelated changes in
  sibling apps (`NewIberia`, `dts/dts3`, `CheckList`). Phase 1 commits must be
  path-scoped to `Wrapper/map/LSU3D/`.

---

## B. Dependency Map

```
                    ┌──────────────────────────────────────┐
                    │  EXISTING TOUR STATE (do not clone)  │
                    │  tourStops / tourIndex /             │
                    │  selectFeature() / goToStop()        │
                    └───────────────┬──────────────────────┘
                                    │
        ┌───────────────┬───────────┼───────────┬────────────────┐
        │               │           │           │                │
   ┌────▼────┐   ┌──────▼─────┐  ┌──▼────┐  ┌───▼─────┐   ┌──────▼──────┐
   │ Router  │   │ Analytics  │  │ Geo   │  │ Content │   │   Kiosk     │
   │ (?stop) │   │  bus       │  │ svc   │  │ provider│   │ controller  │
   └────┬────┘   └──────┬─────┘  └──┬────┘  └───┬─────┘   └─────────────┘
        │               │           │           │
        │               │           │      ┌────▼──────────┐
        │               │           │      │  My Gameday   │
        │               │           │      │  state store  │
        │               │           │      └────┬──────────┘
        │               │           │           │
        └───────────────┴───────────┴───────────┤
                                                │
                                       ┌────────▼─────────┐
                                       │  Live Visit Mode │
                                       │  (mobile-first)  │
                                       └──────────────────┘
```

**Build order forced by this graph:**

1. **Router** — Live Visit, kiosk, My Gameday and QR entry are all *modes
   entered by URL*. Everything downstream needs it.
2. **Analytics bus** — must exist before features so they emit from day one; no
   feature depends on it functionally (fire-and-forget).
3. **Content provider extension** — My Gameday needs itinerary data.
4. **My Gameday state store** — the single source of "which stop are we on,
   what time, who do I call". Live Visit is a *view* of this, not a second model.
5. **Geolocation service** — needed by Live Visit; independently useful.
6. **Live Visit Mode** — composes 1+3+4+5.
7. **Kiosk** — only needs 1 + tour state; can land any time after 1.
8. **Content/CMS normalization** — independent; do it last so it normalizes the
   *final* Phase 1 shape rather than being redone.

---

## C. Recommended Architecture

Same conventions as the existing code: plain classic scripts, IIFE-wrapped,
numbered `js/NN-*.js`, `<script>` tag added in numeric position, no modules, no
build step, no dependencies.

### New files

| File | Role | Loads |
|---|---|---|
| `js/15-core-services.js` | **Analytics bus + storage + geo math + `onAppReady` hook.** No DOM, no wrapping. `track(event, props)`, `setAnalyticsSink(fn)`, `store.get/set` (localStorage, try/catch), `haversineFt()`, `bearingDeg()`, `walkMinutes()`. | after `14` |
| `js/17-router.js` | Query-param router. `parseRoute()`, `applyRoute()`, `updateURL(patch)` (`history.replaceState`), `popstate` handling, invalid-param fallback. Wraps `selectFeature` to keep `?stop=` in sync. | after `16` |
| `js/18-gameday.js` | Gameday state store + My Gameday panel. `Gameday.load(id)`, `Gameday.state`, `Gameday.currentStopIndex()`, `Gameday.nextStop()`, `Gameday.progress()`. Wraps `updateTourbar` to re-render. | after `17` |
| `js/19-geolocation.js` | `Geo.request()`, `Geo.startWatch()`, `Geo.stopWatch()`, marker + accuracy ring, `Geo.distanceToStop(i)`. Replaces the `#locateBtn` handler body. | after `18` |
| `js/20-live-visit.js` | Live Visit Mode UI. Enters via `?mode=live` or a button. Composes Gameday + Geo + tour state. | after `19` |
| `js/21-kiosk.js` | Kiosk controller. `?mode=kiosk`. Auto-advance timer, idle reset, chrome hiding, exit gesture. | after `20` |
| `css/13-gameday.css`, `css/14-live-visit.css`, `css/15-kiosk.css` | New UI. Loaded last so they win the cascade. | end of `<head>` |
| `data/gamedays/index.json`, `data/gamedays/<id>.json` | Staff-authored itineraries. | fetched |
| `docs/DATA-SCHEMA.md` | The contract for every `data/*.json` file. | — |
| `scripts/validate-data.mjs` | Node script, run by hand, validates `data/` against the schema. Not a build step. | — |

### Edits to existing files

- `index.html` — 6 `<script>` tags, 3 `<link>` tags, and the new panel markup
  (My Gameday panel, Live Visit header, kiosk overlay). Additive only.
- `js/00-data-adapter.js` — add `loadGamedayJSON(id)` + `applyGamedayJSON()`.
  **This stays the only place that knows content is JSON.**
- `js/11-boot.js` — **one line** at the end of the reveal `requestAnimationFrame`:
  `if (typeof onAppReady === "function") onAppReady();` — same guard idiom
  already used for `showStartScreen()`. This is the hook the router waits on.
- `js/14-redesign.js` — the `#locateBtn` handler delegates to `Geo`; the
  `#shareBtn` handler shares the *deep link* instead of bare `location.href`.
- `config.js` — one new `gameday: { … }` block (feature flags, file paths,
  timings, kiosk defaults). No deployment URLs anywhere else.
- `data/tours.geojson` — add `stop_key` to each of the 10 features. Additive.

### Explicitly NOT doing

- No framework. No bundler. No second map instance. No second tour state. No
  service worker (Phase 2). No auth, no backend, no hosting change. No staff dashboard UI in
  Phase 1 — the bus and the event schema only.

---

## D. Data Models

### Gameday itinerary — static today

`data/gamedays/index.json` (what exists, for validation + a future picker):

```json
{ "$schema": "lsu-gamedays-v1",
  "gamedays": [
    { "id": "2026-09-05-alabama", "label": "vs Alabama · Sep 5, 2026", "active": true }
  ] }
```

`data/gamedays/2026-09-05-alabama.json`:

```json
{
  "$schema": "lsu-gameday-v1",
  "id": "2026-09-05-alabama",
  "opponent": "Alabama",
  "kickoff": "2026-09-05T18:30:00-05:00",
  "timezone": "America/Chicago",
  "notes": "Wear closed-toe shoes for field level.",
  "contacts": [
    { "role": "Recruiting Operations", "name": "", "phone": "", "note": "Text for anything during the visit" }
  ],
  "stops": [
    { "stopKey": "lot-414-river-road-arrival", "arrive": "13:30", "depart": "13:45",
      "instruction": "Park in Lot 414 and look for the gold LSU flags.", "durationMin": 15 }
  ]
}
```

- `stopKey` matches the new `stop_key` on `data/tours.geojson` — a stable slug,
  not a display name.
- Times are wall-clock local strings; `timezone` is explicit so a phone in
  another zone doesn't drift.
- **Contacts hold role + department line only** — see §Security.

### Visit progress — localStorage, per gameday

```json
{ "gamedayId": "2026-09-05-alabama",
  "visited": ["lot-414-river-road-arrival", "board-the-charter-bus"],
  "startedAt": "2026-09-05T13:28:11-05:00",
  "lastStopKey": "board-the-charter-bus" }
```

Key: `lsu3d.gameday.progress.<gamedayId>`. Same try/catch storage discipline as
`js/12-start-screen.js`.

### Deep link

| Param | Values | Behavior |
|---|---|---|
| `stop` | stop slug | Selects that stop via `selectFeature()`, opens details, flies camera |
| `g` | gameday id | Loads that itinerary; enables My Gameday |
| `n` | first name, ≤24 chars, letters/space/hyphen | Greeting only. Never stored, never sent to analytics |
| `mode` | `live` \| `kiosk` | Enters that mode |
| `autoplay` | `1` | Kiosk only |
| `src` | `qr` \| `nfc` \| `email` \| `sms` | Attribution only; recorded as an analytics dimension |

Invalid/unknown values are dropped, logged at `console.info`, stripped from the
URL via `replaceState`, and the app boots normally. An unknown `stop` shows a
dismissible "That stop isn't on this tour" toast. Unknown params never throw.

### Analytics event

```json
{ "event": "stop_opened", "ts": 1788000000000, "sessionId": "s_9f3a…",
  "props": { "stopKey": "lawton-room", "source": "map_click", "mode": "live",
             "gamedayId": "2026-09-05-alabama", "device": "mobile", "is3D": false } }
```

`sessionId` is a random id in **sessionStorage** — new per tab session, not a
cross-visit identifier. No name, no coordinates, no IP handling by us.

**Phase 1 event vocabulary** (fixed now so history is comparable later):
`app_ready`, `deep_link_opened`, `tour_started`, `stop_opened`,
`tour_completed`, `mode_entered`, `mode_exited`, `gameday_loaded`,
`geo_permission`, `geo_fix`, `explore_launched`, `google3d_entered`,
`google3d_fallback`, `share_clicked`, `contact_clicked`, `kiosk_cycle`,
`error`.

### On the "future backend" shape

Nothing here is designed *for* a specific backend, and no backend schema is
proposed in Phase 1. The only rule applied above is a generic one: **each JSON
file holds one flat, uniform collection of records** (gamedays, stops,
contacts, events) rather than a nested blob. That is the right shape for
hand-editing and validating today, and it happens to be the right shape to
import into any relational or document store later. That is the whole extent of
the forward-thinking — see §G.

---

## E. Implementation Phases

Each batch is a branch off `main`, small enough to review and revert alone.

### Batch 0 — Baseline & safety net
- **Objective:** a known-good rollback point before anything changes.
- **Creates:** git tag `baseline/lsu3d-github-pages-2026-08-27`; `docs/DATA-SCHEMA.md`.
- **Changes:** none to app code.
- **Risk:** none. **Difficulty:** Low. **Behavior change:** none.

### Batch 1 — Core services + `onAppReady` hook
- **Objective:** analytics bus, storage helper, geo math, the boot hook.
- **Creates:** `js/15-core-services.js`.
- **Changes:** `index.html` (1 script tag), `js/11-boot.js` (**1 guarded line**).
- **Risk:** the `boot()`-runs-at-parse-time ordering. Mitigated by the `typeof`
  guard — identical to the existing `showStartScreen()` call.
- **Tests:** full existing checklist; console clean; `track()` callable from the
  console and logging under a debug flag.
- **Difficulty:** Low. **Behavior change:** none visible. **Rollback:** revert
  the file + 2 lines.

### Batch 2 — Router / deep links
- **Objective:** `?stop=`, `?src=`, back/forward, shareable + QR-able URLs.
- **Creates:** `js/17-router.js`.
- **Changes:** `index.html`; `js/14-redesign.js` (`#shareBtn` shares the deep link).
- **Depends on:** Batch 1.
- **Risk:** **Highest-risk batch.** It wraps `selectFeature`, which every path
  funnels through — a bad wrap breaks all navigation. Mitigate: wrap by
  reassignment exactly as `js/14-redesign.js` does, call the original first
  unconditionally, and put everything new in a try/catch so a router failure can
  never block a selection.
- **Tests:** all 10 stops deep-link; back/forward; unknown `?stop=`; no params
  (must behave exactly as today); share copies a stop URL.
- **Difficulty:** Medium. **Behavior change:** **yes — the URL now changes as you
  navigate.** This is the intended fix for a documented gap.

### Batch 3 — Content provider + `stop_key` normalization
- **Objective:** stable slugs; gameday itineraries loadable through the data seam.
- **Creates:** `data/gamedays/index.json`, one sample gameday, `scripts/validate-data.mjs`.
- **Changes:** `js/00-data-adapter.js` (`loadGamedayJSON`), `data/tours.geojson`
  (+`stop_key` ×10), `config.js` (`gameday` block), `docs/DATA-SCHEMA.md`.
- **Depends on:** Batch 2 (router supplies `?g=`).
- **Risk:** Low — `stop_key` is additive; all existing name-key lookups still work.
- **Difficulty:** Low. **Behavior change:** none without `?g=`.

### Batch 4 — My Gameday
- **Objective:** personalized itinerary view over the existing 10-stop tour.
- **Creates:** `js/18-gameday.js`, `css/13-gameday.css`.
- **Changes:** `index.html` (panel markup).
- **UX:** desktop = a card at the top of the existing rail, above `#railTour`
  (greeting, "Now / Next", countdown, progress, contacts). Mobile = a collapsed
  strip above the bottom sheet that expands to full-height. **It renders the
  same `tourStops` with itinerary times layered on — it is not a second list.**
- **Depends on:** 1, 2, 3.
- **Risk:** Medium — wraps `updateTourbar`. Same wrap discipline.
- **Tests:** with and without `?g=`; a stale/404 gameday id; a gameday whose
  `stopKey` doesn't match any stop (must skip, not crash); countdown across
  midnight and across timezones; progress persists across reload.
- **Difficulty:** Medium. **Behavior change:** only when `?g=` is present.

### Batch 5 — Geolocation service
- **Objective:** real "You Are Here" with permission, accuracy, and denial UX.
- **Creates:** `js/19-geolocation.js`.
- **Changes:** `js/14-redesign.js` (`#locateBtn` delegates), `index.html` (marker
  markup if needed).
- **Design:** **on-demand one-shot by default; `watchPosition` only while Live
  Visit is open**, and it stops on tab hide (`visibilitychange`) and on exit —
  this is the battery answer. Persistent marker + accuracy ring
  (`circle` layer, radius from `coords.accuracy`). Accuracy > 50 m ⇒ show a
  "approximate" state and suppress distance readouts. Denied ⇒ a one-time
  explanatory row with a "how to enable" note; never re-prompt automatically;
  everything else keeps working.
- **Depends on:** Batch 1.
- **Risk:** Medium — geolocation needs HTTPS (fine: GitHub Pages) and behaves
  differently on iOS Safari. Must be verified on a real iPhone.
- **Difficulty:** Medium. **Behavior change:** yes — `#locateBtn` does more.

### Batch 6 — Live Visit Mode
- **Objective:** the on-campus, in-hand view.
- **Creates:** `js/20-live-visit.js`, `css/14-live-visit.css`.
- **Changes:** `index.html` (header markup), entry button in the rail / My Gameday card.
- **UX (mobile-first):** a compact top bar — "You are here" state, current stop,
  next destination + direction arrow + "≈450 ft · 3 min", next scheduled
  activity + time, a progress bar, a contact button, and an always-visible
  "Full map" exit. Map chrome (search, filter chips, All-locations tab) is
  hidden; the map itself and `goToStop()` are unchanged. Desktop gets the same
  bar, wider.
- **Depends on:** 1, 2, 3, 4, 5.
- **Risk:** Medium — most new UI surface; mobile layout must not fight the
  existing bottom-sheet/details-sheet mutual exclusion (`isMobile()`,
  `setDetailsMode()`).
- **Difficulty:** Medium-High. **Behavior change:** only inside the mode.

### Batch 7 — Kiosk / presentation mode
- **Objective:** unattended full-screen loop for Lawton Room / office displays.
- **Creates:** `js/21-kiosk.js`, `css/15-kiosk.css`.
- **Changes:** `index.html` (overlay markup).
- **Design:** `?mode=kiosk[&autoplay=1]`. Reuses `goToStop()` on a timer
  (`config.gameday.kiosk.dwellMs`, default 12 s), loops to stop 1, hides rail /
  search / burger / start screen, enlarges tour controls, resets to stop 1 after
  an idle timeout (default 90 s), requests fullscreen on first user gesture
  (browsers block it otherwise — worth stating up front), exits via `Esc` held
  or a triple-tap in a corner. Auto-advance pauses on any manual interaction and
  resumes after the idle timeout.
- **Depends on:** 1, 2.
- **Risk:** Low-Medium — mainly the fullscreen gesture requirement and making
  sure the exit gesture is discoverable to staff but not to a passerby.
- **Difficulty:** Medium. **Behavior change:** only under `?mode=kiosk`.

### Batch 8 — Content-management groundwork
- **Objective:** make content editable without touching code, and validated.
- **Creates:** `docs/CONTENT-EDITING.md` (a plain-English guide for staff).
- **Changes:** finalize `docs/DATA-SCHEMA.md`; extend `scripts/validate-data.mjs`
  to cover locations, tours, sweeps, and gamedays; move any remaining
  copy out of JS into `data/`.
- **Deliberately NOT in Phase 1:** roles, drafts, publishing, version history,
  media upload, an admin UI. Those need auth and a backend — a later phase.
  Git *is* the version history until then, which is worth saying to staff plainly.
- **Difficulty:** Low. **Behavior change:** none.

### Batch 9 — Analytics sink + event coverage
- **Objective:** every Phase 1 feature emits the §D vocabulary.
- **Changes:** `track()` calls added across `06`, `08`, `16`, `17`–`21`.
- **Ships with:** the no-op sink in production; a `?debug=1` console sink.
- **Risk:** Low — fire-and-forget, wrapped in try/catch, never blocks UI.
- **Difficulty:** Low. **Behavior change:** none observable.

---

## F. Performance Guardrails (Phase 1 scope only)

Phase 2 owns performance. Phase 1's job is to **not make it worse**:

- Every new module is small, plain JS, and adds no third-party dependency.
- Nine new files ≈ 9 more requests on first paint. On HTTP/2 that is minor, but
  it is real on slow 4G — **Phase 2's bundling pass should treat `15`–`21` as one
  chunk.** Note it now, don't pre-optimize.
- `data/gamedays/<id>.json` is fetched **only when `?g=` is present**.
- Geolocation `watchPosition` runs **only inside Live Visit** and stops on tab hide.
- Kiosk mode must not leak: the auto-advance timer is cleared on exit and on
  `pagehide`.
- Analytics: fire-and-forget, no network in Phase 1, no synchronous work in a
  click handler.
- **No current performance numbers are measured.** Do not state any. Phase 2
  starts with a real DevTools Slow-4G trace.

---

## G. Migration-Readiness Rules (not migration work)

**No migration work is in Phase 1.** Hosting stays GitHub Pages, there is no
backend, and no Cloudflare or Supabase decision is made or needed. The
migration is its own phase, planned separately, after Phase 1 and Phase 2 are
built and validated.

What Phase 1 *does* commit to is five design rules. Each is defensible on its
own merits today; keeping the migration cheap is a side effect, not the
justification.

1. **Routing uses query params only.** No server rewrites means the same URLs
   work on any static host, today and later. It is also the only shape that
   works on GitHub Pages at all — the rule pays for itself immediately.
2. **All content keeps flowing through `js/00-data-adapter.js`.** This seam
   already exists and `CLAUDE.md` requires it. Phase 1 extends it rather than
   adding `fetch()` calls elsewhere. Whatever a backend turns out to be, it
   replaces one function.
3. **`track()` writes to a swappable sink.** Needed regardless — it is how the
   no-op production sink and the `?debug=1` console sink coexist. The event
   vocabulary is fixed in Phase 1 so data collected from the first real gameday
   stays comparable to anything collected later.
4. **Paths, flags and timings live in `config.js`.** Existing project
   convention, restated. No deployment-specific URL anywhere in app logic.
5. **A baseline git tag exists before anything changes.** That is a rollback
   target for Phase 1 itself, not a migration artifact.

**Explicitly out of scope for Phase 1:** authentication, authorization/RLS, a
staff dashboard UI, media uploads, database schemas, hosting changes, DNS, and
creating any external account or resource. Do not create Cloudflare or Supabase
resources during Phase 1.

---

## H. Test Matrix (Phase 1)

There is no automated suite. Everything below is manual, plus
`scripts/validate-data.mjs` for data files.

**Regression gate — every batch:** the full existing checklist in `CLAUDE.md`
must pass unchanged. That is non-negotiable and comes before any new-feature test.

| Dimension | Coverage |
|---|---|
| **Devices** | Desktop 1440px; Android phone; iPhone (Safari — the geolocation and fullscreen outlier); iPad 768/1024px; a large display for kiosk |
| **Browsers** | Chrome, Safari (desktop + iOS), Firefox, Edge |
| **Networks** | Broadband; DevTools Slow 4G; offline (must fail gracefully, not white-screen) |
| **Modes** | Normal; `?stop=`; `?g=`; `?mode=live`; `?mode=kiosk`; 2D; 3D simple; 3D Google; VR-profile UA |
| **Deep links** | All 10 stops; unknown stop; unknown gameday; malformed `?n=`; no params; back/forward through 5+ selections; refresh on a deep link; bookmark then reopen |
| **Geolocation** | Granted; denied; denied-then-granted; poor accuracy (>50 m); no HTTPS (localhost); airplane mode; permission revoked mid-session |
| **My Gameday** | Before / during / after kickoff time; countdown crossing midnight; device in a different timezone; progress persists across reload; localStorage disabled (private mode) |
| **Kiosk** | Autoplay loop through all 10; manual interrupt then idle resume; idle reset; exit gesture; 8-hour soak for timer/memory leaks |
| **Data** | Validator passes; a deliberately broken gameday file fails validation and the app still boots |

Every claim in a completion report must be labeled **"confirmed by reading
code"** or **"confirmed in a browser"**, per `CLAUDE.md`.

---

## I. Git Strategy

- **Baseline tag first:** `baseline/lsu3d-github-pages-2026-08-27` on the current
  `main` (`bf3954bf`). No tags exist today.
- **Branch per batch:** `feat/lsu3d-phase1-<n>-<slug>`, merged to `main` only
  after its regression gate passes. `main` stays deployable at all times — it is
  production.
- **Path-scoped commits.** The working tree has large unrelated changes in
  `NewIberia`, `dts/dts3`, and `CheckList`. Every commit stages
  `Wrapper/map/LSU3D/` paths explicitly. Never `git add -A`.
- **Commit message rules from `CLAUDE.md` apply:** no `Co-Authored-By`, no
  Claude/Anthropic/AI-generated attribution anywhere, no `--author`. **Every
  proposed subject + body is shown to you for a go-ahead before the commit runs.**
- **Checkpoint tag after each merged batch:** `phase1/batch-<n>`.
- **Rollback:** `git revert` the batch merge (preferred — `main` is public and
  deployed), or redeploy `baseline/lsu3d-github-pages-2026-08-27` in the worst
  case. No history rewriting, no force-push, no destructive git commands.

---

## Security & Privacy Review (Phase 1)

The items that actually bite on a **public static host**:

1. **`data/` is world-readable and permanently indexable.** Anything committed
   there is public — GitHub Pages serves it, and it lives in git history
   forever. **Therefore: no recruit names, no personal phone numbers, and no
   private staff mobile numbers in `data/gamedays/*.json`.** Contacts carry a
   **role + a published department line** only. A staff member's cell number
   waits until there is a backend with real auth. **This is the single most important constraint in
   Phase 1.**
2. **`?g=` ids are guessable and shareable.** Any gameday itinerary is
   effectively public. Adding a random suffix (`2026-09-05-alabama-7f3a`) raises
   the bar but is obscurity, not security. Real per-recruit privacy requires
   auth, which Phase 1 does not have. **Confirm with LSU staff what may go in a public
   itinerary file.**
3. **`?n=` (first name).** Read once for a greeting; never written to storage,
   never included in an analytics event, sanitized to ≤24 chars of
   letters/space/hyphen, and stripped from the URL after read so it doesn't sit
   in shared screenshots or browser history.
4. **Geolocation.** Never requested at boot — only on explicit tap or on
   entering Live Visit. Coordinates stay in memory, are never persisted, and are
   never sent anywhere (there is nowhere to send them in Phase 1). Watch mode
   only while Live Visit is open. Denial is handled and never re-prompted.
5. **Analytics.** No cookies, no cross-visit id, no coordinates, no names.
   `sessionId` is sessionStorage-scoped. With a no-op sink nothing leaves the
   device in Phase 1 — but the *design* is what a consent decision will apply
   to, so it stays minimal from the start.
6. **Kiosk exit.** The gesture must not expose admin controls; kiosk mode grants
   no capability a normal visitor lacks, so a bypass is a UX annoyance, not a
   security hole. Keep it that way — never put privileged actions behind it.
7. **Pre-existing, unchanged, restated for the record:** the Google Maps API key
   is public in `config.js` (protected by referrer restriction + billing cap —
   `README.md` explains why moving it doesn't help), and the OSM tile server is
   used directly for the label overlay and needs a keyed provider before real
   recruit traffic.

---

## Verification

Per batch, in order:

1. `cd Wrapper/map/LSU3D && python -m http.server 8000` — http is required;
   there is no `file://` fallback.
2. Run the **entire `CLAUDE.md` testing checklist** against
   `http://localhost:8000`. Any regression blocks the batch.
3. Run that batch's new-feature tests from §H.
4. `node scripts/validate-data.mjs` (from Batch 3 on).
5. Console must be clean on load and on every panel open.
6. Verify the mobile widths (~375 px) and tablet (~768/1024 px) in device
   emulation; verify Live Visit and geolocation on a **real** phone before
   calling either done.

---

## Final Summary

1. **Recommended order:** Batch 0 baseline → 1 core services → 2 router →
   3 content provider → 4 My Gameday → 5 geolocation → 6 Live Visit →
   7 kiosk → 8 CMS groundwork → 9 analytics coverage.
2. **Critical shared foundations:** the router, the analytics bus, the gameday
   state store, and the extended data adapter. Four things; everything else
   composes them. Nothing gets its own navigation or its own tour state.
3. **Quick wins:** the baseline tag; `stop_key` slugs; deep links (turns the
   existing Share button from useless into the QR/NFC system); the real
   "You Are Here" marker.
4. **Highest risk:** Batch 2's wrap of `selectFeature()` — every navigation path
   goes through it. Then Batch 6's mobile layout against the existing
   sheet system, and the `boot()`-runs-at-parse-time ordering.
5. **Deferred to a later phase (anything needing a backend):** staff
   authentication, the analytics dashboard UI, per-recruit private data, CMS
   roles/drafts/publishing/version history, media upload, and real staff contact
   details. Phase 1 does not decide what that backend is.
6. **Built static now, kept swappable:** the gameday/stop/progress/contact/event
   schemas, the analytics event vocabulary, the sink interface, and the
   data-adapter seam. All are useful as-is; none assumes a destination.
7. **Performance before new immersive features:** none blocking Phase 1 — no new
   immersive surface is added. Phase 2 should bundle `js/15`–`21`, and the
   pre-existing slow-4G Google-3D-billing concern in
   `docs/LSU_Mobile_4G_Audit_Prompt.md` still stands.
8. **Migration:** deliberately not sequenced here. It is a separate phase,
   planned after Phase 1 and Phase 2 ship and the real usage data exists to
   inform it. The five rules in §G are the only thing Phase 1 owes it.
9. **NEEDS CONFIRMATION:**
   - GitHub Pages source setting (branch + root vs `/docs`) — check repo Settings → Pages.
   - What LSU staff will permit in a **publicly readable** itinerary file (§Security #1/#2).
   - Whether Live Visit needs true walking routes or whether straight-line
     distance + a direction arrow is sufficient. The plan assumes the latter
     (no routing API, no cost, no dependency).
   - Real gameday dates/opponents/times for the first itinerary file.
   - Kiosk hardware: which browser, which display, and whether it is unattended.
   - Whether `?n=` (first name in URL) is acceptable to staff at all.
10. **First implementation batch after approval:** **Batch 0 + Batch 1** —
    create the baseline tag, then `js/15-core-services.js` plus the single
    guarded `onAppReady()` line in `js/11-boot.js`. Small, reversible, no visible
    behavior change, and it proves the load-order approach before Batch 2 touches
    `selectFeature()`.
