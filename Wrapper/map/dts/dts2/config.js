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
    tourUrl: "https://spaces.dtsxr.com/tour/4fb22059",
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
    ownerEmail: "robertoenrique2710@hotmail.com",
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
,

  /* ============================================================
     SUB-VERTICAL EXAMPLES  (the windows that open on card / tab click)
     ------------------------------------------------------------
     Keyed by the card `id` used in categories[].cards. Each entry
     populates the example window styled after experienceOpenedWindow.png.

     `project` examples are drawn from the design rationale (section 05).
     Where the rationale named no concrete client for a sub-vertical, a
     plausible illustrative example is provided and flagged
     `illustrative: true` so it can be swapped for a real one later.

     `sweepId` (optional) — when present, the window's "Enter the twin"
     button drops the live Treedis experience to that sweep. When null,
     it opens the default demo showcase.
     ============================================================ */
  examples: {
    /* ---------------- EDUCATION ---------------- */
    campus: {
      sector: "education",
      title: "Campus & Schools",
      tagline: "Spatial navigation, orientation, an LMS gateway — K-12 through university.",
      overview: "A campus twin turns a sprawling, hard-to-navigate institution into a space a prospective student, parent, or new hire can walk before they ever arrive. Wayfinding, recruitment tours, orientation, and an LMS launch point all live in one persistent spatial layer.",
      project: {
        name: "SC State University — Virtual Campus",
        kind: "Active project",
        illustrative: false,
        blurb: "A full Matterport + Treedis twin of the SC State campus pairing a 2D map with 360 street-view sweeps. Buildings, tour stops, and a course-linked Learn mode let students walk the campus and drop into immersive VR before they set foot on it."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "SC State Virtual Campus — recruitment and orientation tool spanning the full campus footprint with deep links into classroom VR.",
        "Awards": "Recognized internally as the reference framework all later DTS spatial-navigation builds adapt from.",
        "Client Feedback": "\u201cStudents can find Financial Aid before their first day\u201d — campus administration.",
        "Press & Research": "Cited as the template for multi-location campus mapping and guided tours.",
        "Project Data": "Multiple buildings, dozens of sweeps, desktop + Meta Quest VR profiles."
      }
    },
    workforce: {
      sector: "education",
      title: "Workforce & Trade",
      tagline: "Skills labs, certification, DOL-funded programs, economic mobility.",
      overview: "Workforce twins capture skills labs and training floors so learners can rehearse procedures and equipment before touching the real thing — the fastest-growing segment in immersive training, and the one most tied to funded economic-mobility programs.",
      project: {
        name: "BRCC / Community-College Skills Lab",
        kind: "Institutional relationship",
        illustrative: false,
        blurb: "DTS holds deep institutional relationships across the technical and community-college space (ULL, BRCC, SCSU, Betaversity). Skills-lab twins let DOL-funded workforce programs scale hands-on training without scaling physical lab time."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Skills-lab capture used to extend limited lab hours across multiple program cohorts.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe can pre-train a cohort before they ever queue for a machine.\u201d",
        "Press & Research": "Immersive training is the fastest-growing segment of the workforce-development market.",
        "Project Data": "Reusable across every cohort; one capture, many trainees."
      }
    },
    healthcare: {
      sector: "education",
      title: "Healthcare Training",
      tagline: "Staff orientation, clinical simulation, patient-safety environments.",
      overview: "Placed in Education because the buyer is an educator or training coordinator — not a clinician. The purchase is instructional: staff orientation, clinical simulation, and patient-safety rehearsal in a true-to-life spatial environment.",
      project: {
        name: "Clinical Simulation Suite",
        kind: "Illustrative example",
        illustrative: true,
        blurb: "A twin of a hospital training ward where new staff rehearse intake, room layout, and patient-safety protocols. Because the buyer self-identifies as an educator, this lives under Education rather than Government or Industry."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Onboarding twin lets staff learn room and equipment layout before their first shift.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cDay-one staff already know where everything is.\u201d",
        "Press & Research": "Simulation-based onboarding reduces first-week error rates.",
        "Project Data": "Walk-through rehearsals, unlimited repetition, zero ward disruption."
      }
    },
    workplace: {
      sector: "education",
      title: "Workplace Learning",
      tagline: "Corporate onboarding, continuing ed, Betaversity, EON Reality.",
      overview: "The platform play. Betaversity and EON Reality content that scales corporate onboarding and continuing education across every other category — one immersive-learning layer reused everywhere.",
      project: {
        name: "Betaversity / EON Reality Content",
        kind: "Platform capability",
        illustrative: false,
        blurb: "Immersive-learning content built on Betaversity and EON Reality that scales across all the other sub-verticals — the reusable training layer that turns a one-off capture into an ongoing learning environment."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Onboarding modules reused across departments from a single immersive build.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cOne build, every new hire.\u201d",
        "Press & Research": "Platform-scale immersive learning lowers per-trainee cost over time.",
        "Project Data": "Scales horizontally across sectors and cohorts."
      }
    },

    /* ---------------- INDUSTRY ---------------- */
    energy: {
      sector: "industry",
      title: "Energy & Utilities",
      tagline: "Compliance documentation, FEMA obligations, infrastructure twins.",
      overview: "The compliance-mandated market — oil/gas, solar, and utility infrastructure buyers driven by regulatory pressure, insurance requirements, and FEMA documentation obligations. The fastest path to a closed contract.",
      project: {
        name: "Solar Farm Sample",
        kind: "Demo capture",
        illustrative: false,
        blurb: "A Matterport Pro2 capture of a solar installation on the Treedis platform — the kind of infrastructure twin used for insurance documentation, compliance records, and remote inspection of energy assets."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Solar Farm Sample — infrastructure capture for compliance and insurance documentation.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe can document the whole site without a truck roll.\u201d",
        "Press & Research": "Energy is the compliance-driven, fastest-to-close digital-twin vertical.",
        "Project Data": "Captured with Matterport Pro2 · Platform: Treedis."
      }
    },
    manufacturing: {
      sector: "industry",
      title: "Manufacturing & Operations",
      tagline: "Industrial forensics and production-environment capture.",
      overview: "Twins of production floors and industrial environments for forensic documentation, process review, and operations training — capturing the state of a facility precisely as it was at a moment in time.",
      project: {
        name: "Production-Floor Forensic Capture",
        kind: "Illustrative example",
        illustrative: true,
        blurb: "A manufacturing-floor twin used to document equipment placement and process flow for a pre-loss insurance assessment and operations review — the industrial-forensic work that anchors this sub-vertical."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Forensic capture preserves the exact state of a production line for later review.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe record is the floor, exactly as it was.\u201d",
        "Press & Research": "Industrial twins shorten incident investigation and insurance cycles.",
        "Project Data": "Millimetre-accurate spatial record of the production environment."
      }
    },
    automotive: {
      sector: "industry",
      title: "Automotive & Retail",
      tagline: "Showroom and vehicle twins that serve the sales process directly.",
      overview: "Showroom and vehicle twins that plug straight into the sales process — letting buyers explore inventory and configurations spatially, anchored by the BMW Lafayette proof point.",
      project: {
        name: "BMW Lafayette — Showroom Twin",
        kind: "Proof point",
        illustrative: false,
        blurb: "A showroom-and-vehicle twin built as a proof point for automotive retail: buyers walk the floor and inspect vehicles remotely, turning the twin into a direct extension of the sales process."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "BMW Lafayette showroom twin used as an automotive-retail proof point.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cBuyers walk the floor before they ever visit.\u201d",
        "Press & Research": "Automotive is one of four dominant commercial twin verticals through 2030.",
        "Project Data": "Showroom + vehicle-level capture tied to the sales funnel."
      }
    },
    hospitality: {
      sector: "industry",
      title: "Hospitality & Tourism",
      tagline: "Destination marketing and the Virgin Hotels model.",
      overview: "Twins for hotels, venues, and destination-marketing organizations — letting guests and event planners experience a property before booking. Modeled on the Virgin Hotels approach.",
      project: {
        name: "Virgin Hotels — Property Twin",
        kind: "Model engagement",
        illustrative: false,
        blurb: "A hospitality twin in the Virgin Hotels model: rooms, venues, and event spaces captured so destination-marketing organizations and planners can sell the experience spatially, before a guest arrives."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Property twin used by a destination-marketing organization to sell event space.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cPlanners book the room they already walked.\u201d",
        "Press & Research": "Hospitality is a leading commercial digital-twin vertical.",
        "Project Data": "Guest rooms, venues, and event spaces in one navigable twin."
      }
    },

    /* ---------------- GOVERNMENT ---------------- */
    federal: {
      sector: "government",
      title: "Federal & State Agencies",
      tagline: "SAM.gov-registered, RFP-driven engagements.",
      overview: "The RFP-driven public-sector market — work won through SAM.gov registration and formal procurement. Government has its own budget authority and compliance timelines, which is why it is its own category.",
      project: {
        name: "LDH / OTS / ConnectLA",
        kind: "Agency relationships",
        illustrative: false,
        blurb: "RFP-driven engagements with state agencies (LDH, OTS, ConnectLA) where the twin serves documentation, public-records, and program-delivery requirements under formal government procurement."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Agency engagement delivered under formal RFP and SAM.gov procurement.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cIt fits how we actually buy.\u201d",
        "Press & Research": "Government procurement differs fundamentally from commercial buying.",
        "Project Data": "Delivered to federal/state documentation and compliance standards."
      }
    },
    emergency: {
      sector: "government",
      title: "Emergency Management",
      tagline: "GOHSEP relationships and FEMA PA documentation.",
      overview: "Time-sensitive, compliance-driven work: GOHSEP relationships and FEMA Public Assistance documentation, accessible through a specific intermediary on a short timeline. A twin is the authoritative record of conditions before and after an event.",
      project: {
        name: "GOHSEP / FEMA PA Documentation",
        kind: "Compliance engagement",
        illustrative: false,
        blurb: "Emergency-management documentation tied to GOHSEP and FEMA Public Assistance: a spatial record captured on a short, compliance-driven timeline that stands as the authoritative account of site conditions."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "FEMA PA documentation capture delivered inside a compliance deadline.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe twin is the record of record.\u201d",
        "Press & Research": "Disaster documentation is a time-sensitive, intermediary-driven market.",
        "Project Data": "Date-stamped spatial record for Public Assistance claims."
      }
    },
    municipal: {
      sector: "government",
      title: "Municipal & Smart Cities",
      tagline: "The fastest-growing government digital-twin segment globally.",
      overview: "City-scale twins — the fastest-growing government segment worldwide — anchored by the New Orleans convention-center work with Miles Partnership. Infrastructure, venues, and public spaces as a living municipal record.",
      project: {
        name: "New Orleans Convention Center",
        kind: "Anchor project",
        illustrative: false,
        blurb: "Smart-city work anchored by the New Orleans convention-center twin with Miles Partnership — positioning DTS in the fastest-growing municipal digital-twin segment globally."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "New Orleans convention-center twin built with Miles Partnership.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe city can show the venue to the world.\u201d",
        "Press & Research": "Municipal/smart-city is the fastest-growing government twin segment.",
        "Project Data": "Large-venue public-infrastructure capture."
      }
    },
    foodsafety: {
      sector: "government",
      title: "Food Safety & Regulatory",
      tagline: "Inspection-authority procurement — regulatory, not operational.",
      overview: "Sits in Government because the AFDO buyer is a federal inspection authority, not a commercial food company. The procurement is regulatory: twins support inspection, training, and standards enforcement.",
      project: {
        name: "AFDO — Inspection & Standards",
        kind: "Regulatory engagement",
        illustrative: false,
        blurb: "Food-safety work for inspection authorities (AFDO): twins of regulated environments used for inspector training and standards enforcement — a regulatory procurement, distinct from any commercial food-industry operation."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Regulated-environment twin used for inspector training and standards.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cInspectors train on the real layout, remotely.\u201d",
        "Press & Research": "Food-safety procurement is regulatory authority work, not commercial.",
        "Project Data": "Standards-aligned capture for inspection workflows."
      }
    },

    /* ---------------- COMMUNITY ---------------- */
    economic: {
      sector: "community",
      title: "Economic Development",
      tagline: "Downtown showcases and commercial-corridor documentation.",
      overview: "Twins that showcase a downtown or commercial corridor to attract investment and tenants — proof that a place is worth building in. Anchored by New Orleans business-district documentation.",
      project: {
        name: "New Orleans Business District",
        kind: "Proof point",
        illustrative: false,
        blurb: "Downtown-showcase and commercial-corridor documentation for the New Orleans business district — a twin economic-development organizations use to attract investment and tenants to the corridor."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Business-district twin used to market a commercial corridor to investors.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cWe can tour a prospect down the whole corridor.\u201d",
        "Press & Research": "Spatial showcases lower the friction of attracting commercial tenants.",
        "Project Data": "Corridor-scale documentation of available space."
      }
    },
    nonprofit: {
      sector: "community",
      title: "Nonprofits & NGOs",
      tagline: "Community-impact narratives alongside commercial work.",
      overview: "Mission-driven twins that give an organization a credible, sharable impact narrative — anchored by the Do It Greener Foundation, which pairs DTS's commercial work with genuine community impact.",
      project: {
        name: "Do It Greener Foundation",
        kind: "Anchor relationship",
        illustrative: false,
        blurb: "A twin built with the Do It Greener Foundation that gives DTS a credible community-impact narrative — letting a mission-driven organization show, spatially, the places and outcomes its work touches."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Do It Greener Foundation twin used to tell a spatial impact story.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cDonors can see exactly where their support lands.\u201d",
        "Press & Research": "Spatial storytelling strengthens nonprofit impact reporting.",
        "Project Data": "Impact-site documentation for grant and donor reporting."
      }
    },
    sustain: {
      sector: "community",
      title: "Sustainability & Civic",
      tagline: "ESG documentation and green-infrastructure capture.",
      overview: "Twins that document green infrastructure and civic-sustainability projects for ESG reporting — a growing market where the spatial record is the evidence of environmental commitments delivered.",
      project: {
        name: "Green-Infrastructure ESG Record",
        kind: "Illustrative example",
        illustrative: true,
        blurb: "A twin documenting a green-infrastructure or civic-sustainability project as the spatial evidence behind an ESG report — positioning DTS in the growing sustainability-documentation market."
      },
      sweepId: null,
      evidence: {
        "Case Studies": "Green-infrastructure capture used as primary evidence in an ESG report.",
        "Awards": "\u2014",
        "Client Feedback": "\u201cThe report points at the place, not a paragraph.\u201d",
        "Press & Research": "ESG documentation is a growing civic-sustainability market.",
        "Project Data": "Verifiable spatial record of delivered green infrastructure."
      }
    },
    heritage: {
      sector: "community",
      title: "Cultural & Heritage Preservation",
      tagline: "Historic tax-credit and Section 106 compliance capture.",
      overview: "Documentation-driven, compliance-mandated work that is underserved by existing digital-twin vendors: historic tax-credit and Section 106 review capture that preserves cultural and heritage sites precisely.",
      project: {
        name: "Historic Tax-Credit / Section 106 Capture",
        kind: "Compliance engagement",
        illustrative: false,
        blurb: "Heritage-preservation capture for historic tax-credit and Section 106 compliance: a precise spatial record of a historic structure — a documentation-mandated market existing twin vendors largely overlook."
      },
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
     Inline answers for the rotating FAQ prompts. Keys are matched
     case-insensitively against the question text (substring match),
     so a visitor can also type a close variant.
     ============================================================ */
  answers: [
    { match: ["treedis"],
      q: "What is Treedis?",
      a: "Treedis is the platform DTS uses to publish and share interactive 3D spatial experiences. A space captured with Matterport is hosted on Treedis, where you can walk through it in 360\u00b0, add tags and hotspots, and embed it on the web \u2014 like the experience running on this page." },
    { match: ["matterport", "capture"],
      q: "What is a Matterport capture like?",
      a: "A Matterport capture is a scan of a real place using a 3D camera (like the Matterport Pro2). The camera takes overlapping 360\u00b0 photos and depth data from many points in a space, which are stitched into a navigable, dimensionally-accurate digital twin you can move through online." },
    { match: ["digital twin", "what is a digital"],
      q: "What is a Digital Twin?",
      a: "A digital twin is a precise, navigable virtual copy of a real place. DTS builds twins for the systems that shape human life \u2014 campuses, operations, public infrastructure, and community spaces \u2014 so you can explore, document, train, and make decisions about a space without being physically there." },
    { match: ["contact", "get in touch", "reach"],
      q: "How do I get in contact?",
      a: "Open any sector and use Contact & Info, or the ACCESS YOUR TWIN button up top. You can Schedule a Discovery (a 30-minute conversation), Request a Proposal, or Start a Pilot \u2014 each goes straight to the DTS team." },
    { match: ["mobile", "phone", "device"],
      q: "Can I use a mobile device?",
      a: "Yes. The experience runs on desktop, tablet, and phone, and on Meta Quest headsets in VR. On a phone, use the menu to move between sectors and tap a use case to open its example experience." }
  ]
};
