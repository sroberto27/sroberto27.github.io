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

// opts.method defaults to GET (the only mode every existing caller in this
// file uses). opts.body/opts.prefer are for the Phase 5b admin Functions
// (functions/_lib/admin.js), which need POST/PATCH/DELETE against
// PostgREST -- service role bypasses RLS entirely for all of these, same as
// the read-only queries below.
export async function pgrst(env, queryPath, opts) {
  opts = opts || {};
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${queryPath}`, {
    method: opts.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(opts.body ? { "content-type": "application/json" } : {}),
      ...(opts.method && opts.method !== "GET" ? { Prefer: opts.prefer || "return=representation" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!resp.ok) throw new Error(`PostgREST ${resp.status}: ${await resp.text()}`);
  if (resp.status === 204) return null;
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

export async function isSiteAdmin(userId, env) {
  const rows = await pgrst(env, `profiles?user_id=eq.${userId}&select=site_role&limit=1`);
  return rows.length > 0 && rows[0].site_role === "site_admin";
}

// Requires the ORGANIZATION's own status to be active too (PostgREST's
// !inner embed + dot-filter on the embedded table), not just the membership
// row's status -- found while building the Phase 5b "disable an
// organization" feature and verified live before this fix existed: a
// disabled org's still-"active" membership rows previously kept granting
// client-level access with zero enforcement, making "disable" purely
// cosmetic. See docs/migration/PROGRESS.md for the reproduction.
async function activeOrgIdsFor(userId, env) {
  const rows = await pgrst(
    env,
    `organization_members?select=org_id,organizations!inner(status)&user_id=eq.${userId}&status=eq.active&organizations.status=eq.active`
  );
  return rows.map((r) => r.org_id);
}

async function hasActiveOrgMembership(userId, env) {
  const orgIds = await activeOrgIdsFor(userId, env);
  return orgIds.length > 0;
}

async function hasEntitlement(userId, resourceKey, env) {
  const directRows = await pgrst(
    env,
    `resource_entitlements?resource_key=eq.${encodeURIComponent(resourceKey)}&subject_type=eq.user&subject_id=eq.${userId}&select=id&limit=1`
  );
  if (directRows.length) return true;

  const orgIds = await activeOrgIdsFor(userId, env);
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
