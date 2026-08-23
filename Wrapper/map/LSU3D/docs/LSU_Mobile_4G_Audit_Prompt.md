# Build Prompt: Audit and Optimize for Mobile / Tablet on Slow 4G

Run this in the LSU "Death Valley Experience" project folder. Paste this whole
document to Claude Code as your message. It is written *to* Claude Code
(second person = you, the agent).

## Work directly — no Plan Mode this time

Audit first (Section 1), but don't stop and wait for approval before fixing
things. Summarize what you found and what you're about to change (Section 2)
as a short written checkpoint in your own response for the record, then go
straight into implementing the fixes in Section 3's phased order. The audit
still matters — don't skip it and start guessing at fixes — it's just not a
gate you need someone else to unlock.

## A note on the Chrome extension

This task is one of the few where real browser testing genuinely earns its
token cost — you can't verify a responsive layout or a throttled network
condition purely by reading code. Even so, use it deliberately, not
continuously: get a Lighthouse mobile run and a code-level audit done first
(Section 1), form a hypothesis about what's wrong, fix it, and use the
extension for a small number of targeted checks — a couple of screenshots at
phone and tablet widths, one throttled load test — rather than reloading and
eyeballing the browser after every change.

---

## 0. Context

Nobody has verified this app on anything but a desktop browser — every
screenshot and every prior build prompt in this project's history has been
desktop-width. The people who'll actually use this in the field are recruits
and families on their own phones (per the deck: reviewing the experience
before a visit, revisiting it for weeks after), plus staff on tablets/kiosks
in the Operations Facility and Lawton Room. Assume nothing about mobile
behavior currently works well — this audit exists to find out, not to confirm
a hunch.

This also matters more than usual for this app specifically, because of what's
already been built: a MapLibre 2D/3D map, a Three.js + `3d-tiles-renderer`
layer for Google's Photorealistic 3D Tiles (heavy to load, and metered — each
load is a billed session), a plain extruded-building fallback, and DOTD raster
aerial imagery. On a fast desktop connection all of that loading eagerly is
invisible. On a slow 4G phone connection it can mean a very long wait, wasted
mobile data, and — for the Google tiles specifically — real money spent on a
session that never even finishes loading.

## 1. Audit phase — do this first

- **Baseline performance numbers.** Run a Lighthouse mobile audit with the
  "Slow 4G" throttling preset against the running app (Lighthouse can run
  headless from the CLI — use that rather than eyeballing load times).
  Record First Contentful Paint, Largest Contentful Paint, Time to
  Interactive, Total Blocking Time, and total transferred bytes on first
  load. This is the number everything else in this task should be measured
  against — don't skip straight to fixes.
- **Bundle and asset audit.** What's actually in the initial JS payload today?
  Specifically check whether Three.js, `3d-tiles-renderer`, and the Google
  tiles integration are already deferred until the user switches to 3D (this
  was asked for in an earlier build prompt — verify it was actually done,
  don't assume it was), or whether they're loading on first paint regardless
  of whether anyone ever opens 3D mode.
- **Responsive layout audit.** Check the sidebar panel, the guided-tour bottom
  bar, search, filter chips, and the map's own zoom/layer controls against
  narrow viewports (~375px phone, ~768px and ~1024px tablet, both
  orientations). Note anything that overflows, clips, becomes unreadable, or
  relies on hover instead of touch.
- **Network/tile behavior audit.** How do the DOTD imagery layer, the
  fallback building layer, and the Google tiles layer behave when a request
  is slow or times out today — is there any loading state, timeout, or
  retry logic, or does a slow tile just silently never appear?
- **Existing network-awareness.** Check whether anything already reads
  `navigator.connection` (Network Information API) or `saveData` — almost
  certainly nothing does yet, confirm rather than assume.

## 2. Audit summary, decisions, and execution order — write this up, then go

- **The baseline numbers from Section 1**, stated plainly, so there's a
  before/after to compare against later.
- **A prioritized list of what's actually wrong**, ranked by impact — don't
  present a flat todo list. Bundle size and unnecessary eager-loading of 3D
  code likely dominate the slow-4G experience; layout clipping matters for
  usability but not load time; treat these as different priorities.
- **Decide these yourself and state the decision** (don't leave them open —
  there's no approval step to resolve them for you):
  - Whether 3D mode (either Google tiles or the simple fallback) should
    auto-default to off on a detected slow/cellular connection, requiring an
    explicit tap to load it — given Google tiles are also billed per
    session, loading one automatically on a connection too slow to actually
    finish wastes both time and money. Pick the safer default.
  - What happens for browsers that don't support the Network Information API
    (Safari, notably) — pick a sensible default rather than leaving it
    undefined.
  - Whether the sidebar becomes a bottom sheet, a collapsible drawer, or
    something else on narrow viewports — pick one, consistent with the
    existing purple/gold visual style, not a generic default.
- **Phased execution order**, each phase independently verifiable:
  1. Defer all 3D-specific code (Three.js, `3d-tiles-renderer`, Google tiles
     integration, the fallback building layer) so none of it is in the
     initial bundle — confirm with a fresh Lighthouse/bundle check that this
     alone measurably improves first-load numbers.
  2. Add network-quality detection and the auto-default behavior from the
     decision above.
  3. Fix responsive layout issues found in the audit — sidebar, tour bar,
     controls, touch target sizing.
  4. Add loading/skeleton states and graceful timeout handling for tile and
     3D-asset requests, so a slow connection shows a clear, calm loading
     state instead of a blank map or an infinite spinner.
  5. Re-run the Lighthouse Slow-4G audit and compare against the Section 1
     baseline; verify the specific numbers actually improved, not just that
     the app "feels" faster.

Go through these phases directly. If something in the real codebase makes one
of the decisions above obviously wrong once you're in the code, change course
and say so in your summary — you don't need permission to course-correct, just
to be honest about it afterward.

## 3. What this should not regress

- Desktop behavior — this is about making mobile/slow-network usage good,
  not trading desktop performance or layout for it.
- The 2D/3D toggle, the Google-tiles/fallback logic, and tour-stop camera
  sync from the prior migrations — network-awareness should change *when*
  and *whether* heavy content auto-loads, not remove anyone's ability to
  choose it manually.
- Kiosk behavior — the Operations Facility and Lawton Room kiosks are
  presumably on a wired facility network, not cellular. Don't build logic
  that assumes everyone is on a slow connection; make the degradation
  genuinely adaptive to actual detected conditions, with a manual override
  available either way (e.g., a simple "reduce data usage" toggle a kiosk
  operator could deliberately turn off).

## 4. Safety net

Same branch/feature-flag discipline as the rest of this project. Network-
quality detection is heuristic and can misfire — a fast connection
misdetected as slow degrades the experience for someone it shouldn't affect.
Ship it as a sensible default with an easy, obvious manual override, not as
an invisible, unoverridable decision made for the user.

## 5. Self-check before calling this done

- [ ] Lighthouse Slow-4G mobile numbers are recorded before and after, and
      have actually improved, not just been eyeballed as "feels better."
- [ ] Three.js / `3d-tiles-renderer` / Google tiles code is confirmed absent
      from the initial page load — verified in the network panel or bundle
      output, not assumed.
- [ ] Sidebar, guided-tour bar, search, and filter chips are usable and
      non-clipping at phone width (~375px) and tablet width, both
      orientations.
- [ ] Touch targets are reasonably sized — nothing that only worked via
      hover on desktop is now hard to tap on a touchscreen.
- [ ] A detected slow/cellular connection changes default 3D-loading
      behavior, with a working manual override.
- [ ] Slow or failed tile/3D-asset requests show a clear loading or timeout
      state, never an indefinite blank map.
- [ ] Desktop behavior, the 2D/3D toggle, and kiosk-relevant behavior are
      all unaffected.
- [ ] `README.md` documents the network-awareness behavior and how to
      override it manually.
