Current handoff: read PHASE_4_RESUME.md and docs/PHASE_4_OWNER_CHECK.md first.
D091: implementation approved and resumed. The local image-overlay editor is
ready for focused owner checks, not Phase 4 acceptance. Do not follow the older
planning hold below. Avoid redundant testing: owner requested a short manual
critical-test list. No commit/push, unrelated changes or telemetry authorized.

Continue SLiVR Phase 4 planning in E:\sroberto27.github.io\SLiVR.

D090: the owner authorized a revised plan only. Read
PHASE_4_IMAGE_OVERLAY_PLAN.md FIRST. Do not implement until the owner explicitly
approves that revised plan. Its dependency order, source-use gate and test mapping
supersede the former dual-view implementation instructions.

Read AGENTS.md and CLAUDE.md, then:
- SLIVR_ARCHITECTURE_AND_FEATURES.md
- IMPLEMENTATION_PLAN.md (Phase 4 and binding reuse obligations)
- SCOUTING_ASSESSMENTS_PLAN.md (D068 dependency and test 213)
- research/PHASE_3_ACCEPTANCE_REVIEW.md (D089 closeout)
- research/DECISION_RECORD.md (D068 and D086-D090)
- docs/FULL-SYSTEM-TESTING.md and docs/UI_INTERACTION_DESIGN.md

Phase 3 is COMPLETE for its delivered scope. Preserve all owner-reported passes;
do not request repeated acceptance. App0.3.7, DB2, transfer1.3.0, template1.0.0,
catalog1.1.0;409 automated tests pass. Phase2 entry-only bookmarks remain accepted
under E2. E1 assigns shot actions to Phase4 and the integrated retest to Phase5.
Read D089 for exact evidence and limitations; do not generalize automated or
Chrome responsive checks into physical-device/provider guarantees.

Proposed Phase4 Shot Designer Core (F08-F12): one captured map image with editable
2D overlays. Keep cameras/actors/marks/arrows/objects, selection/transforms,
undo/redo, camera metadata/numeric FOV, paths and deterministic symbol preview,
shot list, variants, owned-plan calibration, autosave, PNG and safe CSV.
No authored 3D viewport or physically projected frustum over screenshots.
Never replace a saved background on tab navigation. Google Map Tiles screenshot
storage/export permission is unresolved; follow the revised source-use gate.
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

After explicit implementation approval, work through the revised dependency
order and tests237-248 plus retained tests in plan section9,213 and Part J.
Update research evidence and acceptance records. Use Chrome only for critical live
checks. Never claim unexecuted tests passed. Keep required new owner/device
acceptance explicit and narrow. No telemetry, site-data clearing, reference
edits, staging, commits or pushes unless separately requested in this session.

Git: inspect branch/upstream/worktree first. Phase3 was published via a clean
origin/main-based SLiVR-only branch because the original working branch contains
unrelated history. Do not push that unrelated history or overwrite user changes.
