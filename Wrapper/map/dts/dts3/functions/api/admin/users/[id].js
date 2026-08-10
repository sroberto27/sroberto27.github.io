// functions/api/admin/users/[id].js -- site_admin only.
// site_role change and ban/unban (account.disable / account.reactivate)
// are independent axes -- a single PATCH may carry either or both, and each
// gets its own admin_audit row per ACCESS-MODEL.md §7's separate action
// names, not one combined entry.

import { json, pgrst, isUuid } from "../../../_lib/access.js";
import { requireSiteAdmin, writeAudit, gotrue } from "../../../_lib/admin.js";

export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const userId = params.id;
  if (!isUuid(userId)) return json({ error: "id must be a valid id" }, 400);

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

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const userId = params.id;
  if (!isUuid(userId)) return json({ error: "id must be a valid id" }, 400);

  // Found missing entirely in Phase 8's follow-up audit of the Admin Board
  // (only Disable existed anywhere for accounts). Two safety rails an admin
  // Disable never needed: never let a signed-in site_admin delete their OWN
  // account (their session would keep a valid token against a user that no
  // longer exists), and never delete the LAST remaining site_admin (would
  // lock everyone out of the Admin Board with no recovery path).
  if (userId === auth.userId) return json({ error: "you can't delete your own account while signed in as it" }, 400);

  let target;
  try {
    target = await gotrue(env, "/admin/users/" + userId);
  } catch (_) {
    return json({ error: "not found" }, 404);
  }

  const profileRows = await pgrst(env, `profiles?user_id=eq.${userId}&select=site_role`);
  const siteRole = profileRows.length ? profileRows[0].site_role : "user";
  if (siteRole === "site_admin") {
    const admins = await pgrst(env, `profiles?site_role=eq.site_admin&select=user_id`);
    if (admins.length <= 1) return json({ error: "can't delete the last remaining site_admin account" }, 400);
  }

  // auth.users(id) cascades automatically into profiles and
  // organization_members (both declared ON DELETE CASCADE), but three other
  // columns reference auth.users with NO cascade rule at all
  // (admin_audit.actor_user_id, events.user_id, resource_entitlements.
  // granted_by -- confirmed by reading the actual migration, not assumed) --
  // deleting a user who has ever performed an admin action, triggered an
  // event, or granted an entitlement would otherwise fail outright on a
  // foreign-key violation. Nulling these preserves the historical rows
  // (audit before/after snapshots still record what happened) while losing
  // only the now-meaningless live link to a deleted account.
  await pgrst(env, `admin_audit?actor_user_id=eq.${userId}`, { method: "PATCH", body: { actor_user_id: null } });
  await pgrst(env, `events?user_id=eq.${userId}`, { method: "PATCH", body: { user_id: null } });
  await pgrst(env, `resource_entitlements?granted_by=eq.${userId}`, { method: "PATCH", body: { granted_by: null } });
  // subject_id is polymorphic (org OR user), so it's deliberately NOT a real
  // foreign key (ACCESS-MODEL.md §2) -- a direct entitlement held BY this
  // user would silently orphan rather than block the delete unless removed
  // explicitly here.
  await pgrst(env, `resource_entitlements?subject_type=eq.user&subject_id=eq.${userId}`, { method: "DELETE", prefer: "return=minimal" });

  await gotrue(env, "/admin/users/" + userId, { method: "DELETE" });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    before: { email: target.email, site_role: siteRole },
    after: null,
  });

  return json({ ok: true }, 200);
}
