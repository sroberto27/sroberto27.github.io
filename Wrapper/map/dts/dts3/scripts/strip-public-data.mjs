// DTS migration — strips gated navigable targets from a deploy staging
// directory before it goes public. Phase 6 formalizes this into a proper
// split-content.mjs (data/current vs data/source in R2); this is the
// pre-Phase-6 version Phase 4 needs so its gate is actually meaningful.
// See docs/migration/ACCESS-MODEL.md §5.
//
//   node scripts/strip-public-data.mjs --dir=<staging-directory>

import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import vm from "node:vm";

const dirArg = process.argv.find((a) => a.startsWith("--dir="));
if (!dirArg) {
  console.error("Usage: node scripts/strip-public-data.mjs --dir=<staging-directory>");
  process.exit(1);
}
const stageRoot = new URL("file:///" + dirArg.slice("--dir=".length).replace(/\\/g, "/").replace(/^\/+/, "") + "/");

async function readJson(rel) {
  return JSON.parse(await readFile(new URL(rel, stageRoot), "utf8"));
}
async function writeJson(rel, data) {
  await writeFile(new URL(rel, stageRoot), JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ACCESS-MODEL.md §5 resolution: own access (unless absent/"inherit") wins;
// else the project's own access; else "registered" as the default for
// experiences/links (NOT "public" -- only the project's descriptive content
// defaults to public).
function resolve(ownAccess, projectAccess) {
  if (ownAccess && ownAccess !== "inherit") return ownAccess;
  if (projectAccess) return projectAccess;
  return "registered";
}

let strippedCount = 0;

// 1. Project documents.
const projectFiles = await readdir(new URL("data/projects/", stageRoot));
for (const file of projectFiles) {
  const rel = `data/projects/${file}`;
  const doc = await readJson(rel);
  let changed = false;

  // Raw /data field names differ from the DTS_CONFIG shape convertExperience()
  // produces: treedis uses a flat `tourUrl` string, but video uses NESTED
  // `embed`/`watch` source objects ({kind, value}) -- confirmed by reading
  // content-loader.js's convertExperience() AND a real raw video document
  // (civic.json) directly, not assumed from the converted shape.
  function stripTarget(m) {
    let did = false;
    if (m.tourUrl) { delete m.tourUrl; did = true; }
    if (m.embed) { delete m.embed; did = true; }
    if (m.watch) { delete m.watch; did = true; }
    if (m.mapId) { delete m.mapId; did = true; }
    if (m.tourId) { delete m.tourId; did = true; }
    return did;
  }

  if (Array.isArray(doc.experiences)) {
    for (const exp of doc.experiences) {
      if (resolve(exp.access, doc.access) === "public") continue;
      if (stripTarget(exp)) changed = true;
    }
  } else if (doc.media) {
    if (resolve(doc.media.access, doc.access) !== "public") {
      if (stripTarget(doc.media)) changed = true;
    }
  }

  if (Array.isArray(doc.links)) {
    for (const link of doc.links) {
      if (link.kind === "treedis" && resolve(link.access, doc.access) !== "public") {
        if (link.url) { delete link.url; changed = true; }
      }
    }
  }

  if (changed) {
    await writeJson(rel, doc);
    strippedCount++;
  }
}

// 2. GIS documents + local layer files -- whole-document withhold, not
// field-level (ACCESS-MODEL.md §5's "whole-document exception").
// iberia-coastal is `registered` per the Phase 3 backfill; nothing in this
// dataset is a public GIS map, so all of it is withheld from the public
// deploy entirely.
let gisRemoved = 0;
for (const dir of ["data/gis/maps", "data/gis/tours", "data/gis/featuretours", "data/gis/layers"]) {
  const target = new URL(dir + "/", stageRoot);
  try {
    const files = await readdir(target);
    await rm(target, { recursive: true, force: true });
    gisRemoved += files.length;
  } catch (_) { /* directory may not exist in this staging copy -- fine */ }
}

// 3. js/config.js -- the /data-unreachable fallback. A first attempt at
// this used regex string-matching and shipped a real bug: it matched a
// PROPERTIES project's tourUrl that happened to share the same tour ID
// string as the public homepage tour, and "protected" it by mistake --
// caught by checking the actual output, not by trusting the regex. Fixed
// by operating on the real parsed object graph instead (via vm), so a
// field is identified by its STRUCTURAL position (cfg.treedis.tourUrl vs.
// cfg.examples.<id>.media.tourUrl), never by matching string content.
{
  const rel = "js/config.js";
  const src = await readFile(new URL(rel, stageRoot), "utf8");

  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: rel });
  const cfg = sandbox.window.DTS_CONFIG;
  if (!cfg) throw new Error(`${rel}: window.DTS_CONFIG was not defined after evaluating the file`);

  // cfg.treedis.tourUrl is the public homepage tour -- untouched by design.
  for (const ex of Object.values(cfg.examples || {})) {
    if (ex.media) {
      delete ex.media.tourUrl;
      delete ex.media.embedUrl;
      delete ex.media.watchUrl;
    }
    for (const link of ex.links || []) {
      if (typeof link.url === "string" && link.url.startsWith("https://spaces.dtsxr.com")) {
        delete link.url;
      }
    }
  }
  if (cfg.gisMaps && Object.keys(cfg.gisMaps).length) {
    throw new Error(`${rel}: cfg.gisMaps is no longer empty -- the strip script needs a GIS-stripping branch here, it currently assumes there's nothing to strip because there was nothing when this was written.`);
  }

  const out = `window.DTS_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
  await writeFile(new URL(rel, stageRoot), out, "utf8");
  strippedCount++;
}

console.log(`Stripped navigable targets in ${strippedCount} file(s).`);
console.log(`Removed ${gisRemoved} GIS document/layer file(s) from the public deploy entirely.`);
