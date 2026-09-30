# Phase 5 integrated prototype — D096, 2026-09-29

Status: implementation delivered locally; **release acceptance OPEN**. Phase 4
remains CLOSED / ACCEPTED under D095. No previous owner pass is revoked or
requested again. No Phase 6 work, telemetry, commit, staging or push.

Build: App0.5.0 / transfer1.4.0 / DB2 / assessment template1.0.0 /
catalog1.1.0. The ZIP wrapper is `slivr-media-package` version 1; its project.json
uses the existing canonical envelope. No database migration or ID rewrite.
The exact runtime/test digests and final run are recorded below. The owner will perform the full manual test; no extension/browser setup is requested.

## Delivered scope and reference review (test 184)

| Area | Previous implementation | D096 change and source |
|---|---|---|
| Save and routing | Draft flushing; hash routes; save retry | Wait for active writes, retain overlapping failures, latest-transition guard, repair blocked history URL, restore scene/candidate context on traversal. LSU3D `js/17-router.js:179-194,310-335` supplies history/event separation; Experimental `js/10-event-wiring.js:282-335` uses panel navigation, with no persistent workspace equivalent. SLiVR hash grammar and project ownership require the additional guards. |
| Rendering lifecycle | Map/Google and Treedis dispose on surface change; shot editor disposes timers/observer | Add background-tab preview suspension, whole-boot cleanup and unsaved-page guard. Experimental `js/04-street-view.js` retains a shared iframe; SLiVR's accepted multiple-model disposal is retained. Neither reference has a persistent shot editor. No second 3D editor. |
| JSON and media | Canonical JSON, assessment selection, inline assets, emergency export, legacy ZIP reader | Native selected-media ZIP using vendored JSZip3.10.1 and existing canonical validator/atomic import; declared generated paths, size limits, missing/corrupt-media reporting. Both map references have no project/media transfer counterpart. CheckList/v2 `export.js:267-340` supplies the shared file-manifest pattern (D068); SLiVR `data/checklist-import.js:5-25` supplies the pinned loader and bounded-reader shape. |
| Packet and exports | PNG, CSV and diagram emergency JSON | Selectable print sections, assessment sub-sections, immutable evidence, media, dossier summaries, decisions, diagrams and shot lists. Four exports plus ZIP. Add stable IDs to CSV/filenames and PNG context. North arrow only for non-oblique map captures with a known bearing; otherwise label unknown. Neither map reference has a project packet counterpart. |
| Accessibility | Existing trap, focus styles, reduced-motion map/preview and responsive tool windows | Exclude hidden/inert controls, focus empty dialogs, strengthen forced-color state/focus and 44px export labels. LSU3D `js/12-start-screen.js:624-665` supplies existing trap behavior; Experimental `js/10-event-wiring.js:285-335` preserves form input from shortcuts. Existing UI and pin/follow behavior retained. |
| Service worker | Absent | Adapt LSU3D `sw.js:44-122,146-216` and `js/22-service-worker.js:36-118`; Experimental has no worker/controller. Default OFF, exact `/SLiVR/`, `slivr-shell-v1`, provider pass-through, allowlisted public files and network-first switches. Fix recorded unfiltered-unregister defect. All shell modules use network-first to reduce mixed-version risk; defer activation rather than force takeover/reload over unsaved work. No reference telemetry or private files copied. |
| Deployment | Public-path/secret/identity checker | Ignore and explicitly prohibit pre-existing private handoff folder. No files deleted. Synchronize test with the already approved Phase 4 owner-check publication exception. |

The complete reference trees were searched for export, print, history, lifecycle,
keyboard and worker counterparts. Sources were read only. Exceptions above are
architecture requirements, recorded defects, or absent counterparts (CLAUDE.md).
Source inspection is not live-provider evidence.

## Executed evidence

Node tests use fake DOM/IndexedDB/provider/canvas and worker VM doubles except
for real JSZip encoding/decoding, filesystem and catalog checks. They do not
prove browser download, print pagination, real storage quota, live provider
rendering, screen-reader output, tablet ergonomics or real worker installation.

Preserved run logs under ignored `outputs/`:

- `phase5-initial-tests.txt`: 75 PASS / 0 FAIL, early affected regression.
- `phase5-focused-tests.txt`: 10 PASS / 1 FAIL; clean-recovery test omitted opening
  its fake database. Fixed test setup; no failed import product claim.
- `phase5-suite-first.txt`: 436 PASS / 4 FAIL. Two pre-existing deployment
  expectations omitted the accepted public owner-check file; one bookmark test
  read save status before transaction completion; one history-context regression
  overrode explicit candidate/pin behavior. All corrected.
- `phase5-retest.txt`: 101 PASS / 1 FAIL on old failure-message expectation.
- `phase5-retest2.txt`: 69 PASS / 1 FAIL on the old checklist-only failure flow.
  Revised assertion now requires the entire source route to remain open until
  retry, as stable116 requires; pin/follow assertions remain.
- `phase5-regressions.txt`: 90 PASS / 0 FAIL after those corrections.
- `phase5-export-tests.txt`: test module load FAIL due to unused nonexistent
  named import. Removed that test-only import.
- `phase5-export-retest.txt`: 14 PASS / 0 FAIL.

These are separate builds/runs; do not add their counts or substitute historical
D091/D092/D093 results for this build. No participant evidence was collected.

## Stable test mapping and remaining release gates

| Stable IDs | Automated scope / remaining live scope |
|---|---|
| 113-116, 172, 176-177, 179 | Routing, persistence, assessment, shot and shell suites; new transition/history tests. Full integrated trace with screenshots/reload still BLOCKED. |
| 117-122, 178, 208-213, 237-251 affected | Transfer/ZIP/escaping/selection/revision/CSV/canvas contracts, capture regression. Browser downloads, clean-profile media reopening and print/PDF readability BLOCKED. PNG pixels are not proven by canvas doubles. |
| 123-127, 180, 214 | Existing responsive/focus/reduced-motion tests and new export controls. Desktop/tablet touch/keyboard/contrast and screen-reader checks BLOCKED. |
| 128-129, 181, 215 | Provider/WebGL/storage doubles and disposal suites. Repeated real-provider sessions, memory trend and real failure injection BLOCKED. |
| 130-132, 182-183 | Deployment/catalog checks, allowlist parity and worker registration/fetch/removal doubles. Published forbidden-path 404s, neighboring real apps, console/network and worker upgrade/offline/kill-switch behavior BLOCKED. Default remains OFF. |
| 133-140 | This review, decision/feature/change/measurement/limitations records synchronized. Technical evidence distinguished from design rationale; no live release or participant result claimed. |

Browser inventory returned zero browsers/apps; `createBrowserTab("chrome")`
reported `Browser is not available: chrome`. No owner localhost tab or saved
diagram was opened, reloaded or modified. No new acceptance exception is assumed.

## Focused live completion procedure

Use a separate browser profile and isolated origin serving `/SLiVR/`. Create
disposable projects only. Follow IMPLEMENTATION_PLAN §7's amended trace: 18
locations, dated assessment with false/zero/unknown and owned media, immutable
decision revision, entry-only bookmark, screenshot/imported-plan image overlay,
path/variant and reload. Test Back/Forward and rapid navigation during successful
and failed saves, including checklist follow/pin. Export JSON, ZIP, PNG, CSV and
selected print packet; recover JSON and ZIP into another clean profile. Open media,
inspect identifiers, missing-media report, evidence revisions, attribution and
print/PDF page breaks. Retest changed PNG/CSV metadata and export controls.

Repeat critical trace with each provider unavailable, WebGL lost and storage
failure enabled; recover pending work via retry and emergency JSON. Check desktop
and tablet keyboard/touch/focus/contrast/reduced-motion and repeated session resource
counts. Test worker opt-in/update/offline/default-off and `?sw=off` on an isolated
origin with a neighboring registration/cache; confirm provider responses never
enter the shell cache. Restore config to OFF. Check actual deployment forbidden
paths and console/network. These are Phase 5 checks, not requests to repeat D095
acceptance. Record exact browser/device/build and failures before closing Phase 5.


## Final verified build and safe stopping point

Final execution 2026-09-29 16:26 UTC, Node v24.18.0, Windows win32 x64,
OS release 10.0.26200. App0.5.0 / transfer1.4.0 / DB2 / template1.0.0 /
catalog1.1.0. Runtime manifest covers 138 files; test manifest covers 35 files.

- Runtime SHA-256: `a9b7ab92767e159b8b306a402599d2412aa8610755d80bbe3a7a21a492832caf`.
- Tests SHA-256: `696ea6858f47d9ac55217fadf1c8a96e184de32617c445e4517edd18418ff48d`.
- `node --test tests/*.test.mjs`: **445 PASS, 0 FAIL, 0 skipped** in
  `outputs/phase5-final-verified-tests.txt` (6510.98 ms).
- `node tools/check-deploy-scope.mjs`: **226 publishable files, 0 errors** in
  `outputs/phase5-deploy-check-final.txt`. Local publication-candidate inspection,
  not a remote deployment test.
- `node tools/validate-catalog.mjs`: **0 errors, 1 retained name-alias warning**;
  18 locations, 7 areas, 18 captures, 46 sources, 257 preserved unknown values.
- `git diff --check -- .`: no whitespace errors; Git reported LF/CRLF conversion
  notices. No staging, commit, push or reference-project mutation.

Additional preserved runs: `phase5-final-tests.txt` was 444 PASS on the earlier
runtime `7d24ec85e1e260c0375592b63b7e86fadf5a7bd1ebe646c6c03a1c71d214da5d`
and tests `153667413b928f961265bd18fbd8f8cd9c1bcd7692775fe966f41b0b42099f97`.
Final review found that a later successful autosave must supersede an earlier
failed write for that same owned diagram/scouting bundle, without hiding other
failures. Added keyed failure tracking and its regression; the affected run
`phase5-save-supersession.txt` passed 56/56, then the final full suite passed 445/445.

The owner subsequently confirmed they will perform the full manual test and that
extension use is unnecessary. All live items above are handed off for owner
execution, not requested extension setup or acceptance reconfirmation. Stop here
safely: runtime implementation and automation finished, no pending processes or
fixture writes, service worker OFF. Phase 5 release acceptance remains OPEN until
manual results are supplied. Preserve D095 Phase 4 acceptance unchanged.
