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
    initialCenter: [30.336474244489125, -90.0441878437403],
    initialZoom: 16,
    zoomOutExtra: 0.10,

    // Extra space around building/tour bounds when fitting the map.
    boundsPadding: 0.35,
    // TODO: replace with your tiled raster's extent from QGIS
    // (Layer Properties → Information → Extent, reprojected to
    // EPSG:4326). Format: [[southLat, westLng], [northLat, eastLng]].
    // The placeholder below roughly covers Iberia Parish from
    // Cypremort Point up past Lake Fausse Pointe.
    bounds: [
      [30.2886772155761719, -90.2335510253906250],   // south, west
      [30.5302581787109375, -89.9009170532226563]    // north, east
    ],

    attribution: "© City of Mandeville | Imagery: Lousiana:Fontainebleau State Park"
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

  /* -- Layer styles ------------------------------------------
     Redesign palette (DESIGN-SPEC §4):
       • city (civic/historic) — blue fill rgba(15,76,129,.28),
         navy outline
       • parks/recreation      — gold fill rgba(232,185,60,.32),
         dark-gold outline
       • selected              — brighter fill + 3px outline
     styleFor()/hoverStyleFor()/selectedStyleFor() in
     js/02-state.js pick city vs. park per feature category. */
  styles: {
    buildings: {
      color: "#8A8778", weight: 1, fillColor: "#CBD5E1", fillOpacity: 0.12
    },
    buildingsHover: {
      color: "#5F5E5A", weight: 1.5, fillColor: "#94A3B8", fillOpacity: 0.28
    },

    /* City / civic tour polygons */
    tours: {
      color: "#0B2545", weight: 2, fillColor: "#0F4C81", fillOpacity: 0.28
    },
    toursHover: {
      color: "#0B2545", weight: 2.5, fillColor: "#0F4C81", fillOpacity: 0.36
    },

    /* Parks & recreation tour polygons */
    toursPark: {
      color: "#7A5C10", weight: 2, fillColor: "#E8B93C", fillOpacity: 0.32
    },
    toursParkHover: {
      color: "#7A5C10", weight: 2.5, fillColor: "#E8B93C", fillOpacity: 0.42
    },

    /* Off-campus directional indicators (unchanged behavior) */
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
      color: "#0B2545", weight: 3, fillColor: "#0F4C81", fillOpacity: 0.42
    },
    selectedPark: {
      color: "#7A5C10", weight: 3, fillColor: "#E8B93C", fillOpacity: 0.48
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
