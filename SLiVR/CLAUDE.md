# SLiVR project instructions

These instructions apply to all work under `E:\sroberto27.github.io\SLiVR`.

## Project boundary

- Treat `E:\sroberto27.github.io\Wrapper\map\LSU3D` as a read-only reference.
- Create or modify project content only under `E:\sroberto27.github.io\SLiVR`.
- Do not alter, stage, commit, reset, stash, clean or delete unrelated repository content or user changes.
- Follow `SLIVR_ARCHITECTURE_AND_FEATURES.md` as the controlling product and architecture specification.

## Comments

- Write professional, concise comments in plain language.
- Explain intent, non-obvious constraints, units, coordinate frames, provider behavior or the reason for a decision.
- Do not restate self-explanatory code or narrate implementation steps.
- Keep comments close to the relevant code and update or remove stale comments when behavior changes.
- Use short JSDoc only when a public contract or non-obvious input/output behavior needs clarification.
- Do not mention Claude, AI, language models, prompts, generated code or automated authorship in source comments or implementation documentation.

## Git

- Do not commit or push unless the user explicitly requests it.
- Every commit created for SLiVR must contain only paths under `E:\sroberto27.github.io\SLiVR`, shown as `SLiVR/` paths from the repository root.
- Stage with an explicit SLiVR path boundary. Before committing, inspect `git diff --cached --name-only` and require every listed path to begin with `SLiVR/`.
- If unrelated paths are already staged, do not include them, unstage them, or otherwise change the user's index without explicit authorization.
- After committing, inspect the commit's file list and confirm every path begins with `SLiVR/`.
- Before pushing, inspect every commit that is ahead of the upstream branch. Do not push if any outgoing commit contains a path outside `SLiVR/`.
- Use a short, professional commit subject that describes the product change.
- Do not mention Claude, AI, language models, generated code or automated authorship in commit subjects, bodies or trailers.
- Do not add AI attribution or an AI `Co-authored-by` trailer.

## Research records

- Treat SLiVR as a research artifact and keep `research/` synchronized with implemented behavior.
- At each phase boundary, update the feature/evidence register, decision record, research change log, measurement dictionary and limitations/threats register.
- Distinguish design rationale, technical validation and human-participant evidence. Do not report an expected benefit as a result.
- Record versions, feature IDs, dataset/capture versions, provider capabilities, device/browser context and negative or failed results when relevant.
- Do not enable background telemetry or collect participant data by default.
- Participant logging requires a separately reviewed protocol, applicable institutional/ethics determination, informed consent, retention/access rules and data minimization.
- Use explicit opt-in study sessions and pseudonymous identifiers. Do not collect names, private production content, precise personal location, access codes or credentials in research logs.
- Keep Treedis Research Mode in post-prototype Phase 6. Follow `research/TREEDIS_RESEARCH_MODE_PLAN.md`; do not deploy the proxy/probe/collector or enable participant logging without the required provider/content-owner authorization and study/security approvals.
- Implement passive record-only capture before any experimental manipulation. Keep both paths independently gated, reversible and disabled during normal use.

## Full-system testing

- Treat `docs/FULL-SYSTEM-TESTING.md` as the living system-verification specification.
- Before claiming a feature or phase complete, update the applicable tests, map implementation and exit criteria to stable test IDs, and run the affected phase section plus Part J.
- Do not pre-mark tests from planning or code inspection. Only record PASS for the exact build and environment actually executed.
- Record automated and live browser/device/provider evidence separately, including build, browser/device, catalog/schema/provider versions and failure details.
- Preserve FAIL, BLOCKED and NOT TESTED results. A required phase test must pass or have an explicit approved exception and retest condition before the phase is complete.
- Do not renumber an existing test after it is referenced. Add a new stable test ID when behavior or discovered risk needs additional coverage.
