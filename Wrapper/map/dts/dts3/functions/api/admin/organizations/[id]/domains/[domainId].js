// functions/api/admin/organizations/[id]/domains/[domainId].js -- site_admin only.
// Edit/remove one email-domain mapping. See ../domains.js for GET/POST and
// the feature's full rationale.

import { json, pgrst, isUuid } from "../../../../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../../../../_lib/admin.js";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function normalizeDomain(raw) {
  return String(raw || "").trim().toLowerCase();
}

export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const orgId = params.id;
  const domainId = params.domainId;
  if (!isUuid(orgId)) return json({ error: "id must be a valid id" }, 400);
  if (!isUuid(domainId)) return json({ error: "domainId must be a valid id" }, 400);

  const existingRows = await pgrst(env, `organization_email_domains?id=eq.${domainId}&org_id=eq.${orgId}&select=*`);
  if (!existingRows.length) return json({ error: "not found" }, 404);
  const existing = existingRows[0];

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const domain = normalizeDomain(body && body.domain);
  if (!domain) return json({ error: "domain is required" }, 400);
  if (!DOMAIN_RE.test(domain)) return json({ error: "domain doesn't look like a valid domain (e.g. \"louisiana.edu\")" }, 400);

  const collision = await pgrst(env, `organization_email_domains?domain=eq.${encodeURIComponent(domain)}&id=neq.${domainId}&select=id,org_id`);
  if (collision.length) {
    return json({ error: collision[0].org_id === orgId
      ? "that domain is already configured for this organization"
      : "that domain is already assigned to a different organization" }, 409);
  }

  const [updated] = await pgrst(env, `organization_email_domains?id=eq.${domainId}`, {
    method: "PATCH",
    body: { domain },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "org_domain.update",
    targetType: "organization_email_domain",
    targetId: domainId,
    orgId,
    before: { domain: existing.domain },
    after: { domain: updated.domain },
  });

  return json({ domain: updated }, 200);
}

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const orgId = params.id;
  const domainId = params.domainId;
  if (!isUuid(orgId)) return json({ error: "id must be a valid id" }, 400);
  if (!isUuid(domainId)) return json({ error: "domainId must be a valid id" }, 400);

  const existingRows = await pgrst(env, `organization_email_domains?id=eq.${domainId}&org_id=eq.${orgId}&select=*`);
  if (!existingRows.length) return json({ error: "not found" }, 404);
  const existing = existingRows[0];

  await pgrst(env, `organization_email_domains?id=eq.${domainId}`, { method: "DELETE", prefer: "return=minimal" });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "org_domain.remove",
    targetType: "organization_email_domain",
    targetId: domainId,
    orgId,
    before: { domain: existing.domain },
    after: null,
  });

  return json({ ok: true }, 200);
}
