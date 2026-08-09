// functions/api/admin/apps.js -- site_admin only.
// "client_app.create"/"client_app.update" are an additive extension to
// ACCESS-MODEL.md §7's action vocabulary, same reasoning as
// organizations.js's own additive verbs -- §7 never enumerated an action for
// the client_apps row itself. Uploading the actual build FILE is a separate
// endpoint (apps/upload.js); this one only ever touches metadata.

import { json, pgrst } from "../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../_lib/admin.js";

const ACCESS_LEVELS = ["public", "registered", "client", "restricted"];

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const apps = await pgrst(env, "client_apps?select=*&order=name.asc");
  return json({ apps }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const key = (body && body.key || "").trim();
  const name = (body && body.name || "").trim();
  const platform = (body && body.platform || "").trim();
  if (!key || !name || !platform) return json({ error: "key, name, and platform are required" }, 400);
  if (!/^[a-z0-9-]+$/.test(key)) return json({ error: "key may only contain lowercase letters, numbers, and hyphens" }, 400);

  const access = ACCESS_LEVELS.includes(body.access) ? body.access : "restricted";

  const existing = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}&select=id`);
  if (existing.length) return json({ error: "an app with that key already exists" }, 409);

  const [inserted] = await pgrst(env, "client_apps", {
    method: "POST",
    body: {
      key,
      name,
      platform,
      version: body.version || null,
      access,
      enabled: body.enabled !== false,
    },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "client_app.create",
    targetType: "client_app",
    targetId: inserted.key,
    before: null,
    after: inserted,
  });

  return json({ app: inserted }, 201);
}
