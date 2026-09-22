# Research-relevant change log

This log records changes that could affect research interpretation. It complements source-control history; it does not duplicate every code edit.

| Artifact version | Date | Phase/build | Affected features/decisions | Change and research relevance | Evidence level and link | Measurement/data impact | Known limitation |
|---|---|---|---|---|---|---|---|
| Planning 0.17 | 2026-09-19 | Pre-implementation | F01–F20; D001–D013 | Approved prototype boundary, architecture, phase gates and research-traceability framework established | Design rationale; architecture and research records | Initial candidate measures only; no event collection and no participant dataset | No prototype or participant evaluation exists yet |
| Planning 0.18 | 2026-09-19 | Post-prototype pipeline | F21; D014 | Added Phase 6 Treedis Research Mode after essential Phases 0–5; separated passive capture from independently approved manipulation and added security/privacy/reproducibility gates | Design rationale; supplied Treedis research-mode text and `TREEDIS_RESEARCH_MODE_PLAN.md` | Candidate event families and quality measures added; logging remains unimplemented/off | Provider authorization, current Treedis runtime behavior, infrastructure and study approval remain unverified |
| Planning 0.19 | 2026-09-19 | Verification framework | D015; F01–F21 | Added `docs/FULL-SYSTEM-TESTING.md` with 183 unmarked tests covering repository invariants, Phases 0–6, research traceability and standing regression | Design rationale and test specification; no execution evidence yet | Future phase results must record exact build/environment and separate automated from live evidence | All tests begin unexecuted; coverage will evolve without renumbering referenced IDs |
| Phase 0.1 (tree `89aae7a86236`) | 2026-09-19 | Phase 0 implementation, first work package | F01, F02, F19, F20; D001, D004, D006, D007, D012, D013, D015; new D016-D020 | First implementation. Added the spatial core (units, WGS84 helpers, local scene frames, lens optics), the record schema and identifier rules, the catalog generator and validator, and the deployment-scope guard. The 17-record catalog now exists as versioned public JSON derived from the reviewed workbook, with the research vocabulary preserved verbatim | Technical validation. 82 automated assertions passing on Node v24.18.0; catalog validation 0 errors / 1 expected warning; deployment-scope check 0 errors over 39 publishable files. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-19 | No event collection, no participant dataset and no logging of any kind. Candidate measures `fov_error_deg` and `plan_scale_error_pct` now have a working implementation to measure against; `plan_scale_error_pct` remains unexercised until floor-plan calibration exists | No application shell, provider contact or browser execution yet, so no provider capability, rendering or interaction claim is supported. Tests 13 and 27 remain unmarked with partial evidence. Catalog provenance depends on a workbook held outside version control. The living verification record is published as the one deliberate exception to the private-reference exclusion, recorded as D020 |
| Phase 0.2 (tree `a8f4b4e4bd59`) | 2026-09-20 | Phase 0 implementation, second work package | F20 primarily; F01, F02, F19 indirectly; D004, D005, D010, D011, D013, D015, D016; new D021-D026 | Added the application shell, hash routing, the single-state store, runtime capability detection, the save-status surface, the catalog repository, the IndexedDB workspace repository with revision-ordered writes, versioned JSON transfer with conflict resolution, and emergency export from memory. The catalog now has a loader that publishes all 17 records or none, so a corrupted catalog can no longer present a partial list as if it were the research inventory | Technical validation only. 190 automated assertions passing on Node v24.18.0; catalog validation 0 errors / 1 expected warning; deployment-scope check 0 errors over 78 publishable files. No browser executed this build: the automation extension was not connected. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-20 | No event collection, no participant dataset and no logging of any kind. `json_roundtrip_loss` now has a full implementation to measure against and is exercised over a fixture covering every workspace store; the round trip is measured against an in-memory database rather than a browser one | No rendering, interaction or provider contact was observed, so no usability, accessibility or provider claim is supported. Tests 13 to 21 remain unmarked with partial automated evidence. IndexedDB evidence comes from a declared test double, so real browser storage, quota and durability behaviour is still unverified (L023) |
| Phase 0.3 (tree `50dcb29e0e57`) | 2026-09-20 | Phase 0 implementation, third work package | F01, F20; D006, D018; new D028-D032 | Added the imagery configuration contract, the primary-to-fallback-to-neutral failover the reference project lacks, the MapLibre adapter, the pixel-content classifier and the coverage probe, and mounted a map in the Explore foundation panel. First contact with an external provider in this project: both configured DOTD services were requested live over all six operational areas | Technical validation and live provider evidence. 217 automated assertions passing on Node v24.18.0; `tools/probe-imagery.mjs` returned photographic content for 12 of 12 point and source combinations, with two no-coverage controls rejected and the excluded 2026 layer returning a uniform fill. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-20 | No event collection, no participant dataset and no logging. Imagery provenance is now recorded per result: service, year, endpoint, bounding box, ground sample distance, byte counts and pixel statistics, which is what lets a later screenshot be tied to a flight | No browser executed this build, so no rendering, attribution visibility or interaction claim is supported and tests 22 to 25 remain unmarked. Pixel evidence comes from a lossless BMP rendering rather than the JPEG a browser receives (D029). The top zoom level upsamples beyond the source resolution (D032, L026) |
| Phase 0.3 fix (tree `04b19216f222`) | 2026-09-20 | Phase 0 implementation, defect fix | F20; D010; new D033-D034 | Fixed a notification cycle introduced in Phase 0.3 that would have frozen any browser session reaching Explore, and added a boot smoke check that starts the real entry point against a DOM stand-in. Documented that the application must be served over HTTP, which the verification record had not stated anywhere | Technical validation. 227 automated assertions passing on Node v24.18.0, up from 217. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-20 | None. No measure definition changed | The defect was present in the build recorded as `50dcb29e0e57`, so any result attributed to that build for a browser session would have been unobtainable. No browser result was claimed for it. The stand-in has no layout, styling or real event dispatch, so test 15 remains unmarked (L029) |
| Phase 0.4 (tree `6e0130e240ad`) | 2026-09-20 | Phase 0 implementation, fourth work package | F03, F04, F08, F09, F19, F20; D007, D008; new D035-D039 | Added the immersive message contract, capability record and viewer adapter; the scene geometry bridge for camera, actor and frustum; the optional photorealistic 3D context with its failure classification; and the two reconnaissance instruments. First contact with the immersive provider: all 11 supplied entry URLs were requested | Technical validation plus live provider availability evidence. 271 automated assertions passing on Node v24.18.0; `tools/probe-treedis.mjs` reached 11 of 11 entries, all inside the region allowlist, none declaring a header that refuses embedding. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-20 | No event collection, no participant dataset and no logging. Provider message structure is recorded without contents (D037), so reconnaissance cannot capture identifiers from a private experience. `fov_error_deg` is now exercised through the scene builder as well as the optics module | No browser executed this build, so embedding, the message bridge, sweep switching and pose reporting are all still `unknown` and tests 26 to 29 remain unmarked. Capture date, coverage and reuse rights remain `Information has not been found` for all 11 entries, pending administrative access (L030). No Google Maps 3D Tiles credential was supplied, so only the absent, denied, slow and unreachable paths are evidenced (L031) |
| Phase 0.4 reference audit (tree `f3f15de8293a`) | 2026-09-20 | Phase 0 implementation, reference alignment | F01, F08, F20; D008, D031; new D040-D044 | Established reference-first implementation as a standing rule: LSU3D is ground truth for anything it already does, deviation requires a recorded reason naming the file departed from, and the comparison is verified at each phase boundary by new test 184. Audited the plumbing written without consulting it and corrected four defects: a silently rejected style mutation recorded as applied, an ambiguous shared source and layer identifier, map bounds silently overriding the configured default view, and a library loaded from a CDN. Vendored MapLibre 4.7.1 and Three.js 0.183.0 | Technical validation. 275 automated assertions passing on Node v24.18.0; the Three.js spike confirmed in a browser to render with ten of ten assertions passing and to issue no third-party request | None. No measure definition changed | The rule is documented and its verification test is unexecuted: no phase has yet been compared against the reference end to end. Three of the four corrected defects fail silently by nature, so earlier builds may carry others of the same class that no test would have caught |
| Phase 0 reference comparison (tree `e1cbe66298b5`) | 2026-09-20 | Phase 0, first execution of test 184 | F01, F03, F20; D044; new D045-D050 | Compared every Phase 0 module against its LSU3D counterpart and changed SLiVR to match wherever a divergence had no justification. Ten corrections, of which five were silent failures that no existing test would have caught: a map readiness guard, container resizing, style mutations verified rather than assumed, viewer reuse instead of reload, and a modal claiming `aria-modal` without a focus trap. Six divergences were justified and recorded. Phase 4 reuse obligations were written into the implementation plan so they bind the phase that will need them | Technical validation. 286 automated assertions passing on Node v24.18.0, up from 275, including a new accessibility suite. Recorded in `docs/FULL-SYSTEM-TESTING.md` test 184 | None. No measure definition changed | The comparison covered the modules Phase 0 changed, concentrating on plumbing; it was not a line-by-line review of the whole reference. Test 184 asserts only that no unjustified divergence is outstanding in Phase 0. The map itself is still unverified in a browser, so the corrections to it are evidenced by code comparison and automated tests rather than by a rendered result |
| Immersive viewer surface (tree `65ccbfbf7da7`) | 2026-09-20 | Phase 0, viewer wiring | F03, F04, F19, F20; D044, D047; new D051 | Connected the viewer adapter to the Immersive route, which until now had no surface at all: the mode rendered a panel naming Phase 2 where the captured experience belongs. Added the persistent viewer frame with the provider attributes the reference uses, an escalating loading veil with a way out, allowlist enforcement at mount, and release of the provider session on leaving. Corrected a defect in the adapter, which added frame listeners it could not remove, so every capture visited would have left a disposed adapter still reacting to the live frame | Technical validation. 304 automated assertions passing on Node v24.18.0, up from 293, including the frame carrying this record's own entry URL and six downtown records resolving to six distinct sweeps inside one shared experience. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-20 | No event collection, no participant dataset and no logging. The adapter's reconnaissance record is now reachable from the running application, which is what tests 28 and 29 need, but nothing is written anywhere | No browser executed this build: the automation extension was not connected, so embedding, the message bridge, sweep switching and pose reporting remain `unknown` in the product and tests 28 and 29 stay unmarked. The evidence comes from a DOM stand-in with no layout, no real iframe and no provider contact, so nothing here supports a claim that the viewer renders |
| Immersive host change (tree `f55f74da3dbc`) | 2026-09-20 | Phase 0, provider configuration | F03, F19; D044; new D052; L033 | Moved the immersive capture URLs from the provider's primary host to the white-label host that the one working reference embed uses, after the primary failed to serve tour data inside a frame. Changed at the source: the 11 URLs in the reviewed workbook were rewritten by tool, host only, with every other cell verified unchanged, and the catalog regenerated. The region now configures both hosts, with the second as an alias | Technical validation plus live provider availability. 305 automated assertions passing on Node v24.18.0. `tools/probe-treedis.mjs` re-run against the new host: 11 of 11 entries reachable, 6 experiences, all inside the region allowlist, none declaring a header that refuses embedding. Recorded in `docs/FULL-SYSTEM-TESTING.md` execution log, 2026-09-20 | Capture identity is unchanged: the same experiences, sweeps and entry orientations, reached by a different host. Any result recorded against a capture URL before this date names the primary host and refers to the same capture | The host change is reference-driven, not evidenced: no capture has been seen to render on either host, so it must not be reported as a fix. L033 stays open. The workbook is the provenance record and now differs from the URLs as originally supplied; the supplied list is preserved verbatim in `docs/` and the workbook states what changed |

### 2026-09-20 — Critical reference repair (`e13c6854ccc9`)

Phase 0.4 correction, F01/F03/F19/F20; D053–D055, L034–L035. SCSU/Experimental
is now the controlling Treedis code reference; LSU3D remains the map reference.
Adapted queued entry/orientation, the 600 ms ready delay, four arrival attempts at
1500 ms intervals and shared-session reuse. Added source/payload validation,
independent frame identities, bounded load recovery, cancellation guards and a
working Stop waiting return path. Corrected imagery event IDs/applied-source
tracking and cancelled obsolete map mounts using the reference generation pattern.

Negative evidence preserved: the original suite passed 305 checks. New tests
185–194 then failed 10/10 before production edits. Tests 195–197 failed 3/3 before
their corrections; test 199 separately failed before its correction. Test 198 is
additional integration coverage, not a claimed baseline failure. Final `node --test`
passes 320/320; catalog validator reports 0 errors / 1 existing name warning;
deployment checker reports 0 errors across 117 files. Detailed assertions, source
mapping and appended stable IDs are in `docs/FULL-SYSTEM-TESTING.md`.

Evidence is automated technical validation only. No browser was connected and both
Chrome and in-app browser attempts returned unavailable. The owner will run manual
checks. L033's provider 403 was not reproduced, its cause remains undetermined,
and it is not claimed resolved. An iframe load no longer marks embedding proven or
tells users the correct capture is showing. Adapter capability version changes to
`treedis-recon-2`; catalog and persistence schemas, measure definitions and telemetry
remain unchanged. No reference source or private workbook was modified. No commit.

## Entry requirements

### 2026-09-20 — Manual follow-up: stuck loading surface and reference launch

F03/F20, D056. Owner supplied a Chrome screenshot showing `spaces.dtsxr.com`
requests to `api.treedis.com` failing CORS checks, including a 403 for tour 114717.
Before the owner requested no further tests, a direct Node request reproduced
403 with no Access-Control-Allow-Origin for the tour's public BOQ endpoint;
both tour HTML documents returned 200. This unauthenticated request does not
identify why Chrome's embedded requests fail. The owner subsequently confirmed
that both Lafayette and SCSU base-tour links open directly in Chrome.

Fixed by inspection: `.viewer-veil` declared `display: flex`, overriding the
hidden attribute and covering the viewer even after the connection became
unresponsive. Adopted SCSU's default-hidden, explicitly-active loading style.
The transparent status overlay also inherited pointer-events auto, blocking tour
interaction; only the recovery card now accepts pointer events. Aligned startup
with SCSU: load the base tour and apply the queued sweep/orientation through
Navigate. The catalog deep link remains intact for external recovery.

No tests run after the owner's instruction. Prior 320-test results belong to the
preceding build, not this change. Provider CORS/403 resolution is not claimed;
manual verification remains with the owner.

Add an entry when a build changes a task flow, feature behavior, provider capability, visual presentation, data schema, event definition, measurement rule, study condition, dataset/capture, known limitation or claim that could affect comparison across versions.

Each entry should link repeatable technical evidence or an approved study ID where applicable. Record failed experiments and rollbacks when they affect design rationale or interpretation.


## 2026-09-20 ? Explore photorealistic tiles and deployed browser configuration

The deployed 3D button only changed camera pitch; Explore had no tile renderer.
The ignored runtime.js was absent from Pages. Added a lazy MapLibre custom layer
adapted from the read-only reference, a genuine perspective camera for LOD,
Draco/KTX2 loaders, visible provider/loading/fallback states, attribution and
map-lifecycle disposal. Vendored 3d-tiles-renderer 0.5.1 and Three 0.183.0 addons.
D057 records the reference mapping and required architecture deviations.

The owner explicitly requested reuse of the reference application's browser key
and a push, and prohibited further tests. The key is now loaded from the shipped
config/deployment.js. No reference application file was changed. No live Google
request was made. Before that instruction, the 37-test Google-tiles/imagery run
passed using real module imports/math and injected rendering/provider doubles.
Those results precede the final deployment-configuration edits. No test execution
after the instruction; deployed geometry, provider access and browser lifecycle
are left for the owner's manual verification. No participant evidence or new
telemetry is introduced.

## 2026-09-20 - Owner reports Phase 0 manual acceptance results

For deployed build 59a980ac, the owner reports all supplied manual checklist
items passed except the Three.js feasibility demonstration (test 27), which
remains NOT TESTED pending instructions. Recorded items 1-7 and the additional
save-failure procedure as PASS in FULL-SYSTEM-TESTING.md, explicitly attributing
them to the owner. No browser/device details or evidence files were supplied
with this confirmation. No new automated or provider tests executed. Broader
fixture/schema, metadata and audit gates are not inferred from the checklist;
Phase 0 completion remains pending test 27 and the remaining evidence review.

## 2026-09-20 - Shared code-reference policy for future phases (D058)

Owner approved both LSU3D and Experimental/SCSU as read-only code ground-truth
and refactoring sources across all phases. Updated project instructions, added
AGENTS.md pointing to the shared rules, and aligned architecture, implementation
plan, reusable session prompts and test 184. SCSU remains preferred for Treedis
and is also available for any other applicable feature. Neither reference was
modified. Documentation-only update; no tests executed.

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


## 2026-09-20 - Transparent immersive loading and SCSU timing alignment

D059: changed the loading veil from opaque to 55% dark opacity so the provider's
own loading surface remains visible. Aligned slow/cancel notices to 15/30 seconds,
ready settling to the existing 600 ms, sweep transition to configured 0 ms,
retry spacing to the existing 1500 ms/four attempts, and navigation recovery to
6 seconds. Readiness polling starts on attachment with a 2-second first delay;
SLiVR retains bounded failure handling. Veil timers survive intermediate loading
states; a new frame resets them. Updated existing affected assertions by inspection.
No tests executed, per owner instruction; manual validation of this build remains
pending. Earlier owner PASS results apply to deployed 59a980ac, not these edits.

## 2026-09-20 - Owner accepts immersive loading update

The owner reports the D059 loading/timing update is working and authorizes its
publication. Record this as owner-reported manual acceptance of the current
loading presentation and behavior; no additional automated tests were run and
no detailed timing trace or new browser/device information was supplied. This
supersedes the pending manual acceptance of that update, without asserting that
every failure-path regression was separately re-executed.


## 2026-09-20 - Phase 0 closeout verification and evidence consolidation

Owner instruction to finish the stated technical closeout authorized the needed
verification following the earlier manual-only testing period. Initial suite:
318/326 PASS; eight stale expectations failed after the accepted loading changes.
Updated those assertions and strengthened all-six-downtown command/arrival checks.
Final suite 326/326 PASS; catalog validation zero errors/one alias warning;
deployment scope zero errors. Fixed only the diagnostic page configuration path
in runtime assets. Added PHASE_0_CLOSEOUT.md and PROVIDER_CAPABILITY_MATRIX.md.
Manual and automated evidence remain distinguished. No new live provider tests;
no browser surface available. Formal closure awaits the bounded exception decision.


## 2026-09-20 - Phase 0 formally closed (D061)

The owner explicitly approved the bounded exceptions in PHASE_0_CLOSEOUT.md and
instructed closure. Phase 0 is COMPLETE, supported by 326 automated PASS results,
valid catalog, clean deployment scope and all eight owner manual checks. Missing
live storage/device/provider/admin evidence is carried with named retest conditions
rather than falsely marked PASS. Updated the implementation plan and final
acceptance record. Phase 1 is the next work package and has not started.


## 2026-09-20 - Explore framing and numbered pin groups (D062)

Owner-requested Phase 1 map refinement: automatic fitting uses actual catalog
bounds rather than the padded planning envelope, recalculating with map-container
size and reserving controls/provenance space. Unchanged catalog redraws and selection
do not reset the camera. Numbered teardrop pins use SLiVR capture/future colors and
44-pixel button targets. Shared-coordinate records become expandable ordered groups
without moving their stored coordinates. Adapted LSU3D after comparing SCSU.

Verification: Node v24.18.0, 331/331 tests PASS, including five added grouping and
viewport cases; deployment scope zero errors (148 publishable files). No browser
visual execution available. Pin appearance, screen-edge group expansion and live
portrait/landscape resizing remain manual checks on the next deployment. Phase 0
acceptance remains historical; this starts only the requested Phase 1 map work.

## 2026-09-20 - Explore map controls (D063)

Added catalog Recenter in the map toolbar and records rail; street/building/place
reference overlay, aerial toggle, fullscreen, user-triggered geolocation with
accuracy visualization, menu search/help and previous/next catalog navigation.
Retained zoom/compass/scale and real Google 3D switching with a visible mode badge.
Controls use SLiVR colors and 44px targets. Source adaptations and architecture
exceptions are recorded in D063. Map overlay DOM is removed with its control.
The imagery plate now updates on tiles status and explicitly reports hidden aerials.

Validation: Node v24.18.0, 334/334 tests PASS; deployment scope 150 publishable
files, zero errors; catalog zero errors and one pre-existing Old City Hall alias
warning. No browser/device visual PASS. Full Phase 1 remains incomplete.

## 2026-09-20 - Catalog 1.1.0 and selection focus (D064-D065)

Updated 13 existing locations to owner-supplied coordinates, including the later
Moncus Park correction. Added LOC-018 LaSEL / Antoun Hall with official UL sources,
AREA-07 UL Research Park, CAP-018 future placeholder and scout questions. Revised
the existing six-sheet workbook, then regenerated the public catalog: 18 locations
(11 current/7 future), 7 areas, 18 captures/details and 46 sources. Four untouched
positions, existing captures and unrelated facts remain unchanged. Exact supplied
pairs are preserved as numeric cells and longitude-first JSON, with owner provenance.

Workbook verification: summary 18/11/7 recalculated; all 14 supplied pairs exact;
original rows outside authorized fields, field guide, existing cell styles, column
widths, freeze panes, merges and validation preserved. Added rows extend the tables,
use wrapped text and matching conditional rules; changed views rendered and reviewed.
A malformed import of a future capture date exposed an XLSX-reader empty-element
regex defect; matching self-closing cells/rows first fixes it, with regression coverage.

List and pin selection now move the camera, including repeat selection. Search and
catalog stepping share the behavior. Two layout frames, 550 ms duration, zoom cap 19,
current bearing/pitch and protected overlay space follow the reference adaptation.
Camera work is cancelled when superseded, recentered or disposed.

Verification: Node v24.18.0, 338/338 PASS; catalog zero errors/one existing Old City
Hall alias warning; deployment scope 151 publishable files, zero errors. Initial
suite failures reflected old 17-record/solar-exclusion expectations and old camera
behavior; replaced with the owner's new requirements. Tests 201-203 track this
increment. Live map animation/desktop/tablet and native Excel application checks
remain unexecuted. No commit, push or human-participant finding is recorded.

### 2026-09-20 - Additional owner coordinate corrections (D064 follow-up)

Applied the owner's additional positions for LOC-007 Play N Trade, LOC-008 Givens
House and LOC-010 Former Truman Early Childhood Education Center to the workbook
and regenerated catalog 1.1.0. SRC-043 now covers 16 corrected existing locations
plus the new LaSEL pin. Only LOC-001 Carpe Diem retains its original position.
The catalog remains 18 locations (11 current/7 future), seven areas and 46 sources.
Updated the derived map bounds. All 17 supplied coordinate pairs match exactly;
unchanged facts, captures and workbook field-guide content reconcile with the
original workbook. Reviewed the affected workbook rows. Automated suite: 338 PASS;
catalog zero errors/one existing alias warning; deployment scope zero errors.


### 2026-09-20 - Explore single-panel redesign (D067)

Uncommitted increment on e50834604c8decaa13dd2aacc3270a254523ca37. F01/F02/F20: replace two Explore rails and redundant browsing strip with retained discovery/dossier panel, collapse/restore, basic query/capture/area/sort, mobile half/expanded sheet and shell catalog/help drawer. Preserve catalog 1.1.0/schema/provider contracts, mode navigation and local projects. Add tests 204-205; reconcile architecture and document reference adaptation in docs/UI_INTERACTION_DESIGN.md.

Initial regression run: 338 tests, 334 PASS/4 FAIL (obsolete menu/strip/catalog-heading assertions and reference identity in CSS comment). Second run: 340 tests, 337 PASS/3 FAIL (new tests lacked document events and hashchange dispatch in the DOM fixture). Corrected fixture and expectations; final results/build digest are in FULL-SYSTEM-TESTING.md. Preserve these failures as test-development evidence, not browser findings. Browser discovery and creation both failed; no screenshots/live acceptance. No user-study result, telemetry or persistence schema change.

D067 documentation check initially produced 338 PASS/2 FAIL after adding the public UI specification: deployment tests still asserted two allowlisted documents. Updated the exact allowlist fixture to three documents while retaining rejection of every other private docs path. No application behavior changed for those failures.

Final D067 execution: 340 PASS/0 FAIL on Node v24.18.0. Catalog validation zero errors/one retained alias warning; public scope 153 files/zero errors. Runtime digest and Part C/J result boundaries are recorded in FULL-SYSTEM-TESTING.md. Browser and screenshot acceptance remain BLOCKED.


### 2026-09-20 - D067 owner manual checklist results

Owner response: "all passed 13 was not tested". Recorded 12 owner-reported manual PASS results and one NOT TESTED result (forced map-library failure), mapped to existing stable test IDs without declaring the broader tests complete. Updated verification, UI design, feature evidence, limitations and implementation status. Browser/device/URL/build metadata and screenshots were not supplied. No runtime, data, measurement definition or telemetry change; no new tests were executed for this documentation-only update. No commit or push.

## 2026-09-21 - Approved Scouting Assessments plan (D068)

Architecture 0.20; assessment plan 1.0; F06-SA extends essential Phase 3 with supporting Phases 1-5 work. Added record/ownership/history, evidence-state, source-reuse, migration, legacy import, attachment and export contracts; reserved tests 206-215 as NOT TESTED. Guided 360 capture, refinement, sensors and dedicated offline phone tools remain Phase 7. Evidence level: design rationale and source inspection only. No application build, database/catalog/transfer version, telemetry, provider capability or participant dataset changed. No implementation or phase completion claim.

## 2026-09-21 - Phase 1 Location Atlas and Dossiers continuation (D069)

Preserved existing owner planning edits and D062-D067 runtime foundation. Implemented debounced multi-field discovery, ten composable filter dimensions, name/area/capture/session-recent sorts, zoom-dependent nearby grouping, full published dossier practical fields, combined location/detail sources, clear unknown/provenance/access labels and context-free public link copying with selectable fallback. Documented D068 Project context placement and Phase 3 integration ownership without an editor or placeholder action. Both map references were inspected read-only; exact sources/deviations are recorded in D069.

Initial run caught a retained-row focus regression caused by needless recent-history redraws; fixed to refresh only recent-sort results. A subsequent privacy assertion falsely rejected an external public source path containing docs/; corrected to distinguish private local references. Prior logs are retained. Final: 350 automated PASS, zero FAIL; catalog zero errors/one retained alias warning; deployment scope 156 files/zero errors; whitespace check clean. Base HEAD 08ea25c1f70fad472834e2dcfb6bbf3918f9dc3d; runtime SHA256 ef4cb854a20726b2051dba87a785306c9d0fe7304863b88ca5f58bc9b4df19c3. Node v24.18.0; app 0.2.0, catalog 1.1.0, schemas/provider configuration unchanged. Tests 216-217 added alongside Part C/J mappings.

Live browser discovery returned no surfaces and iab tab creation failed. Live visual/device/provider/storage/clipboard acceptance remains BLOCKED; no screenshots, deployment or participant evidence. Phase 1 remains open, including full test 44's later workspace-action integration and inherited Phase 0 browser obligations. No new exception, telemetry, reference edits, staging, commit or push.

### 2026-09-21 - D070 floating panel and group zoom

Applied owner-approved floating panel, full-name wrapping and circular count badge. Group activation fits members; camera padding tracks visible desktop panel, cancels stale focus and preserves orientation/reduced motion; coincident member controls survive regrouping. Both references inspected read-only, provenance in D070. Initial 350 tests PASS; final 352 PASS after targeted group/camera regressions. Catalog zero errors/one retained warning, deployment scope 156 files/zero errors, whitespace clean. Runtime SHA256 ea5085cb623cdb7fe2be15210dbaff2c72b7e351efbe80a576b3db5ab9bb8899. Browser retry unavailable; test 218 live portions BLOCKED. Recorded prior owner functional report separately from screenshot-visible presentation failures; uncertain checklist 15/16 remain NOT TESTED. All changes within SLiVR; no data/schema/provider configuration, telemetry, reference edit, commit or push.


## 2026-09-22 ? D071 acceptance review and independent Phase 2 reconnaissance

Local 318316612d8c44031eae835e4b1760843d3ebe6c on content-migration-2026-09-07;
SLiVR subtree matches published f2627108 before edits. Preserve unrelated history
and user changes. Read both map reference implementations; record exact sources,
existing lifecycle reuse, missing bookmark actions and Explore camera snapshot
in PHASE_2_RECONNAISSANCE.md. Prepare PHASE_1_ACCEPTANCE_REVIEW.md with concrete
remaining gates, E1 test 44 phase allocation proposal and owner checklist.
No E1 approval or dependent Phase 2 feature implementation.

Correct diagnostic wording that inferred restoration from any pose; stable 219
covers sweep-only/raw-zero/named-angle observations without certifying restore.
Add stable 220 exact LOC-001/005/009/011 lifecycle sequence using doubles.
Baseline 352 PASS; diagnostic expectation initially 24 PASS/1 FAIL, preserved
in diagnostic-before-fix.txt; corrected run 352 PASS; targeted suites 39 PASS;
final full suite 353 PASS/0 FAIL. Catalog zero errors/one alias warning;
deployment 158 files/zero errors; whitespace clean. Runtime SHA256
c1a979196d5a331308cce0853410bead57c8590c33997e8476dc30430145dde3.

HTTP probe 1.0.0 at 2026-09-22T13:28:40.061Z: 11/11 HTTP 200, no declared
embedding-refusal header; embedding/runtime capabilities remain unknown.
Browser discovery empty, tab creation unavailable; no new live PASS/screenshots.
Historical presentation FAIL and owner 15/16 NOT TESTED retained. Updated
implementation/test status, capability/evidence/measurement/limitation records.
Provider/capture/catalog/schema versions unchanged; no telemetry, participant
evidence, reference edits, staging, commit or push. Local raw evidence remains
under outputs/acceptance-2026-09-22/.


### 2026-09-22 - D072 Immersive-to-Explore location handoff

Owner-reported defect: the top Explore button discarded the location selected
in Immersive. Reuse the existing location route/action so the dossier, selected
pin and camera target agree. Both reference selection/sweep-sync counterparts
inspected read-only; source lines and architecture deviation are in D072.
Two shell regressions added under stable 221; targeted 23 PASS, full 355 PASS,
catalog zero errors/one alias warning, deployment 158 files/zero errors.
Runtime digest 764eb6758cb36c89c52153fc5855bdbb4601037defcd13c0deba296eacadf336.
Browser discovery empty; live retest remains BLOCKED. Retained prior changes,
provider lifecycle/configuration, data and schemas. No telemetry, commit or push.


### 2026-09-22 - D073 collapsible Immersive mini-map

Adapted the read-only LSU3D mini-map counterpart after inspecting both reference
projects. Add ui/immersive-map.js and compact mode to the existing map adapter;
retain configured imagery/failover/pins/attribution. Render above captured list,
stacked below the viewer on narrow screens, collapsible everywhere as requested.
Keep its canvas attached during viewer updates; dispose on collapse/mode exit;
Open Explore uses current stable location ID. No changes to Treedis or catalog.

Initial suite 355 PASS; new targeted suites 28 PASS; final suite 360 PASS/0 FAIL.
Catalog zero errors/one retained alias warning; deployment 160 files/zero errors;
whitespace clean. Runtime SHA256 c1400777be98a791dc171c1db706e38a3369d8b6ba6b27fa4e525db7a097ca4d.
Live browser unavailable; owner screenshots document the baseline only. Update
stable 222, implementation/UI/evidence/limitations/parameters. No telemetry,
participant evidence, phase close, reference edits, staging, commit or push.


### 2026-09-22 - D074 bidirectional Explore/Immersive tabs

Corrected the Immersive top-tab route dropping Explore's selected location.
Inspected both reference selection-to-viewer implementations; reuse SLiVR's
resolved route ID, current adapter and no-capture recovery. Added stable 223
list/pin, reverse, no-selection/invalid/future regressions. Before fix 24 shell
PASS/2 FAIL; after fix 26 targeted PASS, 362 full PASS/0 FAIL. Catalog zero
errors/one alias warning; deployment 160 files/zero errors; whitespace clean.
Runtime digest 2704950cc4c5e8ecfdad2df50120ed29357d9dce2d38b8f377afba4c4555473d.
Live browser discovery empty; no new browser/participant evidence. Documented
owner's future bidirectional project/shot context requirement without implementing
those actions or waiving existing gates. No telemetry, reference edits, commit
or push; retained prior working changes.


### 2026-09-22 - D075

D075 replaced static preview with captured-location navigation, compact zoom/center/3D/streets/enlarge controls and temporary dismissal. Both references inspected; source/deviations in decision record. Full 363 automated PASS; catalog 0 errors/one existing City Hall alias warning; deployment scope 160 files/0 errors. Live unavailable; gates unchanged. No telemetry, reference edits, commit or push.


### 2026-09-22 - D076

D076: internal compact icon toolbar and pin-style correction. Both references inspected, no reference edits. Full automated 363 PASS; deployment scope 160 files/0 errors. Live presentation retest pending. No telemetry, commit or push.


### 2026-09-22 - D077

D077: recorded owner-reported mini-map PASS, audited remaining phase obligations, prepared Phase 2 acceptance review and next-CLI prompt. Latest automated evidence unchanged at 363 PASS; documentation-only update. No phase closure, telemetry, commit or push.


#### D077 owner scope clarification

Owner explicitly confirms "yeah all the test even the ones before the map" in response to the question naming earlier provider-failure and real-browser storage/reload/export/import checks. All earlier instructed delivered-function checklists, including owner 15-16, are now owner-reported PASS. Preserve earlier NOT TESTED/BLOCKED/FAIL entries as historical; do not repeat those checks solely for missing tool access. Browser/version/device and exact tested digest remain unspecified. This does not make unimplemented bookmark save/restore tested, supply absent raw provider reports, or explicitly approve E1. Bookmark-specific and later-phase workflows remain NOT TESTED. No runtime changes or new automated execution.
