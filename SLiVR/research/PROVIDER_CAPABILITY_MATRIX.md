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
