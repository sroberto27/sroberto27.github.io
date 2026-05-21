/* ============================================================
   SCSU METAVERSITY — shim regenerator (JSON → .js)
   ------------------------------------------------------------
   Reads the canonical data/*.json files and writes refreshed
   data/*.js shims that mirror their content. The shims are
   used as the file:// fallback (when fetch() can't reach the
   JSON files) so they must stay in sync with the JSON. This
   script is the synchronization tool.

   When to run:
     - After editing JSON by hand
     - As part of any future CMS-export pipeline that writes
       fresh JSON: run this immediately after, commit both
     - On any CI step that touches data/*.json

   It does NOT preserve the editorial comments from the
   original hand-edited locations.js (Sheet entry numbers,
   TODO notes, etc.) — those have been migrated into
   per-document `notes` fields in the JSON, and editors see
   them in the CMS instead. The shim is now just a mechanical
   serialization of the JSON for the rare file:// case.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.resolve(ROOT, "data");

regenLocations();
regenSweeps();
regenCourses();

console.log("Regenerated shims from JSON.");

/* =========================================================== */

function regenLocations() {
  const j = readJSON(path.join(DATA, "locations.json"));
  const locs = j.locations || [];

  const maps = {
    categoryMap:    {},
    descriptionMap: {},
    imageMap:       {},
    happensHereMap: {},
    departmentMap:  {},
    addressMap:     {},
    explorableMap:  {}
  };
  const FIELD_TO_MAP = {
    category:    "categoryMap",
    description: "descriptionMap",
    image:       "imageMap",
    happensHere: "happensHereMap",
    departments: "departmentMap",
    address:     "addressMap",
    explorable:  "explorableMap"
  };
  for (const loc of locs) {
    const k = loc.key;
    if (!k) continue;
    for (const [field, mapName] of Object.entries(FIELD_TO_MAP)) {
      if (Object.prototype.hasOwnProperty.call(loc, field)) {
        maps[mapName][k] = loc[field];
      }
    }
  }

  const lines = [
    "/* ============================================================",
    "   SCSU METAVERSITY — Per-location content (FALLBACK SHIM)",
    "   ------------------------------------------------------------",
    "   AUTO-GENERATED from data/locations.json by scripts/regen-shims.js.",
    "   Do NOT edit by hand — edit the JSON and re-run the script.",
    "   This file is the file:// fallback; in production the adapter",
    "   in js/00-data-adapter.js fetches the JSON and overwrites it.",
    "   ============================================================ */",
    "window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};",
    "",
    `window.CAMPUS_CONFIG.categoryMap    = ${js(maps.categoryMap)};`,
    `window.CAMPUS_CONFIG.descriptionMap = ${js(maps.descriptionMap)};`,
    `window.CAMPUS_CONFIG.imageMap       = ${js(maps.imageMap)};`,
    `window.CAMPUS_CONFIG.happensHereMap = ${js(maps.happensHereMap)};`,
    `window.CAMPUS_CONFIG.departmentMap  = ${js(maps.departmentMap)};`,
    `window.CAMPUS_CONFIG.addressMap     = ${js(maps.addressMap)};`,
    `window.CAMPUS_CONFIG.explorableMap  = ${js(maps.explorableMap)};`,
    ""
  ];
  write(path.join(ROOT, "locations.js"), lines.join("\n"));
}

function regenSweeps() {
  const j = readJSON(path.join(DATA, "treedis-sweeps.json"));
  const sweeps = j.sweeps || [];

  const desktop = {};
  const vr = {};
  for (const s of sweeps) {
    if (!s.key) continue;
    if (s.desktop) desktop[s.key] = withParent(s.desktop, s.parentName);
    if (s.vr)      vr[s.key]      = withParent(s.vr,      s.parentName);
  }

  const lines = [
    "/* ============================================================",
    "   SCSU METAVERSITY — Treedis sweep map (FALLBACK SHIM)",
    "   ------------------------------------------------------------",
    "   AUTO-GENERATED from data/treedis-sweeps.json by scripts/regen-shims.js.",
    "   Do NOT edit by hand — edit the JSON and re-run the script.",
    "   ============================================================ */",
    "window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};",
    "",
    `const TREEDIS_MAP_DESKTOP = ${js(desktop)};`,
    "",
    `const TREEDIS_MAP_VR = ${js(vr)};`,
    "",
    "window.CAMPUS_CONFIG.treedisMaps = {",
    "  desktop: TREEDIS_MAP_DESKTOP,",
    "  vr:      TREEDIS_MAP_VR",
    "};",
    "window.CAMPUS_CONFIG.treedisMap = TREEDIS_MAP_DESKTOP;",
    ""
  ];
  write(path.join(ROOT, "treedis-sweeps.js"), lines.join("\n"));
}

function regenCourses() {
  const j = readJSON(path.join(DATA, "courses.json"));
  const courses = j.courses || [];

  const lines = [
    "/* ============================================================",
    "   SCSU METAVERSITY — Course catalog (FALLBACK SHIM)",
    "   ------------------------------------------------------------",
    "   AUTO-GENERATED from data/courses.json by scripts/regen-shims.js.",
    "   Do NOT edit by hand — edit the JSON and re-run the script.",
    "   ============================================================ */",
    "window.SCSU_DATA = window.SCSU_DATA || {};",
    "",
    `window.SCSU_DATA.courses = ${js(courses)};`,
    ""
  ];
  write(path.join(ROOT, "courses.js"), lines.join("\n"));
}

/* Inject parentName into a per-profile sweep entry while
   preserving the {sweepId, parentName, transitionTime,
   rotation} shape the legacy file used. Drops null/undefined
   keys (except sweepId, which is preserved for null
   placeholder entries). */
function withParent(entry, parentName) {
  const out = {};
  if (entry.sweepId !== undefined) out.sweepId = entry.sweepId;
  if (parentName)                  out.parentName = parentName;
  if (entry.transitionTime != null) out.transitionTime = entry.transitionTime;
  if (entry.rotation != null)       out.rotation = entry.rotation;
  return out;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
  console.log(" wrote", path.relative(ROOT, file));
}

/* Pretty-print a JS literal. Uses 2-space indent, double
   quotes for keys and string values, and trailing commas
   stripped (so the output parses as both JS and as input
   to a JSON.parse-friendly subset). */
function js(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);

  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // Arrays of primitives stay on one line if they fit; objects
    // and arrays of strings expand vertically for readability.
    const items = value.map((v) => js(v, indent + 1));
    const oneLine = "[" + items.join(", ") + "]";
    if (oneLine.length < 80 && items.every((s) => !s.includes("\n"))) {
      return oneLine;
    }
    return "[\n" + items.map((s) => pad1 + s).join(",\n") + "\n" + pad + "]";
  }

  // Object
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  const entries = keys.map((k) => `${JSON.stringify(k)}: ${js(value[k], indent + 1)}`);
  return "{\n" + entries.map((s) => pad1 + s).join(",\n") + "\n" + pad + "}";
}
