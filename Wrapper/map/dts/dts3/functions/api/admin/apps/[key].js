// functions/api/admin/apps/[key].js -- site_admin only.
// PATCH is metadata-only (name/platform/version/access/enabled) except for
// the one special case of clearing the uploaded file (removeFile: true) --
// r2_object_key is otherwise never settable here, only ever written by
// upload.js, the one place that actually confirms a real object landed in
// DTS_BUILDS. DELETE removes the whole build: found missing in Phase 8's own
// manual testing pass (docs/migration/PHASE8-BUILDS-TESTING.md test 8) --
// Organizations/Users deliberately have no delete (membership/audit history
// makes "disable" the right permanent record), but a mis-registered or
// throwaway build has no such history worth preserving, so a real delete
// makes sense here where it doesn't there.

import { json, pgrst } from "../../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../../_lib/admin.js";

const ACCESS_LEVELS = ["public", "registered", "client", "restricted"];

export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const key = params.key;
  const existingRows = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}&select=*`);
  if (!existingRows.length) return json({ error: "not found" }, 404);
  const existing = existingRows[0];

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const patch = {};
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) return json({ error: "name cannot be blank" }, 400);
    patch.name = name;
  }
  if (body.platform != null) {
    const platform = String(body.platform).trim();
    if (!platform) return json({ error: "platform cannot be blank" }, 400);
    patch.platform = platform;
  }
  if (body.version != null) patch.version = String(body.version).trim() || null;
  if (body.access != null) {
    if (!ACCESS_LEVELS.includes(body.access)) return json({ error: "access must be one of: " + ACCESS_LEVELS.join(", ") }, 400);
    patch.access = body.access;
  }
  if (body.enabled != null) patch.enabled = !!body.enabled;
  if (body.removeFile === true && existing.r2_object_key) {
    await env.DTS_BUILDS.delete(existing.r2_object_key);
    patch.r2_object_key = null;
  }
  if (!Object.keys(patch).length) return json({ error: "nothing to update" }, 400);
  patch.updated_at = new Date().toISOString();

  const [updated] = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}`, { method: "PATCH", body: patch });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "client_app.update",
    targetType: "client_app",
    targetId: key,
    before: existing,
    after: updated,
  });

  return json({ app: updated }, 200);
}

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const key = params.key;
  const existingRows = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}&select=*`);
  if (!existingRows.length) return json({ error: "not found" }, 404);
  const existing = existingRows[0];

  if (existing.r2_object_key) await env.DTS_BUILDS.delete(existing.r2_object_key);

  // resource_entitlements.resource_key is a plain text column, not a foreign
  // key -- deleting the client_apps row leaves any download.<key> grants as
  // orphans pointing at a resource that no longer exists unless cleaned up
  // here explicitly (ACCESS-MODEL.md's own §4 already warns a resource_key
  // should never be renamed for exactly this reason; deleting it outright
  // needs the same care).
  await pgrst(env, `resource_entitlements?resource_key=eq.${encodeURIComponent("download." + key)}`, { method: "DELETE", prefer: "return=minimal" });
  await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", prefer: "return=minimal" });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "client_app.delete",
    targetType: "client_app",
    targetId: key,
    before: existing,
    after: null,
  });

  return json({ ok: true }, 200);
}
