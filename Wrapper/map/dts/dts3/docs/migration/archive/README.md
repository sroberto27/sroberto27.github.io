# Archived phase-testing documents

These are **historical**. They were each written for one migration phase and are
superseded by the single consolidated
[`docs/migration/FULL-SYSTEM-TESTING.md`](../FULL-SYSTEM-TESTING.md), which
merges them, de-duplicates the overlapping checks, folds in `CLAUDE.md`'s
standing regression checklist, and adds the never-verified-live fixes from the
2026-08-09 / 2026-08-10 audit sessions.

Kept, not deleted, because two of them carry **real results a human actually
recorded** — that's evidence, not scaffolding.

| File | Phase | Results inside |
|---|---|---|
| `PHASE8-BUILDS-TESTING.md` | 8 — builds & downloads | **Real.** 12/13 passed in a live pass; test 8 failed ("no way to delete a build"), was fixed the same session, and the follow-up retest was never run. |
| `PHASE9-TESTING.md` | 9 — analytics, events, audit, marketing tags | None — never filled in. |
| `HELP-DOCS-TESTING.md` | in-app documentation (standalone, not a numbered phase) | None — never filled in, and never spot-checked by an agent either. |
| `USER-ACCESS-MIGRATION-TESTING.md` | 3–9 access model, acceptance checklist | None — never filled in. |

**Don't run these instead of the consolidated document.** Read them only when
you want the original phase-scoped framing, or to see what a past pass actually
found. Everything still worth testing has been carried forward.
