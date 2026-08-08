---
description: Phase 9 — Analytics, events, admin audit, dashboard tile, marketing tags
---

Phase 9 of the DTS migration. Prerequisite: Phase 8 done. Re-read golden rules +
do-not-break list (tour-bridge contract!). **Plan first, execute after
approval.** Goal: instrumentation and polish. Nothing security-critical; do not
disturb the Treedis contract. Read `docs/migration/ACCESS-MODEL.md` §6-7 first —
`events` (product analytics) and `admin_audit` (administrative audit trail) are
DELIBERATELY separate tables with separate RLS; do not merge them for
convenience.

Plan, then do:

1. **`functions/api/track.js`**: insert into the `events` table (Phase 3
   schema). Accepts `type` (one of the set in `ACCESS-MODEL.md` §6:
   `project_view`, `experience_preview`, `login_gate`, `login`, `register`,
   `experience_open`, `experience_close`, `map_open`, `download_view`,
   `download_start`, `download_complete`), `resource_key`, `project_id`,
   `metadata`. The Function — NOT the client — stamps `user_id` (from the JWT
   if present, else null) and `org_id` (the caller's active org context, if
   any, resolved server-side); reject any request that tries to pass its own
   `user_id`/`org_id` in the body. `anon_id` may come from the client (a
   locally-generated, non-PII session id) for guest events.

2. **Wire the new gate events.** Phase 4's login-gate flow
   (`/api/resource/[key].js` returning 401/403, and the resulting sign-in
   prompt) should fire `login_gate` via `/api/track` when a guest or an
   under-entitled user is blocked — this is the one new call site Phase 4
   didn't add, because Phase 9 owns analytics wiring. Also wire
   `experience_open`/`experience_close`/`map_open` at the same call sites
   `openExample`/`mountTreedis`/`mountVideo`/GIS mount already touch, and
   `download_view`/`download_start`/`download_complete` at the Phase 8
   download tile.

3. **tour-bridge instrumentation**: ADD LISTENERS ONLY for existing inbound
   Treedis events (`TourReady`, `PoseChanged`, etc.) to log engagement via
   `/api/track`. Do NOT add or change any message `type` strings or the ping
   cadence — that's the Treedis contract from `js/tour-bridge.js`. You are
   observing, not altering.

4. **Client dashboard tile**: a small Chart.js view in the portal summarizing
   that client's own `events` — scoped by the `events` table's RLS
   (`is_org_member(org_id)`, per Phase 3), which is the actual enforcement,
   not a client-side filter. A member of Beta Municipal must not be able to
   see Acme's events by editing a request; test this adversarially the same
   way Phase 5b tested cross-org membership edits.

5. **Admin audit view.** Add a `site_admin`-only read of `admin_audit`
   (reuse the Phase 5b "Access" screen area, or add an "Audit" nav entry) so
   the trail Phases 3, 5b, and 8 already write to (`site_role.change`,
   `membership.add/remove`, `org_role.change`, `access_policy.change`,
   `entitlement.grant/revoke`, `download.assign`, `account.disable/
   reactivate`, `invite.send`) is actually visible somewhere, not just
   accumulating unread.

6. **Marketing tags**: Plausible or GA4 + Microsoft Clarity, added within the
   CSP allowances. These are separate from `events`/`admin_audit` — third-party
   tags, no DTS user/org data sent to them beyond what they'd see from any
   public page.

7. Test the full README checklist end-to-end one final time, plus the two
   adversarial cross-org checks in steps 2 and 4. Update `PROGRESS.md` — mark
   the dev build COMPLETE. Stop. Next: `/migrate-handoff` (only when going
   live).
