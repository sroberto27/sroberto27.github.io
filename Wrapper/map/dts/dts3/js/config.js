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
      blurb: "Digital twins that turn campuses, labs, and training environments into places to learn by doing.",
      accent: "#E9B44C",
      kicker: "EDUCATION",
      title: "Build the campus as a living learning environment.",
      sub: "Immersive spaces connect orientation, workforce readiness, and hands-on technical learning.",
      body: "Education digital twins translate real campuses, specialized facilities, and professional workflows into interactive learning environments. From film-production orientation to renewable-energy research, learners can explore places, equipment, and processes before they arrive on site. The result is a persistent spatial resource that supports instruction, orientation, workforce development, and future immersive content.",
      cards: [
        { id: "brcc",  title: "BRCC Film Production Orientation",     short: "BRCC Film", text: "A career-oriented digital twin and interactive orientation experience that lets film students explore the Celtic Media Centre, production spaces, equipment, and learning content before working on set." },
        { id: "solar", title: "Louisiana Solar Energy Lab Digital Twin", short: "Solar Lab", text: "A spatial digital twin of UL Lafayette's solar research environment for virtual exploration, education, workforce development, and lab visualization." }
      ]
    },
    {
      id: "industry",
      label: "Industry",
      navSub: "Company",
      blurb: "Immersive training and spatial tools for complex operations, equipment, and customer environments.",
      accent: "#2E8BFF",
      kicker: "INDUSTRY",
      title: "Make complex operations understandable, repeatable, and ready to practice.",
      sub: "From field procedures to product exploration, digital twins bring work into an interactive environment.",
      body: "Industry experiences use XR, 3D visualization, and digital twins to make complex systems easier to see, learn, and rehearse. Teams can practice procedures in modeled operating environments, inspect equipment in context, or extend a physical customer experience into a remotely explorable space. The focus is practical: connect the virtual environment to the way people actually work, train, and make decisions.",
      cards: [
        { id: "shell",      title: "Shell - Permian Basin Assessment Training", short: "Shell Permian", text: "A 3D oilfield training environment that guides users through wellpad and saltwater-disposal assessment tasks, equipment identification, and valve-selection procedures." },
        { id: "automotive", title: "Automotive Dealership Digital Twin",        short: "Dealership",    text: "An interactive dealership and vehicle experience combining spatial capture with detailed product exploration for remote viewing, orientation, and demonstration." }
      ]
    },
    {
      id: "government",
      label: "Government",
      navSub: "City",
      blurb: "Immersive practice environments for public service, safety, compliance, and technical workforce training.",
      accent: "#34598F",
      kicker: "GOVERNMENT",
      title: "Turn critical procedures into repeatable practice.",
      sub: "Interactive simulations make complex public-service and technical workflows easier to learn, assess, and scale.",
      body: "Government and public-sector teams often train for work where consistency, procedure, and technical judgment matter. DTS builds interactive environments that let learners recognize conditions, practice decisions, and repeat workflows without depending on a live facility for every training session. The same approach can support regulatory compliance, public health, and advanced technical workforce development.",
      cards: [
        { id: "foodsafety", title: "Sanitarian Training Enhancement",     short: "Sanitarian",         text: "A modular VR and PC training suite for Louisiana food-safety inspectors to identify hazards, apply inspection criteria, and practice response in simulated food-service environments." },
        { id: "honeywell",  title: "Advanced Manufacturing Training Demo", short: "Adv. Manufacturing", text: "An immersive metrology and manufacturing simulation that lets users practice equipment interaction, measurement workflows, and technical procedures inside a virtual workcell." }
      ]
    },
    {
      id: "community",
      label: "Community",
      navSub: "Community",
      blurb: "Spatial experiences that connect people to local places, culture, public data, and future resilience.",
      accent: "#D27049",
      kicker: "COMMUNITY",
      title: "Make the community itself the interface.",
      sub: "Digital twins help people explore destinations, understand local systems, and engage with the places they share.",
      body: "Community-scale digital twins can connect real places with stories, destinations, infrastructure, and data in one spatial experience. For tourism, that can mean turning local businesses and culture into an explorable destination; for resilience and planning, it can mean making environmental and infrastructure context easier to see. The common goal is to keep the experience grounded in place and accessible across the devices people already use.",
      cards: [
        { id: "lafayette", title: "Downtown Lafayette",                        short: "Downtown Lafayette", text: "A living destination experience linking Lafayette's urban core, businesses, culture, and stories in one interactive tour that can be explored across web and immersive devices." },
        { id: "gfc",       title: "Iberia Parish Clean Energy Hub Digital Twin", short: "Iberia Parish",    text: "A community-scale Iberia Parish digital twin that combines aerial context, local places, environmental data, infrastructure, and clean-energy resilience storytelling in an explorable spatial experience." }
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
     PROJECT EXAMPLES — windows opened by card / tab clicks
     ------------------------------------------------------------
     Keyed by the card `id` in categories[].cards. This file is the
     /data-unreachable FALLBACK only (js/content-loader.js's
     loadConfigFallback), so it deliberately carries ONLY the public
     showcase video of each project:

       experiences — already in the CONVERTED shape buildConfig()
                     produces (type/embedUrl/watchUrl), not the raw
                     /data shape (_type/embed/watch).
       media       — legacy alias for experiences[0], same as
                     buildConfig() sets. Keep both.
       links       — related tours/videos shown as chips.
       gallery     — converted {src, alt}, not {source:{kind,value}}.

     NO gated target (a Treedis tourUrl, a `registered` link url) is
     ever written here. /data + functions/api/resource/* are the only
     places a gated URL lives, so this deployed static file cannot leak
     one no matter what scripts/split-content.mjs does or doesn't strip.
     ============================================================ */
  examples: {
    /* ---------------- EDUCATION ---------------- */
    brcc: {
      sector: "education",
      title: "BRCC Film Production Orientation",
      tagline: "Bring the production environment into the learning experience before a student's first day on set.",
      overview: "Baton Rouge Community College's Film and New Media Production Program uses an immersive digital twin of the Celtic Media Centre as a bridge between classroom learning and real production environments. The experience combines spatial orientation, interactive 3D content, and embedded media to help learners become familiar with production spaces and tools.",
      project: {
        name: "Baton Rouge Community College (BRCC) - Film and New Media Production Program",
        kind: "Immersive learning program development",
        illustrative: false,
        blurb: "Digital Twin Studios is collaborating with BRCC on a career-oriented film-production program centered on a digital twin set at the Celtic Media Centre. The supplied experience imagery includes the Celtic Media Centre entrance, Stage 8, interactive 3D lighting-equipment content, and embedded orientation media. The broader program is aligned with industry needs and includes advisement from the International Alliance for Theatrical and Stage Employees (IATSE), connecting virtual course content with practical film-production preparation."
      },
      capturedWith: "Custom 3D modeling of Celtic Media Centre spaces and production equipment, with embedded interactive and video learning elements.",
      platform: "Interactive 3D / immersive learning modules; Vimeo showcase / Eon Reality.",
      experiences: [
        { id: "video", label: "Watch the BRCC Film Production Orientation", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/1046222253", watchUrl: "https://vimeo.com/1046222253" }
      ],
      media: { id: "video", label: "Watch the BRCC Film Production Orientation", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/1046222253", watchUrl: "https://vimeo.com/1046222253" },
      links: [],
      gallery: [
        { src: "assets/Edu - BRCC/Edu - BRCC - 01.webp", alt: "3D view of the Celtic Media Centre entrance used in the film-production orientation environment." },
        { src: "assets/Edu - BRCC/Edu - BRCC - 02.webp", alt: "Stage 8 at the Celtic Media Centre recreated as part of the virtual orientation experience." },
        { src: "assets/Edu - BRCC/Edu - BRCC - 03.webp", alt: "Interactive 3D lighting-equipment lesson with labeled components and embedded learning media." },
        { src: "assets/Edu - BRCC/Edu - BRCC -04.webp", alt: "Virtual production-space view with an embedded orientation-video touchpoint." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "DTS is collaborating with BRCC on a career-oriented Film and New Media Production Program based on a digital twin set at the Celtic Media Centre.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "BRCC received a $750,000 Louisiana Entertainment Development Fund grant over three years for its Film and New Media Production Program and collaboration with Celtic Media Centre and IATSE.",
        "Project Data": "Public DTS project experience lists the BRCC engagement from March 2023 onward; supplied imagery shows Celtic Media Centre / Stage 8 spatial content, interactive equipment lessons, and embedded orientation media."
      }
    },

    solar: {
      sector: "education",
      title: "Louisiana Solar Energy Lab Digital Twin",
      tagline: "Make a large-scale solar research facility explorable for learning, workforce development, and technical visualization.",
      overview: "Digital Twin Studios is developing an immersive digital twin of the University of Louisiana at Lafayette's Louisiana Solar Energy Lab. The experience pairs spatial capture of the photovoltaic research site with an explorable Treedis environment and aerial flyover media.",
      project: {
        name: "University of Louisiana at Lafayette - Louisiana Solar Energy Lab",
        kind: "Immersive digital twin development",
        illustrative: false,
        blurb: "The Louisiana Solar Energy Lab digital twin gives learners, researchers, industry stakeholders, and workforce audiences a remote way to understand the scale and layout of a real photovoltaic testing facility. The supplied media includes a ground-level spatial tour, a dollhouse-style 3D view, and field imagery showing solar arrays and research equipment, while a separate flyover provides broader site context. The project extends the physical lab into a reusable visualization and learning environment that can support education, workforce development, and future simulation content."
      },
      capturedWith: "3D/360 spatial capture of the solar site plus aerial/flyover video / Eon Reality.",
      platform: "Treedis; Vimeo",
      experiences: [
        { id: "video", label: "UL Lafayette Solar Energy Lab", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/1058364652?h=f98b84dae1", watchUrl: "https://vimeo.com/1058364652/f98b84dae1" }
      ],
      media: { id: "video", label: "UL Lafayette Solar Energy Lab", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/1058364652?h=f98b84dae1", watchUrl: "https://vimeo.com/1058364652/f98b84dae1" },
      links: [
        { id: "link-1", label: "Watch the Solar Energy Lab Flyover", url: "https://vimeo.com/1058364652/f98b84dae1", kind: "vimeo", access: "public" }
      ],
      gallery: [
        { src: "assets/Edu- Sola/Edu - Sola - 01.webp", alt: "Ground-level virtual tour view among photovoltaic arrays at the solar research site." },
        { src: "assets/Edu- Sola/Edu - Sola - 02.webp", alt: "Dollhouse-style 3D spatial view of the captured solar facility." },
        { src: "assets/Edu- Sola/Edu - Sola - 03.webp", alt: "Captured solar arrays and field equipment used for research, testing, and training." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "DTS project experience describes immersive digital twin development for UL Lafayette's Louisiana Solar Energy Lab for education, workforce development, and lab simulation.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "In April 2025, UL Lafayette was designated the U.S. Department of Energy's sixth Regional Test Center for Emerging Solar Technologies, overseen by Sandia National Laboratories.",
        "Project Data": "The Louisiana Solar Energy Lab includes a 6-acre, 4,200-panel solar field and a 4,500-square-foot Antoun Hall research hub; supplied project media includes a public Treedis tour and Vimeo flyover."
      }
    },

    /* ---------------- INDUSTRY ---------------- */
    shell: {
      sector: "industry",
      title: "Shell - Permian Basin Assessment Training",
      tagline: "Turn oilfield assessment procedures into repeatable practice inside a modeled operating environment.",
      overview: "Digital Twin Studios' Shell work applies immersive simulation to oilfield assessment and procedure training. The Permian Basin sample places learners in modeled wellpad and saltwater-disposal environments where they identify equipment and respond to task prompts.",
      project: {
        name: "Shell",
        kind: "Immersive training engagement",
        illustrative: false,
        blurb: "The Permian Basin Assessment Training sample turns field-oriented oil and gas procedures into structured 3D learning tasks. Supplied scenes ask the learner to assess a wellpad or saltwater-disposal site, identify the main shutdown valve and saltwater pipeline inlet, distinguish production-related components, and select block valves. The experience demonstrates how a modeled industrial environment can support repeatable procedural practice and equipment recognition before or alongside work in the field."
      },
      capturedWith: "Custom 3D modeling of wellpad, SWD, piping, valves, and oilfield equipment informed by real operating procedures.",
      platform: "Immersive 3D / VR training simulation; Vimeo showcase",
      experiences: [
        { id: "video", label: "Watch the Permian Basin Assessment Sample", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/376913308", watchUrl: "https://vimeo.com/376913308" }
      ],
      media: { id: "video", label: "Watch the Permian Basin Assessment Sample", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/376913308", watchUrl: "https://vimeo.com/376913308" },
      links: [],
      gallery: [
        { src: "assets/Ind - Shell/Ind - Shell - 01.webp", alt: "Wellpad assessment training scenario inside the 3D oilfield environment." },
        { src: "assets/Ind - Shell/Ind - Shell - 02.webp", alt: "Learner prompt to identify the facility's main shutdown valve." },
        { src: "assets/Ind - Shell/Ind - Shell - 03.webp", alt: "Saltwater-disposal assessment scenario focused on identifying the pipeline inlet." },
        { src: "assets/Ind - Shell/Ind - Shell - 04.webp", alt: "Production assessment task asking the learner to identify the oil to be produced." },
        { src: "assets/Ind - Shell/Ind - Shell - 05.webp", alt: "Interactive equipment-identification task focused on selecting a block valve." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "DTS/Kheiron secured Shell as an early major client and developed customized immersive training for oil and gas operations.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "\u2014",
        "Project Data": "Supplied training scenes cover wellpad assessment, SWD assessment, shutdown valves, pipeline inlets, production selection, and block-valve identification."
      }
    },

    automotive: {
      sector: "industry",
      title: "Automotive Dealership Digital Twin",
      tagline: "Extend a physical dealership and its vehicles into a browsable, product-focused digital experience.",
      overview: "This automotive demonstration combines a spatially explorable dealership/vehicle environment with detailed vehicle views and 3D presentation. Visitors can move through the space, inspect exteriors and interiors, and access contextual controls or information remotely.",
      project: {
        name: "BMW dealership",
        kind: "Public demonstration capability",
        illustrative: false,
        blurb: "The automotive demo shows how a digital twin can connect place and product in one remote experience. Supplied imagery includes a virtual showroom with 3D vehicle models, spatial capture of a BMW SUV, detailed cockpit and dashboard views, and an exterior vehicle view with embedded navigation and information controls. The approved Treedis tour and Vimeo video demonstrate a reusable pattern for remote dealership exploration, orientation, product presentation, and training without asserting a commissioning relationship that is not identified in the supplied materials."
      },
      capturedWith: "360-degree spatial capture of dealership/vehicle environments plus detailed 3D vehicle visualization.",
      platform: "Treedis; Vimeo",
      experiences: [
        { id: "video", label: "BMW Dealership", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/1187103853", watchUrl: "https://vimeo.com/1187103853" }
      ],
      media: { id: "video", label: "BMW Dealership", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/1187103853", watchUrl: "https://vimeo.com/1187103853" },
      links: [],
      gallery: [
        { src: "assets/Ind - Auto/Ind - Auto - 01.webp", alt: "Virtual showroom scene with detailed 3D vehicle models." },
        { src: "assets/Ind - Auto/Ind - Auto - 02.webp", alt: "Spatial capture of a BMW SUV in the dealership/parking environment." },
        { src: "assets/Ind - Auto/Ind - Auto - 03.webp", alt: "Interactive interior view highlighting the vehicle cockpit and dashboard." },
        { src: "assets/Ind - Auto/Ind - Auto - 04.webp", alt: "Exterior vehicle view with embedded navigation and information controls." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "Interactive automotive demonstration combining an explorable spatial environment with detailed vehicle visualization.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "\u2014",
        "Project Data": "The supplied inventory includes an approved public Treedis dealership tour and an approved public Vimeo video titled \u201cBMW Dealership.\u201d The supplied materials do not identify a commissioning client."
      }
    },

    /* ---------------- GOVERNMENT ---------------- */
    foodsafety: {
      sector: "government",
      title: "Sanitarian Training Enhancement",
      tagline: "Give food-safety inspectors a realistic place to practice hazard recognition and response before entering the field.",
      overview: "Digital Twin Studios served as lead design and development firm for immersive Louisiana Department of Health food-safety training modules delivered on VR and PC. The simulations place inspectors in realistic food-service environments where they identify hazards and make inspection decisions.",
      project: {
        name: "Louisiana Department of Health (LDH)",
        kind: "Completed / deployed capability",
        illustrative: false,
        blurb: "The LDH Sanitarian Training Enhancement project converts food-safety inspection work into interactive, repeatable scenarios. Modules 1-4 address Tier 1-4 food-safety violations and ask learners to recognize hazardous conditions, evaluate storage and sanitation practices, and respond inside simulated food-service environments. The suite was developed for VR and PC and deployed across state platforms and devices including Meta Quest 2, creating a modular training resource for field inspectors."
      },
      capturedWith: "Custom 3D modeling of food-service environments, equipment, hazards, and interactive inspection scenarios.",
      platform: "Unity VR and PC (including Meta Quest 2); Vimeo showcase",
      experiences: [
        { id: "video", label: "Watch the Sanitarian Training Demo", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/672407780", watchUrl: "https://vimeo.com/672407780" }
      ],
      media: { id: "video", label: "Watch the Sanitarian Training Demo", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/672407780", watchUrl: "https://vimeo.com/672407780" },
      links: [],
      gallery: [
        { src: "assets/Gov - LDH/Gov - LDH - 01.webp", alt: "Food-safety hazard-identification exercise at a hot-holding station." },
        { src: "assets/Gov - LDH/Gov - LDH - 02.webp", alt: "Interactive confirmation step for a sanitation hazard in the simulated kitchen." },
        { src: "assets/Gov - LDH/Gov - LDH - 03.webp", alt: "Inspection task focused on date labeling and storage conditions." },
        { src: "assets/Gov - LDH/Gov - LDH - 04.webp", alt: "Cold-storage scenario used to practice product handling and inspection decisions." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "DTS led design and development of Modules 1-4 for Louisiana Department of Health food-safety orientation, training, and assessment on VR and PC.",
        "Awards": "Unity \u201cBest Public Health Solution\u201d Award at I/ITSEC.",
        "Client Feedback": "\u2014",
        "Press & Research": "Showcased at the Association of Food & Drug Officials Conference 2026.",
        "Project Data": "Modules 1-4 address Tier 1-4 food-safety violations; the project was deployed on state platforms and devices including Meta Quest 2."
      }
    },

    honeywell: {
      sector: "government",
      title: "Advanced Manufacturing Training Demo",
      tagline: "Practice metrology and manufacturing procedures inside an interactive virtual workcell.",
      overview: "The Advanced Manufacturing Training Demo recreates a technical workcell where a learner can interact with metrology equipment, fixtures, controls, workstation displays, and tools in an immersive environment. The supplied scenes focus on guided setup and measurement tasks rather than passive visualization.",
      project: {
        name: "Honeywell - Advanced Manufacturing Training Demo",
        kind: "Training demonstration / R&D engagement",
        illustrative: false,
        blurb: "This advanced-manufacturing experience turns a specialized metrology workflow into step-by-step immersive practice. The supplied imagery shows a Navigator One measurement system, measurement fixtures, operator controls, a dual-monitor workstation, and interactive tool selection inside a virtual workcell. By modeling the equipment and sequence in context, the experience demonstrates how technical training can support equipment recognition, setup, measurement practice, and procedural familiarity before a learner works at the physical station."
      },
      capturedWith: "Custom 3D modeling of the metrology/manufacturing workcell, equipment, fixtures, controls, workstation, and tools.",
      platform: "Unity Immersive VR training simulation; Vimeo showcase",
      experiences: [
        { id: "video", label: "Watch the Advanced Manufacturing Training Demo", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/1017539252", watchUrl: "https://vimeo.com/1017539252" }
      ],
      media: { id: "video", label: "Watch the Advanced Manufacturing Training Demo", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/1017539252", watchUrl: "https://vimeo.com/1017539252" },
      links: [],
      gallery: [
        { src: "assets/Gov - Honeywell/Gov - Honeywell - 01.webp", alt: "Immersive metrology workcell with the simulated Navigator One measurement system." },
        { src: "assets/Gov - Honeywell/Gov - Honeywell - 02.webp", alt: "Virtual measurement setup and controller interaction inside the manufacturing training environment." },
        { src: "assets/Gov - Honeywell/Gov - Honeywell -03.webp", alt: "Workstation view used to support equipment setup and technical workflow practice." },
        { src: "assets/Gov - Honeywell/Gov - Honeywell - 04.webp", alt: "Hands-on measurement task guided inside the simulated workcell." },
        { src: "assets/Gov - Honeywell/Gov - Honeywell -05.webp", alt: "Interactive tool-selection step in the advanced manufacturing training scenario." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "Immersive advanced-manufacturing/metrology training demonstration in the Honeywell project context, focused on equipment interaction and measurement workflow practice.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "\u2014",
        "Project Data": "Supplied scenes include the Navigator One metrology system, measurement fixtures, operator controls, workstation displays, and interactive tool selection."
      }
    },

    /* ---------------- COMMUNITY ---------------- */
    lafayette: {
      sector: "community",
      title: "Downtown Lafayette",
      tagline: "Connect visitors to the businesses, culture, and stories of Lafayette's urban core through one spatial destination experience.",
      overview: "Commissioned by the Lafayette Convention and Visitors Commission, Downtown Lafayette is a living destination experience that brings local places, businesses, culture, and stories into a connected interactive tour. The same experience can be opened on phone or desktop and has been demonstrated on Meta Quest Pro and Apple Vision Pro.",
      project: {
        name: "Lafayette Convention and Visitors Commission (LCVC)",
        kind: "Deployed destination activation",
        illustrative: false,
        blurb: "Downtown Lafayette extends destination storytelling beyond a static page by making individual places part of a connected spatial experience. Visitors can explore captured venue interiors and move through the broader downtown context while encountering the businesses, culture, and stories that define Lafayette's urban core. The experience is designed around one build that works across phone and desktop and has also been demonstrated on Meta Quest Pro and Apple Vision Pro, giving the destination a reusable experience across devices."
      },
      capturedWith: "360-degree / spatial capture of Downtown Lafayette destinations and venue interiors.",
      platform: "Treedis; web/desktop/mobile; demonstrated on Meta Quest Pro and Apple Vision Pro",
      experiences: [
        { id: "video", label: "Watch Downtown Lafayette", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/1210236846?h=b81cbc0210", watchUrl: "https://vimeo.com/1210236846/b81cbc0210" }
      ],
      media: { id: "video", label: "Watch Downtown Lafayette", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/1210236846?h=b81cbc0210", watchUrl: "https://vimeo.com/1210236846/b81cbc0210" },
      links: [],
      gallery: [
        { src: "assets/Com - LCVC/Com - LCVC - 01.webp", alt: "Captured interior of a Downtown Lafayette entertainment destination within the interactive tour." },
        { src: "assets/Com - LCVC/Com - LCVC - 02.webp", alt: "Interactive venue view with bowling and event-space features." },
        { src: "assets/Com - LCVC/Com - LCVC - 03.webp", alt: "Wide spatial view showing the destination's entertainment and gathering areas." },
        { src: "assets/Com - LCVC/Com - LCVC - 04.webp", alt: "Front-counter and retail-area capture included in the Downtown Lafayette experience." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "A living Downtown Lafayette destination experience commissioned by the Lafayette Convention and Visitors Commission to connect visitors with local businesses, culture, and stories.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "\u2014",
        "Project Data": "One experience is designed for phone and desktop and has been demonstrated on Meta Quest Pro and Apple Vision Pro; the supplied inventory includes a public Treedis tour."
      }
    },

    gfc: {
      sector: "community",
      title: "Iberia Parish Clean Energy Hub Digital Twin",
      tagline: "Make clean-energy, resilience, environmental, and infrastructure context visible at community scale.",
      overview: "The Iberia Parish experience brings community-scale aerial context, local destinations, infrastructure, and environmental data into one digital twin. It is connected to the Iberia Parish Clean Energy Hub initiative in the National Academies' Gulf Futures Challenge.",
      project: {
        name: "Iberia Parish Clean Energy Hub - Gulf Futures Challenge",
        kind: "Gulf Futures Challenge finalist project / digital twin pilot",
        illustrative: false,
        blurb: "The Iberia Parish digital twin is designed to make place-based clean-energy and resilience concepts easier to explore. Supplied imagery shows a location-navigation menu, community-scale 3D aerial views, an environmental surface-temperature visualization, and industrial/transportation infrastructure context. Within the Iberia Parish Clean Energy Hub initiative, the digital twin component supports a broader concept integrating solar, agrivoltaics, carbon capture, workforce training, environmental restoration, and community resilience."
      },
      capturedWith: "Aerial/3D spatial capture combined with map, GIS, location, infrastructure, and environmental data layers.",
      platform: "Treedis; 3D aerial / GIS-style data layers",
      experiences: [
        { id: "video", label: "The Iberia Parish Digital Twin", default: true, access: "public",
          type: "vimeo", embedUrl: "https://player.vimeo.com/video/1132293716", watchUrl: "https://vimeo.com/1132293716" }
      ],
      media: { id: "video", label: "The Iberia Parish Digital Twin", default: true, access: "public",
               type: "vimeo", embedUrl: "https://player.vimeo.com/video/1132293716", watchUrl: "https://vimeo.com/1132293716" },
      links: [],
      gallery: [
        { src: "assets/Com - GFC/Com - GFC - 01.webp", alt: "Aerial 3D view of Iberia Parish with a location menu linking community sites and data layers." },
        { src: "assets/Com - GFC/Com - GFC - 02.webp", alt: "Community-scale aerial context for exploring the parish and surrounding built environment." },
        { src: "assets/Com - GFC/Com - GFC - 03.webp", alt: "Environmental data visualization layer showing modeled surface-temperature conditions." },
        { src: "assets/Com - GFC/Com - GFC - 04.webp", alt: "Aerial view of industrial and transportation infrastructure included in the parish digital twin." }
      ],
      sweepId: null,
      evidence: {
        "Case Studies": "Community-scale Iberia Parish digital twin work tied to the Iberia Parish Clean Energy Hub concept, combining place-based exploration with clean-energy and resilience context.",
        "Awards": "\u2014",
        "Client Feedback": "\u2014",
        "Press & Research": "The Iberia Parish Clean Energy Hub was named one of ten finalists in the National Academies' $50 million Gulf Futures Challenge.",
        "Project Data": "The Gulf Futures Challenge concept integrates solar, agrivoltaics, carbon capture, workforce training, environmental restoration, and digital twin simulations; supplied imagery shows aerial context, environmental data layers, and infrastructure views."
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
