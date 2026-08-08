// DTS migration — Phase 4 resource resolver. THIS is the trust boundary:
// the browser never decides access, it asks this Function and gets back
// either the real target or 401/403. See docs/migration/ACCESS-MODEL.md
// §3-5 for the normative spec this implements.

import { json, getSourceJson, verifyUser, checkAccess } from "../../_lib/access.js";

export async function onRequestGet(context) {
  const { request, params, env } = context;
  // Cloudflare Pages does not percent-decode dynamic route segments, and
  // fetchResource() in js/app.js encodeURIComponent()s the resource key
  // before requesting it (":" -> "%3A") -- without this decode, every
  // project.<id>:<expId> key fails parseResourceKey()'s colon split and
  // 400s before the access check ever runs, for guests and signed-in users
  // alike. decodeURIComponent() is a no-op on an already-decoded key.
  const key = decodeURIComponent(params.key);

  const parsed = parseResourceKey(key);
  if (!parsed) return json({ error: "unrecognized resource key" }, 400);

  let resolved;
  try {
    resolved = parsed.type === "gismap"
      ? await resolveGismapTarget(parsed.mapId, env)
      : await resolveExperienceTarget(parsed.projectId, parsed.expId, env);
  } catch (err) {
    console.error(`[resource resolver] ${key}:`, err);
    return json({ error: "resolution failed" }, 500);
  }
  if (!resolved) return json({ error: "not found" }, 404);

  const userId = await verifyUser(request, env);
  const allowed = await checkAccess(resolved.access, userId, key, env);
  if (!allowed) return json({ error: userId ? "access denied" : "sign-in required" }, userId ? 403 : 401);

  return json(resolved.payload, 200);
}

// ---- resource_key parsing (ACCESS-MODEL.md §4) ----------------------------

function parseResourceKey(key) {
  if (typeof key !== "string") return null;
  if (key.startsWith("gismap.")) {
    return { type: "gismap", mapId: key.slice("gismap.".length) };
  }
  if (key.startsWith("project.")) {
    const rest = key.slice("project.".length);
    const i = rest.indexOf(":");
    if (i === -1) return null; // bare project.<id> -- descriptive content is
                                 // always public and never resolved here.
    return { type: "experience", projectId: rest.slice(0, i), expId: rest.slice(i + 1) };
  }
  return null;
}

async function listSourceJson(env, prefix, predicate) {
  const listing = await env.DTS_CONTENT.list({ prefix: `data/source/${prefix}` });
  const docs = [];
  for (const item of listing.objects) {
    const obj = await env.DTS_CONTENT.get(item.key);
    if (!obj) continue;
    const doc = await obj.json();
    if (!predicate || predicate(doc)) docs.push(doc);
  }
  return docs;
}

// matches content-loader.js's srcValue() -- both kind:"path" and kind:"url"
// resolve to just the raw value.
function srcValue(source) {
  return source ? source.value : undefined;
}

// ---- experience / link resolution --------------------------------------

// Identity convention matched to content-loader.js's projectExperiences():
// experiences[].id as authored; a legacy media object's effective id is its
// own _type; a links[] entry's id is link-<1-based-index> (see
// ACCESS-MODEL.md §4 -- not yet given explicit ids at backfill time, so
// derived from array position; must match app.js's construction exactly).
async function resolveExperienceTarget(projectId, expId, env) {
  const doc = await getSourceJson(env, `projects/${projectId}.json`);
  if (!doc) return null;

  let node = null;
  let buildPayload = null;

  if (Array.isArray(doc.experiences) && doc.experiences.length) {
    node = doc.experiences.find((e) => e.id === expId) || null;
    if (node) buildPayload = () => buildExperiencePayload(node);
  } else if (doc.media && doc.media._type === expId) {
    node = doc.media;
    buildPayload = () => buildExperiencePayload(node);
  }

  if (!node && Array.isArray(doc.links)) {
    const m = /^link-(\d+)$/.exec(expId);
    if (m) {
      const link = doc.links[parseInt(m[1], 10) - 1];
      if (link) {
        node = link;
        buildPayload = () => ({ url: link.url });
      }
    }
  }

  if (!node) return null;

  const access = node.access && node.access !== "inherit" ? node.access : (doc.access || "registered");
  return { access, payload: buildPayload() };
}

function buildExperiencePayload(node) {
  if (node.tourUrl) return { tourUrl: node.tourUrl, origin: node.origin };
  if (node.embed || node.watch) return { embedUrl: srcValue(node.embed), watchUrl: srcValue(node.watch) };
  // GIS pointer: mapId/tourId are identifiers, not secrets -- the actual
  // gate is the separate, whole-document gismap.<mapId> resolve this lets
  // the client make next. Returning them here is what makes that two-step
  // flow possible at all: without this, the client has no way to learn
  // which map to ask for.
  if (node.mapId) return { mapId: node.mapId, tourId: node.tourId || null };
  return {};
}

// ---- GIS map resolution (whole-document, ACCESS-MODEL.md §5) ----------

async function resolveGismapTarget(mapId, env) {
  const mapDoc = await getSourceJson(env, `gis/maps/${mapId}.json`);
  if (!mapDoc) return null;
  const access = mapDoc.access || "registered";

  // Local geojson layer files are gated exactly as hard as the map itself
  // (ACCESS-MODEL.md §5) -- rewrite their url to the authenticated proxy
  // route. Live ArcGIS/tile-service layers stay untouched: those are
  // already public government endpoints, gating DTS's own copy of the URL
  // adds nothing.
  const layers = (mapDoc.layers || []).map((l) => {
    if (l.sourceType === "geojson" && typeof l.url === "string" && l.url.startsWith("data/gis/layers/")) {
      return { ...l, url: `/api/resource/gismap/${mapId}/layer/${l.id}` };
    }
    return l;
  });

  const tours = await listSourceJson(env, "gis/tours/", (t) => t.mapId === mapId);
  const featureTours = await listSourceJson(env, "gis/featuretours/", (ft) => ft.mapId === mapId);

  // IMPORTANT: mapDoc.tours (already present on the raw document) is an
  // array of TOUR ID STRINGS -- js/app.js's toursForMap() reads it as
  // `mapDoc.tours.map(id => cfg.gisTours[id])` against a GLOBAL keyed map,
  // not embedded objects. Spreading `tours` over mapDoc here would silently
  // replace that id-string array with full tour objects and break the
  // lookup. Keep mapDoc.tours untouched; return the full tour/featureTour
  // objects as SEPARATE top-level keys so the client can populate
  // cfg.gisTours/cfg.gisFeatureTours itself (the same keying buildConfig()
  // already uses for the public path).
  return {
    access,
    payload: {
      mapDoc: { ...mapDoc, layers },
      tours,
      featureTours,
    },
  };
}
