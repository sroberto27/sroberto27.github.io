/* === Data adapter ===
   Converts the JSON data files (locations.json, treedis-sweeps.json,
   courses.json) into the flat lookup maps the rest of the app reads:
   window.CAMPUS_CONFIG.*Map, window.CAMPUS_CONFIG.treedisMaps, and
   window.SCSU_DATA.courses. This is the only module that knows the
   JSON shape; swapping the source (e.g. for a CMS API) only requires
   replacing loadDataJSON().

   Loading strategy: fetch the JSON files over http/https. If a fetch
   fails (file:// origin, 404, CORS), fall back to the legacy data/*.js
   shim scripts, which populate the same globals at script parse time. */

/* Fetch and parse a JSON file. Returns null on any failure so the
   caller can fall back to the shim data. */
async function tryFetchJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";

    // Guard against parsing an HTML error page as JSON.
    if (ct.includes("text/html")) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

/* Flatten a locations.json payload into the per-field lookup maps.
   Locations missing a field are simply skipped for that map. */
function applyLocationsJSON(payload) {
  if (!payload || !Array.isArray(payload.locations)) return false;

  const cfg = (window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {});
  cfg.categoryMap    = cfg.categoryMap    || {};
  cfg.descriptionMap = cfg.descriptionMap || {};
  cfg.imageMap       = cfg.imageMap       || {};
  cfg.happensHereMap = cfg.happensHereMap || {};
  cfg.departmentMap  = cfg.departmentMap  || {};
  cfg.addressMap     = cfg.addressMap     || {};
  cfg.explorableMap  = cfg.explorableMap  || {};

  for (const loc of payload.locations) {
    if (!loc || !loc.key) continue;
    const k = String(loc.key).toLowerCase();

    if (typeof loc.category === "string")    cfg.categoryMap[k]    = loc.category;
    if (typeof loc.description === "string") cfg.descriptionMap[k] = loc.description;
    if (typeof loc.image === "string")       cfg.imageMap[k]       = loc.image;
    if (typeof loc.address === "string")     cfg.addressMap[k]     = loc.address;

    if (Array.isArray(loc.happensHere)) cfg.happensHereMap[k] = loc.happensHere;
    if (Array.isArray(loc.departments)) cfg.departmentMap[k]  = loc.departments;
    if (Array.isArray(loc.explorable))  cfg.explorableMap[k]  = loc.explorable;
  }
  return true;
}

/* Flatten treedis-sweeps.json into per-profile maps (desktop / vr).
   parentName is stored once per sweep document and re-injected into
   each profile entry, matching the shape the lookup code expects. */
function applyTreedisSweepsJSON(payload) {
  if (!payload || !Array.isArray(payload.sweeps)) return false;

  const cfg = (window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {});
  const desktop = {};
  const vr      = {};

  for (const s of payload.sweeps) {
    if (!s || !s.key) continue;
    const k = String(s.key).toLowerCase();

    if (s.desktop) desktop[k] = mergeParentName(s.desktop, s.parentName);
    if (s.vr)      vr[k]      = mergeParentName(s.vr,      s.parentName);
  }

  cfg.treedisMaps = { desktop, vr };

  // Default the active-map alias to desktop; the boot sequence calls
  // applyTreedisProfile() again after loading and repoints it to the
  // VR map when a headset is detected.
  cfg.treedisMap = desktop;
  return true;
}

/* Attach parentName to a profile entry and drop null/undefined keys,
   keeping entries identical in shape to the legacy shim data. */
function mergeParentName(profileEntry, parentName) {
  const out = {};
  for (const k of Object.keys(profileEntry || {})) {
    const v = profileEntry[k];

    // Keep sweepId even when null — a null sweepId is a meaningful
    // placeholder state that other code checks explicitly.
    if (k === "sweepId") { out[k] = v; continue; }
    if (v != null) out[k] = v;
  }
  if (parentName) out.parentName = parentName;
  return out;
}

/* Courses live under window.SCSU_DATA.courses, where the Learn-mode
   module reads them. The JSON shape matches the legacy array. */
function applyCoursesJSON(payload) {
  if (!payload || !Array.isArray(payload.courses)) return false;
  window.SCSU_DATA = window.SCSU_DATA || {};
  window.SCSU_DATA.courses = payload.courses;
  return true;
}

/* Fetch the three content files in parallel; each one silently falls
   back to whatever the legacy shim scripts already populated. Returns
   a report of which source was used per file (useful when debugging
   file:// vs http loads). File paths come from config.dataFiles. */
async function loadDataJSON() {
  const cfg = window.CAMPUS_CONFIG || {};
  const files = cfg.dataFiles || {};

  const [locP, sweepsP, coursesP] = await Promise.all([
    tryFetchJSON(files.locations     || "data/locations.json"),
    tryFetchJSON(files.treedisSweeps || "data/treedis-sweeps.json"),
    tryFetchJSON(files.courses       || "data/courses.json")
  ]);

  const report = {
    locations: locP     ? "json" : "shim",
    sweeps:    sweepsP  ? "json" : "shim",
    courses:   coursesP ? "json" : "shim"
  };

  if (locP)     applyLocationsJSON(locP);
  if (sweepsP)  applyTreedisSweepsJSON(sweepsP);
  if (coursesP) applyCoursesJSON(coursesP);

  // Re-apply the active Treedis profile so treedisMap and the
  // treedis.modelId/tourUrl aliases reflect the freshly fetched data.
  // No-op if the profile helpers haven't loaded yet.
  try {
    if (typeof applyTreedisProfile === "function" &&
        typeof activeTreedisProfile === "string") {
      applyTreedisProfile(activeTreedisProfile);
    }
  } catch (_) {  }

  return report;
}
