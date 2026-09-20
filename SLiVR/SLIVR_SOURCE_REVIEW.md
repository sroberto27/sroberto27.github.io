# SLiVR — source and reference review

Reviewed September 17, 2026; location inventory and Treedis research-mode planning updated September 19, 2026. Supporting evidence for [the approved architecture and feature guide](SLIVR_ARCHITECTURE_AND_FEATURES.md).

## Audit scope and limits

The application source was inspected read-only at `E:\sroberto27.github.io\Wrapper\map\LSU3D`. The review traced the runtime JavaScript modules, configuration, HTML, data contracts, major layout/style rules, service worker, and automated checks. Existing documentation was used as context and checked against code; historical planning documents are not proof of implemented behavior.

No original project files were modified. No application was deployed. No live Treedis account, headset, phone field test, or browser rendering test was performed in this audit. Code understanding and passing unit/static checks do not constitute verification of every live integration. The supplied LSU3D source contains no configured Treedis models/sweeps. The separate SLiVR project inventory now supplies Treedis URLs, but they have not yet been tested against a live account/session.

The audit is intended to guide a new application, not to perform unsolicited fixes to LSU3D.

## Runtime inventory

- Static HTML/CSS/JavaScript; no package/build pipeline in this folder.
- `index.html` loads configuration and then 23 numbered scripts, `00` through `22`.
- Fifteen CSS files; numbering omits `06`. Names containing “Leaflet” and `ni-` tokens are historical; the map implementation uses MapLibre.
- MapLibre is loaded from a CDN with a major-version URL. Import map pins Three.js `0.183.0` and `3d-tiles-renderer` `0.5.1`.
- Raster aerial imagery: Louisiana DOTD service; reference overlay: OSM raster; terrain: Terrarium elevation tiles.
- Google photorealistic tiles are configured on in the inspected configuration; some documentation/comments describe a default-off state. Browser keys were not reproduced in planning documents.
- `data/buildings.geojson`: 129 building footprint features. `data/tours.geojson`: 10 tour stops.
- Content uses lowercased display-name joins despite having separate IDs/slugs in parts of the data.
- Local assets referenced in HTML are absent from this folder's inspected file inventory; code includes some image fallbacks. Do not presume those assets can be copied into SLiVR.
- All served static data is public. There is no implemented authenticated production backend or CMS.

## Runtime flow

1. Configuration and data adapter prepare global lookup maps.
2. `02-state.js` creates shared state and the map; later files bind UI and extend behavior.
3. Startup is invoked from `12-start-screen.js`; boot loads geographic/content data, adds map layers and pins, builds lists, and signals readiness.
4. Selection normally funnels through `selectFeature()`, updating feature state, detail content, map focus, tour position, pins and viewer navigation.
5. Later modules wrap earlier global functions to add rail behavior, routing, itinerary, live mode, and kiosk updates.
6. Treedis navigation uses a shared iframe and readiness/pose messages with pending sweep retries.

This central selection seam is useful. The growing chain of wrappers and globals is fragile for an editor with independent projects, scenes, objects and timeline state. Preserve the idea of one authoritative state transition; replace implicit wrapper dependencies with explicit actions and subscriptions in SLiVR.

## File-level migration map

| Source | Actual responsibility | SLiVR implication |
|---|---|---|
| `config.js`, `config.local.js` | Brand, LSU bounds/cameras, imagery, provider setup, feature flags | Introduce region/provider configuration; do not copy credentials or LSU bounds |
| `00-data-adapter.js` | Loads location/sweep JSON into name-keyed config maps; gameday fetch | Replace joins with stable IDs and explicit repositories; optional courses reference is legacy |
| `01-utils.js` | Text/content helpers, profile detection, geometry utilities, sweep access | Reuse carefully; do not let truthy defaults discard valid numeric zero values |
| `02-state.js` | Map creation, DOM references, global selection/tour/layer state | Separate view state from domain records and editor state |
| `03-tour-bridge.js` | Single viewer readiness, messages, navigation, sweep events | Build session/model lifecycle and validate origin/source/payload; expose supported pose only |
| `04-street-view.js` | Iframe overlay, pending navigation/retries, cancel UI, viewer/tour sync | Multiple models and capture-aware context; full selection sync rather than only tour index |
| `05-map-helpers.js` | 2D/3D toggling, terrain/extrusions, reset/presets | Navigation camera must not overwrite authored shot cameras |
| `06-details-panel.js` | Details, media, addresses, sublocations, selection/map focus | Dossier component with verified facts and private project overlays |
| `07-layer-builders.js` | GeoJSON prep, generic extrusions, tour ordering, colocated pins | Exterior context only; scalable spatial filtering and stable source+feature identities |
| `08-tourbar.js` | Fixed tour progress, controls and rail | Reusable visit navigation presentation, not the itinerary domain |
| `09-sidebar-search.js` | Name/department search, lists, category chips, mobile sheets | Film-specific multi-field filtering; synchronize actual map features and list |
| `10-event-wiring.js` | Map/control handlers and global keyboard behavior | Mode-aware shortcuts that respect editors, forms and dialogs |
| `11-boot.js` | Fetch/load pipeline, map setup, image warmup and startup | Lazy media, nonblocking map/catalog, per-provider failures |
| `12-start-screen.js` | Welcome, coachmarks, preferences, navigation instructions, starts boot | Task-focused onboarding and SLiVR-namespaced preferences |
| `13-learn-mode.js` | Switches to a coming-soon shell | Not an existing educational module or workspace implementation |
| `14-redesign.js` | Rail/tour overlays, straight route line, share wiring, mini-map | Useful layout patterns; replace wrappers and fixed-tour “add” semantics |
| `15-core-services.js` | Readiness queue, memory analytics, storage, distances/bearings | Retain narrow services; straight-line walking estimate is not verified routing |
| `16-google-tiles.js` | Dynamic library loading, ECEF-to-local transform, custom shared WebGL layer, LOD camera, attribution, activation generations/fallback | Useful spatial/rendering precedent; not a general film-camera editor |
| `17-router.js` | Query parsing, stable stop slugs, history, sharing | Extend route model for locations/workspaces; authorization independent of URL |
| `18-gameday.js` | Times/contacts/progress layered onto existing ordered stops | Editable project itinerary requires a new independent order and completion model |
| `19-geolocation.js` | Requested location, accuracy ring, live watch lifecycle, straight-line distances | Useful privacy/accuracy pattern; replace campus restriction with regional/entrance logic |
| `20-live-visit.js` | Mobile current/next visit UI | Field scouting shell with notes/tasks and explicit visits |
| `21-kiosk.js` | Timed autoplay, idle reset, presentation chrome | Optional public showcase; not a security boundary |
| `22-service-worker.js`, `sw.js` | Optional shell cache and unregister controls | Scope/cache isolation must be redesigned before copying |
| `scripts/validate-data.mjs` | Read-only validation of current JSON contracts | Add SLiVR schemas, referential integrity, coordinate/provenance checks |
| `scripts/tests/*.mjs` | VM/stub and static checks for select modules | Reuse testing approach where meaningful; add browser/editor/data-access coverage |

## Constraints and findings that affect the new design

### Spatial fidelity

Building footprints are extruded using generic heights, not room geometry or measured production dimensions. The Google renderer provides textured geographic context, but its two internal cameras serve rendering/level-of-detail purposes rather than authored film-camera controls. Its map camera math accesses MapLibre transform details; verify compatibility when upgrading dependencies.

The Google layer keeps resources alive across mode changes, has activation-generation protection, and restores simplified fallback on failures. These lifecycle concepts are worth retaining. Its fixed 3D entry camera and continued render loop should be revisited for scene preservation, battery use and multiple viewports.

### Immersive integration

All inspected Treedis model URLs and sweep assignments are blank. The current bridge can accept messages without an origin restriction when configuration is empty and does not verify the sending window. It posts with a wildcard destination. It is designed around one long-lived iframe; it lacks the model-switching lifecycle required for a regional catalog.

It primarily uses sweep identity for application synchronization rather than a calibrated position/heading. The mini-map reflects a selected location, not a verified live viewer position. No code establishes arbitrary actor insertion, lens preview, depth measurement or accurate interior world coordinates.

### Data and workflow

Location names are used as join keys; renames can break content/sweep relationships. Some feature matching relies on numeric IDs without a fully qualified source identity. New project records should reference independent stable IDs.

Category controls primarily filter list rows. Coincident tour pins are grouped by identical rounded centers, which is not general geographic clustering. Gameday stop order comes from the fixed tour and not the itinerary file; opening a stop can mark it visited. These behaviors need replacement for real scouting decisions and visits.

The drawn tour line connects stop centers; travel estimates use straight-line distance. Neither verifies legal/accessible vehicle or pedestrian routes. Location dossiers should distinguish footprints, public entrances, loading entrances and logistics destinations.

### Layout, loading and state

The desktop rail layers list/tour/detail panels; mobile behavior changes at 880px. Source styles contain overlapping legacy and newer chrome rules and global mode classes. Adopt the responsive principles, not every selector or stacking rule. New inspector/timeline layouts need deliberate panel and focus management.

Boot warms all location images and attempts a home tour; city-scale browsing needs selective loading. Global arrow/space/Escape behavior from tour, onboarding and kiosk modules can conflict with text entry and shot editing. A dedicated input/action scope is necessary.

### Hosting and storage isolation

The service worker is disabled by configuration. Its enabled cache strategy intentionally excludes third-party map/immersive resources; it is an offline shell/content mechanism, not complete offline mapping.

The disabled registration path enumerates and unregisters all accessible service-worker registrations on the origin. A new sibling application must not inherit this broad operation. Limit registration and cache management to SLiVR's exact scope/name; verify both apps remain isolated. Existing `lsu3d`/`lsu:` storage keys also need replacement.

The current static-data privacy model is incompatible with confidential production plans or owner contacts unless backed by actual access control. Avoid deploying the reference `docs` directory as public static content.

### Documentation discrepancies

Some source documentation describes fewer modules, missing tests or absent features that now exist. The code contains footprints, routing, kiosk/live modules and tests; configured Google tiles differ from default-off comments. Conversely, a UI label or future plan is not proof of a functioning CMS, collaboration, learning mode or Treedis tour. Inspect implementation and data before deriving new requirements.

LSU-specific CMS deferral instructions belong to that project's earlier workflow; they do not automatically prohibit choosing a private workspace backend for SLiVR. Nothing in this audit changes the source project's instructions or files.

## Verification performed

Executed the existing read-only checks:

```text
node scripts/run-tests.mjs
coachmark:       12 passed
core-services:   35 passed
modules:         76 passed
router:          47 passed
service-worker:  25 passed
Total:         195 passed, 0 failed across 5 suites

node scripts/validate-data.mjs
0 errors, 0 warnings
```

These are baseline code/data checks. They do not test real provider entitlements, device performance, correct Lafayette assets, authoring behavior, or live backend authorization.

## Reference material review

### Paper — complete supplied body reviewed

[Elsevier_2026_VR_based_Location_Scouting.docx](docs/Elsevier_2026_VR_based_Location_Scouting.docx): *VRScout360: A Formative Mixed-Methods Evaluation of Virtual Reality for Film Location Scouting*. Reviewed body text, tables, findings, guidelines, limitations, interview material and references.

The study combines a manually modeled downtown exterior and captured environments with photographic 360 interiors in a Unity/Quest workflow. It involved 35 participants, largely students, with five film professionals; professional interviews and open responses inform the qualitative themes. It is formative, with no non-VR comparison establishing causal superiority.

| Finding | Design consequence | Proposed features |
|---|---|---|
| T1: preliminary filtering and shared revisits | Save evidence and remaining physical checks | F04–F06, F16 |
| T2: search and practical feasibility | Brief-driven search and early logistics summaries | F01, F02, F05, F15 |
| T3: realistic detail and current conditions | Photographic evidence, capture dates and zoom/detail quality | F02, F03, F19 |
| T4: meaningful coverage and orientation | Room/entry labels, coverage gaps, calibrated context | F03, F12, F19 |
| T5: low-friction notes and text entry | Desktop/mobile notes, optional editable dictation | F04, F20 |
| T6: collaboration and sustainable upkeep | Review workspaces, role permissions, capture maintenance | F18, F19 |

Do not equate spatial recall against a chance baseline with proven savings or better scouting than a conventional method. Do not assume the paper's Unity application or original model assets are present in LSU3D.

### Book — all supplied PDF pages processed, scan incomplete

[locationScoutingBookOCR_compressed.pdf](docs/locationScoutingBookOCR_compressed.pdf): Kathy M. McCurdy, *Shoot on Location: The Logistics of Filming on Location, Whatever Your Budget or Experience* (2011).

The 92-page PDF contains photographed spreads, beginning around the introduction/printed page 1 and ending at the start of the index around printed page 207. PDF page 7 shows chapter 2's title at printed page 13; PDF page 8 jumps to chapter 3 at printed page 39. Printed pages 14–38 are absent. Earlier front matter and the complete index are not present. Some OCR, especially parts of left-hand pages, is poor. All supplied page text was read; not every damaged character can be reconstructed reliably. Page images 7, 8, 44 and 60 were additionally inspected to verify the gap and representative diagrams/checklists.

PDF locators below are one-based and refer to this supplied file, not another edition:

| PDF pages | Workflow insight | Product consequence |
|---|---|---|
| 1–7 | Location character and effects on surrounding people | Creative descriptors and neighborhood-impact records |
| 8–18 | Script breakdown and story-location requirements | Scene briefs, story vs physical location distinction, requirements aggregation |
| 18–30 | Preparation, research, budget, authority and early access | Evidence-based shortlist, contact roles, realistic ancillary costs |
| 30–37 | Comprehensive photography and presentation | Reverse/detail/access views with organized metadata, review packets |
| 38–49 | Finding/approaching sites, checklists, backup choices | Practical dossiers, explicit unknowns, alternate/cover relationships |
| 43–45 | Location checklist, including access/utilities/noise/logistics | Stage-specific fact records; avoid a single overwhelming mandatory form |
| 50–64 | Agreements, prep, parking/basecamp, neighbors, technical scouts | Separate time windows, document tracking, logistics layers and tasks |
| 60 | Parking/posting diagram | Dated proposal maps with street context, vehicle/camera positions and status |
| 62–64 | Departmental technical scouting | Shared itinerary, questions, assignments and follow-up evidence |
| 65–78 | Shoot-day readiness, communication, changes and wrap | Mobile records, restricted handoff information, restoration evidence |
| 78–84 | Film commission resources | Distinguish liaison resources from actual authority/approval |
| 84–92 | Student filming and responsible working practices | Accessible templates and scalable workflows, without embedding historical rules |

The software proposal uses original summaries and requirements. Do not reproduce the book, sample agreements or extended checklist wording in product content. Current permit processes, incentives and insurance requirements would need separate authoritative verification if implemented.

### User's Shot Designer image

[Example of shot designer.png](docs/Example%20of%20shot%20designer.png) was inspected visually. It shows an oblique downtown aerial reference with two color-coded cameras, shot descriptions, numbered marks, actor indicators, movement paths and directional arrows. It supports the proposed downtown acceptance workflow.

The image supplies no verified spatial calibration, editable scene graph or trustworthy optical parameters. It does not establish that a Shot Designer file importer is available or needed. Any reconstruction should use user-supplied geometry/control information or clearly labelled schematic placement.

### Official web references

Reviewed September 17–19, 2026. Official website descriptions establish advertised/documented capabilities, not account-specific availability or a hands-on validation.

- [Shot Designer product page](https://www.hollywoodcamerawork.com/shot-designer.html) and [tutorial descriptions](https://www.hollywoodcamerawork.com/shot-designer-videos.html): feature inventory and released-versus-roadmap distinction summarized in the main guide. Full video playback and installed app behavior were not tested.
- [Treedis viewer integration](https://docs.treedis.com/sdk/web/integration-guide): documented message interface; basis for a bounded adapter and capability experiment.
- [Treedis REST overview](https://docs.treedis.com/api/getting-started/overview): administrative API context; do not conflate administration with viewer scene authoring.
- [LITE address](https://lite.louisiana.edu/contact) and [university energy facility locations](https://energy.louisiana.edu/about-us/contact-us/facility-locations): geographic clarification for the proposed corridor and solar-lab destination.
- [Louisiana DOTD remote-sensing MapServer](https://maps.dotd.la.gov/imagery/rest/services/Imagery/Louisiana_Remote_Sensing_Map/MapServer), [2025 Various 6-Inch ImageServer](https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer), and [2024 Lafayette 6-Inch ImageServer](https://maps.dotd.la.gov/imagery/rest/services/Imagery/2024_Lafayette_6IN_RGBI/ImageServer): evaluated for the 2D aerial basemap. Representative requests at downtown, Givens House, former Truman, Moncus Park, LITE and UL Main Campus returned imagery from the 2025 and 2024 Lafayette services. The user-proposed 2026 layer 187 returned no-data images at those points and should not be the Lafayette primary layer. DOTD identifies the imagery as free to use with attribution/disclaimer language and warns against authoritative high-precision use.

### Lafayette location and Treedis inventory — all supplied records processed

[Current treedis experinece sweeps building starts.txt](docs/Current%20treedis%20experinece%20sweeps%20building%20starts.txt) contains 11 current Treedis entry links and six named future scan candidates. The links were parsed into experience ID, sweep ID and starting X/Y view values. They were not opened in a live authenticated Treedis session, so availability, capture date, coverage, current condition and reuse rights remain unverified.

The current capture structure is:

- Experience `5eb11a1b`: Carpe Diem Cafe & Wine Bar, Pop's Poboys, Lafayette Old City Hall, Spoonbill, Rock'n'Bowl and Borden's Ice Cream Shoppe. These remain six physical location records even though they share a model.
- Separate experiences: Play N Trade (`62704853`), Givens House (`6af20e40`), Magnolia Pantry (`a872109b`), the former Truman Early Childhood Education Center (`a21e99a0`) and Moncus Park (`4c37c871`).
- Future candidates with no supplied model/sweep: CAJUNDOME, Cajun Field, LITE Center, UL Lafayette Main Campus, Blackham Coliseum and UL Lafayette Rec Sports / Bourgeois Hall.

The records form six useful map areas: Downtown Core; Sterling Grove / North Sterling; Johnston Street / Moncus / Blackham; Northside / Clara Street; Cajundome / South Campus; and UL Main Campus. Planning coordinates span approximately latitude 30.2056–30.2486 and longitude -92.0430–-92.0104. Most coordinates came from OpenStreetMap Nominatim and must be checked at the intended entrance; the Old City Hall coordinate came from the Library of Congress HABS record.

The [SLiVR Location Scouting Database](outputs/location_database/SLiVR_Location_Scouting_Database.xlsx) preserves the 17 records, exact Treedis URLs, source IDs, public-facing facts and production questions. Its six sheets cover locations, map areas, scout details, capture inventory, sources and a workflow field guide. The workbook uses `Need validation` when a reported or incomplete fact requires authoritative/current confirmation and `Information has not been found` when research did not locate the value.

Public facts were checked primarily against venue, university, park, city, state and Library of Congress pages. Secondary sources were retained only when useful facts such as Play N Trade or Magnolia Pantry hours were not available on an accessible owner-controlled page, and those rows are marked for validation. The research does not establish filming permission, ownership title, production availability or a rate agreement.

Regulatory research found that Louisiana does not require a state filming permit, while property approval and local requirements can still apply. Lafayette Consolidated Government publishes planning/permitting contacts, a special-event application and a sound-variance process that requires property-owner permission. These are screening inputs rather than a determination that a particular production requires or has obtained a permit. Sources: [Louisiana Entertainment film resources](https://www.louisianaentertainment.gov/film/resources), [LCG Planning and Development](https://www.lafayettela.gov/business-development/planning-and-development/), [LCG special-event application](https://www.lafayettela.gov/media/gvbama12/special-event-application.pdf), and [LCG sound-variance process](https://www.lafayettela.gov/media/gizncka1/sound-variance-application-and-cover-letter.pdf).

## Planning decisions and Phase 0 validation backlog

The approved architecture now settles the product choices that were open during this audit: a public read-only catalog; local IndexedDB project data with versioned JSON transfer; no first-prototype accounts/backend/collaboration; the 17-location, six-area Lafayette scope; desktop-first and tablet-supported authoring; separate lens-coverage boundaries and movement paths; the five required product families; and the solar-energy destination as later expansion. See [SLIVR_ARCHITECTURE_AND_FEATURES.md](SLIVR_ARCHITECTURE_AND_FEATURES.md) for the controlling decisions and phase gates.

Phase 0 must still validate external facts and assets rather than treating them as product-scope questions: live Treedis access and supported navigation for the 11 supplied entries; capture dates, rights and coverage; property/filming authority for workbook records marked for validation; and the scale, provenance and rights of any floor-plan or model files used for calibrated work. Failed validation must produce an explicit capability limit, fallback or later task. It is not a reason to alter the LSU source or silently broaden the approved prototype.

## Post-prototype Treedis research-mode reference

The 2,401-line `docs/TreedisResearch mode information.txt` was reviewed in full. It contains an earlier SCSU-oriented design and generated prototype material for a Cloudflare Worker/R2 reverse proxy, injected passive WebXR probe, NDJSON collector/concatenation workflow, consent/configuration gate, and a later conditional object-manipulation concept. Useful principles include default-off operation, explicit consent, one injected bundle, unchanged call forwarding, fail-silent collection, a performance kill switch, immutable batches, shared event timelines and a separate manipulation gate.

The material is not evidence that the approach works with SLiVR or current Treedis. It assumes different filenames, models, runtime structure and deployment context; proposes changing upstream security/framing headers; relies on undocumented runtime discovery for manipulation; and does not by itself establish provider authorization, ingestion security, anonymity, acceptable overhead or current Quest/browser compatibility. The approved post-prototype Phase 6 therefore treats it as design input, adds authorization/security/privacy/reproducibility gates and requires passive capture before independently approved manipulation. See [Treedis Research Mode Plan](research/TREEDIS_RESEARCH_MODE_PLAN.md).
