# Account Setup, Phase-Start Prompts, and Client Handoff

Three things in one place: what external accounts to set up before/during
development, exactly what to paste into a fresh Claude Code session to resume
any phase, and how the finished site actually ends up hosted on the CLIENT's
own accounts rather than yours.

This document doesn't replace `00-VERIFY-FIRST.md` or
`AUTOMATION-AND-CREDENTIALS.md` — it's the practical, do-this-in-order
companion to them.

---

## Part 1 — External accounts to set up (development phase)

Everything in this section happens on YOUR personal accounts, not the
client's. Nothing here costs money except an optional domain — see
`00-VERIFY-FIRST.md` Question 2 for the full cost breakdown.

### 1. Cloudflare (before Phase 1)

1. Create a free Cloudflare account at cloudflare.com if you don't have one.
2. Decide on a domain now or later:
   - **Defer** — dev on a free `*.pages.dev` subdomain, buy a real domain only
     at handoff. No action needed now.
   - **Use now** — if you already own a domain you want to test with, no
     purchase needed, just be ready to point DNS at it in a later phase.
3. Nothing to authenticate yet — Phase 1 itself will ask you to run
   `npx wrangler login`, which opens a browser for you to approve. Just have
   the account ready to log into when that happens.

### 2. Supabase (before Phase 3)

1. Create a free Supabase account at supabase.com if you don't have one.
2. Create a **new project** — this is your personal DEV project, separate
   from anything the client will eventually get. Free tier. Pick any region;
   it doesn't need to match the client's eventual region.
3. Set a database password when prompted — write it down, you'll need it.
4. Once the project exists, collect these from its dashboard (Settings → API,
   Settings → Database):
   - **Project URL**
   - **Anon (public) key**
   - **Service role key** — keep this one especially guarded; it bypasses
     row-level security and must never end up in a committed file or in
     `js/supabase-init.js`
   - **Project ref** (the short ID visible in the project's URL/settings)
   - **DB password** (from step 3)
5. Generate an access token for the CLI: your Supabase **account** (not the
   project) → Access Tokens → New token. This is what lets the Supabase CLI
   link to and push migrations against your project on your behalf.

### 3. Cloudflare API access (before Phase 1/6/8)

1. Cloudflare dashboard → My Profile → API Tokens → Create Token.
2. Use **Custom token**, not a template. Scope permissions to exactly:
   - **Pages: Edit**
   - **R2: Edit**
   Nothing broader — not the Global API Key, not account-wide admin.
3. Copy your **Account ID** — visible on the right-hand sidebar of almost any
   Cloudflare dashboard page.

### 4. Google Sheet retirement (before Phase 2)

1. You (or whoever owns the account) need access to the Google account that
   currently hosts the published client-directory sheet.
2. No action yet — when Phase 2 runs, it will tell you exactly when to go to
   File → Share → Publish to web → Stop. This is a manual click only you can
   do; nothing in the CLI can reach a Google account.

### 5. Web3Forms (before Phase 7)

1. Register a **new** free key at web3forms.com. The current key is exposed
   publicly in `data/site/lead.json` and is being rotated, not reused.
2. You can do this any time before Phase 7 — it's not urgent this early.

### Where these values actually go

All of the above (except passwords/tokens, which stay in a git-ignored
`.env`) get recorded — as non-secret labels only — in
`docs/migration/PROGRESS.md`'s **Account inventory** section, so a fresh
session can see what already exists without you repeating yourself. Never put
an actual key or password in that file, in a commit, or in this document.

### Quick checklist

| # | Account / service | Needed before | Cost |
|---|---|---|---|
| 1 | Cloudflare account | Phase 1 | Free |
| 2 | Domain (optional) | Phase 1 (or defer) | ~$12–18/yr if bought now |
| 3 | Supabase account + dev project | Phase 3 | Free |
| 4 | Supabase access token | Phase 3 | Free |
| 5 | Cloudflare scoped API token + Account ID | Phase 1 / 6 / 8 | Free |
| 6 | Google Sheet owner access | Phase 2 | Free |
| 7 | Web3Forms new key | Phase 7 | Free |

None of this is required to run `/migrate-start` — Step 0 is read-only
verification against the existing code.

---

## Part 2 — Starting (or resuming) a phase in a fresh CLI session

Every phase lives as a slash command in `.claude/commands/`, and Claude Code
loads those automatically for any session opened in this project folder —
including a brand-new terminal that has never seen this conversation. So the
short version always works:

```
/migrate-phase4
```

The one thing a truly fresh session is missing is **state**: what's already
been done, what account values were recorded, and the access-model spec each
phase depends on. The phase command files assume "re-read the golden rules,"
but a cold session hasn't read `PROGRESS.md` yet and won't know, for example,
which Supabase project ref or org slugs Phase 3 already created.

### The reusable resume prompt

Paste this as your first message in any new session before invoking a phase
command, substituting the phase number:

```
Resume the DTS migration. First read docs/migration/PROGRESS.md for the
current status and any recorded account/project details, then
docs/migration/ACCESS-MODEL.md for the access model spec, then re-read the
golden rules in docs/migration/WORKFLOW.md. Once you have that context, run
/migrate-phaseN.
```

Replace `/migrate-phaseN` with the actual command from the table below. If
you're continuing in the SAME session that just finished the previous phase
(no new terminal), skip this — just type the next slash command directly,
Claude already has the context.

### Per-phase quick reference

| Phase | Same-session command | Needs the resume prompt first? |
|---|---|---|
| Step 0 | `/migrate-start` | No — this is the first command, nothing to resume |
| 1 — Cloudflare foundation | `/migrate-phase1` | Recommended in a new session |
| 2 — Scrub secrets | `/migrate-phase2` | Recommended |
| 3 — Supabase schema | `/migrate-phase3` | Recommended — also re-read `AUTOMATION-AND-CREDENTIALS.md` if it's been a while |
| 4 — Client auth + gating | `/migrate-phase4` | **Yes, always** — this is the security-critical phase, don't skip context loading |
| 5 — Admin auth | `/migrate-phase5` | Yes |
| 5b — CMS access + orgs | `/migrate-phase5b` | Yes |
| 6 — Content pipeline | `/migrate-phase6` | Yes |
| 7 — Lead form | `/migrate-phase7` | Recommended |
| 8 — Builds/downloads | `/migrate-phase8` | Yes |
| 9 — Analytics & audit | `/migrate-phase9` | Recommended |
| Handoff | `/migrate-handoff` | **Yes, always** — re-read `00-VERIFY-FIRST.md` too, not just the resume prompt |

For Handoff specifically, use this extended version instead of the generic
one, since it needs `00-VERIFY-FIRST.md` as well:

```
Resume the DTS migration for handoff. Read docs/migration/PROGRESS.md for
current status, docs/migration/ACCESS-MODEL.md for the access model,
docs/migration/00-VERIFY-FIRST.md for the portability rules, and
docs/migration/AUTOMATION-AND-CREDENTIALS.md for credential handling. Then
run /migrate-handoff.
```

### If you're not sure what's already been done

Just ask, in plain language, before invoking any command:

```
What phase are we on and what's left before handoff?
```

Claude will read `PROGRESS.md` and tell you — that file is the single source
of truth for "where are we," updated at the end of every phase.

---

## Part 3 — Handing off to the client's own accounts

### Why this works as a config swap, not a rewrite

The entire migration was designed around one rule (`00-VERIFY-FIRST.md`,
`WORKFLOW.md` golden rule 3): **nothing account-specific is ever hardcoded in
committed files**, except two spots —

- `js/supabase-init.js` — the public Supabase project URL + anon key (not
  secret; safe to be public, it's what every browser needs to talk to
  Supabase's public API)
- Cloudflare Pages environment variables / secrets — set via
  `wrangler pages secret put`, never written to a file at all

Every other file — HTML, CSS, JS, `/data` content, Cloudflare Functions,
Supabase schema (`supabase/migrations/*.sql`) — is identical between your dev
build and the client's production copy. Handoff is: create the same
infrastructure on the client's accounts, run the same scripts against it,
change those two config spots, done. `/migrate-handoff` is the command that
walks through this, deliberately and with you watching each step (unlike the
earlier phases, which run mostly unattended).

### What actually has to happen, step by step

1. **Client creates their own Cloudflare account** (if they don't have one)
   and their own Supabase account. This is genuinely theirs going forward —
   billing, ownership, everything.
2. **Client grants access for the handoff run.** Someone needs to run the
   automated steps (create the Supabase project, push the schema, upload
   content, set secrets) against the client's accounts. Two ways this
   typically goes — decide which fits before you start:
   - **You're added as a collaborator** on the client's Cloudflare and
     Supabase accounts (temporarily, or long-term if you'll keep maintaining
     the site), so your CLI session can run the automated steps directly
     against their projects.
   - **The client runs the setup clicks themselves** (creating the project,
     generating scoped tokens) following the same instructions Part 1 above
     gives you, then hands you the resulting tokens the same way you'd
     generate your own — in a `.env.prod` file that never leaves their
     control or gets committed.
   Either is fine; the kit doesn't assume one over the other. Decide it with
   the client before running `/migrate-handoff`, since it changes who clicks
   what in step 3 below.
3. **Production Supabase.** A new Supabase project is created inside the
   CLIENT's org (not yours). The exact same
   `supabase/migrations/*.sql` files that ran on your dev project get re-run
   against it — same schema, same RLS, same tables. Upgrade to Supabase Pro
   ($25/mo, billed to the CLIENT) at this point to remove the free tier's
   7-day pause before real users start logging in.
4. **Production Cloudflare.** A new Pages project + the two R2 buckets
   (`dts-content`, `dts-builds`) are created in the CLIENT's Cloudflare
   account. The same site files and the same split `/data` content
   (`data/current/` + `data/source/`) get uploaded. All secrets — Cloudflare
   API token, Web3Forms key, Supabase service key — are generated FRESH on
   the client's side. Nothing is copied over from your dev secrets, ever.
5. **Re-point config.** `js/supabase-init.js` gets edited to the client's
   project URL + anon key. That one file edit, plus the fresh secrets in
   step 4, is the entire account swap — no other code changes.
6. **Real organizations and users.** This is the first time
   `scripts/import-clients.mjs` (written back in Phase 3, dormant until now)
   actually runs, and it runs against the CLIENT's project with the CLIENT's
   real client list — creating real organizations, real memberships, real
   entitlements. You approve the full mapping before any invite email goes
   out, specifically to catch things like the same company appearing under
   two slightly different spellings in the source list (see
   `ACCESS-MODEL.md` and `migrate-handoff.md` for the exact safeguard).
7. **Domain.** The real domain gets pointed at the client's Pages project (or
   migrated into their Cloudflare account outright), coordinated so DNS and
   email don't go down mid-switch.
8. **Final checks, then live.** A full regression pass on the production
   domain, a real client test login, a real build download, a lead send.
   `PROGRESS.md` gets marked LIVE.

### What does NOT transfer, on purpose

- **Your dev Supabase Auth users and passwords** — the dummy `testuser@`,
  `testadmin@`, etc. accounts stay on your personal dev project and never
  touch the client's. Real client accounts are created fresh in step 6.
- **Any secret** — Cloudflare token, Web3Forms key, Supabase service key.
  Every one is regenerated on the client's side. Copying a dev secret into
  production would mean your personal account can still act on the client's
  live data after handoff, which defeats the point of handing off.

### What it costs the client, going forward

Per `00-VERIFY-FIRST.md`: Supabase Pro $25/mo (mandatory once real users are
live), Cloudflare R2 roughly $1–5/mo depending on content/build volume, the
domain itself, and optionally a code-signing certificate if Phase 8 ends up
distributing a signed `.exe`. Everything else — Cloudflare Pages, Pages
Functions, Web3Forms free tier — stays $0. Re-check current pricing at
supabase.com/pricing and cloudflare.com before quoting an exact number, since
these shift.

### One thing to decide before you get there, not during

Whether you (the developer) keep any ongoing access to the client's
production accounts after handoff — to ship future fixes, or not — isn't
something the migration kit decides for you; it's a business arrangement with
the client. If you want continued access, say so before step 2 above so it's
set up as a deliberate, named collaborator grant rather than an afterthought
of however the handoff happened to go.
