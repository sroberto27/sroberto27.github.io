// DTS migration — Phase 6. Runs scripts/split-content.mjs (staging step),
// then uploads both trees to the dts-content R2 bucket:
//   .build/data-current/<relpath>  ->  data/current/<relpath>  (public)
//   .build/data-source/<relpath>   ->  data/source/<relpath>   (private)
//
// Supersedes scripts/upload-source-to-r2.mjs's narrower scope (that script
// only ever covered projects + GIS map/tours/featuretours/layers under
// data/source/, seeded early so Phase 4's resolver had something to read).
// This covers every one of the 61 documents in data/manifest.json plus the
// 6 GIS layer files, on both prefixes.
//
// Uses the same proven mechanism (`wrangler r2 object put ... --remote`)
// upload-source-to-r2.mjs already validated against this bucket.
//
//   node scripts/upload-content.mjs

import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);

function localPath(url) {
  return url.pathname.replace(/^\/([A-Za-z]):/, "$1:");
}

const CONTENT_TYPES = {
  ".json": "application/json",
  ".geojson": "application/geo+json",
};

export function contentTypeFor(rel) {
  const dot = rel.lastIndexOf(".");
  return CONTENT_TYPES[rel.slice(dot)] || "application/octet-stream";
}

async function walk(dirUrl, relPrefix, out) {
  let entries;
  try {
    entries = await readdir(dirUrl, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return; // nothing staged under this root -- fine
    throw err;
  }
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const childUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dirUrl);
    if (entry.isDirectory()) {
      await walk(childUrl, rel, out);
    } else {
      out.push(rel);
    }
  }
}

// Exported so scripts/rollback-content.mjs can reuse the exact same upload
// mechanism against its own re-derived staging trees, instead of
// duplicating the walk+put logic a second time.
export async function uploadTree(stageDirUrl, r2Prefix) {
  const files = [];
  await walk(stageDirUrl, "", files);
  console.log(`Uploading ${files.length} file(s) to dts-content/${r2Prefix}/ ...`);

  let ok = 0, fail = 0;
  for (const rel of files) {
    const key = `${r2Prefix}/${rel}`;
    const localFile = localPath(new URL(rel, stageDirUrl));
    try {
      execFileSync(
        "npx",
        ["--yes", "wrangler", "r2", "object", "put", `dts-content/${key}`,
         "--file", localFile, "--content-type", contentTypeFor(rel), "--remote"],
        { stdio: "pipe", shell: true }
      );
      ok++;
    } catch (err) {
      fail++;
      console.error(`FAILED: ${localFile} -> ${key}`);
      console.error(err.stdout?.toString() || err.message);
    }
  }
  console.log(`${ok} uploaded, ${fail} failed.`);
  return fail;
}

function sha256Hex(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

// Seeds data/source/_hashes.json so functions/api/publish.js's diff-based
// publish (see that file's header) correctly sees "nothing changed" the
// first time an admin publishes after a CLI seed/rollback, instead of
// treating all 61 documents as new.
//
// MUST hash exactly the way publish.js does at runtime: compact
// JSON.stringify() of the PARSED object for .json files (never the
// pretty-printed on-disk bytes -- those hash differently for identical
// content, which would silently defeat the whole diff), raw bytes for
// .geojson layer files (byte-identical to what fetchHarvestedLayers()
// streams through the authenticated proxy, so no normalization needed
// there). Keys are the same relpath convention manifest entries and layer
// urls already use (e.g. "projects/automotive.json",
// "gis/layers/shoreline-1935.geojson") -- walk() naturally produces this,
// so no per-document-type branching is needed here at all.
export async function computeAndUploadHashManifest(sourceDirUrl) {
  const files = [];
  await walk(sourceDirUrl, "", files);
  const hashes = {};
  for (const rel of files) {
    if (rel === "_hashes.json") continue; // never hash the ledger into itself
    const bytes = await readFile(new URL(rel, sourceDirUrl));
    const canonical = rel.endsWith(".json") ? JSON.stringify(JSON.parse(bytes.toString("utf8"))) : bytes;
    hashes[rel] = sha256Hex(canonical);
  }
  const tmpUrl = new URL("_hashes.json", sourceDirUrl);
  await writeFile(tmpUrl, JSON.stringify(hashes));
  execFileSync(
    "npx",
    ["--yes", "wrangler", "r2", "object", "put", "dts-content/data/source/_hashes.json",
     "--file", localPath(tmpUrl), "--content-type", "application/json", "--remote"],
    { stdio: "pipe", shell: true }
  );
  console.log(`Hash ledger updated: ${files.length} file(s) hashed, uploaded to dts-content/data/source/_hashes.json.`);
}

// Only run the CLI flow when this file is executed directly (`node
// scripts/upload-content.mjs`), not when scripts/rollback-content.mjs
// imports uploadTree()/contentTypeFor() from it.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("Running scripts/split-content.mjs ...\n");
  execFileSync("node", ["scripts/split-content.mjs"], { stdio: "inherit", cwd: localPath(root) });

  console.log("");
  let totalFail = 0;
  totalFail += await uploadTree(new URL(".build/data-current/", root), "data/current");
  totalFail += await uploadTree(new URL(".build/data-source/", root), "data/source");
  await computeAndUploadHashManifest(new URL(".build/data-source/", root));

  process.exit(totalFail ? 1 : 0);
}
