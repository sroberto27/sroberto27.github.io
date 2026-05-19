/* ============================================================
   SCSU METAVERSITY — Per-location content
   ------------------------------------------------------------
   Loaded via <script>, like the other data/*.js files. Writes
   onto window.CAMPUS_CONFIG so app.js can keep reading these
   maps from `config.descriptionMap`, `config.imageMap`, etc.
   without any changes.

   Each map is keyed case-insensitively by the feature `name`
   from the GeoJSON data. This file is the place to edit the
   human-readable copy: descriptions, hero images, the
   "What happens here?" pill chips, the "Explorable locations"
   list, and the department category labels.

   Structural settings (map tiles, Treedis SDK plumbing,
   Leaflet styles, UI flags) live in config.js.
   ============================================================ */
window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};

/* -- Category overrides for tour stops --------------------
   These power the department labels shown in the locations
   list (e.g. "MATH & SCIENCE" under "Nance Hall").
   Keys are matched case-insensitively against `name`.
   --------------------------------------------------------- */
window.CAMPUS_CONFIG.categoryMap = {
  "crawford zimmerman":                          "STUDENT SERVICES",
  "nance hall":                                  "ACADEMICS",
  "s-h-m memorial square":                       "MEMORIAL",
  "oliver c. dawson stadium":                    "ATHLETICS",
  "kirkland w. green student center":            "STUDENT LIFE",
  "olar farm":                                   "OFF-CAMPUS FACILITY",

  /* Academic buildings */
  "crawford hall engineering":                   "ACADEMICS",
  "hodge hall":                                  "ACADEMICS",
  "davis hall":                                  "ACADEMICS",
  "engineering & computer science complex":      "ACADEMICS",
  "turner hall":                                 "ACADEMICS",
  "miller f. whittaker library":                 "ACADEMICS",
  "mlk auditorium":                              "ACADEMICS",
  "belcher hall":                                "ACADEMICS",
  "moss hall":                                   "ACADEMICS",

  /* Administrative buildings */
  "administration building":                     "ADMINISTRATION",
  "lowman hall":                                 "ADMINISTRATION",
  "wilkinson hall":                              "ADMINISTRATION",

  /* Athletics */
  "dukes gymnasium":                             "ATHLETICS",
  "smith-hammond-middleton memorial center":     "ATHLETICS",

  /* Museum / cultural */
  "i.p. stanback museum & planetarium":          "MUSEUM & CULTURAL",
  "south carolina state university-department of visual & performing arts":
                                                 "ACADEMICS",

  /* Residence halls */
  "truth hall":                                  "RESIDENCE LIFE",
  "mitchell hall":                               "RESIDENCE LIFE",
  "hugine suites":                               "RESIDENCE LIFE",
  "battiste hall":                               "RESIDENCE LIFE",
  "earle hall":                                  "RESIDENCE LIFE",
  "williams hall":                               "RESIDENCE LIFE",
  "miller hall":                                 "RESIDENCE LIFE",

  /* Health / wellness */
  "infirmary & self development center":         "HEALTH & WELLNESS"
};

/* -- Description overrides --------------------------------
   Because the source data has description: "none",
   you can override what appears in the details panel.
   --------------------------------------------------------- */
window.CAMPUS_CONFIG.descriptionMap = {
  "crawford zimmerman":
    "The Crawford-Zimmerman Service Complex houses Facilities Management " +
    "operations as well as the Enrollment Management suite, including Admissions," +
    "Financial Aid, and Title III Programs. It also serves as the administrative " +
    "address for Residence Life & Housing.",
  "kirkland w. green student center":
    "The primary hub for student life on campus, the Green Student Center houses " +
    "Washington Dining Hall, 'The Pitt' dining area, and a variety of student services" +
    "Originally built in 1954 with a major addition in 1970. Currently undergoing" +
    " a $4.2 million renovation.",
  "s-h-m memorial square":
    "The Smith-Hammond-Middleton Legacy Plaza at South Carolina State " +
    "University, dedicated in 2022, honors the three victims of the 1968 " +
    "Orangeburg Massacre.",
  "nance hall":
    "Home to the College of Agriculture and the Mathematics & Science departments" +
    "Nance Hall hosts several of the USDA-aligned laboratory" +
    "spaces used in the NRM curriculum.",
  "oliver c. dawson stadium":
    "Home of the SC State Bulldogs football and women's soccer teams. " +
    "Built in 1955 on Buckley Street, named in 1984 for coach and AD Oliver" +
    "Cromwell Dawson. Capacity raised to 22,000 in 1994 via a $4.5M renovation." +
    "Synthetic turf and a new scoreboard installed in 2006.",
  "olar farm":
    "The Olar Farm is an off-campus agricultural facility operated by " +
    "South Carolina State University, located approximately 30 miles " +
    "southwest of the main campus in Olar, SC. It supports the " +
    "university's 1890 Research & Extension programs in sustainable " +
    "agriculture and applied research. " +
    "This location is not part of the main campus map, te point on " +
    "the map points in its general direction. Click \"Explore\" to " +
    "open the virtual tour of the farm.",

  /* -- Academic buildings -- */
  "crawford hall engineering":
    "Crawford Hall Engineering — more information about this " +
    "location is coming soon.",
  "hodge hall":
    "Built in 1928 in the Palladian style by architect Miller F. " +
    "Whittaker, Hodge Hall is a two-story brick science building with " +
    "a full basement. Originally built for Agriculture and Home " +
    "Economics, it now houses the sciences. Listed on the National " +
    "Register of Historic Places, with two modern rear additions.",
  "davis hall":
    "Davis Hall houses classrooms and faculty offices for the " +
    "Department of Biological & Physical Sciences. (Distinct from " +
    "the Leroy Davis Sr. Science and Research Complex.)",
  "engineering & computer science complex":
    "Opened in 2013, the four-story Engineering and Computer Science " +
    "Complex provides 85,400 square feet of cutting-edge STEM " +
    "learning space — lecture halls, research centers, teaching and " +
    "research laboratories, computer labs, and faculty offices. " +
    "Designed by Evoke Studios at a cost of approximately $24.5 " +
    "million.",
  "turner hall":
    "A multi-wing academic building that has housed Health Sciences, " +
    "Education, and other departments, with portions dating back " +
    "nearly a century. It is being replaced by a new $54.7 million, " +
    "94,000 sq ft academic building (groundbreaking April 2024; " +
    "completion expected fall 2027).",
  "miller f. whittaker library":
    "The university's main library, built with a $1 million state " +
    "appropriation and dedicated in 1969. Named for SC State's third " +
    "president, Miller F. Whittaker. Originally two levels; a third " +
    "mezzanine level was added in 1979. A 50,000 sq ft replacement " +
    "library is in planning.",
  "mlk auditorium":
    "Built in 1974, the Martin Luther King Jr. Auditorium is the " +
    "primary large-event venue on campus. It made national history " +
    "on April 26, 2007 as the site of the first 2008 Democratic " +
    "presidential primary debate — the first HBCU ever to host a " +
    "presidential debate.",
  "belcher hall":
    "Built in 1986 and named for benefactor Algernon S. Belcher, " +
    "Belcher Hall is home to the College of Business & Information " +
    "Systems, the Career Center (Suite 250), and the BECT Institute.",
  "moss hall":
    "Built in 1949, Moss Hall is part of the SC State College " +
    "Historic District and houses the Registrar's Office (Room 202) " +
    "and the Student Success Center / TRIO program. The Moss Hall " +
    "Annex is being converted to a telehealth center.",

  /* -- Administrative buildings -- */
  "administration building":
    "Built in 1970, the Ko W.G. Donma Administration Building is " +
    "the central administrative hub of SC State, housing the Office " +
    "of the President (Suite 210) and University Relations & " +
    "Marketing (Suite 100).",
  "lowman hall":
    "The oldest intact building on campus, Lowman Hall was designed " +
    "by architect Miller F. Whittaker in 1917 and originally served " +
    "as a men's dormitory. Restored 2001–2009, it now houses " +
    "Administration, Institutional Research, and Institutional " +
    "Advancement offices. Listed individually on the National " +
    "Register of Historic Places.",
  "wilkinson hall":
    "Built in 1938 with New Deal funding, Wilkinson Hall was the " +
    "university's first separate library building. A 16,000 sq ft " +
    "contributing property within the SC State College Historic " +
    "District, it has been undergoing renovation since 2018 via " +
    "National Park Service federal grants.",

  /* -- Athletics -- */
  "dukes gymnasium":
    "Built in 1931 and funded by student recreation fees, Dukes " +
    "Gymnasium is a two-story brick building with a full basement, " +
    "listed on the National Register of Historic Places. Home venue " +
    "for the women's volleyball team and the Office of Intramural " +
    "Sports. It contains a regulation basketball court, yoga space, " +
    "and basement weight room.",
  "smith-hammond-middleton memorial center":
    "Opened in 1968, the Smith-Hammond-Middleton Memorial Center is " +
    "the primary Health and Physical Education facility on campus, " +
    "serving both varsity athletics and general recreation. Its " +
    "opening shifted Dukes Gymnasium to intramural use.",

  /* -- Museum / cultural -- */
  "i.p. stanback museum & planetarium":
    "Opened in 1979, the I.P. Stanback Museum and Planetarium is " +
    "the only interdisciplinary art museum and planetarium on any " +
    "HBCU campus in the United States. It presents rotating " +
    "exhibitions year-round and showcases graduating senior artwork " +
    "each May.",

  /* The Fine Arts Building. The GeoJSON name is the long
     department title; this key matches that literal name. If the
     GeoJSON feature is ever renamed to "Fine Arts Building", change
     this key to "fine arts building". */
  "south carolina state university-department of visual & performing arts":
    "Constructed in 1999, the Fine Arts Building gave the Art and " +
    "Music departments a dedicated home. It includes the Barbara A. " +
    "Vaughan Recital Hall (currently undergoing seating repairs) " +
    "and serves as the center for creative arts programming at SC " +
    "State.",

  /* -- Residence halls -- */
  "truth hall":
    "At 14 stories, Sojourner Truth Hall is the tallest building in " +
    "Orangeburg County. Built in 1972 as a women's residence hall. " +
    "Its dining hall was converted to a cyber café called Pete's " +
    "Arena. Currently undergoing a $25 million renovation, including " +
    "installation of a fire suppression system to reopen the upper " +
    "floors.",
  "mitchell hall":
    "John H. Mitchell Hall is a men's residence hall built in 1975. " +
    "A new 500+ bed residence hall is planned adjacent on Naylor " +
    "Street ($50 million, 110,000 sq ft; groundbreaking April 2026; " +
    "occupancy fall 2027).",
  "hugine suites":
    "The largest dormitory in South Carolina, Hugine Suites opened " +
    "in 2006 with 771 beds across six buildings. Named for " +
    "President Andrew Hugine Jr.",
  "battiste hall":
    "A 200-room co-ed residence hall designed by Huff + Gooden " +
    "Architects. It completes the urban street wall between two " +
    "existing dormitories along the internal east-west campus axis.",
  "earle hall":
    "Earle Hall is a residential hall serving SC State students.",
  "williams hall":
    "Williams Hall is a residential hall serving SC State students.",
  "miller hall":
    "Miller Hall is a former women's dormitory built in 1938 as part " +
    "of the SC State College Historic District. It was closed after " +
    "Hugine Suites opened, due to fire alarm system malfunctions.",

  /* -- Health / wellness -- */
  "infirmary & self development center":
    "The Infirmary & Self Development Center supports student " +
    "health, wellness, and personal development on the SC State " +
    "campus. More information about this location is coming soon."
};

/* -- Location images --------------------------------------
   Paths are relative to index.html. Omit a key (or set it
   to "") to fall back to the placeholder.
   --------------------------------------------------------- */
window.CAMPUS_CONFIG.imageMap = {
  "crawford zimmerman":                "assets/locations/crawford-zimmerman.webp",
  "kirkland w. green student center":  "assets/locations/kirkland-green.webp",
  "s-h-m memorial square":             "assets/locations/shm-memorial.webp",
  "nance hall":                        "assets/locations/nance-hall.webp",
  "oliver c. dawson stadium":          "assets/locations/dawson-stadium.webp",
  "olar farm":                         "assets/locations/olar-farm.webp"
};

/* -- "What happens here?" chips ---------------------------
   Shown as pill chips in the metadata panel. Each array
   entry becomes one chip.
   --------------------------------------------------------- */
window.CAMPUS_CONFIG.happensHereMap = {
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
  ],
  "olar farm": [
    "1890 Research & Extension",
    "Sustainable agriculture",
    "Applied research"
  ],

  /* -- Academic buildings -- */
  "crawford hall engineering": [
    "Engineering",
    "Classrooms",
    "Faculty offices"
  ],
  "hodge hall": [
    "Science",
    "Biology",
    "Physics",
    "Chemistry",
    "Historic (NRHP)"
  ],
  "davis hall": [
    "Biology",
    "Physics",
    "Classrooms",
    "Faculty offices"
  ],
  "engineering & computer science complex": [
    "Engineering",
    "Computer Science",
    "STEM",
    "Research labs",
    "Cybersecurity",
    "Nuclear Engineering"
  ],
  "turner hall": [
    "Health Sciences",
    "Education",
    "Classrooms",
    "Faculty offices"
  ],
  "miller f. whittaker library": [
    "Library",
    "Research",
    "Study spaces",
    "Circulation",
    "Archives"
  ],
  "mlk auditorium": [
    "Convocation",
    "Events",
    "Debates",
    "Concerts",
    "Lectures",
    "Presidential debate site"
  ],
  "belcher hall": [
    "Business",
    "Finance",
    "Accounting",
    "Career Center",
    "BECT Institute",
    "Information Systems"
  ],
  "moss hall": [
    "Registrar",
    "Student Success",
    "TRIO",
    "Academic Support",
    "Telehealth"
  ],

  /* -- Administrative buildings -- */
  "administration building": [
    "Office of the President",
    "University Relations",
    "Marketing",
    "Communications"
  ],
  "lowman hall": [
    "Administration",
    "Institutional Research",
    "Institutional Advancement",
    "Oldest building (1917)",
    "Historic (NRHP)"
  ],
  "wilkinson hall": [
    "Historic",
    "NRHP District",
    "New Deal era",
    "Former library",
    "Under renovation"
  ],

  /* -- Athletics -- */
  "dukes gymnasium": [
    "Volleyball",
    "Intramural Sports",
    "Basketball",
    "Historic (NRHP)",
    "Community events"
  ],
  "smith-hammond-middleton memorial center": [
    "Athletics",
    "Physical Education",
    "Recreation",
    "Fitness"
  ],

  /* -- Museum / cultural -- */
  "i.p. stanback museum & planetarium": [
    "Museum",
    "Planetarium",
    "Art exhibitions",
    "HBCU first",
    "Cultural heritage",
    "STEM"
  ],

  "south carolina state university-department of visual & performing arts": [
    "Art",
    "Music",
    "Recital Hall",
    "Performing Arts",
    "Gallery",
    "Studio"
  ],

  /* -- Residence halls -- */
  "truth hall": [
    "Residence Hall",
    "Tallest building in Orangeburg",
    "Pete's Arena cyber café",
    "Under renovation"
  ],
  "mitchell hall": [
    "Residence Hall",
    "Men's housing"
  ],
  "hugine suites": [
    "Residence Hall",
    "Suite-style housing",
    "Largest dorm in SC",
    "Modern housing"
  ],
  "battiste hall": [
    "Residence Hall",
    "Co-ed",
    "Modern housing"
  ],
  "earle hall": [
    "Residence Hall",
    "Dormitory"
  ],
  "williams hall": [
    "Residence Hall",
    "Dormitory"
  ],
  "miller hall": [
    "Historic",
    "NRHP District",
    "Closed",
    "Former dormitory"
  ],

  /* -- Health / wellness -- */
  "infirmary & self development center": [
    "Student Health",
    "Wellness",
    "Counseling",
    "Self Development"
  ]
};

/* -- Physical addresses -----------------------------------
   Maps a location name to a real-world mailing/street
   address. Used to render an "Open in Maps" link in the
   details panel — useful for off-campus locations like the
   Olar Farm, but works for any location with a known
   address. Keys are matched case-insensitively against
   `name`. Omit a key (or set it to "") to hide the row.
   --------------------------------------------------------- */
window.CAMPUS_CONFIG.addressMap = {
  "olar farm": "1678 Alligator Rd, Olar, SC 29843"
};

/* -- "Explorable locations" list --------------------------
   Shown as the list of sub-locations in the metadata
   panel. Each entry becomes one row.
   --------------------------------------------------------- */
window.CAMPUS_CONFIG.explorableMap = {
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
    "Lecture Room",
    "Room 100"
  ],
  "oliver c. dawson stadium": [
    "Midfield",
    "Gate 1",
    "Bulldog wall"
  ]
};
