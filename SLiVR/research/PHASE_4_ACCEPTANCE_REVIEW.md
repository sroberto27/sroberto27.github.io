# Phase 4 closeout - D095

## D095 - Phase 4 CLOSED / ACCEPTED, 2026-09-29

The owner explicitly confirmed that shot-workspace failure recovery and
calibrated-plan persistence after reload are OK and instructed Phase 4 closure.
Record both as **owner-reported PASS, confirmed 2026-09-29**. All eight previously
accepted critical checks remain PASS, including immersive capture test 251.
The two D094 evidence gaps are resolved by this owner report; do not request
reconfirmation or reopen them solely because detailed execution traces are absent.

Accepted implementation: D093 published as
`af8aa819076d69abacdef0828d466567192a3821`, building on D091/D092 (`996417ad`).
App0.4.0 / transfer1.4.0 / DB2 / template1.0.0 / catalog1.1.0. Browser/device
and an independently measured tested digest were not supplied. Do not invent
individual failure-injection traces, a full live Part J run, or device coverage.

Existing automated evidence is unchanged: D091 423 full-suite PASS; D092 51
focused PASS; D093 56 initial focused PASS, then 6 final capture/action PASS.
These are separate runs. No new runtime tests were executed for this closeout.
Historical failures and earlier pending results retain their build/scope.

**Next: Phase 5 - Integrated prototype and release validation (F20 baseline).**
Phase 4 is no longer a prerequisite blocker. Phase 5's integrated regression,
release/device, exports and deployment gates still require their own evidence.
Phase 6 Treedis Research Mode follows Phase 5. No Phase 5 implementation,
telemetry, participant collection, staging, commit or push in this closeout.


### Final gate disposition

| Phase 4 evidence | Current disposition |
|---|---|
| D091/D092 critical owner checks 1-7 | Owner-reported PASS retained; no repeat requested. |
| D093 immersive screenshot check 8 / 251 | Owner-reported PASS confirmed 2026-09-29; all previously listed capture flows retained. |
| Shot-workspace failure recovery (D094 group 238/239/245; affected Part J 179/181) | Owner-reported PASS confirmed 2026-09-29. Resolves the named remaining recovery gap; no per-injection transcript supplied. |
| Calibrated-plan persistence after reload (243; retained 107-111) | Owner-reported PASS confirmed 2026-09-29. Resolves the remaining plan-retention gap. |
| Automated contracts, historical live checks and approved D090 scope mapping | Existing evidence retained; no new test run or physical projection claim. |
| Part J and release coverage | Existing automated and owner workflow evidence retained. No new complete live sweep claimed; Phase 5 must run its own affected checks and full release sweep. |

The owner has explicitly closed the delivered Phase 4 scope. D094's open-gap
assessment and its conditional handoff below are historical. No Phase 4 blocker
remains. Device generalization, provider-use policy limitations and research
validity limitations remain limitations, not invented acceptance results.

### Active Phase 5 handoff

Start **Phase 5 - Integrated prototype and release validation (F20 baseline)**
from the accepted D093 implementation plus preserved local documentation and
existing worktree changes. Do not reset to the published commit or push the
current branch's unrelated history. Read the actual plan and both reference
projects before introducing new modules.

First inventory existing exports and integration, then harden save-before-transition,
history and disposal. Complete canonical JSON/media ZIP recovery and selected-section
print packets; validate accessibility/tablet behavior, default-off scoped service
worker, deployment isolation and the complete assessment-to-shot workflow. Tests
113-132, 133-140, 208-215 and Part J 172-183 govern the release, with D090/D093
image-overlay changes and stable 237-251 regressions where affected.

Use [PHASE_5_CLI_PROMPT.md](../PHASE_5_CLI_PROMPT.md) for the next session. Phase 6
instrumentation and participant collection stay outside Phase 5.

## Historical D094 audit (superseded by D095; evidence retained)

Date: 2026-09-29. **Owner critical checklist ACCEPTED (checks 1-8); formal
Phase 4 exit remains OPEN pending the evidence gaps below.** This is a
documentation audit, not a new implementation, test run or acceptance exception.

## Baseline and evidence provenance

The controlling architecture and implementation plan are amended by the approved
D090 image-overlay plan, especially section 9. Incompatible dual-view/3D editor
requirements are superseded, not failed or silently marked PASS. D093 subsequently
adds browser-assisted immersive capture; D090's earlier exclusion of immersive
screenshots is historical. E1 retains the Phase 4 shot / Phase 5 integrated split;
E2 entry-only provider context and all D089 owner passes remain accepted.

- D091/D092 owner checks 1-7: previously reported PASS, reaffirmed in the owner's
  2026-09-29 instruction; publication `996417ad`.
- D093 owner check 8 / stable test 251: **owner-reported PASS, confirmed
  2026-09-29**, associated with published implementation
  `af8aa819076d69abacdef0828d466567192a3821`. Screenshot and credits/footer,
  exclusion of SLiVR overlays, sharing termination, editing, JSON/PNG export,
  persistence after reload, return navigation, cancellation/retry, rejection of
  a wrong tab/window, and unsupported-browser import fallback all passed.
- Browser/version/device and an independently measured tested runtime digest
  were not supplied. Do not invent them or require repeat acceptance for them.
  Provider capability/version coverage beyond these reported flows is unknown.
- App0.4.0 / transfer1.4.0 / DB2 / template1.0.0 / catalog1.1.0.
- Existing D091 automation: 423 PASS / 0 FAIL, Windows Node v24.18.0,
  `outputs/phase4-final-tests.txt`; 408 PASS / 1 FAIL initial fixture run retained.
  D092: 51 focused PASS. D093: 56 initial focused PASS / 0 FAIL in
  `outputs/immersive-capture-tests.txt`, then 6 final capture/action PASS / 0 FAIL
  in `outputs/immersive-capture-final-tests.txt`. These logs were inspected, not
  rerun. Browser API mocks do not establish live capture; the owner report does.
- Existing deployment evidence: D091 210 files / 0 errors; D093 0 errors with
  485 files including the pre-existing untracked handoff folder. Catalog has
  the existing name warning. These are historical scans, not a fresh release audit.

## Exit-criterion audit

PASS below is limited to the reported checklist procedure or executed automated
contract. It does not mark every assertion of a larger stable test ID PASS.

| Required scope and stable IDs | Existing evidence and disposition |
|---|---|
| Exact aerial/Google view, source attribution, preserved background (237; replaces 85-86/89/94/97/99/103 as applicable) | Owner check 2 PASS; capture mocks and earlier DOTD live evidence. Owner directed Google capture with attribution under D091; no new provider-policy permission finding. |
| Bounded capture failures, races, no stale/orphan background (238) | Owner check 2 covers unavailable capture/error/retry; automated changed-view rejection and timeout PASS. Full live loading/source-switch/resize/readback/context-failure coverage is not established. OPEN evidence gap. |
| Draft ownership, return, failed-save retention (239; 44/77-79/179/208/232-236) | Owner checks 2/4 PASS for capture/return and project/evidence connection; earlier checklist regression passes retained. New shot failed-save/navigation recovery is not explicitly covered. OPEN with 245. |
| Objects, image transforms, camera setups, numeric optics, no physical projection claim (240-241; retained 90-93/95-96/98) | Owner checks 1/3 PASS plus automated geometry, identities, locks and existing optics/unit fixtures. No recreated 3D renderer is required. |
| Paths, preview, undo, shots and complete variants (242/249; retained 100-106) | Owner checks 1/3/5 PASS; deterministic preview, path symbols, undo and variant automation PASS. |
| Owned flat-plan import, replacement and calibration retention (243; retained 107-111) | Owner check 5 PASS for its reported scope, but flat-plan calibration is conditional ('If using owned plans'). Automated independent-distance and oblique rejection PASS; no explicit live calibrated scale/status retention through save/reload. OPEN evidence gap. |
| Assessment revision/ownership and evidence return (244/213/232-236) | Owner check 4 PASS; revision/reference and workspace automated evidence retained. No findings are converted into geometric measurements. |
| Image bytes, durable reload, copy import, legacy preservation, failure recovery (245) | Owner checks 3/5 and 251 PASS for persistence and transfers; automated roundtrip/remapping PASS. Live image-bearing shot quota/storage failure, draft retention, emergency export and recovery are not established by those checks. OPEN evidence gap. |
| PNG/CSV readability, attribution and safe transfer (246; 118/119/121) | Owner check 5 PASS, plus 251 JSON/PNG PASS; CSV safety and shared rendering automation PASS. Print/PDF and native media ZIP stay Phase 5. |
| Compact controls, alignment, focus and menus (247/250) | Owner checks 6/7 PASS; D092 focused tests and limited Chrome fixtures support their own scope. No physical-device or assistive-technology matrix is inferred. |
| Downtown cameras/setups, actors, paths, descriptions, variants and exports (248, replaces 112) | Owner checks 1/3/5 cover the instructed downtown workflow and are accepted; shared two-camera/two-actor rendering fixture remains separate technical evidence. |
| Immersive screenshot addition (251) | Owner-reported PASS confirmed 2026-09-29 for every listed capture flow. Earlier pending/NOT TESTED entry is historical, not current. |

## Part J accounting

The D091 full-suite evidence covers implemented automated foundations, followed
by D092/D093 affected runs. It is not a new full live Part J sweep of af8aa819.

| IDs | Evidence scope at this audit |
|---|---|
| 172-176 | Prior accepted shell/catalog/discovery/viewer/project behavior and automated regressions retained; no new execution asserted. |
| 177 | Owner shot checks 1/3/5 and D091 automation cover delivered image-overlay editing/variants/reload. |
| 178 | Owner PNG/CSV/JSON passes retained; print/PDF and native ZIP remain Phase 5 gates. |
| 179 | Owner map/evidence/immersive return passes; complete release history traversal remains Phase 5; shot failed-save transition belongs to the open Phase 4 gap. |
| 180 | Owner narrow-screen/menu passes and existing Chrome checks; broader physical-device/assistive-technology coverage not established. |
| 181 | Earlier provider/storage passes preserved; new capture cancellation/rejection/retry PASS under 251. Changed shot-workspace failure injection remains unestablished, not inferred from older workspace tests. |
| 182 | Historical deployment checks only; no reference edits in this task. Complete deployed-site/neighbor isolation remains Phase 5 release validation. |
| 183 | No new telemetry or runtime changes; fresh build console/network execution is not recorded by this audit. Include it with the remaining focused Phase 4 checks and the Phase 5 release sweep. |

## Genuine remaining closure conditions

CLAUDE.md requires each required phase test to pass or have an explicitly approved
exception with a retest condition. The approved image-overlay plan section 9
explicitly requires live capture/provider/storage-failure recovery, and the
implementation-plan exit gate retains flat-plan scale/calibration through reload.
The D093 result itself says failure-injection coverage is not inferred from the
seven-check owner report. Therefore accepting 251 does not fill these other gaps.

1. Record focused live results for the outstanding portions of 238/239/245/181:
   loading/source change or resize and failed readback/context capture; an
   image-bearing shot draft with forced storage failure; retained edits, blocked
   unsafe transition, emergency JSON, retry and recovered reload. Preserve the
   already accepted cancellation/wrong-surface/import checks without repetition.
2. Record one live permitted flat-plan calibration with an independent check
   distance, saved/reloaded scale and calibration status (243/107-111). The
   existing conditional owner check does not identify whether this was exercised.
3. Record affected Part J outcomes, including console/network observations,
   alongside those focused results, or obtain an explicit bounded exception
   naming unexecuted assertions and retest conditions. No exception is inferred.

These are missing execution evidence, not demonstrated defects. No reconfirmation
of checks 1-8 is requested. Missing browser/device metadata alone is not a blocker.
This documentation-only task does not run these live checks or implement fixes.

## Next phase handoff

**Phase 5 - Integrated prototype and release validation (F20 baseline)** is the
next phase in IMPLEMENTATION_PLAN.md section 6. It is not Phase 6 Research Mode.

Prerequisites: resolve the above Phase 4 gate evidence (or explicit bounded
exception); retain accepted Phase 3/assessment contracts, E1/E2, image-space
coordinates and provenance; inspect both read-only reference projects before any
new implementation. Start from published af8aa819 while preserving the current
working branch's unrelated history and all existing local changes.

Scope: integrated discover/dossier/immersive/candidate/assessment/comparison/shot
workflow; canonical JSON/media ZIP import/export and clean-profile recovery;
selected-section print-ready packets; save-before-transition/history/lifecycle;
accessibility and tablet validation; default-off, SLiVR-scoped service worker;
deployment/private-content/neighbor isolation and synchronized research records.

First tasks, in the plan's dependency order:

1. Inventory delivered exports and remaining packet/ZIP work; reconcile the
   section 7 acceptance trace with D068 assessments and D090/D093 image-overlay
   capture (no second 3D editor). Preserve entry-only bookmark limitations.
2. Audit save-before-transition, Back/Forward context and resource disposal;
   map changes to tests 113-132, 133-140, 208-215 and Part J 172-183.
3. Complete canonical media ZIP/recovery and selected-section HTML/print packets,
   then filename policy, keyboard/focus/contrast/reduced-motion and tablet checks.
4. Implement the planned default-off service-worker lifecycle only after
   reference inspection: scope /SLiVR/, SLiVR cache prefix, provider never-cache
   rules, kill switches network-first, and scope-filtered unregister operations.
5. Execute the integrated trace, exports/clean-profile recovery and provider,
   WebGL/storage failures; validate deployment isolation and close research records.

No Phase 5 implementation is authorized by this documentation handoff. Phase 6
Treedis Research Mode, participant collection and later roadmap features remain
outside it. Owner acceptance is technical workflow evidence, not a usability,
research-participant, physical-device generalization or provider-rights result.
