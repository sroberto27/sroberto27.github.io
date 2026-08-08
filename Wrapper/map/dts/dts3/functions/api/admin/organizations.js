// functions/api/admin/organizations.js -- site_admin only.
// "organization.create"/"organization.update" are an additive extension to
// ACCESS-MODEL.md §7's action vocabulary -- that list never enumerated an
// action for the organization row itself (only membership/role/entitlement
// changes within one), a gap found while building this screen. See
// docs/migration/PROGRESS.md.

import { json, pgrst } from "../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../_lib/admin.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const orgs = await pgrst(env, "organizations?select=id,name,slug,status,created_at&order=name.asc");
  return json({ organizations: orgs }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const name = (body && body.name || "").trim();
  const slug = (body && body.slug || "").trim().toLowerCase();
  if (!name || !slug) return json({ error: "name and slug are required" }, 400);
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "slug may only contain lowercase letters, numbers, and hyphens" }, 400);

  const existing = await pgrst(env, `organizations?slug=eq.${encodeURIComponent(slug)}&select=id`);
  if (existing.length) return json({ error: "an organization with that slug already exists" }, 409);

  const [inserted] = await pgrst(env, "organizations", { method: "POST", body: { name, slug } });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "organization.create",
    targetType: "organization",
    targetId: inserted.id,
    orgId: inserted.id,
    before: null,
    after: { name: inserted.name, slug: inserted.slug, status: inserted.status },
  });

  return json({ organization: inserted }, 201);
}
