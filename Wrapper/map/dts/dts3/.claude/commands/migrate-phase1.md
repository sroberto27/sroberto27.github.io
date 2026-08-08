---
description: Phase 1 — Cloudflare foundation, deploy the current site as-is (off GitHub Pages)
---

Phase 1 of the DTS migration. Prerequisite: Step 0 verification approved.
Re-read `docs/migration/WORKFLOW.md` golden rules before starting. **Plan first,
then execute after approval.**

Goal of this phase: get the CURRENT, unmodified site live on Cloudflare Pages via
Direct Upload, with R2 buckets and security headers in place. This alone
completes "off GitHub Pages" — nothing about auth changes yet, so the site keeps
working exactly as it does today.

Steps to plan, then do:

1. **Local git safety net** (not GitHub): `git init` locally if not already, and
   commit the current state as "pre-migration baseline". This is local-only
   rollback insurance; it never gets pushed anywhere.

2. **Wrangler setup.** Check for `wrangler` (`npx wrangler --version`). Create a
   minimal `wrangler.toml` for a Pages project using Direct Upload (no git
   connection). Do not hardcode account IDs into committed files where avoidable;
   prefer `wrangler` login/env.

3. **R2 buckets.** Create `dts-content` and `dts-builds` (document the commands;
   the user runs the ones that need their authenticated CLI). Note: nothing is
   uploaded to them yet — that's Phase 6/8.

4. **`_headers` file** at site root: HSTS, X-Content-Type-Options: nosniff,
   Referrer-Policy, and a CSP. For now the CSP must allow everything the CURRENT
   site already uses (cdnjs for JSZip, the Treedis origin `spaces.dtsxr.com` in
   frame-src, Web3Forms, Vimeo, GA/Clarity). We'll tighten `connect-src` for
   Supabase in Phase 4. Verify the site still fully works with the header in place
   — a too-strict CSP breaks the Treedis iframe or JSZip export.

5. **Deploy as-is.** `wrangler pages deploy .` to a `*.pages.dev` URL. Confirm the
   live site loads, the Treedis tour runs, a lead form send works (or mailto
   fallback), and the demo sign-in (`demo`/`1234`) still works against the
   existing sheet — because we have NOT touched auth yet.

6. **Test** against the README checklist items relevant here: home ↔ sector
   switching, one example window, twin reveal (tour must not reload), lead send,
   demo sign-in, mobile drawer.

7. **Update** `docs/migration/PROGRESS.md`: Phase 1 done, what URL it's on, what
   was tested.

Do NOT proceed to Phase 2 automatically. Stop, show the deployed URL and test
results, and wait. Next command: `/migrate-phase2`.
