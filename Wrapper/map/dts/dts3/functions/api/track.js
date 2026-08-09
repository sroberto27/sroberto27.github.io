// DTS migration -- Phase 9. Writes one row to the `events` table (product
// analytics -- ACCESS-MODEL.md §6), deliberately separate from admin_audit
// (§7). Unlike admin_audit (service-role-only insert), events_insert's RLS
// policy allows any caller -- anon or authenticated -- to insert directly
// with the anon key. This Function exists anyway, and js/app.js is expected
// to call it rather than write to Supabase directly, for one reason: only a
// server-side process can be trusted to stamp user_id/org_id correctly. A
// client-side insert could claim any org_id it wants; RLS's `with check
// (true)` on events_insert does not stop that, it only stops a WRITE from
// being rejected, not a forged column value.

import { json, pgrst, verifyUser, activeOrgIdsFor } from "../_lib/access.js";

// ACCESS-MODEL.md §6, plus four Phase 9 additions (see that section's own
// dated addendum): lead_submit/lead_fallback (the lead form had zero
// analytics before this phase), sector_view (category nav never changes the
// URL, so nothing else would ever see it), faq_search (the "Ask a Question"
// bar is a real feature, not decorative).
const EVENT_TYPES = new Set([
  "project_view", "experience_preview", "login_gate", "login", "register",
  "experience_open", "experience_close", "map_open",
  "download_view", "download_start", "download_complete",
  "lead_submit", "lead_fallback", "sector_view", "faq_search",
]);

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "invalid JSON body" }, 400);

  // The whole point of this Function: user_id/org_id are NEVER trusted from
  // the request, even if a caller helpfully tries to supply the "right"
  // value. Reject outright rather than silently discard, so a client bug
  // that thinks it's stamping these fields is visible instead of quietly
  // no-op'd.
  if ("user_id" in body || "org_id" in body) {
    return json({ error: "user_id/org_id are stamped server-side, not accepted in the body" }, 400);
  }

  const { type, resource_key, project_id, metadata, anon_id } = body;
  if (typeof type !== "string" || !EVENT_TYPES.has(type)) {
    return json({ error: "type must be one of: " + Array.from(EVENT_TYPES).join(", ") }, 400);
  }
  if (resource_key != null && typeof resource_key !== "string") return json({ error: "resource_key must be a string" }, 400);
  if (project_id != null && typeof project_id !== "string") return json({ error: "project_id must be a string" }, 400);
  if (anon_id != null && typeof anon_id !== "string") return json({ error: "anon_id must be a string" }, 400);
  if (metadata != null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    return json({ error: "metadata must be a plain object" }, 400);
  }

  const userId = await verifyUser(request, env);

  // "Active org context" only has one honest answer when it's unambiguous:
  // this app has no org-switcher (a session can belong to several orgs at
  // once -- ACCESS-MODEL.md §1), so a user in exactly one active org gets it
  // stamped; zero or more than one both resolve to null rather than guess
  // which org an event actually belongs to. Guest requests (no userId) are
  // always null here, same as they always were.
  let orgId = null;
  if (userId) {
    const orgIds = await activeOrgIdsFor(userId, env);
    if (orgIds.length === 1) orgId = orgIds[0];
  }

  try {
    await pgrst(env, "events", {
      method: "POST",
      body: {
        type,
        user_id: userId || null,
        anon_id: anon_id || null,
        org_id: orgId,
        resource_key: resource_key || null,
        project_id: project_id || null,
        metadata: metadata || null,
      },
      prefer: "return=minimal",
    });
  } catch (err) {
    // Analytics must never break the feature it's observing -- log and
    // still return 200-shaped success semantics to a caller that (by
    // design, see every call site in js/app.js) never awaits this
    // meaningfully anyway.
    console.error("[track] insert failed:", type, err);
    return json({ ok: false }, 200);
  }

  return json({ ok: true }, 201);
}
