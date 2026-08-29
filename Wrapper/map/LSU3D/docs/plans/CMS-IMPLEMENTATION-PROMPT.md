# Phase 3 — CMS implementation brief

**How to use:** once LSU have answered `docs/LSU-INFORMATION-REQUEST.md`, run
`/cms-build` from `Wrapper/map/LSU3D/`, or paste everything below the divider.
Plan Mode first. The plan goes in `docs/plans/CMS-IMPLEMENTATION-PLAN.md`.

**Do not run this before the answers exist.** §0 is a gate, and it is there
because starting early is the specific way this goes wrong — a CMS designed
against `sample-gameday.json` gets rebuilt the moment real data arrives.

---

You are working inside the existing **LSU3D / Death Valley Experience** project
(`Wrapper/map/LSU3D/`). Phases 1 and 2 are built, live, and must not be
disturbed. This is Phase 3: give LSU staff a way to edit content without a
developer, on a real backend.

**Enter Plan Mode. Do not implement, create accounts, provision anything, or
run migrations on this pass.**

## 0. Gate — check this first, and stop if it fails

Phase 3 was paused deliberately. Confirm the information actually arrived before
planning anything. Look for answers to `docs/LSU-INFORMATION-REQUEST.md` — in
the repo, in `data/`, or from the user directly.

**Required before you plan:**

| Needed | Why it blocks the plan |
|---|---|
| At least one **real gameday schedule** | The whole data model. A CMS shaped around invented times is a CMS that gets rebuilt |
| **Who a family calls**, and whether that number may be public | Decides whether any content can live in a public file at all |
| **The privacy decision** (§8) — public links, signed expiring links, or staff logins | Decides the entire backend: RLS, tokens, whether Functions gate reads |
| **Who edits, and whether anything needs approval** (§6) | Decides roles, draft/publish separation, and the whole editor UX |
| **Confirmation of the four uncertain stops** (§3) | `stop_key` values become permanent once QR codes are printed |

If any are missing: **say exactly which, stop, and do not plan around a guess.**
Offer to plan the parts that are genuinely unblocked, if any are.

## 1. Read before planning

In this order:

1. `CLAUDE.md` — non-negotiables, commit rules
2. `docs/WEBSITE-STATE.md` — how the app works now; §0 carries the status
3. `docs/LSU-INFORMATION-REQUEST.md` **and the answers**
4. `docs/DATA-SCHEMA.md` — the current content contract
5. `docs/CONTENT-EDITING.md` — the workflow the CMS replaces
6. `docs/TEST-PLAN.md` — §I is the migration parity section, currently empty

Then read the sibling project, which matters more than any of the above:

**`../dts/dts3/` is a complete working implementation of this exact stack.**
Do not design from first principles; copy what works and diverge only with a
stated reason.

| File | What to take from it |
|---|---|
| `CLAUDE.md`, `docs/migration/PROGRESS.md` | How the migration was actually sequenced |
| `docs/migration/ACCESS-MODEL.md` | The auth model — roles, what gates what |
| `docs/migration/WORKFLOW.md` | Deploy discipline, and why no account id is committed |
| `docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md` | What the human has to do, and what must never be automated |
| `js/admin.js` | The editor: draft to localStorage, live preview, export the data folder |
| `js/content-loader.js` | How the app reads published content |
| `functions/api/publish.js` | The publish endpoint — **read the header comment**, it documents blowing Cloudflare's 50-subrequest limit and having to go diff-based |
| `functions/_lib/admin.js` | `requireSiteAdmin`, audit writes |
| `supabase/migrations/*.sql` | Real schema and RLS policies |
| `wrangler.toml` | Pages + R2 bindings |

## 2. Settled — do not re-litigate

These were decided with the user. Reopen one only with a concrete reason.

- **Copy the dts3 architecture.** Cloudflare Pages + Functions, R2 for media,
  Supabase for auth and data.
- **Staff authenticate. Recruits and families never do.** No account, ever, to
  view a gameday. A login between a 17-year-old and their visit schedule is a
  product failure, not a security win.
- **Per-recruit privacy = signed, expiring links** validated by a Function —
  not recruit accounts.
- **`js/00-data-adapter.js` stays the only place that knows where content comes
  from.** The CMS replaces `loadDataJSON()`; no UI file learns about a backend.
- **Editing model:** edit → draft with live preview → publish. Export-and-commit
  first if that ships sooner; a publish Function second.
- **GitHub Pages stays live and correct until parity is proven.** Baseline tag
  `baseline/lsu3d-github-pages-2026-08-27`.

## 3. What the CMS must control

Plan the full surface. Say explicitly which parts are phase one and which wait.

**Gamedays** — create, edit, duplicate a previous one, archive; opponent,
kickoff, timezone, visit-wide notes; per-stop arrive/depart/instruction;
staff contacts (role, number, note).

**Stops and content** — name, category, description, "what happens here",
address, hero image, tour order. **`stop_key` must be editable only while no QR
code exists for it, and frozen afterwards** — a printed code that stops
resolving cannot be recalled. Design for that explicitly.

**Media** — upload to R2, alt text, replace, delete; guard against orphans.

**Immersive** — Treedis model/tour URLs and per-stop sweep ids, if a capture
ever exists. If LSU said no capture is planned, propose removing the wiring
rather than maintaining a hidden feature.

**App settings** — kiosk dwell/idle, feature flags (`config.gameday.enable*`),
the service worker flag. Decide carefully which of these belong to staff and
which stay developer-only; a flag that can break the site should not be a
button in a CMS.

**Publishing** — draft state, live preview, publish, and **rollback**. Validate
on save using the same rules as `scripts/validate-data.mjs` (share the logic;
do not reimplement it — dts3 makes this point about `split-logic.js`). An audit
trail of who changed what.

**Roles** — at minimum editor and publisher if LSU said changes need approval;
a single admin role if they did not. Match §6 of their answers, not an
imagined org chart.

## 4. Guardrails

- **Never put a secret in frontend code.** The Supabase anon key is public by
  design; the service-role key must never leave a Function.
- **Nothing personal in a public file.** `data/` is world-readable and
  permanent. If LSU's answers require personal contact details, those move
  behind auth — they do not go in `data/` with a shrug.
- **Do not break the read path.** Every change keeps the current app working for
  a visitor with no account.
- **Do not create accounts, projects, buckets or DNS records.** List what the
  user must create, and what must stay manual.
- **Keep `js/*.js` load order intact** (`CLAUDE.md`) and wrap rather than
  replace.
- **`node scripts/run-tests.mjs` and `scripts/validate-data.mjs` stay green.**
  Add tests that fail against the previous commit.

## 5. Plan output

Sections A–I as in `GAMEDAY-EVOLUTION-PROMPT.md`, plus:

- **A migration sequence** with GitHub Pages live throughout, and the exact
  point of cutover
- **A parity checklist** filling `docs/TEST-PLAN.md` §I — every existing URL,
  all 10 stops, deep links, printed QR codes, My Gameday, Live Visit, kiosk
- **A rollback procedure** to the baseline tag
- **A cost estimate** — Cloudflare and Supabase free-tier limits against
  expected use, and what happens at the ceiling
- **What the user must do by hand**, in order, with what each unlocks

## 6. Do not, on this pass

Implement, commit, push, install, create Supabase or Cloudflare resources, run
migrations, touch DNS, or modify the live site. Inspect and plan only.

If something in the settled architecture conflicts with what you find in the
answers or the code, **say so and recommend the safest path** rather than
quietly working around it.
