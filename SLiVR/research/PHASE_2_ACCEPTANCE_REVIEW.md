# Phase 2 acceptance review and CLI handoff

2026-09-22, D077. Phase 2 remains OPEN; this is not a completion certificate.

## Owner acceptance

After D076, the owner reports: "the test all passed" and requests phase completion and a next-CLI prompt. Record the immediately preceding mini-map retest as owner-reported PASS (stable 222/224 presentation and interactions). This supersedes pending owner retest for that increment, while preserving the earlier screenshot failure. Exact tested digest, browser/version, viewport and device coverage were not supplied. The earlier screenshot was localhost:8000/#/immersive/LOC-005; do not infer that every later check used that environment. The owner subsequently explicitly confirmed all earlier tests, including the provider-failure and real-browser storage/reload/export/import checks named in the clarification. Record those executed owner checks as owner-reported PASS; do not request repetition solely because tool-driven live observation was unavailable. Do not expand this report to unimplemented bookmarks, delivery of raw provider capability reports, or approval of test-allocation exceptions.

Latest executed automated evidence remains 363 PASS, zero failures, Windows Node v24.18.0, local HEAD 318316612d8c44031eae835e4b1760843d3ebe6c plus D071-D076 runtime worktree. Exact runtime digest and logs are in docs/FULL-SYSTEM-TESTING.md D076. D077 changes documentation only. No automated run or live provider run is claimed for this documentation update.

## Exact remaining obligations

| Obligation | Status | Completion / retest condition |
|---|---|---|
| Basic bookmark save/restore, tests 60-62 | NOT IMPLEMENTED; workflow NOT TESTED | After persistence/capability prerequisites pass, implement real project-owned save/name/note/reload/restore through existing repository. Retest supported restoration and explicit unsupported/retired-view recovery, reload, transfer and failed writes. |
| Bookmark evidence identity, D068 / 208 dependency | Schema foundation only | Validate project/location/capture/experience/candidate agreement, catalogVersion, honest captureVersionRef and adapterCapabilityVersion. Preserve zero fields; no assessment editor until Phase 3. |
| Provider capabilities for dependent bookmarks | Raw per-entry observations incomplete | Obtain actual reports and rendered/arrival evidence for downtown, Magnolia and Moncus. Distinguish entry-only restoration from full pose restoration; do not interpret raw rotation units or enable screenshots/media without evidence/authorization. |
| Earlier owner catalog/storage/failure checklists, including 15-16 | Owner-reported PASS after explicit scope clarification; earlier NOT TESTED history retained | Carry the confirmed manual results forward. Browser/version/device and tested digest remain unspecified. Automated persistence contracts already pass; verify new bookmark-specific persistence behavior when implemented. |
| Phase 1 test 44 split E1 | Proposed, not explicitly approved | Retain Phase 1 delivered action tests. Obtain explicit approval for allocation of candidate/comparison to Phase 3 and shots to Phase 4, with integrated Phase 5 retest. No blanket waiver. |
| Explore return, test 64 | Current selected pin/filter linkage implemented; exact prior camera snapshot absent | Reconcile selected-location recenter behavior requested by owner with preserved Explore view/context; implement and test any remaining camera-state contract without overriding selected-location handoff. |
| Earlier delivered-function manual checklists | Owner reports all earlier tests PASS | Retain reported passes for instructed checks; record missing environment metadata honestly. Unimplemented bookmark and later-phase integrated workflows remain NOT TESTED. Run changed-feature regressions during further implementation. |

A bounded exception proposal must name each deferred obligation, rationale, scope, target phase and retest condition; owner approval is required. No exception was granted by D077. Independent Phase 3 source reconnaissance may proceed, but dependent implementation waits for prerequisite passes or exact approved exceptions.

## Handoff prompt

Copy docs/NEXT_CLI_PROMPT.md. It preserves implemented work and directs the next session to finish Phase 2 before Phase 3. No commit/push authorized.
## Current continuation - 2026-09-22, D078

Owner approved E1: "Yes, test them when built." Test 44 candidate/comparison
actions are due in Phase 3, shots in Phase 4, the integrated trace in Phase 5;
delivered Phase 1 passes are retained. E1 is no longer a pending approval.

Explore camera retention is implemented: restore the numeric session view on
unselected return; selected Immersive return still focuses that pin, retaining
orientation/discovery context. Stable 225 extends 64. Full automation 365 PASS,
zero failures; new live camera check NOT TESTED. Current HEAD fd4900a6 is newer
than the old handoff. See FULL-SYSTEM-TESTING D078 for exact identity.

Fresh raw provider capability evidence remains unavailable: no browser surface,
and opening the harness failed. Entry-only bookmark delivery using previously
owner-tested entry links has been proposed as a bounded scope; owner approval
is pending. Exact-angle restoration, raw pose interpretation and screenshots
remain unavailable. New bookmark workflow tests must be executed before phase
closure; earlier passes never cover an unimplemented workflow. Phase 3 remains
dependent on Phase 2 acceptance or a separate exact approved exception.
## D079 current status - 2026-09-22

**Entry-only bookmarks implemented; Phase 2 acceptance OPEN.** This supersedes
the earlier NOT IMPLEMENTED rows, without changing their historical evidence.
E1 approved. E2 entry-only scope approved explicitly: "Yes, finish entry-only
bookmarks." No exact-angle, raw pose or screenshot capability is claimed.

| Remaining item | Current result / next condition |
|---|---|
| Save/name/note, project ownership, reload/transfer, recovery (60-62, 226) | Implemented; automated PASS. New browser checklist sent; owner result pending. |
| Identity/version/candidate foundation for 208 | Automated PASS; integrated assessment handoff remains Phase 3. |
| Provider reports | Entry-only implementation allowed by E2 using prior owner-tested entry links. Exact-view restoration unavailable until verified; dates/coverage/rights stay unknown. |
| E1/test 44 | APPROVED; Phase 3 candidate/comparison, Phase 4 shots, integrated Phase 5 retest. Earlier delivered-action passes retained. |
| Explore return (64/225) | Implemented and automated PASS. Selected location wins; unselected return restores session camera. New live check pending. |
| Earlier manual tests | Owner-reported PASS; no repeat requested. |

New owner checklist: save named downtown/Magnolia/Moncus entries with notes;
reload/open project and restore each, including after walking away inside the
same tour; export/import and compare bookmarks/notes; selected Explore return
and unselected camera retention. Prior failure/storage tests are not being
re-requested. Automated new bookmark failure, emergency export/retry, retired
view, ownership and transfer-contract cases PASS. Any discovered live failure
requires correction/retest before closure. Browser/device/build metadata remain
unspecified until supplied; no live PASS may be inferred from 373 automated checks.

Phase 3 remains gated by new Phase 2 acceptance. Independent source/schema
reconnaissance is recorded in PHASE_3_RECONNAISSANCE_D079.md. No new blanket
exception, phase close, telemetry, commit or push.
## D080 closeout - 2026-09-22

**Phase 2 COMPLETE under approved entry-only scope E2.** Owner explicitly
answered "All new checks passed" to the D079 checklist: project-owned named/
noted downtown, Magnolia and Moncus entry bookmarks; reload/open/restore,
including restoring after walking away within the tour; export/import retaining
bookmarks/notes; selected-pin return and unselected Explore camera retention.
Record these new 60-62/64/225/226 workflow checks as owner-reported PASS. Earlier
confirmed tests remain PASS; historical failures and blocked tool observations
remain in the record. No repeat confirmation is required.

Accepted implementation identity: D079 runtime digest
9a185ee2013f4196cdeb2e2c55932c26ceb84866f72fe2999e238e1edd287541,
HEAD fd4900a6 plus D078-D079 worktree, 373 automated PASS. The checklist named
the new local build, but owner browser/device/viewport and independently verified
tested digest were not supplied. Do not invent those details or expand this
functional report into device-wide certification or participant evidence.

E1 retains test-44 candidate/comparison delivery in Phase 3, shots in Phase 4,
integrated Phase 5 retest. E2 limits bookmarks to catalog entries: exact view,
pose interpretation, screenshots, capture date/extent/rights are still unverified.
Any future capability-dependent implementation must obtain its own evidence.
Phase 3 Project Workspace and Scouting Assessments may now proceed under D068.
