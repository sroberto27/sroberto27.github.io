/* ============================================================
   SCSU METAVERSITY — Treedis sweep map
   ------------------------------------------------------------
   Loaded via <script>, like the other data/*.js files. Writes
   onto window.CAMPUS_CONFIG.treedisMap so app.js can keep
   reading it from `config.treedisMap` without any changes.

   Case-insensitive keys match `name` from the GeoJSON data
   (same convention as descriptionMap / imageMap etc).
   Sub-locations (rooms, floors, etc.) use a `parentName`
   so the street view UI can show the right building title.

   Each entry can be either:
     • a string  → treated as { sweepId: "...", parentName: null }
     • an object → { sweepId, parentName?, transitionTime? }

   Entries marked TODO are placeholders — replace the
   sweepId with the real value from the spreadsheet when
   available. The app treats a missing sweepId gracefully
   and logs a warning rather than breaking.

   The top-level Treedis SDK plumbing (modelId, origin,
   tourUrl, defaultTransitionTime, homeSweepId) lives in
   config.js under `treedis`.
   ============================================================ */
window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};

window.CAMPUS_CONFIG.treedisMap = {
  /* ---- Top-level buildings ---------------------------- */
  "nance hall": {
    sweepId: "asfnat04t866bzrkzegbaki6c"
  },
  "crawford zimmerman": {
    sweepId: "d2brr5bczkx2m8pg0ap06di9d"
  },
  "kirkland w. green student center": {
    sweepId: "itqbbw5un90s6fubay1sg9wpb"
  },
  "oliver c. dawson stadium": {
    sweepId: "a69zbymdc8gnx3nzhy7nm3rna"
  },
  "s-h-m memorial square": {
    sweepId: "uf2k18cpw057bbexxqs9g2w4a"
  },
  "olar demo farm": {
    sweepId: "pgq02k1ubi2mb2gc7cpfpm24d"
  },
  "olar farm": {
    sweepId: "pgq02k1ubi2mb2gc7cpfpm24d"
  },
  "legacy plaza": {
    sweepId: "uf2k18cpw057bbexxqs9g2w4a"
  },
  "street view": {
    sweepId: "gs6itzr7wgg9zm7iicpmf27qd"
  },

  /* ---- Nance Hall sub-locations ----------------------- */
  "1st floor": {
    sweepId: "2ki84r23di9yq9p613u5yg34d",
    parentName: "Nance Hall"
  },
  "2nd floor": {
    sweepId: "1t7xp1xztp4aw4bs372705dwd",
    parentName: "Nance Hall"
  },
  "room 100": {
    // TODO: replace with the real sweep when available
    sweepId: null,
    parentName: "Nance Hall"
  },
  "room 100 - general lecture": {
    // TODO: replace with the real sweep when available
    sweepId: null,
    parentName: "Nance Hall"
  },
  "general lecture room": {
    // TODO: replace with the real sweep when available
    sweepId: null,
    parentName: "Nance Hall"
  },
  "room 110": {
    // TODO: replace with the real sweep when available
    sweepId: null,
    parentName: "Nance Hall"
  },
  "room 110 - baby": {
    // TODO: replace with the real sweep when available
    sweepId: null,
    parentName: "Nance Hall"
  },
  "faculty suite": {
    // TODO: replace with the real sweep when available
    sweepId: null,
    parentName: "Nance Hall"
  },

  /* ---- Crawford-Zimmerman sub-locations --------------- */
  "crawford zimmerman 1st floor": {
    sweepId: "sawh7uqgn3msc6b6y5aeabgpc",
    parentName: "Crawford-Zimmerman"
  },
  "campus bookstore": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Crawford-Zimmerman"
  },
  "office of student financial services": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Crawford-Zimmerman"
  },
  "facilities management & operations": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Crawford-Zimmerman"
  },
  "admissions & financial aid": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Crawford-Zimmerman"
  },

  /* ---- Student Center floors -------------------------- */
  "student center 1st floor": {
    // TODO: spreadsheet has no sweep id
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },
  "student center 2nd floor": {
    // TODO: spreadsheet has no sweep id
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },

  /* ---- Memorial sub-locations ------------------------- */
  "historical marker": {
    // TODO: real sweep
    sweepId: null,
    parentName: "S-H-M Memorial Square"
  },
  "bronze busts/monuments": {
    // TODO: real sweep
    sweepId: null,
    parentName: "S-H-M Memorial Square"
  },

  /* ---- Stadium sub-locations -------------------------- */
  "midfield": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Oliver C. Dawson Stadium"
  },
  "gate 1": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Oliver C. Dawson Stadium"
  },
  "bulldog wall": {
    // TODO: real sweep
    sweepId: null,
    parentName: "Oliver C. Dawson Stadium"
  }
};
