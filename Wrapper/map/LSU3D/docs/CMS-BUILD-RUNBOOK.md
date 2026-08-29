# Runbook — building the CMS, step by step

**For you, not for Claude.** This is the sequence from "LSU sent their answers"
to "staff are editing content themselves", with the checks that stop it going
wrong in the middle.

Work through it in order. Steps 1–4 are yours alone. Step 5 is where Claude
starts. **Do not skip step 4** — it is the one that decides whether the rest is
worth doing.

---

## Before anything

You need three things ready:

- **`docs/LSU-INFORMATION-REQUEST.md` sent to LSU** — this is the questionnaire.
  Send it as-is, or reformat it into an email; the content is what matters.
- **`docs/LSU-ANSWERS.md` in the repo** — where replies get recorded.
- **A machine with the repo, Node, and Python** — the same setup you have now.

You do **not** need a Cloudflare account or a Supabase project yet. Those come
at step 8, and creating them early just means paying attention to something
nobody is using.

---

## Step 1 — Send the request

Send `docs/LSU-INFORMATION-REQUEST.md` to whoever runs recruiting operations.

If you can, ask for two things beyond the document:

1. **A real gameday schedule sheet** — a photo of the printed graphic is ideal.
   You do not need it typed up.
2. **Half an hour with whoever actually walks families around on gameday.** This
   is the highest-value item in the whole process. The questionnaire captures
   what people think happens; that conversation captures what does.

## Step 2 — Record every answer in `docs/LSU-ANSWERS.md`

As replies arrive, paste them in. Rough notes are fine.

**Answers that live only in an email thread or someone's memory do not count.**
`/cms-build` reads `LSU-ANSWERS.md` and nothing else. If it is not in that file,
the work will stop and ask for it again.

Keep the status table at the top current — it is the fastest way to see where
you are.

## Step 3 — Put the real content into the repo

Once §1 and §3 are answered:

```bash
cd Wrapper/map/LSU3D
```

1. **Create a real gameday file.** Copy `data/gamedays/sample-gameday.json` to
   something like `data/gamedays/2026-09-05-alabama.json`, fill in the real
   times, opponent, kickoff and instructions. `docs/CONTENT-EDITING.md` walks
   through this.
2. **Add it to `data/gamedays/index.json`.**
3. **Fix any stop positions** LSU corrected, in `data/tours.geojson`.
4. **Check your work:**

```bash
node scripts/validate-data.mjs
```

Must say `0 error(s)`. It will refuse a misspelled stop key, a time written as
`2:15pm`, a missing timezone, or a personal name in a contact.

5. **Look at it in a browser:**

```bash
python -m http.server 8000
```

Open `http://localhost:8000/?g=2026-09-05-alabama` and read it as a recruit's
family would. **This is the first time the app has ever shown true information.**
Expect to find things that read badly — that is the point of doing it before
building an editor around it.

## Step 4 — Decide whether to proceed *(do not skip)*

Stop and look at what came back. Three honest outcomes:

**A. The blocking answers arrived, and the real data works.** Go to step 5.

**B. Some blocking answers are missing.** Do not start. Chase the gaps. If it
helps, `/cms-build` will tell you precisely which ones are missing and stop —
running it is a safe way to check.

**C. The real data does not fit the current model.** For example: groups split
onto different schedules, or times shift hourly on the day, or each stop needs
several contacts. **This is a good outcome, found at the right time.** Say so
when you run step 5; the plan should be shaped around what is actually true, not
around the placeholder file.

One question worth asking yourself here: **has anyone actually tried editing the
JSON by hand and found it painful?** If a developer edits content twice a season
and nobody has complained, a CMS may not be the most valuable next thing. The
information is worth gathering regardless; the editor is only worth building if
someone needs it.

## Step 5 — Run `/cms-build`

```
/cms-build
```

From `Wrapper/map/LSU3D/`. It enters Plan Mode, which cannot change anything.

It will read `LSU-ANSWERS.md` first and check the five blocking items. If any
are missing it stops and names them — that is working correctly, not failing.

If they are all there, it reads the project, reads the sibling `../dts/dts3/`
implementation, and produces a plan at `docs/plans/CMS-IMPLEMENTATION-PLAN.md`.

**Nothing is created, installed or provisioned on this pass.** No accounts, no
databases, no deployments.

## Step 6 — Read the plan properly

Do not approve it on skim. Check specifically:

- **Does it match what LSU actually said**, or has it drifted back to the
  placeholder assumptions?
- **What does it want you to create by hand**, and roughly what will that cost?
- **Where is the point of no return** — the moment the live site depends on
  something new?
- **Is the rollback real?** It should name the baseline tag
  `baseline/lsu3d-github-pages-2026-08-27`.

Push back where it feels wrong. A plan is cheap to change; a half-built CMS is
not.

## Step 7 — Approve, and build in stages

Implementation should arrive in small batches, each committed separately, each
with the commit message shown to you first. That is required by `CLAUDE.md` and
it has held all the way through Phases 1 and 2.

After every batch:

```bash
node scripts/run-tests.mjs
node scripts/validate-data.mjs
```

Both must stay green. And remember what they can and cannot tell you — they
prove logic, never appearance. **Anything visual still needs `TEST-PLAN.md` and
a browser.** This project has shipped four bugs of exactly that kind while the
test suite was green.

## Step 8 — Create the accounts, when the plan says to

**Only at this point.** The plan will tell you what is needed and in what order.
Expect roughly:

- A **Cloudflare** account, a Pages project, and R2 buckets
- A **Supabase** project, with the database schema applied by migration

Two rules, both inherited from how `../dts/dts3/` was done:

- **You create the accounts, not Claude.** Anything involving credentials,
  billing or ownership stays with you.
- **No secret goes into committed code.** The Supabase anon key is public by
  design; the service-role key must never leave a server-side Function. If you
  are ever asked to paste a secret into a file in this repo, something is wrong.

Watch the free-tier ceilings. `../dts/dts3/functions/api/publish.js` documents
hitting Cloudflare's 50-subrequest limit on a full publish and having to be
rewritten — that is the kind of thing that bites in production, not in testing.

## Step 9 — Prove parity before switching anything off

**GitHub Pages stays live and correct the entire time.** The new stack runs
alongside it until it is proven, not instead of it.

Fill in **Section I of `docs/TEST-PLAN.md`** on the new host: every existing
URL, all ten stops, deep links, any printed QR codes, My Gameday, Live Visit,
kiosk, the service worker.

**Printed QR codes are the one thing that cannot be fixed later.** If a code
exists on a stadium gate, its `stop_key` must resolve identically after
migration. Test it with an actual phone and an actual code.

## Step 10 — Cut over

Only when Section I passes. The plan will give the sequence. Keep the baseline
tag and the rollback procedure to hand until the new stack has survived a real
gameday.

---

## If it goes wrong

| Symptom | Do this |
|---|---|
| `/cms-build` stops and says answers are missing | Working as intended. Chase the answers; do not work around it |
| The plan assumes things LSU did not say | Reject it and say which parts. Do not let it proceed on a guess |
| Real data does not fit the schema | Good — found early. Re-plan around the real shape |
| Something breaks after a deploy | `git revert` the batch. `main` is production; never rewrite its history |
| The service worker pins a bad build on a device | Send that device the app URL with `?sw=off` — no deploy needed |
| Everything is broken and you need the known-good site | Deploy `baseline/lsu3d-github-pages-2026-08-27` |

## What never to do

- **Never put a personal phone number, a recruit's name, or an email address in
  `data/`.** It is world-readable and permanent in git history. If LSU's answers
  require personal contact details, they go behind authentication.
- **Never skip the browser tests because the Node tests are green.** They cannot
  see contrast, layering, or layout.
- **Never change a `stop_key` once a QR code carrying it has been printed.** The
  code cannot be recalled.
- **Never let the live GitHub Pages site break** while the new stack is being
  built. It is the fallback.
