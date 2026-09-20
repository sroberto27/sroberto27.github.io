# Claude CLI plan-mode prompt for SLiVR

You are working in **plan mode**. Perform read-only analysis and produce a reviewable implementation plan. Do not create, edit, move, rename or delete files; do not install dependencies; do not scaffold the application; and do not implement code. The user will authorize implementation separately after reviewing the plan.

## Code reference policy for every phase

Follow `CLAUDE.md` and architecture section 10.5. Both
`E:\sroberto27.github.io\Wrapper\map\LSU3D` and
`E:\sroberto27.github.io\Wrapper\map\Experimental` (SCSU) are approved
read-only code ground-truth and refactoring sources. Inspect both before
proposing new implementations. Reuse applicable working code from either;
SCSU is not limited to Treedis. For each planned module, identify the selected
source project/file and explain required deviations. Preserve SLiVR's identity,
validation and lifecycle requirements; never modify either reference.

## Objective

Plan a new static web application named **SLiVR** for film-location scouting and shot planning in Lafayette, Louisiana. It adapts useful architectural ideas and proven algorithms from the existing LSU3D campus-map project while replacing its recruitment purpose, Baton Rouge content and LSU-specific assumptions.

The new project root is:

`E:\sroberto27.github.io\SLiVR`

The LSU3D reference project is (SCSU is also approved above):

`E:\sroberto27.github.io\Wrapper\map\LSU3D`

Treat LSU3D as strictly read-only. Do not modify, clean, migrate, reformat, deploy over or write generated files into it. Reuse concepts selectively and preserve applicable licenses and attribution; do not copy LSU editorial content, coordinates, branding, credentials, caches or obsolete command files.

## Controlling sources

Read these before producing the plan, in this priority order:

1. `E:\sroberto27.github.io\SLiVR\SLIVR_ARCHITECTURE_AND_FEATURES.md` — the controlling, user-approved product and architecture specification.
2. `E:\sroberto27.github.io\SLiVR\docs\FULL-SYSTEM-TESTING.md` — living numbered verification specification; every phase plan must map work and exit evidence to its test IDs.
3. `E:\sroberto27.github.io\SLiVR\SLIVR_SOURCE_REVIEW.md` — verified source-code analysis, research traceability and audit limits.
4. `E:\sroberto27.github.io\SLiVR\research\README.md` and its linked registers — required research traceability, measurement and evaluation records.
5. `E:\sroberto27.github.io\SLiVR\outputs\location_database\SLiVR_Location_Scouting_Database.xlsx` — reviewed 17-location catalog and evidence register.
6. `E:\sroberto27.github.io\SLiVR\docs\Current treedis experinece sweeps building starts.txt` — supplied Treedis experience/sweep inventory.
7. `E:\sroberto27.github.io\SLiVR\docs\Elsevier_2026_VR_based_Location_Scouting.docx` — research context and user requirements.
8. `E:\sroberto27.github.io\SLiVR\docs\locationScoutingBookOCR_compressed.pdf` — professional scouting workflow reference.
9. `E:\sroberto27.github.io\SLiVR\docs\Example of shot designer.png` — visual reference for the downtown shot-planning acceptance scenario.
10. `E:\sroberto27.github.io\SLiVR\docs\TreedisResearch mode information.txt` — prior proxy/probe/collector and conditional-manipulation research; reference material requiring SLiVR-specific security, authorization and compatibility validation.
11. `E:\sroberto27.github.io\SLiVR\research\TREEDIS_RESEARCH_MODE_PLAN.md` — controlling Phase 6 interpretation and exit boundary for that reference material.
12. Both LSU3D and Experimental/SCSU source code, tests, configuration and project instructions, used read-only to identify reusable implementations and constraints.

If a supporting source conflicts with the approved architecture, follow the architecture and report the conflict. Preserve the exact catalog uncertainty values `Need validation` and `Information has not been found`. Do not treat a URL, public hour, operator name, virtual capture or map coordinate as proof of filming permission, current availability, ownership, measured geometry or present physical condition.

## Approved first-prototype boundary

Plan essential Phases 0–5 from the architecture guide in implementation-ready detail:

0. Foundation and feasibility.
1. Location Atlas and Dossiers.
2. Immersive Scout.
3. Project Workspace.
4. Shot Designer Core.
5. Integrated prototype and release validation.

The first prototype must contain the five approved product families: Location Atlas, Location Dossiers, Immersive Scout with basic bookmarks, Project Workspace, and Shot Designer Core. The phase exit gates in the architecture guide are mandatory acceptance boundaries.

Then plan **Phase 6 — Treedis Research Mode** as a separate post-prototype workstream. It must not enter the Phase 0–5 implementation scope. Phase 6 provides authorized, consented, dormant-by-default passive WebXR/Treedis telemetry first, followed only when separately approved by bounded inventory/experimental manipulation. Use `research/TREEDIS_RESEARCH_MODE_PLAN.md` as its controlling boundary; do not copy the SCSU-oriented scripts or assumptions from the supplied text as production code.

Do not move the other later-roadmap features into the prototype plan. Scout scheduling, dedicated phone field capture, logistics maps, permissions/cost administration and technical-scout handoff remain Phase 7; advanced optics/animation/models and sun/weather tools remain Phase 8; collaboration, capture administration and wrap/stewardship remain Phase 9.

## Fixed technical decisions

- Use static HTML, CSS and modern JavaScript with native ES modules. Do not require Vite, TypeScript, React or another application framework.
- Use MapLibre for the geographic map.
- Use the Louisiana DOTD 2025 Various 6-Inch RGBI ImageServer as the primary aerial source and the 2024 Lafayette 6-Inch RGBI ImageServer as fallback, as specified in the architecture. Do not use MapServer layer 187 as the Lafayette primary source.
- Treat Google Photorealistic 3D Tiles as optional exterior context. Credentials must come from external runtime configuration, and failure must never block shot editing.
- Use a dedicated Treedis adapter with validated message origin/source/type/payload, explicit lifecycle states, cancellation/generation control, timeouts, retry and disposal.
- Preserve the six downtown locations as separate catalog/entry records inside shared Treedis experience `5eb11a1b`; also support the five supplied independent experiences.
- Use Three.js for the authored Shot Designer workspace. Store authored cameras, actors, props, marks, paths and shots independently of Google or Treedis provider internals.
- Use IndexedDB for browser-local workspace data, behind a repository adapter, plus validated versioned JSON import/export and emergency JSON recovery. No backend, accounts, cloud sync or shared workspace is part of the first prototype. Phase 6 may introduce a separate research-only proxy/collector and private event store; it must remain isolated and off during normal use.
- Use a public, read-only, versioned catalog derived from the reviewed workbook. User/project notes must never overwrite catalog facts.
- Support desktop authoring and tablet layouts. Do not promise precision phone editing or headset-specific interaction.
- Keep SLiVR storage keys, cache names and service-worker scope isolated. Never unregister or clear LSU3D or neighboring application storage/workers.
- Exclude `docs/`, the research paper, scouting book, private references, credentials and user exports from public deployment artifacts.

## Code-comment and Git rules

- Write professional, concise comments in plain language. Comment only when intent, a non-obvious constraint, units/coordinate frames, provider behavior or a design reason needs explanation. Do not restate clear code or add tutorial-style narration.
- Keep comments current and close to the relevant code. Use short JSDoc only for public contracts or behavior that cannot be understood safely from names and structure alone.
- Do not add references to Claude, AI, language models, generated code, prompts or automated authorship in code comments, implementation documentation, commit messages or commit trailers. Never add an AI `Co-authored-by` trailer.
- Plan mode must not commit or push. In later implementation, commit or push only when the user explicitly requests it.
- Every commit created for this task must contain only paths under `E:\sroberto27.github.io\SLiVR`. Do not stage, commit, amend, reset, stash, clean or otherwise alter unrelated repository changes.
- Before committing, inspect the staged path list and require every path to begin with `SLiVR/` relative to the repository root. After committing, inspect the committed path list and verify the same boundary.
- Before pushing, inspect every local commit that would be sent to the configured upstream. Do not push if any outgoing commit contains a path outside `SLiVR/`. Git pushes commits rather than a folder, so this outgoing-commit check is mandatory.
- Use short, professional commit subjects describing the product change, without AI references, automated-authorship attribution or generated-by text.

## Research-project requirements

Treat SLiVR as a research artifact intended to support future HCI, VR and spatial-computing publications. Incorporate the records under `E:\sroberto27.github.io\SLiVR\research` into the implementation plan. Every phase must update the feature/evidence register, decision record, research change log, measurement dictionary and limitations/threats register.

Keep design rationale, technical validation and human-participant evidence distinct. Expected outcomes are hypotheses, not findings. Require version, feature ID, catalog/capture version, provider capability and device/browser context for evidence that may support future analysis. Record negative and failed results as well as successful tests.

Do not plan hidden or default-on analytics. Human-participant logging must remain off until a separately reviewed study protocol, applicable institutional/ethics determination, consent process, retention/access rules and data-minimization plan are approved. Any future study mode must be explicit, visible, opt-in and locally reviewable/exportable; use pseudonymous identifiers and exclude names, private production content, precise personal location, access codes and credentials.

For Phase 6, first verify whether Treedis offers a supported SDK/event/export path and whether the project has authorization to proxy, alter response security headers, inject code, inspect runtime handles or modify stimuli. A random session ID does not make movement trajectories anonymous. Require a dedicated research origin, allowlisted upstream, short-lived signed study launches, study-scoped consent/withdrawal, restricted origins, schema/body/rate validation, private storage, versioned manifests, retention/deletion and measured non-interference. Separate passive capture from active manipulation in architecture, consent, authorization, runtime gates and acceptance tests.

## Required analysis before planning

Inspect the LSU3D implementation deeply enough to identify reusable code by actual file/module and behavior. Verify claims against implementation and tests rather than relying only on filenames or documentation. At minimum, trace:

- startup and ordered-module dependencies;
- central state and selection flow;
- MapLibre sources/layers, aerial fallbacks and geographic selection;
- search, filters, details panels and routing/history;
- Treedis bridge/message lifecycle and its current limitations;
- Google 3D/Three.js integration and provider fallbacks;
- local storage, service worker/cache behavior, exports and tests;
- LSU-specific coupling that must be removed rather than copied.

Inspect the workbook structure and map each relevant column to the proposed catalog/domain records. Identify which fields are public catalog data, capture metadata, operational research or source/provenance. Do not invent missing values.

Review every numbered test in `docs/FULL-SYSTEM-TESTING.md`. For each phase, identify which existing tests prove its deliverables and exit gate, which require automated coverage, which require real browser/device/provider execution, and any missing tests that must be added during implementation. Preserve existing test IDs and never pre-mark a result in the plan.

For Treedis, imagery and optional Google 3D, distinguish four categories: verified from supplied evidence, verifiable during Phase 0, requires user-owned credentials/access, and unsupported/unconfirmed. A provider uncertainty should become a Phase 0 validation task with a fallback unless it truly prevents an exit gate.

## Required plan output

Produce one coherent implementation plan with these sections:

1. **Understanding and scope boundary** — summarize the product, users, approved geography, five required feature families, excluded later scope and read-only LSU3D rule.
2. **Source reuse matrix** — name relevant LSU3D files/modules, what behavior may be adapted, what must change, what must not be copied, and the tests/evidence supporting the conclusion.
3. **Target application structure** — propose a concrete no-build directory/module layout for SLiVR and explain module responsibilities, dependency direction, application state, routing and adapter boundaries. Avoid empty abstractions intended only for deferred features.
4. **Data model and migration** — define catalog and workspace records, stable IDs, workbook-to-catalog transformation, schema/version strategy, IndexedDB stores/indexes, JSON import/export validation, conflict handling and recovery. Include coordinate/calibration and evidence/uncertainty rules.
5. **Provider feasibility matrix** — DOTD primary/fallback imagery, optional Google 3D, Treedis shared/separate experiences and Three.js. State validation procedure, expected capability, fallback and evidence needed for each.
6. **Phase-by-phase implementation plan** — cover essential Phases 0–5 in order, then the separate post-prototype Phase 6. For every phase list:
   - user-visible outcome;
   - dependencies and inputs;
   - modules/files expected to be added or adapted;
   - data/schema changes or migrations;
   - implementation work in dependency order;
   - meaningful automated tests;
   - manual acceptance scenario;
   - loading/empty/error/fallback behavior;
   - exact evidence required to pass the architecture exit gate;
   - applicable `FULL-SYSTEM-TESTING.md` test IDs, proposed automated coverage and required live browser/device checks;
   - risks, validation tasks and rollback/recovery approach.
7. **Integrated acceptance trace** — trace the complete workflow: discover a Lafayette location → review dossier → enter/return from Treedis → add and compare project candidates → select preferred and backup → create a shot scene → arrange cameras/actors/marks/paths → save/reload/create a variant → export JSON, PNG, CSV and print-ready packet.
8. **Verification strategy** — use `docs/FULL-SYSTEM-TESTING.md` as the controlling living checklist. Cover domain tests, optics/transforms, schema round trips, IndexedDB failures, provider race conditions, routing/context preservation, accessibility, desktop/tablet checks, provider/WebGL loss, exports, deployment allowlist and cache isolation. Explain how the document will be updated and how automated evidence remains distinct from live execution evidence.
9. **Research traceability and evaluation readiness** — map each required feature to research rationale, candidate constructs and observable measures; specify phase-by-phase record updates; separate development/technical evidence from future participant evidence; identify reproducibility metadata, privacy boundaries and threats to validity without claiming that a study has occurred. Include a Phase 6 trust-boundary/data-flow diagram, event/manifest outline, authorization/consent state machine and record-only versus manipulation acceptance matrix.
10. **Risks and decisions** — separate confirmed constraints, Phase 0 validation tasks, implementation choices Claude can resolve within the approved architecture, and genuine blockers requiring user input. Do not relitigate decisions already settled by the guide.
11. **Implementation start point** — finish with the exact Phase 0 work package Claude recommends implementing first after plan approval, including its completion checklist. Do not implement it in this response.

Make Phase 0 detailed enough that implementation can begin after one user approval. Keep later phases concrete enough to expose dependencies and prevent architectural dead ends. Use dependency ordering rather than calendar estimates.

Do not stop early to ask broad discovery questions. Complete the read-only investigation and plan using the approved assumptions. Ask only focused questions that remain genuine blockers after the plan is written, and explain which exit gate each answer affects.

Your response must contain planning and evidence only. Do not output application code, modify files or begin implementation while in plan mode.
