// DTS migration — Phase 8. A download is just another resource_key
// (download.<client_apps.key>), resolved through the SAME checkAccess() the
// experience/GIS resolvers use -- not a parallel gating system. See
// docs/migration/ACCESS-MODEL.md §3-5 for the shared policy this reuses.
//
// params.key is the bare client_apps.key (e.g. "dummy-viewer-win"), never
// the dotted resource_key itself -- same bare-param convention as
// functions/api/resource/gismap/[mapId]/layer/[layerId].js. The dotted
// "download.<key>" form only ever exists internally, for the entitlement
// lookup and for whatever the Admin Board's entitlement picker writes.
//
// Streams the R2 object directly rather than minting a presigned URL: this
// project has no R2 S3-API credentials set up anywhere, every other R2 read
// in this codebase already streams through a Function this same way (see
// the GIS layer proxy), and re-checking the real entitlement on every
// request is tighter than a presigned URL anyway -- a revoked entitlement
// takes effect on the very next request, not after some TTL expires.

import { json, pgrst, verifyUser, checkAccess } from "../../_lib/access.js";

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const appKey = params.key;

  const rows = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(appKey)}&select=*&limit=1`);
  if (!rows.length) return json({ error: "not found" }, 404);
  const app = rows[0];

  const userId = await verifyUser(request, env);
  const resourceKey = `download.${appKey}`;
  const allowed = await checkAccess(app.access || "restricted", userId, resourceKey, env);
  if (!allowed) return json({ error: userId ? "access denied" : "sign-in required" }, userId ? 403 : 401);

  // Re-checked even for an otherwise-entitled user: a disabled build is
  // unavailable to everyone, entitlement or not -- this is deliberately a
  // SEPARATE check from checkAccess(), never folded into the access level
  // itself, so disabling a build never has to touch (or clobber) whatever
  // access level/entitlements it was already granted.
  if (!app.enabled) return json({ error: "this build is currently unavailable" }, 403);

  if (!app.r2_object_key) return json({ error: "no build uploaded yet" }, 404);
  const obj = await env.DTS_BUILDS.get(app.r2_object_key);
  if (!obj) return json({ error: "build file missing" }, 404);

  const filename = app.r2_object_key.split("/").pop();
  return new Response(obj.body, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(obj.size),
      "cache-control": "no-store",
    },
  });
}
