/* ============================================================
   DTS — Configuration
   ------------------------------------------------------------
   Structural settings + content for the prototype. Treedis
   plumbing keeps the same shape as the SCSU wrapper's config.js
   so the real model IDs drop straight in.

   >>> CONNECT REAL TREEDIS HERE <<<
   Set treedis.tourUrl to the live showcase embed URL and
   treedis.origin to its origin. The demo frame's "Try a Digital
   Twin" button calls TourBridge against these values.
   ============================================================ */
window.DTS_CONFIG = {
  brand: {
    name: "Digital Twin Studios",
    short: "DTS",
    tagline: "Curated Spatial Experiences",
    domain: "dtsxr.com"
  },

  treedis: {
    /* The SCSU wrapper shipped these. They are kept as a working
       default so the demo frame shows a real tour out of the box.
       Replace with the DTS marketing/demo showcase when ready. */
    tourUrl: "https://spaces.dtsxr.com/tour/8e4ca3fc",
    origin:  "https://spaces.dtsxr.com",

    /* Optional landing sweep — null opens the model default.
       Set to a real sweep id to land users somewhere specific. */
    homeSweepId: null,

    /* ms used when Treedis moves sweep. */
    defaultTransitionTime: 1500
  },

  /* Top-right client portal — kept architecturally separate from
     the marketing experience per the design rationale. Placeholder
     URL; wire to the real authenticated portal at launch. */
  clientPortalUrl: "#access-your-twin",

  /* The four pillars ARE the navigation + identity. Order is the
     human-lifecycle sequence from the rationale:
     Education → Industry → Government → Community. */
  categories: [
    {
      id: "education",
      label: "Education",
      blurb: "Education develops people.",
      active: true,                      // most complete category for v0
      kicker: "EDUCATION",
      title: "Campus & Schools",
      sub: "Digital Twin of your campus",
      body: "Where human potential is built. DTS creates living spatial ecosystems for learning environments — from recruitment through graduation. One twin. Every stage of the student and faculty relationship with your institution.",
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
      blurb: "Industry creates economic value.",
      active: false,
      kicker: "INDUSTRY",
      title: "Operations & Trade",
      sub: "Digital Twin of your operation",
      body: "Where capability creates value. DTS builds twins of the environments where educated people produce economic value — energy, manufacturing, automotive, hospitality, and creative production.",
      cards: [
        { id: "energy",       title: "Energy & Utilities",      text: "Compliance documentation, FEMA obligations, infrastructure twins." },
        { id: "manufacturing",title: "Manufacturing & Ops",     text: "Industrial forensics and production environment capture." },
        { id: "automotive",   title: "Automotive & Retail",     text: "Showroom and vehicle twins that serve the sales process directly." },
        { id: "hospitality",  title: "Hospitality & Tourism",   text: "Destination marketing and the Virgin Hotels model." }
      ]
    },
    {
      id: "government",
      label: "Government",
      blurb: "Government provides structure and oversight.",
      active: false,
      kicker: "GOVERNMENT",
      title: "Agencies & Cities",
      sub: "Digital Twin of public infrastructure",
      body: "Where society is structured. Government has its own procurement, budget authority, and compliance timelines. DTS twins serve federal, state, municipal, and emergency-management buyers on their terms.",
      cards: [
        { id: "federal",   title: "Federal & State Agencies", text: "SAM.gov-registered, RFP-driven engagements." },
        { id: "emergency", title: "Emergency Management",     text: "GOHSEP relationships and FEMA PA documentation." },
        { id: "municipal", title: "Municipal & Smart Cities", text: "The fastest-growing government digital-twin segment." },
        { id: "foodsafety",title: "Food Safety & Regulatory", text: "Inspection-authority procurement, regulatory not operational." }
      ]
    },
    {
      id: "community",
      label: "Community",
      blurb: "Community represents the lived outcomes of those systems.",
      active: false,
      kicker: "COMMUNITY",
      title: "Civic & Cultural",
      sub: "Digital Twin of shared places",
      body: "Where it all comes together. Community is the proof that education, industry, and government have done their work — economic development, nonprofits, sustainability, and heritage preservation.",
      cards: [
        { id: "economic",   title: "Economic Development",   text: "Downtown showcases and commercial corridor documentation." },
        { id: "nonprofit",  title: "Nonprofits & NGOs",      text: "Community impact narratives alongside commercial work." },
        { id: "sustain",    title: "Sustainability & Civic", text: "ESG documentation and green infrastructure." },
        { id: "heritage",   title: "Cultural & Heritage",    text: "Historic tax credit and Section 106 compliance capture." }
      ]
    }
  ],

  /* Project-evidence filters (beach / data layer from the rationale). */
  evidence: ["Case Studies", "Awards", "Client Feedback", "Press & Research", "Project Data"],

  /* Rotating placeholder prompts for the question bar. */
  questionPrompts: [
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
  }
};
