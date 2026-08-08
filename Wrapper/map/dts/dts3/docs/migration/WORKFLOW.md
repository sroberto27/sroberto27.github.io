# DTS Migration — Master Workflow

This is the operating manual for migrating the DTS website off GitHub Pages +
Google-Sheet auth onto Cloudflare + Supabase, GitHub-free, WITH a real
organization/entitlement access model. It is grounded in the real code:
`js/app.js`, `js/clients.js`, `js/admin.js`, `js/content-loader.js`,
`data/access/access.json`, `data/site/lead.json`, `index.html`, `README.md`,
and the identity/gating design in `docs/migration/ACCESS-MODEL.md`.

## Golden rules (apply to every step)

1. **Plan before code.** Every phase starts in plan mode: read the real files,
   state exactly what changes, get approval, THEN edit. Never edit blind.
2. **Preserve the do-not-break list** (from README): script/CSS load order,
   `tour-bridge.js` message types + ping cadence, the single-iframe pattern, the
   `DTS_CONFIG` legacy shape, localStorage keys `dtsAdminDraft` / `dtsAdminSession`.
3. **Account-agnostic code.** No account-specific URL/key/id in committed files
   except `js/supabase-init.js` (public URL + anon key) and Cloudflare secrets.
   This is what makes the personal-account → client-account handoff a config swap.
4. **Free during dev.** No step in phases 1–7 may require a paid upgrade. If one
   would, stop and flag it.
5. **One phase at a time, verifiable.** Each phase ends with a concrete test from
   the README testing checklist. Don't start the next phase until the current one
   passes.
6. **Deletion over addition.** Much of this migration removes code (sheet parser,
   CSV auth, admin credential list, "Remember me"). Prefer deleting to rewriting.
7. **Keep the escape hatch.** The Admin Board zip-export stays working the entire
   time as a fallback publish path.
8. **Claude runs the DB and content work itself.** Database creation, JSON→DB
   conversion, seeding, R2 uploads, and deploys are automated via the Supabase CLI
   (local migration files) and scripted Wrangler — the user does not paste SQL. See
   `AUTOMATION-AND-CREDENTIALS.md`. Dev uses DUMMY data; real client import is
   written but dormant until handoff. Secrets live in a git-ignored `.env` and are
   never printed or committed.
9. **Access levels are CMS content; entitlements are not.** A resource's
   `access` field (`public`/`registered`/`client`/`restricted`) lives in
   `/data`, is edited in the Admin Board, and flows through the normal publish
   pipeline. WHO holds a `restricted` resource lives only in Supabase
   (`resource_entitlements`) and is never written to `/data` or published to
   R2. See `docs/migration/ACCESS-MODEL.md` §5. Every phase from 3 onward
   defers to that document for the exact schema and vocabulary — don't
   improvise a different shape mid-phase.
10. **`site_admin` and `org_admin` are different axes, never conflate them.**
    An `org_admin` manages only their own organization's membership and never
    gains CMS or cross-org access. See `ACCESS-MODEL.md` §8.

## Branch / safety model (git-free, but still safe)

Even though the deploy pipeline is git-free, keep a **local git repo for your own
safety** (never pushed to GitHub — it's just local history + a private mirror if
you want one). Each phase = one local commit. This gives you rollback without any
GitHub dependency. The *deploy* still happens via `wrangler pages deploy`, not git.

## The phases (each has its own command file in .claude/commands)

- **Phase 0 — verify** (`/migrate-verify`): answer the two gating questions
  (account portability + dev cost). Output a written verification. See
  `docs/migration/00-VERIFY-FIRST.md`. GATE: user approves before Phase 1.
- **Phase 1 — foundation** (`/migrate-phase1`): Cloudflare Pages (Direct Upload)
  + R2 buckets + `_headers`; deploy the CURRENT site as-is to a `*.pages.dev`
  URL. Milestone: "off GitHub Pages" is already achieved here.
- **Phase 2 — scrub secrets** (`/migrate-phase2`): strip `access.json`
  (adminUsers, demoDirectory, directorySource); gate/retire `clients.js`;
  unpublish the Google Sheet at Google; plan the Web3Forms key rotation.
- **Phase 3 — Supabase** (`/migrate-phase3`): Claude writes `supabase/migrations/`
  and runs `supabase db push` to create the full identity + access schema —
  `profiles`, `organizations`, `organization_members`, `resource_entitlements`,
  `client_apps`, `events`, `admin_audit` + RLS (see `ACCESS-MODEL.md` §2) —
  then writes and RUNS `scripts/seed-dev.mjs` to create DUMMY orgs, users,
  memberships, and entitlement rows. Also writes (but does not run)
  `scripts/import-clients.mjs` and `scripts/backfill-access.mjs` (the latter
  runs now, on `/data`, with approval — it sets initial `access` levels).
  User only creates the project + provides tokens.
- **Phase 4 — client auth swap + resource gating** (`/migrate-phase4`):
  `supabase-init.js` + script tags in `index.html`; rewrite the
  ACCESS-YOUR-TWIN block in `app.js` (signIn, org-aware session restore,
  signOut, forgot-password); delete `loadDirectory`/`parseCSV`/`normalizeRow`
  (the old flat-directory shape, superseded). NEW: add
  `functions/api/resource/[key].js` so `public`/`registered`/`client`/
  `restricted` are enforced server-side for the first time, with a login gate
  that preserves the requested destination, and close the `links[]` leak in
  `automotive`/`campus`.
- **Phase 5 — admin auth swap** (`/migrate-phase5`): delete the ADMIN
  AUTHENTICATION block in `admin.js` (preloadSheetAdmins, registerAdmins,
  adminAccounts, splitCSV, isAdminLogin); route on `profiles.site_role` from
  the `dts:signed-in` event. `org_admin` must NOT open the Admin Board.
- **Phase 5b — CMS access + org management** (`/migrate-phase5b`): NEW phase.
  Access-level editors on projects/experiences/links/GIS maps in the Admin
  Board; Organizations/Users/Access nav sections for `site_admin`; a
  team-management panel for `org_admin`, scoped to their own org only.
- **Phase 6 — content pipeline** (`/migrate-phase6`): seed `data/current/`
  (public, stripped) and `data/source/` (private, full) in R2; add
  `functions/data/[[path]].js` (serves `current/` only); remove the static
  `data/` from deploy; add `functions/api/publish.js` (+ snapshots + cache
  purge) and the board's Publish button; formalize the public/protected split
  Phase 4 needed. content-loader.js stays byte-identical. Also accounts for
  the 29 GIS documents the original design missed.
- **Phase 7 — lead form** (`/migrate-phase7`): `functions/api/lead.js` + Turnstile;
  repoint `sendLead()`; new `ownerEmail`; rotate the Web3Forms key.
- **Phase 8 — builds** (`/migrate-phase8`): R2 upload from Admin Board;
  `client_apps` registry; `functions/api/download.js` resolving
  `download.<key>` through the SAME org/user entitlement path as experiences.
- **Phase 9 — analytics & audit** (`/migrate-phase9`): `events` (product
  analytics) + `/api/track` + tour-bridge instrumentation + dashboard tile,
  kept SEPARATE from `admin_audit` (administrative trail, `site_admin`-only);
  Plausible/GA4 + Clarity.
- **Handoff** (`/migrate-handoff`): recreate prod on the CLIENT's accounts,
  re-point config, reset secrets, migrate the domain, import real
  ORGANIZATIONS and memberships (not just a flat user list), send real client
  invites, move Supabase to Pro on their bill.

Phases 1–5 are the security-critical core. Phase 5b and 6–9 are enhancement,
though 5b and 6 both touch how access levels are authored and published, so
treat their acceptance checks as seriously as the core phases'.

## Progress tracking

Keep `docs/migration/PROGRESS.md` updated after each phase: what's done, what
was tested, what's blocked. Claude updates it at the end of every phase so any
new session can resume cold.
