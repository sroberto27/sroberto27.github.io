# Deploying to the Cloudflare dev URL — the verified-safe procedure

This exists because the same mistake happened three separate times across
Phases 6 and 8 (a dropped catch-all Function route, un-excluded internal
directories, a manifest listing files that don't exist) — each one found in
prose inside `PROGRESS.md`'s session log, never as a single authoritative
checklist. Read this before rebuilding deploy staging; don't reconstruct it
from memory of old session-log entries.

## Why a separate staging directory at all

`wrangler.toml` sets `pages_build_output_dir = "."`, which — taken
literally — would deploy the entire repo root, including `.env`, `scripts/`,
`supabase/`, `docs/migration/`, and the raw `data/` folder. None of that can
ship. The fix is not a config change: build a **separate staging directory**
elsewhere (never inside the repo), copy only what belongs in it, and pass
that directory as an explicit argument to `wrangler pages deploy` — run from
the repo root, so `wrangler.toml`'s R2 bindings still resolve correctly.

## Include

- `index.html`, `_headers`
- `css/`, `js/`, `assets/`, `vendor/`, `functions/`
- `models/` — **except** the two oversized unused Backrooms `.usdz` files
  (`DTScube_Backrooms_Animated.usdz`, `DTScube_Backrooms_Animated_v2.usdz`,
  ~26.4MB each — over Cloudflare's 25MB single-file cap)
- **Overlay `js/config.js`** in the staged copy with `.build/js/config.js`
  (the deploy-time-only STRIPPED fallback config `scripts/split-content.mjs`
  produces — never deploy the real, unstripped repo `js/config.js` as-is; it
  carries all 16 real gated tour URLs). If `.build/js/config.js` doesn't
  exist yet, or is stale relative to real `js/config.js`/`/data` project
  content changes, run `node scripts/split-content.mjs` first to regenerate
  it (this also refreshes `.build/data-current`/`.build/data-source`, the
  separate R2-upload staging trees — see "What this does NOT cover" below).

## Exclude

`data/` (the raw, unstripped source — **must never be static**; it's served
only through `functions/data/[[path]].js` from R2, and a static file at the
same path would take priority over that Function, bypassing every access
check), `scripts/`, `supabase/`, `docs/` (both `migration/` and `plans/`),
`tools/` (`gis-harvest.mjs` shipped live, unnoticed, for the entire
migration until this was written — a real, low-severity leak of internal
comments, fixed by finally adding this exclusion), `.build`, `.claude`,
`.wrangler`, `.env`, `.env.example`, `.gitignore`, `node_modules/`,
`package.json`, `package-lock.json`, `README.md`, `CLAUDE.md`, the 2 oversized
`.usdz` files above.

(`README-MIGRATION.md` and `DTS-Developer-Onboarding.docx` used to be listed
here individually; both now live under `docs/`, which is already excluded
wholesale — one fewer thing to remember per deploy.)

## The verification, every time — don't skip, don't assume

1. **Diff the file list** of every included directory, source vs. staged
   (`diff <(cd functions && find . -type f | sort) <(cd $STAGE/functions && find . -type f | sort)`
   — must be IDENTICAL). This is what catches a silent drop.
   `functions/data/[[path]].js` (the double-bracket catch-all) is the
   specific historical failure point — Windows `robocopy`'s pattern engine
   chokes on literal double square brackets in a filename; a plain POSIX
   `cp -r` (e.g. via Git Bash) does not have this problem, but verify it
   explicitly anyway rather than trusting the tool choice alone. Do NOT
   rely on PowerShell `Test-Path` for a bracket-containing filename —
   PowerShell treats `[...]` as a wildcard character class and gives false
   negatives.
2. **Confirm every excluded path is genuinely absent** from the staged
   directory (a simple existence check per path, printed and reviewed, not
   assumed from the copy command's exit code).
3. **Deploy**: `npx wrangler pages deploy <staging-dir> --project-name dts-website --branch main`,
   run from the repo root (not from inside the staging directory).
4. **Post-deploy, confirm no regression**, via the same signature every
   phase has used: Cloudflare Pages' SPA-style fallback returns a real
   `200`, not a `404`, for a genuinely missing path — so status code alone
   proves nothing. Fetch `/` and note its real byte size, then fetch each
   excluded path (`/.env`, `/scripts/seed-dev.mjs`,
   `/docs/migration/PROGRESS.md`, `/tools/gis-harvest.mjs`, etc.) and
   confirm each one returns **exactly** that same byte count — proof it's
   hitting the fallback, not a real file. Separately confirm
   `/data/manifest.json` returns a genuinely different size (proof the
   R2-backed Function route still works).
5. Only report the deploy as verified once 1-4 all actually ran — "the
   command exited 0" is not verification.

## What this does NOT cover

This is the STATIC SITE deploy only. It has nothing to do with R2 content
(`data/current/`, `data/source/`) — that's a separate pipeline
(`scripts/split-content.mjs` → `scripts/upload-content.mjs`), only needed
when `/data` project/GIS content itself has changed. If this session didn't
touch project or GIS documents, the existing `.build/*` output and R2
content are still valid and don't need re-running — just confirm
`.build/js/config.js` exists and is not stale before overlaying it.

## Where the working directory lives

Build the staging directory in the scratchpad
(`C:\Users\<user>\AppData\Local\Temp\claude\...\scratchpad\`), never inside
the repo — it doesn't need to survive the session, and keeping it out of the
repo means it can never accidentally get `git add`ed.
