// functions/api/org/members.js -- org_admin (own org only) OR site_admin.
// Shared by the site_admin Users screen's "assign to org" action AND
// (Checkpoint C) org_admin's own team panel -- one authorization model,
// one place membership.add/remove/org_role.change get audited, instead of
// two endpoints that could drift apart. requireOrgAdminOf() re-derives the
// caller's real org_admin status for the SPECIFIC orgId in the request from
// their own membership row server-side; it never trusts orgId itself.
//
// "Invite a brand-new user by email" (ACCESS-MODEL.md §8's org_admin invite
// scope) is NOT here yet -- that needs its own rate-limiting and
// invite.send audit handling, added in Checkpoint C. POST here only adds an
// EXISTING account to an org.

import { json, pgrst } from "../../_lib/access.js";
import { requireOrgAdminOf, writeAudit, gotrue } from "../../_lib/admin.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const orgId = url.searchParams.get("org_id");
  if (!orgId) return json({ error: "org_id is required" }, 400);
  const auth = await requireOrgAdminOf(request, orgId, env);
  if (auth.response) return auth.response;

  const rows = await pgrst(env, `organization_members?org_id=eq.${orgId}&select=user_id,org_role,status,created_at&order=created_at.asc`);
  const data = await gotrue(env, "/admin/users?per_page=1000");
  const emailById = new Map((data.users || []).map((u) => [u.id, u.email]));
  const members = rows.map((r) => ({
    userId: r.user_id,
    email: emailById.get(r.user_id) || "(deleted user)",
    orgRole: r.org_role,
    status: r.status,
    createdAt: r.created_at,
  }));
  return json({ members }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const orgId = body && body.orgId;
  if (!orgId) return json({ error: "orgId is required" }, 400);
  const auth = await requireOrgAdminOf(request, orgId, env);
  if (auth.response) return auth.response;

  const email = ((body && body.email) || "").trim().toLowerCase();
  const orgRole = body.orgRole === "org_admin" ? "org_admin" : "member";
  if (!email) return json({ error: "email is required" }, 400);

  const data = await gotrue(env, "/admin/users?per_page=1000");
  const user = (data.users || []).find((u) => (u.email || "").toLowerCase() === email);
  if (!user) return json({ error: "no existing user with that email -- inviting a brand-new user isn't available yet" }, 404);

  const existingMembership = await pgrst(env, `organization_members?org_id=eq.${orgId}&user_id=eq.${user.id}&select=user_id`);
  if (existingMembership.length) return json({ error: "already a member of this organization" }, 409);

  const [inserted] = await pgrst(env, "organization_members", {
    method: "POST",
    body: { org_id: orgId, user_id: user.id, org_role: orgRole, status: "active" },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "membership.add",
    targetType: "user",
    targetId: user.id,
    orgId,
    before: null,
    after: { org_role: orgRole, status: "active" },
  });

  return json({ member: { userId: user.id, email: user.email, orgRole: inserted.org_role, status: inserted.status } }, 201);
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const orgId = body && body.orgId;
  const userId = body && body.userId;
  if (!orgId || !userId) return json({ error: "orgId and userId are required" }, 400);
  const auth = await requireOrgAdminOf(request, orgId, env);
  if (auth.response) return auth.response;

  if (body.orgRole !== "member" && body.orgRole !== "org_admin") return json({ error: "orgRole must be 'member' or 'org_admin'" }, 400);

  const existingRows = await pgrst(env, `organization_members?org_id=eq.${orgId}&user_id=eq.${userId}&select=*`);
  if (!existingRows.length) return json({ error: "not a member of this organization" }, 404);

  const [updated] = await pgrst(env, `organization_members?org_id=eq.${orgId}&user_id=eq.${userId}`, {
    method: "PATCH",
    body: { org_role: body.orgRole },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "org_role.change",
    targetType: "user",
    targetId: userId,
    orgId,
    before: { org_role: existingRows[0].org_role },
    after: { org_role: body.orgRole },
  });

  return json({ member: updated }, 200);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const orgId = url.searchParams.get("org_id");
  const userId = url.searchParams.get("user_id");
  if (!orgId || !userId) return json({ error: "org_id and user_id are required" }, 400);
  const auth = await requireOrgAdminOf(request, orgId, env);
  if (auth.response) return auth.response;

  const existingRows = await pgrst(env, `organization_members?org_id=eq.${orgId}&user_id=eq.${userId}&select=*`);
  if (!existingRows.length) return json({ error: "not a member of this organization" }, 404);

  await pgrst(env, `organization_members?org_id=eq.${orgId}&user_id=eq.${userId}`, { method: "DELETE", prefer: "return=minimal" });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "membership.remove",
    targetType: "user",
    targetId: userId,
    orgId,
    before: existingRows[0],
    after: null,
  });

  return json({ ok: true }, 200);
}
