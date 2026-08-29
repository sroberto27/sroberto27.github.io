# LSU3D docs — index

**Start with `WEBSITE-STATE.md`.** It opens with the project's current status
(Phases 1 and 2 built and live; Phase 3 paused pending LSU) and then describes
every subsystem as it actually works today.

## Working references

| Document | What it is |
|---|---|
| `WEBSITE-STATE.md` | **Cold-read reference.** Status, every subsystem, the loading sequence, and an explicit list of what does *not* exist yet. Read this first. |
| `../CLAUDE.md` | Working rules, non-negotiables, commit conventions, testing checklist. |
| `../README.md` | The Leaflet → MapLibre migration story; Google Photorealistic 3D Tiles setup, cost, and fallback behavior. |

## Content and data

| Document | What it is |
|---|---|
| `DATA-SCHEMA.md` | The contract for every file under `data/` — field by field, including the `stop_key` slugs that printed QR codes depend on and the privacy rules for a world-readable repo. |
| `CONTENT-EDITING.md` | The staff-facing version of the above: which file to open for which change, how to set up a gameday, and how to check your work before pushing. |
| `CMS-BUILD-RUNBOOK.md` | **Step-by-step process for building the CMS**, from sending the request to cutting over. Written for a person, not for Claude. Start here when LSU reply. |
| `LSU-ANSWERS.md` | Where LSU's replies get recorded. `/cms-build` reads this file to decide whether Phase 3 can start — answers kept anywhere else do not count. |
| `LSU-INFORMATION-REQUEST.md` | **What we need from LSU.** 40 questions for athletics staff, written for them rather than for developers. §1–3 block a real gameday; the rest shapes the CMS. |

## Testing

| Document | What it is |
|---|---|
| `TEST-PLAN.md` | The hand-run acceptance checklist for all three phases — Pass / Fail / Not tested per row, filled in by a person. |
| `plans/FULL-TEST-PROMPT.md` | What a Claude session does with the filled-in results: triage first, reproduce before fixing, never mark a row passed from reading code. Also available as `/full-test`. |

Automated checks live in `../scripts/`:

```bash
node scripts/run-tests.mjs        # all suites — logic only, blind to anything visual
node scripts/validate-data.mjs    # everything under data/
```

**Green Node tests never mean "it works."** They load the real `js/*.js` files
against a stubbed DOM and a stubbed map, so they prove logic — slugs resolve,
wrappers call through, handlers fire in order. They cannot see contrast,
stacking order, whether one panel covers another, or mobile layout. This project
has shipped four bugs of exactly that kind while the suite was green. Anything
visual needs `TEST-PLAN.md` and a browser.

## Planning briefs

| Document | What it is |
|---|---|
| `plans/GAMEDAY-EVOLUTION-PROMPT.md` | The original multi-phase brief: Phase 1 "Make It Useful", Phase 2 "Make It Fast", then the hosting migration. **Run in Plan Mode.** Phases 1 and 2 are done; the Phase 3 section is the live part. |
| `plans/CMS-IMPLEMENTATION-PROMPT.md` | **Phase 3, for later.** The brief for building the CMS on Cloudflare + Supabase, modelled on `../../dts/dts3/`. Opens with a gate: do not run it until LSU have answered the information request. Run with `/cms-build`. |
| `plans/GAMEDAY-EVOLUTION-PLAN.md` | The approved Phase 1 plan produced from that brief. Historical — Phase 1 shipped. |
| `LSU_Mobile_4G_Audit_Prompt.md` | Earlier, narrower mobile / slow-4G brief. Largely answered by Phase 2, which found the basemap was ~95% of the page weight. |

## Source data

| Document | What it is |
|---|---|
| `death_valley_stops.csv`, `death_valley_stops_updated.csv`, `death_valley_stops.geojson` | Tour-stop source data from LSU Athletics gameday ops, with per-stop `confidence` flags (`verified` / `derived` / `pending`). **Several are still `derived` or `pending`** — §3 of the information request asks LSU to confirm them. |
| `LSU_Death_Valley_Journey_Map.svg` | Visualization of the 10-stop gameday journey. |

---

## Where the project stands

Phases 1 and 2 are built, committed and live. Phase 3 — a CMS on Cloudflare +
Supabase — is **paused by decision**, not blocked on code.

The reason is in `LSU-INFORMATION-REQUEST.md`: the app runs entirely on
placeholder content, and a CMS is a tool for editing content that exists. When
the answers arrive, the architecture is already settled — copy `../../dts/dts3/`,
which is a complete working implementation of the same stack (Cloudflare Pages +
Functions + R2 + Supabase with RLS, plus a mini-CMS that drafts to localStorage,
previews live, and exports the data folder).
