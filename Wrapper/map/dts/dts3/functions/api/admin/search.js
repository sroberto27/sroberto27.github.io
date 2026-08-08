// functions/api/admin/search.js -- site_admin only.
// Backs every org/user picker in the Admin Board (the entitlement editor,
// and the Users/Organizations screens) -- a live lookup against Postgres
// organizations + GoTrue's user list, not window.DTS_CONTENT.docs
// (fDocPicker() only ever searches /data documents, which orgs/users are
// never part of).

import { json, pgrst } from "../../_lib/access.js";
import { requireSiteAdmin, gotrue } from "../../_lib/admin.js";

// Strips characters meaningful to PostgREST's own filter mini-syntax
// (`,` separates or() clauses, `()` group them, `*` is the ilike wildcard)
// so a search term can't accidentally -- or deliberately -- reshape the
// query it's embedded in. Trusted (site_admin-only) input either way, but
// cheap to do properly.
function sanitize(q) {
  return q.replace(/[,()*]/g, "");
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const q = sanitize((url.searchParams.get("q") || "").trim());
  if (type !== "org" && type !== "user") return json({ error: "type must be 'org' or 'user'" }, 400);
  if (q.length < 2) return json({ results: [] }, 200);

  if (type === "org") {
    const rows = await pgrst(
      env,
      `organizations?or=(name.ilike.*${encodeURIComponent(q)}*,slug.ilike.*${encodeURIComponent(q)}*)&select=id,name,slug,status&order=name.asc&limit=10`
    );
    return json({
      results: rows.map((o) => ({
        id: o.id,
        label: o.name + " (" + o.slug + ")" + (o.status !== "active" ? " -- disabled" : ""),
      })),
    }, 200);
  }

  const data = await gotrue(env, "/admin/users?per_page=1000");
  const needle = q.toLowerCase();
  const results = (data.users || [])
    .filter((u) => (u.email || "").toLowerCase().includes(needle))
    .slice(0, 10)
    .map((u) => ({ id: u.id, label: u.email }));
  return json({ results }, 200);
}
