/* ============================================================
   LSU DEATH VALLEY EXPERIENCE — Configuration (MapLibre GL JS)
   ------------------------------------------------------------
   Forked from the Leaflet build's config.js (Wrapper/map/LSU/).
   This file holds the *structural* settings that wire the app
   together: brand strings, map layers, the coordinate system,
   data file paths, Treedis SDK plumbing, layer styles, and UI
   flags.

   Per-location *content* lives in data/locations.json and
   data/treedis-sweeps.json (see js/00-data-adapter.js) so
   non-technical editors can update copy without touching app
   plumbing.

   NOTE on coordinate order: everything under `map3d` below uses
   MapLibre's [lng, lat] convention — the OPPOSITE of Leaflet's
   [lat, lng], which the old config.js used for `tiles.*`. Double
   check this when hand-editing bounds/centers here.
   ============================================================ */
window.CAMPUS_CONFIG = Object.assign(window.CAMPUS_CONFIG || {}, {
  /* -- Branding ------------------------------------------- */
  brand: {
    name: "LSU Football",
    product: "Death Valley Experience",
    tagline: "The Death Valley Experience"
  },

  /* -- Map layers (MapLibre GL JS) --------------------------
     Imagery is Louisiana DOTD's 2025 6" aerial ImageServer,
     hand-built as a raster source against its `exportImage` REST
     operation using MapLibre's {bbox-epsg-3857} template — no
     esri-leaflet dependency (see js/11-boot.js: addImagerySource()).
     Coverage over LSU campus confirmed via ArcGIS Online Map
     Viewer at (30.410494, -91.185784), next to Tiger Stadium.
     ------------------------------------------------------- */
  esriImagery: {
    // {bbox-epsg-3857} is substituted per-tile by MapLibre at
    // request time. bandIds 0,1,2 = R,G,B — drops the 4th
    // (near-infrared) band so the image renders true-color
    // instead of IR-tinted.
    // FORMAT: jpg, not png32. This is the single biggest performance
    // decision in the app. The source is aerial photography —
    // continuous-tone imagery, which is exactly what JPEG is for —
    // while png32 is lossless RGBA. Measured on one identical tile:
    //
    //     png32  156,115 B   0.28 s      <- what this used to request
    //     png8   140,824 B   0.29 s
    //     jpgpng 156,115 B   0.32 s
    //     jpg     17,177 B   0.18 s      <- 9.1x smaller AND faster
    //
    // A desktop viewport pulls roughly 35 tiles, so this is the
    // difference between ~5.5 MB and ~0.6 MB of basemap for one screen.
    // For scale: the entire rest of the app — MapLibre, all 22 js files,
    // all 15 stylesheets, every data file — is about 120 KB gzipped.
    //
    // The one thing jpg gives up is transparency, which matters only at
    // the EDGE of DOTD's coverage, where a png32 tile would be partly
    // transparent and a jpg tile is opaque black. Campus sits well
    // inside coverage (see README.md), so that edge is outside
    // map3d.bounds. If a black tile ever does appear at the extremes,
    // switch to `jpgpng` — JPEG in the interior, PNG only where
    // transparency is actually needed — and accept the smaller win.
    //
    // SIZE: 512 rather than 256. One 512 jpg tile measured 52,382 B
    // against 68,708 B for the four 256 tiles covering the same ground:
    // fewer bytes and a quarter of the requests. tileSize below must
    // stay in step with the size= parameter here.
    tiles: [
      "https://maps.dotd.la.gov/imagery/rest/services/Imagery/2025_Various_6IN_RGBI/ImageServer/exportImage" +
      "?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=jpg&f=image&bandIds=0,1,2"
    ],
    tileSize: 512,
    // 20, not 21, BECAUSE tileSize became 512. Ground resolution is
    // 2^zoom * tileSize, so z20@512 and z21@256 are the same sharpness —
    // leaving this at 21 would request tiles at twice the detail the
    // 6 in/px source actually has, paying for pixels that do not exist.
    // Zooming past 20 still works; MapLibre overzooms the z20 tiles.
    maxZoom: 20,
    attribution: 'Imagery: Louisiana DOTD, 2025 6" Aerial'
  },

  /* Toggleable streets/buildings/POI-label overlay (off by
     default; #layersBtn toggles it — see js/14-redesign.js).
     Standard OpenStreetMap raster tiles are the only open-data
     source with building- and business-level labels (parking
     lot names, campus building names) rather than just roads
     and city names. Three literal subdomain URLs (MapLibre has
     no Leaflet-style {s} substitution) for round-robin loading.
     PLACEHOLDER: OSM's tile usage policy discourages heavy
     production traffic on this public server — fine for this
     prototype, swap for a paid provider (MapTiler / Stadia
     Maps / Thunderforest — same OSM data, needs an API key)
     before this goes in front of real recruits. */
  referenceOverlay: {
    tiles: [
      "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
    ],
    tileSize: 256,
    opacity: 0.35,
    attribution: "© OpenStreetMap contributors"
  },

  /* AWS Registry of Open Data — public, no-key Terrarium-encoded
     elevation tiles. Loaded lazily, only when 3D mode is first
     entered (see js/05-map-helpers.js: set3DMode()). LSU's campus
     is mostly flat, so most of 3D mode's visual payoff comes from
     buildings/Google Photorealistic 3D Tiles (see map3d below), not
     terrain relief. */
  terrain: {
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    tileSize: 256,
    encoding: "terrarium"
  },

  /* -- Map extent / initial view ----------------------------
     PLACEHOLDER: bounds/center are a desk-research approximation
     of LSU's core football/gameday footprint (Tiger Stadium,
     the Football Operations Center, North/South Stadium Dr).
     ------------------------------------------------------- */
  map3d: {
    // [lng, lat] — center of the ACTUAL combined extent of
    // data/buildings.geojson + data/tours.geojson (computed directly
    // from the data, not eyeballed), so this and `bounds` below stay
    // consistent with each other and with what's really on the map.
    initialCenter: [-91.18745, 30.4121],
    initialZoom: 16,
    initialPitch: 0, // 2D by default; js/14-redesign.js's 3D toggle animates this
    initialBearing: 0,

    minZoom: 14,
    maxZoom: 21,
    zoomOutExtra: 0.5,
    boundsPadding: 0.15,

    // [west, south, east, north] — real combined extent of
    // data/buildings.geojson (lng -91.1939889..-91.1764961, lat
    // 30.4069509..30.4172124) + data/tours.geojson, which now carries
    // REAL stop coordinates from docs/death_valley_stops.csv rather
    // than placeholder boxes (lng -91.195431..-91.183816, lat
    // 30.409712..30.4132 — stops 1/2, Lot 414 and the charter bus, sit
    // well west of the rest). Padded 0.003 deg (~250-330m) on
    // south/east/north, but 0.006 deg on the WEST specifically — with
    // only the flat 0.003 deg used initially, maxBounds clamped
    // map2dStartView's center eastward and pushed stops 1/2 behind the
    // rail sidebar again (confirmed live: they landed at x=315 against
    // a 348px-wide sidebar). The extra west margin gives the camera
    // room to actually center on the full stop spread.
    bounds: [-91.2014, 30.4040, -91.1735, 30.4202],

    // No per-building height data source exists (no OSM height/
    // building:levels tags on data/buildings.geojson) — every building
    // extrudes to this single flat estimate (js/07-layer-builders.js:
    // addSourceAndLayers()). A reasonable flat guess for a 3-4 story
    // campus building; not measured, just uniform. This is the permanent
    // fallback 3D representation, used whenever Google Photorealistic 3D
    // Tiles (below) aren't enabled, fail to load, or are turned off.
    buildingDefaultHeight: 14,

    // -- Google Photorealistic 3D Tiles (js/16-google-tiles.js) --
    // Rendered via NASA-AMMOS's open-source 3d-tiles-renderer + three.js
    // as a MapLibre custom layer. Enabled here with a real key because
    // this file is what GitHub Pages actually serves (config.local.js is
    // gitignored and never deploys) — the key is public static JS to any
    // visitor either way. The real protection is the key's HTTP-referrer
    // restriction (locked to localhost + this GitHub Pages path) and the
    // $10/mo Cloud Billing budget alert on the "lsu-death-valley-3d"
    // project, both confirmed set in Google Cloud Console. That budget
    // alert is notification-only (not a hard spend cap) — if usage looks
    // off, check Cloud Console billing before assuming it's fine.
    googleTilesEnabled: true,
    googleApiKey: "AIzaSyCgDjtnyWh1n5c-2NzMI2eu0EHDtXktLoc",
    googleTilesetUrl: "https://tile.googleapis.com/v1/3dtiles/root.json",
    // Absolute ceiling on how long to wait for the root tileset to load
    // at all before giving up and falling back to the flat extruded-
    // building view above (network failure, bad key, etc.).
    googleTilesMaxWaitMs: 20000,
    // Once tiles ARE loading, how long the tile loader has to go quiet
    // (no downloads/parses in flight) before we consider the current
    // view "settled" and reveal it — LOD refinement happens in several
    // waves (coarse tiles first, then children), so a single "load
    // finished" event fires after just the first wave; this debounce
    // avoids revealing a still-low-resolution intermediate frame.
    googleTilesQuietMs: 500,

    // Fixed camera pose used every time 3D mode is entered
    // (js/16-google-tiles.js: activateGoogleTilesMode()) — jumped to
    // instantly, so every entry starts from the same known view rather
    // than wherever the 2D camera happened to be.
    //
    // center is the exact coordinate requested directly (not
    // cameraForBounds-derived like map2dStartView below). bearing 200
    // = facing south, turned toward the river (west/northwest of
    // campus) — matches the same convention already used for the
    // Kickoff stop's own cam3d preset below in data/tours.geojson, now
    // applied as the general default too (see tour.default3DBearing).
    //
    // TO RETUNE THIS: fly the map to the exact view you want, then run
    //   __captureView()
    // in the browser console. It prints a ready-to-paste replacement
    // for this block (and for map2dStartView below).
    google3DStartView: {
      center: [-91.18543582715819, 30.41871683664508],
      zoom: 16.6, // was 15.6 — +3, matching ~3 mouse-wheel scroll notches in (MapLibre's default scroll-zoom is ~1 level per notch), same center/bearing/pitch
      bearing: 200,
      pitch: 66
    },

    // The matching 2D framing, applied on first load and whenever 3D
    // mode is switched back off. Same center as google3DStartView
    // above (so both modes start from the same verified-clear
    // framing), computed directly by cameraForBounds() for a flat,
    // north-up view rather than reused as-is from the pitched one —
    // pitch and zoom don't carry over 1:1 between a top-down and an
    // oblique camera. Also retunable via __captureView().
    map2dStartView: {
      center: [-91.19086441880341, 30.411144591245616],
      zoom: 10.11,
      bearing: 0,
      pitch: 0
    }
  },

  /* -- Coordinate system of the GeoJSON data --------------- */
  dataCRS: "EPSG:4326",

  /* -- Data files ------------------------------------------- */
  dataFiles: {
    buildings: "data/buildings.geojson",
    tours:     "data/tours.geojson",
    locations:     "data/locations.json",
    treedisSweeps: "data/treedis-sweeps.json",
    // Directory, not a file — one itinerary per gameday, fetched on
    // demand by js/00-data-adapter.js: loadGamedayJSON(id) when a link
    // carries ?g=<id>. Trailing slash required.
    gamedaysDir:   "data/gamedays/"
  },

  /* -- Gameday features (Phase 1) ---------------------------
     Feature flags and timings for My Gameday, Live Visit Mode
     and kiosk mode. Everything tunable lives here rather than
     being scattered through the feature modules, so a display
     in the Lawton Room can be retimed without touching JS.
     ------------------------------------------------------- */
  gameday: {
    // Master switches. Turning one off hides its UI entirely and
    // is the fastest rollback if something misbehaves in front of
    // a real recruit.
    enableMyGameday:  true,
    enableLiveVisit:  true,
    enableGeolocation: true,
    enableKiosk:      true,

    // OFF ON PURPOSE. A service worker is the only real caching control
    // on GitHub Pages (which sends max-age=600 on everything), and it is
    // what lets the app boot at all on a saturated gameday network — but
    // its failure mode is pinning a broken build onto a device where a
    // normal reload will not clear it. Leave it off until geolocation
    // and Live Visit Mode have been exercised in a browser at least once.
    //
    // To turn on: set true and deploy. To turn off: set false and deploy
    // — visitors are unregistered automatically on their next visit.
    // To rescue a device stuck on a bad build without deploying, send
    // them the app URL with `?sw=off`. See js/22-service-worker.js.
    enableServiceWorker: false,

    // Treat a stop as "reached" inside this radius. 150 ft is
    // wider than a typical phone's open-sky accuracy but narrower
    // than the gap between any two stops on this tour.
    arrivalRadiusFt: 150,

    // Above this accuracy figure the fix is too vague to quote a
    // distance from, so Live Visit shows an "approximate" state
    // instead of a confident number.
    poorAccuracyM: 50,

    kiosk: {
      dwellMs:   12000,  // time on each stop before auto-advancing
      idleMs:    90000,  // no interaction for this long → reset to stop 1
      loop:      true
    }
  },

  /* -- Tour configuration ---------------------------------- */
  tour: {
    defaultGroup: "mainTour",
    focusZoom: 18, // 2D fitBounds maxZoom

    // 3D per-stop camera (js/06-details-panel.js: selectFeature()).
    // Generic fallback tilt used when a stop has no hand-tuned
    // `cam3d: {bearing, pitch, zoom}` on its own GeoJSON properties —
    // same placeholder-now-refine-later pattern as stop coordinates.
    // bearing 200 = facing south, turned toward the river — matches
    // map3d.google3DStartView's bearing and the Kickoff stop's own
    // existing cam3d preset, so every 3D camera (start view, and any
    // stop that doesn't hand-tune its own cam3d) shares one look
    // direction instead of most stops defaulting to due-north (0).
    default3DZoom: 15.5,
    default3DPitch: 55,
    default3DBearing: 200
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
