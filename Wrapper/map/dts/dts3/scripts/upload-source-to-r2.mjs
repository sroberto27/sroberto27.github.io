// DTS migration — uploads the UNSTRIPPED source data that
// functions/api/resource/[key].js and its GIS-layer companion need to
// resolve gated resources. Private: nothing under data/source/ is ever
// served by the public data/current/ route (Phase 6 formalizes that split;
// this script seeds the R2 side of it early because Phase 4's resolver
// needs it now).
//
// Re-run this after any change to a project document's access field or
// navigable target (tourUrl/embedUrl/watchUrl/links[].url), or after any
// GIS document/layer change -- the resolver reads whatever is currently in
// R2, not the local files, once deployed.
//
//   node scripts/upload-source-to-r2.mjs

import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);

function localPath(rel) {
  return new URL(rel, root).pathname.replace(/^\/([A-Za-z]):/, "$1:");
}

async function collect() {
  const files = [];
  for (const f of await readdir(localPath("data/projects/"))) {
    files.push({ local: `data/projects/${f}`, key: `data/source/projects/${f}`, type: "application/json" });
  }
  files.push({ local: "data/gis/maps/iberia-coastal.json", key: "data/source/gis/maps/iberia-coastal.json", type: "application/json" });
  for (const f of await readdir(localPath("data/gis/tours/"))) {
    files.push({ local: `data/gis/tours/${f}`, key: `data/source/gis/tours/${f}`, type: "application/json" });
  }
  for (const f of await readdir(localPath("data/gis/featuretours/"))) {
    files.push({ local: `data/gis/featuretours/${f}`, key: `data/source/gis/featuretours/${f}`, type: "application/json" });
  }
  for (const f of await readdir(localPath("data/gis/layers/"))) {
    files.push({ local: `data/gis/layers/${f}`, key: `data/source/gis/layers/${f}`, type: "application/geo+json" });
  }
  return files;
}

const files = await collect();
console.log(`Uploading ${files.length} file(s) to dts-content/data/source/ ...\n`);

let ok = 0, fail = 0;
for (const f of files) {
  try {
    execFileSync(
      "npx",
      ["--yes", "wrangler", "r2", "object", "put", `dts-content/${f.key}`,
       "--file", localPath(f.local), "--content-type", f.type, "--remote"],
      { stdio: "pipe", shell: true }
    );
    ok++;
  } catch (err) {
    fail++;
    console.error(`FAILED: ${f.local} -> ${f.key}`);
    console.error(err.stdout?.toString() || err.message);
  }
}

console.log(`\n${ok} uploaded, ${fail} failed.`);
process.exit(fail ? 1 : 0);
