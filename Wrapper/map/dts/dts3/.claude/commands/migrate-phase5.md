---
description: Phase 5 — Swap admin auth in admin.js to site_role, distinct from org_admin
---

Phase 5 of the DTS migration. Prerequisite: Phase 4 done (client login works via
Supabase, resource gating live). Re-read golden rules + do-not-break list.
**Plan first, execute after approval.** Read `docs/migration/ACCESS-MODEL.md`
first — it defines `site_role` and `org_role` as separate axes; this phase must
not collapse them back into one flag.

Goal: admin sign-in goes through the SAME Supabase login as clients; the Admin
Board (site-wide CMS) opens only for `site_role = 'site_admin'`. An `org_admin`
is a DIFFERENT thing — scoped to their own organization's membership screen,
built in Phase 5b — and must NOT open the Admin Board. NOTE: today's admin check
does NOT go through `authenticate()` — `admin.js` has its own capture-phase
intercept with its own account list. That's why this is a separate phase.

Plan, then do:

1. **Delete the entire ADMIN AUTHENTICATION block in `js/admin.js`**:
   `preloadSheetAdmins()`, `registerAdmins()`, `adminAccounts`, `splitCSV()`,
   `isAdminLogin()`, and the credential comparison inside the capture-phase
   intercept.

2. **New routing**: listen for the `dts:signed-in` event dispatched by app.js
   in Phase 4. Read `session.profile.site_role` (from the `profiles` row
   fetched alongside the org memberships in Phase 4 — if Phase 4 didn't fetch
   `profiles` yet, add that one query here). If `site_role === 'site_admin'`,
   open the Admin Board. Otherwise, if the user has any active
   `organization_members` row, route to the client portal WITH the org-admin
   affordances Phase 5b adds (a "Manage your team" entry point) visible only
   when `org_role === 'org_admin'` for that org. A plain `member` or
   `registered`-only user gets the ordinary portal with no admin affordances
   at all.
   - Do NOT let `org_admin` open the Admin Board under any code path. Test
     this explicitly, not just the positive `site_admin` case.

3. **Drop** the `dtsAdminSession` sessionStorage key — the Supabase session IS
   the session. (Confirm nothing else in the do-not-break list depends on it;
   `dtsAdminDraft` STAYS — it is the draft-content mechanism, unrelated to
   auth.)

4. **Verify** the capture-phase intercept still exists structurally (it may
   still be the place you route from) but now checks `site_role`, not a
   password or a hardcoded account list.

5. **Test**: `testadmin@example.com` (site_admin) signs in → Admin Board
   opens. `testorgadmin@example.com` (org_admin@Acme only) signs in → client
   portal opens, NOT the Admin Board, with the team-management entry point
   visible for Acme only. `testuser@example.com` (plain registered) signs in
   → ordinary portal, no admin affordance anywhere. Draft → preview → discard
   still works; zip export still works (untouched escape hatch). Update
   `PROGRESS.md`. Stop. Next: `/migrate-phase5b`.
