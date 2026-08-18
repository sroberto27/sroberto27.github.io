// functions/api/admin/organizations/[id]/domains.js -- site_admin only.
// List/add email-domain mappings for one organization -- the CMS side of
// the email-domain auto org-assignment feature (see the
// org_email_domains migration and handle_new_user() for the matching
// logic these rows feed). "org_domain.add"/"org_domain.update"/
// "org_domain.remove" are an additive extension to ACCESS-MODEL.md §7's
// action vocabulary, same precedent as "organization.create"/"update".

import { json, pgrst, isUuid } from "../../../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../../../_lib/admin.js";

// Not a full RFC validator (same posture as organizations.js's slug regex):
// just enough to reject blanks, stray "@"/scheme prefixes, and whitespace.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function normalizeDomain(raw) {
  return String(raw || "").trim().toLowerCase();
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const orgId = params.id;
  if (!isUuid(orgId)) return json({ error: "id must be a valid id" }, 400);

  const domains = await pgrst(env, `organization_email_domains?org_id=eq.${orgId}&select=id,domain,created_at&order=domain.asc`);
  return json({ domains }, 200);
}

export async function onRequestPost(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const orgId = params.id;
  if (!isUuid(orgId)) return json({ error: "id must be a valid id" }, 400);

  const orgRows = await pgrst(env, `organizations?id=eq.${orgId}&select=id`);
  if (!orgRows.length) return json({ error: "organization not found" }, 404);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const domain = normalizeDomain(body && body.domain);
  if (!domain) return json({ error: "domain is required" }, 400);
  if (!DOMAIN_RE.test(domain)) return json({ error: "domain doesn't look like a valid domain (e.g. \"louisiana.edu\")" }, 400);

  // domain is already normalized (lowercased) above, and every stored row
  // is normalized the same way on write -- a plain eq. match against the
  // lowercase index is exact and avoids ilike's %/_ wildcard-escaping
  // pitfalls entirely.
  const collision = await pgrst(env, `organization_email_domains?domain=eq.${encodeURIComponent(domain)}&select=id,org_id`);
  if (collision.length) {
    return json({ error: collision[0].org_id === orgId
      ? "that domain is already configured for this organization"
      : "that domain is already assigned to a different organization" }, 409);
  }

  const [inserted] = await pgrst(env, "organization_email_domains", {
    method: "POST",
    body: { org_id: orgId, domain },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "org_domain.add",
    targetType: "organization_email_domain",
    targetId: inserted.id,
    orgId,
    before: null,
    after: { domain: inserted.domain },
  });

  return json({ domain: inserted }, 201);
}
