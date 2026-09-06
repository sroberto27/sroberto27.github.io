---
name: security-audit
description: Run a scoped security audit of this project — one surface per session, deterministic scans first, model reasoning only where tools cannot reach. Use for security review, threat assessment, penetration testing, vulnerability hunting, hardening, or a pre-handoff sign-off; and for questions about RLS policy correctness, row level security, Supabase auth and storage config, Cloudflare Pages Functions authorization, deploy exposure and leaked files, secrets in git history, CSP and security headers, CORS, cache poisoning, IDOR, broken access control, privilege escalation, injection, XSS sinks, CSRF, mass assignment, rate limiting, dependency advisories and supply-chain risk. Takes a scope argument — supabase, cloudflare, app, or deps — and runs one at a time; with no scope it runs the full scan pass and reports which scopes are worth a session, ranked. Reports findings and stops; fixing is a separate, approved step. Not for feature work, performance, or code style.
version: 1.0.0
user-invocable: true
argument-hint: "[supabase|cloudflare|app|deps] [--target <url>] [--offline]"
allowed-tools:
  - Bash(bash .claude/skills/security-audit/scan/*)
  - Bash(node .claude/skills/security-audit/scan/lib/*)
---

An audit is only worth what its evidence is worth. Tools answer what tools can
answer; you reason about what they cannot see — whether a policy's logic is
correct, whether user input reaches a sink through a live route, whether the
authorization model has a hole. **Never spend reasoning on something a command
answers definitively, and never spend a command's silence as if it were an
answer.**

---

## 1. Grounding read — a gate, every run, before any scan

Load [references/00-conventions.md](references/00-conventions.md) now. Then:

1. Read `CLAUDE.md` **in full** — non-negotiables, commit conventions,
   testing checklist, working style.
2. Read `docs/WEBSITE-STATE.md` **end to end**. Not skimmed, not grepped. It
   is the accurate cold-read reference and it **wins** over `CLAUDE.md` and
   `README.md` wherever they disagree.
3. Run `git log -10` and cross-check against `docs/migration/PROGRESS.md`.

Then **state back**, before scanning:

- what the site is and who its users are
- what is deployed where, and which target this run will touch
- what is already known-broken

Two rules that follow from that read:

- **Anything `WEBSITE-STATE.md` already flags as broken is context, not a
  finding.**
- **Anything on the do-not-break list is flagged for the operator, never
  auto-fixed.**

`CLAUDE.md` contains stale claims that will send you chasing ghosts — the
"no backend / GitHub Pages" description, a dead `demo`/`1234` sign-in, a
retired localStorage key. `00-conventions.md` §2 lists them. Verify before
acting on any instruction that depends on one.

---

## 2. The two trust boundaries

Getting this wrong makes the whole audit incoherent.

| | Browser → Supabase direct | Browser → Pages Function |
|---|---|---|
| Credential | publishable key, ships to every visitor | user's JWT, verified server-side |
| Enforcement | **RLS policies** | **service role — RLS bypassed entirely** |
| Audited by | `supabase` scope | `app` scope |
| Failure mode | a policy that exists but is wrong | a route reaching the database before its guard |

The Functions query with the service role, so **they are the trust boundary** —
there is nothing behind them. A route whose guard is missing, mis-ordered, or
whose return value goes unchecked is unauthenticated access to everything that
route can reach.

---

## 3. Scopes

One per session. Load only that scope's reference.

| Scope | Scans | Reference | What only reasoning answers |
|---|---|---|---|
| `supabase` | `30-rls.sh`, `40-supabase-cfg.sh` | [20-supabase.md](references/20-supabase.md) | Is each policy's *logic* right, or does it merely exist? Can `auth.uid()` be satisfied through a row the caller shouldn't reach? Does every write path have `WITH CHECK` constraining the *new* row? Is the identity column itself protected, including on the bootstrap path? |
| `cloudflare` | `55-deploy-exposure.sh`, `50-headers.sh`, `60-cors.sh`, `00-inventory.sh` | [30-cloudflare.md](references/30-cloudflare.md) | Is anything published that shouldn't be — above all, raw `/data` shadowing the access-checking Function? Can a gated response be shared-cached? Is a binding's scope wider than the routes need? |
| `app` | `00-inventory.sh` + targeted greps | [40-appsec.md](references/40-appsec.md) | Is each guard's return value checked *before* the first side effect? Is it the right guard, with an argument the caller can't pick? Which routes take an id without an ownership check? Every `pgrst()` interpolation. Who authors each `innerHTML` value. Where a client-side flag stands in for server authz. |
| `deps` | `10-deps.sh` | [40-appsec.md](references/40-appsec.md) §10 | Reachability triage — which advisories touch a visitor and which touch only a developer machine. |

Always available: [10-severity.md](references/10-severity.md) for ranking,
[60-report.md](references/60-report.md) for the write-up.

### Default — no scope given

Run `bash .claude/skills/security-audit/scan/run-all.sh`, read
`scan/results/<date>/SUMMARY.md`, then report **which scopes the evidence
indicates are worth a session, ranked, with the reason for each.** Do not
audit everything by reflex, and do not start a scope in the same turn — let
the operator choose.

---

## 4. Per-scope flow

### Step 1 — Scan

Run the scope's scripts. Read `SUMMARY.md`'s **tool matrix first**: several
checks fall back to a native equivalent when the real tool is absent, and a
`DEGRADED` result is weaker than the real thing. Its output is the starting
evidence, not the finding list.

Status vocabulary: `OK` · `LEAD` · `DEGRADED` · `SKIPPED` · `ERROR`. `LEAD` is
deliberately not `FINDING`.

### Step 2 — Triage

Discard what the scan proves is fine. For each remaining lead, **open the real
code and follow the real call path.** Most of your effort belongs here.

A lead is a place to look. Findings on this project have dissolved on
inspection before — that is the normal outcome for a meaningful share of
leads, not a failure. Check `CLAUDE.md` and `WEBSITE-STATE.md` before
reporting anything: deliberate design gets said so and left alone.

### Step 3 — Reason about what scanning cannot reach

This is the part with no tool substitute. The scope table's right-hand column
is the question list; the scope reference carries the detail. Plus, in every
scope: **where does the code disagree with `WEBSITE-STATE.md`?** Drift is
where bugs live, because someone believed the document.

### Step 4 — Report, then stop

Write to `SECURITY-AUDIT-<YYYY-MM-DD>.md` per
[60-report.md](references/60-report.md): findings ranked by real
exploitability, each with `file:line`, a reachability trace, blast radius and
a proposed fix; then the investigated-and-dismissed list with reasons; then
accepted risk, human-action items, and what went untested and why.

**Then stop.** The operator decides what gets fixed and in what order. Do not
slide into fixing because a fix looks easy.

### Step 5 — Fix (only after approval)

Per `CLAUDE.md`'s conventions. Clean tree and a dedicated branch first.
Critical and high first, **one finding per commit, each verified before
starting the next.**

Before every commit, show the proposed subject and body and get a go-ahead. No
`Co-Authored-By` trailer and no AI attribution anywhere in a commit — that is
this repo's standing rule, not a per-session preference.

If a fix breaks functionality or touches the do-not-break list: **flag it,
don't ship it.**

---

## 5. Exploit tests

Load [50-pentest.md](references/50-pentest.md) at this step.

Write the failing test **before** the fix, and **only for approved findings.**

The test is the final re-verification: **a finding whose exploit cannot be
reproduced is not real** — it moves to investigated-and-dismissed rather than
getting fixed. After the fix, the exploit must fail *and* a companion test must
prove legitimate access still works. Without that companion, "deny everything"
passes the security test and breaks the product.

Persist under `tests/security/` using the harness there, then wire into
`CLAUDE.md`'s testing checklist so it runs as regression.

**Rules of engagement:** the dev Supabase project and the `pages.dev` preview
are the sanctioned range — seeded fixtures, non-destructive verbs by default,
every request logged. Destructive writes ask first. **Production requires
explicit confirmation for that run**, never inherited from an earlier
approval. No load testing. No third-party systems as targets.

---

## 6. After the audit

Propose — **do not silently write** — updates to `docs/WEBSITE-STATE.md` for
anything the audit changed about how the site works, and to
`docs/migration/PROGRESS.md` for the work done, so the next cold session starts
accurate.

---

## 7. Constraints

- **Never commit or push automatically.** Show the message, get a go-ahead.
- **Never write secrets to disk or into these references.** Scan output is
  redacted on the way out; `.env` is deliberately never read.
- **Minimal, reviewable diffs.** One finding per commit.
- **Flag, don't ship**, anything touching the do-not-break list or breaking
  functionality.
- **State uncertainty.** A `SKIPPED` check is an unanswered question, not a
  pass. A `DEGRADED` result came through a fallback. Never claim a check
  passed when it was not run.
- Use these three phrases precisely and never blur them: *confirmed by reading
  the code* · *confirmed against the real service/data* · *not confirmed live*.

---

## 8. Files

```
scan/
  00-inventory.sh        stack, entry points, route/guard matrix, deploy target
  10-deps.sh             npm audit + OSV.dev + lockfile integrity + CDN/SRI
  20-secrets.sh          history + working tree + browser-fetchable assets
  30-rls.sh              static migration analysis; live catalog when reachable
  30-rls.sql             live-catalog queries (psql + SUPABASE_DB_URL)
  40-supabase-cfg.sh     auth settings, anon reachability, storage, edge fns
  50-headers.sh          served headers vs _headers, CSP, cache on gated routes
  55-deploy-exposure.sh  published files that shouldn't be; raw /data shadowing
  60-cors.sh             hostile Origin, reflection, credentials, cookies
  run-all.sh             runs all of the above -> scan/results/<date>/
  lib/                   common.sh, osv.mjs, rls-static.mjs
references/              00-conventions 10-severity 20-supabase 30-cloudflare
                         40-appsec 50-pentest 60-report
tests/security/          _harness.mjs + probes (project root, not in the skill)
```

`run-all.sh [--target <url>] [--offline] [--only <name>]`. Default target is
the dev preview; production is never a default and is refused without
`DTS_ALLOW_PROD=1`.

References `20`–`50` are pinned. The only thing refetched per run is CVE data
for the current lockfile, which `10-deps.sh` handles.
