# Phase 5 new CLI prompt

Copy the text below into a new CLI session.

```text
Work in E:\sroberto27.github.io\SLiVR. Start and carry out Phase 5 - Integrated
prototype and release validation (F20 baseline). This is an implementation task,
not just a planning review. Do not implement Phase 6.

Read AGENTS.md and CLAUDE.md first. Inspect repository-wide Git status, branch,
upstream and existing changes before editing. Then read:
- SLIVR_ARCHITECTURE_AND_FEATURES.md
- IMPLEMENTATION_PLAN.md, especially Phase 5 and the integrated acceptance trace
- PHASE_4_IMAGE_OVERLAY_PLAN.md (approved D090 replacement of the old 3D editor)
- PHASE_4_RESUME.md
- research/PHASE_4_ACCEPTANCE_REVIEW.md (D095 current closeout)
- docs/FULL-SYSTEM-TESTING.md and docs/PHASE_4_OWNER_CHECK.md
- SCOUTING_ASSESSMENTS_PLAN.md and applicable research records

Accepted baseline:
- Phase 4 is CLOSED / ACCEPTED under D095, confirmed 2026-09-29.
- All seven D091/D092 critical owner checks passed.
- D093 immersive capture check 251 passed: screenshot/credits/footer, no SLiVR
  overlays, stream cleanup, editing, JSON/PNG export, reload persistence, return,
  cancellation/retry, wrong-tab/window rejection and unsupported-browser import.
- The owner also confirmed shot-workspace failure recovery and calibrated-plan
  persistence after reload and explicitly instructed Phase 4 closure.
- These are owner-reported results. Browser/device details were not supplied.
  Do not invent them, request reconfirmation or reopen superseded D094 holds.
- D093 publication: af8aa819076d69abacdef0828d466567192a3821 on origin/main.
  App0.4.0 / transfer1.4.0 / DB2 / template1.0.0 / catalog1.1.0.
- Historical automation: D091 423 full-suite PASS; D092 51 focused PASS;
  D093 56 initial focused PASS and 6 final capture/action PASS. Separate runs,
  not a new final-build full-suite result. The documentation closeout ran no
  runtime tests. Preserve historical failures and earlier evidence.

Reference-first implementation is mandatory. Inspect BOTH approved read-only
projects for counterparts before writing new modules:
E:\sroberto27.github.io\Wrapper\map\LSU3D
E:\sroberto27.github.io\Wrapper\map\Experimental
Adapt applicable working code; record source files/lines and necessary deviations
in research/DECISION_RECORD.md. SCSU is a general reference, not just Treedis;
its working Treedis integration remains the preferred provider starting point.
Never edit either reference project.

Phase 5 scope and first work:
1. Inventory what is already implemented in exports, routing, persistence,
   lifecycle, accessibility and deployment. Identify the remaining Phase 5 work
   against the actual plan. Preserve the current UI and accepted workflows;
   do not introduce an unrelated redesign.
2. Reconcile the integrated acceptance trace with D068 scouting assessments and
   D090/D093 image-overlay capture. Keep legacy ENU records, evidence revisions,
   ownership, stable IDs and entry-only bookmark limitations. Do not resurrect
   a second 3D editor or infer physical measurements from oblique screenshots.
3. Follow the plan's work order: save-before-transition, Back/Forward context,
   resource disposal/suspension, then remaining export and release work.
4. Complete canonical project JSON/media ZIP export/import, selected-media and
   missing-media reporting, clean-profile recovery, and print-ready packets with
   user-selected sections, assessments, evidence, diagrams and shot lists.
   Preserve emergency recovery, safe escaping and filename policy.
5. Harden keyboard access, focus, contrast, non-color status, reduced motion and
   tablet layouts. Preserve Explore/checklist follow/pin and shot save guards.
6. Implement the planned service-worker lifecycle from reference evidence:
   default OFF; scope /SLiVR/; slivr-shell-v1 cache namespace; provider never-cache
   rules including maps.dotd.la.gov, spaces.dtsxr.com and tile.googleapis.com;
   kill switches network-first; filter registrations by SLiVR scope before
   unregistering. Never affect neighboring applications or cache provider content.
7. Validate the integrated workflow, four exports plus native media ZIP/recovery,
   history/context, provider/WebGL/storage failures and deployment isolation.
   Keep private references, credentials and the existing private handoff folder
   out of deployable content. Do not delete user files to pass a deployment check.

Verification and evidence:
- Map work to stable tests 113-132, 133-140, assessment tests 208-215 and Part J
  172-183, with affected 237-251 regressions. Do not renumber existing tests.
- Run meaningful affected tests as work progresses and the required Phase 5
  section plus Part J before claiming completion. Avoid redundant broad sweeps.
- Preserve earlier owner passes; retest changed behavior and the required Phase 5
  integrated trace. Separate automated doubles from live browser/device evidence.
- Use isolated test origins/profiles. Protect the owner's saved diagrams and
  localhost tabs; never overwrite real projects for fixtures.
- Record exact executed build/environment, failures and limitations. If live
  checks cannot run, report the narrow remaining acceptance steps honestly.
  Do not pre-mark Phase 5 PASS or claim a release from automation alone.
- Synchronize the living test specification and phase-boundary feature/evidence,
  decision, change-log, measurement and limitations research records.

Boundaries:
- Edit only SLiVR. Preserve all existing local changes, including uncommitted
  D093/runtime/test changes and closeout documentation. Do not reset, stash,
  clean, stage, commit or push unless explicitly authorized later.
- Do not push unrelated history from the current working branch. The published
  commit identifies the baseline; it is not permission to reset the workspace.
- No Phase 6 proxy/probe/collector, participant logging, background telemetry,
  experimental manipulation or later-roadmap scope.

Begin with a concise gap assessment and implementation sequence, then proceed
with the authorized work. Finish with changes made, exact validation results,
remaining live acceptance items, and a resumable Phase 5 handoff.
```
