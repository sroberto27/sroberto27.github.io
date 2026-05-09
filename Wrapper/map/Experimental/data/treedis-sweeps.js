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

   Sweep IDs in this file belong to model `8e4ca3fc` — see
   `treedis.modelId` in config.js. If you swap models you
   need to update both files together; sweep IDs are
   model-scoped.

   The top-level Treedis SDK plumbing (modelId, origin,
   tourUrl, defaultTransitionTime, homeSweepId) lives in
   config.js under `treedis`.
   ============================================================ */
window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};

window.CAMPUS_CONFIG.treedisMap = {
  /* ---- Top-level buildings ---------------------------- */
  "nance hall": {
    sweepId: "129qre2zyzhkp9e6sdregmmnb"
  },
  "crawford zimmerman": {
    sweepId: "zu9846n3g155mah3egxm5r70c"
  },
  "kirkland w. green student center": {
    sweepId: "5s2skyqyg7w7xdt99utc1636a"
  },
  "oliver c. dawson stadium": {
    sweepId: "0ysqgq6zyay1qms9d4n3pht3a"
  },
  "s-h-m memorial square": {
    // Sheet calls the building-level sweep "Historical Plaza".
    sweepId: "ngewc47tmsx3nt70wgyk6778a"
  },
  "olar demo farm": {
    sweepId: "hnz5p2wkdqr4isd41y1z2e1kc"
  },
  "olar farm": {
    sweepId: "hnz5p2wkdqr4isd41y1z2e1kc"
  },
  "legacy plaza": {
    sweepId: "siisknwp2903ign49n8mkafxa"
  },
  "street view": {
    // No matching row in the new sheet; left at the prior id so
    // existing references keep resolving. Replace if the new
    // model needs a different "street view" entry point.
    sweepId: "gs6itzr7wgg9zm7iicpmf27qd"
  },

  /* ---- Nance Hall sub-locations -----------------------
     Per the SCSU_Links sheet, the only Nance Hall sub-locations
     that exist are Room 100, Room 110, and Lecture Room. The
     previous "1st floor" / "2nd floor" / "general lecture room"
     keys were stale and have been removed.
     ----------------------------------------------------- */
  "room 100": {
    sweepId: "smq4rk3baq414duy3icagdidd",
    parentName: "Nance Hall"
  },
  "room 110": {
    sweepId: "2ki84r23di9yq9p613u5yg34d",
    parentName: "Nance Hall"
  },
  "lecture room": {
    sweepId: "1t7xp1xztp4aw4bs372705dwd",
    parentName: "Nance Hall"
  },
  "room 110 - baby": {
    // TODO: not in current spreadsheet — confirm whether this
    //       sub-location still applies in the new model.
    sweepId: null,
    parentName: "Nance Hall"
  },
  "faculty suite": {
    // TODO: not in current spreadsheet — confirm whether this
    //       sub-location still applies in the new model.
    sweepId: null,
    parentName: "Nance Hall"
  },

  /* ---- Crawford-Zimmerman sub-locations --------------- */
  "crawford zimmerman 1st floor": {
    sweepId: "sawh7uqgn3msc6b6y5aeabgpc",
    parentName: "Crawford-Zimmerman"
  },
  "campus bookstore": {
    // Same sweep as `crawford zimmerman 1st floor` — the sheet
    // labels this sweep "Store". Keeping both keys so either
    // alias resolves.
    sweepId: "sawh7uqgn3msc6b6y5aeabgpc",
    parentName: "Crawford-Zimmerman"
  },
  "office of student financial services": {
    sweepId: "m4hxr31wf6g7x6znru5wkp26a",
    parentName: "Crawford-Zimmerman"
  },
  "facilities management & operations": {
    // TODO: not in current spreadsheet — confirm whether this
    //       sub-location still applies in the new model.
    sweepId: null,
    parentName: "Crawford-Zimmerman"
  },
  "admissions & financial aid": {
    sweepId: "br7rxxkae3inaq9cuuw2cs12a",
    parentName: "Crawford-Zimmerman"
  },

  /* ---- Student Center floors -------------------------- */
  "student center 1st floor": {
    // TODO: spreadsheet has no separate sweep id for floors.
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },
  "student center 2nd floor": {
    // TODO: spreadsheet has no separate sweep id for floors.
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },

  /* ---- Memorial sub-locations ------------------------- */
  "historical marker": {
    // Sheet's "Historical Plaza" sweep — the building-level
    // landing for the memorial square also serves as the
    // historical-marker sub-location.
    sweepId: "ngewc47tmsx3nt70wgyk6778a",
    parentName: "S-H-M Memorial Square"
  },
  "bronze busts/monuments": {
    sweepId: "zckbgra0e4w7hfi5i50s3gria",
    parentName: "S-H-M Memorial Square"
  },

  /* ---- Stadium sub-locations -------------------------- */
  "midfield": {
    sweepId: "2k4mat4f2ba0gca1iap2xs9md",
    parentName: "Oliver C. Dawson Stadium"
  },
  "gate 1": {
    sweepId: "b9z6epq22rc4a3918w6bgkw8d",
    parentName: "Oliver C. Dawson Stadium"
  },
  "bulldog wall": {
    sweepId: "ak3m9c0k9d6dfzkmw7h6h192a",
    parentName: "Oliver C. Dawson Stadium"
  }
};
