# SCSU Metaversity — Virtual Campus Tour

An interactive, Villanova-style virtual campus tour for South Carolina State
University. Styled to match the "SCSU Metaversity" Figma boards: monospace
typography, bordered boxes, architectural feel. Runs on Leaflet with a
QGIS-exported satellite background and GeoJSON overlays for buildings,
tour stops, and highlight zones.

---

## What was wrong & how it's fixed

### 🔴 Why polygons weren't showing (the main problem)

The previous version loaded `.geojson` files with `fetch()`. When you open
`index.html` directly from your hard drive (URL bar shows `file:///…`),
**browsers block fetch for security**, so every GeoJSON load silently
failed. The satellite image kept loading (because `<img>` tags are exempt
from that block), which is why the background showed but no polygons did.

**Fix:** the GeoJSON is now delivered as three `.js` files that assign to
`window.SCSU_DATA`, pulled in via `<script>` tags.  `<script>` tags work
over `file://` just as well as over `http://`, so the app now runs from
either — no local server required.

### 🎨 Layout rebuilt to match the Figma boards

- **Top header** with `SCSU METAVERSITY`, `HELP`, `FULLSCREEN`
- **Explore / Learn** segmented toggle
- **Left sidebar** listing every tour stop with `1. Name` and category
  (e.g. `MATH & SCIENCE`, `ATHLETICS`). Selected row gets the Figma green
  highlight.
- **Right details panel** opens when a location is selected — shows the
  category tag, title, Explore CTA, location image placeholder, description,
  "What happens here?" chips, explorable sub-locations list, VR-Enabled
  indicator.
- **Bottom tour bar** with `‹` `TOUR / Location / 1/5` `›` — matches the
  Figma tour navigator.
- **Monospace-first typography** (JetBrains Mono) with Inter for long prose.
- **Numbered circle pins** (1–5) drop on each tour stop, active stop
  inverts to black-on-mint.

### 📱 Responsive flow

| Breakpoint | Behavior |
|---|---|
| ≥ 1040px | Full three-column layout (list \| map \| details) |
| 880–1040px | Same layout, narrower sidebars, search hidden |
| ≤ 880px | **Figma mobile flow**: metabar + toggle at top, map fills the screen, `Locations` button reveals the list as a dropdown from the top, `Details` slides up as a bottom sheet, tour bar pinned to bottom |
| ≤ 420px | Labels hide to save space; compact controls |

---

## Run it

**Option A — just double-click `index.html`.** Because data is no longer
fetched, this works now.

**Option B — local server** (recommended for development so the browser
doesn't cache aggressively):

```bash
cd scsu-map
python3 -m http.server 8000
# open http://localhost:8000
```

---

## File layout

```
scsu-map/
├── index.html
├── styles.css
├── config.js
├── app.js
├── README.md
├── assets/
│   └── campus_satellite.png
└── data/
    ├── buildings.js      ← loaded via <script>, sets window.SCSU_DATA.buildings
    ├── tours.js          ← 〃                      window.SCSU_DATA.tours
    ├── zones.js          ← 〃                      window.SCSU_DATA.zones
    ├── buildings.geojson ← original export, kept for reference / QGIS edits
    ├── tours.geojson
    └── zones.geojson
```

### Re-generating the `.js` data files after editing in QGIS

Every time you re-export a GeoJSON from QGIS, regenerate the matching `.js`
shim. One-liner:

```bash
cd scsu-map
for name in buildings tours zones; do
  {
    echo "window.SCSU_DATA = window.SCSU_DATA || {};"
    printf "window.SCSU_DATA.%s = " "$name"
    cat "data/${name}.geojson"
    echo ";"
  } > "data/${name}.js"
done
```

---

## Customization

### Fix satellite image alignment (interactive tool)

Your satellite image won't perfectly match the polygons unless QGIS
exported the PNG with the exact data extent — which it usually doesn't.
There's now a built-in **alignment tool** that lets you visually nudge
the image until it lines up:

1. Click **ALIGN** in the top header (or press **Shift+A**).
2. The image dims to 55% opacity so you can see the polygons beneath it.
3. Use the directional pad in the panel (or the arrow keys) to shift
   the image. Hold **Shift** while nudging for 10× steps.
4. Use **−W / +W** and **−H / +H** (or `−` / `+` keys) to stretch it
   horizontally or vertically independently.
5. When everything lines up, click **Save & close**. The values are
   auto-persisted in this browser's localStorage.
6. To make the alignment permanent and shareable, click **Copy config**
   and paste the four lines into `config.js`:

```js
imageOffsetLat: 0.000083,
imageOffsetLng: -0.000142,
imageScaleX:    1.0240,
imageScaleY:    0.9960,
```

(Those are just example numbers — yours will be different.)

### Legacy overall-scale knob

`imagePaddingPct` (default `0.12`) still exists as a coarse overall
scale. In practice you'll leave it at `0.12` and do all fine-tuning
with the alignment tool.

If you re-export a new satellite PNG from QGIS at a different size,
update:

```js
imageWidthPx:  3507,
imageHeightPx: 2480,
```

### Categories for the locations list

Keys are case-insensitive matches against the feature `name`:

```js
categoryMap: {
  "nance hall":                "MATH & SCIENCE",
  "oliver c. dawson stadium":  "ATHLETICS",
  // …
}
```

### Description text in the details panel

Your source GeoJSON has `description: "none"` for every stop. Real text
lives in `descriptionMap` in `config.js`:

```js
descriptionMap: {
  "nance hall": "Home to the College of Mathematics, Natural Sciences…",
  // …
}
```

Either fill that out here or start setting real `description` fields in
QGIS (anything non-empty and not `"none"` is used verbatim).

---

## Interactions

| Action | Desktop | Mobile |
|---|---|---|
| View details | Click polygon or sidebar row | Tap polygon or menu row |
| Next / previous stop | Arrow buttons or `←` / `→` | Arrow buttons |
| Open locations list | Always visible | Tap **Locations** button |
| Open details | Auto-opens right panel | Slides up as bottom sheet |
| Close panel / list | `Esc` or `×` button | Swipe away or `×` |
| Reset view | Fit-to-view button (bottom right) | Same |
| Fullscreen | `FULLSCREEN` in header | Same (where supported) |

---

## Design notes

**Colors** are intentionally restricted and align with the Figma mood:

- Ink (`#0b0b0b`) — borders, type, active elements
- Fog (`#f5f5f4`) — page background
- Paper (`#ffffff`) — panels
- Mint (`#a7f3d0`) — selected state, tour accents (matches Figma green)
- Rose (`#fca5a5`) — highlight zone fill
- Alert (`#e11d48`) — image placeholder X marks

**Fonts:** JetBrains Mono 400/500/600/700 for UI, Inter 400/500/600/700
for longer descriptions. Loaded from Google Fonts.

**No frameworks** beyond Leaflet 1.9.4. Everything else is vanilla
HTML/CSS/JS.
