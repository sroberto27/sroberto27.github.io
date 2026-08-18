// functions/api/org/invite.js -- org_admin (own org) OR site_admin.
// Distinct from functions/api/org/members.js's POST (which only ADDS an
// EXISTING account): this creates a brand-new account -- dev: the admin
// sets a temporary password directly, same pattern as
// functions/api/admin/users.js, since there's no working invite-email
// delivery until custom SMTP is configured (ACCOUNT-SETUP-AND-HANDOFF.md
// §7) -- already bound to the org as a member. Rate-limited server-side
// per ACCESS-MODEL.md §8 ("unrestricted by email domain... but IS
// rate-limited"), using admin_audit itself as the ledger (no new table),
// and audited as invite.send, a distinct action from user.create since
// it's simultaneously an account creation AND a membership grant.

import { json, pgrst } from "../../_lib/access.js";
import { requireOrgAdminOf, writeAudit, gotrue } from "../../_lib/admin.js";

const INVITE_RATE_LIMIT = 20; // per actor, per rolling hour -- generous for a real onboarding batch, low enough to blunt abuse
const INVITE_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "invalid JSON body" }, 400); }
  const orgId = body && body.orgId;
  if (!orgId) return json({ error: "orgId is required" }, 400);
  const auth = await requireOrgAdminOf(request, orgId, env);
  if (auth.response) return auth.response;

  const email = ((body && body.email) || "").trim().toLowerCase();
  const password = body && body.password;
  const orgRole = body.orgRole === "org_admin" ? "org_admin" : "member";
  if (!email || !password) return json({ error: "email and password are required" }, 400);
  if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);

  const since = new Date(Date.now() - INVITE_RATE_WINDOW_MS).toISOString();
  const recentInvites = await pgrst(
    env,
    `admin_audit?actor_user_id=eq.${auth.userId}&action=eq.invite.send&occurred_at=gte.${since}&select=id`
  );
  if (recentInvites.length >= INVITE_RATE_LIMIT) {
    return json({ error: "Too many invites sent recently — try again later." }, 429);
  }

  const existingUsers = await gotrue(env, "/admin/users?per_page=1000");
  if ((existingUsers.users || []).some((u) => (u.email || "").toLowerCase() === email)) {
    return json({ error: "a user with that email already exists — add them instead of inviting" }, 409);
  }

  let created;
  try {
    created = await gotrue(env, "/admin/users", { method: "POST", body: { email, password, email_confirm: true } });
  } catch (err) {
    return json({ error: "couldn’t create account: " + err.message }, 400);
  }

  // Upsert on the real PK, not a plain insert: the new email-domain
  // auto-assignment trigger (handle_new_user(), see the
  // org_email_domains migration) may have already inserted this exact
  // (org_id, user_id) row -- inside the same transaction as the
  // gotrue() call just above, which only returns after that trigger
  // commits -- if this org's domain happens to match the invitee's
  // email. merge-duplicates makes this idempotent against that race
  // instead of throwing on the PK conflict; the invite's own requested
  // org_role always wins on merge, so it never gets silently stuck at
  // the trigger's default 'member'. Safe specifically because the
  // existingUsers check above already rejected the case where the
  // email pre-existed, so any pre-existing row here can only be the one
  // this same request's trigger just created.
  const [membership] = await pgrst(env, "organization_members?on_conflict=org_id,user_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { org_id: orgId, user_id: created.id, org_role: orgRole, status: "active" },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "invite.send",
    targetType: "user",
    targetId: created.id,
    orgId,
    before: null,
    after: { email, org_role: orgRole },
  });

  return json({ member: { userId: created.id, email, orgRole: membership.org_role, status: membership.status } }, 201);
}
