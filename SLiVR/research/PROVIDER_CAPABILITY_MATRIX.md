# Phase 0 provider capability matrix

Recorded 2026-09-20. Catalog/schema 1.0.0; research snapshot 2026-09-19.

Evidence sources: owner acceptance of all 11 supplied entries, shared-downtown
navigation and independent-experience transitions on deployed 59a980ac; subsequent
owner acceptance of D059 loading behavior published as efa64612. No raw message
report or exact browser version was supplied. Do not infer per-entry pose APIs,
capture metadata, media rights or calibrated geometry from visual acceptance.

| Capture | Location | Experience | Visual loading/entry | Bridge/pose report | Capture date / coverage |
|---|---|---|---|---|---|
| CAP-001 | LOC-001 Carpe Diem Cafe & Wine Bar | 5eb11a1b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-002 | LOC-002 Pop's Poboys | 5eb11a1b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-003 | LOC-003 Lafayette Old City Hall / Bank of Lafayette | 5eb11a1b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-004 | LOC-004 Spoonbill Watering Hole & Restaurant | 5eb11a1b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-005 | LOC-005 Rock'n'Bowl de Lafayette | 5eb11a1b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-006 | LOC-006 Borden's Ice Cream Shoppe | 5eb11a1b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-007 | LOC-007 Play N Trade | 62704853 | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-008 | LOC-008 Givens House | 6af20e40 | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-009 | LOC-009 Magnolia Pantry | a872109b | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-010 | LOC-010 Former Truman Early Childhood Education Center | a21e99a0 | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |
| CAP-011 | LOC-011 Moncus Park | 4c37c871 | PASS, owner-reported | Raw per-entry report not supplied | Information has not been found; extent unverified |

The six downtown entries retain separate IDs and sweep targets. Owner-reported
navigation acceptance covers at least two sibling targets, not a claim of pose
or sweep-list capability for every entry. Automated shell checks confirm six
distinct queued navigation commands and acknowledgement handling using doubles.

| Provider | Phase 0 evidence | Limitations / next check |
|---|---|---|
| DOTD 2025 primary | Owner visual acceptance across all six areas; archived image-content probe | Historical probe, not a new provider request |
| DOTD 2024 fallback | Owner forced-fallback acceptance; archived image-content probe | Provider availability may change |
| Google exterior 3D | Owner geometry, attribution, repeated-toggle and blocked-provider acceptance | Denied-key, slow and context-loss paths automated with doubles; no new live request |
| Three.js 0.183.0 | Owner screenshot: rendered camera/actor/frustum and ten PASS assertions | Optics demonstration, not a complete shot editor |

Phase 2 preparation: obtain the diagnostic report for each capture; record
ready/navigation/pose/sweep-list capabilities without coercing unknowns. Confirm
capture dates, extent and permitted reuse through provider administration before
making freshness/rights claims or enabling media-dependent features.


## 2026-09-22 update ? D071 independent Phase 2 reconnaissance

The preceding 2026-09-20 matrix is historical owner evidence. Current catalog
is 1.1.0, schema 1.0.0; 18 total records, 11 current entries/six experiences.
Runtime baseline local 31831661/published f2627108. D071 final runtime digest:
c1a979196d5a331308cce0853410bead57c8590c33997e8476dc30430145dde3.
Adapter protocol remains treedis-recon-2. No new browser capability report exists.

Executed `node tools/probe-treedis.mjs --out outputs/acceptance-2026-09-22/treedis`
on Windows, Node v24.18.0, at 2026-09-22T13:28:40.061Z (08:28 CDT).
Probe 1.0.0 requested the catalog URLs on https://spaces.dtsxr.com. All responses
were HTTP 200, echoed supplied experience/sweep IDs in the document, and had no
X-Frame-Options or CSP frame-ancestors directive. Actual embedding is **unknown**.
The probe's available=true means HTTP response only, not rendered capture.
Raw report SHA256: 6849a720189a01060d7b902d1b9c7852d258bea4e0d5f7b582a7fb77261e2fd4.

| Entries | Experience | HTTP-only result | New runtime capabilities |
|---|---|---|---|
| CAP-001..006 / LOC-001..006 | 5eb11a1b | 6/6 HTTP 200; no declared header refusal | Not observed |
| CAP-007 / LOC-007 | 62704853 | HTTP 200; no declared header refusal | Not observed |
| CAP-008 / LOC-008 | 6af20e40 | HTTP 200; no declared header refusal | Not observed |
| CAP-009 / LOC-009 Magnolia Pantry | a872109b | HTTP 200; no declared header refusal | Not observed |
| CAP-010 / LOC-010 | a21e99a0 | HTTP 200; no declared header refusal | Not observed |
| CAP-011 / LOC-011 Moncus Park | 4c37c871 | HTTP 200; no declared header refusal | Not observed |

Browser discovery was empty and tab creation failed. Rendered scene, ready,
matching sweep arrival, pose fields/conventions, sweep list and screenshot
support remain unverified per entry for this build. No fresh DOTD/Google live
check was made. Capture dates/extent/rights remain explicit unknowns.

Stable test 220 PASS uses simulated messages for the exact downtown -> Magnolia
-> Moncus sequence, not this HTTP probe. Stable 219 PASS prevents diagnostics
from treating poseReporting as full-view restoration. The old diagnostic text
was overconfident even for sweep-only messages; no restoration implementation
was delivered by that flag. Raw rotations still have unestablished axes/units.
Screenshot support has no implemented adapter operation or actual capability
proof; do not enable it. See [reconnaissance prerequisites and sources](PHASE_2_RECONNAISSANCE.md).


### 2026-09-22 - D075

D075 composes existing MapLibre/DOTD/OSM and optional Google 3D with unchanged SLIVR_RUNTIME configuration. Automated wiring evidence does not establish rendering or Treedis arrival/pose/sweep/navigation/screenshot capability. Live 224 remains BLOCKED. Capture dates, coverage and rights remain explicit unknowns.


### 2026-09-22 - D077

D077 owner mini-map pass does not establish new Treedis pose/sweep-list/full-view restoration/screenshot capability. Keep prior provider findings and unknowns; actual capability evidence remains a dependency for bookmarks.


#### D077 owner scope clarification

Owner explicitly confirms "yeah all the test even the ones before the map" in response to the question naming earlier provider-failure and real-browser storage/reload/export/import checks. All earlier instructed delivered-function checklists, including owner 15-16, are now owner-reported PASS. Preserve earlier NOT TESTED/BLOCKED/FAIL entries as historical; do not repeat those checks solely for missing tool access. Browser/version/device and exact tested digest remain unspecified. This does not make unimplemented bookmark save/restore tested, supply absent raw provider reports, or explicitly approve E1. Bookmark-specific and later-phase workflows remain NOT TESTED. No runtime changes or new automated execution.
