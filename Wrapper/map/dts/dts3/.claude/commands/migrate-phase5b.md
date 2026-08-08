---
description: Phase 5b — CMS access-level editors + organization/user management (extends the Admin Board)
---

Phase 5b of the DTS migration. Prerequisite: Phase 5 done (site_admin routing
live, org_admin correctly excluded from the Admin Board). Re-read golden rules
+ do-not-break list. **Plan first, execute after approval.**
Read `docs/migration/ACCESS-MODEL.md` first — every screen in this phase edits
data whose shape it defines.

Why this is its own phase: folding a whole admin UI (access-level dropdowns on
every project/experience/link, plus organization/user/membership management)
into Phase 5's auth-routing gate would make that gate's acceptance check
untestable in isolation. This phase is pure CMS surface — it adds no new auth
mechanism, only new places for `site_admin` and `org_admin` to act on the model
Phases 3-5 already built.

Extends the existing Admin Board (`js/admin.js`, `buildNav()`
`admin.js:2576-2620`). Do NOT create a second admin system.

Plan, then do:

1. **New top-level nav sections, `site_admin` only**: Organizations, Users,
   Access. Add to `buildNav()` alongside SITE / CATEGORY PAGES / PROJECTS /
   GIS MAPS — same list style, same `select()` dispatch pattern
   (`admin.js:2629-2667`).

2. **Access editors on existing screens** — an `access` dropdown
   (`inherit`/`public`/`registered`/`client`/`restricted`, with `inherit`
   hidden on the project's own top-level dropdown since a project has nothing
   to inherit from) added to:
   - the project editor, for the project's own default level;
   - each row in the project's `experiences[]` editor;
   - each row in the project's `links[]` editor (the `automotive`/`campus`
     leak vector from Phase 4 — this is where an editor sets those to
     `registered` going forward, and where any NEW project's links get a
     level from day one instead of shipping ungated by omission);
   - the GIS map editor, for `gismap.<id>` resources.
   Saving writes the `access` field into the document exactly as
   `ACCESS-MODEL.md` §5 specifies — through the SAME draft →
   `dtsAdminDraft` → export/publish path every other field already uses. No
   separate save mechanism.

3. **Restricted-resource entitlement picker.** When a row's resolved access is
   `restricted`, show an org/user picker (search by org name or user email)
   that calls a new admin Function to write/delete `resource_entitlements`
   rows — this table lives in Postgres, not `/data` (per `ACCESS-MODEL.md`
   §5), so this is the one editor in the board that does NOT go through the
   draft/export path; it calls the API directly and reflects the current
   grants live.

4. **Organizations screen** (`site_admin`): list, create, rename, disable
   organizations. Disabling an org does not delete its `organization_members`
   or `resource_entitlements` rows — it flips `status`, and Phase 4's gating
   already treats a non-`active` membership as not granting `client`-level
   access (re-verify this specific case here).

5. **Users screen** (`site_admin`): list users with their `site_role` and org
   memberships; create a user (via the Supabase Admin API, dev-only password
   or invite email per environment); assign to one or more orgs with a role
   per org; promote/demote `site_role` between `user`/`site_admin`;
   activate/deactivate an account. Every mutation writes an `admin_audit` row
   per `ACCESS-MODEL.md` §7 (`site_role.change`, `membership.add`, etc.) via
   the service role — never a client-side insert.

6. **Access screen** (`site_admin`): a flat read-only index of every
   `resource_key` in the system with its resolved level and, for
   `restricted` rows, its current entitlements — a debugging/audit view over
   what's otherwise scattered across many project editors.

7. **Org-admin surface** — a SEPARATE, much smaller panel reachable from the
   client portal's "Manage your team" entry point (added by Phase 5, gated to
   `org_role === 'org_admin'`), not from the Admin Board nav:
   - list current members of their own org;
   - add an existing user (by email) to their org as `member`;
   - invite a NEW user by email — creates the account (or a pending invite)
     already bound to their org as `member`; per `ACCESS-MODEL.md` §8 this is
     unrestricted by email domain but IS rate-limited server-side and logged
     as `invite.send` in `admin_audit`;
   - remove a member from their org;
   - toggle a member between `member` and `org_admin`, scoped to their own
     org only;
   - view (read-only) which resources are currently entitled to their org.
   Every one of these calls a Function that re-derives the caller's `org_id`
   and `org_role` from their JWT server-side and ignores any `org_id` sent in
   the request body — an org_admin must never be able to act on an org they
   don't belong to by editing a request. Test this adversarially: have
   `testorgadmin` (Acme) attempt to add/remove a member of Beta Municipal by
   crafting the request directly; confirm it 403s.

8. **No raw SQL / query console anywhere.** Every screen above is a specific,
   constrained UI over a specific mutation — resist the temptation to add a
   generic "run a query" admin feature even for convenience.

9. **Test**: `site_admin` can reach and use all three new nav sections and
   edit access levels on a real project; `org_admin` sees ONLY the team panel
   and only for their own org; a plain `member` sees no admin surface at all;
   the adversarial cross-org test in step 7 fails closed. Zip export and
   normal content editing (SITE/CATEGORY/PROJECTS/GIS) still work unchanged.
   Update `PROGRESS.md`. Stop. Next: `/migrate-phase6`.
