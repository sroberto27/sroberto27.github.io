# SLiVR research record

## Purpose

This directory preserves the information needed to describe, evaluate and reproduce SLiVR as an HCI and immersive-location-scouting research artifact. It tracks what the tool does, why each feature exists, how the design changes, what can be measured, which evidence has actually been collected and which limitations constrain interpretation.

The record supports future papers, posters, theses, demonstrations and study protocols. It does not turn product assumptions into research findings.

## Evidence levels

Every research statement must use one of these levels:

1. **Design rationale:** a requirement, theory-informed expectation, professional-workflow need or design hypothesis.
2. **Technical validation:** evidence from code inspection, automated tests, provider checks, performance measurements or structured acceptance testing.
3. **Human-participant evidence:** observations collected under a separately reviewed study protocol with the required consent and institutional/ethics determination.

Never describe Level 1 as an observed benefit or Level 2 as proof of user effectiveness. Record negative, null and failed results.

## Records

| File | Purpose | Update point |
|---|---|---|
| [PHASE_0_CLOSEOUT.md](PHASE_0_CLOSEOUT.md) | Phase 0 gate evidence, limitations and closure decision | Phase 0 closeout |
| [PROVIDER_CAPABILITY_MATRIX.md](PROVIDER_CAPABILITY_MATRIX.md) | Per-entry provider evidence and unknowns | Provider verification |
| [FEATURE_EVIDENCE_REGISTER.md](FEATURE_EVIDENCE_REGISTER.md) | Connect feature IDs to workflow problems, research rationale, constructs, measures, evidence and limitations | Every feature change and phase exit |
| [DECISION_RECORD.md](DECISION_RECORD.md) | Preserve design alternatives, rationale, consequences and validation state | Every material product, architecture or study decision |
| [RESEARCH_CHANGELOG.md](RESEARCH_CHANGELOG.md) | Record research-relevant changes by artifact version | Every reviewable build or phase exit |
| [MEASUREMENT_DICTIONARY.md](MEASUREMENT_DICTIONARY.md) | Define events, outcomes, units, derivations and missing-data rules | Before logging or measure changes |
| [EVALUATION_FRAMEWORK.md](EVALUATION_FRAMEWORK.md) | Define candidate research questions and staged evaluation designs | Before each evaluation plan |
| [LIMITATIONS_AND_THREATS.md](LIMITATIONS_AND_THREATS.md) | Track limitations and threats to validity with mitigations | When discovered and before reporting |
| [STUDY_PROTOCOL_TEMPLATE.md](STUDY_PROTOCOL_TEMPLATE.md) | Template for a specific human-participant study | One completed copy per approved study |
| [TREEDIS_RESEARCH_MODE_PLAN.md](TREEDIS_RESEARCH_MODE_PLAN.md) | Post-prototype proxy/probe/collector, consent, security, passive telemetry and conditional manipulation plan | Phase 6 planning, implementation and each study compatibility review |
| [FULL-SYSTEM-TESTING.md](../docs/FULL-SYSTEM-TESTING.md) | Living numbered system and phase verification record | Every implementation work package and phase exit |

## Provenance codes

| Code | Source |
|---|---|
| `PAPER` | Supplied VR-based location-scouting research paper |
| `BOOK` | Supplied professional location-scouting book |
| `SHOT` | Shot Designer product/tutorial review and supplied example image |
| `LSU3D` | Read-only source-project implementation and tests |
| `SCSU` | Read-only Experimental source-project implementation and tests |
| `USER` | User-approved product decision or workflow requirement |
| `INVENTORY` | Supplied Treedis inventory and reviewed location workbook |
| `TEST` | Repeatable technical or acceptance test |
| `STUDY-{id}` | Approved study dataset/protocol; never use before evidence exists |

Use page, section, URL, filename, test name or decision ID where available. A provenance code shows the origin of a statement; it does not establish that the expected user benefit has been demonstrated.

## Phase-close procedure

At every Phase 0–5 exit:

1. Assign an artifact/build version and date.
2. Update implemented/deferred/changed feature status.
3. Add material decisions and rejected alternatives.
4. Record automated, provider and manual validation evidence, including failures.
5. Update event/measure definitions before collecting new observations.
6. Record catalog, capture, schema, browser/device and provider versions.
7. Add limitations and threats discovered during the phase.
8. Verify that public claims match the current evidence level.
9. Confirm that no participant data or sensitive production content entered the repository.

## Human-participant data boundary

Research logging is off by default. Do not collect participant observations until a specific protocol has the applicable institutional/ethics determination, informed-consent process, recruitment criteria, compensation terms, retention/access rules and data-minimization plan.

Approved study logging must be visible and opt-in. Use pseudonymous participant and session IDs. Do not place names, contact details, precise personal location, private production content, access codes, credentials or identifiable free-text notes in application logs. Store raw data outside the public application repository with controlled access; store derived data separately and preserve the transformation/version used to create it.

## Reporting checklist

Future writing should identify the artifact version, feature set, location/capture dataset version, comparison condition, participant/sample definition, device/browser/display, task materials, study setting, provider capabilities, measures and operational definitions, exclusions/missing data, analysis method, uncertainty/effect estimates, negative findings, limitations and data/material availability.
