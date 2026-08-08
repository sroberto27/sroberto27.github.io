// DTS migration — Phase 3 step 7: backfill initial `access` levels into /data.
// Per docs/migration/ACCESS-MODEL.md §5 and §6 of the reconciliation plan.
//
// Defaults to a DRY RUN that only prints what would change. Nothing is
// written to disk unless run with --apply.
//
//   node scripts/backfill-access.mjs           # print the plan, write nothing
//   node scripts/backfill-access.mjs --apply   # actually write the files

import { readFile, writeFile } from "node:fs/promises";

const apply = process.argv.includes("--apply");
const root = new URL("../", import.meta.url);

async function readJson(relPath) {
  return JSON.parse(await readFile(new URL(relPath, root), "utf8"));
}
async function writeJson(relPath, data) {
  await writeFile(new URL(relPath, root), JSON.stringify(data, null, 2) + "\n", "utf8");
}

const manifest = await readJson("data/manifest.json");
// manifest paths are relative to data/ (e.g. "projects/campus.json"), so
// normalize to match the "data/projects/<file>.json" paths used below.
const registeredProjectFiles = new Set(manifest.documents.projects.map((p) => `data/${p.file}`));

const changes = [];

// 1. Homepage tour — public by design (nothing currently gates it; this is a
// documentation/CMS-editability field, not a functional change).
{
  const rel = "data/site/settings.json";
  const doc = await readJson(rel);
  if (doc.treedis && doc.treedis.access !== "public") {
    doc.treedis.access = "public";
    changes.push({ file: rel, doc, note: "treedis.access = 'public'" });
  }
}

// 2. Every project's experiences/media/links.
const fs = await import("node:fs/promises");
const projectFiles = (await fs.readdir(new URL("data/projects/", root))).sort();

for (const file of projectFiles) {
  const rel = `data/projects/${file}`;
  const isRegistered = registeredProjectFiles.has(rel);
  const doc = await readJson(rel);
  const notes = [];

  if (Array.isArray(doc.experiences) && doc.experiences.length) {
    for (const exp of doc.experiences) {
      if (exp.access !== "registered") {
        exp.access = "registered";
        notes.push(`experiences[id=${exp.id}].access = 'registered'`);
      }
    }
  } else if (doc.media) {
    if (doc.media.access !== "registered") {
      doc.media.access = "registered";
      notes.push(`media.access = 'registered'`);
    }
  }
  // heritage.json / emergency.json: neither experiences nor media -> nothing
  // to do here, left untouched, matches the plan exactly.

  if (Array.isArray(doc.links)) {
    doc.links.forEach((link, i) => {
      if (link.kind === "treedis" && link.access !== "registered") {
        link.access = "registered";
        notes.push(`links[${i}].access = 'registered' (${link.label})`);
      }
    });
  }

  if (notes.length) {
    changes.push({ file: rel, doc, note: notes.join(", "), unregistered: !isRegistered });
  } else if (!isRegistered) {
    // emergency.json specifically: on disk, has content, but not touched
    // because it has no experience/media/links to gate anyway. Still worth
    // surfacing its manifest status regardless.
    changes.push({ file: rel, doc: null, note: "NO CHANGE NEEDED, but flagged below", unregistered: true });
  }
}

console.log(`Plan: ${changes.filter((c) => c.doc).length} file(s) would change.\n`);
for (const c of changes) {
  if (!c.doc) continue;
  console.log(`${c.file}${c.unregistered ? "  [NOT IN data/manifest.json]" : ""}`);
  console.log(`  ${c.note}`);
}

const unregisteredFlag = changes.find((c) => c.unregistered);
if (registeredProjectFiles.has("data/projects/emergency.json") === false) {
  console.log("\n" + "=".repeat(70));
  console.log("FLAG: data/projects/emergency.json exists on disk but is NOT");
  console.log("registered in data/manifest.json. This script does not add it to");
  console.log("the manifest -- that's a content decision for the user, not this");
  console.log("script. It has no experience/media to gate either way, so this");
  console.log("backfill doesn't need to touch it regardless of that decision.");
  console.log("=".repeat(70));
}

if (!apply) {
  console.log("\nDRY RUN -- nothing written. Re-run with --apply once this looks correct.");
  process.exit(0);
}

console.log("\n--apply passed. Writing changes...");
for (const c of changes) {
  if (!c.doc) continue;
  await writeJson(c.file, c.doc);
  console.log(`  wrote ${c.file}`);
}
console.log("Done.");
