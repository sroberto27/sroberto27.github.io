/* ============================================================
   LSU DEATH VALLEY EXPERIENCE — Configuration (prototype)
   ------------------------------------------------------------
   Forked from NewIberiaPro's config.js. This file holds the
   *structural* settings that wire the app together: brand
   strings, map layers, the coordinate system, data file paths,
   Treedis SDK plumbing, Leaflet styles, and UI flags.

   Per-location *content* lives in data/locations.json and
   data/treedis-sweeps.json (see js/00-data-adapter.js) so
   non-technical editors can update copy without touching app
   plumbing.
   ============================================================ */
window.CAMPUS_CONFIG = Object.assign(window.CAMPUS_CONFIG || {}, {
  /* -- Branding ------------------------------------------- */
  brand: {
    name: "LSU Football",
    product: "Death Valley Experience",
    tagline: "The Death Valley Experience"
  },

  /* -- Base map -------------------------------------------
     "esri-image": Louisiana DOTD's 2025 6" aerial ImageServer,
     rendered dynamically via esri-leaflet (NOT a cached tile
     pyramid — see js/11-boot.js: addEsriImageryLayer()).
     Coverage over LSU campus confirmed via ArcGIS Online Map
     Viewer at (30.410494, -91.185784), next to Tiger Stadium.
     ------------------------------------------------------- */
  mapMode: "esri-image",

  esriImagery: {
    url: "https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer",
    // R,G,B — drops the 4th (near-infrared) band so the image
    // renders true-color instead of IR-tinted.
    bandIds: [0, 1, 2],
    format: "jpgpng",
    maxZoom: 21, // native resolution is ~6in/pixel; don't advertise sharper
    attribution: 'Imagery: Louisiana DOTD, 2025 6" Aerial'
  },

  /* Toggleable streets/buildings/POI-label overlay (off by
     default; #layersBtn toggles it — see js/14-redesign.js).
     Standard OpenStreetMap raster tiles are the only open-data
     source with building- and business-level labels (parking
     lot names, campus building names) rather than just roads
     and city names — see PLAN's imagery/overlay decision.
     PLACEHOLDER: OSM's tile usage policy discourages heavy
     production traffic on this public server — fine for this
     prototype, swap for a paid provider (MapTiler / Stadia
     Maps / Thunderforest — same OSM data, needs an API key)
     before this goes in front of real recruits. */
  referenceOverlay: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    opacity: 0.6,
    attribution: "© OpenStreetMap contributors"
  },

  /* -- Map extent / initial view ----------------------------
     Reuses the same `tiles.*` keys the "tiles" mapMode reads
     (see js/05-map-helpers.js / js/11-boot.js) — esri-image
     mode shares the same fit/constrain logic.
     PLACEHOLDER: bounds/center are a desk-research approximation
     of LSU's core football/gameday footprint (Tiger Stadium,
     the Football Operations Center, North/South Stadium Dr).
     ------------------------------------------------------- */
  tiles: {
    minZoom: 14,
    maxZoom: 21,
    maxNativeZoom: 21,

    // Near the Football Operations Center / Tiger Stadium midpoint.
    initialCenter: [30.4115, -91.1863],
    initialZoom: 16,

    zoomOutExtra: 0.5,
    boundsPadding: 0.15,

    // PLACEHOLDER extent — south, west / north, east. Loosely covers
    // Lot 414 (River Rd) through Nicholson Gateway / Matherne's.
    bounds: [
      [30.4075, -91.1935],  // south, west
      [30.4165, -91.1770]   // north, east
    ]
  },

  /* -- Coordinate system of the GeoJSON data --------------- */
  dataCRS: "EPSG:4326",

  /* -- Data files ------------------------------------------- */
  dataFiles: {
    buildings: "data/buildings.geojson",
    tours:     "data/tours.geojson",
    locations:     "data/locations.json",
    treedisSweeps: "data/treedis-sweeps.json"
  },

  /* -- Tour configuration ---------------------------------- */
  tour: {
    defaultGroup: "mainTour",
    focusZoom: 18
  },

  /* -- Treedis street view configuration -------------------
     One shared Treedis model/scene covers the entire tour —
     every stop is a "sweep" navigated within that single model
     (not a separate embed per stop). No real LSU Treedis
     project exists yet, so modelId/tourUrl stay empty; the
     iframe safely never loads (see preloadTreedisIframe() in
     js/04-street-view.js) until these are filled in.
     TODO: fill in modelId + tourUrl once the LSU Treedis
     capture/model is ready, then fill in each stop's sweepId
     in data/treedis-sweeps.json.
     ------------------------------------------------------- */
  treedis: {
    profiles: {
      desktop: { modelId: "", tourUrl: "", homeSweepId: null },
      vr:      { modelId: "", tourUrl: "", homeSweepId: null }
    },
    modelId: "",
    tourUrl: "",
    homeSweepId: null,

    // TODO: set once the LSU Treedis model exists.
    origin: "",

    defaultTransitionTime: 0
  },

  /* -- Layer styles ------------------------------------------
     LSU palette: route stops (transit/arrival/departure) in
     gold, facility stops (buildings) in purple. */
  styles: {
    buildings: {
      color: "#3D2A5C", weight: 1, fillColor: "#6C3FA6", fillOpacity: 0.10
    },
    buildingsHover: {
      color: "#3D2A5C", weight: 1.5, fillColor: "#6C3FA6", fillOpacity: 0.24
    },

    /* Facility tour stops (buildings) */
    tours: {
      color: "#2A1245", weight: 2, fillColor: "#461D7C", fillOpacity: 0.32
    },
    toursHover: {
      color: "#2A1245", weight: 2.5, fillColor: "#461D7C", fillOpacity: 0.42
    },

    /* Route tour stops (arrival/transit/departure) */
    toursPark: {
      color: "#7A5C10", weight: 2, fillColor: "#FDD023", fillOpacity: 0.32
    },
    toursParkHover: {
      color: "#7A5C10", weight: 2.5, fillColor: "#FDD023", fillOpacity: 0.42
    },

    /* Off-campus directional indicators (unused today; kept for parity) */
    toursOffCampus: {
      color: "#9A3412", weight: 2, fillColor: "#FB923C", fillOpacity: 0.35,
      dashArray: "4 3"
    },
    toursOffCampusHover: {
      color: "#7C2D12", weight: 2.5, fillColor: "#F97316", fillOpacity: 0.40,
      dashArray: "4 3"
    },

    /* Selected = brighter fill + 3px outline */
    selected: {
      color: "#2A1245", weight: 3, fillColor: "#6C3FA6", fillOpacity: 0.50
    },
    selectedPark: {
      color: "#7A5C10", weight: 3, fillColor: "#FDD023", fillOpacity: 0.55
    },
    selectedOffCampus: {
      color: "#7C2D12", weight: 3, fillColor: "#EA580C", fillOpacity: 0.35,
      dashArray: "4 3"
    }
  },

  ui: {
    enableHoverPreview: true,
    showBuildingTooltips: false // no building footprint data for LSU yet
  }
});
