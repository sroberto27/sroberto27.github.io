# Phase 3 readiness reconnaissance - D079

2026-09-22. Read-only preparation; no assessment editor delivered.

Both approved map reference js trees were searched for project/bookmark/
assessment counterparts. Neither supplies persistent scouting records. Retain
the existing SLiVR repository, ID policy, migrations and transfer. SCSU bridge
and street-view code remain the preferred entry/navigation source; neither
reference is edited. D068's CheckList/v2 source table must be inspected before
implementing the assessment editor/media/legacy importer.

Current foundation reviewed: `src/domain/project.js`, `scene-brief.js`,
`candidate.js`, `bookmark.js`; `src/data/migrations.js`, `workspace-repo.js`,
`transfer.js`, `conflicts.js`; app actions and Projects/Immersive shell.
One database, workspace version 1; transfer/record 1.0.0. Bookmarks carry project,
optional candidate, location/capture/experience/sweep and catalog/adapter version
identity. D079 entry-only bookmarks are portable; unverified legacy views stay
intact without restore. Assessment evidence may reference the named entry only,
never represent it as the camera view or room observed.

Required Phase 3 work order after acceptance: project editing and safe deletion
report -> scene briefs -> idempotent candidates -> dated assessments and immutable
revisions -> requirement evaluations -> comparison -> preferred/backup decision.
Current candidate foundation has `considering` and met/notMet/unknown values;
approved Phase 3 lifecycle/fit vocabulary is richer. Introduce explicit versioned
migration rather than silently relabeling historical decisions. The current
project delete UI is immediate; add the approved owned-record review/confirmation
before broadening the workspace. Preserve failed saves and project-load generation
guards added for bookmarks. Add assessment/media stores and all schema/transfer/
conflict/deletion contracts together, not a second persistence owner.

Shared editor must work in Projects, dossier and Immersive with explicit project,
scene/candidate/location context; unknown/false/zero remain distinct. Provider
failure must leave assessment editing usable. Requirements point at immutable
assessment revisions/questions; comparisons flag later evidence changes. Add
supplied-file media/flat-panorama fallback with disposal; no sensors, telemetry,
private contact/permission-management fields or unimplemented shot buttons.

Exit tests: 68-84, 206-212, 214-215 and Part J; 208 uses only supported entry
bookmark evidence. E1 moves relevant test-44 actions here, with integrated Phase 5
retest. New bookmark/browser tests 60-62/226 and camera 64/225 remain pending;
Phase 3 dependent implementation cannot be claimed started or complete yet.
## D081 status update

D080 owner acceptance closed Phase 2 under entry-only E2. Its former gate below
is resolved. Phase 3 has started with project metadata editing/safe deletion and
scene briefs/reordering/linked-record protection. App 0.3.0, transfer 1.1.0,
database 1; 381 automated PASS. New editing UI live checks NOT TESTED. Next step:
idempotent candidates, then D068 assessments. Full autosave/cross-mode workspace
context remains outstanding. The original source findings below remain useful;
their pending Phase 2 status is historical.
