# Phase 1 acceptance review and closeout proposal

2026-09-22, D071. **Phase 1 OPEN; Phase 2 dependent implementation BLOCKED.**
This is a reviewable proposal, not an approved exception or a phase closeout.
Phase 0 remains complete under D061; its carried obligations remain open.

## Executed build and evidence

- Local HEAD `318316612d8c44031eae835e4b1760843d3ebe6c`, branch
  `content-migration-2026-09-07`, plus D071 working changes. Published baseline
  `f2627108`; local Git comparison of those commits found no SLiVR path differences.
  No fetch, branch change, staging, commit or push was performed.
- Final runtime SHA256:
  `c1a979196d5a331308cce0853410bead57c8590c33997e8476dc30430145dde3`.
  D069 algorithm: 93 sorted POSIX paths comprising index.html and src/styles/config/
  data/vendor, excluding config/runtime.js; hash UTF-8 path, NUL, bytes, NUL.
  Documentation, tests and diagnostic tools are outside this runtime digest.
- Windows/PowerShell, Node v24.18.0; app 0.2.0, MapLibre 4.7.1, catalog 1.1.0,
  record/transfer schema 1.0.0, workspace schema 1, adapter treedis-recon-2.
  Provider configuration, catalog and adapter lifecycle are unchanged.
- Baseline automated run: **352 PASS, 0 FAIL**. Diagnostic regression before
  correction: **24 PASS, 1 FAIL** in immersive.test.mjs. Corrected full run:
  **352 PASS, 0 FAIL**. Added exact four-location sequence: targeted immersive and
  reference suites **39 PASS, 0 FAIL**. Final full suite: **353 PASS, 0 FAIL**.
  The failed diagnostic run remains in the evidence folder.
- Catalog validation: zero errors, one existing Old City Hall alias warning;
  18 locations, 11 current/seven future, seven areas, 257 preserved unknown values.
- Browser discovery returned `apps=[]`, `browsers=[]`; creating an in-app tab at
  `http://localhost:8000/#/explore` failed with `Browser is not available: iab`.
  No page was opened. No browser version, viewport, screenshot, live IndexedDB,
  provider rendering or console observation exists for this run.
- Logs are local and ignored under `outputs/acceptance-2026-09-22/`:
  tests.txt, diagnostic-before-fix.txt, tests-final.txt, recon-tests.txt,
  tests-complete.txt, catalog.txt, deploy.txt, deploy-final.txt, treedis-http.txt,
  identity.json and treedis/treedis-probe.json.
  See the capability matrix for the separately executed HTTP-only provider probe.
- Final deployment scan: 158 publishable files, zero errors. Whitespace check:
  no errors; existing Git LF/CRLF conversion notices are not runtime findings.

The owner report for checklist 1-14 is retained as historical functional evidence.
The screenshot's presentation failures remain **FAIL on that earlier build**.
D070's correction has no executed live retest and remains **BLOCKED**.
Checklist 15 (forced failure variants) and 16 (workspace reload/export) remain
**NOT TESTED**; an automated double does not change either owner-report status.

## Outstanding gates and exact retest conditions

| Gate | Current live status | Required next execution |
|---|---|---|
| 218; affected 180, 204-205, 217 | BLOCKED; prior presentation FAIL retained | On matching runtime, inspect floating imagery-backed rail, every full name, round count badges, panel collapse/restore, click/Enter/Space group fit, padding, reduced motion, 3D bearing/pitch, group edges and coincident-member selection. Run 1440x900, 1024x768, 390x844, short landscape and an actual tablet; record screenshots and input method. |
| 31-43, 45, 48-49, 174, 179, 216 | BLOCKED for fresh live acceptance | Find/select/link all 18; LOC-003 from map and list; all ten filters and four named sorts; seven future entries without tours; unknown labels, sources, public link in fresh tab, clipboard denial, history and discovery restoration. |
| 46-47, 181; owner item 15 | BLOCKED for this run; owner item NOT TESTED | In a disposable profile, block map library, primary then both DOTD sources, Treedis and optional Google. Verify usable list/dossier, neutral/fallback attribution, retry after unblock, bounded viewer wait/return and no stale content. Restore request rules. |
| D061 tests 13, 16-19; owner item 16 | BLOCKED for this run; owner item NOT TESTED | Reject malformed catalog visibly; inspect real slivr-workspace stores/indexes; write full linked fixture, reload and compare IDs/references/zero values; export/import clean profile; cancel/copy/replace conflicts and invalid/future-schema rejection without partial writes. Before expanding persistence. |
| 20-21, 178, 181 storage recovery | BLOCKED live | Force SLiVR write failure; retain edits, visible recovery, emergency JSON, reload/reimport; remove only the SLiVR diagnostics key. Do not clear shared-origin storage. |
| D061 tests 26, 180-183 | BLOCKED for device/provider/console checks; neighboring-app runtime isolation NOT TESTED | Desktop/tablet keyboard/focus/contrast, supported GPU/provider loss variants, fresh console/network after reload, neighboring apps unchanged and no participant telemetry. Automated isolation/deployment checks are separate. |
| 44 integrated actions | NOT TESTED for later-phase actions | Apply the proposed allocation below only after explicit owner approval; do not mark complete from Immersive/link tests. |
| D061 test 28, Phase 2 tests 50-67 and 208 dependency | BLOCKED live; bookmark workflow NOT TESTED | Per-capture reports plus rendered/arrival observations; exact downtown/Magnolia/Moncus sequence, Explore return and eventual bookmark reload/restore. Capture date/extent/rights stay unknown until supplied evidence. |

## Proposed test 44 phase allocation — owner approval pending

Keep stable test ID 44 and its full integrated procedure. Split its acceptance
accounting into these portions, without adding placeholder controls:

| Portion | Delivery/exit obligation | Present result |
|---|---|---|
| Current-capture dossier -> Immersive, stable location/capture IDs; public location link | Phase 1 | Automated PASS; fresh browser entry/clipboard/link check BLOCKED |
| Add/open candidate and compare, active project/scene context | Phase 3, with 71, 73, 77 and D068 207-208 | NOT TESTED; not implemented |
| Create/open shot with project/location/candidate context | Phase 4, with 78 and affected shot tests; integrated trace again in Phase 5 | NOT TESTED; not implemented |

**Proposed bounded exception E1:** permit Phase 1 acceptance without test 44's
unimplemented Phase 3/4 portions, while requiring its delivered Phase 1 portions
and every other applicable Phase 1 gate to pass. Retest the candidate portions
at Phase 3 delivery, shot portions at Phase 4 delivery, and all of test 44 at
Phase 5 integrated acceptance. No other failing, blocked or untested item in the
table is waived by E1. Approval has **not** been received.

Approval is necessary because architecture section 9 makes phase exit a
prerequisite and FULL-SYSTEM-TESTING.md requires a passed test or an explicitly
approved exception. D068 assigns working assessment entry/editor actions to
Phase 3; it does not approve a general Phase 1 waiver. Recommended closeout is
E1 plus executed live retests, not a blanket exception for browser unavailability.
Do not close Phase 1 or begin dependent Phase 2 implementation from this proposal.

## Owner retest checklist

Record URL, exact build/digest, browser/version, device, viewport, hard refresh,
and PASS/FAIL/BLOCKED/NOT TESTED per item. Preserve failed screenshots and errors.

1. **D070 presentation:** at desktop and narrow/tablet sizes, read all names;
   hide/show the floating panel; activate round groups by mouse and keyboard;
   verify visible members, padding, reduced motion, coincident selection and Recenter.
2. **Discovery/dossier:** LOC-003 from map/list; filter and clear; future LOC-012
   and LOC-018; sources/unknowns; fresh public link; Back/Forward and focus return.
3. **Failure recovery (prior item 15):** block/unblock map, DOTD, Treedis and
   optional 3D requests; retain usable list/dossier, clear status and working retry.
4. **Storage/transfer (prior item 16 and D061):** disposable full linked fixture,
   real IndexedDB store/index audit, reload, clean-profile import/conflicts,
   malformed catalog/JSON, forced write failure and emergency export.
5. **Provider reconnaissance:** use tools/treedis-recon.html for all 11 entries;
   separately exercise app LOC-001 -> LOC-005 -> LOC-009 -> LOC-011. Save reports
   and visual/arrival evidence; note Explore camera/filter/selection on return.
   The harness reloads entries; its sibling Navigate controls test within-frame
   navigation. Do not infer production session reuse from harness entry clicks.
6. **Part J and decision:** record keyboard/tablet/console/network/isolation
   results and an explicit decision on E1. Bookmark UI is absent; do not report
   a save/restore PASS until implementation and its prerequisites are delivered.


#### D077 owner scope clarification

Owner explicitly confirms "yeah all the test even the ones before the map" in response to the question naming earlier provider-failure and real-browser storage/reload/export/import checks. All earlier instructed delivered-function checklists, including owner 15-16, are now owner-reported PASS. Preserve earlier NOT TESTED/BLOCKED/FAIL entries as historical; do not repeat those checks solely for missing tool access. Browser/version/device and exact tested digest remain unspecified. This does not make unimplemented bookmark save/restore tested, supply absent raw provider reports, or explicitly approve E1. Bookmark-specific and later-phase workflows remain NOT TESTED. No runtime changes or new automated execution.
## E1 owner approval - 2026-09-22

Owner explicitly answered: "Yes, test them when built" to allocating project
actions to Phase 3, shot actions to Phase 4 and integrated verification to
Phase 5, while preserving earlier passes. **E1 is APPROVED** with exactly the
scope/retest conditions in the proposal below. Earlier "pending" statements
are historical. No other exception is granted by this answer.

All previously instructed delivered-function tests remain owner-reported PASS
under D077; browser/device/exact-build metadata remain unspecified. E1 resolves
the remaining test-44 allocation gate for the accepted Phase 1 baseline.
Phase 1 baseline is accepted on that evidence plus E1. D078's new camera
correction has 365 passing automated checks but still requires its own live
225/64 check; this does not erase the owner's earlier passes. Phase 2 bookmarks
and raw capability prerequisites are separate, unresolved obligations.
