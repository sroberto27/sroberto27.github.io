# Feature and evidence register

Status values: `Approved prototype`, `Later`, `Implemented`, `Validated technically`, `Evaluated with participants`, `Revised`, or `Retired`. A feature may receive the last three statuses only when linked evidence exists.

| ID | Feature | Phase/status | Workflow problem and interaction | Research rationale or hypothesis | Candidate observations/measures | Initial provenance | Known limitation or confound |
|---|---|---|---|---|---|---|---|
| F01 | Location Atlas | Phase 1 · Approved prototype | Search/filter 17 locations through synchronized map and list | Geographic overview may reduce discovery effort and support comparison | Task success/time; filter actions; locations inspected; selection errors; recovery after map failure | `USER`, `BOOK`, `LSU3D`, `INVENTORY` | Results depend on catalog quality and local familiarity |
| F02 | Location Dossiers | Phase 1 · Approved prototype | Review visual, spatial, access, practical and provenance fields | Structured evidence and visible unknowns may improve assessment completeness and confidence calibration | Fields consulted; unresolved items identified; assessment completeness; unsupported assumptions; confidence/correctness gap | `USER`, `BOOK`, `PAPER`, `INVENTORY` | Workbook facts are incomplete and are not permission or availability evidence |
| F03 | Immersive Scout | Phase 2 · Approved prototype | Inspect supplied Treedis viewpoints while retaining map/location context | Photographic immersion may improve remote spatial understanding and early screening | Viewpoints visited; orientation task; spatial-recall accuracy; overlooked areas; task time; confidence; discomfort | `USER`, `PAPER`, `INVENTORY` | Capture age, coverage, viewpoint constraints and novelty can confound outcomes |
| F04 | View Bookmarks and Notes | Phase 2 basic · Approved prototype | Save and restore a relevant viewpoint with contextual notes | Externalized spatial evidence may improve recall and communication | Bookmark creation/restoration success; revisit time; note-reference accuracy; failed restores | `PAPER`, `USER` | Provider may not expose sufficient pose information for exact restoration |
| F05 | Scene Requirements | Phase 3 · Approved prototype | Translate a scene brief into explicit scouting criteria | Explicit criteria may reduce omission and separate needs from location impressions | Requirement completeness; edit count; missing criteria; time to prepare evaluation | `BOOK`, `USER` | Quality depends on participant expertise and task brief realism |
| F06 | Candidate Comparison and Backups | Phase 3 · Approved prototype | Compare candidates, preserve unknowns and record preferred/backup rationale | Side-by-side evidence may improve traceability and reduce premature commitment | Candidates compared; unknowns preserved; rationale completeness; decision changes; confidence calibration | `BOOK`, `USER` | No prototype scoring formula; expert judgment remains central |
| F07 | Scout Visit Planner | Phase 7 · Later | Organize visits, entrances, timing and questions | Deferred pending validation of the core remote workflow | To be operationalized before Phase 7 | `BOOK`, `LSU3D` | Routing and field constraints are outside the prototype |
| F08 | Shot Workspace | Phase 4 · Approved prototype | Arrange a shot in synchronized overhead 2D and perspective 3D | Linking location context to editable blocking may improve feasibility reasoning | Scene completion; transform errors; mode-switch count; layout revisions; expert rubric | `USER`, `SHOT` | Simplified geometry cannot prove physical clearance or final cinematography |
| F09 | Camera, Lens and Framing | Phase 4 core · Approved prototype | Edit camera pose, sensor/gate and focal length with FOV cone/frustum | Visible optics may support shared framing decisions and expose spatial conflicts | Correct lens/FOV settings; framing-task error; adjustment count/time; explanation accuracy | `USER`, `SHOT`, `TEST` | Ideal rectilinear model excludes distortion, breathing and real depth of field |
| F10 | Blocking, Marks and Movement | Phase 4 basic · Approved prototype | Place actors/cameras, marks and simple paths with deterministic preview | Explicit blocking may improve communication of movement and coverage | Path/mark completeness; playback repeatability; conflict detection; revision count; expert rubric | `USER`, `SHOT` | Stand-ins and paths do not simulate biomechanics, collision or timing complexity |
| F11 | Shot List and Variants | Phase 4 core · Approved prototype | Link diagram state to shots and preserve alternatives | Integrated variants may reduce loss of rationale and support comparison | Variant creation/recovery; shot-object consistency; accidental overwrite count; review accuracy | `SHOT`, `USER` | Prototype lacks collaborative approval and full storyboard production workflow |
| F12 | Floor Plans and Calibration | Phase 4 basic · Approved prototype | Import and scale a plan while showing schematic/approximate/calibrated state | Visible provenance and scale state may reduce false precision | Calibration error; unit errors; status interpretation; task success; unsupported precision claims | `BOOK`, `USER`, `TEST` | A single reference dimension and unverified plan do not establish survey accuracy |
| F13 | Light, Sun and Environment | Phase 8 · Later | Record and visualize environmental conditions | Deferred until the core workflow is evaluated | To be operationalized before Phase 8 | `BOOK`, `USER` | Weather, sound and lighting observations vary by time and instrumentation |
| F14 | Production Logistics Map | Phase 7 · Later | Plan basecamp, parking, loading and access overlays | Deferred until core decision workflow is stable | To be operationalized before Phase 7 | `BOOK` | Proposed logistics are not official approvals |
| F15 | Permissions, Availability and Costs | Phase 7 · Later | Track authority, inquiry, dates and cost status | Deferred because it requires sensitive operational records | To be operationalized before Phase 7 | `BOOK`, `USER` | Legal, privacy and organizational requirements exceed local prototype storage |
| F16 | Technical Scout and Handoff | Phase 7 · Later | Move selected location evidence to department verification | Deferred while initial remote-to-previz flow is evaluated | To be operationalized before Phase 7 | `BOOK` | Technical sign-off requires on-site expertise and current measurements |
| F17 | Wrap and Stewardship | Phase 9 · Later | Preserve condition/restoration records and lessons | Deferred operational lifecycle | To be operationalized before Phase 9 | `BOOK` | Contains sensitive incident and contractual context |
| F18 | Collaboration and Review | Phase 9 · Later | Share, comment and coordinate decisions | Deferred until single-user data integrity is established | To be operationalized before Phase 9 | `PAPER`, `SHOT`, `USER` | Requires identity, authorization and conflict handling |
| F19 | Capture Library and Curation | Phase 1 metadata; Phase 9 management · Partial prototype | Preserve provider IDs, coverage, date, rights and refresh status | Capture provenance is necessary to interpret immersive evidence | Missing metadata; stale-capture flags; broken entry rate; replacement traceability | `INVENTORY`, `PAPER` | Current capture dates, rights and coverage require validation |
| F20 | Reliability, Accessibility and Portability | Phases 0–5 baseline · Approved prototype | Maintain task continuity across failures, keyboard use, tablet layouts and local data transfer | Recoverability and inclusive operation affect observed usability of all features | Recovery success/time; keyboard task completion; data-loss incidents; import/export success; accessibility findings | `USER`, `LSU3D`, `TEST` | Dedicated phone field and headset workflows remain later scope |
| F21 | Treedis Research Mode | Phase 6 · Approved post-prototype pipeline | Collect authorized, consented WebXR/Treedis interaction signals through a separately deployed research path; optionally apply named experimental conditions through an independent gate | Time-aligned movement/input/context data may support reproducible study of navigation, spatial understanding, interaction and controlled stimuli | Schema-valid sessions; missing/drop rate; overhead; viewer/controller trajectories; task/condition markers; trigger/operation results; withdrawal/deletion success | `USER`, supplied Treedis research-mode text, `PAPER` | Requires provider/content-owner authorization, study/security approval, current runtime compatibility and careful treatment of motion trajectories as pseudonymous/sensitive data |

## Update fields for implemented features

When a feature changes status, add: artifact version, implementation file/module, interface state, linked decision IDs, automated/manual evidence, observed failures, measurement-schema version and date. Add a study ID only when an approved study actually evaluates the feature.

## Phase 0.1 implementation notes

First implementation work package, 2026-09-19, publishable-tree digest `89aae7a86236`. No feature status changes: nothing here delivers a user-visible feature, so no entry above moves to `Implemented` or `Validated technically`.

| Feature | What now exists | Evidence level | What is still absent |
|---|---|---|---|
| F01, F02 | Versioned public catalog 1.0.0 — 17 locations, 17 captures, 17 scout-detail records, 6 areas, 42 sources — generated from the reviewed workbook by `tools/build-catalog.mjs` and checked by `tools/validate-catalog.mjs` | Technical validation | No map, list, search, filter, dossier or selection. No interface reads the catalog yet. |
| F19 | Capture records carry provider experience and sweep identity, supplied entry orientation, capture date, coverage notes and validation status, with future candidates holding no provider identity at all | Technical validation | Capture date and reuse rights remain `Information has not been found` for all eleven current entries, pending the Phase 0 provider reconnaissance. |
| F09, F12 | Lens geometry (`src/spatial/optics.js`) and scene coordinate frames (`src/spatial/frames.js`), with published-value and independent geometric checks | Technical validation | No camera object, no rendered frustum, no floor-plan import and no calibration workflow. |
| F20 | Record schema and identifier rules that reject structural damage before any write, and a deployment-scope guard that keeps private reference material unpublishable | Technical validation | No persistence, no export, no recovery path, no accessibility surface. |

Measures with a working implementation to test against: `fov_error_deg` (exercised) and `json_roundtrip_loss` (schema half only). `plan_scale_error_pct` remains defined but unexercised until floor-plan calibration exists.

## Phase 0.2 implementation notes

Second implementation work package, 2026-09-20, publishable-tree digest `a8f4b4e4bd59`. No feature status changes. F20 now has working foundations, but nothing here has been observed in a browser, so no entry moves to `Implemented` or `Validated technically`: this package delivers the reliability and portability machinery that F20 is about, and F20 is exactly the feature whose claims cannot be supported without a rendered, operated interface.

| Feature | What now exists | Evidence level | What is still absent |
|---|---|---|---|
| F20 | Local workspace persistence in IndexedDB (`slivr-workspace`, schema 1, eleven stores) behind one repository module; validation before every write; revision-ordered writes that discard a completing older write; versioned JSON export and import with validate-before-mutate, classified rejections and three explicit conflict outcomes; emergency export serialised from memory with no storage access; a save-status surface with retry; a capability object that reports unconfirmed provider behaviour as `unknown` | Technical validation against an in-memory IndexedDB double | Real browser storage behaviour, quota handling and durability across a reload; the download and file-picker paths; keyboard operation, focus visibility and tablet layout; accessibility findings of any kind |
| F20, F01, F02 | Hash routing for every approved route with deterministic serialisation, a single application path into route state, Back and Forward handling, and a recoverable not-found state that names the unknown identifier and the catalog version | Technical validation against a window stand-in | Direct opening and link sharing in a real browser; whether the shell restores the intended context |
| F01, F02 | A catalog repository that loads the region configuration, the manifest and all five catalog files as one unit, refuses a mixed catalog version, validates the whole set, and returns a frozen read-only catalog with lookup indexes, or no catalog at all | Technical validation | Any map, list, search, filter or dossier. The Explore panel lists the 17 records only to prove that routing and loading work |
| F19 | Capture records reach the interface through the catalog repository with their provider identity, coverage notes, capture date and validation status intact; the Immersive foundation panel shows a future candidate as having no capture rather than as an empty viewer | Technical validation | The viewer itself, and the provider reconnaissance that would establish what a capture can actually do |

Measures with a working implementation to test against: `json_roundtrip_loss` is now fully exercised, over a fixture covering every workspace store, and measured as a deep comparison of normalised records after export and re-import. `fov_error_deg` remains exercised from Phase 0.1. `plan_scale_error_pct` remains defined but unexercised until floor-plan calibration exists.

Interface state for every approved feature remains unobserved. No screenshot, interaction trace or device configuration is recorded for this build.

## Phase 0.3 implementation notes

Third implementation work package, 2026-09-20, code-and-data digest `50dcb29e0e57`. No feature status changes. This package produced the first live provider evidence in the project, but nothing has been rendered in a browser, so no feature moves to `Validated technically`.

| Feature | What now exists | Evidence level | What is still absent |
|---|---|---|---|
| F01 | An imagery contract that refuses a misconfigured source, a failover from the 2025 primary to the 2024 fallback to a flat neutral ground with the active year always named, a MapLibre adapter that reports a classified failure instead of throwing, and a map mounted in the Explore foundation panel | Technical validation, plus live provider evidence for coverage | Markers, clustering, search, filters, and any confirmation that tiles actually render. The library is pinned but has never been loaded |
| F01, F19 | Confirmed coverage over all six operational areas from both configured services, with endpoint, bounding box, ground sample distance, byte counts, timings and pixel statistics recorded per point, and no-coverage controls recorded in the same run | Live provider evidence, dated 2026-09-20 | Coverage was sampled at one location per area, not across each area. Provider services change independently of this artifact (L013, L027) |
| F20 | Imagery failure is a recoverable state rather than a blank map: the neutral ground is always the bottom layer, a retry returns to the primary, and an absent library or absent WebGL leaves the mode usable with a message naming what still works | Technical validation | None of these states has been seen. Whether the failure messages are legible and the retry reachable by keyboard is unobserved |

Measures with a working implementation to test against: unchanged from Phase 0.2. Imagery provenance is now recorded in enough detail that a later screenshot can be tied to a specific service, year and request.

## Phase 0.4 implementation notes

Fourth implementation work package, 2026-09-20, code-and-data digest `6e0130e240ad`. No feature status changes. This package produced the first contact with the immersive provider, but nothing has run in a browser, so no feature moves to `Validated technically`.

| Feature | What now exists | Evidence level | What is still absent |
|---|---|---|---|
| F03 | A viewer adapter with an explicit lifecycle — load, handshake, ready, unresponsive, failed — that posts only to the configured origin, refuses inbound messages from anywhere else, and stops rather than hanging when the bridge never answers. All 11 supplied entries confirmed reachable, inside the allowlist, with their own sweep identifiers echoed by the provider | Technical validation, plus live availability evidence | Whether the viewer embeds, answers, lists sweeps, switches without a reload or reports pose. Every one reads `unknown` |
| F04 | A pose reader that records only the fields actually reported, so an absent yaw stays absent instead of becoming zero, and a capability record that downgrades bookmark restore to entry-point-only when no pose is available | Technical validation | No pose has ever been observed, so bookmark restore currently has no supported path beyond the entry URL |
| F19 | Per-entry reconnaissance producing capture identity, experience identity, sweep identity, availability and declared embedding policy, recorded as a dated report | Live provider evidence, dated 2026-09-20 | Capture date, coverage and reuse rights remain unknown for all 11 entries (L030) |
| F08, F09 | Scene geometry as plain data: camera basis from heading and pitch, frustum corners from the lens, containment-based framing, and a single ENU to Y-up conversion. Library placement is separated so a rendering fault cannot be read as a maths fault | Technical validation | Nothing rendered. The spike page exists but has not been loaded |
| F20 | The optional 3D context classified into absent, disabled, configured, denied, slow, unreachable and available, with the blank grid available in every one of those states and every unavailable option carrying a reason | Technical validation against injected responses | The available path, which needs a credential (L031) |

Measures with a working implementation to test against: `fov_error_deg` is now exercised through the scene builder as well as the optics module, against an independently derived value rather than a quoted one.

## Immersive viewer surface implementation notes

Viewer wiring, 2026-09-20, code-and-data digest `65ccbfbf7da7`. No feature status changes: F03 and F04 stay
Phase 2, and only the surface those features need was brought forward, recorded as D051.

| Feature | What now exists | Evidence level | What is still absent |
|---|---|---|---|
| F03 | An Immersive mode that opens the capture the catalog holds for the selected record, in the same window, with the record list and the capture detail beside it. The frame is persistent for the session, carries the provider attributes the reference uses, refuses any experience outside the approved list, and is released on leaving. A wait that becomes long explains itself and offers a way out rather than showing an unexplained blank frame | Technical validation only | Whether anything renders. No browser has opened this surface, so embedding, the bridge, sweep listing, sweep switching and pose reporting are all still `unknown`, exactly as before |
| F04 | The pose the viewer reports is carried into application state as the viewer reports it, and the rail states the connection, the current sweep and how many sweeps were listed, with `Not reported` where the viewer said nothing | Technical validation only | Any pose observed from a running viewer. Bookmarks, saved viewpoints and the handoff into a scene remain Phase 2 |
| F19 | The adapter's per-entry reconnaissance record is reachable from the running application rather than only from the standalone harness, which is what tests 28 and 29 need to cover all 11 entries through the product itself | Technical validation only | The eleven records themselves. One entry has been observed live, from the harness, not from the application |



### 2026-09-20 correction ? Explore optional exterior 3D (D057)

Implemented the previously missing Google tile renderer behind the Explore 3D
control. Geometry rendering, loading and aerial fallback are distinct states.
The owner-approved browser key now ships in deployment.js. Module/coordinate
and injected lifecycle checks passed before the manual-testing instruction;
real Google geometry, Lafayette coverage, attribution layout and repeat toggles
remain NOT TESTED for this build. No usability or measurement benefit claimed.

### 2026-09-20 owner manual report - build 59a980ac

The owner confirms the supplied shell/catalog, routing, basic persistence/JSON,
aerial coverage/fallback, Google 3D geometry/lifecycle/fallback, and all-entry
Treedis navigation checklist passed. This supersedes the earlier absence of
manual acceptance for those surfaces; it is owner-reported evidence without an
attached browser/version record or capability report. The Three.js feasibility
demonstration (test 27) remains NOT TESTED. No participant-benefit findings or
full Phase 0 completion are claimed.

### 2026-09-20 - Three.js manual feasibility PASS

Owner-supplied Chrome screenshot and explicit PASS confirmation show the
published tools/three-spike.html rendering its grid, camera, actor and frustum
with all 10 assertions passing. Horizontal/vertical FOV are 39.598/26.991 degrees
and camera height is 1.50 m. Test 27 is now PASS; this supersedes its earlier
NOT TESTED status. All eight supplied manual checklist items have passed.
No tests were executed by the assistant. The screenshot also shows the known
optional runtime.js 404, which does not invalidate the optics/rendering check
and remains separate from console-cleanliness acceptance. Full Phase 0 closure
still requires the remaining evidence review; no participant outcomes claimed.


### Phase 0 closeout technical evidence, 2026-09-20

Foundation implementation and eight-item owner manual acceptance are complete.
Current regression suite: 326 PASS, 0 FAIL, including linked fixture persistence,
versioned transfer, invalid schemas, optics, six-entry navigation and lifecycle.
See PHASE_0_CLOSEOUT.md for gate coverage and later-phase exclusions, and
PROVIDER_CAPABILITY_MATRIX.md for the 11-entry evidence inventory. Detailed
browser/device and administrative metadata gaps remain explicitly pending;
no participant benefit or complete provider capability is inferred.


### Final Phase 0 status - COMPLETE, 2026-09-20 (D061)

Owner approved the closeout report's bounded exceptions. Phase 0 foundations are
accepted; later-phase feature families remain planned. Evidence is 326 automated
PASS plus owner manual acceptance, including the Three.js screenshot. Deferred
live checks and metadata collection retain their actual unverified status and
scheduled retest conditions. No user-benefit or human-participant result claimed.


### Phase 1 map refinement - D062, 2026-09-20

F01 implemented increment: viewport-derived catalog fit, numbered status-colored
pins, six-decimal co-located grouping with hover/focus/tap selection. Automated
behavior evidence: 331-test suite PASS. Visual desktop/tablet acceptance pending.
Proximity clustering, search/filter and complete dossiers remain unfinished; this
is not full Phase 1 completion. The catalog and coordinate provenance are unchanged.

### Map control extension - D063, 2026-09-20

F01 adds explicit Recenter, streets/aerial visibility, geolocation, fullscreen,
search/help menu and ordered location navigation, with SLiVR-themed map controls.
Automated evidence: 334 PASS including control interaction/lifecycle and imagery
failover preferences. Live permission, fullscreen, provider and responsive visual
checks remain pending. Catalog menu search is implemented; advanced filters,
proximity clustering and full dossiers remain pending. No usability result claimed.

### Catalog 1.1.0 and focused selection - D064-D065

F01: thirteen existing owner-corrected positions plus new LaSEL / Antoun Hall future
candidate. Official sources support identity/address/contact, not filming access.
F01 selection now centers the chosen point from the list, pins, search and catalog
step controls. Repeated selection recenters; unrelated redraws do not. Automated
suite 338 PASS; workbook/catalog reconciliation and rendered workbook views checked.
Live map/device animation evidence remains pending. Historical Phase 0 acceptance
and 17-record observations apply to catalog 1.0.0, not this new snapshot.


### D067 - Explore interaction increment (2026-09-20)

F01/F02/F20: implemented single discovery/dossier panel, retained search/capture/area/sort/scroll state, collapse/repeat-selection restore, responsive sheet and on-demand catalog/help. Basic query/filter/sort is now available; advanced Phase 1 filters/full dossier/project actions remain pending. F03 lifecycle and F05/F08 entry points remain unchanged. Technical evidence: stable tests 204-205, shell/map/viewport/a11y suites. See [UI design](../docs/UI_INTERACTION_DESIGN.md) and [execution record](../docs/FULL-SYSTEM-TESTING.md). Live browser/device/provider verification and screenshots are BLOCKED, not PASS. No participant evidence.


### D067 owner manual evidence - 2026-09-20

F01/F02/F20 and existing F03/mode-entry portions: owner reports critical checklist items 1-12 PASS, covering layout, retained discovery state, empty-result recovery, map/list selection, panel/menu/sheet controls, keyboard, links/history and immersive/Projects/Shot Designer entry. Item 13, forced map-library failure, remains NOT TESTED. See the itemized execution record in docs/FULL-SYSTEM-TESTING.md. Exact browser/device/viewport/URL/build were not provided, and screenshots are absent. Earlier automated/blocked evidence remains intact; no full feature/phase completion or participant finding is claimed.

## F06-SA - Scouting Assessments (D068, 2026-09-21)

Status: Approved prototype, planned for Phase 3; not implemented, technically validated or evaluated with participants. Extends F06 within Project Workspace. Eight-section dated assessments connect observations, owned media and supported bookmarks to candidate requirements, decisions and shot references. Provenance: owner-approved CheckList/v2 source review and both map reference inspections; see SCOUTING_ASSESSMENTS_PLAN.md. Hypothesis: explicit evidence states and revision references may reduce omissions and improve decision traceability; this is not an observed result. Candidate measures: unresolved questions, evidence-linked judgments, revision recovery and transfer integrity. Limitations: virtual coverage/age, legacy default ambiguity, media portability and local-only storage. Planned tests 206-215; no runtime or participant evidence added.

## 2026-09-21 - Phase 1 discovery and dossier continuation (D069)

F01/F02/F19 metadata: advanced discovery, session recent sorting, nearby pin grouping, complete published practical-field rendering, combined source details and safe public location links are implemented on the existing D067 shell. F06-SA Phase 1 preparation is documented at the Project context section; no editor, placeholder action, assessment record or schema change. Record-level source associations do not establish per-field provenance. Unknown wording remains visible; hours/operator/capture do not imply production availability/ownership/permission. Runtime evidence and test IDs are in FULL-SYSTEM-TESTING.md. Automated technical validation only for this increment; no live or participant evidence and no Phase 1 exit claim.

### D070 - 2026-09-21

F01/F02/F20: corrected owner-reported name truncation and rectangular panel/group presentation. Added circular count-to-bounds navigation and measured panel padding while retaining selection, filtering and mobile sheet. 352 automated PASS including test 218; actual presentation and camera behavior remain unverified on the new build. Owner screenshot establishes prior presentation defects, not their resolution. No participant evidence or phase completion.


## D071 ? acceptance audit and reconnaissance, 2026-09-22

F01/F02/F20 remain implemented with Phase 1 acceptance open. D070 presentation
is not live-certified; owner items 15-16 remain NOT TESTED. Final 353 automated
PASS includes new exact downtown/Magnolia/Moncus lifecycle coverage (220).
F03/F04 diagnostic interpretation corrected (219): receiving pose fields does
not establish view restoration. Existing project-owned bookmark record/transfer
foundations are present; save/restore UI/actions and full Explore camera-return
state remain outstanding. F06-SA editor/actions stay Phase 3 under D068.

HTTP-only 11/11 entry reachability is new technical evidence, not a provider
capability or participant result. References and requirements are in
PHASE_2_RECONNAISSANCE.md; exact gates and unapproved test 44 allocation proposal
are in PHASE_1_ACCEPTANCE_REVIEW.md. No phase close or new exception is implied.


### D072 - linked Immersive/Explore selection, 2026-09-22

F01/F03/F20: the Explore mode button carries the resolved Immersive location ID
into the dossier/map selection and existing camera focus. Discovery filters and
scroll remain; viewer teardown is retained. Test 221 verifies four locations,
map-coordinate callbacks, out-of-filter selection and index/unknown fallback.
355 automated PASS; live focus/painting/provider behavior BLOCKED. No participant
benefit, pose-to-geography mapping or full Phase 2 context completion is claimed.


### D073 - collapsible location mini-map, 2026-09-22

F01/F03/F20: selected catalog location has a compact aerial preview in Immersive
with Show/Hide and full Explore handoff. Test 222 verifies state, coordinates,
failover, resource disposal and unchanged viewer on collapse; 360 automated PASS.
Placement avoids the provider viewport by using the existing location rail,
stacked below the viewer on narrow screens. Live painting/touch/attribution
legibility remain BLOCKED. No participant benefit or geographic tracking claim.


### D074 - bidirectional Explore/Immersive navigation

F01/F03/F20: top-tab entry now uses the selected Explore location from list or
pin; reverse map return remains. No-selection/future states retain honest
fallbacks. Test 223 reproduced the defect and now passes; 362 automated tests
PASS. Live retest BLOCKED. F05/F06/F08 future bidirectional context requirements
are clarified for Phase 3/4, not implemented or technically validated here.


### 2026-09-22 - D075

D075: interactive mini-map current-capture selection, compact controls and temporary enlargement implemented. Automated 224 covers callback selection, controls, inside/outside events, Restore, Escape, iframe focus and disposal. 222 retains collapse/retry/stale-event coverage. Full 363 PASS; live layout/provider/iframe interaction BLOCKED. Exact build and procedure in FULL-SYSTEM-TESTING.md.


### 2026-09-22 - D076

D076: owner screenshot documents prior oversized controls and square pin backgrounds (presentation FAIL). Scoped styles and internal icon toolbar corrected; 363 automated PASS, live correction NOT TESTED. Screenshot supports only the pictured LOC-005 rendering/UI, not all tour navigation or capability claims.


### 2026-09-22 - D077

D077: latest D076 mini-map retest owner-reported PASS for 222/224, metadata unspecified. Preserve original screenshot presentation failure on prior build. Basic bookmark workflow remains unimplemented/NOT TESTED; phase-wide acceptance remains open. See PHASE_2_ACCEPTANCE_REVIEW.md.


#### D077 owner scope clarification

Owner explicitly confirms "yeah all the test even the ones before the map" in response to the question naming earlier provider-failure and real-browser storage/reload/export/import checks. All earlier instructed delivered-function checklists, including owner 15-16, are now owner-reported PASS. Preserve earlier NOT TESTED/BLOCKED/FAIL entries as historical; do not repeat those checks solely for missing tool access. Browser/version/device and exact tested digest remain unspecified. This does not make unimplemented bookmark save/restore tested, supply absent raw provider reports, or explicitly approve E1. Bookmark-specific and later-phase workflows remain NOT TESTED. No runtime changes or new automated execution.
