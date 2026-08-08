---
description: Phase 2 — Scrub secrets from /data and retire the Google Sheet
---

Phase 2 of the DTS migration. Prerequisite: Phase 1 deployed and tested.
Re-read the golden rules in `docs/migration/WORKFLOW.md`. **Plan first, execute after approval.**

Goal: remove every credential and secret that is currently public. Everything under
`/data` is world-readable, and the repo history + published sheet leak real values.
Read `docs/migration/ACCESS-MODEL.md` first — it affects item 1 below.

Plan, then do:

1. **`data/access/access.json`** — delete `adminUsers` (including the
   `CHANGE_ME_BEFORE_DEPLOY` placeholder), `demoDirectory`, and `directorySource`.
   KEEP `ui` copy and `portal.sections` — that's CMS content, not auth.
   **Delete `roles` too — do NOT keep it.** Under the access model this migration
   builds (Phases 3-5b), `roles` stops being descriptive copy and becomes a
   real authorization concept (`site_role`/`org_role`, defined in
   `ACCESS-MODEL.md`) that lives in Supabase, not in a world-readable static
   file. Leaving the old `roles` block (with its `permissions` array) sitting
   in public `/data` after Phase 5b ships would be a stale, misleading
   artifact next to the real authorization system — delete it now rather than
   carry it forward. Confirm nothing in `app.js`/`admin.js` hard-crashes when
   these are gone (they will be replaced in Phases 4–5; for now the site may
   lose admin/sheet login, which is expected and fine on the dev deploy).
2. **`js/clients.js`** — delete `sheetCsvUrl`. Optionally keep only `demoDirectory`
   gated behind `location.hostname === 'localhost'` so it can never run in production.
3. **Google Sheet** — the URL is in `clients.js` and `access.json` and git history.
   Deleting references is not enough: the user must UNPUBLISH the sheet at Google
   (File → Share → Publish to web → Stop). Add this as an explicit manual to-do.
4. **Web3Forms key** — currently public in `data/site/lead.json`. Plan the rotation
   (register a new free key; it moves behind a Function in Phase 7). For now, note it
   for rotation; don't wire the Function yet.
5. **Local git repo** — make it private/local only; if a mirror is desired, a private
   non-GitHub host. The old GitHub repo should be made private or deleted since its
   history holds the sheet URL and old key.
6. Redeploy (`wrangler pages deploy .`), update `PROGRESS.md`. Stop. Next: `/migrate-phase3`.
