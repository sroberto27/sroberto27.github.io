/* ============================================================
   SCSU METAVERSITY — data extractor
   ------------------------------------------------------------
   Loads the current data/*.js files in a sandboxed VM context
   (the same way a browser would), then serializes the result
   to JSON in the per-document shape that the new app will
   consume. Output goes to ../data/*.json.

   We don't parse the JS files — we *execute* them. That way
   we cannot drop characters, lose escape sequences, or
   misquote multi-line strings. Every byte that ends up in
   the JSON was produced by the JS interpreter itself.
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const SRC = path.resolve(__dirname, "..");
const OUT = path.resolve(__dirname, "..", "data");

fs.mkdirSync(OUT, { recursive: true });

/* -- Run the three data files in a shared sandbox --------- */
const sandbox = {
  window: {},
  console
};
vm.createContext(sandbox);

for (const file of ["locations.js", "treedis-sweeps.js", "courses.js"]) {
  const code = fs.readFileSync(path.join(SRC, file), "utf8");
  vm.runInContext(code, sandbox, { filename: file });
}

const cfg = sandbox.window.CAMPUS_CONFIG || {};
const data = sandbox.window.SCSU_DATA || {};

/* ===========================================================
   1. LOCATIONS  →  per-document JSON
   -----------------------------------------------------------
   Walk every key from every map, then for each unique key
   build one document carrying every field that key has in
   any map. The seven flat maps become one array of locations.
   =========================================================== */
const FLAT_KEYS = [
  "categoryMap",
  "descriptionMap",
  "imageMap",
  "happensHereMap",
  "departmentMap",
  "addressMap",
  "explorableMap"
];

const FIELD_FROM_MAP = {
  categoryMap:    "category",
  descriptionMap: "description",
  imageMap:       "image",
  happensHereMap: "happensHere",
  departmentMap:  "departments",
  addressMap:     "address",
  explorableMap:  "explorable"
};

// Union of every key across every map.
const allKeys = new Set();
for (const map of FLAT_KEYS) {
  const m = cfg[map] || {};
  for (const k of Object.keys(m)) allKeys.add(k);
}

// Stable display order: category alphabetically, then key.
// (Editors and the CMS don't care about order, but stable
// output makes Git diffs readable.)
const sortedKeys = Array.from(allKeys).sort((a, b) => {
  const ca = (cfg.categoryMap || {})[a] || "~";
  const cb = (cfg.categoryMap || {})[b] || "~";
  if (ca !== cb) return ca.localeCompare(cb);
  return a.localeCompare(b);
});

const locations = sortedKeys.map((key) => {
  const doc = {
    id:   slugify(key),     // stable slug for CMS document IDs
    key:  key,              // the lowercase lookup key (matches GeoJSON name)
    name: titleizeFromKey(key)  // pretty display name (editors can override)
  };
  for (const mapName of FLAT_KEYS) {
    const field = FIELD_FROM_MAP[mapName];
    const m = cfg[mapName] || {};
    if (Object.prototype.hasOwnProperty.call(m, key)) {
      doc[field] = m[key];
    }
  }
  return doc;
});

writeJSON(path.join(OUT, "locations.json"), {
  $schema: "scsu-locations-v1",
  generatedAt: new Date().toISOString().replace(/T.*/, ""),
  locations
});

/* ===========================================================
   2. TREEDIS SWEEPS  →  per-document JSON
   -----------------------------------------------------------
   Same idea: each (desktop, vr) pair becomes one sweep
   document with sub-objects for the two profiles.
   =========================================================== */
const desktopMap = (cfg.treedisMaps && cfg.treedisMaps.desktop) || {};
const vrMap      = (cfg.treedisMaps && cfg.treedisMaps.vr)      || {};

const sweepKeys = new Set([
  ...Object.keys(desktopMap),
  ...Object.keys(vrMap)
]);

const sweeps = Array.from(sweepKeys)
  .sort((a, b) => {
    // Group by parentName first (top-level entries before sub-locations
    // of the same building), then alphabetically.
    const pa = profileEntry(desktopMap[a], vrMap[a]).parentName || "";
    const pb = profileEntry(desktopMap[b], vrMap[b]).parentName || "";
    if (pa !== pb) return pa.localeCompare(pb);
    return a.localeCompare(b);
  })
  .map((key) => {
    const d = normalizeSweep(desktopMap[key]);
    const v = normalizeSweep(vrMap[key]);
    const parentName = d.parentName || v.parentName || null;
    return {
      id:         slugify(key),
      key:        key,
      name:       titleizeFromKey(key),
      parentName: parentName,
      desktop: stripParentName(d),
      vr:      stripParentName(v)
    };
  });

writeJSON(path.join(OUT, "treedis-sweeps.json"), {
  $schema: "scsu-treedis-sweeps-v1",
  generatedAt: new Date().toISOString().replace(/T.*/, ""),
  models: {
    desktop: "8e4ca3fc",
    vr:      "scsu-campus-ade0f346"
  },
  sweeps
});

/* ===========================================================
   3. COURSES  →  JSON
   -----------------------------------------------------------
   The course shape is already document-shaped — each entry
   in the array is one course. Pure format change, no shape
   change. Multi-line concatenated strings flatten naturally.
   =========================================================== */
const courses = Array.isArray(data.courses) ? data.courses : [];

writeJSON(path.join(OUT, "courses.json"), {
  $schema: "scsu-courses-v1",
  generatedAt: new Date().toISOString().replace(/T.*/, ""),
  courses
});

console.log(`Wrote ${locations.length} locations, ${sweeps.length} sweeps, ${courses.length} courses.`);

/* =========================================================== */
/* helpers                                                     */
/* =========================================================== */
function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log(" wrote", path.relative(SRC, file));
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Render a pretty display name from the lowercase lookup key.
   The CMS editor can override this — it's just a sensible
   default. We capitalize most words but lowercase common
   short connectors (of, and, the, etc.) unless they start
   the string. */
function titleizeFromKey(key) {
  const small = new Set(["of", "and", "the", "for", "in", "on", "at", "to", "a", "an"]);
  return String(key).split(/\s+/).map((w, i) => {
    if (i > 0 && small.has(w)) return w;
    // Preserve hyphenated parts: "crawford-zimmerman" → "Crawford-Zimmerman"
    return w.split("-").map(cap).join("-");
  }).join(" ");
}

function cap(s) {
  if (!s) return s;
  // Single-letter wing labels stay uppercase: "a" → "A"
  if (s.length === 1) return s.toUpperCase();
  return s[0].toUpperCase() + s.slice(1);
}

/* Normalize a raw Treedis entry (string OR object) into a
   canonical {sweepId, parentName, transitionTime, rotation}
   shape. Mirrors getTreedisEntry() in 01-utils.js. */
function normalizeSweep(raw) {
  if (raw == null) return { sweepId: null, parentName: null, transitionTime: null, rotation: null };
  if (typeof raw === "string") {
    return { sweepId: raw, parentName: null, transitionTime: null, rotation: null };
  }
  return {
    sweepId:        raw.sweepId        ?? null,
    parentName:     raw.parentName     ?? null,
    transitionTime: raw.transitionTime ?? null,
    rotation:       raw.rotation       ?? null
  };
}

/* parentName lives at the document level, not per-profile —
   it's the same in desktop and vr. Strip it from each
   profile so we don't duplicate. */
function stripParentName(entry) {
  const { parentName, ...rest } = entry;
  return rest;
}

function profileEntry(d, v) {
  return normalizeSweep(d || v);
}
