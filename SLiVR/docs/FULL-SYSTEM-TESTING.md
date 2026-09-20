# SLiVR — Full System Testing

One living verification document for the complete SLiVR system. It begins before implementation and must be updated as Phases 0–6 are planned, built and validated. It combines phase exit checks, manual browser/device tests, provider checks, failure recovery, research traceability and a standing regression sweep.

The first-prototype release gate covers **Phases 0–5**. **Part I / Phase 6 Treedis Research Mode is post-prototype** and must not block the essential prototype unless the approved architecture is revised.

No test is pre-marked. A passing unit test, code review, HTTP response or earlier smoke test does not automatically prove browser/device behavior. Only the person or automated job that actually ran the test should record a result and evidence.

## Document control

| Field | Value |
|---|---|
| Test specification version | 0.1 |
| Architecture baseline | SLiVR architecture 0.19 or later |
| Created | 2026-09-19 |
| Last updated | 2026-09-19 |
| Current implementation phase | Phase 0.1 — catalog, schemas and spatial core |
| First-prototype gate | Parts A–H and J, using the phase applicability rules below |
| Post-prototype gate | Part I plus affected regression tests |

Update this table whenever the architecture, phase, schema, provider contract or test meaning changes. Preserve prior real results in source history or an archived execution copy; never silently rewrite a test after it has produced evidence.

---

## Before you start

### Test target

Record the exact target. Never report “latest” without an immutable build or commit identifier.

Most recent recorded execution. Earlier executions are kept in the execution log at the end of this document.

| Item | Recorded value |
|---|---|
| Build/commit | Uncommitted working tree, Phase 0.1. Publishable-tree sha256 digest `89aae7a86236` over 40 files. |
| Deployment URL or localhost origin | None. Automated checks only; no application shell exists yet. |
| Test date/time and time zone | 2026-09-20T01:38Z (2026-09-19, America/Chicago) |
| Tester | Automated suite executed from the project root |
| Catalog/schema version | Catalog 1.0.0, record schema 1.0.0, research snapshot 2026-09-19 |
| IndexedDB schema version | Not implemented in Phase 0.1 |
| Treedis adapter/capability version | Not implemented in Phase 0.1 |
| DOTD primary/fallback configuration | Configured in `data/region/lafayette.region.json`; not yet requested from the live service |
| Optional Google 3D enabled/config version | Not configured; no credential present |
| Browser and version | None. No browser execution in this run. |
| OS/device/input | Windows 11, Node.js v24.18.0 |
| Display/viewport | Not applicable |
| Network profile | Offline; no provider request was made |
| Study protocol/probe/schema version, Phase 6 only | Not applicable unless Part I is authorized |

### Required fixtures

- The reviewed 17-location catalog: 11 current Treedis entries and six future candidates across six operational areas.
- Shared downtown experience `5eb11a1b`, preserving six distinct location/entry records.
- Magnolia Pantry independent experience `a872109b` and at least one non-downtown independent experience.
- A project with at least two scene requirements and at least three candidates containing known, unknown and conflicting evidence.
- A shot scene based on the supplied downtown reference with at least two cameras, actors/marks and movement paths.
- An owned test floor-plan/reference image with a known distance and documented units.
- Valid, malformed, older-schema, conflicting-ID and future-schema JSON fixtures.
- Provider-failure controls or test doubles for DOTD, Google 3D, Treedis, WebGL loss and IndexedDB write failure.
- Phase 6 only: synthetic WebXR fixtures before any live participant data; approved Quest/browser/runtime and authorized Treedis research entry for live compatibility testing.

### Reset and preservation

Export valid project JSON before clearing browser storage. Use a dedicated test browser profile. Never clear storage, service workers or caches for LSU3D or another application on the origin. Do not use real confidential production data or participant data in general system tests.

### Result format

Use exactly one status. `BLOCKED` requires a concrete dependency and retest condition. `NOT TESTED` means no execution evidence exists.

```text
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED
Evidence: build, browser/device, automated test or artifact link
Comments: observed behavior, failure details, issue ID, or retest condition
```

For failures, include test number, actual result, expected result, reproduction steps, console/network evidence and whether user data was at risk. Fixes happen in a separate pass; rerun the failed test and its named regression set after the change.

### Phase-update rule

When implementation adds or changes a feature, Claude must update this document in the same phase work package:

1. Add or revise tests before claiming the feature complete.
2. Link tests to the affected feature ID, decision and phase exit gate.
3. Keep unimplemented tests unmarked.
4. Record automated evidence separately from live browser/device evidence.
5. Add discovered regressions and failed assumptions; do not remove inconvenient tests.
6. Run the affected phase section plus Part J before closing the phase.

---

# Part A — Scope, repository and deployment invariants

These checks apply in every phase.

**1. LSU3D remains untouched. [D001]** Compare the LSU3D working tree/baseline recorded before SLiVR work with the current state attributable to this project. Confirm no SLiVR implementation changed, generated, formatted, staged or deployed a file under `E:\sroberto27.github.io\Wrapper\map\LSU3D`.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**2. Every SLiVR commit is path-scoped. [D012]** Inspect each commit being evaluated. Every changed path must begin with `SLiVR/` from the repository root; no unrelated staged or outgoing commit is included.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**3. Source comments are concise and professional. [D012]** Sample changed modules. Comments explain intent, constraints, units, coordinate frames or provider behavior without restating code, narrating implementation or containing automated-authorship references.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**4. The first prototype remains static/no-build. [D004]** Confirm it runs as static HTML, CSS and JavaScript ES modules and does not require Vite, TypeScript, React or a framework-specific development server to function.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**5. Public output uses an allowlist.** Inspect the built/deployed artifact. It must exclude `docs/`, the paper, book, planning references, `research` working records unless deliberately published, credentials, local exports, test data containing private content and user workspace files.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**6. No LSU identity remains.** Search rendered UI, metadata, icons, manifests, catalog and routes for LSU/Baton Rouge recruitment language, LSU coordinates, LSU branding and obsolete campus content. Necessary references in provenance/development documentation are excluded from this visual/product check.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**7. Credentials are external.** Confirm no Google, Treedis, Cloudflare or other token/secret is committed, rendered into public files, printed in exports or written to research logs. Missing optional credentials must produce a supported fallback.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**8. SLiVR storage and cache names are isolated.** IndexedDB database names, local/session-storage keys, cache names and service-worker scope belong to SLiVR. No code enumerates and deletes every registration/cache on the shared origin.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**9. Unknown facts remain unknown.** Inspect catalog rendering, comparisons and exports. `Need validation` and `Information has not been found` must never become available, approved, no restriction, owner confirmed or another favorable claim.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**10. Deferred features did not enter the prototype accidentally.** Confirm Phases 0–5 contain only the approved five feature families and their required foundations. Phase 6 research service and Phases 7–9 product features remain dormant/unimplemented unless a later approved work package explicitly activates them.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part B — Phase 0: foundation and feasibility

## Catalog, schemas and application shell

**11. The catalog contains exactly 17 stable records. [F01/F02]** Confirm 11 records have current Treedis inventory entries and six are future candidates. IDs remain stable across reload and JSON/catalog regeneration.

Result: - [x] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: Automated. `node --test` from the project root, 82 tests passing, Node v24.18.0, build digest `89aae7a86236`. Suite `tests/catalog.test.mjs`, tests "the catalog holds exactly 17 locations, 11 current and 6 future", "location identifiers are the documented stable sequence" and "regenerating the catalog produces identical records".  
Comments: Catalog 1.0.0 holds 17 locations (11 current, 6 future), 17 captures, 17 scout-detail records, 6 areas and 42 sources. Identifiers are LOC-001..LOC-017, CAP-001..CAP-017 and AREA-01..AREA-06. Rebuilding from the workbook produced byte-identical output for all six files apart from the manifest `generatedAt` stamp, and the suite re-reads the JSON from disk on every run. Browser reload is not covered here because no application shell exists yet; it is retested against test 14 once the shell is built.

**12. All six operational areas reconcile with the workbook.** Counts, names and location membership match the approved database; the solar-energy destination is absent from the committed 17.

Result: - [x] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: Automated. Same run as test 11. Suite `tests/catalog.test.mjs`, tests "area membership reconciles with the workbook counts" and "the solar-energy destination is absent from the committed inventory"; plus `node tools/validate-catalog.mjs`, 0 errors and 1 warning.  
Comments: All six areas reconcile: AREA-01 Downtown Core 7/0, AREA-02 Sterling Grove / North Sterling 1/0, AREA-03 Johnston Street / Moncus / Blackham 2/1, AREA-04 Northside / Clara Street 1/0, AREA-05 Cajundome / South Campus 0/4, AREA-06 UL Main Campus 0/1, totalling 11 current and 6 future. Derived membership matches each area's declared `locationIds` and the counts recorded in the workbook. No record mentioning the solar-energy destination is present. The single warning is benign and expected: CAP-003 records the location as "Lafayette Old City Hall" while LOC-003 is named "Lafayette Old City Hall / Bank of Lafayette".

**13. Catalog validation rejects structural errors.** Exercise missing IDs, duplicate IDs, invalid coordinates, invalid capture states, malformed evidence status and broken experience references. The app reports actionable errors and does not load a partially corrupted catalog silently.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Partial automated evidence only. Suite `tests/catalog.test.mjs` covers 13 rejection cases: missing ID, duplicate ID, unknown area reference, unknown source reference, out-of-envelope coordinate, swapped [lat, lon] pair, invalid capture status, invalid source availability state, fabricated tour on a future candidate, capture state disagreeing with its location, experience outside the region allowlist, area membership drifting from the workbook, manifest count mismatch, coerced unknown vocabulary and an absolute local path reaching published data.  
Comments: The validation half is implemented and exercised: `tools/validate-catalog.mjs` reports every problem positionally and exits non-zero. The second half of this test — that the application reports actionable errors and does not silently load a partially corrupted catalog — cannot be executed because the catalog repository and application shell are not built yet. Retest when `src/data/catalog-repo.js` and the shell land in Phase 0.2.

**14. Stable routes open directly.** Load `/explore`, one `/location/{id}`, one `/immersive/{id}`, one project/scene route and one shot route from a fresh tab. Supported routes restore context; invalid IDs produce a recoverable not-found state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**15. The application shell exposes the four approved modes.** Explore, Projects, Immersive and Shot Designer occupy a consistent top-level control, show active state and preserve the active breadcrumb/save status.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## IndexedDB and JSON foundation

**16. IndexedDB creates only the documented database, stores and indexes. [D005]** Confirm schema version, upgrade path and indexes match the approved domain records and do not create data outside the SLiVR namespace.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**17. A basic project round-trips through IndexedDB.** Create, save, reload and reopen a fixture containing project, scene, candidate, bookmark, shot scene, object and shot references. IDs and relationships are identical.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**18. Versioned JSON round-trips without loss.** Export the fixture, inspect version/units/coordinate frames/references, import into a clean profile and compare normalized records.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**19. Malformed and unsupported JSON never mutates saved data.** Test invalid JSON, missing required fields, duplicate references and future schema version. Validation occurs before writes and reports the failing path/reason.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**20. ID conflicts have an explicit outcome.** Import a project whose ID already exists. Confirm cancel changes nothing, add-as-copy creates new stable IDs/references, and deliberate replace replaces only the selected project.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**21. Storage failure preserves recoverable work.** Force a quota/write/transaction failure. The current workspace stays open, shows Save failed, supports retry and produces valid emergency JSON from memory.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Provider feasibility

**22. DOTD 2025 primary imagery returns real Lafayette pixels. [D006]** Test representative points in all six operational areas. Validate image content, not only HTTP 200, and record endpoint, date, response and visual evidence.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**23. DOTD 2024 Lafayette fallback activates on primary failure.** Block/disable the primary service and confirm equivalent representative areas remain visible with the fallback year/source identified.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**24. Imagery attribution and accuracy limits are visible.** Confirm DOTD source/year attribution and the statement that imagery is contextual rather than authoritative measurement/navigation/property evidence.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**25. Layer 187 is not the configured Lafayette primary.** Inspect configuration and rendered requests. If exposed for diagnostics, it must not silently replace the approved source after an all-black/no-data response.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**26. Optional Google 3D fails without blocking the workspace. [D008]** Test missing key, denied request, slow response and disabled configuration. Aerial/plan/simple Three.js views, editing, saving and export remain available.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**27. Minimal Three.js scene proves transforms and optics.** Place a camera, actor and frustum; verify zero rotation, translation, height, unit conversion and at least one independently calculated FOV fixture.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Partial automated evidence only. Suites `tests/optics.test.mjs` (15 assertions) and `tests/frames.test.mjs` (11 assertions) in the same run. Field-of-view fixtures: a 36.0 x 24.0 mm gate at 50 mm gives H 39.5978 deg, V 26.9915 deg, D 46.7930 deg; a Super 35 24.89 x 18.66 mm gate at 35 mm gives H 39.1479 deg, V 29.8526 deg. Each angle is additionally checked against the independent relation tan(fov/2) = gate/(2 x focal) to 1e-12.  
Comments: Transforms, optics and unit conversion are proven in isolation: the scene origin maps to exactly zero, local-to-geographic round trips agree to 1e-6 m, a known 100 m offset measures 100 m to within 0.4 m against the geographic distance model, zero and full-turn rotations are stable, a north offset of 90 degrees places a due-north point at x = -100, heights above floor and above ground stay separated, and zero or negative gate and focal values are rejected with a reason. This test also requires a rendered Three.js scene placing a camera, an actor and a frustum, which is not built yet. Retest when the Phase 0 provider spike lands.

**28. Treedis capability reconnaissance covers all supplied entries. [F03/F19]** Record availability, authorization, ready/navigation messages, sweep support, view/pose availability, capture metadata and failure behavior for the shared downtown entries and five independent experiences without assuming unsupported APIs.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**29. The shared downtown model proves distinct entry navigation.** Navigate to at least two supplied downtown sweep/entry targets and show that catalog identity remains distinct even though the experience ID is shared.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**30. Phase 0 research records and test traceability are complete. [D013]** Every approved feature has a research entry; material decisions, validation failures, provider capability and limitations are recorded; Phase 0 implementation/tests link back to feature and test IDs.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part C — Phase 1: Location Atlas and Dossiers

**31. Explore opens on the approved Lafayette envelope. [F01]** The initial view contains the working inventory without presenting the padded region as a legal/property/capture boundary.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**32. Map and list contain all 17 records exactly once.** Clustering may change marker presentation, but result counts and accessible list entries remain correct.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**33. Current capture and future candidate have distinct treatments.** Check markers, list rows and dossiers. Research completeness appears separately and never overwrites capture status.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**34. Selection is synchronized.** Select from map, list and direct location route. The same location is highlighted, scrolled/focused appropriately and opened in the dossier without feedback loops.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**35. Search covers approved fields.** Verify name, address, operational area, venue type and representative visual/practical tags, including case/spacing tolerance and zero-result behavior.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**36. Filters combine deterministically.** Exercise area, capture, interior/exterior, venue type, historic/contemporary, known public hours, immersive coverage, access, validation and completeness individually and in combinations; counts/map/list agree.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**37. Sorting is stable and correctly labelled.** Test name, area, capture availability and recently viewed. If user-location distance exists, it is straight-line distance and never travel time.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**38. Clusters expand without losing selection/filter state.** Zoom out/in, open a cluster and use browser history. The selected record and result set remain consistent.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**39. Every dossier has the approved sections. [F02]** Overview, visual/spatial character, immersive coverage, production considerations, access information, evidence/source details and project actions are present or show an explicit missing state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**40. Evidence status is understandable.** A reviewer can distinguish source, observation date/method, approximate coordinate, reported/public information, remote observation, on-site verification and missing/unvalidated facts.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**41. Operator, owner, filming authority and contact remain separate.** Inspect representative public, university, municipal and unclear records. No label implies ownership or booking authority incorrectly.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**42. Public hours do not imply production availability.** Locations with hours show an explicit distinction and unknown availability remains unknown.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**43. Future candidates never receive fabricated immersive actions.** Each of the six shows future/no-current-capture state and recovery/next-step text rather than an invented tour or sweep.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**44. Dossier project actions carry stable IDs.** Add/compare candidate, open existing candidate, enter Immersive, create/open shot design and copy public location link all target the intended location/context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**45. Catalog data remains read-only.** Attempt project note/rating changes and JSON import. Master catalog facts and evidence are unchanged; project overlays remain separately stored.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**46. Map/WebGL failure leaves a usable list and dossier.** Force map initialization failure or WebGL loss. Search, results, dossier and relevant project actions remain keyboard-operable.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**47. Imagery failure uses a neutral recoverable state.** Block both DOTD services. No endless spinner or misleading stale imagery appears; markers/list/dossier remain usable and a retry/status message is available.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**48. No-result search can recover.** Apply an impossible combination. The UI explains zero matches and can clear filters without reload or lost mode context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**49. Location links round-trip.** Copy links for one current and one future location, open each in a fresh tab and confirm exact selection, dossier and fallback behavior.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part D — Phase 2: Immersive Scout

**50. Immersive opens the selected current capture. [F03]** From a dossier, open Carpe Diem and confirm active catalog location, experience, entry/sweep and breadcrumb agree.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**51. Six downtown records remain distinct inside the shared experience.** Enter each supplied downtown location and verify location-specific name, address, entry and notes without unnecessary iframe reload where supported.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**52. Switching to Magnolia loads the independent experience cleanly.** The previous session cannot emit a late event that changes the new location, sweep, caption or readiness state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**53. A non-downtown independent experience works.** Test at least Moncus Park, Play N Trade, Givens House or the former Truman site and record any capability differences rather than hiding them.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**54. Lifecycle states are explicit and reachable.** Verify not loaded, loading, ready, navigating, unavailable, unauthorized, timed out and failed through real behavior or deterministic test doubles.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**55. Message validation rejects untrusted input. [D007]** Wrong origin, wrong source window, unknown type, malformed payload, wrong active generation and stale session events do not change state or execute navigation.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**56. Zero-valued pose fields survive validation.** A valid x/y/rotation value of zero is retained rather than treated as missing/falsy.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**57. Rapid switching cannot create a race.** Switch among at least three locations before each finishes loading. Only the final selection can become active; abandoned frames/timers/listeners are disposed.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**58. Timeout and retry recover.** Simulate a hung provider, wait for the documented timeout, retry and then return to Explore. No endless spinner, duplicate frame or orphan loading state remains.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**59. Unauthorized and unavailable are different.** A denied current capture and a future/no-capture location show correct, non-misleading states and next actions.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**60. Supported view bookmark saves complete context. [F04]** Save location, experience/capture, sweep/entry, supported orientation/view fields, name, note, date and schema/provider version.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**61. Bookmark restore reaches the intended view when supported.** Restore after leaving Immersive and after a full reload. The associated project/location context remains intact.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**62. Unsupported/retired bookmark restore explains the limitation.** Alter/remove a sweep or capability in a fixture. The app preserves the bookmark, identifies the unavailable part and offers the nearest safe recovery without silently redirecting.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**63. Capture metadata and coverage warnings remain visible.** Users can see known date/version/coverage and unknown values without implying that unseen rooms or current conditions were inspected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**64. Returning to Explore restores map context.** Center, zoom, filters, selection and dossier state survive the round trip.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**65. Leaving Immersive releases resources.** Verify frame/session/listener/timer disposal or suspension according to the adapter contract; repeated opens do not grow iframe, listener or animation-loop counts.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**66. Keyboard and focus behavior is usable around the iframe.** Enter/exit full screen or viewer focus, reach side-panel controls, escape/return, and avoid trapping keyboard users inside an inaccessible overlay.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**67. Treedis failure does not damage project or shot data.** With an active project and design, force viewer failure, return to other modes, reload and confirm local records are unchanged.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part E — Phase 3: Project Workspace

**68. A project can be created with required metadata. [F05]** Name, production type, description, status, `America/Chicago` time zone, stable ID and timestamps save and reopen correctly.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**69. Multiple scene requirements remain independent.** Add, rename, reorder and remove scene requirements; candidates and shots linked to one scene do not move to another silently.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**70. A scene brief preserves explicit requirements and unknowns.** Populate creative, spatial, access and practical criteria. Blank/unknown values do not become passes or zero-cost assumptions.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**71. Locations become project candidates without duplicating catalog facts.** Add the same location from Atlas and Dossier. One candidate relationship exists; catalog source fields remain referenced/read-only.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**72. Candidate statuses cover the approved workflow. [F06]** Apply strong fit, acceptable, concern, fails requirement and unknown to representative criteria. Unknown is visually and computationally distinct from favorable ratings.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**73. Side-by-side comparison shows at least three candidates.** Required criteria, evidence, unknowns and notes align by row without losing location identity or hiding overflow on supported desktop/tablet layouts.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**74. Comparison updates from either surface.** Change a rating/note in candidate detail and comparison, then confirm the same underlying record updates once without feedback loops or stale duplicates.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**75. Preferred and backup choices are independent and explainable.** Select one preferred and at least one backup, record rationale and reopen it. Changing preferred does not delete the previous candidate or evidence.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**76. Decision can be reopened without history loss.** Reopen a previously decided scene, revise one criterion and choose again. Timestamps/revisions make the change understandable.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**77. Candidate-to-Immersive context is exact.** From comparison, open a current candidate in Treedis and return. The same project, scene, candidate and comparison position remain active.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**78. Candidate-to-Shot Designer relationship is exact.** Create a design for one candidate, return and reopen it. Project → Scene → Candidate → Shot Scene references survive reload/export/import.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**79. Bookmarks attach without copying provider data incorrectly.** Link an Immersive bookmark to a candidate/scene. Updating the bookmark label/note does not rewrite capture identity or catalog metadata.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**80. Autosave state is visible and ordered.** Observe Saving, Saved locally and Save failed through edits and rapid changes. An older completion cannot overwrite a newer revision.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**81. Reload restores the exact project workspace.** Browser reload while comparing candidates restores active project/scene/candidate, saved decision and stable relationships without claiming unsaved failed writes succeeded.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**82. Full project JSON preserves the workspace.** Export/import a project with multiple scenes, candidates, decisions, bookmarks and a linked shot scene. Compare normalized records and catalog/capture-version references.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**83. Sensitive operational documents cannot be added accidentally.** Confirm the prototype has no fields/uploads for contracts, insurance, access codes, private contacts or confidential production files and exports contain none.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**84. Deleting a project is explicit and referentially safe.** Cancel leaves everything; confirm removes only that project-owned data, reports linked records and never deletes the master location catalog or unrelated project.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part F — Phase 4: Shot Designer Core

## Scene, objects and editing

**85. A shot scene opens in synchronized 2D and 3D. [F08]** Both views use the same scene model, selection and coordinate frame; edits in one appear once in the other.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**86. All approved background modes work.** Test DOTD aerial, optional Google 3D context, imported floor-plan/reference image and blank grid. Switching background does not delete authored objects.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**87. All approved object types can be created.** Camera, actor/stand-in, vehicle, generic prop, position mark, direction arrow, annotation and simple wall/set boundary appear in scene tree and both applicable views.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**88. Object selection is unambiguous.** Select from canvas and scene tree, cycle overlapping objects, deselect and confirm inspector/visual highlight/object ID agree.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**89. Move and rotate work by drag and numeric fields.** Values, units, zero/negative coordinates and transforms remain consistent in 2D/3D and after save/reload.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**90. Duplicate, group and delete preserve intended identity.** Copies receive new stable IDs, groups transform predictably and deletion removes or warns about linked shots/paths without orphan references.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**91. Grid and snap are optional and deterministic.** Toggle each, change interval where supported and verify numeric values match the displayed snapped position/rotation.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**92. Undo/redo covers meaningful commands.** Create, transform, duplicate, group, path edit and delete; undo to the initial state and redo to the final state without changing unrelated objects.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**93. Undo history and autosave cannot corrupt each other.** Edit rapidly around an autosave boundary, undo/redo, reload and verify the last visibly saved revision—not an intermediate command—is restored.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Camera, lens and framing

**94. Camera properties persist. [F09]** Name/color, position/height, pan/tilt/roll, focal length, sensor/gate and aspect reload and export with explicit units.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**95. Horizontal FOV matches an independent known fixture.** Use `2*atan(sensor width/(2*focal length))` after the effective gate/crop and compare within the documented tolerance.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**96. Vertical FOV and aspect/gate behavior are correct.** Change sensor/gate and aspect; verify expected axes and that invalid zero/negative values are rejected clearly.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**97. Coverage cone and 3D frustum describe the same camera.** Position, orientation and near/far display update together and never imply distortion, depth of field or surveyed occlusion.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**98. Camera zero rotations and full-turn boundaries are stable.** Exercise zero, positive/negative angles and normalized wrap behavior without sudden axis flips or NaN transforms.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**99. Provider failure cannot remove authored camera state. [D008]** Disable Google 3D/DOTD after positioning cameras. Continue editing, save/reload and export the same authored scene against blank/local context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Blocking, paths, shots and variants

**100. Actor and camera start/end marks are independent. [F10]** Create multiple actors and two cameras; editing one path/mark does not move another unless explicitly grouped.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**101. Straight and curved movement paths edit predictably.** Add/move control points, reverse or delete a segment and verify arrows/start/end remain clear in plan view and saved data.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**102. Basic preview is deterministic.** Play, pause, scrub/restart the approved simple movement preview several times. Identical inputs produce the same positions/timing and reduced-motion handling is respected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**103. Marks, arrows and annotations remain legible.** Numbered marks and direction indicators survive zoom, 2D/3D switching, save/reload and diagram export.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**104. Shot list and diagram share one record. [F11]** Editing shot number, camera, shot type, lens/aspect or description through either surface updates once and retains the linked arrangement.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**105. Shot order changes without changing story/scene identity.** Reorder and duplicate shots; stable IDs, camera assignments and arrangement links remain correct.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**106. Named variants do not overwrite one another.** Create A/B variants, change camera/blocking, switch/restore and reload. Each retains its own intended scene revision and identifies the active variant.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Floor plans and accuracy

**107. An owned reference image imports without silent transformation. [F12]** Record source/provenance, original dimensions and initial uncalibrated/schematic status.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**108. Known-distance calibration is mathematically stable.** Set two control points and a known metric/imperial distance; verify scale/unit conversion and independent check distance before and after save/reload.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**109. Background alignment persists.** Rotate, translate and set north/origin; reopen/export/import and confirm transform, frame/version and calibration status remain intact.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**110. Accuracy labels prevent false precision.** Schematic, approximately aligned and measured/calibrated states are visible in workspace and exports, with source/date/error where available.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**111. Recalibration does not silently rewrite approved shots.** Change calibration after saving a variant/reviewed state. Original frame/version stays traceable and migration requires an explicit user action.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**112. The supplied downtown reference scenario can be recreated.** Build at least cameras A/B, actors/marks and paths over appropriate owned/approximate context; save, reload, variant, preview and export without claiming the image is measured/georeferenced.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part G — Phase 5: integrated prototype and release validation

## End-to-end workflow and routing

**113. Complete the primary workflow without data loss.** Discover → dossier → Immersive → project candidate → compare → preferred/backup → Shot Designer → save/reload/variant → exports.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**114. Mode switches preserve the active context.** Exercise all four modes from an active project/scene/candidate/location/shot scene and confirm breadcrumb, selection and return actions remain correct.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**115. Browser Back/Forward follows real history.** Traverse Explore → location → Immersive → project/scene → shot and walk backward/forward. No duplicate loops, stale provider events or lost saved context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**116. Save-before-transition behaves correctly.** With pending edits, change mode. Successful save transitions; failed save keeps the workspace open and offers retry/emergency JSON.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Approved export set

**117. Full project JSON is complete and portable.** It includes required project/scene/candidate/decision/bookmark/shot/variant/background references and versions but embeds no provider imagery or sensitive reference documents.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**118. PNG shot diagram is readable at target resolution.** Verify intended view, title block, project/scene/location/shot, camera/lens/aspect, date/revision, units/calibration, meaningful north arrow and required attribution.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**119. Shot-list CSV opens cleanly in spreadsheet software.** Headers, encoding, quoting/newlines, units, IDs and required fields are correct; formula-like user text cannot become an unsafe spreadsheet formula without explicit handling.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**120. Print-ready HTML produces a usable PDF.** Use browser print preview/Save as PDF. Selected sections, diagrams, page breaks, evidence/calibration/provider notes, date and revision are legible; interactive-only controls are hidden.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**121. Export filenames are predictable and safe.** Project/scene/shot/date/revision appear where applicable; illegal/reserved characters and excessive length are sanitized without collisions in the tested set.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**122. Emergency JSON works with persistence unavailable.** Force IndexedDB failure after valid in-memory edits and confirm the downloaded file imports successfully into a clean profile.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Accessibility, layout and failure recovery

**123. Desktop layout supports the complete workflow.** At the approved desktop viewport, panels/canvas/timeline do not overlap or hide required controls; resizing does not lose state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**124. Tablet layout supports browsing and approved editing.** Side panels collapse/reopen, touch targets are usable and no precision phone-editor claim appears. Test the approved representative tablet/browser.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**125. Keyboard-only core tasks are possible.** Navigate modes, search/filter/open dossier, manage candidates, edit camera numerically, save and export with visible focus and logical order.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**126. Labels, contrast and status do not rely only on color.** Check evidence/capture/save/error/selection states, controls, diagrams and focus under normal and high-contrast expectations.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**127. Reduced motion is respected.** Disable or simplify nonessential animation and deterministic path preview according to the design without hiding state changes.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**128. Slow/offline/provider-loss states recover.** Exercise slow network, DOTD loss, Google loss, Treedis loss, WebGL loss and denied geolocation where present. Each has bounded feedback and a usable fallback/return path.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**129. Long/repeated sessions do not leak rendering resources.** Repeatedly open/close/switch map, Immersive and Shot Designer while inspecting iframe/canvas/context/listener/timer counts and memory trend.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**130. Deployment contains only approved files and routes.** Fetch representative public files plus prohibited planning/reference paths. Prohibited files must be absent rather than merely unlinked.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**131. Service worker/cache isolation survives deployment and update.** Install/update/uninstall SLiVR as applicable; LSU3D/neighboring registrations/caches remain untouched and an old SLiVR shell cannot silently serve incompatible data schemas.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**132. Console and network are clean for the complete acceptance path.** No uncaught errors, repeated failed requests, mixed content, leaked credentials, missing assets or unhandled promise rejections; expected provider failures are classified and explained.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part H — Research traceability and evaluation readiness

These checks validate research documentation and evidence handling. They do not establish human-participant findings.

**133. Feature register matches the tested build. [D013]** F01–F21 status, phase, actual interaction, modules, evidence level and known limitations agree with implementation; unimplemented features are not labelled implemented or validated.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**134. Material decisions are append-only and traceable.** New/revised choices include alternatives, rationale, consequences and validation state; superseded decisions link rather than erase history.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**135. Research changelog identifies behavior-affecting changes.** Artifact/build, date, affected feature/decision IDs, evidence, measurement/data impact and limitation are present for each phase release.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**136. Measurement definitions are operational and versioned.** Units, start/stop rules, missing/failure handling, derivations, questionnaire version/timing where applicable and changed definitions are explicit before any observation is analysed.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**137. Design rationale, technical evidence and participant evidence are separated.** Search UI, documentation and research records for expected benefits stated as results. Each claim has the correct evidence level and link.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**138. Negative, failed and null evidence is retained.** Provider failures, rejected hypotheses, failed usability paths and unsupported capabilities appear in changelog/limitations instead of being omitted from the final narrative.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**139. Participant logging is absent/off in Phases 0–5.** Network, storage and code/config inspection show no default background research telemetry, participant/session trajectory capture or undeclared third-party analytics.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**140. Reproducibility context can be reconstructed.** A reviewer can identify exact artifact, catalog/capture/schema/provider, browser/device, fixture, test method and evidence for every phase-exit result.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part I — Phase 6: Treedis Research Mode (post-prototype)

Do not run this part with participants until provider/content-owner authorization and the applicable institutional ethics/security approvals are documented. Begin with synthetic fixtures and researcher-only compatibility sessions. Record-only and manipulation are separate gates.

## Authorization, launch and consent

**141. Authorization evidence is current and scoped. [F21/D014]** Record Treedis/content-owner permission for the exact proxy/injection/capture behavior, approved experiences, study window and whether manipulation is included. Unsupported use is BLOCKED, not silently assumed.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**142. Study/ethics/security approval matches implementation.** Protocol, consent, collected fields, infrastructure, retention, withdrawal/deletion and manipulation disclosure align with the reviewed deployment and versions.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**143. Public/off mode contacts no research service.** With normal configuration and ordinary URLs, iframe origin is the approved direct Treedis URL and network/storage show zero probe, launch, ingest or research-service requests.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**144. A URL flag alone cannot start recording.** Try study/condition query parameters without a valid signed launch and consent. The request fails closed to direct/non-recording behavior without exposing protocol or storage details.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**145. Signed launches are scoped, expiring and replay-controlled.** Valid launch works only for its protocol/build/mode/condition/expiry; altered, expired, wrong-origin and replayed launches do not activate collection.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**146. Consent occurs before proxy/probe collection.** Inspect network and event storage before acceptance. Decline uses the direct tour and creates no research event; accept activates only the disclosed study/mode.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**147. Consent is study/session scoped.** Starting a different protocol, expired session, fresh test profile or withdrawal does not reuse stale consent silently.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**148. Study state and stop/withdraw control are visible and usable.** A participant can identify recording status and invoke the approved stop/withdraw path without navigating undocumented developer controls.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Proxy and passive probe

**149. The proxy is not open.** Only allowlisted Treedis upstream hosts, paths and methods are reachable. Arbitrary external hosts, traversal, unexpected redirects and server-side request targets are rejected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**150. Proxied tour differences are declared and bounded.** Compare direct and authorized proxied responses/behavior. Only approved origin/header/injected-bundle differences occur; navigation, resources, hotspots and ordinary Treedis use remain equivalent.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**151. Exactly one versioned research bundle is injected.** Eligible HTML has one bundle with manifest/hash; non-HTML, errors, redirected/unapproved content and public/direct sessions are not injected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**152. Original WebXR call contract is preserved.** In a test harness, `requestSession`, frame callbacks, arguments, returned promises/results, exceptions and callback order match the no-probe baseline apart from declared observation overhead.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**153. One frame loop serves capture and approved controller work.** No second animation loop or duplicate wrapper accumulates across XR sessions, tour reloads or mode changes.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**154. Passive schema captures only approved event families.** Verify lifecycle/capabilities, viewer pose, controller grip/target ray, approved input, optional hand joints, safe-listed Treedis context, task markers and quality diagnostics against the protocol manifest.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**155. Head direction is never labelled eye gaze or attention.** Schema, UI, analysis and exports use head/HMD pose or head-direction proxy and preserve reference space/units/sample configuration.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**156. Treedis messages are safe-listed and minimized.** Unrecognized origins/types/payload fields, DOM text and unrestricted message contents are neither trusted nor stored.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**157. Sampling overhead and frame cadence meet the protocol threshold.** Compare baseline and record-only sessions on every approved device/runtime; report distribution, sampling rate, dropped events and uncertainty rather than only one average.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**158. Kill switch is tested.** Artificially exceed the approved sampling-cost rule. High-rate sampling stops, the reason/cost is logged, minimal lifecycle behavior remains as approved and Treedis continues functioning.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**159. Collector loss cannot break the tour.** Block ingest, force 4xx/5xx, timeout and storage failure. Treedis navigation/XR continue; bounded buffers do not grow indefinitely; loss/failure is measurable without leaking data to another endpoint.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Collector, storage and analysis

**160. Ingest enforces authorization and bounds.** Wrong origin/token/protocol, invalid content type/schema/event/numeric range, oversized batch/session and excessive request rate are rejected and auditable without becoming a reflection/open-storage service.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**161. Raw batches are immutable, private and collision-safe.** Concurrent batches cannot overwrite each other; public listing/read is denied; least-privilege roles and infrastructure logs are documented.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**162. Session manifest supports reproducibility.** Protocol/consent, SLiVR/proxy/probe/schema, experience/entry/capture, device/runtime/reference space, condition, sampling and time-anchor versions are present without direct identity.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**163. Batch reconstruction reports gaps and duplicates.** Use synthetic out-of-order, duplicate, missing and malformed batches. Analysis produces deterministic order plus an explicit quality report and never silently discards rows.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**164. Derived measures reproduce from frozen raw input.** Run the declared transformation twice and compare output/checksum, exclusions and version. Coordinate transforms require recorded reference/calibration.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**165. Retention and deletion work end to end.** Test lifecycle expiry and protocol-controlled participant/session deletion lookup across raw, derived, consent/launch and backups/logs according to the approved policy.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Optional manipulation gate

**166. Record-only mode installs no manipulation hooks.** With manipulation disabled or no condition, compare DOM/runtime hooks/frame work and visible experience against passive baseline.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**167. Inventory mode changes no stimulus.** Researcher-only authorized inventory records bounded handle/selector/capability metadata without visible changes, unrestricted DOM text or fabricated IDs.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**168. Condition assignment is versioned and counterbalance-ready.** The session records condition/version/assignment source before triggers while keeping recruitment identity separate.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**169. A real condition changes only named stimuli.** Verify ready/time/zone/head-direction/input triggers used by the approved condition; every operation logs target/action/result/failure and unrelated navigation/objects remain unchanged.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**170. Missing target and controller failure are fail-safe.** Use nonexistent and changed handles plus forced controller error. The operation logs failure, stops or rolls back as designed and the tour continues.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**171. Two-level rollback is complete.** Disable manipulation to return to record-only without controller residue; disable the research service to return to direct public behavior with no recording, injection or changed content.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part J — Standing regression sweep

Run this after every material change and as the final pass for each phase. Tests may link to detailed evidence above, but record the current build's result here.

**172. Application boots and the four-mode shell is usable.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**173. All 17 locations and six areas reconcile.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**174. Search/filter/select/open dossier works from map and list.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**175. One shared downtown entry and one independent Treedis experience open and switch correctly.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**176. Project scene/candidate comparison, preferred and backup persist.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**177. Shot scene edit, camera FOV, path, variant, undo and reload work.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**178. JSON, PNG, CSV and print/PDF exports are valid and legible.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**179. Browser history and cross-mode context remain correct.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**180. Desktop/tablet, keyboard, focus, contrast and reduced-motion checks pass for affected surfaces.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**181. DOTD/Treedis/Google/WebGL/IndexedDB failure paths recover without data loss.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**182. Public deployment excludes private references/credentials and does not disturb neighboring apps.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**183. Console/network are clean and research telemetry is off during ordinary prototype use.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

## When you are done

Report:

1. Build, environment, catalog/schema/provider versions and sections executed.
2. Passed, failed, blocked and not-tested counts.
3. Every failure by test number with actual versus expected behavior and evidence.
4. Every blocked test with owner/dependency and a specific retest condition.
5. Automated evidence separately from live browser/device evidence.
6. Data-loss, privacy, security, incorrect-evidence or research-integrity failures first.
7. Tests added/changed during the phase and why.
8. Required regression set after fixes.

Do not mark the phase complete while a required exit-gate test is failed, silently untested or blocked without an approved exception. Do not repair unobserved behavior speculatively and then mark the original test passed; run it and record fresh evidence.

---

## Execution log

One entry per recorded execution, newest first. The "Before you start" target table always describes the most recent entry.

### 2026-09-19 — Phase 0.1, automated only

| Field | Value |
|---|---|
| Build | Uncommitted working tree; publishable-tree sha256 digest `89aae7a86236` over 40 files |
| Environment | Windows 11, Node.js v24.18.0, no browser, offline |
| Catalog/schema | Catalog 1.0.0, record schema 1.0.0, research snapshot 2026-09-19 |
| Command | `node --test` from the project root; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | Part B, tests 11, 12, 13 and 27 only |

Results: 2 PASS (11, 12), 0 FAIL, 0 BLOCKED, 2 NOT TESTED with partial evidence recorded (13, 27). Every other test remains unexecuted.

Automated evidence: 82 assertions passing across `tests/units.test.mjs`, `tests/optics.test.mjs`, `tests/frames.test.mjs`, `tests/schema.test.mjs`, `tests/catalog.test.mjs` and `tests/deploy-scope.test.mjs`. `tools/validate-catalog.mjs` reported 0 errors and 1 warning. `tools/check-deploy-scope.mjs` reported 0 errors across 39 publishable files.

Live browser, device and provider evidence: none. No DOTD, Treedis, Google or WebGL request was made in this run, so tests 22 to 26 and 28 to 29 remain entirely unexecuted and no provider capability is claimed.

Tests not yet marked, and why:

- **13** — the validator half is implemented and exercised against 13 rejection cases. The application-load half needs the catalog repository and shell from Phase 0.2.
- **27** — optics and transform fixtures pass in isolation. The rendered Three.js camera, actor and frustum scene is not built.

Notes carried forward:

- The one warning from catalog validation is expected and benign: CAP-003 names the location "Lafayette Old City Hall" while LOC-003 is "Lafayette Old City Hall / Bank of Lafayette".
- `docs/` is excluded from version control so private reference material cannot be published from this repository. This document is the single deliberate exception, so its execution history is preserved in source history (decision D020). `tools/check-deploy-scope.mjs` names that exception, still rejects everything else under `docs/`, and fails if the exception ever stops being published. Test 5 is therefore read as: the deployed artifact excludes `docs/` apart from this verification record.
