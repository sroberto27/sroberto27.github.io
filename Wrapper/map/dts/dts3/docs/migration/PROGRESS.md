# DTS Migration — Progress Log

Claude updates this after every phase so any new session can resume cold. The
identity/access model each phase from 3 onward implements is defined in
`docs/migration/ACCESS-MODEL.md` — read it alongside this log when resuming.

| Phase | Status | Deployed URL / notes | Tested |
|-------|--------|----------------------|--------|
| 0 — Verify | in progress | `.gitignore` + `.env.example` scaffolded | — |
| 1 — Cloudflare foundation | not started | — | — |
| 2 — Scrub secrets | not started | — | — |
| 3 — Supabase (dev): org/access schema + RLS + dummy seed | not started | — | — |
| 4 — Client auth swap + resource gating | not started | — | — |
| 5 — Admin auth swap (site_role) | not started | — | — |
| 5b — CMS access editors + org management | not started | — | — |
| 6 — Content pipeline (public/protected split) | not started | — | — |
| 7 — Lead form | not started | — | — |
| 8 — Builds (org/user entitlement-gated) | not started | — | — |
| 9 — Analytics & audit | not started | — | — |
| Handoff — go live (real orgs + members) | not started | — | — |

## Session log
(Newest first. One short entry per working session: what changed, what was tested, what's blocked.)

- 2026-08-07 — Ran `/migrate-start` (Step 0 verification). Portability
  confirmed: only the Google Sheet CSV URL (`js/clients.js:29`,
  `data/access/access.json:31`), the Web3Forms key (`data/site/lead.json:5`),
  and the `CHANGE_ME_BEFORE_DEPLOY` admin placeholder (`access.json:62`) are
  account-specific values outside the designated config spots — all three are
  already scheduled for removal in Phase 2, so nothing blocks the clean
  handoff. `data/site/settings.json`'s Treedis tour URL/origin is also
  account-specific but is a third-party showcase URL DTS already owns, not a
  Cloudflare/Supabase credential — out of scope for the account-portability
  rule. Dev-phase cost confirmed $0 + optional domain, no changes to the
  numbers in `00-VERIFY-FIRST.md`. Two things found and handled: no
  `.gitignore` existed at all (created one — excludes `.env`/`.env.*`, allows
  `.env.example`, plus `node_modules/`/`.wrangler/`/`.supabase/` for the
  tooling upcoming phases introduce); and this repo is NOT a fresh local-only
  git repo as `WORKFLOW.md`'s safety model assumes — `origin` is already set
  to the real GitHub Pages remote (`sroberto27.github.io.git`) on `main`,
  which is what currently serves the live site. Local commits are safe;
  `git push` during migration would go live immediately and should be
  avoided until Phase 1's Cloudflare deploy is the live site instead.
  **Decision confirmed by the user: no `git push` to `origin` for the
  remainder of the migration** — commit locally only, phase by phase, until
  Phase 1 makes the Cloudflare deploy the live site and GitHub Pages is
  retired. Any future session should honor this until it's explicitly
  revisited. Scaffolded `.env.example` with all 8 placeholder vars. No site code, `/data`,
  or Phase 1 work done — Step 0 output presented for approval.

- 2026-08-07 — Reconciled the migration kit with the current site (GIS engine,
  multi-experience projects) and redesigned the identity/access model per
  `docs/migration/ACCESS-MODEL.md`: organizations, memberships, org roles,
  four-level resource gating (public/registered/client/restricted), split
  public/protected content publishing, org/user download entitlements, and a
  separate `events`/`admin_audit` split. Rewrote Phases 2-9 and Handoff; added
  new Phase 5b. No code, schema, or `/data` changes made — this session only
  updated the migration-kit instructions. Nothing has been executed.

## Open questions / blockers
- **GIS maps are a whole-document gate, not a field-level one.** Confirmed by
  reading `js/gis/gis-viewer.js:311-317` — `DTSGis.mount()` takes the entire
  `gisMap` document, sourced today from `cfg.gisMaps[mapId]` in the
  unconditionally-fetched `DTS_CONFIG`. Phase 4/6 must withhold the whole
  `gisMap`/`gisTour`/`gisFeatureTour` document set from `data/current/` for a
  gated map (not strip a field within it) and resolve it via
  `/api/resource/gismap.<mapId>` — see `ACCESS-MODEL.md` §5. Verify with
  `USER-ACCESS-MIGRATION-TESTING.md` test 5b.
- **Second half of the same gap: `iberia-coastal`'s 5 local shoreline/
  boundary `.geojson` layer files** (`data/gis/layers/*.geojson`) are fetched
  directly by `js/gis/gis-viewer.js:170`, independent of the map document and
  of `DTS_CONFIG` entirely — gating the map document alone does not stop a
  guest who knows the file path. Phase 4 adds
  `/api/resource/gismap/[mapId]/layer/[layerId].js` and Phase 6 routes these
  6 files to `data/source/`, never `data/current/`, with the map resolver
  rewriting `layers[].url` to the authenticated route (zero changes to
  `gis-viewer.js` itself). Verify with
  `USER-ACCESS-MIGRATION-TESTING.md` test 5c.
- **`js/config.js` is a third leak surface and the easiest to miss.** It is
  the `/data`-unreachable fallback, injected dynamically rather than via a
  `<script>` tag (`content-loader.js:367-375`), so it never appears in a
  normal page-load network trace — but it is a deployed static file holding
  16 `spaces.dtsxr.com` tour URLs and 46 Vimeo references for all 16
  projects. `curl https://<site>/js/config.js` returns every gated target
  unless it is stripped alongside `data/current/`. Phase 4 strips it (or
  verifies the strip), Phase 6 folds it into `split-content.mjs`. Must be
  RE-verified whenever `config.js` is regenerated, since `CLAUDE.md` directs
  keeping it in sync with `/data` and that sync is what would re-add the
  URLs. Verify with `USER-ACCESS-MIGRATION-TESTING.md` test 5d.
- Whether an `org_admin`'s invite should be restricted to specific email
  domains — currently unrestricted (DTS issues client addresses on its own
  domain), rate-limited + audited server-side. Revisit at Phase 5b if abuse
  becomes a concern.
- `data/projects/emergency.json` exists on disk but is absent from
  `data/manifest.json` — Phase 3's backfill script must ask before deciding
  whether to register or leave it out.
- Confirm Supabase free-tier auth email volume covers org-admin invites at
  real client scale before handoff (see `00-VERIFY-FIRST.md`).

## Account inventory (fill in as you go — NEVER put secret values here)
- Dev Cloudflare account: ____
- Dev Supabase project URL: ____  (anon key lives in js/supabase-init.js)
- Domain (dev *.pages.dev or real): ____
- Client Cloudflare account (handoff): ____
- Client Supabase project (handoff): ____
