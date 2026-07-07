/* ============================================================
   NEW IBERIA VIRTUAL TOUR — Configuration (prototype)
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
     • data/treedis-sweeps.js  — treedisMaps (per-location
                                 sweep IDs, split into desktop
                                 vs. vr profiles)
     • data/courses.js         — Learn-mode course catalog

   Those files all assign onto `window.CAMPUS_CONFIG`, so app.js
   keeps reading them as `config.descriptionMap`, `config.treedisMap`,
   etc. without any code changes.

   IMPORTANT loading order: this file is loaded AFTER the data/*.js
   files in index.html. We use `Object.assign(window.CAMPUS_CONFIG
   || {}, …)` below so we merge into whatever the data files
   already set, rather than overwriting it.

   ─── Treedis dual-profile (desktop / VR) ────────────────────
   The original SCSU build shipped two Treedis models — one
   for desktop/tablet/mobile, one for XR/VR headset browsers.
   Sweep IDs are scoped per model, so we keep both `modelId` and
   `tourUrl` under `treedis.profiles.{desktop, vr}` and let app.js
   pick a profile at boot. The legacy top-level fields
   `treedis.modelId` / `treedis.tourUrl` are kept as
   desktop-profile aliases for backward compatibility; app.js
   overwrites them with the VR equivalents when XR is detected.
   ============================================================ */
window.CAMPUS_CONFIG = Object.assign(window.CAMPUS_CONFIG || {}, {
  /* -- Branding ------------------------------------------- */
  brand: {
    name: "New Iberia",
    product: "Metaversity",
    tagline: "Virtual Parish Tour"
  },

  /* -- Satellite image ------------------------------------- */
  /* -- Base map tiles -------------------------------------- */
  mapMode: "tiles",

  tiles: {
    url: "assets/tiles/{z}/{x}/{y}.jpg",

    // ── NEW IBERIA ──────────────────────────────────────────
    // The parish extent is far larger than a campus, so the
    // zoom window shifts down. Match these to the zoom range
    // you render with "Generate XYZ tiles (Directory)" in QGIS.
    minZoom: 10,
    maxZoom: 20,
    maxNativeZoom: 16,
    tms: false,

    // Downtown New Iberia. TODO: replace with the center you
    // read from QGIS (canvas coordinates readout, EPSG:4326).
    initialCenter: [30.0035, -91.8187],
    initialZoom: 12,

    zoomOutExtra: 0.10,

    // Extra space around building/tour bounds when fitting the map.
    boundsPadding: 0.35,
    // TODO: replace with your tiled raster's extent from QGIS
    // (Layer Properties → Information → Extent, reprojected to
    // EPSG:4326). Format: [[southLat, westLng], [northLat, eastLng]].
    // The placeholder below roughly covers Iberia Parish from
    // Cypremort Point up past Lake Fausse Pointe.
    bounds: [
      [29.7079878904492674, -92.0102326961766863],   // south, west
      [30.1875962102446991, -91.2169066525727885]    // north, east
    ],

    attribution: "© City of New Iberia | Imagery: Iberia CarteBaseMap2025"
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
    tours:     "data/tours.geojson",
    // Per-location content (CMS-shape JSON). When a CMS lands,
    // these can be repointed at an API endpoint that returns the
    // same JSON shape — the adapter in js/00-data-adapter.js is
    // the only thing that knows what the shape looks like.
    locations:     "data/locations.json",
    treedisSweeps: "data/treedis-sweeps.json",
    courses:       "data/courses.json"
  },

  /* -- Tour configuration ---------------------------------- */
  tour: {
    defaultGroup: "mainTour",
    focusZoom: 16
  },

  /* -- Treedis street view configuration ------------------
     Shared SDK plumbing lives at the top level; the model-
     specific fields (modelId, tourUrl) live under `profiles`
     because we ship two Treedis models — one for desktop,
     one for VR.

     The per-location sweep lookup (treedisMaps) lives in
     data/treedis-sweeps.js.
     ------------------------------------------------------- */
  treedis: {
    /* Per-profile model + tour URL. app.js picks one of these at
       boot via detectXRProfile() and copies its values up to
       treedis.modelId / treedis.tourUrl. */
    profiles: {
      /* PROTOTYPE: no New Iberia Treedis model exists yet, so both
         profiles point at the Lafayette City experience
         (spaces.dtsxr.com/tour/4fb22059) as a stand-in. Sweep
         IDs per location live in data/treedis-sweeps.json. */
      desktop: {
        modelId: "4fb22059",
        tourUrl: "https://spaces.dtsxr.com/tour/4fb22059",
        homeSweepId: null
      },
      vr: {
        modelId: "4fb22059",
        tourUrl: "https://spaces.dtsxr.com/tour/4fb22059",
        homeSweepId: null
      }
    },

    /* Active-profile aliases. These default to the desktop
       profile and get overwritten by app.js (resolveTreedisProfile)
       at boot if XR is detected. Older code paths that read
       config.treedis.modelId / .tourUrl keep working. */
    modelId: "4fb22059",
    tourUrl: "https://spaces.dtsxr.com/tour/4fb22059",
    homeSweepId: null,

    /* Origin used by the Treedis SDK for postMessage safety.
       Both models live on the same origin, so this stays shared. */
    origin: "https://spaces.dtsxr.com",

    /* External student portal referenced by the legacy menu. */
    studentPortal: "https://metaversitysportal.carrd.co/",

    /* Transition time (ms) used when Treedis moves sweep.     */
    defaultTransitionTime: 0
  },

  /* -- Layer styles ---------------------------------------- */
  styles: {
    buildings: {
      color: "#111111", weight: 1, fillColor: "#CBD5E1", fillOpacity: 0.15
    },
    buildingsHover: {
      color: "#111111", weight: 1.5, fillColor: "#94A3B8", fillOpacity: 0.35
    },
    tours: {
      color: "#0B2545", weight: 1.5, fillColor: "#E8B93C", fillOpacity: 0.15
    },
    toursHover: {
      color: "#0B2545", weight: 2, fillColor: "#D9A62E", fillOpacity: 0.35
    },
    /* Off-campus tour stops get a distinct orange/amber treatment so
       the user can tell at a glance that the shape on the map is a
       directional indicator (not a real building). The Olar Farm
       arrow on the highway uses this. */
    toursOffCampus: {
      color: "#9A3412", weight: 2, fillColor: "#FB923C", fillOpacity: 0.35,
      dashArray: "4 3"
    },
    toursOffCampusHover: {
      color: "#7C2D12", weight: 2.5, fillColor: "#F97316", fillOpacity: 0.40,
      dashArray: "4 3"
    },
    selected: {
      color: "#0B2545", weight: 2.5, fillColor: "#F0C75E", fillOpacity: 0.25
    },
    selectedOffCampus: {
      color: "#7C2D12", weight: 3, fillColor: "#EA580C", fillOpacity: 0.35,
      dashArray: "4 3"
    }
  },

  ui: {
    enableHoverPreview: true,
    showBuildingTooltips: true
  }
});
