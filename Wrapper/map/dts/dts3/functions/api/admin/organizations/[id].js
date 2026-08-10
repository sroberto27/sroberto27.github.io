// functions/api/admin/organizations/[id].js -- site_admin only.
// Rename and/or change status (active/disabled -- "disable" never deletes;
// see functions/_lib/access.js's activeOrgIdsFor() for what disabling
// actually enforces at the gating layer).

import { json, pgrst, isUuid } from "../../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../../_lib/admin.js";

export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const id = params.id;
  if (!isUuid(id)) return json({ error: "id must be a valid id" }, 400);
  const existingRows = await pgrst(env, `organizations?id=eq.${id}&select=*`);
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
  if (body.slug != null) {
    const slug = String(body.slug).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "slug may only contain lowercase letters, numbers, and hyphens" }, 400);
    const collision = await pgrst(env, `organizations?slug=eq.${encodeURIComponent(slug)}&id=neq.${id}&select=id`);
    if (collision.length) return json({ error: "an organization with that slug already exists" }, 409);
    patch.slug = slug;
  }
  if (body.status != null) {
    if (body.status !== "active" && body.status !== "disabled") return json({ error: "status must be 'active' or 'disabled'" }, 400);
    patch.status = body.status;
  }
  if (!Object.keys(patch).length) return json({ error: "nothing to update" }, 400);

  const [updated] = await pgrst(env, `organizations?id=eq.${id}`, { method: "PATCH", body: patch });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "organization.update",
    targetType: "organization",
    targetId: id,
    orgId: id,
    before: existing,
    after: updated,
  });

  return json({ organization: updated }, 200);
}

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const id = params.id;
  if (!isUuid(id)) return json({ error: "id must be a valid id" }, 400);
  const existingRows = await pgrst(env, `organizations?id=eq.${id}&select=*`);
  if (!existingRows.length) return json({ error: "not found" }, 404);
  const existing = existingRows[0];

  // organization_members.org_id cascades automatically (ON DELETE CASCADE,
  // confirmed by reading the migration) -- no cleanup needed there. Three
  // other columns reference organizations with NO cascade at all
  // (admin_audit.org_id, events.org_id, resource_entitlements.subject_id
  // when subject_type='org') -- same reasoning as the user-delete endpoint's
  // own cleanup: null the audit/event link (history stays, the live
  // reference doesn't), and explicitly delete org-held entitlements since
  // subject_id is polymorphic and deliberately not a real foreign key.
  await pgrst(env, `admin_audit?org_id=eq.${id}`, { method: "PATCH", body: { org_id: null } });
  await pgrst(env, `events?org_id=eq.${id}`, { method: "PATCH", body: { org_id: null } });
  await pgrst(env, `resource_entitlements?subject_type=eq.org&subject_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });

  await pgrst(env, `organizations?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });

  // orgId deliberately omitted (stays null) -- the org this row is ABOUT no
  // longer exists the instant after this DELETE succeeds, and admin_audit.
  // org_id has no cascade, so setting it here would immediately re-create
  // the exact dangling reference the cleanup above just removed. The org's
  // identity is preserved in `before` instead.
  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "organization.delete",
    targetType: "organization",
    targetId: id,
    before: existing,
    after: null,
  });

  return json({ ok: true }, 200);
}
