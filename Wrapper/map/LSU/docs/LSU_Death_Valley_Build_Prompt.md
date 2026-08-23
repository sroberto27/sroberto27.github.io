# Build Prompt: LSU "Death Valley Experience" Guided Map

Paste this whole document to Claude Code as your first message in the new project
folder. It is written *to* Claude Code (second person = you, the agent).

## Run this in Plan Mode

Before sending this prompt, put the session into Plan Mode: press `Shift+Tab`
until the status bar shows plan mode on, or launch the session with
`claude --permission-mode plan`. In Plan Mode Claude Code can only read, search,
and explore — no files get written until you review and approve its plan. That's
deliberate here: Section 1 below is exploration work (reading someone else's
codebase and a design deck), and this project deserves a real plan before anything
gets scaffolded.

**Claude Code: do not write, edit, or create a single file until you've completed
Section 1 and presented the plan described at the end of it, and the user has
approved it.** If you're not already in a read-only permission mode when you start,
say so and ask the user to switch before you proceed.

---

## 0. What you're building

You're adapting an existing prototype — **NewIberiaPro** — into a new site for LSU
Football recruiting: a guided-tour map of the gameday journey through LSU's campus
and football facilities, with Treedis immersive experiences dropped in at each stop.
Working name: **"The Death Valley Experience."**

This project folder and `../NewIberiaPro` are sibling folders under the same parent
directory. `../NewIberiaPro` is the **original, working prototype** — read-only
reference. Do not edit, delete, or write anything inside it.

In this project folder you'll also find:
- `The_Death_Valley_Experience_Deck.pdf` — the pitch deck. It defines the 10 tour
  stops, the "Before / During / After" content structure, the stats block, the
  branding tone, and the Treedis/Matterport/HeyGen platform plan. Treat it as the
  spec for copy and structure.
- A screenshot of LSU's official athletics site (lsusports.net) — use this as the
  visual/brand reference: LSU purple, gold, the bold condensed headline treatment,
  photography style.

## 1. Explore phase (Plan Mode) — do this before writing any code

1. Open and read, in full: `../NewIberiaPro/index.html`, `../NewIberiaPro/config.js`,
   everything under `../NewIberiaPro/css/`, `../NewIberiaPro/js/`,
   `../NewIberiaPro/data/`, plus `README.md` and `PRODUCT.md` in that folder. If a
   `.claude/` or `.agents/` folder exists there with project instructions or skills,
   read those too — they may describe conventions worth reusing.
2. Also read this project's own reference material: the deck PDF and the
   lsusports.net screenshot in this folder.
3. While exploring, build a clear picture of:
   - How the map initializes and which mapping library is used (Leaflet is likely,
     confirm it).
   - How the base imagery layer is configured (NewIberiaPro's attribution reads
     "Imagery: Iberia CartoBaseMap2025" — find that layer definition; it's probably
     an Esri ImageServer/MapServer, which matters for Section 3 below).
   - How the layer switcher / layers control works.
   - How the sidebar is built: title card, Explore/Learn tabs, search box, category
     filter chips (`All / Parks / City` in the original), and the "3 PLACES /
     FEATURED / ALL" list.
   - How tour data is structured and consumed — find the actual GeoJSON file(s) in
     `data/` and note the real property names used (id, order, title, description,
     category, media references, etc.). **The real schema you find here overrides
     the one guessed in Section 6 below.**
   - How the "Guided tour · N stops" widget at the bottom works (numbered map
     markers, prev/next, "Start your tour").
   - How Treedis is embedded per stop — iframe, SDK, or a bridge script — and what
     parameters it expects (project ID, scene ID, etc.).
   - Design tokens: colors, fonts, spacing, the rounded-card sidebar style.

### Required output of this phase: a plan, not code

When exploration is done, stop and present a plan — don't write any files yet.
Structure it as:

- **What NewIberiaPro actually does** — the real architecture, in your own words,
  including anywhere the real code diverges from what Sections 2–8 below assume.
- **File-by-file build plan** — every file you intend to create or copy-and-adapt
  in this new project, with a one-line purpose for each.
- **Key decisions to confirm before you build**, specifically:
  - Whether the DOTD ImageServer (Section 3) actually covers the LSU campus
    footprint, and how you'll verify that before wiring it in as the default layer.
  - Which street/reference overlay you'll use (Section 4) and why — CARTO,
    Esri's reference layer, or the OSM fallback.
  - The exact tour-data schema you'll use (Section 6) — confirmed from the real
    NewIberiaPro files, not assumed.
  - Anything in the deck or the screenshot that's ambiguous or that you'd default
    on without asking.
- **Phased execution order** — group the work from Sections 2–8 into a handful of
  reviewable phases (e.g., scaffold + imagery/overlay layers → branding + sidebar
  → tour data + guided-tour widget → Treedis placeholders + Learn-tab content →
  self-check pass). List them in the order you'll execute, so approval can happen
  phase by phase if the user wants to check in along the way rather than approving
  one giant plan.

Wait for the user to approve the plan (or send corrections) before writing
anything. Once approved, execute phase by phase, and if you hit something in the
real codebase that contradicts the approved plan, stop and flag it rather than
improvising past it.

## 2. Scaffold the new project

Mirror the same top-level structure in this folder (`assets/`, `css/`, `js/`,
`data/`, `index.html`, `config.js`, `README.md`, `PRODUCT.md`, and any lockfile
convention like `skills-lock.json` if that's part of their tooling). Reuse the same
build/run approach (looks like a static site — plain HTML/CSS/JS served directly,
confirm from `index.html`/`config.js`).

## 3. Base imagery layer — DOTD 2025 6-inch aerial

Imagery service:
```
https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer
```

Important — I checked this service's metadata directly. Two things that matter for
implementation:

- **It's a dynamic ImageServer, not a cached tile service** (`"Single Fused Map
  Cache": false`). You cannot point a plain `{z}/{x}/{y}` XYZ tile layer at it. Use
  the `esri-leaflet` plugin's `L.esri.imageMapLayer(...)`, which calls
  `exportImage` dynamically. If NewIberiaPro's current imagery layer already uses
  `esri-leaflet` (likely, given it's also an Esri-style service), copy that exact
  pattern and just swap the URL and options.
- **It's a 4-band image (Red, Green, Blue, near-Infrared)**, 8-bit, EPSG:3857. If
  the layer renders false-color/IR-tinted, pass a band combination to force true
  color, e.g.:
  ```js
  L.esri.imageMapLayer({
    url: 'https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer',
    bandIds: [0, 1, 2], // R,G,B — drop the 4th (IR) band for natural color
    format: 'jpgpng',
    attribution: 'Imagery: Louisiana DOTD, 2025 6" Aerial'
  }).addTo(map);
  ```
- Coverage caveat: the service description says "Various areas of interest," not
  statewide. **Verify Baton Rouge/LSU campus (~30.412, -91.184) actually falls
  inside its footprint** by loading the layer and panning there before wiring
  anything else to it. If it's blank at campus, fall back to a general basemap and
  flag this to the user rather than guessing.
- Max useful zoom for 6" imagery is roughly z=20–21; don't advertise sharper zoom
  than the source supports.

## 4. Street / reference overlay

You asked for an open-source option that overlays cleanly on top of aerial imagery
(roads + labels, no opaque basemap underneath). Two good choices — try the first,
keep the second as fallback:

**Primary — CARTO Voyager, labels/roads only (built on OpenStreetMap data):**
```
https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png
```
Attribution: `© OpenStreetMap contributors © CARTO`. This has historically been
usable without an API key for light/prototype traffic, but CARTO's terms do change —
if it 403s or requires a key, drop to the fallback below rather than burning time on
it.

**Fallback — Esri's "World Boundaries and Places" reference layer**, which is
purpose-built by Esri to sit on top of imagery (roads, boundaries, labels, no fill):
```
https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer
```
This is a cached/tiled service, so a standard `L.esri.tiledMapLayer(...)` or the
`{z}/{y}/{x}` tile template works directly — simpler than the imagery layer in
Step 3.

**Last resort (dev-only)** — plain OpenStreetMap standard tiles at reduced opacity:
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```
Note OSM's tile usage policy explicitly discourages heavy/production use of this
public server — fine to prototype with, not to ship on.

Add whichever you land on as a toggleable overlay in the existing layer control, on
top of the aerial base layer.

## 5. Branding — swap New Iberia for LSU

Reference the deck and the lsusports.net screenshot for tone: bold, oversized
uppercase headlines, high-contrast, confident, minimal copy per screen.

- Palette: LSU Purple `#461D7C`, LSU Gold `#FDD023`, and the near-black
  purple-to-violet gradient background seen throughout the deck (roughly
  `#150c26` → `#2d1b4e`). Sample the deck's actual background gradient rather than
  guessing further if you can extract it from the PDF pages.
- Headline type: bold condensed uppercase, tracked out (matches "SATURDAY NIGHT.
  EVERY NIGHT." on the deck cover) — an Anton/Oswald-class Google Font is a
  reasonable stand-in for the body's system font if NewIberiaPro doesn't already
  have something suitable.
- Sidebar title card: replace "Explore New Iberia / IBERIA PARISH, LOUISIANA" with
  something like **"Explore Death Valley" / LSU FOOTBALL · BATON ROUGE, LOUISIANA**.
- Keep the two-tab pattern (`Explore` / `Learn`):
  - **Explore** = the map + the 10-stop guided tour (Section 6).
  - **Learn** = pull directly from the deck: the "30+ / 7 / 1" stats block, the
    Before/During/After three-moments framing, and the "your staff, their
    voices" avatar-guide explanation. Use the deck's actual language — it's your
    client's own copy, so quote it fully rather than paraphrasing thin.
- Replace the `All / Parks / City` filter chips with something that fits football
  stops, e.g. `All / Route / Facility`.
- Keep the "Guided tour · N stops" bottom bar and numbered pin pattern exactly as
  built — just point it at 10 stops instead of 3.

## 6. Tour data — placeholder `tours.geojson`

Put this in whatever path/filename you found NewIberiaPro actually uses in Section 1
(likely something like `data/tours.geojson`). **Every coordinate below is a
desk-research approximation** for prototyping only — the user will redraw these
precisely in QGIS. Keep the schema loose and clearly commented as placeholder data;
don't build logic that assumes survey-grade precision.

Coordinates are real anchors where a real one exists (Tiger Stadium, the Football
Operations Center) and rough estimates elsewhere (Lot 414, the Tiger Walk route,
Matherne's) — flag the estimated ones in a `"placeholder": true` property so they're
easy to find and fix later.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "stop-01",
        "order": 1,
        "title": "Lot 414 · River Road Arrival",
        "category": "route",
        "description": "Recruit families arrive and park along River Road.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1875, 30.4145] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-02",
        "order": 2,
        "title": "Charter Bus to the Facility",
        "category": "route",
        "description": "Shuttle from Lot 414 to the Football Operations Center.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1878, 30.4118] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-03",
        "order": 3,
        "title": "Football Operations Facility",
        "category": "facility",
        "description": "The Charles McClendon Practice Facility / Football Operations Center.",
        "treedis_scene_id": "",
        "placeholder": false
      },
      "geometry": { "type": "Point", "coordinates": [-91.188749, 30.410930] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-04",
        "order": 4,
        "title": "Tiger Tailgate · Indoors",
        "category": "facility",
        "description": "Indoor tailgate reception inside the Operations Facility.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1885, 30.4108] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-05",
        "order": 5,
        "title": "Registration",
        "category": "facility",
        "description": "Recruit check-in.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1884, 30.4106] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-06",
        "order": 6,
        "title": "Tiger Walk",
        "category": "route",
        "description": "The team's walk from the Operations Center to Tiger Stadium.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1862, 30.4114] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-07",
        "order": 7,
        "title": "Lawton Room",
        "category": "facility",
        "description": "Shirley and Bill Lawton Team Room, inside the Operations Center.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1888, 30.4110] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-08",
        "order": 8,
        "title": "Field Level Warmups",
        "category": "facility",
        "description": "Field-level access inside Tiger Stadium before kickoff.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1838, 30.4119] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-09",
        "order": 9,
        "title": "Kickoff · Death Valley",
        "category": "facility",
        "description": "Tiger Stadium, kickoff.",
        "treedis_scene_id": "",
        "placeholder": false
      },
      "geometry": { "type": "Point", "coordinates": [-91.183815, 30.412035] }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "stop-10",
        "order": 10,
        "title": "Postgame · Buses at Matherne's",
        "category": "route",
        "description": "Departure near Matherne's Market at LSU, Nicholson Gateway.",
        "treedis_scene_id": "",
        "placeholder": true
      },
      "geometry": { "type": "Point", "coordinates": [-91.1798, 30.4098] }
    }
  ]
}
```

Also add a single `LineString` feature (same file or a `route.geojson`, matching
whatever convention you found) connecting the 10 stops in order, to drive the
walking-route line on the map — again, placeholder geometry the user will trace
properly in QGIS.

## 7. Treedis placeholders

Find the exact embed pattern NewIberiaPro uses per stop and mirror it, but leave
`treedis_scene_id` empty for every stop (per the schema above). When a stop has no
scene ID, render a graceful fallback panel — a static placeholder image or a "360°
walkthrough coming soon" message — instead of an empty/broken embed. Add a `//
TODO: Treedis scene ID` comment at the integration point so it's trivial to wire up
real scenes later.

## 8. Content to lift from the deck

Pull this directly into the `Learn` tab / an about panel — it's the client's own
material, use it verbatim:

- Stats block: **30+** recruits expected (Clemson opener, Sept 5), **7** home games
  / recruiting cohorts, **1** scripted journey.
- The three-moment framing: **Before** (secure link days out, family walks the
  route), **During** (Death Valley in their hands — kiosks in the Operations
  Facility and Lawton Room, on facility network), **After** (follow-up link, return
  visits and engagement analytics).
- The "your staff, their voices" section on HeyGen avatar guides narrating each
  stop.
- The security/governance notes (scan sweep protocol, recruits-only access,
  nothing not already visible on a physical visit, LSU owns the data) — good as a
  short trust/compliance footer, doesn't need to be functional for this prototype.

## 9. Boundaries — do not do these

- Do not touch anything inside `../NewIberiaPro`.
- Do not invent survey-grade GPS data — every coordinate in Section 6 is an
  approximation and must stay clearly marked as such.
- Do not wire up real Treedis scene IDs — none exist yet.
- Don't introduce a new mapping library or framework if NewIberiaPro already solves
  the problem with what it has; extend the existing stack (add `esri-leaflet` only
  if it isn't already a dependency).

## 10. Self-check before you call this done

- [ ] Aerial imagery renders correctly (true color, not IR-tinted) when the map is
      centered on LSU campus (~30.412, -91.184).
- [ ] Street/label overlay toggles on and off cleanly over the aerial layer.
- [ ] Sidebar shows LSU branding, title, and the Explore/Learn tabs.
- [ ] All 10 stops appear as numbered markers in tour order; "Start your tour" /
      prev/next stepping works.
- [ ] Each stop detail panel shows a Treedis placeholder state, not a broken embed.
- [ ] Learn tab shows the deck's stats block and three-moment content.
- [ ] This project's `README.md` clearly lists what's placeholder (imagery
      coverage assumption, street layer choice, all stop coordinates, the route
      line, every Treedis scene ID) so the user knows exactly what to fix in QGIS
      and in Treedis before this goes to real recruits.
