Continue SLiVR Phase 4 in E:\sroberto27.github.io\SLiVR.

Read AGENTS.md and CLAUDE.md, then:
- SLIVR_ARCHITECTURE_AND_FEATURES.md
- IMPLEMENTATION_PLAN.md (Phase 4 and binding reuse obligations)
- SCOUTING_ASSESSMENTS_PLAN.md (D068 dependency and test 213)
- research/PHASE_3_ACCEPTANCE_REVIEW.md (D089 closeout)
- research/DECISION_RECORD.md (D068 and D086-D089)
- docs/FULL-SYSTEM-TESTING.md and docs/UI_INTERACTION_DESIGN.md

Phase 3 is COMPLETE for its delivered scope. Preserve all owner-reported passes;
do not request repeated acceptance. App0.3.7, DB2, transfer1.3.0, template1.0.0,
catalog1.1.0;409 automated tests pass. Phase2 entry-only bookmarks remain accepted
under E2. E1 assigns shot actions to Phase4 and the integrated retest to Phase5.
Read D089 for exact evidence and limitations; do not generalize automated or
Chrome responsive checks into physical-device/provider guarantees.

Implement Phase4 Shot Designer Core (F08-F12): one scene model driving Canvas2D
plan and Three.js perspective views; approved camera/actor/mark/object set;
selection/transforms, undo/redo, camera/lens/FOV, paths and deterministic preview,
shot list and variants, floor-plan import/calibration, autosave, PNG and safe CSV.
Keep selected scouting findings and owned assessment revision references visible
under D068. Provider imagery is optional context; loss must not remove authored
objects. Imported backgrounds stay schematic until calibrated. Do not claim
survey accuracy, exact tour pose or filming permission.

Inspect BOTH read-only references before implementation:
E:\sroberto27.github.io\Wrapper\map\LSU3D
E:\sroberto27.github.io\Wrapper\map\Experimental
Inspect relevant private shot-design reference locally; do not publish it.
Adapt applicable working code and record source/deviation. Edit only SLiVR.
Preserve unified Explore, responsive panels, V2 checklist appearance, automatic
location following/pinning, project records and all uncommitted user changes.

Work through Phase4 dependency order and stable tests85-112,118,119,121,213 and
Part J. Update research evidence and acceptance records. Complete implementation
and appropriate automated checks; use Chrome extension only for critical live
checks. Never claim unexecuted tests passed. Keep required new owner/device
acceptance explicit and narrow. No telemetry, site-data clearing, reference
edits, staging, commits or pushes unless separately requested in this session.

Git: inspect branch/upstream/worktree first. Phase3 was published via a clean
origin/main-based SLiVR-only branch because the original working branch contains
unrelated history. Do not push that unrelated history or overwrite user changes.
