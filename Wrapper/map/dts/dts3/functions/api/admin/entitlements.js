// functions/api/admin/entitlements.js -- site_admin only.
// resource_entitlements lives in Postgres, never /data (ACCESS-MODEL.md §5)
// -- this is the one editor surface in the Admin Board that writes live
// instead of through the draft/export path.

import { json, pgrst } from "../../_lib/access.js";
import { requireSiteAdmin, writeAudit, gotrue } from "../../_lib/admin.js";

async function allUserEmails(env) {
  const data = await gotrue(env, "/admin/users?per_page=1000");
  const map = new Map();
  (data.users || []).forEach((u) => map.set(u.id, u.email));
  return map;
}

async function resolveSubjectLabel(row, env, userEmailById) {
  if (row.subject_type === "org") {
    const orgs = await pgrst(env, `organizations?id=eq.${row.subject_id}&select=name,slug`);
    return orgs[0] ? `${orgs[0].name} (${orgs[0].slug})` : "(deleted organization)";
  }
  return userEmailById.get(row.subject_id) || "(deleted user)";
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const resourceKey = url.searchParams.get("resource_key");
  if (!resourceKey) return json({ error: "resource_key is required" }, 400);

  const rows = await pgrst(
    env,
    `resource_entitlements?resource_key=eq.${encodeURIComponent(resourceKey)}&select=*&order=created_at.desc`
  );
  const userEmailById = await allUserEmails(env);
  const entitlements = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      label: await resolveSubjectLabel(r, env, userEmailById),
      createdAt: r.created_at,
    }))
  );
  return json({ entitlements }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const { resourceKey, subjectType, subjectId } = body || {};
  if (!resourceKey || (subjectType !== "org" && subjectType !== "user") || !subjectId) {
    return json({ error: "resourceKey, subjectType ('org'|'user'), and subjectId are required" }, 400);
  }

  // Confirm the subject actually exists before granting -- a typo'd id
  // would otherwise silently create a dangling, unusable entitlement row.
  if (subjectType === "org") {
    const orgs = await pgrst(env, `organizations?id=eq.${subjectId}&select=id`);
    if (!orgs.length) return json({ error: "no organization with that id" }, 404);
  } else {
    const userEmailById = await allUserEmails(env);
    if (!userEmailById.has(subjectId)) return json({ error: "no user with that id" }, 404);
  }

  const [inserted] = await pgrst(env, "resource_entitlements", {
    method: "POST",
    body: { resource_key: resourceKey, subject_type: subjectType, subject_id: subjectId, granted_by: auth.userId },
  });

  // ACCESS-MODEL.md §7 reserves a distinct "download.assign" verb (this
  // Function is shared across every resource type -- project/gismap/download
  // -- so it's the one place that can tell the difference); everything else
  // still logs the generic "entitlement.grant" it always has. There's no
  // symmetric "download.unassign" in the spec's vocabulary, so revoke below
  // stays "entitlement.revoke" for every resource type, downloads included.
  await writeAudit(env, {
    actorUserId: auth.userId,
    action: resourceKey.startsWith("download.") ? "download.assign" : "entitlement.grant",
    targetType: subjectType,
    targetId: subjectId,
    before: null,
    after: { resource_key: resourceKey, subject_type: subjectType, subject_id: subjectId },
  });

  return json({ entitlement: inserted }, 201);
}
