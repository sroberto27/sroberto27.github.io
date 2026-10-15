/* ============================================================
   SCSU METAVERSITY — Treedis sweep map (FALLBACK SHIM)
   ------------------------------------------------------------
   ⚠️  EDITORS: this file is no longer the source of truth.
   The canonical data lives in data/treedis-sweeps.json. This
   shim is kept so the page still works when opened directly
   from disk (file:// origin), where fetch() can't read JSON.

   When served over http/https, js/00-data-adapter.js fetches
   data/treedis-sweeps.json and overwrites whatever this shim
   set, so any edits made here are silently ignored in production.

   To regenerate this file from the JSON, run:
       node scripts/extract.js     (JSON → fresh shim)

   --- legacy header continues below ---

   Loaded via <script>, like the other data/*.js files. Writes
   onto window.CAMPUS_CONFIG.treedisMaps so app.js can look up
   sweep IDs scoped to the device profile (desktop vs. VR).

   ─── Why two profiles? ────────────────────────────────────
   The SCSU campus exists in two separate Treedis models:

     • Desktop / tablet / mobile  →  model `6243b323`
     • XR / VR headset browsers   →  model `scsu-campus-b49e93eb`

   Sweep IDs are scoped per model — a sweep id from the desktop
   model will not resolve in the VR model and vice versa, so we
   keep two completely separate lookup tables here. app.js picks
   one at boot time based on the result of detectXRProfile()
   (see app.js — uses navigator.xr.isSessionSupported plus a
   UA-token check for `OculusBrowser` / `Quest` / ` VR ` /
   `Pico`). The top-level SDK plumbing in config.js (modelId,
   tourUrl) is also profile-scoped now — see config.js.

   ─── Entry shape ──────────────────────────────────────────
   Each entry can be either:
     • a string  → treated as { sweepId: "...", parentName: null }
     • an object → { sweepId, parentName?, transitionTime?, rotation? }

   Case-insensitive keys match `name` from the GeoJSON data
   (same convention as descriptionMap / imageMap etc).
   Sub-locations (rooms, floors, etc.) use a `parentName`
   so the street view UI can show the right building title.

   `parentName` is matched (case-insensitively) against the
   tour-stop name in tours.geojson — when a sub-location's
   sweep becomes active, syncWrapperToSweep() looks up the
   tour stop whose `cleanName(name).toLowerCase()` equals
   `parentName.toLowerCase()`. It MUST therefore match the
   exact tour-stop name (e.g. "Crawford-Zimmerman Building",
   not "Crawford-Zimmerman"); otherwise the tour bar won't
   update when the user navigates inside Treedis.

   `rotation` is forwarded to Treedis's `Navigate` command as
   `{ x, y }` (x = pitch, y = yaw). The values below were
   sourced from the `&x=…&y=…` parameters in the October 2026
   Treedis links files (10_2026_PCMobile.txt / 10_2026_VR.txt)
   — they encode camera heading and tilt that the client-team
   captured at each location. They're per-profile
   because the same physical viewpoint resolves differently in
   the desktop vs VR models. When present, the camera lands at
   the sweep facing that direction instead of Treedis's default.

   Entries with `sweepId: null` are deliberate placeholders —
   the app treats them gracefully and logs a warning rather
   than breaking.

   ─── Backward compatibility ───────────────────────────────
   Older app code reads `config.treedisMap` (singular). For
   safety we also expose `treedisMap` as an alias of the
   desktop profile, so any code path we miss falls back to
   the desktop sweeps rather than erroring. app.js repoints
   the alias to the VR profile at boot when XR is detected.

   ─── v2 GeoJSON name changes ──────────────────────────────
   The v2 buildings + tours GeoJSON renamed two tour stops:
     • "Crawford Zimmerman"      → "Crawford-Zimmerman Building"
     • "S-H-M Memorial Square"   → "SHM Memorial Square"
   Both the keys below and the `parentName` strings for their
   sub-locations have been updated to match.
   ============================================================ */
window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};

/* ============================================================
   DESKTOP / TABLET / MOBILE — model `6243b323`
   Sourced from 10_2026_PCMobile.txt (October 2026 rescan).
   ============================================================ */
const TREEDIS_MAP_DESKTOP = {
  "nance hall": {
    sweepId: "bptytnkf430rd8x5q3rf8kxwa",
    rotation: { x: 1.8308220730768359, y: -67.36165022803233 }
  },

  "crawford-zimmerman building": {
    sweepId: "itqxwr11998403qirw207664a",
    rotation: { x: -1.5078394157588464, y: -123.30022548386077 }
  },

  "kirkland w. green student center": {
    sweepId: "1znsf8cet7xb1a0qbi0hza61c",
    rotation: { x: -3.9861222226634734, y: -74.36293086564665 }
  },

  "oliver c. dawson stadium": {
    sweepId: "3y676st7rww404pi609rg5c0a",
    rotation: { x: 2.2623879715926987, y: -77.82672803121368 }
  },

  "shm memorial square": {
    sweepId: "qz3nktz52msay1c5c1q798y5a",
    rotation: { x: -2.799710996780854, y: -51.46308749570923 }
  },

  /* ---- Nance Hall sub-locations ----------- */
  "room 100": {
    sweepId: "smq4rk3baq414duy3icagdidd",
    parentName: "Nance Hall",
    rotation: { x: -6.703468654632588, y: -114.62033650528998 }
  },

  "room 110": {
    sweepId: "seh878f3barigi91p12186a8c",
    parentName: "Nance Hall",
    rotation: { x: -11.84294733877048, y: -104.10895267061555 }
  },

  "lecture room": {
    sweepId: "uqik25u7i841yyf37nw53wnba",
    parentName: "Nance Hall",
    rotation: { x: -3.653470874964615, y: -87.10556821932185 }
  },

  "room 110 - baby": {
    // Placeholder — no sweep in the current links files.
    sweepId: null,
    parentName: "Nance Hall"
  },

  "faculty suite": {
    // Placeholder — no sweep in the current links files.
    sweepId: null,
    parentName: "Nance Hall"
  },

  /* ---- Crawford-Zimmerman sub-locations --- */
  /* parentName must match the v2 tour stop name exactly so
     syncWrapperToSweep() can find the parent in tourStops. */
  "crawford zimmerman 1st floor": {
    sweepId: "n1xw6qb7rekq3kim4dnsss68c",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -15.374351331722128, y: -106.75808875918557 }
  },

  "campus bookstore": {
    // Same sweep as `crawford zimmerman 1st floor` — the links
    //    file labels this sweep "Campus Bookstore". Keeping both
    //    keys so either alias resolves.
    sweepId: "n1xw6qb7rekq3kim4dnsss68c",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -15.374351331722128, y: -106.75808875918557 }
  },

  "office of student financial services": {
    sweepId: "w71ztkwx17guq5zwx8yk60ctb",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -10.23793914389481, y: -87.94131670515388 }
  },

  "facilities management & operations": {
    // Same sweep as the Office of Student Financial Services.
    sweepId: "w71ztkwx17guq5zwx8yk60ctb",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -10.23793914389481, y: -87.94131670515388 }
  },

  "admissions & financial aid": {
    sweepId: "br7rxxkae3inaq9cuuw2cs12a",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -11.351601389945868, y: -143.1231080454776 }
  },

  /* ---- Student Center floors -------------- */
  "student center 1st floor": {
    // Placeholder — no sweep in the current links files.
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },

  "student center 2nd floor": {
    // Placeholder — no sweep in the current links files.
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },

  /* ---- Memorial sub-locations ------------- */
  "historical marker": {
    sweepId: "tzhz35815d7s781b6tmf7a55a",
    parentName: "SHM Memorial Square",
    rotation: { x: -7.580569957610004, y: -109.38112353684902 }
  },

  "bronze busts/monuments": {
    sweepId: "urgag8wshwyftawn24p2iem9b",
    parentName: "SHM Memorial Square",
    rotation: { x: -6.187161142963161, y: -48.33218879233851 }
  },

  /* ---- Stadium sub-locations -------------- */
  "midfield": {
    sweepId: "2k4mat4f2ba0gca1iap2xs9md",
    parentName: "Oliver C. Dawson Stadium",
    rotation: { x: 0, y: -77.82672803121369 }
  },

  "gate 1": {
    sweepId: "dxahxrty742e61uarb1b8yyra",
    parentName: "Oliver C. Dawson Stadium",
    rotation: { x: 1.1644293470846456, y: -77.66777327879078 }
  },

  "bulldog wall": {
    sweepId: "8n861sr3te5g4mbzq53bs1uad",
    parentName: "Oliver C. Dawson Stadium",
    rotation: { x: -0.7310982950556848, y: -69.81619634884808 }
  }
};

/* ============================================================
   XR / VR — model `scsu-campus-b49e93eb`
   Sourced from 10_2026_VR.txt (October 2026 rescan).

   The VR file supplies its own sweep IDs and rotation values
   per location — the headset uses a different default
   heading/tilt, and a few viewpoints use a different sweep.
   Sub-locations without a sweep are left null with the same
   parentName so the UI still resolves the building title.
   ============================================================ */
const TREEDIS_MAP_VR = {
  "nance hall": {
    sweepId: "bptytnkf430rd8x5q3rf8kxwa",
    rotation: { x: -2.1115541681296324, y: -71.87775567457783 }
  },

  "crawford-zimmerman building": {
    sweepId: "itqxwr11998403qirw207664a",
    rotation: { x: -1.10251807625474, y: -118.53575571201992 }
  },

  "kirkland w. green student center": {
    sweepId: "f35kwue683p1rm2x1n3a1fa2a",
    rotation: { x: 4.393484751677412, y: -66.90998509162446 }
  },

  "oliver c. dawson stadium": {
    sweepId: "3y676st7rww404pi609rg5c0a",
    rotation: { x: 0.8613542571958254, y: -81.2055251219462 }
  },

  "shm memorial square": {
    sweepId: "qz3nktz52msay1c5c1q798y5a",
    rotation: { x: -0.5476714240315109, y: -52.499009278150844 }
  },

  /* ---- Nance Hall sub-locations ----------- */
  "room 100": {
    sweepId: "smq4rk3baq414duy3icagdidd",
    parentName: "Nance Hall",
    rotation: { x: -5.242127486250525, y: -110.70658070707988 }
  },

  "room 110": {
    sweepId: "seh878f3barigi91p12186a8c",
    parentName: "Nance Hall",
    rotation: { x: -13.616000937918715, y: -100.80487912819763 }
  },

  "lecture room": {
    sweepId: "uqik25u7i841yyf37nw53wnba",
    parentName: "Nance Hall",
    rotation: { x: -6.242008009870321, y: -91.20002390596463 }
  },

  "room 110 - baby": {
    sweepId: null,
    parentName: "Nance Hall"
  },

  "faculty suite": {
    sweepId: null,
    parentName: "Nance Hall"
  },

  /* ---- Crawford-Zimmerman sub-locations --- */
  /* parentName must match the v2 tour stop name exactly so
     syncWrapperToSweep() can find the parent in tourStops. */
  "crawford zimmerman 1st floor": {
    sweepId: "n1xw6qb7rekq3kim4dnsss68c",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -11.746378744151919, y: -109.22204050887603 }
  },

  "campus bookstore": {
    sweepId: "n1xw6qb7rekq3kim4dnsss68c",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -11.746378744151919, y: -109.22204050887603 }
  },

  "office of student financial services": {
    sweepId: "w71ztkwx17guq5zwx8yk60ctb",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -14.024155132910757, y: -85.13678629531688 }
  },

  "facilities management & operations": {
    sweepId: "w71ztkwx17guq5zwx8yk60ctb",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -14.024155132910757, y: -85.13678629531688 }
  },

  "admissions & financial aid": {
    sweepId: "br7rxxkae3inaq9cuuw2cs12a",
    parentName: "Crawford-Zimmerman Building",
    rotation: { x: -14.31838660217417, y: -137.72271834520288 }
  },

  /* ---- Student Center floors -------------- */
  "student center 1st floor": {
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },

  "student center 2nd floor": {
    sweepId: null,
    parentName: "Kirkland W. Green Student Center"
  },

  /* ---- Memorial sub-locations ------------- */
  "historical marker": {
    sweepId: "tzhz35815d7s781b6tmf7a55a",
    parentName: "SHM Memorial Square",
    rotation: { x: -6.100726242436972, y: -90.41078515081536 }
  },

  "bronze busts/monuments": {
    sweepId: "urgag8wshwyftawn24p2iem9b",
    parentName: "SHM Memorial Square",
    rotation: { x: -6.408175202298518, y: -47.905138450692846 }
  },

  /* ---- Stadium sub-locations -------------- */
  "midfield": {
    sweepId: "2k4mat4f2ba0gca1iap2xs9md",
    parentName: "Oliver C. Dawson Stadium",
    rotation: { x: -8.07282331525429, y: -80.19718770852671 }
  },

  "gate 1": {
    sweepId: "dxahxrty742e61uarb1b8yyra",
    parentName: "Oliver C. Dawson Stadium",
    rotation: { x: -4.796121074299831, y: -77.77366305914475 }
  },

  "bulldog wall": {
    sweepId: "uhpx2eq3adep8nfzmwwb5utqd",
    parentName: "Oliver C. Dawson Stadium",
    rotation: { x: -2.8373423646653313, y: -72.83576124294186 }
  }
};

/* Expose both profiles. `treedisMaps` is the new dual-profile
   API. `treedisMap` (singular) is preserved as an alias to the
   desktop profile for any code path that hasn't been migrated —
   app.js repoints it to the VR profile at boot when XR is
   detected. */
window.CAMPUS_CONFIG.treedisMaps = {
  desktop: TREEDIS_MAP_DESKTOP,
  vr:      TREEDIS_MAP_VR
};
window.CAMPUS_CONFIG.treedisMap = TREEDIS_MAP_DESKTOP;
