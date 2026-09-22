# Scouting Assessments implementation plan

Version 1.0, 2026-09-21. Owner-approved scope; planned, not implemented or runtime-validated. Decision D068. Feature F06-SA extends F06 within Project Workspace; it is not a sixth product family or a new mode. The controlling architecture and essential phase gates incorporate this plan.

## Outcome and phase placement

Choose location -> add to project -> complete scouting assessment -> compare candidates -> plan shots -> export project packet.

Phase 3 order: project CRUD -> scene briefs -> candidate creation -> scouting assessments -> requirement evaluation -> comparison -> preferred/backup decision. Phase 1 defines dossier entry/summary placement; Phase 2 establishes supported bookmark evidence. The editor and its dossier/immersive integrations ship together in Phase 3, after those dependencies. No nonfunctional checklist action is required in earlier releases. Phase 4 exposes selected findings beside shots. Phase 5 completes selected-section packets, media packaging and integrated verification. Phase 6 research remains unchanged.

## Essential scope

Preserve eight sections: general information and visual documentation; exterior access/parking/staging; lighting; power/network; aesthetic/design; compliance validation prompts; acoustics; final documentation. Retain useful section navigation and answered progress. Support dated assessments for separate rooms, virtual reviews and later visits; manually entered site observations do not imply a dedicated field toolkit.

Include photo/video attachments, existing panorama attachment/viewing, supported bookmark evidence, notes, explicit reference links, assessment history and project transfer. Compliance contains validation questions and evidence references, not private contacts, permit administration or a claim that filming is authorized. Keep candidate suitability and preferred/backup status in the existing candidate workflow; do not duplicate the checklist app's approval status or stars as a competing decision system.

Phase 7 retains guided 360 capture, source-frame sessions, stitching and image refinement, GPS/reverse geocoding, compass, microphone tools, installable offline phone workflows, private contact and permission management. Essential attachments use supplied files; no camera/sensor permission or ML-model download is introduced. Existing SLiVR service-worker defaults and provider cache exclusions remain in force.

## User interaction

Projects provides a Scouting checklist action for each candidate. The active project's dossier shows its assessment summaries and opens the same editor. Immersive provides a collapsible assessment panel; attach a view only through the existing capability-aware bookmark adapter, with capture/version references and honest restore limitations. Desktop/tablet and keyboard access are required; preserve editor context and focus on return. Provider failure must leave the checklist usable.

Each answer has a stable question ID, typed value (including explicit false and zero), units where applicable, and state: unanswered, observed, needs-validation, or not-applicable. Evidence records source kind (virtual tour, site visit, document, other), observation date, notes and optional bookmark/media reference. Observed means recorded from that source, not independently verified. Preserve catalog strings `Need validation` and `Information has not been found` when presented; do not overwrite catalog facts.

Completion counts substantive observed answers and explicit not-applicable answers over the versioned template's questions. Needs-validation and unanswered items remain unresolved and are counted separately. Show not-applicable counts separately so completion cannot hide exclusions. Completion is not suitability, compliance or filming readiness. A virtual image cannot establish circuit capacity, current permission or acoustic performance.

Link selected answers to candidate requirements; users explicitly judge fit. No automatic favorable score for unknowns and no inference of measured geometry from an image or narrative. Comparison cites the chosen assessment revision; later edits flag changed evidence rather than silently rewriting a previous decision. Shot Designer displays linked findings/references without changing spatial calibration.

## Records, persistence and lifecycle

Add a versioned template with stable question/section IDs and field types. Proposed stores are `scoutAssessments` (projectId, locationId, catalogVersion, title/room, observation date, source context, templateVersion, answers, revision, timestamps), `scoutAssessmentRevisions` (assessmentId, immutable revision snapshot), and `scoutMedia` (projectId, Blob, MIME, size, dimensions where relevant, original filename, provenance). Candidate evidence links reference assessment ID, revision and question ID; permit links across scenes only within the same project and location. Optional bookmark links must match project/location/capture context. Workspace IDs follow SLiVR's UUID policy, never names or legacy media IDs.

Use src/data/idb.js and workspace-repo.js; extend migrations, schema validation, conflicts, transfer and emergency export. Do not import the checklist's separate localStorage/database ownership. Bump database and transfer versions when implemented, preserving old projects with empty assessment collections through explicit migration. Resolve successful writes on transaction completion. Debounce per assessment and guard asynchronous work by identity/revision; flush or retain pending edits before navigation, export, duplication or deletion. Older writes and stale media loads cannot affect another assessment.

Keep historical revisions addressable by decisions. Report references before deletion; preserve referenced snapshots or require an explicit unlink before removing them. Project deletion removes only its owned records. Media shared by assessments within one project is removed only after the final live/history reference is removed. Copy imports remap all record IDs and evidence references. Never modify public catalog records or the original checklist database.

## Transfer and existing checklist import

SLiVR's canonical versioned project JSON includes assessment records, revisions, references and selected owned assets using the existing inline-asset envelope. A complete backup must include all required owned media; data-only exports explicitly list missing/excluded media. Apply bounded file/total-size validation and a clear failure message without silently dropping attachments. Emergency export preserves in-memory answers and references even when storage fails, and explicitly states which media could not be recovered.

Adapt export.js's shared file manifest for a ZIP package containing canonical project JSON and selected owned media, with matching validated package import. Phase 5 also includes assessment sections in the print-ready packet/PDF workflow. Direct folder export and an independent PDF engine are not required for essential acceptance. Do not embed provider imagery.

Legacy importer accepts the checklist's single-location JSON and exported ZIP/package manifest. Preview supported values, excluded fields, unknown location mapping and missing media before any write. User selects the target project and catalog location; do not match by display name or create public catalog entries. Copy files into new SLiVR-owned IDs. Legacy raw media IDs alone cannot recover binaries on another device. Untouched false/zero values become unanswered; explicitly touched false/zero remain answers. Packaged exports omit touched metadata: ambiguous defaults must be flagged for review, not upgraded to confirmed negatives. Unknown legacy statuses and stars are shown in preview and require explicit candidate decisions, never permission approval. Exclude private contacts and other out-of-scope fields with a visible report; do not retain them in hidden payloads. Validate everything and resolve conflicts before a single atomic record import; cancellation/failure leaves the workspace unchanged.

## Sources and planned adaptations

All sources are read-only. Recheck counterparts at implementation time and record exact adopted lines if they move.

| Source | Reuse | Required adaptation |
|---|---|---|
| CheckList/v2/app.js:5-43 | Typed field lists and eight-section metadata | Versioned template; explicit evidence states; omit private contacts and operational permission management |
| CheckList/v2/app.js:66-159, 198-235, 734-747 | Location/form shape, touched semantics, debounced save | SLiVR project/location identity, transaction-backed saves and safe mode switching; current switchLocation does not flush pending form edits |
| CheckList/v2/db.js:13-106 | Blob metadata and media references | SLiVR database/repository, project ownership, transaction completion and shared-reference cleanup |
| CheckList/v2/panorama-viewer.js:70 | Existing image panorama viewer | Lazy load; explicit dispose/context-loss behavior and flat-image fallback; no capture pipeline |
| CheckList/v2/export.js:267-340; app.js:1025-1055 | Media manifest and legacy transfer shapes | Validated versioned round trip, missing-media reporting, privacy preview and remapping; raw legacy import cannot transfer media bytes |
| Wrapper/map/LSU3D/js/06-details-panel.js:5-40 and Experimental/js/06-details-panel.js:6-43 | Panel visibility and mobile sheet behavior | Use SLiVR's existing shell/state and accessibility; one shared editor |
| Wrapper/map/Experimental/js/03-tour-bridge.js:55-67 and js/04-street-view.js | Preferred working Treedis readiness/navigation source | Use SLiVR adapter with origin/source/payload checks, cancellation and disposal; never add a second bridge |

Both map references were inspected; neither has a project scouting-assessment/persistent evidence counterpart. New domain records fill that absence. Storage, uncertainty, lifecycle and export differences from CheckList are required by the approved SLiVR architecture (D068), not stylistic rewrites. Checklist source inspection is not live device/provider validation.

## Delivery and exit gates

1. Phase 1: reserve dossier integration and catalog/workspace boundary (test 207 at Phase 3 delivery).
2. Phase 2: expose supported bookmark references without inventing pose/screenshot capability (208).
3. Phase 3: implement domain/template, migrations and revision rules; shared editor; attachments/viewer; evidence-to-requirement links; comparison; canonical transfer and legacy import. Run 206-212, 214-215 plus existing Phase 3 tests and Part J.
4. Phase 4: integrate evidence summaries/reference links without geometry inference (213), affected Phase 4 tests and Part J.
5. Phase 5: selected-section print packet and media ZIP round trip; integrated failure/accessibility checks (208-215), affected Phase 5 tests and Part J. Include the checklist in the end-to-end acceptance trace.

Manual scenario: create two scenes and three candidates; record a virtual assessment with a bookmark, explicit zero, unknown capacity and photo; add a separate later assessment; compare using a named revision; edit it and verify prior decision evidence; view linked findings in Shot Designer; export/import in a clean profile and reopen media. Repeat with provider blocked and storage failure; verify emergency data and honest missing-media reporting.

Rollback disables assessment entry points while retaining data and migration compatibility. Do not downgrade/delete the database to roll back UI. Offer versioned export before any future destructive migration. No implementation or acceptance PASS is implied by this plan.
