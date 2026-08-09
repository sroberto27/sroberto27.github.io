// DTS migration — Phase 6. The ONE implementation of the public/protected
// split (ACCESS-MODEL.md §5), imported by both a Workers-runtime Function
// (functions/api/publish.js) and a Node CLI script (scripts/split-content.mjs)
// via a plain relative import. Deliberately dependency-free: no `fs`, no
// `vm`, no Node-only API — every export here must run unmodified inside a
// Cloudflare Pages Function.
//
// This supersedes scripts/strip-public-data.mjs's inline resolve()/
// stripTarget() (Phase 4's ad-hoc version) and js/admin.js's
// resolveAccessLevel() (UI-only copy, admin.js:469) as the one real
// implementation — those call sites' own comments already say "kept in sync
// deliberately, not re-derived," which is exactly the drift this file closes.

// ACCESS-MODEL.md §5 resolution order: the node's own access (unless absent
// or "inherit") wins; else the project's own access; else "registered" as
// the default for experiences/links (the project's own descriptive content
// defaults to public, but that's a different rule entirely — see
// isProjectDocPublicDefault() below, never confuse the two).
export function resolveAccessLevel(ownAccess, projectAccess) {
  if (ownAccess && ownAccess !== "inherit") return ownAccess;
  return projectAccess || "registered";
}

function deepClone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

// Removes the navigable target fields from one experience/media/link node in
// place. Raw /data field names differ from the DTS_CONFIG shape
// content-loader.js's convertExperience() produces: treedis uses a flat
// `tourUrl` string, video uses NESTED `embed`/`watch` source objects
// ({kind,value}) -- must operate on the RAW shape here, not the converted
// one (confirmed against a real raw video document during Phase 4).
//
// `origin` travels WITH tourUrl as one navigable-target pair -- the
// resolver's buildExperiencePayload() (functions/api/resource/[key].js)
// returns both together for a gated resolve, so a gated node's `origin`
// is never read from this stripped copy at runtime; safe to remove
// alongside tourUrl. (It is NOT resource-identifying on its own -- every
// project shares the same Treedis SDK origin -- but leaving it behind
// still fails the phase's own literal acceptance check, a `grep -c
// spaces.dtsxr.com` over js/config.js expecting exactly 1 match, the
// public homepage tour.)
function stripTarget(node) {
  let did = false;
  if (node.tourUrl) { delete node.tourUrl; did = true; }
  if (node.origin) { delete node.origin; did = true; }
  if (node.embed) { delete node.embed; did = true; }
  if (node.watch) { delete node.watch; did = true; }
  if (node.mapId) { delete node.mapId; did = true; }
  if (node.tourId) { delete node.tourId; did = true; }
  return did;
}

// Field-level split for one project document (ACCESS-MODEL.md §5's first
// kind of strip). `current` ships to data/current/ (public); `source` is the
// full, unstripped document, exactly as authored, for data/source/. Every
// descriptive field (title, tagline, overview, project{}, gallery, evidence,
// capturedWith, platform, every experience/link's label) is never withheld —
// only the navigable target above `public`.
export function splitProjectDoc(doc) {
  const source = deepClone(doc);
  const current = deepClone(doc);

  if (Array.isArray(current.experiences)) {
    for (const exp of current.experiences) {
      if (resolveAccessLevel(exp.access, current.access) === "public") continue;
      stripTarget(exp);
    }
  } else if (current.media) {
    if (resolveAccessLevel(current.media.access, current.access) !== "public") {
      stripTarget(current.media);
    }
  }

  if (Array.isArray(current.links)) {
    for (const link of current.links) {
      if (link.kind === "treedis" && resolveAccessLevel(link.access, current.access) !== "public") {
        if (link.url) delete link.url;
      }
    }
  }

  return { current, source };
}

// Whole-document split for a GIS map + its tours/featureTours
// (ACCESS-MODEL.md §5's second, non-field-level kind of strip).
// `js/gis/gis-viewer.js`'s `DTSGis.mount()` consumes the entire mapDoc at
// once -- there is no per-field boundary to strip inside it, so a gated map
// is either shipped in full or excluded wholesale and replaced with a
// minimal public stub, never present with fields removed.
const PUBLIC_GIS_STUB_FIELDS = ["id", "title", "subtitle"];

export function splitGisDocSet({ mapDoc, tours, featureTours }) {
  const access = mapDoc.access || "registered";
  const source = {
    mapDoc: deepClone(mapDoc),
    tours: deepClone(tours || []),
    featureTours: deepClone(featureTours || []),
  };

  if (access === "public") {
    return { current: deepClone(source), source };
  }

  const stub = {};
  for (const f of PUBLIC_GIS_STUB_FIELDS) {
    if (mapDoc[f] !== undefined) stub[f] = mapDoc[f];
  }
  return { current: { mapDoc: stub, tours: [], featureTours: [] }, source };
}

// CRITICAL: js/content-loader.js's loadContent() (content-loader.js:64-74)
// fetches EVERY file listed in manifest.json via Promise.all(), and a
// single 404 rejects the WHOLE load -- content-loader.js falls back to
// js/config.js the instant ANY manifest-listed file is missing
// (content-loader.js:445's .catch()). A gated map's tour/featureTour
// documents are deliberately absent from data/current/ (see
// splitGisDocSet() above) -- if manifest.json still lists them as fetchable
// files, EVERY page load 404s on them and the entire site falls back to
// the config.js fallback for EVERYONE, not just guests. This is not
// hypothetical: reproduced live against the real deployed site. The public
// manifest MUST only list files that are actually present in data/current/.
// data/source/'s own manifest.json stays the full, unfiltered list --
// nothing currently reads it there, and keeping it complete is harmless.
export function filterManifestForPublic(manifest, excludedFiles) {
  const excluded = new Set(excludedFiles);
  const filtered = { ...manifest, documents: {} };
  for (const [category, entries] of Object.entries(manifest.documents)) {
    filtered.documents[category] = entries.filter((e) => !excluded.has(e.file));
  }
  return filtered;
}

// True for a gated map's local geojson layer file (ACCESS-MODEL.md §5's
// local-layer-file note) -- these never land in data/current/ regardless of
// the map's own access, since gating the map document alone does not stop a
// guest who knows/guesses the raw file path. Live ArcGIS/tile-service layers
// (sourceType esriFeature/esriDynamic/esriImage) are untouched -- their data
// already lives on a public, unauthenticated government server, so gating
// DTS's own copy of the URL adds nothing.
//
// Takes the whole layer object, not just its url -- checks BOTH
// sourceType === "geojson" and the url prefix, matching the same
// double-check functions/api/resource/gismap/[mapId]/layer/[layerId].js
// and js/admin.js's collectHarvestedLayerUrls() already use, so all three
// call sites agree on exactly which layers this rule covers.
export function isLocalGisLayer(layer) {
  return !!layer && layer.sourceType === "geojson" &&
    typeof layer.url === "string" && layer.url.startsWith("data/gis/layers/");
}
