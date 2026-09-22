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
