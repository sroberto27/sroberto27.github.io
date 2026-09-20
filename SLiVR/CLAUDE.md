# SLiVR project instructions

These instructions apply to all work under `E:\sroberto27.github.io\SLiVR`.

## Project boundary

- Treat `E:\sroberto27.github.io\Wrapper\map\LSU3D` as a read-only reference.
- Treat `E:\sroberto27.github.io\Wrapper\map\Experimental` (SCSU) as a read-only reference for reusable code across all phases, including the Treedis wrapper and immersive viewer.
- Create or modify project content only under `E:\sroberto27.github.io\SLiVR`.
- Do not alter, stage, commit, reset, stash, clean or delete unrelated repository content or user changes.
- Follow `SLIVR_ARCHITECTURE_AND_FEATURES.md` as the controlling product and architecture specification.

## Reference-first implementation

Both `E:\sroberto27.github.io\Wrapper\map\LSU3D` and
`E:\sroberto27.github.io\Wrapper\map\Experimental` (SCSU) are approved code
ground-truth and refactoring sources for every current and future phase.
Inspect both for an existing implementation before writing a new module.
Adapt the relevant working code rather than deriving a replacement from scratch.
SCSU is not limited to Treedis: either project may supply any applicable feature,
interface, map integration, loading pattern, lifecycle or utility.
When counterparts differ, choose the one with demonstrated behavior that meets
SLiVR's architecture, and record the source project, file/line and reason.
Neither project's existence alone proves its behavior in SLiVR.

For Treedis, start from `Experimental/js/03-tour-bridge.js`,
`Experimental/js/04-street-view.js`, `Experimental/map.html` and its provider
configuration. The working SCSU integration supersedes the unexercised LSU3D
bridge as the implementation source. Retain SLiVR's required origin/source/payload
checks, multiple-model cancellation and disposal. Neither reference is edited.

- Before writing a module, find its counterparts in both projects and read them. If one exists, start
  from it. Refactoring is the default; writing from zero is the exception.
- Plumbing follows the reference exactly unless there is a recorded reason: how a library
  is loaded, stylesheet order, container setup, source and layer identifiers, lifecycle
  and teardown, request shapes and provider parameters.
- A deviation is allowed for exactly three reasons, and each one is written down in
  `research/DECISION_RECORD.md` with the chosen source project, file and line it departs from:
  1. The architecture or the implementation plan requires a different approach.
  2. The reference behaviour is a defect the plan already records.
  3. Neither reference has a counterpart at all.
- "I would write it differently" is not one of the three.
- A divergence that qualifies under none of the three is not recorded and kept. It is
  corrected: change SLiVR to match the reference. Writing down a reason is what the three
  exceptions get, not a way to keep code that has no exception.
- Corrections are made in the phase that finds them. A known divergence is never carried
  into the next phase, because the next phase builds on it and the cost compounds.

Neither reference is authoritative everywhere. These recorded LSU3D caveats
remain relevant; assess the corresponding SCSU code on its own evidence:

- **Never executed.** Its Treedis bridge was never run against a live model: every entry
  in its inventory carries `sweepId: null` and an empty tour URL. Its message protocol is
  a transcription, not evidence. Live reconnaissance supersedes it, and the observed
  payload already differs from what it assumes.
- **Recorded defects.** Posting to `"*"`, the truthiness bug at `js/03-tour-bridge.js:87`,
  joining on lowercased display names, enumerating every service-worker registration on
  the origin, no imagery failover, no search debounce. Reuse the shape, not the fault.
- **Deliberate omissions.** It does not dispose 3D resources or handle WebGL context
  loss, and says so. SLiVR adds both.
- **No counterpart.** The catalog and record schemas, IndexedDB persistence, versioned
  transfer, the shot workspace and the research records have no equivalent there.

Never modify LSU3D or SCSU/Experimental. All adapted code belongs under SLiVR.

Why this rule exists: on 2026-09-20 four pieces of plumbing were written without
consulting the reference, and all four were defective — stylesheet order, cross-origin
library loading, an unpinned major version, and a container whose positioning was
silently overridden. Each was already solved in LSU3D, one of them beside a comment
warning about the exact failure.

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
