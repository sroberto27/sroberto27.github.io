# Visual redesign comparison and verification — D097

Date: 2026-10-08. Baseline: current uncommitted App 0.5.0, transfer 1.4.0,
DB2, template 1.0.0, catalog 1.1.0. The supplied v2 desktop/phone designs
control appearance; current application behavior controls functionality.

| Area | Compatible visual implementation | Preserved functionality / adaptation |
|---|---|---|
| Shared shell | Neutral graphite surfaces, Geist/Geist Mono, restrained blue actions/selection, segmented modes, flat separators, compact controls | Existing two destinations, project/scene selectors, New project, Add scene, Reset layout, save states and notices |
| Explore | Flat location rail, quieter rows, readable names/IDs/status, minimal map chrome | Same-panel browse/dossier and retained scroll; all 18 real records, full-text search, all additional filters/sorts, shared-entry clusters, DOTD primary/fallback and Google 3D |
| Dossier / Immersive | Shared typography, evidence glyphs plus words, simplified sections and viewer chrome | Real loading, timeout, retry, cancellation; persistent provider frame, mini-map controls, entry-only bookmarks, sources, validation gaps, candidate actions and immersive-image handoff |
| Scouting | Neutral checklist frame, flatter sections, coherent controls and answer-state styling | Eight actual sections; existing selectors preserve unanswered/observed/needs-validation/not-applicable, explicit negative answers, provenance, attachments, history, dates, pin/follow, floating/docked/maximized/mobile layouts and theme switch |
| Project tools / exports | Shared forms, lists, dialogs and comparison styling | Real project/scene editing, candidate lifecycle, assessments, requirement evaluations, preferred/backup decisions, reopening, JSON/ZIP imports/exports, selected-section packets and emergency recovery |
| Shot Designer | Neutral toolbar/menus/inspector, blue selection, wrapped desktop tools, phone dock/sheet | Image-space canvas, calibrated-plan limits, object types, numeric editing, optics, paths, layers/locks/visibility, multi-select, history, variants, shot list, preview, import/PNG/CSV/JSON and return context |

Prototype-only or incorrect interactions are not implemented: simulated saves,
imports, exports, viewer success, sample counts/research results, image stand-ins,
invented exact-view bookmarks, fixed scale, Esri source claims, global command
palette, additional keyboard shortcuts and suggested aggregate readiness.
The current app supplies all states and data. Capture availability, research
verification, filming permission and suitability remain separate.

Responsive/accessibility adaptations: retain the established 880px breakpoint,
explicit half/full sheet buttons and existing mobile navigation, numeric editing
alternatives, labelled native controls, focus restoration and save guards.
No automatic panel closure on resize, new peek workflow, removal of map buttons,
or new single-section checklist workflow. Text contrast takes precedence over
the prototype's faintest greys. No extra pane is required for the existing dossier.

No blocking product decision is needed for this compatible scope. A command
palette, new shortcuts, three-state mobile sheet, simultaneous list/dossier,
or changing checklist navigation would be separate workflow proposals requiring
owner input. No framework rewrite, new executable dependency or schema migration.
Design originals and both reference projects remain read-only.

## Reference reuse

Inspected both reference base styles and responsive styles, plus
`LSU3D/js/06-details-panel.js:5-42` and
`Experimental/js/06-details-panel.js:6-44`: retain the existing SLiVR adaptation
of exclusive panels, half/full mobile sheets and map resizing.
`Experimental/css/01-base.css:6-85` supplies the flat, token-based sidebar pattern;
`LSU3D/css/01-base.css:18-128` supplies semantic token aliases and sizing.
Reason 1 deviation: approved SLiVR v2 appearance replaces campus colors, type,
rounded floating rail and branding. Library order, provider containers, request
shapes and lifecycle are unchanged. Neither reference has assessment, project
transfer or image-space editor counterparts (reason 3); reuse SLiVR's existing
components. Font assets are local with a system fallback, not runtime CDN calls.

## Execution evidence

Compatible visual implementation completed locally on 2026-10-08. Phase 5 release
acceptance remains OPEN; D095 owner acceptance is preserved. No product decision
blocks this visual scope. No deployment, staging, commit or push was performed.

Final build: App0.5.0 / transfer1.4.0 / DB2 / template1.0.0 / catalog1.1.0.
Node v24.18.0, Windows x64 10.0.26200. Manifest generated 22:40 UTC:
`outputs/redesign/completion-build-manifest.json` (145 runtime and 36 test files).
Digest uses sorted path/NUL/file-SHA256/newline entries, matching D096's method.

- Runtime SHA-256: `dfcaf3076fcb238741db031ffeacafaaaac69e9d6de842db44706bedc09b9d13`.
- Tests SHA-256: `a20f1cd9a66e682e83a9458ec6c707cabb7cd02d4ccc3f2bc817f9196bee17e0`.
- `node --test tests/*.test.mjs`: **447 PASS, 0 FAIL, 0 skipped**;
  `outputs/redesign/completion-tests.txt`, including shell-cache parity.
- Deployment scope: **236 publication candidates, 0 errors**; catalog:
  **18 locations, 7 areas, 18 captures, 46 sources, 0 errors, 1 retained
  Old City Hall alias warning**. 257 unknown markers remain preserved.
- `git diff --check -- .`: no whitespace errors; LF/CRLF notices only.
- Baseline hash comparison: no missing original files; supplied design originals
  unchanged. Pre-existing Phase 5 work retained. Research/document updates are
  additive; original source checklist stylesheet retained byte-for-byte.

### Critical browser observations

Chrome extension on Windows, isolated local origin `http://127.0.0.1:8767/`,
no-store preview server, fixture project `Visual verification — local fixture`.
Browser version and physical device were not independently measured. Dimensions
below are viewport overrides, not physical-phone/tablet acceptance.

- Desktop 1440x900: neutral tokens/local Geist, real records/search/no-result
  recovery, dossier, local project and scene creation with required INT/EXT
  validation, assessment creation and real Treedis imagery during handoff.
  Rendering alone does not establish provider readiness or pose correctness.
- Phone 390x844: checklist identity, saved `Visual QA fixture` value after reload,
  Sections drawer, existing half/full dossier, future-location uncertainty labels,
  Shot Designer Add/Properties/Layers and visible Tab focus. No outer horizontal
  overflow in inspected checklist, dossier, editor or project-tool views.
- Shot Designer: map-image diagram, camera insertion, keyboard label editing,
  Saved locally feedback, layer identity, persisted label after reload, Escape
  closes Layers, Back restores Explore with project/scene context.
- 1024x768 Explore and 768x1024 project tools: no horizontal document overflow;
  tablet-width project form visually inspected. At 844x390 the 600px app frame
  remains vertically scrollable, with no horizontal overflow.

Screenshots in `outputs/redesign/`: `desktop-explore.png`,
`desktop-shot-designer.png`, `mobile-checklist-final.png`, `mobile-dossier.png`,
`mobile-shot-designer.png`, `tablet-project-tools.png`. These are local verification
artifacts, not public deployment assets. The phone editor image predates the
handler correction below; its appearance is unchanged by that correction.

### Negative results and correction

The first revised suite was **444 PASS / 1 FAIL** because stable234 expected the
old font link (`final-tests.txt`). Updated that link expectation while preserving
all checklist fields/sections and original CSS-hash assertions; subsequent suites
passed. Initial 8766 browser output used stale cached tokens and is not final-build
visual evidence. A scene click timed out during asynchronous creation, then worked
after state inspection. Initial screenshots taken immediately after resize or
selection captured preceding frames; final captures above supersede those views.
`desktop-checklist.png` is floating, not proof of docking. Failed cross-frame
evaluation was replaced by frame-scoped inspection, which confirmed persistence.

Browser locator fill plus Tab did not persist the camera label; keyboard text
entry plus Tab did. Keyboard editing exposed a pre-existing `value` parameter
shadowing the diagram accessor in `src/shot-workspace/editor.js:115-122`:
`TypeError: value is not a function` after the edit had saved. Renamed only that
parameter to `initialValue`; no field, validation or save contract changed.
Reloaded the corrected build, restored the saved camera, edited again, observed
the new layer label and Saved locally, and saw no new application handler error.
The console retained the old error and a separate Grammarly extension error;
this is not a claim of a clean full-session console/network audit.

### Stable-test and acceptance mapping

| Stable IDs | Executed evidence | Remaining scope |
|---|---|---|
| 172-174, 232-236 | Full automated regression; browser shell/search/dossier/checklist and saved-value checks above; catalog PASS | Full live filter combinations and follow/pin lifecycle not rerun |
| 175, 181 | Provider/storage/WebGL failure doubles PASS; real imagery observed | Shared/independent switching, actual failure injection and recovery not rerun |
| 176, 208-215 | Project/assessment/persistence/transfer suites PASS; fixture creation and project-tool layout observed | Full decision/comparison/attachment/transfer lifecycle not rerun |
| 177, 237-250 | Shot/model/optics tests PASS; actual insertion/edit/layers/reload/Escape/return checks above | Full paths/variants/calibration/multi-selection acceptance not rerun |
| 178, 251 | Export/capture tests PASS; real export controls retained | New-build downloads, print/PDF, capture permission lifecycle not rerun |
| 179 | Router/save/history suites PASS; real editor Back/context observed | Full browser Back/Forward and failed-save transition trace not rerun |
| 180, 252 | Two shared-token contrast tests PASS; critical desktop/phone/tablet-width observations | Physical touch/keyboard, screen reader, light-theme/forced-colors/reduced-motion and print rendering not tested |
| 182 | Deployment scope and cache parity PASS; source baseline compared | Published forbidden-path checks, neighboring app and worker lifecycle not rerun; worker OFF |
| 183 | No telemetry added; runtime error corrected and retested as above | Comprehensive console/network audit not performed |

CSS review retained existing safe-area padding, responsive navigation, focus rules,
reduced-motion and forced-color overrides; added a light checklist print palette.
Source review is not browser emulation evidence. The two contrast tests cover
specified opaque token pairs, not every composited pixel or light-theme control.
No participant performance, usability, data-loss-rate or research-validity benefit
was measured. Remaining Phase 5 gates retain their D096 scope and retest conditions.


## D098 correction ? original checklist appearance

Owner clarified that CheckList/v2 remains the checklist appearance authority.
Restored its original font, visible red header, header mobile menu, light-default
and original dark theme, cards and spacing by removing the redesign override
and shared-token links. Original style.css and Inter CSS match the source
byte-for-byte; SLiVR's existing integration.css and assessment/evidence/save
handlers remain unchanged. All earlier D097 checklist screenshots and runtime
digests describe the superseded build. Other redesigned surfaces are retained.
No new Chrome session was used for this narrowly scoped restoration; source/hash
and automated checks do not establish a new visual browser result.


## D098 checklist restoration verification ? 2026-10-08

Supersedes D097 checklist appearance and build target; other visual changes stay.
Original CheckList/v2 stylesheet and Inter CSS verified byte-identical. Stable234
now forbids shared redesign styles/default dark forcing and checks header menu.
Focused suite20 PASS; full suite447 PASS / 0 FAIL / 0 skipped, including Part J
automated contracts and shell-cache parity. Deployment235 candidates / 0 errors;
scoped whitespace check clean. No new browser/device check. D096 live gates remain
OPEN and D095 accepted; no commit/push/deploy.

Runtime SHA256: 643b65d1ae00c12104b4b048e248ea3b7daccb47535787bd75c4fa597a6fb10f
Tests SHA256: a697dc76ae1511113019cdc87d6d4efe9ed1c2e22e8165921568ded916a74234
Manifest: outputs/redesign/original-checklist-build-manifest.json
Test log: outputs/redesign/original-checklist-full-tests.txt
