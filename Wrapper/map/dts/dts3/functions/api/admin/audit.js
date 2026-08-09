// functions/api/admin/audit.js -- site_admin only, read-only.
// admin_audit (ACCESS-MODEL.md §7) has no client insert policy at all
// (only the service role, via functions/_lib/admin.js's writeAudit(), ever
// writes it) and its select policy is is_site_admin()-only -- a direct
// client-side read would work under RLS, but this project's established
// pattern for every OTHER Admin Board list screen (organizations, users,
// entitlements) is a Function that resolves actor/subject labels via the
// GoTrue Admin API, since auth.users isn't reachable through PostgREST.
// Consistent with that, not a new pattern.

import { json, pgrst } from "../../_lib/access.js";
import { requireSiteAdmin, gotrue } from "../../_lib/admin.js";

async function allUserEmails(env) {
  const data = await gotrue(env, "/admin/users?per_page=1000");
  const map = new Map();
  (data.users || []).forEach((u) => map.set(u.id, u.email));
  return map;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  // Bounded, not user-configurable beyond a sane ceiling -- this is a
  // read-only debugging/oversight view, not a paginated report builder.
  const limit = Math.min(parseInt(url.searchParams.get("limit"), 10) || 100, 500);

  const rows = await pgrst(env, `admin_audit?select=*&order=occurred_at.desc&limit=${limit}`);
  const userEmailById = await allUserEmails(env);

  const entries = rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    actorEmail: userEmailById.get(r.actor_user_id) || "(deleted user)",
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    orgId: r.org_id,
    before: r.before,
    after: r.after,
  }));

  return json({ entries }, 200);
}
