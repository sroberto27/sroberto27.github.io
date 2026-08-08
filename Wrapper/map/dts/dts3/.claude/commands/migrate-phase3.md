---
description: Phase 3 — Supabase dev DB via CLI migrations + automated dummy seed (Claude runs it)
---

Phase 3 of the DTS migration. Prerequisite: Phase 2 done, and the credential setup
in `docs/migration/AUTOMATION-AND-CREDENTIALS.md` complete (dev Supabase project
created by the user; `.env` filled with SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD,
SUPABASE_SERVICE_ROLE_KEY, project ref/URL/anon key). Re-read golden rules.
**Plan first, execute after approval.**

Read `docs/migration/ACCESS-MODEL.md` first — it is the normative spec for
everything in this phase. If anything below and that document ever disagree,
`ACCESS-MODEL.md` wins; flag the conflict and stop rather than guessing.

This phase is AUTOMATED: Claude writes the migrations and the seed script and RUNS
them via the Supabase CLI. The user does NOT paste SQL. Dev uses DUMMY data only —
no real client emails on the personal dev project.

Pre-flight (Claude does this before anything):
- Confirm `.env` exists and is git-ignored; confirm `.env.example` is committed.
  If any required var is missing, STOP and name exactly which one and where to get it.
- Confirm `npx supabase --version` works; if the Supabase CLI isn't available, set it
  up (via npx) before proceeding.

Plan, then do:

1. **Init + link.** `supabase init` (if needed) to create the `supabase/` folder.
   `supabase link --project-ref <ref>` using the env token. Keep everything local +
   in the LOCAL git repo; nothing pushed to GitHub.

2. **Write migrations** under `supabase/migrations/`, matching
   `ACCESS-MODEL.md` §2 exactly:
   - `profiles` — `user_id` (FK `auth.users`), `site_role` ('user'|'site_admin',
     default 'user'), `display_name`, `created_at`. A trigger on `auth.users`
     insert creates the matching `profiles` row with `site_role='user'`.
   - `organizations` — `id`, `slug` (unique), `name`, `status`
     ('active'|'disabled', default 'active'), `created_at`.
   - `organization_members` — composite PK `(org_id, user_id)`, `org_role`
     ('member'|'org_admin'), `status` ('active'|'invited'|'disabled', default
     'active'), `created_at`. FKs to `organizations(id)` and `auth.users`.
   - `resource_entitlements` — `id`, `resource_key` (text, format in
     `ACCESS-MODEL.md` §4), `subject_type` ('org'|'user'), `subject_id`,
     `granted_by` (FK `auth.users`), `created_at`.
   - `client_apps` — `id`, `key` (unique), `name`, `platform`, `version`,
     `r2_object_key`, `enabled` (default true), `created_at`, `updated_at`.
   - `events` — `id`, `occurred_at` (default now()), `type`, `user_id`
     (nullable), `anon_id` (nullable), `org_id` (nullable), `resource_key`
     (nullable), `project_id` (nullable), `metadata` (jsonb).
   - `admin_audit` — `id`, `occurred_at` (default now()), `actor_user_id`,
     `action`, `target_type`, `target_id`, `org_id` (nullable), `before`
     (jsonb), `after` (jsonb).
   - Indexes: `organization_members(user_id)`,
     `resource_entitlements(resource_key)`, `events(occurred_at, org_id)`.
   - RLS helper functions, `SECURITY DEFINER` with a pinned `search_path`:
     `is_site_admin()`, `is_org_member(org_id)`, `is_org_admin(org_id)`.
   - RLS policies (deny-by-default — enable RLS on every table above, no table
     ships without policies):
     - `profiles`: a user reads/updates their own row; `site_admin` reads/updates
       any row; `site_role` column only writable by `site_admin` (via a
       trigger or a separate admin-only update path — never client-writable).
     - `organizations`: readable by members of that org and `site_admin`;
       writable only by `site_admin`.
     - `organization_members`: readable by members of that org and
       `site_admin`; insert/update/delete by `site_admin` OR by `org_admin`
       of that same `org_id` (server-side re-derived, never trust a client
       `org_id`).
     - `resource_entitlements`: readable by the entitled subject (user, or a
       member of the entitled org) and `site_admin`; writable only by
       `site_admin`.
     - `client_apps`: readable by any authenticated user (gating happens at
       download time, not at listing time — but only `enabled=true` rows via
       a view or filter); writable only by `site_admin`.
     - `events`: insert allowed for any caller (including anon via a
       service-role Function path for anon_id events); select scoped to your
       own `org_id` (via `is_org_member`) or `site_admin`.
     - `admin_audit`: no client insert policy at all (service-role only via
       Functions); select only by `site_admin`.
   - Do NOT create the old `entitlements` table shape from the prior version
     of this phase — it modeled one flat directory and is superseded by
     `resource_entitlements` + `organization_members`.

3. **Apply migrations.** `supabase db push`. Confirm the tables + policies exist.

4. **Write `scripts/seed-dev.mjs`** (Node, Supabase Admin API via the service
   role from env). Creates, all DUMMY:
   - Two organizations: `Acme Hotels` (slug `acme-hotels`), `Beta Municipal`
     (slug `beta-municipal`).
   - `testadmin@example.com` — `site_role='site_admin'`.
   - `testuser@example.com` — plain registered user, no org membership.
   - `testorgadmin@example.com` — `org_admin` at Acme Hotels **and** `member`
     at Beta Municipal simultaneously (this is the multi-org, multi-role case
     the whole schema exists to support — do not skip it).
   - `testmember@example.com` — `member` at Beta Municipal only.
   - A `resource_entitlements` row granting a `restricted` dummy resource
     (e.g. `project.gfc:map`) to the Acme Hotels org, and one granting a
     different dummy resource directly to `testuser@example.com`, so both
     `subject_type` paths are exercised.
   - A `client_apps` row (`key: 'dummy-viewer-win'`, `enabled: true`) pointing
     at a placeholder `r2_object_key` (the real object doesn't need to exist
     yet — Phase 8 uploads it).
   - All auth users get known dev-only passwords, printed once to the user;
     never write passwords to `PROGRESS.md` or any committed file.

5. **Run the seed.** Execute `scripts/seed-dev.mjs`. Print a summary of what was
   created (emails, org memberships, entitlement rows — NOT passwords/secrets).

6. **Also write (do NOT run) `scripts/import-clients.mjs`** — the real-import
   version. Per `ACCESS-MODEL.md`, it must GROUP the real client list into
   organizations (not create one isolated user per row), create the
   corresponding `organization_members` rows with the correct `org_role`, and
   map existing `twin_url`/`sweep_id` values to `resource_entitlements` rows
   keyed by the matching `resource_key`. It stays dormant until handoff — do
   not run it now, and do not point it at real data yet.

7. **Write `scripts/backfill-access.mjs`** (do NOT run without approval — this
   writes into `/data`, which is reviewed content, not throwaway dev state).
   Per `ACCESS-MODEL.md` §5 and the initial defaults table in the reconciliation
   plan: sets `access` on the homepage `treedis.tourUrl` context to `public`
   (it already is, implicitly — this just makes it explicit and CMS-editable),
   sets each of the 16 project documents' descriptive content to stay
   unconditionally public, sets every existing Treedis/Vimeo/GIS
   experience and every `links[]` entry that targets `spaces.dtsxr.com` to
   `access: "registered"`, and leaves `heritage`/`emergency` untouched (no
   experience to gate). Flag `data/projects/emergency.json` as present on disk
   but absent from `data/manifest.json` — do not silently add it to the
   manifest; ask the user what to do with it. Show the full diff before
   applying; get approval; then run it.

8. **Verify RLS** with a quick scripted check: as dummy user A (`testmember`),
   confirm `organization_members`/`resource_entitlements` rows for org B
   (Acme, which A doesn't belong to) are not visible; as `testorgadmin`,
   confirm they see Acme AND Beta rows but not a third org's; as `testadmin`,
   confirm they see everything.

9. Update `PROGRESS.md` (record table names + dummy user emails + org slugs,
   never passwords). Stop. Next: `/migrate-phase4`.

Free-tier guardrail: dev stays $0 — seven tables plus indexes and a handful of
dummy rows is far under the 500 MB free Postgres limit. If anything here would
need Pro, stop and flag it.

Security: never print token/password values; confirm `.env` stays out of git.
