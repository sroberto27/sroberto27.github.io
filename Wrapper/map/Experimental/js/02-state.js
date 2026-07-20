/* === Map setup, DOM refs, styling helpers, module state === */

/* -----------------------------------------------------------
   Leaflet map + panes
   ----------------------------------------------------------- */
const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  maxZoom: 20,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 120,
  maxBoundsViscosity: 1.0
});

L.control.zoom({ position: "topright" }).addTo(map);

map.createPane("imagePane");     map.getPane("imagePane").style.zIndex     = 200;
map.createPane("buildingsPane"); map.getPane("buildingsPane").style.zIndex = 420;
map.createPane("toursPane");     map.getPane("toursPane").style.zIndex     = 430;
map.createPane("pinsPane");      map.getPane("pinsPane").style.zIndex      = 500;

/* -----------------------------------------------------------
   DOM refs
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

  // "All" tab sort controls (Alphabetical / Department)
  locSortAlpha:       $("locSortAlpha"),
  locSortDept:        $("locSortDept"),

  details:         $("details"),
  detailsHandle:   $("detailsHandle"),
  detailsClose:    $("detailsClose"),
  detailsTag:      $("detailsTag"),
  detailsTitle:    $("detailsTitle"),
  detailsSub:      $("detailsSub"),
  detailsBody:     $("detailsBody"),

  // Details panel dynamic sections
  happensHereBlock: $("happensHereBlock"),
  chipsHere:        $("chipsHere"),
  explorableBlock:  $("explorableBlock"),
  subList:          $("subList"),
  addressBlock:     $("addressBlock"),
  detailsAddress:   $("detailsAddress"),
  detailsAddressLinks: $("detailsAddressLinks"),
  detailsImage:     $("detailsImage"),

  // Desktop tour nav (sidebar footer)
  tourName:        $("tourName"),
  tourCurrent:     $("tourCurrent"),
  tourTotal:       $("tourTotal"),
  tourPrev:        $("tourPrev"),
  tourNext:        $("tourNext"),

  // Mobile tour nav (bottom .tourbar)
  tourNameMobile:    $("tourNameMobile"),
  tourCurrentMobile: $("tourCurrentMobile"),
  tourTotalMobile:   $("tourTotalMobile"),
  tourPrevMobile:    $("tourPrevMobile"),
  tourNextMobile:    $("tourNextMobile"),

  fitBtn:          $("fitBtn"),

  // Treedis street-view overlay
  streetview:        $("streetview"),
  tourFrame:         $("tour-frame"),
  streetviewClose:   $("streetviewClose"),
  streetviewTitle:   $("streetviewTitle"),
  streetviewSub:     $("streetviewSub"),
  streetviewTouchGuard: $("streetviewTouchGuard"),
  streetviewLoading: $("streetviewLoading"),
  streetviewLoading: $("streetviewLoading"),
  streetviewLoadingLabel:  $("streetviewLoadingLabel"),
  streetviewLoadingCancel: $("streetviewLoadingCancel"),

  // Explore controls in the details panel:
  //   exploreCta       — mobile inline button
  //   exploreCtaFooter — desktop/iPad footer button
  //   vrInline         — mobile inline VR-Enabled row
  //   detailsFooter    — desktop/iPad footer wrapper (collapses when
  //                      the location has no Treedis sweep)
  //   vrBtn            — hidden legacy button JS still binds to
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
   Styling helpers
   -----------------------------------------------------------
   The optional `feature` argument selects the distinct palette for
   off-campus tour stops (directional indicators at the campus edge).
   ----------------------------------------------------------- */
function isOffCampusFeature(feature) {
  return !!(feature && feature.properties && feature.properties.off_campus);
}

function styleFor(kind, feature) {
  const s = config.styles;
  if (kind === "building") return { ...s.buildings };
  if (kind === "tour") {
    if (isOffCampusFeature(feature) && s.toursOffCampus) {
      return { ...s.toursOffCampus };
    }
    return { ...s.tours };
  }
  return { ...s.buildings };
}

function hoverStyleFor(kind, feature) {
  const s = config.styles;
  if (kind === "building") return { ...s.buildingsHover };
  if (kind === "tour") {
    if (isOffCampusFeature(feature) && s.toursOffCampusHover) {
      return { ...s.toursOffCampusHover };
    }
    return { ...s.toursHover };
  }
  return { ...s.buildingsHover };
}

function selectedStyleFor(feature) {
  const s = config.styles;
  if (isOffCampusFeature(feature) && s.selectedOffCampus) {
    return { ...s.selectedOffCampus };
  }
  return { ...s.selected };
}

/* -----------------------------------------------------------
   Module state
   ----------------------------------------------------------- */
let imageBounds     = null;
let imageOverlay    = null;
let baseTileLayer   = null;
let dataBounds      = null;
let buildingsLayer  = null;
let toursLayer      = null;
let tourPinsLayer   = L.layerGroup([], { pane: "pinsPane" });

let selectedLayer = null;
let selectedKind  = null;

let tourStops  = [];
let tourIndex  = -1;
let allFeatures = [];

/* Mobile panel state. The locations drawer and the details bottom
   sheet are mutually exclusive; the sheet snaps to "half" or "full". */
let drawerOpen   = false;
let detailsMode  = null;

/* Street view state. The iframe preloads at boot but stays hidden until
   the user hits Explore. While active, list/tour navigation drives
   Treedis via postMessage instead of moving the map. */
let streetViewActive = false;

/* Last sweep sent to Treedis, used to skip redundant Navigate calls. */
let lastStreetViewSweepId = null;

/* Set when the user takes a real street-view action so warmHomeSweep()
   aborts instead of clobbering their chosen sweep. */
let warmupCancelled = false;

/* Target queued while Treedis is still booting. Flushed by
   _flushPendingSweep() once TourReady fires; cleared on close. */
let pendingSweep = null;

/* Image-alignment state (legacy single-image mode). Loaded from
   localStorage first so tuning persists, then from config.js. */
const ALIGN_KEY = "scsu-map.align.v1";
function loadAlign() {
  const fromCfg = {
    offsetLat: config.imageOffsetLat || 0,
    offsetLng: config.imageOffsetLng || 0,
    scaleX:    config.imageScaleX    || 1,
    scaleY:    config.imageScaleY    || 1
  };
  try {
    const raw = localStorage.getItem(ALIGN_KEY);
    if (!raw) return fromCfg;
    const parsed = JSON.parse(raw);
    return { ...fromCfg, ...parsed };
  } catch (_) { return fromCfg; }
}
function saveAlign(a) {
  try { localStorage.setItem(ALIGN_KEY, JSON.stringify(a)); } catch (_) {}
}
let align = loadAlign();
