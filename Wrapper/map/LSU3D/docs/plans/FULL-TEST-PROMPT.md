# Full test triage — prompt

**How to use:** fill in `docs/TEST-PLAN.md` by hand, then run `/full-test` from
`Wrapper/map/LSU3D/`, or paste everything below the line as your message.

The test plan is filled in by a human. This prompt is what a Claude session does
with the results.

---

You are working inside the existing **LSU3D / Death Valley Experience** project
(`Wrapper/map/LSU3D/`).

I have just run the acceptance tests by hand and recorded the results in
**`docs/TEST-PLAN.md`**. Your job is to work through what failed and fix it.

## 1. Read before doing anything

1. `docs/TEST-PLAN.md` — **in full**, including every Comments cell. The
   comments carry more information than the tick boxes.
2. `CLAUDE.md` — the working rules and the do-not-break list.
3. `docs/WEBSITE-STATE.md` — how the app actually works today.
4. `docs/DATA-SCHEMA.md` — if any data or content row failed.

## 2. Report back before fixing anything

Start with a triage, not a patch. Give me:

- **Counts** — pass / fail / not tested, and how that compares to the summary I
  wrote at the bottom (if they disagree, say so — I may have miscounted).
- **The blocking list**, in this order:
  1. Section A regressions — something that used to work and now doesn't.
  2. Privacy and security failures (J26–J33).
  3. Everything else that failed.
- **For each failure: your best guess at the cause, with the file and function**,
  and how confident you are. Say "I don't know yet" where that's true rather
  than inventing a plausible-sounding cause.
- **Failures that are probably one bug.** Several rows often share a root cause;
  say so instead of listing them as separate work.
- **Rows I marked Pass that you think are wrong** — if a comment describes
  behaviour that shouldn't happen, flag it even though I ticked Pass.
- **Rows marked N/T that actually matter** — particularly anything in Section A,
  D, or the privacy block. Untested is not the same as working.

Then stop and let me confirm the order of work.

## 3. Fixing

Once I've confirmed:

- **Reproduce before you fix.** If you can't reproduce it, say so and tell me
  what extra information you need from the device it happened on — don't
  speculatively change code and call it fixed.
- **One fix per commit**, scoped to `Wrapper/map/LSU3D/`. Show me the commit
  message and wait for a go-ahead, every time (`CLAUDE.md`).
- **Smallest change that fixes the actual cause.** No refactoring on the way
  past, no redesigning a working system because you're already in the file.
- **Respect the non-negotiables in `CLAUDE.md`** — script and CSS load order,
  the Treedis message contract and single iframe, the `CAMPUS_CONFIG` shape, the
  data-adapter seam. If a fix seems to need one of those broken, stop and tell
  me why instead of doing it.
- **Wrap, don't replace.** `js/14-redesign.js` and `js/17`–`21` wrap shared
  functions by reassignment. A new hook follows the same pattern and loads
  after them.
- **After each fix, tell me exactly which test rows to re-run**, and update
  those rows in `docs/TEST-PLAN.md` — result and a note saying what changed.

## 4. Verification honesty

This matters more than speed.

- Label every claim **"confirmed by reading code"** or **"confirmed in a
  browser"**. Never blur them.
- Anything visual, mobile, GPS-dependent, or timing-dependent is **not verified
  until it is verified on a real device**. Reading the code is not evidence for
  those, and neither is a passing Node test.
- `node scripts/validate-data.mjs` must be clean after any data change.
- If a fix could plausibly affect Section A, say which A rows I should re-run.

## 5. Do not

- Do not mark anything Pass in `docs/TEST-PLAN.md` yourself on the strength of
  reading code. Results come from me running it. You may fill in a row's
  Comments with what you changed and set the result back to **N/T (retest)**.
- Do not fix things I didn't report as broken. If you spot something else while
  you're in there, tell me — don't quietly change it.
- Do not delete or rewrite tests to make them pass.
- Do not push. Do not create tags. Do not touch the baseline tag
  `baseline/lsu3d-github-pages-2026-08-27`.
- Do not add AI attribution to any commit (`CLAUDE.md`).

## 6. When it's finished

When the failures I care about are fixed:

- A short summary of what was broken, what caused it, and what changed.
- Anything still outstanding, and why it was left.
- Anything the test plan should have caught but didn't — propose the rows to add
  to `docs/TEST-PLAN.md`.
- Any **NEEDS CONFIRMATION** left open (real gameday data, staff contact
  numbers, kiosk hardware, whether walking routes are needed).
