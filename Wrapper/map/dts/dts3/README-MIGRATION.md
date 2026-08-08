# DTS Migration Kit — How to Use This

This kit drives the DTS website migration from GitHub Pages + Google-Sheet login
to a GitHub-free Cloudflare + Supabase stack, using Claude Code (CLI) — and
replaces the current site's flat, non-enforcing login with a real identity
model: guests, registered users, client organizations with members and
org-admins, and site admins, plus four resource access levels
(public/registered/client/restricted) enforced server-side.

## What's in here
- `docs/migration/WORKFLOW.md` — the master process + golden rules (read first).
- `docs/migration/ACCESS-MODEL.md` — the normative spec for roles, organizations,
  memberships, access levels, and entitlements. Every phase from 3 onward
  defers to this document for the exact schema.
- `docs/migration/00-VERIFY-FIRST.md` — the two gating questions (accounts + cost).
- `docs/migration/AUTOMATION-AND-CREDENTIALS.md` — how Claude runs the DB, the
  JSON→database conversion, uploads, and deploys itself, plus the one-time
  credential setup that enables it.
- `docs/migration/PROGRESS.md` — living progress log; Claude updates it each phase.
- `docs/migration/USER-ACCESS-MIGRATION-TESTING.md` — manual acceptance checklist
  for the access-control behavior, run by you after the relevant phases.
- `docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md` — every external account to set
  up and when, ready-to-paste prompts for resuming any phase in a fresh CLI
  session, and how the finished site actually ends up on the client's own
  accounts.
- `.claude/commands/*.md` — slash commands, one per phase.

## Identity model, in brief
Six separable concepts — see `docs/migration/ACCESS-MODEL.md` for the full
spec: authentication state (guest/authenticated), site role
(user/site_admin), organizations, organization membership (many-to-many),
organization role (member/org_admin, scoped to one org), and resource access
policy + entitlements (public/registered/client/restricted, with
org-or-user-level grants for restricted resources). Nothing is ever derived
from an email address or its domain.

## How automated is this?
Claude does the database creation, the JSON-to-database conversion, the dummy-data
seeding, the content/build uploads to R2, and the deploys **itself** — you don't
paste SQL or hand-run migrations. Database work uses the Supabase CLI with local
migration files; content and deploys use scripted Wrangler. Dev runs on DUMMY test
data (no real client emails on your personal accounts); the real client import is
written but only runs at handoff, on the client's account.

The only things that stay manual (Claude can't click account screens): logging
Wrangler into Cloudflare once, creating the Supabase project once, generating two
scoped API tokens, unpublishing the Google Sheet, and approving the real client
invite emails at go-live. Full details + the exact `.env` vars are in
`AUTOMATION-AND-CREDENTIALS.md`.

## Setup (one time)
1. Copy the `.claude/` folder and the `docs/migration/` folder into your project
   root — the folder that contains `index.html`, `js/`, `css/`, `data/`,
   `README.md` (the `dts3` folder in your screenshot).
2. Open that folder in Claude Code:  `cd <project>` then `claude`.
3. Verify the commands are picked up:  type `/` and you should see `migrate-start`,
   `migrate-phase1` … `migrate-handoff`.

## Running the migration
Run these one at a time. Each STOPS and waits for your approval before the next.

    /migrate-start      -> plan mode + Step 0 verification (accounts portable? dev cost $0?)
    /migrate-phase1     -> Cloudflare foundation, deploy current site as-is (off GitHub Pages)
    /migrate-phase2     -> scrub secrets, unpublish the Google Sheet
    /migrate-phase3     -> Supabase dev project + org/access schema + RLS (automated, dummy seed)
    /migrate-phase4     -> swap client login to Supabase + enforce resource access levels (security-critical)
    /migrate-phase5     -> swap admin login to the site_role claim (org_admin stays separate)
    /migrate-phase5b    -> CMS access-level editors + organization/user management
    /migrate-phase6     -> serve /data from R2 + instant publish, public/protected split (git-free)
    /migrate-phase7     -> lead form behind a Function + Turnstile
    /migrate-phase8     -> secure build downloads (R2 + org/user entitlements)
    /migrate-phase9     -> analytics events + admin audit trail, dashboard, marketing tags
    /migrate-handoff    -> recreate on the CLIENT's accounts, import real orgs, migrate domain, go live

Phases 1-5 are the security-critical core. 5b-9 are enhancement, though 5b and 6
both touch how access levels are authored and published. Handoff is only when
you're ready to move billing + real clients onto the client's accounts.

## The two things verified up front (Step 0)
1. **Same files, two account sets.** You build on YOUR personal Cloudflare +
   Supabase, then hand the identical files to the CLIENT's accounts. Only config
   (one file: `js/supabase-init.js`) + secrets change. Client passwords are
   created fresh on the production project (you send invites at go-live).
2. **Dev is free.** The entire build (phases 1-7) runs at $0 on free tiers, plus
   the cost of a domain (~$12-18/yr, or use a free *.pages.dev URL during dev).
   The only mandatory paid item — Supabase Pro $25/mo to remove the 7-day pause —
   lands at go-live, on the CLIENT's bill. Re-check live prices at
   supabase.com/pricing and cloudflare.com before relying on exact numbers.

## Safety
- A LOCAL git repo (never pushed to GitHub) gives you per-phase rollback.
- The Admin Board zip-export stays working the whole time as a publish fallback.
- Every phase ends with the README testing checklist before the next begins.
- Secrets live in a git-ignored `.env`; Claude never prints or commits them.
