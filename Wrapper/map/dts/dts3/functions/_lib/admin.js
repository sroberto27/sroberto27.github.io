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

// Requires the ORGANIZATION's own status to be active too, not just the
// membership row's -- the same !inner embed + dot-filter access.js's
// activeOrgIdsFor() uses, and for the same reason. Without it, disabling an
// organization left its org_admin still able to manage members through
// /api/org/members and still able to create brand-new accounts through
// /api/org/invite, because both authorize through requireOrgAdminOf() ->
// here. Security audit 2026-09-06, finding F-S01 (the Function-path half; the
// RLS half is 20260906190100_org_status_in_rls_helpers.sql).
export async function isOrgAdmin(userId, orgId, env) {
  const rows = await pgrst(
    env,
    `organization_members?select=org_id,organizations!inner(status)&user_id=eq.${userId}&org_id=eq.${orgId}&org_role=eq.org_admin&status=eq.active&organizations.status=eq.active&limit=1`
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

// The full user directory (up to 1000 users) -- used only to resolve ids to
// emails for display, never for an access decision -- was being re-fetched
// from GoTrue independently by every admin/org endpoint that needed it, with
// no cache between them. This is a best-effort, per-isolate microcache, not
// a correctness mechanism: Cloudflare doesn't guarantee an isolate survives
// between requests, so a cache miss (cold isolate) just falls back to
// exactly today's behavior -- one real GoTrue call. A short TTL keeps a
// stale-roster window small; invalidateUserListCache() (called after any
// mutation that changes who exists -- create/delete, see call sites) also
// clears it immediately within the same isolate, which is the common case
// for one admin doing a create-then-view in quick succession.
let userListCache = null; // { data, expiresAt }
const USER_LIST_CACHE_MS = 30000;

export async function listAllUsers(env) {
  const now = Date.now();
  if (userListCache && userListCache.expiresAt > now) return userListCache.data;
  const data = await gotrue(env, "/admin/users?per_page=1000");
  userListCache = { data, expiresAt: now + USER_LIST_CACHE_MS };
  return data;
}

export function invalidateUserListCache() {
  userListCache = null;
}
