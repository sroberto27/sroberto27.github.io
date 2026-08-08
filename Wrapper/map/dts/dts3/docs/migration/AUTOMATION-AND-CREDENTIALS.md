# Automation & Credentials — Read Before Phase 1

This migration is set up so **Claude runs the database work, the JSON-to-database
conversion, the content uploads, and the deploys itself** — you do not paste SQL
or hand-run migrations. This doc defines the small one-time credential setup that
makes that possible, and the few things that remain manual no matter what.

## Tooling decision (fixed)
- **Database: Supabase CLI with local migration files.** Schema lives in
  `supabase/migrations/*.sql` (version-controlled in your LOCAL git repo). Claude
  writes migrations and applies them with `supabase db push`. This gives clean,
  replayable history and makes the handoff a re-run of the same migrations on the
  client's project.
- **Content/deploy: scripted Wrangler + Node.** Claude writes and runs the
  scripts (`npx wrangler ...`, Node import scripts). You approve, Claude executes.
- **Dev data: dummy/test only.** No real client emails ever touch your personal
  dev project. Real clients are imported at handoff, on the client's account.

## One-time credential setup (you do this once, then Claude runs unattended)

Claude cannot click through login/signup screens or create the initial cloud
*projects*. You do these ~5 things once; everything downstream is automated.

1. **Cloudflare login for Wrangler:** run `npx wrangler login` (opens a browser,
   you approve). This authenticates the CLI for all later R2/Pages commands.
2. **Create the Supabase DEV project** in the dashboard ("New project", free tier).
   Copy its **project ref**, **project URL**, and **anon key**.
3. **Generate scoped tokens and put them in a local `.env`** (Claude will create
   the `.env.example`; you fill in real values):
   - `SUPABASE_ACCESS_TOKEN` — from Supabase account → Access Tokens. Lets the
     Supabase CLI link + push migrations.
   - `SUPABASE_DB_PASSWORD` — the dev project's database password.
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings → API. Required
     starting Phase 3: `scripts/seed-dev.mjs` uses it to create dummy Auth users,
     organizations, and memberships via the Admin API, and every admin-only
     Function from Phase 5b onward (organization/user management, entitlement
     grants, `admin_audit` writes) needs it to bypass RLS deliberately at a
     controlled boundary. Never expose this key to the browser — it only ever
     lives in `.env` / Pages secrets, never in `js/supabase-init.js`.
   - `CLOUDFLARE_API_TOKEN` — a **scoped** token: permissions limited to
     **Pages: Edit** and **R2: Edit** only. Not a global key.
   - `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard.
4. **Unpublish the Google Sheet** at Google (Phase 2) — only you can do this.
5. **Approve the real client invite emails** at handoff (Phase handoff).

## Security rules (Claude must enforce these)
- Claude creates `.env.example` (placeholders) and ensures `.env` is in
  `.gitignore` so real tokens NEVER enter even the local git repo. Claude verifies
  this before running anything that reads `.env`.
- Tokens are **dev-scoped**. The client's production tokens are only introduced at
  handoff, and the handoff phase is run more deliberately (you watching each step),
  not fully unattended, because it touches real client data.
- Claude never prints secret values back into the chat or into committed files.
- If a required env var is missing, Claude stops and tells you exactly which one
  and where to get it — it does not guess or hardcode.

## What "automated" means per phase
- **Phase 3:** Claude writes `supabase/migrations/` (tables, RLS, roles) and runs
  `supabase db push`. It writes and runs a Node seed script that creates DUMMY
  auth users + entitlement rows. You create the project + provide tokens; Claude
  does the rest.
- **Phase 4/6/8:** Claude writes the JSON→DB / content→R2 / build→R2 scripts and
  runs them via the CLI. You approve the plan; Claude executes.
- **Deploys:** Claude runs `wrangler pages deploy` itself.

## The JSON→database conversion (dummy data)
Claude writes `scripts/seed-dev.mjs` that:
1. Reads your real `data/access/access.json` structure (schema only — for shape).
2. Creates DUMMY **organizations** (e.g. `Acme Hotels`, `Beta Municipal`) and
   DUMMY users (fake emails like `testuser@example.com`) with known dev
   passwords, including at least one user who is `org_admin` at one
   organization and a plain `member` at another — the multi-org case the
   schema exists to support.
3. Creates matching `organization_members` rows (with `org_role`) and
   `resource_entitlements` rows — some entitled directly to a user, some to
   an organization — pointing at real resource keys from your `/data` so the
   portal has something real to show. See `docs/migration/ACCESS-MODEL.md`
   for the exact schema and `resource_key` format.
4. Creates the users via the Supabase Admin API (using
   `SUPABASE_SERVICE_ROLE_KEY`) and inserts the rows.
This lets you exercise the whole portal — including multi-org membership and
both entitlement paths — end to end without any real client data. The REAL
import script (`scripts/import-clients.mjs`, grouping the actual client list
into organizations and memberships, not just isolated users) is written but
NOT run until handoff, on the client's project. A separate
`scripts/backfill-access.mjs` sets the initial `access` levels on the 16
existing project documents (Phase 3) and DOES run in dev, on approval, since
it edits reviewed `/data` content rather than creating throwaway accounts.
