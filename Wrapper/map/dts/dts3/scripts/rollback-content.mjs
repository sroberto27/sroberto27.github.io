// DTS migration — Phase 6. Rollback drill: restores data/current/ and
// data/source/ in R2 from a snapshot functions/api/publish.js wrote to
// data/snapshots/<ISO-timestamp>.json (ONE combined object -- see
// publish.js's header for why: one-object-per-document blew the free-tier
// 50-subrequest-per-invocation ceiling).
//
// Per the phase design, a rollback re-derives data/current/ from the
// snapshot's full (source) documents via the SAME split logic every other
// path uses (scripts/split-content.mjs's splitDataTree(), shared with
// functions/api/publish.js through functions/_lib/split-logic.js) -- never
// a raw copy of whatever data/current/ happened to look like at snapshot
// time. A raw copy would either re-strip nothing (data/current/ is already
// stripped) or, worse, resurrect a stale strip if the split logic itself
// changed between the snapshot and the rollback -- re-deriving from the
// FULL source is the only version that stays correct either way.
//
// Also regenerates data/source/_hashes.json from the restored state (via
// scripts/upload-content.mjs's computeAndUploadHashManifest()) so the NEXT
// publish after a rollback diffs against the rolled-back state, not a
// stale ledger from whatever was live before the rollback.
//
//   node scripts/rollback-content.mjs --snapshot=<ISO-timestamp>

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { splitDataTree } from "./split-content.mjs";
import { uploadTree, computeAndUploadHashManifest } from "./upload-content.mjs";

const root = new URL("../", import.meta.url);
function localPath(url) {
  return url.pathname.replace(/^\/([A-Za-z]):/, "$1:");
}

const snapshotArg = process.argv.find((a) => a.startsWith("--snapshot="));
if (!snapshotArg) {
  console.error("Usage: node scripts/rollback-content.mjs --snapshot=<ISO-timestamp>");
  console.error("(the snapshotId is returned by functions/api/publish.js's response, e.g. { snapshotId: \"2026-08-08T23-40-00-000Z\" })");
  process.exit(1);
}
const snapshotId = snapshotArg.slice("--snapshot=".length);
const snapshotKey = `data/snapshots/${snapshotId}.json`;

const rawRoot = new URL(".build/rollback-raw/", root);
const currentRoot = new URL(".build/data-current/", root);
const sourceRoot = new URL(".build/data-source/", root);

console.log(`Downloading snapshot dts-content/${snapshotKey} ...`);
const snapshotFileUrl = new URL("snapshot.json", rawRoot);
await mkdir(rawRoot, { recursive: true });
execFileSync(
  "npx",
  ["--yes", "wrangler", "r2", "object", "get", `dts-content/${snapshotKey}`, "--file", localPath(snapshotFileUrl), "--remote"],
  { stdio: "pipe", shell: true }
);
const snapshot = JSON.parse(await readFile(snapshotFileUrl, "utf8"));
const { manifest, docs, layers } = snapshot;
if (!manifest || !docs) throw new Error(`snapshot ${snapshotId} is missing manifest/docs -- refusing to roll back to a malformed snapshot`);

console.log(`Snapshot has ${Object.keys(docs).length} document(s) + ${(layers || []).length} GIS layer file(s). Writing to a local raw tree...`);

async function writeRaw(rel, dataOrText) {
  const dest = new URL(rel, rawRoot);
  await mkdir(new URL("./", dest), { recursive: true });
  await writeFile(dest, dataOrText);
}

await writeRaw("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
for (const [file, doc] of Object.entries(docs)) {
  await writeRaw(file, JSON.stringify(doc, null, 2) + "\n");
}
for (const layer of layers || []) {
  await writeRaw(layer.url.replace(/^data\//, ""), layer.text);
}

console.log("Re-deriving data/current/ and data/source/ from the snapshot via the shared split logic (not a raw copy)...");
await splitDataTree(rawRoot, currentRoot, sourceRoot);

console.log("\nRe-uploading both trees to R2...");
let totalFail = 0;
totalFail += await uploadTree(currentRoot, "data/current");
totalFail += await uploadTree(sourceRoot, "data/source");

if (totalFail) {
  console.error(`\nRollback finished with ${totalFail} failed upload(s) -- R2 may be left in a mixed state. Re-run once the failures are understood.`);
  process.exit(1);
}

console.log("\nRegenerating the hash ledger from the restored state...");
await computeAndUploadHashManifest(sourceRoot);

console.log(`\nRollback to snapshot ${snapshotId} complete.`);
