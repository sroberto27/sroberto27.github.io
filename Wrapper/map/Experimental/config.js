/* ============================================================
   SCSU METAVERSITY — Configuration
   ------------------------------------------------------------
   This file holds the *structural* settings that wire the app
   together: brand strings, map tiles, the coordinate system,
   data file paths, Treedis SDK plumbing, Leaflet styles, and
   UI flags. It rarely changes.

   Per-location *content* lives in sibling files so non-technical
   editors can update copy without touching app plumbing:

     • data/locations.js       — descriptionMap, imageMap,
                                 categoryMap, happensHereMap,
                                 explorableMap
     • data/treedis-sweeps.js  — treedisMap (per-location
                                 sweep IDs)
     • data/courses.js         — Learn-mode course catalog

   Those files all assign onto `window.CAMPUS_CONFIG`, so app.js
   keeps reading them as `config.descriptionMap`, `config.treedisMap`,
   etc. without any code changes.

   IMPORTANT loading order: this file is loaded AFTER the data/*.js
   files in index.html. We use `Object.assign(window.CAMPUS_CONFIG
   || {}, …)` below so we merge into whatever the data files
   already set, rather than overwriting it.
   ============================================================ */
window.CAMPUS_CONFIG = Object.assign(window.CAMPUS_CONFIG || {}, {
  /* -- Branding ------------------------------------------- */
  brand: {
    name: "SCSU",
    product: "Metaversity",
    tagline: "Virtual Campus Tour"
  },

  /* -- Satellite image ------------------------------------- */
  /* -- Base map tiles -------------------------------------- */
  mapMode: "tiles",

  tiles: {
    url: "assets/tiles/{z}/{x}/{y}.png",

    // Match the QGIS OUTPUT_HTML.html values.
    minZoom: 15,
    maxZoom: 20,
    maxNativeZoom: 20,
    tms: false,

    // QGIS preview center from OUTPUT_HTML.html.
    initialCenter: [33.4977, -80.8493],
    initialZoom: 17,

    zoomOutExtra: 0.10,

    // Extra space around building/tour bounds when fitting the map.
    boundsPadding: 0.35,
    bounds: [
      [33.4909200101593001, -80.8627640321827954],
      [33.5051108680217027, -80.8355473474424997]
    ],

    attribution: "© SC State University | Imagery: SC_2023_RGB WMTS"
  },

  /* -- Coordinate system of the GeoJSON data --------------- */
  dataCRS: "EPSG:4326",

  /* -- Data files -----------------------------------------
     Paths to the GeoJSON files, relative to index.html.
     These are used when the page is served over http/https.
     When opened directly from disk (file://), the app falls
     back to the data/*.js shim scripts loaded in index.html.
     ------------------------------------------------------- */
  dataFiles: {
    buildings: "data/buildings.geojson",
    tours:     "data/tours.geojson"
  },

  /* -- Tour configuration ---------------------------------- */
  tour: {
    defaultGroup: "mainTour",
    focusZoom: 19
  },

  /* -- Treedis street view configuration ------------------
     Top-level SDK plumbing only. The per-location sweep
     lookup (treedisMap) lives in data/treedis-sweeps.js.
     ------------------------------------------------------- */
  treedis: {
    /* Shared model — every sweep in data/treedis-sweeps.js lives
       inside this model. If you swap models you also need to swap
       the sweep IDs, since they're scoped per model.            */
    modelId: "8e4ca3fc",

    /* Origin used by the Treedis SDK for postMessage safety. */
    origin:  "https://spaces.dtsxr.com",

    /* Full tour URL built from the model id.                  */
    tourUrl: "https://spaces.dtsxr.com/tour/8e4ca3fc",

    /* External student portal referenced by the legacy menu. */
    studentPortal: "https://metaversitysportal.carrd.co/",

    /* Transition time (ms) used when Treedis moves sweep.     */
    defaultTransitionTime: 0,

    /* Campus "home" sweep — the view Treedis opens into first.
       null = open the iframe at the model's default sweep and
       only navigate when the user picks a location. The new
       model in the SCSU_Links sheet has no dedicated home sweep;
       set this to a real sweep id later if a campus landing is
       desired.                                                  */
    homeSweepId: null
  },

  /* -- Layer styles ---------------------------------------- */
  styles: {
    buildings: {
      color: "#111111", weight: 1, fillColor: "#CBD5E1", fillOpacity: 0.35
    },
    buildingsHover: {
      color: "#111111", weight: 1.5, fillColor: "#94A3B8", fillOpacity: 0.55
    },
    tours: {
      color: "#111111", weight: 1.5, fillColor: "#A7F3D0", fillOpacity: 0.35
    },
    toursHover: {
      color: "#111111", weight: 2, fillColor: "#6EE7B7", fillOpacity: 0.60
    },
    selected: {
      color: "#111111", weight: 2.5, fillColor: "#86EFAC", fillOpacity: 0.55
    }
  },

  ui: {
    enableHoverPreview: true,
    showBuildingTooltips: true
  }
});
