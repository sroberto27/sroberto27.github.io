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
    tours:     "data/tours.geojson"
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
    "Crawford Zimmerman":                          "STUDENT SERVICES",
    "nance hall":                                  "ACADEMICS",
    "s-h-m memorial square":                       "MEMORIAL",
    "oliver c. dawson stadium":                    "ATHLETICS",
    "kirkland w. green student center":            "STUDENT LIFE"
  },

  /* -- Description overrides ------------------------------
     Because the source data has description: "none",
     you can override what appears in the details panel.
     ------------------------------------------------------- */
  descriptionMap: {
    "crawford zimmerman":
      "Crawford-Zimmerman Building is a key administrative and operations " +
      "facility located on campus. It houses several departments, including " +
      "Procurement & Compliance, and serves as a hub for student services, " +
      "such as the SCSU Bookstore.",
    "kirkland w. green student center":
      "The Kirkland W. Green Student Center is the central hub for campus " +
      "life offering dining, social, and recreational spaces for students.",
    "s-h-m memorial square":
      "The Smith-Hammond-Middleton Legacy Plaza at South Carolina State " +
      "University, dedicated in 2022, honors the three victims of the 1968 " +
      "Orangeburg Massacre.",
    "nance hall":
      "Nance Hall serves as a hub for academic activities offering modern " +
      "classrooms and resources to support student learning.",
    "oliver c. dawson stadium":
      "Oliver C. Dawson Stadium is a 22,000 seat multi purpose stadium. " +
      "The Home of SC State Bulldogs football."
  },

  /* -- Location images ------------------------------------
     Paths are relative to index.html. Omit a key (or set it
     to "") to fall back to the placeholder.
     ------------------------------------------------------- */
  imageMap: {
    "Crawford Zimmerman":                "assets/locations/crawford-zimmerman.jpg",
    "kirkland w. green student center":  "assets/locations/kirkland-green.jpg",
    "s-h-m memorial square":             "assets/locations/shm-memorial.jpg",
    "nance hall":                        "assets/locations/nance-hall.jpg",
    "oliver c. dawson stadium":          "assets/locations/dawson-stadium.jpg"
  },

  /* -- "What happens here?" chips -------------------------
     Shown as pill chips in the metadata panel. Each array
     entry becomes one chip.
     ------------------------------------------------------- */
  happensHereMap: {
    "crawford zimmerman": [
      "Student services",
      "Warehouse",
      "Campus Bookstore"
    ],
    "kirkland w. green student center": [
      "Dining (\"The Pitt\")",
      "Campus Hub"
    ],
    "s-h-m memorial square": [
      "Memorial bronze busts",
      "Annual commemoration",
      "Historical marker"
    ],
    "nance hall": [
      "Classrooms",
      "General lecture room"
    ],
    "oliver c. dawson stadium": [
      "Bulldogs Football",
      "SC State women's soccer team"
    ]
  },

  /* -- "Explorable locations" list ------------------------
     Shown as the list of sub-locations in the metadata
     panel. Each entry becomes one row.
     ------------------------------------------------------- */
  explorableMap: {
    "crawford zimmerman": [
      "Campus Bookstore",
      "Office of Student Financial Services",
      "Facilities Management & Operations",
      "Admissions & Financial Aid"
    ],
    "kirkland w. green student center": [],
    "s-h-m memorial square": [
      "Historical marker",
      "Bronze Busts/Monuments"
    ],
    "nance hall": [
      "Room 110",
      "General Lecture Room",
      "Room 100"
    ],
    "oliver c. dawson stadium": [
      "Midfield",
      "Gate 1",
      "Bulldog wall"
    ]
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
