# GIS Phase 5 CMS testing — Admin Board GIS editors

Manual testing handoff for Phase 5 (`06-SPEC-cms-admin.md`): the Admin Board's new
GIS Maps section — field builders, the experiences editor, map/layer/tour/sources
editors, the live preview, and export. Same shape as
`docs/plans/gis/GIS-FULL-SYSTEM-TESTING.md` — fill in as you go.

**Nothing in this document has been marked as tested.** Every checkbox below is
unchecked. Leave "Not tested" checked (or all three unchecked) for anything you
skip, and use the Comments line for anything that doesn't cleanly pass or fail.

Everything below was verified two ways before this handoff: by reading the code
against `06-SPEC-cms-admin.md`/`04-SPEC-gis-engine.md`/`05-SPEC-guided-tours.md`,
and by a headless (jsdom, no real browser) harness that signs into the real Admin
Board, loads the real `data/` documents, and clicks through every new nav entry and
several buttons, watching for uncaught exceptions and checking specific outputs
(boundary-layer dropdown population, delete-guard warning text, the legacy-migration
byte-identical check, the export fail-loud path). That harness cannot render CSS,
Leaflet, or real network calls — this document is what closes that gap.

## Setup

- Serve the site locally: `python -m http.server 8000` from the repo root. Use
  plain `python`, not `python3`.
- Base URL: `http://localhost:8000/index.html`
- Admin sign-in: click "Access Your Twin", sign in with `dtsAdmin` /
  `CHANGE_ME_BEFORE_DEPLOY` (from `data/access/access.json`).
- Open the browser console before you start and leave it open all session.
- The GIS content under test is the real `iberia-coastal` map and its
  `iberia-coastal-intro` tour — the same documents Phase 3/4 tested live on the
  Government → Coastal Resilience project.

---

## 1. Field builders (06-SPEC §1)

These are exercised throughout the sections below rather than in isolation — check
them as you hit them in the map/layer/tour editors.

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Number fields (`fNumber`) accept and save numeric input, including min zoom, mask opacity precursors, etc.
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Range sliders (`fRange`) show a live value readout that updates while dragging (opacity, fill opacity)
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Ordered lists (`fListOrdered`) — ▲▼ buttons reorder items, disabled correctly at the ends
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Key/value editor (`fKeyValue`) — not directly wired into any Phase 5 UI yet (available for a future use); skip or spot-check in isolation if you want
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Document pickers (`fDocPicker`) — the Map/Guided tour dropdowns in the experiences editor and tour editor list real documents, not blank
      Comments: ___________________________

---

## 2. Project experiences editor (06-SPEC §2)

### 2.1 Legacy project shows correctly, untouched
Open any of the 16 pre-GIS projects (e.g. Education → Campus). Confirm "Main
experiences" shows exactly one experience, correctly populated from the old single
`media` field (type, label, URL/embed all correct). **Do not edit anything.** Close
the project (navigate elsewhere).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Legacy project's single experience displays correctly
      Comments: ___________________________

### 2.2 Legacy migration only happens on a real edit
Confirmed by the automated harness this session: opening `campus.json`'s editor and
navigating away without touching anything leaves `project.experiences` absent and
`project.media` untouched (a byte-identical export would result). To verify this
yourself: open a legacy project, change nothing, use Export data folder, and confirm
that project's exported JSON still has `media`, not `experiences`. Then go back,
actually edit the Tab label, export again, and confirm it now has `experiences`
instead.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Untouched legacy project exports with `media`, unchanged
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Editing one field migrates it to `experiences` on export
      Comments: ___________________________

### 2.3 Add / remove / reorder experiences
On any project, click "+ Add experience" twice (creating two Treedis-type entries).
Change the second one's Type to "GIS map" and confirm the fields swap to Map/Guided
tour on open. Reorder them with ▲▼. Remove one.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Add experience creates a working new entry
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Changing an experience's Type swaps its fields to match
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Reorder and remove work
      Comments: ___________________________

### 2.4 Short id validation and "Open this one first"
With 2+ experiences, give two of them the same Short id and confirm a warning
appears live. Fix it and confirm the warning clears and a deep-link preview shows.
Click "Open this one first" on a non-default experience and confirm it becomes the
only one checked.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Duplicate short id shows a live warning
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: "Open this one first" radio is mutually exclusive
      Comments: ___________________________

### 2.5 GIS experience end-to-end on the live site
On the GFC project (Government → Coastal Resilience), confirm its GIS experience
(mapId `iberia-coastal`, tourId `iberia-coastal-intro`) still shows correctly in the
editor, with no "belongs to a different map" warning. Save draft & preview, confirm
the Parish map tab still opens correctly on the live site afterward.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: GFC's real GIS experience edits cleanly, no false mismatch warning
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Save draft & preview — Parish map tab still opens correctly
      Comments: ___________________________

---

## 3. GIS nav, add/delete map and tour (06-SPEC §3)

### 3.1 Nav structure
Confirm a "GIS MAPS" section appears in the left nav below Projects, listing
"Iberia Parish — Coastal Resilience" with "Iberia Parish: land, water, and risk"
nested under it, a "+ New map" button, and a "Data sources" entry.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: GIS Maps nav section matches expectations
      Comments: ___________________________

### 3.2 Create and delete a map
Click "+ New map", give it an id. Confirm it opens with sensible defaults (2
basemaps including "No basemap", all tools on, empty layers). Delete it via the
Danger zone button and confirm the confirm-dialog text is accurate (no references,
since nothing points to it yet) and it disappears from the nav.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: New map created with sensible defaults
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Deleting an unreferenced map has no false warnings
      Comments: ___________________________

### 3.3 Delete guard — a referenced, gated map
**Do not actually confirm this one** (or revert after) — on the real
`iberia-coastal` map, click "Delete this map" and read the confirm dialog. Confirm
it correctly names "Coastal Resilience — Gulf Futures Challenge" as a referencing
project and correctly says its 1 guided tour will also be deleted. Click Cancel.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Delete-map warning names the real referencing project and tour count correctly
      Comments: ___________________________

### 3.4 Create and delete a tour
On a test map, click "+ New tour". Confirm it opens the tour editor with the map
pre-selected. Delete it and confirm the map's own "Guided tours" list and
`defaultTour` picker update correctly.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: New tour created against the right map
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Deleting a tour cleans up the map's tour list/default cleanly
      Comments: ___________________________

---

## 4. Map editor (06-SPEC §4)

Use a **test map** (create one via "+ New map") for anything destructive; use the
real `iberia-coastal` map for read/inspect checks unless a step says otherwise.

### 4.1 Map / Default view
Edit Title/Subtitle/Attribution. Confirm the Id field is read-only. In Default view,
try both "Center + zoom" and "Bounding box" modes and confirm switching between them
doesn't lose the other fields' current values weirdly. Try "Set from current
preview" (see §9 below — needs the preview mounted).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Map/Default view fields save correctly
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: View shape toggle (center+zoom ↔ bbox) works cleanly
      Comments: ___________________________

### 4.2 Parish boundary
Confirm the Boundary layer dropdown lists every real layer's title (16 on
`iberia-coastal`) and is correctly set to "Iberia Parish boundary". Toggle the dim
mask checkbox and drag the opacity slider.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Boundary layer dropdown populated and correctly selected
      Comments: ___________________________

### 4.3 Basemaps
Confirm all 4 real basemaps show (Streets, Aerial 2024, Satellite (global), No
basemap) with the correct default radio on Streets. Add a basemap, try removing all
but one and confirm it's blocked ("A map needs at least one basemap").
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Real basemaps list correctly, default is Streets
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Can't remove the last basemap
      Comments: ___________________________

### 4.4 Layer groups + reassignment guard
Confirm all 7 real groups show. On a **test map** with 2+ groups and layers
assigned, try deleting a group that has layers in it — confirm it prompts asking
where to move them, and that choosing a target actually reassigns those layers'
Group field. Try deleting the last remaining group while layers still reference it
— confirm it's blocked with an explanatory message.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Deleting a group with layers prompts for reassignment and actually reassigns
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Deleting the last group with layers still on it is blocked
      Comments: ___________________________

### 4.5 Tools grid
Confirm all 20 tools show as checkboxes with one-line descriptions, matching the
real map's current on/off state exactly — every tool is on for `iberia-coastal`
except `miniMap` (off).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Tools grid matches the real document's current state
      Comments: ___________________________

### 4.6 Bookmarks
Confirm all 4 real bookmarks show (New Iberia, Avery Island, Port of Iberia,
Vermilion Bay shoreline — note the last one is a bounding box, not center/zoom;
confirm it displays correctly in "Bounding box" mode). Add one via "Set from
current preview".
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: All 4 real bookmarks display correctly, including the bbox-shaped one
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: "Set from current preview" adds a working new bookmark
      Comments: ___________________________

---

## 5. Layer editor (06-SPEC §4, "the big one")

### 5.1 Add a layer against a real ArcGIS service
On a test map, click "+ Add layer". Set Source type to "ArcGIS feature layer",
paste a real service URL (e.g.
`https://maps.iberiagov.net/server/rest/services/Govt_Units/Updated_Parish_Boundary/MapServer`),
set Sublayer index to `0`, click **Test connection**. Confirm it reports a real
service name, sublayer count, and SRS, with "CORS allowed this request."
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Test connection succeeds against a real, CORS-open service
      Comments: ___________________________

### 5.2 Test connection against a CORS-blocked / bad URL
Point Service URL at something unreachable or CORS-blocked (or just a typo'd URL).
Confirm the failure message is the plain-language CORS explanation, not a raw stack
trace or unhandled rejection in the console.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Test connection failure shows a clear, non-technical message
      Comments: ___________________________

### 5.3 Load fields from service
On the same real layer from 5.1, click **Load fields from service**. Confirm it
populates the Fields to show list with real field names/aliases (NAME, AREA,
EFF_DATE, VINTAGE for the parish boundary), skipping OBJECTID/Shape/etc.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Load fields from service populates real, sensible fields
      Comments: ___________________________

### 5.4 Reordering layers changes zIndex (draw order)
On a test map with 3+ layers of known zIndex, use ▲▼ to swap two adjacent layers.
Confirm (via the live preview, see §9) that their draw order visibly swaps, and
that no *other* layer's stacking changed.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Swapping two layers in the list swaps their draw order in the preview
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Swapping only affects the two swapped layers, not the rest
      Comments: ___________________________

### 5.5 Style / legend / popup sections
On a vector layer (geojson or esriFeature), confirm the Style section (line/fill
color, weight, opacity, point radius) is present and saves. Set Legend to "Custom"
and add a legend row. Toggle "Clickable" and edit Popup title/fields.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Style fields save and are reflected in the preview
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Custom legend rows save
      Comments: ___________________________

### 5.6 Known cosmetic finding — not a functional bug
Opening the real `iberia-coastal` map's editor adds an empty placeholder
`popup: {title:"",fields:[],linkField:null}` object (and, for 3 non-vector layers,
an unused `style` object) to any layer that doesn't already have one, the moment
that layer's card is rendered — confirmed by reading `js/gis/gis-tools.js`'s own
popup-fields fallback (an empty `fields` array is treated identically to a missing
`popup` field, so this changes no rendered behavior), but it does mean an export
taken after touching *anything else* on the same map will carry this extra,
functionally-inert JSON on ~7 of the 16 real layers. Not chased further this phase
— flagging so it isn't mistaken for a new bug later.
- [ ] Confirmed as described  [ ] Behaves differently — Test: exporting after an unrelated edit adds harmless empty popup/style objects to untouched layers
      Comments: ___________________________

---

## 6. Tour editor (06-SPEC §5)

### 6.1 Tour settings
Open `iberia-coastal-intro`. Confirm Title/Intro/autoStart/autoAdvance/position/
showProgress all show the real values correctly (autoStart on, position "left").
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Tour-level settings match the real document
      Comments: ___________________________

### 6.2 Steps show correctly
Confirm all 6 real steps show with correct titles, and the word counter reads
correctly per step (flagging red if any exceed ~55 words — none of the real steps
should).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: All 6 real steps display with correct content and word counts
      Comments: ___________________________

### 6.3 Capture current view
On a **test tour** (don't do this against the real one unless you're prepared to
revert), drive the live preview map somewhere (pan/zoom, toggle a couple of
layers), then click "Capture current view" on a step. Confirm the saved-state
summary line updates and the "Layers on for this step" checkboxes reflect what you
had on. Uncheck "Hide all other layers" and confirm the step's `layers.off`
becomes `[]` instead of `["*"]`.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Capture current view correctly saves position, zoom, basemap, and layer state
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: "Hide all other layers" checkbox correctly toggles between off:["*"] and off:[]
      Comments: ___________________________

### 6.4 Preview this step
On any step, click "Preview this step". Confirm the live preview map actually
changes to that step's view/layers/basemap/highlight — the same way the real tour
player would apply it (view + layers + basemap + highlight, not just a center jump).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Preview this step correctly drives the preview map
      Comments: ___________________________

### 6.5 The 'water' step's bounding-box view survives
Step 2 ("The water that drains it") uses a bounding-box view (`bbox`), not
center/zoom, in the real document. Confirm opening the tour editor shows it
correctly in "Bounding box" mode with the right 4 numbers, and that **not touching
it** keeps it that way (doesn't silently convert to center/zoom).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: The real bbox-shaped step displays and survives untouched
      Comments: ___________________________

### 6.6 Highlight and CTA action editor
On a step, set Highlight to a real layer and edit its where-clause. In the Ending
section, try each of the 5 outro button actions (Open the layer panel / Open the
attribute table / Start another tour / Open a link / Exit the tour) and confirm the
parameterized ones (Start another tour, Open a link) show the right secondary field
and save a correctly composed action string (e.g. `link:https://…`).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Highlight editor works
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: All 5 CTA action kinds work, including the two parameterized ones
      Comments: ___________________________

---

## 7. Data sources editor (06-SPEC §6)

### 7.1 Candidate layers show correctly
Open Data sources. Confirm all 13 real candidate layer entries show (parish
boundary, hydrography, flood risk, infrastructure exposure, parcels, address
points, nursing homes, imagery 2013/2024, CPRA projects, CPRA master plan, CPRA
shorelines, subsidence) with their real field values intact. Confirm the harvested
ones show their harvest notes and either a single Harvested file or a Harvested
files list (shorelines) correctly.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: All 13 real candidate layers display correctly with real data intact
      Comments: ___________________________

### 7.2 Open questions
Confirm all 5 real open questions show (Iberia terms of use, CPRA/CIMS terms of
use, factsheet retrieval, parcels decision, nursing homes decision) with correct
status text and blocked-layers lists.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: All 5 real open questions display correctly
      Comments: ___________________________

### 7.3 Export sources document
Click "Export sources document". Confirm a Markdown file downloads, and that it
contains a real candidate-layers table and the open questions — a reasonable,
reviewable summary, even if it won't be identical to the hand-written
`docs/GIS-DATA-SOURCES.md`.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Export sources document downloads a sensible Markdown file
      Comments: ___________________________

### 7.4 sourceRef picker on a layer
Back in the layer editor, confirm the "Data source (provenance)" dropdown lists the
13 real candidate layers' source ids (not the sources document itself), and that a
real layer's current `sourceRef` (e.g. `iberia-parish-boundary` on the parish
boundary layer) shows correctly selected.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: sourceRef picker lists real candidate layer ids and selects correctly
      Comments: ___________________________

---

## 8. Live preview (06-SPEC §7)

### 8.1 Preview mounts and reflects unsaved edits
Open the real `iberia-coastal` map. Confirm the preview panel mounts a real map
(not stuck on "Loading preview…"). Toggle a layer's "Visible by default" checkbox
in the form and confirm the preview updates within ~400ms without a full page
reload or losing your scroll position in the form.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Preview mounts the real map correctly
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: A structural edit (layer added/removed/rewired) re-mounts the preview within ~400ms, debounced (not once per keystroke)
      Comments: ___________________________

### 8.2 Non-structural edits don't thrash the preview
Type into the Title field character by character. Confirm the preview does **not**
re-mount/flicker on every keystroke.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Typing in a text field doesn't re-mount the preview
      Comments: ___________________________

### 8.3 Mobile collapse
Resize the browser to ~500px wide. Confirm the preview collapses to a "⛶ Preview
map" button rather than staying permanently docked. Click it and confirm it opens
fullscreen; click again (or however the toggle works) to close it.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Preview collapses to a button on narrow viewports and opens fullscreen on tap
      Comments: ___________________________

### 8.4 Preview torn down on navigation
With the map editor's preview mounted, navigate to a different pane (e.g. Home
page). Reopen the map editor and confirm a fresh preview mounts cleanly (no
duplicate/ghost map, no console errors about a detached Leaflet instance).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Leaving and returning to the map editor remounts a clean, single preview
      Comments: ___________________________

---

## 9. Export (06-SPEC §8)

### 9.1 Export includes harvested layers
With the real `iberia-coastal` map present (its 5 shoreline layers + parish
boundary all point at real files under `data/gis/layers/`), click "Export data
folder". Unzip the result and confirm `data/gis/layers/parish-boundary.geojson`
and the 5 `shoreline-*.geojson` files are present and match the real files on disk.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Exported zip includes all 6 real harvested layer files, correct paths
      Comments: ___________________________

### 9.2 Export fails loudly on a missing layer file
Temporarily rename or move one of `data/gis/layers/*.geojson` (e.g.
`shoreline-2015.geojson`) so it 404s, then click Export. Confirm you get a clear
alert naming the failed file and that **no `data.zip` downloads at all** — not a
zip missing that one file. Restore the renamed file afterward.
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: A missing harvested layer file blocks the entire export with a clear message
      Comments: ___________________________

### 9.3 Manifest and contentVersion still bump correctly
After any export, confirm `manifest.json`'s `contentVersion` changed from what it
was before (busts the per-document cache in content-loader.js, unchanged Phase 5
behavior).
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: contentVersion is freshly stamped on every export
      Comments: ___________________________

---

## 10. 06-SPEC §9 acceptance criteria (the phase's real bar)

### 10.1
An editor can create a map, add a layer by pasting an ArcGIS REST URL, click Test
connection, load its fields, and see it on the preview — without leaving the board.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

### 10.2
Reordering layers changes draw order in the preview.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

### 10.3
An editor can build a five-step tour entirely by driving the preview map.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

### 10.4
Attaching the map to a project via the experiences editor makes it appear as a tab
on the live site after Save draft & preview.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

### 10.5
Delete guards work: deleting a map warns about projects referencing it; deleting a
group asks where its layers go.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

### 10.6
Export produces a zip whose `data/` folder, dropped into the repo, reproduces
exactly what the editor previewed.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

### 10.7
No console errors when the Admin Board opens on a site with zero GIS documents.
This one is hard to test against the real site (which has real GIS docs already) —
if you want to check it, temporarily remove the `gis` group from a copy of
`data/manifest.json`, reload, sign in as admin, and confirm the board opens clean
with just "GIS MAPS" showing empty state + "+ New map" and no "Data sources" entry
(since `gisSourcesFile()` returns nothing). Revert the manifest copy after.
- [ ] Pass  [ ] Fail  [ ] Not tested
      Comments: ___________________________

---

## 11. Regression checklist

Same items the build plan requires at the end of every phase. Phase 4's gate last
ran this in full; Phase 5 doesn't touch any of these files directly, but the
`experiencesEditor()` change touches every project document's editing path, so it's
worth a real pass here rather than assuming carry-forward.

- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Home ↔ each of the four sector views
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: One example window per sector opens correctly
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: "Try a Digital Twin" reveal opens and closes — the tour must not reload
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: A lead form send, plus the mailto: fallback with the Web3Forms key removed
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Sign-in with demo / 1234
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Admin sign-in → save draft → preview → discard
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Mobile drawer and sector swipe
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Safari check for the Vision Pro CTA
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Browser back/forward through home → sector → project → close
      Comments: ___________________________
- [ ] Pass  [ ] Fail  [ ] Not tested — Test: Console clean on load and on every overlay
      Comments: ___________________________

---

## Summary

Notes for anything that needs discussion before Phase 5 is gated:

_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________
