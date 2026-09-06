# Conventions — read this before the first scan, every run

This file is loaded at the start of every scope. It carries the grounding
read, the evidence standard, and the specific ways this project will mislead
you if you skip them.

---

## 1. The grounding read (a gate, not a warm-up)

Before running a single scan:

1. **`CLAUDE.md`, in full.** Non-negotiables, commit conventions, testing
   checklist, working style.
2. **`docs/WEBSITE-STATE.md`, end to end.** Not skimmed, not grepped. It is
   the cold-read reference and it is the accurate one.
3. **`git log -10`, cross-checked against `docs/migration/PROGRESS.md`.** The
   session log is newest-first and records what was actually verified versus
   what was merely deployed.

Then state back, in your own words, before scanning:

- what the site is and who its users are
- what is deployed where, and which target this audit will touch
- what is already known-broken

If you cannot state those three things, you are not ready to audit. An audit
that has not read `WEBSITE-STATE.md` will re-report half the known-gaps
section as new findings and burn the operator's trust on the first pass.

---

## 2. Document precedence

`docs/WEBSITE-STATE.md` **wins** over `CLAUDE.md` and `README.md` wherever
they disagree. `CLAUDE.md` says so itself, and so does `WEBSITE-STATE.md`.

`docs/migration/ACCESS-MODEL.md` is normative for identity, orgs, access
levels, `resource_key` format, and entitlements. When a question is "should
this user be able to reach this?", that file is the answer, not your
intuition about what a sensible access model looks like.

### Stale claims that will send you chasing ghosts

Each of these appears in a committed document and is **false about the code
today**. Verify before acting on any instruction that depends on one.

| Claim, and where it appears | Reality |
|---|---|
| "no backend", "static files to GitHub Pages" (`CLAUDE.md` header) | Cloudflare Pages with a substantial Functions backend, Supabase Postgres with RLS, and R2. Confirm the current shape with `00-inventory.sh`. |
| "Sign-in with `demo` / `1234`" (`CLAUDE.md` testing checklist) | Dead. Auth is real Supabase GoTrue. Grep before you trust it. |
| `dtsAdminSession` is a protected localStorage key (`CLAUDE.md`, `README.md`) | Retired; the Supabase session is the session. `dtsAdminDraft` is the live key. |
| `js/clients.js`, Google-Sheet sign-in, `adminUsers` in `data/access/access.json` (`README.md`) | All removed. `README.md`'s auth, deploy, and admin sections predate the migration. |

**Drift like this is itself worth reporting** — not as a vulnerability, but in
the report's documentation-update section. A stale do-not-break entry is a
trap for the next person, and the next person may be you.

---

## 3. Evidence standard

Applied to every finding, without exception.

**Cite `file:line` or a command's output.** A finding a reader cannot locate
is not a finding. No style nitpicks. No "consider refactoring". No
"potentially unsafe" without saying what makes it unsafe here.

**Tool hits and grep matches are leads, not findings.** The scan scripts say
`LEAD`, never `FINDING`, on purpose. Re-verify every lead by opening the real
code and following the real call path before it goes in a report. Findings on
this project have dissolved on inspection before; that is the normal outcome
for a meaningful share of leads, not a failure of the scan.

**Show the reachability path.** Every finding names:

- the entry point (which route, which file, which URL)
- the caller's auth state (anonymous / registered / org member / org_admin /
  site_admin)
- the parameter that carries the payload
- what the caller gets that they should not have

If you cannot fill in all four, the finding is not ready. Say what is missing
rather than shipping it with the gaps papered over.

**Rank by real exploitability, not category alarm.** "XSS" is not
automatically high. See `10-severity.md`.

**Deliberate design gets said so and left alone.** Check `CLAUDE.md` and
`WEBSITE-STATE.md` first. If a thing is documented as an accepted risk or a
considered decision, it belongs in the report's accepted-risk section, in one
sentence, not in the findings table.

  *The one exception worth knowing:* an accepted risk covers the decision that
  was actually made. A **second-order consequence** of that decision — a
  control that was removed alongside it, a mitigation that quietly stopped
  applying — was not part of what anyone accepted, and is fair game.

**Leads that fail re-verification go in "Investigated and dismissed", with the
reason.** Do not drop them silently: the next audit will rediscover them and
redo the work. Do not pad the findings count with them either. The dismissed
list is a first-class section of the report and is often the most useful part
for the next session.

---

## 4. Things this project will do to you

**The do-not-break list is never auto-fixed.** Script and CSS load order in
`index.html`; `js/tour-bridge.js` message strings and ping cadence; the
single-Treedis-iframe rule; the legacy `DTS_CONFIG` shape; the `dtsAdminDraft`
localStorage key; plus the structural rules in `WEBSITE-STATE.md` §7. If a fix
touches any of them, **flag it and stop.** Describe the fix, describe what it
would break, and let the operator decide.

**The git root is not the project root.** The repository is a much larger
personal site; this project is a subdirectory. Every `git` command must be
path-scoped or it returns thousands of unrelated results. `lib/common.sh`
provides `pgit` for exactly this.

**The working tree is often dirty.** Deployed-target probes and local greps
then describe different versions of the site. That is drift, not a finding.
`SUMMARY.md` records the dirty state so you can tell the difference.

**`/data` documents are inert until registered in three places** — the
manifest, `buildConfig()` in `js/content-loader.js`, and the renderer in
`js/app.js`. A field present in JSON and absent from the UI is usually this,
not a bug. It matters for security when a field you assume is enforced is
never actually read.

**Raw `data/` must never ship as static files.** A static asset at
`/data/<path>` takes priority over the access-checking Function at the same
path and bypasses every check on the site at once, silently. This is the
single highest-severity invariant here; `55-deploy-exposure.sh` tests it.

**`js/config.js` is injected dynamically**, so it never appears in a normal
network trace — and it is fetchable, and the repo copy holds real URLs. Easy
to forget; check the deployed copy, not the repo copy.

---

## 5. Reporting language

Three phrases, used precisely, never blurred:

- **"Confirmed by reading the code"** — you followed the call path yourself.
- **"Confirmed against the real service/data"** — you ran the request, decoded
  the response, queried the catalog.
- **"Not confirmed live"** — you reasoned it out and did not execute it.

When a check did not run, say it did not run. A `SKIPPED` is an unanswered
question, not a pass. A `DEGRADED` result came through a fallback and is
weaker than the real tool would have been; report it that way.

Never claim a check passed when it was not run. This is the failure mode the
whole status vocabulary exists to prevent.

---

## 6. Scope discipline

One surface per session. Load only that scope's reference. Scan, triage,
reason, report, **stop**.

Stopping is part of the job. The operator decides what gets fixed and in what
order. Do not slide from reporting into fixing because a fix looks easy.
