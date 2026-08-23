/* === LSU Death Valley Experience — Part 2: Map setup, DOM refs, state === */
/* Includes: MapLibre map (sec 3), DOM refs (sec 4), styling helpers
   (sec 5), and all module-level state (sec 6).

   Ported from the Leaflet build (Wrapper/map/LSU/js/02-state.js). Leaflet
   panes (z-indexed DOM layers) have no MapLibre equivalent — layer paint
   order is controlled by the order layers are added in js/11-boot.js /
   js/07-layer-builders.js instead. The old pane z-index scheme is kept
   here only as a comment for reference:
     imagePane(200) -> imagery raster layer, added first
     buildingsPane(420) -> reference overlay + buildings fill layer
     toursPane(430) -> tour-stop fill layer + route line
     pinsPane(500) -> maplibregl.Marker DOM pins (always topmost — markers
                      are absolutely-positioned HTML above the canvas,
                      same visual role as the old pinsPane, no code needed) */
/* -----------------------------------------------------------
   3. MapLibre map
   ----------------------------------------------------------- */
const map3d = config.map3d || {};

const map = new maplibregl.Map({
  container: "map",
  style: { version: 8, sources: {}, layers: [] }, // built entirely from our own sources
  center: map3d.initialCenter || [-91.1863, 30.4115],
  zoom: map3d.initialZoom ?? 16,
  pitch: map3d.initialPitch ?? 0,
  bearing: map3d.initialBearing ?? 0,
  minZoom: map3d.minZoom ?? 14,
  maxZoom: map3d.maxZoom ?? 21,
  // MapLibre's own default maxPitch is 60 — raised so per-stop cam3d
  // presets (js/06-details-panel.js: selectFeature()) can use steeper
  // angles for dramatic close-up shots (e.g. looking down into Tiger
  // Stadium's bowl) without silently clamping. Found via a live probe:
  // a cam3d.pitch of 65 got clamped to 60 with no warning until this
  // was raised.
  maxPitch: map3d.maxPitch ?? 80,
  attributionControl: { compact: true }
});

// MapLibre's addSource()/addLayer() can silently reject an invalid style
// mutation (e.g. a paint property expression that isn't data-driven-
// capable) without throwing — the only visible signal is this 'error'
// event, which nothing surfaced by default. Logging it loudly here beats
// a layer just quietly never appearing.
map.on("error", (e) => {
  console.error("[maplibre]", (e && e.error) || e);
});

/* Layer/source id constants — MapLibre addresses layers by string id on
   the map's internal style, not by holding JS object references the way
   Leaflet's L.tileLayer(...)/L.geoJSON(...) instances worked. */
const LAYER_IDS = {
  background: "background-layer",
  imagery: "imagery-layer",
  referenceOverlay: "reference-overlay-layer",
  buildingsFill: "buildings-fill-layer",
  buildingsExtrusion: "buildings-extrusion-layer",
  toursFill: "tours-fill-layer",
  toursExtrusion: "tours-extrusion-layer",
  routeLine: "route-line-layer",
  googleTiles: "google-3d-tiles-layer"
};
const SOURCE_IDS = {
  imagery: "imagery-source",
  referenceOverlay: "reference-overlay-source",
  terrain: "terrain-source",
  buildings: "buildings-source",
  tours: "tours-source",
  route: "route-source"
};

/* -----------------------------------------------------------
   4. DOM refs
   ----------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const el = {
  splash:          $("splash"),
  app:             $("app"),
  shell:           document.querySelector(".shell"),

  helpBtn:         $("helpBtn"),
  fullscreenBtn:   $("fullscreenBtn"),
  searchBtn:       $("searchBtn"),

  locations:          $("locations"),
  locationsList:      $("locationsList"),
  allLocationsList:   $("allLocationsList"),
  locationsCount:     $("locationsCount"),
  locationsClose:     $("locationsClose"),
  locationsToggle:    $("locationsToggle"),
  locationsBackdrop:  $("locationsBackdrop"),

  // All-tab sort control (Alphabetical / Department)
  locSortAlpha:       $("locSortAlpha"),
  locSortDept:        $("locSortDept"),

  details:         $("details"),
  detailsHandle:   $("detailsHandle"),
  detailsClose:    $("detailsClose"),
  detailsTag:      $("detailsTag"),
  detailsTitle:    $("detailsTitle"),
  detailsSub:      $("detailsSub"),
  detailsBody:     $("detailsBody"),

  // Metadata panel dynamic sections
  happensHereBlock: $("happensHereBlock"),
  chipsHere:        $("chipsHere"),
  explorableBlock:  $("explorableBlock"),
  subList:          $("subList"),
  addressBlock:     $("addressBlock"),
  detailsAddress:   $("detailsAddress"),
  detailsAddressLinks: $("detailsAddressLinks"),
  detailsImage:     $("detailsImage"),

  // Desktop tour nav (inside sidebar footer)
  tourName:        $("tourName"),
  tourCurrent:     $("tourCurrent"),
  tourTotal:       $("tourTotal"),
  tourPrev:        $("tourPrev"),
  tourNext:        $("tourNext"),

  // Mobile tour nav (separate .tourbar at the bottom of viewport)
  tourNameMobile:    $("tourNameMobile"),
  tourCurrentMobile: $("tourCurrentMobile"),
  tourTotalMobile:   $("tourTotalMobile"),
  tourPrevMobile:    $("tourPrevMobile"),
  tourNextMobile:    $("tourNextMobile"),

  fitBtn:          $("fitBtn"),
  toggle3DBtn:     $("toggle3DBtn"),
  toggleImageryBtn: $("toggleImageryBtn"),
  googleTilesAttrib: $("googleTilesAttrib"),
  googleTilesLoading: $("googleTilesLoading"),
  mode3DBadge:     $("mode3DBadge"),

  /* ---- Treedis street-view overlay (new) ---------------- */
  streetview:        $("streetview"),
  tourFrame:         $("tour-frame"),
  streetviewClose:   $("streetviewClose"),
  streetviewTitle:   $("streetviewTitle"),
  streetviewSub:     $("streetviewSub"),
  streetviewTouchGuard: $("streetviewTouchGuard"),
  streetviewLoading: $("streetviewLoading"),
  streetviewLoadingLabel:  $("streetviewLoadingLabel"),
  streetviewLoadingCancel: $("streetviewLoadingCancel"),

  /* Explore CTA inside the metadata panel — used to launch
     the street view for the currently-selected location.
     `exploreCta`       — mobile inline button (inside scroll flow)
     `exploreCtaFooter` — desktop/iPad persistent footer button
     `vrInline`         — mobile inline VR-Enabled row
     `detailsFooter`    — desktop/iPad persistent footer wrapper
                          (collapses entirely when the building
                          has no Treedis sweep configured)
     `vrBtn`            — legacy hidden button JS still binds to */
  exploreCta:        $("exploreCta"),
  exploreCtaFooter:  $("exploreCtaFooter"),
  detailsFooter:     document.querySelector(".details-footer"),
  vrInline:          document.querySelector(".details-vr-inline"),
  vrBtn:             $("vrBtn"),

  metabarSearch:   $("metabarSearch"),
  searchInput:     $("searchInput"),
  searchResults:   $("searchResults"),
  searchClear:     $("searchClear"),

  modeBtns:        document.querySelectorAll(".mode-btn")
};

const mqMobile = window.matchMedia("(max-width: 880px)");
function isMobile() { return mqMobile.matches; }

/* -----------------------------------------------------------
   5. Styling helpers
   -----------------------------------------------------------
   The optional `feature` argument lets us pick a different
   palette for off-campus tour stops (e.g. an arrow that sits at
   the campus edge as a directional indicator). Callers that
   don't have a feature handy can omit it — they get the
   default/facility behavior.

   Unlike the Leaflet build, these no longer return per-call style
   objects for imperative layer.setStyle() — MapLibre paints a
   whole layer with one declarative expression. isOffCampusFeature()/
   isParkFeature() are now used ONCE per feature, at source-build
   time (js/07-layer-builders.js), to bake a `__styleVariant`
   property ("offCampus" | "route" | "facility") into each feature.
   styleExpressionsFor() below then builds a MATCH-on-variant,
   CASE-on-feature-state expression consumed as the layer's paint
   properties — the MapLibre-native replacement for setStyle().
   ----------------------------------------------------------- */
function isOffCampusFeature(feature) {
  return !!(feature && feature.properties && feature.properties.off_campus);
}

/* Redesign: tour polygons split by category — ROUTE stops (arrival,
   transit, departure) render in gold (config.styles.toursPark), FACILITY
   stops (buildings) render in purple (config.styles.tours). Category
   comes from locations.json via getCategory(). Function name kept from
   NewIberiaPro (was park/recreation there) — same style-variant seam,
   different category values. */
function isParkFeature(feature) {
  const raw = feature && feature.properties && feature.properties.name;
  if (!raw) return false;
  const cat = (getCategory(cleanName(raw)) || "").toLowerCase();
  return /route/.test(cat);
}

function styleVariantFor(feature) {
  if (isOffCampusFeature(feature)) return "offCampus";
  if (isParkFeature(feature)) return "route";
  return "facility";
}

/* Builds the three MapLibre paint-property expressions
   ({fillColor, outlineColor, fillOpacity}) for a given kind
   ("tour" | "building"), reading colors from config.styles.
   Selected beats hover beats the variant's default, matching the
   old setStyle() precedence (selectedStyleFor > hoverStyleFor >
   styleFor). Buildings don't have route/facility/off-campus
   variants — they use a single flat style regardless of
   __styleVariant. */
function styleExpressionsFor(kind) {
  const s = config.styles;

  if (kind === "building") {
    return {
      fillColor: [
        "case",
        ["boolean", ["feature-state", "selected"], false], s.selected.fillColor,
        ["boolean", ["feature-state", "hover"], false], s.buildingsHover.fillColor,
        s.buildings.fillColor
      ],
      outlineColor: [
        "case",
        ["boolean", ["feature-state", "selected"], false], s.selected.color,
        ["boolean", ["feature-state", "hover"], false], s.buildingsHover.color,
        s.buildings.color
      ],
      fillOpacity: [
        "case",
        ["boolean", ["feature-state", "selected"], false], s.selected.fillOpacity,
        ["boolean", ["feature-state", "hover"], false], s.buildingsHover.fillOpacity,
        s.buildings.fillOpacity
      ]
    };
  }

  // kind === "tour"
  const variantMatch = (offCampusVal, routeVal, facilityVal) => [
    "match", ["get", "__styleVariant"],
    "offCampus", offCampusVal,
    "route", routeVal,
    /* facility (default) */ facilityVal
  ];

  return {
    fillColor: [
      "case",
      ["boolean", ["feature-state", "selected"], false],
        variantMatch(s.selectedOffCampus.fillColor, s.selectedPark.fillColor, s.selected.fillColor),
      ["boolean", ["feature-state", "hover"], false],
        variantMatch(s.toursOffCampusHover.fillColor, s.toursParkHover.fillColor, s.toursHover.fillColor),
      variantMatch(s.toursOffCampus.fillColor, s.toursPark.fillColor, s.tours.fillColor)
    ],
    outlineColor: [
      "case",
      ["boolean", ["feature-state", "selected"], false],
        variantMatch(s.selectedOffCampus.color, s.selectedPark.color, s.selected.color),
      ["boolean", ["feature-state", "hover"], false],
        variantMatch(s.toursOffCampusHover.color, s.toursParkHover.color, s.toursHover.color),
      variantMatch(s.toursOffCampus.color, s.toursPark.color, s.tours.color)
    ],
    fillOpacity: [
      "case",
      ["boolean", ["feature-state", "selected"], false],
        variantMatch(s.selectedOffCampus.fillOpacity, s.selectedPark.fillOpacity, s.selected.fillOpacity),
      ["boolean", ["feature-state", "hover"], false],
        variantMatch(s.toursOffCampusHover.fillOpacity, s.toursParkHover.fillOpacity, s.toursHover.fillOpacity),
      variantMatch(s.toursOffCampus.fillOpacity, s.toursPark.fillOpacity, s.tours.fillOpacity)
    ]
  };
}

/* Compute [[west,south],[east,north]] from a GeoJSON Polygon/
   MultiPolygon feature's raw coordinates — the MapLibre-world
   replacement for Leaflet's layer.getBounds(). Placeholder stop
   boxes and building footprints are simple single-ring polygons,
   so a flat scan of every [lng,lat] pair is sufficient (no need
   for a full geometry library for this shape of data). */
function boundsOfFeature(feature) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    coords.forEach(visit);
  };
  try { visit(feature.geometry.coordinates); } catch (_) { return null; }
  if (!isFinite(west) || !isFinite(south) || !isFinite(east) || !isFinite(north)) return null;
  return new maplibregl.LngLatBounds([west, south], [east, north]);
}

function centerOfBounds(bounds) {
  if (!bounds) return null;
  const c = bounds.getCenter();
  return [c.lng, c.lat];
}

/* Leaflet's LatLngBounds.pad(ratio) has no MapLibre equivalent —
   LngLatBounds doesn't expose a padding convenience, so it's
   implemented by hand here (used as a fallback when config.map3d.bounds
   isn't set — in practice it always is, so this path rarely runs). */
function padBounds(bounds, ratio) {
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
  const latPad = (ne.lat - sw.lat) * ratio;
  const lngPad = (ne.lng - sw.lng) * ratio;
  return new maplibregl.LngLatBounds(
    [sw.lng - lngPad, sw.lat - latPad],
    [ne.lng + lngPad, ne.lat + latPad]
  );
}

/* -----------------------------------------------------------
   6. State
   ----------------------------------------------------------- */
let imageBounds = null; // maplibregl.LngLatBounds — campus bounds for fit/maxBounds
let dataBounds  = null; // maplibregl.LngLatBounds — extent of loaded buildings+tours

let buildingsGeo = null; // raw GeoJSON FeatureCollection, post source-prep
let toursGeo     = null;

/* #layersBtn toggle state — the OSM streets/buildings/POI-label
   overlay. OFF by default (opt-in, low opacity when on — see
   config.js: referenceOverlay.opacity) so it doesn't compete with the
   aerial/3D imagery unless the user asks for it. Works identically in
   2D and 3D: js/16-google-tiles.js lifts it above the 3D tiles while
   Google mode is active so the labels stay legible whenever it's on. */
let referenceOverlayOn = false;
let imageryOn = true; // #toggleImageryBtn — DOTD aerial photo on/off (§3.6)
let is3DMode = false;           // #toggle3DBtn toggle state

/* Which 3D renderer is actually active right now, independent of
   is3DMode (which just means "3D, whichever kind"). null in 2D mode;
   "simple" for the flat extruded-building fallback; "google" once
   js/16-google-tiles.js's Google Photorealistic 3D Tiles layer has
   successfully taken over. Drives the mode-indicator badge and the
   #toggleImageryBtn disabled state. */
let active3DRenderer = null;

/* selectedFeature = { sourceId, kind, featureId } | null — the MapLibre
   replacement for Leaflet's selectedLayer/selectedKind. featureId must be
   numeric (GeoJSON source uses generateId:true — see js/07-layer-builders.js)
   for map.setFeatureState() to work. */
let selectedFeature = null;

let tourStops  = []; // [{ feature, featureId, marker, order }]
let tourIndex  = -1;
let allFeatures = []; // [{ kind, sourceId, featureId, props }]

/* Mobile drawer state. At any given time on mobile we can be in:
     - "map only"         (nothing open)
     - drawer open        (locations list visible)
     - details half       (bottom sheet covering ~half the screen)
     - details full       (bottom sheet covering the whole map area)
   The drawer and details are mutually exclusive. */
let drawerOpen   = false;
let detailsMode  = null; // null | "half" | "full"

/* Street view state. The iframe starts preloading the moment the
   page boots, but stays hidden (aria-hidden + CSS) until the user
   explicitly hits "Explore" on a location. While the street view
   is active the locations list and tour-bar arrows keep working,
   except they drive Treedis via postMessage instead of flying the
   map to the next feature. */
let streetViewActive = false;

/* Track the last successful Treedis navigation so we don't fire a
   redundant Navigate message (e.g. selecting the same row twice). */
let lastStreetViewSweepId = null;

/* Set to true when the user takes a real street-view action, so
   warmHomeSweep() aborts before clobbering their chosen sweep. */
let warmupCancelled = false;

/* When the user opens street view before TourReady has fired, we
   stash their intended target here. Once Treedis reports ready,
   _flushPendingSweep() sends the queued Navigate and hides the
   loading veil. Cleared on close or on successful flush. */
let pendingSweep = null;
