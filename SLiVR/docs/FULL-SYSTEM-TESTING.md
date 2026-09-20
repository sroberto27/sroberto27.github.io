# SLiVR — Full System Testing

One living verification document for the complete SLiVR system. It begins before implementation and must be updated as Phases 0–6 are planned, built and validated. It combines phase exit checks, manual browser/device tests, provider checks, failure recovery, research traceability and a standing regression sweep.

The first-prototype release gate covers **Phases 0–5**. **Part I / Phase 6 Treedis Research Mode is post-prototype** and must not block the essential prototype unless the approved architecture is revised.

No test is pre-marked. A passing unit test, code review, HTTP response or earlier smoke test does not automatically prove browser/device behavior. Only the person or automated job that actually ran the test should record a result and evidence.

## Document control

| Field | Value |
|---|---|
| Test specification version | 0.2 |
| Architecture baseline | SLiVR architecture 0.19 or later |
| Created | 2026-09-19 |
| Last updated | 2026-09-20 |
| Current implementation phase | Phase 0.4 — reference repair; live acceptance remains open |
| First-prototype gate | Parts A–H and J, using the phase applicability rules below |
| Post-prototype gate | Part I plus affected regression tests |

Update this table whenever the architecture, phase, schema, provider contract or test meaning changes. Preserve prior real results in source history or an archived execution copy; never silently rewrite a test after it has produced evidence.

---

## Before you start

### Test target

Record the exact target. Never report “latest” without an immutable build or commit identifier.

Most recent recorded execution. Earlier executions are kept in the execution log at the end of this document.

**Manual follow-up:** the owner subsequently reported the embedded failure and
confirmed both base-tour links open directly in Chrome. The working tree now
includes D056's loading-overlay, pointer-event and base-tour-launch corrections.
No tests were run after the owner instructed that testing be manual. The target
table below identifies the last automated execution, not these later edits.

| Item | Recorded value |
|---|---|
| Build/commit | Uncommitted working tree, reference repair. SHA256 `e13c6854ccc9c5ec40169278df1b44ba7da24916e3a2a89c2e976cbed0491cd2` over 107 sorted publishable paths and their bytes, excluding `docs/` and `research/`; 117 publishable files total. |
| Deployment URL or localhost origin | No live result. Attempted `http://127.0.0.1:8787/SLiVR/#/immersive/LOC-001`; neither Chrome nor the in-app browser was available. No provider request made in this repair. |
| Test date/time and time zone | 2026-09-20, America/Chicago |
| Tester | Automated suite and imagery probe executed from the project root |
| Catalog/schema version | Catalog 1.0.0, record schema 1.0.0, transfer envelope 1.0.0, research snapshot 2026-09-19 |
| IndexedDB schema version | Workspace schema 1, database `slivr-workspace`. Exercised against an in-memory test double only. |
| Treedis adapter/capability version | `treedis-recon-2`; SCSU-based entry navigation, source/payload checks, shared-session reuse, independent-frame replacement and bounded recovery. Capabilities observed only through deterministic doubles in this run. |
| DOTD primary/fallback configuration | Primary `2025_Various_6IN_RGBI`, fallback `2024_Lafayette_6IN_RGBI`, both at 512 pixels, maxZoom 20, source resolution 0.150 m per pixel. Excluded: `Louisiana_Remote_Sensing_Map/MapServer/187`. Both configured services were requested live and returned photographic content over all six operational areas. |
| Optional Google 3D enabled/config version | Not exercised in this repair; external runtime configuration unchanged. Historical credential decision D042 remains applicable. |
| Browser and version | None. Discovery returned no browsers; both creation attempts returned `Browser is not available`. Vendored MapLibre 4.7.1 unchanged. |
| OS/device/input | Windows 11, Node.js v24.18.0 |
| Display/viewport | Not applicable |
| Network profile | No live provider execution in this repair |
| Study protocol/probe/schema version, Phase 6 only | Not applicable unless Part I is authorized |

### Running the application

SLiVR must be served over HTTP. Opening `index.html` from the file system does not work and is not a defect: browsers give a `file://` page the opaque origin `null`, which blocks ES module loading and every `fetch`, so the entry point never runs and the page stays at the stylesheet background. There is no error on screen, because no script executed to report one.

Serve the repository root, not the `SLiVR` directory, so the paths match the deployed layout:

```text
cd <repository root>
python -m http.server 8787 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8787/SLiVR/`. Any static server works; `npx serve` and the VS Code Live Server extension are equivalent. Record the exact origin used in the target table.

Before reporting a blank or broken page, run the boot smoke check, which starts the real entry point against a DOM stand-in and fails if the shell throws while building itself:

```text
node --test tests/shell-smoke.test.mjs
```

If that passes and the page is still blank, the cause is still undetermined: the stand-in does not test rendering. Check that the address begins with `http://`, inspect browser console/module/CORS errors, and confirm `data/catalog/manifest.json` loads from the same origin before assigning a cause.

Two failure paths cannot be produced on demand, so they are behind a SLiVR-scoped diagnostics key. Set it in the browser console, reload, and remove it afterwards:

```text
localStorage.setItem("slivr:diagnostics", JSON.stringify({ forceStorageFailure: true }))
localStorage.setItem("slivr:diagnostics", JSON.stringify({ forceImageryFailure: true }))
localStorage.removeItem("slivr:diagnostics")
```

`forceStorageFailure` makes every write fail, for test 21. `forceImageryFailure` abandons the primary imagery source on mount, for test 23. Both default to off and the application never writes them.

### Required fixtures

- The reviewed 17-location catalog: 11 current Treedis entries and six future candidates across six operational areas.
- Shared downtown experience `5eb11a1b`, preserving six distinct location/entry records.
- Magnolia Pantry independent experience `a872109b` and at least one non-downtown independent experience.
- A project with at least two scene requirements and at least three candidates containing known, unknown and conflicting evidence.
- A shot scene based on the supplied downtown reference with at least two cameras, actors/marks and movement paths.
- An owned test floor-plan/reference image with a known distance and documented units.
- Valid, malformed, older-schema, conflicting-ID and future-schema JSON fixtures.
- Provider-failure controls or test doubles for DOTD, Google 3D, Treedis, WebGL loss and IndexedDB write failure.
- Phase 6 only: synthetic WebXR fixtures before any live participant data; approved Quest/browser/runtime and authorized Treedis research entry for live compatibility testing.

### Reset and preservation

Export valid project JSON before clearing browser storage. Use a dedicated test browser profile. Never clear storage, service workers or caches for LSU3D or another application on the origin. Do not use real confidential production data or participant data in general system tests.

### Result format

Use exactly one status. `BLOCKED` requires a concrete dependency and retest condition. `NOT TESTED` means no execution evidence exists.

```text
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED
Evidence: build, browser/device, automated test or artifact link
Comments: observed behavior, failure details, issue ID, or retest condition
```

For failures, include test number, actual result, expected result, reproduction steps, console/network evidence and whether user data was at risk. Fixes happen in a separate pass; rerun the failed test and its named regression set after the change.

### Phase-update rule

When implementation adds or changes a feature, Claude must update this document in the same phase work package:

1. Add or revise tests before claiming the feature complete.
2. Link tests to the affected feature ID, decision and phase exit gate.
3. Keep unimplemented tests unmarked.
4. Record automated evidence separately from live browser/device evidence.
5. Add discovered regressions and failed assumptions; do not remove inconvenient tests.
6. Run the affected phase section plus Part J before closing the phase.

---

# Part A — Scope, repository and deployment invariants

These checks apply in every phase. Test 184 sits here for the same reason; its number is out of sequence because identifiers are stable once referenced and 1 to 183 were already allocated.

**1. LSU3D remains untouched. [D001]** Compare the LSU3D working tree/baseline recorded before SLiVR work with the current state attributable to this project. Confirm no SLiVR implementation changed, generated, formatted, staged or deployed a file under `E:\sroberto27.github.io\Wrapper\map\LSU3D`.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**2. Every SLiVR commit is path-scoped. [D012]** Inspect each commit being evaluated. Every changed path must begin with `SLiVR/` from the repository root; no unrelated staged or outgoing commit is included.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**3. Source comments are concise and professional. [D012]** Sample changed modules. Comments explain intent, constraints, units, coordinate frames or provider behavior without restating code, narrating implementation or containing automated-authorship references.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**4. The first prototype remains static/no-build. [D004]** Confirm it runs as static HTML, CSS and JavaScript ES modules and does not require Vite, TypeScript, React or a framework-specific development server to function.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**5. Public output uses an allowlist.** Inspect the built/deployed artifact. It must exclude `docs/`, the paper, book, planning references, `research` working records unless deliberately published, credentials, local exports, test data containing private content and user workspace files.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**6. No LSU identity remains.** Search rendered UI, metadata, icons, manifests, catalog and routes for LSU/Baton Rouge recruitment language, LSU coordinates, LSU branding and obsolete campus content. Necessary references in provenance/development documentation are excluded from this visual/product check.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**7. Credentials are external.** Confirm no Google, Treedis, Cloudflare or other token/secret is committed, rendered into public files, printed in exports or written to research logs. Missing optional credentials must produce a supported fallback.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**8. SLiVR storage and cache names are isolated.** IndexedDB database names, local/session-storage keys, cache names and service-worker scope belong to SLiVR. No code enumerates and deletes every registration/cache on the shared origin.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**9. Unknown facts remain unknown.** Inspect catalog rendering, comparisons and exports. `Need validation` and `Information has not been found` must never become available, approved, no restriction, owner confirmed or another favorable claim.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**10. Deferred features did not enter the prototype accidentally.** Confirm Phases 0–5 contain only the approved five feature families and their required foundations. Phase 6 research service and Phases 7–9 product features remain dormant/unimplemented unless a later approved work package explicitly activates them.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**184. Implementation follows the reference, and divergence is corrected rather than excused. [D044]** For each module changed in the phase, identify its LSU3D counterpart and compare them. Cover plumbing specifically: library loading, stylesheet order, container setup, source and layer identifiers, lifecycle, teardown, request shapes and provider parameters. Classify every difference as one of: matches the reference; qualifies under one of the three permitted reasons and is recorded in the decision record naming the LSU3D file; or has no counterpart. A difference that fits none of those is corrected by changing SLiVR to match the reference, in this phase. This test does not pass while any unjustified divergence is outstanding, and recording a reason for a divergence that qualifies under none of the three does not satisfy it. The reference is not treated as authoritative where it was never executed.

Result: - [x] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: First execution, 2026-09-20, over the Phase 0 modules, build `e1cbe66298b5`. Compared against `js/02-state.js`, `js/04-street-view.js`, `js/05-map-helpers.js`, `js/11-boot.js`, `js/12-start-screen.js`, `js/16-google-tiles.js`, `js/17-router.js`, `config.js`, `index.html` and `css/`. 286 automated assertions passing afterwards.  
Comments: Ten divergences were corrected by changing SLiVR to match the reference: stylesheet order; the library vendored and loaded as a classic script; a style mutation verified rather than assumed, since neither `addSource` nor `addLayer` throws on rejection; distinct source and layer identifiers; a readiness guard for a map that has already loaded; resizing on container change; reusing the same capture instead of reloading it; a modal that declared `aria-modal` without a focus trap, Escape or focus restoration; a viewport that did not cover the device edges, with safe-area insets adopted alongside it; and a reduced-motion rule that removed state feedback rather than travel. Five of the ten failed silently, with no test, error or visible symptom. Six divergences qualified under reason 1 and are recorded: D045 no camera constraint to an envelope that is explicitly not a boundary, D046 a container observer in place of timed resize calls, D047 releasing the provider session on leaving, D048 the focus trap adopted from the reference, D049 failures that persist rather than auto-dismissing, plus the standing D016, D025, D030, D035, D040 and D041. Modules with no counterpart, compared against nothing and listed as such: the catalog and record schemas, IndexedDB persistence, versioned transfer, the shot workspace, the research records, and capability detection, which the reference does not perform. The reference was not treated as authoritative for the Treedis protocol, which it never executed; live reconnaissance superseded it and the observed pose payload differs from its transcription. Phase 4 reuse obligations are recorded in the implementation plan and as D050; they are obligations rather than divergences, because the code they govern does not exist yet, and this test checks them when it does. No unjustified divergence is outstanding in Phase 0, which is what this result asserts and the only thing it asserts.

---

# Part B — Phase 0: foundation and feasibility

## Catalog, schemas and application shell

**11. The catalog contains exactly 17 stable records. [F01/F02]** Confirm 11 records have current Treedis inventory entries and six are future candidates. IDs remain stable across reload and JSON/catalog regeneration.

Result: - [x] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: Automated. `node --test` from the project root, 82 tests passing, Node v24.18.0, build digest `89aae7a86236`. Suite `tests/catalog.test.mjs`, tests "the catalog holds exactly 17 locations, 11 current and 6 future", "location identifiers are the documented stable sequence" and "regenerating the catalog produces identical records".  
Comments: Catalog 1.0.0 holds 17 locations (11 current, 6 future), 17 captures, 17 scout-detail records, 6 areas and 42 sources. Identifiers are LOC-001..LOC-017, CAP-001..CAP-017 and AREA-01..AREA-06. Rebuilding from the workbook produced byte-identical output for all six files apart from the manifest `generatedAt` stamp, and the suite re-reads the JSON from disk on every run. Browser reload is not covered here because no application shell exists yet; it is retested against test 14 once the shell is built.

**12. All six operational areas reconcile with the workbook.** Counts, names and location membership match the approved database; the solar-energy destination is absent from the committed 17.

Result: - [x] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: Automated. Same run as test 11. Suite `tests/catalog.test.mjs`, tests "area membership reconciles with the workbook counts" and "the solar-energy destination is absent from the committed inventory"; plus `node tools/validate-catalog.mjs`, 0 errors and 1 warning.  
Comments: All six areas reconcile: AREA-01 Downtown Core 7/0, AREA-02 Sterling Grove / North Sterling 1/0, AREA-03 Johnston Street / Moncus / Blackham 2/1, AREA-04 Northside / Clara Street 1/0, AREA-05 Cajundome / South Campus 0/4, AREA-06 UL Main Campus 0/1, totalling 11 current and 6 future. Derived membership matches each area's declared `locationIds` and the counts recorded in the workbook. No record mentioning the solar-energy destination is present. The single warning is benign and expected: CAP-003 records the location as "Lafayette Old City Hall" while LOC-003 is named "Lafayette Old City Hall / Bank of Lafayette".

**13. Catalog validation rejects structural errors.** Exercise missing IDs, duplicate IDs, invalid coordinates, invalid capture states, malformed evidence status and broken experience references. The app reports actionable errors and does not load a partially corrupted catalog silently.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated only, two suites. `tests/catalog.test.mjs` covers 13 build-time rejection cases and `tools/validate-catalog.mjs` reports each positionally and exits non-zero. `tests/catalog-repo.test.mjs` (Phase 0.2, 22 tests) now covers the load path through `src/data/catalog-repo.js`: unreachable file, catalog-version mismatch between files, manifest with no version, a file that is not a catalog document, missing identifier, duplicate identifier, out-of-envelope coordinate, swapped [lat, lon] pair, invalid capture state, experience outside the region allowlist, fabricated tour on a future candidate, broken area reference, manifest count mismatch and coerced unknown vocabulary. Each returns a classified code with the failing path, and `result.catalog` is `undefined` on every rejection. `src/app/errors.js` maps each code to a stated recovery whose wording says nothing was loaded; `tests/store.test.mjs` asserts that mapping and that an unrecognised code is reported as unrecognised rather than replaced by a generic sentence. Run: `node --test`, 190 tests passing, Node v24.18.0, build digest `a8f4b4e4bd59`.  
Comments: The loader half is now implemented and exercised, including the property this test exists for: a rejected catalog publishes no records at all rather than a partial list. What is still missing is the rendered half, that a person opening the application on a corrupted catalog sees the actionable error with an otherwise intact shell. That needs a browser, and none was available in this run because the automation extension was not connected. Retest in a live browser: serve the project, replace one catalog file with a broken copy, load `#/explore`, and confirm the error card names the failing path and that no location list is shown.

**14. Stable routes open directly.** Load `/explore`, one `/location/{id}`, one `/immersive/{id}`, one project/scene route and one shot route from a fresh tab. Supported routes restore context; invalid IDs produce a recoverable not-found state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated only. `tests/router.test.mjs`, 17 tests, same run and build. Covers every approved route (`#/explore`, `#/location/{id}`, `#/projects`, `#/project/{id}`, `#/project/{id}/scene/{id}`, `#/immersive`, `#/immersive/{id}?bookmark=`, `#/shot`, `#/shot/{id}`), the empty-hash default, deterministic serialisation and round trip, stable query ordering, percent-encoded identifiers, a malformed escape sequence, direct opening of a deep route against a window stand-in, Back and Forward through `hashchange` and `popstate`, and the guarantee that a route carries record identifiers only. Identifier resolution is covered in `tests/catalog-repo.test.mjs`: an unknown location identifier resolves to `null` rather than an empty record, which `src/app/actions.js` turns into a recoverable `unknown-record` state naming the catalog version.  
Comments: Route grammar, resolution and the not-found state are implemented and exercised, but this test is written as a fresh-tab browser check and no browser ran. The window stand-in models `location.hash`, `history.replaceState` and the two events; it does not show that a real browser produces the same sequence, that a pasted link restores the right context, or that the shell renders any of it. Retest live: serve the project and open each of the five route shapes in a fresh tab, plus `#/location/LOC-999` and `#/nowhere`, confirming the recoverable not-found panel and its two return actions.

**15. The application shell exposes the four approved modes.** Explore, Projects, Immersive and Shot Designer occupy a consistent top-level control, show active state and preserve the active breadcrumb/save status.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Partial automated evidence, added 2026-09-20 with the boot smoke check. `tests/shell-smoke.test.mjs` boots the real entry point against a DOM stand-in and asserts that the four mode controls are rendered in the approved order (`explore`, `projects`, `immersive`, `shot`), that exactly one carries `aria-current`, and that clicking one changes the hash, applies the route and re-renders that mode. The breadcrumb and save-status chip are built in the same top bar region. Build `04b19216f222`.  
Comments: The controls exist, are in the right order, carry an active state and respond to activation, which is more than was claimed before. What this test is actually about remains unobserved: whether the controls are legible, hold their position between modes, are reachable and operable by keyboard with visible focus, and whether the breadcrumb and save status stay visible. The stand-in has no layout, styling or real event dispatch. Retest live once a browser is available.

## IndexedDB and JSON foundation

**16. IndexedDB creates only the documented database, stores and indexes. [D005]** Confirm schema version, upgrade path and indexes match the approved domain records and do not create data outside the SLiVR namespace.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated against an in-memory test double. `tests/workspace-repo.test.mjs`, 21 tests, same run and build. Asserts that `src/data/migrations.js` declares exactly the eleven approved stores (`meta`, `projects`, `scenes`, `candidates`, `bookmarks`, `shotScenes`, `sceneObjects`, `paths`, `shots`, `variants`, `assets`) with the approved index list per store, including the compound `[projectId, sceneId]` and `[shotSceneId, type]` keys; that the schema version equals `WORKSPACE_SCHEMA_VERSION` and the `storage.databaseVersion` in `data/region/lafayette.region.json`; that opening creates that database and nothing else; and that reopening at the same version keeps existing records. `assertStorageConfig` refuses a database name outside the `slivr-` namespace, a key prefix outside `slivr:`, and a configured version disagreeing with the schema, and the repository constructor throws rather than opening.  
Comments: The declaration, the upgrade path and the namespace guard are exercised, but against `tests/fixtures/indexeddb.mjs`, a deliberate test double that says so in its own header. It does not show what a browser IndexedDB implementation actually creates. Retest live: open the application, inspect Application then IndexedDB in developer tools, and confirm database `slivr-workspace` version 1 with exactly those stores and indexes, and that no database, local-storage key or cache belonging to a neighbouring application on this origin was created or removed.

**17. A basic project round-trips through IndexedDB.** Create, save, reload and reopen a fixture containing project, scene, candidate, bookmark, shot scene, object and shot references. IDs and relationships are identical.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated against the same in-memory double. `tests/workspace-repo.test.mjs` writes the fixture in `tests/fixtures/project.mjs` (one project, two scene briefs, three candidates, one bookmark, one shot scene, two scene objects, one path, one variant, one shot), reads it back through `loadProjectBundle`, and compares identifiers per store together with the `sceneId`, `locationId`, `variantId`, `cameraObjectId` and `ownerObjectId` relationships. A separate test asserts the zero values survive: camera `headingDeg` 0 and `x` 0, shot `order` 0, scene `northOffsetDeg` 0, `groundElevationM` 0, and the first path point at `atS` 0.  
Comments: Records and relationships round-trip through the repository, and the reopen-at-same-version test covers the reload path at the storage layer. The part of this test that was not executed is the browser one: creating a project in the interface, reloading the page, and confirming it returns. Retest live: create a project on `#/projects`, reload the tab, and confirm the project and its identifier come back unchanged.

**18. Versioned JSON round-trips without loss.** Export the fixture, inspect version/units/coordinate frames/references, import into a clean profile and compare normalized records.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated. `tests/transfer.test.mjs`, 28 tests, same run and build. The envelope declares `schemaVersion` 1.0.0, `kind` `slivr-project`, `appVersion`, `exportedAt` and `catalogVersion`. The fixture is written to storage, exported, parsed, imported into a second empty database, and compared with `normalizeBundle`, which sorts records and keys and yields a deep equality across every record. Separate assertions cover units (`metric`), the coordinate frame (`northOffsetDeg`, `origin.elevationDatum`, `calibration.accuracyMode`), zero values, the catalog reference triple (`locationId`, `captureId`, `catalogVersion`), and that no provider imagery URL, data URI or credential pattern appears in the exported text. A file exported against catalog 0.9.0 imports and produces a version note without rewriting any catalog fact.  
Comments: The transfer format and the repository round trip are exercised end to end, but through the in-memory double, and no file ever left or entered a browser. Not executed: the download, the file picker, and reading the file back in a genuinely clean browser profile. Retest live: export a project to disk, open a fresh profile, import that file, and compare the visible records.

**19. Malformed and unsupported JSON never mutates saved data.** Test invalid JSON, missing required fields, duplicate references and future schema version. Validation occurs before writes and reports the failing path/reason.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated. `tests/transfer.test.mjs` covers invalid JSON, a file that is not a SLiVR export, a missing schema version, schema versions `2.0.0` and `1.1.0` (both refused with the version named in the message), a missing required field reported at `payload.projects[0].name`, a duplicate identifier inside one file, a reference to a record not present in the file, a file carrying more than one project, and an inline asset with no matching record. One test stores the fixture, attempts an import whose payload is broken and which also renames the project, then compares the stored bundle before and after and finds it unchanged. Another asserts that validation reports every problem it finds rather than only the first.  
Comments: Validation runs before any write and the outcomes are classified, so the data-safety property this test protects is demonstrated at the module level. What was not executed is the interface behaviour: that a person choosing a broken file sees the failing path and reason and keeps their workspace open. Retest live using the invalid, older-schema, conflicting-ID and future-schema fixtures through the import control.

**20. ID conflicts have an explicit outcome.** Import a project whose ID already exists. Confirm cancel changes nothing, add-as-copy creates new stable IDs/references, and deliberate replace replaces only the selected project.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated. `tests/transfer.test.mjs` covers all three outcomes against a workspace that already holds the project. An import offered no resolution is refused with `transfer-conflict-unresolved` rather than guessing. Cancel writes nothing and the stored bundle is identical afterwards. Add-as-copy produces a second project in which every workspace identifier is new and `projectId`, `sceneId`, `ownerObjectId`, `variantId` and `activeVariantId` all point inside the copy, while catalog identifiers (`LOC-001`, `CAP-001`, experience `5eb11a1b`) are deliberately kept because the copy describes the same real place. Replace removes only the named project, including records the replacement does not carry, and a second unrelated project in the same database keeps its records. An unknown resolution such as `merge` is refused.  
Comments: Every outcome is exercised at the data layer. The conflict dialog in `src/app/shell.js` presents the three choices with the file summary and a catalog-version note, but it was not operated, because no browser ran. Retest live: import a project that already exists and exercise each of the three buttons in turn.

**21. Storage failure preserves recoverable work.** Force a quota/write/transaction failure. The current workspace stays open, shows Save failed, supports retry and produces valid emergency JSON from memory.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated, partial. `tests/workspace-repo.test.mjs` forces every write to fail through the double and confirms that a failed single-record write leaves the stored record at its previous name and revision, and that a failed bundle write aborts with no part of it applied. `tests/store.test.mjs` covers the save-status surface: saving then failed, the failure staying failed with `canRetry` true and the classified code preserved, a retry re-running the same operation and succeeding, and overlapping writes reporting saved only once the last one finishes. `tests/transfer.test.mjs` builds an emergency export from an in-memory bundle with no storage access, parses it, and imports it into an empty database with no loss.  
Comments: The recovery mechanism exists and its parts are exercised, but this test as written is a live one: forcing a real quota or transaction failure in a browser and confirming the workspace stays open and usable. That did not run. `src/app/capabilities.js` reads a SLiVR-scoped diagnostics flag for exactly this purpose: set the `slivr:diagnostics` local-storage key to enable `forceStorageFailure` and reload, and every write fails. The flag defaults to off and the application never writes it. Retest live with that flag, and again with browser storage genuinely full, confirming the Save failed chip, a working retry, and a valid emergency JSON file.

## Provider feasibility

**22. DOTD 2025 primary imagery returns real Lafayette pixels. [D006]** Test representative points in all six operational areas. Validate image content, not only HTTP 200, and record endpoint, date, response and visual evidence.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Live provider evidence, automated. `node tools/probe-imagery.mjs --keep-images`, run 2026-09-20 from Windows 11 / Node v24.18.0, build `50dcb29e0e57`. One representative catalog location per operational area (AREA-01 to AREA-06) was requested from the configured 2025 service at its own ground sample distance of 0.150 m per pixel, 512 by 512, through the same `exportImage` template the map uses. All six returned photographic content: mean channel standard deviation 25.4 to 56.1 over 22,234 to 49,992 distinct colours in 262,144 pixels, with no near-black pixels. The production JPEG request was issued for each point alongside the pixel probe and returned `image/jpeg` at 32.7 to 45.3 kB. Endpoint, bbox in EPSG:3857, ground sample distance, byte counts, timings and full statistics are in `outputs/imagery-probe/imagery-probe.json`, with the decoded BMP and the production JPEG saved per point. Two calibration controls inside the published service extent but outside coverage, open water and rural land, both returned 100% no-data across a single colour, so the thresholds are shown to separate coverage from an empty response rather than assumed to.  
Comments: The provider half of this test is done, and it found the thing the test exists for: the service publishes an extent covering much of the state while holding imagery only for selected areas, and its own metadata records the no-data value as 0, so an uncovered request returns a valid, entirely black image with a 200 response. A status-code check would have called that success. What remains is the in-browser half the plan also requires: tiles rendering through MapLibre in a real browser, with a screenshot. No browser was available in this run. Retest live: open `#/explore`, confirm imagery draws over the Lafayette envelope, and capture a screenshot.

**23. DOTD 2024 Lafayette fallback activates on primary failure.** Block/disable the primary service and confirm equivalent representative areas remain visible with the fallback year/source identified.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Two parts, both automated. Coverage: the same probe run requested all six operational areas from the configured 2024 Lafayette service and all six returned photographic content, standard deviation 26.5 to 40.4 over 20,617 to 30,785 distinct colours, so the fallback genuinely covers the equivalent areas rather than merely answering. Behaviour: `tests/imagery.test.mjs` exercises `createImageryFailover` end to end. An isolated tile failure does not abandon a working source, four consecutive failures with no success between them move to the fallback, the resulting status reports year 2024 with `isFallback` true and an attribution naming 2024, and the transition is appended to a history entry carrying the provider reason.  
Comments: Fallback coverage and the switching logic are both evidenced. Not executed: blocking the primary host in a browser and confirming the map redraws from the fallback with the 2024 attribution visible on screen. For the manual pass, set the `slivr:diagnostics` local-storage key to enable `forceImageryFailure` and reload, which abandons the primary on mount; blocking `maps.dotd.la.gov/...2025_Various_6IN_RGBI` in the network panel exercises the same path through real tile errors.

**24. Imagery attribution and accuracy limits are visible.** Confirm DOTD source/year attribution and the statement that imagery is contextual rather than authoritative measurement/navigation/property evidence.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Partial, automated. The configuration refuses any source whose attribution does not name its year, so a screenshot cannot show imagery without identifying the flight, and `tests/imagery.test.mjs` asserts that rule and the year carried through a failover. When every source is exhausted the attribution reads that no aerial imagery is available and deliberately contains neither year, so nothing stale is attributed. `region-config.js` requires an `accuracyNote`, and the Explore panel renders it beneath the map together with the active source and year.  
Comments: The wording exists, is required by validation, and is wired into the panel, but nobody has seen it rendered. Attribution visibility is a question about the screen, not about the data. Retest live: confirm the DOTD source and year are legible over the map at desktop and tablet widths, that the contextual-not-survey statement is present, and that after a failover the year shown changes to 2024.

**25. Layer 187 is not the configured Lafayette primary.** Inspect configuration and rendered requests. If exposed for diagnostics, it must not silently replace the approved source after an all-black/no-data response.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Configuration and provider evidence, automated. The 2026 layer is recorded in `data/region/lafayette.region.json` as an excluded service with its reason; `validateRegionImagery` raises an error if it is ever set as the primary or the fallback, and `tests/imagery.test.mjs` asserts that. A second test scans every committed file under `src/`, `styles/` and `index.html` and fails if any of them references that service, so it cannot reach a rendered request from application code. The probe also queried it directly for all six operational areas through the correct map-service `export` operation with that layer shown: every response was HTTP 200 with a valid image of one flat colour, recorded as `uniform` in the probe report.  
Comments: This is the confirmed negative the architecture records, and probing it produced a sharper finding than expected. The excluded service does not return black; it returns a uniform non-black fill with a 200 response, so a check that only looked for an all-black image would have passed it. The content classifier rejects any single-colour image whatever its colour, which is what makes this detectable. An earlier probe run reported HTTP 400 for this service; that was a defect in the probe, which was calling the image-service operation on a map-service layer, and it was corrected before this result. Not executed: inspecting the browser network panel to confirm no request is issued to this service during a session.

**26. Optional Google 3D fails without blocking the workspace. [D008]** Test missing key, denied request, slow response and disabled configuration. Aerial/plan/simple Three.js views, editing, saving and export remain available.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated, four of the five paths. `tests/workspace-3d.test.mjs`, 23 tests, build `6e0130e240ad`. No credential is an explicit `absent` state whose wording says the aerial, imported-plan and blank-grid workspaces are unaffected, and no request is made at all. A disabled configuration is a distinct state from a missing credential. A refused credential returns `denied` and names the likely cause, a referrer restriction. A service that does not answer within the timeout returns `slow` rather than hanging, and an unreachable one is distinguished from a refusal. Across every one of those states, plus no WebGL, `availableBackgrounds` leaves the blank grid available and every unavailable option carries a reason. `redactCredentials` is asserted to strip `key`, `api_key` and `token` values from any text that reaches a display or a log.  
Comments: The failure paths are exercised, but against injected responses rather than the real service, and the one path that needs a working credential — the tiles actually loading and then being removed — has not been attempted, because no Google Maps 3D Tiles key has been supplied. Retest live: with no credential, open `tools/three-spike.html` and confirm the scene renders and the optional-3D panel reads `absent`; with a credential in `config/runtime.js`, repeat for the available, denied and slow cases. Editing, saving and export do not depend on this provider at any point.

**27. Minimal Three.js scene proves transforms and optics.** Place a camera, actor and frustum; verify zero rotation, translation, height, unit conversion and at least one independently calculated FOV fixture.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated. `tests/workspace-3d.test.mjs` plus the Phase 0.1 optics and frame fixtures. Zero rotation is the identity and zero heading points at scene north; heading follows a compass, with 90° east, 180° south, 270° west; the basis stays orthonormal at an arbitrary heading and pitch to within 1e-12; a positive pitch raises the view without rolling the horizon. Translation and height: a 1.5 m mount height places the camera at 1.5 m on the ground floor and at 4.7 m on a floor 3.2 m up. Unit conversion: 1.5 m is 4.92126 ft. Optics, independently calculated rather than quoted: a 36.0 by 24.0 mm gate at 50 mm gives 39.5978° horizontally and 26.9915° vertically, matching `2 * atan(36 / (2 * 50))` to 1e-9. The frustum has eight corners that widen with distance, rotates with its camera, and decides framing by containment rather than proximity, including the cases just inside and just outside its horizontal edge. `buildThreeScene` is exercised against a stand-in library and asserted to place only what was already computed.  
Comments: Every number this test names is now computed and checked, and the geometry is deliberately separated from the library so a rendering fault cannot be mistaken for a maths fault. What remains is the rendered half: `tools/three-spike.html` draws the camera, actor and frustum from these same corners and repeats the fixtures on screen, but it has not been loaded. Retest live: open that page and confirm the scene draws and every assertion in its list reads PASS.

**28. Treedis capability reconnaissance covers all supplied entries. [F03/F19]** Record availability, authorization, ready/navigation messages, sweep support, view/pose availability, capture metadata and failure behavior for the shared downtown entries and five independent experiences without assuming unsupported APIs.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Two parts. Availability, automated and live against the provider: `node tools/probe-treedis.mjs`, run 2026-09-20, requested all 11 supplied entry URLs. All 11 answered 200, all 6 experiences are inside the region allowlist, and every entry document echoed both its experience identifier and its own sweep identifier, so the supplied URLs address the viewpoints the catalog claims. No entry returned a header refusing embedding: none carries `X-Frame-Options`, and none carries a `frame-ancestors` directive. Full per-entry endpoints, statuses, timings, header findings and SDK hints are in `outputs/treedis-probe/treedis-probe.json`. Contract, automated: `tests/immersive.test.mjs`, 21 tests, covering the message vocabulary, origin enforcement, handshake, navigation, timeout and capability rules. Runtime, not executed: `tools/treedis-recon.html` loads each entry through the shipping adapter and records what the viewer does. Since 2026-09-20 the same adapter also runs inside the application itself, so this test can be executed from Immersive rather than only from the standalone harness, and `actions.viewerReport()` returns the per-entry record from whichever capture is open.  
Comments: Availability and authorization are established. Embedding is not: the absence of a refusing header is a necessary condition, not a sufficient one, because the page may still refuse in script and the viewer may fail inside a cross-origin frame. Ready and navigation messages, sweep support and pose availability have not been observed at all, and every one of them reads `unknown` in the capability record rather than being assumed either way. Capture metadata remains `Information has not been found` for all 11 entries; retrieving capture date, coverage and reuse rights needs the Treedis administrative access that has not been supplied. Retest live one entry at a time, either from the harness or from Immersive, and keep the report as the provider capability matrix. Eleven entries are required; one has been observed, from the harness.

**29. The shared downtown model proves distinct entry navigation.** Navigate to at least two supplied downtown sweep/entry targets and show that catalog identity remains distinct even though the experience ID is shared.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [x] NOT TESTED  
Evidence: Automated in part. The probe confirms six catalog records — LOC-001 to LOC-006, captures CAP-001 to CAP-006 — share experience `5eb11a1b` while carrying six distinct sweep identifiers, each echoed by the delivered document. `tests/immersive.test.mjs` asserts that the adapter report identifies the capture and location, not only the experience, so two findings inside the shared experience cannot be confused; and that a sweep change is only recorded as no-reload navigation when a pose actually reports arrival at the requested sweep. `tools/treedis-recon.html` offers, for whichever entry is loaded, a navigation button per sibling record in the same experience, labelled by location identifier. Added 2026-09-20, build `65ccbfbf7da7`: `tests/shell-smoke.test.mjs` opens all six downtown routes through the real entry point and asserts that the viewer frame receives six distinct entry URLs, all inside experience `5eb11a1b`, with application state naming the requested location each time. That covers the routing half through the product rather than through a fixture.  
Comments: The catalog half is proven, and as of build `65ccbfbf7da7` so is the routing half: six routes reach six distinct entry URLs inside one shared experience. What no test can show is the screen. The navigation half has not been run, because it needs the viewer to accept a `Navigate` command, which is exactly the capability that is still unknown. Retest live: load CAP-001 in the harness, navigate to at least two of the other downtown targets, and confirm both that the view changes and that the harness continues to name the destination by its own location identifier. If the bridge does not answer, the fallback is a full reload of the sibling entry URL, which the harness also offers and which always works.

**30. Phase 0 research records and test traceability are complete. [D013]** Every approved feature has a research entry; material decisions, validation failures, provider capability and limitations are recorded; Phase 0 implementation/tests link back to feature and test IDs.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part C — Phase 1: Location Atlas and Dossiers

**31. Explore opens on the approved Lafayette envelope. [F01]** The initial view contains the working inventory without presenting the padded region as a legal/property/capture boundary.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**32. Map and list contain all 17 records exactly once.** Clustering may change marker presentation, but result counts and accessible list entries remain correct.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**33. Current capture and future candidate have distinct treatments.** Check markers, list rows and dossiers. Research completeness appears separately and never overwrites capture status.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**34. Selection is synchronized.** Select from map, list and direct location route. The same location is highlighted, scrolled/focused appropriately and opened in the dossier without feedback loops.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**35. Search covers approved fields.** Verify name, address, operational area, venue type and representative visual/practical tags, including case/spacing tolerance and zero-result behavior.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**36. Filters combine deterministically.** Exercise area, capture, interior/exterior, venue type, historic/contemporary, known public hours, immersive coverage, access, validation and completeness individually and in combinations; counts/map/list agree.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**37. Sorting is stable and correctly labelled.** Test name, area, capture availability and recently viewed. If user-location distance exists, it is straight-line distance and never travel time.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**38. Clusters expand without losing selection/filter state.** Zoom out/in, open a cluster and use browser history. The selected record and result set remain consistent.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**39. Every dossier has the approved sections. [F02]** Overview, visual/spatial character, immersive coverage, production considerations, access information, evidence/source details and project actions are present or show an explicit missing state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**40. Evidence status is understandable.** A reviewer can distinguish source, observation date/method, approximate coordinate, reported/public information, remote observation, on-site verification and missing/unvalidated facts.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**41. Operator, owner, filming authority and contact remain separate.** Inspect representative public, university, municipal and unclear records. No label implies ownership or booking authority incorrectly.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**42. Public hours do not imply production availability.** Locations with hours show an explicit distinction and unknown availability remains unknown.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**43. Future candidates never receive fabricated immersive actions.** Each of the six shows future/no-current-capture state and recovery/next-step text rather than an invented tour or sweep.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**44. Dossier project actions carry stable IDs.** Add/compare candidate, open existing candidate, enter Immersive, create/open shot design and copy public location link all target the intended location/context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**45. Catalog data remains read-only.** Attempt project note/rating changes and JSON import. Master catalog facts and evidence are unchanged; project overlays remain separately stored.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**46. Map/WebGL failure leaves a usable list and dossier.** Force map initialization failure or WebGL loss. Search, results, dossier and relevant project actions remain keyboard-operable.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**47. Imagery failure uses a neutral recoverable state.** Block both DOTD services. No endless spinner or misleading stale imagery appears; markers/list/dossier remain usable and a retry/status message is available.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**48. No-result search can recover.** Apply an impossible combination. The UI explains zero matches and can clear filters without reload or lost mode context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**49. Location links round-trip.** Copy links for one current and one future location, open each in a fresh tab and confirm exact selection, dossier and fallback behavior.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part D — Phase 2: Immersive Scout

**50. Immersive opens the selected current capture. [F03]** From a dossier, open Carpe Diem and confirm active catalog location, experience, entry/sweep and breadcrumb agree.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**51. Six downtown records remain distinct inside the shared experience.** Enter each supplied downtown location and verify location-specific name, address, entry and notes without unnecessary iframe reload where supported.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**52. Switching to Magnolia loads the independent experience cleanly.** The previous session cannot emit a late event that changes the new location, sweep, caption or readiness state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**53. A non-downtown independent experience works.** Test at least Moncus Park, Play N Trade, Givens House or the former Truman site and record any capability differences rather than hiding them.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**54. Lifecycle states are explicit and reachable.** Verify not loaded, loading, ready, navigating, unavailable, unauthorized, timed out and failed through real behavior or deterministic test doubles.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**55. Message validation rejects untrusted input. [D007]** Wrong origin, wrong source window, unknown type, malformed payload, wrong active generation and stale session events do not change state or execute navigation.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**56. Zero-valued pose fields survive validation.** A valid x/y/rotation value of zero is retained rather than treated as missing/falsy.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**57. Rapid switching cannot create a race.** Switch among at least three locations before each finishes loading. Only the final selection can become active; abandoned frames/timers/listeners are disposed.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**58. Timeout and retry recover.** Simulate a hung provider, wait for the documented timeout, retry and then return to Explore. No endless spinner, duplicate frame or orphan loading state remains.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**59. Unauthorized and unavailable are different.** A denied current capture and a future/no-capture location show correct, non-misleading states and next actions.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**60. Supported view bookmark saves complete context. [F04]** Save location, experience/capture, sweep/entry, supported orientation/view fields, name, note, date and schema/provider version.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**61. Bookmark restore reaches the intended view when supported.** Restore after leaving Immersive and after a full reload. The associated project/location context remains intact.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**62. Unsupported/retired bookmark restore explains the limitation.** Alter/remove a sweep or capability in a fixture. The app preserves the bookmark, identifies the unavailable part and offers the nearest safe recovery without silently redirecting.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**63. Capture metadata and coverage warnings remain visible.** Users can see known date/version/coverage and unknown values without implying that unseen rooms or current conditions were inspected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**64. Returning to Explore restores map context.** Center, zoom, filters, selection and dossier state survive the round trip.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**65. Leaving Immersive releases resources.** Verify frame/session/listener/timer disposal or suspension according to the adapter contract; repeated opens do not grow iframe, listener or animation-loop counts.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**66. Keyboard and focus behavior is usable around the iframe.** Enter/exit full screen or viewer focus, reach side-panel controls, escape/return, and avoid trapping keyboard users inside an inaccessible overlay.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**67. Treedis failure does not damage project or shot data.** With an active project and design, force viewer failure, return to other modes, reload and confirm local records are unchanged.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part E — Phase 3: Project Workspace

**68. A project can be created with required metadata. [F05]** Name, production type, description, status, `America/Chicago` time zone, stable ID and timestamps save and reopen correctly.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**69. Multiple scene requirements remain independent.** Add, rename, reorder and remove scene requirements; candidates and shots linked to one scene do not move to another silently.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**70. A scene brief preserves explicit requirements and unknowns.** Populate creative, spatial, access and practical criteria. Blank/unknown values do not become passes or zero-cost assumptions.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**71. Locations become project candidates without duplicating catalog facts.** Add the same location from Atlas and Dossier. One candidate relationship exists; catalog source fields remain referenced/read-only.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**72. Candidate statuses cover the approved workflow. [F06]** Apply strong fit, acceptable, concern, fails requirement and unknown to representative criteria. Unknown is visually and computationally distinct from favorable ratings.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**73. Side-by-side comparison shows at least three candidates.** Required criteria, evidence, unknowns and notes align by row without losing location identity or hiding overflow on supported desktop/tablet layouts.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**74. Comparison updates from either surface.** Change a rating/note in candidate detail and comparison, then confirm the same underlying record updates once without feedback loops or stale duplicates.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**75. Preferred and backup choices are independent and explainable.** Select one preferred and at least one backup, record rationale and reopen it. Changing preferred does not delete the previous candidate or evidence.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**76. Decision can be reopened without history loss.** Reopen a previously decided scene, revise one criterion and choose again. Timestamps/revisions make the change understandable.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**77. Candidate-to-Immersive context is exact.** From comparison, open a current candidate in Treedis and return. The same project, scene, candidate and comparison position remain active.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**78. Candidate-to-Shot Designer relationship is exact.** Create a design for one candidate, return and reopen it. Project → Scene → Candidate → Shot Scene references survive reload/export/import.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**79. Bookmarks attach without copying provider data incorrectly.** Link an Immersive bookmark to a candidate/scene. Updating the bookmark label/note does not rewrite capture identity or catalog metadata.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**80. Autosave state is visible and ordered.** Observe Saving, Saved locally and Save failed through edits and rapid changes. An older completion cannot overwrite a newer revision.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**81. Reload restores the exact project workspace.** Browser reload while comparing candidates restores active project/scene/candidate, saved decision and stable relationships without claiming unsaved failed writes succeeded.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**82. Full project JSON preserves the workspace.** Export/import a project with multiple scenes, candidates, decisions, bookmarks and a linked shot scene. Compare normalized records and catalog/capture-version references.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**83. Sensitive operational documents cannot be added accidentally.** Confirm the prototype has no fields/uploads for contracts, insurance, access codes, private contacts or confidential production files and exports contain none.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**84. Deleting a project is explicit and referentially safe.** Cancel leaves everything; confirm removes only that project-owned data, reports linked records and never deletes the master location catalog or unrelated project.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part F — Phase 4: Shot Designer Core

## Scene, objects and editing

**85. A shot scene opens in synchronized 2D and 3D. [F08]** Both views use the same scene model, selection and coordinate frame; edits in one appear once in the other.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**86. All approved background modes work.** Test DOTD aerial, optional Google 3D context, imported floor-plan/reference image and blank grid. Switching background does not delete authored objects.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**87. All approved object types can be created.** Camera, actor/stand-in, vehicle, generic prop, position mark, direction arrow, annotation and simple wall/set boundary appear in scene tree and both applicable views.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**88. Object selection is unambiguous.** Select from canvas and scene tree, cycle overlapping objects, deselect and confirm inspector/visual highlight/object ID agree.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**89. Move and rotate work by drag and numeric fields.** Values, units, zero/negative coordinates and transforms remain consistent in 2D/3D and after save/reload.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**90. Duplicate, group and delete preserve intended identity.** Copies receive new stable IDs, groups transform predictably and deletion removes or warns about linked shots/paths without orphan references.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**91. Grid and snap are optional and deterministic.** Toggle each, change interval where supported and verify numeric values match the displayed snapped position/rotation.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**92. Undo/redo covers meaningful commands.** Create, transform, duplicate, group, path edit and delete; undo to the initial state and redo to the final state without changing unrelated objects.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**93. Undo history and autosave cannot corrupt each other.** Edit rapidly around an autosave boundary, undo/redo, reload and verify the last visibly saved revision—not an intermediate command—is restored.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Camera, lens and framing

**94. Camera properties persist. [F09]** Name/color, position/height, pan/tilt/roll, focal length, sensor/gate and aspect reload and export with explicit units.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**95. Horizontal FOV matches an independent known fixture.** Use `2*atan(sensor width/(2*focal length))` after the effective gate/crop and compare within the documented tolerance.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**96. Vertical FOV and aspect/gate behavior are correct.** Change sensor/gate and aspect; verify expected axes and that invalid zero/negative values are rejected clearly.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**97. Coverage cone and 3D frustum describe the same camera.** Position, orientation and near/far display update together and never imply distortion, depth of field or surveyed occlusion.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**98. Camera zero rotations and full-turn boundaries are stable.** Exercise zero, positive/negative angles and normalized wrap behavior without sudden axis flips or NaN transforms.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**99. Provider failure cannot remove authored camera state. [D008]** Disable Google 3D/DOTD after positioning cameras. Continue editing, save/reload and export the same authored scene against blank/local context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Blocking, paths, shots and variants

**100. Actor and camera start/end marks are independent. [F10]** Create multiple actors and two cameras; editing one path/mark does not move another unless explicitly grouped.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**101. Straight and curved movement paths edit predictably.** Add/move control points, reverse or delete a segment and verify arrows/start/end remain clear in plan view and saved data.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**102. Basic preview is deterministic.** Play, pause, scrub/restart the approved simple movement preview several times. Identical inputs produce the same positions/timing and reduced-motion handling is respected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**103. Marks, arrows and annotations remain legible.** Numbered marks and direction indicators survive zoom, 2D/3D switching, save/reload and diagram export.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**104. Shot list and diagram share one record. [F11]** Editing shot number, camera, shot type, lens/aspect or description through either surface updates once and retains the linked arrangement.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**105. Shot order changes without changing story/scene identity.** Reorder and duplicate shots; stable IDs, camera assignments and arrangement links remain correct.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**106. Named variants do not overwrite one another.** Create A/B variants, change camera/blocking, switch/restore and reload. Each retains its own intended scene revision and identifies the active variant.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Floor plans and accuracy

**107. An owned reference image imports without silent transformation. [F12]** Record source/provenance, original dimensions and initial uncalibrated/schematic status.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**108. Known-distance calibration is mathematically stable.** Set two control points and a known metric/imperial distance; verify scale/unit conversion and independent check distance before and after save/reload.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**109. Background alignment persists.** Rotate, translate and set north/origin; reopen/export/import and confirm transform, frame/version and calibration status remain intact.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**110. Accuracy labels prevent false precision.** Schematic, approximately aligned and measured/calibrated states are visible in workspace and exports, with source/date/error where available.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**111. Recalibration does not silently rewrite approved shots.** Change calibration after saving a variant/reviewed state. Original frame/version stays traceable and migration requires an explicit user action.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**112. The supplied downtown reference scenario can be recreated.** Build at least cameras A/B, actors/marks and paths over appropriate owned/approximate context; save, reload, variant, preview and export without claiming the image is measured/georeferenced.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part G — Phase 5: integrated prototype and release validation

## End-to-end workflow and routing

**113. Complete the primary workflow without data loss.** Discover → dossier → Immersive → project candidate → compare → preferred/backup → Shot Designer → save/reload/variant → exports.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**114. Mode switches preserve the active context.** Exercise all four modes from an active project/scene/candidate/location/shot scene and confirm breadcrumb, selection and return actions remain correct.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**115. Browser Back/Forward follows real history.** Traverse Explore → location → Immersive → project/scene → shot and walk backward/forward. No duplicate loops, stale provider events or lost saved context.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**116. Save-before-transition behaves correctly.** With pending edits, change mode. Successful save transitions; failed save keeps the workspace open and offers retry/emergency JSON.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Approved export set

**117. Full project JSON is complete and portable.** It includes required project/scene/candidate/decision/bookmark/shot/variant/background references and versions but embeds no provider imagery or sensitive reference documents.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**118. PNG shot diagram is readable at target resolution.** Verify intended view, title block, project/scene/location/shot, camera/lens/aspect, date/revision, units/calibration, meaningful north arrow and required attribution.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**119. Shot-list CSV opens cleanly in spreadsheet software.** Headers, encoding, quoting/newlines, units, IDs and required fields are correct; formula-like user text cannot become an unsafe spreadsheet formula without explicit handling.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**120. Print-ready HTML produces a usable PDF.** Use browser print preview/Save as PDF. Selected sections, diagrams, page breaks, evidence/calibration/provider notes, date and revision are legible; interactive-only controls are hidden.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**121. Export filenames are predictable and safe.** Project/scene/shot/date/revision appear where applicable; illegal/reserved characters and excessive length are sanitized without collisions in the tested set.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**122. Emergency JSON works with persistence unavailable.** Force IndexedDB failure after valid in-memory edits and confirm the downloaded file imports successfully into a clean profile.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Accessibility, layout and failure recovery

**123. Desktop layout supports the complete workflow.** At the approved desktop viewport, panels/canvas/timeline do not overlap or hide required controls; resizing does not lose state.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**124. Tablet layout supports browsing and approved editing.** Side panels collapse/reopen, touch targets are usable and no precision phone-editor claim appears. Test the approved representative tablet/browser.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**125. Keyboard-only core tasks are possible.** Navigate modes, search/filter/open dossier, manage candidates, edit camera numerically, save and export with visible focus and logical order.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**126. Labels, contrast and status do not rely only on color.** Check evidence/capture/save/error/selection states, controls, diagrams and focus under normal and high-contrast expectations.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**127. Reduced motion is respected.** Disable or simplify nonessential animation and deterministic path preview according to the design without hiding state changes.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**128. Slow/offline/provider-loss states recover.** Exercise slow network, DOTD loss, Google loss, Treedis loss, WebGL loss and denied geolocation where present. Each has bounded feedback and a usable fallback/return path.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**129. Long/repeated sessions do not leak rendering resources.** Repeatedly open/close/switch map, Immersive and Shot Designer while inspecting iframe/canvas/context/listener/timer counts and memory trend.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**130. Deployment contains only approved files and routes.** Fetch representative public files plus prohibited planning/reference paths. Prohibited files must be absent rather than merely unlinked.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**131. Service worker/cache isolation survives deployment and update.** Install/update/uninstall SLiVR as applicable; LSU3D/neighboring registrations/caches remain untouched and an old SLiVR shell cannot silently serve incompatible data schemas.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**132. Console and network are clean for the complete acceptance path.** No uncaught errors, repeated failed requests, mixed content, leaked credentials, missing assets or unhandled promise rejections; expected provider failures are classified and explained.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part H — Research traceability and evaluation readiness

These checks validate research documentation and evidence handling. They do not establish human-participant findings.

**133. Feature register matches the tested build. [D013]** F01–F21 status, phase, actual interaction, modules, evidence level and known limitations agree with implementation; unimplemented features are not labelled implemented or validated.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**134. Material decisions are append-only and traceable.** New/revised choices include alternatives, rationale, consequences and validation state; superseded decisions link rather than erase history.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**135. Research changelog identifies behavior-affecting changes.** Artifact/build, date, affected feature/decision IDs, evidence, measurement/data impact and limitation are present for each phase release.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**136. Measurement definitions are operational and versioned.** Units, start/stop rules, missing/failure handling, derivations, questionnaire version/timing where applicable and changed definitions are explicit before any observation is analysed.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**137. Design rationale, technical evidence and participant evidence are separated.** Search UI, documentation and research records for expected benefits stated as results. Each claim has the correct evidence level and link.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**138. Negative, failed and null evidence is retained.** Provider failures, rejected hypotheses, failed usability paths and unsupported capabilities appear in changelog/limitations instead of being omitted from the final narrative.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**139. Participant logging is absent/off in Phases 0–5.** Network, storage and code/config inspection show no default background research telemetry, participant/session trajectory capture or undeclared third-party analytics.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**140. Reproducibility context can be reconstructed.** A reviewer can identify exact artifact, catalog/capture/schema/provider, browser/device, fixture, test method and evidence for every phase-exit result.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part I — Phase 6: Treedis Research Mode (post-prototype)

Do not run this part with participants until provider/content-owner authorization and the applicable institutional ethics/security approvals are documented. Begin with synthetic fixtures and researcher-only compatibility sessions. Record-only and manipulation are separate gates.

## Authorization, launch and consent

**141. Authorization evidence is current and scoped. [F21/D014]** Record Treedis/content-owner permission for the exact proxy/injection/capture behavior, approved experiences, study window and whether manipulation is included. Unsupported use is BLOCKED, not silently assumed.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**142. Study/ethics/security approval matches implementation.** Protocol, consent, collected fields, infrastructure, retention, withdrawal/deletion and manipulation disclosure align with the reviewed deployment and versions.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**143. Public/off mode contacts no research service.** With normal configuration and ordinary URLs, iframe origin is the approved direct Treedis URL and network/storage show zero probe, launch, ingest or research-service requests.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**144. A URL flag alone cannot start recording.** Try study/condition query parameters without a valid signed launch and consent. The request fails closed to direct/non-recording behavior without exposing protocol or storage details.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**145. Signed launches are scoped, expiring and replay-controlled.** Valid launch works only for its protocol/build/mode/condition/expiry; altered, expired, wrong-origin and replayed launches do not activate collection.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**146. Consent occurs before proxy/probe collection.** Inspect network and event storage before acceptance. Decline uses the direct tour and creates no research event; accept activates only the disclosed study/mode.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**147. Consent is study/session scoped.** Starting a different protocol, expired session, fresh test profile or withdrawal does not reuse stale consent silently.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**148. Study state and stop/withdraw control are visible and usable.** A participant can identify recording status and invoke the approved stop/withdraw path without navigating undocumented developer controls.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Proxy and passive probe

**149. The proxy is not open.** Only allowlisted Treedis upstream hosts, paths and methods are reachable. Arbitrary external hosts, traversal, unexpected redirects and server-side request targets are rejected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**150. Proxied tour differences are declared and bounded.** Compare direct and authorized proxied responses/behavior. Only approved origin/header/injected-bundle differences occur; navigation, resources, hotspots and ordinary Treedis use remain equivalent.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**151. Exactly one versioned research bundle is injected.** Eligible HTML has one bundle with manifest/hash; non-HTML, errors, redirected/unapproved content and public/direct sessions are not injected.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**152. Original WebXR call contract is preserved.** In a test harness, `requestSession`, frame callbacks, arguments, returned promises/results, exceptions and callback order match the no-probe baseline apart from declared observation overhead.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**153. One frame loop serves capture and approved controller work.** No second animation loop or duplicate wrapper accumulates across XR sessions, tour reloads or mode changes.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**154. Passive schema captures only approved event families.** Verify lifecycle/capabilities, viewer pose, controller grip/target ray, approved input, optional hand joints, safe-listed Treedis context, task markers and quality diagnostics against the protocol manifest.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**155. Head direction is never labelled eye gaze or attention.** Schema, UI, analysis and exports use head/HMD pose or head-direction proxy and preserve reference space/units/sample configuration.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**156. Treedis messages are safe-listed and minimized.** Unrecognized origins/types/payload fields, DOM text and unrestricted message contents are neither trusted nor stored.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**157. Sampling overhead and frame cadence meet the protocol threshold.** Compare baseline and record-only sessions on every approved device/runtime; report distribution, sampling rate, dropped events and uncertainty rather than only one average.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**158. Kill switch is tested.** Artificially exceed the approved sampling-cost rule. High-rate sampling stops, the reason/cost is logged, minimal lifecycle behavior remains as approved and Treedis continues functioning.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**159. Collector loss cannot break the tour.** Block ingest, force 4xx/5xx, timeout and storage failure. Treedis navigation/XR continue; bounded buffers do not grow indefinitely; loss/failure is measurable without leaking data to another endpoint.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Collector, storage and analysis

**160. Ingest enforces authorization and bounds.** Wrong origin/token/protocol, invalid content type/schema/event/numeric range, oversized batch/session and excessive request rate are rejected and auditable without becoming a reflection/open-storage service.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**161. Raw batches are immutable, private and collision-safe.** Concurrent batches cannot overwrite each other; public listing/read is denied; least-privilege roles and infrastructure logs are documented.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**162. Session manifest supports reproducibility.** Protocol/consent, SLiVR/proxy/probe/schema, experience/entry/capture, device/runtime/reference space, condition, sampling and time-anchor versions are present without direct identity.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**163. Batch reconstruction reports gaps and duplicates.** Use synthetic out-of-order, duplicate, missing and malformed batches. Analysis produces deterministic order plus an explicit quality report and never silently discards rows.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**164. Derived measures reproduce from frozen raw input.** Run the declared transformation twice and compare output/checksum, exclusions and version. Coordinate transforms require recorded reference/calibration.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**165. Retention and deletion work end to end.** Test lifecycle expiry and protocol-controlled participant/session deletion lookup across raw, derived, consent/launch and backups/logs according to the approved policy.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

## Optional manipulation gate

**166. Record-only mode installs no manipulation hooks.** With manipulation disabled or no condition, compare DOM/runtime hooks/frame work and visible experience against passive baseline.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**167. Inventory mode changes no stimulus.** Researcher-only authorized inventory records bounded handle/selector/capability metadata without visible changes, unrestricted DOM text or fabricated IDs.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**168. Condition assignment is versioned and counterbalance-ready.** The session records condition/version/assignment source before triggers while keeping recruitment identity separate.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**169. A real condition changes only named stimuli.** Verify ready/time/zone/head-direction/input triggers used by the approved condition; every operation logs target/action/result/failure and unrelated navigation/objects remain unchanged.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**170. Missing target and controller failure are fail-safe.** Use nonexistent and changed handles plus forced controller error. The operation logs failure, stops or rolls back as designed and the tour continues.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**171. Two-level rollback is complete.** Disable manipulation to return to record-only without controller residue; disable the research service to return to direct public behavior with no recording, injection or changed content.

Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

# Part J — Standing regression sweep

Run this after every material change and as the final pass for each phase. Tests may link to detailed evidence above, but record the current build's result here.

**172. Application boots and the four-mode shell is usable.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**173. All 17 locations and six areas reconcile.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**174. Search/filter/select/open dossier works from map and list.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**175. One shared downtown entry and one independent Treedis experience open and switch correctly.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**176. Project scene/candidate comparison, preferred and backup persist.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**177. Shot scene edit, camera FOV, path, variant, undo and reload work.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**178. JSON, PNG, CSV and print/PDF exports are valid and legible.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**179. Browser history and cross-mode context remain correct.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**180. Desktop/tablet, keyboard, focus, contrast and reduced-motion checks pass for affected surfaces.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**181. DOTD/Treedis/Google/WebGL/IndexedDB failure paths recover without data loss.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**182. Public deployment excludes private references/credentials and does not disturb neighboring apps.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

**183. Console/network are clean and research telemetry is off during ordinary prototype use.**  
Result: - [ ] PASS - [ ] FAIL - [ ] BLOCKED - [ ] NOT TESTED  
Evidence: ____________________________________  
Comments: ____________________________________

---

## When you are done

Report:

1. Build, environment, catalog/schema/provider versions and sections executed.
2. Passed, failed, blocked and not-tested counts.
3. Every failure by test number with actual versus expected behavior and evidence.
4. Every blocked test with owner/dependency and a specific retest condition.
5. Automated evidence separately from live browser/device evidence.
6. Data-loss, privacy, security, incorrect-evidence or research-integrity failures first.
7. Tests added/changed during the phase and why.
8. Required regression set after fixes.

Do not mark the phase complete while a required exit-gate test is failed, silently untested or blocked without an approved exception. Do not repair unobserved behavior speculatively and then mark the original test passed; run it and record fresh evidence.

---

## Execution log

One entry per recorded execution, newest first. The "Before you start" target table always describes the most recent entry.

### 2026-09-20 — Critical reference repair, automated verification

Build `e13c6854ccc9`, full digest and environment in the target table above.
Catalog/record/transfer schemas remain 1.0.0; IndexedDB schema remains 1.
Adapter capability version changes to `treedis-recon-2` (D053–D055).

Baseline: `node --test` passed all 305 tests before changes. Added tests 185–194,
then ran `node --test tests/reference-regressions.test.mjs` before editing production
code: **0 pass, 10 fail, exit 1**. Exact representative assertion output:

```text
185: actual undefined; expected { type: 'Navigate', sweepId: 'sebf1e31m9u7dk7twchgfz1mc', transitionTime: 1500, rotation: { x: 0, y: 0 } }
186: actual 'unresponsive'; expected 'ready'
187: actual 'ready'; expected 'loading'
188: actual 'loading'; expected 'timedOut'
189: actual true; expected 'unknown'
190: actual URL for CAP-005; expected unchanged loaded URL for CAP-001
191: actual 2 remaining frame listeners; expected 0
192: actual 2025; expected 2024
193: actual 'pending'; expected 'active'
194: actual 'ready'; expected 'idle'
```

After those corrections, the same 10 tests passed. Three further regression tests
(195–197) were then run before their corrections: **0 pass, 3 fail, exit 1**.
Actual results: malformed messages marked messaging true; the independent model
kept the previous frame identity; a cancelled verification increased posted-message
count from 3 to 4. Those tests now pass. Test 198 adds shell switching/retry
coverage and passed on its first execution; it is not claimed as a reproduced
baseline failure. Test 199 separately failed before correction with mode
`immersive` instead of `explore` after Stop waiting, then passed after the cancel
action was changed to return to the selected location.

Final required commands, all executed in full:

| Command | Result |
|---|---|
| `node --test` | 320 pass, 0 fail, 0 skipped; exit 0 |
| `node tools/validate-catalog.mjs` | 0 errors, 1 existing CAP-003 display-name warning; exit 0 |
| `node tools/check-deploy-scope.mjs` | 117 publishable files, 0 errors; exit 0 |

New numbered checks: **15 PASS (185–199), automated only**. No live test is promoted
to PASS. Standing regression evidence: automated boot/routing, 17-record catalog,
transfer/persistence doubles, spatial math, provider failure doubles and deployment
scope all ran; the rendered/device/export and later-phase portions of Part J remain
unexecuted. Phase 0 and the full prototype are not declared complete.

Source comparison for this work (test 184 follow-up):

| SLiVR surface | Read-only source | Adaptation / required difference |
|---|---|---|
| Entry navigation and shared session | `Experimental/js/03-tour-bridge.js`, `js/04-street-view.js` | Queued sweep and orientation, 600 ms delay after ready, up to four navigation attempts 1500 ms apart, verify arrival from pose, reuse shared model |
| Viewer frame and loading recovery | `Experimental/map.html:299-306`, `js/04-street-view.js` | Keep persistent frame within an experience; replace it for independent models/retry to reject obsolete source windows; dispose on exit per architecture 6.4; Stop waiting returns to the location |
| Trusted bridge | Same SCSU bridge | Exact target origin, source-window/payload validation and generation cancellation are required SLiVR additions; reference wildcard posting and missing disposal are not copied |
| Imagery plumbing | `LSU3D/js/11-boot.js:234-257` | Same source constant for construction and event routing; keep primary/fallback/neutral recovery from D030; remember applied source to prevent needless tile restarts |
| Asynchronous activation | `LSU3D/js/16-google-tiles.js:46-47` | Adopt generation guard for the map library await and invalidate it on exit |
| Existing library/layout/markers | LSU3D source matrix; D040, D045–D049 | Vendored MapLibre 4.7.1/classic loading, source/layer separation and module boundaries retained; no campus content imported |

The earlier test 184 PASS is retained as historical evidence, but is not proof
that the repaired paths worked: tests 185–194 demonstrate omissions in that audit.
This is a targeted correction of existing Phase 0 code, not completion of the
unbuilt project comparison, bookmarks or Shot Designer features. Neither reference
was edited; existing unrelated working-tree changes were preserved. No commit made.

Live reproduction: browser discovery returned no browsers; opening Chrome returned
`Browser is not available: chrome`, and opening the in-app browser returned
`Browser is not available: iab`. Thus the provider API 403 described by L033 was
**not reproduced and is not claimed fixed**. On completion, the owner elected to
perform manual testing. Retest the same entry top-level and embedded, all six
downtown entries, Magnolia, at least one non-downtown capture, Stop waiting, retry,
and returning to Explore. Record actual console/network output if any capture fails.

### 2026-09-20 — Immersive host moved to the reference host, automated and live provider

| Field | Value |
|---|---|
| Build | Uncommitted working tree; code-and-data sha256 digest `f55f74da3dbc` over 106 publishable files outside `docs/` and `research/` (116 publishable in total) |
| Environment | Windows 11, Node.js v24.18.0, no browser, online for provider requests |
| Provider | Treedis, `https://spaces.dtsxr.com`, all 11 supplied entries |
| Command | `node tools/rehost-captures.mjs --to https://spaces.dtsxr.com --apply`; `node tools/build-catalog.mjs`; `node --test`; `node tools/probe-treedis.mjs`; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | None. No test changed status |

Results: 0 PASS, 0 FAIL, 0 BLOCKED.

Changed: the 11 immersive capture URLs now name `spaces.dtsxr.com` instead of `my.treedis.com`, following D052. The change was made in the reviewed workbook, which is what the catalog is generated from, so the record and the data do not disagree. Only the host moved; experience, sweep and entry orientation are untouched, and the tool compared every cell in every sheet before and after, restoring from its backup on any unexpected difference. The catalog was then regenerated. The region's configured origin is the new host with the former one kept as an alias, so the frame, the postMessage target and the accepted sender move together. Every other reference in the project was updated except two: the supplied entry list in `docs/`, which is the provenance record of what was given and is left verbatim, and the 2026-09-20 browser observation in this log, which records what actually happened on the primary host.

Live provider evidence: `tools/probe-treedis.mjs` re-run against the new host reached 11 of 11 entries, 6 distinct experiences, all inside the region allowlist, none declaring a header that refuses embedding. Automated: 305 assertions passing; catalog validation 0 errors and 1 expected warning; deployment scope 0 errors.

This is not evidence that the viewer works. No capture has been seen to render on either host, and the mechanism behind the API refusal is not established. L033 stays open, and tests 28 and 29 remain NOT TESTED.

### 2026-09-20 — First browser attempt at the immersive viewer, provider failure

| Field | Value |
|---|---|
| Build | Uncommitted working tree, immersive viewer surface plus origin diagnostic |
| Environment | Chrome on Windows 11, served from `http://127.0.0.1:8787/SLiVR/`. Operated by the project owner; no automation extension was connected |
| Provider | Treedis, `https://my.treedis.com`, experience `5eb11a1b`, sweep `kmwh5gsznuu4t01eyp7urs0ha` (CAP-003, Lafayette Old City Hall) |
| Sections executed | Part B, test 28, one entry |

Results: 0 PASS, 0 FAIL, 0 BLOCKED. Test 28 stays NOT TESTED; this is one entry and the observation is about the provider, not about the requirement.

Observed: the frame loaded and the provider's application started. It reached `showcaseLoad`, loaded the Google Maps script it uses, and then failed every request to its own API. `POST v1/public/getSweepGroups`, `POST v1/public/getSweeps`, `GET v1/public/tours/114717/boq`, `GET v1/admin/navigation/teleportGroups` and `GET v1/admin/navigation/sweeps` were all refused, reported as 403 with no `Access-Control-Allow-Origin` header on the response. No sweeps loaded, so the viewer had nothing to render.

What this does and does not show: every refused request has origin `https://my.treedis.com` and target `https://api.treedis.com`. They are made by the provider's own document, not by SLiVR, and no iframe attribute affects cross-origin request policy. Embedding itself is therefore evidenced positively for the first time — the document loaded and ran in the frame — while the tour data path failed. Requesting the same public endpoints from Node with `Origin: https://my.treedis.com` also returned 403 with no CORS header, which is consistent with an endpoint that requires a session the request did not carry, and does not distinguish a frame problem from an account or provider problem.

Recorded as L033. The discriminating observation, not yet made, is the same entry URL opened in a top-level tab.

Changed in response, neither being a claimed fix: the frame's permissions now match the reconnaissance harness, which is the only configuration in this project the viewer has ever been seen running in; and the region records a second provider host that serves byte-identical tour documents and is the host the working reference project embeds, selectable through the `viewerOrigin` diagnostic so the two can be compared without editing the catalog.

### 2026-09-20 — Immersive viewer surface, automated only

| Field | Value |
|---|---|
| Build | Uncommitted working tree; code-and-data sha256 digest `65ccbfbf7da7` over 104 publishable files outside `docs/` and `research/` (114 publishable in total). The digest is taken over each path followed by its bytes, in sorted path order |
| Environment | Windows 11, Node.js v24.18.0, no browser. The automation extension reported not connected, so nothing was opened on screen |
| Provider | No provider was contacted. The viewer frame was never pointed at a live origin; the DOM stand-in has no iframe |
| Command | `node --test`; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | None. Evidence added to tests 28 and 29; both remain NOT TESTED |

Results: 0 PASS, 0 FAIL, 0 BLOCKED. No test changed status. Tests 28 and 29 gained automated evidence for the half that can be shown without a browser.

Automated evidence: 304 assertions passing, up from 293. New suite `tests/viewer-host.test.mjs` (7) covering the frame attributes, the veil and its escalation. `tests/shell-smoke.test.mjs` grew by 4, opening all six downtown routes through the real entry point. `tools/validate-catalog.mjs` reported 0 errors and 1 expected warning; `tools/check-deploy-scope.mjs` reported 0 errors.

What was built: Immersive had no viewer surface at all. The mode rendered a panel naming Phase 2 where the captured experience belongs, which is why the running application showed nothing. The adapter written in Phase 0.4 was complete and tested but referenced by no part of the application. It is now wired to the route, with a persistent frame, the provider attributes the reference uses, allowlist enforcement before anything is requested, an escalating loading veil with a way out, and release of the provider session on leaving. Recorded as D051: only the surface moved forward from Phase 2, not the feature.

Defect found and fixed: the adapter added `load` and `error` listeners to the frame and had no way to remove them. The frame outlives the adapter, so every capture visited would have left a disposed adapter still reacting to the live frame. This had no symptom in the single-entry harness, which is the only place the adapter had ever run.

Evidence still needed: everything this test set is actually about. No browser has opened the Immersive surface, so whether the viewer renders, whether the bridge answers from inside this application, whether sweeps are listed, whether a sweep change happens without a reload and whether any pose is reported are all still `unknown`, and tests 28 and 29 need all 11 entries and two downtown navigations respectively. One entry has been observed, from the standalone harness, not from the product.

### 2026-09-20 — Phase 0.4, automated and live provider

| Field | Value |
|---|---|
| Build | Uncommitted working tree; code-and-data sha256 digest `6e0130e240ad` over 91 publishable files outside `docs/` and `research/` (101 publishable in total) |
| Environment | Windows 11, Node.js v24.18.0, no browser, online for provider requests |
| Provider | Treedis tour URLs requested directly. Three.js 0.183.0 and 3d-tiles-renderer 0.5.1 pinned but not loaded. No Google Maps 3D Tiles credential supplied |
| Command | `node --test`; `node tools/probe-treedis.mjs`; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | Part B, tests 26 to 29 |

Results: 0 PASS, 0 FAIL, 0 BLOCKED, 4 NOT TESTED with evidence recorded (26, 27, 28, 29). Tests 13 to 25 were not re-run for this build.

Automated evidence: 271 assertions passing, up from 227. New suites `tests/immersive.test.mjs` (21) and `tests/workspace-3d.test.mjs` (23). `tools/validate-catalog.mjs` reported 0 errors and 1 expected warning; `tools/check-deploy-scope.mjs` reported 0 errors across 101 publishable files.

Live provider evidence: `tools/probe-treedis.mjs` requested all 11 supplied entry URLs. 11 of 11 answered 200; 6 distinct experiences, all inside the region allowlist; the shared downtown experience `5eb11a1b` carries 6 of the 11 entries; every document echoed both its experience and its own sweep identifier. No entry declares a header refusing embedding.

Findings recorded during this work package:

- No supplied entry sends `X-Frame-Options` or a `frame-ancestors` directive. This is the first evidence bearing on the one uncertainty the architecture says can block a gate. It is a necessary condition only: a page can still refuse in script, and the viewer can still fail inside a cross-origin frame. Embedding therefore remains `unknown`, not `true`.
- The reference bridge posts commands to `"*"`, which hands every command to whatever document occupies the frame. The adapter here posts to the configured origin and refuses inbound messages from anything else, and both rules are asserted.
- The reference bridge was never run against a live model, which its own data confirms: every entry in its inventory carries `sweepId: null` and an empty tour URL. Nothing in the documented protocol can be treated as verified.
- The implementation plan quotes a Super-35 horizontal field of view of 39.152° in prose. The geometry gives 39.1479°, and the Phase 0.1 fixture already asserts 39.15 within tolerance. The derivation is the authority; the prose figure is rounded and slightly off. No code changed.
- `enuToThree` produced `-0` for a zero north component, which compares unequal to `0` under deep equality. Corrected so the axis mapping never emits a negated zero.

Instruments added for the live pass, neither of which is part of the application: `tools/treedis-recon.html` loads each supplied entry through the shipping adapter and records observed capabilities and message shapes, and `tools/three-spike.html` renders the camera, actor and frustum from the computed corners while repeating the fixtures on screen. Message contents are recorded as shapes rather than values, because a payload could carry identifiers from a private experience.

Evidence still needed for the Phase 0.4 exit: the optional-3D panel reading `absent` beside a rendered scene, and the same page with a credential for the available, denied and slow cases (26); the spike page drawing the scene with every assertion reading PASS (27); per-entry embedding, bridge response, sweep list and pose from the harness (28); and navigation between at least two downtown targets inside the shared experience (29). Tests 26 and 28 additionally need the Google Maps 3D Tiles key and Treedis administrative access, neither of which has been supplied.

### 2026-09-20 — Boot defect found and fixed, automated only

| Field | Value |
|---|---|
| Build | Uncommitted working tree; code-and-data sha256 digest `04b19216f222` over 78 publishable files outside `docs/` and `research/` (88 publishable in total) |
| Environment | Windows 11, Node.js v24.18.0, no browser |
| Command | `node --test`; `node tools/check-deploy-scope.mjs` |
| Sections executed | None. This run records a defect and its fix, and adds partial automated evidence to test 15. |

Prompted by a report that opening `index.html` showed only a dark screen. Two separate causes were found.

The first is not a defect. A page opened from the file system has the opaque origin `null`, which blocks ES module loading and every `fetch`, so the entry point never runs and the stylesheet background is all that appears. The application has to be served over HTTP. The procedure is now written down under "Running the application" above, which the record previously did not state anywhere.

The second is a real defect, introduced in Phase 0.3 and present in the build recorded as `50dcb29e0e57`. `renderMain` in `src/app/shell.js` called the map mount or unmount action on every render, and each call wrote a freshly built `map` object into the store. A new object is a new identity, so the subscription on `map` fired, which re-rendered, which called the action again. The result was an unbounded notification loop that would freeze the tab and present exactly the same blank page. It would have affected any browser session reaching Explore, so the manual pass would have been blocked at its first step.

Three changes were made:

- `src/app/actions.js` now tracks its own mount state (`idle`, `mounting`, `mounted`, `failed`). Mounting is not re-entered while in progress, unmounting does nothing when already idle, and a failed mount is not retried on its own; leaving and re-entering the mode tries again.
- `src/app/store.js` caps notification passes for one `setState` and throws a message naming the likely cause. A cycle now fails loudly instead of hanging, because a frozen tab is indistinguishable from a page that never loaded.
- `tests/shell-smoke.test.mjs` and `tests/fixtures/dom.mjs` boot the real entry point against a DOM stand-in, so this class of failure is detectable from the command line.

Automated evidence: 227 assertions passing, up from 217. The ten new checks cover a page being built at all, the four mode controls and their active state, catalog loading and reporting, a deep route opening directly, an unknown identifier reaching the recoverable not-found panel, mode switching by activation, a map library that will not load leaving the mode usable, absent local storage warning instead of failing, a project surviving a reboot against one shared database, and a broken catalog listing no locations. `tools/check-deploy-scope.mjs` reported 0 errors across 88 publishable files.

No test moved to PASS. Test 15 gained partial automated evidence and stays unmarked. The stand-in has no layout, styling or real event dispatch, and is declared as a stand-in in its own header.

### 2026-09-20 — Phase 0.3, automated and live provider

| Field | Value |
|---|---|
| Build | Uncommitted working tree; code-and-data sha256 digest `50dcb29e0e57` over 76 publishable files outside `docs/` and `research/` (86 publishable in total) |
| Environment | Windows 11, Node.js v24.18.0, no browser, online for imagery requests |
| Provider | Louisiana DOTD image services, requested directly. MapLibre GL JS 6.10.0 pinned but not loaded |
| Command | `node --test`; `node tools/probe-imagery.mjs --keep-images`; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | Part B, tests 22 to 25 |

Results: 0 PASS, 0 FAIL, 0 BLOCKED, 4 NOT TESTED with substantial evidence recorded (22, 23, 24, 25). Tests 13 to 21 were not re-run for this build.

Automated evidence: 217 assertions passing, up from 190, including the new `tests/imagery.test.mjs` (27). `tools/validate-catalog.mjs` reported 0 errors and 1 expected warning. `tools/check-deploy-scope.mjs` reported 0 errors across 86 publishable files, and the probe output under `outputs/` is excluded from version control.

Live provider evidence: `tools/probe-imagery.mjs` requested one representative catalog location per operational area from both configured services, at each service's own ground sample distance, through the same request template the map uses. Twelve of twelve point and source combinations returned photographic content. Two no-coverage controls inside the published extent returned 100% no-data, and the excluded 2026 layer returned a uniform fill for all six areas. Full endpoints, bounding boxes, byte counts, timings and pixel statistics are in `outputs/imagery-probe/imagery-probe.json`, with decoded BMP and production JPEG images kept per point.

Findings recorded during this work package:

- The image service publishes an extent covering much of the state while holding imagery only for selected areas, and its metadata records the no-data value as 0. A request outside coverage returns a valid, entirely black image with HTTP 200. Status-code checking alone would report coverage that does not exist.
- The excluded 2026 layer does not return black. It returns HTTP 200 with a single flat non-black colour, so a check looking only for an all-black image would have accepted it. The content classifier rejects any single-colour image whatever its colour.
- The configured `maxZoom: 20` at 512 pixels requests about 0.064 m per pixel, while both services hold about 0.150 m. The top zoom level upsamples. The value is unchanged because it is the shape proven to render, and lowering it is a visual judgement that needs a browser. `validateRegionImagery` now reports this as a warning on both sources, and it is recorded as L026.
- An earlier probe run reported HTTP 400 for the excluded service. That was a defect in the probe calling the image-service operation on a map-service layer, not a finding about the service. It was corrected before the recorded result. The classifier was also corrected during this package: an image split between two flat regions passed the variation threshold, so a minimum distinct-colour fraction is now required as well.

Why no test moved to PASS: all four are written to include what a person sees in a browser, and no browser executed this build. Test 22 additionally requires a screenshot. Every remaining step is named in the test entry above.

Evidence still needed for the Phase 0.3 exit: tiles rendering through MapLibre at `#/explore` with a screenshot (22); a blocked primary redrawing from the 2024 fallback on screen (23); attribution, year and the accuracy statement legible at desktop and tablet widths (24); and the browser network panel showing no request to the excluded service (25).

### 2026-09-20 — Phase 0.2, automated only

| Field | Value |
|---|---|
| Build | Uncommitted working tree; code-and-data sha256 digest `a8f4b4e4bd59` over the 68 publishable files outside `docs/` and `research/` (78 publishable in total) |
| Environment | Windows 11, Node.js v24.18.0, no browser, offline |
| Catalog/schema | Catalog 1.0.0, record schema 1.0.0, transfer envelope 1.0.0, workspace schema 1, research snapshot 2026-09-19 |
| Command | `node --test` from the project root; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | Part B, tests 13 to 21. Tests 11, 12 and 27 were not re-run for this build. |

Results: 0 PASS, 0 FAIL, 0 BLOCKED, 9 NOT TESTED with partial automated evidence recorded (13, 14, 15, 16, 17, 18, 19, 20, 21).

Automated evidence: 190 assertions passing, up from 82. New suites `tests/router.test.mjs` (17), `tests/store.test.mjs` (17), `tests/workspace-repo.test.mjs` (21), `tests/transfer.test.mjs` (28) and `tests/catalog-repo.test.mjs` (22), alongside the Phase 0.1 suites. `tools/validate-catalog.mjs` reported 0 errors and 1 expected warning, with 235 field values carrying a preserved unknown marker. `tools/check-deploy-scope.mjs` reported 0 errors across 78 publishable files. All 16 application entry modules import cleanly under Node, and the `index.html` import map and stylesheet references resolve to files that exist.

Live browser, device and provider evidence: none. A static server was started on `http://127.0.0.1:8787/SLiVR/` and answered 200 for `index.html` and the catalog manifest, but the browser automation extension was not connected, so no page was loaded. No rendering, interaction, real IndexedDB, download, file-picker or reload behaviour was observed, and none is claimed.

Why no test moved to PASS, and what each one still needs:

- **13** — the catalog loader now exists and every rejection path is exercised, returning a classified code, the failing path, and no catalog at all. The rendered error state was not observed.
- **14** — the full route grammar, direct opening, Back and Forward, and the recoverable not-found state are exercised against a window stand-in. A fresh tab in a real browser was not opened.
- **15** — nothing about the rendered shell was observed. This test has no automated component and stays entirely unexecuted.
- **16, 17** — the schema declaration, upgrade path, namespace guard, round trip and revision ordering are exercised against `tests/fixtures/indexeddb.mjs`, which is a test double. What a browser actually creates, and whether a project survives a page reload, were not observed.
- **18, 19, 20** — the envelope, its rejections and all three conflict outcomes are exercised at the data layer. No file was downloaded or chosen through a file picker, and the conflict dialog was not operated.
- **21** — write failure, the save-status states, retry and emergency export are exercised, but not a real quota or transaction failure in a browser.

Tests added or changed during this work package: none. Tests 13 to 21 were annotated with evidence; no test was renumbered or reworded.

Notes carried forward:

- The in-memory IndexedDB double in `tests/fixtures/indexeddb.mjs` is deliberately declared as a double in its own header, and a test asserts that declaration is present, so this distinction cannot be quietly lost. Evidence produced through it is recorded as automated, never as browser evidence.
- `src/app/capabilities.js` reports `canvasReadback` and every Treedis capability as `unknown` rather than `false`. Those findings belong to Phases 0.3 and 0.4 and have not been made.
- The storage-failure diagnostics flag is read from the `slivr:diagnostics` local-storage key, defaults to off, and is never written by the application. It exists so test 21 can be executed on demand.
- The build digest recorded for this entry covers publishable files outside `docs/` and `research/`. The Phase 0.1 entry used a digest over every publishable file, which includes this document, so that figure cannot be recomputed now that the Phase 0.1 result was written into it. The earlier entry is left exactly as recorded; from this entry onward the narrower scope is used and is stated wherever the digest appears (D027).

### 2026-09-19 — Phase 0.1, automated only

| Field | Value |
|---|---|
| Build | Uncommitted working tree; publishable-tree sha256 digest `89aae7a86236` over 40 files |
| Environment | Windows 11, Node.js v24.18.0, no browser, offline |
| Catalog/schema | Catalog 1.0.0, record schema 1.0.0, research snapshot 2026-09-19 |
| Command | `node --test` from the project root; `node tools/validate-catalog.mjs`; `node tools/check-deploy-scope.mjs` |
| Sections executed | Part B, tests 11, 12, 13 and 27 only |

Results: 2 PASS (11, 12), 0 FAIL, 0 BLOCKED, 2 NOT TESTED with partial evidence recorded (13, 27). Every other test remains unexecuted.

Automated evidence: 82 assertions passing across `tests/units.test.mjs`, `tests/optics.test.mjs`, `tests/frames.test.mjs`, `tests/schema.test.mjs`, `tests/catalog.test.mjs` and `tests/deploy-scope.test.mjs`. `tools/validate-catalog.mjs` reported 0 errors and 1 warning. `tools/check-deploy-scope.mjs` reported 0 errors across 39 publishable files.

Live browser, device and provider evidence: none. No DOTD, Treedis, Google or WebGL request was made in this run, so tests 22 to 26 and 28 to 29 remain entirely unexecuted and no provider capability is claimed.

Tests not yet marked, and why:

- **13** — the validator half is implemented and exercised against 13 rejection cases. The application-load half needs the catalog repository and shell from Phase 0.2.
- **27** — optics and transform fixtures pass in isolation. The rendered Three.js camera, actor and frustum scene is not built.

Notes carried forward:

- The one warning from catalog validation is expected and benign: CAP-003 names the location "Lafayette Old City Hall" while LOC-003 is "Lafayette Old City Hall / Bank of Lafayette".
- `docs/` is excluded from version control so private reference material cannot be published from this repository. This document is the single deliberate exception, so its execution history is preserved in source history (decision D020). `tools/check-deploy-scope.mjs` names that exception, still rejects everything else under `docs/`, and fails if the exception ever stops being published. Test 5 is therefore read as: the deployed artifact excludes `docs/` apart from this verification record.

## Appended regression checks — reference repair, 2026-09-20

These are automated behavior checks, not browser/provider acceptance. All were
executed on build `e13c6854ccc9` using Node v24.18.0. IDs are appended without
renumbering any previous test. Initial failures and final command results are
preserved in the execution entry above.

| ID | Requirement and related checks | Executable evidence | Result |
|---|---|---|---|
| **185** | SCSU-style initial navigation waits 600 ms after trusted readiness and carries the exact sweep and zero-valued orientation; arrival clears verification timers (F03, 50, 56) | `tests/reference-regressions.test.mjs`, test beginning `185:` | PASS; previously FAIL |
| **186** | Late iframe load cannot restart a ready handshake or turn it unresponsive (F03, 54) | Same suite, `186:` | PASS; previously FAIL |
| **187** | Another same-origin frame cannot report readiness (F03, 55) | Same suite, `187:` | PASS; previously FAIL |
| **188** | A frame with neither load nor error reaches a bounded timeout, clears timers and keeps embedding unknown (F03, 58) | Same suite, `188:` | PASS; previously FAIL |
| **189** | Document load alone leaves embedding unknown (F19, 28) | Same suite, `189:` | PASS; previously FAIL |
| **190** | Responsive shared downtown model reuses its frame, forwards the new entry orientation and preserves physical/capture identity (F03, 29, 51) | Same suite, `190:` | PASS; previously FAIL |
| **191** | Reattach/dispose leaves no orphan frame listeners or callbacks (F20, 65, 129) | Same suite, `191:` | PASS; previously FAIL |
| **192** | Errors for the actual imagery source activate 2024 fallback, then neutral, then permit primary retry (F01, 23, 47) | Same suite, `192:` | PASS; previously FAIL |
| **193** | Successful tiles activate imagery and reset failure counting; isolated failures do not rebuild the working source (F01, 23) | Same suite, `193:` | PASS; previously FAIL |
| **194** | Leaving Explore before its library resolves prevents a stale mount (F20, 114, 129) | Same suite, `194:` | PASS; previously FAIL |
| **195** | Non-finite pose values and malformed sweep lists cannot establish capabilities (F03, 55) | Same suite, `195:` | PASS; previously FAIL |
| **196** | Independent experiences receive distinct frame identities and reject late ready messages from the abandoned frame (F03, 52, 57) | Same suite, `196:` | PASS; previously FAIL |
| **197** | A cancelled verification callback cannot post after a newer request even for the same sweep (F03, 57) | Same suite, `197:` | PASS; previously FAIL |
| **198** | Shell switching, timeout, retry, fresh-frame creation and capture reporting stay coherent (F03, 58) | `tests/shell-smoke.test.mjs`, `198:` | PASS; additional integration coverage |
| **199** | Stop waiting returns to the selected location and releases the viewer instead of remounting it (F03, 58, 64) | `tests/shell-smoke.test.mjs`, `199:` | PASS; previously FAIL |

**200. Base-tour startup and viewer visibility after manual failure report. [F03/F20, D056]**
Hard-refresh the application. Open Carpe Diem, confirm the base tour launches and
the queued requested sweep/orientation is applied after readiness. Confirm the
loading veil disappears on ready or unresponsive state, the model accepts drag
input, recovery buttons remain clickable, and switching captures retains correct
location identity. If provider calls fail again, record their status and origin
separately from the wrapper's visibility state.

Result: NOT TESTED — owner requested manual testing. No automated tests, browser
tests or validation commands were run after that instruction. The earlier
320-test result does not cover this change. Existing tests asserting deep-link
iframe startup describe the superseded startup contract and need alignment before
the next authorized automated run; initial queued-navigation coverage remains
applicable. The screenshot demonstrates provider API failures and a visible loading
veil despite the unresponsive state. Inspection identified the flex/hidden cascade
and transparent-overlay pointer interception; neither CSS correction establishes
that the API failure is resolved. Both base links opening directly is owner-reported
evidence. L033 remains open pending the embedded manual check.


## 2026-09-20 ? Explore 3D deployment correction, D057

Owner screenshot: tilted DOTD raster and runtime.js 404, with no Google renderer
connected to Explore. Added the reference-derived custom layer, vendored loaders,
explicit fallback/loading, per-view attribution and lifecycle cleanup. The owner
requested the existing reference browser key and stopped further testing before
the deployment-configuration edits. The final build is NOT TESTED; manual review
is assigned to the owner after push. Tests 26 and 128 remain open for live evidence.

Before that instruction, `node --test tests/google-tiles.test.mjs
 tests/imagery.test.mjs` passed 37 checks. Rendering/provider lifecycle checks used
doubles; imports and coordinate calculations used pinned library code. Browser
verification was unavailable. These results do not validate the final build or
provider access. No subsequent tests or live credential requests were executed.

Manual retest: at downtown street scale, select 3D, verify real building geometry,
rotate through four bearings, check Google Maps/data attribution, return to 2D,
repeat toggles, leave/re-enter Explore, and exercise absent/denied/slow-provider
and graphics-context failure. Confirm a labelled aerial fallback, intact catalog
selection, and no deletion of saved project data. No phase completion is claimed.
