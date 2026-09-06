// PASS means: no link whose resolved access level is above `public` still
// carries its `url` in the public copy -- and every link that IS public still
// does. A failed "denied" assertion means gated link URLs are being published
// to anonymous visitors again (F-01). A failed "allowed" assertion means the
// strip has become too aggressive and public links lost their URLs.
//
// Two modes:
//
//   node tests/security/probe-f01-link-access-strip.mjs
//       Local. Runs the REAL shared splitter (functions/_lib/split-logic.js --
//       the same module functions/api/publish.js imports) over the REAL
//       data/projects/*.json. This is the authoritative check: it tests the
//       code that will run at the next publish.
//
//   node tests/security/probe-f01-link-access-strip.mjs --deployed
//       Fetches the published documents from the live target anonymously.
//       NOTE: this reflects the LAST PUBLISH, not the working tree. It stays
//       red after the code fix until someone actually runs "Publish to site".
//       That gap is the point of having both modes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { begin, report, expectDenied, expectAllowed, req, TARGET } from "./_harness.mjs";
import { splitProjectDoc, resolveAccessLevel } from "../../functions/_lib/split-logic.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..", "..");
const DEPLOYED = process.argv.includes("--deployed");

begin(`F-01 -- gated link URLs must not ship in the public copy (${DEPLOYED ? "deployed" : "local splitter"})`);

/* The harness asserts on HTTP-response shapes, so local findings are wrapped
   in the same shape: an EMPTY json array reads as "denied / nothing leaked",
   a populated one reads as "returned data" and fails. Same semantics as a
   PostgREST query that should have matched no rows. */
function asResponse(rows) {
  return { status: 200, headers: {}, body: JSON.stringify(rows), json: rows };
}

/** Every link in `doc` whose resolved level is above `public`. */
function gatedLinks(doc) {
  return (doc.links || []).map((link, i) => ({
    id: `link-${i + 1}`,
    kind: link.kind,
    level: resolveAccessLevel(link.access, doc.access),
    link,
  })).filter((l) => l.level !== "public");
}

function publicLinks(doc) {
  return (doc.links || []).map((link, i) => ({
    id: `link-${i + 1}`,
    kind: link.kind,
    level: resolveAccessLevel(link.access, doc.access),
    link,
  })).filter((l) => l.level === "public");
}

async function loadDocs() {
  if (!DEPLOYED) {
    const dir = path.join(PROJECT_ROOT, "data", "projects");
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ file: `projects/${f}`, doc: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
  }
  // Deployed: the manifest lists what is actually present in data/current/.
  const manifest = await req(`${TARGET}/data/manifest.json`);
  if (manifest.status !== 200 || !manifest.json) {
    throw new Error(`could not read the published manifest: HTTP ${manifest.status}`);
  }
  const entries = Object.values(manifest.json.documents || {})
    .flat()
    .filter((e) => e.type === "project");
  const docs = [];
  for (const e of entries) {
    const r = await req(`${TARGET}/data/${e.file}`);
    if (r.status === 200 && r.json) docs.push({ file: e.file, doc: r.json });
  }
  if (!docs.length) throw new Error("no published project documents were readable");
  return docs;
}

const docs = await loadDocs();

/* ---- the exploit: a gated link that still carries its url ---------------- */

const leaked = [];
const keptPublic = [];

for (const { file, doc } of docs) {
  /* Local mode splits the raw document exactly as publish.js would; deployed
     mode already IS the split copy, so it is inspected as-is. */
  const current = DEPLOYED ? doc : splitProjectDoc(doc).current;

  for (const g of gatedLinks(doc)) {
    const publishedLink = (current.links || [])[parseInt(g.id.slice("link-".length), 10) - 1];
    if (publishedLink && publishedLink.url) {
      leaked.push({ file, link: g.id, kind: g.kind, level: g.level, url: publishedLink.url });
    }
  }
  for (const p of publicLinks(doc)) {
    const publishedLink = (current.links || [])[parseInt(p.id.slice("link-".length), 10) - 1];
    if (publishedLink && publishedLink.url) {
      keptPublic.push({ file, link: p.id, kind: p.kind });
    }
  }
}

console.log(`  inspected ${docs.length} project document(s)`);
console.log(`  gated links leaking a url : ${leaked.length}`);
console.log(`  public links keeping a url: ${keptPublic.length}\n`);

expectDenied(
  "no link above `public` keeps its url in the public copy",
  asResponse(leaked)
);

/* ---- the companion: public links must still work ------------------------- */

expectAllowed(
  "links resolved as `public` still carry their url",
  asResponse(keptPublic)
);

/* ---- deployed-only: the gate itself is still a real gate ----------------- */

if (DEPLOYED) {
  // A Treedis link that has always been correctly stripped -- proves the
  // resolver still refuses an anonymous caller rather than the whole gating
  // layer having been switched off.
  expectDenied(
    "anonymous resolve of a gated Treedis link is still refused",
    await req(`${TARGET}/api/resource/project.campus%3Alink-1`)
  );
}

report();
