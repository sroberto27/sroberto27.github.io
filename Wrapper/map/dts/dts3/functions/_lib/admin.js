// Shared helpers for the Phase 5b Admin Board backend -- every Function
// under functions/api/admin/ (site_admin) and functions/api/org/ (org_admin,
// scoped to their own org) imports from here. All admin/org_admin mutations
// go through a Function using the service role, never a direct client-side
// Supabase write, because admin_audit has NO client insert policy at all
// (supabase/migrations/20260807220100_rls_policies.sql) -- only the service
// role can write it, so writing the audit trail has to happen in the same
// place as the mutation itself, not as a second, skippable client call.
// See docs/migration/ACCESS-MODEL.md §7-8.

import { pgrst, verifyUser, isSiteAdmin, isUuid, json } from "./access.js";

export async function requireSiteAdmin(request, env) {
  const userId = await verifyUser(request, env);
  if (!userId) return { response: json({ error: "sign-in required" }, 401) };
  if (!(await isSiteAdmin(userId, env))) return { response: json({ error: "site_admin required" }, 403) };
  return { userId };
}

export async function isOrgAdmin(userId, orgId, env) {
  const rows = await pgrst(
    env,
    `organization_members?user_id=eq.${userId}&org_id=eq.${orgId}&org_role=eq.org_admin&status=eq.active&select=org_id&limit=1`
  );
  return rows.length > 0;
}

// Authorizes a mutation scoped to one specific org_id -- site_admin may act
// on any org; an org_admin only on an org they are actually, currently
// org_admin of, re-checked here against their real membership row rather
// than trusted from whatever org_id the request claims (ACCESS-MODEL.md §8:
// "org_admin invite scope... own org only"). A caller who is org_admin at
// Acme and merely a member at Beta gets 403 the moment orgId is Beta's,
// regardless of what the request body says.
export async function requireOrgAdminOf(request, orgId, env) {
  const userId = await verifyUser(request, env);
  if (!userId) return { response: json({ error: "sign-in required" }, 401) };
  // Checked before anything else, even the site_admin bypass below: every
  // caller of this function goes on to splice orgId into a pgrst() filter
  // itself, so an invalid orgId must never reach isOrgAdmin() (see
  // access.js's isUuid() for exactly what this closes).
  if (!isUuid(orgId)) return { response: json({ error: "orgId must be a valid id" }, 400) };
  if (await isSiteAdmin(userId, env)) return { userId };
  if (!(await isOrgAdmin(userId, orgId, env))) {
    return { response: json({ error: "org_admin of this organization required" }, 403) };
  }
  return { userId };
}

// admin_audit row per docs/migration/ACCESS-MODEL.md §7. Never awaited by
// the caller into the same try/catch as the mutation's own error handling --
// a failed audit write after a successful mutation should be logged
// server-side, not roll back or mask the mutation's own result.
export async function writeAudit(env, { actorUserId, action, targetType, targetId, orgId, before, after }) {
  try {
    await pgrst(env, "admin_audit", {
      method: "POST",
      body: {
        actor_user_id: actorUserId,
        action,
        target_type: targetType || null,
        target_id: targetId != null ? String(targetId) : null,
        org_id: orgId || null,
        before: before == null ? null : before,
        after: after == null ? null : after,
      },
    });
  } catch (err) {
    console.error("[admin] audit write failed:", action, err);
  }
}

// GoTrue Admin API -- auth.users isn't exposed via PostgREST (only the
// public schema is), so anything touching real user accounts (creation,
// email lookup, ban/unban) goes through this instead of pgrst().
export async function gotrue(env, path, opts) {
  opts = opts || {};
  const resp = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;
  if (!resp.ok) throw new Error(`GoTrue admin ${resp.status}: ${text}`);
  return data;
}
