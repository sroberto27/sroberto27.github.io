# New Iberia Virtual Tour — standalone prototype

Rebranded fork of the SCSU Metaversity map for the City of New Iberia,
covering three areas: New Iberia (city), Cypremort Point State Park, and
Lake Fausse Pointe State Park. Street view uses the Lafayette City Treedis
experience (spaces.dtsxr.com/tour/4fb22059) as a stand-in.

## Run it

    cd new-iberia-site
    python -m http.server 8000
    # open http://localhost:8000

Serve over http — the JSON/GeoJSON data files load via fetch(). (The old
file:// shim fallback scripts were intentionally not included; the
onerror handlers in index.html swallow their 404s.)

## What still needs replacing

1. **data/tours.geojson** — currently three PLACEHOLDER rectangles at
   roughly the right coordinates. Replace with your QGIS export of the
   `areas` layer (Export -> Save Features As -> GeoJSON, EPSG:4326).
   Keep the names exactly: "New Iberia", "Cypremort Point State Park",
   "Lake Fausse Pointe State Park" — they're the lookup keys into
   data/locations.json and data/treedis-sweeps.json.
2. **assets/tiles/** — empty. Render the Iberia CarteBaseMap2025 with
   QGIS "Generate XYZ tiles (Directory)", zooms 10-16, into this folder.
   See assets/tiles/README.txt.
3. **config.js -> tiles.bounds / initialCenter / initialZoom /
   min-maxZoom** — placeholders marked TODO; paste the real extent and
   zoom range of your tile render.
4. **assets/Icons/logo-white.svg and logo.png** — placeholder "NI"
   seals; swap in the real City of New Iberia seal (white version for
   the header, color for the welcome modal).
5. **Colors** — navy/gold approximation of cityofnewiberia.com in
   css/01-base.css (:root block) and config.js (styles). Eyedrop the
   live site and adjust if needed.

## Treedis wiring (already done)

- Model: 4fb22059 (both desktop and vr profiles)
- New Iberia            -> sweep u81yx7teebucha7t1kpe4w7fc
- Cypremort Point SP    -> sweep u9s8q0au6ws71h7f4p10xdy1a
- Lake Fausse Pointe SP -> sweep hx65c61euk09gqnrca05r18ha
Rotations from your URLs are stored per sweep in data/treedis-sweeps.json.

Learn mode ships with an empty course catalog (data/courses.json); the
UI shows its empty state. Everything else is unchanged from the SCSU
codebase — see the original README for architecture details.
