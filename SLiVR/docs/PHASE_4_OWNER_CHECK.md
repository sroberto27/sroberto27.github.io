# Phase 4 critical owner checks

App0.4.0, transfer1.4.0, DB2; D091 core and D092 menus. Owner acceptance pending.
Earlier Phase 3 owner passes remain accepted. Check only these new/changed flows.
Wait for Saved locally and export Diagram JSON as a backup before refreshing an
existing working diagram. Use a fresh tab to load the latest modules if needed.

1. **Paths and symbols (240/242/249).** Open your downtown diagram. Every actor
   and camera step should repeat its icon, with its number inside and no white
   number badge. Camera paths use two dark lines, with arrows showing direction.
   Select a camera, find Path line style in Properties, and try Straight, Smooth
   curve and Spaced curve (automatic). Icons must stay in place. Repeat on an
   actor path; its line retains the actor color. Try reverse, play/pause/reset
   and moving one step. Spaced curves may still cross other objects; they are
   automatic bows, not global obstacle avoidance.
2. **Map capture and return (237-239).** Frame a location in aerial mode, enter
   Shot Designer and make a new diagram. The same view should appear without
   Explore controls/pins and with source attribution. Repeat from Google 3D;
   check the image is the 3D view and includes Google/source attribution. An
   unavailable capture must show an error/retry choice. Reopening an existing
   diagram must not replace its background. Return to Explore: check selection,
   view and the existing checklist follow/pin behavior.
3. **Editing and durable save (240-242/245).** Add a second setup of a camera,
   an actor path and two shot descriptions. Change lens/rotation, duplicate,
   lock/hide, undo/redo. Save a named variant, edit, restore it, then wait for
   Saved locally and reload. The design, paths, camera setups, shot list and
   background must survive. A locked object must not move or be deleted.
4. **Project/evidence connection (239/244).** Attach a test diagram to the chosen
   project/scene. Link a dated scouting answer under Evidence. The displayed
   value and note must match that revision. Update the assessment and return:
   the older linked revision remains, with a newer-evidence notice. The diagram
   must not alter the V2 checklist, its location follow/pin selection or answers.
5. **Backup, image and exports (243/245/246).** Export Diagram JSON and PNG plus
   shot-list CSV. Open PNG and CSV: symbols, numbers, arrows, text, descriptions
   and attribution must be readable. Import the diagram JSON into a separate
   blank diagram and compare it. If using owned plans, try image preview/rotate,
   cancel/replace and flat-plan calibration; the old arrangement must remain in
   a variant, and an oblique image must not offer measured scale.
6. **Small-screen usability (247).** Use a narrow browser/tablet/phone. Open Add,
   Properties and Shots one at a time, pan/zoom and resize/rotate. Controls must
   remain reachable and overlays must stay aligned with the image. Use numeric
   fields or Add path step where dragging is awkward.

Report the number and any failure, ideally with the action that triggered it.
Do not repeat earlier accepted tests unless one of these flows exposes a regression.
Physical-device results are separate from desktop browser results.

7. **Menu review (250).** On desktop and phone width, try Add, Layers, Edit,
   Shots and More. Select two layer checkboxes, hide/lock one object, edit several
   properties consecutively, and use undo/redo. Check Tab focus, Escape/Close,
   sheet Expand/Collapse and More > Preview. Reload after saving and confirm the
   same arrangement. Report usability issues; no broad repeat of earlier passes.

## Owner result and new addition (2026-09-27)

Owner reports checks 1-7 PASSED on the published D091/D092 build. Preserve these
results; repeat only a flow affected by a reported regression.

8. **Immersive screenshot (251, new and pending).** Open an immersive location
   and frame a view. Click Shot Designer > New diagram from immersive view.
   In the browser sharing prompt, choose the current SLiVR tab. The diagram
   should contain the viewer image and its visible provider credits plus source
   footer, without SLiVR panels; sharing should stop immediately. Add an actor
   and camera path, wait for Saved locally, then export JSON/PNG and reload.
   Back should return to the immersive location; exact camera pose restoration
   is not promised. Also cancel the sharing prompt once and confirm retry works.
   Choosing a different tab/window must fail without creating an incorrect
   diagram. Unsupported browsers use Blank / imported-image diagram instead.
