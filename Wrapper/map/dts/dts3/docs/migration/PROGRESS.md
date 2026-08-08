# DTS Migration — Progress Log

Claude updates this after every phase so any new session can resume cold. The
identity/access model each phase from 3 onward implements is defined in
`docs/migration/ACCESS-MODEL.md` — read it alongside this log when resuming.

| Phase | Status | Deployed URL / notes | Tested |
|-------|--------|----------------------|--------|
| 0 — Verify | done | `.gitignore` + `.env.example` scaffolded, approved | — |
| 1 — Cloudflare foundation | done | **https://dts-website-4cu.pages.dev** (stable — always latest; per-deploy hash URLs like `987a897b...` change every redeploy, don't bookmark those) | deterministic checks pass; user confirmed tour, lead forms, demo sign-in, mobile |
| 2 — Scrub secrets | done, except item 6 (GitHub repo privacy — deferred to domain cutover) | https://dts-website-4cu.pages.dev | secrets confirmed gone from live deploy; demo sign-in now localhost-only by design |
| 3 — Supabase (dev): org/access schema + RLS + dummy seed | **done** | project `DTSdev` (`wsqvzyfvxjenqvqjpqjv`, region `us-west-2`) | schema/RLS/functions/seed verified by direct query; access backfill applied + validated; adversarial RLS check (SELECT + write-path) all pass |
| 4 — Client auth swap + resource gating | done, API-level verified; interactive UI checks pending user | https://dts-website-4cu.pages.dev | all curl/API checks pass on the live deploy; sign-in flow, destination preservation, reload persistence, tour-no-reload, mobile, lead form NOT yet verified — see below |
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

- 2026-08-08 — Ran `/migrate-phase4` end to end (the security-critical
  phase). Built and tested infrastructure BEFORE touching app.js, then
  built app.js on top of an already-validated backend.

  **Infrastructure:** confirmed empirically (not assumed) that R2 bindings
  work with the existing Direct Upload deploy once `wrangler.toml` has
  `pages_build_output_dir` set. Seeded `dts-content`'s `data/source/`
  prefix with unstripped project/GIS data (`scripts/upload-source-to-r2.mjs`,
  new). Wrote `scripts/strip-public-data.mjs` (new) for the public-facing
  strip Phase 6 will later formalize.

  **Real bugs found and fixed before they ever shipped, each verified
  independently after fixing, not just assumed correct:**
  1. `strip-public-data.mjs` initially missed 8/15 gated projects — video
     experiences use nested `embed`/`watch` source objects in raw /data,
     not the flat `embedUrl`/`watchUrl` the *converted* DTS_CONFIG shape
     uses. Confirmed by reading a real raw document (`civic.json`), not
     assumed from the converted shape.
  2. The `config.js` strip's first version used regex string-matching and
     shipped a real bug: it "protected" a DIFFERENT project's tourUrl
     because it happened to share the homepage's tour ID string. Rewrote
     to operate on the parsed object graph via `vm` — fields identified by
     structural position, never by string content.
  3. `gfc.json`'s GIS map had no `access` field of its own (only the
     project-side experience pointer got one from Phase 3's backfill) —
     added `"access": "registered"` to `data/gis/maps/iberia-coastal.json`
     directly, re-uploaded to R2.
  4. The resolver's GIS payload originally spread computed `tours`/
     `featureTours` (full objects) directly over `mapDoc`, silently
     overwriting `mapDoc.tours` — which the RAW document already carries
     as an array of ID STRINGS that `js/app.js`'s `toursForMap()` looks up
     against a global `cfg.gisTours` map. Caught by tracing the actual
     client consumer before shipping, not by assuming the naming implied
     the right shape. Fixed: `{mapDoc, tours, featureTours}` as separate
     keys; the client populates `cfg.gisTours`/`cfg.gisFeatureTours` itself,
     the same keying `buildConfig()` already uses for public maps.
  5. **A real "three places" gap, not yet caught by anything:**
     `content-loader.js`'s `convertExperience()` and the project/links
     mapping in `buildConfig()` never mapped the `access` field through to
     `DTS_CONFIG` at all — Phase 3's backfill added it to `/data`, but step
     2 of the rule (map it in `buildConfig()`) was never done. Didn't
     manifest as a live bug only because every real resource today happens
     to resolve to `registered` either way — but `computeAccessibleResources()`
     (the portal's "All Apps" list) genuinely needs `node.access`/`ex.access`
     client-side to work correctly once ANY resource is ever `client` or
     `restricted`. Fixed: `access` now flows through
     `convertExperience()`, the project-level `ex`, and links (which also
     needed a stable `id` — `link-<1-based-index>`, matching the resolver's
     convention — since they never had one).
  6. The deploy staging build accidentally swept in `node_modules` (from
     installing `@supabase/supabase-js` for the migration tooling
     scripts) — caught by checking the staging directory's actual contents
     before deploying, not assumed clean. Excluded `node_modules/`,
     `package.json`, `scripts/`, and `supabase/` from the public deploy —
     none are needed there, and the latter two reveal internal
     implementation details (exact RLS policies, resource_key formats,
     R2 path structure) with no benefit to shipping them.

  **app.js**: deleted `loadDirectory`/`parseCSV`/`normalizeRow`/old
  `authenticate` (~120 lines); new `authenticate` via
  `supabase.auth.signInWithPassword`; session restore on boot (fire-and-
  forget, never blocks initial paint); `dts:signed-in` event dispatch;
  real forgot-password flow; `resolveExperienceNode`/`resolveGisMapById`/
  `fetchResource` as the gating layer, integrated into `showExperience()`
  (now async, with a race guard matching the pattern `mountGis()` already
  used for its own async mount); `buildExampleLinks()` rewritten so a
  gated link renders as a resolve-then-open button instead of a raw
  `<a href>` a guest could just read out of the page source; portal
  redesigned around `computeAccessibleResources()` (scans `cfg.examples`,
  cross-references the user's own entitlements, readable client-side
  under RLS as "your own") since the old `session.twins[]` model doesn't
  exist anymore. `mountTreedis`/`mountVideo`/`mountGis` themselves:
  ZERO changes, exactly as planned — the gating layer sits at the mount
  boundary, not inside them.

  `index.html`: supabase-js CDN + `js/supabase-init.js` (the only
  account-specific values in a committed file, by design) before
  `content-loader.js`; `js/clients.js` deleted entirely (fully dead code
  after Phase 2); "Login In" → "Log In"; Remember-me checkbox removed
  (the underlying logic is gone). `_headers`: Supabase URL added to
  `connect-src` (https + wss).

  **Verified on the live deployed site (API-level, via curl with real
  Supabase tokens for testuser/testorgadmin/testmember) — not just
  locally:** registered resource resolves with real target for a signed-in
  user, 401 for a guest; the `automotive` link-1 leak is closed end to
  end (real BMW X1 tour URL only returned to an authenticated request);
  the two-step GIS resolve works (`project.gfc:map` → `{mapId, tourId}`
  → `gismap.iberia-coastal` → full doc with 14 tours + 13 feature tours);
  the GIS layer proxy streams real geojson to an authenticated user, 401
  to a guest; `js/config.js` on the live deploy has exactly 1 `tourUrl`
  (the homepage) and 0 `embedUrl`/`watchUrl`; the GIS map document and a
  local layer file are both confirmed absent from the public deploy
  (checked actual response body/size against `index.html`'s real byte
  count, not status code alone — Cloudflare's SPA-style fallback returns
  200 for genuinely-missing paths).

  **NOT yet verified — needs the user, per the project's manual-testing
  convention:** the sign-in FORM flow (does clicking a gated tile actually
  open the login form, not just the API returning 401), destination
  preservation after login, session persisting across a reload, sign-out,
  forgot-password actually sending, the GIS map rendering correctly in
  the browser (tours/feature tours/layers visually working, not just the
  API returning correct data), the full README regression checklist
  (tour must not reload, lead form, mobile drawer).

- 2026-08-08 — Ran `/migrate-phase3` step 8 (adversarial RLS check) —
  **Phase 3 is now fully DONE.** Wrote a scripted check that signs in as
  each dummy user with the ANON key (not service role, which bypasses RLS
  entirely and would prove nothing) and queries what their own session can
  actually see.
  **Two false failures in the first run, both my own test-assertion bugs,
  not real RLS problems — investigated each before accepting or dismissing
  either:**
  1. `testmember` "failed" a check expecting exactly 1 visible
     `organization_members` row. The real count was 2. Investigated by
     adding `user_id` to the query: the second row belonged to
     `testorgadmin`, who is *also* a plain member of `beta-municipal`. This
     is correct behavior under the "org members see their org's roster"
     policy, not a leak — confirmed neither row was ever `acme-hotels`. Fixed
     the assertion to check "every visible row is beta-municipal" instead of
     an exact count that was wrong to begin with.
  2. `testorgadmin` then "failed" two checks that had been passing — caused
     by my own fix in (1) changing the row-string format (adding the
     `user_id` suffix) without updating these two assertions' exact-match
     comparisons. Fixed to use `.startsWith()`.
  **After both fixes, every check passes** — `testadmin` (site_admin) sees
  everything; `testuser` sees only their own direct entitlement and nothing
  org-related; `testorgadmin` sees the full rosters/entitlements of both
  orgs they belong to (Acme + Beta) and correctly does NOT see `testuser`'s
  entitlement; `testmember` sees only Beta's data, never Acme's.
  **Also added a write-path adversarial check** beyond what the phase file
  literally asked for (SELECT-visibility only), since the infrastructure was
  already built and this validates the exact mechanism Phase 5b's team
  panel depends on: confirmed `testorgadmin` (org_admin at Acme, plain
  member at Beta) CAN update their own membership row at Acme, and CANNOT
  modify `testmember`'s row at Beta (RLS silently filters the UPDATE to
  zero affected rows) — org_admin write scope is genuinely per-org, not
  global, confirmed both directions, not just asserted from reading the
  policy SQL.
  Removed the temporary check script from the project directory afterward
  (throwaway verification, was never meant to be committed).
  Phase 3 complete. Next: `/migrate-phase4` — the security-critical client
  auth swap + resource gating enforcement.

- 2026-08-08 — Ran `/migrate-phase3` step 7. Wrote
  `scripts/backfill-access.mjs` (defaults to dry-run/print-only; only writes
  with `--apply`). **Caught a real bug in the script itself before showing
  the plan for approval:** the first dry-run flagged all 15 real project
  files as "NOT IN data/manifest.json", which was wrong — the manifest
  stores project paths relative to `data/` (`"projects/campus.json"`, no
  `data/` prefix), but the script compared against the prefixed form. Fixed
  the comparison and re-ran before showing anything to the user, rather than
  presenting a plan with a false flag on every single file.
  **`emergency.json` decision — user chose to register it.** Read its actual
  content for the first time this session (previously only knew it existed
  and had no experience/media): a real, complete `government`-sector project
  document (GOHSEP/FEMA PA documentation) that was simply never wired in. It
  had no sector card either, which would have left it registered-but-
  unreachable, so both were added: a card entry in `data/sectors/
  government.json` and the manifest entry. Noted but NOT touched:
  `government` sector's own `active` field is currently `false` (predates
  this session, unrelated to the emergency.json question, out of scope for
  this task — flagging only).
  Applied the backfill (`--apply`) after review: `access: "public"` on the
  homepage tour context (`data/site/settings.json` — documentation only,
  nothing currently gates it), `access: "registered"` on all 14 legacy
  `media` projects, both of `gfc.json`'s experiences (`tour` + `map`), and
  the 4 leak links (3 in `automotive.json`, 1 in `campus.json`) — the vimeo
  links in both files were correctly left untouched (spot-checked directly).
  `heritage.json` correctly received no changes (nothing to gate) and
  `emergency.json` correctly received none either (also nothing to gate,
  registration alone was enough). Validated all 20 touched/read JSON files
  parse correctly after writing, not just trusted the script's own "Done."
  **Remaining in Phase 3:** step 8 (adversarial RLS check), step 9 (this
  table row, once 8 is done).

- 2026-08-08 — Ran `/migrate-phase3` steps 1-6. Supabase dev project
  `DTSdev` (ref `wsqvzyfvxjenqvqjpqjv`, region `us-west-2`) created by the
  user; `.env` filled with all 6 Supabase vars (never printed to chat — user
  edited the file directly after being told not to paste secrets in-chat).
  **Two real infrastructure bugs found and fixed, not routed around blindly:**
  1. `supabase link` failed on a secondary "fetch API keys" step (a CLI
     schema-validation error on a date field) — but the CORE link state
     (project ref, org, Postgres version) was confirmed written correctly
     regardless, so migrations proceeded via `supabase db push --db-url`
     instead of depending on a full clean `link`.
  2. `db.<ref>.supabase.co` (the "direct connection" host) only has an IPv6
     DNS record, no IPv4 — confirmed via `nslookup`, not assumed. The
     `aws-0-<region>.pooler.supabase.com` guess also failed ("tenant not
     found") because the actual pooler cluster assignment was
     `aws-1-us-west-2`, not `aws-0` — got the authoritative value from
     Supabase's own Management API
     (`GET /v1/projects/{ref}/config/database/pooler`) rather than guessing
     further. **The working connection for this project:**
     `postgresql://postgres.<ref>:<password>@aws-1-us-west-2.pooler.supabase.com:6543/postgres`
     (transaction-mode session pooler, port 6543) — worth remembering for
     any future phase that needs a direct DB connection to this project.
  Wrote and applied 3 migrations (`supabase/migrations/`): core schema (7
  tables per `ACCESS-MODEL.md` §2), RLS helper functions + deny-by-default
  policies on every table, and a follow-up fix (see below). Verified by
  direct SQL query (not just trusting `db push`'s success message): all 7
  tables have `rowsecurity=true`; policy counts per table match exactly
  what was written (profiles=2, organizations=4, organization_members=4,
  resource_entitlements=4, client_apps=4, events=2, admin_audit=1); all 5
  functions exist. (A 6th function, `rls_auto_enable`, also showed up —
  that's Supabase's own automatic-RLS safety net from the "Enable automatic
  RLS" project-creation checkbox, not something this migration wrote;
  expected, not a bug.)
  **Found and fixed a real bug in the migration's own `protect_site_role`
  trigger**, confirmed empirically (queried `auth.uid()`/`auth.role()` on a
  raw backend connection and got `null`/`null`) before touching anything: as
  originally written, the trigger would have blocked even a legitimate
  service-role/backend connection from ever setting the FIRST `site_admin`,
  since `is_site_admin()` depends on `auth.uid()`, which is null outside a
  PostgREST-mediated request. Fixed with an additive migration
  (`20260807220200_fix_protect_site_role_bootstrap.sql`) allowing the change
  when `auth.uid() is null` — safe because RLS already reduces any
  unauthenticated PostgREST request on `profiles` to zero affected rows
  before the trigger would ever see them, so this only opens the path that
  backend/service connections already had on every other table anyway.
  Wrote and ran `scripts/seed-dev.mjs`: 2 orgs (`acme-hotels`,
  `beta-municipal`), 4 dummy users covering every role combination
  including the multi-org case (`testorgadmin@example.com` = `org_admin`
  at Acme + `member` at Beta simultaneously), 2 entitlements exercising
  both `subject_type` paths (org-level: `project.gfc:map` -> acme-hotels;
  user-level: `download.dummy-viewer-win` -> testuser), 1 `client_apps`
  row. Verified by direct query, not just the script's own output. Dev
  passwords were shown once in this session for testing purposes, never
  written to any file.
  Wrote (did NOT run) `scripts/import-clients.mjs` — defaults to
  `--dry-run`, groups rows into organizations, flags near-duplicate client
  names as a probable duplicate-org bug per `migrate-handoff.md`'s
  safeguard, and explicitly refuses to guess two things that need a human
  decision at handoff: who is `org_admin` per org (needs `--org-admins`
  input, never inferred from the sheet) and the legacy-`twin_url`-to-real-
  `resource_key` mapping (needs `--resource-map` input).
  Added `package.json` + `scripts/` — Node tooling for migration scripts
  only, separate from the site's own vanilla-JS runtime (no framework
  introduced to the browser-facing code).
  **Remaining in Phase 3:** step 7 (`scripts/backfill-access.mjs`, needs its
  own diff-review approval since it writes to reviewed `/data` content, and
  will surface the `emergency.json`-not-in-manifest question), step 8 (the
  adversarial RLS check — confirm `testmember` genuinely cannot see Acme's
  rows, etc.), step 9 (this table's Status column, once 7-8 are done).

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
