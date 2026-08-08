---
description: Phase 6 — Content pipeline: /data to R2 (scripted) + instant publish Function + public/protected split
---

Phase 6 of the DTS migration. Prerequisite: Phases 4-5b done. Re-read golden
rules + do-not-break list. **Plan first, execute after approval.** AUTOMATED:
Claude writes and RUNS the upload/deploy scripts; you approve the plan. Read
`docs/migration/ACCESS-MODEL.md` first.

Goal: move `/data` into R2, served SAME-ORIGIN via a Function so
`content-loader.js` stays byte-identical AND publishing is instant (no
redeploy, no GitHub) — AND formalize the public/protected document split that
Phase 4 had to do ad hoc to make its gate meaningful.

Scope correction from the original design: `/data` is not just the 30
site/page/sector/project/form/faq documents. It is **60 documents** (per
`data/manifest.json`), including
`gis/sources.json`, 1 GIS map, 14 GIS tours, and 13 GIS feature tours (29 GIS
documents total) — none of which the original Phase 6 draft accounted for.

**`data/gis/layers/*.geojson` (6 files) are NOT optional to carry along —
"matching today's behavior" here means leaving a real gap, not being
conservative.** These are fetched directly by `js/gis/gis-viewer.js:170`
(`fetch(def.url)`), independent of the manifest/`DTS_CONFIG` pipeline
entirely, whenever `iberia-coastal` renders its 5 shoreline layers + parish
boundary mask. They are absent from `data/manifest.json` today only because
nothing gated them before — that absence is the bug this phase closes, not a
precedent to preserve. Per `ACCESS-MODEL.md` §5's local-layer-file note: all 6
files go to `data/source/gis/layers/` (private — same treatment as the
`gisMap` document that references them), served ONLY through
`functions/api/resource/gismap/[mapId]/layer/[layerId].js` (Phase 4). They
must NOT land in `data/current/` at all, and must NOT be treated as
"public static assets" the way the rest of `/data` is — do not let
`scripts/upload-content.mjs` route them through the same public-upload path
as everything else without checking `ACCESS-MODEL.md` first.

Separately: `data/projects/emergency.json` exists on disk but is NOT in
`data/manifest.json`. Unlike the layers, this one really is undecided pending
the user — Phase 3's backfill script already flagged it and did not decide;
carry it into the manifest-driven upload only if the user chose to register
it there, otherwise leave it out (a missing marketing project page is a
content gap, not a security one, so "leave out" is actually safe here, unlike
for the layer files above).

Pre-flight: confirm CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env;
confirm the R2 buckets from Phase 1 exist. If missing, stop and name what's
needed.

Plan, then do:

1. **The public/protected split.** Two kinds of stripping, per
   `ACCESS-MODEL.md` §5 — do not conflate them:
   - **Field-level** (project documents): for every experience/link whose
     resolved `access` is above `public`, the PUBLISHED copy under
     `data/current/` has its navigable target removed —
     `experiences[].tourUrl`, `experiences[].embedUrl`/`watchUrl`, and
     `links[].url`. Everything else in the document (labels, posters,
     descriptive fields) ships unchanged. This is the formal version of the
     strip Phase 4 had to do ad hoc.
   - **Whole-document** (GIS): a `gisMap` document, and every `gisTour`/
     `gisFeatureTour` document sharing its `mapId`, is either published in
     full to `data/current/` (if `gismap.<mapId>` resolves to `public`) or
     EXCLUDED ENTIRELY from `data/current/` and replaced with a minimal
     public stub (`id`/`title`/`subtitle` only) — never present with fields
     stripped, since `js/gis/gis-viewer.js:311-317`'s `DTSGis.mount()`
     consumes the whole document at once and there is no per-field boundary
     to strip inside it. The full document lives only in `data/source/`.
     `iberia-coastal` (1 map, 14 tours, 13 feature tours, all `registered`
     per the Phase 3 backfill) is the concrete case to get right here.
   - **`js/config.js` gets the SAME field-level strip** — it is a third
     surface, not covered by anything above, and the easiest to miss. It is
     not a `<script>` tag in `index.html` (content-loader injects it only as a
     `/data`-unreachable fallback, `content-loader.js:367-375`), so it never
     shows up in a normal page-load network trace — but it IS deployed as a
     plain static file, and today it holds 16 `spaces.dtsxr.com` tour URLs and
     46 Vimeo references for all 16 projects. `curl https://<site>/js/config.js`
     returns every gated target unless this strip happens. Remove every
     `tourUrl`/`embedUrl`/`watchUrl`/`links[].url` whose resolved level is
     above `public`; KEEP the structure, copy, form definitions, descriptive
     project fields, and the public homepage `treedis.tourUrl` (so the
     fallback still renders and "Try a Digital Twin" still works). See
     `ACCESS-MODEL.md` §5. Because `CLAUDE.md` directs keeping `config.js`
     "roughly in sync" with `/data`, this strip must be RE-APPLIED (and
     re-verified) any time `config.js` is regenerated — treat it as part of
     `split-content.mjs`'s job, not a one-time manual edit.
   - Phase 4's `/api/resource/[key].js` reads the FULL unstripped source (a
     `data/source/` prefix in the same bucket, never served by the
     `[[path]].js` route) to resolve the real target — a URL for
     project/experience/link keys, the full document set for a `gismap.*`
     key — while the browser-facing `data/current/` copy never contains the
     gated material.
   - Write this as `scripts/split-content.mjs`: reads the full `/data` tree,
     writes an unstripped copy to `data/source/` (R2, private — no route
     serves this prefix to the browser) and a stripped/reduced copy to
     `data/current/` (R2, served by `functions/data/[[path]].js`). Run it as
     part of every publish, not as a one-time step.
   - Re-run the Phase 4 acceptance checks here against the PUBLISHED output,
     not just the UI: fetch `data/current/projects/automotive.json` directly
     and confirm the gated link URLs are absent; fetch
     `data/current/gis/maps/iberia-coastal.json` (and one tour, one feature
     tour) directly as a guest and confirm either a 404/stub, not the full
     interactive map definition; fetch
     `data/current/gis/layers/shoreline-1935.geojson` (and the other 4
     shorelines + the parish boundary) directly and confirm 404/absent — this
     is the check that catches `split-content.mjs` silently routing the layer
     files through the generic public-upload path instead of `data/source/`.
     Finally `curl https://<deployed-site>/js/config.js | grep -c
     spaces.dtsxr.com` and confirm the count is 1 (the public homepage tour
     only), not 16. This last one is the check most likely to be skipped,
     because `config.js` never appears in the browser's network tab on a
     normal load — you have to fetch it deliberately.

2. **Seed R2 (scripted).** Claude writes `scripts/upload-content.mjs` (using
   `split-content.mjs` as its first step) and RUNS it to upload both the
   scrubbed `data/current/` and the private `data/source/` to `dts-content`.

3. **`functions/data/[[path]].js`** (~25 lines): reads `data/current/<path>`
   ONLY from the R2 binding — it must never be able to resolve `data/source/`
   — and returns it same-origin with edge caching. Verify the loader's
   fallback chain (draft → /data → config.js) still behaves;
   `content-loader.js` is UNCHANGED.

4. **Remove the static `data/` from the deploy** (keep a local copy). Confirm
   the site hydrates identically from the R2-backed route, and confirm gated
   resources still resolve correctly through `/api/resource/[key].js`
   (Phase 4), which now reads from `data/source/`.

5. **`functions/api/publish.js`** (~70-100 lines, grew from the original
   estimate to cover the split): verify the Supabase JWT + `site_role =
   'site_admin'` claim (JWKS), validate the payload is the known document
   set, run the same split logic as `split-content.mjs` on the incoming
   payload, write BOTH the stripped copy to `data/current/` and the full
   copy to `data/source/`, plus a snapshot of the FULL copy to
   `data/snapshots/<ISO-timestamp>/` (git-free version history — snapshot the
   source, not the stripped view, so a rollback doesn't need to re-strip),
   purge the `/data/*` edge cache. Secrets (Cloudflare API token, Supabase
   JWT config) as Pages secrets — Claude sets them via
   `wrangler pages secret put`, never committed.

6. **Admin Board "Publish to site" button** — POSTs the same `content.docs`
   object the zip export already serializes, to `/api/publish`, with the
   Supabase access token in the Authorization header. KEEP the zip export
   untouched as fallback.

7. **Rollback drill (scripted):** Claude runs a check copying a `data/source/`
   snapshot back over `current/` (through the split step, not a raw copy) to
   prove version history works.

8. Deploy (`wrangler pages deploy`), test edit→publish→live-in-seconds→reload,
   AND test that a gated resource's URL is genuinely absent from the public
   `data/current/` response for that document. Update `PROGRESS.md`. Stop.
   Next: `/migrate-phase7`.

Free-tier guardrail: R2 under 10 GB, function calls under the free daily cap.
