---
description: Phase 8 — Builds: R2 upload from Admin Board + org/user entitlement-gated downloads
---

Phase 8 of the DTS migration. Prerequisite: Phase 7 done. Re-read golden rules.
**Plan first, execute after approval.** AUTOMATED where possible; Claude
writes/runs scripts. Read `docs/migration/ACCESS-MODEL.md` first — `client_apps`
and the `download.<key>` resource-key form are defined there.

Goal: secure software distribution (replaces the PatchKit question). Builds
live in `dts-builds`; access gated per user AND per organization via
`resource_entitlements`, through the SAME resolution path
`/api/resource/[key].js` already implements for experiences — a download is
just another `resource_key`, not a parallel gating system.

Plan, then do:

1. **`client_apps` registry (Phase 3 table, used here for the first time).**
   Admin Board upload: add UI + an admin-only Function (service role, verifies
   `site_role='site_admin'`) that streams a build file to `dts-builds` and
   writes/updates the matching `client_apps` row (`key`, `name`, `platform`,
   `version`, `r2_object_key`, `enabled`, timestamps). Large files go straight
   to R2 — no size workaround. For dev testing, Claude can script uploading a
   small DUMMY build file for the `dummy-viewer-win` app seeded in Phase 3.

2. **`functions/api/download.js`** (~50 lines): verify the Supabase JWT,
   resolve `download.<key>` through the SAME policy resolution as
   `/api/resource/[key].js` (public/registered/client/restricted, checking
   both direct user entitlements and the caller's org entitlements per
   `ACCESS-MODEL.md` §3-5), THEN check `client_apps.enabled` — a disabled app
   403s even for an otherwise-entitled user. Only after both checks pass,
   return a SHORT-LIVED presigned R2 URL. No entitlement → 403. No session
   and level > public → 401.

3. **Entitlement assignment is a Phase 5b screen, not new here** — the
   restricted-resource picker built in Phase 5b already writes
   `resource_entitlements` rows keyed by `resource_key`; a download's key is
   just `download.<client_apps.key>`, so no new admin UI is needed here
   beyond wiring the picker to also list `client_apps` rows as pickable
   resources. If Phase 5b shipped before this phase (it does, per the phase
   order), confirm that wiring now.

4. **Seed a dummy build entitlement** for a test user and a test org
   (scripted, extending Phase 3's seed) so both entitlement paths
   (`subject_type='user'` and `subject_type='org'`) are testable end to end.

5. **Portal wiring**: the download tile calls `/api/download` and follows the
   signed URL. A `public`-level app (if one ever exists — e.g. a general
   installer with no gating) uses plain R2 URLs through the same code path,
   not a separate one.

6. **Code-signing** (manual/external, deferred): note distributing a real .exe
   needs a code-signing cert (~$10/mo-equiv) so Windows doesn't warn. First
   real recurring cost; belongs on the client's account at/after handoff.

7. Deploy + test: entitled dummy user downloads; entitled-via-org dummy user
   downloads; non-entitled blocked (403); a DISABLED `client_apps` row blocks
   even an entitled user (403); signed URL expires. Update `PROGRESS.md`.
   Stop. Next: `/migrate-phase9`.
