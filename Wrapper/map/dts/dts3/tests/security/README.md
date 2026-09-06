# tests/security

Exploit and regression probes for findings from the `security-audit` skill.

**This directory holds a harness and no probes yet, and that is deliberate.**
A probe is written against an *approved* finding, before its fix. Writing
speculative probes for hypothetical bugs produces a suite that passes forever
and proves nothing.

---

## The protocol

1. **The finding is approved for fixing.** Not merely reported — approved.
2. **Write the failing probe first**, before the fix.
3. **Run it. It must fail** — meaning the exploit succeeds.
   *If the exploit cannot be reproduced, the finding is not real.* It moves to
   the audit report's investigated-and-dismissed section and does **not** get
   fixed. This is the single most valuable step in the whole flow: a scan hit
   that survived triage and still cannot be executed was a plausible story
   about the code, not a vulnerability.
4. **Fix it.** One finding, one commit.
5. **Re-run.** The exploit must now be denied.
6. **Write the companion probe**: the user who *should* have access still
   does. Without it, "deny everything" passes the security test and breaks the
   product.
7. **Wire it into `CLAUDE.md`'s testing checklist** so it runs as regression.

---

## Running a probe

```bash
# From the project root.
export DTS_TEST_USER_PW=...          # the seeded dev fixture's password
node tests/security/probe-f01-cross-org-read.mjs
```

Exit 0 = every assertion passed. Exit 1 = something failed; the output says
whether the exploit still works or the fix over-denied. Exit 2 = refused to
run (production target without explicit approval).

Every request and response is logged to `tests/security/logs/<run>.jsonl`,
with tokens and keys redacted. A finding you cannot replay is not evidence.

### Environment

| Variable | Purpose |
|---|---|
| `DTS_AUDIT_TARGET` | Site under test. Defaults to the dev preview. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Override; otherwise read from `js/supabase-init.js`. |
| `DTS_TEST_SITEADMIN_PW` etc. | Fixture passwords. Never hardcoded, never defaulted. |
| `DTS_ALLOW_PROD=1` | Required to target production. Per run, never inherited. |

A probe that cannot authenticate **throws** rather than continuing. Silently
degrading into an anonymous test would report a pass for a test that never
ran.

---

## Writing a probe

```js
import { begin, signInAs, pgrst, site, expectDenied, expectAllowed, report }
  from "./_harness.mjs";

// PASS means: user B's rows are not readable by user A, and A's own rows are.
begin("F-01 -- cross-org read on resource_entitlements");

const a = await signInAs("member");
const b = await signInAs("orgAdmin");

// The exploit: A asks for B's org's rows.
expectDenied(
  "member cannot read another org's entitlements",
  await pgrst(a, `resource_entitlements?subject_id=eq.${B_ORG_ID}&select=*`)
);

// The companion: A can still read their own.
expectAllowed(
  "member can still read their own entitlements",
  await pgrst(a, `resource_entitlements?subject_type=eq.user&subject_id=eq.${a.userId}&select=*`)
);

report();
```

Rules that keep the suite worth having:

- **One question per file.** A probe testing three things reports one result
  and hides two.
- **Assert on content, not status.** `expectDenied` treats a `200` carrying
  rows as a failure — the same status code as a correct empty response.
- **Self-contained fixtures.** Create what you need; remove what you created.
- **Name it after the finding**: `probe-<id>-<short-name>.mjs`, so report,
  commit, and test are findable from each other.
- **One line at the top saying what PASS means.** The next person needs to
  know whether red means the bug is back or the fixture drifted.

---

## Probes worth building as findings land

Each is more valuable as a sweep than a single case — a sweep catches the
sibling bug the reported finding did not mention.

- **Cross-user RLS sweep** — user A's session against user B's rows, every
  table, every verb. Highest value in the suite; table-driven so a new table
  is one line.
- **Unauthenticated PostgREST reads** — every table with only the publishable
  key. Check rows, not status.
- **Forged tokens** — expired, malformed, `alg:none`, and a valid token from a
  different Supabase project. On an auth-optional route, assert the
  *downstream* access check denies, not that the token verifier errored.
- **IDOR sweep** — a low-privilege session against every id-taking route with
  another user's and another org's identifiers, every verb.
- **Write-path escalation** — update a row you own while changing the column
  that determines ownership or tenancy; self-grant an org membership;
  self-promote a role directly through PostgREST.
- **Rate limits** — login, signup, reset, OTP, and any unauthenticated write
  endpoint. Fewest requests that answer the question; this is not load testing.
- **Injection fuzz** — inputs reaching SQL, RPC, shell, templates, and URL
  query strings. For this codebase the last matters most: `#`, `&`, `,`, `=`
  and `%23` in any value landing in a PostgREST filter. Assert rejection, not
  merely an empty result — an empty result can mean the filter truncated.
- **Path traversal** — `../` and encoded variants in any key building an
  object-store path.
- **Storage / signed URLs** — no session, past expiry, guessed path.
- **Build-artifact secret scan** — against the artifact that will actually be
  uploaded, not the source tree. This is the check that catches the exposure
  class this project has already had.

---

## Rules of engagement

The dev Supabase project and the `pages.dev` preview are the sanctioned range:
seeded fixtures, non-destructive verbs by default, every request logged.

- Destructive writes — `DELETE` against existing data, role changes on real
  accounts, anything altering shared state — **ask first**, every time.
- **Production requires explicit confirmation for that run.** The harness
  refuses without `DTS_ALLOW_PROD=1`, and approval never carries over to the
  next run.
- No load testing. No detection evasion. No third-party systems as targets —
  the tour host, the form relay and the video hosts are out of scope, always.

Full detail: `.claude/skills/security-audit/references/50-pentest.md`.
