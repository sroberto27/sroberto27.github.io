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
  },

  /* ============================================================
     LEAD CAPTURE  →  emails the owner when a form is submitted.
     ------------------------------------------------------------
     Delivery uses Web3Forms (https://web3forms.com) — a free,
     no-backend service that emails form submissions to a fixed
     address. Static-site friendly (works on GitHub Pages).

     >>> SETUP (2 minutes) <<<
       1. Go to https://web3forms.com, enter the owner's email,
          and copy the "Access Key" they send you.
       2. Paste it into `accessKey` below.
       3. Set `ownerEmail` to where leads should land (shown to
          the user as confirmation; Web3Forms uses the key, not
          this, to route — but keep them the same).

     Until a key is set, the forms fall back to opening the user's
     email app (mailto:) pre-filled with all their answers, so the
     prototype still "sends" without any signup.
     ============================================================ */
  lead: {
    accessKey: "b825431d-56a9-4ee5-9042-72bb7685f8c3",                       // <-- paste Web3Forms key herec00416436@louisiana.edu
    //ownerEmail: "hello@dtsxr.com",       // <-- owner's destination inbox
    ownerEmail: "00416436@louisiana.edu",   
    subjectPrefix: "DTS Website Lead",

    /* Per-button form definitions. Each maps to one CTA id. The
       `sector` field is auto-filled from the category the user is
       browsing — they don't have to pick it. */
    forms: {
      discovery: {
        title: "Schedule a Discovery",
        intro: "A 30-minute conversation about your space and what a twin could do for it. No demo, no pitch.",
        submitLabel: "Request my discovery call",
        fields: [
          { name: "name",    label: "Your name",         type: "text",  required: true },
          { name: "email",   label: "Work email",        type: "email", required: true },
          { name: "org",     label: "Organization",      type: "text",  required: true },
          { name: "role",    label: "Your role",         type: "text",  required: false },
          { name: "timing",  label: "Ideal timeframe",   type: "select", required: false,
            options: ["This week", "Next 2 weeks", "This month", "Just exploring"] },
          { name: "notes",   label: "Anything we should know? (optional)", type: "textarea", required: false }
        ]
      },
      proposal: {
        title: "Request a Proposal",
        intro: "Tell us about the space and the outcome you're after. We'll scope a proposal and send it back.",
        submitLabel: "Send my proposal request",
        fields: [
          { name: "name",     label: "Your name",        type: "text",  required: true },
          { name: "email",    label: "Work email",       type: "email", required: true },
          { name: "org",      label: "Organization",     type: "text",  required: true },
          { name: "space",    label: "What space or project?", type: "text", required: true },
          { name: "budget",   label: "Budget range (optional)", type: "select", required: false,
            options: ["Not sure yet", "Under $25k", "$25k–$100k", "$100k+"] },
          { name: "timeline", label: "Target timeline",  type: "select", required: false,
            options: ["ASAP", "This quarter", "This year", "Planning ahead"] },
          { name: "notes",    label: "Describe the goal (optional)", type: "textarea", required: false }
        ]
      },
      pilot: {
        title: "Start a Pilot",
        /* The pilot explainer doubles as the intro copy. */
        intro: "A pilot is a scoped, paid engagement — one defined space, a real twin, a clear deliverable. The fee is set during the proposal stage. Tell us what you'd pilot and we'll define the scope with you.",
        submitLabel: "Start my pilot request",
        fields: [
          { name: "name",     label: "Your name",        type: "text",  required: true },
          { name: "email",    label: "Work email",       type: "email", required: true },
          { name: "org",      label: "Organization",     type: "text",  required: true },
          { name: "space",    label: "Space you'd pilot", type: "text", required: true },
          { name: "outcome",  label: "What does success look like?", type: "textarea", required: false },
          { name: "timeline", label: "When would you start?", type: "select", required: false,
            options: ["Immediately", "Within a month", "This quarter", "Still scoping"] }
        ]
      }
    }
  }
};
