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

1. **Client account & credential inventory — gather everything before
   touching anything.** This is a hard gate: do not start step 2 until every
   row below is either in hand or explicitly deferred with the user's
   sign-off. Confirm with the user, for each item, whether it's already
   ready, still needed, or being deliberately skipped (e.g. OAuth deferred
   for launch) — and record the answer in `PROGRESS.md`'s Account inventory
   section (labels only, never actual secrets) before proceeding.

   | # | Needed from the client | Used for | Where it comes from |
   |---|---|---|---|
   | 1 | Cloudflare account (new or existing) | Production Pages project + R2 buckets | Client creates it, or adds you as collaborator |
   | 2 | Cloudflare scoped API token (Pages:Edit, R2:Edit) + Account ID | Automated deploy/upload in step 3 | Client's Cloudflare dashboard → My Profile → API Tokens |
   | 3 | Supabase account (new or existing) + new project | Production database | Client creates it, or adds you as collaborator |
   | 4 | Supabase project URL, anon key, service role key, project ref, DB password | Schema push, config re-point, Functions | Client's Supabase project → Settings → API / Database |
   | 5 | Supabase access token (account-level, not project) | CLI `supabase link` | Client's Supabase account → Access Tokens |
   | 6 | Web3Forms account/key decision | Lead form delivery | Decide with the user: does this stay on DTS's own account (it only needs a destination inbox), or move to the client's? Don't assume — ask if not already decided. |
   | 7 | Google Cloud Console access — **only if self-registration's Google sign-in is going live** | OAuth client ID + secret for production | Client's Google account (or a DTS-managed Google Workspace acting on their behalf — confirm which with the user) |
   | 8 | Azure Portal access — **only if self-registration's Microsoft sign-in is going live** | OAuth app registration + secret for production | Client's Microsoft/Azure tenant |
   | 9 | Domain registrar / DNS access | Pointing the real domain at production | Wherever the client's domain is currently registered/hosted |
   | 10 | The real client list (companies, staff, who's `org_admin` per company) | Step 6's org/membership import | The client directly — never guessed from old sheet data |
   | 11 | Custom SMTP provider account + verified sending domain | Password reset / signup confirmation emails actually working | Client's (or DTS-managed) SMTP provider — see `ACCOUNT-SETUP-AND-HANDOFF.md` §7 |
   | 12 | GA4 Measurement ID + Microsoft Clarity Project ID | Marketing tags (Phase 9) — both currently placeholder-empty in `js/analytics-init.js`, so neither tag loads on the dev site at all | Client's Google Analytics account (Admin → Data Streams) and clarity.microsoft.com — both free, not secrets, safe to paste directly once created |

   Items 7-8 only apply if OAuth is actually launching with this handoff —
   if the user is deferring Google/Microsoft sign-in (as decided
   2026-08-08, see `PROGRESS.md`), skip them explicitly rather than
   blocking on them, and note the deferral in `PROGRESS.md`. Email/password
   self-registration needs nothing beyond item 4 (Supabase's own "Confirm
   email" + Redirect URLs settings, done in the client's project the same
   way as the dev one — see `ACCOUNT-SETUP-AND-HANDOFF.md` §6).

   **Item 11 is NOT skippable like 7-8** — Supabase's built-in email service
   is capped at 2 messages/hour, project-wide, and is documented by Supabase
   itself as unsuitable for production. Password reset and signup
   confirmation will not work reliably for real users without it, regardless
   of whether self-registration or OAuth are in use — this predates and is
   independent of the self-registration feature.

   Also decide now, not mid-handoff (`ACCOUNT-SETUP-AND-HANDOFF.md` Part 3
   step 2 has the detail): is Claude added as a collaborator on the client's
   accounts to run the automated steps directly, or does the client run the
   setup clicks themselves and hand over the resulting tokens in a
   git-ignored `.env.prod`? Either works; decide before step 2 so it's clear
   who clicks what.

2. **Client Supabase (production).** User creates the project in the CLIENT's
   org and provides production tokens in a SEPARATE `.env.prod`
   (git-ignored). Claude `supabase link`s to it and re-runs the SAME
   `supabase/migrations/` (`db push`) — same seven tables
   (`profiles, organizations, organization_members, resource_entitlements,
   client_apps, events, admin_audit`), same RLS. Create the first real
   `site_admin` account (the DTS operator, not a client). **Upgrade to Pro
   ($25/mo) on the client's billing** to remove the 7-day pause before real
   users log in. **Also configure custom SMTP now** (inventory item 11) —
   Supabase's built-in email service caps out at 2 messages/hour project-wide
   and is not viable for real users resetting passwords or confirming
   sign-up; this is not optional the way OAuth is, and it's independent of
   whether self-registration/OAuth are in use. Follow
   `ACCOUNT-SETUP-AND-HANDOFF.md` §7 against the client's own SMTP provider
   account and verified domain, not the dev one used for testing.

3. **Client Cloudflare (production).** User provides a scoped prod Cloudflare
   token. Claude creates the Pages project (Direct Upload) +
   `dts-content`/`dts-builds` buckets in the CLIENT's account, uploads the
   same site files + the split `data/current/`+`data/source/` content
   (scripted, reusing `scripts/split-content.mjs`/`upload-content.mjs` from
   Phase 6), and sets ALL secrets FRESH via `wrangler pages secret put`
   (Cloudflare API token, Web3Forms key, Supabase service key). NEVER copy
   secrets across accounts.

4. **Re-point config.** Edit `js/supabase-init.js` to the client's project URL
   + anon key. That plus the fresh secrets is the ENTIRE account swap. Claude
   greps once more to confirm no stray personal-account value remains
   anywhere.

5. **Google/Microsoft OAuth (production) — only if self-registration's
   social login is going live with this handoff.** Skip entirely, and note
   the deferral in `PROGRESS.md`, if the user is still deferring it (as of
   2026-08-08 they are). Otherwise: using inventory items 7-8, register a
   NEW OAuth client/app under the CLIENT's own Google Cloud Console / Azure
   Portal — same steps as `ACCOUNT-SETUP-AND-HANDOFF.md` §6, but pointed at
   the client's production Supabase callback URL (from step 2), not the dev
   one. Move Google's OAuth consent screen from Testing to Published (or
   complete the client's own verification) so real users don't hit the
   "unverified app" warning. Enable both providers in the CLIENT's Supabase
   Dashboard → Authentication → Providers, and confirm Authentication → URL
   Configuration → Redirect URLs includes the real production domain (from
   step 7) once it's live — revisit this specific setting after step 7, since
   the domain isn't final until then.

6. **Real organization + client import (runs now, deliberately).** User
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

7. **Domain.** Point the real domain at the client's Pages project (or
   migrate the domain into their Cloudflare). Coordinate DNS + email so
   nothing is interrupted. Same web address, same brand.

8. **Final live checks.** Full README checklist on the production domain; a
   real client test login (client + org_admin, at minimum); confirm cross-org
   isolation with two real client accounts if more than one client goes live
   at once; a small real build download; a lead send. Update `PROGRESS.md` →
   LIVE.

Post-launch client bill: Supabase Pro $25/mo + R2 ~$1-5 + domain + optional
code-signing/Plausible. Everything else $0. Re-check live prices before
quoting.
