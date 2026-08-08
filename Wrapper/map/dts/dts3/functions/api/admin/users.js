// functions/api/admin/users.js -- site_admin only.
// "user.create" is another additive extension to ACCESS-MODEL.md §7's
// action vocabulary, same reasoning as organization.create/update in
// functions/api/admin/organizations.js.

import { json, pgrst } from "../../_lib/access.js";
import { requireSiteAdmin, writeAudit, gotrue } from "../../_lib/admin.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const [authData, profiles, memberships] = await Promise.all([
    gotrue(env, "/admin/users?per_page=1000"),
    pgrst(env, "profiles?select=user_id,site_role"),
    pgrst(env, "organization_members?select=org_id,user_id,org_role,status,organizations(name,slug)"),
  ]);

  const siteRoleById = new Map(profiles.map((p) => [p.user_id, p.site_role]));
  const membershipsByUser = new Map();
  memberships.forEach((m) => {
    const list = membershipsByUser.get(m.user_id) || [];
    list.push({
      orgId: m.org_id,
      orgName: m.organizations ? m.organizations.name : "(deleted organization)",
      orgSlug: m.organizations ? m.organizations.slug : "",
      orgRole: m.org_role,
      status: m.status,
    });
    membershipsByUser.set(m.user_id, list);
  });

  const users = (authData.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      siteRole: siteRoleById.get(u.id) || "user",
      // GoTrue omits banned_until entirely for a never-banned user, and
      // leaves a PAST timestamp behind after an unban rather than clearing
      // it -- only a future timestamp means "currently banned".
      disabled: !!(u.banned_until && new Date(u.banned_until) > new Date()),
      createdAt: u.created_at,
      memberships: membershipsByUser.get(u.id) || [],
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return json({ users }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const email = (body && body.email || "").trim().toLowerCase();
  const password = body && body.password;
  if (!email || !password) return json({ error: "email and password are required" }, 400);
  if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);

  let created;
  try {
    created = await gotrue(env, "/admin/users", { method: "POST", body: { email, password, email_confirm: true } });
  } catch (err) {
    return json({ error: "couldn’t create account: " + err.message }, 400);
  }

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "user.create",
    targetType: "user",
    targetId: created.id,
    before: null,
    after: { email },
  });

  return json({ user: { id: created.id, email: created.email } }, 201);
}
