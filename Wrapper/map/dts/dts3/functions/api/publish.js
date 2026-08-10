// DTS migration — Phase 6. The Admin Board's "Publish to site" endpoint:
// takes the SAME { manifest, docs, layers } shape js/admin.js's existing
// exportData() already assembles for the zip export (content.manifest,
// content.docs keyed exactly like data/manifest.json's `file` paths, plus
// any harvested local GIS layer files), runs the shared split logic
// (functions/_lib/split-logic.js -- the SAME module scripts/split-
// content.mjs uses, not a reimplementation), writes both the public
// data/current/ and private data/source/ copies to R2, snapshots the full
// payload for rollback, and purges the edge cache for everything actually
// published.
//
// DIFF-BASED, not "rewrite everything every time": a full publish of all 61
// documents needs 150+ R2 operations if done unconditionally, which blows
// Cloudflare's 50-subrequest-per-invocation free-tier ceiling (confirmed
// empirically -- the first version of this file threw "Too many
// subrequests" against the real deployed site). R2 reads/writes/deletes
// each count as one subrequest; in-Worker crypto.subtle.digest() does not,
// so hashing every incoming document costs nothing. Only documents whose
// content-hash actually differs from the last published state get written.
//
// The hash ledger (`data/source/_hashes.json`, ONE combined object, not
// one-per-doc) is maintained by BOTH this Function and scripts/upload-
// content.mjs's uploadHashManifest() -- so the very first publish after a
// CLI seed correctly sees "nothing changed" instead of treating all 61
// documents as new. Both sides MUST hash the same canonical form (compact
// JSON.stringify() of the PARSED object, never the pretty-printed on-disk
// bytes, which would hash differently for identical content) -- see
// scripts/upload-content.mjs's computeAndUploadHashManifest() for the CLI
// side of this contract.
//
// See docs/migration/ACCESS-MODEL.md §5 and PROGRESS.md's Phase 6 entry
// for the fuller design rationale, including why this replaced an earlier
// non-diffing version.

import { requireSiteAdmin, writeAudit } from "../_lib/admin.js";
import { json, getSourceJson } from "../_lib/access.js";
import { splitProjectDoc, splitGisDocSet, isLocalGisLayer, filterManifestForPublic } from "../_lib/split-logic.js";

const HASH_MANIFEST_KEY = "data/source/_hashes.json";

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const { manifest, docs, layers } = payload || {};
  if (!manifest || typeof docs !== "object" || docs === null) {
    return json({ error: "payload must include { manifest, docs, layers }" }, 400);
  }

  // Validate the payload is exactly the known document set (every manifest
  // entry present, nothing extra) -- rejects a corrupted/partial/tampered
  // publish rather than silently writing an incomplete data/current/.
  const knownFiles = [];
  for (const category of Object.values(manifest.documents || {})) {
    for (const entry of category) knownFiles.push(entry);
  }
  const knownSet = new Set(knownFiles.map((e) => e.file));
  const payloadSet = new Set(Object.keys(docs));
  const missing = knownFiles.filter((e) => !payloadSet.has(e.file)).map((e) => e.file);
  const extra = [...payloadSet].filter((f) => !knownSet.has(f));
  if (missing.length || extra.length) {
    return json({ error: "payload document set does not match manifest.json", missing, extra }, 400);
  }

  const layerFiles = Array.isArray(layers) ? layers : [];

  // ---- hash everything incoming (pure CPU, zero subrequests) ----
  const incomingHashes = { "manifest.json": await sha256Hex(JSON.stringify(manifest)) };
  for (const [file, doc] of Object.entries(docs)) incomingHashes[file] = await sha256Hex(JSON.stringify(doc));
  for (const lf of layerFiles) incomingHashes[lf.url.replace(/^data\//, "")] = await sha256Hex(lf.text);

  // ---- read the ONE hash ledger (1 subrequest; a first-ever publish with
  // no ledger yet just means everything reads as "changed") ----
  let previousHashes = {};
  try {
    const obj = await env.DTS_CONTENT.get(HASH_MANIFEST_KEY);
    if (obj) previousHashes = await obj.json();
  } catch (_) {
    previousHashes = {};
  }
  const changed = (key) => incomingHashes[key] !== previousHashes[key];

  async function put(prefix, relPath, doc) {
    await env.DTS_CONTENT.put(`${prefix}/${relPath}`, JSON.stringify(doc, null, 2) + "\n", {
      httpMetadata: { contentType: "application/json" },
    });
  }
  async function putRaw(prefix, relPath, bytes, contentType) {
    await env.DTS_CONTENT.put(`${prefix}/${relPath}`, bytes, { httpMetadata: { contentType } });
  }
  async function del(prefix, relPath) {
    await env.DTS_CONTENT.delete(`${prefix}/${relPath}`);
  }

  const publishedCurrentPaths = []; // -> cache purge list at the end
  let writtenCount = 0, skippedCount = 0, deletedCount = 0;

  // ---- clean up documents removed since the last publish ----
  // The main loop below only ever visits entries actually present in the
  // INCOMING manifest -- a project/sector/gisMap deleted in the Admin Board
  // (its manifest entry simply gone from this payload) was never diffed,
  // never deleted, just silently skipped. Its old data/current/ AND
  // data/source/ objects stayed in R2 exactly as last published --
  // permanently public at their old, still-guessable URL, since
  // functions/data/[[path]].js serves any path under data/current/ by
  // direct key lookup with no manifest cross-check. Read the PREVIOUS
  // manifest (data/source/'s copy, about to be overwritten below) to find
  // what disappeared. First-ever publish has no previous manifest to diff
  // against -- nothing to clean up yet.
  const previousManifest = await getSourceJson(env, "manifest.json");
  if (previousManifest) {
    const previousEntries = [];
    for (const category of Object.values(previousManifest.documents || {})) {
      for (const entry of category) previousEntries.push(entry);
    }
    const removedEntries = previousEntries.filter((e) => !knownSet.has(e.file));
    for (const entry of removedEntries) {
      // A removed gisMap's own local (non-ArcGIS) layer files are a second,
      // separate set of public objects nothing else will ever clean up --
      // same "permanently public at a guessable URL" problem, one level
      // deeper. Read its last-published full document (data/source/, since
      // a gated map's data/current/ copy was only ever a stub) to find them
      // before the document itself is deleted below.
      if (entry.type === "gisMap") {
        const oldMapDoc = await getSourceJson(env, entry.file);
        for (const layer of (oldMapDoc && oldMapDoc.layers) || []) {
          if (!isLocalGisLayer(layer)) continue;
          const rel = layer.url.replace(/^data\//, "");
          await del("data/source", rel);
          await del("data/current", rel);
          publishedCurrentPaths.push(rel);
          deletedCount++;
        }
      }
      await del("data/source", entry.file);
      await del("data/current", entry.file);
      publishedCurrentPaths.push(entry.file);
      deletedCount++;
    }
  }

  // manifest.json's data/source/ copy is always the full, unfiltered list;
  // its data/current/ copy is written at the end, once excludedFromCurrent
  // is known (see filterManifestForPublic()'s comment for why this can't
  // just ship the raw manifest).
  await put("data/source", "manifest.json", manifest);

  const gisMapEntries = [], gisTourEntries = [], gisFeatureTourEntries = [];

  for (const category of Object.values(manifest.documents)) {
    for (const entry of category) {
      const doc = docs[entry.file];
      if (entry.type === "project") {
        if (!changed(entry.file)) { skippedCount++; continue; }
        const { current, source } = splitProjectDoc(doc);
        await put("data/current", entry.file, current);
        await put("data/source", entry.file, source);
        publishedCurrentPaths.push(entry.file);
        writtenCount++;
      } else if (entry.type === "gisMap") {
        gisMapEntries.push({ entry, doc });
      } else if (entry.type === "gisTour") {
        gisTourEntries.push({ entry, doc });
      } else if (entry.type === "gisFeatureTour") {
        gisFeatureTourEntries.push({ entry, doc });
      } else {
        // Never gated: site/page/sector/form/faq/access/media documents,
        // and gis/sources.json -- ships unchanged.
        if (!changed(entry.file)) { skippedCount++; continue; }
        await put("data/current", entry.file, doc);
        await put("data/source", entry.file, doc);
        publishedCurrentPaths.push(entry.file);
        writtenCount++;
      }
    }
  }

  // GIS whole-document split, grouped by mapId. A map's own access level
  // decides EVERY tour/featureTour's public-vs-absent status in
  // data/current/ (ACCESS-MODEL.md §5) -- so if the map itself changed
  // (its access may have flipped), every member of the group must be
  // re-evaluated regardless of its own hash. If the map is unchanged, group
  // visibility is unchanged too, and members can be diffed individually.
  // Files NOT present in data/current/ this publish -- MUST also be removed
  // from data/current/manifest.json, or content-loader.js's unconditional
  // per-file Promise.all() fetch 404s on them and takes the ENTIRE site
  // down to the config.js fallback for every visitor, not just guests.
  // Reproduced live against the real deployed site before this fix existed
  // -- see filterManifestForPublic()'s own comment. Tracked regardless of
  // whether THIS publish touched a given file's content, since the
  // manifest must reflect total current reality, not just this publish's
  // delta -- a tour whose own hash didn't change is still correctly
  // excluded if its map is gated.
  const excludedFromCurrent = [];

  for (const { entry: mapEntry, doc: mapDoc } of gisMapEntries) {
    const mapId = mapDoc.id;
    const tourGroup = gisTourEntries.filter(({ doc }) => doc.mapId === mapId);
    const featureTourGroup = gisFeatureTourEntries.filter(({ doc }) => doc.mapId === mapId);
    const isPublic = (mapDoc.access || "registered") === "public";
    const mapChanged = changed(mapEntry.file);

    if (mapChanged) {
      const { current, source } = splitGisDocSet({
        mapDoc, tours: tourGroup.map((g) => g.doc), featureTours: featureTourGroup.map((g) => g.doc),
      });
      await put("data/source", mapEntry.file, source.mapDoc);
      await put("data/current", mapEntry.file, current.mapDoc);
      publishedCurrentPaths.push(mapEntry.file);
      writtenCount++;

      for (const g of [...tourGroup, ...featureTourGroup]) {
        await put("data/source", g.entry.file, g.doc);
        if (isPublic) await put("data/current", g.entry.file, g.doc);
        else await del("data/current", g.entry.file);
        publishedCurrentPaths.push(g.entry.file);
        writtenCount++;
      }
    } else {
      for (const g of [...tourGroup, ...featureTourGroup]) {
        if (!changed(g.entry.file)) { skippedCount++; continue; }
        await put("data/source", g.entry.file, g.doc);
        if (isPublic) await put("data/current", g.entry.file, g.doc);
        publishedCurrentPaths.push(g.entry.file);
        writtenCount++;
      }
    }
    if (!isPublic) {
      for (const g of [...tourGroup, ...featureTourGroup]) excludedFromCurrent.push(g.entry.file);
    }

    for (const layer of mapDoc.layers || []) {
      if (!isLocalGisLayer(layer)) continue;
      const rel = layer.url.replace(/^data\//, "");
      if (!mapChanged && !changed(rel)) { skippedCount++; continue; }
      const found = layerFiles.find((lf) => lf.url === layer.url);
      if (!found) continue; // admin never harvested this one this publish -- leave whatever's already in R2 alone
      await putRaw("data/source", rel, found.text, "application/geo+json");
      if (isPublic) await putRaw("data/current", rel, found.text, "application/geo+json");
      else await del("data/current", rel);
      publishedCurrentPaths.push(rel);
      writtenCount++;
    }
  }

  const publicManifest = filterManifestForPublic(manifest, excludedFromCurrent);
  await put("data/current", "manifest.json", publicManifest);
  publishedCurrentPaths.push("manifest.json");
  writtenCount++;

  // ONE combined snapshot object (not one-per-doc -- see the file header for
  // why) holding the FULL incoming payload, so a rollback always has a
  // complete, self-consistent state to re-derive data/current/ from, not
  // just this publish's delta.
  const snapshotId = new Date().toISOString().replace(/[:.]/g, "-");
  await put("data/snapshots", `${snapshotId}.json`, { manifest, docs, layers: layerFiles });

  // Hash ledger reflects the FULL incoming state (every doc, changed or
  // not), so the next publish's diff is against true current state.
  await put("data/source", "_hashes.json", incomingHashes);

  // Fixed key, always overwritten (unlike the timestamped snapshot above) --
  // the one thing functions/api/admin/content.js reads so the Admin Board
  // can load the FULL, unstripped document set (data/current/ is
  // hard-coded public-only by functions/data/[[path]].js, by design, and
  // was never readable by the board at all until this existed -- see
  // PROGRESS.md's session log for the bug this fixes). A single combined
  // object, not 61 separate R2 reads, for the same subrequest-ceiling
  // reason this file's own header explains for writes.
  await put("data/source", "_latest.json", { manifest, docs, layers: layerFiles });

  // Purge only what was actually (re)written or deleted.
  const origin = new URL(request.url).origin;
  await Promise.all(
    publishedCurrentPaths.map((p) => caches.default.delete(new Request(`${origin}/data/${p}`)))
  );

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "content.publish",
    targetType: "data",
    targetId: snapshotId,
    before: null,
    after: { writtenCount, skippedCount, deletedCount, snapshotId },
  });

  return json({ ok: true, snapshotId, writtenCount, skippedCount, deletedCount }, 200);
}
