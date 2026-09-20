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
