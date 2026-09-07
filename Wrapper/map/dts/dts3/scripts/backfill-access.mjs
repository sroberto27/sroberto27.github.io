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
// manifest paths are relative to data/ (e.g. "projects/brcc.json"), so
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

  // BACKFILL ONLY: fill in a MISSING access level, never overwrite an
  // authored one. The original Phase 3 version assigned `registered`
  // unconditionally, which was correct exactly once -- when no node in /data
  // carried the field yet. It is not correct now: every project authored in
  // the September 2026 content migration marks its public showcase video
  // `"access": "public"` deliberately (that is what lets a visitor watch it
  // without signing in, per each content form's "Requires sign-in? No"), and
  // an unconditional rewrite would silently gate all eight of them. A backfill
  // that clobbers real editorial decisions is a downgrade, not a migration.
  const needsBackfill = (node) => node.access === undefined || node.access === null || node.access === "";

  if (Array.isArray(doc.experiences) && doc.experiences.length) {
    for (const exp of doc.experiences) {
      if (needsBackfill(exp)) {
        exp.access = "registered";
        notes.push(`experiences[id=${exp.id}].access = 'registered' (was unset)`);
      }
    }
  } else if (doc.media) {
    if (needsBackfill(doc.media)) {
      doc.media.access = "registered";
      notes.push(`media.access = 'registered' (was unset)`);
    }
  }
  // A project with neither experiences nor media -> nothing to do here, left
  // untouched. (heritage.json / emergency.json were the two such documents
  // when this ran in Phase 4; both were removed in the September 2026 content
  // migration, and every surviving project carries experiences[].)

  if (Array.isArray(doc.links)) {
    doc.links.forEach((link, i) => {
      // Same backfill-only rule as above. The `kind === "treedis"` test is
      // kept because that is what this one-shot script was scoped to, but the
      // real enforcement is access-level-based and lives in
      // functions/_lib/split-logic.js -- see SECURITY-AUDIT-2026-09-06.md F-01.
      if (link.kind === "treedis" && needsBackfill(link)) {
        link.access = "registered";
        notes.push(`links[${i}].access = 'registered' (${link.label}, was unset)`);
      }
    });
  }

  if (notes.length) {
    changes.push({ file: rel, doc, note: notes.join(", "), unregistered: !isRegistered });
  } else if (!isRegistered) {
    // On disk with content, but nothing to gate. Still worth surfacing its
    // manifest status: an unregistered project document is invisible to the
    // site and to the Admin Board alike.
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
if (unregisteredFlag) {
  console.log("\n" + "=".repeat(70));
  console.log(`FLAG: ${unregisteredFlag.file} exists on disk but is NOT`);
  console.log("registered in data/manifest.json. This script does not add it to");
  console.log("the manifest -- that's a content decision for the user, not this");
  console.log("script, and an unregistered document never reaches the site.");
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
