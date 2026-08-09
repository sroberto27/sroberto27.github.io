/* ============================================================
   Site configuration and content
   ------------------------------------------------------------
   All copy, navigation, forms, and example-window content live
   here. To point the site at a different Treedis showcase, set
   treedis.tourUrl and treedis.origin below.
   ============================================================ */
window.DTS_CONFIG = {
  brand: {
    name: "Digital Twin Studios",
    short: "DTS",
    tagline: "Curated Spatial Experiences",
    motto: "The World as Interface",
    domain: "dtsxr.com"
  },

  treedis: {
    /* Default showcase shown by "Try a Digital Twin". */
    tourUrl: "https://spaces.dtsxr.com/tour/4fb22059",
    origin:  "https://spaces.dtsxr.com",

    /* Optional landing sweep — null opens the model default. */
    homeSweepId: null,

    /* Transition time (ms) when Treedis moves between sweeps. */
    defaultTransitionTime: 1500
  },

  /* Client portal entry point — kept separate from the marketing
     flow. Placeholder until a real authenticated portal exists. */
  clientPortalUrl: "#access-your-twin",

  /* GIS map/tour documents, keyed by id. Empty until Phase 3+ authors any
     (data/gis/maps, data/gis/tours) — kept here only for structural parity
     with the shape js/content-loader.js builds from /data. */
  gisMaps: {},
  gisTours: {},

  /* The four sector pillars are the primary navigation. Order:
     Education → Industry → Government → Community. */
  categories: [
    {
      id: "education",
      label: "Education",
      navSub: "Campus",                  // pillar sublabel
      blurb: "Education develops people.",
      active: true,
      accent: "#E9B44C",                 // sector accent color
      kicker: "EDUCATION",
      title: "Campus & Schools",
      sub: "Digital Twin of your campus",
      body: "Where human potential is built. DTS creates living spatial ecosystems for learning environments \u2014 from recruitment through graduation. One twin. Every stage of the student and faculty relationship with your institution.",
      cards: [
        { id: "campus",     title: "Campus & Schools",     text: "Spatial navigation, orientation, LMS gateway, K-12 through university." },
        { id: "workforce",  title: "Workforce & Trade",    text: "Skills labs, certification, DOL-funded programs, economic mobility." },
        { id: "healthcare", title: "Healthcare Training",  text: "Staff orientation, clinical simulation, patient safety environments." },
        { id: "workplace",  title: "Workplace Learning",   text: "Corporate onboarding, continuing ed, Betaversity, EON Reality." }
      ]
    },
    {
      id: "industry",
      label: "Industry",
      navSub: "Company",
      blurb: "Industry creates economic value.",
      active: false,
      accent: "#2E8BFF",
      kicker: "INDUSTRY",
      title: "Commercial & Industrial",
      sub: "Digital Twin of your company",
      body: "Where capability creates economic value. Manufacturing holds 30%+ of the digital twin market. Automotive holds 22%+. Healthcare is the fastest-growing segment. DTS has active or adjacent work across all four commercial verticals.",
      cards: [
        { id: "energy",     title: "Energy & Manufacturing",       text: "Oil/gas, solar, utilities, industrial ops, FEMA PA documentation." },
        { id: "automotive", title: "Automotive & Transportation",  short: "Automotive", text: "Showrooms, vehicle twins, EV facilities, franchise audits." },
        { id: "healthfac",  title: "Healthcare Facilities",        text: "Hospital systems, clinical environments, pharmaceutical facilities." },
        { id: "properties", title: "Properties & Places",          text: "Commercial, residential, hospitality, tourism, film locations." }
      ]
    },
    {
      id: "government",
      label: "Government",
      navSub: "City",
      blurb: "Government provides structure and oversight.",
      active: false,
      accent: "#34598F",
      kicker: "GOVERNMENT",
      title: "Public & Civic",
      sub: "Digital Twin of your city",
      body: "Where collective output becomes public infrastructure. Government has a fundamentally different procurement process, budget authority, and decision timeline. DTS is SAM.gov qualified. Organized by function \u2014 not agency level.",
      cards: [
        { id: "municipal",  title: "Infrastructure & Cities",   text: "Municipal twins, transportation, utility grids, urban planning." },
        { id: "gfc",        title: "Coastal Resilience",        short: "Coastal", text: "Parish-scale digital twins, GIS, and scenario planning for coastal risk." },
        { id: "foodsafety", title: "Regulatory & Compliance",   text: "Food safety, environmental compliance, inspection training." },
        { id: "civic",      title: "Civic Services",            text: "Libraries, transit, parks, civic engagement, accessibility." }
      ]
    },
    {
      id: "community",
      label: "Community",
      navSub: "Community",
      blurb: "Community represents the lived outcomes of those systems.",
      active: false,
      accent: "#D27049",
      kicker: "COMMUNITY",
      title: "Civic & Social",
      sub: "Digital Twin of your community",
      body: "Where all systems converge into human flourishing. The community twin accumulates \u2014 each project adds to a growing spatial record, building by building, until the community itself is spatially documented and interconnected.",
      cards: [
        { id: "economic",   title: "Economic Development",         text: "Downtown BIDs, chambers, EDCs, commercial corridors." },
        { id: "nonprofit",  title: "Nonprofit & Social Impact",    text: "NGOs, foundations, DIG, faith communities, social services." },
        { id: "sustain",    title: "Sustainability & Environment", short: "Sustainability", text: "Green infrastructure, ESG twins, environmental monitoring." },
        { id: "heritage",   title: "Cultural & Heritage",          text: "Historic preservation, Section 106, museums, heritage tourism." }
      ]
    }
  ],

  /* Project-evidence filter labels used by the example windows. */
  evidence: ["Case Studies", "Awards", "Client Feedback", "Press & Research", "Project Data"],

  /* Rotating placeholder prompts for the question bar. */
  questionPrompts: [
    "What does Digital Twin Studios do?",
    "What is Treedis?",
    "What is a Matterport capture like?",
    "What is a Digital Twin?",
    "How do I get in contact?",
    "Can I use a mobile device?"
  ],

  /* Contact / conversion CTAs (ocean layer). */
  contact: {
    kicker: "READY TO BEGIN?",
    headline: "Begin with the right",
    headlineAccent: "first step.",
    body: "Every DTS engagement starts with a conversation. Not a demo. Not a pitch. A structured discovery of what your space needs and what a twin can do for it.",
    footnote: "Pilots are scoped engagements · Fee established during the proposal stage",
    ctas: [
      { id: "discovery", stage: "PLAN",    label: "SCHEDULE A DISCOVERY", primary: false },
      { id: "proposal",  stage: "PROPOSE", label: "REQUEST A PROPOSAL",   primary: true  },
      { id: "pilot",     stage: "PILOT",   label: "START A PILOT",        primary: false }
    ]
  },

  /* ============================================================
     LEAD CAPTURE — emails the owner on form submit
     ------------------------------------------------------------
     Delivery uses Web3Forms (https://web3forms.com) directly from the
     browser -- Web3Forms documents this access key as public/safe for
     client-side use (docs/migration/PROGRESS.md's Phase 7 entry). A
     Turnstile widget gates the submit button client-side (no server-side
     verification) as a lightweight bot deterrent.
     Without a key, forms fall back to a pre-filled mailto: link.
     ============================================================ */
  lead: {
    accessKey: "81e0fad6-ed36-42e7-b055-f5ce2ac92a04",
    /* Destination inbox for leads (production: hello@dtsxr.com). */
    ownerEmail: "robertoenrique2710@hotmail.com",
    subjectPrefix: "DTS Website Lead",

    /* One form definition per contact CTA. The `sector` field is
       auto-filled from the category the user is browsing. */
    forms: {
      /* `half: true` pairs a field two-up; textareas span the row. */
      discovery: {
        title: "Schedule a Discovery",
        intro: "Schedule a 30-minute conversation with one of our team members about your space and what a digital twin could do for you.",
        submitLabel: "SCHEDULE A DISCOVERY",
        fields: [
          { name: "name",    label: "Full Name",    type: "text",  required: true,  placeholder: "First and Last Name", half: true },
          { name: "phone",   label: "Phone number", type: "tel",   required: true,  placeholder: "(###) ### - ####",    half: true },
          { name: "email",   label: "Email",        type: "email", required: true,  placeholder: "address@email.com",   half: true },
          { name: "org",     label: "Company Name", type: "text",  required: true,  half: true },
          { name: "country", label: "Country",      type: "select", required: false, half: true,
            options: ["United States", "Canada", "United Kingdom", "European Union", "Other"] },
          { name: "timing",  label: "Ideal time frame", type: "select", required: false, half: true,
            options: ["This week", "Next 2 weeks", "This month", "Just exploring"] },
          { name: "notes",   label: "Anything we should know?", optional: true, type: "textarea", required: false }
        ]
      },
      proposal: {
        title: "Request a Proposal",
        intro: "Tell us about the space and the outcome you're after. We'll scope a proposal and send it back.",
        submitLabel: "REQUEST A PROPOSAL",
        fields: [
          { name: "name",     label: "Full Name",    type: "text",  required: true,  placeholder: "First and Last Name", half: true },
          { name: "phone",    label: "Phone number", type: "tel",   required: true,  placeholder: "(###) ### - ####",    half: true },
          { name: "email",    label: "Email",        type: "email", required: true,  placeholder: "address@email.com",   half: true },
          { name: "org",      label: "Company Name", type: "text",  required: true,  half: true },
          { name: "country",  label: "Country",      type: "select", required: false, half: true,
            options: ["United States", "Canada", "United Kingdom", "European Union", "Other"] },
          { name: "timeline", label: "Target timeline", type: "select", required: false, half: true,
            options: ["ASAP", "This quarter", "This year", "Planning ahead"] },
          { name: "notes",    label: "Describe the goal", optional: true, type: "textarea", required: false }
        ]
      },
      pilot: {
        title: "Start a Pilot",
        intro: "A pilot is a scoped, paid engagement \u2014 one defined space, a digital twin, a clear deliverable. The fee is set during the proposal stage. Tell us what you'd pilot and we'll define the scope with you.",
        submitLabel: "START MY PILOT REQUEST",
        fields: [
          { name: "name",     label: "Full Name",    type: "text",  required: true,  placeholder: "First and Last Name", half: true },
          { name: "phone",    label: "Phone number", type: "tel",   required: true,  placeholder: "(###) ### - ####",    half: true },
          { name: "email",    label: "Email",        type: "email", required: true,  placeholder: "address@email.com",   half: true },
          { name: "org",      label: "Company Name", type: "text",  required: true,  half: true },
          { name: "country",  label: "Country",      type: "select", required: false, half: true,
            options: ["United States", "Canada", "United Kingdom", "European Union", "Other"] },
          { name: "timeline", label: "Time-frame",   type: "select", required: false, half: true,
            options: ["Immediately", "Within a month", "This quarter", "Still scoping"] },
          { name: "space",    label: "Space you'd pilot", type: "text", required: true },
          { name: "outcome",  label: "What does success look like?", type: "textarea", required: false }
        ]
      }
    }
  }
,

  /* ============================================================
     SUB-VERTICAL EXAMPLES — windows opened by card / tab clicks
     ------------------------------------------------------------
     Keyed by the card `id` in categories[].cards. Fields:
       media    — main experience pane: a Treedis tour or a Vimeo
                  embed; omit to reuse the shared showcase iframe.
       links    — related tours/videos shown as chips.
       gallery  — real project imagery (assets/portfolio/).
       sweepId  — optional sweep for the shared showcase fallback.
       illustrative: true flags placeholder projects to be swapped
                  for real ones later.
     ============================================================ */
  examples: {
    /* ---------------- EDUCATION ---------------- */
    campus: {
      sector: "education",
      title: "Campus & Schools",
      tagline: "Spatial navigation, orientation, an LMS gateway — K-12 through university.",
      overview: "A campus twin turns a sprawling, hard-to-navigate institution into a space a prospective student, parent, or new hire can walk before they ever arrive. The world is the interface: wayfinding, recruitment tours, orientation, and an LMS launch point all live in one persistent spatial layer.",
      project: {
        name: "South Carolina State University — Virtual Campus",
        kind: "Active project · USDA-commissioned",
        illustrative: false,
        blurb: "A campus-scale digital twin of one of America's historically Black universities: full-campus map, guided tours, and VR-enabled immersive locations built on Matterport + Treedis. Students walk the campus and drop into immersive VR before they ever set foot on it. Commissioned by the USDA; currently under development."
      },
      capturedWith: "Matterport Pro3 + Insta360 Pro 2",
      platform: "Treedis",
      media: {
        type: "treedis",
        label: "Explore the Virtual Campus",
        tourUrl: "https://spaces.dtsxr.com/tour/8e4ca3fc",
        origin: "https://spaces.dtsxr.com"
      },
      links: [
        { label: "SCSU Campus — VR-enabled tour", url: "https://spaces.dtsxr.com/tour/scsu-campus-ade0f346" },
        { label: "Watch the SCSU Walkthrough", url: "https://vimeo.com/1202389953/1e9b4d74aa" },
        { label: "SCSU Metaversity Course Structure Reel", url: "https://vimeo.com/1152008581" }
      ],
      gallery: [
        { src: "assets/portfolio/scsu-virtual-campus.jpg", alt: "SCSU Virtual Campus — full-campus map with guided-tour sidebar" }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "SC State Virtual Campus — a campus-scale HBCU digital twin with a full-campus map, guided tours, and VR-enabled immersive locations, spanning recruitment through orientation.",
        "Awards": "Commissioned by the USDA — a federal vote of confidence in campus-scale spatial platforms.",
        "Client Feedback": "\u201cStudents can find Financial Aid before their first day\u201d — campus administration.",
        "Press & Research": "The SCSU framework is the reference architecture every later DTS spatial-navigation build adapts from — multi-location mapping, guided tours, VR deep-links.",
        "Project Data": "Campus scale · Matterport + Treedis · Desktop, mobile, and Meta Quest VR profiles."
      }
    },
    workforce: {
      sector: "education",
      title: "Workforce & Trade",
      tagline: "Skills labs, certification, DOL-funded programs, economic mobility.",
      overview: "Workforce twins capture skills labs and training floors so learners can rehearse procedures and equipment before touching the real thing — the fastest-growing segment in immersive training, and the one most tied to funded economic-mobility programs.",
      project: {
        name: "Laser-Scanned VR Training Environment",
        kind: "Deployed capability",
        illustrative: false,
        blurb: "A real industrial workspace laser-scanned and integrated into VR, where trainees rehearse trade skills in a dimensionally accurate copy of the floor they'll work on. Companion builds include the Metal Shark shipbuilding demo and AR equipment overviews with hands-on interaction."
      },
      capturedWith: "Laser scan + XR tools for Unity",
      platform: "VR / AR",
      media: {
        type: "vimeo",
        label: "Laser Scanned Environment Integrated into VR — Demo",
        embedUrl: "https://player.vimeo.com/video/293449698",
        watchUrl: "https://vimeo.com/293449698"
      },
      links: [
        { label: "Metal Shark shipbuilding training demo", url: "https://vimeo.com/522913162/bf51023c68" },
        { label: "Energy Equipment Overview with AR interaction", url: "https://vimeo.com/334052078" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "Laser-scanned VR training floor — trainees rehearse trade procedures in an exact spatial copy of the real workspace; Metal Shark shipbuilding demo extends the same approach to marine manufacturing.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe can pre-train a cohort before they ever queue for a machine.\u201d",
        "Press & Research": "Immersive training is the fastest-growing segment of the workforce-development market.",
        "Project Data": "Laser scan + VR integration · AR equipment modules · Reusable across every cohort."
      }
    },
    healthcare: {
      sector: "education",
      title: "Healthcare Training",
      tagline: "Staff orientation, clinical simulation, patient-safety environments.",
      overview: "Placed in Education because the buyer is an educator or training coordinator — not a clinician. The purchase is instructional: staff orientation, clinical simulation, and patient-safety rehearsal in a true-to-life spatial environment.",
      project: {
        name: "Immersive Stroke Assessment Diagnostic Experience",
        kind: "Deployed simulation",
        illustrative: false,
        blurb: "A biomedical training simulation in which clinical learners run a stroke-scale assessment on a virtual patient — rehearsing a time-critical diagnostic protocol with unlimited repetition and zero patient risk. Part of a healthcare-training line that includes hospital walkthrough demos and heart-hospital orientation builds."
      },
      capturedWith: "3D modeling & XR tools for Unity",
      platform: "PC / VR",
      media: {
        type: "vimeo",
        label: "Healthcare Training Demo",
        embedUrl: "https://player.vimeo.com/video/368534955",
        watchUrl: "https://vimeo.com/368534955"
      },
      links: [
        { label: "Immersive Stroke Assessment Diagnostic Experience", url: "https://vimeo.com/dtsxr/stroke-scal-assessment" },
        { label: "Heart hospital orientation demo", url: "https://vimeo.com/383209930/50ac64b5eb" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "Immersive stroke-scale assessment — clinical learners rehearse a time-critical diagnostic on a virtual patient, with unlimited repetition and zero ward disruption.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cDay-one staff already know where everything is.\u201d",
        "Press & Research": "Simulation-based clinical training reduces first-week error rates.",
        "Project Data": "Diagnostic protocol simulation · Hospital walkthrough demos · VR-ready."
      }
    },
    workplace: {
      sector: "education",
      title: "Workplace Learning",
      tagline: "Corporate onboarding, continuing ed, Betaversity, EON Reality.",
      overview: "The platform play. Immersive-learning content — from state-agency staff modules to soft-skills and safety training — that scales corporate onboarding and continuing education across every other category. One immersive layer, reused everywhere.",
      project: {
        name: "LDH WIC Program — Staff Learning Modules",
        kind: "Deployed training",
        illustrative: false,
        blurb: "Workplace-learning modules built for the Louisiana Department of Health's WIC program, sitting alongside soft-skills builds (Components of Communication) and safety modules (Electrical Safety) — the reusable training layer that turns one build into every new hire's onboarding."
      },
      capturedWith: "3D modeling & XR tools for Unity",
      platform: "EON Reality \u00b7 PC / VR",
      media: {
        type: "vimeo",
        label: "LDH WIC Demo",
        embedUrl: "https://player.vimeo.com/video/373647092",
        watchUrl: "https://vimeo.com/373647092"
      },
      links: [
        { label: "Components of Communication module", url: "https://vimeo.com/1073705160/a29eee9a63" },
        { label: "Electrical Safety training module", url: "https://vimeo.com/522099868/9ac166f67f" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "LDH WIC staff modules — immersive workplace learning deployed for a state agency, with communication and electrical-safety modules reused across teams.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cOne build, every new hire.\u201d",
        "Press & Research": "Platform-scale immersive learning lowers per-trainee cost over time.",
        "Project Data": "Modular builds · Scales horizontally across sectors and cohorts."
      }
    },

    /* ---------------- INDUSTRY ---------------- */
    energy: {
      sector: "industry",
      title: "Energy & Manufacturing",
      tagline: "Oil/gas, solar, utilities, industrial ops, FEMA PA documentation.",
      overview: "The compliance-mandated market — oil/gas, solar, and utility infrastructure buyers driven by regulatory pressure, insurance requirements, and FEMA documentation obligations. The fastest path to a closed contract.",
      project: {
        name: "Solar Farm Capture",
        kind: "Live Treedis experience",
        illustrative: false,
        blurb: "A Matterport capture of a working solar installation published on Treedis — the kind of infrastructure twin used for insurance documentation, compliance records, and remote inspection. Sits alongside the UL Lafayette Solar Energy Lab fly-over and a deep oil-and-gas catalog: Central Processing Facility, wellpad, degasser, and saltwater-disposal twins built for Permian Basin operators."
      },
      capturedWith: "Matterport Pro3",
      platform: "Treedis",
      media: {
        type: "treedis",
        label: "Explore the Solar Farm",
        tourUrl: "https://spaces.dtsxr.com/tour/ea18f14b",
        origin: "https://spaces.dtsxr.com"
      },
      links: [
        { label: "UL Lafayette Solar Energy Lab — fly-over", url: "https://vimeo.com/1058364652/f98b84dae1" },
        { label: "Energy: Central Processing Facility", url: "https://vimeo.com/376724255" },
        { label: "Shell demo", url: "https://vimeo.com/303186440" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "Solar Farm Capture and the ULL Solar Energy Lab fly-over — infrastructure twins for compliance and insurance documentation; Permian Basin facility twins (CPF, wellpad, degasser, saltwater disposal) for operator training and remote inspection.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe can document the whole site without a truck roll.\u201d",
        "Press & Research": "Energy is the compliance-driven, fastest-to-close digital-twin vertical.",
        "Project Data": "Captured with Matterport Pro3 · Published on Treedis · VR variants for facility training."
      }
    },
    healthfac: {
      sector: "industry",
      title: "Healthcare Facilities",
      tagline: "Hospital systems, clinical environments, pharmaceutical facilities.",
      overview: "The fastest-growing commercial digital-twin segment: hospital systems, clinical environments, and pharmaceutical facilities documented spatially for planning, compliance, and operations.",
      project: {
        name: "Immersive Facility Flythrough — CAD to Unity",
        kind: "Deployed capability",
        illustrative: false,
        blurb: "A healthcare facility's CAD data integrated seamlessly into Unity and rendered as an immersive flythrough — letting operations teams and stakeholders review a clinical environment spatially before and after it is built."
      },
      capturedWith: "CAD data + 3D modeling",
      platform: "Unity",
      media: {
        type: "vimeo",
        label: "Immersive Flythrough — Seamless CAD Integration",
        embedUrl: "https://player.vimeo.com/video/390616842",
        watchUrl: "https://vimeo.com/390616842"
      },
      links: [
        { label: "Immersive Stroke Assessment (clinical simulation)", url: "https://vimeo.com/dtsxr/stroke-scal-assessment" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "CAD-to-Unity facility flythrough — clinical space reviewed immersively for planning and operations.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe review the facility without walking it.\u201d",
        "Press & Research": "Healthcare is the fastest-growing digital-twin segment.",
        "Project Data": "CAD data pipeline · Unity rendering · Clinical environments to compliance standards."
      }
    },
    automotive: {
      sector: "industry",
      title: "Automotive & Transportation",
      tagline: "Showrooms, vehicle twins, EV facilities, franchise audits.",
      overview: "Showroom and vehicle twins that plug straight into the sales process — letting buyers explore inventory and configurations spatially, anchored by the BMW Lafayette proof point.",
      project: {
        name: "BMW Lafayette — Dealership & Vehicle Twins",
        kind: "Live Treedis experiences",
        illustrative: false,
        blurb: "A showroom twin plus vehicle-level captures of the BMW X1, X5, and X7: buyers walk the dealership floor and step inside individual vehicles remotely, turning the twin into a direct extension of the sales process. A Range Rover Sport SVR capture extends the same approach."
      },
      capturedWith: "Matterport Pro3",
      platform: "Treedis",
      media: {
        type: "treedis",
        label: "Walk the Dealership",
        tourUrl: "https://spaces.dtsxr.com/tour/fee23e79",
        origin: "https://spaces.dtsxr.com"
      },
      links: [
        { label: "BMW X1 vehicle twin", url: "https://spaces.dtsxr.com/tour/026593c5" },
        { label: "BMW X5 vehicle twin", url: "https://spaces.dtsxr.com/tour/352ad07a" },
        { label: "BMW X7 vehicle twin", url: "https://spaces.dtsxr.com/tour/bfab6d52" },
        { label: "Watch the BMW dealership video", url: "https://vimeo.com/1187103853" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "BMW Lafayette — dealership twin plus X1 / X5 / X7 vehicle twins used as an automotive-retail proof point.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cBuyers walk the floor before they ever visit.\u201d",
        "Press & Research": "Automotive is one of four dominant commercial twin verticals through 2030.",
        "Project Data": "Showroom + per-vehicle capture · Published on Treedis · Tied to the sales funnel."
      }
    },
    properties: {
      sector: "industry",
      title: "Properties & Places",
      tagline: "Commercial, residential, hospitality, tourism, film locations.",
      overview: "Twins for downtowns, hotels, venues, and destination-marketing organizations — letting guests, planners, and visitors experience a place before they arrive. One build, every device: phone, desktop, Meta Quest Pro, Apple Vision Pro.",
      project: {
        name: "Downtown Lafayette — Living Destination Experience",
        kind: "Commissioned · Lafayette CVC",
        illustrative: false,
        blurb: "A living-downtown destination experience connecting visitors to the businesses, culture, and stories of Lafayette's urban core — commissioned by the Lafayette Convention and Visitors Commission. Alongside it: the Virgin Hotels orientation experience, deployed and managed remotely across VR headset fleets for a global hospitality brand, plus Westin and Marriott property captures."
      },
      capturedWith: "Matterport Pro3 + Insta360 Pro 2",
      platform: "Treedis",
      media: {
        type: "treedis",
        label: "Explore Downtown Lafayette",
        tourUrl: "https://spaces.dtsxr.com/tour/4fb22059",
        origin: "https://spaces.dtsxr.com"
      },
      links: [
        { label: "Virgin Hotels Orientation Experience", url: "https://vimeo.com/558259558" },
        { label: "Virgin Hotels staff-orientation walk-thru", url: "https://vimeo.com/379311258" },
        { label: "Westin property twin (Matterport)", url: "https://my.matterport.com/show/?m=D85w1F2sXiw" }
      ],
      gallery: [
        { src: "assets/portfolio/downtown-lafayette.jpg", alt: "Downtown Lafayette urban core — destination experience capture" },
        { src: "assets/portfolio/virgin-hotels-vr.jpg", alt: "Virgin Hotels orientation experience on a VR headset" }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "Downtown Lafayette destination experience (Lafayette CVC) and the Virgin Hotels orientation experience — hospitality twins deployed across remote VR headset fleets to global brand standards.",
        "Awards": "Virgin Hotels engagement — proof the work meets the brand standards and device logistics of world-class hospitality.",
        "Client Feedback": "\u201cPlanners book the room they already walked.\u201d",
        "Press & Research": "One build, every device: phone, desktop, Meta Quest Pro, and Apple Vision Pro.",
        "Project Data": "Downtown-scale + property-scale captures · Westin & Marriott twins in catalog."
      }
    },

    /* ---------------- GOVERNMENT ---------------- */
    civic: {
      sector: "government",
      title: "Civic Services",
      tagline: "Libraries, transit, parks, civic engagement, accessibility.",
      overview: "Public-facing civic spaces — parks, campuses, and public venues — twinned so residents and visitors can navigate, plan visits, and engage with public services accessibly from anywhere.",
      project: {
        name: "LSU Performance Innovation POC",
        kind: "Proof of concept · 2 weeks",
        illustrative: false,
        blurb: "A proof of concept developed with LSU exploring immersive technology for design and performance innovation — evidence of how quickly DTS moves (two weeks) from concept to working experience with flagship institutions. Alongside it: the State Park Experience Demo built for Miles Partnership and the Louisiana Office of Tourism, with aerial context, accessibility-first navigation, and place-based storytelling.",
      },
      capturedWith: "3D modeling & XR tools for Unity",
      platform: "PC / VR",
      media: {
        type: "vimeo",
        label: "Watch the LSU POC",
        embedUrl: "https://player.vimeo.com/video/1171910011?h=0758e149fc",
        watchUrl: "https://vimeo.com/1171910011/0758e149fc"
      },
      links: [
        { label: "State Park Demo — Miles Partnership & LA Office of Tourism", url: "https://vimeo.com/1209678624/b5ed428562" },
        { label: "Virtual Park Tour (short)", url: "https://vimeo.com/1209665275/d14536542c" }
      ],
      gallery: [
        { src: "assets/portfolio/lsu-performance-poc.jpg", alt: "LSU Performance Innovation POC — immersive facilities render" },
        { src: "assets/portfolio/state-park-demo.jpg", alt: "State Park virtual tour demo — aerial context and guided navigation" }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "LSU Performance Innovation POC (concept to working experience in two weeks) and the State Park Experience Demo for Miles Partnership & the Louisiana Office of Tourism — accessibility-first navigation and place-based storytelling for one of Louisiana's most visited parks.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cResidents arrive already knowing the place.\u201d",
        "Press & Research": "Built for demonstration with a state tourism office and its agency of record.",
        "Project Data": "Aerial context · Accessibility-first navigation · Two-week concept-to-demo cycle."
      }
    },
    gfc: {
      sector: "government",
      title: "Coastal Resilience \u2014 Gulf Futures Challenge",
      tagline: "A parish-scale digital twin for coastal risk, drainage, and planning.",
      overview: "An integrated digital twin platform for Gulf coastal resilience, joining spatial capture, live environmental data, and a parish's own GIS so land change, flood exposure, and drainage capacity can be examined together instead of in separate systems. Iberia Parish is the demonstration community.",
      project: {
        name: "Gulf Futures Challenge \u2014 Phase 2",
        kind: "Active project \u00b7 Multi-institution research partnership",
        illustrative: false,
        blurb: "Digital Twin Studios leads platform engineering for the Gulf Futures Challenge \u2014 3D visualization, real-time data integration, and AI-assisted scenario modeling \u2014 built with Louisiana State University, the University of Louisiana at Lafayette, and Do It Greener Foundation. The partnership pairs technical development with sustained community engagement."
      },
      capturedWith: "Matterport Pro3",
      platform: "Treedis \u00b7 DTS GIS",
      sweepId: null,
      evidence: {
        "Case Studies": "Iberia Parish demonstration deployment \u2014 spatial capture joined to parish GIS, flood and drainage data, and coastal-change layers in a single planning surface.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "Findings, methods, and platform architecture intended for peer-reviewed publication and public technical documentation, to support replication in other Gulf communities.",
        "Project Data": "Research data, processed datasets, and platform architecture documented for replication in approved public repositories."
      }
    },
    municipal: {
      sector: "government",
      title: "Infrastructure & Cities",
      tagline: "Municipal twins, transportation, utility grids, urban planning.",
      overview: "City-scale twins — the fastest-growing government segment worldwide. Infrastructure, venues, and public spaces documented as a living municipal record that planners, agencies, and citizens can all walk.",
      project: {
        name: "Lafayette Digital Twin Initiative",
        kind: "Municipal initiative",
        illustrative: false,
        blurb: "A city-scale digital-twin initiative for Lafayette, Louisiana — documenting the city's infrastructure and urban core as a navigable municipal record, extended by the Silicon Bayou technology-corridor work and city fly-over captures."
      },
      capturedWith: "Aerial capture + 3D modeling",
      platform: "Unity",
      media: {
        type: "vimeo",
        label: "Lafayette Digital Twin Initiative",
        embedUrl: "https://player.vimeo.com/video/959296524",
        watchUrl: "https://vimeo.com/959296524"
      },
      links: [
        { label: "Silicon Bayou Initiative — highlight", url: "https://vimeo.com/1109358698/e6ce9de564" },
        { label: "Lafayette fly-over", url: "https://vimeo.com/1007749997" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "Lafayette Digital Twin Initiative — a city documenting its own urban core spatially; Silicon Bayou extends the record across the region's technology corridor.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe city can show the venue to the world.\u201d",
        "Press & Research": "Municipal/smart-city is the fastest-growing government twin segment.",
        "Project Data": "City-scale capture · Aerial + street-level layers."
      }
    },
    foodsafety: {
      sector: "government",
      title: "Regulatory & Compliance",
      tagline: "Food safety, environmental compliance, inspection training.",
      overview: "Sits in Government because the buyer is a regulatory authority, not a commercial food company. The procurement is regulatory: twins support inspection, training, and standards enforcement — and the state's investment keeps extending because the builds are modular.",
      project: {
        name: "Sanitarian Training Enhancement — Louisiana Department of Health",
        kind: "Award-winning deployment",
        illustrative: false,
        blurb: "Virtual training simulations for Louisiana's retail food-safety inspectors on PC and Meta Quest, built modular so the state's investment keeps extending. Winner of the Unity \u201cBest Public Health Solution\u201d Award (I/ITSEC) and showcased at the Association of Food & Drug Officials Conference 2026."
      },
      capturedWith: "3D modeling & XR tools for Unity",
      platform: "PC + Meta Quest",
      media: {
        type: "vimeo",
        label: "LDH Sanitarian Training Demo",
        embedUrl: "https://player.vimeo.com/video/672407780",
        watchUrl: "https://vimeo.com/672407780"
      },
      links: [
        { label: "Retail Food Safety Inspection — in development", url: "https://vimeo.com/403092357" },
        { label: "LDH VR capture (highlight)", url: "https://vimeo.com/1109426072/0ddb5aa3aa" },
        { label: "Louisiana Department of Health demo", url: "https://vimeo.com/390542485" }
      ],
      gallery: [
        { src: "assets/portfolio/ldh-logo.jpg", alt: "Louisiana Department of Health" }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "Sanitarian Training Enhancement — virtual retail food-safety inspection training for the Louisiana Department of Health, deployed on PC and Meta Quest. Full case study available upon request.",
        "Awards": "Unity \u201cBest Public Health Solution\u201d Award · I/ITSEC. Showcased at the Association of Food & Drug Officials Conference 2026.",
        "Client Feedback": "\u201cInspectors train on the real layout, remotely.\u201d",
        "Press & Research": "Presented to the national food-safety regulatory community at AFDO 2026.",
        "Project Data": "Modular Unity builds · PC + Meta Quest · Built so the state's investment keeps extending."
      }
    },

    /* ---------------- COMMUNITY ---------------- */
    economic: {
      sector: "community",
      title: "Economic Development",
      tagline: "Downtown BIDs, chambers, EDCs, commercial corridors.",
      overview: "Twins that showcase a downtown, parish, or commercial corridor to attract investment and tenants — proof that a place is worth building in. Each business added becomes another grain of the community's spatial record.",
      project: {
        name: "LSU Digital Twin — Iberia Parish Pilot",
        kind: "Parish-scale pilot",
        illustrative: false,
        blurb: "A parish-scale economic-development twin piloted with LSU for Iberia Parish, published live on Treedis — paired with a growing series of downtown business captures (Keller's Bakery, Rock'n'Bowl, Carpe Diem, Pop's, Borden's, Spoonbill) that document a commercial corridor one storefront at a time."
      },
      capturedWith: "Matterport Pro3 + Insta360 Pro 2",
      platform: "Treedis",
      media: {
        type: "treedis",
        label: "Explore the Iberia Parish Twin",
        tourUrl: "https://spaces.dtsxr.com/tour/56111605",
        origin: "https://spaces.dtsxr.com"
      },
      links: [
        { label: "Watch: LSU Digital Twin — Iberia Parish Pilot", url: "https://vimeo.com/1132293716" },
        { label: "Keller's Bakery — downtown business capture", url: "https://vimeo.com/1176361159/56b48ef2bf" },
        { label: "Rock'n'Bowl — downtown business capture", url: "https://vimeo.com/1176361349/a380192055" },
        { label: "Planning for Development and Growth", url: "https://vimeo.com/1073705217/dd4b934aa9" }
      ],
      gallery: [
        { src: "assets/portfolio/downtown-lafayette.jpg", alt: "Downtown commercial corridor — living destination capture" }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "Iberia Parish pilot with LSU — a parish documented as an investable, navigable place; downtown business series turns a corridor into a spatial showcase, storefront by storefront.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe can tour a prospect down the whole corridor.\u201d",
        "Press & Research": "Spatial showcases lower the friction of attracting commercial tenants.",
        "Project Data": "Parish-scale twin on Treedis · Six-plus storefront captures and growing."
      }
    },
    nonprofit: {
      sector: "community",
      title: "Nonprofit & Social Impact",
      tagline: "NGOs, foundations, DIG, faith communities, social services.",
      overview: "Mission-driven twins that give an organization a credible, sharable impact narrative — anchored by the Do It Greener Foundation, which pairs DTS's commercial work with genuine community impact.",
      project: {
        name: "Do It Greener Foundation — Sample Experience",
        kind: "Anchor relationship",
        illustrative: false,
        blurb: "An interactive sample experience built with the Do It Greener Foundation — letting a mission-driven organization show, spatially, the places and outcomes its coastal and community work touches, so donors and partners can see exactly where support lands."
      },
      capturedWith: "3D modeling & XR tools for Unity",
      platform: "Interactive experience",
      media: {
        type: "vimeo",
        label: "Do It Greener Sample Experience",
        embedUrl: "https://player.vimeo.com/video/1072371346?h=4c1279364c",
        watchUrl: "https://vimeo.com/1072371346/4c1279364c"
      },
      links: [],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "Do It Greener Foundation sample experience — a spatial impact story for coastal and community work.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cDonors can see exactly where their support lands.\u201d",
        "Press & Research": "Spatial storytelling strengthens nonprofit impact reporting.",
        "Project Data": "Impact-site documentation for grant and donor reporting."
      }
    },
    sustain: {
      sector: "community",
      title: "Sustainability & Environment",
      tagline: "Green infrastructure, ESG twins, environmental monitoring.",
      overview: "Twins that document green infrastructure and civic-sustainability projects — a growing market where the spatial record is the evidence of environmental commitments delivered.",
      project: {
        name: "ULL Energy Efficiency & Sustainable Energy Center",
        kind: "Deployed capture",
        illustrative: false,
        blurb: "A digital twin of the University of Louisiana at Lafayette's Energy Efficiency & Sustainable Energy Center — green infrastructure and applied-sustainability research documented spatially, the evidence layer behind the institution's environmental commitments."
      },
      capturedWith: "Aerial capture + 3D modeling",
      platform: "Video walkthrough",
      media: {
        type: "vimeo",
        label: "ULL Energy Efficiency & Sustainable Energy Center",
        embedUrl: "https://player.vimeo.com/video/1109361463",
        watchUrl: "https://vimeo.com/1109361463"
      },
      links: [
        { label: "ULL EESEC — full walkthrough", url: "https://vimeo.com/986869653" },
        { label: "UL Lafayette Solar Energy Lab fly-over", url: "https://vimeo.com/1029700958" }
      ],
      gallery: [],
      sweepId: null,
      evidence: {
        "Case Studies": "ULL Energy Efficiency & Sustainable Energy Center — a sustainability facility captured as a navigable spatial record.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe report points at the place, not a paragraph.\u201d",
        "Press & Research": "ESG documentation is a growing civic-sustainability market.",
        "Project Data": "Verifiable spatial record of delivered green infrastructure."
      }
    },
    heritage: {
      sector: "community",
      title: "Cultural & Heritage",
      tagline: "Historic preservation, Section 106, museums, heritage tourism.",
      overview: "Documentation-driven, compliance-mandated work that is underserved by existing digital-twin vendors: historic tax-credit and Section 106 review capture that preserves cultural and heritage sites precisely.",
      project: {
        name: "Historic Tax-Credit / Section 106 Capture",
        kind: "Compliance engagement",
        illustrative: true,
        blurb: "Heritage-preservation capture for historic tax-credit and Section 106 compliance: a precise spatial record of a historic structure — a documentation-mandated market existing twin vendors largely overlook."
      },
      capturedWith: "Preservation-grade reality capture",
      platform: "Spatial documentation",
      sweepId: null,
      evidence: {
        "Case Studies": "Historic-structure twin used for tax-credit and Section 106 review.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe building is preserved even as it changes.\u201d",
        "Press & Research": "Heritage compliance is an underserved digital-twin market.",
        "Project Data": "Preservation-grade capture of a historic structure."
      }
    }
  },

  /* ============================================================
     QUESTION-BAR ANSWERS
     ------------------------------------------------------------
     Inline FAQ answers. `match` entries are case-insensitive
     substrings tested against the visitor's question.
     ============================================================ */
  answers: [
    { match: ["what does digital twin studios", "what does dts", "who is dts", "who are you", "about dts"],
      q: "What does Digital Twin Studios do?",
      a: "The world is our interface. DTS doesn't serve industries \u2014 it serves the systems that shape human life: education prepares people, industry employs them, government structures their society, and community is what all three build together. We create digital twins \u2014 precise, navigable spatial copies of real places \u2014 for state agencies, universities, destinations, and global hospitality brands. Built. Deployed. Awarded: from the USDA-commissioned SC State virtual campus to the Unity-award-winning food-safety training for the Louisiana Department of Health. Every experience runs on phone, desktop, or headset \u2014 one build, every device." },
    { match: ["why four", "why these categories", "education industry government community"],
      q: "Why Education, Industry, Government, Community?",
      a: "Because that's the natural sequence of the systems that shape human life: education builds people, industry puts them to work, government structures their society, and community is the proof the other three did their job. You don't browse a menu here \u2014 you explore a world, the same way you'd explore one of our twins." },
    { match: ["treedis"],
      q: "What is Treedis?",
      a: "Treedis is the platform DTS uses to publish and share interactive 3D spatial experiences. A space captured with Matterport is hosted on Treedis, where you can walk through it in 360\u00b0, add tags and hotspots, and embed it on the web \u2014 like the experience running on this page." },
    { match: ["matterport", "capture"],
      q: "What is a Matterport capture like?",
      a: "A Matterport capture is a scan of a real place using a 3D camera (like the Matterport Pro3). The camera takes overlapping 360\u00b0 photos and depth data from many points in a space, which are stitched into a navigable, dimensionally-accurate digital twin you can move through online." },
    { match: ["digital twin", "what is a digital"],
      q: "What is a Digital Twin?",
      a: "A digital twin is a precise, navigable virtual copy of a real place. DTS builds twins for the systems that shape human life \u2014 campuses, operations, public infrastructure, and community spaces \u2014 so you can explore, document, train, and make decisions about a space without being physically there." },
    { match: ["contact", "get in touch", "reach"],
      q: "How do I get in contact?",
      a: "Open any sector and use Contact & Info, or the ACCESS YOUR TWIN button up top. You can Schedule a Discovery (a 30-minute conversation), Request a Proposal, or Start a Pilot \u2014 each goes straight to the DTS team." },
    { match: ["mobile", "phone", "device"],
      q: "Can I use a mobile device?",
      a: "Yes. The experience runs on desktop, tablet, and phone, and on Meta Quest headsets in VR. On a phone, use the menu to move between sectors and tap a use case to open its example experience." }
  ],

  /* ============================================================
     FUN FACTS
     ------------------------------------------------------------
     Random fact typed out under the headline during the loading
     intro (js/intro-typewriter.js). Kept in sync with
     data/faq/fun-facts.json — that file is the source of truth
     and is what the Admin Board edits.
     ============================================================ */
  funFacts: [
    "The USDA commissioned South Carolina State University's virtual campus twin from DTS.",
    "Our food-safety training for the Louisiana Department of Health won Unity's \u201cBest Public Health Solution\u201d award at I/ITSEC.",
    "One build, every device \u2014 phone, desktop, or headset. No separate versions.",
    "DTS is SAM.gov qualified \u2014 cleared to contract directly with federal and state agencies.",
    "A digital twin isn't a video \u2014 it's dimensionally accurate. You could measure a room straight from your browser.",
    "We don't organize by industry \u2014 we organize by the systems that shape human life: education, industry, government, community.",
    "Every new capture adds to a community's spatial record \u2014 it never really finishes.",
    "Spaces are captured with a Matterport Pro3 and an Insta360 Pro 2, then published as navigable space on Treedis.",
    "A hotel, a campus, and a state health department are the same problem: a real place, made navigable.",
    "Government moves on different timelines than industry. We build for both.",
    "Tags and hotspots turn a flat scan into something you can actually explore, not just look at.",
    "Preservation-grade capture means a historic building stays documented even as it changes.",
    "The world is our interface.",
    "Most spatial data dies in a folder somewhere. A digital twin is built to be walked through."
  ]
};
