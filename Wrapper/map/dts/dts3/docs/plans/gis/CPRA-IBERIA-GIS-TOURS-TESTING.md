# CPRA Iberia GIS project tours — manual testing

Manual testing handoff for the CPRA Iberia Parish per-feature guided tours
feature (a new `cpra-projects-points` layer plus 13 project-specific tours —
now covering all 13 real Iberia Parish CPRA projects in that layer, expanded
from an initial 5 — each attached to one real CPRA project pin via a new
`gisFeatureTour` association type), and the general CMS capability behind
it. Same shape as `docs/plans/gis/GIS-PHASE5-CMS-TESTING.md` — fill in as
you go.

**Scope note (2026-08-14):** sections 2 and 5 below were filled in against
the original 5-project scope and are untouched here — see their own `Claude
Fix` notes. Sections 3/4/6/7 have been expanded to the full 13 for this
round. If you want to spot-check section 5's CMS items against the extra 8,
that's a bonus, not a requirement — nothing about the CMS editor itself
changed, only how many tour/feature-tour documents exist.

**Nothing in this document has been marked as tested.** Every checkbox below
is unchecked. Leave "Not tested" checked (or all three unchecked) for
anything you skip, and use the Comments line for anything that doesn't
cleanly pass or fail.

Verified by direct means before this handoff (not by an agent-driven Chrome
session, per this repo's verification approach): the real ArcGIS service
(`cimsgeo.coastal.louisiana.gov/.../outreach/Outreach_Projects_Layer_New/MapServer/0`)
was queried live — `where=Project_Status_List.Parish LIKE '%Iberia%'` returns
13 real features, and the 5 projects below were matched to it by name and
`Project_ID`, confirmed live. Every `mapId`/`tourId`/`layerId` cross-reference
in the new JSON documents was checked by a small script against the real
files on disk. `node --check` passed on every edited `.js` file. What's
below is what that couldn't settle — real rendering, click behavior, and the
CMS UI.

## Setup

- Serve the site locally: `python -m http.server 8000` from the repo root.
- Base URL: `http://localhost:8000/index.html`
- Admin sign-in: click "Access Your Twin", sign in with `dtsAdmin` /
  `CHANGE_ME_BEFORE_DEPLOY` (from `data/access/access.json`).
- Open the browser console before you start and leave it open all session.
- Live-site path: Government sector → "Coastal Resilience" project → the
  Parish map tab (mapId `iberia-coastal`). The new layer is in the
  "Coastal projects (CPRA)" group, titled "CPRA projects (Iberia Parish)" —
  it's off by default, same as the map's other CPRA layers.

All 13 real Iberia Parish projects now have tours, for reference while testing:

| Project | Project_ID | Status |
|---|---|---|
| Acadiana Regional Airport Street Improvements — Admiral Doyle Drive | TV-0031 | Completed |
| Port of Iberia Bridge Replacement — Port Road Over Commercial Canal | TV-0028 | Completed |
| Port of Iberia Bridge Replacement — David Dubois Road Over Commercial Canal | TV-0030 | Completed |
| Rutton Rill Rd Flood Protection | TV-0094 | Headed to Bid |
| Stumpy Bayou Flood Protection | TV-0095 | Headed to Bid |
| CIAP Performance Evaluation Borrow Area Management and Monitoring | LA-0012-7 | Completed |
| Non-Rock Alternatives to Shoreline Protection Demonstration | LA-0016 | Completed |
| East Marsh Island Marsh Creation | TV-0021 | Completed |
| Cypremort Point State Park Improvements | TV-0081 | Completed |
| Little Valley Bayou Water Control Structure | TV-0092 | Headed to Bid |
| Iberia/St. Mary Upland Levee | TV-0102 | Engineering & Design |
| Big Bayou Pigeon Depth Restoration | AT-0039 | Engineering & Design (no published project description — tour says so honestly) |
| Abbeville and Vicinity Hurricane Protection | TV-0108 | Planning |

Note on `LA-0012-7`: its real map point falls well outside the parish (a
multi-parish borrow-area study, plotted near Barataria Basin) and outside
this map's `maxBounds` — its tour deliberately uses the parish's own default
view instead of trying to zoom to that point, and the highlight may not be
visible on screen. Flagged in the tour's own step text, not a bug to chase.

---

## 1. Map and layer loading

- [x] Pass  [ ] Fail  [ ] Not tested — Test: The Parish map still loads normally; console clean.
      Comments: ___________________________
- [x] Pass  [ ] Fail  [ ] Not tested — Test: "CPRA projects (Iberia Parish)" appears in the layer panel under "Coastal projects (CPRA)", off by default. Turning it on shows point pins, not polygons.
      Comments: ___________________________
- [x] Pass  [ ] Fail  [ ] Not tested — Test: Only Iberia Parish projects appear as pins — no pins clustered far outside the parish (spot-check against the parish boundary; there should be roughly a dozen pins, not a statewide scatter).
      Comments: ___________________________
- [x] Pass  [ ] Fail  [ ] Not tested — Test: The pre-existing "CPRA project footprints" layer (polygon footprints, a different service) still works exactly as before — unaffected by this change.
      Comments: ___________________________

## 2. Pin click / popup / feature↔tour matching

For each of the 5 projects above:

- [ ] Pass  [x] Fail  [ ] Not tested — Test: Admiral Doyle — clicking its pin shows the normal attribute popup AND a "Start guided tour" button.
      Comments: click doe snot work it does not activate anything when a point is clicked.

Claude Fix:
- Root cause: two compounding, pre-existing issues in `js/gis/gis-viewer.js`,
  neither introduced by this feature's own layer, but both blocking any point
  layer stacked below `parish-boundary` (zIndex 90) from ever receiving a
  click: (1) `buildParishMask()`'s dim mask sits in its own pane at zIndex
  450 — above every data layer — with `interactive:false`, but that option
  only excludes it from its own canvas's *hit test*; it does not stop that
  canvas's DOM element from being the browser's actual click target. Under
  this map's `preferCanvas:true`, every distinct zIndex pane gets its own
  `<canvas>`, and Leaflet's canvas click dispatch (confirmed by reading the
  vendored `leaflet.js` directly — `L.Canvas#_onClick`/`L.Map#_fireDOMEvent`)
  only ever tests the browser's actual click target; a miss there becomes a
  generic, untargeted map click and never falls through to test any lower
  pane's own canvas. The always-on mask was silently swallowing every click
  on the whole map. (2) Even with the mask fixed, `parish-boundary` itself
  (zIndex 90, always visible, a filled polygon covering the entire parish,
  genuinely interactive) sits above the new `cpra-projects-points` layer and
  would win the same way — so the new layer needed a higher zIndex to be the
  one whose canvas actually receives clicks on its own pins.
- Change: `buildParishMask()` now sets `pointer-events:none` directly on the
  mask's own dedicated pane element, so the browser skips its canvas entirely
  and the click reaches whatever's actually drawn underneath — restoring the
  "cosmetic only" behavior `interactive:false` already documented as the
  intent. Separately, `cpra-projects-points`'s `zIndex` was raised from 21 to
  95 (above `parish-boundary`'s 90) so its own pins' canvas is the one that
  receives clicks on them; documented inline in the layer's own
  `description` so a future edit doesn't "normalize" it back into the
  group's ordinary z-order without understanding why.
- Files: `js/gis/gis-viewer.js`, `data/gis/maps/iberia-coastal.json`.
- Verification: confirmed by direct reading of the vendored, unminified-where-
  possible `leaflet.js` dispatch code (`_onClick`, `_fireDOMEvent`,
  `_findEventTargets`), not guessed from the symptom. Empirically: a
  jsdom-based headless test against the real Leaflet + esri-leaflet + this
  repo's own `gis-esri.js` confirmed the underlying feature/click-propagation
  mechanism works correctly for this exact real CPRA service and its
  `Project_ID`-based feature identity when not blocked by an overlapping
  pane; a second jsdom test running the *same* full `DTSGis.mount()` pipeline
  against the pre-existing, presumably-already-working `critical-facilities`
  layer showed the identical "zero rendered markers" result, which is a
  jsdom limitation (it has no Canvas 2D implementation at all — confirmed
  directly, `HTMLCanvasElement.getContext()` is "Not implemented" without a
  separate native `canvas` package), not evidence of a bug — this project's
  own Phase 5 jsdom harness has the same documented gap ("cannot render CSS,
  Leaflet, or real network calls"). **The `pointer-events:none` DOM/CSS
  mechanism itself is standard, well-established browser behavior, not
  something that needs Leaflet-specific verification** — confirmed the exact
  JS API used (`el.style.pointerEvents = "none"`) sets and serializes
  correctly. What could not be verified deterministically: the actual live
  click → popup → "Start guided tour" behavior in a real browser, which is
  exactly what this checklist section is for.
- Ready for manual retest: Yes

- [ ] Pass  [x] Fail  [ ] Not tested — Test: Port Road Bridge — same.
      Comments: ___________________________

Claude Fix:
- Root cause / Change / Files / Verification: same as Admiral Doyle above —
  one shared fix (the mask's `pointer-events:none` + the layer's zIndex),
  not a per-project issue.
- Ready for manual retest: Yes

- [ ] Pass  [x] Fail  [ ] Not tested — Test: David Dubois Road Bridge — same.
      Comments: ___________________________

Claude Fix:
- Root cause / Change / Files / Verification: same as Admiral Doyle above.
- Ready for manual retest: Yes

- [ ] Pass  [x] Fail  [ ] Not tested — Test: Rutton Rill Rd — same.
      Comments: ___________________________

Claude Fix:
- Root cause / Change / Files / Verification: same as Admiral Doyle above.
- Ready for manual retest: Yes

- [ ] Pass  [x] Fail  [ ] Not tested — Test: Stumpy Bayou — same.
      Comments: ___________________________

Claude Fix:
- Root cause / Change / Files / Verification: same as Admiral Doyle above.
- Ready for manual retest: Yes

- [ ] Pass  [x] Fail  [ ] Not tested — Test: Clicking a pin for one of the other 8 Iberia projects (no DOCX content) shows the normal popup with NO "Start guided tour" button.
      Comments: Clicking does not work at all.

Claude Fix:
- Root cause / Change / Files / Verification: same as Admiral Doyle above —
  this confirms the bug was never specific to feature-tour-linked pins; it
  blocked every pin on the new layer, matched or not, which is consistent
  with a map-wide click-routing issue rather than anything in the
  feature-tour association logic itself.
- Ready for manual retest: Yes

Note: Since the click on the points does not work i could not test anything above!
Given the fix above, these should now be retestable — flagging, not
re-marking, since I did not execute the manual retest myself.
## 3. Tour content accuracy (word-for-word against the DOCX)

For each of the 13 tours, click "Start guided tour" and check each step
against `docs/plans/gis/CPRA PROJECT TOUR INFORMATION.docx` (updated
2026-08-14 to cover all 13 — text was rewritten to be more plain-language/
community-facing than the original 5's wording, sourced from the same CIMS
Iberia Parish factsheet data provided this round, so check against the
*current* DOCX text, not the original 5's older wording).

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Admiral Doyle — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Port Road Bridge — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: David Dubois Road Bridge — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Rutton Rill Rd — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Stumpy Bayou — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: CIAP BAMM — all 3 steps match the DOCX exactly, including the multi-parish/off-map caveat in Step 1.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Non-Rock Shoreline Protection Demo — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: East Marsh Island Marsh Creation — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Cypremort Point State Park Improvements — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Little Valley Bayou Water Control Structure — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Iberia/St. Mary Upland Levee — all 3 steps match the DOCX exactly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Big Bayou Pigeon Depth Restoration — Step 2 honestly says no published description exists yet, rather than inventing one.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Abbeville and Vicinity HP — all 3 steps match the DOCX exactly, including the "long-term concept, not a finalized design" caveat.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: No step, on any of the 13 tours, contains educational content that isn't in the DOCX (no invented dates, impacts, or explanations beyond what the DOCX/factsheet actually says).
      Comments: ___________________________

## 3a. Step media (new)

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Every one of the 13 tours shows a real aerial photo on its "Where it's at" step — check a handful (not all 13) for obvious problems: broken image, wrong-looking location, mostly-black tile.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Cypremort Point's "What it is changing" step additionally shows the real marsh-boardwalk ground photo (not just the aerial).
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Images don't distort/overflow the tour card at normal desktop width.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test (CMS): Opening any of the 13 tours' first step in the tour editor shows "+ Add video (optional)" alongside "+ Add image (optional)" is gone (media already set) — instead confirm the existing image shows correctly with its real alt text.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test (CMS): On a *test* step with no media yet, click "+ Add video (optional)", paste a real YouTube watch URL (e.g. any public video), and confirm the field accepts it without requiring a separate "provider" selection.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: That same test step, previewed live on the site, shows the YouTube video actually embedded and playable (not a broken `<video>` player) — this is the one part of this feature with no real content yet, so use any placeholder public YouTube link for the check.
      Comments: ___________________________

## 4. Tour playback and map focus

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Start/Next/Previous/Close all work correctly on a feature tour, same as the parish-wide tour.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Each step zooms/pans to the correct project location and highlights that project's pin (gold highlight ring on the correct pin, not another one).
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: CPRA pins are still clickable *during* the parish-wide tour's new last step ("CPRA projects here in Iberia Parish") — click one and confirm its popup (and "Start guided tour" button, if it has one) appears.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: After finishing (or exiting) any individual project tour, CPRA pins are still clickable afterward — not just the one that was just highlighted, a different one too.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Starting one project's tour, finishing or closing it, then clicking a different project's pin and starting its tour works cleanly (no leftover state from the first tour).
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: These 13 tours do NOT appear in the map's own "Guided tours" toolbar button/dropdown or "Default tour" picker — only the parish-wide intro tour does.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: The parish-wide `iberia-coastal-intro` tour's autostart-once-per-session behavior is unaffected by this change.
      Comments: ___________________________

## 5. CMS — Admin Board

Admin sign-in → GIS Maps → "Iberia Parish — Coastal Resilience".

- [x] Pass  [ ] Fail  [ ] Not tested — Test: A new "Feature tours" section appears below "Guided tours", listing all 5 real feature tours with correct layer/field/value/tour title shown.
      Comments: ___________________________
- [x] Pass  [ ] Fail  [ ] Not tested — Test: Clicking "Edit" on one opens the feature tour editor; Layer/Enabled/Field/Value/Tour all show the real saved values correctly.
      Comments: I can se the edition but i can not see preview maps when "pick from map".
- [x] Pass  [ ] Fail  [x] Not tested — Test: Unchecking "Enabled" and saving (Save draft & preview) — that project's pin no longer shows the "Start guided tour" button on the live-previewed site; re-checking it restores the button.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [x] Not tested — Test: "+ New feature tour" creates a new association against a test layer/feature; "📍 Pick from map" (after clicking a real feature on the preview map) correctly fills in the field/value from that feature's real attributes.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [x] Not tested — Test: "+ Create tour for this feature" creates a new empty tour, links it, and does NOT add it to the map's own "Guided tours" list.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [x] Not tested — Test: Adding/deleting/reordering steps on one of the 5 real feature tours (via "Edit" on its "Guided tours" section entry — it's an ordinary tour editor) works exactly like any other tour.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [x] Not tested — Test: "Delete this feature tour" removes only the association, not the underlying tour content (confirm the tour still exists under "Guided tours" if referenced from there, or just isn't linked to anything).
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [x] Not tested — Test: Deleting one of the 5 tours themselves (via its own "Delete this tour" button) shows a warning naming the feature tour association, and clears (doesn't crash) that association's `tourId` on confirm.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [x] Not tested — Test: Save draft → Preview → the changes above are reflected on the live-previewed site.
      Comments: ___________________________

## 6. Mobile / responsive (brief)

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: On a narrow viewport, tapping a CPRA pin shows the popup with the "Start guided tour" button usably (not clipped/overlapping).
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: A feature tour's card renders as a bottom sheet on mobile, same as the parish-wide tour.
      Comments: ___________________________

## 7. Regression (brief)

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Home ↔ each of the four sector views.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: "Try a Digital Twin" reveal opens and closes — the tour must not reload.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Sign-in with `demo` / `1234`.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Admin sign-in → save draft → preview → discard round-trips cleanly.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Console clean on load and on every overlay.
      Comments: ___________________________

---

## Summary

Notes for anything that needs discussion before this is considered done:

_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________
