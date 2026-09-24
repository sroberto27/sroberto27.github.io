# Research and design decision record

| ID | Date | Decision | Alternatives considered | Rationale | Consequence and validation |
|---|---|---|---|---|---|
| D001 | 2026-09-19 | Treat LSU3D as read-only and build SLiVR separately | Modify LSU3D in place; full rewrite without inspection | Preserve the working reference and allow selective evidence-based reuse | Reuse matrix required; verify no LSU3D file changes |
| D002 | 2026-09-19 | Use 17 records across six Lafayette operational areas | Baton Rouge/LSU geography; unbounded Acadiana catalog | Matches supplied captures and planned scan inventory | Solar-energy and wider regional sites remain later until validated |
| D003 | 2026-09-19 | First prototype contains Atlas, Dossiers, Immersive Scout, Project Workspace and Shot Designer Core | Full production-management suite | Tests the distinctive end-to-end research concept with bounded scope | All post-prototype Phases 6–9 remain outside prototype acceptance |
| D004 | 2026-09-19 | Use static HTML, CSS and JavaScript ES modules | Vite/TypeScript/React application | Aligns with the useful no-build source foundation and user preference | Runtime schema validation and module tests must carry contract assurance |
| D005 | 2026-09-19 | Use IndexedDB plus versioned JSON transfer | Backend database; localStorage only | Supports local prototypes without backend while retaining explicit portability | Data is device/browser-local and needs visible backup/recovery messaging |
| D006 | 2026-09-19 | Use DOTD 2025 imagery with 2024 Lafayette fallback | MapServer layer 187; commercial aerial as primary | Direct testing found relevant Lafayette coverage in selected services | Phase 0 must verify actual image content, attribution and continuing access |
| D007 | 2026-09-19 | Isolate Treedis behind a lifecycle/message adapter | Direct feature code around iframe globals | Shared/separate experiences and stale events require controlled state | Phase 0 validates available provider capabilities and access rights |
| D008 | 2026-09-19 | Keep authored shot objects provider-independent in Three.js | Place/edit objects inside Treedis or Google renderer internals | Enables saving and editing when providers fail and avoids unsupported APIs | Occlusion/measurement against streamed geometry remains approximate or deferred |
| D009 | 2026-09-19 | Use desktop-first authoring with tablet support | Precision phone editor; headset-required workflow | Matches complexity of shot editing and approved prototype boundary | Dedicated phone field and headset interaction move to later phases |
| D010 | 2026-09-19 | Use persistent Explore, Projects, Immersive and Shot Designer modes | Separate disconnected pages/tools | Preserves project/location/scene context across the workflow | Routing and save-before-transition acceptance tests required |
| D011 | 2026-09-19 | Export project JSON, diagram PNG, shot-list CSV and printable HTML packet | Proprietary production formats and cloud sharing | Covers recovery, analysis and communication without backend dependencies | Imports validate before mutation; exports identify version and provenance |
| D012 | 2026-09-19 | Use concise professional comments and repository-scoped commits | Generated narration; repository-wide commits | Supports maintainability and protects unrelated work | Project rules verify comment quality and Git path boundaries |
| D013 | 2026-09-19 | Maintain a versioned HCI/VR research record and keep participant logging off by default | Reconstruct evidence after development; default analytics | Supports reproducibility and prevents unconsented or ambiguous evidence | Each phase updates research records; studies require separate protocol and consent |
| D014 | 2026-09-19 | Add post-prototype Phase 6 Treedis Research Mode with passive capture before separately gated manipulation | Put telemetry in the essential prototype; rely only on parent messages; deploy the supplied proxy code unchanged | Preserves prototype scope while creating a path to richer WebXR evidence after authorization and security/compatibility validation | Normal users never contact the service; provider/owner and study approvals are prerequisites; Phase 6 uses the dedicated plan and acceptance gate |
| D015 | 2026-09-19 | Maintain one living numbered full-system test document across all phases | Separate temporary phase checklists; reconstruct tests after implementation | Preserves acceptance intent, real execution evidence and regression history for product and research reproducibility | Each phase updates applicable tests and runs its section plus standing regression; no result is pre-marked |
| D016 | 2026-09-19 | Use hash routes such as `#/location/LOC-001` | History API with a 404.html fallback; query parameters as in the reference project | The repository is served as static files with no rewrite support, so a path route cannot be opened directly. A hash preserves the approved route grammar on any static host and at any sub-path | Direct opening, sharing and Back/Forward must be verified against tests 14, 49 and 115 |
| D017 | 2026-09-19 | Keep `docs/` and `outputs/` out of version control | Commit them and accept publication; deploy the application to a separate origin with an explicit allowlist | The repository root is published, and there is no build step to filter it, so not committing a file is the only reliable allowlist. The scanned book, the unpublished paper, the research-mode text and the contact workbook must not be republished | Private material cannot be published from this repository, verified by `tools/check-deploy-scope.mjs`. The consequence for the living verification record is resolved by D020 |
| D018 | 2026-09-19 | Render the Shot Designer plan view on a dedicated 2D canvas rather than through MapLibre | Use MapLibre with a custom overlay layer, as the reference project does for its 3D tiles | Editing must survive provider failure, and diagram export must be a deterministic re-render at higher resolution. Binding the editor to the map would make both depend on imagery availability | Aerial context in a scene becomes a single georeferenced image request rather than a live map. Occlusion against streamed geometry stays out of scope |
| D019 | 2026-09-19 | Generate the public catalog from the private workbook as a filtered projection, preserving the unknown vocabulary verbatim | Hand-author the catalog JSON; publish the workbook directly; normalise unknowns to null | The workbook stays the reviewed source of truth while the published data carries only public facts. Copying `Need validation` and `Information has not been found` through unchanged keeps an unknown from becoming a favourable claim | `tools/build-catalog.mjs` regenerates byte-identical output; `tools/validate-catalog.mjs` fails the build if the vocabulary is lost, if a future candidate gains provider identity, or if an absolute local path reaches published data |
| D020 | 2026-09-19 | Publish `docs/FULL-SYSTEM-TESTING.md` as the single deliberate exception to D017 | Leave it untracked and keep execution history outside the repository; move it out of `docs/`; keep an archived execution copy elsewhere | Its own document control requires preserving real results in source history, and the file carries test procedures and catalog identifiers that are already public. Moving a controlling document was not authorised, so the exclusion is narrowed instead | `.gitignore` uses `docs/*` with a negation, because git cannot re-include a file whose parent directory is excluded. `PUBLISHED_EXCEPTIONS` in `tools/check-deploy-scope.mjs` names the one file, still rejects everything else under `docs/`, and fails if the negation is ever dropped. This narrows test 5: the deployed artifact excludes `docs/` apart from this record |

| D021 | 2026-09-20 | Keep the whole workspace behind one repository module over an injected IndexedDB factory | Call IndexedDB directly from the feature modules; adopt a wrapper library; use localStorage for small records | Persistence is the part most likely to be replaced by an authenticated backend, and it is also the part that cannot be exercised in Node. One module owning the API keeps the replacement to one file and lets the repository logic be tested against an injected factory | `src/data/idb.js` is the only module touching IndexedDB. `tests/fixtures/indexeddb.mjs` provides an in-memory double and declares itself as a double, so its results are recorded as automated evidence and never as browser evidence. Browser behaviour, quota and durability still require a live run against tests 16, 17 and 21 |
| D022 | 2026-09-20 | Write every workspace record with a monotonic `revision` and discard a completing older write | Last write wins; timestamp comparison; a write lock per aggregate | Debounced autosave lets a slow write finish after a newer one. Comparing a per-record revision makes the late write a no-op instead of a silent reversal of the user's most recent edit | Enforced in `src/data/workspace-repo.js` and exercised in `tests/workspace-repo.test.mjs`. Debounced autosave itself arrives in Phase 3 and is validated by test 80 |
| D023 | 2026-09-20 | Refuse an import whose project identifier already exists until the user chooses cancel, add as a copy, or replace | Default to add-as-copy; default to replace; merge records by identifier | Every default here is somebody's data loss, and a merge would silently interleave two versions of a decision record. The choice is small and infrequent, so asking is cheap | `src/data/conflicts.js` implements the three outcomes and `src/data/transfer.js` refuses to proceed without one. Add-as-copy regenerates workspace identifiers only; catalog identifiers are kept, because the copy describes the same real place. Exercised in `tests/transfer.test.mjs`, test 20 |
| D024 | 2026-09-20 | Report an unconfirmed runtime capability as `unknown` rather than as unavailable | Treat an untested capability as false and enable it when a probe succeeds; assume the documented behaviour works | `false` is a finding. Recording one that was never made would put an unverified provider claim into the same record that is supposed to separate expectation from evidence, which is the failure mode the research vocabulary exists to prevent | `src/app/capabilities.js` reports `canvasReadback` and every Treedis capability as `unknown` until Phases 0.3 and 0.4 make the findings. `tests/store.test.mjs` asserts that an absent document does not turn into a claim that WebGL is missing |
| D025 | 2026-09-20 | Apply a route only from the hash-change listener, guarded by the last applied hash | Apply the route inside `navigate` and suppress the event it causes with a synchronous re-entrancy flag, as the reference project does | A synchronous flag is cleared before the browser fires `hashchange`, so it does not actually suppress anything and the route is applied twice. Comparing the last applied hash works whatever the source: initial load, programmatic navigation, Back, or an edited address bar | `src/app/router.js` has one path into the route state. `tests/router.test.mjs` asserts that a navigation followed by repeated `hashchange` events reports the route exactly once |
| D026 | 2026-09-20 | Ship the Phase 0 mode panels as an explicitly labelled foundation rather than as empty or placeholder features | Leave the modes blank until their phase; build a reduced version of each feature now | A blank panel and a finished one look alike in a screenshot, and the verification record has to be able to say which is which. Each panel states the phase that delivers it | `src/app/shell.js` renders a phase note in every mode panel. The Explore list, the location identity block and the Projects panel exist to exercise routing, catalog loading and persistence, and they are replaced by the Phase 1, 2, 3 and 4 surfaces |

| D027 | 2026-09-20 | Identify a build by a digest over publishable files outside `docs/` and `research/` | Keep the Phase 0.1 scope covering every publishable file; use a git commit only; use a timestamp | A digest that covers the documents recording a result changes the moment the result is written into them, so it can never be recomputed and cannot identify the build it names. Excluding the two record directories makes the figure reproducible from the artifact at any later time. Commits alone do not identify an uncommitted working tree, which is what these phases are tested against | The Phase 0.1 entry keeps its original figure unchanged, as the record requires. From Phase 0.2 onward every place the digest appears states its scope, and the figure can be recomputed by hashing the sorted publishable paths and contents under `SLiVR/` excluding `docs/` and `research/`. This supersedes nothing in D015; it narrows how a build is named inside it |

| D028 | 2026-09-20 | Validate imagery by decoding pixels, not by checking the HTTP status | Accept any 200 response; compare byte size against a threshold; check only in the browser | The service publishes an extent covering much of the state while holding imagery only for selected areas, and its metadata records the no-data value as 0, so an uncovered request returns a valid all-black image with a 200 response. Byte size alone is not decisive either, because the excluded layer returns a flat fill at full size | `src/map/image-content.js` classifies a decoded image as covered, no-data, uniform or suspect. `tools/probe-imagery.mjs` carries the evidence for test 22. Thresholds are calibrated against real responses, with two no-coverage controls inside the published extent recorded in every run so a future run shows whether the separation still holds |
| D029 | 2026-09-20 | Read probe pixels from an uncompressed BMP rendering while production requests stay JPEG | Decode JPEG in the probe; install an image library; probe with PNG and inflate it | Decoding JPEG without a dependency is out of scope under the no-build rule, and the service renders the same raster to several formats. BMP decodes to exact pixels in a few lines. The probe issues the production JPEG request for the same box in the same run, so the shape the map actually uses is still exercised | `tools/lib/bmp.mjs` reads uncompressed 24- and 32-bit BMP and rejects anything else rather than guessing. Pixel statistics therefore describe a lossless rendering of the same bounding box, not the JPEG the browser receives; the JPEG is recorded by status, type, size and timing |
| D030 | 2026-09-20 | Abandon an imagery source only after consecutive failures with no success between them | Switch on the first failed tile; use a time window; never switch automatically | A single failed tile is ordinary: a request times out, or a tile falls outside coverage at the edge. Switching on one would retire a working service, and a plain failure count without a reset would retire it eventually | `createImageryFailover` in `src/map/imagery.js` resets the count on any successful tile and moves on after four consecutive failures, appending the provider reason to a transition history. Exhausting every source leaves a flat neutral ground whose attribution names no year, so nothing stale is attributed |
| D031 | 2026-09-20 | Pin MapLibre GL JS at 6.10.0 rather than the version the reference project uses | Follow the reference project at `maplibre-gl@4`; leave the major version floating as it does | A floating major version can change what a recorded result was produced with, which the verification record cannot tolerate. The reference pin is three majors behind current | `index.html` pins `maplibre-gl@6.10.0` patch-exact in the import map, with the stylesheet pinned to the same version. The library has not yet been loaded in a browser, so no rendering behaviour of this version is claimed. Any change to this pin is a new build for verification purposes |
| D032 | 2026-09-20 | Keep `maxZoom: 20` although it requests finer detail than the source holds, and record the discrepancy | Lower it to 19 to match the source; keep it silently as inherited from the reference project | Measured on 2026-09-20, both services report about 0.150 m per pixel while maxZoom 20 at 512 pixels asks for about 0.064 m, so the top zoom level upsamples. The inherited value is the shape proven to render, and whether the sharper-looking upsample is preferable is a visual judgement that cannot be made without a browser | `validateRegionImagery` reports it as a warning on both sources rather than an error, the measured figures are recorded in the region configuration, and it is carried as L026. Revisit during the manual browser pass at the Phase 0 exit |

| D033 | 2026-09-20 | Boot the real entry point against a DOM stand-in as an automated check | Rely on the browser pass to find startup failures; build no check at all; adopt a full headless browser | A page that is blank because the shell threw looks exactly like a page that was never served correctly, and the store reports a failing subscriber rather than propagating it, so the first cause can be silent. Being able to rule it out from the command line is what makes a blank-page report diagnosable. A full headless browser would need an install, which the no-build rule excludes | `tests/shell-smoke.test.mjs` with `tests/fixtures/dom.mjs`. It found a real notification cycle in the Phase 0.3 build on its first run. The stand-in has no layout, styling or real event dispatch and says so in its header, so it never substitutes for the live checks and its results are recorded as automated evidence |
| D034 | 2026-09-20 | Cap notification passes in the store and fail loudly on a cycle | Leave the queue unbounded; deep-compare state values instead of comparing identity; debounce renders | Queueing bounds recursion but not total work: a subscriber that writes a newly built object each pass keeps the queue full forever and freezes the tab. Deep comparison would hide the mistake rather than surface it, and would make every write cost more | `createStore` throws after 50 passes with a message naming the likely cause. Callers that write state from a render must avoid writing a new object when nothing changed, which is now the rule the map mounting in `actions.js` follows through its own mount state |

| D035 | 2026-09-20 | Post viewer commands to the configured origin and refuse inbound messages from any other | Follow the reference project and post to `"*"` with an origin check only when one happens to be configured | Posting to `"*"` hands every command to whatever document currently occupies the frame, and an origin check that is skipped when unconfigured is not a check. The frame holds third-party content this project does not control | `treedis-messages.js` refuses a missing or mismatched origin outright, `treedis-adapter.js` posts to `region.immersive.origin`, and both rules are asserted, including that a `TourReady` from another origin never reaches the capability record |
| D036 | 2026-09-20 | Keep every provider capability `unknown` until observed, and never infer one from another | Treat the documented protocol as working; treat anything untested as unavailable; infer pose support from a working message bridge | The reference bridge was never run against a live model — its inventory carries `sweepId: null` for every entry — so the documented protocol is a claim. `false` is also a finding, and recording one that was never made is the same error in the other direction | `capability.js` starts every key at `unknown`, `isAvailable` treats only `true` as available, and `observe` refuses any value outside true, false and unknown. The URL-entry path is always available because the supplied URLs already encode experience, sweep and entry orientation |
| D037 | 2026-09-20 | Record provider message structure rather than message contents | Log whole payloads for richer reconnaissance; log nothing but message type | A payload may carry coordinates or identifiers from a private experience, and the reconnaissance record is a research artifact that outlives the session. The structure is what the finding needs; the values are not | `describeShape` records `key:type` pairs, and a test asserts that neither a private identifier nor a pose value survives into the record. The harness report is built from these shapes |
| D038 | 2026-09-20 | Compute scene geometry as plain data and give Three.js only placement | Build the scene directly with library objects, as most examples do | Every number in a Phase 4 exit gate — heights, headings, field of view, framing — has to be testable without a renderer, and a rendering fault must never be diagnosable as a maths fault. Separating them also keeps the library replaceable | `three-bridge.js` computes the basis, the frustum corners and the containment test in ENU metres; only `buildThreeScene` touches the library, and a test drives it with a stand-in to assert it places what was already computed. ENU to Y-up conversion happens at exactly one function |
| D039 | 2026-09-20 | Ship the provider reconnaissance instruments as pages under `tools/`, outside the application | Add a diagnostics route inside the application behind a flag; keep them untracked and rebuild them when needed | The instruments must drive the shipping adapter so the findings describe the code that ships, but they must not appear in the product surface or be mistaken for one in a screenshot attached to a result. `tools/` is committed, carries no private material, and already holds the probes | `tools/treedis-recon.html` and `tools/three-spike.html` import from `src/` and are styled deliberately plainly. They are published, which is acceptable: they contain no credential and the experience identifiers they name are already in the public catalog |

| D040 | 2026-09-20 | Supersedes D031: vendor MapLibre GL JS 4.7.1 under `vendor/` and load it as a classic script | Keep the 6.10.0 import-map pin from D031; keep any version on a CDN | D031 pinned 6.10.0 against the plan's own note that the reference proved the 4.x line, and it loaded the library cross-origin. A browser refuses to construct a worker from a cross-origin script, so the library paints a background and never completes a style load: no error, no tiles. Vendoring also removes a third-party host from a research artifact that has to stay reproducible | `vendor/maplibre-gl/` holds the exact files with their provenance in `vendor/VERSIONS.md`. The 6.10.0 attempt could not be evaluated fairly, because it was tried in a backgrounded automated tab where `requestAnimationFrame` never fires and MapLibre therefore never completes a style load; no conclusion about that version is recorded |
| D041 | 2026-09-20 | Vendor Three.js 0.183.0 alongside the map library | Load it from a CDN, as the spike originally did | The same reproducibility argument applies, and mixing a vendored library with a CDN one is an inconsistency that invites the next person to reach for the CDN. Fetching it also revealed that `three.module.js` imports a sibling `three.core.js`, which a partial copy would have missed | Both files are vendored and the spike page now issues no third-party request at all, confirmed in the browser. Versions match the implementation plan |
| D042 | 2026-09-20 | Share the LSU3D Google Maps 3D Tiles credential rather than issuing a key scoped to SLiVR | Issue a new key restricted to the SLiVR path, as D008 specified | The owner instructed it, and the existing key's referrer restriction already covers this path on the shared origin: verified 200 from `sroberto27.github.io/SLiVR/` | Quota and billing are shared with the neighbouring application and the key cannot be revoked for one without affecting the other. It narrows D008 rather than replacing its reasoning. The key lives only in gitignored `config/runtime.js`; the deployment check confirms it reaches no publishable file, and a test asserts the checker catches a credential in a would-be-published file rather than relying on the ignore rule alone |
| D043 | 2026-09-20 | Verify that a style mutation was applied instead of assuming it succeeded | Trust `addSource` and `addLayer` to throw on failure | Neither throws when the library rejects a mutation; it reports through the error event and leaves the layer quietly absent. The adapter would then record the source as applied, no tile would be requested, none would fail, the failover would never fire, and the map would stay empty with nothing reported. The reference project logs this case loudly for the same reason | `applyImagerySource` re-reads the source and layer after adding them and treats an absent one as the source being unusable, which advances the failover. Exercised by a test that accepts the call and then does not register the source |

| D044 | 2026-09-20 | Treat LSU3D as the ground-truth reference and refactor it rather than deriving new solutions, recording every deviation | Build each module from the specification alone, consulting the reference only when stuck; treat the reference as inspiration rather than as a source | It is a working, deployed application against the same providers and origin, so its configuration carries evidence no specification does. On 2026-09-20 four pieces of plumbing were written without consulting it and all four were defective: stylesheet order, cross-origin library loading, an unpinned major version, and a container whose positioning was silently overridden. Each was already solved there, one beside a comment warning about the exact failure | Recorded in `CLAUDE.md` and architecture section 10.5. Deviation is permitted only where the architecture or plan requires it, where the reference behaviour is a recorded defect, or where no counterpart exists, and each is written down naming the LSU3D file. The reference is explicitly not authoritative where it was never executed, which includes its Treedis bridge. A divergence qualifying under none of the three is corrected in the phase that finds it rather than recorded and kept, so the record cannot become a way to keep unexamined code. Test 184 verifies the comparison at each phase boundary and does not pass while an unjustified divergence is outstanding |

| D045 | 2026-09-20 | Do not constrain the camera to the region envelope, unlike the reference | Adopt `setMaxBounds` and a coverage-derived `setMinZoom` as `js/05-map-helpers.js:19-39` does | The reference constrains the camera to its imagery coverage, which is a real boundary. The SLiVR envelope is not: `data/region/lafayette.region.json` states it is a padded planning extent and not a legal, property or capture boundary, and test 31 requires that it never be presented as one. Hard-locking pan to it would present it as exactly that | Deviation under reason 1. The consequence is that a person can currently pan beyond coverage and see only neutral ground. Handling that readably, without implying a boundary, belongs to the Phase 1 map work under test 31 and is not yet built |
| D046 | 2026-09-20 | Resize the map from a container observer rather than timed calls after a panel transition | Call `map.resize()` on a delay after each panel change, as `js/05-map-helpers.js:51-56` does with a 260 ms timer | The library tracks the window, not the container, so both projects must resize explicitly. The reference's container changes size only through panel transitions of known duration; SLiVR's changes through a grid whose rails appear and disappear per mode, with no single duration to wait for | Deviation under reason 1, adopting the behaviour with a trigger suited to the layout. `ResizeObserver` on the map host, disconnected on dispose, guarded for runtimes without it |
| D047 | 2026-09-20 | Release the immersive provider session on leaving instead of keeping the frame warm | Keep the iframe loaded between visits, as `js/04-street-view.js:21-22` deliberately does | The reference keeps it warm so reopening is instant. Architecture section 6.6 requires the provider session to be suspended or disposed on leaving, and a viewer left running holds a WebGL context and keeps streaming | Deviation under reason 1. The frame is set to `about:blank` on dispose. The reference's other lesson is adopted unchanged: re-entering the same capture does not reload, because a reload costs the whole model download and discards where the person had walked to |

| D048 | 2026-09-20 | Trap focus and honour Escape in any surface that declares `aria-modal` | Leave the dialog as markup only, as it was written | `aria-modal="true"` tells assistive technology the rest of the page is inert. Without a trap that is false, and a keyboard user tabs out of the dialog into controls that are supposedly unreachable. The import conflict dialog offers a destructive choice, so reaching past it is not cosmetic. The reference already solved this at `js/12-start-screen.js:605-660` | Adopted into `src/ui/a11y.js` and used by the conflict dialog: focus enters on open, Tab cycles inside, Escape takes the cancel route rather than a destructive one, and focus returns to whatever opened it. Exercised by `tests/a11y.test.mjs` |

| D049 | 2026-09-20 | Keep a failure on screen until it is dismissed rather than auto-dismissing it | Auto-dismiss after a timeout, as the reference toast does at `js/17-router.js:212-245` | The reference clears a transient message after six seconds, which is right for a confirmation and wrong for a failure: an error that disappears before it is read is an error nobody acted on. The architecture requires a failed save to keep the workspace open and offer retry, which a vanishing message cannot do | Deviation under reason 1. Notices and errors share one status band and persist until dismissed, replaced, or cleared by a route change. The reference's other habits are adopted unchanged: `role="status"`, `aria-live="polite"`, and message text set as text rather than markup |
| D050 | 2026-09-20 | Carry the reference's Phase 4 three-dimensional patterns as binding obligations rather than re-deriving them | Build the 3D workspace from the specification and consult the reference only if it goes wrong | These are the parts of the reference with the most hard-won detail behind them: rendering inside MapLibre's own WebGL context as a custom layer, a generation counter guarding every awaited step of an activation, and geo-referencing maths the reference states was verified against the package source rather than guessed. Re-deriving them would repeat work that is already evidenced | Recorded in the implementation plan's Phase 4 section, naming `js/16-google-tiles.js` and the specific lines. They are obligations rather than divergences, because the code they apply to does not exist yet; test 184 checks them when Phase 4 builds it |

| D051 | 2026-09-20 | Build the immersive viewer surface in Phase 0 rather than waiting for Phase 2 | Leave Immersive as a foundation panel naming Phase 2, as it was written | The reference opens its captured experience in the same window as the map, and the prototype claimed the immersive mode existed while showing an empty panel where the viewer belongs. Reconnaissance had already established that the provider embeds and answers, so the surface was the only missing part, and a mode that names a phase instead of showing the evidence misreports what the build can do | The viewer frame, its loading veil and the adapter lifecycle are implemented and wired to the Immersive route. Only the surface moved forward: bookmarks, saved viewpoints and the handoff into a scene remain Phase 2 under F03 and F04, and no capability is reported as available that the viewer has not demonstrated. The frame is persistent for the whole session because re-inserting an iframe reloads the document inside it. The escalating loading veil is adopted from `js/04-street-view.js:194-250` with its own wording, including the way out offered once the wait becomes long; it is lifted on `unresponsive`, a state the reference has no counterpart for, because the supplied entry URL already places the viewer correctly |

| D052 | 2026-09-20 | Record `https://spaces.dtsxr.com` as the immersive host in the workbook and the catalog, keeping the provider's primary host as a configured alias | Keep `https://my.treedis.com`, the host the entries were supplied on, and treat the embedded failure as a provider matter | On 2026-09-20 the viewer document loaded and started inside the frame and then failed every request to its own API, so no capture rendered (L033). Both hosts return byte-identical tour documents for the same experiences, and the one working Treedis embed available as a reference — the SCSU campus project at `Wrapper/map/Experimental`, `config.js:102-116` — embeds the white-label host. Under the reference-first rule the configuration that is known to work is the one to adopt | Changed at the source: `tools/rehost-captures.mjs` rewrote the 11 URLs in the reviewed workbook, moving only the host and verifying every other cell was untouched, and the catalog was regenerated from it. The region's `origin` is the new host and `originAliases` keeps the primary, so the frame, the postMessage target and the accepted sender always agree. This is not recorded as a fix: no capture has been seen to render on either host, the mechanism behind the API refusal is not established, and L033 stays open until a sweep is observed |

| D053 | 2026-09-20 | Use Experimental/SCSU as the read-only Treedis implementation source, as directed by the owner; retain LSU3D for the other existing behaviors | Continue using the unexercised LSU3D bridge or write a new viewer | SCSU supplies the working wrapper. Adapted `Experimental/js/03-tour-bridge.js:55-67` readiness delay and commands, `js/04-street-view.js:86-167, 269-333` queued orientation and bounded arrival retries, and `map.html:299-306` iframe surface | Supersedes the Treedis-source portion of D044 and narrows D051's persistent-frame rule. A responsive shared experience keeps its frame; independent models and retries replace the frame so queued same-origin messages have an obsolete source window. Exact origin/source/payload checks, generation guards, load/navigation timeouts and disposal are required deviations for architecture 6.4, unlike the single-model reference. Tests 185–191 and 195–199; no reference file changed and no live Lafayette rendering claim |
| D054 | 2026-09-20 | Keep map event routing tied to the same source constant used for style creation, and cancel obsolete asynchronous mounts | Retain hard-coded event ID; allow pending mounts to finish after leaving Explore | `LSU3D/js/11-boot.js:234-257` consistently uses source identifiers and `js/16-google-tiles.js:46-47` guards asynchronous activation with a generation. SLiVR renamed its imagery source without updating its event handlers and omitted the applied-source assignment | Tests 192–194 failed before correction: fallback stayed at 2025, a successful tile stayed pending, and an abandoned mount became ready. Tests now cover primary/fallback/neutral/retry, success resetting the failure count without source replacement, and cancelled mount completion. Failover itself remains the approved D030 addition |
| D055 | 2026-09-20 | Report iframe load and silent-bridge outcomes without claiming successful capture rendering | Keep `embedding: true` on load and tell the user that the intended entry is showing | A frame load may be a refusal page; L033 already records a loaded document whose data failed. Technical observations must distinguish document load, bridge readiness and sweep arrival | Supersedes the unconditional URL-success language in D036 and D051. Adapter capability version is `treedis-recon-2`; embedding stays unknown on load, readiness requires a trusted message, and requested sweep arrival requires a matching pose after navigation. Existing doubles now supply `event.source` and valid message payloads. No schema, catalog, participant measure or telemetry change; live provider verification remains outstanding |

| D056 | 2026-09-20 | Match SCSU's base-tour launch followed by queued Navigate, and its explicitly activated loading overlay | Keep direct deep-link startup and rely on the hidden attribute over a flex rule | Owner reports both base tour links open in Chrome, while the embedded Lafayette tour fails. `Experimental/js/04-street-view.js:12-24` loads the configured base tour; its CSS hides the loading surface unless explicitly active. SLiVR's unconditional flex rule overrides hidden, leaving a stale veil over the provider and recovery controls | Base-tour launch now retains sweep/orientation in the adapter queue and preserves the supplied deep link for external recovery. The veil displays only while waiting and not hidden; the empty status surface passes pointer events to the iframe. The provider CORS/403 cause remains unproven. No tests executed after the owner's explicit instruction to leave testing manual |

New entries are append-only. If a decision changes, add a superseding decision that links the earlier ID rather than rewriting the historical rationale.


| D057 | 2026-09-20 | Connect Explore's dimension control to streamed Google tiles and ship the owner-approved shared browser key | Keep a tilt-only button or an ignored runtime script absent from Pages | Owner reported flat imagery after deployment and explicitly requested the existing LSU3D key, publication, and manual testing. Adapted `LSU3D/js/16-google-tiles.js:146-308, 389-530, 605-708`: ECEF-to-ENU anchoring, separate draw/LOD cameras, compressed glTF loaders, cached resources and generation guards | Architecture requires lifecycle cleanup and explicit provider fallback, so resources are disposed when the map leaves Explore (reference retains them for the session). Geometry becomes active only after a visible-tile render, rather than the reference's root-loaded timeout condition. Keep the current Lafayette camera rather than importing campus framing. `config/deployment.js` is the owner's explicit exception to D008/architecture 6.2.2's uncommitted-key rule. Only its browser-key property is exempt from credential scanning; no other source credentials are allowed. No tests after the owner's manual-testing instruction; live geometry remains unverified |

| D058 | 2026-09-20 | Recognize both LSU3D and Experimental/SCSU as read-only code ground-truth and refactoring sources for every phase | Restrict SCSU reuse to Treedis and require LSU3D for all other code | Owner explicitly broadened the source policy for future implementation sessions | Supersedes the source-scope restriction in D053, without removing its preference for the working SCSU Treedis wrapper. Inspect both references, select demonstrated behavior compatible with SLiVR, and record source files/lines and deviations. Never edit either reference. Updated shared instructions, AGENTS.md, architecture, plan, reusable prompts and test 184; no runtime changes or tests |


| D059 | 2026-09-20 | Use a translucent immersive loading veil and align user-facing/provider timings with SCSU | Opaque SLiVR veil, 8/25-second notices, 1500 ms default sweep transition and 20-second navigation window | Owner requests visibility of Treedis loading underneath and SCSU timings. References: `Experimental/css/07-streetview-xr.css:88-121`, `js/04-street-view.js:157-280`, `js/03-tour-bridge.js:23-31, 54-56, 93-96`, `config.js:125-126` | Veil alpha is 55% per owner visibility preference rather than reference 92%; keep SLiVR colors/reduced-motion behavior. Slow notice 15 s, cancel 30 s, spinner 900 ms, ping every 2 s starting after 2 s, ready-settle 600 ms, default transition 0 ms, four navigation attempts 1500 ms apart with final recovery at 6 s. Preserve bounded lifecycle per architecture: 60 s no-load timeout and 30 readiness pings (unresponsive at 62 s) rather than reference indefinite polling. Polling starts on attach; veil escalation is not restarted by handshake/navigation state changes. Pending entry keeps the veil until arrival or bounded recovery. No tests run; previous acceptance belongs to 59a980ac |


| D060 | 2026-09-20 | Reconcile Phase 0 regression expectations with accepted base-tour startup and SCSU timing | Restore obsolete deep-link startup to make historical assertions pass; weaken navigation tests to only check URLs | D056/D059 and owner acceptance establish the current behavior | Replace URL-distinctness with six distinct queued Navigate targets, exact orientations, ready delay, explicit origins and arrival acknowledgements. 326 tests PASS after eight stale expectations failed initially. No production Treedis behavior changed. Closeout report separately lists live evidence gaps and proposed exceptions; approval is pending |


| D061 | 2026-09-20 | Close Phase 0 with bounded owner-approved evidence exceptions | Keep the phase open until all live/device/administrative checks are performed | Owner explicitly answered "Approve these exceptions and close Phase 0" after reviewing the concrete closeout report | Phase 0 COMPLETE. Live storage/schema/full fixture checks move to first Phase 1 browser integration before persistence expansion; remaining device/provider/console variants to next deployment; raw Treedis reports and metadata/rights before Phase 2 dependent features/claims. Missing observations remain unverified, not PASS. 326 automated PASS plus recorded owner manual acceptance support the foundation release; Phase 1 is next, not started |


| D062 | 2026-09-20 | Fit Explore to actual catalog pins and adapt numbered/co-located reference pins in SLiVR colors | Keep the padded region envelope and tiny dots; offset catalog coordinates to separate records | Owner supplied SLiVR/LSU3D screenshots and requested tight screen-size fitting, stronger pins and the reference array behavior. Sources: LSU3D `js/05-map-helpers.js:38-48`, `js/07-layer-builders.js:180-332`, `css/05-leaflet-responsive.css:55-217`; SCSU `js/07-layer-builders.js:106-135` | Fit min/max pin coordinates on initial catalog and container-size changes, preserving manual navigation across unchanged redraws. Use bottom-anchored numbered button pins in SLiVR captured/future colors. Group at reference six-decimal coordinate precision; expand ordered members on hover/focus/tap and reveal selected members. Architecture requires keyboard buttons and bounded accessible menus; owner requires viewport-derived bounds instead of a fixed reference campus view. Keep geographic coordinates unchanged. Proximity clustering is not implemented by this exact-position grouping |

| D063 | 2026-09-20 | Adapt the reference map toolbar, menu and location navigation in SLiVR colors | Keep only the original zoom/compass and dimension button | Owner explicitly requested Recenter and all LSU3D map UI. Sources: LSU3D `index.html:334-450`, `js/14-redesign.js:270-350`, `js/11-boot.js:260-283`, `js/10-event-wiring.js:128-151`, `js/08-tourbar.js`; compared SCSU `js/10-event-wiring.js:247-276` | Preserve SLiVR architecture: Recenter fits catalog bounds rather than campus imagery, navigation follows catalog IDs instead of an LSU itinerary, and menu help/search replace campus startup/exit screens. Use MapLibre's pinned built-in zoom/compass, fullscreen and one-shot geolocation controls with accuracy visualization and lifecycle cleanup. Geolocation is user-triggered, never logged. Adapt raster streets overlay at reference 0.35 opacity, loaded on first request; use canonical OSM tile host and linked attribution. Preserve independent aerial preference across fallback and 3D transitions, disable its toggle while Google geometry covers it, keep reference layer above geometry. Menu, search, help, 3D status, catalog previous/next strip and rail Recenter use SLiVR tokens. Device-specific presentation and live providers remain unverified; 334 automated checks PASS. No reference project edits |

| D064 | 2026-09-20 | Publish catalog 1.1.0 from the updated reviewed workbook, with 13 corrected existing pins and LaSEL / Antoun Hall as a future candidate | Retain prior geocoder positions or postpone the solar destination under D002 | Owner supplied exact latitude/longitude pairs, added Moncus Park in a follow-up, and explicitly requested website/workbook synchronization and LaSEL research | Supersedes D002's solar exclusion. LOC-018/CAP-018 in AREA-07 UL Research Park has no provider identity. Official UL facility/contact, dedication and lab pages are SRC-044..046; coordinate intent is SRC-043 and docs/CATALOG_COORDINATE_UPDATES_2026-09-20.md. Retain four other pins and all existing stable IDs, public facts, capture links and unknowns. Catalog has 18 locations, 11 current/7 future, 7 areas, 18 capture/detail records and 46 sources. Workbook remains local/private; regenerated JSON is the website projection. Schema stays 1.0.0. Fixed the existing XLSX reader's empty-element matching so blank cells cannot swallow the next populated capture-date cell on export. Workbook/catalog tooling has no reference-project counterpart |
| D065 | 2026-09-20 | Center the map on list, pin, search and previous/next selection, including repeated selection | Highlight a record without moving the camera; only focus search results | Owner explicitly requests SCSU-style selection behavior. Sources: SCSU `js/06-details-panel.js:313-368`, `config.js:84`; LSU3D `js/06-details-panel.js:407-446` | Adapt reference 550 ms animation and focus zoom cap 19 to MapLibre point coordinates. Defer two animation frames for layout settling and retain bearing/pitch. SLiVR has point records rather than reference building polygons. Superseded focus requests, Recenter and disposal invalidate pending camera moves. Unchanged redraws do not move the camera; resize preserves an explicit location focus, otherwise fits all pins. Recenter returns to all-pin fitting. This refines D062's selection/resize behavior without changing coordinate data |

D064 follow-up, 2026-09-20: the owner additionally supplied Play N Trade (LOC-007),
Givens House (LOC-008) and Former Truman (LOC-010). These three positions supersede
their previous geocodes in both the workbook and catalog. The cumulative scope is
now 16 existing corrections plus LaSEL; Carpe Diem alone retains its prior point.
No other record facts or capture identities change. The same owner-provenance
limitations and catalog 1.1.0 scope apply.

| D066 | 2026-09-20 | Include the coordinate-correction evidence note in the SLiVR-only publication | Leave the note ignored and break catalog regression verification after checkout | The owner authorized publishing the corrected public location catalog; the note contains those same venue coordinates and official source links | Narrowly allowlist docs/CATALOG_COORDINATE_UPDATES_2026-09-20.md alongside the existing verification document. Keep the workbook, private reference documents and all other outputs ignored. This makes the coordinate provenance and its regression fixture reproducible in the published source tree |


| D067 | 2026-09-20 | Single Explore discovery/dossier panel and shell-owned catalog/help drawer; remove permanent right rail and redundant navigation strip | Keep two rails, map-only search and previous/next strip from D063 | Owner explicitly authorizes LSU3D-inspired Explore redesign, preserving identity, modes and architecture. Sources: LSU3D css/03-sidebar.css:7-62, css/01-base.css:87, css/04-map-details.css:520-550, css/02-header.css:84-139, js/09-sidebar-search.js:7-124, js/14-redesign.js:100-139,156-208; compared Experimental js/06-details-panel.js:6-45,310-368 and js/09-sidebar-search.js:8-135 | Reason 1: retain modular route/store IDs, stable catalog, SLiVR palette/top nav, accessible native controls/trap and bounded provider lifecycle. Reserve map grid space instead of overlapping floating rails; ResizeObserver replaces timed refresh. Explicit sheet-size buttons replace mandatory drag. Filter both map/list by actual area/capture fields; no itinerary. Reason 3: retain SLiVR-only evidence/catalog/private-workspace semantics. Supersedes Explore layout in architecture 6.6 and D063 strip/menu-search placement, not other modes. Public docs/UI_INTERACTION_DESIGN.md is narrowly allowlisted for durable provenance. Browser source comparison and screenshots BLOCKED; automated results in tests 204-205 and the execution record. No Phase 1 completion or participant benefit claim. |

| D068 | 2026-09-21 | Owner approves native Scouting Assessments (F06-SA) in essential Phase 3, after candidates and before comparison; supporting integration in Phases 1, 2, 4 and 5 | External checklist link; iframe; entire field toolkit moved into prototype | Shared project identity, explicit unknowns, evidence history and portable media connect inspection to decisions without another mode | Approved plan only, not implemented. SCOUTING_ASSESSMENTS_PLAN.md records CheckList/v2 sources and both read-only map counterparts. Architecture-required deviations replace split storage, ambiguous defaults and incomplete media transfer; no assessment counterpart exists in either map reference. Tests 206-215 NOT TESTED; advanced capture/sensors/offline phone remain Phase 7; no telemetry or reference edits |

| D069 | 2026-09-21 | Extend existing Phase 1 discovery/dossiers and prepare D068 placement without adding a premature assessment editor | Rebuild Explore; publish invented tags/facts; add disabled later-phase actions | Inspect both approved references first: LSU3D js/09-sidebar-search.js:28-124 and js/14-redesign.js:156-208 provide normalized multi-field discovery/category filtering; Experimental js/09-sidebar-search.js:8-135 supplies the same selection handoff. LSU3D js/06-details-panel.js:43-210 and Experimental js/06-details-panel.js:47-200 supply description/space/address/link rendering and missing-media handling. LSU3D js/17-router.js:408-431 and Experimental js/10-event-wiring.js:94-113 supply clipboard feedback and fallback patterns. LSU3D js/07-layer-builders.js:180-332 supplies ordered expandable pins; Experimental js/07-layer-builders.js:100-141 supplies ordered location pins without grouping | Reason 1: approved architecture requires stable catalog IDs, all results, map/list AND filters, debounce, explicit missing information, read-only public evidence, no telemetry, and lifecycle cleanup. Extend the existing pin groups to 44 screen-pixel proximity for Phase 1 zoom clustering; retain exact-position fallback and actual coordinates. Clipboard failure is visible/selectable instead of ignored or success reported without proof. Description facets use existing catalog wording; no unreviewed catalog rewrite or inferred approval. Reason 3: neither reference has SLiVR practical-evidence/completeness semantics or project assessments. Define the Project context insertion point in docs/UI_INTERACTION_DESIGN.md; the shared assessment editor/actions stay Phase 3 under D068. No reference edits. Tests 31-49, 204-205, new 216-217 and Part J are mapped in the verification record; live browser unavailable, no phase completion or participant benefit claim. |

| D070 | 2026-09-21 | Owner-approved floating Explore panel, wrapped location names, circular group counts and group-click zoom | Keep rectangular backing, single-line truncated rows and rectangular group labels | Owner supplied localhost screenshot showing unreadable truncated names, rejected rectangular panel backing and group labels, then approved proposed styling and requested automatic zoom to group members. Inspected LSU3D css/03-sidebar.css:7-62 floating rail versus Experimental css/03-sidebar.css:6-33 grid sidebar; LSU3D js/05-map-helpers.js:38-48 bounds fitting and Experimental js/06-details-panel.js:310-368 padded animated focus; existing grouping derives from LSU3D js/07-layer-builders.js:180-332 versus Experimental js/07-layer-builders.js:100-141 | Owner directive supersedes D067's desktop reserved map column: the map spans behind the rounded panel, while camera padding measures the actual visible panel and ResizeObserver also tracks its hidden/visible size. Keep mobile reserved sheet, SLiVR colors and existing state/lifecycle. Reason 1: preserve selected IDs, provider independence, reduced motion, cancellation and public/private boundaries. Group click fits only its members with a zoom cap and retains pitch/bearing; coincident members remain expandable. Circular 44px count and full-width wrapping names follow owner-approved design; metadata stays separately readable. Tests 218 and existing Part C/J regressions; live verification unavailable. No reference edits or phase completion. |


| ID | Date | Decision | Alternative | Rationale / provenance | Consequences / evidence |
|---|---|---|---|---|---|
| D071 | 2026-09-22 | Keep Phase 1 open; perform independent Phase 2 reconnaissance and correct diagnostic restore inference | Infer acceptance from 352 tests/HTTP success, begin gated bookmark implementation, or advertise restoration from any pose | User requests acceptance-first work and actual capability evidence. Inspected Experimental js/03-tour-bridge.js:20-119, js/04-street-view.js:11-155,217-281, map.html:297-306, config.js:92-126; compared LSU3D js/03-tour-bridge.js:27-128, js/04-street-view.js:12-29,86-191,269-332. Neither js tree has persistent bookmark/capability interpretation counterparts (reason 3); SLiVR evidence contract requires independent restoration verification (reason 1). | Diagnostic-only descriptor correction in src/immersive/capability.js:78; preserve provider configuration and lifecycle. Tests 219/220 and final 353 automated PASS; HTTP 11/11 reachable is not rendering/arrival. Live browser unavailable; owner 15/16 NOT TESTED and historical presentation FAIL preserved. PHASE_1_ACCEPTANCE_REVIEW.md proposes E1 for test 44 phase allocation, NOT APPROVED, with exact retest gates. PHASE_2_RECONNAISSANCE.md records bookmark/context gaps; no dependent implementation or Phase 3 placeholder/editor. No phase completion, telemetry, reference edits, commit or push. |


| ID | Date | Decision | Alternative | Rationale / provenance | Consequences / evidence |
|---|---|---|---|---|---|
| D072 | 2026-09-22 | Explore from a resolved Immersive location opens that location's map selection/dossier | Always navigate to the unselected Explore index | Owner explicitly requests the map pin for the location visited in Immersive. Compared Experimental js/04-street-view.js:32-56 and js/06-details-panel.js:330-368 with LSU3D js/04-street-view.js:41-69 and js/06-details-panel.js:407-446: retain shared location context and focus the selected feature. Reason 1: SLiVR uses stable catalog route IDs and its existing point/panel-aware MapLibre focus, not reference display-name joins or polygon bounds. | src/app/shell.js mode button forwards resolved locationId to the existing location action. Current immersive selection takes priority over the general map index; discovery filters/scroll persist and the selected pin remains represented outside filters. Index/unknown routes fall back to ordinary Explore. No provider protocol/lifecycle or persistence change. Test 221 and 355 automated PASS; live browser unavailable. Narrow owner-requested correction, not Phase 1 closure or approval of E1/bookmark implementation. |


| ID | Date | Decision | Alternative | Rationale / provenance | Consequences / evidence |
|---|---|---|---|---|---|
| D073 | 2026-09-22 | Add an Immersive location mini-map above the captured-location list, collapsible on every screen | Overlay the provider's bottom controls, hide the map on phones, or keep a second full Explore toolbar | Owner supplies desktop/narrow screenshots and requests a nonintrusive mini-map; follow-up explicitly requires collapse on every screen. Inspected LSU3D js/14-redesign.js:430-518, css/07-streetview-xr.css:147-194, index.html:283-287; compared Experimental js/05-map-helpers.js:1-83 and js/04-street-view.js:32-56 (no mini-map counterpart found in Experimental js/css/html). Reuse LSU3D's noninteractive second MapLibre view, selected numbered pin and return-to-map action. | Reason 1: preserve SLiVR location IDs, no overlay on provider controls, keyboard buttons, attribution, configured imagery failover, resource disposal and current viewer lifecycle. New ui/immersive-map.js composes existing map adapter in compact mode; no new provider endpoint/configuration or reference edit. Desktop starts open, <=64rem starts closed; Show/Hide remains available everywhere, session preference retained. Keep map canvas attached during viewer redraws; dispose on collapse/exit. Test 222 and 360 automated PASS; browser unavailable, presentation remains BLOCKED. No phase close, new acceptance exception, telemetry, commit or push. |


| ID | Date | Decision | Alternative | Rationale / provenance | Consequences / evidence |
|---|---|---|---|---|---|
| D074 | 2026-09-22 | Preserve selected location across both Explore/Immersive top-tab directions; require future bidirectional project/shot context | Preserve only Immersive-to-Explore and drop Explore selection on Immersive entry | Owner reports the reverse-direction defect and explicitly requests future connections with Projects/Shot Designer. Inspected Experimental js/06-details-panel.js:331-399 and LSU3D js/06-details-panel.js:461-478: shared feature selection drives list/pin/tour navigation. Reason 1: retain SLiVR stable route IDs and existing adapter ownership rather than reference feature/name globals. | Shell tab routes resolved Explore selection to immersive/{locationId}; existing reverse route stays intact. No selection/invalid ID uses immersive index; future records show existing no-capture state. Test 223 reproduced two failures, then 26 targeted and 362 full automated PASS. Future project/scene/candidate/shot context requirements documented, not implemented; no arbitrary project/shot selection or placeholder actions. Live BLOCKED, phase gates unchanged; no telemetry, reference edit, commit or push. |


### D075 - Interactive temporary Immersive map (2026-09-22)

Owner requests pin navigation, zoom, recenter, 3D, streets and temporary enlargement before manual testing. Supersedes D073's static mini-map contract. Reuse SLiVR's Explore adapter for all 11 current-capture pins, grouping, keyboard selection, imagery recovery and optional configured 3D. Pin selection navigates immersive/{locationId}; Open Explore remains a separate action. Recenter focuses the current location. A compact two-row toolbar preserves 44px targets; enlarged desktop uses one row. Show/Hide works at every width.

Read-only sources: LSU3D js/14-redesign.js:430-518 (second MapLibre mini-map), :307-348 (street overlay/recenter); Experimental js/10-event-wiring.js:244-278 (resize/fullscreen refresh), js/06-details-panel.js:331-399 (selection/tour dispatch). Reason 1: architecture and owner-required interactive map use SLiVR stable IDs, existing adapter/runtime configuration, attribution, bounded recovery and disposal; no reference globals, duplicate provider configuration or document fullscreen. Reason 3: neither inspected reference supplies temporary enlargement with outside-interaction dismissal. Fixed enlargement preserves the same canvas; ResizeObserver and explicit resize refresh it. Outside pointer/focus/wheel, Escape, Restore, collapse/exit restore size. Cross-origin tour interaction observes window blur and iframe focus without intercepting input or reading iframe contents. Remove listeners/timer on disposal. No viewer bridge changes or new capability claims.

Stable 224 automated contracts PASS; live layout, actual iframe focus on desktop/touch and 3D rendering remain BLOCKED by unavailable browser automation. Phase acceptance remains OPEN; no exception approved.


### 2026-09-22 - D076

D076: Owner screenshot of localhost:8000/#/immersive/LOC-005 shows oversized external controls and square pin backgrounds. Move six controls into a single icon strip at the top inside a viewport wrapper; 32px buttons/18px glyphs, accessible labels/tooltips and active/focus states. The map-owned container remains a sibling of the overlay so disposal cannot remove controls. Restrict generic button styling to header/retry to preserve existing transparent pins and circular group badges. Sources inspected read-only: LSU3D index.html:344-389 (SVG zoom/locate/layers, including filled minus rectangle), Experimental map.html:265-290 (accessible icon-only navigation); reuse existing SLiVR Explore cube/layers/recenter glyphs. Reason 1: SLiVR lifecycle and owner-requested compact inline toolbar require scoped styling and viewport ownership rather than reference full-page controls. Size toggle changes both glyph and tooltip. No provider/configuration changes.


### 2026-09-22 - D077

D077 records owner report "the test all passed" after D076 as owner-reported mini-map retest PASS. Broader historical gates are not inferred; browser/device/build metadata and scope clarification pending. Audit confirms bookmark save/restore absent, therefore Phase 2 remains OPEN. Concrete obligations and conditional Phase 3 handoff in PHASE_2_ACCEPTANCE_REVIEW.md and docs/NEXT_CLI_PROMPT.md. No exception or completion approval invented; no runtime change.


#### D077 owner scope clarification

Owner explicitly confirms "yeah all the test even the ones before the map" in response to the question naming earlier provider-failure and real-browser storage/reload/export/import checks. All earlier instructed delivered-function checklists, including owner 15-16, are now owner-reported PASS. Preserve earlier NOT TESTED/BLOCKED/FAIL entries as historical; do not repeat those checks solely for missing tool access. Browser/version/device and exact tested digest remain unspecified. This does not make unimplemented bookmark save/restore tested, supply absent raw provider reports, or explicitly approve E1. Bookmark-specific and later-phase workflows remain NOT TESTED. No runtime changes or new automated execution.
## D078 - Explore camera retention, 2026-09-22

Retain the Explore center, zoom, bearing and pitch in the actions session before
disposing its map. Restore them on remount without an initial inventory fit or
ResizeObserver overwriting them. Explicit location selection still focuses that
pin (D072/D074); Recenter and changed filters still fit their represented records.
This reconciles test 64 with the owner's selected-location return requirement:
an unselected return restores the exact camera; a selected return deliberately
replaces center/zoom while retaining orientation. No provider session is retained.

Read-only sources inspected: LSU3D `js/05-map-helpers.js:145-172` provides
center/zoom/bearing/pitch capture and camera application; Experimental
`js/05-map-helpers.js:9-83` supplies layout refresh/default-view behavior.
Reason 1: SLiVR disposes maps on mode exit, so retain numeric session state through
its existing action owner rather than globals or a surviving map. Avoid reference
rounding, preserve legitimate zeros, reject nonfinite snapshots, and keep the
interactive Immersive mini-map independent. Neither reference supplies persistent
project bookmarks or scouting-assessment records (searched both js trees).

Stable 225 extends 64; 365 full-suite checks PASS, zero failures. Live camera
acceptance remains NOT TESTED: browser discovery returned no surfaces and opening
the local reconnaissance harness failed with `Browser is not available: iab`.
Prior owner-reported passes remain accepted; no phase closure, E1 approval or
provider capability observation is inferred. Current checkout HEAD is
`fd4900a6f14348dd3a574911bfcc500e5e9786a5`, newer than the handoff baseline.
No branch/index operation, reference edit, telemetry, commit or push.
## D079 - approved entry-only bookmarks and E1, 2026-09-22

Owner approved E1 with "Yes, test them when built": keep earlier Phase 1
delivered-action passes; test 44 candidate/comparison actions in Phase 3, shot
actions in Phase 4 and the integrated trace in Phase 5. Phase 1 baseline is
accepted with that bounded allocation; new D078 camera checks remain separate.

Owner then approved: "Yes, finish entry-only bookmarks." Bounded E2 permits
implementation using previously owner-tested location entry links without new
raw pose reports. Exact-angle/position restoration stays unavailable until its
outbound contract and real view restoration are verified. This is not a waiver
of the new bookmark reload/restore/transfer checks before Phase 2 closure, nor
permission for screenshots, pose inference or media export. Dates/coverage/
rights remain unknown. Full-pose reports are deferred only for that unsupported
feature, not represented as passed or unnecessary evidence for future work.

Source comparison: both js trees have no persistent bookmark/project ownership
counterpart (reason 3). Reuse SLiVR's existing bookmark schema, repository,
transaction completion, retry/emergency export, conflict handling and transfer.
For entry restoration retain the SCSU-derived adapter: Experimental
`js/03-tour-bridge.js:20-119`, `js/04-street-view.js:67-155`; compared LSU3D
`js/03-tour-bridge.js:27-128`, `js/04-street-view.js:86-155`. Reason 1 requires
stable IDs, ownership, exact origins/source/payload validation, generation
cancellation, disposal and honest entry-only wording. Restore renews the frame
even for the current capture, so a walked-away view is not mistaken for arrival.
No new provider protocol or unsupported angle conversion is introduced.

`treedis-recon-2/entry-only-1` records the supported bookmark contract.
`captureVersionRef = catalog-{catalogVersion}/{captureId}` identifies the public
record snapshot, never a provider revision/date. New views have empty view and
supportedFields; legacy finite zero values survive transfer but do not enable
restoration. Project/candidate/location/capture ownership and same-version
catalog identity are checked; retired/incompatible records retain notes and
explain why restore is unavailable. No schema/database version bump is needed.

Protect the working bundle during failed saves and stale project reads. Normal
export also retains failed in-memory bookmarks; retry writes the same ID. Import
replacement refreshes the open bundle. UI drafts retain names/notes through
provider redraws. No assessment editor, second database or telemetry.

Stable 226 plus 60-62/208 foundation and Part J: 373 automated checks PASS.
The intermediate race-test harness timing failure is retained in the log;
the corrected deterministic race test passes after generation guarding cached
project reselection. New real-browser bookmark and camera acceptance is pending.
Phase 2 remains OPEN; dependent Phase 3 implementation waits for that acceptance
or an exact separately approved exception. Earlier owner passes are preserved.
## D080 - owner acceptance closes Phase 2, 2026-09-22

Owner answered "All new checks passed" to the exact D079 bookmark/camera
checklist. Carry owner-reported PASS for save/name/note, downtown/Magnolia/Moncus
reload and restore including walked-away same-entry return, export/import and
Explore selected/unselected camera behavior. Phase 2 COMPLETE under E2 entry-only
scope; E1 remains approved. Browser/device/exact tested digest unspecified.
The accepted implementation has 373 automated PASS and D079 runtime digest
9a185ee2013f4196cdeb2e2c55932c26ceb84866f72fe2999e238e1edd287541.
Prior FAIL/BLOCKED history remains; no full-view/provider-media/participant claim.
Proceed to Phase 3 in D068 order. No runtime change is made by this closeout.
## D081 - Phase 3 project and scene editing begins, 2026-09-22

After D080 acceptance, implement the first two D068 work-order steps: project
metadata editing and scene briefs. Keep explicit Save controls for this initial
slice; full workspace autosave (80), candidates, assessments and decisions remain
outstanding. Do not portray the partial Phase 3 workspace as phase-complete.

Inspected both reference js trees for project/scene/assessment/deletion workflows;
neither has persistent counterparts (reason 3). Compared LSU3D
`js/06-details-panel.js:5-40` and Experimental `js/06-details-panel.js:6-43`
for panel visibility/state; inspected LSU3D `js/12-start-screen.js` and reused
SLiVR's existing focus-trap/import-dialog pattern for the deletion review.
Reason 1: retain SLiVR record IDs, project-owned storage, native keyboard forms,
inert dialog background, responsive shell and cancellation/disposal semantics.
No reference edits or new provider/library plumbing.

Projects edit name, production type, description and active/archived status;
identity, creation time and America/Chicago time zone remain stable. Scene briefs
edit required fields and all existing creative/practical lists/counts; blank
counts stay absent, explicit zero stays zero. Reordering writes scene order/
revisions atomically; linked candidates/shot designs prevent scene deletion.
Public catalog is never edited. Forms retain drafts during shell redraw/mode
changes but explicit Save is required before reload/export; unsaved form text
is not presented as persisted. Failed submitted writes retain emergency data.

Project deletion now reviews counts and a record/revision snapshot, requires
confirmation, rechecks that snapshot inside the deletion transaction and updates
memory/navigation only after commit. Failed deletion retains the workspace;
retry completes cleanup, cancel revokes retry. A stale review requires a fresh
review. Stale record writes are reported as failures, not Saved locally.

App 0.3.0, transfer 1.1.0 adds optional scene order; old 1.0 exports read without
rewriting records and use deterministic ordering until reordered. Old readers
explicitly reject the newer export version. IndexedDB remains version 1 because
no store/index changed. Assessment stores/version migrations remain the next
D068 persistence increment. 381 automated PASS; new UI live checks NOT TESTED.

## D082 - candidate workflow and persistent selection, 2026-09-23

Continue Phase 3 after D080 owner acceptance in D068 order. Candidates can be
added from a scene, public dossier or Immersive with an explicitly selected
project/scene. Catalog locations without captures remain valid candidates.
Return actions preserve project/scene/candidate identity; local workspaceContext
metadata restores selection on reload. Public share links remain context-free.

Re-inspected both read-only js trees: no persistent candidate/assessment workflow
counterpart (reason 3). LSU3D js/06-details-panel.js:5-40 and Experimental
js/06-details-panel.js:6-43 supply panel-state context; adapt to SLiVR's existing
shell, accessible native forms and project-owned repository (reason 1). No new
provider plumbing. Read CheckList/v2/app.js:5-165, db.js:13-106 and
export.js:267-340 for the NEXT assessment increment; this inspection does not
claim that its checklist/media editor has been implemented.

One candidate per project/scene/location is enforced in a repository transaction
and transfer validation. Adding the same location returns its existing candidate;
other scenes may consider it independently. Identity and ownership cannot be
changed through editing. New candidates start discovered, with scene requirements
unknown and open questions copied to missing information. Review statuses include
under-review, shortlisted, rejected and withdrawn. Notes/strengths/concerns/missing
information use explicit Save. New preferred/backup decisions remain unavailable
until the assessment/evaluation/comparison steps; imported legacy decisions remain.

Explicit migration: legacy candidates are read unchanged. Selecting a new review
status records workflowVersion 2 and the prior legacyStatus; old met/notMet/unknown
ratings are preserved verbatim, never relabeled as richer fit results. The later
fit/evidence migration remains outstanding. App 0.3.1, transfer 1.2.0; older 1.0/1.1
files remain readable, older readers reject 1.2. Database version stays 1 because
no store/index changed. Submitted failed edits retain memory and emergency JSON;
retry reuses identity. Scene/project deletion clears stale remembered selection.

Tests 44/71/77/81/82/228 cover this increment. It is not full Phase 3 acceptance,
full autosave, an assessment implementation or human-participant evidence.

## D083 - Phase 3 scouting assessments and decisions, 2026-09-23

Implemented the remaining D068 workspace increment. Phase 3 is IMPLEMENTED,
AWAITING LIVE ACCEPTANCE, not COMPLETE. New browser gates cannot inherit D080's
accepted bookmark/camera evidence. E1/E2 and every earlier owner PASS are preserved.

Reference-first: re-inspected LSU3D/js/06-details-panel.js:5-40 and
Experimental/js/06-details-panel.js:6-43 and searched both js trees for persistent
candidate/assessment/comparison/storage counterparts. None exist (reason 3).
Retained SLiVR's existing shell, record IDs, repository and provider adapter.
Adapted CheckList/v2/app.js:5-43 eight-section typed metadata and :66-159 explicit
answer/touched semantics; db.js:13-106 media ownership/Blob references;
panorama-viewer.js:70-247 supplied equirectangular viewer; export.js:267-340 shared
media manifest and data/location.json; index.html's local JSZip loading. JSZip
3.10.1 is copied verbatim to vendor/jszip-3.10.1.min.js with its license header.
Both map references and CheckList remain read-only.

Required deviations (reason 1, D068 architecture): one SLiVR database; explicit
unanswered/observed/needs-validation/not-applicable; private contact/address/person
fields excluded; catalog facts remain read-only; dated room/source assessments;
immutable snapshots; project/location/capture checks; transaction completion;
ordered local autosave/flush; stable UUID media IDs and bounded supplied files.
Do not copy CheckList's parseInt(value)||0 default or implicit untouched negatives.
Panorama module is lazy, has explicit disposal, stale-image guarding, keyboard
look/zoom, WebGL context-loss flat fallback and object-URL revocation. No second
Treedis bridge, provider screenshot/pose claim, capture pipeline or sensor request.

App 0.3.2, transfer 1.3.0, workspace database 2, template 1.0.0. Additive upgrade
creates scoutAssessments/scoutAssessmentRevisions/scoutMedia without rewriting
legacy records. Old 1.0-1.2 project files explicitly gain empty collections.
New requirement evaluations use five fit states; old met/notMet/unknown ratings
remain intact, never silently converted. New judgments and decisions are explicit.
Comparison/detail use the same candidate data. Scene decision history snapshots
candidate judgments and exact evidence revisions; later observations flag changed
evidence. Reopening retains prior decisions. Phase 3 creates linked schematic shot
workspace metadata only; spatial editing remains Phase 4.

Media stores both Blob and a bounded base64 recovery representation, trading some
local storage for synchronous emergency recoverability. Limits: 16 MiB/file,
48 MiB/project; browser image decoding also caps 64 million pixels. Canonical JSON
moves bytes in assetsInline, never provider imagery. Selected assessment/media
exports explicitly report excluded/missing bytes and reject exclusion of required
decision evidence. Copy imports remap assessment/history/media and nested evidence.
Archiving/detaching preserves historical references; owned project deletion removes
all its records. No separate media-delete action can bypass history ownership.

Legacy JSON/ZIP preview requires a chosen catalog location in the selected project;
shows supported answers, excluded field names, ambiguous defaults, legacy status/
stars and missing attachments. Excluded private values are not retained in the
preview plan or imported records. Missing bytes become explicit owned placeholders.
Import is atomic; cancellation/failure leaves stored records unchanged. Native
SLiVR ZIP/print packets stay Phase 5 as planned; legacy ZIP input is implemented.

Final 399 automated PASS, 0 FAIL. Catalog 0 errors/one retained alias warning;
deployment scope clean. Logs, failed interim runs, exact digest and per-gate limits
are in FULL-SYSTEM-TESTING and PHASE_3_ACCEPTANCE_REVIEW. Browser discovery returned
no apps/browsers and iab creation failed. Live gates remain BLOCKED/NOT TESTED;
there is no approved exception for those new gates. No telemetry, staging, commit,
push or changes outside SLiVR.

D083 final review also rejects imported record IDs already owned by another
project before any write/removal; an atomic regression test verifies both projects
remain unchanged on rejection. Final deployment: 178 publishable files, 0 errors.

## D084 - visible save errors and reversible failure testing, 2026-09-23

Owner reports Create gives Save failed and selection-metadata warning (screenshot,
localhost:8000, browser/device version unspecified). This is a new Phase 3 live
FAIL; earlier Phase 2 PASS remains untouched. Owner read slivr:diagnostics and
reported null. An enabled persisted test flag is therefore not established as the
cause. Actual native failure remains UNRESOLVED pending the newly visible error.

Confirmed UI defect: Create navigates after the failed write and applyRoute clears
state.error. Save status retained the error but did not render its message. Always
show the failed-save message independently of transient route errors, and include
native transaction-start cause details. Do not reset data or label an unsaved
project saved. Requested emergency export before refreshing the old page.

Also repaired the previously identified diagnostic gap: wrap project, candidate,
scene, assessment, import/delete/order and selection writes. Read the opt-in flag
per write; expose test mode and a user-triggered off/retry action preserving all
other diagnostics. Disabling test mode retries the same memory record without a
reload. No flags are changed automatically; session bookkeeping remains available
so storage can initialize for failure-path testing.

Reference audit: re-read LSU3D/js/06-details-panel.js:5-40 and Experimental/
js/06-details-panel.js:6-43 and searched both for storage-failure diagnostics.
No persistent-workspace/IndexedDB counterpart exists (reason 3); adapt SLiVR's
existing error/status and local diagnostics under its architecture (reason 1).
Neither reference changed. No telemetry, commit/push or clearing browser data.

App 0.3.3; database/transfer/template unchanged. Automated 401 PASS; two new stable
230 tests reproduce failed Create under simulation and recover the same project,
cover assessment writes/reload, preserve other flags, and show real failures
without claiming simulation. This does not prove the owner's unknown failure is
fixed. Logs/digest outputs/phase3-d084; deployment 178 files, zero errors.

## D085 - open local storage independently of catalog loading (2026-09-23)

Owner reports the exact live error: "the workspace database is not open", with
selection metadata also failing and diagnostics null. Startup exposed an
interactive shell with storage.available inferred from API presence, then waited
for the network catalog before opening the repository. This allowed early Create
to write to an unopened database. The report identifies the missing connection;
the precise network timing in the owner's browser was not independently observed.

Inspected read-only LSU3D js/11-boot.js:286-310 and Experimental
js/11-boot.js:214-237: both start independent provider loading alongside map data.
Neither has an IndexedDB workspace counterpart (per CLAUDE.md). Exception 3
permits SLiVR's storage readiness implementation; architecture requires local
project use independent of remote catalog availability. No reference edits.

App 0.3.4 starts database initialization independently, distinguishes initializing
from available, and makes Create await a single initialization promise before
creating its draft. Genuine storage unavailability retains the existing emergency
export workflow. Direct project routes reopen their bundle after storage loads.
The checklist import panel explains a missing catalog without throwing or blocking
local editing. Session catalog metadata is updated after catalog completion.

Stable 231 deliberately delays database opening and catalog loading, submits Create
before either is ready, verifies saving before catalog completion, and reloads a
direct project URL. 35 targeted and 402 full automated PASS; deployment 178 files,
zero errors. DOM/IndexedDB doubles are not live browser durability evidence.
Logs and explicit runtime manifest: outputs/phase3-d085. Owner live FAIL remains
historical; focused Create/save/reload retest pending. Earlier Phase 2 passes and
approved E1/E2 are unchanged. No telemetry, commit, push or data clearing.

## D086 - unified Explore and embedded V2 presentation (2026-09-23)

Authorization: owner accepted all nine supplied Phase 3 critical checks, requested
V2 visual fidelity and simultaneous scouting, approved unifying Projects/Immersive
under Explore, then explicitly approved the final floating-first plan with "yes".
No permanent right checklist panel. Shot Designer remains unchanged.

Sources inspected read-only: LSU3D js/06-details-panel.js:5-40 and Experimental
js/06-details-panel.js:6-43 (panel visibility, mobile sheets, map resize);
Experimental js/04-street-view.js:9-23 and LSU3D counterpart:12-28 (retain tour
iframe rather than reset it on UI redraw). CheckList/v2/index.html:34-545 supplies
the header, toolbar and eight form sections; style.css is copied byte-for-byte
(SHA256 3b4ec224bc942b998cb8055c4df82e901bcf07d9a977dfd3ebd1b8d394750dcc),
with vendor/fonts and vendor/fontawesome. app.js:243-289 supplies navigation/
progress structure. No reference files modified.

Exceptions 1 and 3: approved architecture now requires nonmodal workspace tools
and SLiVR persistence; neither map reference has these project/assessment windows.
V2's standalone storage, install/service worker, independent status/stars, private
contact fields, capture/sensor controls and future exports are excluded. Its markup
is adapted for the existing typed assessment questions and evidence states; generic
SLiVR evidence/history/media controls remain in expandable details. Partner-logo
rotation is not copied into SLiVR. V2's CSS, Inter and Font Awesome are local and
unchanged; integration CSS is a separate file. A same-origin static iframe isolates
CSS and gives V2 its own responsive viewport, with parent-owned actions and no
independent app script/database. Media uses existing SLiVR ownership and limits.

Implementation: src/ui/tool-windows.js; src/scouting/embedded-checklist.js and v2/;
shell integration and styles/40-workspace.css. Legacy project URLs open tools over
the remembered viewing surface. Menus expose project creation, scene selection/
creation and existing project/candidate/comparison/import/export/deletion controls.
The checklist is pinned to its assessment location; navigation mismatch is visible.
Save failure prevents tool close or assessment/project replacement. Keyboard title
arrows move, Shift+arrows resize. Minimized tabs retain mounted content. Reset layout
changes geometry only. View route, tool preferences and section navigation use
SLiVR-only local keys; active assessment ID joins existing workspace metadata.

Evidence: app0.3.5, DB2, transfer1.3.0, template1.0.0, catalog1.1.0. 407 automated
PASS, zero failures; deployment199/0errors; catalog0errors/one retained alias warning.
New232-234 cover navigation, retained provider frames, ownership and window lifecycle,
failure-close guard, preferences and V2 source/template boundaries. Tests use DOM/
IndexedDB doubles; no browser visual claims. CUA inventory apps=[]/browsers=[].
Actual iframe rendering, pointer resizing, keyboard traversal inside the iframe,
media decoding and visual comparison remain NOT TESTED live. Earlier owner passes
are preserved; new visual acceptance is pending. No telemetry, commit or push.


## D087 ? Responsive workspace collision repair (2026-09-23)

Owner approved implementation after desktop/phone screenshots demonstrated collisions
in D086. Those failures remain historical evidence. App 0.3.6 reserves toolbar,
viewing workspace and minimized desktop tray as separate grid rows. Phone (<=880px)
uses compact project/scene and app menus, View/Locations/Checklist/Project navigation,
and mutually exclusive retained tools. Full editing and half-height view+tool modes
replace desktop drag/resize controls. Browser Back dismisses a newly opened mobile
tool without destroying its draft. Desktop geometry is not overwritten by phone
resizing. The visual viewport sizes the shell during keyboard changes.

Read-only sources inspected before edits: LSU3D/js/06-details-panel.js:5-43 and
Experimental/js/06-details-panel.js:6-43. Adapt their mutually exclusive mobile
panels, half/full states and map-resize notification. Architecture exception 1:
SLiVR retains project/checklist DOM and provider hosts and reserves grid space
instead of translating independent overlays; source layouts cannot provide its
project-owned editor lifecycle. Neither reference was modified. V2 style.css stays
byte-identical; mobile touch sizing belongs in its separate integration.css.

Map controls are available through Map options on phones. Imagery explanation
is expandable; source/year, provider attribution and scale stay visible. Project
context is collapsed above the V2 editor; ownership mismatch remains visible.
No data schema or transfer changes, telemetry, commits or pushes.

Validation: 408 automated PASS; deployment199/0; catalog0 errors/one existing
alias warning. Chrome extension critical checks: phone full/half panels, exclusive
project/checklist tools, narrow view without horizontal overflow, Map options and
Back dismissal; desktop toolbar and minimized tray no longer overlap the map.
Viewport requests390x844,320x720,1440x900; Chrome zoom produced observed CSS
433x937,355x800 and approximately1600x1000 respectively. This is desktop Chrome
responsive evidence, not physical iOS/Android or participant evidence. Initial
screenshot timed out; extension reconnected during checks. Temporary override reset.
Physical keyboard/touch/orientation and live provider interaction with the new
layout remain acceptance gates. Prior owner storage/assessment/Phase2 passes stand.


## D087 responsive workspace repair (2026-09-23)

App0.3.6 addresses owner-reported D086 screenshot collisions. Desktop launchers
and minimized tray occupy separate grid rows outside the map/rail. Phone <=880px
has compact project/scene and app menus, reserved View/Locations/Checklist/Project
navigation, and one retained active tool. Full and half-height modes replace
floating-window controls. Browser Back dismisses a newly opened phone tool;
desktop geometry survives phone use. Visual viewport sizes the keyboard layout.
Map options reveals existing controls; imagery explanations and assessment/project
context are expandable. Ownership mismatch stays visible. V2 source stylesheet
remains byte-identical; phone touch sizing is in separate integration CSS.

Read-only sources inspected: LSU3D/js/06-details-panel.js:5-43 and
Experimental/js/06-details-panel.js:6-43. Adapt mutual exclusion, half/full states
and resize notifications. Architecture exception1: SLiVR reserves grid space and
retains editor/provider DOM instead of independent translated overlays, to meet
its project ownership and lifecycle requirements. References remain unchanged.

Validation:408 automated PASS (outputs/responsive-d087-tests.txt), deployment199/0,
catalog0errors/one retained alias warning. Stable235 adds exclusive-tool/draft/
geometry coverage; existing233/234 remain. Critical Chrome extension checks passed:
phone full/half panels, switching tools, no horizontal overflow, Map options and
Back dismissal; desktop toolbar and tray separate from map controls. Requested
390x844/320x720/1440x900 viewports were zoom-adjusted by Chrome to observed CSS
433x937/355x800/approximately1600x1000. Initial screenshot timeout and temporary
extension disconnection occurred; verification resumed. Viewport override reset.
No project answers edited in Chrome. This is responsive desktop Chrome evidence,
not physical iOS/Android or participant evidence. Physical-phone keyboard/touch,
orientation, provider navigation and complete device matrix remain NOT TESTED.
Earlier owner functional passes and D086 screenshot failures remain unchanged.
No telemetry, staging, commits, pushes, or schema/transfer changes.


## D088 - Checklist follows selected location (2026-09-23)

Owner reported all ten D087 critical checks passed. Preserve that exact scope;
no browser/device metadata supplied. The owner then requested prominent checklist
location identity and automatic following of location selections anywhere.

App0.3.7: route resolution covers map/list/details/immersive/bookmark location
navigation; an explicit candidate-selection request also covers repeated project
candidate selection without a route change. Checklist shows its location name,
project/scene context and assessment date above collapsed metadata. A selector
switches dated assessments; the last used assessment per project/location is
remembered during the current shell session. Otherwise choose the most recent
nonarchived assessment. No assessment is silently created or moved: an empty
location offers Start assessment, with explicit project/scene prerequisites.
Pin checklist to this location opts out; Follow selected location opts back in.
Flush drafts and scouting writes before switching; failed saves retain the old
editor with a retry explanation. Rapid selections converge on the latest target.

Reference inspection: both LSU3D and Experimental js/06-details-panel.js:5-43
retain the shared-selection/panel lifecycle already adapted in SLiVR. Neither
has project-owned assessment following, save guards or date selection (exception3:
no counterpart). SLiVR uses its existing actions and persistence, not a second
store. No schema/transfer changes, telemetry, commits, push or reference edits.

Stable236: automated integration covers location routes, project candidates,
pinning/unpinning, empty-location noncreation, failed-save retention, rapid
selection and remembering one of multiple assessments. Existing232/233 ownership
check now explicitly pins to exercise the retained comparison behavior.409 tests
PASS; deployment199/0; catalog0errors/one existing warning. Logs:
outputs/checklist-follow-full.txt and checklist-follow-targeted.txt. Initial
failed follow tests are retained in checklist-follow-initial.txt; candidate
repeat-selection failure was corrected with an explicit selection request.
Focused live Chrome DOM check confirmed the selected location name and explicit
Start assessment action. Complete new phone/provider follow workflow remains
NOT TESTED, separate from prior owner passes. No project answers edited live.


## D089 Phase 3 closeout

Phase3 COMPLETE for delivered scope, based on preserved owner functional/layout
passes plus final D088 Chrome selection/pin/return/mobile identity checks and
409 automated PASS. Exact evidence, limitations and runtime digest are in
research/PHASE_3_ACCEPTANCE_REVIEW.md. Physical-device generalization and provider
pose claims are not inferred. Phase4 shot actions and Phase5 integrated retest
remain in their approved allocation. Owner authorized SLiVR-only commit/push;
private ignored assets/credentials remain local. No telemetry.
