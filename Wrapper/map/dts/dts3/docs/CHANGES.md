# Changelog

Newest first.

## Whole-project bug audit: one critical auth bypass fixed, plus four more

A full audit found and fixed a critical authorization bypass — a crafted
request could truncate a PostgREST filter mid-string (a literal `#` becomes
a URL fragment that's never actually sent), letting any org member escalate
themselves to org_admin and mass-mutate or wipe an entire organization's
membership. Fixed with strict id validation everywhere an externally-supplied
id reaches a database filter, verified live against a real exploit attempt
before and after. Also fixed: a stored XSS reachable via a shareable GIS map
link (an unescaped color value breaking out of an HTML attribute); deleted
CMS content (a project, sector, or GIS map) staying permanently live and
publicly fetchable in storage after "deletion" in the Admin Board; a cosmetic
field-name mismatch that made every publish show "undefined" in its success
message; and a real, previously-inert `active` toggle for category pages,
now properly wired up after confirming with the user what the existing data
actually meant, rather than guessing. See `docs/migration/PROGRESS.md`'s
session log for the full trace, exploit proof, and live verification of
every fix — nothing has been checked in an actual browser yet.

## Fix: Admin Board couldn't see gated GIS maps, tours, or gated experiences

Real bug, found by the user: the Coastal Resilience / Gulf Futures Challenge
project's GIS map and tour experience showed up empty in the Admin Board, and
the GIS MAPS nav section had nothing in it at all. Root cause was two-fold —
the public placeholder for a gated GIS map was missing its `_type` field
(so anything that looks for "all the GIS maps" found none), and more
fundamentally, the Admin Board never had a way to load the full, unstripped
content at all: it used the exact same public-only content path every guest
visitor gets, which by design can never reach the private copy `/api/publish`
writes to. Nothing was actually lost — confirmed the real content was intact
in storage the whole time — this was purely a blind spot in what the board
could see. Fixed with a new site_admin-only endpoint that loads the real
content once, right when a site_admin session opens the board, without ever
touching what a real visitor sees. See `docs/migration/PROGRESS.md`'s session
log for the full trace and live verification; a real browser click-through
is still needed to close this out.

## In-app documentation for all four audiences (standalone feature)

Added a help/documentation system covering everyone who touches the site:
`site_admin` gets a new "Documentation" screen in the Admin Board; signed-in
client sessions get a "Help" tab in the portal (org admins see their
team-management topics layered on top of the same member content, not a
separate track); everyone else (guests, and any signed-in visitor with no
organization) gets a small floating help icon reachable from anywhere on the
public site. One shared engine (`js/help.js`) renders all three — search,
a table of contents, and a "Print / Save as PDF" export with a real linked
index — from static content (`js/help-content.js`) that's deliberately kept
out of the CMS, since it documents how the code behaves rather than anything
an editor would change. Also added: URL-based deep links to a specific topic,
a `?` keyboard shortcut, an inline "?" hint next to the entitlement picker,
and two new analytics event types (`help_topic_view`, `help_search`). See
`docs/migration/PROGRESS.md`'s session log for the full detail and
`docs/migration/HELP-DOCS-TESTING.md` for the manual testing checklist —
nothing in this feature has been verified in a live browser yet.

Following real feedback the same session, the Admin Board's Documentation
content was rewritten from short summaries into genuine step-by-step
tutorials — exact button/field labels traced from the real editors, numbered
steps for every add/edit/delete flow, and "before you start" callouts for
prerequisites (e.g. Builds needs the file ready, Users has no working
invite-email yet).

## Analytics, audit trail, and marketing tags — dev build complete

Product analytics (`/api/track` → the `events` table) now covers 15 event
types across the whole visitor journey — project/experience views, gated
sign-in prompts, downloads, lead form submissions, category browsing, and
FAQ search — each stamped server-side with the real user/org, never trusted
from the client. Client organizations get a small "Activity" tab in their
portal (a Chart.js summary of their own usage, RLS-scoped so one
organization can never see another's); `site_admin` gets a new read-only
"Audit" screen surfacing the administrative trail earlier phases were
already writing but nothing displayed. GA4 + Microsoft Clarity are wired in
but inert (placeholder IDs) until the client's real accounts exist at
Handoff. Along the way, fixed a real pre-existing gap: the cookie-consent
banner's Accept/Reject buttons were functionally identical — now Reject
actually prevents any tracking script from loading. See
`docs/migration/PROGRESS.md`'s Phase 9 entry for the full detail, including
two rounds of real verification (adversarial RLS checks against the live
database, and scripted checks against the live deployed site).

## Admin Board — real delete added where Disable wasn't enough

Organizations and Users now have a real, permanent Delete alongside the
existing Disable (with a guard against deleting your own account or the
last remaining site_admin). Category pages (sectors) can now be added and
deleted too — previously a fixed set with no way to do either. Everything
else in the CMS (projects, GIS maps/tours, and every list-style field)
already had real delete; this closes the three gaps that didn't. See
`docs/migration/PROGRESS.md` for the full detail, including the
foreign-key cleanup needed to make Organization/User delete safe.

## Cloudflare migration — gated software downloads (Builds)

A download is now just another `resource_key` (`download.<client_apps.key>`),
gated through the exact same policy resolver every project/GIS-map experience
already uses — not a separate system. New Admin Board "Builds" screen to
register an app, edit its access level, upload a real file, delete a build or
just remove its file, and grant/revoke who has it (reusing the same
entitlement picker as everywhere else). The client portal's "All Apps" list
now includes any download the signed-in account holds a real grant for —
clicking one triggers an authenticated file save. See
`docs/migration/PROGRESS.md`'s Phase 8 entries for the full detail, including
a couple of things fixed along the way (a pre-existing dev-seed script bug, a
deploy-staging bug that would have silently broken all `/data` loading had it
shipped, and a missing delete capability found by the user's own manual
testing pass).

## Cloudflare migration — lead form simplified back to client-side Web3Forms

Reverted the server-side `/api/lead` proxy from the entry below after a real
debugging chain (a submit-timing race, a PowerShell pipe silently corrupting
secrets with a stray BOM character, then a Web3Forms rate limit from all the
testing) — each bug was real and got fixed, but the underlying design was
protecting a key that Web3Forms's own dashboard explicitly documents as
"public, safe to use in client side code." Web3Forms's own abuse protection
(confirmed live: they do rate-limit) covers what the server-side proxy was
otherwise for. Lead delivery now calls Web3Forms directly from the browser
again, exactly like before this phase started. Turnstile stays as a
client-side gate on the submit button (real friction against unsophisticated
bots) — only the server-side re-verification round trip was removed. See
`docs/migration/PROGRESS.md`'s Phase 7 entries for the full chain.

## Cloudflare migration — lead form goes server-side, Turnstile added, Web3Forms key rotated

Lead delivery now goes through `functions/api/lead.js`: a Cloudflare
Turnstile token is verified before anything reaches Web3Forms, and the
Web3Forms access key lives only in a Pages secret, never in a committed
file. The previously-exposed key (public in `data/site/lead.json` and git
history since before this migration) is rotated to a new value. The
mailto fallback is preserved — any failure (network, Function down, a
rejected Turnstile token) falls through to it exactly as before. See
`docs/migration/PROGRESS.md`'s Phase 7 entry for the full writeup,
including a real secret-exposure mistake caught and fixed the same
session (a CLI command's JSON output included a secret half I didn't
anticipate, printed it, then immediately rotated that credential too).

## Cloudflare migration — critical fix: gated GIS docs were breaking the whole site's data load

Found by real live testing right after the content-pipeline entry below:
`manifest.json`'s public copy still listed gated GIS tour/feature-tour
documents as fetchable files even though they're deliberately absent from
`data/current/`. `js/content-loader.js`'s `Promise.all()` loader rejects the
ENTIRE load on a single 404, so every page load fell back to `js/config.js`
for every visitor — hexagons rendering from the HTML fallback instead of
real data, and the Admin Board disabled outright (it bails out whenever
`window.DTS_CONTENT` isn't populated). Fixed with `filterManifestForPublic()`
— the public manifest now only lists files actually present in
`data/current/`. Fixed live via an R2 content update before the code fix
was even deployed. See `docs/migration/PROGRESS.md`'s follow-up Phase 6
entry for the full root-cause writeup, including why the phase's own
acceptance testing missed it.

## Cloudflare migration — content pipeline: /data moved to R2, instant publish

`/data` no longer ships as static files in the deploy — it lives in R2 as
`data/current/` (public, stripped) and `data/source/` (private, full),
served same-origin by `functions/data/[[path]].js` with zero changes to
`js/content-loader.js`. A new "Publish to site" button in the Admin Board
posts to `functions/api/publish.js` and goes live within seconds, no
redeploy. Publish is diff-based (a SHA-256 content-hash ledger decides what
actually changed) after the first unconditional version blew Cloudflare's
50-subrequest-per-invocation free-tier ceiling on a real deploy. Also fixed
a real regression the R2 move would have caused in the zip-export escape
hatch (harvested GIS layer files now route through the authenticated proxy
instead of a now-gone static path) and a leftover leak in `js/config.js`'s
fallback strip (a gated example's `origin` field). See
`docs/migration/PROGRESS.md` (2026-08-08 Phase 6 entry) for the full
breakdown, including a real double-execution bug found while testing the
rollback drill.

## Cloudflare migration — gating UX: no more surprise sign-in prompts

Follow-up to the resolver-bug fix below. Opening a project window used to
immediately fetch and gate its default experience, popping the sign-in form
before the reader had tried to view anything — jarring, and made it look
like browsing itself required an account. `showExperience()` now only
resolves a gated experience on an explicit view attempt (clicking a new
locked placeholder in the stage, or "Enter Twin"/"Full screen map"); opening
a project, switching tabs, or following a deep link just shows the project
(and, for the now-public videos, plays them) with a "Sign in to view this
experience" tile standing in for anything still gated. Destination
preservation and the client portal's own resource cards still resolve
immediately, since clicking those already is the explicit view attempt.
Also added a subtitle to the sign-in form explaining why it's asking
("Log in for full, free access...") and a close (X) control on the client
portal that returns to the site without signing out. See
`docs/migration/PROGRESS.md` (2026-08-08 entry) for the full breakdown.

## Cloudflare migration — resource-gate resolver bug, and video access reclassification

Real-world testing (deployed Cloudflare Pages preview) found that every gated
experience/link showed a blank pane with no login prompt, for guests and
signed-in users alike. Root cause: `js/app.js`'s `fetchResource()`
`encodeURIComponent()`s the resource key before requesting
`/api/resource/<key>` (`:` becomes `%3A`); Cloudflare Pages does not
percent-decode dynamic route segments, so `parseResourceKey()` never found
the colon separator and 400'd before the access check ever ran. Fixed by
decoding `params.key` in `functions/api/resource/[key].js`. Also reclassified
the 9 Vimeo-only project experiences (no Treedis, no GIS) from `registered`
to `public` per an explicit access-model change. See
`docs/migration/PROGRESS.md` (2026-08-08 entry) for full detail, verification,
and a known follow-up gap in `js/config.js`'s fallback strip step.

## CPRA Iberia GIS tours — main tour's final step, and a second click-blocking bug

Per the human's own follow-up: (1) the parish-wide tour's last step now
turns on `cpra-projects-points` (and off the old footprints layer),
explains the layer, and invites exploring individual project pins — so a
finished tour leaves the map on exactly `parish-boundary` +
`cpra-projects-points`, verified by replaying the full 6-step layer-state
chain with a script (mirrors `resolveTourLayerState()`): confirmed the
end state is exactly those two layers, nothing else. (2) The human then
reported CPRA pins stop being clickable both during the main tour's new
last step and after finishing any individual project tour.

- **Root cause, same class of bug as the dim-mask fix earlier in this
  file:** `highlightGroup` (`gis-viewer.js`, the layer group every tour
  step's `highlight` draws into) was created with no `pane` option at all.
  Under this map's `preferCanvas:true`, that put every highlight ring in
  Leaflet's *default* `overlayPane` (zIndex 400) — above every data-layer
  pane (max 95) — and left it fully interactive by default. Once any
  step's highlight had rendered even once, that pane's canvas became the
  browser's actual click target for the whole map; a miss on it (anywhere
  not exactly on the thin highlight ring) becomes a generic, untargeted map
  click that never reaches a real layer's own canvas underneath.
  **Confirmed why it outlives the tour that caused it:** reaching a tour's
  outro screen doesn't clear anything at the engine level (only an
  explicit exit call does, and even that isn't reached just by letting a
  tour finish) — `clearHighlight()` only ever runs again at the *next*
  `applyStep()` call, so a project tour finished by reading through to the
  end, not exiting, leaves its last highlight (and the click-blocking
  pane) in place indefinitely.
- **Fix:** `highlightGroup`'s shapes now render in their own dedicated pane
  with `pointer-events:none` set directly on it (the browser skips it
  entirely, same fix as the dim mask), plus `interactive:false` on the
  shapes themselves — the highlight ring was never meant to be its own
  click target. Visual stacking is unaffected (still zIndex 300, above
  every data layer); only its interactivity changes.
- **Verification:** the layer-state replay for the new last step was
  checked by script, not eyeballed. The pane/pointer-events mechanism
  itself is the exact same one already used (and already reasoned through
  against the real Leaflet dispatch code) for the dim-mask fix earlier —
  not re-derived from scratch. `node --check` clean. **Not yet confirmed
  live:** that pins are actually clickable during and after both the main
  tour's last step and an individual project tour — left for the human's
  own retest, same as the outstanding items already in
  `docs/plans/gis/CPRA-IBERIA-GIS-TOURS-TESTING.md`.

## CPRA Iberia GIS tours — step media (aerial photos + video embed support)

Per the human's own ask, after first assessing feasibility (not implementing
blind): every one of the 13 CPRA tours now has at least one real, verified
image on its "Where it's at" step; `js/gis/gis-tour.js` and `js/admin.js`
gained YouTube/Vimeo embed support for step video, even though no real video
source material exists for these specific 13 projects (the human's explicit
choice, to be ready if real CPRA video turns up later).

- **Assessed before implementing, with real searches, not assumed:**
  ground-level photos genuinely exist and are verifiable for only one of the
  13 projects (Cypremort Point State Park — official Louisiana State Parks /
  Louisiana Office of Tourism coverage of its new marsh boardwalk). Searched
  specifically for the flood-protection structures (Rutton Rill, Stumpy
  Bayou, Little Valley Bayou) and the shoreline demo — only technical
  PDFs/federal register notices exist, no photos. A small, single bridge
  replacement (Port Road) returned nothing project-specific at all. Did not
  force a stock or generic image onto any of these — an unverifiable photo
  presented as a specific project would misrepresent it, which is worse than
  no photo.
- **Real, reliable fallback used for all 13**: a real, on-demand aerial photo
  centered on each project's own live-verified coordinate, pulled from
  Iberia Parish's own 2024 imagery service — the same service this map
  already uses as its "Aerial 2024" basemap, not a new trust dependency.
  Every one of the 13 was fetched and visually confirmed (not just checked
  for HTTP 200) before use. **Real finding:** Iberia's own imagery service
  doesn't have full-parish coverage — a first attempt at `LA-0012-7`'s own
  (off-map, Barataria-area) coordinate and at central Iberia Parish both
  returned blank tiles; Esri's public World Imagery service (globally
  covered, no key required) was used as a fallback for that one project,
  centered on New Iberia itself as an honest "this is Iberia Parish"
  substitute, since the project's true location isn't a meaningful single
  site anyway (documented in that tour's own step text already). The
  Cypremort Point and Big Bayou Pigeon aerials were each re-fetched once
  after the first attempt returned a tile more than half black (a real
  imagery-tile-boundary artifact, not fabricated data) — both now fully
  populated.
- **Real usage-rights flag, not silently assumed:** the one ground photo
  (Cypremort Point's boardwalk) is credited on its source page to "Louisiana
  Office of Tourism," republished on a local travel blog (iberiatravel.com)
  — official government-sourced content, but its actual redistribution
  terms for a third-party commercial site were not confirmed. Marked
  "pending confirmation" in both the tour's `alt` text and the DOCX caption,
  the same pattern this project already uses for the CPRA/Iberia GIS data
  ToS questions in `data/gis/sources.json` — but this is a distinct,
  photography-specific rights question, not covered by the prior GIS-data
  go-ahead, and should be confirmed before public launch.
- **`js/gis/gis-tour.js`**: `mediaEl()` now auto-detects a YouTube or Vimeo
  URL in `step.media.source.value` (regex-matched, not a new authored
  `provider` field — the existing URL is the only source of truth, so there
  is nowhere for a field and a URL to disagree) and renders a lazy-loaded
  `<iframe>` embed instead of a `<video src>` tag, which can only ever play
  a direct file and cannot embed either provider's watch-page URL. Backward
  compatible: a direct video file URL still renders as `<video>` exactly as
  before. `css/15-gis.css` gained a 16:9 aspect-ratio rule for the embed
  case (iframes have no intrinsic size, unlike `img`/`video`).
- **`js/admin.js`**: `tourStepEditor()`'s media section previously could
  only ever add an image (`+ Add image (optional)`, hardcoded `_type:
  "image"`) — there was no way to author video media at all. Added a
  parallel `+ Add video (optional)` path using the same existing `fSource()`
  field (path/URL toggle, already supported — no new field builder needed)
  with a hint explaining that a YouTube/Vimeo link embeds automatically.
- **13 real images added**: `assets/gis/cpra/*-aerial.jpg` (13, ~45-140KB
  each) + `cpra-cypremort-point-boardwalk.jpg`, referenced from each tour's
  first step (`step.media`) and embedded directly into
  `docs/plans/gis/CPRA PROJECT TOUR INFORMATION.docx` (14 inline images,
  each captioned) per the human's explicit ask to add them to the document
  too, not just reference them from the site.
- **Verification performed:** every image was actually fetched and viewed
  (not just HTTP-200-checked) before being used, including re-fetching two
  that initially returned mostly-blank tiles. Every tour's `step.media`
  cross-checked by script: valid `_type`, non-empty source value, and (for
  `path`-kind sources) the referenced file actually exists on disk — all 14
  entries clean. `node --check` clean on both edited `.js` files. The
  YouTube/Vimeo URL-detection regex was tested directly against real watch/
  short/embed URL formats for both providers, confirming correct embed-URL
  construction, and against non-video URLs (an ArcGIS export URL, a local
  image path) to confirm no false positives. **Not yet confirmed live:**
  actual rendering of the aerial photos and the Cypremort Point ground photo
  in a real browser, and (since no real video exists yet to test with) the
  YouTube/Vimeo embed path has only been verified by direct regex/URL
  construction, not by watching a real embedded video play in the tour card.

## CPRA Iberia GIS tours — expanded from 5 to all 13 real Iberia projects

Per the human's own follow-up: the original 5-project scope only covered
projects with pre-approved content in the original
`docs/plans/gis/CPRA PROJECT TOUR INFORMATION.docx`. The human asked whether
that really matched "the 13 points in the CPRA GIS project data" and asked
for the DOCX itself to be updated — in its original format — to cover the
rest, using the real CIMS Iberia Parish factsheet as an additional source,
and to make every project's 3-step tour more didactic and community-facing.

- **Source note:** `cims.coastal.louisiana.gov/robots.txt` disallows all
  automated access (`Disallow: /`) — confirmed live, matching this project's
  own Phase 0 note ("robots.txt disallows automated fetch; transcribe
  manually"). The human pasted the real Iberia Parish factsheet page content
  directly rather than have it fetched; that pasted content, cross-checked
  against the real ArcGIS service's own descriptive fields
  (`LOCATION`/`OBJECTIVE`/`ISSUEADDR`/`GOALS`/`Project_Description`, queried
  live), is the source for the 8 newly-added projects' content.
- **Real finding, not previously flagged:** the factsheet actually lists 20
  distinct CPRA projects touching Iberia Parish, not 13 — 7 of them
  (`AT-0036`, `AT-0012`, `AT-0030`, `TV-0054`, `TV-0086`, `TV-0087`,
  `AT-0026`) do not exist as features in the `outreach/
  Outreach_Projects_Layer_New` point service at all — confirmed live,
  querying each by `Project_ID` directly returns zero features, regardless
  of the `Parish` attribute. These are basin/region-scale studies or
  projects not yet geocoded into this specific point layer; there is no map
  feature to attach a tour to, so they're out of scope for this
  feature-tour mechanism (not silently dropped — flagged here). The DOCX and
  tours below cover exactly the 13 real, mappable Iberia Parish points.
- **`docs/plans/gis/CPRA PROJECT TOUR INFORMATION.docx` rewritten**, same
  format as the original (title, then per-project: bold name, "Where it's
  at", "What it is changing", "Timeline / Completion Date" with Project
  Status/Estimated Cost/Funding Source) — built with `python-docx` from a
  single Python data structure that also generates the JSON tours below, so
  the two can't drift out of sync. All 13 real Iberia Parish projects are
  now covered (the original 5 rewritten in the same more plain-language,
  community-facing voice as the 8 new ones, per the human's explicit ask).
  Real cost/funding figures cross-checked against both the factsheet and the
  live ArcGIS attributes (they agree, e.g. Rutton Rill's $3,928,864 matches
  the original "$3.9 million" rounding). Two projects (`AT-0039` Big Bayou
  Pigeon, `TV-0108` Abbeville and Vicinity HP) have no published project
  description in either the factsheet or the ArcGIS service's own
  descriptive fields — confirmed both report "N/A" — so `AT-0039`'s "What
  it is changing" says so honestly ("CPRA has not yet published a detailed
  public description...") rather than inventing one; `TV-0108` does have
  real content, sourced from the factsheet's own "2023 Master Plan Projects"
  section (`Abbeville and Vicinity (292)`, the same project tracked under
  the master-plan scenario), explicitly labeled as the long-range concept
  and not a finalized design, per this project's existing sourcing-caution
  convention for master-plan-derived content.
- **8 new `gisTour` + `gisFeatureTour` document pairs** added following the
  exact pattern of the original 5 (`data/gis/tours/cpra-{ciap-bamm,
  non-rock-shoreline,east-marsh-island,cypremort-point,little-valley-bayou,
  iberia-st-mary-levee,big-bayou-pigeon,abbeville-hp}.json` + matching
  `data/gis/featuretours/*.json`), registered in `data/manifest.json`. Real
  step view coordinates for all 13 (including the original 5, re-derived to
  confirm) converted from each feature's own live Web Mercator geometry.
  **Real finding, handled deliberately:** `LA-0012-7`'s (CIAP Performance
  Evaluation Borrow Area Management and Monitoring) actual map point falls
  outside both Iberia Parish and this map's own `maxBounds` (a multi-parish
  benefit-area study, plotted near Barataria Basin) — confirmed live via its
  real geometry. Rather than set an unreachable step `view` (the exact
  clamping bug already documented and fixed in this project's Phase 4 gate
  entry for two other steps), this tour's steps use the map's own
  already-verified-safe default parish view, with the caveat stated plainly
  in the tour's own "Where it's at" text.
- **Verification performed:** every `Project_ID` cross-checked live against
  the real ArcGIS service (still the same 13 for Iberia; the 7 factsheet-only
  projects confirmed absent from the point service by direct per-ID query);
  every `mapId`/`tourId`/`layerId`/`featureKey.value` cross-reference across
  all 13 tours + 13 feature tours validated by script against the real files
  on disk, including confirming `featureKey.value`s match the real 13
  `Project_ID`s exactly (no extras, none missing); all new/edited JSON
  validated. **Not yet confirmed live:** the actual tour content/playback in
  a real browser — `docs/plans/gis/CPRA-IBERIA-GIS-TOURS-TESTING.md` §3 has
  been expanded to all 13 for the human's own retest; §2's and §5's earlier,
  already-recorded results (from the original 5-project round) were left
  untouched, per instruction, rather than reinterpreted against the new
  scope.

## CPRA Iberia GIS tours — human testing fix pass (mask/pane click blocking)

Per the human's own manual pass against
`docs/plans/gis/CPRA-IBERIA-GIS-TOURS-TESTING.md` §2 (filled in for real,
their own words) — every one of its 6 tests failed with the same symptom:
clicking any pin on the new `cpra-projects-points` layer, matched to a tour
or not, "does not activate anything." Section 1 (map/layer loading, 4 tests)
passed cleanly; sections 3-7 were left untested, correctly, since the human
noted they couldn't proceed past a non-functional click. This entry is the
fix pass that followed, not a re-run of the human's own checklist — see that
document's own `Claude Fix` notes (their PASS/FAIL marks are untouched).

- **Root cause, found by reading the vendored `leaflet.js` dispatch code
  directly, not guessed from the symptom:** two compounding, pre-existing
  issues, neither introduced by this feature's own new layer:
  1. `js/gis/gis-viewer.js`'s `buildParishMask()` (Phase 3, task 3.8) builds
     the "dim everything outside the parish" overlay in its own pane at
     zIndex 450 — above every data layer — with `interactive:false`. That
     option only excludes the mask from its *own* canvas's internal hit
     test; it does not stop that canvas's DOM element from being the
     browser's actual click target. This map's `preferCanvas:true` gives
     every distinct zIndex pane (`ensurePane()`, keyed by zIndex) its own
     `<canvas>`, and Leaflet's canvas click dispatch — confirmed directly in
     `vendor/leaflet/leaflet.js` (`L.Canvas#_onClick` always calls
     `_fireEvent`, hit or miss; `L.Map#_fireDOMEvent` with no hit layer falls
     back to `_findEventTargets`, which never inspects a *different* pane's
     canvas) — only ever tests the one canvas element the browser actually
     dispatched the click to. A miss there becomes a generic, untargeted map
     click and never falls through to any lower pane. The always-on mask has
     been silently swallowing every click on this entire map since Phase 3;
     it was never caught earlier because whatever session confirmed identify
     popups working (Phase 3/4 gate) most likely did so before the mask's
     own separate, slower `entry.query({})` fetch had finished and been
     added to the map, or via the attribute table / search / highlight
     paths, none of which go through a real map click at all.
  2. Even with the mask fixed, `parish-boundary` itself (zIndex 90, always
     visible, a genuinely interactive filled polygon covering the entire
     parish) sits above every other data layer, including the new
     `cpra-projects-points` (previously zIndex 21), and would win the exact
     same way.
- **Fix:** `buildParishMask()` now sets `pointer-events:none` directly on the
  mask's own dedicated pane element right after creating it, so the browser
  skips its canvas entirely and the click reaches whatever's actually drawn
  underneath — restoring the "cosmetic only" behavior `interactive:false`
  already documented as the intent, with zero effect on anything else (that
  pane holds nothing but the mask). `cpra-projects-points`'s `zIndex` was
  raised from 21 to 95 (above `parish-boundary`'s 90) so its own pins'
  canvas is the one that actually receives clicks on them; documented inline
  in the layer's own `description` so a future edit doesn't "normalize" it
  back into the group's ordinary z-order without understanding why.
- **Real, separate, smaller bug also found and fixed while investigating:**
  `js/gis/gis-tools.js`'s `renderTemplate()` used `/\{(\w+)\}/g` to
  substitute popup-title placeholders — `\w` doesn't match `.`, so a title
  referencing a joined ArcGIS view's table-qualified field name (this map's
  own established convention for the CPRA services, e.g.
  `{Project_Status_List.Project_Name}`) never matched at all; the literal,
  unsubstituted placeholder text would have rendered instead of the project
  name. Fixed to `/\{([\w.]+)\}/g`. Confirmed by reading the regex against a
  real field name from the live service response, not by observing it fail
  live (this bug is orthogonal to the click-blocking one above and would
  only have been visible once a popup could open at all).
- **Not a new fix, a scoping note:** the same mask/pane click-blocking
  mechanism above also affects every *other* existing point/vector layer
  whose zIndex sits below `parish-boundary`'s 90 (`critical-facilities` 52,
  `fire-stations` 50, `port-canals` 37, `hydrography` 35, `cpra-projects` 20,
  `cpra-master-plan-2023` 22) whenever `parish-boundary` — always visible by
  default — is on screen. Deliberately **not** fixed this pass: reordering
  those z-indexes is a broader, map-wide behavioral change well outside the
  scope of "why don't the new CPRA pins respond to clicks," and none of them
  were reported as failing in this round's testing. Flagged here rather than
  silently left for someone to rediscover as a "new" bug later, and as a
  real, separate follow-up worth its own testing pass if picked up.
- **Verification performed:** the actual root cause was confirmed by reading
  the real (if minified) `vendor/leaflet/leaflet.js` dispatch code directly,
  not inferred from the symptom. A jsdom-based headless test (real network,
  real vendored Leaflet + esri-leaflet + this repo's own `js/gis/gis-esri.js`)
  confirmed the underlying feature-query/click-propagation mechanism works
  correctly end-to-end for the real CPRA service and its `Project_ID`-keyed
  feature identity when not blocked by an overlapping pane. A second jsdom
  test running the full `DTSGis.mount()` pipeline against the pre-existing
  `critical-facilities` layer showed the identical "zero rendered markers"
  result as the new layer — confirmed to be a jsdom limitation
  (`HTMLCanvasElement.getContext()` is unimplemented without a separate
  native `canvas` package — checked directly), not a real-app difference,
  matching this project's own already-documented Phase 5 jsdom-harness gap
  ("cannot render CSS, Leaflet, or real network calls"). The
  `pointer-events:none` mechanism itself needed no Leaflet-specific
  verification (standard, spec-level browser behavior); confirmed only that
  the exact JS API used (`el.style.pointerEvents = "none"`) sets and
  serializes correctly. **Not yet confirmed live:** the actual click →
  popup → "Start guided tour" behavior in a real browser, and everything in
  `CPRA-IBERIA-GIS-TOURS-TESTING.md` §§3-7 that depended on it — left for
  the human's own retest, per this project's verification approach; nothing
  here is claimed as functionally PASS until they confirm it.

## CPRA Iberia Parish GIS project tours + general CMS-managed feature tours

Additive to the already-gated GIS Phase 5, not a new numbered phase — one new
document type (`gisFeatureTour`) inside the existing GIS family, no new
engine/CMS category. Built per the plan approved this session; see
`docs/plans/gis/CPRA-IBERIA-GIS-TOURS-TESTING.md` for the human's manual pass.

- **Real ArcGIS service identified and queried live**, resolved from the AGOL
  item id `20422ab8cbce407a8970d2fc549272ae` via
  `arcgis.com/sharing/rest/content/items/<id>?f=json`:
  `cimsgeo.coastal.louisiana.gov/arcgis/rest/services/outreach/Outreach_Projects_Layer_New/MapServer/0`
  ("CPRA_Points" / "CPRA Projects (Center Points)"), point geometry, public,
  no token. **Confirmed distinct from the `cpra-projects` layer already
  shipped in `data/gis/maps/iberia-coastal.json`** since Phase 3
  (`cimsgeo3.coastal.louisiana.gov/.../prot_rest/CPRA_Projects`, layer name
  `CPRA_Polys`, polygon footprints, no `Parish` field at all — confirmed live
  by querying its own `?f=json`, so it can't be attribute-filtered to Iberia).
  The existing footprints layer is untouched; a new `cpra-projects-points`
  layer was added for the point/pin service the request specifically asked
  for.
- **Iberia Parish filter, applied server-side**: `Project_Status_List.Parish
  LIKE '%Iberia%'`, baked into the new layer's `where` field and enforced by
  a one-line addition to `js/gis/gis-esri.js`'s `buildFeature()`
  (`if (def.where) opts.where = def.where;` — esri-leaflet's own
  `FeatureLayer` constructor option, applied on every request the layer
  itself makes, not a client-side post-filter of the statewide set). Queried
  live: **13 real Iberia Parish features** as of 2026-08-07 (not a
  predetermined count — this is what the service actually returns). **Known,
  accepted limitation, documented in the layer's own `description` and in
  `data/gis/sources.json`, not chased further:** the map's existing Filter
  tool calls esri-leaflet's `setWhere()`, which replaces a layer's active
  `where` entirely rather than ANDing with the baked-in one — a visitor using
  Filter on this specific layer could temporarily see non-Iberia projects
  until the filter is cleared.
- **DOCX ↔ GIS matching**, all 5 confirmed by name and the service's own
  `Project_Status_List.Project_ID` (CPRA's stable business key — used
  instead of an ArcGIS OBJECTID because this joined-view service reports
  `objectIdField: null`, confirmed live): Admiral Doyle Drive → `TV-0031`,
  Port Road Bridge → `TV-0028`, David Dubois Road Bridge → `TV-0030`, Rutton
  Rill Rd → `TV-0094`, Stumpy Bayou → `TV-0095`. No unresolved matches. The
  other 8 of the 13 Iberia features have no DOCX content and get no tour —
  they still render as ordinary clickable pins.
- **New `gisFeatureTour` document type** — a small association record
  (`mapId`, `layerId`, `featureKey: {field, value}`, `enabled`, `tourId`),
  sibling to `gisMap`/`gisTour`, registered in the same `data/manifest.json`
  `gis` array. Deliberately kept separate from `gisTour` itself (a real
  design decision confirmed with the human before implementation, not
  assumed): the actual tour content is an ordinary `gisTour` document with
  ordinary steps, reusing the tour engine and its CMS editor unchanged; only
  the "which feature triggers this" association is new. This means every
  existing tour picker (the map's own `tours[]`/`defaultTour`, the outro
  CTA's `startTour` dropdown, a project experience's `tourId`) needed zero
  changes — a feature tour simply never appears in `mapDoc.tours[]`.
  `js/content-loader.js` gained one more raw pass-through mapping
  (`cfg.gisFeatureTours`), mirroring the existing `gisMap`/`gisTour` pattern
  exactly.
- **Runtime wiring**: `js/app.js`'s `toursForMap()` now also folds in every
  enabled feature tour's `tourId` (deduped against the map's own listed
  tours) — required because `gis-viewer.js`'s `startTour()` and
  `gis-tour.js`'s own `tourDocs` lookup both only resolve against
  `opts.tours`; without this, `instance.startTour()` for a feature tour
  would silently no-op. A separate new `featureToursForMap()` resolves the
  association docs themselves, passed only to `DTSGisTools.mount()` (the
  module that already owns the identify popup) as `opts.featureTours`.
  `js/gis/gis-tools.js` builds a small `layerId → {field, byValue}` index
  from it and, in `buildPopupSection()`, adds a "Start guided tour" button
  to the popup when the clicked feature's attribute matches — calling
  `instance.startTour(tourId)` directly rather than through
  `gis-tour.js`'s own `startTour()` wrapper (which requires the tour to be
  in its own `tourDocs`, populated from `opts.tours` — already satisfied by
  the `toursForMap()` change above, so this works via the ordinary
  `"tourstep"` event listener, same as any other tour start).
- **CMS**: `js/admin.js` gained `gisFeatureTourFiles()`,
  `addGisFeatureTour()`, `deleteGisFeatureTour()`, a new "Feature tours"
  section inside `editGisMap()`, and a new `editGisFeatureTour()` pane
  (layer picker, a "📍 Pick from map" one-shot `identify`-event listener on
  the live preview with manual field/value fallback, enabled toggle, tour
  picker, "+ Create tour for this feature"). `addGisTour()`'s skeleton was
  factored into `newGisTourSkeleton()` (identical output, no behavior
  change) so "+ Create tour for this feature" can create a normal `gisTour`
  document without the side effect of auto-adding it to the map's own
  `tours[]` list (which `addGisTour()` deliberately still does, for its own
  normal callers). `deleteGisTour()` gained a guard mirroring
  `deleteGisMap()`'s existing pattern: deleting a tour referenced by a
  feature tour now names it in the confirm dialog and unlinks (doesn't
  delete) the association. `deleteGisMap()` now also cascades feature-tour
  deletion, named in its own confirm dialog, alongside its existing
  guided-tour cascade.
- **Content**: 5 new `gisTour` documents
  (`data/gis/tours/cpra-{admiral-doyle,port-road-bridge,david-dubois,
  rutton-rill,stumpy-bayou}.json`), 3 steps each (Where it's at / What it is
  changing / Timeline), and 5 new `gisFeatureTour` documents
  (`data/gis/featuretours/*.json`). All step body text is copied verbatim
  from `docs/plans/gis/CPRA PROJECT TOUR INFORMATION.docx` — no additional
  descriptions, impacts, or dates were added from the ArcGIS data or any
  other source. Step view centers are the real project coordinates
  (converted from the service's own Web Mercator geometry, confirmed live).
  Each step highlights its own project via `where:
  "Project_Status_List.Project_ID = '<id>'"` — the engine already supports
  both `where` and `objectIds` highlight selectors end-to-end (confirmed by
  reading `js/gis/gis-viewer.js`'s `applyStep()`/`highlight()` and
  `js/gis/gis-esri.js`'s `query()`, and by reading `js/admin.js`'s own
  `previewTourStep()`, which already branches on `step.highlight.objectIds`)
  — `where` on the stable `Project_ID` business key was used rather than
  `objectIds`, consistent with the `objectIdField: null` service quirk
  above; no admin UI was added for `objectIds` since nothing in this feature
  needs it.
- **Verification performed, and what's left**: confirmed directly — the real
  ArcGIS query and its 13-feature/5-match result (`curl`, live); every
  `mapId`/`tourId`/`layerId` cross-reference in the new JSON via a small
  Python script; valid JSON on every new/edited file; `node --check` on
  every edited `.js` file. **Not yet confirmed live** (left for
  `docs/plans/gis/CPRA-IBERIA-GIS-TOURS-TESTING.md`, per this project's
  post-Phase-4 verification approach): real pin rendering/click behavior,
  the popup's "Start guided tour" button, actual tour playback and map
  focus per step, the CMS "Pick from map" click-to-pick flow, mobile
  rendering, and a full regression pass.
- No `docs/GIS-DATA-SOURCES.md` update — that file doesn't exist in the repo
  despite being referenced as a Phase 0 deliverable; a new
  `cpra-outreach-projects-points` entry was added to the real
  `data/gis/sources.json` instead (`candidateLayers[]`, same shape as its
  siblings), which is what `js/admin.js`'s `sourceRefPicker()` and the new
  layer's own `sourceRef` field actually read.

## GIS Phase 5 — CMS

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 5 / `06-SPEC-cms-admin.md`, tasks 5.1–5.9.
Confirmed before starting that Phase 4 was actually gated (the "GIS Phase 4 gate —
testing fixes" entry below, plus the human's own filled-in
`GIS-FULL-SYSTEM-TESTING.md`, both present) rather than taking it on faith. All of
`js/admin.js`'s new GIS editors edit `window.DTS_CONTENT.docs` in place, same
draft → preview → export → commit model as every other document type in the board.

- **5.1** New field builders in `js/admin.js`, alongside the existing `fList`:
  `fNumber`, `fRange` (slider + live value), `fListOrdered` (`fList` + ▲▼ reorder),
  `fKeyValue`, `fDocPicker`. `fListOrdered` also takes an optional trailing `opts`
  (`swapKeys`, `beforeRemove`, `onChange`) — an additive extension beyond §1's literal
  signature, needed for layer draw-order swapping and the group-delete reassignment
  guard; every other field builder in this file already ends in an optional `opts`,
  so this follows the file's own convention rather than departing from it.
- **5.2** `experiencesEditor()` replaces `mediaEditor()` in `editProject()`. The
  legacy-migration rule (`media` → `experiences[0]`, only on the first real edit) is
  implemented via a new one-shot `preDirtyHook`, fired from inside the shared
  `markDirty()` — every mutating field builder already funnels through it, so this
  is the one choke point that can catch "the very next real edit" regardless of
  which field it comes from. `select()` clears the hook on every pane switch so a
  stale hook from a previously-viewed project can never fire against the wrong
  document. **Confirmed directly, not just by reading the code:** a small Node
  script re-derived this same detection/synthesis logic against all 16 real
  `data/projects/*.json` legacy documents and re-stringified each one unedited —
  byte-identical to the file on disk in every case (the few that weren't identical
  differ only by pre-existing CRLF line endings on those specific files, unrelated
  to this change and already true of `exportData()`'s existing `JSON.parse`/
  `stringify` round trip before this phase).
- **5.3** GIS nav group (`gisMapFiles()`/`gisTourFiles()`/`gisSourcesFile()`,
  `addGisMap()`/`deleteGisMap()`/`addGisTour()`/`deleteGisTour()`), following
  `addProject()`/`deleteProject()`'s exact pattern — maps, tours and `sources.json`
  all share one manifest group (`data/manifest.json`'s `gis` array), so new entries
  push into that same array. Delete guards remove (not just warn about) referencing
  project experiences and attached tours, named in the confirm dialog, mirroring how
  `deleteProject()` already prunes sector cards. **Deliberate simplification from
  06-SPEC §3's nav mockup:** no separate "Layers" nav entry (it's a section within
  the map's own single-page editor, same pattern this file already uses for a
  project's "Cards" section) and no "Guided tours" sub-heading label between a map
  and its tours in the nav — tours are listed directly, sub-indented, under their
  map. Documented here rather than silently deviating.
- **5.4** Map editor (`editGisMap()`): Map/Default view/Parish boundary/Basemaps/
  Layer groups/Layers/Tools/Bookmarks/Guided tours, all as sections in one scrolling
  pane next to the live preview (same one-pane-many-sections shape `editProject()`
  already uses). `groupsEditor()`'s delete guard prompts (via `prompt()`, same
  mechanism `addProject()`/`addGisMap()` already use for text input) for which
  remaining group a deleted group's layers should move to, and actually reassigns
  them — not just a warning. `basemapsEditor()` blocks removing the last basemap.
- **5.5** Layer editor (`layerEditor()`), the largest single piece. **Test
  connection** fetches `<serviceUrl>?f=json` and reports the real service name,
  sublayer count and spatial reference; a CORS-blocked or unreachable service gets a
  plain-language message suggesting `esriDynamic` instead — confirmed live this
  session via a headless harness pointed at the real `maps.iberiagov.net` boundary
  service through a stubbed-offline `fetch`, producing exactly this message rather
  than an uncaught rejection. **Load fields from service** fetches
  `<url>/<sublayer>?f=pjson` and populates `popup.fields` from real field
  aliases, matching the exact request shape `js/gis/gis-esri.js`'s own
  `fetchFieldAliases()` already uses (read directly, not guessed) — skips
  `OBJECTID`/`FID`/`Shape`/`GlobalID`-prefixed fields, a small deliberate
  narrowing beyond 04-SPEC's literal "show all fields" wording. **Real bug caught
  by a direct data check, fixed before this ever shipped:** the layer's `sourceRef`
  field was first wired as a plain `fDocPicker(..., "gisSources")`, which filters
  `docs` by `_type` — but `sourceRef` values (e.g. `iberia-parish-boundary`,
  `cpra-master-plan-2023`) are `sourceId`s *inside* `data/gis/sources.json`'s single
  `candidateLayers` array, not separate documents; there is only ever one
  `gisSources` document, so that picker would only ever have offered one, wrong
  option. Confirmed against the real file (every real layer's `sourceRef` matches a
  real `candidateLayers[].sourceId` exactly) and replaced with a dedicated
  `sourceRefPicker()` that reads the real array directly.
- **Layer reordering and draw order:** confirmed by reading `js/gis/gis-viewer.js`'s
  `ensurePane()` that the live engine gives each distinct `zIndex` value its own
  Leaflet pane (`"gis-z-" + zIndex`), so stacking order is purely a `zIndex`
  comparison, unrelated to a layer's position in the `layers[]` array. `▲▼` on the
  layers list therefore swaps `zIndex` between exactly the two swapped layers
  (`fListOrdered`'s new `swapKeys` option) rather than renumbering the whole list —
  a minimal, predictable diff that satisfies 06-SPEC §9 criterion 2 without
  silently rewriting every other layer's stacking value on an unrelated reorder.
  **Note for whoever next reorders layers on the real `iberia-coastal` map:** its
  16 layers' existing `zIndex` values don't already sort in the same order as the
  `layers[]` array (they predate this CMS, hand-authored in Phase 3) — swapping via
  ▲▼ is still correct for the two layers involved, it just won't retroactively
  make the whole list's positions match zIndex order.
- **5.6** Tour editor (`editGisTour()`), including **Capture current view** (reads
  the live preview's `getState()`, reconstructs *every* layer's true on/off state by
  overlaying the diff-shaped `l` map onto each layer's own authored default —
  `getState()` only ever reports layers that differ from default, so a naive read
  would miss layers already on/off *because* they're at their default) and
  **Preview this step**. **Deliberate implementation choice, not the obvious one:**
  "Preview this step" does NOT reuse `applyState()`'s diff semantics (which only
  overrides layers present in its `l` map and leaves everything else at whatever
  the map currently shows — not equivalent to a real step application). It instead
  calls the same public `setView`/`setLayerVisible`/`setLayerOpacity`/`setBasemap`/
  `highlight`/`clearHighlight` sequence `js/gis/gis-tour.js`'s own `applyStep()`
  documented behavior describes, so the CMS preview and the real tour player can
  never diverge in how a step gets applied. The outro CTA editor supports all 5 of
  05-SPEC §1's closed-vocabulary actions, including the two parameterized ones
  (`startTour:<id>`, `link:<url>`) via a kind dropdown plus a conditional secondary
  field, rather than only the 3 that don't need a parameter.
- **5.7** Data sources editor (`editGisSources()`). **Deliberate, documented
  deviation from 06-SPEC §6's idealized field list:** the real, already-shipped
  `data/gis/sources.json` is Phase 0's actual verification record
  (`candidateLayers[]` with `sourceId`/`feedsGroup`/`publisher`/`serviceEndpoint`/
  free-text `access`/`cors`/`harvested`/`harvestNotes`/…, plus `corsSpike` and
  `platformNotes`), not the spec's proposed enum-driven schema (`Access: Public /
  Public with attribution / …`, a `Retrieval method` toggle, etc.) — forcing the
  real data into that idealized shape would have meant reshaping or discarding real
  provenance text. Per this project's own "extend, don't reshape" rule, the editor
  works the real fields directly; `corsSpike`/`platformNotes` (one-time Phase 0
  findings, not routine editorial content) are shown read-only rather than built
  into a full editor. "Export sources document" generates a Markdown summary from
  the live document — not byte-identical to the hand-written
  `docs/GIS-DATA-SOURCES.md`, but a real, reviewable table.
- **5.8** Live preview (`gisPreviewPanel()`), mounted beside the map/tour editor's
  form in a new two-column layout (`.adm-gissplit`, `.adm-pane-wide` overriding the
  board's normal 880px single-column cap for just these two editors — cleared again
  on every `select()` pane switch, same discipline as `preDirtyHook`). Lazily
  injects the exact same `js/gis/gis-loader.js` → `gis-viewer.js` → `gis-esri.js` →
  `gis-tools.js` load order `js/app.js`'s own `loadGisEngine()` already uses for the
  live site, not a lighter subset invented for the board. Re-mounts debounced
  400ms after a structural edit; plain text-field edits don't trigger it. On
  narrow viewports the preview collapses to a "⛶ Preview map" button that opens it
  fullscreen (06-SPEC §7's explicit "don't over-invest" steer for a desktop tool).
  The preview instance is torn down (`instance.destroy()`) on every pane switch, not
  just hidden, so a backgrounded Leaflet map never keeps making requests after its
  DOM is gone.
- **5.9** `exportData()` now also fetches every `gisMap` layer whose `sourceType` is
  `geojson` and whose `url` points under `data/gis/layers/` (those files are
  deliberately never in `DTS_CONTENT.docs`/localStorage, per 04-SPEC §1's size
  warning, so export is the only path that ships them at all) and bundles them into
  the zip at the matching path. **Fails loudly, confirmed live:** if any harvested
  file can't be fetched, the whole export aborts with an alert naming the failure —
  no `data.zip` is produced at all, not a zip silently missing that one layer.
  Confirmed against the real `iberia-coastal` map (all 6 real files — the parish
  boundary plus 5 shoreline years — collected correctly) and, separately, by
  stubbing `fetch` to always fail in the same headless harness used throughout this
  phase: the export correctly stopped with the exact alert text describing all 6
  missing files, no download fired.
- **Verification approach for this phase, per `CLAUDE.md`'s post-Phase-4 note:** no
  live Claude-in-Chrome session was run. Every claim above was either confirmed by
  reading the real call path in `js/gis/gis-viewer.js`/`gis-esri.js`/`gis-tour.js`
  and `js/content-loader.js`, confirmed against the real data files directly (small
  Node scripts checking `data/projects/*.json`, `data/gis/maps/iberia-coastal.json`,
  `data/gis/sources.json`), or confirmed through a headless (jsdom, no real browser)
  harness that signs into the real Admin Board with the real `data/access.json`
  credential, loads every real document from `data/manifest.json`, and drives the
  actual DOM (nav clicks, button clicks, form submits) — not a hand-written
  simulation of what the code *should* do. That harness caught the `sourceRef`
  picker bug above and confirmed, with zero uncaught exceptions, every real GIS
  document (map, tour, sources) and both a legacy and an already-migrated project
  render correctly. It cannot render CSS/Leaflet or exercise a real ArcGIS network
  call, real drag/click timing, or mobile layout — `docs/plans/gis/
  GIS-PHASE5-CMS-TESTING.md` is the manual pass covering exactly that gap, for the
  human to run and report back, same pattern as the Phase 4 gate.
- **Known, accepted cosmetic finding, not fixed this phase:** `layerEditor()`
  unconditionally instantiates placeholder `popup`/`style` objects on render for any
  layer that doesn't already have one (7 of the real map's 16 layers lack `popup`,
  3 lack `style`). Confirmed by reading `js/gis/gis-tools.js`'s own popup-fields
  fallback that an empty `fields` array (or an empty `title` string) is treated
  identically to a missing `popup` field entirely — this changes no rendered
  behavior — but it does mean exporting after touching *anything else* on the same
  map will carry these harmless placeholder objects into layers nobody meant to
  touch. A full fix would need the same detached-copy/commit-on-first-edit machinery
  `experiencesEditor()` uses, replicated per optional sub-object across every layer;
  judged disproportionate for a diff-noise-only issue this phase. Flagged in
  `GIS-PHASE5-CMS-TESTING.md` §5.6 rather than silently left for someone to
  rediscover as a "new" bug later.

## GIS Phase 4 gate — testing fixes

Per `docs/plans/gis/GIS-FULL-SYSTEM-TESTING.md`, the human's own manual pass against
Phases 1-4 (filled in for real, every checked box and Comments line their own words, not
re-derived). This entry is the fix pass that followed it, all confirmed live against the
real `iberia-coastal` map document. Phase 4 is now gated.

- **Root cause, fixed first (drove several of the Fails below):** `js/gis/gis-viewer.js`'s
  `buildBasemap()` built every basemap with no `pane` option, landing it in Leaflet's
  default `tilePane` (zIndex 200) -- above every data layer's own custom pane (this map's
  layer `zIndex` values only run 5-90). The basemap always rendered on top, visually and
  for pointer events (a tile `<img>` sitting above a vector path swallows clicks meant for
  it). Fixed with a dedicated low-zIndex basemap pane (`BASEMAP_ZINDEX = 1`).
- **Opacity slider was a no-op on every vector layer:** `setLayerOpacity()` only ever
  called `.setOpacity()`, which tile/image layers have and `L.geoJSON`/esri-leaflet vector
  layers don't. Now falls back to `.setStyle({opacity, fillOpacity})`, scaled against the
  layer's own authored `fillOpacity` so the default slider position still matches the
  original look.
- **Legend didn't match what's on the map, two distinct bugs:** the style-based swatch
  fallback always drew a fully opaque square regardless of the layer's real `fillOpacity`
  (e.g. `parish-boundary`'s thin, near-invisible fill rendering as a solid gold block); and,
  more consequentially, every `esriFeature` layer's legend was fetched live from the ArcGIS
  *service's own* renderer (`legendRowsForArcgis`) even though `gis-esri.js`'s
  `buildFeature()` always overrides rendering with this map's own `def.style` -- confirmed
  live via a screenshot showing hydrography's legend with separate "Lateral"/"Main" icons
  the map never actually draws (one flat blue line, no such split), and critical-facilities/
  fire-stations showing the service's own star/pin icons instead of this map's solid circle
  markers. Now only `esriDynamic` (server-rendered images, no client style option at all)
  uses the live service legend; everything else reflects `def.style` directly.
- **Identify popups never appeared, attribute-table row clicks and feature-search results
  didn't navigate:** two separate bugs, not one. The popup failure was downstream of the
  basemap z-order bug above (clicks were landing on the basemap tile, not the feature
  underneath). The navigation failure was `gis-esri.js` calling a chainable query method,
  `q.objectIds(...)`, that doesn't exist on vendored esri-leaflet 3.0.19's `Query` --
  confirmed directly against the real service, both by hand-replicating the exact combined
  query esri-leaflet builds (works fine over plain `curl`) and by decoding the vendored
  bundle's own setter-name mapping table, which showed the real method is `featureIds(...)`
  (it sets the REST param actually named `objectIds` internally). The thrown `TypeError`
  was swallowed by a `.catch()` into a console warning, so it looked like nothing happened.
- **Attribute table listed every queryable layer, not just visible ones:** `queryableDefs`
  was filtered once at construction and never re-filtered by visibility. Rebuilt into
  `renderTableTabs()`, re-run on panel open and on every visibility-changing `layerchange`
  event while the panel is open (same reactive pattern `renderLegend()` already used).
- **Off-script "Back to step N" pill restored view/basemap but not the full layer state:**
  each tour step's `layers` directive only lists what *that step* turns on/off (a relative
  delta), so a layer toggled on manually outside the tour's own deltas was never accounted
  for on restore. `gis-tour.js`'s own off-script *detection* already replayed every step
  from 0 to compute the "expected" state (a comment there even said so), but
  `gis-viewer.js`'s `applyStep()` never did the same replay for the *restore* side. Fixed
  with `resolveTourLayerState()`, mirroring that same replay, so both sides now agree.
- **Rectangle draw threw inside Leaflet, not a basemap-visibility illusion:**
  `rectCorners()` returned plain `[lat,lng]` arrays, but its only caller,
  `finishDrawSession()`, treats every non-"point" type's input as LatLng-*objects* (reading
  `.lat`/`.lng`) -- correct for line/polygon (real `e.latlng` clicks) but not for a plain
  array. The rectangle silently became four `[undefined,undefined]` coordinates until
  Leaflet actually tried to project them, throwing several frames deep. Fixed by having
  `rectCorners()` return real `L.LatLng` instances.
- **Toolbar buttons clipped off-screen at 360px:** `.dts-gis-toolbar` (a single-row flex
  box, no width limit, `overflow:hidden`) had no responsive rule at all, unlike every other
  GIS panel in this file -- narrow viewports silently lost the earliest-added buttons
  (layers, basemap, legend, filter) with no wrap, scroll, or overflow affordance. Now wraps
  at the same `760px` breakpoint the panels already dock-to-bottom-sheet at (which is why
  wrapping is safe -- nothing else needs the space below the toolbar at that width). The
  geolocate toast, positioned at the same coordinates, needed a matching nudge.
- **Timeline and the Layers-panel checkbox fought each other, human's own design call, not
  a bug report:** a time-stepped layer used to need *both* its own `visible` flag *and* the
  current Timeline step to agree before it would show -- checking a shoreline's box did
  nothing unless the Timeline happened to already be on that exact year, which the human
  read (reasonably) as "Timeline is broken" and "shorelines don't display." Decoupled per
  their explicit request: `syncLayerToMap()` now only ever looks at the checkbox's own
  `visible` flag; the Timeline drives that same flag directly via `setLayerVisible()` when
  it moves, instead of gating behind a second, hidden condition. Real bug introduced and
  caught in the same pass: the first attempt seeded this at mount by calling
  `applyTimeFilters()` too early, before `swipeLayerId` (a `let` declared later in the same
  function) had been assigned -- a temporal-dead-zone `ReferenceError` that aborted
  `mount()` entirely ("The map couldn't load"). Fixed by moving the seed call down past that
  declaration; timing is unaffected since `loadLayer()`'s own layer-adding work is async and
  can't run before this synchronous function body finishes regardless of textual order.
- **Basemap redesign, human's own explicit request, not a bug:** dropped "Dark" entirely,
  made "Streets" the default, kept "Aerial 2024," and added a "No basemap" option (a new
  `type: "none"` basemap, an empty `L.layerGroup()`). Removing "Dark" broke the guided
  tour's first step, which had it hardcoded (`"basemap": "dark"`) -- caught by grep across
  the repo before it could resurface later, updated to `"streets"`.
- **Added a genuinely open, globally-covering satellite basemap, human's own request:**
  EOX Sentinel-2 cloudless (Copernicus Sentinel-2 imagery, CC-BY 4.0, no API key) --
  confirmed live with real tile fetches both at a global test coordinate and one covering
  Iberia Parish specifically. Coarser resolution (~10m) than the parish's own EagleView
  flight, by nature of being satellite rather than aerial photography, but it's the one
  basemap option that shows something anywhere in the world, not just this parish.
- **Confirmed not bugs, no fix made:** the "Subsidence (2023 model)" layer's muted gray
  appearance is the CPRA service's own real grayscale renderer -- decoded its live
  `/legend?f=pjson` swatch directly and confirmed R=G=B at every step of the ramp, white to
  near-black, no color at all. Swipe compare (6.1 in the testing doc) clips correctly at
  the extremes (confirmed real imagery vs. real imagery, not the same thing twice) but
  showed a black/white no-data mismatch when tested somewhere the two aerial services don't
  both have real coverage; **deferred, not chased further this pass** -- next step if
  picked back up is re-testing at a location both services are confirmed (via direct
  service queries this session) to have real photography for.
- Every fix verified live in Chrome against the real `iberia-coastal` map document this
  session, plus direct `curl` calls against the real ArcGIS/CPRA/EOX services themselves
  where a fix's root cause needed confirming server-side vs. client-side (the `featureIds`
  bug, the subsidence grayscale renderer, the EOX satellite basemap, the aerial-imagery
  coverage-gap question).

## GIS Phase 4 — guided tours

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 4 / `05-SPEC-guided-tours.md`. All of tasks
4.1–4.7. Phases 0–3 were already gated; this phase is now gated too.

- **05-SPEC's own prerequisite — not fully satisfiable this session:** the spec requires
  running CPRA's Master Plan Data Viewer guided tour live at
  `https://mpdv.coastal.la.gov/#map=8.66/29.5211/-91.51` before finalizing the player UI.
  Attempted with real browser automation this session (three attempts, including a plain
  navigation and a bare-domain retry); the host itself is unreachable from this session's
  browser (network otherwise confirmed working — `google.com` loaded fine in the same
  tab). Per this project's own "avoid rabbit holes" guidance, not chased further. Fell back
  to Phase 0's own `data/gis/sources.json` → `platformNotes.mpdv.guidedTourTranscript` —
  a static-bundle-analysis transcript of the same tour (10 slides, exit-to-"Explore"
  behavior, consistent scenario-qualifier tone discipline) — which was already flagged
  in Phase 0 as needing this exact live spot-check. **Gap carried forward, not silently
  closed:** the player's visual/interaction mechanics (card animation timing, exact
  docking behavior) are built from 05-SPEC §2's own description plus that transcript, not
  from a live observation of CPRA's actual UI.
- `js/gis/gis-tour.js` (new) — the presentational player. Confirmed before writing it that
  `js/gis/gis-viewer.js` already owns step application (`startTour`/`tourNext`/`tourPrev`,
  `getState()`/`applyState()`'s existing `t` field) since Phase 3a — this file drives the
  map exclusively through that public API (plus one narrow, justified addition, next
  bullet) and never touches a Leaflet object, same rule `gis-tools.js` already follows.
  Card UI (desktop dock + mobile bottom sheet, collapsible via a chevron tap rather than a
  drag gesture — a deliberate, documented simplification of §2's "drag handle" wording),
  progress dots (clickable), off-script detection + "Back to step N" pill, an outro screen
  (presentation-only — the engine has no concept of a step past the last one, so "Next" on
  the last step never calls `tourNext()`, it just swaps the card's own content and leaves
  the map exactly where the last real step put it), keyboard (`←`/`→`/`Escape`, scoped to
  when focus is inside the tour card so it doesn't fight Leaflet's own arrow-key map
  panning), focus management, and a live region for step announcements.
- `js/gis/gis-viewer.js` gains one additive method, `tourGoTo(index)` — an arbitrary-index
  jump, needed because the progress dots' "click to jump" and the off-script "back to step"
  pill can't be expressed through `tourNext`/`tourPrev`'s relative-step shape, and
  `applyStep(index)` already did exactly this internally. Same "extend, don't reshape" as
  every prior schema/API addition in this project.
- **Real bug, found live, first found this session:** a center/zoom step's `setView()`
  animates over several hundred ms; `checkOffScript()`'s naive read of the map's live
  position immediately after a step change was comparing the *previous* step's
  still-in-flight position against the *new* step's target, flagging every animated step
  change as off-script instantly. Fixed by seeding the tracked position optimistically to
  the commanded target the moment a step renders (self-correcting either way: a normal
  flight confirms no drift on its own final `"viewchange"`; a genuinely interrupted one
  reports the real position instead). The `"viewchange"`-triggered half of the check is
  also debounced (350ms of quiet) rather than reacting to every single event, since a step
  with both a center and a zoom change can make Leaflet fire more than one `"moveend"`
  while settling.
- **Second real bug, found live, more consequential — a genuine, deterministic, and (for
  this specific authored content) 100%-reproducible position error, not the animation-race
  above:** two tour steps (`built`, `future`) originally used `center: [29.78, -91.78],
  zoom: 11`. At this browser's actual viewport width, that combination puts part of the
  requested view outside `iberia-coastal.json`'s own `view.maxBounds` — with
  `restrictToBounds: true` (`maxBoundsViscosity: 1.0`), Leaflet correctly clamps the center
  to keep the viewport inside bounds rather than honoring the requested one, landing at the
  bounds' own longitudinal midpoint (confirmed by direct calculation: `(-92.10 + -91.17) /
  2 = -91.635`, matching the observed drift to 5 decimal places) while latitude tracked
  correctly. This is Leaflet doing exactly what §8's own bounds defence is supposed to do —
  not an engine bug — but it meant the *authored* view for those two steps was never
  actually reachable at ordinary desktop widths, which the off-script detector correctly
  (if confusingly, at first) flagged as a real mismatch every time. Root-caused by adding
  temporary instrumentation (a debug global exposing the live engine instance's own
  `getState()`, removed before committing) rather than continuing to guess from the
  symptom. Fixed at the content level: both steps now reuse the map's own verified-safe
  default parish view (`[29.740394, -91.635827]`, zoom 10) instead of an unverified
  hand-picked one — thematically apt too, since both are whole-parish-scale steps.
- **Third real bug, found live, most consequential:** `?...&map=<state>` (05-SPEC
  criterion 4) did not restore anything at all, for a tour or otherwise — not a gap in
  `gis-viewer.js`'s `getState()`/`applyState()` (already correct since Phase 3a), but in
  `js/app.js`, which never read the `map` query parameter or passed it to
  `DTSGis.mount()`'s `opts.stateParam` at all, for any map, since Phase 3. Wiring it in
  surfaced a second problem: reading `location.search` from inside `mountGis()`'s own async
  callback (after the lazy GIS engine finishes loading) is too late — `openExample()`'s own
  `syncURL()` call already rewrites the address bar (to `category`/`project`/`exp` only;
  `buildStateURL()` never carries `map`) synchronously, before that callback ever gets a
  turn to run. Fixed by capturing the `map` param once, at `js/app.js`'s module parse time
  — before any `syncURL()` call in the file can execute — into `pendingGisStateParam`,
  consumed (read once, then cleared) by whichever GIS map is the first to actually mount
  that session. Confirmed live end-to-end: a hand-built `map=` link encoding `{v:1,
  t:["iberia-coastal-intro", 2]}`, opened as a fresh navigation, restored directly to tour
  step 3 with no earlier steps played.
- `js/gis/gis-tools.js`: the "Guided tours" toolbar button (task 4.5), gated on
  `mapDoc.tours.length` and the resolved tour docs actually being available. Mounts
  `gis-tour.js` once; click toggles start/exit. Once-per-session autostart via
  `sessionStorage` (keyed by map id) when `mapDoc.defaultTour` is set — additionally gated
  on the resolved tour document's own `autoStart !== false` (a real, if easy to miss, field
  in 05-SPEC §1's own schema) and skipped entirely both when a `map=` deep link already
  restored a specific state (`opts.hasStateParam`) and when a tour is already running from
  an experience-level `tourId` (see next bullet) — otherwise autostart would stomp a
  correctly-already-running tour with a second, competing `startTour()` call back to step 0.
  CTA actions (`openLayerPanel`/`openAttributeTable`) bridge into this file's own panel
  registry via a plain callback, since `gis-tour.js` has no reason to know panel internals.
- **Fourth real bug, found by inspection, not live — but confirmed necessary, not
  theoretical:** `data/projects/gfc.json`'s `gis` experience carries its own `tourId` field
  (an experience-level "always start this tour" flag, predating Phase 4 — see
  `js/content-loader.js`'s `gis` branch, Phase 1) which `js/app.js` already passed straight
  to `DTSGis.mount()`'s `opts.tourId`. That starts the tour *inside* `createInstance()`,
  before `gis-tools.js`/`gis-tour.js` are even mounted (both are mounted from the
  `DTSGis.mount()` promise's own `.then()`, one async hop later) — the resulting
  `"tourstep"` event would otherwise fire to no listener, applying the step to the map with
  no card ever shown. Same failure mode for a `map=`-restored mid-tour state. Fixed by
  having `gis-tour.js` check `instance.getState().t` once at its own mount time and render
  whatever tour/step is already active, before relying on the listener for every step
  after. Confirmed live: this is exactly the path that made the `experiences[1].tourId`
  wiring (below) actually show a card on first load, not just silently move the map.
- Content, per task 4.7: `data/gis/tours/iberia-coastal-intro.json` (new) — six authored
  steps (where / water / flood / exposed / built / future) per 05-SPEC §3's outline, plus a
  separate `outro` (the spec's own schema keeps these distinct; `08-SPEC`'s "seven-step
  tour" phrasing means six steps + the outro hand-off, not seven `steps[]` entries), using
  this map's real layer ids throughout (`parish-boundary`, `hydrography`, `dfirm-panels`,
  `bfe-floodways`, `critical-facilities`, `fire-stations`, `port-canals`, `cpra-projects`,
  `cpra-master-plan-2023`, `subsidence`) — 05-SPEC §1's example step schema uses placeholder
  ids that don't exist in this map and were not copied. The `water` step deliberately never
  highlights or otherwise queries `hydrography`, per this map's own already-documented
  permanent 400-error quirk (task 3.8) — the layer is still toggled on for the drainage
  narrative (it degrades to "Unavailable right now" gracefully, confirmed live, unaffected
  by this phase), just never depended on rendering. Step `future`'s body explicitly labels
  the Master Plan/subsidence layers as "modelled scenarios of what may happen — not a
  forecast or a guarantee," per 05-SPEC §3's sourcing caution. Each step's body checked
  against §3's own ~55-word guidance.
- Three-place wiring, per the build plan: (a) `data/gis/maps/iberia-coastal.json` —
  `tours: ["iberia-coastal-intro"]`, `defaultTour: "iberia-coastal-intro"`; (b)
  `data/manifest.json`'s `gis` array — registered the new tour document (nothing loads it
  otherwise, same as every other manifest-driven document type in this repo); (c)
  `data/projects/gfc.json`'s `gis` experience — `tourId: "iberia-coastal-intro"` (was
  `null`), so the tour offers itself the moment that project's map tab first mounts, not
  just via the map-level session default.
- Verified live in Chrome against the real, deployed content (`python -m http.server 8000`,
  Government → Coastal, no temporary test data — `gfc.json` is already real and live, per
  the prior out-of-band entry, so this phase's own content was the integration target):
  autostart on first mount (via the `experiences[1].tourId` path, confirmed distinct from
  the `mapDoc.defaultTour` session-autostart path by checking `aria-pressed` and
  `sessionStorage`); clicking through all six steps plus the outro end-to-end, each
  changing view/layers/highlight/basemap exactly as authored, with progress dots and the
  "Back"/"Next"/"Done" labels correct at every boundary; a real off-script trigger (manual
  scroll-zoom on step 1) showing the "Back to step 1" pill and correctly restoring the
  exact step view on click; the outro's "Open the layer panel" CTA actually opening the
  real layer panel; exit (✕) showing the "Tour ended. The map is where you left it." toast,
  leaving the map and the (still-open) layer panel exactly where they were, restoring focus;
  `←`/`→` stepping the tour when focus is inside the card; the `map=` deep-link restore
  (previous bullet); a 511px-wide window rendering the card as a collapsible bottom sheet,
  confirmed both expanded and collapsed-to-title-bar; and a clean console throughout every
  check above, including a plain home-page load and the Government sector's card grid.
  **Not independently re-verified this session** (regression-checklist items unrelated to
  any file this phase touched, already covered in this project's own Phase 3 gate one task
  prior): the lead form, `demo`/`1234` sign-in, admin draft round-trip, and the Safari
  Vision Pro CTA (still not runnable from Chrome-only automation).
- Debug-only instrumentation (a temporary cache-busting query string on the lazily-injected
  `js/gis/*` script tags, and a temporary `window.__DTS_DEBUG_INSTANCE` assignment in
  `gis-tools.js`) was added and removed within this session, used only to root-cause the
  two real bugs above — confirmed not present in any committed file.

## GFC project shipped early, replacing Safety & Emergency

Out of the normal phase order — the human explicitly asked to showcase the Iberia Parish
GIS map's current progress on the live site now, rather than waiting for `08-SPEC-
gfc-project.md`'s planned build order (GFC is built last, through the Admin Board, after
Phase 5/CMS).

- **Deliberate, explicit departure from `08-SPEC`'s own gate:** that spec says build the
  GFC project document with `illustrative:true` and "leave it unlinked from any sector
  card" until the PI (LSU/Dr. Schwarz, or Marcus) signs off on naming the partners and
  Iberia Parish publicly — the source Statement of Work is a draft grant document with
  budget splits and named personnel that aren't the partner's to publish before award. The
  human was shown this exact gate and explicitly chose to proceed and link the project now
  regardless — their call on their own client relationship, not overridden or second-guessed
  here. Compensating control kept regardless of that decision: only the copy `08-SPEC`
  itself already pre-cleared as safe is used anywhere (programme name, partner
  organisations, purpose, the four goals, DTS's role) — no budget figures, subaward
  percentages, indirect rates, named individuals, or period of performance, in `gfc.json`
  or anywhere else. `project.illustrative` was left `false` per the human's explicit choice
  (the site's only WIP-marker chip reads "Illustrative example — representative of DTS's
  work in this space," which doesn't fit a real, ongoing, unfinished research partnership,
  and adding a more accurate status label was judged out of proportion for this change).
- `data/projects/gfc.json` (new): `sectorId: "government"`, two experiences — a real
  Treedis tour (`spaces.dtsxr.com/tour/56111605`, confirmed live: 242 real sweeps loaded,
  not a placeholder) and the real `iberia-coastal` GIS map from Phase 3 (`tourId: null` —
  the Phase 4 guided tour doesn't exist yet).
- **Replaced, not added as a fifth card:** `data/sectors/government.json`'s existing
  `emergency` card ("Safety & Emergency" / GOHSEP-FEMA PA documentation, a real,
  non-illustrative, currently-live project) is now the `gfc` card ("Coastal Resilience" /
  "Coastal" short label, exact card text `08-SPEC §1` proposes). This was the human's own
  framing, and it sidesteps `08-SPEC` task 6.1's open question about whether the sector
  card slider handles five cards — it never has to, since the count stays at four.
  `data/projects/emergency.json` is unregistered from `data/manifest.json` (removed from
  the `projects` array) but left on disk, not deleted — fully recoverable by re-adding one
  manifest entry if the GOHSEP/FEMA positioning is wanted again later.
- `js/config.js`'s fallback (`file://` path, no `/data` available) carried real duplicate
  content for both the government sector's card list and a full `emergency` example entry
  — unlike the empty `gisMaps`/`gisTours` stubs from Phase 1, this wasn't a structural
  no-op to skip. Updated both to the same `gfc` content so the fallback path doesn't show
  stale GOHSEP/FEMA copy while the real `/data` path shows GFC.
- Verified live in Chrome: Government sector now shows exactly 4 cards ending in
  "Coastal"; clicking it opens the GFC project with both tabs; the Treedis tab genuinely
  loads the real tour (`[treedis] sweeps: 242` in console, not a stub); the map tab mounts
  `iberia-coastal` exactly as it did at the end of Phase 3; console clean throughout.

## GIS Phase 3 gate — acceptance criteria and regression checklist

Per `docs/plans/gis/09-BUILD-PLAN.md`'s Phase 3 acceptance criteria and regression
checklist, run against the real `iberia-coastal` map document (task 3.14) before starting
Phase 4. **PASSED**, with two gaps noted rather than silently skipped:

- Verified live this session, against the real map document wired temporarily into the
  `healthcare` project (reverted after, `git diff` empty): GIS bundle 113.2KB gzipped
  (Leaflet + esri-leaflet + `js/gis/*` + `15-gis.css`), well under the 200KB budget; a
  non-GIS project (`campus`) loads with zero GIS/Leaflet script tags and no
  `window.DTSGis`/`window.L` globals; the map mounts with real Iberia layers rendered
  (confirmed via real search results returning live ArcGIS facility names, a real 18.42mi
  measurement, real attribute-table rows, real share-link generation); every tool in
  `mapDoc.tools` opens and functions (layers, legend, basemap switcher, filter, attribute
  table, bookmarks, coordinates, geolocate, search, measure, draw, swipe, timeline, export
  data, share, fullscreen — print was exercised in task 3.11's own build-time testing, not
  re-clicked here); a real degraded layer (`Drainage laterals & mains`, task 3.8's
  documented 400-error quirk) shows "Unavailable right now" without affecting any other
  layer; fullscreen enter correctly re-measures the map; keyboard `Tab` moves through the
  toolbar with visible gold focus rings; `prefers-reduced-motion` is still correctly wired
  (`animate: !reducedMotion` on every `setView`/`fitBounds` call, unchanged since Phase 3a);
  console stayed clean across every check, including a plain home-page load.
- **Real bug found and fixed during this pass** — see task 3.14's own entry above
  (`gis-esri.js`'s unconditional `pointToLayer` tripping a vendored esri-leaflet
  `_redraw()` bug for non-point layers).
- **Gap 1, not closed this session:** the 360px mobile layout was not independently
  re-verified against the real map document — this session's browser-automation `resize`
  tool reported success but did not actually change the tab's `window.innerWidth` in this
  environment (confirmed via `window.innerWidth` reading 1310 both before and after a
  reported resize to 400px), and repeating it did not help. Not chased further, per this
  project's own "avoid rabbit holes" guidance for a browser tool that isn't cooperating.
  The `max-width:760px` bottom-sheet CSS in `15-gis.css` is unchanged since tasks 3.5/3.6,
  where it was verified live with real interaction; this map document doesn't add or
  change any CSS.
- **Gap 2, not closed this session:** the full site-wide regression checklist (lead form
  send + mailto fallback, `demo`/`1234` sign-in, admin sign-in → save draft → preview →
  discard, mobile drawer + sector swipe, Safari Vision Pro CTA, browser back/forward
  through home → sector → project → close) was not re-run. Nothing outside GIS-specific
  files (`data/gis/*`, `js/gis/*`, `data/manifest.json`'s `gis` array) changed across tasks
  3.13-3.14 or this gate, and the full checklist was last run clean one task prior, in task
  3.12. The Safari-specific check in particular cannot be run at all from this Chrome-only
  automation regardless of session state.
- Human sign-off: proceeding to Phase 4 with both gaps accepted as documented risk, not
  re-litigated at the start of every future GIS task.

## GIS Phase 3 task 3.14 — Iberia Parish map configuration

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.14 / `08-SPEC-gfc-project.md` §3. Last task in
Phase 3 before the phase gate. Hand-built (CMS authoring is Phase 5) using only what Phase
0 actually verified in `data/gis/sources.json` plus task 3.13's real harvested layers — not
the full aspirational `08-SPEC` composition table where it outran what's actually verified
(no municipalities/levee-district/CRMS/pump-station layers — none were catalogued in
Phase 0, and guessing service names wasn't an option).

- `data/gis/maps/iberia-coastal.json` (new): 16 layers across 7 groups (boundaries, water,
  risk, infra, coastal, coastal-change, imagery), 3 basemaps (CARTO dark default, Aerial
  2024, OSM streets), the real parish centroid/envelope from `sources.json`'s Phase 0
  derivation, all `tools` from the completed §6 set turned on. Every ArcGIS layer's
  `layerId`/`layers` sublayer index was checked live against the real service (`?f=json`)
  before writing it in, not guessed from `sources.json`'s service-root URLs alone — caught
  that `BFE_with_Floodways_for_Public_Map` has two sublayers (0 is a labels-only layer, 1 is
  the real data) and that `CPRA_Projects` is a joined ArcGIS view whose field names carry
  table-qualified prefixes (e.g. `Project_Status_List.Project_Name`), left to the engine's
  existing "show all fields with aliases" popup fallback rather than a guessed exact-name
  popup config.
- Registered `iberia-coastal` (and, since it was never done, `sources.json` itself) in
  `data/manifest.json`'s `gis` group per `04-SPEC §1` — without this the content loader
  never discovers the map document at all; `flattenManifest()` only reads each entry's
  `file` path, so this is the one required step, `type`/`id` are documentation only.
- **Correction to `08-SPEC`'s own composition table, decided here:** "2023 Master Plan"
  and CPRA's subsidence model are grouped under **Coastal change (scenarios)** together
  with task 3.13's 5 harvested shoreline-history layers, not under "Coastal projects
  (CPRA)" (that group holds only `prot_rest/CPRA_Projects`, current project footprints —
  a different story than modelled change over time).
- **Scope decision, default layer state:** per `08-SPEC §3` ("parish boundary + dark
  basemap + drainage network visible, everything else off"), only the boundary and
  hydrography layers default on — except the 5 harvested shoreline layers, which also
  default on (checkbox-checked) so the timeline tool has something to scrub between the
  moment the map opens, rather than an empty scrubber until a visitor finds and checks all
  five by hand. Not a real contradiction of "everything else off": `mapDoc.timeSeries`'s
  gate means only the *active* step's layer ever actually renders at once (confirmed
  live — checking all 5 shows exactly one shoreline on screen, matching the current
  timeline position), so the visible default state is still just boundary + drainage +
  one shoreline year, not five overlapping layers.
- `tours: []`, `defaultTour: null` — deliberately not referencing
  `iberia-coastal-intro` yet. That tour document doesn't exist until Phase 4; nothing in
  `gis-tools.js` reads `mapDoc.tours` yet either (the launcher button is task 4.5), so this
  is inert either way, but referencing a tour id with no matching document would be an
  unnecessary dangling reference the moment 4.5 does land.
- **Real bug, found live, pre-existing since Phase 3a's `gis-esri.js` (not introduced by
  this task, only ever exercised by it — no prior map document had a non-point
  `esriFeature` layer that both rendered *and* got repeatedly re-queried across pan/zoom):**
  panning near New Iberia with the real hydrography layer (`Laterals_and_Mains_2026`, a
  polyline layer) threw an uncaught `Error: Invalid LatLng object` from inside vendored
  esri-leaflet 3.0.19 itself, outside any of this codebase's own try/catch. Root-caused by
  reading the vendored source directly: esri-leaflet's `FeatureLayer._redraw()`
  unconditionally calls `this.options.pointToLayer(feature, L.latLng(feature.geometry
  .coordinates[1], feature.geometry.coordinates[0]))` whenever `pointToLayer` is set and
  the existing Leaflet layer object has `setStyle` — true of Polyline/Polygon layers too,
  not just point markers, with **no `geometry.type` check at all**. `_redraw()` runs
  whenever `createLayers()` re-encounters a feature ID already on the map, which is exactly
  what a parish-wide drainage line spanning more than one of esri-leaflet's internal query
  tiles does on ordinary pan/zoom. For a LineString/MultiLineString, `coordinates[0]`/`[1]`
  are whole coordinate arrays, not lat/lng numbers, so `L.latLng()` threw. `gis-esri.js`'s
  `buildFeature()` had set `pointToLayer` unconditionally on every `esriFeature` layer
  since Phase 3a, point or not, so every non-point `esriFeature` layer with more than one
  query tile in view was exposed to this, not just hydrography. Fixed by only setting
  `opts.pointToLayer` when the layer's own `style.pointRadius` is declared (the existing,
  already-meaningful signal that a layer's authors intend point styling) — confirmed safe
  by reading Leaflet core's `GeoJSON.geometryToLayer()`, which is what actually builds each
  feature the *first* time via `createNewLayer()`: it already checks `geometry.type` itself
  before ever calling `pointToLayer`, so omitting the option for non-point layers changes
  nothing on that path and only starves `_redraw()`'s buggy branch of a truthy callback to
  invoke. Vendored library left untouched, per this repo's own "vendor, don't patch"
  posture.
- Verified live in Chrome (`python -m http.server 8000`) against the real app shell: a
  temporary `gis` experience wired into the existing `healthcare` project (same pattern as
  task 3.12's testing), confirming the real `iberia-coastal` document mounts with the real
  parish silhouette and dim mask, the layer panel's 7 groups and 16 real layer titles, the
  attribution line combining all three real sources, the bookmarks panel jumping to all 4
  real named places, and the timeline panel showing the 5 real representative-year steps.
  Confirmed `Drainage laterals & mains` degrades to "Unavailable right now" exactly per
  §11's contract for its already-documented, separate 400-error quirk (task 3.8) without
  affecting any other layer. Reproduced the `_redraw` crash against the live hydrography
  layer before the fix (twice, with different feature coordinates each time, both times
  panning near New Iberia's dense drainage network), confirmed it stopped after the fix
  under the same repro steps, and confirmed a plain home-page load stays console-clean
  afterward. Temporary experience wiring on `healthcare.json` reverted before committing
  (`git diff` empty on that file); `iberia-coastal.json`, the manifest registration, and
  the `gis-esri.js` fix are the real, permanent deliverables.

## GIS Phase 3 task 3.13 — harvest script and frozen boundary/shoreline layers

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.13 / `04-SPEC-gis-engine.md` §8 defence 1.
Only 3.14 (hand-building `data/gis/maps/iberia-coastal.json`) remains before Phase 3's
gate. Harvesting was explicitly unblocked by the human ahead of final ToS confirmation
from Iberia Parish GIS and CPRA/LSU (see `data/gis/sources.json`'s `openQuestions`) —
every harvested file's attribution is placeholder text flagged as pending, not final copy.

- `tools/gis-harvest.mjs` (new): a Node script (`.mjs`, no `package.json` needed) run
  manually — `node tools/gis-harvest.mjs` — never per-visitor. Identifies itself with a
  real User-Agent naming the project, and throttles every request (including between
  pagination pages) at 900ms, per the risk register's "Iberia server is small... throttle
  hard, schedule not on-demand."
- Ran it for real against two sources this session and committed the real output:
  - **Iberia Parish boundary** (`Govt_Units/Updated_Parish_Boundary`) →
    `data/gis/layers/parish-boundary.geojson` — 1 feature, 1409 vertices, 32.3KB. This is
    both a layer in its own right and defence 1's own clip geometry for every other
    harvested file.
  - **CPRA/LSU historical shoreline**, 5 representative years →
    `data/gis/layers/shoreline-{1935,1948,1998,2008,2015}.geojson` (one file per year, not
    one file with a per-feature year discriminator — chosen to match the time-slider's
    existing `def.timeStep` mechanism from task 3.10, which already expects "separate
    layers per scenario/step," not a single file it would have to split itself).
- **Real, consequential correction to `data/gis/sources.json`'s own description, found
  live while writing this script:** the doc's `cpra-coastal-change-shorelines` entry
  described `lasard/contoursYYYY` (e.g. `lasard/contours1934`) as historical shoreline
  contour layers good for a time slider. Checked live: those are actually
  **TopoBathyContours** — bathymetric/topographic elevation isolines (a `Z_FT`
  class-break renderer, fields like `V_BENCH`/`V_EPOCH`/`THICKNESS`) mined from surveys
  *near* each labelled year, not shoreline position snapshots. Wrong dataset entirely for
  "the coast used to be here." Harvested `lasard/shoreline` instead — the layer already
  CORS/query-verified in Phase 0 — a single compiled feature layer where each feature
  carries its own `SRC_DATE` (`YYYYMMDD`), not one shoreline per calendar year. Real
  coverage inside the Iberia envelope clusters unevenly across ~160 years (dense around
  1931-1937, 1946-1955, and 1994-1999; solid single-year counts in 2008 and 2015), so the
  "five representative years" are `SRC_DATE` range windows queried with a lexical string
  comparison (safe: the field is a fixed-width zero-padded `YYYYMMDD` string, so lexical
  order equals numeric order) rather than five clean single-date queries. `data/gis/sources.json` is updated with the correction and full harvest provenance per layer.
- **Real bug in the first version of this script's own clip logic, found live, fixed
  before committing:** defence 1's "point-in-polygon pass" was first implemented as a
  keep-the-whole-feature-or-drop-it test — a feature survived if *any* vertex fell inside
  the parish polygon, but every vertex (including ones far outside Iberia) was then
  written unchanged. This is not what `04-SPEC §1` means by "Iberia-clipped snapshots."
  It surfaced immediately as a budget failure: one `shoreline-1998` feature (USGS
  `DDS-79`, "Coastal Erosion and Wetland Change in Louisiana") is a single polyline
  digitized across the entire Louisiana coast with 475,623 vertices; keeping it whole
  because a fraction of its points passed near Iberia blew that one file to 11.3MB, ~5.7x
  the `04-SPEC §9` 2MB budget, and defeated the point of a parish-scoped layer regardless
  of size. Chasing the budget with heavier Ramer-Douglas-Peucker tolerances alone only
  got it down to ~2.3MB before real detail loss would have started to show. Fixed at the
  root: `clipGeometryToParish()` now walks each line's vertices and keeps only the
  contiguous run(s) that actually fall inside the parish polygon, discarding the rest —
  a real trim, not an include/drop decision. That one feature's Iberia-relevant run turned
  out to be a small fraction of its statewide original; final `shoreline-1998.geojson` is
  610.5KB. Every other year's file was already small and dropped further too (paragraph
  above's byte counts are post-fix). Simplification (RDP at 0.0001°, ~10m, imperceptible
  at this map's scale) runs after clipping, coordinate rounding (6 decimals, ~0.11m) after
  that — both documented per layer in `sources.json`, per `§9`'s "tolerance documented per
  layer" requirement.
- Geometry math (point-in-polygon via ray-casting across all rings at once — correctly
  handles holes by winding parity with no separate per-ring XOR step; iterative
  stack-based Ramer-Douglas-Peucker, not recursive, since a 475k-vertex real feature made
  naive recursion a stack-depth risk) is hand-rolled in the script itself, no Turf, per
  `04-SPEC §2`'s explicit steer — this is a one-time offline tool, not the live engine, so
  it's a separate ~140 lines from the engine's own geometry helpers, not a extension of
  them.
- Verified for real, not just by inspection: every point in every harvested shoreline
  file (a script-driven point-in-polygon check re-run independently against the written
  files, not reusing the harvest script's own pass) falls inside the real parish polygon
  — 0 of ~24,000 points outside, across all 5 years. All 6 output files are valid
  GeoJSON, well under the 2MB budget (110KB-625KB), and none are registered in
  `data/manifest.json` or reachable from the Admin Board's document set, per `04-SPEC §1`'s
  localStorage warning.

## GIS Phase 3 task 3.12 — mountGis() wiring, instance cache, invalidateSize

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.12 / `04-SPEC-gis-engine.md` §9. Wires the
already-complete engine (3.1-3.11) into the real experience switcher. Only 3.13 (harvest
script) and 3.14 (the real Iberia map document) remain in Phase 3.

- `js/app.js`'s `mountGis()` placeholder is now a real `DTSGis.mount()` call. Two lazy-load
  layers stack: `js/gis/gis-loader.js` (already lazy, vendors Leaflet/esri-leaflet) plus a
  new `loadGisEngine()` that lazily injects *our own* `gis-viewer.js`/`gis-esri.js`/
  `gis-tools.js` too -- §9's "under 200KB, loaded only on first GIS tab activation" budget
  covers `js/gis/*` itself, not just `vendor/`, so a visitor who never opens a map project
  should download none of it. (`css/15-gis.css` stays statically linked, per task 3.5's own
  precedent -- a small stylesheet with no such budget concern, not revisited here.)
- **Instance cache with an LRU cap of 2** (`gisCache`, keyed by `mapId` -- deliberately not
  experience id, since a `mapId` can be referenced by more than one project, and every
  experience's base id defaults to its `_type` alone, so two different projects' first "gis"
  experience would otherwise collide on id "gis"). Leaving a map's tab (`suspendExperience`)
  or closing its project (`closeExampleNow`) calls the engine's own `suspend()` (§5/§9 --
  stops pending tile/query requests, a backgrounded map costs nothing) and just hides the
  pane; nothing is destroyed or removed from `#exStageSlot`, so a returning visit is a cache
  hit -- same instance, same DOM node, no reload, no re-fetch, matching the "no reload on
  switch back" bar this codebase already holds Treedis to. `closeExampleNow`'s existing
  `[id^="exampleMediaFrame-"]` removal is naturally exempt from the parked GIS pane, since it
  uses its own distinct `exampleGisPane-<mapId>` id prefix. Only eviction past the cap
  actually tears an instance down (`instance.destroy()` + its `DTSGisTools` instance's own
  `destroy()` + pane removal); the map currently on screen is never a candidate.
- `invalidateSize()` wired to: the CSS-fallback fullscreen enter (`playReveal()`, covering
  the real Fullscreen-API path, the older-WebKit event path, and the no-Fullscreen-API CSS
  overlay, since all three funnel through it), the two fullscreen-exit paths (the native
  `fullscreenchange`/`webkitfullscreenchange` listener, and the CSS fallback's own tap-exit
  and Escape-exit handlers), and a plain `window` `resize` listener.
- **Finding, not a bug (confirmed live, worth recording so it isn't "fixed" again later):**
  prototype-patching `L.Map.prototype.invalidateSize` and dispatching a synthetic `resize`
  event showed vendored Leaflet 1.9.4 already calls `invalidateSize()` on every *live* map
  instance itself on `window` resize (its own internal listener, bound at construction,
  still firing even for a suspended/hidden map) -- making this task's explicit `resize`
  listener redundant for that one case. Kept anyway: it's harmless, it's what the task
  explicitly calls for, and it doesn't rely on an implementation detail of a vendored
  library that could change. It is **not** redundant for fullscreen: entering/exiting the
  CSS fallback changes the stage's size via a class toggle, with no native `resize` event at
  all, so that path only re-measures because of this task's own explicit call -- confirmed
  live by spying the same prototype method around a real `#exEnter` click (browser
  automation can't grant a script-driven `.click()` real Fullscreen-API transient activation,
  so the click reliably exercises the CSS-fallback branch, the one this task most needed to
  verify) and around a synthetic Escape keydown.
- Verified live in Chrome against the real app shell (not a standalone harness this time --
  `python -m http.server 8000` serving the actual site), with three temporary `gisMap`
  documents and matching `experiences[]` entries added to three real, existing projects
  (`energy`, `workforce`, `healthcare` -- one of the three, `healthcare`, wired to the real,
  CORS-verified Iberia parish-boundary `esriFeature` layer to confirm the *whole* pipeline
  end to end, not just the engine in isolation) and registered in `data/manifest.json`'s
  `gis` group: a deep link straight to a project's GIS tab (`?category=…&project=…&exp=…`)
  mounts correctly alongside its Treedis tab; switching tabs away and back reuses the exact
  same DOM node and Leaflet instance (checked by object identity, not just visual
  inspection); closing the project and reopening it later reuses the same cached instance
  too; opening two more distinct maps in sequence correctly evicts the least-recently-used
  entry once the cache exceeds its cap of 2, while never touching the one currently on
  screen; and a non-GIS legacy project (`campus`) loads with zero GIS/Leaflet script tags
  and no `window.DTSGis`/`window.L` globals at all, confirmed directly via the DOM rather
  than the session's network-request-capture tool, which (consistent with this session's
  already-documented automation quirks) failed to reliably attribute requests to the page
  under test. All temporary map/manifest/project-file test data reverted before committing,
  same pattern as every prior phase's live-data testing.

## GIS Phase 3 task 3.11 — print/export image, export data, and share links

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.11 / `04-SPEC-gis-engine.md` §6-7. This is the
last of the §6 tool set; only 3.12 (wiring `mountGis()` into `js/app.js`'s switcher) and the
content tasks remain in Phase 3. Nothing wired into `index.html`/`app.js` yet.

- **Share** (`getState()`/`applyState()` already existed from Phase 3a; this task adds the
  encode half): `js/gis/gis-viewer.js` gains `encodeStateParam()`, the exact inverse of the
  already-tested `decodeStateParam()` -- same `escape`/`atob` round trip, not
  `TextEncoder`/`TextDecoder` as §7 suggests, because encode has to invert what decode
  already expects, and decode's mechanism is the one every prior `applyState()` test (3.8's
  filters, 3.9's drawings, 3.10's swipe/time state) actually exercised. Exposed as
  `instance._encodeState`, same internal-seam footing as `_getLayerBounds`. §7's "consider
  splitting the view into a `#map=z/lat/lng` fragment" question was already answered
  implicitly back in Phase 3a -- `decodeStateParam` has only ever accepted the whole blob --
  so `gis-tools.js`'s share panel keeps that shape: one opaque `map=` query parameter.
  Round, per §7: centre to 5 decimals and opacity to 2 (already true of `getState()`); cap
  the encoded blob at 1500 chars, and if drawings are what pushed it over, drop them and say
  so in the panel. Verified live: encode → URL → a **second, independent `DTSGis.mount()`**
  with `stateParam` set reproduces the exact same `getState()` (center, zoom, layer
  visibility/opacity) -- the real decode path, not a hand-rolled copy of it. Also verified
  the cap: 40 synthetic drawings pushed the blob to 4774 chars; the share link correctly
  dropped them (down to 142 chars) and showed the message, while a single drawing under the
  cap round-tripped intact.
- **Export data**: a new toolbar panel, layer-scoped to currently-visible queryable layers
  (dropdown rebuilt on open, same live pattern as swipe's layer choice), with GeoJSON and
  CSV downloads. Deliberately reuses task 3.8's `queryRows`/`fieldsForLayer`/
  `matchesConditions`/`downloadCsv` wholesale instead of writing a parallel path: "currently
  visible/filtered features" is exactly the attribute table's own row set (minus its
  transient text-search box, which isn't part of the map's actual state), so there was
  nothing new to compute. Per §6, the GeoJSON export embeds the layer's attribution as a
  properties-level note (`_attribution`) on every feature -- confirmed live against the real
  Iberia parish-boundary layer.
- **Print / export image**: composes the live DOM Leaflet already rendered into a canvas --
  every `<img>`/`<canvas>` inside the map container, positioned via `getBoundingClientRect()`
  and ordered by its ancestor pane's `zIndex` -- rather than re-deriving Leaflet's internal
  pixel math. A bottom band overlays title/attribution/scale-bar-text/legend swatches read
  straight off the same `legendRowsFor()` the legend panel already uses. Downloads as PNG via
  `canvas.toBlob()`.
- **Real bug, found live (this task's central finding, matching §6's own warning that canvas
  tainting is "a common late surprise"):** MDN documents a tainted canvas as resolving
  `toBlob()`'s callback with `null`. Confirmed live against Chrome and the real Iberia
  boundary layer + CARTO dark basemap tiles (neither loaded with a `crossOrigin` attribute --
  changing that site-wide for every tile/image layer to chase untainted exports was judged
  out of scope and too risky for this task, since a server that doesn't answer the
  `crossOrigin` fetch correctly would silently break basemap tiles everywhere, not just
  export): Chrome instead throws a **synchronous `SecurityError` out of `toBlob()` itself**,
  which an unguarded call would let escape as an uncaught exception. Fixed by wrapping the
  `toBlob()` call itself in try/catch, in addition to the `null`-blob check -- both outcomes
  reach the same §11 message ("Image export isn't available for these layers — use Print
  instead."). This is not a theoretical fallback: against real project data it is the
  *normal* path, confirmed live.
- **Print fallback**, per §6 ("open a print-styled view and let the browser's own
  print-to-PDF handle it"): rather than clone the map into a second Leaflet instance (a
  second live mount re-triggers every layer's network fetch for no benefit -- the same waste
  the "one Treedis iframe ever" rule elsewhere in this codebase warns against in spirit),
  `printMap()` repositions the *real*, already-mounted map full-page via the classic
  visibility-flip `@media print` technique (`css/15-gis.css`) plus a small injected
  title/legend/attribution block. This works precisely because canvas tainting only blocks
  JS pixel *readback* -- it never affects the browser's own on-screen/print compositing, so
  the same layers that can't be exported to PNG still print correctly. Cleanup runs on the
  `afterprint` event, with a 60s fallback timer since `afterprint` doesn't fire in every
  environment. Verified live (with `window.print` stubbed to avoid blocking the test session
  on a native OS dialog -- the same reason browser-automation guidance elsewhere avoids
  triggering real dialogs): the printing class and info block appear with the correct title
  and a real legend row, and both are removed once `afterprint` fires.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (the parish boundary
  `esriFeature` layer) and a CARTO dark basemap: all three tools end-to-end, including both
  real bugs above and their fixes. Automated `computer` clicks on the small toolbar buttons
  were unreliable in this session (a CSS-pixel/screenshot-pixel scale mismatch sent clicks to
  the wrong coordinates) -- fell back to direct DOM `.click()` dispatch via the JS console for
  every interaction, the same ground-truth-over-screenshot approach documented in prior
  tasks' entries. Test harness deleted before committing.

## GIS Phase 3 task 3.10 — swipe compare and time slider

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.10 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12. This is the last of the
§6 tool set; only 3.11 (print/export/share) and the wiring/content tasks remain in
Phase 3.

- **Swipe compare**: a draggable divider clipping one chosen layer's own Leaflet pane
  via CSS `clip-path` -- simpler than reassigning the layer to a dedicated pane, and
  correct as long as each layer keeps a distinct `zIndex` (true of every layer in
  §4's own schema example and the expected authoring convention; two layers sharing
  one `zIndex` would share one pane and both get clipped -- a documented limitation,
  not a silent one). Layer choice is a dropdown of currently-*visible* layers, per §6,
  rebuilt live off the existing layerchange tracking. Dragging uses Pointer Events
  (`setPointerCapture`) for one code path across mouse and touch. Resets cleanly per
  §6's own requirement: `setLayerVisible` clears the clip immediately if the hidden
  layer is the active swipe target.
- **Time slider**: additive to the schema, same "extend, don't reshape" pattern as
  earlier tasks -- `mapDoc.timeSeries.steps: [{id,label,date?}]` (§3) and, per layer
  (§4), `def.timeStep` (pure visibility swap -- CPRA content is "separate layers per
  scenario," per §6's own text, not a continuous temporal field) or `def.timeField`
  (ArcGIS time query via the layer's own `setTimeRange`, for a source that genuinely
  is temporal). Both mechanisms are supported per §6's explicit "support both."
  `isTimeVisible()` folds into the existing `syncLayerToMap()` visibility gate
  alongside the zoom-range check, so a layer panel checkbox stays the master switch --
  turning a time-stepped layer off keeps it off regardless of the active step. Play
  advances on a timer and auto-stops at the last step; `destroy()` now clears that
  timer, since nothing else would stop it firing against a torn-down map.
  **Scope decision:** the tool only shows when `timeSeries.steps.length >= 2` -- a
  lone `timeField` layer with no declared steps has no defined positions to scrub
  between (deriving them from ArcGIS service time-extent metadata was out of scope
  for this pass); §6's "or a timeField" wording is about which layers *respond* to
  the slider once it exists, not an independent trigger for showing it.
- **Real bug, found live, pre-existing since Phase 3a (not introduced here):**
  `entry.leaflet.getPane()` throws once a layer has actually been removed from the
  map -- `map.removeLayer()` nulls the layer's internal `_map` reference, and
  Leaflet's own `getPane()` reads `this._map.getPane(...)` with no null guard. This
  is exactly what happens when a layer being used as the swipe target gets switched
  off: `setLayerVisible()`'s `syncLayerToMap()` call removes it from the map, then
  the very next line tried to clear its swipe clip via `.getPane()` and threw.
  Fixed by looking the pane up through the map object by name
  (`map.getPane(layer.options.pane)`) instead of asking the layer object for it --
  always safe, attached or not.
- **Second real bug, found live, pre-existing since the original geojson/esriFeature
  layer factories (not introduced here) -- the most consequential finding of this
  task:** `pointToLayer`'s manually-built `L.circleMarker` (in both
  `gis-viewer.js`'s `buildGeoJsonLayer` and `gis-esri.js`'s `buildFeature`) never
  forwarded the layer's `pane` option. A parent `L.geoJSON`'s own `pane` option does
  *not* propagate into a custom `pointToLayer`'s manually-constructed marker -- that's
  a separate `L.Path` instance with its own `pane` option, defaulting to Leaflet's
  shared `"overlayPane"` (zIndex 400) when unset. This meant **every point feature
  from every geojson/esriFeature layer, ever, has silently ignored its configured
  `zIndex`** and rendered into one shared pane above (almost) everything else --
  §6's "layer order follows zIndex" was never actually true for points. Harmless-
  looking in isolation (points were still visible, just in the wrong stacking order,
  which no prior test happened to check for) until this task's swipe compare, which
  clips a layer's *own* pane by name: against a point layer it was clipping the wrong
  element entirely, doing nothing visible. Fixed by forwarding `ctx.pane` /
  `opts.pane` into the `pointToLayer` marker's own options in both files.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (parish
  boundary) plus local geojson fixtures (two overlapping polygons for swipe, three
  point markers tagged to different `timeStep`s for the slider). Screenshot-based
  visual verification was unreliable in this session's automated Chrome environment
  for *both* tasks this time -- not just the already-documented animation/dblclick
  quirks, but canvas content specifically: a deliberately-painted, fully-opaque test
  rectangle on a layer's own canvas did not appear in a screenshot of that exact
  region, and `getImageData` reads immediately after a time-step change were
  inconsistent with reality. Fell back to ground-truth checks with no rendering
  dependency -- `map.hasLayer()`, `getBoundingClientRect()`, DOM pane structure, and
  computed `clipPath` values -- which is what actually caught and confirmed both bugs
  above; screenshots would have shown the point layers "worked" the whole time.
  Test harness and geojson fixtures deleted before committing.

## GIS Phase 3 task 3.9 — measure, draw, coordinates, search, geolocate, bookmarks

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.9 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12. Six tools, all gated by
`mapDoc.tools.<name>`.

- **Bookmarks**: no engine changes at all -- `setView()` already accepts either
  `{center,zoom}` or `{bbox}`, exactly what a `mapDoc.bookmarks[].view` already is.
- **Coordinates**: `gis-viewer.js` emits a new `"pointer"` event (an addition to §5's
  event set, same spirit as `"identify"`) on `mousemove`+`click` -- click covers touch
  taps, which don't fire `mousemove`. `gis-tools.js` shows an always-on readout chip
  (click-to-copy) plus a "go to coordinates" panel parsing both decimal degrees and
  DMS (`29°52'12"N 91°45'00"W`), figuring out which half of the pair is latitude from
  which one carries N/S rather than assuming input order.
- **Geolocate**: `instance._geolocate()` wraps `navigator.geolocation`, draws an
  accuracy circle, and reports whether the result falls inside `view.maxBounds`.
  Per §11, a permission denial is silent (no toast); every other outcome gets a brief
  one, and being outside the parish offers a "Zoom to parish" action instead of flying
  to the user.
- **Search**: two parish-limited scopes per §6. Feature search runs across every
  queryable (`geojson`/`esriFeature`) layer using `def.searchField` if the map
  document sets one -- an additive extension to §4's layer schema -- else the first
  field `fieldsForLayer()` (from task 3.8) resolves. Place search is Nominatim, bounded
  to the map's own `view.maxBounds`: `sources.json` already confirmed the Iberia
  AddressLocators service is token-restricted, so per §6's own fallback chain Nominatim
  is the only option, not a corner cut. A failed place search says so in the results
  list rather than silently only showing feature matches.
- **Measure**: distance (multi-segment, running total) and area, per §6. All
  interaction lives in `gis-viewer.js` -- click adds a vertex, mousemove previews the
  next segment/closing edge, dblclick finishes, Escape cancels an in-progress session,
  Clear removes every finished one. Distance uses Leaflet's own `L.LatLng#distanceTo`
  (already haversine -- §2's "hand-roll haversine" note doesn't apply once you're
  already inside Leaflet); area uses §2's own suggested shortcut, an equirectangular
  projection centred on the ring's mean latitude plus the ordinary planar shoelace
  formula. On-map segment + running-total labels are `L.divIcon` markers; the panel
  mirrors the same total as text per §10 (the on-map label isn't the only channel).
- **Draw/annotate**: point, line, polygon, rectangle, text, per §6. Same
  click-to-vertex/dblclick-finish model as measure for line/polygon; rectangle is two
  opposite corners; text places a point then `gis-tools.js` collects the label via a
  small inline input positioned at the point's `containerPoint` (same technique task
  3.7's identify popup uses) before finalizing. Drawings are a plain-object registry --
  `{id,type,color,latlng?,latlngs?,text?}` -- so `getState().d`/`applyState()` (§7) and
  the "download as GeoJSON" button both just read it directly, no Leaflet object ever
  crosses out. **Security note:** a drawing's `text` can arrive via `applyState()` from
  a share link someone else authored and is rendered through a `divIcon`'s `innerHTML`
  -- escaped before render (confirmed live: a label typed as `Test <b>label</b>`
  rendered as literal text, not a real `<b>` element), since an unescaped label would
  be a real self-XSS vector via a crafted share link, not just a cosmetic concern.
- **Real bug, found live, pre-existing in the tools UI's own DOM structure (not new to
  this task, just newly triggered by it):** `js/gis/gis-tools.js`'s `host` element is a
  DOM descendant of the same container Leaflet owns as its map root (both mounted onto
  the same `containerEl`). Per ordinary DOM bubbling, any click on a *real* control
  inside `host` (buttons, inputs -- `host` itself stays `pointer-events:none`) was also
  reaching Leaflet's own container-level listeners as a genuine map click. Mostly
  harmless before now (a stray "identify: miss" event, a misleading coordinate
  readout), but for measure it was a real functional bug: opening the measure panel,
  or switching its mode/unit mid-measurement, injected a spurious vertex at the
  clicked button's screen position, because `gis-viewer.js`'s map click listener was
  already (re-)attached by the time the same click event finished bubbling to the
  container. Fixed once, at the root: `host` now calls `stopPropagation()` on
  click/dblclick/mouse*/wheel/touch* -- the single place that fixes every current and
  future control the same way, rather than patching each one. Corollary fix: this also
  stops scrolling a panel's list (e.g. the attribute table) from also zooming the map
  via the bubbled wheel event.
- **Second real bug, found live:** `gis-viewer.js`'s `finishMeasure()` built the
  emitted `"measure"` event's `detail` (via `buildMeasureDetail(true)`) *before*
  clearing `measureSession`, so `detail.active` read `true` on the very event meant to
  announce the session had ended. `gis-tools.js`'s readout -- which resets to "Click
  the map to start measuring." only `if (!detail.active)` -- got stuck showing the
  last in-progress distance instead of resetting. Fixed by explicitly setting
  `detail.active = false` after building the (still session-derived) totals.
  Confirmed via direct `MouseEvent`/`dblclick` dispatch in the console, not the
  higher-level browser-automation `double_click` action -- that action reliably added
  a third vertex instead of finishing in this environment, but dispatching the same
  two-clicks-then-`dblclick` sequence real browsers actually produce finished the
  measurement correctly both before and after this fix was isolated, confirming the
  automation action itself doesn't reproduce a real double-click here (harness
  artifact, not a product bug -- same category as Phase 3a's animated-`setView`
  finding).
- **Naming fix, not a behavior bug:** the filter panel's Apply/Clear buttons (task
  3.8) were `.dts-gis-filter-apply`/`.dts-gis-filter-clear`. This task reused those
  same classes for the coordinates "Go" button and measure's Finish/Clear, which is
  what actually caught this: a `document.querySelector('.dts-gis-filter-clear')`
  during testing silently grabbed the filter panel's button instead of measure's.
  Renamed everywhere to `.dts-gis-btn-primary`/`.dts-gis-btn-secondary` -- generic
  names for what was always a generic style, now unambiguous for any future caller.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (parish
  boundary) plus a local geojson point fixture: every tool above end-to-end, including
  the two bugs' before/after states, `getState()`/`applyState()` round-tripping a
  restored drawing, the XSS-escaping check, and that task 3.6-3.8's existing tools
  (layer panel checkbox toggling, identify) still work unchanged after the
  `stopPropagation` fix. Console clean throughout. Test harness and geojson fixture
  deleted before committing.

## GIS Phase 3 task 3.8 — attribute table and filter/query builder

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.8 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12.

- `js/gis/gis-viewer.js` gains three internal seams for `gis-tools.js`, same "not §5
  public API" footing as `_getLayerBounds`: `_queryLayer(id, selector)` (returns every
  feature, not just an objectIds lookup -- both `esriFeature`'s and `geojson`'s
  `query()` were extended to support a selector-less "give me everything" call),
  `_setLayerFilter(id, conditions)` (an ANDed `[{field, op, value}]` list, translated
  per sourceType -- `buildWhereFromConditions()` to an ArcGIS SQL where-clause for
  esriFeature, `buildPredicateFromConditions()` to an in-memory predicate for geojson),
  and `_zoomToFeature(id, selector)` (queries once, reuses the result for both the
  highlight layer and the bounds fit, for the table's row-click).
- `js/gis/gis-esri.js`'s `buildFeature()` now also returns `setFilter(where)`, a thin
  wrapper over esri-leaflet's own `FeatureLayer.setWhere()` -- confirmed live in the
  vendored bundle that this is a real, intentional API for exactly this ("filtering out
  data" by requerying and swapping the displayed feature set), not something to
  reimplement. `js/gis/gis-viewer.js`'s `buildGeoJsonLayer()` grew a matching
  `setFilter(predicate)` that toggles each feature's already-built sub-layer in/out of
  the `L.geoJSON` group by membership -- captured once at construction, no rebuild.
- **Deliberate departure from §7's illustrative state shape:** `getState().f` holds
  `{ layerId: [{field, op, value}, …] }` -- the condition list itself -- not a raw
  ArcGIS where-clause string as §7's example shows. A where-clause string is lossy to
  parse back for the geojson predicate path, and the spec itself flags the exact `f`
  shape as an example, not a contract ("Decide in Phase 3"). This round-trips exactly
  through `applyState()` for both sourceTypes.
- `js/gis/gis-tools.js`: the attribute table (`tools.attributeTable`) is a bottom
  drawer -- `.dts-gis-drawer`, deliberately not `.dts-gis-panel`, since §6 calls for it
  full-width at every viewport, not just as a mobile bottom sheet -- with one tab per
  queryable (`geojson`/`esriFeature`, `queryable !== false`) layer (tab strip hidden
  entirely for a single such layer). Sortable columns (click a `<th>`, `aria-sort`
  kept honest), a text filter box searching every shown column, row click →
  `_zoomToFeature` + highlight, "download visible rows as CSV" (the full filtered set,
  not just the current page), paginated at 200 rows per §6 with a status line naming
  the true total. Row set reflects both the text box and the layer's active
  query-builder filter (via a small `matchesConditions()` mirroring
  `buildPredicateFromConditions()`, kept local rather than shared -- this file never
  reaches into `gis-viewer.js` beyond the instance/`_`-prefixed seams).
- The filter/query builder (`tools.filter`) is a docked panel matching the layers/
  legend panels: a layer select, one or more field+operator+value condition rows
  (`+ Add condition`, ANDed), Apply/Clear. The active filter is always shown as a
  removable chip over the map (top-left, independent of whether either panel is open,
  per §6's "never invisibly on"), each chip clickable to clear that layer's filter on
  its own.
- **Real bug, found live, pre-existing in task 3.4's code (not introduced here):**
  the parish boundary dim mask's `buildParishMask()` called `boundaryLayerGroup
  .eachLayer(...)` directly on the boundary layer's built Leaflet object. That's fine
  for the `geojson` sourceType (a real `L.geoJSON`/`LayerGroup`), but confirmed live
  against the vendored esri-leaflet 3.0.19 bundle, `FeatureLayer` extends `L.Layer`,
  not `L.LayerGroup` -- `typeof L.esri.featureLayer({url}).eachLayer` is `"undefined"`
  (esri-leaflet's own source only ever calls it guarded, `this.eachLayer &&
  this.eachLayer(...)`, i.e. it expects this to be absent on some layer types). Since
  `sources.json` recommends `esriFeature` as the *primary* sourceType for the parish
  boundary layer itself, this meant the dim mask silently never rendered for the
  boundary config every future map is actually likely to ship with. Fixed by rebuilding
  `buildParishMask()` off the layer's `query({})` (the same seam this task added
  full-fetch support to) instead of its Leaflet object directly -- works for both
  sourceTypes uniformly via one throwaway `L.geoJSON()` conversion of the query result.
- **Second real bug, found live, also pre-existing (task 3.7's `highlight()`, not
  introduced here):** `L.geoJSON(fc, {style}).addTo(highlightGroup)` renders a Point
  feature with Leaflet's default blue marker icon -- `style` only touches path layers
  (lines/polygons); points need an explicit `pointToLayer`. Surfaced live via this
  task's row-click zoom-to-feature against the point fixture layer. Fixed with a
  shared `highlightGeoJson()` helper (used by both `highlight()` and the new
  `_zoomToFeature()`) that supplies a gold `circleMarker` `pointToLayer`, matching the
  site's styling instead of Leaflet's default pin.
- **Third finding, not a code bug:** an early version of the live test harness called
  `setFilter` unconditionally on every layer load (even with no filter set, to cover
  the "restore a filter from a share link before the layer finishes loading" case).
  Confirmed live this forces esri-leaflet's `FeatureLayer.setWhere()` to run an
  immediate full requery that races the layer's own just-started initial grid load
  against the same service. Fixed by only ever touching `setFilter` from `loadLayer`'s
  ready branch when a filter is actually pending (`applyPendingFilter()`); an ordinary
  first load leaves the layer's own default query alone entirely.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (parish
  boundary + a local geojson point fixture standing in for a parcels-style layer,
  since the two real `esriFeature` candidates in `sources.json` -- boundary and
  hydrography -- don't give a numeric field to exercise sort/CSV against): both
  sourceTypes' attribute tables (system fields excluded, real ArcGIS field aliases for
  the boundary, `OWNER`/`ZONE`/`ACRES` for the fixture), column sort, the text filter
  box, row-click zoom+highlight (confirmed the marker-icon fix), CSV button (no
  console errors), the filter builder's layer switch/condition rows/Apply/Clear, the
  chip appearing and disappearing in sync with both the map (only matching points
  remained) and the table ("3 of 10" narrowing correctly), and `getState()`/
  `applyState()` round-tripping a filter through the console. Also incidentally
  confirmed no regression in 3.7's identify popups (Escape-to-close) during testing.
  One real ArcGIS service quirk found and *not* fixed, because there's nothing to fix
  in our code: the Iberia hydrography layer (`Hydrography/Laterals_and_Mains_2026`,
  sublayer 3) returns a genuine server-side `400 "Unable to complete operation"` for
  esri-leaflet's default combination of `resultType=tile`+`geometryPrecision=6` query
  params specifically on that service -- confirmed via direct `curl` isolation, not an
  artifact of this task's code. The engine's existing per-layer try/catch correctly
  degraded it to "Unavailable right now" without affecting the boundary or fixture
  layers, which is §11's contract working as intended; flagged here as a content/
  sourcing note for whoever finalizes `data/gis/maps/iberia-coastal.json` in task 3.14.
  Test harness and geojson fixture deleted before committing.

## GIS Phase 3 task 3.7 — identify and popups

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.7 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12.

- `js/gis/gis-viewer.js`: click handling, gated entirely by `mapDoc.tools.identify`
  (`false` attaches no listeners and makes no requests at all, not just hides the UI).
  Two paths, matching §6's split exactly:
  - **Vector layers** (`esriFeature`/`geojson`, `queryable !== false`): a `click` listener
    on the built layer itself, resolved instantly from the already-client-side feature --
    no network round trip. `L.DomEvent.stopPropagation` keeps it from also falling through
    to the map's background-click handler below.
  - **`esriDynamic`**: a raster image has nothing to attach a per-feature click to, so a
    single `map.on("click", …)` handler runs `identifyFeatures` (via the new
    `DTSGisEsri.identify()`) against every visible+ready+queryable esriDynamic layer in
    zoom range, in parallel, and combines the results into one event -- §6's "grouped by
    layer when several hit."
  - Both paths emit a new `"identify"` event -- `{latlng, containerPoint, hits:[{layerId,
    sublayerId, properties}]}` -- through the existing `on()`/`emit()` mechanism. This is
    an *addition* to §5's documented event set (`ready`/`viewchange`/`layerchange`/
    `tourstep`/`error`), same spirit as extending `DTS_CONFIG` rather than reshaping it,
    not a change to any existing event's shape.
  - Fires with `hits: []` on a genuine miss (not silently dropped), so gis-tools.js can
    dismiss a stale popup on every click, not just on ones that hit something.
- `js/gis/gis-esri.js`: `identify(def, map, latlng)` wraps `L.esri.identifyFeatures`, but
  reads the task's raw third callback argument (the untouched ArcGIS JSON) instead of the
  GeoJSON conversion, because each result carries its own true `layerId` (which sublayer
  actually matched) -- needed since one `esriDynamic` layer can have several sublayers
  with different schemas. `fetchFieldAliases(url, sublayerId)` fetches and caches
  `<service>/<sublayerId>?f=pjson` for the popup's "no `popup.fields` configured" fallback
  (§6: "show all non-system fields with their ArcGIS aliases") -- the same per-service
  caching idea the legend fetch in gis-tools.js already uses, and it works unchanged for
  both `esriDynamic` (using the sublayer id the identify response reported) and
  `esriFeature` (using the layer's own static `layerId`).
- `js/gis/gis-tools.js`: builds and positions the popup itself -- **a plain absolutely-
  positioned div, not a Leaflet popup object.** It only needs `containerPoint` (already
  relative to the map container this module owns the overlay for) and never needs the map
  or `L`, keeping identify on the same "no Leaflet objects here" footing as the rest of
  the file. Trade-off, deliberate: it doesn't track the map on pan/zoom -- it closes on
  the next `viewchange` instead of repositioning, which is simpler and matches how most
  identify popups behave anyway. Also: system-field filtering (`OBJECTID`/`Shape*`/
  `GlobalID` pattern), `popup.title`'s `{field}` template, `format:"number"` + `suffix`
  value formatting, grouped-by-layer sections, close button, Escape-to-close, and focus
  move-in/restore-on-close per §10.
- `css/15-gis.css`: popup styling (dark glass, gold hairline, gold-bright section
  headers), continuing the tokens from 3.5/3.6.
- Verified live in Chrome against real Iberia Parish data: a real `esriFeature` click
  (Iberia Parish boundary attributes, field aliases fetched with no `popup.fields`
  configured), a real `esriDynamic` background click (FEMA BFE/floodway attributes,
  multiple fields, scrolling body), a `geojson` layer with `popup.fields` configured
  (confirmed the `{name}` title template and `format:"number"`+`suffix` -- `"128.4 ac"`)
  stacked correctly above the boundary layer by `zIndex`, the close button, Escape,
  pan-to-close, and that focus lands on the close button on open. Console clean throughout.
  Test harness and geojson fixture deleted before committing.

## GIS Phase 3 task 3.6 — layer panel, legend, basemap switcher

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.6 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12.

- `js/gis/gis-tools.js` (new) -- `window.DTSGisTools.mount(containerEl, mapDoc, instance,
  opts)`: a toolbar (top-right) with toggleable Layers/Legend panels and an inline
  basemap `<select>`, gated by `mapDoc.tools.layerPanel` / `.legend` / `.basemapSwitcher`.
  Desktop: docked panels. Mobile (`max-width:760px`, matching the site's existing
  breakpoint): bottom sheets.
  - **Layer panel**: grouped by `mapDoc.groups` (open/closed per the doc), per-group
    show-all/hide-all, per-layer checkbox + expandable detail (description, attribution,
    updated date, opacity slider, zoom-to-extent). A layer whose `status` goes
    `"unavailable"` shows "Unavailable right now" in place of controls; a layer outside
    its `minZoom`/`maxZoom` greys out with "Zoom in to see this layer" -- both driven
    live off `viewchange`/`layerchange` events, not polled.
  - **Legend**: rebuilt from currently-visible layers only. `legend.mode:"custom"` renders
    `legendItems` directly; `"auto"` fetches `<serviceUrl>/legend?f=pjson` for esri layers
    (cached per URL) and filters to the layer's own sublayer id(s), falling back to a
    single swatch from `style.color` for geojson/tileXYZ/wms or a failed fetch.
  - **Basemap switcher**: a native `<select>` (keyboard/mobile-friendly by construction,
    no custom listbox needed) kept in sync via `getState()` at mount and the `layerchange`
    `{type:"basemap"}` event afterward.
  - State model is seeded from `instance.getState()` + the static `mapDoc` defaults and
    kept current purely off `viewchange`/`layerchange` events -- gis-tools.js never reads
    a Leaflet object or reaches into gis-viewer.js's closure.
- `js/gis/gis-viewer.js`: adds one narrow, deliberately-not-public method,
  `instance._getLayerBounds(id)`, for the zoom-to-extent button -- returns a `Promise` of
  plain `[[south,west],[north,east]]` or `null`. Not part of §5: the tour/CMS boundary
  stays Leaflet-object-free, but zoom-to-extent has no honest answer through ArcGIS
  service metadata alone (extents come back in the service's native SR -- State Plane for
  both Iberia servers per `data/gis/sources.json`, not WGS84, and reprojecting by hand is
  out of scope).
- **Real bug found only by live testing, now fixed:** a first version of
  `_getLayerBounds` assumed esri-leaflet's `FeatureLayer.getBounds()` was async
  (`callback(err, bounds)`, querying the service for the real full extent). Live testing
  showed otherwise: the vendored esri-leaflet 3.0.19 `FeatureLayer` and `DynamicMapLayer`
  implement no `getBounds()` at all (`typeof` is `"undefined"`, not a function of either
  arity). Zoom-to-extent is therefore only ever available for the `geojson` sourceType's
  plain `L.geoJSON` layer, which has the ordinary synchronous Leaflet `getBounds()` --
  confirmed by adding a temporary local geojson fixture layer and watching the map
  actually fly to its bounds. `_getLayerBounds` still returns a `Promise` (always
  immediately resolved) so this seam has one stable async contract regardless of which
  sourceType built the layer, rather than a sync/async split only one branch of which is
  ever real. For esri layers the button now honestly reports "Extent isn't available for
  this layer yet" rather than silently doing nothing.
- `getState()`'s `l` map only lists layers that differ from their `mapDoc` default (per
  `04-SPEC §7`), so gis-tools.js seeds its own visible/opacity state from
  `mapDoc.layers[i]`'s defaults whenever a layer id is absent from `getState().l`, rather
  than treating absence as "unknown."
- `css/15-gis.css`: extended with the tool-panel chrome (toolbar, panels, groups, layer
  rows, legend rows) styled to the same tokens as task 3.5's Leaflet-chrome pass. These
  are the project's own elements, not Leaflet's, so (unlike 3.5) there's no
  injection-order specificity race to guard against -- plain `.dts-gis-tools`-prefixed
  selectors are enough here.
- Verified live in Chrome against a temporary, not-committed test harness (same pattern as
  3.5) mounting real Iberia Parish boundary + hydrography `esriFeature` layers, a
  deliberately-nonexistent `esriFeature` URL (confirmed it degrades to "Unavailable right
  now" without affecting the other layers), and a local geojson fixture: group
  expand/collapse, per-layer checkbox/opacity/zoom-to-extent, zoom-range greying, legend
  swatches (both the real ArcGIS `data:` image swatches and the style-color fallback),
  live basemap switching, the `max-width:760px` mobile bottom sheet, keyboard reachability
  with visible gold focus rings, and a clean console. Harness and fixture deleted before
  committing.

## GIS Phase 3 task 3.5 — map chrome

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.5. CSS-only; nothing new is wired into
`index.html`/`app.js` yet.

- `css/15-gis.css`: restyles Leaflet's default white/boxy chrome to the site's dark/gold
  tokens — the zoom control bar, popups (content wrapper, tip, close button), the
  attribution control, and the scale bar — plus visible `--gold-bright` focus rings on
  every control and link (04-SPEC §10). `index.html` links it last in the stylesheet
  order, after `14-intro.css`.
- `js/gis/gis-viewer.js`: `createInstance()` now adds a `dts-gis-map` class to the mount
  container (removed again in `destroy()`) so `15-gis.css` has something to scope to.
  Also adds `L.control.scale()` on mount — the scale bar is always-on map chrome per
  04-SPEC §6, not a gated tool, so it belongs with the other init-time controls rather
  than waiting for `gis-tools.js`.
- **Real bug found and fixed by live testing, not by inspection alone:** every selector
  in `15-gis.css` is anchored on the compound `.dts-gis-map.leaflet-container` (both
  classes, no space), not plain `.dts-gis-map`. `js/gis/gis-loader.js` injects
  `leaflet.css` into `<head>` lazily, *after* this file, and several of Leaflet's own
  rules (`.leaflet-container a`, `.leaflet-container .leaflet-control-attribution`,
  `.leaflet-container a.leaflet-popup-close-button`) match at the exact same
  specificity as a plain `.dts-gis-map` equivalent — a tie that source order decides,
  and Leaflet loads later. A first pass of this file used plain `.dts-gis-map` and
  silently lost every one of those ties (link color, attribution background, close
  button color all stayed Leaflet's defaults) until a live check caught the zoom
  control showing the browser's default blue focus outline instead of gold.
- Verified live in Chrome against a temporary, not-committed test harness mounting
  `DTSGis` with the real, CORS-verified Iberia Parish boundary layer
  (`Govt_Units/Updated_Parish_Boundary`) from `data/gis/sources.json`: zoom control,
  scale bar, attribution, and a sample popup all render in the site's dark-glass/gold
  language; keyboard `Tab` shows the gold focus ring on the zoom control; console clean.
  Harness deleted before committing, same pattern as prior phases' temporary test data.

## GIS Phase 3a — map engine and layer sources

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 3 tasks 3.1-3.4 / `04-SPEC-gis-engine.md`.
Phase 3 is split into several commits per the plan; this is the first ("map engine and
layer sources"). No wiring into `index.html`/`app.js` yet -- that's task 3.12
(`mountGis()` in the switcher), still to come. Vendoring vs CDN (04-SPEC §2) was
confirmed with the human before starting.

- `vendor/leaflet/`: Leaflet 1.9.4 + esri-leaflet 3.0.19, SHA-256-verified against
  jsdelivr's package metadata; versions/hashes/licenses in `vendor/leaflet/README.md`.
- `js/gis/gis-loader.js`: idempotent `DTSGisLoader.load()` -- injects the vendored
  CSS/JS only on first call, rejects cleanly (not a hang) on failure. Verified a plain
  page load makes zero `vendor/`/`gis` requests.
- `js/gis/gis-viewer.js` -- `window.DTSGis`: map init, view/bounds (`maxBounds` +
  `restrictToBounds`), basemaps (`tileXYZ`, `esriImage`), the layer factory dispatcher,
  the parish boundary dim mask, and the full §5 public API (`setView`,
  `setLayerVisible/Opacity`, `setBasemap`, `highlight/clearHighlight`, `startTour/
  tourNext/tourPrev/exitTour`, `getState/applyState`, lifecycle, `on`).
- `js/gis/gis-esri.js` -- `window.DTSGisEsri`: `buildDynamic` (esriDynamic, image
  overlay, no client query) and `buildFeature` (esriFeature, with a `query()` that
  carries the parish envelope per §8 defence 2). `esriImage`/`geojson`/`tileXYZ`/`wms`
  are simple enough to build inline in `gis-viewer.js`.
- Each layer builds independently and asynchronously into the registry so one slow or
  broken source never blocks the map or the others (§11); a `requesterror` listener on
  each esri-leaflet layer catches runtime fetch failures, since those surface as an
  event, not a constructor throw, as an earlier version of this code assumed. Layers
  outside their declared zoom range are removed from the map on `zoomend`, not just
  hidden (§9).
- Parish boundary dim mask (§8 defence 3): once the `mapDoc.boundary.layerId` layer
  loads, its real ring geometry (recursively flattened from Polygon/MultiPolygon
  `getLatLngs()`) becomes the hole in a world-covering `evenodd`-fill donut polygon, in
  its own pane above ordinary data layers. Independent of that layer's own visibility
  toggle -- the mask is static map chrome, not a togglable layer.
- **Design departure from the spec, deliberate:** `startTour`/`tourNext`/`tourPrev`/
  `exitTour` are fully implemented in `gis-viewer.js` now (applying each step's
  `view`/`layers`/`highlight` per `05-SPEC-guided-tours.md §1`), not left as stubs for
  the later guided-tours phase. Re-read that spec to get the step schema right first.
  The rationale: §5 says the tour player "drives the map exclusively through this API,"
  which reads as the engine owning step application and the player (a later phase)
  owning presentation only (card UI, keyboard, off-script pill, autoAdvance timing).
- Verified live in Chrome against real, CORS-verified Iberia Parish ArcGIS services
  (not synthetic fixtures): all six `sourceType`s build and render; a bad service URL
  and an unsupported `sourceType` both degrade to "unavailable" without affecting other
  layers; bounds/zoom-range enforcement, state round-trip, and the dim mask all checked
  against the real parish boundary layer. Found and fixed two real bugs this way before
  they shipped: esri-leaflet's `FeatureLayer` has no `layerId` option (the sublayer id
  must be part of the URL, or every query silently hits the wrong endpoint), and
  animated `setView` calls stall in this session's automated-Chrome test harness
  (confirmed as a harness/rAF-throttling artifact, not a product bug, by reproducing it
  against bare Leaflet with no DTSGis code involved).

## GIS Phase 2 — the tabbed stage

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 2 / `03-SPEC-multi-experience.md §3-5`.

- `index.html`: `#exStageTabs` (tablist) and `#exStageSlot` (mount point) added
  inside `#exampleStage`, as siblings of the existing loading veil and seam.
- `css/06-example-window.css`: `.example-stage` is now a column flex container;
  `.example-stage iframe` narrowed to `.example-stage-slot iframe`, plus an
  explicit `[hidden]` override (author CSS otherwise beats the UA `[hidden]`
  rule, so a suspended-but-not-removed iframe would keep rendering); tab strip
  styles; a placeholder style for the not-yet-built GIS pane. Checked
  `08-responsive.css`, `09-mobile.css`, `11-desktop.css` — none had a
  conflicting `.example-stage iframe` selector to update.
- `js/app.js`: `showExperience()`/`activeExperience()` switcher,
  `mountTreedis()`/`mountVideo()`/`mountSharedShowcase()`/`mountGis()` (the last
  a placeholder — the real GIS engine lands in a later phase),
  `suspendExperience()`, `syncStageTabs()` with a full keyboard-operable
  tablist (roving tabindex; arrows move focus, Home/End jump, Enter/Space
  activates), delegated so rebuilding the tab buttons doesn't cost re-wiring.
  `exampleMediaUrl()`/`exampleOpenUrl()` replaced per spec §3.4;
  `currentURLParams()`/`applyStateFromURL()`/`restoreInitialStateFromURL()`
  carry `&exp=` (only emitted for 2+ experiences); tab switches use
  `replaceState`, never `pushState`.
- **Design departure from the spec, deliberate:** each experience gets its own
  persistent iframe (`exampleMediaFrame-<expId>`), not one `#exampleMediaFrame`
  reused across a project's tabs. A project mixing a Treedis tour with a video
  would otherwise fight over one iframe's `src` — reassigning it on every tab
  switch would force the tour to reload and re-run the TourBridge handshake on
  every return visit, which fails the phase's own "no reload on switch back"
  acceptance criterion. Suspending hides a tour's frame (never reloads it) and
  blanks a video's `src` (actually stops its audio).
- **Scope decision, confirmed with the user:** skipped the spec's proposed
  optimization of borrowing the shared showcase iframe whenever an
  experience's `tourUrl` happens to match `cfg.treedis.tourUrl`. One live
  project (Properties & Places) has exactly that match with a null `sweepId`;
  borrowing would make it show whatever pose the shared iframe already has
  instead of a deterministic fresh load, breaking this phase's own
  byte-identical-for-legacy-projects criterion. Every experience with its own
  `tourUrl` always gets its dedicated frame, matching today's behavior
  exactly. Revisit as a deliberate, separately-tested change later if wanted.
- **Deferred, not done:** the spec's optional `:has(.example-stage-tabs)`
  stage-height growth for 2+ experience projects — needs matching overrides in
  both `08-responsive.css` and `11-desktop.css` to actually win at every
  breakpoint (source order means only touching `06` has no effect at
  desktop width), out of proportion for a cosmetic nicety with zero real
  multi-experience content until Phase 6. The tab strip still renders inside
  today's stage height with no clipping, just a slightly shorter slot.
- Verified live in Chrome (`python -m http.server 8000`): temporarily gave the
  `energy` project a second (video) experience per the spec's own suggested
  test step, confirmed the tab strip, tab switching, keyboard operation (found
  and fixed a real bug here — rebuilding the tab buttons on every switch was
  dropping keyboard focus to `<body>`; `syncStageTabs()` now re-focuses the new
  active tab when the strip owned focus), `&exp=` deep links, single-step
  browser back after several tab switches (confirms `replaceState`), and — via
  the console — that switching a Treedis tab away and back fires no new
  `TourReady`. Reverted the test data before committing. Also spot-checked a
  legacy single-experience project (`campus`) renders with no tab strip and no
  `&exp=` param, and that "Try a Digital Twin" still opens/closes cleanly.

## GIS Phase 1 — multi-experience schema and loader

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 1 / `03-SPEC-multi-experience.md §1-2`.
No UI change — loader/schema only.

- `js/content-loader.js`: added `projectExperiences(p)` (normalises a project's
  `experiences[]` or legacy `media` into a uniform list) and `convertExperience(m, i)`
  (replaces `convertMedia()`; adds a `gis` branch alongside `treedis`/`video`, still drops
  unknown `_type`s silently).
- `buildConfig()`'s project loop now sets `ex.experiences = projectExperiences(p)
  .map(convertExperience).filter(Boolean)` and keeps `ex.media` as a live alias to
  `experiences[0]` — every existing `ex.media` reader in `js/app.js` keeps working
  unchanged.
- `buildConfig()` now also loads `gisMap`/`gisTour` documents straight through into
  `cfg.gisMaps`/`cfg.gisTours`, keyed by id — a deliberate exception to the flattening
  convention; the GIS engine (Phase 3) reads its own schema directly.
- `data/manifest.json`: added the (currently empty) `gis` document group.
- `js/config.js`: structural sync only — added empty `gisMaps`/`gisTours`.
- Verified against real `/data` content with a Node-based replay of `buildConfig()`
  (browser extension unavailable this pass): all 16 existing projects produce
  behaviorally identical `media` (`type`/`tourUrl`/`embedUrl`/`watchUrl`), and
  `energy.experiences` is the expected one-item array. A live in-browser console/UI
  check (`python -m http.server 8000`) is still recommended before Phase 2 starts.

## GIS Phase 0 — source verification and CORS spike

No production code; research only, per `docs/plans/gis/09-BUILD-PLAN.md` Phase 0.

- CORS spike: both `maps.iberiagov.net` and `cimsgeo3.coastal.louisiana.gov`
  return permissive, origin-reflecting CORS headers on real `/query` and
  `/exportImage` calls — `esriFeature` can be the default sourceType on both
  servers, not just the `esriDynamic`/harvest fallback.
- Enumerated both ArcGIS service trees; catalogued candidate layers for the
  Boundaries/Water/Flood/Infrastructure/Coastal-projects/Coastal-change/Imagery
  groups in `08-SPEC-gfc-project.md`'s composition table.
- Confirmed MPDV runs on MapLibre GL JS with vector tiles (not ArcGIS image
  export) — resolves the scope question flagged in `07-SPEC §C`/`04-SPEC §2`.
- Transcribed MPDV's 10-step guided tour via static bundle analysis (no live
  browser session available this pass — visual/interaction details still need
  a live spot-check before Phase 4).
- Derived the parish's WGS84 envelope and an approximate centroid from
  `Govt_Units/Updated_Parish_Boundary`.
- Flagged five open items needing a human, not more automation: Iberia/CPRA
  terms-of-use confirmation (no published ToS found for either), manual
  retrieval of the robots.txt-blocked parish factsheet, and product-level calls
  on the Parcels and Nursing-Homes layers (real PII / vulnerable-population
  sensitivity respectively).
- Output: `data/gis/sources.json` (committed) and `docs/GIS-DATA-SOURCES.md`
  (gitignored, local reference only — `docs/` is excluded from this repo).

## Code reorganization (maintainability pass)

No functional changes. The site behaves exactly as before.

- Moved all JavaScript into `js/` and renamed for clarity:
  `script.js → js/app.js`, `dts-clients.js → js/clients.js`,
  `dts-tour-bridge.js → js/tour-bridge.js`; `config.js`,
  `smoke-depth.js`, and `vision-pro-spatial.js` moved as-is.
- Split `styles.css` into 12 ordered files under `css/`
  (`01-base.css` … `12-smoke.css`). Files load in numeric order and
  later files intentionally override earlier ones, preserving the
  original cascade exactly.
- `index.html` updated to load the new stylesheet and script paths;
  all markup, IDs, and asset references are unchanged.
- Comments rewritten across all files to be short and professional;
  references to internal design files and iteration history removed.
- New `README.md` for developer onboarding.
- All referenced imagery consolidated into `assets/`; HTML/CSS paths
  updated accordingly.

## Hex-cluster alignment fix

- `.hex` aspect ratio corrected to `1/0.8660254` (true regular
  flat-top hexagon) so diagonal edges sit at exactly 60°.
- Positions recomputed for exact edge contact between different-width
  neighbours; residual joint gap is sub-pixel.
- Base unit enlarged: `--hexu` is now `clamp(132px,12.5vw,360px)`
  (tablet breakpoint scaled to match).

## Content pass — real projects, live experiences, and videos

Populated all 16 sub-vertical example windows from the project link
inventory and the DTS portfolio.

- New per-example fields in `config.js → examples`:
  - `media` — the window's main experience pane (`treedis` tour or
    `vimeo` embed).
  - `links` — related tours/videos shown as "More from this project".
  - `gallery` — real project imagery in `assets/portfolio/`.
  - `capturedWith` / `platform` — accurate chips per project.
- Three formerly illustrative windows now carry real projects:
  Healthcare Training, Healthcare Facilities, Sustainability.
  Heritage remains illustrative; Safety & Emergency has copy but no
  inventory media.
- `openExample` loads the example's own media into a dedicated
  `#exampleMediaFrame` (torn down on close so video stops); the
  shared showcase iframe + sweep navigation remain the fallback.
  "Enter Twin" and the open-in-tab button target the active
  example's own tour/video.
- Only public/unlisted links are used; private, inactive, and
  sensitive items were excluded. Unlisted Vimeo links embed with
  their `h=` hash; non-embeddable share slugs appear as external
  links only.
- New brand motto ("The World as Interface") and expanded
  question-bar prompts/answers.

## Desktop layout pass (1920×1080, holds 1024–1920)

- Sector copy aligned across all four categories; new sub-verticals
  Healthcare Facilities (Industry) and Civic Services (Government);
  `navSub` and dock `short` labels added.
- Home: evidence row restyled (spread layout, gold dots); light
  question bar; light cookie card. The hexagon cluster and
  arrow-burst CTA remain unchanged.
- Contact panel: plain centred desktop layout with uppercase CTAs.
- Access Your Twin: wide desktop popup — brand block left, form
  card right.
- Example window: near-fullscreen layout with gold CTAs, chip rows,
  PROJECT EVIDENCE band, media mosaic, "More from {Sector}" cards,
  back-to-top FAB.
- Projects window: full-screen mosaic. Client portal: desktop shell
  with horizontal nav, asymmetric HOME tile grid, 3-up APPS grid.
- Tokens: `--bg #070E18`, `--bg-2 #0A1525`, `--gold #C49A2A`.

## Mobile layout pass (360×780, holds 320–480)

- Sector accents unified: education `#E9B44C`, industry `#2E8BFF`,
  government `#34598F`, community `#D27049`.
- Nav drawer: left slide-in panel listing the four sectors; the
  active item is a full-width accent bar.
- Home hero: hexagon cluster and evidence bullets now shown on
  phones; light question bar with quoted rotating placeholder.
- Category screens: sector-named "VIEW {SECTOR} PROJECTS" button,
  right-edge "Contact & Info" tab, dock-tab rail, sector pager.
- New sector projects window and post-login client portal (HOME
  tiles, All APPS cards, tile menu).
- Contact panel: centred PLAN / PROPOSE / PILOT steps. Lead-form
  modals rebuilt with paired fields and uppercase gold submits;
  success state is the "REQUEST SENT" toast.
- Access Your Twin rebuilt as the "Welcome Back!" login; the demo
  directory was repopulated (`demo` / `1234`).

## Initial wiring pass

- Fixed the boot crash (config global renamed to `DTS_CONFIG`).
- 16 example windows populated (overview + example project +
  evidence tabs + CTAs); three flagged as illustrative.
- Access Your Twin sign-in + dashboard added (Google Sheet directory,
  see `js/clients.js`).
- Question bar answers the FAQ prompts inline.
- Evidence filters open the active sector's lead example focused on
  that proof type.
