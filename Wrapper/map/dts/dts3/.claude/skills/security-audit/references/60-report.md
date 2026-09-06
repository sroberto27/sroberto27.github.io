# Report template

One document per audit date: `SECURITY-AUDIT-<YYYY-MM-DD>.md` at the project
root. **Append** a scope section as each scope completes; do not start a new
file per scope and do not rewrite earlier sections.

Redact every secret and all user data, including inside pasted command output.

---

## Skeleton

````markdown
# Security audit — <YYYY-MM-DD>

**Target:** <url> · **Commit:** <sha> · **Working tree:** clean / N uncommitted
**Scopes completed:** supabase · cloudflare · app · deps
**Scan evidence:** `.claude/skills/security-audit/scan/results/<date>/`

## Grounding

One paragraph, written before scanning: what the site is, what is deployed
where, what is already known-broken. If this is thin, the audit was rushed.

**Tooling:** which checks ran degraded and what would upgrade them.

---

## Findings

| ID | Severity | Component | Title | Status |
|---|---|---|---|---|
| F-01 | Critical | functions/api/... | <one line> | Reported |
| F-02 | Medium | js/app.js | <one line> | Fixed, verified |
| F-03 | Low | _headers | <one line> | Flagged — do-not-break |

Status is one of: Reported · Approved · Fixed, verified · Fixed, unverified ·
Flagged — do-not-break · Human action required.

---

### F-01 — <title>

**Severity:** Critical — impact <x>, exploitability <y>, reachability <z>.
Spell out all three; a bare label gives a disagreeing reader nothing to
disagree with.

**Location:** `path/to/file.js:123`

**What it is.** Two or three sentences. What the code does, and why that is
wrong. No preamble.

**Reachability trace.**
- Entry point: `POST /api/...`
- Route file: `functions/api/....js:12`
- Caller's auth state: anonymous / registered / org member / org_admin / site_admin
- Parameter carrying the payload: `body.orgId`
- What the caller obtains that they should not

**Evidence.** `file:line` excerpts, or command output. Enough that a reader
can confirm it without rerunning the audit.

**Confidence.** One of: confirmed by reading the code · confirmed against the
real service/data · not confirmed live. Never blur these together.

**Blast radius.** What an attacker reaches from here, including what the
compromised component can reach in turn.

**Proposed fix.** The specific change. If it touches the do-not-break list,
say so and stop — describe the fix and what it would break; do not apply it.

**Exploit test.** `tests/security/probe-f01-....mjs` · `node tests/security/probe-f01-....mjs`
- before fix: <output — exploit succeeded>
- after fix: <output — denied>
- companion (legitimate access still works): <output>

**Diff.** The commit, or the diff itself if small.

**Verification.** What was run after the fix, and its output. If it was not
verified, say that instead.

---

## Investigated and dismissed

Every lead that did not survive re-verification. Not padding — the record that
stops the next session redoing this work.

| Lead | Source | Why it is not a finding |
|---|---|---|
| `USING(true)` on `events_insert` | 30-rls | <the actual reason, from reading the policy> |
| N `innerHTML` sites in `js/x.js` | 00-inventory | <who authors the value, and why that settles it> |

State the reason concretely. "Looked fine" is not a reason; "the value is a
constant defined at `file:line` and never reaches user input" is.

---

## Accepted and residual risk

Things that are real, understood, and deliberately not being fixed. One line
each, with where the decision is recorded.

Note second-order consequences separately: an accepted risk covers the
decision that was made, not a control that was quietly removed alongside it.

---

## Human action items

Things the audit cannot do and must not attempt.

- **Key rotation.** Any credential in git history is in the repository
  forever; deletion does not help. Name the key, where it appears, and the
  rotation procedure. Never rotate a key on someone's behalf.
- **Schema changes** requiring a migration and a deploy window.
- **Anything on the do-not-break list.** Describe the fix and what it would
  break; the operator decides.
- **Provider configuration** — redirect allowlists, SMTP, OAuth providers,
  dashboard settings.

---

## Untested areas

What was not covered, and why. A scope not run, a check that skipped, a
degraded fallback that could not answer definitively.

Be specific about what remains unknown. "Storage bucket visibility was not
checked because it needs a service-role key this audit did not take" is
useful. "Storage: not tested" is not.

---

## Documentation updates — proposed, not applied

Write these as proposals for the operator to approve. Do not edit the
documents as part of the audit.

**`docs/WEBSITE-STATE.md`** — anything the audit changed about how the site
works, plus any drift found between the document and the code.

**`docs/migration/PROGRESS.md`** — a session-log entry for the work done, so
the next cold session starts accurate.

**`CLAUDE.md`** — the testing checklist, when a new regression test lands
under `tests/security/`.
````

---

## Writing rules

- **Rank by real exploitability, not category.** A trivially reachable Medium
  goes above a hard-to-reach High.
- **One finding per entry.** Two bugs sharing a file are two findings.
- **No finding without `file:line` or command output.**
- **No style nitpicks.** If it is not exploitable and not a real control gap,
  it is not in this document.
- **Separate committed from deployed.** On a project with a manual deploy,
  "fixed" and "live" are different claims and only one of them protects
  anyone.
- **Say what you did not do.** An audit that reports only what it found reads
  as more complete than it is.
