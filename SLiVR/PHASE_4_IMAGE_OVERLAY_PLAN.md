# Phase 4 revised plan: image-overlay Shot Designer

Date: 2026-09-26. Decision: D090.
Status: owner approved implementation on 2026-09-26; resumed after a requested
pause. D091 records the implemented local build and pending owner acceptance.
The owner explicitly directed Google screenshots with attribution. This replaces
the implementation hold below; it is owner direction, not a new legal finding.

Phase 3 remains COMPLETE under D089, published as 3237867b. Preserve all owner
passes, E2 entry-only bookmarks and E1's Phase 4 shot / Phase 5 integrated split.
Baseline was app0.3.7/transfer1.3.0. Current local build is app0.4.0, DB2,
transfer1.4.0, template1.0.0, catalog1.1.0.
The recorded 409 automated passes belong to D089; no new tests ran for this plan.

## 1. Product outcome

Frame a location in Explore's existing aerial or 3D map, press Shot Designer,
and use a still image of that view as the background for editable shot diagrams.
All cameras, actors, arrows, marks, labels and movement paths are 2D overlay
objects. A capture of a 3D map is still a flat image in this editor.

No second perspective viewport, reconstructed scene, live tile stream or
authored 3D geometry is required in Shot Designer. Explore retains its current
2D/3D map and Immersive choices. The screenshots are workflow references only;
do not ship private example images or infer their dimensions.

This proposal replaces the prior dual-view Phase 4 design after approval.
Unchanged project, evidence, privacy, persistence and lifecycle requirements
continue to apply. Earlier specification text is retained as history where
explicitly superseded by this proposal.

## 2. Entry, capture and return

- With no existing design selected, Shot Designer starts a new diagram draft
  from the current Explore map view when that source permits capture.
- With an existing design, present Open existing design and New diagram from
  current view. Never silently replace a saved background.
- Capture the underlying map canvas at its current dimensions, centre, zoom,
  bearing and pitch before disposing the map. Exclude browser/site controls,
  floating panels and catalog pins. Preserve visible map content and required
  source attribution. Do not refit, recenter or substitute a north-up bbox image.
- Capture current rendered content only once ready. Freeze the requested view;
  bounded waiting, cancel/retry and generation checks prevent a later selection,
  resize or provider switch from attaching the wrong background.
- Keep source/year, capture timestamp, original pixel dimensions, map view
  metadata and applicable attribution alongside the image. Capture time is not
  the imagery acquisition date. Never persist API keys or credentialed URLs.
- If capture fails, retain Explore and its drafts; offer retry, an owned image
  or blank canvas. No silent blank screenshot, substitute provider or orphan
  record. An unready or restricted Google source must be explained explicitly.
- Immersive is not a screenshot source. From a tour or absent map, offer return
  to the location's map, an owned image, blank canvas or an existing design.
- Carry project/scene/candidate/location IDs where known. Resolve ambiguous
  ownership explicitly. A standalone draft must be deliberately saved/attached;
  merely visiting the tab must not manufacture persistent projects/candidates.
- Return to Explore restores prior selection/view and retained checklist state.
  Flush pending changes before leaving; failed saves retain the working draft
  and offer retry/emergency export.

## 3. Interface

Keep Explore and Shot Designer as the two top destinations. Shot Designer uses
a large single canvas; no permanent left/right multi-column editor is required.

- Compact toolbar: back to Explore, design/context, save status, Add, Layers,
  undo/redo, background, variants, shot list and export.
- Add menu: camera, actor/stand-in, vehicle, prop, mark, arrow, annotation and
  simple wall/set shape. Symbol shapes belong to SLiVR's own interface.
- Layers menu: show/hide and lock/unlock categories/objects; background locked
  by default; adjustable background opacity and clear selection feedback.
- Selecting an object opens a compact properties panel. Canvas and list
  selection agree; overlapping objects can be cycled without precision dragging.
- Collapsible shot list contains camera/setup, description, lens/aspect,
  movement, duration, status and notes; shot ordering is separate from scene
  identity. Variants store alternative complete arrangements.
- Compact play/pause/restart/scrub controls animate symbols along image paths.
  Reduced-motion preferences suppress unsolicited motion.
- Mobile/tablet: one canvas and one active sheet/menu at a time, usable touch
  targets and numeric/keyboard alternatives. Opening a keyboard or rotating
  the device must not move authored objects relative to the background.
- Preserve Explore's D086-D088 V2 styling, responsive panels, automatic location
  following, pin/follow selection, dated-assessment memory and save guards.

The supplied Pages menu is a visual reference, not a promise of a separate
automated page system. Shots and variants provide the core organization here;
storyboard/page automation and lighting simulation are not added by screenshots.

## 4. Editing scope and accuracy

Keep selection, drag/numeric position and rotation, resize, duplicate, group,
delete, lock/hide, optional grid/snap, arrows/numbered marks, annotations,
straight/smooth/spaced curves with editable control points, undo/redo, deterministic
preview, autosave, shot list, named variants, PNG, safe CSV and JSON transfer.

Camera identity is distinct from a numbered setup. One camera may have multiple
marks/setups without moving its other setups. Actor paths and camera paths stay
independent unless explicitly grouped. Shot list and diagram share references,
not competing copies. Preview is evaluated from saved inputs and time, without
rewriting the saved arrangement on each frame.

Lens, sensor/gate, crop/aspect, camera height, pan/tilt/roll and focus notes can
remain shot metadata. Existing ideal rectilinear FOV calculations remain useful
as numeric information. A drawn coverage wedge is schematic on a screenshot;
it does not predict an actual perspective view or hidden geometry.

Use image coordinates (original-image pixels, top-left origin, +x right, +y
down) for authoring, separate from CSS pixels and display zoom/pan. Store object
angles in a documented image convention. Use the same canvas transform for
background, hit testing, overlays and preview; resizing never rewrites objects.

Owned flat plans may retain known-distance calibration with source, units,
control points, independent check and version. Oblique/tilted screenshots remain
schematic: no global metres-per-pixel scale, clearance claim or projected FOV
claim. North is shown only when meaningful and supported by source orientation.
Aerial source resolution or a map scale bar is not surveyed scene accuracy.

Background replacement is explicit and previewed. Default to a new variant
of work retaining the old background and arrangement; reuse of existing overlay
positions requires review. No automatic alignment across different screenshots.
Plan recalibration likewise preserves the earlier background/calibration version.

Deferred: authored 3D scenes/frustums, synthetic film-camera view, 3D
measurements/occlusion, perspective reconstruction, advanced animation,
physics, realistic actors, optical simulation, proprietary file compatibility,
Treedis object placement/capture, cloud collaboration and field capture.
Phase 5 retains native media ZIP, print/PDF packets and integrated release work.

## 5. Project data and evidence

Extend existing repositories and versioned transfer, not a second database.
Proposed additive records/fields (final schema names are implementation choices):
diagram coordinate-space discriminator; background asset with dimensions,
provenance/rights and view metadata; overlay objects; camera/setup links;
paths/timing; shot entries; layer/group state; immutable variant contents;
background/calibration revision; selected assessment evidence references.

Do not reinterpret existing local ENU records as pixels. Preserve legacy records
and identifiers through explicit migrations. Existing schematic linked workspaces
can acquire a new image diagram; any existing spatial content must be preserved
and reported rather than silently flattened or discarded.

Use existing project/scene/candidate ownership. Findings refer to assessment ID,
revision and question, with compatible owned media/bookmarks. Later changes flag
stale evidence; prior decisions remain intact. Observations never auto-calibrate
the diagram. Test 213 remains required.

Persist allowed background bytes and authored records atomically. Validate file
type, decoded dimensions, byte/pixel limits and ownership; release image URLs.
Define concrete limits and test fixtures before implementation. Variant restoration
includes its background, objects, setups, paths, shots and calibration, not just
a name. Remap all owned references on copy import, with no dangling paths/shots.
JSON must include allowed background bytes for reliable reopening; data-only or
missing-image transfer is clearly reported. Emergency export keeps valid in-memory
edits and identifies unrecovered media. Ordered saves and meaningful command
boundaries protect undo/autosave interleaving. No schema version bump in this turn.

## 6. Capture feasibility and source-use gate

Read-only reconnaissance, 2026-09-26; no browser capture executed.

SLiVR uses MapLibre 4.7.1. Its pinned upstream source documents the top-level
preserveDrawingBuffer option for canvas export; it defaults to false. Current
src/map/maplibre-adapter.js:221 does not enable it or expose screenshot capture.
Do not use newer-version option names without checking the pinned version.
Test a render-synchronized readback first; if a preserved buffer is required,
measure its cost before choosing it. Do not introduce an invisible second map
with duplicate provider sessions merely to evade this question.

Google tiles already render into the same map canvas through the custom layer
in src/map/google-tiles.js:95-125. Reading that canvas is a plausible technical
path, not proof of a complete/exportable frame. Map controls, markers and
attribution can be DOM elements outside the canvas; attribution needs explicit
composition. Continuous 3D repaint means an unbounded wait for map idle is
unsuitable. Verify loading completion, timeout, origin-clean readback, device
pixel ratio, image decoding and context-loss recovery after implementation approval.

Source-use findings:
- DOTD 2025 primary and 2024 Lafayette fallback both publish reuse permission
  for products/publications, with accuracy limitations. Plan to retain attribution
  and year. Check any additional visible street/label layer separately.
- Google Map Tiles policy restricts content storage and offline use, subject to
  the applicable agreement. The reviewed material does not establish permission
  for durable Google-derived screenshot backgrounds in IndexedDB/JSON/PNG.
  General consumer Google Maps screenshot guidance is not sufficient evidence
  for this application's Map Tiles API workflow.
- Historical proposal: keep Google snapshot capture/storage/export unavailable
  until applicable permission is established. Superseded for implementation by
  the owner direction recorded in D091; the policy interpretation remains a limitation. Do not assume local-only or manual
  screenshot import removes provider restrictions. Retain the requested Google
  entry path as a conditional acceptance requirement; do not silently drop it
  or claim full Phase 4 completion without resolution or an owner-approved
  narrower delivery exception.
- DOTD, permitted owned images and blank diagrams provide the proposed
  independent implementation track. Existing Google Explore viewing is unchanged.

Sources checked:
- [MapLibre 4.7.1 map options](https://github.com/maplibre/maplibre-gl-js/blob/v4.7.1/src/ui/map.ts)
- [DOTD primary metadata](https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer)
- [DOTD fallback metadata](https://maps.dotd.la.gov/imagery/rest/services/Imagery/2024_Lafayette_6IN_RGBI/ImageServer)
- [Google Map Tiles policy](https://developers.google.com/maps/documentation/tile/policies)
- [Google geo guidelines](https://about.google/brand-resource-center/products-and-services/geo-guidelines/)

## 7. Reference reuse and deviations

Both references were inspected read-only in this planning session.
- LSU3D js/16-google-tiles.js:46-52,147-209,453-475: generation guards,
  coordinate/camera derivation and shared MapLibre WebGL rendering. Preserve
  the already adapted Explore integration; no new shot-specific tile renderer.
- LSU3D js/06-details-panel.js:5-40 and Experimental
  js/06-details-panel.js:6-43: panel visibility and exclusive mobile sheets;
  extend SLiVR's existing accessible tool lifecycle.
- Experimental js/03-tour-bridge.js:55-67 and js/04-street-view.js:9-23:
  existing preferred Treedis lifecycle source; no screenshot bridge or new
  provider session is introduced.
- No toDataURL/toBlob/preserveDrawingBuffer capture counterpart was found in
  either reference's js directory. Neither supplies a persistent overlay editor.
- SLiVR domain/shot-scene.js, shot.js, variant.js, spatial/optics.js,
  data/workspace-repo.js, data/transfer.js and scouting/autosave.js provide
  reusable foundations, but not a finished pixel-space editor.

Deviation reason 1: owner-requested image-overlay architecture replaces the
dual-view scene and forbids inference of 3D geometry from screenshots.
Reason 3: capture handoff and image-overlay editor have no reference counterpart.
The old Phase 4 shared-context obligations still protect Explore's Google
renderer; they no longer require a second editor 3D surface. No reference edits.

## 8. Implementation order after explicit approval

1. Resolve source-use gate and prove bounded exact-view capture with allowed
   sources; document Google condition. Verify render timing and attribution.
2. Finalize image-coordinate schema, ownership, legacy preservation, versioned
   background assets and JSON/emergency portability.
3. Build command stack, ordered autosave and canvas pan/zoom/selection.
4. Add object symbols, transforms, groups, layers, lock/hide and grid/snap.
5. Add distinct camera setups, shot metadata, numeric FOV and schematic wedges.
6. Add numbered marks, independent editable paths and deterministic preview.
7. Add shot-list editing/order and complete named variant restoration.
8. Add owned-plan import/calibration and explicit background replacement.
9. Connect assessment findings and all navigation/save-failure guards.
10. Complete PNG/CSV exports, regression and narrowly scoped new live acceptance.

The original plan update authorized documentation only. The subsequent owner
approval authorizes runtime implementation. Telemetry, staging, commit and push
remain unauthorized. Inspect Git again before implementation. Work only in SLiVR;
do not push the current branch's unrelated history.

## 9. Acceptance mapping (proposal, all new tests NOT TESTED)

Keep existing IDs and past results intact. Add tests 237-248 in the living test
specification. Approval of this plan will supersede incompatible dual-view
requirements, not mark their original tests passed.

| Earlier gate | Proposed disposition |
|---|---|
| 85-86,89,94,97,99,103 | 237-241,245-246 replace dual-view/background/coordinate expectations |
| 90-93,100-102,104-106 | Retain underlying identity/commands/preview/shot/variant requirements; add 240-242 for image coordinates and complete backgrounds |
| 95-96,98 | Retain numeric optics validation; 241 verifies no physical projection claim and image-angle boundaries |
| 107-111 | Retain owned-flat-plan principles; 243 tests image replacement and oblique limitations |
| 112 | 248 replaces the spatial downtown recreation with an image-overlay scenario |
| 118,119,121 | Retain PNG readability, safe CSV and filenames; extend with 246 |
| 213 | Retain assessment revision/ownership contract; extend with 244 |
| Part J 172-183 | Run against new build; 172 uses D086's two destinations; 177 uses overlays; print/PDF portion of 178 remains Phase 5 |
| 44,77-79,179,208,232-236 | Focused changed-build handoff and checklist regression; earlier owner passes remain accepted |

Required new live acceptance: capture the exact permitted map view; edit and
reopen the downtown two-camera example; check compact desktop/tablet/mobile and
keyboard use; verify image alignment after zoom/resize; recover from capture,
provider and storage failure; inspect PNG and CSV in their actual viewers.
Google end-to-end capture requires both permission resolution and a successful
live result, or a separately approved scoped exception with retest condition.
Record automated, live and owner evidence separately with exact build/context.

## D091 path presentation refinement

Actor and camera symbols repeat at each step. Step numbers are inside the symbol
with a text outline, without a separate white badge. Camera connecting and offset
directional lines are neutral/dark; actor path lines retain actor color. Each leg
has a direction arrow. The per-path Straight / Smooth curve / Spaced curve setting
preserves authored steps. Spaced curves bow automatically between steps; they do
not perform global obstacle avoidance. Playback and PNG use the same geometry.
Existing paths without the new optional style retain their previous setting.
