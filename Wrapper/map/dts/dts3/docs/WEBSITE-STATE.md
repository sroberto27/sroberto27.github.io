# DTS Website — State of Knowledge

**Last updated: 2026-08-10, with a 2026-09-05 addition (§9, §10) covering a
memory/network performance audit and fix pass, a 2026-09-06 addition (§4,
§9) covering the first `security-audit` run (`app` scope), and a 2026-09-07
addition (§1, §4, §5.5, §9) covering the portfolio content migration from 17
projects to 8 — the rest of this document was not otherwise re-verified on any
of those dates.** Written to be read
cold. If you are
a new session or a new developer, read this before `docs/migration/PROGRESS.md`
(2,800+ lines of session log) or before reading source files from scratch.

This document **synthesizes**. Where an authoritative procedural document
already exists and was hard-won, this file summarizes the practical points and
points at the source rather than duplicating it:

| For… | The authority is | This file gives you |
|---|---|---|
| Deploying to the dev URL | `docs/migration/DEPLOY-STAGING.md` | §8 summary + why it exists |
| Identity / access rules | `docs/migration/ACCESS-MODEL.md` | §3 in practical terms |
| Phase-by-phase history, every bug and fix | `docs/migration/PROGRESS.md` | §10 current status only |
| What must not break | `CLAUDE.md` | §7, restated |
| Manual test pass | `docs/migration/FULL-SYSTEM-TESTING.md` | §11 pointer |

---

## 1. What this site is

Marketing and client-access site for **Digital Twin Studios** (dtsxr.com). A
single-page, app-shell experience — fixed viewport, no long scroll — with:

- a home view with a hex-image cluster and a live embedded Treedis digital-twin
  tour ("Try a Digital Twin");
- four sector views (Education / Industry / Government / Community), each with
  **exactly two cards**, into **8 project documents** (see §4's inventory —
  replaced wholesale on 2026-09-07 from four client content-submission forms);
- per-project "example windows" containing one or more **experiences** (Treedis
  tour, Vimeo video, or an interactive GIS map);
- lead-capture forms (discovery / proposal / pilot);
- a **client portal** behind real authentication, with entitlement-gated app
  downloads and an activity dashboard;
- an **Admin Board** (mini CMS) for site_admins;
- **in-app documentation** for four audiences.

---

## 2. Tech stack and deploy model

**No build step. No framework. Vanilla JS + plain CSS + one HTML file.**

| Layer | What | Where |
|---|---|---|
| Front end | One `index.html` app shell, 16 numbered CSS files, ~15 JS IIFEs | repo root, `css/`, `js/` |
| Backend | Cloudflare **Pages Functions** (ES modules, one file per route) | `functions/` |
| Auth + DB | **Supabase** (GoTrue auth + Postgres with RLS) | `supabase/migrations/` |
| Content storage | **Cloudflare R2** bucket `dts-content` | keyed `data/current/…`, `data/source/…` |
| Build downloads | Cloudflare R2 bucket `dts-builds` | binding `DTS_BUILDS` |
| Map engine | Vendored Leaflet + esri-leaflet, lazy-loaded | `vendor/leaflet/`, `js/gis/` |
| Node tooling | Migration/seed/publish CLI scripts — **not shipped to the browser** | `scripts/`, `tools/` |

**Deployment is a file copy, not a build.** `wrangler.toml` sets
`pages_build_output_dir = "."`, which taken literally would publish the entire
repo (`.env`, `scripts/`, `supabase/`, `docs/`, raw `data/`). It is never used
that way — see §8.

Runtime globals worth knowing: `window.DTS_CONFIG` (legacy shape `app.js`
reads), `window.DTS_CONTENT` (raw `/data` documents the Admin Board edits),
`window.DTS_ACCESS` (session/access state), `window.DTS_SUPABASE` (Supabase
client), `window.DTS_HELP` (documentation content), `window.DTS_TRACK`
(analytics helper), `TourBridge` (Treedis bridge singleton).

---

## 3. Identity and access, in practical terms

Full normative spec: **`docs/migration/ACCESS-MODEL.md`** — that document wins
on any disagreement. What follows is the working summary.

### Six separate concepts, never collapsed into one "user type"

1. **Authentication state** — guest, or a real Supabase session.
2. **Site role** — `user` | `site_admin`, on `profiles.site_role`. Global.
3. **Organizations** — real rows, not a string on a user.
4. **Membership** — many-to-many; a user can belong to 0, 1, or many orgs.
5. **Org role** — `member` | `org_admin`, scoped to **one membership row**.
   `org_admin` at Acme confers nothing at Beta.
6. **Resource access level + entitlements** — what a resource requires, and for
   `restricted`, who specifically holds it.

Nothing is ever derived from an email address or its domain **at the point
an access decision is made.** Documented exception since 2026-08-18: an
email's domain can auto-create an `organization_members` row at account
creation time (see §3's DB tables list and ACCESS-MODEL.md §1/§10) — once
that row exists it's indistinguishable from one created by an invite or the
Admin Board.

### The four resource access levels

| Level | Who gets in |
|---|---|
| `public` | anyone, no session |
| `registered` | any signed-in user |
| `client` | signed in **and** has ≥1 `active` membership in an `active` org |
| `restricted` | signed in **and** a `resource_entitlements` row exists for them directly, or for an org they actively belong to |

Deny-by-default: `restricted` with no entitlement is a 403, not a degraded view.
`site_admin` bypasses `client` and `restricted` entirely (`checkAccess()` in
`functions/_lib/access.js`).

### `resource_key` — the string everything hangs off

```
project.<projectId>                  the project's own default level
project.<projectId>:<experienceId>   one experience or link inside it
gismap.<mapId>                       a GIS map, keyed independently of any project
download.<clientAppKey>              a registered build in client_apps
```

Real examples: `project.gfc`, `project.gfc:map`, `project.automotive:link-1`,
`gismap.iberia-coastal`, `download.dummy-viewer-win`.

**Never rename a published `resource_key`** — entitlement rows reference it as
plain text with no foreign key, so a rename silently orphans every grant. Link
ids are `link-<n>` frozen at backfill time, *not* re-derived from array position
on each publish.

### Where each half lives

- **The access level is CMS content.** It lives in `/data` (`"access"` on a
  project, an experience, a link, or a GIS map), is edited in the Admin Board,
  and flows through the normal publish pipeline.
- **Entitlements are never CMS content.** Who holds a `restricted` resource
  lives only in Postgres (`resource_entitlements`) and is never written to
  `/data` or published to R2.

### Where the decision is made

Only in `functions/api/resource/[key].js` (and its GIS layer companion route),
using `checkAccess()`. **Never trust a client-computed decision** — the client
may render a locked tile from a public stub, but the real target URL only ever
arrives from an authorized server response.

### Role capability summary

| | guest | registered | org member | org_admin | site_admin |
|---|---|---|---|---|---|
| Public content | yes | yes | yes | yes | yes |
| `registered` resources | login gate | yes | yes | yes | yes |
| `client` resources (own org) | no | no | yes | yes | yes |
| `restricted` (if entitled) | no | no | if entitled | if entitled | yes (all) |
| Manage own org's members | no | no | no | own org only | any org |
| Grant `site_admin` | no | no | no | **no** | yes |
| Admin Board / CMS | no | no | no | **no** | yes |
| See other orgs | no | no | no | **no** | yes |
| View `admin_audit` | no | no | no | no | yes |

An `org_admin` is **not** a CMS user. They get a team-management panel inside
the client portal (`renderOrgAdminPanel()` in `js/app.js`), never the Admin
Board.

### Account creation paths

1. **DTS-created** — Admin Board → Users, or `scripts/import-clients.mjs` at
   handoff. Only this path, or an org invite, can grant `site_admin`.
1b. **Org invite** (`functions/api/org/invite.js`) — an org_admin or
   site_admin creates the account and its membership together in one step.
2. **Self-registration** — email+password (`signUp()`, email confirmation
   required) or Google/Microsoft OAuth. Always lands at `site_role='user'`.
   OAuth providers are **not yet enabled** (§9).
3. **Domain-based auto-assignment (added 2026-08-18)** — applies underneath
   all three paths above, not a separate path of its own. `handle_new_user()`
   (the same trigger that provisions every new `profiles` row) also checks
   the new user's email domain against `organization_email_domains` and, on
   a match against an active org, inserts an `organization_members` row
   (`member`/`active`) in the same transaction. Trigger-level because OAuth
   sign-in never touches DTS's own backend — only something at the database
   layer can see every creation path uniformly. Admin-managed from the
   Organizations screen (site_admin only). Full rationale, the invite-race
   interaction, and failure isolation: `docs/migration/ACCESS-MODEL.md` §10.

### Database tables

`profiles`, `organizations`, `organization_members`,
`organization_email_domains` (added 2026-08-18 — email→org mappings for
auto-assignment, site_admin-managed, see the Account creation paths section
above), `resource_entitlements`, `client_apps`, `events`, `admin_audit`. All
eight have RLS enabled with deny-by-default policies. `admin_audit` has
**no client insert policy at all** —
only Functions using the service role can write it, which is why every audited
mutation goes through a Cloudflare Function rather than a direct client write,
even where RLS alone would have permitted the write.

---

## 4. The content pipeline

### The three-places rule (from `CLAUDE.md` — the thing people get wrong)

Adding a field to a `/data` JSON document **does nothing** until it is also:

1. registered in `data/manifest.json`,
2. mapped in `buildConfig()` in `js/content-loader.js`, and
3. rendered in `js/app.js`.

`buildConfig()` only copies fields it knows about, and `convertMedia()` silently
drops any `media._type` it doesn't recognize. This has caused real bugs (the
`access` field itself was added to `/data` in Phase 3 and not mapped through
until Phase 4).

### How content reaches a visitor

```
Admin Board edits window.DTS_CONTENT (in memory)
  │
  ├─ Save draft & preview → localStorage "dtsAdminDraft" → reload
  │     content-loader.js renders FROM THE DRAFT (instant local preview only)
  │
  ├─ Publish to site → POST /api/publish (site_admin only)
  │     splits each doc into public + full, diffs against a SHA-256 hash
  │     ledger, writes ONLY what changed to R2, purges the edge cache
  │
  └─ Export data folder → data.zip (the escape hatch; still works, kept
        deliberately per WORKFLOW.md golden rule 7)
```

**Two copies live in R2, and the distinction is the whole security model:**

| Prefix | Contents | Reachable by |
|---|---|---|
| `data/current/` | public, **stripped** — gated `tourUrl`/`embedUrl`/`watchUrl`/link `url` removed; a gated GIS map reduced to an `id`/`title`/`subtitle`/`_type` stub; a gated map's tours, feature tours, and local layer files not present at all | anyone, via `functions/data/[[path]].js` |
| `data/source/` | private, **full** | never through the public route — only `/api/resource/*` after a passed access check, and `/api/admin/content` for a site_admin |

The split logic is one shared module, `functions/_lib/split-logic.js`, imported
by **both** the CLI path (`scripts/split-content.mjs`) and the live path
(`functions/api/publish.js`) so they cannot drift apart.

**A link's `url` is stripped on its resolved access level alone — the link's
`kind` is irrelevant** (corrected 2026-09-06; before that the strip only
applied to `kind: "treedis"`, which made the access field inert on every other
kind of link. See `SECURITY-AUDIT-2026-09-06.md` F-01). Two consequences worth
holding on to:

- A link with **no** `access` resolves to `registered` and its URL is withheld
  from `data/current/`. Links that should be publicly visible say so
  explicitly — 29 Vimeo/Matterport links carry `"access": "public"` for exactly
  this reason. A newly added link in the Admin Board defaults to "Inherit",
  which means gated until someone chooses otherwise.
- For links, **the strip is the enforcement.** `js/app.js`'s
  `resolveExperienceNode()` returns early with no network call when a node
  already carries a `url`, and `buildExampleLinks()` renders such a link as a
  plain `<a href>`. `/api/resource/*` gates links correctly, but it is only
  reached for a link whose URL was actually withheld. Anything that publishes a
  URL it should not have therefore bypasses the gate entirely rather than
  merely leaking a stale string.

`data/current/manifest.json` is **filtered** — it lists only documents that
actually exist in `data/current/`. This matters: `content-loader.js` fetches
every manifest-listed file in one `Promise.all()`, and a single 404 rejects the
whole load and drops **every visitor** (admins included) to the `js/config.js`
fallback. That exact failure took the whole site down once already.

### `js/config.js` is a third leak surface and the easiest to miss

It is the fallback used when `/data` is unreachable. It is **not** a `<script>`
tag — `content-loader.js` injects it dynamically — so it never appears in a
normal page-load network trace, but it is a deployed static file anyone can
`curl`. The repo's committed copy holds all 16 real tour URLs. The deploy must
overlay the **stripped** `.build/js/config.js` over it (see §8). Re-verify with
`curl <site>/js/config.js | grep -c spaces.dtsxr.com` → expect **2**, never 16.
(Corrected 2026-09-06 — it said "expect 1". `grep -c` counts *lines*, and the
one public homepage tour occupies two: its `tourUrl` and its `origin`, which
travel together as a pair. Both the staged and the deployed copy have always
returned 2, so the old figure would have failed a correct deploy. What the
check is really asserting is "only the public homepage tour survives"; 16 means
the unstripped repo copy shipped.)

### Current content inventory

**52 documents** in `data/manifest.json` (was 61 before the 2026-09-07 content
migration): 2 site, 2 pages, 4 sectors, **8 projects**, 3 forms, 2 faq, 1
access, 1 media, and 29 GIS (1 map + 14 tours + 13 feature tours + 1 sources
doc). Plus 6 local `.geojson` layer files under `data/gis/layers/` that are
**not** manifest documents and are fetched directly by the GIS engine.

The portfolio — 4 categories, 8 projects, **exactly 2 per category**:

| Category | Projects (`id`) |
|---|---|
| Education | BRCC Film Production Orientation (`brcc`) · Louisiana Solar Energy Lab Digital Twin (`solar`) |
| Industry | Shell — Permian Basin Assessment Training (`shell`) · Automotive Dealership Digital Twin (`automotive`) |
| Government | Sanitarian Training Enhancement (`foodsafety`) · Advanced Manufacturing Training Demo (`honeywell`) |
| Community | Downtown Lafayette (`lafayette`) · Iberia Parish Clean Energy Hub Digital Twin (`gfc`) |

Every project now carries an `experiences[]` array (before the migration only
`gfc` did; the other 16 used a single legacy `media` object). Each has a
`public` Vimeo showcase as its default tab; four also carry a `registered`
Treedis tour, and `gfc` additionally carries the GIS map. The legacy `media`
shape is still read by `content-loader.js` and the resolver, but no document
uses it — worth knowing before assuming a code path is dead.

Three ids were deliberately kept rather than renamed, because their
`resource_key`s are published: **`gfc`** (carries the GIS map and the
`project.gfc:map` entitlement `scripts/seed-dev.mjs` seeds), **`automotive`**
and **`foodsafety`** (their new content reuses the exact tour/videos those ids
already publish). Their `sectorId` and content changed; their ids did not. `gfc`
moved from `government` to `community`.

---

## 5. Subsystems — what each does and where it lives

### 5.1 App shell (`js/app.js`, ~3,400 lines)

One state machine. Home and category views swap via JS state, never scroll;
everything else (example windows, lead forms, sign-in, portal) layers as
overlays. Owns: nav/pillars/drawer/sector pager/swipe, view switching, the
Treedis embed and TourBridge wiring, the full-screen twin reveal, the example
window, sign-in + client portal, question bar, contact panel, lead forms,
analytics `track()` calls, and boot.

Access-relevant entry points: `resolveExperienceNode()`, `resolveGisMapById()`,
`fetchResource()`, `showLockedPlaceholder()`, `handleResolveFailure()`. The
gating layer sits at the **mount boundary** — `mountTreedis()`/`mountVideo()`/
`mountGis()` themselves know nothing about access.

### 5.2 Content loader (`js/content-loader.js`, 464 lines)

Checks localStorage for an admin draft; otherwise fetches
`data/manifest.json` + every listed document, converts them to the legacy
`DTS_CONFIG` shape via `buildConfig()`, applies home content to the DOM, then
injects `app.js`, `smoke-depth.js`, `vision-pro-spatial.js`, and `admin.js`.
Falls back to `js/config.js` if `/data` is unreachable.

### 5.3 Admin Board (`js/admin.js` ~3,670 lines, `css/13-admin.css`)

Opens **only** for `site_admin` — it listens for `app.js`'s `dts:signed-in`
event and checks `siteRole`, and also reads `window.DTS_ACCESS` synchronously
in case it lost the race to register the listener. Nav groups:

- **CONTENT** — Home page, Contact panel, FAQ answers, Fun facts
- **SECTORS** — one per category page, with its projects nested
- **GIS MAPS** — each map as a bold parent row with a collapse/expand toggle,
  its tours nested one level deeper; plus Data sources
- **ADMIN** — Organizations (each with an inline "Email domains" editor,
  added 2026-08-18 — add/edit/remove the domains that auto-assign new
  signups into that org, `domainsEditor()`), Users, Builds, Access, Audit
- **HELP** — Documentation

Two different write models, and the distinction trips people up:

- **Draft → preview → publish** — everything sourced from `/data`
  (home/contact/faq/fun facts/sectors/projects/GIS).
- **Writes live immediately, no draft step** — Organizations, Users, Builds,
  Access (entitlements), Audit. These talk to Postgres through Functions, not
  to `/data`.

The board loads the **full** content set (including gated documents) via
`GET /api/admin/content`, which reads a single combined bundle at
`data/source/_latest.json` — one R2 read rather than 62, because Cloudflare's
free plan caps a Worker invocation at 50 subrequests. It skips this entirely
when a local draft is active, so it can never overwrite unsaved edits.

### 5.4 Client portal (`js/app.js`, `#portalLayer` in `index.html`)

Six views: HOME, APPS, Manage, Support, **Activity** (hidden unless the session
has ≥1 active org), **Help**. `computeAccessibleResources()` and
`computeAccessibleDownloads()` build the app list; every download click still
calls the real `/api/download/<key>` — the client never predicts access.
`renderOrgAdminPanel()` renders one team-management panel per org where the
session holds `org_admin`: member list, add-existing-by-email, invite-new,
remove, and a member↔org_admin toggle.

### 5.5 GIS engine (`js/gis/*`, `css/15-gis.css`, `vendor/leaflet/`)

Lazy-loaded — no GIS bytes reach a visitor who never opens a map.
`gis-loader.js` injects vendored Leaflet + esri-leaflet on first use;
`gis-viewer.js` (~1,575 lines) owns `DTSGis.mount(containerEl, mapDoc)`, map
init, view/bounds, basemaps, and the layer factory for six source types;
`gis-esri.js` handles ArcGIS layers; `gis-tools.js` the tool UIs;
`gis-tour.js` guided tours.

**A GIS map is a whole-document gate, not a field-level one.** `mount()` takes
the entire map document, so a gated map means the map document *and* every tour
and feature tour referencing it are withheld wholesale from `data/current/`,
plus its local `.geojson` layer files. On a successful resolve, the resolver
rewrites each local layer's `url` to
`/api/resource/gismap/<mapId>/layer/<layerId>` — which required **zero** changes
to `gis-viewer.js`, since its `fetch(def.url)` simply receives a different URL.

Today there is exactly one map: `iberia-coastal` (17 layers, `registered`
level), referenced by `project.gfc`, with 14 tours and 13 feature tours.

**The GIS subsystem is coupled to no project.** `mountGis()` keys on
`target.mapId`, tours and feature tours match on `mapId === mapDoc.id`, and the
resolver reads `gis/maps/<mapId>.json` — grep `js/gis/*`, `data/gis/**`,
`vendor/leaflet/`, `css/15-gis.css` and the GIS Function routes and you will not
find the string `gfc` in any of them. A project reaches the map through exactly
one thing: a `{_type:"gis", id, mapId, tourId, access}` node in its
`experiences[]`. That is why the 2026-09-07 content migration could re-home the
map onto an entirely new project (Iberia Parish Clean Energy Hub) by rewriting
`data/projects/gfc.json` in place and carrying that one node across untouched.
Keeping the `gfc` **id** is what kept `project.gfc:map` valid; a rename would
have orphaned the seeded entitlement row that references it as plain text.

Note the two-step resolve for a gated map, because the first step is easy to
miss: `stripTarget()` removes `mapId`/`tourId` from the published experience
node, so the client must first resolve `project.<id>:map` to learn *which* map
to ask for, then resolve `gismap.<mapId>` for the map itself. Both keys are
live at runtime.

### 5.6 Analytics and audit

- `functions/api/track.js` — inserts into `events`. Validates `type` against 17
  allowed values application-side. Stamps `user_id` from the verified JWT and
  **rejects outright** (does not silently drop) any request supplying its own
  `user_id`/`org_id`. `org_id` is stamped only when the caller has exactly one
  active org; zero or many both resolve to `null` rather than guess.
- Event types: `project_view`, `experience_preview`, `login_gate`, `login`,
  `register`, `experience_open`, `experience_close`, `map_open`,
  `download_view`, `download_start`, `download_complete`, `lead_submit`,
  `lead_fallback`, `sector_view`, `faq_search`, `help_topic_view`,
  `help_search`.
- Activity tile — a direct client-side Supabase read of `events` (RLS is the
  real scoping, not a client filter), rendered as a Chart.js bar chart lazily
  loaded from jsDelivr.
- `admin_audit` — service-role writes only, read by `site_admin` through
  `functions/api/admin/audit.js`, which resolves actor UUIDs to real emails via
  the GoTrue Admin API.
- Marketing tags — `js/analytics-init.js` loads GA4 and Microsoft Clarity, but
  **only after a real cookie-banner Accept** (`dtsCookieConsent` in
  localStorage). First-party `/api/track` events are deliberately *not* gated by
  the banner; they are DTS's own product analytics, same category as the auth
  session itself.

### 5.7 Lead form

**Client-side, deliberately.** After a real debugging chain, the server-side
`/api/lead` proxy was removed at the owner's explicit call — Web3Forms's own
dashboard labels this key public and safe for client-side use.
`sendLead()` in `js/app.js` posts directly to `api.web3forms.com/submit`;
any failure falls through to a pre-filled `mailto:` link.

**Turnstile was kept** — it still gates the submit button client-side (disabled
until a real token exists). Only the server-side re-verification round trip was
removed. Site key lives in `js/turnstile-init.js`; there is no longer any
Turnstile secret or Web3Forms Pages secret.

### 5.8 In-app documentation (`js/help.js`, `js/help-content.js`, `css/16-help.css`)

One rendering engine, `DTSHelp.mount(container, topics, opts)`, three mount
points:

- Admin Board → HELP → **Documentation** (`admin` audience, 16 topics)
- Client portal → **Help** tab (`member` topics, with `orgAdmin` topics layered
  on top as a superset for an org_admin session)
- A **floating "?" icon** for guests and signed-in users with no org — hidden
  while a twin, the portal, or the board is open

Content is static in `js/help-content.js` — a **deliberate, flagged exception**
to the "belongs in `/data`" rule, because it documents code behavior, not
editable content. It is not in the manifest and the three-places rule does not
apply to it. Features: client-side search, deep links (`#help=<audience>:<topic>`),
a `?` keyboard shortcut routed by context (and suppressed while typing), a
contextual "?" hint next to the entitlement picker, and print/PDF export with a
genuinely clickable linked table of contents.

Two topics — **"Install on a Meta Quest headset (APK)"** (`install-vr`) and
**"Run on a Windows PC (.exe)"** (`install-pc`) — are defined once in a small
IIFE at the bottom of `js/help-content.js` and pushed into `admin`, `member`,
and `guest` alike (not `orgAdmin` directly; it inherits them via `member`'s
superset), so every audience sees the identical sideload/run instructions.
Each opens with an inline-SVG step-flow diagram using the same
`help-diagram`/`currentColor` pattern as the existing org-admin invite-flow
diagram.

### 5.9 Treedis bridge (`js/tour-bridge.js`) — contract, not our code

`TourBridge.initialize(iframeEl, {origin, defaultTransitionTime, onReady,
onPoseChanged})`, plus `reset()`, `isReady`, `navigateToSweep()`,
`warmSweep()`, `requestSweeps()`. Outbound `Ping`/`Navigate`/`RequestSweeps`;
inbound `TourReady`/`PoseChanged`/`SweepsChanged`/tag events. Pings every 2s
until `TourReady`, defers `onReady` by 600ms, validates inbound `event.origin`.
**These strings and the cadence are Treedis's contract — do not change them.**

`TourBridge.initialize()` is called in exactly one place: the shared homepage
iframe. Per-project Treedis panes set `iframe.src` directly and do not use the
bridge.

### 5.10 Function routes (`functions/`)

```
functions/_lib/access.js           isUuid, verifyUser, pgrst, isSiteAdmin,
                                   activeOrgIdsFor, checkAccess
functions/_lib/admin.js            requireSiteAdmin, requireOrgAdminOf,
                                   writeAudit, gotrue
functions/_lib/split-logic.js      resolveAccessLevel, splitProjectDoc,
                                   splitGisDocSet, filterManifestForPublic
functions/data/[[path]].js         public read of data/current/* from R2
functions/api/resource/[key].js    the gate: resolve a resource_key
functions/api/resource/gismap/[mapId]/layer/[layerId].js
functions/api/publish.js           site_admin: diff-based publish to R2
functions/api/track.js             public: analytics events
functions/api/download/[key].js    entitlement-gated build download
functions/api/org/members.js       org_admin (own org) or site_admin
functions/api/org/invite.js        org_admin: create account + membership
functions/api/admin/…              site_admin: content, organizations, users,
                                   entitlements, apps, search, audit
```

**`functions/**` is routed by exact path.** `functions/api/foo.js` *is* the
`/api/foo` route. Moving or renaming anything in this tree changes what URL
serves it. A leading `_` excludes a path from routing, which is why `_lib/`
works.

---

## 6. Local development

```bash
python3 -m http.server 8000
```

Required. Opening `index.html` over `file://` breaks `/data` loading and the
site silently falls back to `js/config.js` — which will make you chase a bug
that isn't there.

**Standing project convention: manual testing happens against the deployed dev
URL, `https://dts-website-4cu.pages.dev`, not localhost.** Local serving is for
confirming a file parses and serves, not for acceptance testing.

Node tooling lives in `scripts/` (`seed-dev.mjs`, `split-content.mjs`,
`upload-content.mjs`, `rollback-content.mjs`, `backfill-access.mjs`,
`import-clients.mjs`) and `tools/gis-harvest.mjs`. None of it is browser code.

---

## 7. Do-not-break list (restated from `CLAUDE.md`)

- **Script and CSS load order in `index.html`.** Never reorder either list.
  CSS is numbered because later files intentionally override earlier ones.
- **`js/tour-bridge.js` message type strings and ping cadence.** Treedis's
  contract, not ours.
- **One Treedis iframe, ever.** Overlays move the existing iframe in the DOM and
  return it on close. A second iframe resets the session and the bridge
  handshake.
- **The legacy `DTS_CONFIG` shape** produced by `js/content-loader.js`. Extend
  it; don't reshape it. `js/app.js` depends on it.
- **localStorage key `dtsAdminDraft`.** (`dtsAdminSession` was deliberately
  retired in Phase 5 — the real Supabase session is the session now. Other keys
  in use, none protected: `dtsCookieConsent`, `dtsHelpHintSeen`.)
- **Backward compatibility is not optional.** The existing project documents
  must render identically after any schema change.

Structural rules that follow from how things are wired, not from taste:

- **`functions/**`** — path *is* route (§5.10).
- **`js/*.js`, `css/*.css`** — referenced by exact relative path in
  `index.html` and dynamically in `js/content-loader.js`. Do not rename or move.
- **`data/**`** — every path is in `data/manifest.json` and fetched by exact
  relative path at runtime. Don't restructure without updating the manifest.
- **Raw `data/` must never ship as static files.** A static file at
  `/data/<path>` would take priority over `functions/data/[[path]].js` and
  bypass every access check.

Commit conventions (also `CLAUDE.md`): no `Co-Authored-By` trailer and no
"Claude"/"Anthropic"/"AI-generated" attribution in any commit subject or body;
the commit author is the repo's configured git identity; show the proposed
subject and body and get a go-ahead before every `git commit`.

---

## 8. Deploying — summary only

**The authority is `docs/migration/DEPLOY-STAGING.md`. Follow it exactly.
Three separate real bugs have shipped from improvising this step.** The
practical shape:

1. Build a **separate staging directory** outside the repo (the scratchpad),
   never deploy the repo root — `pages_build_output_dir = "."` would publish
   `.env`, `scripts/`, `supabase/`, `docs/`, and raw `data/`.
2. Include `index.html`, `_headers`, `css/`, `js/`, `assets/`, `vendor/`,
   `functions/`, `models/` (minus the two oversized unused Backrooms `.usdz`
   files, over Cloudflare's 25 MB per-file cap).
3. **Overlay `.build/js/config.js`** onto the staged `js/config.js` — never
   deploy the real repo copy, it carries all 16 gated tour URLs.
4. **Diff the file list** of every included directory, source vs. staged. Use
   POSIX `cp -r` (Git Bash), not `robocopy` — robocopy's pattern engine drops
   `functions/data/[[path]].js`, the double-bracket catch-all that serves all of
   `/data`. Don't use PowerShell `Test-Path` on bracketed filenames; `[...]` is
   a wildcard class there and gives false negatives.
5. **Confirm every excluded path is genuinely absent** before deploying.
6. Deploy from the repo root so `wrangler.toml`'s R2 bindings resolve:
   `npx wrangler pages deploy <staging-dir> --project-name dts-website --branch main`
7. **Post-deploy, verify by byte count, never status code.** Cloudflare Pages
   returns a real `200` SPA fallback for genuinely missing paths. Fetch `/`,
   note its size, then confirm each excluded path returns *exactly* that same
   size, and that `/data/manifest.json` returns a genuinely different size.

The R2 content pipeline (`split-content.mjs` → `upload-content.mjs`) is a
**separate** thing, only needed when `/data` project or GIS content itself
changed.

---

## 9. Known gaps and deferred items

Everything below is **documented, not fixed**. None of it is a surprise.

### Blocked on external accounts / handoff

| Item | State | Impact |
|---|---|---|
| **Custom SMTP** | not configured | Supabase's built-in email is capped at **2 messages/hour, project-wide**, shared across signup confirmation and password reset. Forgot-password is effectively untestable in bursts. Supabase documents the built-in service as unsuitable for production — treat as **non-optional before handoff**. Blocked on DNS access to a domain. |
| **Google / Microsoft OAuth** | buttons live, providers **not enabled** | Clicking them shows a Supabase "provider not enabled" error. Known, not a bug. Optional at handoff. |
| **GA4 + Clarity IDs** | placeholder-empty in `js/analytics-init.js` | `loadGA4()`/`loadClarity()` are no-ops. Nothing breaks; nothing is tracked third-party. Real IDs come from the client's accounts at handoff. |
| **`ownerEmail` for leads** | `robertoenrique2710@hotmail.com` | Not a `dtsxr.com` mailbox yet. Deliberate, flagged for handoff. |
| **Supabase Redirect URLs allow-list** | never confirmed done | An un-whitelisted `redirectTo` would silently break signup confirmation, OAuth return, **and** forgot-password. Worth checking in the dashboard. |
| **Old GitHub repo privacy** | deferred | It is still the live GitHub Pages host; making it private would break that immediately. Revisit at domain cutover. |

### Code-level, known and unaddressed

- **`/api/track` has no rate limiting.** It is a public, unauthenticated-allowed
  write endpoint. `invite.js` has a real limiter (20 `invite.send` rows per
  actor per rolling hour, using `admin_audit` as the ledger); `track.js` has
  none. Worth fixing before real production traffic.
- **`scripts/upload-content.mjs` doesn't delete removed content from R2.**
  `/api/publish` now does (it diffs the previous manifest and deletes both
  copies of anything dropped), but the CLI tool has the same original gap and
  was **not** fixed — doing so needs R2's S3-compatible listing API, which isn't
  configured. Flagged in a code comment. It is a rare operator tool, not the
  everyday path.
- **CLI content writes don't purge the edge cache.** `caches.default` is a
  Workers-runtime-only API, so `upload-content.mjs`/`rollback-content.mjs` can
  serve a stale cached response for up to the 5-minute edge TTL. Not observed in
  practice.
- ~~**`js/config.js` has no `access` field and its strip is access-blind.**~~
  **RESOLVED 2026-09-07** by the content migration. `js/config.js` was rebuilt
  carrying **only** each project's public Vimeo showcase — no Treedis `tourUrl`
  anywhere in the file — so there is nothing gated left for the strip to get
  wrong. `grep -c spaces.dtsxr.com js/config.js` → **2** (the public homepage
  tour's `tourUrl` and `origin`), `my.treedis.com` → **0**. It also gained
  `experiences[]` arrays alongside the legacy `media` alias, matching
  `buildConfig()`'s output, so the fallback actually plays those videos instead
  of falling through to the shared showcase iframe.
- **Link identity is positional.** `link-<n>` is frozen at backfill time, so
  removing an earlier link shifts the meaning of every later link's
  `resource_key`. Flagged inline in the editor's own hint. Pre-existing.
- **Build upload has practical size ceilings.** A single streamed PUT is fine
  for dev/dummy files; a real multi-GB client installer may need R2's multipart
  upload API. Code signing for a distributed `.exe` is deliberately unaddressed
  — external, belongs on the client's account.
- **Treedis URL sharing.** Once `/api/resource/[key].js` returns a tour URL to
  an authorized browser, it is a bearer URL for that Treedis session's lifetime.
  DTS controls **who obtains** the URL, not what they do with it afterward.
  Stated so no later work assumes stronger guarantees.

### Found during this documentation pass — new, not previously recorded

- ~~**`tools/gis-harvest.mjs` is being served live again.**~~ **RESOLVED
  2026-08-18.** Was confirmed live 2026-08-10 (`200`, 16,886 bytes,
  byte-identical to the local file — not the SPA fallback), because a deploy
  had rebuilt staging without applying `DEPLOY-STAGING.md`'s own `tools/`
  exclusion. The 2026-08-18 deploy (email-domain auto-assignment feature)
  followed the checklist's file-list diff and exclusion-presence checks
  exactly and re-confirmed live: `/tools/gis-harvest.mjs` now returns the
  same byte count as `/` (63,157 — the SPA fallback), same as every other
  excluded path (`/.env`, `/scripts/seed-dev.mjs`, `/supabase/config.toml`,
  `/CLAUDE.md`, `/docs/migration/PROGRESS.md`, `/package.json`). No code
  change was needed — the checklist itself was already correct; a deploy had
  simply skipped a step.
- **`README.md` is substantially stale.** It still describes Google-Sheet
  client sign-in, `adminUsers` in `data/access/access.json`, `js/clients.js`
  (deleted in Phase 4), GitHub Pages as the deploy target, and the old
  capture-phase admin auth. Its architecture, media-convention, schema, and
  TourBridge sections are still accurate. Treat this file (`WEBSITE-STATE.md`)
  as current where the two disagree.
- **The GIS build package is mostly gone from the repo.** `CLAUDE.md` used to
  point at `docs/plans/gis/README.md` and `GIS-FULL-SYSTEM-TESTING.md`, and
  `docs/CHANGES.md` and `js/gis/gis-viewer.js` still cite numbered specs like
  `04-SPEC-gis-engine.md` and `06-SPEC-cms-admin.md`. **None of those files
  exist, and `git log` confirms none was ever committed** — only
  `09-BUILD-PLAN.md` survives. `CLAUDE.md`'s pointers were corrected during this
  pass; the historical citations in `docs/CHANGES.md` were left alone, since
  rewriting a changelog's own history would be worse than a dangling reference.
  Don't spend time hunting for the missing specs.

### Resolved 2026-09-05 — memory/network performance audit and fix pass

Full findings list and reasoning: `docs/migration/PROGRESS.md`'s 2026-09-05
entry. Practical, current-state summary:

- The home hero's two 3D models (`Buildings.glb`, `ToolBox.glb`) now decode to
  far less GPU texture memory (measured: `Buildings.glb` ~129MB→~33MB) via a
  texture resolution cap, not just a smaller file — this was the leading
  hypothesis for the site's reported ~1GB Chrome memory usage, though the
  actual JS-heap-vs-GPU split has never been confirmed with a live memory
  profile. The models still mount unconditionally and eagerly on home load
  and keep auto-rotating/rendering even once the visitor navigates away
  (`display:none` on an ancestor, not removed from the DOM) — deliberately
  left as-is pending that profile, since changing it further affects hero UX.
- `assets/logBackground.png` (7.66MB, fetched by every visitor on every page
  load regardless of whether the sign-in modal was ever opened) is now a
  38.7KB `.jpg`, loaded only when the modal actually opens.
- The gated-GIS-map resolver (`functions/api/resource/[key].js`) no longer
  does its tour/feature-tour R2 reads sequentially.
- Every previously-timeout-less client fetch (lead form, sign-in/sign-up,
  session restore, resource/download fetches, the boot-critical `/data`
  fetch, the Admin Board's content fetch) now gives up and surfaces a
  fallback/error after 15s instead of being able to hang indefinitely on a
  stalled connection.
- The GIS engine's local GeoJSON layers (shoreline/boundary, ~1.63MB) now
  load on idle time instead of blocking a map's initial interactivity.
- `css/13-admin.css` and `css/15-gis.css` are no longer in the static
  `<head>` list — they're injected the first time each feature is actually
  used, from both real load points for the admin one. `css/16-help.css`
  stays static on purpose: it positions the always-visible help fab itself,
  not just its overlay content.
- A 30s best-effort cache was added for the GoTrue full-user-directory call
  six admin/org endpoints were each independently re-issuing.
- Two findings from that audit did NOT hold up on closer inspection and no
  code changed for them: `/api/admin/content`'s real payload was already
  ~180KB, not the ~1.86MB an initial proxy-based measurement suggested (it
  already excludes the raw GeoJSON layer bodies); and admin sign-in's
  "double content fetch" is real but was investigated and found genuinely
  not worth fixing at its corrected, smaller size, without adding real
  complexity to the universal (non-admin) boot path.

~~**None of the above has been committed, deployed, or confirmed in a real
browser as of 2026-09-05.**~~ **Corrected 2026-09-06: it was committed
(`d71c77ae`) and deployed the same day** — deployment `0cfe69ba`, ~15 hours
before the 2026-09-06 session. The "not deployed" line above was already wrong
when it was written, and it mattered: it is why nobody went looking when the
GIS map broke. **One of these changes shipped a live outage** — see the GIS
resolver entry below. `docs/migration/FULL-SYSTEM-TESTING.md`'s Part L (tests
144-156) is still the manual pass that has not happened.

The lesson worth keeping: "deployed" and "verified" are separate claims, and so
are "deployed" and "believed to be deployed." A performance change that is
reasoned about but never exercised against the real runtime can be both live
and broken while the documentation says it is neither.

### Security audit, `app` scope — 2026-09-06

Three fixes on branch `security-audit-2026-09-06`; full report and the
dismissed-lead list in `SECURITY-AUDIT-2026-09-06.md`. Practical current state:

- **Link access levels are now enforced on the access level, not the link
  kind** (§4 above). Visitor-facing output is unchanged by design.
- **`js/app.js:116` and `:546` now escape** the sector kicker and use-case card
  title/text before `innerHTML`.
- **`/api/org/invite` reserves its rate-limit ledger row before creating the
  account** and fails closed. This is the one place in the codebase that
  deliberately does *not* use `writeAudit()`, because that helper swallows its
  own failures — right for an audit trail, wrong for a counter.

**All three are now merged to `main`, deployed, and their R2 content synced**
(deployment `fb6554dd`). The link fix runs at publish time, so `data/current/`
was rewritten via `scripts/upload-content.mjs`, plus a hand-built
`data/source/_latest.json` — see the note below on why that second step is not
optional. Verified live: the deployed-mode F-01 probe reports 0 gated links
leaking and 29 public links intact. Part M (tests 157–164) is the manual
browser pass, still to run.

**A trap worth knowing about, found during that sync.** `_latest.json` is
written **only** by `functions/api/publish.js` and read **only** by
`/api/admin/content` — `scripts/upload-content.mjs` does not touch it. So after
a CLI content upload the Admin Board still holds the *previous* content, and
the next "Publish to site" would write that stale copy back over what the CLI
just uploaded. Repo `/data` changes reach R2 through the CLI; Admin Board edits
reach R2 through `/api/publish`; and the two paths do not see each other unless
`_latest.json` is updated alongside a CLI upload. If you ever run
`upload-content.mjs` by hand, regenerate `_latest.json` too.

**The highest-severity invariant was checked during the deploy and it holds.**
Raw `/data` is **not** shipping as static files: `/data/projects/campus.json`
on the live site has no `tourUrl`, while the repo copy does — proof the request
is being served the stripped `data/current/` copy through
`functions/data/[[path]].js`, not a static file shadowing it. Every excluded
path (`/.env`, `/scripts/`, `/supabase/`, `/docs/`, `/tools/gis-harvest.mjs`,
`/CLAUDE.md`, `/wrangler.toml`, `/tests/`, the audit report) returns the
64804-byte SPA fallback rather than real content. `55-deploy-exposure.sh` as a
script still has not been run, but the question it exists to answer has been
answered directly. The `supabase`, `cloudflare` and `deps` scopes are still
unrun.

### GIS map resolver outage — found and fixed 2026-09-06

**`gismap.iberia-coastal` returned 500 to every caller for about 15 hours**, so
the GFC project's map — the only GIS map — could not be opened by anyone. The
resolve runs before the access check, so being signed in made no difference.

Introduced by the 2026-09-05 performance commit (`d71c77ae`), which replaced a
sequential read loop in `listSourceJson()` with `Promise.all` over every R2
`get()` followed by `Promise.all` over every `.json()`. That holds all 27
bodies open at once (14 tours + 13 feature tours). **Workers allows 6
simultaneously open connections, and an unconsumed R2 body counts as one** — so
the runtime closed them (`Response closed due to connection limit`, read from
the deployment's own logs via `wrangler pages deployment tail`) and the
resolver's `catch` turned that into a 500.

The change reasoned about the **50-subrequest ceiling**, which it genuinely did
leave unchanged. The connection limit is a **separate budget**, and
parallelising does not reduce it — it is precisely what exhausts it. Worth
holding onto, because this codebase has hit the subrequest ceiling before
(`functions/api/publish.js`, `functions/api/admin/content.js`) and the habit of
reaching for `Promise.all` came from those fixes.

Fixed in `9ed89866` with bounded concurrency (`READ_CONCURRENCY = 4`): each task
`get()`s **and fully consumes** its own body before taking the next key, so no
more than 4 are ever open. Keeps most of the speedup — about 7 rounds instead
of 27 serial reads. Confirmed live: 500 → 401 across 8/8 requests.

`tests/regression/gis-resolver-connection-limit.mjs` drives the real handler
against a fake R2 binding that enforces the same limit; it is red against the
previous version with the identical error and 500 body seen in production. It
is in `CLAUDE.md`'s testing checklist.

**Two sibling sites carry the same shape and were deliberately left alone**:
`functions/api/admin/entitlements.js:38` (a `pgrst()` per entitlement row) and
`functions/api/publish.js:289` (a `caches.default.delete()` per published
path). Both iterate small collections today and there is no evidence either
fails; they are recorded here so the pattern is recognisable if one ever does.
`functions/api/admin/users.js:14` is a fixed three-element `Promise.all` and is
fine.

---

## 10. Current deployment status

**Live dev site: <https://dts-website-4cu.pages.dev>** (the stable alias —
always the latest deploy; per-deploy hash URLs change every redeploy, don't
bookmark those).

**Current deployment: `fb6554dd`, 2026-09-06, from `main`.** As of that deploy
`main` and the live site are identical — worth keeping true, because for a
while they were not and it made a live outage hard to attribute. R2 content was
synced in the same session (`scripts/upload-content.mjs` plus a regenerated
`data/source/_latest.json`).

- **Migration Phases 0–9 are DONE.** Cloudflare foundation, secret scrub,
  Supabase schema + RLS + dummy seed, client auth swap + resource gating, admin
  auth swap to `site_role`, CMS access editors + org management, the R2 content
  pipeline, the lead form, entitlement-gated builds, and analytics/audit.
- **Handoff has NOT happened.** The site still runs entirely on the
  **developer's personal dev accounts** — Cloudflare account
  `robertoenrique2710@hotmail.com`, Supabase project `DTSdev`
  (`wsqvzyfvxjenqvqjpqjv`, `us-west-2`). Swapping to the client's own
  Cloudflare/Supabase accounts is the remaining step, driven by
  `/migrate-handoff` and `docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md`. Nothing
  in ordinary work should touch account or infrastructure config.
- All data is **dummy/test data**. Seeded accounts: `testadmin@example.com`
  (site_admin), `testorgadmin@example.com` (org_admin at Beta Municipal, member
  at Acme Hotels — note `seed-dev.mjs`'s own console log is stale and prints
  this backwards), `testmember@example.com` (member of Beta Municipal only),
  `testuser@example.com` (registered, no org). Two orgs, one dummy build.
- The old GitHub Pages site is still live in parallel; the Cloudflare deploy is
  not yet the sole live site.

### Verification status — read this before trusting "done"

A cluster of fixes landed on 2026-08-09 and 2026-08-10 that are **deployed and
verified at the API/file level but have never been seen in a real browser** —
Chrome automation was unavailable across all of those sessions. Specifically:

- the org-membership auth-bypass fix (`isUuid()` guard) — the exploit is
  confirmed closed and the legitimate org_admin path confirmed 200 via real
  minted sessions, but the **team panel has not been clicked through**;
- the GIS-link stored-XSS fix (`sanitizeColor()`);
- the Admin Board finally loading gated GIS maps, tours, and experiences;
- the new GIS MAPS collapse/expand nav hierarchy;
- the whole in-app documentation feature, across all four audiences —
  **nothing** in it has been spot-checked even once;
- the sector `active` checkbox (all four sectors are currently `active: true`);
- the iPhone-only crash-loop fix — confirmed live at the file level (the static
  tag is gone from the served HTML, the corrected USDZ filename resolves at
  16,706,226 bytes, `isVisionOS()` is present in the deployed JS) but **not**
  confirmed on an actual iPhone, which is the only thing that can confirm it.

This is exactly what `docs/migration/FULL-SYSTEM-TESTING.md` exists to close.

---

## 11. Where to go next

| You want to… | Read |
|---|---|
| Find any other document | `docs/README.md` (the index) |
| Know how to *use* these docs, or how to prompt for the next task | `docs/DTS-Documentation-Guide.docx` |
| Run a full manual test pass | `docs/migration/FULL-SYSTEM-TESTING.md` |
| Understand access rules precisely | `docs/migration/ACCESS-MODEL.md` |
| Deploy | `docs/migration/DEPLOY-STAGING.md` |
| Know why something is the way it is | `docs/migration/PROGRESS.md` (newest first) |
| See what changed recently | `docs/CHANGES.md` |
| Go live on the client's accounts | `docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md`, then `/migrate-handoff` |
| Work on the GIS build package | `docs/plans/gis/09-BUILD-PLAN.md` |
| Know the working rules | `CLAUDE.md` |

### How to report verification honestly (this project's standing rule)

Always be explicit about which claims are **"confirmed by reading the code,"**
**"confirmed against the real service/data,"** and **"not yet confirmed live."**
Don't blur those together as if they carry the same weight. Prefer, in order:
read the code and trace the real call path → check directly against the real
service/file (`curl`, `node --check`, a real R2 read) → live browser
verification only when a claim is genuinely undecidable otherwise.
