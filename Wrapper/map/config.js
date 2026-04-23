/* ============================================================
   SCSU METAVERSITY — Configuration
   ============================================================ */
window.CAMPUS_CONFIG = {
  /* -- Branding ------------------------------------------- */
  brand: {
    name: "SCSU",
    product: "Metaversity",
    tagline: "Virtual Campus Tour"
  },

  /* -- Satellite image ------------------------------------- */
  imageUrl: "assets/campus_satellite.svg",
  imageWidthPx: 7016,
  imageHeightPx: 4961,

  // How much space QGIS left around the features when it
  // exported the PNG (overall scale).
  imagePaddingPct: 0.12,

  // Fine-tuning offsets/scale applied AFTER the padding math.
  // You don't have to guess these — press the "Align" button in
  // the top bar (or Shift+A) and nudge the image with arrow keys
  // until it lines up, then hit "Copy config" and paste the
  // values back here.
  imageOffsetLat: -0.000040,
  imageOffsetLng: -0.000048,
  imageScaleX:    1.4040,
  imageScaleY:    0.9940,

  /* -- Coordinate system of the GeoJSON data --------------- */
  // "EPSG:3857" (Web Mercator meters, QGIS default)
  // "EPSG:4326" (raw lon/lat degrees)
  dataCRS: "EPSG:3857",

  /* -- Data files -----------------------------------------
     Paths to the GeoJSON files, relative to index.html.
     These are used when the page is served over http/https.
     When opened directly from disk (file://), the app falls
     back to the data/*.js shim scripts loaded in index.html.
     ------------------------------------------------------- */
  dataFiles: {
    buildings: "data/buildings.geojson",
    tours:     "data/tours.geojson",
  },

  /* -- Tour configuration ---------------------------------- */
  tour: {
    defaultGroup: "mainTour",
    focusZoom: 19
  },

  /* -- Category overrides for tour stops ------------------
     These power the department labels shown in the locations
     list (e.g. "MATH & SCIENCE" under "Nance Hall").
     Keys are matched case-insensitively against `name`.
     ------------------------------------------------------- */
  categoryMap: {
    "south carolina state university bookstore": "STUDENT LIFE",
    "nance hall":                                  "ClASS ROOMS",
    "s-h-m memorial square":                       "MEMORIAL",
    "oliver c. dawson stadium":                    "ATHLETICS",
    "kirkland w. green student center":            "STUDENT LIFE"
  },

  /* -- Location images ------------------------------------
     Paths are relative to index.html. Omit a key (or set it
     to "") to fall back to the placeholder.
     ------------------------------------------------------- */
  imageMap: {
    "crawford zimmerman":                "assets/locations/crawford-zimmerman.jpg",
    "kirkland w. green student center":  "assets/locations/kirkland-green.jpg",
    "s-h-m memorial square":             "assets/locations/shm-memorial.jpg",
    "nance hall":                        "assets/locations/nance-hall.jpg",
    "oliver c. dawson stadium":          "assets/locations/dawson-stadium.jpg"
  },

  /* -- Description overrides ------------------------------
     Because the source data has description: "none",
     you can override what appears in the details panel.
     ------------------------------------------------------- */
  descriptionMap: {
    "Crawford Zimmerman":
      "Crawford-Zimmerman Building is a key administrative and operations "+
      "facility located on campus. It houses several, departments, including"+
      " Procurement & Compliance, and serves as a hub for student services,"+
      "such as the SCSU Bookstore.",
    "nance hall":
      "Nance Hall serves as a hub for academic activities offering modern" +
      "and resources to support student learning.",
    "s-h-m memorial square":
      "Nance Hall serves as a hub for academic activities " +
      "killed in the 1968 Orangeburg Massacre — a defining moment in the " +
      "civil rights movement and in university history.",
    "oliver c. dawson stadium":
      "Home of the SC State Bulldogs football program. The stadium seats " +
      "over 22,000 fans and hosts the annual MEAC/SWAC Challenge.",
    "kirkland w. green student center":
      "The heart of student life on campus. The Student Center houses " +
      "dining, the campus post office, lounges, meeting rooms, and a " +
      "variety of student organizations."
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
};
