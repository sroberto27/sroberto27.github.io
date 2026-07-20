/* ============================================================
   SCSU Virtual Campus — Configuration
   ------------------------------------------------------------
   Structural settings that wire the app together: brand strings, map
   tiles, coordinate system, data file paths, Treedis SDK settings,
   Leaflet styles, and UI flags.

   Per-location content lives in the data/ files so it can be edited
   without touching app code:
     data/locations.json      — descriptions, images, categories,
                                departments, addresses, explorables
     data/treedis-sweeps.json — per-location sweep IDs (desktop / vr)
     data/courses.json        — Learn-mode course catalog

   Loading order: this file loads after the data/*.js shim scripts in
   map.html, and Object.assign merges into whatever they already set.

   Treedis dual profile: the campus exists as two Treedis models — one
   for desktop/tablet/mobile, one for VR headsets — with sweep IDs
   scoped per model. Both live under treedis.profiles; the boot code
   picks one and copies its values to the top-level treedis.modelId /
   tourUrl aliases (kept for older code paths).
   ============================================================ */
window.CAMPUS_CONFIG = Object.assign(window.CAMPUS_CONFIG || {}, {

  /* -- Branding -------------------------------------------- */
  brand: {
    name: "SCSU",
    product: "Metaversity",
    tagline: "Virtual Campus Tour"
  },

  /* -- Base map -------------------------------------------- */
  /* "tiles" (XYZ raster, production) or legacy single-image mode. */
  mapMode: "tiles",

  tiles: {
    url: "assets/tiles/{z}/{x}/{y}.png",

    // Zoom range matches the QGIS tile export.
    minZoom: 15,
    maxZoom: 20,
    maxNativeZoom: 20,
    tms: false,

    // Initial view (QGIS preview center).
    initialCenter: [33.4977, -80.8493],
    initialZoom: 17,

    // Extra zoom-out allowance below the campus cover zoom.
    zoomOutExtra: 0.10,

    // Padding around vector bounds when tile bounds are absent.
    boundsPadding: 0.35,
    bounds: [
      [33.4909200101593001, -80.8627640321827954],
      [33.5051108680217027, -80.8355473474424997]
    ],

    attribution: "© SC State University | Imagery: SC_2023_RGB WMTS"
  },

  /* -- Coordinate system of the GeoJSON data ---------------- */
  dataCRS: "EPSG:4326",

  /* -- Data files -------------------------------------------
     Paths relative to map.html, used when the page is served over
     http/https. When opened from disk (file://), the app falls back
     to the data/*.js shim scripts loaded in map.html. The JSON files
     can be repointed at API endpoints returning the same shape; only
     js/00-data-adapter.js knows the shape. */
  dataFiles: {
    buildings: "data/buildings.geojson",
    tours:     "data/tours.geojson",

    locations:     "data/locations.json",
    treedisSweeps: "data/treedis-sweeps.json",
    courses:       "data/courses.json"
  },

  /* -- Tour ------------------------------------------------- */
  tour: {
    defaultGroup: "mainTour",
    focusZoom: 19
  },

  /* -- Treedis street view ----------------------------------
     Shared SDK settings live at this level; model-specific fields
     (modelId, tourUrl, homeSweepId) live under profiles because two
     models ship (desktop and VR). Per-location sweep lookups come
     from data/treedis-sweeps.json. */
  treedis: {

    /* Per-profile model + tour URL. The boot code picks one via the
       XR detection in js/01-utils.js and copies its values up to
       treedis.modelId / tourUrl. homeSweepId: null opens the iframe
       at the model's default sweep; set a real sweep id to define a
       campus landing point. */
    profiles: {
      desktop: {
        modelId: "8e4ca3fc",
        tourUrl: "https://spaces.dtsxr.com/tour/8e4ca3fc",

        homeSweepId: null
      },
      vr: {
        modelId: "scsu-campus-ade0f346",
        tourUrl: "https://spaces.dtsxr.com/tour/scsu-campus-ade0f346",
        homeSweepId: null
      }
    },

    /* Active-profile aliases. Default to the desktop profile; the boot
       code overwrites them with the VR values when XR is detected. */
    modelId: "8e4ca3fc",
    tourUrl: "https://spaces.dtsxr.com/tour/8e4ca3fc",
    homeSweepId: null,

    /* Origin used for postMessage validation. Both models share it. */
    origin: "https://spaces.dtsxr.com",

    /* External student portal (legacy menu link). */
    studentPortal: "https://metaversitysportal.carrd.co/",

    /* Transition time (ms) for Treedis sweep moves. */
    defaultTransitionTime: 0
  },

  /* -- Layer styles ------------------------------------------
     Off-campus tour stops use a distinct amber/dashed treatment so the
     shape reads as a directional indicator, not a real building. */
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

    toursOffCampus: {
      color: "#9A3412", weight: 2, fillColor: "#FB923C", fillOpacity: 0.75,
      dashArray: "4 3"
    },
    toursOffCampusHover: {
      color: "#7C2D12", weight: 2.5, fillColor: "#F97316", fillOpacity: 0.90,
      dashArray: "4 3"
    },
    selected: {
      color: "#111111", weight: 2.5, fillColor: "#86EFAC", fillOpacity: 0.55
    },
    selectedOffCampus: {
      color: "#7C2D12", weight: 3, fillColor: "#EA580C", fillOpacity: 0.85,
      dashArray: "4 3"
    }
  },

  /* -- UI flags --------------------------------------------- */
  ui: {
    enableHoverPreview: true,
    showBuildingTooltips: true
  }
});
