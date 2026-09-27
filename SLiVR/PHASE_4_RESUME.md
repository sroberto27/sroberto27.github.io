# Phase 4 current handoff

Updated 2026-09-26 after explicit resume. D091 local implementation is ready for
focused owner review; Phase 4 is not accepted or deployed. Read AGENTS.md and
CLAUDE.md. No commit/push, telemetry or unrelated changes authorized.

## Current result

- Screenshot-based editor, persistence, image import/calibration, variants,
  camera setups, shot list, evidence and exports are implemented locally.
- Priority owner path fixes: repeated actor/camera symbols at every step,
  numbers INSIDE icons without white badges, dark connecting plus directional
  camera lines, actor-colored paths and arrows per leg.
- Per-path Path line style offers Straight / Smooth curve / Spaced curve
  (automatic). Spaced curves keep steps fixed; no global collision avoidance.
- Old diagrams/legacy ENU records are preserved. App0.4.0 / transfer1.4.0 / DB2;
  template1.0.0 / catalog1.1.0. No new dependency or reference-project edits.
- Added keyboard Add path step, removable variants, import-preview image rotation,
  bounded history, stale-save rejection and capture attribution/source guards.

## Verification and next action

423 automated PASS / 0 FAIL in outputs/phase4-final-tests.txt. Deployment scope
210 files / 0 errors. Catalog valid with its existing name warning. Limited
Chrome checks verified saved camera reload and shared path rendering; they are
not full phase acceptance. Initial 408/1 failure log remains as history.

The owner asked to minimize unnecessary testing and will run the critical manual
list: docs/PHASE_4_OWNER_CHECK.md (six checks; maps to 237-249). Do not launch broad
repeated browser/test sweeps. Address reported failures and run only affected
checks. Record exact owner results without replacing earlier D089 owner passes.

Full live Google capture, evidence-return, storage-failure recovery, export-viewer
and mobile/physical-device acceptance remain pending. The owner authorized Google
screenshots with attribution; prior policy limitations remain honestly recorded.

## Git and runtime boundaries

Branch content-migration-2026-09-07 includes unrelated history and uncommitted
changes outside SLiVR. Do not stage/reset/stash/clean or push that history. All
implementation changes are under SLiVR. Both Wrapper/map/LSU3D and Experimental
are read-only, inspected references with no persistent shot-editor counterpart.
The owner's localhost:8000 tabs contain real diagrams: do not reload or alter
those tabs without protecting their saves. Browser testing used isolated origins.
No production deployment changed.

## Publication and next UI proposal

Owner authorized committing and pushing the current SLiVR changes on 2026-09-26.
Publish only a SLiVR-scoped commit based on origin/main, excluding unrelated
working-branch history. This authorization does not imply Phase 4 acceptance.

Owner subsequently approved the full UI proposal. D092 implements desktop top
menus, mobile labeled dock/sheets, grouped Properties, explicit Layers selection
and states, shot summaries and focus preservation. No schema migration. Latest
changes are local and uncommitted; previous publication is 2fbcdcd7 on origin/main.
Local working-branch publication counterpart is 15bcdc89. Do not push unrelated
history. Menu checks: 51 focused Node PASS, limited Chrome fixture checks, owner
test 250 pending. Next: owner menu review and remaining six Phase 4 critical
checks in docs/PHASE_4_OWNER_CHECK.md. Preserve all earlier owner passes.
