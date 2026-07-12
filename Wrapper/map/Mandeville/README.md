# Fontainebleau State Park Virtual Tour — standalone prototype

Rebranded fork of the New Iberia / SCSU Metaversity map for
Fontainebleau State Park (Mandeville, LA), presenting an
accessibility-journey demo across five stops:

  1. Entrance & Parking
  2. Sugar Mill Ruins
  3. Accessible Playground
  4. Beach & Splash Pad
  5. Waterfront Cabins

Street view uses the Lafayette City Treedis experience
(spaces.dtsxr.com/tour/4fb22059) as a stand-in until the park is
captured.

## Run it

    cd fontainebleau-site
    python -m http.server 8000
    # open http://localhost:8000

Serve over http — the JSON/GeoJSON data files load via fetch().

## What still needs replacing

1. **assets/tiles/** — empty. Drop in your QGIS "Generate XYZ tiles
   (Directory)" render of the new Mandeville basemap (zooms 12-17).
   See assets/tiles/README.txt.
2. **config.js -> tiles.bounds / initialCenter / initialZoom /
   min-maxZoom** — placeholders marked TODO; paste the real extent
   and zoom range of your tile render from QGIS.
3. **data/tours.geojson** — the five polygons are APPROXIMATE
   placeholders. Replace with your QGIS export of the areas layer
   (Export -> Save Features As -> GeoJSON, EPSG:4326). Keep the
   names exactly: "Entrance & Parking", "Sugar Mill Ruins",
   "Accessible Playground", "Beach & Splash Pad", "Waterfront
   Cabins" — they are the lookup keys into data/locations.json and
   data/treedis-sweeps.json (no leading/trailing spaces).
4. **Card images** (assets/img/) — cabins, beach and entrance
   (all-terrain track chair) photos are on-topic. Two are
   best-effort stand-ins until park-provided photos are available:
   fontainebleau-playground.jpg currently shows the park's paved
   bike trail, and fontainebleau-ruins.jpg shows the lakefront
   cypress walkway. Swap in licensed photos of the playground and
   the 1829 sugar mill ruins when you have them (keep filenames,
   or update data/locations.json).
5. **Treedis sweeps** — data/treedis-sweeps.json maps the five
   stops onto the three known Lafayette sweeps (two are reused).
   When a Fontainebleau capture exists, update the model IDs in
   config.js -> treedis.profiles and the per-stop sweep IDs.
6. **VR wrapper links** — index.html points the "Enter VR" /
   VR-Enabled links at
   https://sroberto27.github.io/Wrapper/map/Fontainebleau/ ;
   create that wrapper page (copy of the NewIberia one) or repoint
   the four links.
7. **assets/Icons/nav-instructions(.png/-xr.png)** — absent; the
   modal shows its "TBD" fallback until you add them.

## Branding

Louisiana State Parks-inspired palette in css/01-base.css (:root)
and config.js (styles):

- Pine green  #1F4D33  (primary — buttons, tour pill, outlines)
- Moss green  #2E7D4F  (hover / selection)
- Gold        #D9A441  (hairlines, progress, recreation polygon fill)
- Dark gold   #6E5312  (text on gold, recreation outlines)
- Cream/paper unchanged from the light redesign.

Recreation stops (categories PLAY, WATERFRONT) draw in gold on the
map; arrival, history and lodging stops draw in green (see
isParkFeature in js/02-state.js).

The seal (assets/Icons/logo.svg/.png, logo-white.svg) is a
generated placeholder — a bald cypress over Lake Pontchartrain —
not the official Louisiana State Parks pelican logo. Swap in the
official mark if you have license to use it.

Learn mode ships with an empty course catalog (data/courses.json).
Everything else is unchanged from the New Iberia codebase.
