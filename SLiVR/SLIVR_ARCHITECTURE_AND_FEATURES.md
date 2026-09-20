# SLiVR — Lafayette location scouting and shot planning

Version: 0.19 — approved implementation-planning guide with living full-system verification, September 19, 2026.

Status: Approved implementation-planning guide. It defines the first-prototype scope, architecture, operating boundaries, phases and exit gates. It is not itself an instruction to modify either project; implementation begins only after the user approves the plan produced in Claude CLI plan mode.

## 1. Purpose and boundaries

Build a map-centered location scouting website for Lafayette, Louisiana, using the useful foundations of the LSU3D campus recruitment map. Connect discovery, immersive inspection, production requirements, shot blocking, and technical scouting in one workflow.

The existing project at `E:\sroberto27.github.io\Wrapper\map\LSU3D` is a **read-only reference**. All future development belongs in `E:\sroberto27.github.io\SLiVR`. Do not rename, edit, clean, reformat, migrate, or deploy over the original project. Preserve existing reference files in `SLiVR/docs`.

The primary outcome is a defensible scouting decision: why a place fits a scene, what has been observed, what remains unknown, how a proposed shot could work, and what must be checked on site. Attractive imagery alone is insufficient.

Approved product separation:

- **Location library:** reusable, curated facts and approved media about places.
- **Local production workspace:** project-specific requirements, candidate decisions, notes and shot designs stored in the current browser and transferred through explicit JSON export/import.
- **Presentation/export:** deliberately selected, non-sensitive material included in diagrams, CSV files or printable scouting packets.

Do not assume a public location listing grants filming permission. Do not treat a virtual inspection as a completed physical or technical scout. Do not expose the reference book, unpublished research, private plans, or owner information in the deployed website.

## 2. Confirmed geography, inventory and pilot

The initial map is a Lafayette city-center scouting region rather than a single campus map. It must cover six operational areas derived from the supplied Treedis inventory and future scan list:

| Area | Current Treedis locations | Future scan candidates | Current experience structure | Product implication |
|---|---:|---:|---|---|
| Downtown Core | 7 | 0 | Six locations share experience `5eb11a1b`; Magnolia Pantry uses `a872109b` | Primary launch and acceptance area; the UI must represent several location entry points inside one experience and switch cleanly to a nearby separate model |
| Sterling Grove / North Sterling | 1 | 0 | Givens House uses `6af20e40` | Historic residential/hospitality context; address and present authority still need validation |
| Johnston Street / Moncus / Blackham | 2 | 1 | Play N Trade uses `62704853`; Moncus Park uses `4c37c871`; Blackham is unscanned | Separate properties along a corridor, with distinct permissions and logistics |
| Northside / Clara Street | 1 | 0 | Former Truman site uses `a21e99a0` | Current occupancy, custodian, safe access and capture freshness must be resolved before production use |
| Cajundome / South Campus | 0 | 4 | CAJUNDOME, Cajun Field, LITE Center and Rec Sports are future candidates | Largest planned capture campaign; requires a hierarchy of complex, facility, entrance, interior zone and sweep |
| UL Main Campus | 0 | 1 aggregate record | No current experience | The campus must be decomposed into named buildings, quads, streets, entrances and controllable zones before scanning |

This produces **17 catalog records: 11 with current Treedis entry links and six future candidates**. The 11 current records use six distinct Treedis experience IDs. Exact model coverage, capture dates, access rights and current physical condition have not been verified. The links are project inventory, not proof that every relevant room or exterior is captured.

The working location register is [SLiVR Location Scouting Database](outputs/location_database/SLiVR_Location_Scouting_Database.xlsx). It contains stable provisional IDs, addresses, planning-level coordinates, public hours, operators, ownership/authority status, access contacts, practical scout questions, exact Treedis link components and a source register. Until these records move into versioned application data, treat this workbook as the review source of truth. Use the exact phrases `Need validation` and `Information has not been found`; do not silently convert either into a favorable assumption.

The current points span approximately latitude 30.2056–30.2486 and longitude -92.0430–-92.0104. A provisional padded map envelope of about 30.200–30.255 latitude and -92.050–-92.005 longitude will contain the working inventory. This is a configuration starting point, not a legal boundary, property boundary, or claim of Treedis coverage. Store the region, operational areas and per-location geometry in data rather than scattering coordinates through JavaScript.

Phase 1 should expose all 17 records so missing capture status is part of the real workflow. The immersive acceptance track should use the six-location shared downtown experience, Magnolia Pantry as the nearby independent model, and at least one non-downtown model. A separate shot-planning acceptance track should use the downtown reference image and owned or clearly approximate geometry.

The UL solar farm / Louisiana Solar Energy Lab is a requested expansion idea but is not listed in the current Treedis/future-candidate file. Keep it outside the committed 17-location inventory until its exact site, approval path and capture priority are added. Official university pages place the Louisiana Solar Energy Lab at 439 Eraste Landry Road, so it should be modeled as a separate destination rather than assumed to be on Cajundome Boulevard. Sources: [LITE contact](https://lite.louisiana.edu/contact), [Energy Institute facility locations](https://energy.louisiana.edu/about-us/contact-us/facility-locations).

A location with unknown access or missing immersive coverage may still appear, but its limitations must be visible. Do not fabricate tours, measurements, availability, property ownership, or sample contacts.

## 3. What the source project contributes

The source is a static, no-build MapLibre application with 23 ordered JavaScript files, 15 CSS files, JSON/GeoJSON content, and an optional service worker. Three.js and a 3D tiles renderer provide Google photorealistic context. It is not already a 3D authoring system.

| Source capability | Proposed reuse | Necessary change |
|---|---|---|
| Map, aerial imagery, terrain, footprints, selection | Geographic browsing foundation | Lafayette region configuration, stable location IDs, real entrance points and film categories |
| Details panel, search, category chips, mobile sheets | Location discovery UI patterns | Rich dossiers, map/list-consistent filters, comparison and project actions |
| Treedis bridge and immersive overlay | Integration starting point | Multiple models, explicit lifecycle, validated messages, capture metadata and calibrated orientation |
| Google 3D custom layer and fallback | Optional exterior context | Independent authored shot layer; retain authored camera state; verify provider capabilities |
| Tour navigation and gameday overlay | Visit navigation concepts | Arbitrary editable itineraries, independent order, date/time windows and explicit visit completion |
| Deep links and browser history | Location/workspace entry points | IDs for locations, scenes, shots and bookmarks; authorization where private |
| Geolocation and live mode | Field scouting patterns | Region-wide entrances, explicit accuracy, useful notes/photos, no automatic claim of a completed scout |
| Kiosk | Later public/review presentation mode | Curated publishable content, separate from private workspace |
| Core services and tests | Readiness, storage and verification patterns | Modules, repositories, explicit events, meaningful editor and privacy tests |

Important source realities: 129 footprint features and 10 tour stops exist; Treedis model URLs and sweep assignments are empty. The current “Learn” area is a placeholder. The source's itinerary overlays times on a fixed tour; its route line is not a road-routing engine. Its global function-wrapping pattern should not become the architecture for the new editor. See [source review](SLIVR_SOURCE_REVIEW.md) for file-level detail and audit limits.

## 4. Evidence translated into product requirements

### Research paper

The supplied *VRScout360* paper supports a formative design direction: early filtering, realistic photographic detail, clear coverage/orientation, easy contextual notes, collaboration, and stage-appropriate logistics. It does not establish that this website will save a particular amount of money or outperform every conventional scouting method.

Product implications:

- Search and practical feasibility should be available before entering an immersive experience.
- Capture dates, inaccessible spaces, incomplete coverage, and uncertain measurements must remain visible.
- Desktop/mobile text entry and freeform notes are essential. Dictation should be optional, editable, and tested; headset text entry must not be the only path.
- A scout should revisit a specific view and discuss it with others without recreating the navigation journey.
- Virtual observations, reported facts, and on-site verification need different labels.

Reference: [supplied paper](docs/Elsevier_2026_VR_based_Location_Scouting.docx), findings/themes T1–T6 and design guidelines G1–G6.

### Scouting workflow reference

McCurdy's *Shoot on Location* emphasizes script requirements, creative and practical fit, ownership/access, comprehensive visual records, alternate locations, technical scouts, logistics, public impact, and restoration. This proposal converts those concerns into original software workflows rather than reproducing the book's forms. Historical prices, incentives, sample contracts, and jurisdiction-specific rules are not current application defaults.

All 92 pages in the supplied PDF were processed. The supplied scan is incomplete: printed pages 14–38, containing the body of chapter 2, are missing; OCR is degraded in places. The book therefore cannot be described as reviewed in its complete published form. Relevant checklist and parking-map pages were also inspected visually. See [reference review](SLIVR_SOURCE_REVIEW.md#reference-material-review).

### Shot Designer reference

The official product page describes connected diagrams, shot lists, storyboards, a viewfinder, blocking animation, set/light symbols, templates, snapshots, exports, and sharing. Its real-time 3D layer and deeper script/voice integration are listed as roadmap items, not confirmed released capabilities. Source: [Shot Designer](https://www.hollywoodcamerawork.com/shot-designer.html).

The tutorial descriptions add camera marks, tracking/snapping, movement timing, shot variants and metadata, background drawings, and scene organization. The research reviewed these descriptions, not every video's playback or an installed copy of the application. Source: [official tutorials](https://www.hollywoodcamerawork.com/shot-designer-videos.html).

SLiVR should develop its own interaction design and scene format. Compatibility with proprietary Shot Designer files is not assumed. The supplied Lafayette image is a workflow reference, not a measured or georeferenced asset.

## 5. Approved feature catalog

Each feature below states the intended workflow and a completion condition. Phase numbers refer to section 9. Required and later scope are approved planning requirements, not claims about existing code.

### 5.1 Feature decision register

Decisions confirmed during review on September 19, 2026. The user approved the five essential families as the complete first-prototype product scope. Ten product families remain in the later roadmap, and Treedis Research Mode is an additional approved post-prototype research phase.

| Feature family | Decision | Required first-release scope | Related detailed features |
|---|---|---|---|
| Location Atlas | **Required** | Browse, search and filter all 17 Lafayette records from a synchronized map and list, including explicit current-capture and future-candidate states | F01 |
| Location Dossiers | **Required** | Show identity, visual character, Treedis coverage, evidence sources, hours, contacts, access status, practical logistics and visible validation gaps | F02 |
| Immersive Scout | **Required** | Enter the correct supplied Treedis sweep, navigate shared and independent experiences, retain location context, save a basic view/bookmark and recover from unavailable captures | F03 and the basic bookmark portion of F04 |
| Project Workspace | **Required** | Create a production/project, define scene requirements, add and compare candidates, retain evidence and decisions, and connect selected locations to shot planning | F05, F06 and the project foundation described in section 6.5 |
| Shot Designer Core | **Required** | Place and edit cameras, actors, marks, annotations and paths; adjust camera/lens framing; save variants; maintain a shot list; and export readable shot diagrams and shot-list material | F08–F12 core scope |
| Scout Visit Planner | **Later** | Add scheduled scout stops, entrance instructions, contacts, travel windows, assignments and visit questions after the first usable release | F07 |
| Production Logistics Map | **Later** | Add project-specific parking, basecamp, loading, staging, access-control and emergency-route overlays in a later release | F14 |
| Permissions, Availability and Costs | **Later** | Add structured holds, agreements, permits, insurance, restrictions, fees, quotes and actual costs after the core scouting and shot-design workflow | F15 |
| Technical Scout and Handoff | **Later** | Add department checklists, measurements, sign-offs, unresolved-item tracking and formal technical-scout packets in a later release | F16 |
| Field and Mobile Tools | **Later** | Defer the dedicated phone/tablet field workflow, geolocation capture, photos, voice notes, offline drafts and synchronization tools | F20 expanded field scope |
| Advanced Shot Design | **Later** | Add timed keyframes, advanced constraints, reusable rigs/groups, sophisticated optical controls, calibrated plan/model workflows and richer animation after the core editor is proven | F10 and F12 advanced scope; F13/F18 integrations where applicable |
| Light, Sun and Weather Tools | **Later** | Add sun direction, shadows, weather history/forecast evidence, seasonal comparison and environmental visualization in a later release | F13 |
| Collaboration and Review | **Later** | Add comments, assignments, approval states, review links, version comparisons and concurrent editing after single-user persistence is reliable | F18 |
| Capture Library Management | **Later** | Add upload, rights administration, capture replacement, coverage curation and a full media-management interface later; first-release dossiers still read required capture metadata | F19 management scope |
| Wrap and Location Stewardship | **Later** | Add condition reports, restoration, damage tracking, final costs and reusable post-production lessons in a later release | F17 |
| Treedis Research Mode | **Post-prototype Phase 6** | Add an authorized, consented, dormant-by-default proxy/probe/collector and analysis path for passive WebXR interaction research, with separately gated experimental manipulation | F21 |

`Required` means part of the first usable release and its acceptance workflow. Advanced collaboration, complex animation, high-precision calibrated models and expanded production administration remain governed by their later phase assignments unless separately promoted during review.

`Later` means the architecture must leave a clean extension path but the first usable release does not need the complete workflow or acceptance tests. Basic responsive layout, keyboard access, readable contrast and reliable save/error states remain baseline quality requirements for the required features; they do not imply delivery of the deferred mobile field toolkit.

**Approved first-prototype boundary:** implement Location Atlas, Location Dossiers, Immersive Scout with basic bookmarks, Project Workspace, and Shot Designer Core. Include only the data, persistence, error handling, accessibility and export foundations needed to make that end-to-end workflow reliable. Do not expand the prototype into the ten deferred product families or Phase 6 research service unless this decision register is explicitly revised.

### F01 — Location Atlas · Phase 1

Search by place, district, architectural character, period appearance, interior/exterior, scene type, capture availability, and practical requirements. Keep map markers, result counts, and list filters consistent. Support saved filter sets later without making search dependent on a project.

Use meaningful film descriptors: plaza, alley, office, laboratory, arena, residence, industrial exterior, and similar configurable tags. Keep subjective appearance tags separate from measured or verified facts. Provide list access when a map or WebGL view fails.

Seed the atlas from the 17 records in the working location database. Distinguish `Current Treedis` from `Future candidate` in markers, filters and dossiers. A shared Treedis experience does not merge its six downtown locations into one catalog record; each keeps its own address, entry sweep, authority questions and production history.

**Done when:** a scout can find, filter, open, and share a Lafayette location from either the map or the list, including a location with no immersive capture.

### F02 — Location Dossier · Phase 1 core, Phase 7 field/operations expansion

Describe a physical site and its usable spaces. Include reference photos, look/period tags, geometry provenance, dimensions where known, entrances, floors, surrounding context, capture dates, and current access inquiry status. Show practical summaries early: parking, loading, power, toilets, holding, noise, operating hours, restrictions, and accessibility.

Record evidence per important fact: value and unit, source, observation date, observer, verification method, confidence/status, and attachments. Use `Need validation` and `Information has not been found` for the imported research state, then more precise operational states such as `reported`, `observed remotely`, and `verified on site` as evidence is added. An empty field must not become “no restriction” or “available.” Maintain separate public and restricted fields.

**Done when:** a reviewer can distinguish a photographic observation from a confirmed practical fact and identify what still needs checking.

#### Approved first-prototype Atlas and Dossier boundary

Explore opens on the approved Lafayette envelope with the 2025 DOTD six-inch aerial source, configured 2024 Lafayette fallback, optional street/label overlay, optional Google 3D and markers for all 17 catalog records. Map and list share one selection state; zoomed-out markers may cluster. Current Treedis records and future candidates use distinct marker treatments, while research completeness appears as a separate validation indicator. The active-project candidate state appears as an additional badge rather than replacing capture/evidence status.

Search covers name, address, area, venue type and visual/practical tags. Filters cover operational area, current/future capture, interior/exterior, venue type, historic/contemporary character, known public hours, immersive coverage, access status, validation status and dossier completeness. Initial sorts are name, area, capture availability and recently viewed. Optional user-position distance is straight-line distance and is never labelled travel time.

A dossier contains overview, visual/spatial character, immersive coverage, production considerations, access information, evidence/source details and project actions. It exposes the workbook-derived practical fields while preserving `Need validation` and `Information has not been found`. Actions add/compare a candidate, open an existing candidate, enter Treedis, create/open a shot design and copy a public location link.

The catalog is read-only in the first prototype and loads from versioned application data. Project notes never overwrite catalog facts. Public hours do not imply production availability; operator does not imply property owner; capture does not imply filming permission; approximate coordinates are labelled; and future candidates never receive fabricated tours. Only public contact data enters the public build.

Provider or WebGL failure retains a usable location list and dossier. Missing imagery uses a neutral background; absent/failed Treedis presents future/unavailable state plus recovery; no-result search suggests clearing filters; missing facts use the approved evidence language.

### F03 — Immersive Scout · Phase 2

Enter the correct exterior or interior Treedis experience from a location or space. Offer clear entry points, room/floor labels, a coverage list, capture date, return-to-map navigation, and device-appropriate help. Let users browse known captures without implying unrecorded spaces are accessible.

Support multiple experiences per site and multiple independent sites. Preserve context while switching; show an explicit unavailable/unauthorized state rather than an endless spinner. Pose-linked orientation on the mini-map is available only after the provider frame is calibrated to the map/floor plan.

**Done when:** a user switches between two real models without stale navigation, returns to the intended location, and sees useful alternatives when a tour fails.

#### Approved first-prototype Treedis boundary

Each captured location stores its physical location ID, experience ID, sweep ID, starting X/Y orientation, capture status, known capture date/version and coverage notes. Opening Immersive Scout navigates to that exact entry state while keeping the physical location name and dossier context visible.

The six downtown records in shared experience `5eb11a1b` remain separate locations. The viewer offers their six entry points and changes sweep within the active experience without a full reload when the provider supports it. Moving to Magnolia Pantry, Moncus Park or another independent experience cancels pending navigation, disposes of the prior session, loads and waits for the new model, then applies the requested sweep and supported orientation.

The adapter exposes explicit `not loaded`, `loading`, `ready`, `navigating`, `unavailable`, `unauthorized`, `timed out` and `failed` states with retry/return actions. Validate message origin, source window, message type and payload. Prevent stale ready/navigation events from an old model from mutating the active session.

A basic bookmark stores location, experience, sweep, supported orientation, name, short note, creation date and capture/version reference. Reopening restores the supported view or explains why it cannot. Screenshots are optional only after provider capability and reuse rights are verified.

Leaving Immersive Scout preserves the selected location and unsaved project/shot state and supports return to the map, candidate record or Shot Designer. Show nearby entry points within the same experience and warn when capture date or coverage is unknown.

Deferred or excluded from the first prototype: placing authored cameras/actors inside Treedis, treating the viewer as editable geometry, uncalibrated panorama measurement, undocumented depth extraction, relighting, claims about unrecorded rooms, a headset requirement and dependence on Treedis administrative APIs.

### F04 — View Bookmarks and Contextual Notes · Phase 2 basic, Phase 9 review expansion

Save a named view with location, space, capture/version, sweep ID, and supported orientation. Link it to a scene, candidate concern, or shot. Attach text, annotated owned photos, or a voice note with editable transcription when the selected service/browser supports it. Keep author, timestamp, and revision history.

Do not promise a screenshot of an embedded tour unless the provider supports it and the media rights allow it. A bookmark plus an uploaded reference image is an acceptable initial path. Do not require approximate screen-space note pins to masquerade as 3D world anchors.

**Done when:** reopening a note restores the supported view or clearly explains that the source capture changed, and typing works without tour/editor keyboard shortcuts intercepting it.

### F05 — Production Brief and Scene Requirements · Phase 3

Create a production, story-location requirements, and scenes. Record scene number, INT/EXT, DAY/NIGHT, look/period, expected action, cast/extras, picture vehicles, special equipment, approximate crew size, dates, access needs, and must-have versus preferred constraints. One story location can have several physical candidates; one physical location can serve several story locations.

Start with manual forms and an explicit CSV template. Script-file import is later, with preview and correction. AI extraction is optional future assistance; it must not silently publish or treat inferred requirements as confirmed.

**Done when:** a scout can compare multiple physical candidates against the same creative/practical brief without duplicating the whole location record.

### F06 — Shortlist, Comparison and Backups · Phase 3

Track candidates as discovered, under review, shortlisted, rejected, preferred, or withdrawn, with reasons. Keep this decision state separate from availability, permission, and capture quality. Compare selected sites side by side against the brief, with evidence and unknowns visible.

Allow configurable weighted scoring, but never silently award points for missing data. Identify hard requirement failures separately from subjective scores. Model primary, alternate, and weather-cover relationships; flag unverified availability and schedule conflicts. Show nearby locations that could reduce company moves without presenting straight-line proximity as travel time.

**Done when:** the scout can explain a preferred choice and retain at least one meaningful backup with its remaining uncertainties.

#### Approved first-prototype Project Workspace boundary

A locally stored project has a stable ID, name, production type, short description, status, `America/Chicago` time zone, timestamps and multiple scene requirements. It links to candidate records, Treedis bookmarks and shot designs without duplicating the master location catalog. Do not store contracts, insurance documents, access codes or other sensitive production documents in the first prototype.

A scene requirement supports scene/internal ID, title, story location, INT/EXT, DAY/NIGHT, description/action, desired character/period, required spaces, cast/extras/picture vehicles, special equipment, approximate crew size, must-have and preferred requirements, rejection conditions, open questions and notes. Entry is manual; script parsing and AI extraction are deferred.

Each candidate links a physical location to a project scene and stores status, date added, rationale, visual/practical strengths, concerns, missing information, requirement assessments, bookmarks, shot designs and decision notes. Candidate states are `discovered`, `under review`, `shortlisted`, `preferred`, `backup`, `rejected` and `withdrawn`.

Side-by-side comparison covers visual fit, requirements, immersive coverage, known access status, public hours/availability information, practical summaries, proximity context, validation gaps and associated shot designs. Use `strong fit`, `acceptable`, `concern`, `fails requirement` and `unknown`; unknown evidence never receives a favorable score.

The decision record supports a preferred candidate, backups, rationale, unresolved questions, rejection reasons, reopening and the location/capture versions supporting the decision. The relationship is `Project → Scene requirement → Candidate location → Shot scene`; one catalog location may serve multiple projects.

IndexedDB provides local autosave with visible `saving`, `saved` and `failed` states. Versioned JSON exports/imports the complete project after schema validation. Catalog facts remain separate from project judgments. Deletion requires deliberate confirmation.

Deferred: accounts/roles, collaboration, script or AI extraction, permit/agreement tracking, detailed costs, private contact-document storage, scheduling/itineraries, remote synchronization and weighted scoring formulas.

### F07 — Scout Visit Planner · Phase 7

Build an ordered itinerary independent of catalog order. Include scout purpose, participants, owner windows, arrival/departure, duration, travel buffers, entrances, contact access, and outstanding questions. Use full dates plus the `America/Chicago` time zone; support visits crossing midnight.

Initially use reviewed external navigation links and manual travel allowances. Add a routing provider only after selection and validation. Distinguish crew entrance, delivery/loading entrance, basecamp, and public map centroid. Mark a visit completed explicitly; browsing a place on a map does not count.

**Done when:** an itinerary can be reordered, saved, reopened, and used on a phone, including with denied geolocation.

### F08 — Shot Workspace · Phase 4

Create an editable scene associated with a location/space and project scene. Provide a top-down blocking view and a coordinated 3D representation from the **same scene data**. Add named cameras, actors/stand-ins, targets, marks, props, lights, and annotations. Select, translate, rotate, duplicate, lock, hide, group, and delete objects; support undo/redo and autosave.

Provide map-navigation and object-editing modes with clear cursor/selection feedback. Offer numeric position, height, heading, and size fields alongside drag handles. Keep inspector labels, selected objects, and shot-list entries synchronized. Labels should remain legible at different zooms. Touch and keyboard alternatives should avoid precision-drag-only operation.

**Done when:** a scout can recreate the essential structure of the supplied Lafayette example, save it, reopen it, and edit it without losing object identities or scene coordinates.

### F09 — Camera, Lens and Framing · Phase 4 core, Phase 8 advanced

Define a camera rig separately from its shot setups. A setup includes position, mount height, heading, tilt, roll where supported, sensor/gate dimensions, focal length, aspect/crop, target, focus distance when known, and notes. Support custom sensor values so the tool is not dependent on a supposedly complete camera database.

Display top-down field-of-view boundaries and 3D frustums, subject distance, and a framing preview when usable scene geometry exists. Explain the difference between the map's navigation camera and the authored film camera. Preserve the shot when switching map modes.

For an ideal rectilinear lens, use `FOV = 2 * atan(active sensor dimension / (2 * focal length))`; calculate horizontal and vertical angles using the effective gate after crop. Store physical units explicitly. Test formula behavior with known dimensions. Distortion, anamorphic behavior, breathing, stabilization crops, and real optical depth of field require additional models and are not implied by a cone graphic.

Treat the user's “lens curves” as two separately editable ideas: **lens coverage boundaries** and **curved camera movement paths**. Additional optical overlays, depth-of-field simulation and anamorphic behavior are deferred to Phase 8.

**Done when:** changing focal length or gate produces predictable coverage in both views, with a visible distinction between schematic and calibrated estimates.

### F10 — Blocking, Marks and Movement · Phase 4 basic, Phase 8 advanced

Place actor marks and camera marks, draw straight or curved paths, and edit control points. Store actors, rigs, targets, and paths independently. Offer optional target tracking and maintain-offset behavior; users can detach these constraints without unexpected camera movement.

The basic release previews deterministic timed paths with start/end values, play/pause, and scrubbing. Later add keyframes, segment timing/easing, simultaneous actions, shot versions, and optional dialogue cues. Support explicit actor heights and approximate stand-ins; avoid implying realistic character animation is included.

**Done when:** two cameras and multiple actors can follow their own paths on a shared timeline, repeat playback consistently, and export the intended marks and shot identifiers.

### F11 — Shot List, Storyboards and Variants · Phase 4 core, Phase 8 advanced

Maintain shot number, scene, setup, camera, lens/gate, framing description, movement, reference image, duration estimate, status, and notes. Editing shared properties through the diagram or inspector updates the same record. Keep story order distinct from proposed shooting order.

Attach storyboards and permitted reference frames. Save named variants and immutable review snapshots; compare alternatives without destroying the last accepted setup. Record which capture and calibration version supported a shot.

**Done when:** camera A/B and their setup marks correspond to unambiguous shot-list entries, and a reviewer can reopen a named version.

### F12 — Floor Plans, Set Layout and Measurements · Phase 4 basic, Phase 8 advanced

Import an owned/licensed plan or reference image as a background. Calibrate its scale using a known dimension, set origin/north/floor elevation, and retain uncertainty and source. Provide simple walls, doors, windows, and obstructions; advanced model import should use a validated, bounded format such as a selected glTF/GLB pipeline.

Measure only where a meaningful coordinate frame exists. Separate estimated map geometry, owner-supplied dimensions, and surveyed geometry. A single panorama or screenshot cannot establish reliable hidden geometry, ceiling clearance, or arbitrary viewpoint parallax.

**Done when:** a known-distance fixture stays consistent across 2D/3D and save/reload, and uncalibrated backgrounds are visibly schematic.

#### Approved first-prototype boundary for F08–F12

The approved Shot Designer Core uses one scene model across a synchronized overhead 2D plan and perspective 3D view. A scene may use DOTD aerial imagery, optional Google 3D context, an imported floor-plan image or a blank grid. Supported first-prototype objects are cameras, actors/stand-ins, vehicles, generic props, position marks, direction arrows, annotations and simple walls/set boundaries.

Users can select, move, rotate, duplicate, group and delete objects through drag controls and numeric fields, with an optional grid/snap mode, undo/redo, autosave and named variants. Camera controls include name/color, position/height, pan/tilt/roll, focal length, sensor/gate, aspect ratio, calculated horizontal/vertical field of view, a 2D coverage cone and a 3D frustum.

Basic blocking includes independent actor and camera start/end positions, editable paths, direction arrows, numbered marks and a simple deterministic preview. The shot list stores shot number, camera assignment, shot type, lens/aspect, description and the linked arrangement; users can reorder shots and duplicate or restore a variant.

For interiors, users can import an owned floor-plan/reference image, set scale from a known distance, rotate and align it, classify it as schematic/approximate/calibrated, place scene objects over it and persist the background transform. IndexedDB stores the working scene; versioned JSON provides import/export and recovery portability.

Deferred from this boundary: a full animation timeline, advanced keyframes/easing/motion curves, physics/collision, automatic character animation, depth-of-field or anamorphic simulation, complex 3D-model import, real-time multiuser editing, precise collision/measurement against Google tiles, and direct placement of authored objects inside the Treedis viewer.

### F13 — Light, Sun and Environmental Evidence · Phase 8

Record light direction, window orientation, blackout possibilities, fixture observations, noise sources, traffic patterns, construction, weather sensitivity, and observation date/time. Attach short owned audio/video evidence where useful; do not present device audio as a calibrated sound survey.

Later provide date/time-based sun direction and conceptual shadows over suitable geometry, plus lighting symbols, aiming directions, and notes. Label astronomical position versus model-based shadow estimates. Baked aerial/360 imagery cannot be physically relit by moving a sun slider. Exact photometry, exposure prediction, acoustic simulation, and structural load approval are outside the baseline.

**Done when:** environment notes and approximate visual overlays have explicit provenance and limitations and can be added to a technical-scout question list.

### F14 — Production Logistics Map · Phase 7

Add project-specific areas for working trucks, crew parking, basecamp, holding, catering, toilets, generators, load-in paths, proposed camera/picture-car positions, and affected neighbors. Separate proposals from approved areas. Store capacities/dimensions only with their evidence and verification status.

Allow date/time windows and notes for proposed closures or parking controls, but do not produce claims of official traffic approval. Include confirmed entrances, vehicle clearance concerns, pedestrian/accessibility routes, and crew-facing directions. Keep restricted access codes outside broadly shared maps.

**Done when:** a reviewed map explains where people and equipment should go, distinguishes proposed versus approved arrangements, and can be exported without leaking private contact/access details.

### F15 — Access, Permissions, Availability and Costs · Phase 7

Track property owner, authorized representative, manager, tenant, and permitting authority as distinct roles. Support contact history, inquiry status, permitted use conditions, requested/confirmed windows, prep/shoot/strike access, and linked documents. A site may have several permissions with different scopes and dates.

Keep creative preference, owner permission, permit status, document status, and availability independent. Date availability is scoped to the requested activity and is not a global “bookable” flag. Track quoted, estimated, agreed, and actual costs with currency, basis, dates, and source; include ancillary location costs and restoration allowances.

This is a workflow tracker. It does not issue permits, provide legal advice, determine insurance sufficiency, negotiate contracts, or send communications automatically.

**Done when:** the workspace can explain what is confirmed, by whom, for which activities/dates, and which dependencies remain open.

### F16 — Technical Scout and Location Handoff · Phase 7

Generate stage-specific checklists from project needs. Early remote review emphasizes fit and questions; technical scouting emphasizes department requirements, access, practical logistics, and verification. Assign questions/actions to a department or person with due date, evidence, and resolution.

Provide a mobile visit record for photos, notes, changed conditions, and decisions. Export a location packet with location summaries, selected views, shot diagrams/list, logistics maps, itinerary, unresolved questions, and revision/date. Support different audience presets: creative review, technical crew, owner discussion, and public showcase.

**Done when:** department heads can identify unresolved requirements and review a dated packet whose contents match a saved workspace revision.

### F17 — Wrap and Location Stewardship · Phase 9

Record pre-use condition images, incidents, changes, restoration tasks, post-use photographs, and signoff records. Retain lessons for future scouting while separating one production's private incident history from publishable catalog facts. Flag a location needing review after major changes.

**Done when:** a production can close its location obligations and a curator can request a capture/fact refresh without overwriting historical evidence.

### F18 — Collaboration and Review · Phase 9

Use project membership and roles such as owner/admin, editor/scout, commenter/reviewer, and viewer. Field-level or resource-level restrictions must cover private contacts, documents, notes, and shared media. Begin with asynchronous notes/reviews and versioned saves.

Later add presence and follow-presenter sessions. Synchronize selected location/bookmark and supported view commands through the application, not by assuming a vendor automatically synchronizes arbitrary scenes. Simultaneous shot editing needs an explicit locking or conflict-resolution strategy; do not implement silent last-write-wins for important edits.

**Done when:** unauthorized users cannot retrieve a private resource through its API or direct media URL, and competing edits are detected and recoverable.

### F19 — Capture Library and Curation · Phase 1 metadata, Phase 9 management

Maintain media rights/source, capture date, publication state, rooms covered, provider model/sweep identifiers, calibration, missing viewpoints, and refresh needs. Keep unavailable/retired captures referentially intact so historical notes explain what changed.

Add curator forms, validation, draft/publish review, and owner-submitted updates later. Photo capture guidance should include reverse views and practical spaces, not only attractive compositions. Record quality gaps such as unreadable details, inaccessible floors, or missing load-in views.

**Done when:** replacing a tour does not silently redirect old notes or misrepresent an outdated view as current.

### F20 — Reliability, Accessibility and Portability · Baseline in Phases 0–5; field expansion in Phase 7

Keep catalog browsing light; load 3D/Treedis on demand. Provide keyboard access, visible focus, readable contrast, reduced motion, labelled controls, and numeric alternatives to drag editing. Test real phones/tablets separately from desktop emulation.

Provide project/scene JSON round-trip export, CSV shot lists, and printable packets early. Exports must preserve units, IDs, coordinate-frame and schema versions. Detect and explain unsupported or malformed imports.

Offline support initially covers approved lightweight material and explicit local drafts, not a promise of offline Google imagery or Treedis experiences. Saving confidential material offline requires a deliberate access/retention design. Show saved/pending/failed state and resolve upload conflicts after reconnecting.

**Done when:** failure of a provider, storage write, permission request, or network connection produces a recoverable state without silent data loss.

### F21 — Treedis Research Mode · Phase 6, post-prototype

Add a dormant-by-default research path for consented studies of Treedis/WebXR interaction. The public and record-only application paths remain unchanged unless an authorized study launch, current consent and the required research-service configuration are all present. Phase 6 introduces a separate research service rather than changing the first-prototype decision to keep ordinary project data local.

The approved candidate architecture is a dedicated HTTPS research proxy/collector, initially evaluated as a Cloudflare Worker with private R2 storage, that serves authorized Treedis content through a controlled origin, injects one versioned probe into eligible HTML, validates and accepts bounded event batches, and stores immutable raw batches for controlled analysis. The SLiVR integration replaces only the Treedis origin for an authorized study session and preserves experience path/query, adapter identity and normal failure recovery. The supplied `TreedisResearch mode information.txt` is design input and prototype code, not a verified SLiVR implementation or security review; its SCSU filenames, IDs, assumptions and generated scripts must not be copied blindly.

Phase 6 has two gates:

1. **6A — Passive capture:** capture only protocol-approved WebXR/session signals such as viewer/head pose, controller grip/target-ray pose, buttons/axes, optional hand joints, select/squeeze/session events, safe-listed Treedis lifecycle events and explicit data-loss/performance diagnostics. Label viewer direction as head direction/head-gaze rather than eye tracking. Record protocol, condition, consent, probe/schema, SLiVR build, capture/experience, device/runtime and coordinate/reference-space versions on the same monotonic timeline.
2. **6B — Experimental manipulation:** only after 6A passes and the study has explicit approval for changed stimuli, optionally inventory authorized object handles and apply predefined, versioned conditions such as visibility/media/timed/zone/head-direction triggers. Use a separate manipulation gate and disclosure. Log condition assignment, trigger and operation result on the same timeline. Do not fabricate object IDs or depend on undocumented renderer internals without a live discovery/compatibility test.

Prefer a provider-supported SDK, export or approved integration if Treedis offers one when Phase 6 begins. Reverse proxying, removing/altering security headers, inspecting runtime objects or modifying served content requires written confirmation that the project has the needed Treedis/content-owner rights and an approved institutional security/ethics path. Use a dedicated research origin with an upstream allowlist, signed short-lived study launches, restricted CORS/origins, request-size/schema/rate validation, private non-public storage, retention/deletion rules, audit records and a tested kill switch. A random session ID makes data pseudonymous, not automatically anonymous; motion trajectories and network/platform logs require explicit treatment in the protocol.

Normal mode, consent decline/withdrawal, expired/invalid launch, unavailable research service and collector failure must fall back safely without recording or manipulating the tour. The probe must forward original calls/results, avoid a second render loop, measure its own overhead against a protocol-defined baseline, stop sampling if limits are exceeded and never block the Treedis render/navigation path. Record-only and manipulation modes require separate non-interference tests.

**Done when:** provider/owner authorization and the applicable study/security approvals are documented; normal/public behavior never contacts the research service; consent and a valid study launch are required; passive sessions produce schema-valid, versioned, time-aligned data with measurable loss/overhead; collector failure leaves the tour usable; withdrawal and retention/deletion paths are tested; analysis reproduces declared measures from immutable raw data; and any enabled condition changes only named stimuli, logs its assignment/actions, passes counterbalanced-condition and rollback tests, and remains independently disableable. See [Treedis Research Mode Plan](research/TREEDIS_RESEARCH_MODE_PLAN.md).

## 6. Approved prototype architecture

### 6.1 Modular migration in the new project

Reuse proven behavior and algorithms selectively. Implement SLiVR as static HTML, CSS and modern JavaScript using native ES modules, following the source project's no-build delivery approach where useful. Do not require Vite, TypeScript, React or another UI framework for the first prototype. Use schema-validated domain records, JSDoc where it improves contracts, a central store and documented adapter interfaces. Keep modules independently testable so a later build system can be adopted without rewriting domain data or provider boundaries.

Approved responsibility boundaries; the exact filenames may evolve during planning:

```text
src/
  app/              startup, routing, layout, store, feature capabilities
  domain/           locations, captures, projects, candidates, scenes, shots, visits
  map/              MapLibre adapter, layers, filters, region configuration
  immersive/        Treedis adapter, sessions, bookmarks, capability checks
  spatial/          coordinate frames, calibration, units, geometry, lens math
  shot-workspace/   commands, selection, constraints, paths, timeline, 2D/3D views
  scouting/         briefs, comparisons, checklists, logistics, field records
  data/             catalog/workspace repositories, validation, migrations
  exports/          JSON, PNG, CSV, print packet and emergency recovery
  ui/               reusable panels, forms, accessible controls
tests/              domain, integration, browser, representative scene fixtures
public/             approved public assets only
docs/               private planning references; excluded from public build output
```

Do not copy local credentials, LSU editorial content, private reference documents, or obsolete command files into the new build. Pin compatible dependency versions after a working prototype; preserve licenses and attribution. Adapt useful tests while removing LSU-specific assumptions.

### 6.2 Three coordinated spatial surfaces

1. **Geographic map:** discovery, exterior context, entrances, geographic overlays.
2. **Immersive viewer:** photographic inspection at the viewpoints and controls actually available from the provider.
3. **Shot workspace:** editable objects, calibrated geometry, camera mathematics, paths, and optional synthetic camera preview.

They share stable domain IDs and coordinate transforms, not DOM hacks or duplicate mutable scene copies. Selecting a location, opening a bookmark, or choosing a shot sends an explicit action through the store. Adapter events must not create selection feedback loops.

Do not couple authored scene objects to private Google renderer internals. Prototype a separate authored Three.js layer or dedicated viewport with explicit transforms. Confirm shared WebGL depth/occlusion behavior before promising correct occlusion against streamed tiles. Preserve a standalone plan/model view when basemap providers fail.

#### 6.2.1 Approved 2D aerial-imagery source

Use Louisiana DOTD public high-resolution natural-color aerial imagery as the primary 2D map surface. The approved prototype source is the direct [2025 Various 6-Inch RGBI ImageServer](https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer), requested through its `exportImage` operation as Web Mercator raster tiles. Use RGB bands `0,1,2`, 512-pixel JPEG requests and visible attribution such as `Imagery: Louisiana DOTD, 2025 6-inch aerial`. This follows the proven MapLibre raster-source pattern in LSU3D without copying LSU coordinates or content.

Use the [2024 Lafayette 6-Inch RGBI ImageServer](https://maps.dotd.la.gov/imagery/rest/services/Imagery/2024_Lafayette_6IN_RGBI/ImageServer) as the configured fallback if the 2025 service is unavailable or reveals a local coverage gap. Both services returned imagery in direct tests at representative points in all six SLiVR operational areas and allowed browser-origin image requests.

Do not use MapServer layer `187` as the Lafayette primary layer. Although [layer 187](https://maps.dotd.la.gov/imagery/rest/services/Imagery/Louisiana_Remote_Sensing_Map/MapServer/187) is 2026 six-inch natural-color imagery, its published extent and direct sample requests do not cover the current Lafayette inventory. A successful HTTP response may still be an all-black no-data image, so Phase 0 must validate pixel/content coverage rather than status code alone.

DOTD states that the imagery is free to use in products/publications, is supplied as-is and is not authoritative for navigation, engineering, legal, property-transfer or other high-precision site-specific work. Preserve DOTD attribution and show the collection/source year. Treat the aerial image as scouting context, not measured clearance geometry or proof of present conditions. Keep the imagery URL, year, attribution, fallback and coverage bounds in region configuration so the provider can be changed without editing map logic.

#### 6.2.2 Approved optional 3D exterior context

Retain Google Photorealistic 3D Tiles as an optional prototype layer for realistic exterior context, adapting the useful integration concepts from LSU3D. It supplements the DOTD 2D aerial map and does not replace it. API credentials and provider configuration must remain outside committed public source files.

Keep all authored Shot Designer objects in SLiVR's own scene model and coordinate frames. Cameras, actors, props, marks, paths, annotations and shot records must save and reopen independently of Google tile availability. Do not bind persistent object identity, measurements, collision, occlusion or editing behavior to private renderer internals or streamed tile object IDs.

If Google 3D is disabled, unavailable, unauthorized or slow, the user must retain a usable aerial/plan or simple local 3D workspace. Label placements against unverified streamed geometry as approximate. Provider failure must not block opening, editing, saving or exporting a shot design.

### 6.3 Coordinate and accuracy contract

Use WGS84 longitude/latitude for geographic features. Use local metric east/north/up coordinates for each authored scene, with a documented origin and altitude datum. Separate ground elevation, floor elevation, and camera height above that floor. Convert units only at input/output boundaries.

Each Treedis model, imported plan, and local 3D model has its own coordinate frame. A calibration record contains source/destination frame IDs, axis convention, units/scale, translation, orientation, control points, date, method, residual/error estimate, and version. Use sufficient non-degenerate controls and an independent check appropriate to the transform. Do not assume all models use the same origin or north direction.

Modes: **schematic**, **approximately aligned**, and **measured/calibrated**. Record the achieved accuracy, not just a badge. Uncalibrated scenes can support conceptual blocking but cannot support precise clearance claims. Updating calibration must not silently rewrite approved shots; retain their original frame/version and offer an explicit migration.

### 6.4 Treedis integration contract

The current official interface documents readiness, pose/sweep events and navigation/sweep-request commands. It does not document arbitrary actor insertion, depth access, optical camera control, or relighting. Account/domain configuration and access to real models still need testing. Source: [Treedis integration guide](https://docs.treedis.com/sdk/web/integration-guide).

Approved adapter requirements: one controlled active session; model/capture identity; explicit not-loaded/loading/ready/navigating/unavailable/unauthorized/timed-out/failed states; timeout and user retry; cancellation/generation tokens during switches; checks of message origin, source window, type and payload; documented disposal; preservation of valid zero values. Expose a capability object instead of promising every control on every device/model.

Persist bookmarks using supported view information. A richer API or export route may be added only after its actual availability and rights are verified. Provider administration APIs and runtime viewer controls are separate integrations.

### 6.5 Persistence and access

Public catalog data may begin as validated versioned JSON/GeoJSON. Nonconfidential prototype drafts may use IndexedDB with visible local-only status and export/import. Browser storage is not a secure multiuser workspace or a backup service.

**Approved prototype storage decision:** use IndexedDB as the browser-local working database for projects, scene briefs, candidates, bookmarks, shot scenes, objects, shots and revision metadata. Provide versioned JSON export/import for backup, transfer and recovery. IndexedDB requires no backend, but its data is isolated to the current browser profile/device and can be lost if browser storage is cleared. The interface must state this plainly. Keep access behind a repository/storage adapter so a later authenticated backend can be added without coupling the feature modules to IndexedDB APIs.

Remote storage, accounts and shared production workspaces are outside the first prototype. If a later release stores real private productions remotely, it must add authenticated APIs, project membership checks, database/resource authorization, controlled media access and server-side handling of secrets. Hiding fields in the UI or using unguessable URLs is not access control.

The prototype is a static application with local-only workspace persistence. Public build output must not include `docs/`, manuscript files, the book, user workspace exports or other private reference material. Deploy from an explicit public/output allowlist rather than publishing the entire project folder.

All storage keys, service-worker scopes, and cache names must belong to SLiVR. Source code currently includes a worker-disable routine that enumerates all registrations on the origin; do not copy that behavior. SLiVR must never unregister or clear the LSU app's workers/caches. Prefer an independently hosted origin for private workspaces if appropriate to the chosen deployment.

### 6.6 Approved interface layout and mode navigation

Use a desktop-first application shell with a persistent top workspace switcher for `Explore`, `Projects`, `Immersive` and `Shot Designer`, plus the active context breadcrumb and local-save status. The active project, scene, candidate, location and shot scene persist when switching modes.

- **Explore:** left search/filter/results panel, central MapLibre map, right location dossier.
- **Immersive:** left location/entry-point/coverage panel, central Treedis viewer, right bookmarks/notes/warnings panel, with a full-screen viewer option.
- **Projects:** left project/scene/candidate navigator, central brief/comparison/decision workspace, right selected-candidate details/actions.
- **Shot Designer:** left scene tree/object library/shot navigator, central synchronized 2D or 3D canvas, right object/camera inspector and a collapsible bottom panel for shots, variants and basic path preview.

Primary mode buttons remain in a consistent top-bar position. Contextual actions also carry the relevant IDs: dossiers open Immersive, add to a project or open Shot Designer; candidate records show the location, open Treedis or open the associated design; Immersive and Shot Designer provide explicit return actions. `Explore` and `Projects` are always available. `Immersive` explains future/unavailable capture state when no current model exists. `Shot Designer` opens the active design or offers to create a standalone/local design that can later attach to a project.

Use stable routes such as `/explore`, `/location/{locationId}`, `/project/{projectId}/scene/{sceneId}`, `/immersive/{locationId}` and `/shot/{shotSceneId}`. Browser Back/Forward must work. URLs identify records but never contain private project content.

Before a mode transition, persist pending edits to IndexedDB and show `Saving…`, `Saved locally` or `Save failed`. A failed save keeps the current workspace open and offers retry plus emergency JSON export. Leaving Treedis suspends/disposes its provider session after preserving supported view state; leaving Shot Designer saves the scene and releases unnecessary rendering resources; returning restores the last supported state. Explore retains map center/zoom/filters/selection, and Projects retains its comparison selection.

Desktop uses the full panels; tablet may collapse either side panel; small screens retain readable map/dossier/viewer access but do not promise precision Shot Designer editing. Provide keyboard access, visible focus, numeric alternatives to dragging and clear distinction between map-navigation and object-edit modes. Use a neutral filmmaking-oriented visual system with high contrast, consistent evidence-status colors and no LSU branding or recruitment language.

### 6.7 Approved prototype exports

The first prototype provides four primary export paths plus emergency recovery:

1. **Versioned project JSON:** complete project metadata, scene requirements, candidates/decisions, bookmarks, shot scenes/objects, shot list/variants, floor-plan transforms and catalog/capture-version references. Do not embed Treedis, Google or DOTD imagery. Import validates before mutation, previews contents, detects ID conflicts and supports adding a copy or deliberately replacing an existing project.
2. **High-resolution PNG shot diagram:** the intentionally visible 2D or 3D view with optional title block for project/scene/location/shot, camera/lens, aspect, date, revision, calibration/units, meaningful north arrow and required provider attribution.
3. **Shot-list CSV:** scene, shot number/description, location, camera, lens, sensor/gate, aspect, camera/actor movement, estimated duration, status, notes and variant/revision.
4. **Print-ready project packet:** browser-printable HTML suitable for Save as PDF, with user-selected sections for project/scene summary, candidate decision, validation gaps, dossier summary, bookmark links, diagrams, shot list, evidence/calibration/provider notes, date and revision.

If local persistence fails, **Export Emergency JSON** serializes the current valid in-memory project without requiring IndexedDB. Use predictable sanitized filenames containing SLiVR, project, relevant scene/shot, date and revision.

Deferred exports: proprietary Shot Designer formats, Final Draft/Movie Magic, BIM/CAD, glTF/GLB packages, animation video, unapproved Treedis screenshots, cloud share/review packages and permit/contract packages.

## 7. Approved domain-record model

| Record | Important contents and relationships |
|---|---|
| Region / District | IDs, name, boundary, default views, time zone, provider configuration |
| Location | Stable ID, public name, district, geographic geometry, publication status; independent of projects |
| Space / Entrance | Location ID, floor/interior-exterior type, geometry/frame, entrance purpose and restrictions |
| Fact / Observation | Subject, value/unit, source, method, author/date, verification state, visibility, attachments |
| Source / Evidence | Publisher, title, URL/local reference, access date, authority type, supported facts and limitations |
| Capture / Viewpoint | Space, provider/model/sweep IDs, capture date/version, coverage, rights, capabilities |
| CoordinateFrame / Calibration | Origins, axes, units, transforms, controls, uncertainty, versions |
| Project / Membership | Production, time zone, roles, access scope, retention and ownership |
| StoryLocation / SceneBrief | Creative requirements, scene identifiers, INT/EXT, DAY/NIGHT, constraints |
| Candidate | Project + story location + physical location; decision state, rationale, scores, backup relationship |
| Availability / Permission | Resource/activity/date scope, issuer/authority, status, evidence, conditions |
| Contact / Document | Restricted relationships, roles, versions, access policy; not public catalog defaults |
| ShotScene / SceneObject | Location/space/frame, objects with transforms, source model, revision |
| CameraRig / ShotSetup / Shot | Stable rig; setup transform/lens; editorial shot ID/order/description; explicit relationship |
| Path / Keyframe / Constraint | Target object, coordinates, timing, interpolation, dependency/track behavior |
| Bookmark / Note | Capture view or scene/object context, author, timestamp, visibility, revision |
| Visit / VisitStop / Task | Independent order, full time windows, entrances, participants, questions and completion |
| LogisticsArea / CostItem | Project-specific geometry/date/status; estimate/quote/agreed/actual cost basis |
| ReviewSnapshot / Export | Immutable revision, audience, included records, generated date and attribution |

All persistent formats require `schemaVersion`, stable IDs, validation and migrations. References must survive renaming a location. Store missing values explicitly. Never use lowercased display names as foreign keys. Maintain history where later updates would change the meaning of a scouting decision.

## 8. Primary acceptance scenario: downtown Lafayette

Use `docs/Example of shot designer.png` as the visual workflow reference. Do not extract coordinates, lens specifications, or dimensions from its appearance as though measured.

1. Find one of the downtown records and open its dossier without losing the distinction between the physical location and the shared Treedis experience.
2. Add it as a candidate for a project scene; record an unknown access issue.
3. Enter its supplied sweep in experience `5eb11a1b`, move to another downtown location entry point in that same experience, and save a contextual bookmark.
4. Switch to Magnolia Pantry's independent experience `a872109b`, then return to the original location without stale sweep state.
5. Open a shot scene with a suitable geographic reference or calibrated owned background.
6. Place magenta camera A, blue camera B, actor stand-ins, numbered marks and annotations.
7. Define distinct camera/actor paths and shot descriptions; edit positions and angles.
8. Set known gate/lens values; inspect coverage in plan and 3D. Clearly label approximate geometry.
9. Preview movement; switch map/immersive/editor views without losing the design.
10. Save, reload, undo an edit, create a variant, and restore a reviewed version.
11. Export a shot list and readable diagram with location, north/orientation, scale status, units, date and revision.
12. Attach the design to a technical-scout packet with outstanding access/logistics questions from the location database.

This is the pilot's central product test. Its first implementation can use simple stand-ins and owned reference geometry; realistic full-city reconstruction is not a dependency for proving the workflow.

## 9. Approved delivery phases and exit gates

| Phase | Deliverable | Exit gate |
|---|---|---|
| **0 — Foundation and feasibility** | Create the static HTML/CSS/JavaScript ES-module application shell, stable mode routes, shared schemas, versioned 17-location catalog, repository adapters, IndexedDB persistence and versioned JSON transfer. Prove the risky integrations with small vertical tests: MapLibre with the approved DOTD primary/fallback imagery, optional Google 3D context, Treedis shared/separate entry behavior, and a minimal Three.js camera/actor/frustum scene. Establish the versioned research feature register, decision record, change log, measurement dictionary and limitations register. | All 17 catalog records reconcile with the workbook; local save/load and JSON round trips preserve stable IDs and relationships; DOTD coverage is verified with real image-content checks across the operational envelope; a provider-capability matrix records verified Treedis behavior and unresolved rights/freshness data; camera field-of-view and transform checks pass; the research records identify every approved feature and planned construct without making untested claims; SLiVR runs independently and no LSU3D file, LSU content or LSU coordinate is changed or copied. |
| **1 — Location Atlas and Dossiers** | Deliver all 17 locations and six operational areas in a synchronized map/list interface with search, approved filters and sorting, capture/future status, DOTD imagery, optional 3D context, full dossier sections and visible evidence/validation states. | Every record can be found, selected, opened and linked; map and list selection remain synchronized; current capture and research completeness are never conflated; future candidates have no fabricated tours; approximate, missing and unvalidated facts are visible; imagery/provider failures leave the list and dossier usable. |
| **2 — Immersive Scout** | Add the isolated Treedis adapter, the six distinct downtown entries inside the shared experience, the five separate current experiences, explicit lifecycle/error states, trusted-message validation, bookmarks, notes and context-preserving transitions. | The six downtown records remain distinct; the user can switch among downtown entries, Magnolia Pantry and at least one non-downtown model; stale events cannot overwrite the active selection; timeouts and failures offer retry or return paths; a bookmark restores the intended view when supported and clearly explains when restoration is unavailable. |
| **3 — Project Workspace** | Add local productions, multiple scene requirements, candidates, suitability ratings, comparison, preferred and backup choices, decision rationale, links to locations/bookmarks/shot scenes, autosave and validated JSON import/export. | A user can compare at least two candidates for a scene, preserve unknowns as unknown, choose a preferred location and backup, and reopen the decision with its evidence intact; reload and JSON transfer preserve stable IDs and relationships; failed persistence retains the working state and offers emergency JSON recovery. |
| **4 — Shot Designer Core** | Add the synchronized overhead 2D and perspective 3D scene, approved object set, selection/transforms, grid/snap, camera and lens controls, FOV cone/frustum, simple movement paths, deterministic preview, shots/variants, floor-plan import/calibration, undo/redo, autosave, PNG diagrams and shot-list CSV. | Recreate the structure of the supplied downtown reference with at least two cameras plus actors/marks/paths; known FOV, transform and unit tests pass; a known-distance floor plan retains scale and calibration status; save/reload and variants preserve the scene; exported PNG and CSV are legible and identify location, orientation, units, date and revision without claiming unverified precision. |
| **5 — Integrated prototype and release validation** | Connect the complete workflow, finish the approved export set including the print-ready scouting packet, harden routing/context transitions, dispose or suspend mode resources correctly, verify accessibility and tablet behavior, and document static deployment, provider configuration, storage recovery, cache isolation and research-evaluation readiness. | Complete discovery → dossier → immersive review → project comparison → shot planning → export without data loss; browser Back/Forward and mode switching preserve the active context; all required empty/loading/error/fallback states work; desktop and tablet acceptance checks pass; research records match the released behavior, measures have operational definitions, limitations and version/provenance are recorded, and no participant data is collected without a separately approved protocol and consent; private reference documents are absent from the public build; SLiVR does not disturb LSU3D or neighboring applications on the same origin. |
| **6 — Treedis Research Mode (post-prototype)** | After the essential prototype is complete, validate authorization and implement the separately deployed research launch, proxy/probe/collector, private raw-event storage, schema/version manifest, consent/withdrawal controls, analysis pipeline and non-interference tests. Deliver passive record-only capture first; add inventory/condition manipulation only through its separate approval and runtime gate. | The F21 completion gate passes: authority and study/security approvals are documented; public/declined/invalid sessions never contact the service; authorized passive data are schema-valid, time-aligned, reproducible and bounded; failure and performance tests preserve Treedis operation; retention/deletion and analysis are tested; and any manipulation is named-condition-only, logged, reversible and independently disableable. |

Phases are dependency-based, not calendar estimates. Phase 0 resolves integration risks before large interface work. Each later phase begins only after the preceding exit gate is demonstrated. Accessibility, provenance, recovery and provider-failure handling apply throughout rather than being deferred to release cleanup.

**Approved first prototype:** phases 0–5. It contains the five approved product families—Atlas, Dossiers, Immersive Scout, Project Workspace and Shot Designer Core—plus only the technical foundations, recovery behavior and exports needed to make their end-to-end workflow dependable.

### Later roadmap outside the first prototype

- **Phase 7 — Field production:** scout-visit planning, phone field tools, production-logistics maps, permissions, availability, costs and technical-scout handoff.
- **Phase 8 — Advanced previsualization and environment:** advanced camera/lens behavior, depth of field, complex model workflows, richer animation, sun/weather analysis and higher-quality visualization.
- **Phase 9 — Team and operations:** collaboration and review, capture-library administration, publishing/refresh workflows, wrap/stewardship records, operational hardening and regional expansion such as a validated solar-energy location.

Moving a later feature into phases 0–5 requires an explicit scope revision and a corresponding exit-gate update. Future phases must reuse the approved provider adapters, records and persistence boundaries rather than bypassing them.

## 10. Verification and implementation discipline

Each implementation phase should name its inputs, changed/new SLiVR files, data migrations, tests, manual acceptance steps, limitations, and rollback path. Verify behavior rather than recreating implementation details in superficial tests.

### 10.1 Code comments and authorship language

Write professional, concise comments in plain language. Comments should explain intent, a non-obvious constraint, coordinate/unit assumptions, provider behavior or the reason for a decision. Do not restate self-explanatory code, narrate implementation steps or leave tutorial-style commentary. Keep comments close to the relevant code and update or remove them when behavior changes. Use short JSDoc only where a public module contract, units, coordinate frame, lifecycle or non-obvious input/output behavior needs clarification.

Do not add references to Claude, AI, language models, generated code, prompts or automated authorship in source comments, documentation created during implementation, commit messages or commit trailers. Do not add `Co-authored-by` or similar attribution for an AI tool.

### 10.2 Git scope and publication

Planning mode never commits or pushes. During later implementation, commit or push only when the user explicitly requests it. Every agent-created commit must contain paths exclusively under `E:\sroberto27.github.io\SLiVR`; do not stage, commit, amend, reset, stash, clean or otherwise alter unrelated changes elsewhere in the repository.

Because Git pushes commits rather than folders, verify both boundaries before publishing: the staged file list before each commit and every local commit that would be sent to the upstream branch before push. If any staged or outgoing commit contains a path outside `SLiVR/`, do not commit or push it as part of this work. After committing, inspect the committed path list and confirm that every path begins with `SLiVR/`. Use a short professional commit subject that describes the product change and contains no AI reference, attribution or generated-by trailer.

### 10.3 Research traceability and evaluation readiness

Treat SLiVR as a research artifact as well as a product prototype. Maintain the versioned records under `research/` so future HCI, VR and spatial-computing writing can reconstruct what was built, why it was built, what changed, what evidence supports it and what remains untested. At the end of every implementation phase, update:

- the feature/evidence register with status, interaction, research rationale, source provenance, expected construct, observable measure and known limitation;
- the design-decision record with alternatives, rationale, consequences and validation status;
- the research change log with the exact build/version, affected feature IDs, schema or measurement changes and links to technical evidence;
- the measurement dictionary when an event, task outcome, rating, timing rule or derived metric changes;
- the limitations and threats register when provider behavior, study design, sample, device, geography or measurement constrains interpretation.

Separate three evidence levels: **design rationale**, **technical validation** and **human-participant evidence**. Never describe an expected benefit as an observed result. Record negative, null and failed results alongside successful outcomes. Preserve application version, catalog/capture version, provider capability, device/browser context, study condition and analysis transformation so findings remain reproducible.

The application must not enable background research telemetry by default. Any participant study requires a separately reviewed protocol, applicable institutional/ethics determination, informed consent, defined retention/access rules and data minimization before collection begins. Study logging must be explicit, visible and opt-in; use pseudonymous session IDs and avoid names, private production content, precise personal location, access codes or provider credentials. Store raw observations separately from derived metrics and never silently alter prior study data when a schema changes.

The initial research framework is indexed at [research/README.md](research/README.md). It is planning infrastructure, not evidence that the prototype has been evaluated with participants.

### 10.4 Living full-system test specification

Maintain [FULL-SYSTEM-TESTING.md](docs/FULL-SYSTEM-TESTING.md) as the consolidated verification record for the entire application. It begins with unmarked planned tests and evolves with implementation. Every phase work package must map changed features and exit-gate claims to stable test IDs, add missing success/failure/recovery tests before claiming completion, and run the affected phase section plus the standing regression sweep.

Do not pre-mark a test from code inspection, a plan or an earlier build. Record the exact build, browser/device, catalog/schema/provider versions and evidence separately for automated tests and live browser/device observations. Preserve failed, blocked and not-tested results; only the executor records PASS. When a test's meaning changes, update the document/version and retain the historical result through source history or an archived execution copy. Do not renumber existing test IDs after they are referenced; assign new IDs for added coverage.

A phase exit gate is not met while a required test is failed, silently untested or blocked without a documented approved exception and retest condition. Phase 6 research tests remain outside the first-prototype gate, but any Phase 6 implementation must satisfy its authorization, consent, security, non-interference, data-quality, retention/deletion and manipulation-separation tests before participant use.

Priority verification:

- IDs/references, schema migration and JSON round-trip preservation.
- Known coordinate transforms, altitude/axis conventions, plan scale, camera FOV/crop, zero rotations and unit conversion.
- Selection consistency across map/list/shot list; navigation history and accessible keyboard focus.
- Model-switch races, unavailable sweeps, origin/source validation, disposal, timeouts and retry.
- Deterministic movement and undo/redo; save failures, interrupted edits and emergency JSON recovery.
- Local-only status, explicit export selection, malformed/conflicting imports and exclusion of private reference material from public build artifacts.
- Slow network, WebGL loss/provider failure, desktop/tablet layouts, keyboard operation and reduced motion.
- Export legibility, filenames, units, revision provenance and provider attribution.
- SLiVR service-worker/cache isolation from neighboring applications on the same origin.

Do not treat the original project's passing tests as proof of new functionality. Browser/device tests and representative calibrated assets will be needed for the new application.

### 10.5 Reference-first implementation

The read-only `E:\sroberto27.github.io\Wrapper\map\Experimental` SCSU project is
the source of truth for the Treedis wrapper and immersive street viewer, as
directed on September 20, 2026. Adapt its `js/03-tour-bridge.js`,
`js/04-street-view.js`, `map.html` and provider configuration. Preserve SLiVR's
multiple-experience identity, validation, cancellation and disposal requirements.
Its working implementation is the source; Lafayette provider behavior still
requires live verification. LSU3D remains the reference for its other capabilities.

LSU3D is the ground-truth reference for anything it already does. Every phase adapts its
code in preference to deriving a new solution, and plumbing follows its working
configuration exactly: library loading, stylesheet order, container setup, source and
layer identifiers, lifecycle and teardown, request shapes and provider parameters.

Deviation is permitted only where this specification or the implementation plan requires
a different approach, where the reference behaviour is a recorded defect, or where no
counterpart exists. Each deviation is recorded in the decision record naming the LSU3D
file it departs from. The reference is not authoritative where it was never executed:
its Treedis bridge has no live evidence behind it, and observed provider behaviour
supersedes its transcribed protocol.

Before a phase closes, the phase's modules are compared against their LSU3D counterparts.
A divergence that qualifies under one of the three reasons is written down; every other
divergence is corrected in that phase by changing SLiVR to match the reference. Neither a
divergence nor its correction is deferred to a later phase, because the next phase builds
on whatever is left. Test 184 carries this check and does not pass while an unjustified
divergence remains.

## 11. Approved prototype operating decisions

| Decision | Approved boundary |
|---|---|
| Audience and visibility | Public location catalog with non-sensitive production work stored locally on the current user's device |
| Accounts and backend | No accounts, server database, cloud synchronization or shared workspace in the first prototype |
| Deployment | Static SLiVR application with storage keys, cache names and any service-worker scope isolated from LSU3D and neighboring applications |
| Geography | The 17 approved records and six Lafayette operational areas; boundaries are planning regions rather than legal/property boundaries |
| Expansion | The solar-energy destination and broader Acadiana coverage remain later additions until their records and approval paths are validated |
| Catalog editing | Read-only, versioned application data derived from the reviewed workbook; project notes never overwrite catalog facts |
| User data | IndexedDB for projects, comparisons, bookmarks and shot scenes, with validated versioned JSON transfer and emergency recovery |
| Sensitive data | No contracts, access codes, insurance documents, private contacts or confidential production files in the prototype |
| Location authority | Operator, property owner, filming authority and public contact remain distinct; no record is presented as bookable without evidence |
| Unknown information | Preserve `Need validation` and `Information has not been found`; never translate unknown into approval, availability or absence of a restriction |
| Devices | Desktop-first authoring with supported tablet layouts; phone field workflows and headset-specific interaction are later scope |
| Collaboration | Deferred to Phase 9; JSON export/import is the prototype's explicit transfer mechanism |
| Provider credentials | No credentials in committed source; optional Google 3D uses external runtime configuration and all provider failures have usable fallbacks |
| Lens curves | First prototype provides calculated lens-coverage boundaries and separate editable movement paths; advanced optical simulation is Phase 8 |
| Treedis research instrumentation | Phase 6 after prototype completion; passive capture precedes separately approved manipulation, and normal users never contact the research service |
| Name and interface | Use **SLiVR** as the working product name with a neutral, high-contrast filmmaking interface and no LSU branding |
| Research record | Maintain versioned HCI/VR feature, decision, measurement, change and limitation records; participant logging is off by default and requires a separate approved protocol and consent |
| Full-system verification | Maintain `docs/FULL-SYSTEM-TESTING.md`; each phase updates and executes its applicable tests plus standing regression, with no pre-marked results |

## 12. Claude CLI planning handoff

Use [CLAUDE_CLI_PLAN_MODE_PROMPT.md](CLAUDE_CLI_PLAN_MODE_PROMPT.md) from `E:\sroberto27.github.io\SLiVR` to begin the next step. The prompt makes this guide the controlling specification, identifies the read-only LSU3D reference and supporting evidence, requires a dependency-based plan for essential Phases 0–5 plus the separate post-prototype Phase 6 research pipeline, and forbids implementation while Claude CLI remains in plan mode.

The first Claude response should be a reviewable implementation plan rather than code. It must report contradictions, missing inputs and unverifiable provider assumptions explicitly; those items become validation tasks or blockers only when they prevent the relevant phase exit gate. Later-roadmap features must not enter the prototype plan unless the user revises this guide.


### 2026-09-20 owner-directed deployment exception (D057)

For the shared GitHub Pages prototype, the owner explicitly requested reuse of
the existing reference application's Google Maps browser key and publication of
the 3D fix. `config/deployment.js` ships that public browser configuration instead
of the ignored runtime.js. This narrowly supersedes section 6.2.2's prohibition
on committed provider credentials for this browser key only. Provider access and
rendering are left for the owner's manual testing after push; no live success
is claimed.
