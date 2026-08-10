// functions/api/admin/entitlements/[id].js -- site_admin only. Revoke.

import { json, pgrst, isUuid } from "../../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../../_lib/admin.js";

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const id = params.id;
  if (!isUuid(id)) return json({ error: "id must be a valid id" }, 400);
  const existing = await pgrst(env, `resource_entitlements?id=eq.${id}&select=*`);
  if (!existing.length) return json({ error: "not found" }, 404);

  await pgrst(env, `resource_entitlements?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "entitlement.revoke",
    targetType: existing[0].subject_type,
    targetId: existing[0].subject_id,
    before: existing[0],
    after: null,
  });

  return json({ ok: true }, 200);
}
