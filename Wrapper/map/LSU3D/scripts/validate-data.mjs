/* validate-data.mjs — check every file under data/ against the
   contract in docs/DATA-SCHEMA.md.
   ------------------------------------------------------------------
   Run it by hand after editing anything in data/:

       node scripts/validate-data.mjs

   This is NOT a build step and it is not wired into anything. The app
   has no build, and it is deliberately tolerant at runtime: it skips
   malformed content rather than failing to load. That tolerance is
   the right behaviour in front of a recruit and the wrong behaviour
   for an editor, who needs to be told immediately that a stop key is
   misspelled. This script is that second half.

   Exit code 0 = clean (warnings allowed), 1 = at least one error.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

const errors = [];
const warnings = [];

const err  = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function readJSON(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return { missing: true };
  try {
    return { data: JSON.parse(fs.readFileSync(abs, "utf8")) };
  } catch (e) {
    err(rel, `not valid JSON — ${e.message}`);
    return { broken: true };
  }
}

/* Must stay byte-identical in behaviour to slugify() in
   js/17-router.js. If these two drift, printed QR codes stop
   resolving — which is exactly the failure you cannot fix later. */
function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------- data/tours.geojson ---------------------------------- */

const stopKeys = new Set();
const stopNames = new Map();

{
  const rel = "data/tours.geojson";
  const { data, missing, broken } = readJSON(rel);
  if (missing) err(rel, "file not found");
  else if (!broken) {
    const feats = Array.isArray(data.features) ? data.features : [];
    if (!feats.length) err(rel, "no features");

    const orders = new Set();
    for (const [i, f] of feats.entries()) {
      const at = `feature[${i}]`;
      const p = f.properties || {};

      if (!p.name) { err(rel, `${at} has no name`); continue; }

      if (!p.stop_key) {
        err(rel, `${at} "${p.name}" is missing stop_key (expected "${slugify(p.name)}")`);
      } else {
        if (p.stop_key !== slugify(p.name)) {
          // Not fatal: a stop may be renamed while its key is
          // deliberately frozen because QR codes already exist.
          warn(rel, `${at} stop_key "${p.stop_key}" does not match its name ` +
                    `(slug of name is "${slugify(p.name)}") — intentional only if codes are already printed`);
        }
        if (stopKeys.has(p.stop_key)) err(rel, `${at} duplicate stop_key "${p.stop_key}"`);
        stopKeys.add(p.stop_key);
        stopNames.set(p.stop_key, p.name);
      }

      if (!Number.isInteger(p.order_num)) err(rel, `${at} order_num must be an integer`);
      else if (orders.has(p.order_num)) err(rel, `${at} duplicate order_num ${p.order_num}`);
      else orders.add(p.order_num);

      if (!p.tour_group) warn(rel, `${at} has no tour_group`);
      if (f.geometry?.type !== "Polygon") err(rel, `${at} geometry must be a Polygon`);

      // [lng, lat] order is the classic bug here — a swapped pair
      // puts LSU in the Indian Ocean, so check the ranges.
      const ring = f.geometry?.coordinates?.[0] || [];
      for (const [lng, lat] of ring) {
        if (!(lng >= -180 && lng <= 180) || !(lat >= -90 && lat <= 90)) {
          err(rel, `${at} coordinate out of range: [${lng}, ${lat}]`);
          break;
        }
        if (lng > 0 && lat < 0) {
          err(rel, `${at} coordinates look like [lat, lng] — this file is [lng, lat]`);
          break;
        }
      }
    }
  }
}

/* ---------- data/locations.json --------------------------------- */

{
  const rel = "data/locations.json";
  const { data, missing, broken } = readJSON(rel);
  if (missing) err(rel, "file not found");
  else if (!broken) {
    const locs = Array.isArray(data.locations) ? data.locations : null;
    if (!locs) err(rel, "expected a `locations` array");
    else {
      const seen = new Set();
      for (const [i, l] of locs.entries()) {
        const at = `locations[${i}]`;
        if (!l.key)  { err(rel, `${at} has no key`); continue; }
        if (!l.name)   err(rel, `${at} has no name`);
        if (seen.has(l.key)) err(rel, `${at} duplicate key "${l.key}"`);
        seen.add(l.key);

        // The join to tours.geojson is the lowercased name.
        if (l.name && l.key !== String(l.name).toLowerCase()) {
          err(rel, `${at} key "${l.key}" must be the lowercased name ("${String(l.name).toLowerCase()}")`);
        }
        if (l.category && !["ROUTE", "FACILITY"].includes(l.category)) {
          warn(rel, `${at} unexpected category "${l.category}"`);
        }
        for (const field of ["happensHere", "departments", "explorable"]) {
          if (field in l && !Array.isArray(l[field])) {
            err(rel, `${at} ${field} must be an array`);
          }
        }
      }

      // Every tour stop should have copy; a stop without it shows an
      // empty details panel, which looks broken rather than sparse.
      for (const key of stopKeys) {
        const name = stopNames.get(key);
        if (name && !locs.some((l) => l.key === String(name).toLowerCase())) {
          warn(rel, `no entry for tour stop "${name}" — its details panel will be empty`);
        }
      }
    }
  }
}

/* ---------- data/treedis-sweeps.json ---------------------------- */

{
  const rel = "data/treedis-sweeps.json";
  const { data, missing, broken } = readJSON(rel);
  if (missing) warn(rel, "file not found — the Explore CTA will be hidden everywhere");
  else if (!broken) {
    const sweeps = Array.isArray(data.sweeps) ? data.sweeps : null;
    if (!sweeps) err(rel, "expected a `sweeps` array");
    else for (const [i, s] of sweeps.entries()) {
      if (!s.key) err(rel, `sweeps[${i}] has no key`);
      for (const profile of ["desktop", "vr"]) {
        if (s[profile] && !("sweepId" in s[profile])) {
          err(rel, `sweeps[${i}].${profile} must carry a sweepId (null is valid)`);
        }
      }
    }
  }
}

/* ---------- data/gamedays/ -------------------------------------- */

{
  const dir = path.join(DATA, "gamedays");
  if (!fs.existsSync(dir)) {
    warn("data/gamedays/", "directory not found — ?g= links will not resolve");
  } else {
    const indexRel = "data/gamedays/index.json";
    const { data: index, missing } = readJSON(indexRel);
    const listed = new Set();

    if (missing) warn(indexRel, "file not found");
    else if (Array.isArray(index?.gamedays)) {
      for (const [i, g] of index.gamedays.entries()) {
        if (!g.id) { err(indexRel, `gamedays[${i}] has no id`); continue; }
        listed.add(g.id);
        if (!fs.existsSync(path.join(dir, `${g.id}.json`))) {
          err(indexRel, `gamedays[${i}] "${g.id}" has no matching ${g.id}.json`);
        }
      }
    } else err(indexRel, "expected a `gamedays` array");

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");
    for (const file of files) {
      const rel = `data/gamedays/${file}`;
      const id = file.replace(/\.json$/, "");
      if (!listed.has(id)) warn(rel, `not listed in index.json`);

      const { data: g, broken } = readJSON(rel);
      if (broken) continue;

      if (g.id !== id) err(rel, `id "${g.id}" does not match the filename "${id}"`);
      if (!g.timezone) err(rel, "timezone is required (e.g. America/Chicago)");
      if (g.kickoff && !/[+-]\d{2}:\d{2}$|Z$/.test(g.kickoff)) {
        err(rel, `kickoff "${g.kickoff}" needs an explicit UTC offset`);
      }

      // The privacy rule that actually matters: everything under
      // data/ is served publicly and kept in git forever.
      for (const [i, c] of (g.contacts || []).entries()) {
        if (!c.role) err(rel, `contacts[${i}] must have a role`);
        if (c.name)  err(rel, `contacts[${i}] must not carry a person's name — this file is public`);
        if (c.email) err(rel, `contacts[${i}] must not carry an email address — this file is public`);
        if (c.phone && !/^[\d\s()+.-]{7,}$/.test(c.phone)) {
          warn(rel, `contacts[${i}] phone "${c.phone}" does not look like a phone number`);
        }
      }

      if (!Array.isArray(g.stops)) { err(rel, "expected a `stops` array"); continue; }

      const seen = new Set();
      for (const [i, s] of g.stops.entries()) {
        const at = `stops[${i}]`;
        if (!s.stopKey) { err(rel, `${at} has no stopKey`); continue; }
        if (stopKeys.size && !stopKeys.has(s.stopKey)) {
          err(rel, `${at} stopKey "${s.stopKey}" matches no stop in tours.geojson`);
        }
        if (seen.has(s.stopKey)) err(rel, `${at} duplicate stopKey "${s.stopKey}"`);
        seen.add(s.stopKey);

        for (const field of ["arrive", "depart"]) {
          if (s[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s[field])) {
            err(rel, `${at} ${field} "${s[field]}" must be 24-hour HH:MM`);
          }
        }
        if (s.arrive && s.depart && s.depart < s.arrive && s.arrive < "22:00") {
          warn(rel, `${at} departs (${s.depart}) before it arrives (${s.arrive})`);
        }
      }

      for (const key of stopKeys) {
        if (!seen.has(key)) warn(rel, `no time given for stop "${key}"`);
      }
    }
  }
}

/* ---------- report ---------------------------------------------- */

for (const w of warnings) console.log(`WARN   ${w}`);
for (const e of errors)   console.log(`ERROR  ${e}`);

console.log(
  `\n${errors.length} error(s), ${warnings.length} warning(s)` +
  (errors.length ? "" : " — data is valid.")
);

process.exit(errors.length ? 1 : 0);
