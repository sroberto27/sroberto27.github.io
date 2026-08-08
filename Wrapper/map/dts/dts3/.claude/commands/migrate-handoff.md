---
description: Handoff — recreate production on the CLIENT's accounts, real org/client import, go live
---

Handoff phase. Prerequisite: dev build complete + tested on your personal
accounts (Phases 1-9 all done, `PROGRESS.md` marked dev build COMPLETE).
Re-read `docs/migration/00-VERIFY-FIRST.md` (portability),
`docs/migration/AUTOMATION-AND-CREDENTIALS.md`, and
`docs/migration/ACCESS-MODEL.md`. **Plan first, execute after approval.**

IMPORTANT: unlike dev, this phase is run DELIBERATELY, not fully unattended —
it touches real client data and the client's billing. Claude proposes each
step and waits; the user watches. The real import script (written in Phase 3
as `scripts/import-clients.mjs`, dormant since) runs HERE for the first time,
on the CLIENT's project — and per `ACCESS-MODEL.md` it now imports
ORGANIZATIONS and MEMBERSHIPS, not a flat user list.

Goal: the same files run on the CLIENT's Cloudflare + Supabase, on the real
domain, with real client organizations and users. Because the code is
account-agnostic, this is a config swap + a migration re-run, not a rewrite.

Plan, then do:

1. **Client Supabase (production).** User creates the project in the CLIENT's
   org and provides production tokens in a SEPARATE `.env.prod`
   (git-ignored). Claude `supabase link`s to it and re-runs the SAME
   `supabase/migrations/` (`db push`) — same seven tables
   (`profiles, organizations, organization_members, resource_entitlements,
   client_apps, events, admin_audit`), same RLS. Create the first real
   `site_admin` account (the DTS operator, not a client). **Upgrade to Pro
   ($25/mo) on the client's billing** to remove the 7-day pause before real
   users log in.

2. **Client Cloudflare (production).** User provides a scoped prod Cloudflare
   token. Claude creates the Pages project (Direct Upload) +
   `dts-content`/`dts-builds` buckets in the CLIENT's account, uploads the
   same site files + the split `data/current/`+`data/source/` content
   (scripted, reusing `scripts/split-content.mjs`/`upload-content.mjs` from
   Phase 6), and sets ALL secrets FRESH via `wrangler pages secret put`
   (Cloudflare API token, Web3Forms key, Supabase service key). NEVER copy
   secrets across accounts.

3. **Re-point config.** Edit `js/supabase-init.js` to the client's project URL
   + anon key. That plus the fresh secrets is the ENTIRE account swap. Claude
   greps once more to confirm no stray personal-account value remains
   anywhere.

4. **Real organization + client import (runs now, deliberately).** User
   provides the real client list — per `ACCESS-MODEL.md`, this must include
   which staff belong to which organization and who is that organization's
   `org_admin`, not just a flat email list. Claude runs
   `scripts/import-clients.mjs` (the dormant script from Phase 3) against the
   CLIENT's project:
   - creates one `organizations` row per real client company;
   - creates real Supabase Auth users;
   - creates `organization_members` rows binding each user to their
     organization(s) with the correct `org_role` (`member` or `org_admin` —
     confirm with the user which named contact at each client should be
     `org_admin` before running; do not guess from a job title in the sheet);
   - maps each client's existing `twin_url`/`sweep_id` rows to
     `resource_entitlements` (`subject_type='org'`, keyed by the matching
     `resource_key` established during Phase 3's backfill / Phase 5b
     editing) so nothing regresses relative to what that client could already
     see under the old sheet-based model;
   - prepares password-set invite emails.
   **User approves the full org/membership/entitlement mapping before any
   invite is sent** — this is the step most likely to misassign a resource to
   the wrong organization if the source sheet's `client` string was ever
   inconsistent (e.g. "Acme Hotels" vs "Acme Hotel" on different rows); Claude
   should flag any such near-duplicate `client` string as a probable
   duplicate-organization bug rather than silently creating two orgs.

5. **Domain.** Point the real domain at the client's Pages project (or
   migrate the domain into their Cloudflare). Coordinate DNS + email so
   nothing is interrupted. Same web address, same brand.

6. **Final live checks.** Full README checklist on the production domain; a
   real client test login (client + org_admin, at minimum); confirm cross-org
   isolation with two real client accounts if more than one client goes live
   at once; a small real build download; a lead send. Update `PROGRESS.md` →
   LIVE.

Post-launch client bill: Supabase Pro $25/mo + R2 ~$1-5 + domain + optional
code-signing/Plausible. Everything else $0. Re-check live prices before
quoting.
