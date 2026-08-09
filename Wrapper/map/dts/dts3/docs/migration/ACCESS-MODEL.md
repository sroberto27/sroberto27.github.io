# DTS Access Model — Normative Spec

This is the single source of truth for identity, organizations, and resource
gating across the migration. Phase 3–9 and Handoff command files reference this
document instead of restating its rules; if a phase file and this document ever
disagree, this document wins and the phase file is out of date.

Grounded in the real code as of the reconciliation pass: `js/app.js`,
`js/admin.js`, `js/content-loader.js`, `data/access/access.json`,
`data/manifest.json`, and the 16 project documents under `data/projects/`.

**Added since the reconciliation pass, still normative here:**
self-registration (§10) — a `registered`-tier account is no longer only
ever DTS-created. Read §10 before assuming every account arrives via
import/invite.

---

## 1. Why not one `user_type`

The old design (and the site's actual `access.json` `roles` block today) treats
"client" as one flat tag. It cannot express "Acme Hotels has three staff, one of
whom manages the others" or "this user is `org_admin` at Acme and a plain
`member` at Beta Municipal at the same time." Six concepts, kept separate:

1. **Authentication state** — guest / authenticated. A Supabase Auth session;
   guest is simply its absence.
2. **Site role** — `user` | `site_admin`. Global, on `profiles.site_role`.
3. **Organizations** — first-class rows, not a repeated string.
4. **Organization membership** — many-to-many, a user may belong to zero, one,
   or many organizations.
5. **Organization role** — `member` | `org_admin`, scoped to *one* membership
   row. `org_admin` at Acme confers nothing at Beta.
6. **Resource access policy + entitlements** — what level a resource requires,
   and (for `restricted`) who specifically holds it.

None of these is ever derived from an email address or its domain. DTS issues
addresses like `Acme_Hotel@dtsxr.com`, but that string carries no permissions —
permissions come only from `profiles`, `organization_members`, and
`resource_entitlements`.

---

## 2. Schema (authoritative shape — Phase 3 implements exactly this)

```
profiles
  user_id        uuid PK, references auth.users
  site_role      text  'user' | 'site_admin'   default 'user'
  display_name   text
  created_at     timestamptz

organizations
  id             uuid PK
  slug           text unique
  name           text
  status         text  'active' | 'disabled'   default 'active'
  created_at     timestamptz

organization_members
  org_id         uuid  references organizations(id)
  user_id        uuid  references auth.users
  org_role       text  'member' | 'org_admin'
  status         text  'active' | 'invited' | 'disabled'  default 'active'
  created_at     timestamptz
  PRIMARY KEY (org_id, user_id)

resource_entitlements
  id             uuid PK
  resource_key   text        -- see §4
  subject_type   text  'org' | 'user'
  subject_id     uuid        -- organizations.id or auth.users.id
  granted_by     uuid        -- auth.users.id of the site_admin who granted it
  created_at     timestamptz

client_apps
  id             uuid PK
  key            text unique   -- resource_key suffix, e.g. 'acme-viewer-win'
  name           text
  platform       text          -- 'windows' | 'android' | ...
  version        text
  r2_object_key  text
  enabled        boolean default true
  created_at     timestamptz
  updated_at     timestamptz

events
  id             uuid PK
  occurred_at    timestamptz default now()
  type           text          -- see §6
  user_id        uuid nullable
  anon_id        text nullable
  org_id         uuid nullable -- stamped server-side, never client-supplied
  resource_key   text nullable
  project_id     text nullable
  metadata       jsonb

admin_audit
  id             uuid PK
  occurred_at    timestamptz default now()
  actor_user_id  uuid
  action         text          -- see §7
  target_type    text
  target_id      text
  org_id         uuid nullable
  before         jsonb
  after          jsonb
```

Indexes: `organization_members(user_id)`, `resource_entitlements(resource_key)`,
`events(occurred_at, org_id)`.

---

## 3. Resource access levels

| Level | Requirement |
|---|---|
| `public` | none |
| `registered` | any authenticated user |
| `client` | authenticated **and** has at least one `organization_members` row with `status = 'active'` |
| `restricted` | authenticated, and a `resource_entitlements` row exists for the user directly, or for an org the user actively belongs to |

Deny-by-default: `restricted` with no matching entitlement is a 403, not a
degraded view.

---

## 4. `resource_key` format

Dotted, stable, never renamed once published (renaming orphans entitlement
rows):

```
project.<projectId>                 -- the project's own default level
project.<projectId>:<experienceId>  -- one experience/link inside it
gismap.<mapId>                      -- a GIS map, keyed independently of any project
download.<clientAppKey>             -- a client_apps row
```

Examples from the real data: `project.gfc`, `project.gfc:tour`,
`project.gfc:map` (→ `gismap.iberia-coastal`), `project.automotive:link-1`,
`download.acme-viewer-win`.

`<experienceId>` is the project document's own `experiences[].id` (or, for a
link, a stable `link-<n>` derived from array position at backfill time and
frozen thereafter — do not re-derive it from position on every publish).

---

## 5. Where the level is authored vs. where entitlements live

**Level → `/data`, edited in the Admin Board, flows through the normal
pipeline** (manifest → `buildConfig()` → `DTS_CONFIG`), because it is
CMS content, not a secret:

```jsonc
// data/projects/<id>.json
{
  "access": "registered",              // project default; omitted = registered
  "experiences": [
    { "id": "tour", "access": "inherit", ... },     // omitted = inherit
    { "id": "map",  "access": "restricted", ... }
  ],
  "links": [
    { "id": "link-1", "access": "registered", "url": "...", ... }
  ]
}
```

Project documents' own descriptive content (`title`, `tagline`, `overview`,
`project{}`, `gallery`, `evidence`, `capturedWith`, `platform`, and every
experience/link's `label`) has **no** access field and is never withheld — it
ships in the public document regardless of the resource's level. Only the
navigable target — `tourUrl`, `embedUrl`/`watchUrl`, and link `url` — is
withheld above `public`.

**GIS maps are a whole-document exception, not a field-level one.**
`js/gis/gis-viewer.js`'s `DTSGis.mount(containerEl, mapDoc)` (`gis-viewer.js:
311-317`) takes the ENTIRE `gisMap` document as its argument — `view`,
`basemaps`, `layers`, `groups`, `bookmarks`, `tours`, `defaultTour` all
together — not a resolved URL the way a Treedis/Vimeo experience is. There is
no separate field inside `project.gfc`'s `experiences[]` entry to strip: the
map's own document (`data/gis/maps/<mapId>.json`) IS the resource, and so is
every `gisTour`/`gisFeatureTour` document that references it by `mapId`. A
gated `gismap.<mapId>` therefore means:
- the project's `experiences[].mapId`/`tourId` pointer is withheld (as with
  any other experience), AND
- the `gisMap` document, and every `gisTour`/`gisFeatureTour` document whose
  `mapId` matches it, is EXCLUDED WHOLESALE from the public `/data` — not
  present with a field stripped, simply not shipped — and moved to
  `data/source/` alongside gated Treedis/Vimeo targets, resolved through
  `/api/resource/gismap.<mapId>` only after the gate passes. `js/app.js` must
  source `mapDoc` for a gated map from that resolved response, never from
  `cfg.gisMaps[mapId]`/`DTS_CONFIG` for a guest or under-entitled session.
- A minimal PUBLIC stub (`id`, `title`, `subtitle` only — no `view`/
  `basemaps`/`layers`/`tours`) may still ship in `data/current/` so a locked
  map tile can render its label without a network round trip, exactly as a
  gated experience's `label`/poster still ship today.

**Locally-hosted layer files are part of the same whole-document boundary.**
Not every `layers[]` entry in a `gisMap` document points at a live ArcGIS
service — `iberia-coastal` has 5 local shoreline/boundary files (plus a parish
boundary mask) under `data/gis/layers/*.geojson`, each loaded by
`js/gis/gis-viewer.js:170`'s `fetch(def.url)` with a plain relative URL. That
fetch is a SEPARATE browser request, entirely independent of
`DTS_CONFIG`/the manifest pipeline — gating the `gisMap` document alone does
NOT stop a guest who knows or guesses `data/current/gis/layers/
shoreline-1935.geojson` from fetching the raw geometry directly, because
`functions/data/[[path]].js` (Phase 6) serves any path under `data/current/`
uniformly, with no per-path check. The 12 live ArcGIS-backed layers in the
same document (`sourceType: esriFeature`/`esriDynamic`/`esriImage`) do NOT
need this treatment — their data lives on a public, unauthenticated ArcGIS
server per `data/gis/sources.json`'s verified CORS/token findings, so gating
DTS's own copy of the URL adds nothing; the resource being protected is
`iberia-coastal`'s local geometry files, not those government endpoints.

The fix: local geojson layer files referenced by a gated map move to
`data/source/` (never `data/current/`), same as the map document. When
`/api/resource/gismap.<mapId>` resolves successfully, it rewrites each local
layer's `url` in the RETURNED document from `data/gis/layers/<file>.geojson`
to `/api/resource/gismap/<mapId>/layer/<layerId>` — a companion route,
re-verifying the SAME access resolution per request, that streams the raw
file from `data/source/`. This requires **zero changes to
`js/gis/gis-viewer.js`**: its `fetch(def.url)` call is unchanged, it simply
receives an already-rewritten URL in the `mapDoc` object it was handed.

Currently only one GIS map exists (`iberia-coastal`, referenced by
`project.gfc`, with 14 `gisTour` + 13 `gisFeatureTour` documents and 6 local
layer files), so this is a bounded, concrete fix, not a hypothetical one —
see Phase 6 §1 for the publish-side implementation.

### `js/config.js` is a third stripping surface, and the easiest to miss

`js/config.js` (814 lines) is the documented fallback that `content-loader.js`
injects dynamically when `/data` is unreachable (`content-loader.js:367-375,
432-434`). It is deliberately **not** a `<script>` tag in `index.html`, so it
never appears in a normal page-load network trace — which is exactly why it
is easy to review a gated site, see clean network traffic, and conclude the
gating works.

It does not. `js/config.js` is still deployed as an ordinary static file, and
it currently contains **16 `spaces.dtsxr.com` tour URLs and 46 Vimeo
references** covering all 16 projects, plus every `links[].url`. Anyone can
fetch `https://<site>/js/config.js` directly and read every gated target,
regardless of what `data/current/` ships. Stripping `/data` while leaving this
file intact accomplishes nothing.

The fix: apply the SAME field-level strip to `js/config.js` that
`data/current/` gets. It keeps structure and copy — brand, categories, form
definitions, and each project's descriptive fields — so its purpose as a
"the site still renders if `/data` dies" fallback survives. It loses every
`tourUrl`, `embedUrl`, `watchUrl`, and `links[].url` whose resolved level is
above `public`. The homepage `treedis.tourUrl`
(`https://spaces.dtsxr.com/tour/4fb22059`) STAYS, because it is `public` by
design (§6 of the reconciliation plan) and the fallback needs it for the
"Try a Digital Twin" reveal to keep working.

Consequence to accept deliberately: in the `/data`-unreachable fallback state,
gated resources are unavailable rather than ungated. That is the correct
failure direction — deny-by-default (§3) applies to degraded states too.
`js/config.js` has no `gisMaps` content today (`config.js:36` is `gisMaps: {}`)
so the GIS surface needs nothing here, but a future edit that populates it
would reintroduce the same leak — the Phase 6 check below must be re-run
whenever `config.js` is regenerated, since `CLAUDE.md` directs keeping it
"roughly in sync" with `/data` and that sync is exactly what would re-add the
URLs.

**Entitlements (who, for `restricted`) → Postgres only**, via
`resource_entitlements`. They are never written into `/data` and never
published to R2 — a restricted resource's `resource_key` is public (so the UI
can render a locked tile), but the identity of who holds it is not.

Resolution order for a given `resource_key`:

1. Read the experience/link's own `access`. If `inherit` or absent, use the
   project's `access`. If the project has none, default `registered` for
   experiences/links, `public` for the project document itself.
2. Evaluate the resolved level per §3.
3. For `restricted`, query `resource_entitlements` for `subject_type='user',
   subject_id=<uid>` OR `subject_type='org', subject_id IN (<uid's active
   org_ids>)`.

This resolution happens **only** inside `functions/api/resource/[key].js`
(Phase 4) — never trust a client-computed decision.

---

## 6. `events` types (product analytics)

`project_view`, `experience_preview`, `login_gate`, `login`, `register`,
`experience_open`, `experience_close`, `map_open`, `download_view`,
`download_start`, `download_complete`.

**Added in Phase 9, still normative here:** `lead_submit`, `lead_fallback`
(the lead form had zero analytics before this — arguably the single
highest-value gap on a marketing site), `sector_view` (category/sector
navigation never changes the URL, so nothing else — not even a future GA4
pageview — would ever see it happen), `faq_search` (the homepage "Ask a
Question" bar, `#qbarInput`, is a real FAQ-matching feature, not decorative
— logged with `metadata: {query, matched}`). `events.type` is a plain `text`
column with no DB check constraint; the enum is enforced application-side in
`functions/api/track.js`.

`org_id` on every row is stamped server-side by `functions/api/track.js`,
never accepted as a client-supplied field (a request that tries is rejected
outright, not silently ignored). Because this app has no org-switcher and a
session can belong to more than one organization at once (§1), "the org
active in the session" only has an unambiguous answer when the caller has
exactly one active org membership — that case gets stamped; zero or more
than one both resolve to `null` rather than guess which org an event
belongs to. Records what happened, never why.

---

## 7. `admin_audit` actions (administrative audit trail)

`site_role.change`, `membership.add`, `membership.remove`,
`org_role.change`, `access_policy.change`, `entitlement.grant`,
`entitlement.revoke`, `download.assign`, `account.disable`,
`account.reactivate`, `invite.send`.

`events` and `admin_audit` are separate tables with separate RLS: `events` is
client-insertable (via `/api/track`) and readable within your own org only;
`admin_audit` is written only by Functions using the service role and readable
only by `site_admin`.

---

## 8. Role capabilities summary

| | guest | user (registered) | org member | org_admin | site_admin |
|---|---|---|---|---|---|
| Browse public content | yes | yes | yes | yes | yes |
| Open `registered` resources | no → login gate | yes | yes | yes | yes |
| Open `client` resources for own org | no | no | yes | yes | yes |
| Open `restricted` resources entitled to them | no | no | if entitled | if entitled | yes (all) |
| Manage own org's members / invite | no | no | no | yes (own org only) | yes (any org) |
| Promote/demote `org_admin` within own org | no | no | no | yes (own org only) | yes |
| Grant `site_admin` | no | no | no | **no** | yes |
| CMS (content, access levels, entitlements) | no | no | no | **no** | yes |
| See other orgs | no | no | no | **no** | yes |
| View `admin_audit` | no | no | no | no | yes |

`org_admin` invite scope: may invite new users into their own org, unlimited by
email domain (DTS issues client addresses on its own domain), subject to
server-side rate limiting and an `invite.send` audit row per §7. This was an
explicit product decision, not a default — see `docs/migration/PROGRESS.md`
risk log if it needs revisiting.

---

## 9. Known residual limitation

A Treedis tour URL, once returned by `/api/resource/[key].js` to an authorized
browser, is a bearer URL for the lifetime of that Treedis session — DTS's
access model controls **who obtains** the URL, not what they do with it
afterward (share it, screenshot it, etc.). Making it unshareable after release
would require Treedis-side support this project does not have. This is stated
here so no later phase silently assumes stronger guarantees than the design
provides.

---

## 10. Account creation paths

Two ways an `auth.users` row (and its auto-provisioned `profiles` row —
`handle_new_user()`, `supabase/migrations/20260807220000_core_schema.sql`)
comes into existence. Both land at exactly the same place: `site_role='user'`,
zero `organization_members` rows — the plain `registered` tier in the §8
table, nothing more, regardless of which path created it.

**1. DTS-created (the originally-assumed path).** Phase 5b's Admin Board (not
yet built) or `scripts/import-clients.mjs` at Handoff. This is the ONLY path
that can ever also create an `organization_members` row or grant
`site_role='site_admin'` — self-registration (below) never does either.

**2. Self-registration (added 2026-08-08, after the reconciliation pass —
not in the original phased plan, an explicit approved extension).** A guest
can create their own `registered`-tier account directly from the sign-in
form, two ways:
- **Email + password** — `supabase.auth.signUp()`. Email confirmation is
  REQUIRED (a deliberate choice, not Supabase's default-off setting) — no
  session exists until the confirmation link is clicked, so the form shows
  a "check your email" note rather than pretending to sign the reader in.
- **Google / Microsoft OAuth** — `supabase.auth.signInWithOAuth()`. First
  sign-in auto-creates the account; there's no separate "sign up with
  Google" action.

Client-side, `js/app.js` handles both through the same `finishSignIn()` tail
as password login, plus a `supabase.auth.onAuthStateChange()` listener so a
sign-up confirmed in a DIFFERENT tab (or any other out-of-band session
change) is picked up without a manual reload.

**Operational status as of 2026-08-08 — check `PROGRESS.md`'s session log
for anything more recent before relying on this:**
- Google/Microsoft OAuth buttons are live in the UI but the providers are
  NOT yet enabled in Supabase — deferred, clicking them currently errors.
  Dev setup steps: `ACCOUNT-SETUP-AND-HANDOFF.md` §6.
- Custom SMTP is NOT configured — Supabase's built-in email is capped at
  2 messages/hour, PROJECT-WIDE, shared across signup confirmation and
  password reset alike. Deferred (blocked on DNS access to a domain, not a
  decision). Setup steps: `ACCOUNT-SETUP-AND-HANDOFF.md` §7. Treat this as
  non-optional before Handoff, unlike OAuth — Supabase documents the
  built-in service as unsuitable for production, independent of whether
  self-registration or OAuth are in use.
