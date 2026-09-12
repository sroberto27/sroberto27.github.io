---
description: Provisioning — stand up client-owned Cloudflare + Supabase early, keep building on dev
---

> # ⛔ SPENT — RAN 2026-09-12. DO NOT RUN AGAIN.
>
> This command is single-use and has been used. The client's Cloudflare and
> Supabase accounts are stood up, content is uploaded, and the site is deployed
> at <https://dts-website-cdc.pages.dev>. The record is the **Provisioning** row
> and the 2026-09-12 session entry in `docs/migration/PROGRESS.md`, the account
> inventory in that same file, and §10 of `docs/WEBSITE-STATE.md`.
>
> `.claude/commands/migrate-handoff.md` steps 2-4 have been rewritten to
> *verify* this work rather than redo it, and its step 4 grep has been scoped to
> the staged deploy directory so it no longer contradicts the overlay.
>
> **Re-running this would re-create infrastructure that already exists.** If you
> need to push content or a deploy to the client's account again, do that
> directly (Steps 3 and 4 below are still accurate as procedure) — or go to
> `/migrate-handoff`, which is the next command in the sequence.
>
> Deferred out of this run and still owed at go-live: Supabase Pro, custom SMTP
> (blocked on DNS, checklist item 9), OAuth, the real org/client import, the
> domain, and marketing tags.

Provisioning phase. **Single-use.** Prerequisite: dev build complete
(`PROGRESS.md` phase table), credential checklist items 1-5 and 13 in hand, and
6/7/8/12 recorded as deferred go-live concerns.

Re-read `docs/migration/DEPLOY-STAGING.md` and
`docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md` Part 3 before starting.
**Plan first, execute after approval.**

IMPORTANT: like `/migrate-handoff` and unlike the dev phases, this runs
DELIBERATELY, not unattended. It touches the client's real accounts and their
billing. Claude proposes each step and waits; the user watches.

---

## What this is, and what it is not

**Goal:** the client owns both accounts and the billing from day one, while
development continues against the existing dev environment. Infrastructure moves
now; go-live stays deferred.

**This is NOT the handoff.** It stops before OAuth, before the real
organization/client import, before the domain, and before final live checks.
Those stay with `/migrate-handoff`.

**Why this exists rather than running `/migrate-handoff` and stopping at step 4.**
Three of those four steps need different behaviour, and one would actively push
toward the wrong action. `migrate-handoff.md` step 4 says to edit
`js/supabase-init.js` in the repo and then *"grep once more to confirm no stray
personal-account value remains anywhere."* Here the repo **deliberately keeps
dev values** so dev work keeps pointing at dev — so that grep finds them and
reports a failure, correctly by its own logic, for a run it was not written for.
The obvious "fix" is to commit the swap, which aims ongoing development at the
client's production database.

**Single-use.** Once Step 5 has run, this command is spent: its record lives in
`PROGRESS.md` and `migrate-handoff.md` has been rewritten to match. Do not run
it twice.

---

## The hazard this command exists to manage

**The same command targets a different account depending only on the
environment loaded.** `scripts/upload-content.mjs:87` hardcodes the bucket as
`dts-content` (likewise `:135`, `upload-source-to-r2.mjs:50`,
`rollback-content.mjs:52`), and `wrangler r2 object put` resolves the *account*
from `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` in the environment. After
this run, a bucket named `dts-content` exists in **both** accounts. The command
line is byte-identical either way. The same applies to `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` read by `scripts/seed-dev.mjs` and
`scripts/import-clients.mjs`.

**Before every write in Steps 1-4, print and confirm the resolved target** —
`npx wrangler whoami`, and echo the Supabase project ref being addressed. Never
run a dev shell and a prod shell from the same terminal session. If you cannot
say with certainty which account a command is about to write to, stop.

**Naming is fixed by this:** the client's Pages project is `dts-website` and the
buckets are `dts-content` / `dts-builds`, matching `wrangler.toml`. Any other
naming means editing hardcoded strings in three scripts for no benefit.

### How the credentials actually reach a command

Nothing auto-loads `.env` or `.env.prod` — no `dotenv` anywhere, and the
scripts read bare `process.env` (`seed-dev.mjs:10-11`,
`import-clients.mjs:48-49`). **Shell state does not persist between tool
calls**, so exporting in one command and running `wrangler` in the next fails:
the second call starts from a fresh shell with none of it set.

Load them in the **same invocation** as the command that needs them:

```bash
set -a; . ./.env.prod; set +a; npx wrangler whoami
```

That constraint is useful here rather than annoying: it makes "confirm which
account I am pointed at" and "write to it" one atomic step instead of two that
can drift apart between calls. Do it for every credentialed command in Steps
1-4, not once at the start.

---

## Decisions already taken (2026-09-11) — record, do not re-prompt

1. **No Supabase Pro yet.** Activate when required. Expect, rather than debug,
   that the free tier pauses the project after seven days idle — this one will
   sit idle while dev remains the workspace. Restoring a paused project from the
   dashboard loses no data; it is a known manual step, not an incident. Pro
   becomes required before real users log in.
2. **DTS keeps collaborator access after go-live**, agreed with the client. The
   Route A grant is deliberately permanent, not a handoff-run grant left in
   place by accident. Record it as agreed, so a later reader can tell a standing
   grant from an overlooked one.

---

## Plan, then do

### Step 0 — Preconditions gate (read-only, hard stop)

Confirm every row before anything else moves. Do not proceed on assumption.

- Checklist items 1-5 and 13 in hand; 6, 7, 8, 12 recorded deferred.
  (`docs/handoff-preflight.html` is the live record.)
- **Both collaborator invites actually accepted** — Cloudflare
  *Manage Account → Members*, Supabase *Organization → Team*. Choosing Route A
  is not the same as holding the grant, and the run stops dead at whichever one
  was missed.
- `.env.prod` exists, is git-ignored (`.gitignore` covers `.env.*`), and carries
  the client's **eight** values (the same keys as `.env.example`). Never
  `.env` — that is dev, and the two are one careless `source` apart.
- The shell has **prod** env loaded. `npx wrangler whoami` and confirm the
  account is the client's.
- Report which rows are satisfied and which are not. Stop if any is unresolved.

### Step 1 — Client Supabase project

- Project created inside the **client's** organization — check the org selector
  before creating; moving a project between orgs afterwards is painful.
- `supabase link` using `SUPABASE_ACCESS_TOKEN` from `.env.prod`.
- `supabase db push` — re-runs the same migrations in `supabase/migrations/`.
- **Verify rather than assume:** eight tables present (`profiles`,
  `organizations`, `organization_members`, `organization_email_domains`,
  `resource_entitlements`, `client_apps`, `events`, `admin_audit`), RLS enabled
  on all eight, and the three 2026-09-06 security migrations applied
  (`drop_events_anon_insert`, `org_status_in_rls_helpers`,
  `client_apps_column_grants`).
- Create the first real `site_admin` — the DTS operator, not a client — via the
  dashboard **with auto-confirm**. No SMTP exists yet, so a normal confirmation
  email will not reliably send.
- **Skip custom SMTP deliberately.** Blocked on DNS (checklist item 9), and not
  needed until real users exist. Record the skip and its reason. It becomes
  non-negotiable before `/migrate-handoff`'s org import, which sends
  password-set invites that would otherwise hit the 2/hour cap and mostly never
  arrive.
- **No Pro upgrade** (decided above). Record the idle-pause consequence.

### Step 2 — Client Cloudflare project + buckets

- Pages project `dts-website`, Direct Upload, no git connection.
- R2 buckets `dts-content` and `dts-builds` — exact names, per the hazard above.
- Set every secret **fresh** via `wrangler pages secret put`. Nothing is ever
  copied from dev: a copied secret means a personal account can still act on the
  client's live data, which defeats the point.

### Step 3 — Content to the client's R2

- `node scripts/split-content.mjs` — regenerates `.build/data-current`,
  `.build/data-source`, and the stripped `.build/js/config.js`.
- `node scripts/upload-content.mjs` with prod env loaded. **Confirm the target
  account first** (the hazard above).
- **Regenerate and upload `data/source/_latest.json` by hand.**
  `upload-content.mjs` does not write it and `/api/admin/content` is the only
  thing that reads it, so skipping this leaves the Admin Board holding stale
  content whose next "Publish to site" overwrites what was just uploaded.
- Verify object counts on both prefixes.

### Step 4 — Static deploy, with the existing overlay extended

**This is not a new mechanism.** `DEPLOY-STAGING.md` already overlays a file on
every deploy — `.build/js/config.js` over the staged `js/config.js`, because the
repo copy carries the gated tour URLs and must never ship. One overlay becomes
three, using machinery already proven here.

What differs from a normal deploy is the **target account** and the **reason**
two of the overlays exist. Today the repo's `js/supabase-init.js` ships as-is and
is *correct* — the dev site should talk to dev Supabase. Deployed to the
client's project it is *wrong*, because their site must talk to their database.

The overlay is temporary, and exists only while two environments coexist. At
real go-live `/migrate-handoff` step 4 is right: commit the swap, dev is
retired, no overlay needed.

Follow `docs/migration/DEPLOY-STAGING.md` exactly, with two extra overlays:

- Standard: build the staging directory **outside the repo** (scratchpad), and
  overlay `.build/js/config.js`.
- **New:** overlay `js/supabase-init.js` in the staged copy with the client's
  project URL + anon key.
- **New:** overlay `index.html`'s Supabase `preconnect` to the same host. This
  is the second of three account-specific spots (the third,
  `js/turnstile-init.js`'s Turnstile site key, was MISSED on this run — see the
  2026-09-12 PROGRESS.md entry), and the one that gets
  missed because nothing fails when it is wrong — a stale preconnect costs a
  wasted DNS/TLS handshake and no error.
- Run the runbook's verification 1-6 in full: per-directory file-list diff (the
  `functions/data/[[path]].js` double-bracket trap — use POSIX `cp -r`, never
  `robocopy`, and never PowerShell `Test-Path` on a bracketed filename),
  excluded-path absence, deploy, post-deploy byte-count checks against `/`'s own
  size, and `grep -c spaces.dtsxr.com <stage>/js/config.js` → **2**.
- Deploy to the **client's** Pages project.
- **New assertion, the inverse of the handoff's.** Confirm the **repo** still
  holds **dev** values: `git diff` clean on `js/supabase-init.js` and
  `index.html`. Under provisioning a clean repo is the pass condition, not a
  failure. If either file shows as modified, the swap was committed by mistake —
  revert it before going further.

### Step 5 — Record, and adapt the handoff command

Not optional cleanup. This is the step that makes the approach worth taking, and
it is why this command exists rather than a remembered stopping point. This
repo's documented failure mode is work that got done and never written down.

- `docs/migration/PROGRESS.md`: add a **Provisioning** row to the phase table,
  and a session entry — what changed, what was tested, what is blocked.
- Account inventory: fill in, **labels only, never values**. Record that DTS's
  collaborator access is an agreed standing grant. **Never write the client's
  Cloudflare account id into any committed file** — the dev account's id is
  already in this repo's public git history and cannot be undone; the client's
  need not follow it.
- `docs/WEBSITE-STATE.md` §10: record that **two environments now exist** — dev
  is the workspace, client production is a destination — and that content must
  be re-uploaded at go-live rather than assumed current. This repo has already
  had one outage made hard to attribute by exactly that kind of divergence.
- **Rewrite `.claude/commands/migrate-handoff.md` steps 2-4** from *do these* to
  *verify these, they were done during provisioning*, and fix step 4's grep so
  it no longer contradicts the overlay.
- Mark this command **spent** at the top of its own text.

---

## Verified when

Against the **client's** deployment:

- `/` returns a real page, and every excluded path (`/.env`, `/scripts/`,
  `/supabase/`, `/docs/`, `/tools/gis-harvest.mjs`, `/CLAUDE.md`,
  `/wrangler.toml`, `/package.json`, `/tests/`) returns **exactly** `/`'s byte
  count. Compare against `/`'s own size each run — it changes with every content
  deploy, so a figure copied from a previous session is the wrong baseline.
- `/data/manifest.json` returns a genuinely different size — proof the R2-backed
  Function owns that route and no static `/data` is shadowing it. This is the
  highest-severity invariant in `CLAUDE.md`'s do-not-break list.
- A repo project document carries `tourUrl`/`mapId` while the same document
  served live carries neither (currently `data/projects/gfc.json`).
- Deployed `js/config.js` greps **2** for `spaces.dtsxr.com`, never 16.
- Anonymous `GET /api/resource/gismap.iberia-coastal` → **401**, not 500.
- Function responses carry the four security headers — checked with `GET`,
  **never `HEAD`**. A HEAD to a Function path falls through to the static SPA
  shell and returns `_headers`' CSP instead, which looks exactly like the fix
  being absent.
- `git status` clean — no client values committed.
- All six credential-free tests pass:
  `for p in tests/security/probe-*.mjs tests/regression/*.mjs; do node "$p" || echo "FAILED: $p"; done`

Report which claims are confirmed by reading code, which against the real
service, and which not yet confirmed live. "The command exited 0" is not
verification.

---

## Out of scope

OAuth, the real organization/client import, the domain cutover, marketing tags,
and final live checks all stay with `/migrate-handoff`.

Parts L and M of `docs/migration/FULL-SYSTEM-TESTING.md` remain unrun.

**Part N is not a blocker for this run — decided 2026-09-11, do not re-raise
it.** Its highest-risk items were confirmed in a developer smoke pass: the
tour not reloading on a stage-tab switch and still exactly one Treedis iframe
(178-179), the GIS map drawing all 17 layers from its new home with its tours
running (180-183), the Admin Board editing the new content (186-191), and a
clean console (194). The remainder — counts, deleted-project reachability, the
two desktop layout regressions, the guest/signed-in split, images, mobile and
back/forward — is a cleanup pass for before go-live, not before provisioning.
See that Part's own header for the exact split.

Two things make this safe rather than optimistic. Gating **enforcement** is
proven without a browser (F-01 probe green, live 401s on gated keys, 404s on
deleted ones), so what is unconfirmed there is rendering, not exposure. And
**dev stays live as the workspace**, so it remains the control group: if
something looks wrong on the client's deployment, compare against dev and the
difference says which layer it is in. Content is re-uploaded at go-live
regardless, so a defect found later costs a scripted re-run, not a rebuild.
