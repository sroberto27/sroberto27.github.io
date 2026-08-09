// DTS migration — Phase 6. Formalizes the public/protected split
// (ACCESS-MODEL.md §5) into a real, re-runnable pipeline step, driven off
// data/manifest.json itself (the same source of truth CLAUDE.md's "three
// places" rule points at) rather than a hardcoded per-directory list, so a
// newly-registered document is picked up automatically.
//
// Writes two local staging trees, mirroring /data's own internal path
// structure (no "data/" prefix -- that's added when scripts/upload-
// content.mjs computes the R2 key):
//   .build/data-current/  -- public, stripped. Uploaded to R2 data/current/.
//   .build/data-source/   -- full, private. Uploaded to R2 data/source/.
//
// Also applies the SAME field-level strip to js/config.js in place, per
// ACCESS-MODEL.md's "js/config.js is a third stripping surface" note --
// cross-referencing each example's resolved access against the real project
// document by id (config.js itself carries no access field of its own; see
// this script's stripConfigJs()).
//
// Supersedes scripts/strip-public-data.mjs (Phase 4's ad-hoc, deploy-
// staging-only version). The actual split algorithm now lives in
// functions/_lib/split-logic.js, shared with functions/api/publish.js, so
// the CLI path and the live publish path can never drift apart.
//
//   node scripts/split-content.mjs

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import {
  resolveAccessLevel,
  splitProjectDoc,
  splitGisDocSet,
  isLocalGisLayer,
  filterManifestForPublic,
} from "../functions/_lib/split-logic.js";

const root = new URL("../", import.meta.url);
const dataRoot = new URL("data/", root);
const currentRoot = new URL(".build/data-current/", root);
const sourceRoot = new URL(".build/data-source/", root);

async function readJson(base, rel) {
  return JSON.parse(await readFile(new URL(rel, base), "utf8"));
}
async function writeJson(base, rel, data) {
  const url = new URL(rel, base);
  await mkdir(new URL("./", url), { recursive: true });
  await writeFile(url, JSON.stringify(data, null, 2) + "\n", "utf8");
}
async function copyRaw(base, rel, bytes) {
  const url = new URL(rel, base);
  await mkdir(new URL("./", url), { recursive: true });
  await writeFile(url, bytes);
}

// The /data-tree split, factored out of main() so scripts/rollback-
// content.mjs can reuse the exact same algorithm against a downloaded
// snapshot directory instead of the repo's real data/ -- same reasoning as
// functions/_lib/split-logic.js being shared with functions/api/publish.js:
// one implementation, never two that can drift.
export async function splitDataTree(fromRoot, toCurrentRoot, toSourceRoot) {
  await rm(toCurrentRoot, { recursive: true, force: true });
  await rm(toSourceRoot, { recursive: true, force: true });

  const manifest = await readJson(fromRoot, "manifest.json");

  // Full, unfiltered manifest for data/source/ -- written now; the public
  // copy is written at the end, once we know which GIS tour/featureTour
  // files were excluded from data/current/ (see filterManifestForPublic()'s
  // own comment for why this filtering is not optional).
  await writeJson(toSourceRoot, "manifest.json", manifest);

  let projectCount = 0;
  const gisMapEntries = [];
  const gisTourEntries = [];
  const gisFeatureTourEntries = [];
  let plainCount = 0;

  for (const category of Object.values(manifest.documents)) {
    for (const entry of category) {
      if (entry.type === "project") {
        const doc = await readJson(fromRoot, entry.file);
        const { current, source } = splitProjectDoc(doc);
        await writeJson(toCurrentRoot, entry.file, current);
        await writeJson(toSourceRoot, entry.file, source);
        projectCount++;
      } else if (entry.type === "gisMap") {
        gisMapEntries.push(entry);
      } else if (entry.type === "gisTour") {
        gisTourEntries.push(entry);
      } else if (entry.type === "gisFeatureTour") {
        gisFeatureTourEntries.push(entry);
      } else {
        // Never gated: site/page/sector/form/faq/access/media documents,
        // and gis/sources.json (public ArcGIS server metadata, not one of
        // ACCESS-MODEL.md §4's resource-key shapes) -- ships unchanged.
        const doc = await readJson(fromRoot, entry.file);
        await writeJson(toCurrentRoot, entry.file, doc);
        await writeJson(toSourceRoot, entry.file, doc);
        plainCount++;
      }
    }
  }

  // GIS whole-document split (ACCESS-MODEL.md §5's second kind of strip) --
  // grouped by mapId, since the decision (full vs. minimal stub) applies to
  // the map + every tour/featureTour that references it together, not each
  // document independently.
  let gisPublicMaps = 0, gisGatedMaps = 0, layersCopiedPublic = 0, layersKeptSource = 0;
  const excludedFromCurrent = [];
  for (const mapEntry of gisMapEntries) {
    const mapDoc = await readJson(fromRoot, mapEntry.file);
    const mapId = mapDoc.id;
    const tourEntries = [];
    const tours = [];
    for (const e of gisTourEntries) {
      const t = await readJson(fromRoot, e.file);
      if (t.mapId === mapId) { tourEntries.push(e); tours.push(t); }
    }
    const featureTourEntries = [];
    const featureTours = [];
    for (const e of gisFeatureTourEntries) {
      const t = await readJson(fromRoot, e.file);
      if (t.mapId === mapId) { featureTourEntries.push(e); featureTours.push(t); }
    }

    const { current, source } = splitGisDocSet({ mapDoc, tours, featureTours });
    const isPublic = (mapDoc.access || "registered") === "public";
    isPublic ? gisPublicMaps++ : gisGatedMaps++;

    // Source always gets the full set.
    await writeJson(toSourceRoot, mapEntry.file, source.mapDoc);
    for (const [i, e] of tourEntries.entries()) await writeJson(toSourceRoot, e.file, source.tours[i]);
    for (const [i, e] of featureTourEntries.entries()) await writeJson(toSourceRoot, e.file, source.featureTours[i]);

    // Current gets either the full set (public) or just the stub, with
    // zero tour/featureTour files -- the gated resolver
    // (functions/api/resource/[key].js) returns tours/featureTours inline
    // in its own payload, so a per-file /data fetch of a gated map's tours
    // never happens on that path; omitting them here matches
    // strip-public-data.mjs's existing wholesale-removal behavior exactly.
    await writeJson(toCurrentRoot, mapEntry.file, current.mapDoc);
    if (isPublic) {
      for (const [i, e] of tourEntries.entries()) await writeJson(toCurrentRoot, e.file, current.tours[i]);
      for (const [i, e] of featureTourEntries.entries()) await writeJson(toCurrentRoot, e.file, current.featureTours[i]);
    } else {
      // These files are never written to data/current/ -- MUST also be
      // removed from the public manifest.json, or content-loader.js's
      // unconditional per-file fetch 404s on them and takes down the
      // entire site's data load (see filterManifestForPublic()).
      for (const e of tourEntries) excludedFromCurrent.push(e.file);
      for (const e of featureTourEntries) excludedFromCurrent.push(e.file);
    }

    // Local geojson layer files gated exactly as hard as the map itself.
    for (const layer of mapDoc.layers || []) {
      if (!isLocalGisLayer(layer)) continue; // live ArcGIS/tile layer -- not a local file
      const rel = layer.url.replace(/^data\//, "");
      const bytes = await readFile(new URL(rel, fromRoot));
      await copyRaw(toSourceRoot, rel, bytes);
      layersKeptSource++;
      if (isPublic) { await copyRaw(toCurrentRoot, rel, bytes); layersCopiedPublic++; }
    }
  }

  const publicManifest = filterManifestForPublic(manifest, excludedFromCurrent);
  await writeJson(toCurrentRoot, "manifest.json", publicManifest);

  console.log(`Split ${projectCount} project document(s), ${plainCount} always-public document(s).`);
  console.log(`GIS: ${gisPublicMaps} public map(s) (full), ${gisGatedMaps} gated map(s) (stub only) -- ${gisTourEntries.length} tour(s) + ${gisFeatureTourEntries.length} feature tour(s) total.`);
  console.log(`GIS local layer files: ${layersKeptSource} kept in data/source/, ${layersCopiedPublic} also shipped to data/current/ (public maps only).`);
  console.log(`Public manifest.json excludes ${excludedFromCurrent.length} gated GIS document(s) not present in data/current/ (prevents content-loader.js's whole-site fetch failure).`);
  console.log(`Staged at ${toCurrentRoot.pathname} and ${toSourceRoot.pathname}.`);
}

async function main() {
  await splitDataTree(dataRoot, currentRoot, sourceRoot);
  await stripConfigJs();
}

// js/config.js -- the /data-unreachable fallback (content-loader.js:367-375).
// Deployed as an ordinary static file, so it needs the SAME field-level
// strip data/current/ gets, or it leaks every gated target regardless of
// what /data ships (ACCESS-MODEL.md's "third stripping surface" section).
//
// IMPORTANT: js/config.js in the repo is the real, unstripped MASTER copy
// (manually kept "roughly in sync" with /data per CLAUDE.md) -- confirmed
// before writing this function (16 real spaces.dtsxr.com URLs on disk
// today). This function must never overwrite it in place; the stripped
// result goes to .build/js/config.js, a deploy-time staging artifact that
// scripts/upload-content.mjs's deploy-staging step overlays on top of the
// real js/config.js when building the site for `wrangler pages deploy` --
// the same role strip-public-data.mjs's `--dir=<staging-copy>` argument
// played in Phase 4, just now produced here instead of hand-invoked per
// deploy.
//
// config.js carries no `access` field anywhere on its own -- resolved here
// by cross-referencing each example's id against the REAL project document
// in data/projects/<id>.json (confirmed structurally identical ordering: a
// project's single legacy `media` object maps 1:1 to the example's `media`,
// and `links[]` is index-matched in the same order -- verified directly
// against automotive.json/config.js before relying on it). gfc (the only
// experiences[]-based, multi-experience project) has neither `media` nor
// `links` in config.js today, so it needs no handling here; a guard below
// fails loudly if that ever changes without this script being updated.
async function stripConfigJs() {
  const rel = "js/config.js";
  const src = await readFile(new URL(rel, root), "utf8");

  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: rel });
  const cfg = sandbox.window.DTS_CONFIG;
  if (!cfg) throw new Error(`${rel}: window.DTS_CONFIG was not defined after evaluating the file`);

  let strippedMedia = 0, keptPublicMedia = 0, strippedLinks = 0, mismatchWarnings = 0;

  for (const [id, ex] of Object.entries(cfg.examples || {})) {
    let rawDoc;
    try {
      rawDoc = await readJson(dataRoot, `projects/${id}.json`);
    } catch {
      rawDoc = null; // no matching /data project -- nothing to resolve against, leave untouched
    }
    if (!rawDoc) continue;

    if (ex.media) {
      const access = resolveAccessLevel(rawDoc.media?.access, rawDoc.access);
      if (access === "public") {
        keptPublicMedia++;
      } else {
        delete ex.media.tourUrl;
        delete ex.media.origin; // travels with tourUrl, same reasoning as split-logic.js's stripTarget()
        delete ex.media.embedUrl;
        delete ex.media.watchUrl;
        strippedMedia++;
      }
    }

    if (Array.isArray(ex.links)) {
      const rawLinks = Array.isArray(rawDoc.links) ? rawDoc.links : [];
      if (rawLinks.length !== ex.links.length) {
        // Can't safely index-match -- fall back to the original, proven-safe
        // behavior (strip any spaces.dtsxr.com URL) rather than guess.
        mismatchWarnings++;
        for (const link of ex.links) {
          if (typeof link.url === "string" && link.url.startsWith("https://spaces.dtsxr.com")) {
            delete link.url;
            strippedLinks++;
          }
        }
        continue;
      }
      ex.links.forEach((link, i) => {
        const rawLink = rawLinks[i];
        if (rawLink.kind !== "treedis") return; // vimeo links have no access field, always public by convention
        const access = resolveAccessLevel(rawLink.access, rawDoc.access);
        if (access !== "public" && link.url) {
          delete link.url;
          strippedLinks++;
        }
      });
    }
  }

  // cfg.treedis.tourUrl (the public homepage tour) is untouched by design --
  // never part of cfg.examples, never resolved against a project document.
  if (cfg.gisMaps && Object.keys(cfg.gisMaps).length) {
    throw new Error(`${rel}: cfg.gisMaps is no longer empty -- stripConfigJs() needs a GIS-stripping branch, it currently assumes there's nothing to strip because there was nothing when this was written.`);
  }

  const out = `window.DTS_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
  const stagedUrl = new URL(".build/js/config.js", root);
  await mkdir(new URL("./", stagedUrl), { recursive: true });
  await writeFile(stagedUrl, out, "utf8");

  console.log(`js/config.js (staged copy only, repo file untouched): stripped ${strippedMedia} gated media block(s), kept ${keptPublicMedia} public one(s) untouched, stripped ${strippedLinks} gated link(s)${mismatchWarnings ? `, ${mismatchWarnings} project(s) fell back to the unconditional strip (links[] length mismatch vs. /data)` : ""}.`);
}

// Only run the CLI flow when this file is executed directly (`node
// scripts/split-content.mjs`), not when scripts/rollback-content.mjs or
// scripts/upload-content.mjs imports splitDataTree() from it. Without this
// guard, importing splitDataTree also triggers a real, unwanted main() run
// against the actual live /data (splitting it AND rewriting .build/js/
// config.js) as a side effect of the import -- found while testing the
// rollback drill: rollback-content.mjs's own explicit splitDataTree(rawRoot,
// ...) call happened to run afterward and overwrite the accidental output
// with the correct snapshot-derived content, so the end result was right by
// call-order luck, not by design. That's not something to depend on.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
