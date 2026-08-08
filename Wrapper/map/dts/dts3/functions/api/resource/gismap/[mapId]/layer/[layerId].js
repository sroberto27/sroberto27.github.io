// DTS migration — Phase 4. Streams one gated GIS layer's raw geojson.
// Re-verifies the SAME gismap.<mapId> access check as
// functions/api/resource/[key].js on every request -- this is a separate
// HTTP request from a separate browser fetch() call
// (js/gis/gis-viewer.js:170), so the parent check having already passed
// once is never trusted here. See docs/migration/ACCESS-MODEL.md §5.

import { getSourceJson, verifyUser, checkAccess } from "../../../../../_lib/access.js";

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const { mapId, layerId } = params;

  const mapDoc = await getSourceJson(env, `gis/maps/${mapId}.json`);
  if (!mapDoc) return new Response("not found", { status: 404 });

  // The layer must genuinely be one of this map's own local geojson layers
  // -- never trust layerId alone to build an R2 path (path traversal /
  // arbitrary-file guard).
  const layer = (mapDoc.layers || []).find(
    (l) => l.id === layerId && l.sourceType === "geojson" && typeof l.url === "string" && l.url.startsWith("data/gis/layers/")
  );
  if (!layer) return new Response("not found", { status: 404 });

  const userId = await verifyUser(request, env);
  const access = mapDoc.access || "registered";
  const allowed = await checkAccess(access, userId, `gismap.${mapId}`, env);
  if (!allowed) {
    return new Response(JSON.stringify({ error: userId ? "access denied" : "sign-in required" }), {
      status: userId ? 403 : 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  // layer.url is "data/gis/layers/<file>.geojson" -- strip the "data/"
  // prefix, since getSourceJson/R2 objects live under data/source/ already.
  const filename = layer.url.replace(/^data\//, "");
  const obj = await env.DTS_CONTENT.get(`data/source/${filename}`);
  if (!obj) return new Response("not found", { status: 404 });

  return new Response(obj.body, {
    status: 200,
    headers: { "content-type": "application/geo+json", "cache-control": "no-store" },
  });
}
