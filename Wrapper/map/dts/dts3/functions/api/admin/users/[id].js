// functions/api/admin/users/[id].js -- site_admin only.
// site_role change and ban/unban (account.disable / account.reactivate)
// are independent axes -- a single PATCH may carry either or both, and each
// gets its own admin_audit row per ACCESS-MODEL.md §7's separate action
// names, not one combined entry.

import { json, pgrst } from "../../../_lib/access.js";
import { requireSiteAdmin, writeAudit, gotrue } from "../../../_lib/admin.js";

export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const userId = params.id;

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }

  const result = {};

  if (body.siteRole != null) {
    if (body.siteRole !== "user" && body.siteRole !== "site_admin") {
      return json({ error: "siteRole must be 'user' or 'site_admin'" }, 400);
    }
    const beforeRows = await pgrst(env, `profiles?user_id=eq.${userId}&select=site_role`);
    if (!beforeRows.length) return json({ error: "no profile for that user id" }, 404);
    const before = beforeRows[0].site_role;
    if (before !== body.siteRole) {
      await pgrst(env, `profiles?user_id=eq.${userId}`, { method: "PATCH", body: { site_role: body.siteRole } });
      await writeAudit(env, {
        actorUserId: auth.userId,
        action: "site_role.change",
        targetType: "user",
        targetId: userId,
        before: { site_role: before },
        after: { site_role: body.siteRole },
      });
    }
    result.siteRole = body.siteRole;
  }

  if (body.disabled != null) {
    // GoTrue has no permanent-ban sentinel -- ~100 years is the documented
    // pattern for "indefinite", "none" clears it.
    const banDuration = body.disabled ? "876000h" : "none";
    await gotrue(env, "/admin/users/" + userId, { method: "PUT", body: { ban_duration: banDuration } });
    await writeAudit(env, {
      actorUserId: auth.userId,
      action: body.disabled ? "account.disable" : "account.reactivate",
      targetType: "user",
      targetId: userId,
      before: null,
      after: null,
    });
    result.disabled = body.disabled;
  }

  if (!Object.keys(result).length) return json({ error: "nothing to update" }, 400);
  return json(result, 200);
}
