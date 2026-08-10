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
| 4 — Client auth swap + resource gating | **DONE** — full manual checklist passed, including both post-fix retests | https://dts-website-4cu.pages.dev | Every checklist item passed except forgot-password (item 14 — blocked on the deferred SMTP setup, an account/infra gap, not a code issue; retest once §7 is done). All real bugs found during testing (resource-key decode, gating-UX auto-prompt, locked-placeholder-not-restored, cross-tab sign-in sync, sign-out not revoking cached access) fixed and user-confirmed live, not just deployed. |
| 5 — Admin auth swap (site_role) | **DONE** | https://dts-website-4cu.pages.dev (deployed, `b693ed64...`) | user ran all 6 local checks pre-deploy (site_admin→board, org_admin→portal/no board, plain user→portal, draft/preview/discard, zip export, real sign-out) — all PASS; not yet re-confirmed on the dev URL |
| 5b — CMS access editors + org management | **DONE** — all three checkpoints (A: access editors + entitlement picker; B: Organizations/Users/Access screens; C: org-admin team panel) complete and user-confirmed live | https://dts-website-4cu.pages.dev (deployed, `a30b1e22...`) | User confirmed all three checkpoints live, including the org-admin panel's full member management, the plain-`member`-sees-nothing case, and that `testadmin`'s Admin Board screens still work unchanged |
| 6 — Content pipeline (public/protected split) | **DONE** | https://dts-website-4cu.pages.dev (deployed, `1e7003a4...`) | Diff-based `/api/publish` verified live end-to-end via real `testadmin` session; rollback drill run clean; full acceptance battery passes. **A critical whole-site-breaking bug was found by the user in real live testing AFTER this row was first marked done, then fixed and re-verified** — see the session log's follow-up entry: `manifest.json` listed gated GIS documents that don't exist in `data/current/`, 404ing `content-loader.js`'s `Promise.all()` and taking the ENTIRE site (every visitor, not just guests) to the `config.js` fallback, which also silently disabled the Admin Board for `site_admin`. Confirmed fixed: all 34 manifest-listed files now return 200 against the live stable alias. Not yet re-confirmed via the Admin Board UI in a browser. |
| 7 — Lead form | **DONE** | https://dts-website-4cu.pages.dev (deployed, `b4ed6f66...`) | Original server-side design (Turnstile-verified `/api/lead` proxying to Web3Forms) hit a real chain of debugging problems (documented in the session log below) and was deliberately reverted to a simpler client-side design at the user's explicit call. **User confirmed a real lead submit works end-to-end** against the simplified version — the fix is complete, not just deployed. |
| 8 — Builds (org/user entitlement-gated) | **DONE** | https://dts-website-4cu.pages.dev (deployed, `101ac885...`) | Full scripted end-to-end battery against the real deployed site passes: guest 401, direct-user-entitlement 200, org-entitlement 200 (different account than the direct grant), site_admin bypass 200 with zero entitlement, non-entitled 403, unknown key 404, a disabled build 403s an otherwise-entitled user then 200s again once re-enabled, admin routes (list/create/update/upload/delete) all site_admin-gated and a non-admin gets 403, and a `public`-level app serves with no token at all. **User ran the full manual browser pass** (`docs/migration/PHASE8-BUILDS-TESTING.md`) — 12/13 passed; the one failure (no way to delete a build) was fixed same session, redeployed, and re-verified scripted end-to-end. Not re-run in the browser after that fix — the fix itself is proven at the API level, same confidence level as the rest of this row. |
| 9 — Analytics & audit | **DONE — dev build complete** | https://dts-website-4cu.pages.dev (deployed, `40291069...`) | 23 scripted assertions pass (8 adversarial RLS on `events`/`admin_audit` against real dev Supabase, 15 live against `/api/track`/`/api/admin/audit` on the real deployed site) + full deploy-staging exclusion diff. **User needs to run** `docs/migration/PHASE9-TESTING.md` (browser click-through: consent banner, Activity chart, Audit screen, event-instrumented flows, final README regression) — nothing in it marked passed on their behalf. |
| Handoff — go live (real orgs + members) | not started | — | — |

## Session log
(Newest first. One short entry per working session: what changed, what was tested, what's blocked.)

- 2026-08-09 — **Real bug found and fixed: the Admin Board could not see
  gated GIS maps/tours or gated project experiences at all**, reported by
  the user with screenshots (the GFC project's GIS-type experience showing
  an empty "Map" dropdown, GIS MAPS nav completely empty, the map's guided
  tours nowhere to be found) — independent of the documentation feature
  above, found while the user was exploring the just-shipped Documentation
  screen.

  **Root cause, traced by reading the real code and querying the live R2
  bucket directly, not guessed:** two separate issues stacked on top of
  each other.
  1. Phase 6's `splitGisDocSet()` (`functions/_lib/split-logic.js`) builds
     the public placeholder for a gated GIS map using
     `PUBLIC_GIS_STUB_FIELDS = ["id", "title", "subtitle"]` — `_type` was
     never included, confirmed live (`/data/gis/maps/iberia-coastal.json`
     really did come back as just those three fields). Every consumer that
     enumerates "all the GIS maps" filters by `_type === "gisMap"` —
     `js/admin.js`'s `gisMapFiles()` (driving both the GIS MAPS nav and the
     experience editor's "Map" dropdown) got zero matches as a result.
  2. **The bigger issue:** `js/content-loader.js`'s `loadContent()` — the
     ONE content-loading path for every visitor, admin included — only ever
     fetches through `functions/data/[[path]].js`, which is hard-coded, by
     its own explicit design comment, to read ONLY `data/current/` (the
     public, stripped copy) and can never resolve `data/source/` (the full
     copy `/api/publish` writes to). Nothing anywhere in
     `functions/api/admin/` ever read `data/source/` back into the board.
     So even with #1 fixed, the board would show a title-only stub, never
     the map's real layers/view/tours, and any gated project experience's
     real `tourUrl`/`mapId` stayed stripped too.

  **Confirmed nothing was actually lost** — this was a client-visibility
  bug, not data loss: `wrangler r2 object get` against the live
  `data/source/manifest.json` returned the correct, full 61-file listing
  (29 in the `gis` group: 1 map + 14 tours + 13 feature tours, matching the
  repo's local `data/manifest.json` exactly), and a real tour document read
  back with its genuine content intact.

  **Fix 1:** added `"_type"` to `PUBLIC_GIS_STUB_FIELDS`
  (`functions/_lib/split-logic.js`) — confirmed the real map document
  actually carries `_type: "gisMap"` before assuming this was the missing
  piece.

  **Fix 2, the real one — a single combined "admin content bundle," not 61
  separate reads:** `/api/publish` already hit Cloudflare's
  ~50-subrequest-per-invocation ceiling once before at a similar document
  count (its own file header documents "Too many subrequests" at 150+
  operations for 61 docs) — a naive read of manifest + 61 docs (~62
  operations) would hit the same wall, so this was designed around
  up front rather than discovered the hard way again.
  - `functions/api/publish.js`: one more `put("data/source",
    "_latest.json", {manifest, docs, layers})` at the end of every publish
    — a fixed key, always overwritten, same shape as the existing
    timestamped `data/snapshots/<id>.json` this mirrors.
  - New `functions/api/admin/content.js` (`GET`, `requireSiteAdmin()`-gated,
    same helper every other admin Function already uses): one
    `env.DTS_CONTENT.get()` read of that key, returns `{manifest, docs}`.
    `data/source/*` is already unreachable through the public catch-all
    route by construction, so this is the only way to reach it.
  - `js/admin.js`: new `ensureFullContent()`, called at the top of
    `openBoard()` before the nav/editors are built. Skips entirely when a
    local draft is active (`content.fromDraft`) so it can never silently
    overwrite a site_admin's own unsaved edits — if an existing draft was
    itself saved while this bug was live, the fix is the existing "Discard
    draft" recovery path, not a new mechanism. Replaces `content.manifest`
    wholesale (not just merging `docs`), which matters:
    `saveDraft()`/`publishToSite()`/`exportData()` all build their payload
    from `content.manifest` directly, and `/api/publish` only processes
    files actually listed in it — leaving the old 34-entry public manifest
    in place would have silently dropped any edit to the 27 GIS tour/
    feature-tour documents from ever publishing, even once the nav
    correctly showed them. Mutates the same object `window.DTS_CONTENT`
    already points to; never touches `window.DTS_CONFIG` (the legacy shape
    `app.js` reads), so "View site" preview still correctly shows the site
    exactly as a real visitor would, respecting gating — this fix only
    changes what the editor sees.
  - **One-time backfill, run directly against the live bucket, not shipped
    as application code** (same "throwaway harness, not committed"
    convention prior sessions used for direct Supabase/R2 work): read the
    REAL live `data/source/manifest.json` + all 61 listed documents
    straight from R2 (not the local repo copy, which could be stale
    relative to whatever's actually been published live), assembled the
    bundle, wrote it to `data/source/_latest.json` — needed once so the fix
    works immediately without requiring a publish first, which the admin
    couldn't meaningfully do while the board couldn't see the content in
    the first place. Verified by reading it back: 61/61 docs, the map
    document's real `layers`/`view`/`tours` all present.
  - **Separately, with the user's explicit go-ahead for this specific
    write** (flagged and confirmed before acting, since it directly
    modifies live public-facing content): patched the ONE already-published
    `data/current/gis/maps/iberia-coastal.json` object in R2 to add the
    same `_type` field Fix 1's code change will produce on the next real
    publish — otherwise that inconsistency would have sat live until
    someone happened to publish again. Only the one field was added; the
    `id`/`title`/`subtitle` values are byte-identical to what was already
    live.

  **Verified live, end to end, against the real deployed site**
  (`https://5afe56f9.dts-website-4cu.pages.dev`) via a throwaway script
  minting real sessions for the already-seeded `testadmin`/`testuser`
  accounts (Admin API `generate_link`+`verify`, no passwords, no rows
  created or left behind, same pattern prior sessions used): `GET
  /api/admin/content` with no token → 401; with `testuser`'s token
  (non-admin) → 403; with `testadmin`'s token → 200, manifest shows 61
  files/29 gis entries, and the returned `iberia-coastal` document carries
  its real `layers` (17), `view`, and `tours` (1) — not the stub. The
  public `/data/gis/maps/iberia-coastal.json` now returns `_type:"gisMap"`
  alongside its existing stub fields, confirmed both via a cache-busting
  request (proves the R2 object itself is correct) and the canonical cached
  URL (proves it's actually being served, not just written). Full
  byte-count regression battery (root, every excluded path,
  `/data/manifest.json`, `js/help.js`, `js/admin.js`) re-run clean
  afterward — no regression from this session's changes.

  **NOT yet verified — needs the user, in a real browser:** GIS MAPS now
  actually listing `iberia-coastal` with its tours nested underneath in the
  Admin Board's own nav, the GFC project's GIS experience's "Map" dropdown
  actually showing and being selectable, opening the map in the board
  actually rendering its real layers, and Save draft & preview / Publish
  still working normally afterward with the fuller content set. Chrome
  browser automation was unavailable all session — every check above is
  real (direct API calls, real R2 reads, real minted sessions), but none of
  it is a screenshot of the actual UI.

- 2026-08-09 — **Admin Board documentation rewritten for depth, same
  session, real user feedback on the just-shipped feature below.** The
  user's complaint was specific and correct: the site_admin content
  summarized what each screen was for rather than actually teaching someone
  who doesn't know the system how to do things -- no click-by-click steps,
  no exact button/field labels, no "what you need before you start."

  **Rewrote all 14 `admin` topics in `js/help-content.js`** (~4x the content,
  27,947 characters of HTML vs. the original terse version) using real
  labels traced from the actual editor functions in `js/admin.js` --
  `editHome`/`editContact`/`editFaq`/`editFunFacts`/`editSector`/
  `addSector`/`editProject`/`addProject`/`editGisMap`/`layerEditor`/
  `editOrganizations`/`editUsers`/`editBuilds`/`editAccessIndex`/
  `entitlementPicker`/the top toolbar's six buttons -- read directly rather
  than described from memory, so every button name quoted in the content
  (\"Save draft & preview\", \"+ Add category page\", \"Test connection\",
  \"Who has access\", etc.) is the literal real label. Structured with new
  `<h4>` step-group headings, numbered `<ol>` steps, and a `.help-note`
  callout style for \"before you start\" prerequisites (e.g. Builds needs
  the real file ready first; GIS layers need the service URL; Users has no
  working invite-email yet so you set the password directly) -- new to
  `css/16-help.css` (`.dts-help-panebody h4/ol/li/.help-note`), verified
  balanced by a scripted tag-count check (`<ol>`/`<li>`/`<h4>`/`<div>`/`<p>`/
  `<strong>`/`<code>` open/close counts match in every topic, not just
  visually skimmed) rather than trusted from writing it carefully.

  Also newly explicit per topic, not implicit before: which screens write
  live immediately with no draft/publish step at all (Organizations, Users,
  Builds, Access) vs. which follow the ordinary draft → preview → publish
  flow -- this distinction existed in the code before but was easy to miss
  and is exactly the kind of thing someone new to the system would get
  wrong.

  All 14 topic ids kept identical to before (`overview`, `draft-workflow`,
  `home`, `contact`, `faq`, `funfacts`, `sectors`, `projects`, `gis`,
  `organizations`, `users`, `builds`, `access`, `audit`) — the
  entitlement-picker's "?" contextual hint (`helpHintBtn("access", ...)`,
  `js/admin.js`) still resolves correctly, confirmed by grep, not assumed.

  **Verified:** `node --check` clean on every touched JS file; loaded
  `help-content.js` in a real Node VM and confirmed all 14 admin topics
  parse with non-empty `title`/`html` and matching id list; a scripted
  open/close tag-count check (`<ol>`/`<li>`/`<h4>`/`<div>`/`<p>`/`<strong>`/
  `<code>`) confirms every topic's HTML is balanced, not just visually
  skimmed; local `http.server` re-confirms `index.html`/`js/help-content.js`/
  `css/16-help.css` all still serve `200`.

  **Redeployed** (fresh staging rebuild + full diff/exclusion re-verify per
  `DEPLOY-STAGING.md`, same as the prior deploy this session — nothing
  skipped just because it was done once already):
  `https://849d58f4.dts-website-4cu.pages.dev`. **One real finding, worth
  recording plainly rather than glossed over:** the very first post-deploy
  check of `/data/manifest.json` returned a stray `404` (with a mismatched
  `Content-Type: text/html`, though the response body was actually the
  correct real JSON) — investigated rather than dismissed: five immediate
  retries all returned a clean `200`/5,043 bytes, matching the previous
  deploy and the stable alias exactly, so this reads as a one-off edge-
  propagation blip immediately after the fresh Functions bundle upload, not
  a real regression — nothing in this session touched `functions/` or the
  data pipeline. A full clean re-run of the whole byte-count battery (root,
  every excluded path, the manifest route, both new help files) afterward
  came back consistent and correct across the board.

  **Still not verified:** no live browser pass (Chrome extension
  unavailable this session too) — how the new headings/notes/lists actually
  render is unconfirmed, same gap as the original feature.

- 2026-08-09 — **In-app documentation for four audiences, requested by the
  user independent of any numbered phase** ("Add in-app documentation/manual
  for four audiences: site_admin, org_admin, member, and normal user"). Does
  not block or require `/migrate-handoff`; must keep working unchanged after
  the account-swap handoff — it's pure static content + client-side logic,
  nothing account-specific anywhere in it.

  **Resolved the four-tier request onto the real role model
  (`ACCESS-MODEL.md` §1/§8) before building anything, confirmed with the
  user in planning:** `site_admin` → the Admin Board; `org_admin`/`member` →
  one portal Help tab, with org_admin's team-management topics layered ON
  TOP of member topics (a superset, not a separate track — the exact
  `orgRole === "org_admin"` filter `renderOrgAdminPanel()` already
  established); `normal user` → NOT the same as `member` — guests AND any
  signed-in visitor with no organization, reachable from anywhere via a new
  floating icon, split by UI surface (marketing site vs. portal chrome) not
  by identity, since a no-org registered account genuinely does land in the
  portal too (`finishSignIn()` → `openPortal()` unconditionally once
  `site_admin`/pending-resource cases are ruled out — traced the real call
  path rather than assuming).

  **Four design decisions, each pre-approved with a stated recommendation
  and built exactly as recommended, no changes:** PDF export via
  `@media print` + `window.print()` (browser-native, no new library) with a
  genuinely clickable linked TOC in the output — the TOC entries are real
  `<a href="#dts-help-...">` anchors intercepted for in-app clicks but left
  as real links for print/PDF rendering, not literal buttons; content stored
  static in the codebase (`js/help-content.js`), a **deliberate, flagged
  exception** to CLAUDE.md's "belongs in /data" rule since this documents
  code behavior, not editable content — confirmed this means the "three
  places every time" `/data` rule (manifest → buildConfig → app.js) doesn't
  apply at all here, nothing to register; diagrams as lightweight inline SVG
  (two built: the four-level access ladder in the Admin Board's Access
  topic, the invite flow in the org-admin Help topics), not screenshots;
  search is client-side filter-only, no backend.

  **One shared rendering engine, three mount points** — avoids three separate
  TOC/search/print implementations. `js/help.js`'s `DTSHelp.mount(container,
  topics, opts)` is called by: `js/admin.js`'s new `editHelp()` (new
  `navBtn("Documentation", "help")` under a new HELP nav group, same
  `navBtn()`/`select()` dispatcher pattern as every other screen); `js/app.js`'s
  new `renderPortalHelp()` (new `data-portal-view="help"` tab, following the
  Phase 9 Activity tab's exact pattern — the existing generic
  `$$(...).forEach(b => b.addEventListener(...))` wiring picked up the new
  buttons with zero new listener code); and `js/help.js`'s own floating-icon
  overlay, fully self-contained (owns its own open/close, unlike the other
  two which are opened by their host's existing navigation). Unlike the
  Activity tab, the portal Help tab is **not** hidden for a no-org session —
  it documents the portal itself, which applies regardless of org
  membership.

  **Two new one-line exports on `window`, same pattern as the existing
  `window.DTS_ACCESS`/`DTS_CONFIG`/`DTS_CONTENT`:** `window.DTS_TRACK = track`
  (`js/app.js`) so `help.js` — a separate, statically-loaded script that
  parses before `app.js` even exists, since `app.js` is injected dynamically
  by `content-loader.js` — can fire the two new analytics events without
  reaching into `app.js`'s private closure. `window.DTSHelp.registerOpener()`
  lets `admin.js`/`app.js` register how to reach THEIR OWN Help screen, so
  the shared `?` keyboard shortcut (guarded against firing while typing in
  any real input/textarea/contenteditable) can route to the right one based
  on which body class (`adm-lock`/`portal-open`) is currently active, falling
  back to the floating overlay otherwise. Both guarded
  (`if (window.DTSHelp) …`) the same way `window.DTS_ANALYTICS` guards
  already are, in case load order ever changes.

  **New analytics event types, additive:** `help_topic_view`
  (`{topicId, audience}`, fired once per topic opened across all three
  surfaces) and `help_search` (`{query, matched}`, same 200-char cap and
  shape as the existing `faq_search`) — added to `functions/api/track.js`'s
  `EVENT_TYPES` set and `ACCESS-MODEL.md` §6's dated addendum, same
  convention Phase 9 used for its own four additions.

  **One narrow contextual "?" hint, deliberately not sprinkled everywhere:**
  next to the entitlement picker's "Who has access" label (the concrete
  example the request gave) — calls `DTSHelp.requestTopic("admin","access")`
  then `select("help")`, landing directly on the Access topic rather than the
  screen's default first topic.

  **Floating icon placement is a calculated claim, not a guessed one, but
  still needs a real look:** `position:fixed; left:14px; bottom:calc(var(--dock-h) + 14px)`
  — clears the dockbar using its own real CSS variable (confirmed via
  `css/01-base.css`) rather than guessing a pixel offset against the
  dockbar's actual internal content (`.qbar` plus a `.sector-pager`, both
  confirmed present via `css/08-responsive.css` before assuming the dockbar
  was just the question bar), and sits opposite the bottom-right `.cookie`
  card so neither can structurally overlap the other. Hidden outright via
  `body.twin-active`/`body.portal-open`/`body.adm-lock` while any full-screen
  context is open.

  **NOT verified live at all this session — flagged plainly, not glossed
  over:** the Chrome browser automation tool was unavailable (extension not
  connected), so unlike every other phase's testing doc, nothing in
  `docs/migration/HELP-DOCS-TESTING.md` has been spot-checked by the agent,
  not even once. What *was* confirmed: `node --check` clean on all four new/
  edited JS files, and a local `python3 -m http.server 8000` run confirming
  `js/help.js`/`js/help-content.js`/`css/16-help.css` all serve `200` and
  `index.html` still does after the edits. The floating icon's real on-screen
  position, the PDF export's actual output, both diagrams actually rendering,
  and every interactive behavior (search, deep links, the `?` shortcut, the
  contextual hint, the first-visit hint's persistence) are all still
  first-hand unverified.

  **Redeployed following `docs/migration/DEPLOY-STAGING.md` exactly**
  (staging directory built fresh in the scratchpad via Git Bash `cp -r`,
  never `robocopy` — confirmed this handles the double-bracket
  `functions/data/[[path]].js` catch-all with no manual copy step needed,
  unlike prior phases' robocopy workaround). `functions/`/`css/`/`js/`
  file lists diffed byte-identical against source before deploying;
  `.build/js/config.js` (unchanged this session, project/GIS content
  untouched) overlaid onto staged `js/config.js` as required; every
  excluded path confirmed genuinely absent from staging before deploying,
  not assumed. Deployed:
  `https://f3329d93.dts-website-4cu.pages.dev` (stable alias
  `https://dts-website-4cu.pages.dev`, propagates shortly). Post-deploy
  byte-count check against the real deployed site: `/` and every excluded
  path (`.env`, `scripts/seed-dev.mjs`, `docs/migration/PROGRESS.md`,
  `tools/gis-harvest.mjs`, `CLAUDE.md`) all return exactly the same
  62,275-byte SPA fallback; `/data/manifest.json` returns a genuinely
  different, real size (5,043 bytes) — no regression. The three new help
  files (`js/help.js`, `js/help-content.js`, `css/16-help.css`) each serve
  their own real, distinct byte count, not the fallback — confirms the
  deploy actually shipped them, not just that the deploy succeeded.

  **Still not done: a live human pass.** The deploy is verified at the
  file/byte level only, the same level of confidence as every check this
  session — nothing about how this feature actually looks or behaves in a
  browser has been confirmed. `docs/migration/HELP-DOCS-TESTING.md`'s 21
  items are all still unchecked; needs the user to run through them
  against the URL above before this can be called done.

- 2026-08-09 — **Phase 9 is DONE — dev build complete.** Analytics events,
  the client dashboard tile, the admin audit view, and marketing tags (with
  a real pre-existing gap fixed along the way — the cookie consent banner).

  **Three real product decisions made with the user before writing code,**
  not assumed: (1) GA4 + Microsoft Clarity, both free, no permanent
  Plausible-style paid tier needed — chosen after clarifying Clarity alone
  gives session recordings/heatmaps but no traffic numbers, so it needed a
  pairing; (2) both IDs shipped as placeholder-empty in `js/analytics-init.js`
  since the user won't have the client's real GA4/Clarity accounts until
  Handoff — deliberately built so nothing blocks on that, same pattern as
  the OAuth/SMTP deferrals; (3) wire all 15 event types now (the 11 in
  `ACCESS-MODEL.md` §6 plus 4 proposed and approved this session:
  `lead_submit`/`lead_fallback`, `sector_view`, `faq_search`), not just the
  7 the phase brief's task 2 named explicitly.

  **A real, pre-existing gap found and fixed, not in the brief:**
  `#cookieAccept`/`#cookieReject` were functionally identical — both just
  hid the banner, no choice was ever stored or read anywhere
  (`js/app.js`, confirmed by grep before assuming). Wiring in real GA4/
  Clarity on top of a consent banner that didn't actually gate anything
  would have made "Reject" a lie. Fixed: `dtsCookieConsent` in
  `localStorage` (a new key, doesn't touch the two protected keys in
  `CLAUDE.md`'s do-not-break list), GA4/Clarity only ever load after a real
  Accept. First-party `/api/track` events are deliberately NOT gated by
  this banner — they're DTS's own product analytics, not third-party
  tracking, same category as the Supabase auth session itself.

  **`functions/api/track.js`** (new): inserts into `events`
  (`ACCESS-MODEL.md` §6). Validates `type` against the full 15-value
  vocabulary application-side (`events.type` has no DB check constraint).
  Stamps `user_id` from the verified JWT and rejects outright — not
  silently drops — any request that tries to supply its own `user_id`/
  `org_id`. **`org_id` resolution is a real judgment call, stated plainly
  rather than glossed over:** this app has no org-switcher, so "the org
  active in the session" only has an honest answer when the caller belongs
  to exactly one active org; zero or more than one both resolve to `null`
  rather than guess. Exported `activeOrgIdsFor()` from
  `functions/_lib/access.js` (previously module-private) to reuse the exact
  same active-membership logic `checkAccess()` already relies on, rather
  than reimplementing it.

  **15 call sites wired in `js/app.js`** via a new `track()`/`getAnonId()`
  helper (fire-and-forget, never awaited, wrapped so a failed/slow
  `/api/track` call can never block or visibly affect the feature it's
  observing): `login_gate` (`handleResolveFailure`, both the signin and
  denied branches), `experience_open`/`experience_close` (`mountTreedis`/
  `mountVideo` open; `suspendExperience` for a tab switch and
  `closeExampleNow` for the whole window close), `map_open` (`mountGis`,
  keyed to the real `gismap.<mapId>` resource_key, not the experience
  pointer), `project_view` (`openExample`), `experience_preview`
  (`showLockedPlaceholder`), `login`/`register` (`finishSignIn`, now takes
  an `opts.event` so the shared tail can tell a real login from a
  confirmation-disabled signup's immediate session; the check-your-email
  branch fires `register` directly since it never reaches `finishSignIn`
  at all), `download_view`/`download_start`/`download_complete`
  (`showPortalView`'s apps branch / `downloadApp`'s fetch start / its
  success tail), `lead_submit`/`lead_fallback` (the existing sent/fallback
  branch after `sendLead()`), `sector_view` (`openCategory`), `faq_search`
  (`answerQuestion`, `{query, matched}`, query capped at 200 chars
  defensively).

  **A real naming collision caught before it could ship a runtime bug:**
  `openCategory()` already had a local `const track = $("#catTrack")` (a
  DOM element) that would have shadowed the new global `track()` function
  for that entire function body and thrown a TDZ `ReferenceError` the
  moment `track("sector_view", ...)` was added — caught by grepping for
  `\btrack\b` across the whole file before assuming the name was free, not
  discovered by running it. Renamed the local to `catTrackEl`.

  **Tour-bridge instrumentation, observing only, per the do-not-alter
  contract:** `js/tour-bridge.js`'s `TourBridge.initialize()` exists in
  exactly ONE place in the whole codebase — the single shared homepage
  iframe (`startTreedis()`) — confirmed by grep before assuming
  `mountTreedis()`'s per-project Treedis panes also used it; they don't,
  they just set `iframe.src` directly. So this phase's tour-bridge
  instrumentation only ever applies to the homepage "Try a Digital Twin"
  reveal: its existing `onReady` callback now also fires `experience_open`
  with `metadata:{source:"homepage_demo"}`. `onPoseChanged` stays
  console-only, deliberately — no §6 type fits a per-movement signal, and
  firing one on every sweep change would be spam, not analytics. Zero
  changes to `tour-bridge.js` itself, only to the callbacks `app.js` was
  already passing into it.

  **Client dashboard tile** (`js/app.js`, `index.html`, `css/09-mobile.css`):
  new 5th portal nav tab, "Activity," hidden unless the session has ≥1
  active org (`events_select`'s RLS never returns a row for anyone else,
  so there's nothing to show). `renderPortalActivity()` is a direct
  client-side Supabase read of `events` — same "RLS is the real scoping,
  not a client filter" reasoning `renderOrgAdminPanel()` already
  established in Phase 5b — aggregated into a Chart.js bar chart (counts by
  type, last 30 days). Chart.js itself is lazy-loaded on first open
  (`loadChartLib()`, same dynamically-appended-`<script>`-with-memoized-
  promise pattern `loadGisEngine()` already uses for the GIS engine bundle)
  from `cdn.jsdelivr.net`, already whitelisted in `_headers`' CSP for
  supabase-js — no CSP change needed for the chart library itself.

  **Admin audit view** (`functions/api/admin/audit.js`, new;
  `js/admin.js`'s new "Audit" nav entry + `editAuditLog()`): site_admin
  only, read-only, resolves `actor_user_id` → email the same way
  `entitlements.js` already resolves subject labels (GoTrue Admin API
  batch fetch, `auth.users` isn't reachable via PostgREST) — a Function,
  not a direct client read, matching every OTHER Admin Board list screen's
  established pattern (Organizations/Users/Entitlements), not a new one.

  **Marketing tags**: new `js/analytics-init.js` (placeholder
  `ga4MeasurementId`/`clarityProjectId`, both `""` today — `loadGA4()`/
  `loadClarity()` are no-ops until a real id is set, so this deploys and
  works today with nothing pending on the client's accounts existing).
  Loaded at the very end of `index.html`'s script list, after Turnstile,
  never reordering anything above it. `_headers` CSP: added
  `googletagmanager.com` + `clarity.ms` to `script-src`; `connect-src`
  already allowed any `https:` origin, so no change needed there.
  `ACCESS-MODEL.md` §6 gets a dated addendum for the 4 new event types
  (same convention as §10's self-registration addendum).
  `docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md` (new §8 + Quick checklist
  row 11) and `.claude/commands/migrate-handoff.md` (new inventory row 12)
  both updated so this doesn't get forgotten at Handoff, same as every
  other deferred-credential item.

  **Verified two ways, both real, neither hypothetical:**
  1. **Adversarial RLS, directly against the real dev Supabase project**
     (a throwaway scripted harness using the established `generateLink`+
     `verifyOtp` mint-session pattern, deleted after use, zero rows left
     behind): `testadmin` (site_admin) sees every marker row across both
     orgs; `testorgadmin` (Acme + Beta) sees exactly those two orgs' rows;
     **`testmember` (Beta only) sees ONLY Beta's row, never Acme's** — the
     core adversarial property the phase brief's task 4 asked for,
     confirmed server-side, not by reading the policy SQL and assuming;
     `testuser` (no org) sees zero rows, including the anon/guest one;
     `testadmin` can read `admin_audit`, `testmember` cannot (RLS filters
     to zero rows); and confirmed `admin_audit` has no client insert path
     at all — even `testadmin`'s own authenticated client session gets
     rejected trying to insert directly, proving the service-role-only
     write path is real, not just documented. 8/8 passed.
  2. **Live against the real deployed site**, after a from-scratch,
     explicitly-diffed deploy-staging rebuild (see below):
     `/api/track` — a guest event lands with genuinely null `user_id`/
     `org_id`; an invalid `type` 400s; a request that tries to supply its
     own `user_id` OR `org_id` 400s (not silently dropped); `testmember`
     (exactly 1 active org) gets `org_id` correctly stamped to Beta's real
     id; `testorgadmin` (2 active orgs) gets `org_id` correctly stamped
     `null` rather than a guess — confirmed by querying the actual inserted
     rows via service role, not trusting the 201 response alone.
     `/api/admin/audit` — no auth 401s, a non-admin 403s, `testadmin` gets
     a real entries list with resolved actor emails, not raw UUIDs. 15/15
     passed, all throwaway rows cleaned up after.

  **Deploy-staging rebuilt from scratch and shown to the user before
  running anything**, given `wrangler.toml`'s `pages_build_output_dir = "."`
  didn't match the separate-staging-directory approach every prior
  session's prose described, and three real staging bugs had already been
  found in this exact step across Phases 6/8. Built in the scratchpad
  directory (never inside the repo), every included folder diffed file-
  for-file against the source (`functions/` — all 22 files including the
  double-bracket `functions/data/[[path]].js` catch-all — matched exactly),
  every excluded path (`data/`, `scripts/`, `supabase/`, `docs/`,
  `node_modules/`, `.env`, `package.json`, `README*.md`, `CLAUDE.md`, the
  `.docx`, the 2 oversized Backrooms `.usdz` files) confirmed genuinely
  absent before deploying, not assumed. **One opportunistic fix, flagged as
  a known gap in Phase 8's own entry and never acted on until now:**
  `tools/gis-harvest.mjs` had been shipping live this whole migration —
  added `tools/` to the exclusion list this session; confirmed post-deploy
  it now returns the SPA-fallback byte count, not the real file. Also
  reconfirmed no regression: homepage loads at its real byte count,
  `/data/manifest.json` still serves the real (different-sized) public
  manifest through the R2-backed Function, and `/.env`/`/scripts/...`/
  `/docs/migration/...` all correctly return the fallback byte count, not a
  real leaked file. Deployed: `https://40291069.dts-website-4cu.pages.dev`
  (stable alias `https://dts-website-4cu.pages.dev`, propagates shortly).

  **NOT yet verified — needs the user, per this project's manual-testing
  convention:** everything in the new `docs/migration/PHASE9-TESTING.md` —
  the consent banner's actual click-through, the Activity tab's chart
  actually rendering in a browser, the Audit screen's real list rendering,
  and a final full README regression pass. Nothing in it marked passed on
  their behalf.

  **Known limitation, documented not fixed:** `/api/track` has no rate
  limiting of its own (unlike `invite.js`'s `admin_audit`-ledger-based
  limiter) — it's a public, unauthenticated-allowed write endpoint. Not
  addressed this phase since it wasn't in the brief and adding one wasn't
  asked for; worth a real fix before real production traffic if abuse ever
  becomes a concern, same "documented not fixed" treatment Phase 8 gave its
  own known limitations.

  Dev build (Phases 0-9) is now complete. Next: `/migrate-handoff`, only
  when actually going live with the real client.

- 2026-08-09 — **Admin Board delete-option audit, requested by the user
  independent of any phase file** ("go through the CMS and add a remove
  option to anything that would benefit from it... organizations, users,
  maps, and others"). Surveyed the whole board first (an Explore agent
  inventory) before changing anything, since the honest answer turned out to
  be mixed: projects, GIS maps, GIS tours, GIS feature tours, and every
  array-based sub-list (experiences/links/gallery/FAQ/fun facts/sector
  cards) already had real delete, not just disable — nothing to add there.
  Three genuine gaps found and fixed:

  1. **Organizations** — real `DELETE /api/admin/organizations/:id` added.
     Checked the actual FK constraints before writing anything (not
     assumed): `organization_members.org_id` cascades automatically, but
     `admin_audit.org_id`, `events.org_id`, and `resource_entitlements.
     subject_id` (polymorphic, deliberately not a real FK per
     ACCESS-MODEL.md §2) do not — a raw delete would either FK-violate on
     any org with audit history, or silently orphan its entitlement grants.
     Fixed by nulling the audit/event columns (history rows survive, just
     lose the live link) and explicitly deleting org-held entitlements
     before the org row itself. New audit verb `organization.delete`
     (additive, same reasoning as `organization.create`/`update`).
  2. **Users** — real `DELETE /api/admin/users/:id` added via the GoTrue
     Admin API (never a raw Postgres delete on `auth.users`, matching how
     creation already works). Same FK situation as orgs
     (`resource_entitlements.granted_by`, `admin_audit.actor_user_id`,
     `events.user_id`, all nullable/no-cascade — nulled before delete).
     Two safety rails added that Disable never needed: a site_admin can't
     delete their OWN account (blocks a mid-session self-lockout), and the
     LAST remaining site_admin can't be deleted by anyone (would lock
     everyone out of the board). New audit verb `user.delete`.
  3. **Sectors (category pages)** — the one whole-document type with NO
     add or delete at all (a fixed set until now). Added `addSector()`/
     `deleteSector()` mirroring `addProject()`/`deleteProject()` exactly.
     Delete is blocked outright (not cascaded) while any project still has
     that `sectorId` — traced the real consumer first: `content-loader.js`
     maps it into `cfg.examples[id].sector`, which `js/app.js`'s sector-view
     rendering looks up directly (`cfg.categories.find(c => c.id ===
     ex.sector)`) — a project left pointing at a deleted sector would
     silently break that lookup on the LIVE site, not just look odd in the
     admin nav, so this is deliberately never auto-cascaded the way a GIS
     map's tours are. The admin is pointed at each project's own existing
     Category dropdown to reassign first.

  **Verified live against the real deployed site**
  (https://1d8b2ad5.dts-website-4cu.pages.dev) via another throwaway
  scripted harness, deleted after use, touching only throwaway accounts —
  never `testadmin`/`testuser`/`testorgadmin`/`testmember` themselves, and
  confirmed no lingering rows afterward: deleting a throwaway org
  cascade-removed a real membership automatically and left zero dangling
  entitlement rows; deleting a throwaway user (after promoting it to
  site_admin) correctly blocked when it tried to delete ITSELF, a different
  real site_admin (`testadmin`) could still delete it successfully, and
  `testadmin` attempting to delete their OWN account was also correctly
  blocked. **One limitation, stated plainly rather than glossed over:** the
  "can't delete the LAST remaining site_admin" guard's count check is
  correct by code reading, and its happy path (deleting one of several
  site_admins) is live-verified, but actually triggering the block would
  require reducing the shared dev project to a single site_admin first —
  not something worth risking against the real dev environment just to
  exercise a straightforward count comparison. Sectors add/delete is
  client-side draft-only logic (recoverable via Discard Draft even if
  wrong) — verified by `node --check` and tracing the real consumer, not
  live-clicked.

  **NOT yet verified — needs the user, in a browser:** the new Delete
  buttons on Organizations/Users actually clicking through as expected, and
  Sectors' new "+ Add category page" / "Delete this category page" — same
  "not marked passed on their behalf" convention as every other phase.

- 2026-08-09 — **Real Phase 8 gap found by the user's own manual testing pass,
  fixed same session.** Ran the full `docs/migration/PHASE8-BUILDS-TESTING.md`
  checklist against the live deploy: 12 of 13 passed. Test 8 failed — there
  was no way to delete a registered build at all, only disable it (the
  screen deliberately mirrored Organizations/Users' "disable, never delete"
  convention, which doesn't actually fit here: a mis-registered or throwaway
  build has no membership/audit history worth permanently preserving the way
  an organization or user account does). Test 4's comment separately flagged
  the same gap for just the uploaded FILE (no way to remove one without
  deleting the whole build).

  **Fixed:** `functions/api/admin/apps/[key].js` gained `onRequestDelete`
  (site_admin — deletes the `client_apps` row, the R2 object at its
  `r2_object_key` if one exists, and any `download.<key>`
  `resource_entitlements` rows, since that column is plain text, not a
  foreign key, and would otherwise orphan silently) and a `removeFile: true`
  branch on the existing `PATCH` (clears just the R2 object + `r2_object_key`,
  keeps the build registered). New audit verb `client_app.delete`, additive
  to §7 same as `client_app.create`/`update`. `js/admin.js`'s `editBuilds()`
  gained a "Delete" button (confirm-gated, explicit copy pointing back to
  Disable for anything that might be needed again) and a "Remove file" button
  shown only when a file is actually uploaded.

  **Verified live against the real deployed site**
  (https://101ac885.dts-website-4cu.pages.dev) via another throwaway scripted
  harness, deleted after use: a non-admin gets 403 on delete; `removeFile`
  clears the file while the build stays listed and `/api/download` correctly
  404s "no build uploaded yet" (not a stale/broken reference); a full delete
  removes the build from the list entirely and `/api/download` then 404s
  "not found"; the still-live `dummy-viewer-win`/entitlement rows from the
  original seed were untouched throughout (this only ever exercised a
  separate throwaway key). Re-deployed the same careful way as the original
  Phase 8 deploy (fresh `robocopy`, the double-bracket catch-all route copied
  manually since robocopy still can't handle that literal filename, `docs/
  migration`+`docs/plans` removed from staging afterward) — full staging diff
  re-confirmed before deploying, not assumed clean from having done it once
  already this session.

  **Not re-verified in the browser after this fix** — the delete/remove-file
  behavior is proven at the same API level as the rest of Phase 8's own
  verification, but the Admin Board buttons' actual click-through hasn't been
  re-confirmed live. Worth a quick manual spot-check whenever convenient, not
  blocking.

  Next: `/migrate-phase9`.

- 2026-08-09 — **Phase 8 is DONE — builds are gated the same way as any other
  resource, per the phase's own core design principle.** A download is
  `download.<client_apps.key>`, resolved through the exact same
  `checkAccess()` `/api/resource/[key].js` already uses — no parallel gating
  system, confirmed live end to end, not just by reading the code.

  **Three things the phase brief assumed but the schema/infra didn't actually
  have yet, each flagged to the user and resolved before writing code, not
  discovered mid-build:**
  1. `client_apps` had no `access` column at all — Phase 3's schema only ever
     gave it `enabled`. The brief's own step 5 (a hypothetical future public
     installer) requires a real per-app level. Additive migration
     (`20260809120000_client_apps_access.sql`): `access text not null default
     'restricted'`, same 4-value check constraint as everywhere else.
     Applied and verified by direct query — the existing dummy row correctly
     defaulted to `restricted`.
  2. The brief asked for a presigned R2 URL; this project has no R2 S3-API
     credentials set up anywhere. Streamed the file through
     `/api/download/[key].js` instead, same pattern the GIS layer proxy
     already uses for `DTS_CONTENT` — no new secrets, and re-checking the
     real entitlement on every request is tighter than a presigned URL's TTL
     window anyway (a revoked entitlement takes effect on the very next
     request). User approved this substitution as part of the plan, not
     after the fact.
  3. Folded download tiles into the portal's existing "All Apps" view rather
     than a new nav section — smaller footprint, and `client_apps` already
     implies "another kind of app" in this system's own naming.

  **`wrangler.toml`**: added the `DTS_BUILDS` R2 binding (the bucket itself
  has existed, empty, since Phase 1 — never bound to anything until now).

  **New Functions**: `functions/api/download/[key].js` (`params.key` is the
  bare `client_apps.key`, never the dotted `download.<key>` form — same
  bare-param convention `resource/gismap/[mapId]/layer/[layerId].js` already
  uses — builds the dotted resource_key internally only for the
  `checkAccess()`/entitlement lookup); `functions/api/admin/apps.js` +
  `apps/[key].js` (site_admin, list/create/update metadata — new additive
  audit verbs `client_app.create`/`client_app.update`, same reasoning
  Phase 5b used for `organization.create`/`user.create`) and
  `apps/upload.js` (site_admin, streams the raw request body straight into
  `DTS_BUILDS.put()`, no buffering). `entitlements.js` now logs the spec's
  already-reserved `download.assign` verb specifically when the resource_key
  it's granting starts with `download.` — the one place that can tell the
  difference, since it's the single shared endpoint every resource type's
  entitlement picker calls. Revoke has no symmetric verb in the spec, so it
  stays `entitlement.revoke` for every resource type including downloads.

  **`js/admin.js`**: new "Builds" nav item under ADMIN, `editBuilds()` — list,
  create, edit (name/version/access), enable/disable, and a real file-upload
  input per app, reusing the existing `entitlementPicker()` component
  unchanged whenever an app's resolved level is `restricted`. `editAccessIndex()`
  (the read-only cross-system Access view) now also fetches `/api/admin/apps`
  and lists `download.<key>` rows alongside the `/data`-sourced ones, with the
  same live picker — the phase brief's step 3 ask, confirmed working, not
  assumed from the component being generic.

  **`js/app.js`**: `computeAccessibleDownloads()` — a direct client-side read
  of `client_apps` (RLS already scopes `client_apps_select` to
  `enabled=true` for any signed-in session, the same "direct read, RLS
  already does the real scoping" pattern `renderOrgAdminPanel()` established
  for `resource_entitlements` in Phase 5b) — merged into the portal's "All
  Apps" list and its count. Deliberately does NOT predict access level
  client-side; every download card's click always calls the real
  `/api/download/<key>`, exactly the same "never trust a client-computed
  decision" discipline the experience resolver already follows. New
  `downloadApp()`: authenticated `fetch` → `blob()` → an object-URL `<a
  download>` click (a plain navigation can't carry the Authorization header
  the endpoint requires).

  **A real, pre-existing bug found and fixed along the way, unrelated to
  Phase 8's own design but blocking it:** `scripts/seed-dev.mjs`'s
  `ensureUser()` re-run check (`/already registered|already exists/i`) never
  actually matched GoTrue's real error text, "...has already been
  registered" (the word "been" breaks the contiguous-substring match) — every
  re-run of this script has apparently hard-failed on the very first already-
  existing account instead of reaching its own documented idempotent lookup
  path. Widened to `/already (been )?registered|already exists/i`. Confirmed
  fixed by actually re-running the script clean against the real dev project.

  **Seed extension**: added `download.dummy-viewer-win -> org:acme-hotels`
  (`ensureClientApp` now also sets `access:"restricted"` explicitly) so the
  two entitlement paths are each proven by a DIFFERENT account rather than
  one account that happens to satisfy both — `testuser` still proves the
  direct-user path (from Phase 3's original seed), `testorgadmin` (member of
  acme-hotels, no entitlement of their own) now proves the org path, and
  `testmember` (beta-municipal only) stays the 403 case. Verified both rows
  exist by direct query after the re-run, not just the script's own "Seed
  complete." A tiny real placeholder `dummy.zip` (201 bytes) was uploaded to
  `dts-builds` at the exact seeded `r2_object_key`, round-tripped (uploaded
  then downloaded back) to confirm it genuinely landed before any Function
  ever tried to read it.

  **A real deploy-composition bug caught before shipping, not after:**
  rebuilding the deploy staging directory (`robocopy`, same exclusion list as
  every prior phase's deploy, confirmed against what's ACTUALLY live today
  via curl rather than trusted from memory of an old session entry) silently
  dropped `functions/data/[[path]].js` — the double-bracket catch-all route
  that serves ALL of `/data/*` from R2. Robocopy's own pattern engine chokes
  on literal double square brackets in a filename (single-bracket dynamic
  routes like `[key].js` copied fine — confirmed by diffing the full file
  list between source and staging, not by trusting a PowerShell `Test-Path`
  check, which itself gave false negatives for `[key].js` paths since
  PowerShell treats `[...]` as a wildcard character class). Had this shipped
  undetected, every `/data/*` request would have fallen through to
  Cloudflare's generic 200 SPA fallback — the same failure MODE as the real
  Phase 6 incident (silent wholesale fallback to `config.js` for every
  visitor), just from a different cause. Fixed by copying that one file
  manually (`Copy-Item -LiteralPath`) before deploying, and separately caught
  (same pre-deploy check) that `robocopy /XD "docs\migration" "docs\plans"`
  hadn't actually excluded either directory — removed them from staging
  directly before deploying. Deployed only after a full re-diff confirmed
  every excluded path was genuinely absent and every required path
  (including the fixed catch-all route) was genuinely present.

  **Verified live against the real deployed site**
  (https://984686cf.dts-website-4cu.pages.dev), via a throwaway scripted
  harness (Admin API `generate_link`+`verify`, no passwords needed, deleted
  after use — same pattern as Phase 5b/6's own scripted checks): every case
  in the table row above passed, plus a full create→upload→download round
  trip on a throwaway `public`-level app confirmed the uploaded bytes come
  back byte-identical with no token at all (the brief's step 5 case). No
  regression in the existing public-data-loading or secret-path-exclusion
  behavior (checked the same way prior phases did: real file sizes vs. the
  SPA-fallback byte count). All throwaway test rows/R2 objects deleted
  afterward; the two real, permanent seed entitlements remain.

  **NOT yet verified — needs the user, per this project's manual-testing
  convention (nothing below has been marked passed on their behalf):** the
  Admin Board's new Builds screen (create a build, edit its fields, toggle
  enable/disable, upload a real file via the browser's file picker, grant/
  revoke via the entitlement picker) and the portal's Download tile (does it
  appear correctly for `testuser`/`testorgadmin`, does clicking it actually
  save a real file, does `testmember` correctly see it 403 with the expected
  message). A manual testing document will be produced for this alongside
  the PROGRESS.md update.

  **Known limitations, documented not fixed (flagged in code comments too):**
  a single streamed upload PUT has practical ceilings (Cloudflare's
  request-body cap on this project's current Free plan, and R2's binding
  potentially buffering an unsized `ReadableStream` in Worker memory) — fine
  for dev/dummy testing, a real multi-GB client installer at handoff may need
  R2's multipart upload API instead. Code-signing for a real distributed
  `.exe` (~$10/mo-equiv cert) is unaddressed here by design — external,
  belongs on the client's own account at/after handoff, per the phase brief.

  **Noticed incidentally, not fixed (unrelated to Phase 8, pre-existing):**
  `tools/gis-harvest.mjs` (the GIS layer-harvesting CLI script) is genuinely
  served as a live static file on the deployed site — unlike `scripts/`,
  `supabase/`, and `docs/migration/`, nothing has ever excluded `tools/` from
  the deploy. No secrets inside it, but it does reveal internal
  implementation comments (references to internal doc paths). Low severity,
  didn't touch it (out of this phase's scope) — worth adding to the deploy
  exclusion list whenever convenient.

  Next: `/migrate-phase9`.

- 2026-08-09 — **Phase 7 architecture simplified, at the user's explicit
  call, after a long real-world debugging chain on the server-side
  design.** The user asked to stop burning time/tokens on the
  Turnstile-verified `/api/lead` proxy and go back to a direct
  client-side Web3Forms call with Turnstile as a lightweight client-only
  gate. Agreed this was the right call — the chain of real bugs below,
  while each individually fixed, kept surfacing because the server-side
  design was solving for a threat (a leaked Web3Forms key) that
  Web3Forms's own product design says isn't actually a threat for this
  specific key.

  **Full debugging chain, in order, each one a real bug independently
  confirmed via live server logs (`wrangler pages deployment tail`), not
  guessed:**
  1. Submit button wasn't gated on Turnstile actually finishing
     verification — a normal-speed submit could race ahead of the async
     check and get bounced to mailto. Fixed with a disable-until-token
     gate (this piece is still in the current, simplified design).
  2. **The actual root cause of "still opens my email" after fix #1:**
     `wrangler pages secret put`, when fed a value via PowerShell's `|`
     pipe (`Get-Content ... | npx wrangler pages secret put ...`), was
     silently prepending a UTF-8 byte-order-mark to the stored secret.
     Confirmed by reading the raw Cloudflare Worker log output live: the
     Web3Forms API's own rejection (`"Invalid form_id/access_key format.
     Must be a valid UUID."`) showed the literal corrupted value,
     `"﻿81e0fad6-..."` where `﻿` is the BOM character. This
     affected BOTH `WEB3FORMS_ACCESS_KEY` and `TURNSTILE_SECRET_KEY`
     (both were originally pushed via the same piped pattern). Traced the
     corruption to PowerShell's pipe-to-external-process text encoding
     (not `$OutputEncoding`, which didn't fix it when set explicitly; not
     the source file, which was verified byte-clean via
     `[System.IO.File]::ReadAllBytes` before every push attempt). The
     reliable fix that actually worked: `wrangler pages secret bulk
     <file>` reading a JSON file directly (wrangler does its own file
     read, no PowerShell pipe involved) — both secrets rotated again
     using this method and confirmed clean.
  3. Immediately after fix #2, a NEW real error appeared: Web3Forms
     returned `429 Rate limit exceeded. IP temporarily blocked.` The user
     initially (reasonably) doubted this was real since they hadn't
     manually pressed "Send" in their email client — clarified that
     clicking Submit on the site itself makes a real server-side call
     to Web3Forms immediately, before the mailto fallback ever shows;
     the fallback appearing doesn't mean nothing was attempted. Cross-
     checked the log event's timestamp against the actual conversation
     timing to confirm it really was the user's own test, not a stale/
     unrelated entry, before asserting this explanation. Root cause: the
     cumulative volume of direct diagnostic Web3Forms calls made this
     session (testing key validity) plus the user's real attempts hit
     Web3Forms's own rate limiting.

  **At this point the user asked to stop and simplify rather than keep
  debugging the server-side path**, on the reasonable observation that
  Web3Forms's own dashboard explicitly labels this key "a public key,
  safe to use in client side code" (screenshot-confirmed) — meaning the
  original phase brief's premise (this key needs hiding like a secret)
  doesn't match how Web3Forms actually designed their own product.
  Agreed and reverted:
  - `data/site/lead.json` / `js/config.js`: `accessKey` restored to the
    real value, matching pre-Phase-7 shape exactly.
  - `js/app.js`: `sendLead()` reverted to calling
    `https://api.web3forms.com/submit` directly from the browser with
    `access_key` in the payload; the original `if (!lead.accessKey)
    return false` mailto-gate restored verbatim.
  - **Turnstile itself was kept, deliberately** — it still gates the
    submit button client-side (disabled until a real token exists,
    fix #1 above), which is real friction against unsophisticated
    bots/scripts hitting the form. What was removed is only the
    server-side re-verification round trip (`/api/lead`'s call to
    Cloudflare's `siteverify`), which existed to protect a key that
    doesn't need that protection per Web3Forms's own design.
  - `functions/api/lead.js` deleted. `TURNSTILE_SECRET_KEY` and
    `WEB3FORMS_ACCESS_KEY` Pages secrets deleted (confirmed via
    `wrangler pages secret list`). `.env`/`.env.example` cleaned up to
    match — no env vars needed for the lead form at all now.
  - The Turnstile WIDGET itself (site key `0x4AAAAAAELMgm4dHxFB4W_L`)
    stays registered and in use for `js/turnstile-init.js` — only the
    secret-key/server-verification half was removed, not Turnstile
    entirely.

  **Verified live post-simplification**
  (https://dts-website-4cu.pages.dev, deployed `b4ed6f66...`):
  `data/site/lead.json` and the deployed `js/config.js` both carry the
  real key again; `functions/api/lead.js` no longer routes; the Phase 4
  gated resolver, homepage, and manifest are all unaffected (no
  regression from the earlier phases' work).

  **User confirmed a real lead submit works end-to-end** against the
  simplified path (their first live test of this specific version, since
  every prior attempt was against the since-removed server-side design).
  Phase 7 is genuinely complete, not just deployed. Next: `/migrate-phase8`.

- 2026-08-09 — **Real Phase 7 regression found by the user in live
  testing, fixed same session.** 3 of 4 checklist items passed
  (widget renders, page source clean, widget resets on reopen), but a
  real lead submit opened the user's mail client instead of sending
  directly — a regression from the pre-Phase-7 behavior.

  **Root cause:** `submitLeadForm()`'s submit button was never gated on
  Turnstile actually completing its (async) verification. Clicking Send
  at normal human speed — filling the form takes only a few seconds, and
  Turnstile's own check can take a moment, or in managed mode may need an
  explicit checkbox click the user hadn't made yet — meant
  `turnstileToken` was still `null` when `sendLead()` read it.
  `functions/api/lead.js` correctly rejected the missing token (this part
  was working exactly as designed and already verified the session
  before), and `sendLead()`'s "any failure falls through to mailto" logic
  (also working as designed) faithfully did its job — the bug was never
  giving the user a real chance to succeed in the first place.

  **Fix:** the `#formSubmit` button now starts disabled on every
  `openLeadForm()` call and only re-enables once Turnstile's own
  `callback` actually fires with a real token (`setSubmitReady()`,
  `js/app.js`). Re-disables on `expired-callback`. If Turnstile never
  becomes ready at all (script blocked, bounded ~3s retry exhausted), the
  button re-enables anyway rather than trapping the user — submitting
  then still correctly falls through to mailto, preserving the
  degraded-mode guarantee the fallback exists for. Existing
  `.form-submit:disabled` CSS (`opacity:.6`) already gives this a visible
  state, matching the button's existing "Sending…" disabled look — no new
  CSS needed.

  Redeployed (`1eab93e9...`); confirmed the fix landed on the deployed
  `js/app.js` (both the per-deploy hash URL immediately, and the stable
  alias after its normal short propagation delay — not a second bug,
  matches prior phases' documented behavior). **Not yet re-confirmed by
  the user with a real submit** after this fix.

  **Separately, the user asked whether category/form-navigation not
  changing the URL (`?category=community` stays static across every
  sector, project, and form-type interaction) is a problem for future
  analytics, and whether to fix it now.** Answered: no, don't fix URL
  routing for this — `/migrate-phase9`'s own plan
  (`.claude/commands/migrate-phase9.md`) already covers exactly this
  through `functions/api/track.js` and the `events` table (`ACCESS-MODEL.md`
  §6), an EVENT-based model (`type`/`resource_key`/`project_id`/`metadata`
  per interaction) rather than URL-based tracking — this gives strictly
  better analytics than encoding every UI interaction into the URL would
  (structured, queryable, RLS-scoped per org), without touching the site's
  navigation/history architecture (a real risk surface `CLAUDE.md`'s own
  testing checklist protects: "Browser back/forward through home → sector
  → project → close"). No code changed for this — deferred to Phase 9 as
  already planned, not a new decision.

- 2026-08-08 — **Phase 7 is DONE** — lead delivery moved server-side
  (`functions/api/lead.js`), Cloudflare Turnstile added for bot
  protection, and the exposed Web3Forms key rotated.

  **Turnstile widget creation was fully automated, not a dashboard
  click-through** — `wrangler turnstile widget create` exists (the OAuth
  session already carried `challenge-widgets.write` scope), so the whole
  widget lifecycle (create/get/list/update/delete) ran through scripted
  `wrangler` calls, matching this migration's "Claude runs it" pattern.

  **A real secret-exposure mistake, caught and fixed within the same
  session:** while checking the widget's registered domain,
  `wrangler turnstile widget get --json` was run as an ordinary visible
  command — its output includes both `sitekey` AND `secret`, and the
  secret got printed directly into the conversation. This is exactly the
  class of mistake `AUTOMATION-AND-CREDENTIALS.md`'s "never print secret
  values" rule exists to prevent, broken despite having just built the
  correct discipline for the widget's own creation and for
  `WEB3FORMS_ACCESS_KEY` (both captured/piped without ever surfacing the
  raw value). Treated as a real compromise, not a formality: the widget
  was deleted (`wrangler turnstile widget delete <sitekey> -y`) and a
  fresh one created immediately (new sitekey `0x4AAAAAAEK0mVIJhdBWUYES`,
  new secret pushed to the `TURNSTILE_SECRET_KEY` Pages secret,
  `js/turnstile-init.js` updated, redeployed). **Lesson for future
  phases:** before running ANY CLI command that returns a create/get
  response for a credential-bearing resource, check whether the output
  shape includes the secret half, not just the value you asked for.

  **Web3Forms rotation had a real wrinkle:** the user's Web3Forms
  dashboard shows only one form access key, and it's explicitly labeled
  "This is a public key. You can safely use it in client side code" —
  Web3Forms's own security model doesn't treat this as a secret the way
  the phase brief assumed, and there was no "Allowed Domains" restriction
  option available on the free tier to check. Proceeded anyway: the
  value now in use (`WEB3FORMS_ACCESS_KEY` Pages secret) is different
  from the one that was previously exposed in `data/site/lead.json` and
  git history, so this still closes the actual exposure, and moving it
  server-side behind Turnstile still adds real value regardless of
  Web3Forms's own public-key framing — it stops anyone from bypassing the
  bot-check by hitting Web3Forms directly with a scraped key.

  **`ownerEmail` deliberately NOT changed to a domain address** — per the
  phase brief's step 4, but the user doesn't have a working `dtsxr.com`
  mailbox yet. Stays `robertoenrique2710@hotmail.com`; flagged for
  Handoff, when the client's real domain/mailbox exists. A deliberate
  deviation, not an oversight.

  **`sendLead()`'s gating logic had to genuinely change, not just its
  URL** — the old `if (!lead.accessKey) return false` mailto-trigger no
  longer makes sense once `accessKey` is removed from `/data` entirely
  (it would always be falsy, permanently disabling the Function path).
  Replaced with "always attempt `/api/lead`, any failure (network,
  non-2xx, Turnstile reject) falls through to the existing mailto path" —
  functionally the same dual-path behavior, just gated on the Function's
  real response instead of a client-side key presence check.
  `openMailtoFallback()`/`showFormSuccess()` untouched.

  **Files:** new `functions/api/lead.js` (Turnstile `siteverify` then
  Web3Forms forward, endpoint/shapes confirmed against Cloudflare's own
  docs this session), new `js/turnstile-init.js` (public sitekey, same
  pattern as `js/supabase-init.js`); `index.html` (Turnstile script +
  init file appended to the end of the existing static script list, never
  reordering the five already there; new `#turnstileWidget` container
  inside `#leadForm`); `_headers` (`https://challenges.cloudflare.com`
  added to `script-src` only — `frame-src`/`connect-src` were already
  broad enough); `js/app.js` (`sendLead()` rewrite, new
  `ensureTurnstileRendered()` explicit-render/reset helper wired into
  `openLeadForm()`); `data/site/lead.json` (`accessKey` removed,
  `notes` updated); `js/config.js`'s lead-fallback comment updated
  (was still describing rotation as pending); `.env.example` (new
  `TURNSTILE_SECRET_KEY`/`WEB3FORMS_ACCESS_KEY` placeholders).

  **Verified live against the real deployed site
  (https://dts-website-4cu.pages.dev, stable alias, deploy `698a2a10...`):**
  `POST /api/lead` with no token → `400 missing Turnstile token`; with a
  bogus token → `403 bot check failed` (confirms server-side enforcement
  with the NEW post-rotation secret, not just client-side UI); the exposed
  key confirmed gone from both `data/current/site/lead.json` and the
  deployed `js/config.js` fallback; CSP `script-src` carries the Turnstile
  origin; homepage and manifest unaffected (no Phase 6 regression).

  **NOT yet verified — needs the user, per this project's manual-testing
  convention:** a real browser lead submit delivering to the inbox; the
  Turnstile widget actually rendering (confirms the widget's registered
  domain, `dts-website-4cu.pages.dev`, genuinely covers this deployment —
  not verifiable by curl, since domain matching happens client-side at
  render time); the mailto fallback firing when `/api/lead` is genuinely
  unreachable. Next: `/migrate-phase8`.

- 2026-08-08 — **Critical Phase 6 bug found by the user in real live
  testing (immediately after the Phase 6 entry below first marked it
  done), fixed and re-verified same session.** The user reported the
  stable alias homepage rendering the `config.js` fallback (hexagons
  sourced from HTML, not `/data`) and a wall of console 404s for
  `data/gis/tours/*.json` / `data/gis/featuretours/*.json`, plus
  `testadmin@example.com` unable to reach the Admin Board at all.

  **Root cause:** `js/content-loader.js`'s `loadContent()` (untouched by
  design this whole phase, and correctly so) fetches EVERY file listed in
  `manifest.json` via `Promise.all()` — a single rejected fetch rejects the
  whole load, which `content-loader.js:445`'s `.catch()` turns into the
  `js/config.js` fallback for literally everyone, not just guests. `data/
  current/manifest.json` still listed all 14 `gisTour` + 13
  `gisFeatureTour` documents as fetchable files, but Phase 6's own design
  (correctly) never writes those files to `data/current/` at all when
  their map is gated (`iberia-coastal` is `registered`, not `public`) —
  the manifest was claiming files existed that `data/current/` didn't
  actually have. Every page load 404'd on 27 files and fell back
  wholesale. The Admin Board symptom was the same root cause one layer
  down: `js/admin.js`'s own guard (`if (!window.DTS_CONTENT || ...)
  return;`) disables the whole board the instant `/data` fails to load,
  since the `config.js` fallback never populates `DTS_CONTENT`.

  **Why this got past the phase's own acceptance testing:** every
  acceptance check that session verified individual API paths in
  isolation (curl one file, confirm its status/content) — never an actual
  full end-to-end page load simulating `content-loader.js`'s real
  `Promise.all()` behavior across every manifest-listed file at once. A
  gated GIS tour correctly 404ing was the INTENDED, verified behavior in
  isolation; the fact that its mere presence in the manifest poisoned the
  entire site's data load was never exercised. Lesson for future phases:
  isolated endpoint checks are not a substitute for at least one real
  full-load simulation when a phase changes what a manifest-driven
  `Promise.all()` loader depends on.

  **Fix:** new `filterManifestForPublic(manifest, excludedFiles)` in
  `functions/_lib/split-logic.js` — the public `data/current/manifest.json`
  now excludes any document actually absent from `data/current/` (today:
  a gated map's tours/featureTours); `data/source/manifest.json` stays the
  full, unfiltered list. Applied in both `scripts/split-content.mjs`
  (tracks excluded files while iterating each GIS group) and
  `functions/api/publish.js` (tracks them independent of the diff-based
  "changed" check — the manifest must reflect total current reality, not
  just what this publish's delta touched, so an untouched-but-still-gated
  tour is still correctly excluded).

  **Fixed live immediately, in the right order:** re-ran
  `scripts/upload-content.mjs` first (an R2 content write, not a site
  deploy) to stop the bleeding — verified via a script that downloaded the
  live manifest and fetched every one of its now-34 listed files (down
  from 61), confirming all return 200 against the real stable alias
  `https://dts-website-4cu.pages.dev` before touching any code deploy.
  Then redeployed the code fix (`1e7003a4...`) so future publishes via the
  Admin Board can't reintroduce this. Re-verified post-deploy: manifest
  still correct, a gated project's stripped fields still absent, homepage
  loads, the Phase 4 resolver still works.

  **NOT yet re-confirmed by the user:** an actual browser reload showing
  the real homepage content (not the fallback) and `testadmin` reaching
  the Admin Board — the data-layer fix is proven via direct fetch
  (identical to what `content-loader.js` does), but the user's own
  original report is the one this fix needs to actually resolve; asked
  them to hard-refresh and confirm.

- 2026-08-08 — **Phase 6 is DONE** — `/data` moved into R2 (`data/current/`
  public+stripped, `data/source/` private+full), instant publish via
  `/api/publish`, and the formal public/protected split Phase 4 had to do
  ad hoc.

  **Scope corrections, confirmed against the real repo before planning, not
  assumed from the phase brief:** the manifest actually holds 61 documents
  (not 60) and 17 projects (not 16) — `data/projects/emergency.json` IS
  registered (`git log` confirms it was added in the 2026-08-07 Phase 3
  session, commit `a2453364`); the "Open questions" bullet in this file
  still calling it undecided was stale bookkeeping, not current truth.
  Treated as an ordinary manifest-driven project document (nothing to gate
  — no experiences/media/links).

  **Design:** `functions/_lib/split-logic.js` — one pure, dependency-free
  module (`resolveAccessLevel`, `splitProjectDoc`, `splitGisDocSet`,
  `isLocalGisLayer`) imported by BOTH `scripts/split-content.mjs` (CLI) and
  `functions/api/publish.js` (live), so the two paths can't drift apart the
  way Phase 4's ad hoc `strip-public-data.mjs` was always at risk of vs. a
  hypothetical future Function. `js/config.js`'s strip (the "third leak
  surface" `ACCESS-MODEL.md` flags) is now access-aware — cross-references
  each example's id against the real `data/projects/<id>.json` instead of
  blind-stripping everything, fixing a real pre-existing gap (the 9 public
  Vimeo videos were being incorrectly stripped from the fallback). The
  stripped result goes to a deploy-time-only staging file
  (`.build/js/config.js`) — confirmed BEFORE writing anything that the
  real, committed `js/config.js` still held all 16 real tour URLs, so the
  strip function was written to never touch that file in place.

  **Four real bugs found and fixed, each verified after fixing:**
  1. `js/admin.js`'s existing `fetchHarvestedLayers()` did a plain
     unauthenticated `fetch("data/gis/layers/...")` — a relative URL that
     only worked because those files used to be static assets. Once local
     layer files moved to `data/source/` (reachable only through Phase 4's
     authenticated `/api/resource/gismap/[mapId]/layer/[layerId]` proxy),
     this would have silently broken the zip-export escape hatch for any
     gated map. Fixed to route through that proxy with the caller's own
     Bearer token, same shape (`{url, text}`) preserved for every
     downstream consumer.
  2. The phase's own literal acceptance check (`grep -c spaces.dtsxr.com`
     on `js/config.js` must equal 1) caught a real gap my first pass
     missed: a gated example's `origin` field ("https://spaces.dtsxr.com",
     paired with the stripped `tourUrl`) was left behind. Not
     resource-identifying on its own, but still fails the literal check and
     is never read from the stripped copy at runtime (a gated resolve
     always returns tourUrl+origin together from `/api/resource`) — safe to
     strip alongside `tourUrl`, fixed in both `split-logic.js`'s
     `stripTarget()` and `split-content.mjs`'s separate config.js-specific
     strip (which has its own inline copy of the same field list).
  3. **The big one:** the first version of `/api/publish` wrote every
     document unconditionally (current + source + a per-document snapshot)
     — 150+ R2 operations for 61 documents in one Worker invocation.
     Reproduced live against the real deployed site (not caught by
     `node --check` or local testing): "Too many subrequests by single
     Worker invocation." Confirmed via Cloudflare's own docs that the free
     plan caps at 50 subrequests/invocation (paid: 10,000) — a real
     `WORKFLOW.md` golden-rule-4 "stop and flag" moment, not something to
     silently route around. Presented three free/paid options to the user;
     they chose diff-based publish. Rewrote `/api/publish` around a
     SHA-256 content-hash ledger (`data/source/_hashes.json`, ONE combined
     object): every incoming document is hashed in-memory (free — only R2
     reads/writes/deletes count as subrequests, not `crypto.subtle`), only
     documents whose hash actually changed get written, and the snapshot
     is now ONE combined object per publish instead of one-per-document.
     `scripts/upload-content.mjs` gained `computeAndUploadHashManifest()`
     so a CLI seed populates the SAME ledger the Function reads, using the
     exact same canonical-JSON hashing convention (cross-verified Node's
     `crypto` and Web Crypto's `subtle.digest` produce byte-identical SHA-256
     hex for the same string before trusting this) — without this, the
     first-ever publish after any CLI seed would treat all 61 documents as
     "new" and blow the same limit right back open. Verified live with a
     real minted `testadmin` session (Admin API `generate_link`+`verify`,
     no password needed): a no-op publish correctly wrote only
     `manifest.json` and skipped 66 unchanged documents; a real in-memory
     tagline edit correctly wrote exactly 2 documents (manifest +
     the changed one) and was live and verified via a direct fetch within
     seconds; the mutated test value was immediately republished away with
     the real content afterward, confirmed via a follow-up fetch.
  4. Found while running the rollback drill: `scripts/split-content.mjs`'s
     bottom `main().catch(...)` had no entry-point guard (unlike
     `upload-content.mjs`, which was correctly guarded) — importing
     `splitDataTree` from it (as `rollback-content.mjs` does) ALSO ran a
     full, real `main()` against the live `/data` as an unwanted import-time
     side effect. The first rollback run happened to upload the correct
     content anyway, purely because the importing script's own explicit
     `splitDataTree()` call ran second and overwrote the accidental output
     before the upload step — correct by call-order luck, not by design.
     Fixed with the same `pathToFileURL(process.argv[1])` guard pattern;
     re-ran the rollback drill cleanly afterward (single split run, 0
     failed uploads) rather than trusting the lucky first result.

  **New/changed files:** `functions/_lib/split-logic.js` (new),
  `functions/data/[[path]].js` (new — reads `data/current/<path>` from the
  `DTS_CONTENT` R2 binding only, edge-cached via `caches.default`
  cache-aside so `/api/publish`'s purge step has something to purge),
  `functions/api/publish.js` (new — `requireSiteAdmin()` reused unchanged
  from Phase 5b rather than introducing the phase brief's suggested local
  JWKS verification as a second, inconsistent auth mechanism), `scripts/
  split-content.mjs` (new, supersedes `strip-public-data.mjs`),
  `scripts/upload-content.mjs` (new, supersedes the narrower
  `upload-source-to-r2.mjs`), `scripts/rollback-content.mjs` (new),
  `js/admin.js` ("Publish to site" button + `publishToSite()`, the
  harvested-layers fix — `exportData()`'s zip path itself untouched,
  still the fallback per `WORKFLOW.md` golden rule 7).

  **Deliberate deviations from the phase brief, each with a stated
  reason:** no new Cloudflare API token/secret for cache purging — the
  Workers Cache API (`caches.default`) already covers it from inside the
  Function, at zero extra credential surface. No local JWT/JWKS
  verification in `/api/publish` — reused the exact `requireSiteAdmin()`
  pattern every other admin Function already uses. Snapshots are one
  combined object per publish, not one-per-document — required by the
  subrequest-limit fix, and nothing outside this phase's own rollback
  script reads the old per-file shape.

  **Verified live against the real deployed site
  (https://b829ebc7.dts-website-4cu.pages.dev, stable alias
  https://dts-website-4cu.pages.dev), via curl and real minted sessions —
  not just locally:** `data/current/projects/automotive.json` has no
  `media.tourUrl` and no gated `links[].url` (public vimeo link intact);
  `data/current/projects/civic.json`'s public video `media.embed.value` is
  present unstripped; `data/current/gis/maps/iberia-coastal.json` is the
  3-field public stub only; a gated tour and feature tour both 404; all 6
  local layer geojson files 404; `data/source/` is unreachable through the
  public `/data/*` route (404); `js/config.js`'s only `spaces.dtsxr.com`
  references are the sanctioned public homepage tour (`tourUrl` + its
  paired `origin`), zero elsewhere; the Phase 4 gated resolver
  (`/api/resource/...`) still correctly returns "sign-in required" for a
  guest, unaffected by this phase's routing change since it always read
  `data/source/` directly; homepage loads with the expected byte count.

  **Known limitation, not fixed this phase:** only `/api/publish` (the
  Function path) purges Cloudflare's edge cache on write. The CLI paths
  (`upload-content.mjs`, `rollback-content.mjs`) have no access to
  `caches.default` (a Workers-runtime-only API) and don't purge — a CLI
  seed or rollback could theoretically serve a previously-cached response
  for up to the edge TTL (`s-maxage=300`, 5 minutes) before R2's new
  content is reflected. Not observed in practice this session (every live
  check after a CLI run showed correct, non-stale content), and low-risk
  since CLI runs are infrequent bulk operations, not the everyday publish
  path — worth a real fix (e.g. an explicit purge step using a Cloudflare
  API token) before this matters in production.

  **NOT yet verified — needs the user, per the project's manual-testing
  convention:** the "Publish to site" button's actual click-through in the
  Admin Board UI (API-level POST to `/api/publish` is proven, the button's
  wiring in `admin.js` is proven by `node --check` and code reading, but
  not by an actual click); the full README regression checklist (tour
  reveal, lead form, sign-in, mobile drawer — none of this phase's changes
  should affect them, but unconfirmed live). Next: `/migrate-phase7`.

- 2026-08-08 — **Phase 5b is DONE.** User confirmed Checkpoint C's portal
  panel live: add-existing/invite-new/remove/role-toggle all worked for
  `testorgadmin` at Acme Hotels, `testmember` (plain member, no org_admin
  anywhere) correctly sees no org-admin panel at all, and `testadmin`'s
  Admin Board (Organizations/Users/Access screens from Checkpoint B) is
  unaffected. Combined with Checkpoints A and B's earlier live
  confirmations, every acceptance point in step 9 of the phase file is
  now satisfied: `site_admin` reaches and uses all three new nav
  sections and can edit access levels on a real project; `org_admin`
  sees only the team panel, scoped to their own org; a plain member sees
  no admin surface; the adversarial cross-org test fails closed (proven
  server-side across Checkpoints B and C, 28 combined automated
  assertions); zip export and normal content editing are unchanged. Two
  real bugs found and fixed along the way, both documented above in
  their own checkpoint entries: `checkAccess()` had no `site_admin`
  bypass for `client`/`restricted` resources (found in Phase 5, fixed
  same session), and disabling an organization didn't actually revoke
  `client`-level access until Checkpoint B's fix (`activeOrgIdsFor()`).
  Next: `/migrate-phase6`.

- 2026-08-08 — **Phase 5b Checkpoint C done.** New
  `functions/api/org/invite.js`: creates a brand-new account (dev: the
  inviting org_admin sets a temporary password directly, same reasoning
  as `functions/api/admin/users.js` — no working invite-email delivery
  until custom SMTP) already bound to the org as `member`, distinct from
  `org/members.js`'s POST (existing accounts only). Rate-limited
  server-side (`ACCESS-MODEL.md` §8) using `admin_audit` itself as the
  ledger — 20 `invite.send` rows per actor per rolling hour, no new table
  — and audited as `invite.send`, a distinct action from `user.create`
  since it's simultaneously an account creation and a membership grant.

  **`js/app.js`**: built the org-admin team panel into the existing,
  previously-static `#portalManage` view (`renderOrgAdminPanel()`,
  called from `openPortal()`) — one panel per organization where
  `session.orgs[].orgRole === "org_admin"`, hidden entirely for anyone
  else. Member list, add-existing-by-email, invite-new, remove, and a
  member↔org_admin role toggle, all calling `org/members.js`/`invite.js`.
  The "resources entitled to this org" view is a **direct client-side
  Supabase read**, not a Function call — `resource_entitlements`'s own
  RLS policy already allows "the entitled subject, or a member of the
  entitled org" to `SELECT` it, exactly the scope needed, so a
  server-side re-check would add nothing. New `.portal-orgadmin*` CSS in
  `css/09-mobile.css`, matching the existing dark portal-card styling.
  This is entirely separate from `js/admin.js`'s Admin Board — an
  `org_admin` never sees the CMS, only this portal panel, per Phase 5's
  routing.

  **Verified end-to-end against the real dev Supabase project, calling
  the actual exported `invite.js`, 6 assertions, all pass, no test data
  left behind:** the adversarial cross-org case (`testorgadmin` at Acme
  attempting to invite someone at Beta) 403s; a real invite creates a
  working account (confirmed with an actual password sign-in attempt,
  not just the API response) and an active membership row; inviting an
  already-existing email is rejected (409); and the rate limit itself —
  seeded 20 synthetic `invite.send` rows for the actor, confirmed the
  21st real attempt within the hour gets 429. The core adversarial
  membership-write property (`org/members.js`) was already proven in
  Checkpoint B's own test run, since the endpoint is shared.
  **Redeployed and re-verified against the real deployed site**
  (https://a30b1e22.dts-website-4cu.pages.dev, stable alias
  https://dts-website-4cu.pages.dev) — `/api/org/invite` spot-checked
  through Cloudflare's own routing, passed, cleaned up. **Not yet
  verified: the portal panel UI in a browser** — needs the user's live
  click-through, including confirming a plain `member` (`testmember`)
  sees no org-admin panel at all.

- 2026-08-08 — **Phase 5b Checkpoint B done** (Organizations + Users
  screens, the org_admin membership Function pulled forward from
  Checkpoint C since the Users screen needs it too, and the three
  `site_admin` nav sections — Organizations/Users/Access — all wired at
  once rather than as empty stubs).

  **A real, pre-existing gating bug found and fixed before building
  "disable an organization" — verified live, not assumed:** confirmed with
  a throwaway org that `functions/_lib/access.js`'s `hasActiveOrgMembership()`
  and `hasEntitlement()` only ever checked the MEMBERSHIP row's own
  `status`, never the organization's own `status` — a member of a
  `disabled` org kept full `client`-level access and org-entitlement
  access with zero enforcement, making "disable" purely cosmetic. Fixed
  with `activeOrgIdsFor()`, using PostgREST's `!inner` embed + dot-filter
  syntax to require both the membership AND the organization it points to
  to be active (verified the exact syntax works against real Supabase
  before committing to it as the fix). Re-verified through the real
  exported `checkAccess()` (not a reimplementation): a member of an active
  org gets `client` access, loses it the instant the org is disabled,
  regains it on reactivation — plus the existing `testadmin`/`testuser`
  regression cases still pass unchanged.

  **New Functions** (`site_admin` unless noted): `functions/api/admin/
  organizations.js` (list/create) + `organizations/[id].js` (rename/
  status — "disable" is a status PATCH, never a DELETE; deleting an org
  isn't exposed anywhere, matching the phase file's own verb list of
  "list, create, rename, disable"), `functions/api/admin/users.js` (list
  with resolved `site_role`+memberships, create via the GoTrue Admin API
  with an admin-chosen password per the earlier decision — dev has no
  working invite email) + `users/[id].js` (site_role change, ban/unban for
  disable/reactivate — GoTrue has no permanent-ban sentinel, `876000h`
  ~100 years is the documented pattern), and `functions/api/org/
  members.js` (`org_admin` of the specific org OR `site_admin` — list/add-
  existing-user/change-role/remove). `organization.create`/
  `organization.update`/`user.create` are additive extensions to
  `ACCESS-MODEL.md` §7's action vocabulary, which never enumerated an
  action for the organization/user row itself (only membership/role/
  entitlement changes within one) — a gap found while building these,
  not a disagreement with the spec.

  **`js/admin.js`**: `editOrganizations()`, `editUsers()`, and
  `editAccessIndex()` (a read-only enumeration of every `resource_key` in
  the system, computed client-side from `window.DTS_CONTENT.docs` the same
  way `strip-public-data.mjs` does — no new Function needed for the
  listing itself, only for a Restricted row's entitlement picker, reusing
  Checkpoint A's component unchanged) plus their "ADMIN" nav section. No
  extra `site_admin` gating needed in the nav itself — the whole board only
  ever opens for a `site_admin` session per Phase 5's routing.

  **Verified end-to-end against the real dev Supabase project, calling the
  actual exported handlers, 22 assertions, all pass, no test data left
  behind:** org create/list/rename/disable and denial for a plain user;
  user create/list, promote/demote `site_role` (checked against the real
  `profiles` row, not just the response), disable/reactivate verified with
  REAL password sign-in attempts before and after (not just checking the
  API response) — a disabled account genuinely can't sign in, a
  reactivated one can again; every `org/members.js` action including the
  **adversarial cross-org boundary** (`testorgadmin`, real `org_admin` at
  Acme and a plain `member` at Beta, can add/promote/remove members at
  Acme but gets 403 attempting the identical actions at Beta by supplying
  Beta's `org_id` directly) — this is the exact security property
  Checkpoint C's own adversarial test asks for, already confirmed here
  since the endpoint is shared; and `admin_audit` rows for every one of
  `organization.create/update`, `user.create`, `site_role.change`,
  `account.disable/reactivate`, `membership.add/remove`, `org_role.change`.
  **Redeployed and re-verified against the real deployed site**
  (https://ac9f971e.dts-website-4cu.pages.dev, stable alias
  https://dts-website-4cu.pages.dev) — spot-checked the two new dynamic
  routes (`organizations/[id].js`, `users/[id].js`) plus `org/members.js`
  through Cloudflare's own routing, all pass, cleaned up. **Not yet
  verified: the admin.js UI in a browser** — needs the user's live
  click-through.

  **User confirmed the Organizations/Users/Access screens live, dev URL** —
  create/rename/disable an org, create/promote/demote/disable a user,
  search-add-to-org, role change, remove, and the Access index all worked.
  **Checkpoint B is fully done.**

- 2026-08-08 — Started `/migrate-phase5b`. Planned as three checkpoints
  (A: nav + access editors + entitlement picker; B: Organizations/Users
  screens + Functions; C: org-admin panel + adversarial test), approved by
  the user before writing code. **Checkpoint A done, committed separately
  from B/C.**

  **Two real findings during planning, before any code was written:**
  1. `admin_audit` has NO client insert policy at all (only the service
     role can write it, confirmed reading
     `supabase/migrations/20260807220100_rls_policies.sql`) — since every
     mutation this phase adds needs an audit row, this forces ALL of it
     (not just the ones the phase file explicitly called "Function") through
     Cloudflare Functions using the service role, even the org_admin
     membership writes RLS's own `is_org_admin(org_id)` policy would
     otherwise allow directly from the client. A two-step "client writes,
     then separately calls an audit-log endpoint" design was rejected
     because a skipped or failed second call would leave the mutation
     unaudited — the audit trail has to be structurally inescapable, not
     client-optional.
  2. The phase file's step 7 assumes Phase 5 already added a "Manage your
     team" portal entry point for org_admin. It didn't — checked
     `index.html` directly: `#portalManage` is still the static placeholder
     ("Twin management tools are handled with your DTS project lead...")
     from before this migration. Checkpoint C will build the org-admin panel
     into this existing view rather than inventing a new one.

  **Checkpoint A — shared backend + entitlement editor:**
  `functions/_lib/access.js`: exported `pgrst`/`isSiteAdmin` (previously
  module-private) and extended `pgrst()` to support POST/PATCH/DELETE with
  a body (previously GET-only), backward compatible with every existing
  caller. New `functions/_lib/admin.js`: `requireSiteAdmin()`,
  `requireOrgAdminOf()`/`isOrgAdmin()` (built now for Checkpoint C's reuse,
  since they're tiny and the natural extension of `isSiteAdmin()`'s own
  pattern), `writeAudit()` (the one place every mutation's `admin_audit` row
  gets written), and `gotrue()` (the GoTrue Admin API wrapper — `auth.users`
  isn't exposed via PostgREST, only the `public` schema is, so anything
  touching real accounts goes through this instead of `pgrst()`).

  New Functions: `functions/api/admin/entitlements.js` (GET list by
  `resource_key` with resolved org-name/user-email labels, POST grant),
  `functions/api/admin/entitlements/[id].js` (DELETE revoke),
  `functions/api/admin/search.js` (org-name / user-email lookup, backs
  every picker — sanitizes the query term against PostgREST's own filter
  mini-syntax characters `, ( ) *` first, since they'd otherwise let a
  search term reshape the query it's embedded in).

  `js/admin.js`: `accessLevelField()` (a thin wrapper around the existing
  `fSelect()` — deliberately NOT a new field-builder primitive, reuses
  `fSelect`'s own "unset shows the first option, only writes on real
  interaction" behavior so untouched documents' export diff stays
  unchanged) added to the project editor (top-level, no "inherit" — a bare
  `project.<id>` key is never itself gated per `ACCESS-MODEL.md` §4, so this
  field never shows an entitlement picker, only sets the default children
  inherit), each `experiences[]` row (threaded `project` through
  `renderExperienceItem()`, previously not passed), each `links[]` row (using
  `fList`'s already-passed 0-based index for the position-based `link-<n>`
  key — flagged inline in the new field's own hint that removing an earlier
  link shifts every link after it, a pre-existing fragility in how link
  identity works, not something this phase fixes), and the GIS map editor
  (top-level, resourceKey `gismap.<id>`, DOES get a picker — a GIS map is a
  whole-document gate directly checked by the resolver, unlike a project's
  own default). New `entitlementPicker()`: the one editor surface in the
  whole board that talks to a live API instead of `window.DTS_CONTENT.docs`
  and never calls `markDirty()`, since `resource_entitlements` lives in
  Postgres, never `/data` (`ACCESS-MODEL.md` §5).

  **Verified end-to-end against the real dev Supabase project — calling the
  actual exported Function handlers, not reimplementations, with real
  minted sessions** (a new reusable test harness, `mint-session.mjs` — uses
  the Admin API's generate_link + verify redirect dance to get a real
  access token for a seeded test account WITHOUT ever touching or needing
  to know its password, safe to reuse against accounts the user is actively
  testing with themselves): `testadmin` (site_admin) can search orgs/users,
  grant an entitlement to a real org, see it listed with the correct
  resolved label, and revoke it; `testuser` (plain registered) gets 403 on
  every one of those calls; both the grant and the revoke wrote the
  expected `admin_audit` rows with correct `action`/`target_type`/
  `target_id`/`before`/`after`. All 10 assertions passed, no test data left
  behind (the test's own grant was revoked as its last step). **Re-verified
  against the real DEPLOYED site** (https://05fa51de.dts-website-4cu.pages.dev,
  stable alias https://dts-website-4cu.pages.dev) — the local test only
  proved the handler logic was correct, not that Cloudflare Pages' own
  routing (specifically `functions/api/admin/entitlements/[id].js`'s
  dynamic `:id` segment extraction) worked; a separate script hit the real
  deployed URL end to end (search/grant/list/revoke as testadmin, 403 as
  testuser) and all 6 assertions passed, again with no test data left
  behind. **User confirmed the admin.js UI live, dev URL** — project/
  experience/link/GIS-map access dropdowns, the entitlement picker
  (search, grant, list, revoke) on a Restricted row, and Save draft &
  preview all worked. **Checkpoint A is fully done.**

- 2026-08-08 — **Phase 5 is DONE — user ran all 6 local checks, all PASS**
  (site_admin → Admin Board directly; org_admin → ordinary portal, board
  never opens; plain registered user → ordinary portal, no admin
  affordance; Save draft & preview → chip, not board, then discard; zip
  export; real Sign out from inside the board actually ends the Supabase
  session). Committed together with the previously-uncommitted Phase 4
  follow-up work (`9d6af05d`).

  **Also fixed, same session, at the user's request:** the `checkAccess()`
  gap flagged in this entry's own Open questions section (site_admin had no
  bypass for `client`/`restricted` resources at all, not just `restricted`
  as first flagged — corrected after re-reading `ACCESS-MODEL.md` §8's table
  row for `client` resources too). See Open questions below for the fix and
  its live verification. Not yet committed — see next entry once it is.

  **User asked to stop testing via `python3 -m http.server` going forward
  and test only against the dev Cloudflare URL from here on** — acted on the
  same session: rebuilt the deploy staging directory from scratch (fresh
  robocopy, same exclusions as every prior phase's deploy —
  `.git`/`.claude`/`node_modules`/`.wrangler`/`docs/migration`/`scripts`/
  `supabase`/`.env`/`.env.example`/`README-MIGRATION.md`/the two unused
  oversized Backrooms `.usdz` files — confirmed via `Test-Path`, not
  assumed), ran `scripts/strip-public-data.mjs` against it (7 files
  stripped, 34 GIS documents/layers removed entirely), and redeployed:
  https://b693ed64.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev). **Verified live, not just by exit
  code:** `js/app.js`/`js/admin.js` on the deployed site carry the new code
  (`DTS_ACCESS`, `site_admin` routing, zero `adminAccounts` references); and
  — since a Cloudflare Pages 200 can be its SPA-style fallback rather than a
  real file — confirmed `/.env` and `/docs/migration/PROGRESS.md` both
  return exactly `index.html`'s own byte count (56,316), i.e. the fallback,
  not a real leaked file. **Not yet re-run on the dev URL:** the 6-item
  checklist above was run locally, before this deploy — worth a quick
  re-confirm on https://dts-website-4cu.pages.dev now that it's live there,
  though nothing in the diff between local and deployed should change the
  outcome.

- 2026-08-08 — Ran `/migrate-phase5`. Deleted the entire old ADMIN
  AUTHENTICATION block in `js/admin.js` (`adminAccounts`, `registerAdmins`,
  the `access.json`/Google-Sheet admin-account sources, `splitCSV`,
  `isAdminLogin`, and the capture-phase `submit` interceptor) — Supabase
  requires an async round trip before any role is known, so credential-based
  capture-phase interception is structurally impossible now, not just
  replaced by preference.

  **New routing, built on Phase 4's existing `dts:signed-in` event** (which
  already carried `session.siteRole` and `session.orgs[].orgRole` as
  genuinely separate fields — no schema change needed, confirming
  `ACCESS-MODEL.md` §1's axes were already respected end to end):
  `admin.js` listens for `dts:signed-in` and opens the Admin Board only when
  `siteRole === "site_admin"`; every other signed-in user (including
  `org_admin`) is untouched, since `app.js` already routes them to the
  ordinary client portal. `org_admin`'s "Manage your team" affordance stays
  deferred to Phase 5b exactly as planned — nothing in this phase adds it.

  **Two real gaps found by tracing the actual call path before writing any
  code, not assumed from the phase file's literal wording, both flagged for
  approval before implementing:**
  1. `app.js`'s `finishSignIn()`/`restoreSession()` called `openPortal()`
     unconditionally after every sign-in — with no per-role branch, a
     `site_admin` login would have opened BOTH the Admin Board (from
     `admin.js`'s new listener) AND the client portal in the same dispatch,
     since the event fires before that call. Fixed by making `app.js` itself
     skip portal/pending-resource resumption when `siteRole === "site_admin"`
     — their destination is entirely `admin.js`'s to decide. Also fixed
     `openAccess()`, which had the same unconditional-`openPortal()` bug for
     an already-signed-in admin re-opening the sign-in form.
  2. **A real race, reproduced by tracing script load order, not
     hypothetical:** `admin.js` is lazy-loaded via a separate `<script>` tag
     (content-loader.js's `isAdminContext()` — unchanged this phase — loads
     it eagerly whenever a draft exists in localStorage, which Save draft &
     preview's reload always triggers). `restoreSession()`'s `getSession()`
     read resolves from local storage, no network call, so it can easily
     dispatch `dts:signed-in` before a network-loaded `admin.js` has even
     registered its listener. The OLD design never had this problem — its
     chip-on-reload check was fully synchronous. Fixed by exposing
     `window.DTS_ACCESS = access` (same by-reference pattern as
     `window.DTS_CONFIG`/`DTS_CONTENT`) so `admin.js`, once loaded, can
     synchronously check for an already-existing `site_admin` session
     instead of depending on winning the race to register in time.

  **Preserved the Save & Preview UX deliberately, not just structurally:**
  the `dts:signed-in` event now carries a `restored` flag (`false` from a
  real just-now sign-in submit via `finishSignIn()`, `true` from
  `restoreSession()`'s page-load/reload path). `admin.js` opens the board
  directly only when `restored:false`; on `restored:true` it just shows the
  floating chip — otherwise every reload while signed in as `site_admin`
  (including the one Save & Preview itself triggers) would have thrown the
  reader straight back into the editor instead of letting them see the live
  preview, defeating the feature's whole purpose.

  **`dtsAdminSession` dropped entirely** (per this phase's explicit
  instruction — a deliberate, approved deviation from `CLAUDE.md`'s
  do-not-break list, superseded by the real Supabase session now being the
  session). `closeBoard(true)` ("Sign out") now calls the real
  `window.DTS_SUPABASE.auth.signOut()` + a full reload — the same pattern
  `app.js`'s own `signOut()` uses, for the same reason established during
  Phase 4 testing (in-place-mutated experience/GIS caches have no clean
  "undo"; a reload is the only reliable way to guarantee a signed-out
  session can't still reach anything). `dtsAdminDraft` is untouched.

  **A real gap found incidentally while reading the resource resolver for
  this phase, NOT fixed here (out of Phase 5's scope, and Phase 4 is already
  closed/tested) — flagged for whenever it becomes live-relevant:**
  `functions/_lib/access.js`'s `checkAccess()` has no `site_admin` bypass at
  all — a `restricted`-level resource still requires a real
  `resource_entitlements` row for a `site_admin`, contradicting
  `ACCESS-MODEL.md` §8's table ("Open restricted resources entitled to
  them... yes (all)" for `site_admin`). Zero live impact today — nothing in
  `/data` is currently `client` or `restricted` (Phase 3's backfill only
  ever set `public`/`registered`) — but this will matter the moment any
  resource (or a Phase 8 download) becomes `restricted`, since a `site_admin`
  would get a false 403 instead of the site-wide access the spec promises.
  Worth a small, standalone fix (an `is_site_admin` check added to
  `checkAccess()`, mirroring the DB-side function used elsewhere) before
  Phase 8 ships, or whenever the first real `restricted` resource is
  authored.

  **Verified by reading the code and syntax-checking both files
  (`node --check`) — not yet verified live.** Every other claim in this
  entry is a "confirmed by reading the code" claim, not a live one. **Not
  yet deployed** to the Cloudflare dev URL — this phase's instructions
  stop at "test, update PROGRESS.md" and don't call for a redeploy, and
  Supabase auth behaves identically local vs. deployed, so the user can
  test via `python3 -m http.server 8000` per `CLAUDE.md`'s local-dev
  instructions if that's preferred over a redeploy first. **Needs the
  user's live pass**, sign-in as each seeded dummy account
  (`testadmin@example.com` → Admin Board should open directly;
  `testorgadmin@example.com` → ordinary portal, Admin Board must NOT open
  under any path; `testuser@example.com` → ordinary portal, no admin
  affordance anywhere), plus Save draft & preview → discard, and the zip
  export escape hatch, still working unchanged.

- 2026-08-08 — **Phase 4 is DONE.** Both outstanding retests passed:
  cross-tab sign-in sync (verified via a same-tab-vs-other-tab plain login,
  since the original email-based retest hit the same known 2/hour rate
  limit — same code path either way, `onAuthStateChange` doesn't
  distinguish how the other tab's session was established) and sign-out
  actually revoking cached access (confirmed a previously-viewed gated
  experience correctly re-locks after sign-out, without a manual reload).
  Every item in the manual checklist has now passed except forgot-password
  (item 14), which stays blocked on the deferred custom-SMTP setup — an
  account/infrastructure gap already fully documented, not a code issue,
  and not a blocker for calling Phase 4 complete. Next: `/migrate-phase5`.

- 2026-08-08 — **Item 14 (forgot-password) root-caused — confirmed from the
  user's own Supabase dashboard screenshot, not guessed.** Authentication →
  Rate Limits showed "Rate limit for sending emails: 2 emails/h" —
  Supabase's documented built-in-email default, shared project-wide across
  every auth email type (confirmed against Supabase's own docs via
  WebFetch, not assumed from memory). Not a code bug. The user's earlier
  successful signup-confirmation email almost certainly used the hour's
  quota before the password-reset request that failed.
  **Deferred, same as OAuth** — the real fix (custom SMTP via a provider
  like Resend) requires a verified domain, and the user doesn't have DNS
  access to one available right now. Documented for later, and — unlike
  OAuth — flagged as NOT optional at production handoff, since Supabase
  itself documents the built-in service as unsuitable for production and
  this affects password reset regardless of whether self-registration or
  OAuth ship: new `ACCOUNT-SETUP-AND-HANDOFF.md` §7 (dev setup steps once a
  domain is available), a new row 10 in its Quick checklist, a new
  inventory row 11 in `migrate-handoff.md` step 1 marked explicitly
  non-skippable, and an addition to migrate-handoff step 2 / Part 3 step 4
  (production Supabase) requiring it be done during that step, not
  deferred to production the way it was in dev.
  **Known testing constraint until this is fixed:** the whole dev project
  shares 2 auth emails/hour — don't chain signup/reset attempts within the
  same hour and mistake the shared cap for a new bug.

- 2026-08-08 — **User ran the full verification checklist — 23/25 passed,
  2 real bugs found, both fixed.**
  1. **Cross-tab sign-up confirmation never reached the original tab.**
     Reported as: sign up, get the "check your email" note, confirm the
     email in a NEW tab (which correctly signs in there) — but the
     ORIGINAL tab's form just sits there still showing the sign-up fields,
     with no indication anything happened. Root cause: there was no
     `supabase.auth.onAuthStateChange()` listener anywhere in `js/app.js` —
     the only session checks were the one-shot `getSession()` in
     `restoreSession()` (boot only) and the direct calls inside
     `submitAccess()` (that tab's own submit only). Neither could ever
     learn about a session established in a DIFFERENT tab. Fixed: added an
     `onAuthStateChange` listener that calls the existing `finishSignIn()`
     for any `SIGNED_IN` event this tab didn't cause itself — guarded with
     a `localAuthInFlight` flag (set for the duration of `submitAccess()`
     and `restoreSession()`) so the normal same-tab paths never get
     double-handled by both their own direct call AND the listener.
  2. **Signing out didn't actually revoke client-side access until a
     manual reload.** Real security-relevant bug, not cosmetic:
     `resolveExperienceNode()`'s whole design is to skip the network
     entirely once a node already carries its real target (`Object.assign`
     mutates the shared `cfg.examples[...]` node in place on first
     resolve) — `signOut()` cleared `access.session` but never undid any
     of those mutations, nor `access.resolvedGisMaps`/`cfg.gisMaps`, so
     anything resolved earlier in the session stayed reachable client-side
     after logout with zero server round-trip to catch it. There's no
     clean "undo" for those in-place mutations, so the fix is a full
     `window.location.reload()` after `auth.signOut()` completes — the
     only way to guarantee every trace is actually gone. (The same
     `onAuthStateChange` listener now also nulls `access.session` on a
     `SIGNED_OUT` event from elsewhere, e.g. a token revoked in another
     tab — a smaller, complementary fix, though the reload is what
     actually closes the exploit.)
  Both verified via curl that the fix is live (`onAuthStateChange`,
  `localAuthInFlight` present in the deployed `js/app.js`); **not yet
  re-verified live in a browser** — needs the user's re-test.
  **Also**: item 14 (forgot-password) failed — no email arrived. Root
  cause not yet determined; `submitForgotPassword()` was silently
  swallowing the actual Supabase response either way (deliberately, so the
  UI never leaks whether an email has an account) — added
  `console.warn()` logging of the real error so a future failure is at
  least diagnosable instead of just "nothing arrived". Most likely
  candidates, none yet confirmed: the Supabase Redirect URLs allow-list
  item flagged in the self-registration entry below was never confirmed
  done (`resetPasswordForEmail`'s `redirectTo` would be rejected if so);
  Supabase free-tier auth email rate limits (shared bucket with the
  signup-confirmation email that DID arrive successfully); or the email
  landed in spam. Needs the user to check Supabase Dashboard →
  Authentication → Logs and Rate Limits, and their spam folder, since none
  of this is visible from the deployed code alone.
  Redeployed: https://82e97b22.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

- 2026-08-08 — **Google/Microsoft OAuth deferred; handoff docs restructured
  around a credential-inventory gate.** User confirmed they'll set up the
  Google/Microsoft OAuth apps later (still under their own personal accounts
  first, per the self-registration entry below — not the client's, this
  early) and chose to leave the "Continue with Google/Microsoft" buttons
  visible on the live site in the meantime (they'll show a Supabase
  "provider not enabled" error if clicked until the providers are
  configured — known, not a bug).
  Separately, the user asked that gathering ALL client account access
  (Cloudflare, Supabase, OAuth if it's launching, domain/DNS, the real
  client list) become the explicit FIRST step of `/migrate-handoff`, not
  something discovered mid-process. Restructured both handoff documents:
  `.claude/commands/migrate-handoff.md` gained a new step 1 — a 10-row
  credential/access table covering every external account this migration
  now touches, framed as a hard gate ("don't start step 2 until every row
  is either in hand or explicitly deferred") — and every later step
  renumbered (2-8) to make room, including a new step 5 for the
  Google/Microsoft OAuth production setup (skippable, with the deferral
  noted in `PROGRESS.md`, exactly as decided here). `docs/migration/
  ACCOUNT-SETUP-AND-HANDOFF.md`'s Part 1 gained a new §6 (dev-account OAuth
  setup steps, under the user's own accounts) and Part 3's step-by-step
  walkthrough was restructured to lead with the same credential-inventory
  step, with cross-references fixed throughout (step numbers had shifted).
  No code changed this entry — documentation/process only.

- 2026-08-08 — **Self-registration added** — user asked whether guests could
  create their own account (email/password, or Google/Microsoft), and
  clarified this was never actually specified anywhere in the migration kit;
  the model built through Phase 4 assumed every account is created by DTS
  staff. A genuine, approved extension, not a correction.
  **The database already supported this with zero schema change** — confirmed
  by reading `supabase/migrations/20260807220000_core_schema.sql`:
  `handle_new_user()` already fires on every new `auth.users` row (however it
  was created — password sign-up or OAuth) and inserts a `profiles` row with
  `site_role='user'`, exactly the "registered" tier per `ACCESS-MODEL.md` §3.
  Only the client UI and Supabase Auth provider config were missing.
  **Built:** a Log In ⇄ Create Account mode toggle in the existing sign-in
  form (`setAccessMode()` in `js/app.js`) reusing the same fields/submit
  handler; `submitAccess()` branches to `supabase.auth.signUp()` in signup
  mode, with a client-side password-confirmation check first. Per the user's
  choice, email confirmation is required — `signUp()` returns no session in
  that case, so the form shows a "check your email" success note and drops
  back to login mode rather than pretending to sign the reader in.
  Google + Microsoft "Continue with…" buttons call
  `supabase.auth.signInWithOAuth({provider:"google"|"azure"})`. Since OAuth is
  a full-page redirect away and back (not a fetch), `access.pendingResourceKey`
  (in-memory) would be lost across that navigation — `signInWithOAuth()` now
  persists it to `sessionStorage` first, and `restoreSession()` (which already
  runs on every boot) checks for that marker on return and resumes either the
  original gated resource or the portal, but ONLY when the marker is present —
  an ordinary page load with an already-existing session still does nothing
  automatically, unchanged from before. No CSP change needed: OAuth's
  redirects are top-level navigation, which CSP's `connect-src`/`script-src`
  don't govern. New CSS: `.access-oauth-row`/`.access-oauth-btn`/
  `.access-divider` (`css/09-mobile.css`), `.form-success-note`
  (`css/04-overlays.css`).
  **Verified via curl against the live deploy:** the new form fields/buttons
  (`accessGoogle`, `accessMicrosoft`, `accessModeToggle`, `accessConfirmField`)
  and JS functions (`signInWithOAuth`, `setAccessMode`, `finishSignIn`) are
  present in the deployed `index.html`/`js/app.js`. **NOT yet verified live**
  — needs the user's own click-through, same as the rest of this phase's
  outstanding checklist.
  **Requires external setup ONLY the user can do, before this fully works —
  none of it is optional, and one item retroactively affects an already-
  shipped feature:**
  1. Supabase Dashboard → Authentication → Providers → Email → confirm
     "Confirm email" is ON (should already be Supabase's project default,
     but never explicitly verified this session).
  2. Supabase Dashboard → Authentication → URL Configuration → **Redirect
     URLs allow-list.** Add `https://dts-website-4cu.pages.dev/*` (site's
     `redirectTo`/`emailRedirectTo` is always `location.origin +
     location.pathname`, so one entry covers sign-up confirmation, OAuth
     return, AND the existing forgot-password flow). **This was never
     confirmed done for forgot-password either** (`docs/migration/
     PROGRESS.md` has no record of it) — worth checking now since an
     un-whitelisted redirect would silently break all three.
  3. Google OAuth: Google Cloud Console → APIs & Services → Credentials →
     Create OAuth client ID (Web application) → Authorized redirect URI
     `https://wsqvzyfvxjenqvqjpqjv.supabase.co/auth/v1/callback` → copy
     Client ID + Secret → Supabase Dashboard → Authentication → Providers →
     Google → enable, paste both, save.
  4. Microsoft OAuth: Azure Portal → Azure Active Directory → App
     registrations → New registration, redirect URI (Web)
     `https://wsqvzyfvxjenqvqjpqjv.supabase.co/auth/v1/callback` → New client
     secret → Supabase Dashboard → Authentication → Providers → Azure →
     enable, paste Application (client) ID + secret + tenant URL, save.
  Until 3/4 are done, clicking those buttons will show a Supabase
  provider-not-enabled error — expected, not a bug.
  Redeployed: https://d55645ed.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

- 2026-08-08 — **UX follow-up requested after the resolver-bug fix**, three
  changes to how gating actually feels to a visitor (no access-model change,
  all client-side + one new portal control):
  1. **Sign-in form now explains itself.** Added
     `.access-brand-note` under the "Grounded in Human Experience." tagline
     in the login panel: "Log in for full, free access to our immersive
     platform and interactive maps." (`index.html`, `css/09-mobile.css`,
     `css/11-desktop.css`).
  2. **Gated experiences no longer auto-prompt sign-in just from opening a
     project window.** This was the biggest change. Previously
     `showExperience()` unconditionally called `resolveExperienceNode()` the
     instant a project window opened — for a `registered` Treedis/GIS
     experience, that meant an immediate 401 → sign-in form, even though the
     reader hadn't tried to view anything yet. Now `showExperience()` takes
     an `opts.resolveNow` flag: by default (opening a project card, a deep
     link, back/forward, a stage-tab switch) it does NOT resolve — a gated,
     not-yet-resolved experience renders a new locked placeholder inside
     `#exStageSlot` ("Sign in to view this experience/video/map", clickable)
     instead of either a blank pane or an auto-popped login form. Only two
     things actually trigger a resolve: clicking that placeholder, or
     clicking "Enter Twin"/"Full screen map" — both explicit view attempts,
     which is where the sign-in prompt is now allowed to appear (a 401 from
     `resolveExperienceNode` still opens the existing sign-in form exactly as
     before). `resolveNow:true` is also passed by destination-preservation
     (`openResourceByKey`, post-login reopen) and the portal's own resource
     cards, since a click there already IS the explicit view attempt — it
     just happened before the sign-in interruption. A `public` experience
     (the 9 Vimeo videos, and anything already resolved earlier this
     session) is unaffected — `experienceIsAvailable()` short-circuits it
     straight to the existing zero-network-call auto-mount path, so it still
     "just plays" on window open, per the earlier fix. New CSS:
     `.example-locked-placeholder` in `css/06-example-window.css`.
  3. **Client portal now has a close (X) control.** `openPortal()`'s
     `#portalLayer` previously only closed via Escape or sign-out (which also
     clears the session) — added `#portalClose` next to "Sign out" in the
     topbar, wired to the existing `closePortal(false)` (closes the board,
     keeps the session, same function Escape already used) so a signed-in
     visitor can back out to the site without being signed out.
  **Verified by reading the code path (not assumed):** confirmed
  `resolveExperienceNode`'s existing zero-fetch shortcut
  (`node.tourUrl||embedUrl||watchUrl||mapId||url`) is exactly the right
  predicate for "already available, don't gate" and reused it unchanged as
  `experienceIsAvailable()`, so the public-video fast path added earlier this
  session needed no further change. **Verified against the real deployed
  site via curl:** the login subtitle text, `id="portalClose"`, and the new
  `experienceIsAvailable`/`showLockedPlaceholder`/`resolveNow` functions are
  all present in the live `index.html`/`js/app.js`
  (https://dts-website-4cu.pages.dev). **NOT yet verified live in a
  browser** — the Claude-in-Chrome extension was disconnected at the point
  this needed checking; the actual click-through (does the placeholder
  really appear instead of a blank pane, does clicking it really pop sign-in,
  does the portal X really work) is left to the user's manual pass, alongside
  the rest of the outstanding Phase 4 checklist below.
  Redeployed: https://03e1cdf2.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

  **User caught a real follow-on bug from their own click-through, before
  finishing the rest of the verification pass:** closing the sign-in form
  (the X, after clicking the locked placeholder) left the stage with
  nothing clickable at all — not locked, not open — recoverable only by
  reopening the project or switching tabs away and back. Root cause:
  `showExperience()`'s failure branches (`resolveExperienceNode` 401/403,
  and the GIS second-step failure) called `handleResolveFailure()` to open
  the sign-in form but never put the locked placeholder back afterward —
  it had already been hidden at the top of the same call (the unconditional
  `hideLockedPlaceholder()` that runs before deciding whether to show it
  again). Fixed: both failure branches now re-show the locked placeholder
  (`if (!experienceIsAvailable(target)) showLockedPlaceholder(slot, target)`)
  before returning, so dismissing the sign-in form leaves the reader back
  at the same clickable "Sign in to view this…" tile, able to retry.
  Verified via curl that the fix is live
  (`js/app.js` contains the new "Still not available" comment marker).
  Redeployed: https://c049950a.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev). Still needs the user's live click
  confirmation, same as the rest of this entry.

- 2026-08-08 — **User reported Phase 4 broken in real testing**, contradicting
  the prior session's "API-level verified" status: clicking a gated experience
  (automotive Treedis tour) showed a completely blank experience pane with NO
  login prompt, for BOTH guests and signed-in `testorgadmin`; user also
  reported public/registered videos not showing for guests at all, and could
  not sign in from the portal. Confirmed not a caching issue (user hard-
  refreshed and tried incognito, same result).

  **Root cause, found by reproducing live in-browser (Claude-in-Chrome) then
  isolating with direct `fetch()` calls from the page console:**
  `fetchResource()` in `js/app.js` calls `encodeURIComponent(resourceKey)`
  before requesting `/api/resource/<key>` — turning `project.automotive:treedis`
  into `project.automotive%3Atreedis`. Cloudflare Pages does NOT percent-decode
  dynamic route segments (confirmed empirically: a raw, unencoded colon in the
  URL correctly hit `parseResourceKey()`'s colon split and returned 401; the
  `%3A`-encoded form returned 400 "unrecognized resource key"). Since
  `parseResourceKey()` runs BEFORE the auth check, this 400 happened
  identically for guests and signed-in users, for EVERY gated experience/link
  — exactly matching the reported symptom. The client's `handleResolveFailure()`
  only `console.warn`s on an unrecognized "error" reason (vs. opening the
  sign-in form for a real 401), so nothing was visible in the UI at all — a
  silent failure, not a crash.

  **Fixed** in `functions/api/resource/[key].js`: decode `params.key` via
  `decodeURIComponent()` as the first line of `onRequestGet` (a no-op if the
  segment ever arrives already-decoded, so this is safe regardless of exactly
  how Cloudflare is or isn't decoding). Verified by curl (encoded key now
  returns 401 "sign-in required", stable across repeated requests) AND live in
  the browser: the "Welcome Back!" sign-in form now correctly opens over the
  automotive project window for a guest, matching the intended design for the
  first time.

  **Also addressed the user's separate point 0 ("videos should be open access
  to any user even not registered")** — a real reversal of the `registered`
  default `ACCESS-MODEL.md` §6 set for all Treedis+Vimeo experiences, but the
  user stated it plainly as an explicit requirement, not an open question.
  Changed `media.access` from `"registered"` to `"public"` on the 9 Vimeo-only
  project documents (`civic`, `foodsafety`, `healthcare`, `healthfac`,
  `municipal`, `nonprofit`, `sustain`, `workforce`, `workplace.json`) —
  Treedis and GIS experiences are untouched and remain `registered`, matching
  "not a treedis experience or a map" in the user's own wording. Re-uploaded
  all `data/source/` documents to R2 (`upload-source-to-r2.mjs`, idempotent)
  so the server-side resolver stays consistent even though the client no
  longer calls it for these (public resources short-circuit client-side with
  zero network calls, by existing design in `resolveExperienceNode()`).
  Verified via curl: `civic.json`'s published document now carries its real
  `embedUrl`/`watchUrl` directly (no strip) with `access:"public"`; a gated
  project (`automotive`) is confirmed still stripped/gated exactly as before.

  **Known gap surfaced, not fixed (out of scope for this pass):**
  `js/config.js` (the `/data`-unreachable fallback) has never carried any
  `access` field at all and `strip-public-data.mjs`'s config.js-stripping
  step unconditionally deletes every example's `embedUrl`/`watchUrl`/
  `tourUrl` regardless of access level. This means if `/data` ever fails to
  load and the site falls back to `config.js`, the 9 now-public videos would
  incorrectly appear gated in that fallback path (they did before this
  change too — this isn't a regression, just a pre-existing gap made visible
  by the videos becoming public in the primary `/data` path). Not fixed
  because it only matters in a rare degraded-mode fallback, not the bug the
  user reported. Needs: an `access` field added to `config.js`'s per-example
  media, and `strip-public-data.mjs`'s config.js section updated to honor it
  the same way the `/data` section already does.

  Rebuilt the deploy staging directory from scratch (fresh `robocopy` +
  `strip-public-data.mjs`, same exclusions as before plus the two oversized
  unused Backrooms `.usdz` files, which the fresh copy re-included and which
  still exceed Cloudflare's 25 MiB file cap). Redeployed:
  https://ea8f2b35.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

  **Still NOT yet verified — needs the user:** the full sign-in FORM flow
  beyond the login prompt appearing (actually signing in, destination
  preservation, reload persistence, sign-out, forgot-password), the GIS map
  rendering visually, and the full README regression checklist. These are
  the same items flagged as outstanding in the previous session's entry —
  this session only fixed the blocking bug that prevented testing them at
  all, it did not newly verify them.

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
- **`tools/gis-harvest.mjs` is served as a live static file on the deployed
  site** — found incidentally while rebuilding the Phase 8 deploy staging
  directory and confirming today's real exclusion list against the live URL.
  Unlike `scripts/`, `supabase/`, and `docs/migration/`, nothing has ever
  added `tools/` to the deploy exclusion list. No secrets in the file, but it
  does expose internal implementation comments (references to internal doc
  paths like `04-SPEC-gis-engine.md`). Low severity, not fixed (out of
  Phase 8's scope) — add `tools/` to the exclusion list on the next deploy.
- **RESOLVED — CSP blocked arbitrary admin-authored external URLs across
  every content-loading directive, not just images.** Started from a user
  report: setting a home-page hexagon's image to an Adobe Stock CDN URL
  (`t4.ftcdn.net`) via the Admin Board silently failed to load. Root cause,
  confirmed by reading `js/hex-media.js:180` (`probe.src = value` for
  `_type: "image"` — a plain `<img>`, subject to CSP): Phase 1's `img-src`
  was a narrow allowlist (`'self' data: blob:` + three specific GIS
  tile-server origins) that only ever enumerated origins in active use AT
  THAT TIME — every hex/gallery image was a local asset path then. But the
  CMS schema (`source: {kind:"path"|"url"}`) has always supported arbitrary
  external URLs by design (`fSource()` in `js/admin.js`), so a fixed
  per-origin allowlist can never keep pace with whatever host an editor
  picks. Confirmed the image URL itself was fine (curl: 200,
  `Access-Control-Allow-Origin: *`) — the CSP was the only blocker. Real
  migration regression, not pre-existing: GitHub Pages served no CSP at all,
  so external URLs "just worked" there.

  **At the user's request, audited every other URL-loading path in the CMS
  against the CSP before fixing anything, rather than patching only the one
  reported case — found three more real gaps, same root cause:**
  1. **External direct video files** (a client's own hosted `.mp4`, not
     YouTube/Vimeo) — `media-src` wasn't in the CSP AT ALL, so it fell back
     to `default-src 'self'` and silently blocked any non-local video `src`
     (`js/hex-media.js:198`, `v.src = value` on a real `<video>` element).
  2. **YouTube embeds** — confirmed two DIFFERENT YouTube embed hosts are
     actually built by real, already-shipped code:
     `js/hex-media.js`'s `embedUrls()` uses `www.youtube.com/embed/`;
     `js/gis/gis-tour.js`'s tour-step video uses
     `www.youtube-nocookie.com/embed/`. Neither was ever in `frame-src`
     (only `spaces.dtsxr.com` + `player.vimeo.com` were) — Vimeo worked,
     YouTube has been fully coded but silently broken this whole time.
  3. **GIS layers/model URLs beyond what's already allowlisted** —
     `connect-src`'s three GIS hostnames (`maps.iberiagov.net`,
     `cimsgeo.coastal.louisiana.gov`, `cimsgeo3.coastal.louisiana.gov`) only
     work because they happen to be Iberia Parish's own servers, already
     known from Phase 1's reconnaissance. But the Admin Board's Layer editor
     ("Test connection", "Load fields from service", "+ Add layer") and
     `<model-viewer>` (fetches GLB files via `fetch()`/XHR internally,
     confirmed by tracing `js/gis/gis-esri.js`/`gis-viewer.js`'s own
     `fetch()` usage as the same mechanism) both explicitly support ANY
     external ArcGIS/WMS/geojson service or GLB URL an admin supplies — a
     different project/parish's GIS server, or an externally-hosted 3D
     model, would be blocked out of the box.

  **Fix, consistent across all four (approved by the user after reviewing
  the full audit, not applied unilaterally):** broadened `img-src`
  (already done), added `media-src 'self' https:` (previously absent
  entirely), and broadened `frame-src`/`connect-src` to accept any `https:`
  source, replacing their narrow per-origin allowlists. `script-src`/
  `object-src 'none'`/`base-uri 'self'` are untouched and remain strict —
  those are the actual XSS-relevant boundaries, and every one of these four
  gaps is in content only `site_admin` can author (already maximally
  trusted via this phase's own routing work), never guest-facing input.
  `connect-src` keeps its explicit `wss://wsqvzyfvxjenqvqjpqjv.supabase.co`
  entry since a bare `https:` source doesn't cover the `wss:` scheme
  Supabase Realtime needs. Redeployed: https://7d72e764.dts-website-4cu.pages.dev
  (stable alias: https://dts-website-4cu.pages.dev). **Verified live** —
  curled the deployed site's response headers and confirmed the new CSP
  string is exactly what's being served, not just a successful `wrangler`
  exit code. **User confirmed live in the browser, dev URL:** retried the
  original reported case (the Adobe Stock hexagon image) plus a second
  spot-check — both worked. All four CSP gaps are now closed and confirmed
  end to end, not just by header inspection.
- **RESOLVED — `checkAccess()` now bypasses `client`/`restricted` for
  `site_admin`.** Found reading `functions/_lib/access.js` during Phase 5;
  fixed the same session at the user's request. Added `isSiteAdmin(userId,
  env)` (mirrors the `is_site_admin()` Postgres function's own semantics —
  `profiles.site_role = 'site_admin'` — via the service-role REST query this
  Function already uses for every other table, since it can't call a
  per-request RLS function the way an authenticated PostgREST client can).
  `checkAccess()` now checks it once for `client`/`restricted` before falling
  through to the ordinary membership/entitlement checks; `public`/
  `registered` are untouched (no extra query on the common path). **Verified
  live against the real dev Supabase project, calling the actual exported
  `checkAccess()` function (not a reimplementation)** with real
  `testadmin`/`testuser` ids and a synthetic, deliberately nonexistent
  resource key: `testadmin` (site_admin, zero org memberships, zero
  entitlements) → `true` for both `client` and `restricted`; `testuser`
  (plain registered, same zero memberships/entitlements) → `false` for both.
  Confirms the bypass is role-driven, not accidentally permissive.
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
- **`js/config.js` has no `access` field anywhere and its strip step is
  access-blind** — `strip-public-data.mjs`'s config.js section unconditionally
  strips every example's `tourUrl`/`embedUrl`/`watchUrl`, regardless of the
  real access level in `/data`. Harmless while everything was `registered`
  (that's the correct strip either way), but now that 9 Vimeo experiences are
  `public` in `/data` (see 2026-08-08 session entry), the fallback is
  stricter than the real data — only matters if `/data` fails to load AND the
  site falls back to `config.js` AND a guest opens one of those 9 videos in
  that degraded state. Needs an `access` field added to `config.js` per
  example and the strip step updated to check it, mirroring the `/data`
  logic already in the same script.
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
- GA4 Measurement ID: ____  (placeholder-empty in js/analytics-init.js until set)
- Microsoft Clarity Project ID: ____  (placeholder-empty in js/analytics-init.js until set)
