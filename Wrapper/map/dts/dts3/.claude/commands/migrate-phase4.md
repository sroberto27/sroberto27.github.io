---
description: Phase 4 — Swap client auth in app.js to Supabase + real resource gating (security-critical core)
---

Phase 4 of the DTS migration. Prerequisite: Phase 3 done (dev DB + schema + DUMMY
org/user/entitlement data seeded by Claude via the CLI). Re-read golden rules AND
the README do-not-break list. **Plan first, execute after approval.** This is the
most important phase — test thoroughly. Read `docs/migration/ACCESS-MODEL.md`
first; it is the normative spec this phase implements.

Goal: replace the Google-Sheet CSV login with Supabase Auth, AND make resource
access levels (`public`/`registered`/`client`/`restricted`) real and
server-enforced — not just a UI gate. Today NOTHING is gated (confirmed by
reading `js/app.js` — `authenticate()` only returns which twin rows to *list*
in the portal; no project, experience, or GIS map checks `access.session`
before rendering). This phase changes that for the first time.

Plan, then do:

1. **`index.html`** — add, BEFORE `content-loader.js`: the supabase-js CDN
   bundle, then a new `js/supabase-init.js` (creates the client from the dev
   project URL + anon key — these are the ONLY account-specific values in a
   committed file, by design; read them from the values recorded in Phase 3).
   Remove or dev-gate the `clients.js` tag (Phase 2 already scoped it to
   localhost). Final order:
   `config.js -> supabase-init.js -> tour-bridge.js -> content-loader.js`.
   Fix the "Login In" typo. Disturb no other load-order.

2. **`js/app.js authenticate()`** — the function the code comment already
   flags as the swap point. Replace its body with
   `supabase.auth.signInWithPassword({ email, password })`. On success, fetch
   the caller's own org memberships (`organization_members` joined to
   `organizations`, readable under RLS as "your own row") to populate
   `access.session.orgs` — this is new state; the old code had none, because
   the old model had no orgs. Do NOT attempt to map this onto the old
   `normalizeRow()`/`twins[]` shape — that shape assumed one flat directory
   with no resource gating and is retired in this phase. Fix up
   `openPortal()`/`openTwin()` to iterate the user's actual accessible
   resources (see step 4) instead of `session.twins`.

3. **Delete** `loadDirectory()`, `parseCSV()`, `normalizeRow()`, and the
   `access.directory`/`access.loading` state (~80 lines gone).

4. **Resource gating — the new part.** Read `ACCESS-MODEL.md` §4-5 for the
   exact `resource_key` format and resolution order before writing any of
   this.
   - `functions/api/resource/[key].js` (~50-70 lines): verifies the caller's
     Supabase JWT (optional — anonymous callers are allowed through for
     `public` resources), looks up the resolved access level for `key` by
     reading the PUBLISHED `/data` document (via the same R2-backed route
     Phase 6 sets up — if Phase 6 hasn't run yet in this dev sequence, read
     from the local `/data` copy instead and note the TODO to switch to R2),
     evaluates the level per `ACCESS-MODEL.md` §3, and for `restricted`
     queries `resource_entitlements` using the service role (bypassing RLS
     deliberately, since this Function IS the trust boundary). For a
     `project.<id>`/`project.<id>:<expId>`/`links[]` key, returns
     `{ tourUrl | embedUrl+watchUrl | url }`. For a `gismap.<mapId>` key,
     returns the FULL `gisMap` document (view/basemaps/layers/tours) plus its
     associated `gisTour`/`gisFeatureTour` documents, WITH every local-file
     `layers[].url` (the `sourceType: "geojson"` ones — 5 shorelines + the
     parish boundary for `iberia-coastal`, NOT the 12 live ArcGIS-backed
     layers, which stay as their real public government URLs unchanged)
     rewritten to `/api/resource/gismap/<mapId>/layer/<layerId>` — see
     `ACCESS-MODEL.md` §5's "whole-document exception" note; a GIS map is not
     a URL to hand back, it's the entire object `DTSGis.mount()` needs, and
     its local layer files are exactly as gated as the map itself. 401 if no
     session and level > public, 403 if authenticated but not entitled/not a
     client member. Never trust an `access` value posted from the client.
   - `functions/api/resource/gismap/[mapId]/layer/[layerId].js` (~20 lines):
     re-runs the SAME `gismap.<mapId>` access check (a separate HTTP request,
     so re-verify — don't trust that the caller already passed the parent
     check once) and, if it passes, streams the raw geojson from
     `data/source/gis/layers/<file>.geojson`. This means
     `js/gis/gis-viewer.js:170`'s `fetch(def.url)` needs ZERO code changes —
     it just receives an already-rewritten, already-authenticated URL inside
     the `mapDoc` the resolver returned.
   - **Strip navigable targets from published `/data`.** Any experience or
     `links[]` entry whose resolved level is above `public` loses its
     `tourUrl`/`embedUrl`/`watchUrl`/`url` in the document that ships to the
     browser (label/poster/description stay). This is a Phase 6 publish
     concern but MUST be verified working here, because Phase 4's gate is
     meaningless if Phase 6 hasn't stripped the target yet — if Phase 6 is
     not done yet in this sequence, do the strip as a temporary build step
     in this phase and hand it off to Phase 6 to formalize.
   - **Strip `js/config.js` too — the gate is void without this.**
     `js/config.js` is the `/data`-unreachable fallback, injected dynamically
     rather than via a `<script>` tag, so it is invisible in a normal
     page-load network trace — but it is a deployed static file currently
     holding 16 tour URLs and 46 Vimeo references for all 16 projects. Until
     it is stripped, `curl https://<site>/js/config.js` hands over every
     gated target and NOTHING else in this phase matters. Apply the same
     field-level strip (keep structure, copy, and the public homepage
     `treedis.tourUrl`; drop gated `tourUrl`/`embedUrl`/`watchUrl`/
     `links[].url`) — see `ACCESS-MODEL.md` §5. Phase 6 formalizes this into
     `split-content.mjs`; do it here as a build step if Phase 6 hasn't run.
   - **GIS maps are withheld WHOLESALE, not field-stripped.** `js/app.js`
     currently sources the map object `DTSGis.mount()` needs from
     `cfg.gisMaps[mapId]` — i.e. from the unconditionally-fetched
     `DTS_CONFIG`, the SAME public config every guest already receives today.
     Confirmed by reading `js/gis/gis-viewer.js:311-317`:
     `DTSGis.mount(containerEl, mapDoc)` takes the entire document, not a
     resolved URL. For a gated `gismap.<mapId>`, `js/app.js` must stop
     reading from `cfg.gisMaps`/`cfg.gisTours`/`cfg.gisFeatureTours` for that
     map and instead await the full document from
     `/api/resource/gismap.<mapId>` before calling `DTSGis.mount()`. This is
     the single highest-value fix in this phase: today NOTHING gates the GIS
     map at all — the whole `iberia-coastal` map, its 14 tours, and its 13
     feature tours are already in every visitor's `DTS_CONFIG` regardless of
     what any project-level access field says, because content-loader.js
     fetches every manifest document unconditionally. Test this specifically
     — open the browser console as a guest and confirm `DTS_CONFIG.gisMaps`
     does NOT contain `iberia-coastal` (or its full definition) before login.
   - **Close the `links[]` leak explicitly.** `automotive.json` has 3 and
     `campus.json` has 1 `links[]` entries pointing directly at
     `spaces.dtsxr.com` — these are the SAME resource class as the
     experiences they duplicate and must carry the same `access` field and
     go through the same strip-and-resolve path. A project rendering with a
     gated experience tile but an ungated raw link to the same tour is a
     FAILED acceptance check for this phase, not a follow-up.
   - `js/app.js` — wherever an experience/GIS-map/link is opened
     (`openExample`, `mountTreedis`, `mountVideo`, GIS mount, `openTwin`),
     replace the direct use of a `/data`-supplied URL with a call to
     `/api/resource/<key>`. On 401, open the existing sign-in form instead of
     the resource, and preserve the requested destination (a `resourceKey` in
     a query param or in-memory state) so a successful login re-opens the
     original target instead of dumping the user back at the home page. On
     403, show an "ask your DTS contact for access" message — do not silently
     fail.

5. **Session restore** — on boot `supabase.auth.getSession()`; rebuild
   `access.session` (including org memberships) and repopulate the portal so
   reload no longer logs clients out.

6. **`signOut()`** — `supabase.auth.signOut()`. Remove the "Remember me"
   localStorage logic.

7. **`#accessForgot`** — `supabase.auth.resetPasswordForEmail(email,
   { redirectTo })` + a small recovery panel in the existing overlay
   (~30 lines). Whitelist the redirect URL in Supabase.

8. **On successful login**, dispatch a `dts:signed-in` CustomEvent carrying
   the session (now including `site_role` and `orgs`) — admin.js listens in
   Phase 5.

9. **CSP** — tighten `_headers` connect-src to include the Supabase project
   URL.

10. **Test hard, using the seeded DUMMY users from Phase 3**:
    - `testuser@example.com` (registered, no org): can open every
      `registered` experience/link; is blocked (403) from the `restricted`
      resource entitled to Acme; the `client`-level check (if any resource
      uses it yet) correctly blocks them for lack of org membership.
    - `testorgadmin@example.com` (org_admin@Acme, member@Beta): can open the
      resource restricted to Acme; session correctly shows both orgs.
    - `testmember@example.com` (member@Beta only): blocked from the
      Acme-restricted resource.
    - Guest (no session): clicking any `registered`/`client`/`restricted`
      resource opens the login form, not the resource; after logging in as
      `testuser`, the ORIGINAL requested resource opens (destination
      preservation).
    - `automotive`/`campus` `links[]` entries render as gated tiles, not raw
      clickable URLs, for a guest.
    - **The GIS map is genuinely gated, not just hidden.** As a guest, inspect
      `DTS_CONFIG` in the console and confirm `gisMaps`/`gisTours`/
      `gisFeatureTours` do NOT contain the full `iberia-coastal` definition
      (view/basemaps/layers/tours) — a locked tile with just a label is fine,
      the full document is not. As `testuser` (registered, no org — `gfc`'s
      map is `restricted` to Acme per the Phase 3 seed), confirm the SAME:
      still no full map document without the Acme entitlement. As
      `testorgadmin` (Acme), confirm the map loads via
      `/api/resource/gismap.iberia-coastal` and `DTSGis.mount()` renders it
      correctly, including at least one tour and one feature tour, AND the 5
      shoreline/boundary layers render (not blank/erroring) — confirming the
      `/api/resource/gismap/iberia-coastal/layer/<id>` rewrite works.
    - **Local layer files are gated independently of the map document.** As a
      guest, directly fetch `data/current/gis/layers/shoreline-1935.geojson`
      (and the other 4 shorelines + the parish boundary). Confirm 404/absent
      — not the raw geometry — even though these files never appeared in
      `DTS_CONFIG` in the first place. This is a distinct check from the
      "GIS map is genuinely gated" one above: that one proves the map
      *document* is withheld, this one proves the map's *local layer files*
      are too, since they're fetched by a separate, independent browser
      request (`js/gis/gis-viewer.js:170`) that a document-level gate alone
      does not stop.
    - **`js/config.js` no longer hands out gated URLs.** Run
      `curl https://<deployed-site>/js/config.js | grep -c spaces.dtsxr.com`
      and confirm 1 (the public homepage tour), not 16. Do the same for
      Vimeo references. Do NOT substitute a browser network-tab check here —
      `config.js` is loaded dynamically only on the `/data`-failure path, so
      it will correctly appear absent from a normal load while still being
      fully fetchable. Fetch it deliberately.
    - Reload keeps everyone signed in; signOut works; forgot-password sends.
    - Re-run the full README checklist (tour must not reload — the single
      shared iframe pattern must survive all of the above; lead form; mobile).
    - Redeploy with `wrangler pages deploy`. Update `PROGRESS.md`. Stop.
      Next: `/migrate-phase5`.
