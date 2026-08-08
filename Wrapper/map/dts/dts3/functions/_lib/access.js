// Shared resolver helpers -- imported by functions/api/resource/[key].js and
// functions/api/resource/gismap/[mapId]/layer/[layerId].js. Files/dirs under
// functions/_lib/ are NOT routes (Pages Functions convention: a leading `_`
// excludes a path from routing).
//
// Env bindings required: DTS_CONTENT (R2). Env vars/secrets required:
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

export function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function getSourceJson(env, path) {
  const obj = await env.DTS_CONTENT.get(`data/source/${path}`);
  if (!obj) return null;
  return await obj.json();
}

export async function verifyUser(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!resp.ok) return null; // expired/invalid token -> treat as guest, not an error
    const data = await resp.json();
    return data.id || null;
  } catch (_) {
    return null;
  }
}

async function pgrst(env, queryPath) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${queryPath}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resp.ok) throw new Error(`PostgREST ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

async function isSiteAdmin(userId, env) {
  const rows = await pgrst(env, `profiles?user_id=eq.${userId}&select=site_role&limit=1`);
  return rows.length > 0 && rows[0].site_role === "site_admin";
}

async function hasActiveOrgMembership(userId, env) {
  const rows = await pgrst(env, `organization_members?user_id=eq.${userId}&status=eq.active&select=org_id&limit=1`);
  return rows.length > 0;
}

async function hasEntitlement(userId, resourceKey, env) {
  const directRows = await pgrst(
    env,
    `resource_entitlements?resource_key=eq.${encodeURIComponent(resourceKey)}&subject_type=eq.user&subject_id=eq.${userId}&select=id&limit=1`
  );
  if (directRows.length) return true;

  const memberships = await pgrst(env, `organization_members?user_id=eq.${userId}&status=eq.active&select=org_id`);
  const orgIds = memberships.map((m) => m.org_id);
  if (!orgIds.length) return false;

  const orFilter = orgIds.map((id) => `subject_id.eq.${id}`).join(",");
  const orgRows = await pgrst(
    env,
    `resource_entitlements?resource_key=eq.${encodeURIComponent(resourceKey)}&subject_type=eq.org&or=(${orFilter})&select=id&limit=1`
  );
  return orgRows.length > 0;
}

export async function checkAccess(level, userId, resourceKey, env) {
  if (level === "public") return true;
  if (!userId) return false; // registered/client/restricted all require SOME session
  if (level === "registered") return true;
  // site_admin sees every client/restricted resource regardless of org
  // membership or a specific entitlement row (ACCESS-MODEL.md §8: "Open
  // client resources for own org" / "Open restricted resources entitled to
  // them" -> "yes (all)" for site_admin) -- checked once here rather than
  // duplicated into both branches below.
  if (level === "client" || level === "restricted") {
    if (await isSiteAdmin(userId, env)) return true;
  }
  if (level === "client") return await hasActiveOrgMembership(userId, env);
  if (level === "restricted") return await hasEntitlement(userId, resourceKey, env);
  return false; // unrecognized level -- deny by default
}
