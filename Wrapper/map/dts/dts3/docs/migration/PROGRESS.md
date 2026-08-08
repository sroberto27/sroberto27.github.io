# DTS Migration — Progress Log

Claude updates this after every phase so any new session can resume cold. The
identity/access model each phase from 3 onward implements is defined in
`docs/migration/ACCESS-MODEL.md` — read it alongside this log when resuming.

| Phase | Status | Deployed URL / notes | Tested |
|-------|--------|----------------------|--------|
| 0 — Verify | done | `.gitignore` + `.env.example` scaffolded, approved | — |
| 1 — Cloudflare foundation | done | **https://dts-website-4cu.pages.dev** (stable — always latest; per-deploy hash URLs like `987a897b...` change every redeploy, don't bookmark those) | deterministic checks pass; user confirmed tour, lead forms, demo sign-in, mobile |
| 2 — Scrub secrets | done, except item 6 (GitHub repo privacy — deferred to domain cutover) | https://dts-website-4cu.pages.dev | secrets confirmed gone from live deploy; demo sign-in now localhost-only by design |
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

- 2026-08-07 — Ran `/migrate-phase2`. Traced every real consumer before
  editing (not just following the phase file's literal text):
  `content-loader.js` never maps `access.json` into `DTS_CONFIG` at all; the
  only reader is `admin.js:68-74`, and both call sites already guard against
  `undefined` (`registerAdmins(list)` does `(list || [])`;
  `accessDoc.directorySource && ...`) — confirmed zero crash risk before
  deleting anything.
  Deleted `directorySource`, `roles`, and `adminUsers` (incl.
  `CHANGE_ME_BEFORE_DEPLOY`) from `data/access/access.json`, keeping `ui` and
  `portal`. Deleted `sheetCsvUrl` from `js/clients.js` and gated
  `demoDirectory` behind `location.hostname === 'localhost'` — **demo/1234
  sign-in now only works locally, not on the live Cloudflare URL**, by
  design (Phase 4 rebuilds real auth).
  **Found a third leaked copy of the Web3Forms key the phase file didn't
  mention:** `js/config.js:154` (the `/data`-unreachable fallback — same
  blind spot as the CSP gap in Phase 1, since it's never a `<script>` tag).
  Traced `app.js:2107` (`if (!lead.accessKey) return false` → mailto
  fallback) to confirm blanking it is safe, then blanked it. Left
  `data/site/lead.json`'s copy untouched per the phase's own instruction —
  that one is flagged for rotation, actually replaced in Phase 7, not
  removed now (removing it without a replacement would break lead delivery
  in the meantime).
  Verified on the LIVE deployed site, not just locally: `curl`'d
  `data/access/access.json`, `js/clients.js`, `js/config.js` from
  `https://e6dc6df8.dts-website-4cu.pages.dev` and confirmed zero matches
  for the sheet URL or the Web3Forms key.
  **Deferred item 6 (make the old GitHub repo private/delete it) — not
  done.** That repo is still the actual live host via GitHub Pages right
  now (Cloudflare is a parallel deployment, not yet the sole live site);
  making it private would very likely break GitHub Pages serving
  immediately, and deleting it is irreversible. Revisit at domain cutover
  (near Phase 6/handoff), not now. User agreed to this deferral.
  Redeployed: https://dts-website-4cu.pages.dev (stable alias; the specific
  deploy was `e6dc6df8...`). Phase 2 status: DONE except item 6. Next:
  `/migrate-phase3`.

- 2026-08-07 — **User confirmed the model renders correctly** at
  https://71a041ec.dts-website-4cu.pages.dev — Phase 1 fully DONE, no open
  items remain. Next: `/migrate-phase2`.

- 2026-08-07 — Real CSP gap found and fixed: the compressed `ToolBox.glb`
  wasn't rendering on the homepage despite the file itself serving correctly
  (confirmed by exact byte-size download in the prior session entry) — traced
  the actual code path (`js/hex-media.js:59-60`) rather than guessing, and
  found the `model` media type lazy-loads Google's `<model-viewer>` web
  component from `ajax.googleapis.com` (fallback `cdn.jsdelivr.net`), neither
  of which was in the original CSP's `script-src` — a real origin my initial
  research missed (it isn't a static `<script src>` tag in `index.html`, it's
  loaded dynamically by `hex-media.js`, so grepping `index.html` alone
  wouldn't surface it). The CSP silently blocked the component from loading,
  so the code correctly fell back to "poster only"
  (`hex-media.js:239`'s console warning) — not a broken asset, a blocked
  script.
  Added `ajax.googleapis.com` + `cdn.jsdelivr.net` to `script-src` AND
  `connect-src` (defensive — `<model-viewer>`/three.js commonly fetch a
  Draco/KTX2 WASM decoder as a separate request after the initial script
  load), plus `blob:` to `img-src` and a `worker-src 'self' blob:` (3D
  viewer libraries commonly decode via Web Worker + blob URLs). Redeployed;
  confirmed via the new deployment's own hash URL
  (`71a041ec.dts-website-4cu.pages.dev`) that the updated CSP is live and
  correct. The STABLE alias URL (`dts-website-4cu.pages.dev`) took a short
  time to propagate the new deployment — confirmed normal, not a second bug;
  if it's ever still showing a stale CSP after a few minutes, that would be
  worth investigating, but a brief propagation window right after deploy is
  expected. **Still needs the user's visual confirmation that the model
  actually renders now** — this fix addresses why it was blocked, not a
  guarantee it looks correct once loaded.

- 2026-08-07 — Phase 1 complete. User confirmed all interactive checks pass
  on the deployed URL: Treedis tour, lead form send, demo sign-in, mobile.
  Compressed `assets/ToolBox.glb` per the user's decision. Diagnosed with
  `@gltf-transform/cli inspect` first rather than guessing: the 38.15 MB size
  was almost entirely two uncompressed 4096×4096 PNG textures (baseColor
  22.67 MB + normal 15.45 MB); the mesh geometry itself was only 29.62 KB.
  `gltf-transform optimize`'s texture-compression step failed on this machine
  (a `sharp`/`libvips` colourspace bug — "value 32 invalid for
  VipsInterpretation" — reproduced on WebP, AVIF/auto, and even plain resize,
  so it's an environment issue, not a WebP-specific one). Worked around it
  with a pure-JS path with no native dependency: unpacked the GLB to loose
  files (`gltf-transform copy`), resized both PNGs 4096→2048 with `jimp`
  (no libvips involved), then repacked (`gltf-transform copy` again).
  Result: 38.15 MB → 11.46 MB (70% reduction), comfortably under Cloudflare's
  25 MB limit. `gltf-transform validate` reports zero errors; mesh structure
  (756 vertices, same attributes) is byte-identical to the original — only
  the two textures changed. The true original is preserved, untouched, at
  `.../scratchpad/glb-work/ToolBox.original.glb` in this session's temp dir
  (not in the repo) in case full-resolution masters are ever needed again —
  worth copying somewhere durable if that matters, since scratchpad temp
  dirs aren't guaranteed to persist.
  Redeployed with the compressed model included (no more exclusions needed):
  https://987a897b.dts-website-4cu.pages.dev. Confirmed by download, not
  just status code, that `assets/ToolBox.glb` now serves the real
  11,456,292-byte file with the correct `model/gltf-binary` content type.
  **Not yet verified: visual quality of the resized textures** — I can
  confirm the file is structurally valid and geometry is unchanged, but
  actual rendered appearance (does the compressed texture still look good at
  the hex-4 slot's display size) needs the user's eyes, not a CLI check.
  The two orphaned Backrooms usdz files stay permanently excluded (zero
  references, confirmed earlier). Phase 1 status: DONE.

- 2026-08-07 — Finished the deploy half of `/migrate-phase1`.
  `wrangler login` confirmed (`robertoenrique2710@hotmail.com`, account
  `290ae8584c9b91cac7f995c4e28e18c5`). Created R2 buckets `dts-content` and
  `dts-builds` (empty — content upload is Phase 6/8) and the Pages project
  `dts-website`. **Deployed from a staging copy, not the source tree
  directly** — necessary because a straight deploy would have published the
  migration-kit's internal docs (`.claude/`, `docs/migration/`,
  `README-MIGRATION.md`, `.env.example`) to a public URL, which never existed
  on the live GitHub Pages site and isn't meant to be public (the access
  model's own design doc, RLS layout, etc.). Also caught a genuine near-miss:
  the local `.wrangler/cache/wrangler-account.json` (created by the CLI
  commands run this session) contains the real Cloudflare account ID in
  plaintext — excluded it from the staging copy; it was already correctly
  excluded from git by `.gitignore`.
  **Real deploy blocker found and resolved:** Cloudflare Pages caps files at
  25 MiB. Three files exceeded it — `assets/ToolBox.glb` (37 MB, genuinely
  used: the homepage hex-4 slot model, `data/pages/home.json`) and two
  unreferenced files, `models/DTScube_Backrooms_Animated.usdz` and
  `..._v2.usdz` (27 MB each, confirmed zero references anywhere in `/data`,
  `/js`, or `index.html`). The two unused ones are permanently dropped from
  the deploy with no functional impact. `ToolBox.glb` is set aside (not
  deleted — held at
  `.../scratchpad/ToolBox.glb.excluded-from-deploy` in this session's temp
  dir) and is **excluded from THIS deployment only** — the homepage hex-4
  slot will show missing/broken on the Cloudflare URL until this is resolved
  (compress it, move it to R2 with a content-pipeline change, or something
  else — needs a decision, not a unilateral fix, since re-encoding a real
  asset or restructuring how it's served are content/architecture choices).
  **Live GitHub Pages is completely unaffected** — this only touched the new
  Cloudflare deployment.
  **Unrelated pre-existing bug found incidentally:**
  `data/site/settings.json` references
  `models/DTS_Studio_Interior_VisionPro_V2.1.usdz` (with a `.1`) but the real
  file on disk is `DTS_Studio_Interior_VisionPro_V2.usdz` (no `.1`) — the
  Vision Pro spatial backdrop already 404s on the CURRENT live GitHub Pages
  site too. Predates this migration; out of Phase 1's "deploy as-is" scope,
  not fixed. Flagged because the README's own testing checklist calls out
  "Safari check for the Vision Pro CTA."
  **Deployed:** https://efc0ce12.dts-website-4cu.pages.dev — deterministic
  checks pass: real content served correctly for `/data/manifest.json`,
  `/js/app.js`, `/css/01-base.css`; security headers present and match
  `_headers`; migration-kit paths confirmed NOT really served (Cloudflare
  Pages returns its default 200-with-`index.html`-fallback for unmatched
  paths rather than a real 404 — verified by content-length/body, not status
  code alone, since the fallback masks true 404s as 200). Interactive checks
  (Treedis tour reveal, lead form send, demo sign-in, mobile drawer) are
  NOT yet done — handed to the user per the project's manual-testing
  convention rather than driving a browser session unprompted.

- 2026-08-07 — Started `/migrate-phase1`. Verified local `HEAD` matched
  `origin/main` exactly (`a19a4072`) before touching anything, so nothing had
  silently diverged from what GitHub Pages serves. The 47 files `git status`
  showed as modified turned out to be pure line-ending noise
  (`core.autocrlf=true` vs. on-disk CRLF) — `git diff --numstat` confirmed
  ZERO real content differences before staging anything. Committed locally as
  `799ab78d` "Pre-migration baseline": the 21 real new migration-kit files
  (`.claude/commands/`, `docs/migration/`, `README-MIGRATION.md`,
  `.env.example`, `.gitignore`) plus the line-ending renormalization, which
  turned out to add zero extra file changes once staged (git recognized them
  as unchanged). Working tree is now clean; `origin/main` still points at the
  old commit, confirming the baseline never left this machine. Grounded the
  real external origins the site uses today (not the phase file's generic
  "GA/Clarity" assumption, which doesn't exist in this site yet): Treedis
  (`spaces.dtsxr.com`), Vimeo (`player.vimeo.com`), Web3Forms
  (`api.web3forms.com`), Google Fonts, cdnjs (JSZip, admin-only), and — for
  the live GIS map, which is unauthenticated and reachable today since
  nothing is gated yet — `maps.iberiagov.net`,
  `cimsgeo.coastal.louisiana.gov`, `cimsgeo3.coastal.louisiana.gov`,
  `tile.openstreetmap.org`, `tiles.maps.eox.at`, and
  `nominatim.openstreetmap.org`. Excluded `mpdap.coastal.la.gov`/
  `mpdv.coastal.la.gov` from the CSP — those only appear in
  `data/gis/sources.json` as research notes on candidate servers, never
  wired into the live map. Confirmed a real inline `<script>`
  (`index.html:39`) and inline `<style>` (`index.html:34`), so the CSP needs
  `'unsafe-inline'` on script-src/style-src to match current behavior.
  `npx wrangler` confirmed working (auto-resolves 4.120.0, no separate
  install needed). Not yet done: `wrangler.toml`, `_headers`, R2 buckets, or
  the actual deploy — those need `npx wrangler login` first, which only the
  user can approve (browser OAuth).

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
- **RESOLVED — `assets/ToolBox.glb` compressed and redeployed** (38.15 MB →
  11.46 MB; see session log for the exact method). **Still needs the user to
  visually confirm the compressed textures look acceptable at the hex-4
  slot's display size** — structural validity and unchanged geometry are
  confirmed, actual rendered quality is not (needs eyes, not a CLI check).
  True original preserved at
  `.../scratchpad/glb-work/ToolBox.original.glb` (session temp dir, not
  durable — worth relocating if it might be needed again).
- **Pre-existing, unrelated bug found incidentally:**
  `data/site/settings.json`'s Vision Pro `spatialBackdrop` references
  `models/DTS_Studio_Interior_VisionPro_V2.1.usdz` (with a `.1`) but the real
  file on disk is `DTS_Studio_Interior_VisionPro_V2.usdz` (no `.1`) — already
  404s on the CURRENT live GitHub Pages site, predates this migration. Not
  fixed (out of Phase 1's "deploy as-is" scope) — flag for whenever it makes
  sense to fix, migration-related or not.
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
