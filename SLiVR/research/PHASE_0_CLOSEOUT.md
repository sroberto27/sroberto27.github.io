# Phase 0 closeout evidence

**Status: PHASE 0 COMPLETE - owner approved the bounded acceptance exceptions
on 2026-09-20. Phase 1 is next and has not started.**

## Build and verification

- Runtime baseline: published `efa64612`; local baseline commit `31877b35`.
- Closeout edits: updated obsolete Treedis test expectations and corrected the
  demonstration page to load `config/deployment.js` instead of missing runtime.js.
- Node v24.18.0: `node --test tests/*.test.mjs` ? 326 passed, 0 failed.
- Initial closeout run: 318 passed, 8 failed. Failures expected deep-link startup,
  pre-polling loading state, or 25-second cancellation. Reconciled with D056/D059;
  no production Treedis behavior was changed to satisfy the tests.
- Six-entry shell verification now asserts actual Navigate sweep IDs, orientations,
  configured transitionTime 0, 600 ms ready delay and acknowledged arrival.
- `node tools/validate-catalog.mjs` ? 0 errors, 1 retained Old City Hall name warning.
- `node tools/check-deploy-scope.mjs` ? 0 errors, D057 browser-key exception retained.
- Manual evidence: owner confirms all eight supplied checks; test 27 additionally
  has a screenshot showing ten assertions PASS. D059 accepted separately by owner.
- Browser automation unavailable during closeout: no enabled browser/app surfaces.
- All closeout changes are confined to SLiVR. Existing unrelated user changes,
  including the untracked reference-project .claude directory, were untouched.

## Foundation evidence mapping

| Gate | Evidence | Qualification |
|---|---|---|
| Catalog/workbook and schemas (11?13) | Catalog tests, validation, catalog-repo rejection tests; owner counts/areas | Corrupted-catalog live UI not manually demonstrated |
| Shell/routes (14?15) | Router/shell suites and owner direct links, history, four modes | Later-phase editors/routes remain scaffolded |
| Persistence/transfer (16?21) | Full linked fixture store/transfer suites; owner basic browser save/reload, import/conflicts and failure recovery | Detailed store/index inspection and full linked fixture in real IndexedDB not observed |
| Imagery (22?25) | Owner six-area acceptance and archived 12 area/source content results below | No fresh provider probe during closeout |
| Optional 3D/optics (26?27) | Owner geometry/fallback and optics screenshot; renderer/math/failure suites | All failure variants not exercised on real GPU/provider |
| Treedis feasibility (28?29) | Owner all-entry and navigation acceptance; provider matrix; source/origin/cancellation tests | Raw reports and administrative metadata absent |
| Research traceability (30) | Evidence register, decisions, change log, measurements, limitations, provider matrix and this report | Technical validation only; no human-participant study claims |

## Preserved image-content evidence

Archived probe timestamp: 2026-09-20T06:49:24.366Z. Files remain in ignored
`outputs/imagery-probe/`; they are not newly published as part of closeout.

| Source | Area | Sample | Result |
|---|---|---|---|
| dotd-2025-various-6in-rgbi | AREA-01 | LOC-001 | covered |
| dotd-2025-various-6in-rgbi | AREA-02 | LOC-008 | covered |
| dotd-2025-various-6in-rgbi | AREA-03 | LOC-007 | covered |
| dotd-2025-various-6in-rgbi | AREA-04 | LOC-010 | covered |
| dotd-2025-various-6in-rgbi | AREA-05 | LOC-012 | covered |
| dotd-2025-various-6in-rgbi | AREA-06 | LOC-015 | covered |
| dotd-2024-lafayette-6in-rgbi | AREA-01 | LOC-001 | covered |
| dotd-2024-lafayette-6in-rgbi | AREA-02 | LOC-008 | covered |
| dotd-2024-lafayette-6in-rgbi | AREA-03 | LOC-007 | covered |
| dotd-2024-lafayette-6in-rgbi | AREA-04 | LOC-010 | covered |
| dotd-2024-lafayette-6in-rgbi | AREA-05 | LOC-012 | covered |
| dotd-2024-lafayette-6in-rgbi | AREA-06 | LOC-015 | covered |

## Standing regression sweep (Part J)

| Tests | Current evidence / applicability |
|---|---|
| 172?173 | Shell/catalog suites PASS; owner manual acceptance PASS |
| 174 | Selection/location opening covered; search/filter/full dossier are Phase 1 and remain unimplemented |
| 175 | Owner shared/independent entry acceptance; strengthened shell/source-isolation suites PASS |
| 176?177 | Full later-phase comparison/editor/undo workflows not Phase 0; foundation persistence/math suites PASS |
| 178 | JSON suites and owner transfer PASS; PNG/CSV/print are later-phase scope |
| 179 | Router/shell suites and owner history/context acceptance PASS |
| 180 | Keyboard/focus/reduced-motion logic covered by automated doubles; real tablet/visual contrast not reported |
| 181 | Failure suites PASS using doubles; owner imagery/storage/blocked-Google procedures PASS; all live variants not reported |
| 182 | Deployment scan PASS and scoped published commits reviewed; neighboring app destructive operations absent |
| 183 | Telemetry remains off; known demonstration runtime.js 404 source corrected; fresh browser console not observed |

## Owner-approved bounded acceptance exceptions (2026-09-20)

The owner explicitly accepted the combined automated foundation checks and manual acceptance for
Phase 0 while carrying these live-only evidence items to the first applicable
work package. None is silently marked PASS:

1. Live malformed-catalog error display (13), full IndexedDB store/index audit
   and linked fixture reload/transfer in a real browser (16?19): retest at the
   next browser-connected Phase 1 integration check, before expanding persistence.
2. Remaining real-device/provider variants (26, 180?181) and fresh console check
   after the one-line diagnostic configuration fix (183): retest on the next
   deployed build on desktop/tablet; no all-device compatibility claim until then.
3. Raw per-entry Treedis capability reports, capture date/extent and reuse-rights
   confirmation (28): obtain before Phase 2 provider-dependent features or
   media/freshness claims. Preserve unknown values until evidence exists.

No feature from Phases 1?6 is advanced by this review. Owner response: "Approve
these exceptions and close Phase 0." These exceptions satisfy the phase-close
rule without turning any unexecuted check into PASS. Next work package: Phase 1
Location Atlas and Dossiers, including the assigned browser storage/schema checks.

## Closeout artifact identity

SHA256 over 126 sorted runtime/tool/test/vendor paths (excluding ignored
runtime.js): `7a9ee940e3d45bffe110a5f854486f287764b1236febb0348964c2ee8d687b50`. Each relative UTF-8 path, NUL, raw file bytes, NUL is added in order.
Documentation is excluded so acceptance annotations do not change this identity.
Working-tree closeout based on published efa64612; not yet committed.
