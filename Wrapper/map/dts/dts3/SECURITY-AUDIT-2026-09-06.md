# Security audit — 2026-09-06

**Target:** https://dts-website-4cu.pages.dev · **Commit:** 964d7df0 · **Working tree:** 3 uncommitted files (a skill script, a .docx, one new doc — none affect this scope)
**Scopes completed:** app · supabase · cloudflare · **Fixes:** branch `security-audit-2026-09-06` (`3be4dec0`, `ea805d19`, `84922d80`)
**Scan evidence:** `00-inventory.sh` (run 2026-09-06) plus the targeted greps recorded inline below

## Grounding

DTS is a marketing + client-access single-page app for Digital Twin Studios, served as static
files from Cloudflare Pages with a substantial Pages Functions backend, Supabase (GoTrue +
Postgres/RLS) for identity, and two R2 buckets for content and build downloads. Its users span
anonymous visitors, registered users, org members, `org_admin`s (client portal + team
management), and `site_admin`s (Admin Board / CMS). The live deployment is the dev preview above,
still running on the developer's personal Cloudflare and Supabase (`DTSdev`) accounts — handoff
has not happened and all data is dummy. Migration phases 0–9 are done.

This scope is `app`: the Pages Functions layer and the client code that consumes it. The Functions
query Postgres with the **service role**, so RLS is bypassed entirely and these routes *are* the
trust boundary — there is nothing behind them.

Already known-broken, treated as context and not re-reported: `/api/track` has no rate limiting;
`upload-content.mjs` neither deletes removed R2 content nor purges the edge cache; the
`js/config.js` fallback is access-blind; link identity is positional (`link-<n>`); a Treedis URL is
a bearer URL once issued; SMTP, OAuth providers, GA4/Clarity IDs and the Supabase redirect
allow-list are all handoff-blocked. The 2026-09-05 performance fixes are uncommitted and not yet
confirmed live.

**Tooling:** `00-inventory.sh` ran clean. `semgrep` is absent but no check in this scope depends on
it; no check ran DEGRADED. All triage was done by reading the real call paths, with two claims
confirmed directly against the deployed dev site by `curl`.

---

## Findings

| ID | Severity | Component | Title | Status |
|---|---|---|---|---|
| F-01 | Medium | functions/_lib/split-logic.js | A link's `access` level is unenforced unless its `kind` is `"treedis"` | Fixed, verified (not published) |
| F-02 | Medium | js/app.js | Two CMS-authored sector fields reach `innerHTML` unescaped | Fixed, verified (not confirmed in a browser) |
| F-03 | ~~Low~~ -> hardening | functions/api/org/invite.js | The invite rate limiter's ledger is a best-effort write that swallows its own failures | Fixed; **reclassified - no reproducible exploit** |

---

### F-01 — A link's `access` level is unenforced unless its `kind` is `"treedis"`

**Severity:** Medium — impact Medium (a URL the CMS reports as gated is published to anonymous
callers), exploitability Trivial (one unauthenticated `curl`), reachability Live for the
misreporting and the 29 currently-published URLs, Conditional for a genuine gated leak (it needs
an operator to set a non-`public` level on a non-`treedis` link, which the Admin Board invites).

**Location:** `functions/_lib/split-logic.js:76-82` (and the three sibling implementations:
`scripts/split-content.mjs:256`, `scripts/strip-public-data.mjs:72-73`. A fourth file,
`scripts/backfill-access.mjs:67-68`, carries the same `kind` test but *assigns* access rather
than stripping it, so it was left alone.)

**What it is.** The public/private splitter decides whether to strip a link's `url` from
`data/current/` with `link.kind === "treedis" && resolveAccessLevel(...) !== "public"`. The `kind`
test short-circuits the access test, so **any link that is not a Treedis link keeps its `url` in
the public document no matter what access level it carries.** The resolver at
`functions/api/resource/[key].js:93-107` has no such convention — it gates *every* link at its own
access, defaulting to `registered`. The two halves of the system disagree about the same
`resource_key`.

That disagreement is load-bearing rather than cosmetic, because for links **the strip is the
entire enforcement mechanism.** `js/app.js:1854` returns `{ok:true}` with zero network calls the
moment a node already carries a `url`, and `js/app.js:1512-1526` renders a link that has a `url` as
a plain `<a href>` — its own comment says "A link with its url already present is public (never
stripped)". So a gated non-Treedis link is never routed through `/api/resource/*` at all; the gate
exists and is simply never reached.

**Reachability trace.**
- Entry point: `GET /data/projects/<id>.json` (public, unauthenticated — `functions/data/[[path]].js`, no guard by design)
- Route file: the leak is authored at `functions/_lib/split-logic.js:78`, published by `functions/api/publish.js:170-174`
- Caller's auth state: **anonymous**
- Parameter carrying the payload: none — the URL is simply present in the published document
- What the caller obtains: the `url` of every link whose `kind` is not `treedis`, including the ones the Admin Board's own Access screen reports as `registered`

**Evidence.** The splitter's rule:

```js
// functions/_lib/split-logic.js:76-82
if (Array.isArray(current.links)) {
  for (const link of current.links) {
    if (link.kind === "treedis" && resolveAccessLevel(link.access, current.access) !== "public") {
      if (link.url) delete link.url;
    }
  }
}
```

Against the real deployed site, the same anonymous caller gets both halves:

```
$ curl -s https://dts-website-4cu.pages.dev/data/projects/campus.json
link-1 kind=treedis access="registered" url=(STRIPPED)
link-2 kind=vimeo    access=undefined   url=https://vimeo.com/1202389953/1e9b4d74aa
link-3 kind=vimeo    access=undefined   url=https://vimeo.com/1152008581

$ curl -s -o /dev/null -w "%{http_code}" \
    https://dts-website-4cu.pages.dev/api/resource/project.campus%3Alink-2
401
```

The gate says "sign-in required" for `project.campus:link-2`; the public document hands the same
anonymous caller that link's URL, unlisted-video hash token included.

The CMS side compounds it. `js/admin.js:1136-1145` attaches `accessLevelField()` to **every** link
with no `kind` condition, and new links are created as `kind: "external"` (`js/admin.js:1145`) — so
the access picker on a newly created link is inert from the moment it appears.
`js/admin.js:3179-3184` lists all 29 non-Treedis links in the Access index at
`resolveAccessLevel(link.access, p.access)`, i.e. **`registered`**, and the entitlement picker will
happily grant `restricted` entitlements against a `resource_key` whose URL is already public.

**Confidence.** Confirmed by reading the code (all four splitter implementations, the resolver,
`js/app.js`'s two client paths, the Admin Board editor and Access index) **and confirmed against
the real service/data** (the two `curl`s above, run 2026-09-06 against the dev preview).

**Blast radius.** Today: 28 Vimeo URLs and 1 Matterport URL across 13 project documents are
readable by anyone, several carrying unlisted-video hash tokens that are the only thing keeping
those videos private on Vimeo. The 9 `video`-type *experiences* were explicitly set to
`access: "public"`, so the intent there is clear; the `links[]` entries were never given an access
field at all and therefore resolve to `registered` under the normative spec. The larger exposure is
forward-looking: the next client video or Matterport link an operator marks `client` or
`restricted` will be published in the clear while every UI surface tells them it is gated.

**Proposed fix.** Two parts, and they should be decided separately:

1. *Make the control honest.* Drop the `kind === "treedis"` condition from all four
   implementations so the strip keys off the resolved access level alone, matching
   `functions/api/resource/[key].js` and `ACCESS-MODEL.md` §5. One line per file — but on its own
   this would gate all 31 currently-public Vimeo/Matterport links behind sign-in, a visible product
   change rather than a silent fix.
2. *Preserve today's behaviour deliberately.* If those links are meant to stay public — which
   `scripts/split-content.mjs:256`'s comment ("vimeo links have no access field, always public by
   convention") suggests — then write `"access": "public"` onto each of the 31 links in `/data` as
   part of the same change, so the convention becomes authored data rather than an implicit rule
   hidden in the splitter.

Doing (1) without (2) is a functional regression. Doing (2) without (1) leaves the control inert.
This does not touch the do-not-break list — no load order, no TourBridge strings, no second iframe,
no `DTS_CONFIG` reshape, no `dtsAdminDraft` — but it does change what `data/current/` publishes, so
it needs a republish and a pass over the testing checklist.

**Applied fix.** The operator chose option 2 — keep the links public. Both halves were done in
commit `3be4dec0`:

- The `kind` test was removed from `functions/_lib/split-logic.js`,
  `scripts/split-content.mjs` and `scripts/strip-public-data.mjs`, so all three key on the
  resolved access level alone. `scripts/backfill-access.mjs` was deliberately not touched — it
  assigns access rather than stripping it, and its current behaviour is still correct.
- 29 links across 13 project documents gained an explicit `"access": "public"`, turning the
  unwritten convention into authored data.
- `js/admin.js`'s link-editor hint now states that a link left on "Inherit" resolves to Registered
  and has its URL withheld, because that default is now load-bearing where it previously did
  nothing.

**Exploit test.** `tests/security/probe-f01-link-access-strip.mjs` ·
`node tests/security/probe-f01-link-access-strip.mjs`

The probe runs the real shared splitter over the real `/data` documents, which is the code path
`/api/publish` executes. A `--deployed` mode fetches the published copies instead.

- before fix: `gated links leaking a url : 29` · `[FAIL] no link above 'public' keeps its url in the public copy`
- after fix: `gated links leaking a url : 0` · `[PASS]`
- companion (legitimate access still works): `public links keeping a url: 29` · `[PASS] links resolved as 'public' still carry their url`

Independently confirmed that the gated Treedis link and gated media are still stripped:
`splitProjectDoc()` on `campus.json` yields `link-1 … url=(STRIPPED)`, `media.tourUrl: (STRIPPED)`,
with `link-2`/`link-3` keeping their URLs and `data/source/` untouched.

**Verification.** Probe green, `node --check` clean on all three modified modules and on
`js/admin.js`. **Not published.** The strip runs at publish time, so `data/current/` in R2 still
holds the pre-fix copies until a `site_admin` runs "Publish to site" — the `--deployed` mode of the
probe correctly stays red until then. No visitor-facing regression in the meantime, because the
pre- and post-fix public output is identical for today's content. Publishing needs a `site_admin`
session or R2 credentials from `.env`, neither of which this audit takes.

---

### F-02 — Two CMS-authored sector fields reach `innerHTML` unescaped

**Severity:** Medium — impact Medium (persistent script in every visitor's session; the session
token is in `localStorage`, not an HttpOnly cookie, and the CSP allows `'unsafe-inline'`),
exploitability Hard (requires `site_admin`, the maximally trusted role here), reachability Live.

**Location:** `js/app.js:116` and `js/app.js:546`

**What it is.** `js/app.js` has an `escapeHTML()` helper and uses it at 15 sites. Two dynamic
`innerHTML` assignments skip it:

```js
// js/app.js:116   — sector kicker, mobile nav drawer
a.innerHTML = '<span>' + c.kicker + '</span>';

// js/app.js:546   — use-case card title and body, category view
el.innerHTML =
  '<h3>' + card.title.toUpperCase() + '</h3><p>' + card.text + '</p>';
```

All three values are free-text CMS fields edited in the Admin Board — `js/admin.js:860` (sector
kicker) and `js/admin.js:868-872` (card title / card text) — published through `/api/publish` to
`data/current/` and rendered for **every visitor**, signed in or not.

This is the inconsistency pattern, not a missing concept: the file knows to escape and does so
almost everywhere, including the immediately adjacent `js/app.js:827`, which escapes the *same
card's* `title` and `text` when rendering the "more from this sector" grid. 116 and 546 are the two
that were missed.

**Reachability trace.**
- Entry point: any page load of the home view (drawer) or a category view (cards)
- Route file: content served by `functions/data/[[path]].js`; authored via `POST /api/publish` (`functions/api/publish.js:50`, correctly `site_admin`-gated)
- Caller's auth state to *author*: `site_admin`. To be *hit*: anonymous — every visitor
- Parameter carrying the payload: `sectors/<id>.json`'s `kicker`, and `cards[].title` / `cards[].text`
- What the attacker obtains: arbitrary JS in every visitor's origin, including any signed-in user's Supabase access token in `localStorage`

**Evidence.** `js/app.js:116`, `js/app.js:546` above; the escaping counterexample at
`js/app.js:827`; the CMS editors at `js/admin.js:860` and `js/admin.js:868-872`. `_headers` carries
`script-src 'self' 'unsafe-inline' …`, so an injected inline `<script>` executes.

**Confidence.** Confirmed by reading the code. Not confirmed live — no payload was published to the
dev site, since that is a destructive write to shared CMS content.

**Blast radius.** Ranked with this project's own `site_admin` calibration: the author can already
publish arbitrary site content and read every gated resource, so this is not guest-facing XSS. What
it adds is **persistence and blast radius** — one phished or malicious `site_admin` becomes
arbitrary JavaScript running in every visitor's session indefinitely, rather than one bad content
publish, and every signed-in visitor's bearer token becomes readable.

**Applied fix.** Commit `ea805d19`. All three values now go through the existing `escapeHTML()`,
matching what `js/app.js:827` already does with the same two card fields. The card title is
upper-cased *before* escaping — the other order would upper-case the entity names it produces
(`&lt;` → `&LT;`). No do-not-break surface touched.

**Exploit test.** `tests/security/probe-f02-cms-html-injection.mjs` ·
`node tests/security/probe-f02-cms-html-injection.mjs`

The probe locates each `innerHTML` assignment in `js/app.js`, extracts its right-hand side, and
evaluates it with the file's own `escapeHTML()` and a crafted payload — so it exercises the
shipping expression rather than a restatement of it. Detection is by counting tag openings against
a benign baseline, not by grepping for `<img` or `onerror`: those strings still appear, correctly
escaped, after the fix, and a detector that flagged them could never go green.

- before fix: `<span><img src=x onerror="alert(1)"></span>` — `tags: 2 baseline, 3 with payload`;
  `<h3><IMG SRC=X ONERROR="ALERT(1)"></h3>…` — `tags: 4 baseline, 6 with payload` · `[FAIL]`
- after fix: `<span>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</span>` — `tags: 2 baseline, 2 with payload` · `[PASS]`
- companion (legitimate access still works): `[PASS] ordinary sector text still renders unchanged` —
  asserts the upper-cased title *and* the un-upper-cased body text both survive, which is what
  catches an escape/upper-case ordering mistake

**Verification.** Probe green; `node --check js/app.js` clean. The probe was re-run against the
pre-fix file (via `git stash`) to confirm it goes red on vulnerable code — a regression test that
only ever passes proves nothing.

**Still not confirmed in a browser.** Reaching these sinks end to end means publishing a payload
into shared CMS content on the dev site, which is a destructive write to state other people use, so
it was not done. Manual tests 161–162 cover the rendering regression.

---

### F-03 — The invite rate limiter's ledger is a best-effort write that swallows its own failures

> **Reclassified during the fix pass: this is hardening, not a vulnerability.** It was originally
> ranked Low. On closer examination while writing the exploit test, an `org_admin` has **no
> reliable way to make the `admin_audit` insert fail** — every column in that row is server-derived
> except an email GoTrue has already accepted and validated. The bypass therefore only materialises
> under database failure, which is a robustness property rather than an attack. By this skill's own
> rule ("a finding whose exploit cannot be reproduced is not real"), it belonged in
> *Investigated and dismissed* rather than the findings table. It was fixed anyway, with the
> operator's approval, because the change is cheap and correct — but it should not be read as a
> closed hole, and it is left here rather than moved so the reasoning is not lost.

**Severity (as originally assessed):** Low — impact Low (bypasses the only real rate limit in the
codebase; creates accounts, does not disclose data), exploitability Moderate (needs an existing
`org_admin` or `site_admin` session *and* a way to make the audit write fail), reachability Live.
**Corrected:** exploitability is effectively *not achievable* by the caller; see the note above.

**Location:** `functions/api/org/invite.js:34-41`, depending on `functions/_lib/admin.js:53-72`

**What it is.** `invite.js` enforces 20 invites per actor per rolling hour by counting
`admin_audit` rows with `action = 'invite.send'`. Those rows are written by `writeAudit()`, which
is explicitly and deliberately fire-and-forget:

```js
// functions/_lib/admin.js:66-70
} catch (err) {
  console.error("[admin] audit write failed:", action, err);
}
```

The invite itself has already succeeded by then — the GoTrue account and the membership row are
both committed. So any condition that makes the audit insert fail produces a successful invite that
never increments the counter, and the limiter silently stops limiting.

**Reachability trace.**
- Entry point: `POST /api/org/invite`
- Route file: `functions/api/org/invite.js:39`
- Caller's auth state: `org_admin` of the target org, or `site_admin`
- Parameter carrying the payload: none directly — the bypass is a failure mode of the ledger, not an input
- What the caller obtains: unbounded account creation on the project's Supabase instance

**Evidence.** `functions/api/org/invite.js:35-41` reads the ledger; `functions/_lib/admin.js:66-70`
is the swallow. The header comment on `writeAudit()` states the swallow is intentional ("a failed
audit write after a successful mutation should be logged server-side, not roll back or mask the
mutation's own result") — a sound rule for an audit trail and an unsound one for a rate-limit
counter. The problem is that one function is doing both jobs.

**Confidence.** Confirmed by reading the code. Not confirmed live — triggering it would need a way
to fail the `admin_audit` insert, which I did not attempt against the dev database.

**Blast radius.** Account-creation abuse and Supabase quota consumption by an already-privileged
caller. Bounded by the fact that the caller must already hold `org_admin`, and every created
account lands at `site_role = 'user'` with a membership only in the org they already administer.
It becomes materially worse once custom SMTP is configured at handoff, since invites will then send
real email.

**Applied fix.** Commit `84922d80`. The proposal above ("await it, 500 on failure") turned out not
to close anything on its own — the account is already created by that point, so the caller still
gets an account with no ledger row. The ledger has to be written *before* the side effect it
counts. So:

- The `invite.send` row is **reserved before** the GoTrue account is created, written directly
  rather than through `writeAudit()`, and fails closed with a 503 if it cannot be written.
- If account creation then fails, the reservation is **released**, so a rejected invite neither
  counts against the limit nor leaves an `admin_audit` row for an invite that never happened
  (`ACCESS-MODEL.md` §7).
- The created account's id is attached to the reserved row afterwards, best-effort — by then the
  row already exists and already counts, so a failure there costs one `target_id`, not the limit.

`writeAudit` is no longer imported by this route. That is the one deliberate exception to the
codebase's "every audited mutation goes through `writeAudit()`" pattern, commented at both the
import and the reservation block.

**Exploit test.** `tests/security/probe-f03-invite-ledger-order.mjs` ·
`node tests/security/probe-f03-invite-ledger-order.mjs`

**This is a structural regression guard, not an exploit probe, and it is the weakest test in the
directory** — its own header says so. There is no reproducible exploit (see the reclassification
note above), so rather than fake one it asserts the ordering invariant that makes the failure mode
safe.

- before fix: `ledger write at: 2487`, `account create: 1850` · `[FAIL] the ledger row is written
  AFTER the account is created` and `writeAudit() appears in this route`
- after fix: `ledger write at: 1970`, `account create: 2747` · `[PASS]`
- companion (legitimate access still works): `[PASS] a successful invite is still audited, and an
  abandoned one is not` — checks the reserved row is still tied to the created account and that a
  release path exists

**Verification.** Probe green; `node --check` clean. Re-run against the pre-fix file via `git stash`
to confirm it goes red. A genuine behavioural test would need fault injection into the dev
database, which was not done. Manual tests 163–164 cover the happy path and the rejected-invite
path.

---

## Investigated and dismissed

| Lead | Source | Why it is not a finding |
|---|---|---|
| PostgREST filter injection via `${...}` in `pgrst()` templates | 40-appsec §4 (this project's proven class) | Every one of the 45 interpolations is guarded. Path/body ids pass `isUuid()` before use (`admin/users/[id].js:15,69`, `admin/organizations/[id].js:15,62`, `admin/entitlements/[id].js:12`, `admin/organizations/[id]/domains.js:26,38`, `.../domains/[domainId].js:21-22,66-67`, `admin/entitlements.js:61`, `org/members.js:88,121`, and `orgId` inside `requireOrgAdminOf()` at `_lib/admin.js:44`). String keys use `encodeURIComponent()` (`download/[key].js:25`, `admin/apps*.js`, `admin/organizations.js:32`). `audit.js:31`'s `limit` is a clamped `parseInt`. The two remaining unguarded values — `isSiteAdmin()`'s `userId` at `_lib/access.js:80` and `entitlements.js:18`'s `row.subject_id` — come from a verified JWT and from a column `isUuid()` validated on insert. |
| 1 route file calls no guard (`functions/data/[[path]].js`) | 00-inventory `route-guards` LEAD | Public by design and on `WEBSITE-STATE.md` §5.10's documented exception list. It reads only the hardcoded `data/current/` prefix and is itself the access-checked public content route. |
| Guard return values possibly unchecked before a side effect | 40-appsec §2a | All 31 guard call sites check `if (auth.response) return auth.response;` on the immediately following line, before any `pgrst()`, R2 access or mutation. Verified by reading every one. |
| Path traversal into `data/source/` via the public data route or a resource key | 40-appsec §4 | `functions/data/[[path]].js:27` rejects any segment that is `..` or contains `/`. More fundamentally, R2 object keys are opaque strings with no path normalisation, so a literal `..` in a key resolves to a non-existent object rather than traversing. Same reasoning for `getSourceJson(env, "projects/" + projectId + ".json")`. |
| IDOR on id-taking routes | 40-appsec §3 | Every id-taking route re-derives authority server-side. `org/members.js` and `org/invite.js` pass `orgId` to `requireOrgAdminOf()`, which checks the caller's real membership row rather than trusting the request (`_lib/admin.js:38-50`). Write verbs get the same check as reads. All `admin/*` routes are `requireSiteAdmin`. `download/[key].js:31` and `resource/[key].js:33` both re-run `checkAccess()`; the GIS layer route at `layer/[layerId].js:25-33` deliberately re-checks rather than trusting the parent resolve. |
| Mass assignment on PATCH routes | 40-appsec §7 | Every mutation builds an explicit `patch` object from named, validated fields — `admin/organizations/[id].js:22-38`, `admin/apps/[key].js:29-49`, `admin/users/[id].js:22-58`, `org/members.js:90-98`. No route forwards a request body into an update. `client_apps.r2_object_key` is reachable only via `apps/upload.js`, which constrains both halves of the key by regex (`:28`, `apps.js:33`). |
| CSRF | 40-appsec §6 | No cookie is set or read anywhere in `functions/` or `js/` (grep for `Set-Cookie` / `document.cookie` returns nothing). Auth is a bearer token from `localStorage`, attached explicitly at `js/app.js:1833-1835`. No route authenticates on anything ambient. |
| 29 `innerHTML` sites in `js/admin.js` with zero escape calls | 00-inventory sink count | All 29 are `element.innerHTML = ""` clears. The Admin Board builds its DOM through `createElement` + `textContent` and has no dynamic HTML injection, which is why it needs no escape helper. |
| Sibling fields on the decoded share-link state (the prior XSS path) | 40-appsec §5 | Checked each field `applyState()` consumes (`js/gis/gis-viewer.js:1580-1612`). `obj.b` is allowlisted against `basemapDefs`; `obj.l[id][2]` (`fillPattern`, added *after* the `sanitizeColor()` fix — the exact "new sibling" risk) is allowlisted against `FILL_PATTERNS` at `gis-viewer.js:825`; `obj.f` filter conditions reach `buildWhereFromConditions()` and never an HTML sink — `gis-tools.js` renders feature values with `text:` (textContent) and has exactly one dynamic `html:` at `:557`, which is escaped. `d.color` and `d.text` remain covered by `sanitizeColor()`/`escapeHtml()`. |
| Unescaped CMS values in the lead-form field builder (`js/app.js:2869`) | 40-appsec §5 | `f.label`, `f.name`, `f.type` and `f.options[]` are interpolated without escaping, but `data/forms/*.json` has **no editor in the Admin Board** (no forms pane exists in `js/admin.js`). The author is therefore someone with repository write access — the same trust level as a code constant. Carried into residual risk rather than dropped. |
| `content-disposition` header injection in the download route (`functions/api/download/[key].js:50`) | 40-appsec §4 | `filename` derives from `r2_object_key`, which only `apps/upload.js` can set, and both of its components are regex-constrained to `[a-z0-9-]+` and `[a-zA-Z0-9._-]+` (`:28`, `apps.js:33`). No quote, CR or LF can reach the header. |
| Client-side role flags deciding access (`session.siteRole`, `window.DTS_ACCESS`) | 40-appsec §8 | These decide only which UI renders. Every privileged route re-derives the role from the verified JWT via `isSiteAdmin()`, and `GET /api/admin/content` — the only path to the unstripped document set — is `requireSiteAdmin`-gated. A user who flips `siteRole` in the console gets an empty Admin Board shell and 403s on every write. |
| `js/admin.js` loaded for every visitor | 00-inventory (dynamic script injection at `content-loader.js:427`) | Payload-size decision only; see the row above for why nothing security-relevant depends on it. |

---

## Accepted and residual risk

- **`'unsafe-inline'` in `script-src`** — recorded as a deliberate match to existing behaviour at
  `docs/migration/PROGRESS.md:2932`. It is what makes F-02 executable rather than inert; noted here
  so the dependency between the two is explicit.
- **Session token in `localStorage` rather than an HttpOnly cookie** — inherent to the Supabase JS
  client as used. It raises the value of every XSS finding on this site; stated so F-02's ranking
  is legible.
- **Vimeo/Matterport link URLs are public "by convention"** — recorded only in a code comment at
  `scripts/split-content.mjs:256`. F-01 is the second-order consequence of that convention: what
  was accepted is "these particular links are public," not "the access control on every
  non-Treedis link is permanently inert, including on links authored later." Those are different
  decisions and only the first was made.
- **The lead-form field builder does not escape CMS values** (`js/app.js:2836-2870`) — currently
  safe only because no CMS editor exists for `data/forms/*.json`. It becomes a real F-02-class
  finding the day a forms editor is added.
- **`/api/track` has no rate limit** — already recorded in `WEBSITE-STATE.md` §9.

---

## Human action items

- ~~**Decide F-01's product question before its code question.**~~ **Done** — the owner chose to
  keep the 29 links public, so they now carry an explicit `"access": "public"` and visitor-facing
  output is unchanged.
- **Publish, or F-01 is not live.** ← *the outstanding one.* The strip runs at publish time, so
  `split-logic.js` changing does nothing until a `site_admin` uses the Admin Board's "Publish to
  site" and `data/current/` is rewritten. Nothing regresses in the meantime — pre- and post-fix
  public output is identical for today's content — but the CMS control is not live until then.
  This audit cannot do it: publishing needs a `site_admin` session or R2 credentials from `.env`,
  neither of which it takes. Manual test 157 is this step.
- **Deploy the code.** The three fixes are committed on branch `security-audit-2026-09-06`, not
  merged and not deployed. `docs/migration/DEPLOY-STAGING.md` is the authority; deploying is not
  something this audit should improvise.
- **Run the manual pass.** `docs/migration/FULL-SYSTEM-TESTING.md` Part M (tests 157–164). Test 159
  in particular covers the one real behaviour change for CMS editors: a new link left on "Inherit"
  is now gated where it used to be silently public.
- **No key rotation is indicated by this scope.** `.env` was never read, per the skill's
  constraints; secrets in history are `20-secrets.sh`'s job and were not run this session.

---

## Untested areas

- **`supabase`, `cloudflare` and `deps` scopes were not run.** This session was scoped to `app`
  only. Specifically unanswered: whether each RLS policy's *logic* is correct (only the fact that
  the Functions bypass RLS entirely was in scope here); whether raw `/data` is shadowing the
  access-checking Function on the current deploy (`55-deploy-exposure.sh` — the single
  highest-severity invariant on this project, and it was **not** verified today); whether the
  deployed `js/config.js` is the stripped copy; CSP and cache headers on gated routes; CORS
  behaviour; and dependency advisories.
- **F-02 was not confirmed live.** Doing so means publishing a payload to shared CMS content on the
  dev site, which is a destructive write and needs approval.
- **F-03's failure mode was not triggered.** Confirming it means forcing an `admin_audit` insert to
  fail, which I did not attempt against the dev database.
- **No browser-level verification was done**, per `CLAUDE.md`'s standing verification order.
  Nothing in this scope turned out to be undecidable by code-reading plus direct service checks.
- **The 2026-09-05 performance changes are uncommitted**, so the working tree and the deployed site
  differ. Both `curl` results above describe the deployed site; every `file:line` citation describes
  the working tree. For the code paths in these three findings the two agree.

---

## Corrections to this report

Recorded rather than silently edited, because the first version was circulated.

- **The affected link count is 29, not 31.** 31 was the number of non-Treedis links; four Treedis
  links are correctly stripped, and two of those four sit inside that count. The real figure is 28
  Vimeo + 1 Matterport = **29**, across **13** project documents (not 15). Corrected throughout.
  Confirmed by the F-01 probe, which counts them directly.
- **F-03 was over-ranked.** Reclassified from Low finding to hardening; see the note in its own
  section for why, and the findings table for the corrected status.
- **`scripts/backfill-access.mjs` was miscounted as a fourth "splitter".** It carries the same
  `kind` test but *assigns* an access level rather than stripping a URL, so it was correctly left
  unchanged. Three implementations were fixed, not four.

---

## Documentation updates — applied

The document/code drift F-01 exposed was resolved **in favour of the documents** — `ACCESS-MODEL.md`
§5 was already right ("loses every … `links[].url` whose resolved level is above `public`"); the
code was wrong. So these edits record and reinforce the rule rather than weakening it.

**`docs/migration/ACCESS-MODEL.md`** — the resolution order now states explicitly that step 1
applies to every link **whatever its `kind`**, that there is no kind-based exemption, and that a
link authored with no `access` is therefore gated. The old unwritten convention is named as the
thing that disagreed, with a pointer to F-01.

**`docs/WEBSITE-STATE.md`** — §4 gained a paragraph stating that a link's `url` is stripped on the
resolved access level alone, plus the two consequences that are easy to get wrong: a link with no
`access` is withheld, and **for links the strip *is* the enforcement** (because
`resolveExperienceNode()` short-circuits when a `url` is present, anything wrongly published
bypasses the gate entirely rather than merely leaking a stale string). §9 gained a dated subsection
for this audit, including the fact that the fixes are committed but **not published**, and that
`55-deploy-exposure.sh` was never run. The header's "last updated" line was amended.

**`docs/migration/PROGRESS.md`** — a full session-log entry: what each finding was, the live
evidence for F-01, the owner's product decision, F-03's mid-fix reclassification, how each probe
was confirmed red before being confirmed green, and what remains blocked.

**`docs/CHANGES.md`** — a "Fix: security audit (app scope)" entry at the top, leading with F-01
and flagging the one behaviour change for editors.

**`docs/migration/FULL-SYSTEM-TESTING.md`** — new **Part M, tests 157–164**. Test 157 is the
republish itself; 159 covers the new-link-defaults-to-gated change; 160 verifies a Registered link
is genuinely absent from the page source; 163–164 cover the invite happy path and the
rejected-invite audit trail.

**`CLAUDE.md`** — the probe suite is wired into the testing checklist as a one-line loop needing no
credentials and no network, with a note that the F-01 probe's `--deployed` mode legitimately stays
red until a republish. Separately, the dead "Sign-in with `demo` / `1234`" checklist item was
corrected to a real Supabase fixture account — unrelated to these findings, but it is a trap in a
checklist people are told to run after every change, and it was already flagged in
`references/00-conventions.md` as a known stale claim.

---
---

# Scope: `supabase` — appended 2026-09-06

**Target:** Supabase project `DTSdev` (`wsqvzyfvxjenqvqjpqjv`, `us-west-2`), reached both through
the live Postgres catalog and through PostgREST with the publishable key ·
**Commit:** `b1bec220` on `main` · **Working tree:** dirty — 3 paths
(`.claude/skills/security-audit/scan/30-rls.sh`, `docs/DTS-Documentation-Guide.docx`, untracked
`docs/CONTENT-VERIFICATION.md`); none is application code, so local greps and live probes describe
the same site.
**Scan evidence:** `.claude/skills/security-audit/scan/results/2026-09-06/` (archived `30-rls.txt`),
plus two fresh runs made during this session.

## Grounding (supabase scope)

This scope audits exactly one of the two trust boundaries: **browser → Supabase direct**, where the
publishable key ships to every visitor and RLS policies are the only enforcement. It does *not*
cover the Cloudflare Functions, which query with the service role and bypass RLS entirely — that was
the `app` scope earlier in this document. The practical consequence is that every `.from()` in `js/`
is in scope and every `pgrst()` in `functions/` is not, and that a control implemented only in a
Function is, from this scope's point of view, not a control at all.

**Tooling.** Both scans ran at full strength, and this is a genuine upgrade on the last run. The
archived `30-rls.txt` from earlier today records `[ERROR] rls-live` — psql could not resolve
`db.wsqvzyfvxjenqvqjpqjv.supabase.co` — and fell back to `[DEGRADED] rls-static`, reading the
committed migrations only. In this session the live read **succeeded**, via
`supabase/.temp/pooler-url` + `SUPABASE_DB_PASSWORD` against `aws-1-us-west-2.pooler.supabase.com`.
So the policy text, role grants, view list, storage-bucket list and `SECURITY DEFINER` `search_path`
settings below are read from the **live catalog**, not inferred from migration files — which is what
makes the grants section meaningful at all. `40-supabase-cfg.sh` read the live GoTrue settings
endpoint and probed PostgREST anonymously. No check in this scope was skipped.

Static-vs-live drift: **none.** The live catalog's 25 policies across 8 tables match the committed
migrations exactly, table for table and predicate for predicate. That is a real result worth
recording — it means the migrations can be trusted as a description of production for this scope.

---

## Findings (supabase scope)

| ID | Severity | Component | Title | Status |
|---|---|---|---|---|
| F-S01 | Medium | `…_rls_policies.sql:18,31` | Disabling an organization revokes nothing on the RLS path — `is_org_member()`/`is_org_admin()` omit the org-status join that `activeOrgIdsFor()` has | Fixed, verified |
| F-S02 | Medium | `…_rls_policies.sql:166` | `events_insert` gives every anonymous holder of the publishable key an unvalidated, unmetered direct write into `events`; no client code uses the policy | Fixed, verified |
| F-S03 | Low | `…_rls_policies.sql:147` | `client_apps_select` exposes every column, including `r2_object_key`, to any authenticated user | Fixed, verified |

Ranked by real exploitability. F-S02 is trivially reachable by anyone on the internet with no
account and is the fix-first item; F-S01 has larger impact but needs a precondition that does not
currently hold in the dev data.

---

### F-S01 — Disabling an organization does not revoke anything on the RLS path

**Severity:** Medium — impact Medium-to-High (an org's full analytics history, member roster and
entitlement list stay readable after revocation, and an `org_admin` keeps membership-management
rights), exploitability Moderate (requires an active membership in the org at the time it was
disabled), reachability Live-but-conditional (the code path is live and disabled orgs exist today;
no disabled org currently has a member, so it is **not** exploitable against the present dataset —
it opens the moment a populated org is disabled, which is the feature's entire purpose).

**Location:** `supabase/migrations/20260807220100_rls_policies.sql:18` (`is_org_member`) and `:31`
(`is_org_admin`).

**What it is.** Both RLS helpers resolve the caller's org membership by filtering on the
**membership row's** `status = 'active'` and nothing else. Neither joins `organizations` to check the
**organization's** own `status`. The sibling function on the Functions path, `activeOrgIdsFor()`,
does exactly that join — and its comment says it was added because this precise bug was found and
fixed during Phase 5b. The RLS helpers were never given the same fix, so the bug still lives on the
path where RLS is the only control.

**Reachability trace.**
- Entry point: `GET/POST/PATCH/DELETE https://wsqvzyfvxjenqvqjpqjv.supabase.co/rest/v1/<table>`,
  called directly with the publishable key and the caller's own JWT. No Cloudflare Function is
  involved, so no server-side guard applies.
- Policy sites: `…_rls_policies.sql:107` (`organization_members_select`), `:87`
  (`organizations_select`), `:129` (`resource_entitlements_select`), `:175` (`events_select`),
  `:111`/`:115`/`:120` (member insert/update/delete).
- Caller's auth state: a signed-in user holding an `active` membership row in an org whose own
  `status` is `'disabled'`.
- Parameter carrying the payload: none needed for the reads; `org_id` on the member-management
  writes, checked against `is_org_admin(org_id)` — which returns `true` for a disabled org.
- What the caller obtains that they should not: after an administrator has disabled the org, its
  members can still read the `organizations` row, the **full member roster** (`user_id`, `org_role`,
  `status` for every colleague), the org's `resource_entitlements` list, and **every `events` row
  attributed to that org**. An `org_admin` of the disabled org can additionally still insert, update
  and delete membership rows — including promoting someone to `org_admin`.

**Evidence.**

The RLS helper — membership status only (`…_rls_policies.sql:18-28`):

```sql
create or replace function public.is_org_member(check_org_id uuid)
...
  select exists (
    select 1 from public.organization_members
    where org_id = check_org_id and user_id = auth.uid() and status = 'active'
  );
```

The Functions-path sibling, which does join, and says why (`functions/_lib/access.js:84-96`):

```
// Requires the ORGANIZATION's own status to be active too (PostgREST's
// !inner embed + dot-filter on the embedded table), not just the membership
// row's status -- found while building the Phase 5b "disable an
// organization" feature and verified live before this fix existed: a
// disabled org's still-"active" membership rows previously kept granting
// client-level access with zero enforcement, making "disable" purely
// cosmetic.
```
```js
`organization_members?select=org_id,organizations!inner(status)&user_id=eq.${userId}&status=eq.active&organizations.status=eq.active`
```

What the product promises the operator when they click Disable (`js/admin.js:2777-2780`):

```js
if (next === "disabled" && !confirm(
  "Disable “" + org.name + "”? Its members immediately lose client-level access. " +
  "Membership and entitlement rows are kept, not deleted — reactivate any time to restore them."
)) return;
```

Live state, read from the catalog this session (read-only query; UUIDs omitted):

```
acme-hotels|active                       beta-municipal|active|org_admin|active|1
beta-municipal|active                    phase5b-cp-b-test-org|disabled  (0 members, 0 events)
deployed-cp-b-test|active                test-1|disabled                 (0 members, 0 events)
```

**Confidence.** *Confirmed by reading the code* for the divergence between the two helpers and for
what each policy permits. *Confirmed against the real service/data* for the live policy text (the
catalog read reproduces `is_org_member(org_id)` with no org-status join) and for the current org
inventory. **Not confirmed live** as an executed exploit: no session was minted for a member of a
disabled org, because no such member exists — creating one means writing to the database, which the
rules of engagement put behind your approval.

**Blast radius.** Bounded, and worth being precise about: `checkAccess()` →
`hasActiveOrgMembership()` → `activeOrgIdsFor()` **does** join org status, so the confirm dialog's
headline promise — "members immediately lose client-level access" — genuinely holds. Gated projects,
experiences, GIS maps and downloads all stay denied. What does not hold is everything else: the data
directly readable through PostgREST, and the membership-management surface. The worst case is a
contract termination or a compromised-account incident, where "disable the organization" is exactly
the control an operator reaches for, and where it silently leaves the org's analytics history and
roster readable and its admin still able to mutate membership.

**Cross-scope note — the RLS fix alone will not close this.** `functions/_lib/admin.js:20-26`'s
`isOrgAdmin()` has the *same* omission:

```js
`organization_members?user_id=eq.${userId}&org_id=eq.${orgId}&org_role=eq.org_admin&status=eq.active&select=org_id&limit=1`
```

It is the guard behind `requireOrgAdminOf()`, which gates `functions/api/org/members.js` (4 call
sites) and `functions/api/org/invite.js:28`. So an `org_admin` of a disabled org can also still
manage members *and create brand-new user accounts* through the Function path. That half is an
`app`-scope finding by the scope split, but it shares one root cause with F-S01, and fixing only the
RLS half would leave it open. Recorded here rather than deferred, because splitting one root cause
across two reports is how the second half gets forgotten.

**Proposed fix.** Add the organization-status join to both RLS helpers, in a new migration —
mirroring what `activeOrgIdsFor()` already does:

```sql
create or replace function public.is_org_member(check_org_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.org_id = check_org_id and m.user_id = auth.uid()
      and m.status = 'active' and o.status = 'active'
  );
$$;
```

and the same `join` / `o.status = 'active'` in `is_org_admin`. Both are `create or replace`, so no
policy needs dropping or recreating and no policy text changes. Then the matching join in
`functions/_lib/admin.js:20-26`.

This does **not** touch the do-not-break list. It is a schema change needing a migration and a
deploy window, so it is also a human-action item below.

Two consequences to weigh before approving, because they are behaviour changes rather than pure
hardening:

- A site_admin reactivating an org restores everything, since nothing is deleted — which already
  matches the confirm dialog's second sentence.
- `js/app.js:2071-2073`'s `buildSessionFromAuth()` also filters only on membership status, so a
  disabled org still appears in `access.session.orgs` and its team panel still renders. After the RLS
  fix that panel would render and then fail its reads, which is worse than not rendering. The
  client-side filter should land in the same change.

**Exploit test.** Not yet written — per the skill's flow, exploit tests are written only for approved
findings, and this one additionally needs a seeded fixture (a member of a disabled org) that does not
exist yet. The failing-first test to write: mint a session for a member of a disabled org, assert
`GET /rest/v1/events?org_id=eq.<disabled>` returns rows before the fix and `[]` after, with a
companion asserting a member of an *active* org still reads their own org's events.

---

### F-S02 — `events_insert` gives every anonymous visitor a direct, unvalidated write into `events`

**Severity:** Medium — impact Medium (data integrity and availability: forged analytics, forged
attribution to a real user or org, unbounded row growth; **no** confidentiality breach and **no** XSS
— the Activity tile renders through Chart.js to a `<canvas>`, not to `innerHTML`), exploitability
**Trivial** (one `curl`, no account, the key is a published static file), reachability Live. Per the
rubric's own tie-breaker, a trivially exploitable Medium outranks a hard-to-reach High — this is the
fix-first item, and the cheapest fix in the report.

**Location:** `supabase/migrations/20260807220100_rls_policies.sql:166-169`.

```sql
create policy "events_insert"
  on public.events for insert
  to anon, authenticated
  with check (true);
```

**What it is.** `with check (true)` for `anon` means anyone holding the publishable key — which ships
to every visitor in a static file — can `POST /rest/v1/events` with a body of their choosing. Every
application-side control on this table lives in `functions/api/track.js` and is bypassed entirely by
talking to PostgREST directly: the 17-value `EVENT_TYPES` allowlist, the explicit rejection of
caller-supplied `user_id`/`org_id`, and the server-side org stamping.

The part that makes this cheap to fix: **nothing uses the policy.** A grep for `.insert(` across
`js/` returns zero hits, and the only client-side `events` access is a SELECT at `js/app.js:2382`.
Every legitimate write goes through `track.js`, which uses the **service role** and therefore
bypasses RLS and needs no insert policy at all. The policy is pure attack surface with no functional
counterpart.

**Reachability trace.**
- Entry point: `POST https://wsqvzyfvxjenqvqjpqjv.supabase.co/rest/v1/events`, headers
  `apikey: sb_publishable_…` and `Content-Type: application/json`.
- Caller's auth state: **anonymous.** The policy names `anon` explicitly.
- Parameter carrying the payload: the whole request body — `type`, `user_id`, `org_id`,
  `resource_key`, `project_id`, `metadata`.
- What the caller obtains that they should not: the ability to write arbitrary rows into the
  analytics table that the client portal's Activity tile and site_admin reporting read from.

**Evidence.** Live catalog, section 4 ("Unconditional predicates"):

```
 schemaname | tablename |  policyname   |  cmd   |        roles         | with_check_expr
 public     | events    | events_insert | INSERT | {anon,authenticated} | true
```

Live grants (section 6) confirm `anon` holds `INSERT` on `public.events`, so the policy is the only
thing between an anonymous caller and the table.

The key is genuinely public — fetched from the deployed site during this audit:

```
$ curl -s https://dts-website-4cu.pages.dev/js/supabase-init.js
window.DTS_SUPABASE = supabase.createClient(
  "https://wsqvzyfvxjenqvqjpqjv.supabase.co",
  "sb_publishable_…"           # redacted here; publishable by design
);
```

And `functions/api/track.js:1-11` already states the situation plainly — this finding is not a
disagreement with the author, but the observation that the mitigation chosen at the time only works
for a client that cooperates:

```
// ... Unlike admin_audit (service-role-only insert), events_insert's RLS
// policy allows any caller -- anon or authenticated -- to insert directly
// with the anon key. This Function exists anyway, and js/app.js is expected
// to call it rather than write to Supabase directly, for one reason: only a
// server-side process can be trusted to stamp user_id/org_id correctly. A
// client-side insert could claim any org_id it wants; RLS's `with check
// (true)` on events_insert does not stop that ...
```

**Confidence.** *Confirmed against the real service/data* for the policy text, the role grants and
the publishable key being served. *Confirmed by reading the code* for "no client code inserts" and
for what `track.js` validates. **Not confirmed live** as an executed exploit: I did not send the
insert. That is a write to the database, and the rules of engagement put state-changing verbs behind
your explicit approval — so this remains reasoned, not executed. One `curl` settles it either way
whenever you want it settled.

**Blast radius.**
- **Availability / cost.** Unlimited anonymous rows into `events`, with no rate limit on this path.
  (The known-gaps entry about `/api/track` having no limiter concerns a *different* path, which at
  least validates its input.) On a free-tier project this is a storage and quota problem.
- **Integrity of the org-facing dashboard.** `org_id` is FK-constrained to a real organization, but a
  signed-in member can read their own `org_id` through `organizations_select`. They can inject
  fabricated events attributed to their own org, which colleagues and any site_admin then see in the
  Activity tile as genuine usage.
- **Forged attribution to a specific person.** `user_id` is FK-constrained to `auth.users`, and
  `organization_members_select` lets any org member read colleagues' `user_id`s. So one member can
  write analytics rows attributed to another named colleague.
- **Bypassing the type allowlist.** Arbitrary `type` strings and arbitrary `metadata` JSON land in a
  table reporting reads. Not an injection sink today — the render path is Chart.js on a canvas — but
  it is unvalidated attacker data at rest.
- Notably **not** reachable: `events` has no UPDATE or DELETE policy (live catalog shows only
  `events_insert` and `events_select`), so an attacker can add noise but cannot erase existing rows.

**Proposed fix.** Drop the policy in a new migration:

```sql
drop policy "events_insert" on public.events;
```

`track.js` writes with the service role, which bypasses RLS, so this is expected to be
behaviour-neutral for every legitimate path. That expectation is exactly what the companion test
below must prove before the change ships — "deny everything" would otherwise pass the security test
and silently break analytics.

If you would rather keep a client-side insert path open for future use, the narrower version is to
scope it `to authenticated` and constrain the columns a caller may set. Given nothing uses it today,
dropping it is both stronger and simpler.

**Exploit test.** Not yet written — approval first. Shape:
`probe-fs02-events-anon-insert.mjs` posts a row to `/rest/v1/events` with a bogus `type` and a forged
`org_id` using only the publishable key, asserting `201` before the fix and `401/403` after; the
companion drives `/api/track` with a legitimate event and asserts it still lands — which is the test
that actually protects the product here.

---

### F-S03 — `client_apps_select` exposes every column, including `r2_object_key`, to any authenticated user

**Severity:** Low — impact Low (internal object-path disclosure; the build catalog itself is shown to
signed-in users by design), exploitability Easy (any free self-registered account, one request),
reachability Live.

**Location:** `supabase/migrations/20260807220100_rls_policies.sql:147-149`.

```sql
create policy "client_apps_select"
  on public.client_apps for select
  using (auth.uid() is not null and (enabled = true or public.is_site_admin()));
```

**What it is.** RLS is row-level, not column-level, so a policy permitting the row permits every
column of it. The client asks for four columns (`js/app.js:2204`:
`.select("key, name, platform, version")`), but nothing stops any authenticated caller asking for
`select=*` and receiving `r2_object_key`
(`supabase/migrations/20260807220000_core_schema.sql:60`) for every enabled build.

**Reachability trace.**
- Entry point: `GET /rest/v1/client_apps?select=*` with any valid session JWT.
- Caller's auth state: any registered user — including a self-registered account with no org and no
  entitlement, since the predicate is only `auth.uid() is not null`.
- What the caller obtains that they should not: the R2 object key for every enabled build.

**Confidence.** *Confirmed by reading the code*, and *confirmed against the real service* for the
policy text and grants. I did not execute the `select=*` — it is a read and would have been within
the rules of engagement, but it needs a minted session and the policy text already settles it.

**Blast radius.** Small, and worth saying plainly: `dts-builds` is a private R2 bucket reached
through a Worker binding, so knowing an object key grants no access to the object. Downloads stay
gated by `/api/download/<key>`, which re-checks entitlement server-side. This is internal-path
disclosure and a slightly wider catalog view than the UI intends — defence-in-depth, not a live hole.
Enumerating the build catalog is *by design*; the portal shows locked tiles to signed-in users.

**Proposed fix.** Optional, and low priority. Either add a column grant
(`revoke select (r2_object_key) on public.client_apps from anon, authenticated;` — RLS and column
grants compose), or leave it and record it as accepted. The service role is unaffected either way.

---

## Investigated and dismissed (supabase scope)

| Lead | Source | Why it is not a finding |
|---|---|---|
| Email-domain auto-assignment as privilege escalation (register as `anyone@clientdomain.com`, inherit the client's org) | `20-supabase.md` §4 — flagged **Critical** where a domain→org mapping exists, and one does exist here | **Closed by configuration, confirmed against the live project.** `40-supabase-cfg.sh` read GoTrue's live settings: `mailer_autoconfirm = false`. Email confirmation is required, so the attacker must control a mailbox at the target domain. This was the highest-risk hypothesis going into the scope. |
| `handle_new_user()` auto-inserting membership from an email domain | `30-rls` trigger list | Reads correctly. `…_org_email_domains.sql:82-88` matches on `lower(oed.domain) = lower(split_part(new.email,'@',2))` — exact equality on the part after the `@`, not a substring or suffix match, so `evil-clientdomain.com` and `clientdomain.com.attacker.net` do not match. It joins `organizations o ... and o.status = 'active'`, and a unique index on `lower(domain)` makes a domain global to one org. It inserts `status='active'` deliberately (an `'invited'` row would pass "membership exists" while granting nothing). Note the contrast with F-S01: **this** path got the org-status join right. |
| `USING(true)` / `WITH CHECK(true)` on `events_insert` | `30-rls` "permissive predicates" | This one *is* a finding — F-S02. Listed here only so the row is not double-counted as dismissed. |
| Anonymous PostgREST read of all 8 tables | `40-supabase-cfg` | **Not a finding, and positively verifying.** All eight returned `HTTP 200` with a 2-byte body — `[]`. An empty array is RLS working correctly. Confirmed against the real service. |
| `[LEAD] storage-bucket-list` — an unauthenticated caller can enumerate storage buckets | `40-supabase-cfg` | `GET /storage/v1/bucket` returns 200, but section 10 of the live catalog shows **zero buckets exist**. The endpoint enumerates an empty list. Supabase Storage is unused; binaries live in Cloudflare R2. Nothing to disclose. |
| `SECURITY DEFINER` functions bypassing RLS with a hijackable `search_path` | `20-supabase.md` §2 | All 7 pin it. Confirmed against the live catalog (section 8): `handle_new_user`, `is_org_admin`, `is_org_member`, `is_site_admin`, `protect_site_role` all show `search_path=public`; the two `vault` functions are Supabase-managed with `search_path=""`. |
| `protect_site_role()`'s bootstrap relaxation — the `auth.uid() is not null` escape in `…_fix_protect_site_role_bootstrap.sql` | `20-supabase.md` §2 ("read its bootstrap path — that path has already needed a fix in this schema") | **Traced and sound.** The relaxation lets the trigger pass when `auth.uid()` is NULL. For an anonymous PostgREST caller that is unreachable: `profiles_update`'s `USING (user_id = auth.uid() or is_site_admin())` evaluates to `NULL or false` → not true for every row, so RLS filters the update to zero rows and the trigger never fires. The only callers reaching it with NULL `auth.uid()` **and** a selected row are service-role connections, which already bypass RLS everywhere else. The migration's own comment makes this argument and it holds. |
| Self-promotion to `site_admin` by updating one's own `profiles` row | `20-supabase.md` §2 ("is the identity column itself protected?") | Blocked. `protect_site_role_trigger` (BEFORE UPDATE, confirmed present in the live catalog, section 11) raises on any `site_role` change by a non-site_admin. `profiles` has only SELECT and UPDATE policies — no INSERT, no DELETE — so a user cannot sidestep it by deleting and re-creating their row, nor by inserting a crafted one. |
| Membership self-grant — inserting yourself into an org you do not belong to, which would collapse every org-scoped policy at once | `20-supabase.md` §2 ("trace the chain to its root") | Blocked at the root. `organization_members_insert`'s `WITH CHECK (is_site_admin() or is_org_admin(org_id))` is false for a plain user, so the table `is_org_member()` resolves against cannot be seeded by its own beneficiary. |
| Tenancy move via UPDATE — changing `org_id` on a membership row to escape into another org | `20-supabase.md` §2 (the `WITH CHECK` question) | Blocked on both sides. `USING` evaluates `is_org_admin(OLD.org_id)` and `WITH CHECK` evaluates `is_org_admin(NEW.org_id)`; an org_admin of A moving a row to B fails the `WITH CHECK`. An org_admin *can* set an arbitrary `user_id` within their own org — but that is the shipped "add existing member by email" feature, and it grants the added user access to the admin's own org only, which is not an escalation for the actor. |
| Write policies missing `WITH CHECK` | `30-rls` | None. Confirmed against the live catalog (section 5 returns 0 rows). Every write-capable policy defines one. |
| Views leaking past RLS | `20-supabase.md` §2 | No views exist. Confirmed against the live catalog (section 9, 0 rows). |
| `admin_audit` writable by a client | `30-rls` grants | `anon` and `authenticated` hold the INSERT *grant*, but the table has exactly one policy (SELECT, `is_site_admin()`). No insert policy means insert is denied. The design intent recorded in `WEBSITE-STATE.md` §3 holds. |
| Erasing evidence from `events` after forging it | follow-on from F-S02 | Not possible. `events` has only INSERT and SELECT policies; UPDATE and DELETE are denied despite the blanket grants. |
| Realtime as a separate surface | `20-supabase.md` §3 | Not in use. No `.channel(`, `removeChannel` or `realtime` reference anywhere in `js/`. |
| `is_org_member` / `is_org_admin` exposed as PostgREST RPC (both live in `public`) | reasoning | Callable, but each takes only a `uuid` and returns a boolean about **the caller**, resolved from `auth.uid()`. Useful as a membership oracle for yourself, which you already know. No argument lets a caller ask about anyone else. |
| Static-vs-live policy drift | `30-rls` | None. The live catalog's 25 policies match the 5 committed migrations exactly. |

---

## Accepted and residual risk (supabase scope)

- **No `FORCE ROW LEVEL SECURITY` on any table** (confirmed live, `rls_forced = f` on all 16). The
  table owner therefore bypasses every policy. Normal for Supabase and harmless while the app
  connects as `anon`/`authenticated` and the Functions as the service role — which is the case here.
  Worth knowing before anyone asserts "the table is protected" unconditionally.
- **Open signup is enabled** (`disable_signup = false`, live). Correct for this product: a
  self-registered account reaches `registered` content and nothing further, and F-S03 is the only
  place this scope found where such an account sees slightly more than intended.
- **The publishable key is in a committed, world-readable static file.** By design, and correct — it
  is a publishable key. Recorded only because F-S02's severity derives from it: any policy granting
  `anon` a capability grants it to the entire internet.
- **Events attributed to a multi-org or zero-org user carry `org_id = null`** and are therefore
  invisible to everyone but a site_admin. A deliberate "don't guess" choice in `track.js`, not a gap.

**Second-order consequence, recorded separately per the conventions:** `WEBSITE-STATE.md` §9 accepts
"`/api/track` has no rate limiting" as a known gap. That acceptance covers the *Function*. It does
not cover the direct PostgREST insert path, which has no rate limiting *and* no type validation *and*
no `user_id`/`org_id` rejection — i.e. the controls `track.js` implements were never actually
controls, because a second unguarded path to the same table was left open. That gap is F-S02, and is
fair game rather than covered by the acceptance.

---

## Human action items (supabase scope)

- **Approve or reject F-S01 and F-S02 before any code is written.** Both need a new migration and a
  deploy window; neither can be applied without a schema change reaching the live database.
- **Supabase Redirect URLs allow-list — still unconfirmed.** `WEBSITE-STATE.md` §9 has carried this
  as an open question and this audit could not close it: GoTrue's public `/settings` endpoint does
  not publish the allow-list, so it needs a dashboard check. Both directions matter — an unlisted
  `redirectTo` silently breaks signup confirmation, OAuth return and password reset; an
  over-permissive or wildcard entry turns the reset flow into token theft.
- **Custom SMTP** remains unset (existing §9 item). Beyond the documented 2-emails/hour availability
  problem, it is now load-bearing for *security*: `mailer_autoconfirm = false` is the single control
  closing the email-domain escalation path (see the dismissed table), and it is only as strong as the
  confirmation email actually being delivered.
- **JWT expiry and refresh-token rotation were not verifiable from outside.** `config.toml` says
  `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`,
  but that file describes the **local** stack, not the hosted project, and the live settings endpoint
  does not publish these. Confirm in the dashboard. It matters because the session token lives in
  `localStorage` and is readable by any XSS.
- **`minimum_password_length = 6`** in `config.toml` — same caveat, local-stack only; confirm the
  hosted value. Six is low if it is also the live setting.

---

## Untested areas (supabase scope)

- **No exploit was executed.** Every finding here is reasoned from live policy text and real code,
  not from a fired request. F-S02 in particular would be settled by a single `curl` and I did not
  send it, because it is a write to the database and the rules of engagement require your approval.
  F-S01 additionally has no fixture to exploit — no member exists in either disabled org — so a real
  test needs a seeded one.
- **Per-bucket storage visibility and signed-URL TTLs:** moot. Zero buckets exist, confirmed against
  the live catalog.
- **The Functions/service-role boundary is out of scope by construction** and was covered by the
  `app` scope earlier in this document — with the one exception of `functions/_lib/admin.js`'s
  `isOrgAdmin()`, recorded under F-S01 because it shares that finding's root cause.
- **`cloudflare` and `deps` scopes remain unrun**, as recorded in `WEBSITE-STATE.md` §9.
  `55-deploy-exposure.sh` has still never been executed as a script, though the invariant it exists to
  test was checked directly during the 2026-09-06 deploy.
- **The auth *flows* themselves were not exercised** — no signup, confirmation, password reset or
  OAuth round trip was performed. This scope read configuration and policy, not runtime behaviour.

---

## Documentation updates — proposed, not applied (supabase scope)

**`docs/WEBSITE-STATE.md`** — §9 gains a dated `supabase`-scope subsection recording: that the scope
ran with a **live catalog read** (the previous run degraded to static analysis, so this is the first
time the grants and the absence of drift were actually verified); that `mailer_autoconfirm = false`
is the control closing the email-domain escalation path and should be treated as load-bearing; and
F-S01/F-S02/F-S03 with their status. §3's "four resource access levels" table is accurate for the
Functions path and should gain one sentence noting that the RLS helpers do **not** currently enforce
org status, so the two paths disagree until F-S01 is fixed. §10's scope-status line should change
from "`supabase`, `cloudflare` and `deps` scopes are still unrun" to name `supabase` as complete.

**`docs/migration/PROGRESS.md`** — a session-log entry: the scope ran; the live read succeeded where
the earlier same-day run failed DNS and degraded; the three findings; that no exploit was executed
and why; and the cross-scope `isOrgAdmin()` sibling, so it is not lost between reports.

**`CLAUDE.md`** — no change yet. It gains probe lines only if F-S01/F-S02 are approved and their
regression tests land under `tests/security/`.

---

## Fixes applied — supabase scope, 2026-09-06

All three findings were approved and fixed on branch
`security-audit-supabase-2026-09-06`, one finding per commit. Every fix was
proven **red before and green after**, against the real dev database, and each
ships with a companion assertion showing legitimate access survived.

**Applied to the live dev database** (`DTSdev`, the project backing
<https://dts-website-4cu.pages.dev>) and recorded in
`supabase_migrations.schema_migrations`, which now lists all eight migrations.
The two JS changes are committed but **not yet deployed** — see "Deployment
state" below, because that distinction has bitten this project before.

### One process note worth keeping

The F-S02 exploit **initially appeared not to reproduce**, returning `401` with
`new row violates row-level security policy`. Taken at face value that would
have moved a real finding to investigated-and-dismissed, exactly as the
protocol says to do when an exploit cannot be executed. It was a bug in the
probe, not a property of the system: `Prefer: return=representation` makes
PostgREST add a `RETURNING` clause, which additionally requires the **SELECT**
policy to pass — and `events_select` is false for an anonymous caller. The
insert itself was permitted the whole time. Removing the header returned `201`
and the row landed.

The lesson generalises past this one probe: **a denial that arrives for the
wrong reason looks exactly like a control working.** Read the error body, not
the status code. The probe now carries a comment explaining why it must not ask
for the row back.

---

### F-S01 — fix and verification

**Diff.** `supabase/migrations/20260906190100_org_status_in_rls_helpers.sql`
(new) rewrites both RLS helpers to join `organizations` and require
`o.status = 'active'`, mirroring `activeOrgIdsFor()`. Both are
`create or replace`, so no policy was dropped or recreated and none of the 25
policy definitions changed — they simply get a correct answer now.

Two more sites, same root cause, in the same commit:

- `functions/_lib/admin.js:20-33` — `isOrgAdmin()` gained
  `organizations!inner(status)` + `organizations.status=eq.active`. Without it,
  an org_admin of a disabled org could still manage members through
  `/api/org/members` and still create accounts through `/api/org/invite`.
- `js/app.js:2065-2087` — `buildSessionFromAuth()` gained
  `organizations!inner(...)` + `.eq("organizations.status", "active")`, so a
  disabled org no longer appears in `access.session.orgs` and its team panel
  stops rendering. `!inner` also means a row whose org is filtered out is
  dropped rather than arriving with a null `organizations`, which the mapping
  immediately below would dereference.

**Exploit test.** `tests/security/probe-fs01-disabled-org-rls.sql` — disables a
real populated org inside a transaction, checks what its members can still
reach, and `ROLLBACK`s. Non-destructive by construction; the org is never
actually disabled.

```
PGPASSWORD=… psql "$(head -1 supabase/.temp/pooler-url)" \
  -f tests/security/probe-fs01-disabled-org-rls.sql
```

Before the fix:

```
 ACTIVE  (companion -- both must be t) | is_org_member: t | is_org_admin: t
 DISABLED (exploit -- both must be f)  | is_org_member: t | is_org_admin: t   <-- the bug
 rows still readable after disable     | orgs_visible: 1 | roster_visible: 2 | events_visible: 0
```

After the fix:

```
 ACTIVE  (companion -- both must be t) | is_org_member: t | is_org_admin: t   <-- preserved
 DISABLED (exploit -- both must be f)  | is_org_member: f | is_org_admin: f
 rows still readable after disable     | orgs_visible: 0 | roster_visible: 0 | events_visible: 0
```

`events_visible` was 0 in both runs only because the fixture org has no events;
the org row and the 2-person roster are what demonstrate the leak and its
closure.

**Regression guard.** `tests/security/probe-fs01-org-status-enforced.mjs` —
offline, no credentials, in the standard checklist loop. It checks **all four**
sites rather than the two in the finding's title, because F-S01 existed
precisely because the Phase 5b fix landed in one place and nowhere else.
Confirmed red against the unfixed tree (4/4 denial assertions failed) by
stashing the fix and re-running, then green (7/7) with it restored.

**Confidence.** *Confirmed against the real service/data.* The live catalog now
reports `is_org_member joins orgs: true` and `is_org_admin joins orgs: true`.

---

### F-S02 — fix and verification

**Diff.** `supabase/migrations/20260906190000_drop_events_anon_insert.sql`
(new): `drop policy if exists "events_insert" on public.events;`

Nothing else changed. `events_select` is untouched, so reads behave exactly as
before, and `functions/api/track.js` writes with the service role, which
bypasses RLS and never needed the policy.

**Exploit test.** `tests/security/probe-fs02-events-anon-insert.mjs`. Default
mode is an offline structural check that walks every migration and tracks net
policy state, so a `create` later followed by a `drop` reads as absent. `--live`
fires the real request using only the publishable key read from
`js/supabase-init.js`.

Before the fix (`--live`):

```
[FAIL] anonymous PostgREST insert into events is refused
       HTTP 201 returned data:
```

…and the row was confirmed present in the database, carrying a `type` outside
`track.js`'s 17-value allowlist:

```
AUDIT-FS02-PROBE-not-an-allowed-type|t|t|AUDIT-FS02-PROBE
```

After the fix:

```
[PASS] anonymous PostgREST insert into events is refused
       HTTP 401
[PASS] POST /api/track still accepts a legitimate event
       HTTP 201
```

The second line is the companion and is the one that matters: dropping a policy
is only a fix if the real analytics path still works. Offline mode is green too
(2/2), and was confirmed red beforehand (`anon-writable INSERT policies still
present: events_insert`).

**Cleanup.** The probe row was deleted in the same transaction as the policy
drop; a follow-up count confirmed `leftover_probe_rows = 0`.

**Confidence.** *Confirmed against the real service/data*, both directions.
Live catalog now reports `events policies: events_select/SELECT` — no INSERT
policy at all, so the table is deny-by-default for writes, the same shape
`admin_audit` already had.

---

### F-S03 — fix and verification

**Diff.** `supabase/migrations/20260906190200_client_apps_column_grants.sql`
(new). The trap here is that a **column-level `REVOKE` does not carve an
exception out of a table-level `GRANT`** — a table-level `SELECT` covers every
column regardless. So the migration drops the table-level grant and re-grants
the eight safe columns explicitly:

```sql
revoke select on public.client_apps from anon, authenticated;
grant select (id, key, name, platform, version, enabled, created_at, updated_at)
  on public.client_apps to anon, authenticated;
```

`r2_object_key` is deliberately absent. Because the columns are listed, a column
added later is **not** browser-readable until someone adds it here on purpose.

Verified beforehand that nothing legitimate breaks: `js/app.js:2214` selects
four named columns, all still granted; the Admin Board reads builds through
`adminFetch("/api/admin/apps")` (service role, unaffected), never a direct
client-side Supabase read; `functions/api/download/[key].js` and the admin apps
routes also use the service role.

**Exploit test.** `tests/security/probe-fs03-client-apps-columns.sql` —
read-only, two separate transactions (the expected post-fix result of the first
is an error, which would otherwise abort the companion).

Before the fix, a plain authenticated user read real R2 object paths:

```
 f0ed5d0c-… | builds/test-browser-app/EyeVrUpdated.apk
 a3f1170c-… | builds/dummy-viewer-win/futureJoke.png
```

After the fix:

```
--- EXPLOIT ---   ERROR: permission denied for table client_apps
--- COMPANION --- test-browser-app | test app-1         | android | 0.0.1-test
                  dummy-viewer-win | Dummy Viewer (dev) | windows | 0.0.1-dev
```

**Confidence.** *Confirmed against the real service/data.* The live catalog
lists exactly eight columns granted to `authenticated`, and `r2_object_key` is
not one of them.

---

### Regression status

The full checklist loop passes, including the three probes from the earlier
`app` scope:

```
PASS tests/security/probe-f01-link-access-strip.mjs
PASS tests/security/probe-f02-cms-html-injection.mjs
PASS tests/security/probe-f03-invite-ledger-order.mjs
PASS tests/security/probe-fs01-org-status-enforced.mjs
PASS tests/security/probe-fs02-events-anon-insert.mjs
PASS tests/regression/gis-resolver-connection-limit.mjs
```

`CLAUDE.md`'s checklist gained the three connection-requiring probes as a
separate, explicitly-not-in-the-loop block, plus the `--live` flag note.

### Deployment state

Separating "committed", "deployed" and "verified" matters on this project;
conflating them is what made the 2026-09-06 GIS outage hard to attribute. All
three are now true for this work, and here is the evidence for each.

**Deployed: `3eada530`, 2026-09-06, from the staged directory built per
`docs/migration/DEPLOY-STAGING.md`.** 83 files, 1 changed.

- **Live in the database, no deploy needed:** all three migrations, applied to
  `DTSdev` and recorded in `schema_migrations` (8 rows). Postgres enforces RLS
  and grants regardless of which JS is deployed, so F-S02, F-S03 and F-S01's
  RLS half were in force from the moment they were applied.
- **Live in the deploy:** the two JS changes. The deployed `js/app.js` now
  contains `organizations!inner` (confirmed by fetching it); the Functions
  bundle was recompiled and uploaded, carrying the fixed `isOrgAdmin()` behind
  `/api/org/members` and `/api/org/invite`. **F-S01 is now closed on both
  paths.**

Pre-deploy checks from the runbook, all run rather than assumed:

- File lists diffed source vs. staged for all six included directories. `css`,
  `js`, `assets`, `vendor`, `functions` identical; `models` differs only by the
  two oversized Backrooms `.usdz` files, which is the intended exclusion.
- `functions/data/[[path]].js` confirmed present in staging — the
  double-bracket catch-all that has silently vanished from a staged build
  before.
- All 19 excluded paths confirmed absent from the staged directory.
- `js/config.js` overlay applied: staged copy greps 2, not the repo copy's 16.

Post-deploy checks against `https://dts-website-4cu.pages.dev`:

- `/` is 64804 bytes. Ten excluded paths (`/.env`, `/scripts/seed-dev.mjs`,
  `/supabase/config.toml`, `/docs/migration/PROGRESS.md`,
  `/tools/gis-harvest.mjs`, `/CLAUDE.md`, `/wrangler.toml`, `/package.json`,
  `/SECURITY-AUDIT-2026-09-06.md`, `/tests/security/_harness.mjs`) each return
  **exactly** 64804 — the SPA fallback, not real content. Status codes prove
  nothing here, which is why this is measured in bytes.
- `/data/manifest.json` returns 5043 bytes — genuinely different, so the
  R2-backed Function route still serves `/data`.
- **The highest-severity invariant holds.** Raw `/data` is not shipping as
  static files: the repo's `data/projects/campus.json` contains `tourUrl`, the
  served copy contains none, which is only possible if the request is being
  answered from the stripped `data/current/` copy in R2 through
  `functions/data/[[path]].js`. A nonexistent `/data/...` path returns the
  Function's own 9-byte `not found` rather than the SPA fallback, confirming
  the Function owns that route.
- Deployed `js/config.js` greps **2** for `spaces.dtsxr.com`, not 16 — the
  stripped fallback shipped, not the repo copy carrying all 16 gated tour URLs.
- `/index.html` 308-redirects to `/` and resolves to the same 64804 bytes.
  Normal Cloudflare Pages behaviour, noted only so a future reader does not
  mistake a bare `curl` of it (0 bytes, redirect not followed) for a fault.

Regression suite, post-deploy — all green:

```
PASS tests/security/probe-f01-link-access-strip.mjs
PASS tests/security/probe-f02-cms-html-injection.mjs
PASS tests/security/probe-f03-invite-ledger-order.mjs
PASS tests/security/probe-fs01-org-status-enforced.mjs
PASS tests/security/probe-fs02-events-anon-insert.mjs
PASS tests/regression/gis-resolver-connection-limit.mjs
```

Plus the live F-S02 probe against the deployed site: anonymous PostgREST insert
refused (401), `POST /api/track` still accepted (201).

**Still not confirmed in a browser.** No one has signed in and looked at the
portal since the `js/app.js` change. The query shape is the documented
PostgREST embed syntax and `node --check` passes, but the thing worth clicking
is the org-admin team panel for an **active** org — that is the path the change
touches, and the failure mode if the embed filter is wrong is that a legitimate
org_admin loses their panel. Everything above is API- and file-level evidence,
which is not the same claim.

**Not pushed.** `main` and `security-audit-supabase-2026-09-06` are both ahead
of `origin`. Pushing also updates the still-live GitHub Pages site, which
`PROGRESS.md` records as a separate decision; it was deliberately left alone.

---
---

# Scope: `cloudflare` — 2026-09-06

**Target:** https://dts-website-4cu.pages.dev (deployment `3eada530`) ·
**Commit:** `b4504b9e` · **Working tree:** 3 uncommitted (a scan script, a
`.docx`, one untracked doc — none of them shipped code)
**Scan evidence:** `.claude/skills/security-audit/scan/results/2026-09-06/`
(the pre-deploy morning run of the same day is preserved alongside it as
`results/2026-09-06-pre-deploy-am/`)

## Grounding

Third scope of the day, after `app` and `supabase`. Same site: a Cloudflare
Pages deployment of a vanilla-JS app shell with a real Pages Functions backend,
Supabase behind it, and two R2 buckets — not the "static files on GitHub Pages"
that `CLAUDE.md`'s header still describes. Users run from anonymous visitor to
`site_admin`. The audited target is the dev preview at deployment `3eada530`,
built from a staged directory per `DEPLOY-STAGING.md`; production does not
exist yet and handoff has not happened, so everything still runs on the
developer's personal Cloudflare and Supabase accounts. Known-broken going in,
from `WEBSITE-STATE.md` §9: no custom SMTP, OAuth providers disabled,
placeholder GA4/Clarity IDs, `/api/track` unrate-limited, the CLI content tools
neither deleting removed objects nor purging the edge cache, the access-blind
`js/config.js` fallback, positional link identity, Treedis URLs being bearer
URLs once issued, and the deferred decision to leave the old GitHub repo
public. Two of those turn out to matter here.

**Tooling.** Every tool the scan asks for was present — `git`, `node`, `curl`,
`gitleaks`, `osv-scanner`, `psql`, `supabase`, `jq`. **No check ran degraded
and none skipped**, so nothing in this scope is weakened by a fallback path.
`rg` and `semgrep` are absent, and no check uses them.

One tooling defect found and worth recording, because it produced nine of the
scan's leads and all nine are artifacts: `lib/common.sh`'s `fetch_headers()`
probes with `curl --head`, and Cloudflare Pages does not route a **HEAD**
request to a Function that exports only `onRequestGet`/`onRequestPost` — it
falls through to the static asset handler and answers with the SPA shell. So
`50-headers.sh` and `60-cors.sh` measured the static half of the site while
believing they were measuring `/api/*`. Every "ACAO `*`" and "cacheable" lead
against a Function route came from that. The fix is to probe with
`curl -X GET -o /dev/null -D -` instead; it is a change to the skill's own
scripts, not to the project, and is not applied here.

---

## Findings

| ID | Severity | Component | Title | Status |
|---|---|---|---|---|
| F-C01 | High | deploy (GitHub Pages) | The parallel `sroberto27.github.io` host serves the unstripped repo, bypassing every content access control the migration built | Human action required — deferred to handoff by the owner |
| F-C02 | **High** (revised from Medium) | Cloudflare Pages retained deployments | 53 deployments, not the 25 first probed. 29 served excluded files, 9 served the unstripped `js/config.js`, and **5 served raw `/data` as static files** — the Critical invariant. 50 deleted | Partially fixed — **deleted, but the hostnames still serve; see Fix record** |
| F-C03 | Low | `_headers` / Functions | `_headers` does not apply to Pages Functions responses — every `/data` and `/api` response ships with no CSP, HSTS, `nosniff` or `Referrer-Policy` | Fixed, verified — **not deployed** |
| F-C04 | Low | `_headers` | No `frame-ancestors` and no `X-Frame-Options`; no `form-action` | Fixed, verified — **not deployed** |
| F-C05 | Low | `_headers` | `script-src 'unsafe-inline'` is forced by exactly one inline script that could be hashed instead | Accepted — owner's decision, left as is |

Ranked by real exploitability. F-C01 is first because it is one anonymous
`curl` against a well-known URL and it returns content the entire access model
exists to withhold.

---

### F-C01 — The parallel GitHub Pages host serves the unstripped repo

**Severity:** High — impact High (every gated content URL and 27 documents the
access model withholds entirely, read by an anonymous stranger), exploitability
Trivial (one `curl`, no account, a guessable public URL), reachability Live
(confirmed against the real service, 2026-09-06). Not Critical: it reaches no
credential, no database row, no write path, and no Supabase or R2 object — it
is a content disclosure, not a compromise. Not Medium: gating *is* the product
here, and this defeats it wholesale rather than at the margin.

**Location:** not a code defect. `https://sroberto27.github.io/Wrapper/map/dts/dts3/…`
— GitHub Pages serving the repository subtree that also holds the Cloudflare
source. Recorded as a deferred decision in `docs/migration/PROGRESS.md:2919`
and `docs/WEBSITE-STATE.md:574`.

**What it is.** The Cloudflare site enforces content access in exactly one
place before the browser ever asks: the publish pipeline writes a *stripped*
copy to `data/current/` and withholds gated documents from it entirely, and the
deploy overlays a stripped `js/config.js` over the repo's copy
(`WEBSITE-STATE.md` §4, §8). Both controls operate on **what gets published**.
The old GitHub Pages site publishes the repository directly, so it serves the
unstripped originals of both. Every access decision the Functions make is
irrelevant there, because nothing routes through a Function at all.

**Reachability trace.**
- Entry point: `GET https://sroberto27.github.io/Wrapper/map/dts/dts3/<any repo path>`
- Route file: none — GitHub Pages static hosting, no Function in the path
- Caller's auth state: **anonymous**, no session, no referer requirement
- Parameter carrying the payload: the path itself
- What the caller obtains: the 8 gated Treedis tour URLs, the raw unstripped
  `/data` documents including the 27 the live manifest withholds, the gated
  GIS map document and its local GeoJSON layers, plus the RLS migration
  source, the internal migration documents, and the operator tooling

**Evidence.** All confirmed against the real service on 2026-09-06.

```
$ curl -s .../js/config.js | grep -oE '"https://spaces\.dtsxr\.com/tour/[^"]*"' | sort -u
  github.io    : 026593c5 352ad07a 4fb22059 56111605 8e4ca3fc bfab6d52
                 ea18f14b fee23e79 scsu-campus-ade0f346      -> 9 distinct
  pages.dev    : 4fb22059                                    -> 1 distinct
```

Nine tours against one. `4fb22059` is the public homepage tour; the other
**eight are gated** and are exactly what the `.build/js/config.js` overlay in
`DEPLOY-STAGING.md` step 3 exists to remove.

```
manifest entries  repo data/manifest.json ................ 61
                  pages.dev /data/manifest.json .......... 34   (filtered)
                  github.io /data/manifest.json .......... 61   (unfiltered)
```

27 documents that the live site withholds are listed and served there. Spot
checks, status and byte count:

```
/data/projects/campus.json          200   2883   contains tourUrl  (live copy: 2769, none)
/data/gis/maps/iberia-coastal.json  200  27247   the gated map document itself
/data/gis/layers/shoreline-1935.geojson
                                    200 112923   (live: 404 — withheld)
/supabase/migrations/20260807220100_rls_policies.sql
                                    200   6247
/tools/gis-harvest.mjs              200  16513
/scripts/seed-dev.mjs               200   6936
/docs/migration/ACCESS-MODEL.md     200  23356
/docs/migration/PROGRESS.md         200 199639
/CLAUDE.md                          200   7111
/wrangler.toml                      200    712
/.env                               404          (never committed — correct)
/SECURITY-AUDIT-2026-09-06.md       404          (not pushed yet)
/tests/security/_harness.mjs        404          (not pushed yet)
```

**Confidence.** Confirmed against the real service/data. Every line above is a
real response fetched during this audit, not inferred from the repo.

**Blast radius.** All 16 project documents in full, the 8 gated tour URLs
(which `WEBSITE-STATE.md` §9 already records as bearer URLs for the Treedis
session's lifetime — obtaining one is the whole control), the only GIS map and
its harvested layer data, the complete RLS policy source and access model, the
seeded dev account list, and the Cloudflare account id at
`docs/migration/PROGRESS.md:2995`. It reaches no key: `.env` was never
committed and returns 404, and the only credential in the served tree is the
Supabase publishable key, which is public by design.

**Why this is reported rather than filed as accepted risk.** The deferral on
record (`PROGRESS.md:2919`, Phase 2, 2026-08-07, user-agreed) is *"don't make
the old repo private yet, because it is still the live GitHub Pages host."*
That was decided when the site's gating was a Google-Sheet sign-in and every
tour URL sat in `js/config.js` in the clear anyway — the decision accepted the
status quo. Phases 4 and 6 then built an access model whose entire content-side
enforcement is the publish-time strip. Nobody accepted the consequence that the
new control would be nullified on a second live host; that consequence is the
second-order case `references/00-conventions.md` §3 explicitly keeps in scope.

**Proposed fix.** This is an operator decision, not a code change, and it is
listed under Human action items. The options, in the order I would pick them:

1. **Stop serving the DTS subtree from GitHub Pages** — in practice: move
   `Wrapper/map/dts/dts3` out of the Pages-served branch, or switch the Pages
   source to a branch that omits it. Immediate, reversible, keeps the rest of
   the personal site live.
2. **Make the repository private** and accept that GitHub Pages stops serving —
   this is the Phase 2 item, and it is only viable once the Cloudflare deploy
   is the sole live site (domain cutover).
3. Do neither, and accept that the Cloudflare access model protects nothing
   that also lives in this repo. That is a coherent choice only if the gated
   content is not actually sensitive — which is the owner's call, not mine.

Whichever is chosen, the 8 exposed tour URLs stay valid until Treedis reissues
them; see Human action items.

**Exploit test.** Not written. A probe here would assert against a third-party
host's serving behaviour rather than this codebase, and the failing condition
is a deploy/hosting decision, not a code path a regression test can hold. If
option 1 or 2 is taken, the right check is a one-line addition to the
deploy-verification block: `curl -s -o /dev/null -w '%{http_code}'
https://sroberto27.github.io/Wrapper/map/dts/dts3/js/config.js` must return
404. Say the word and I will add it to `tests/security/`.

**Verification.** Not fixed. Reported only.

---

### F-C02 — Retained Pages deployments still serve excluded files

**Severity:** Medium — impact High in kind but almost entirely duplicative of
F-C01 while that stands (the same 8 tour URLs), exploitability Trivial (a
`curl` against a URL published in a public document), reachability Live
(confirmed 2026-09-06). It is ranked below F-C01 and reported separately for
one reason: **it survives F-C01's fix.** Taking GitHub Pages down leaves these
serving the same content.

**Location:** Cloudflare Pages project `dts-website`, 25 retained deployments,
each permanently addressable at `https://<8-hex>.dts-website-4cu.pages.dev`.

**What it is.** Cloudflare Pages keeps every deployment live at its own
hostname forever. Redeploying moves the alias; it does not retract what an
older deployment serves. Two mistakes that were found and fixed by redeploying
are therefore still live at their original URLs.

**Reachability trace.**
- Entry point: `GET https://101ac885.dts-website-4cu.pages.dev/js/config.js`
- Route file: none — a static asset in a historical deployment
- Caller's auth state: **anonymous**
- Parameter carrying the payload: the hostname
- What the caller obtains: the 8 gated tour URLs (three deployments), and
  `tools/gis-harvest.mjs` (seven deployments)

**Evidence.** All 25 retained deployments were probed. Each row compares the
byte count of the path against that deployment's own `/` SPA fallback, which is
the only sound test here — status codes are all 200 either way.

```
deployment   /tools/gis-harvest.mjs   js/config.js tour-URL lines
101ac885     LEAKED 16886 bytes       16   <- unstripped
1d8b2ad5     LEAKED 16886 bytes       16   <- unstripped
984686cf     LEAKED 16886 bytes       16   <- unstripped
1eab93e9     LEAKED 16886 bytes        2
5e8bbb3e     LEAKED 16886 bytes        2
9af92d1c     LEAKED 16886 bytes        2
b4ed6f66     LEAKED 16886 bytes        2
(the other 18, including the current 3eada530: fallback / 2)
```

`/.env` returned the SPA fallback on all 25. Raw `/data` is **not** shipping
statically on any of them either — `data/projects/campus.json` comes back at
2769 bytes with no `tourUrl`, and `data/source/_latest.json` returns the
Function's own 9-byte `not found`, on every deployment. All deployments share
the current Functions and R2 content, so `/data` and `/api` behave identically
across them.

The hash is not a secret. `docs/migration/PROGRESS.md` — served publicly per
F-C01, and in the public GitHub repo regardless — names `101ac885`,
`1d8b2ad5`, `984686cf`, `b4ed6f66` and `1eab93e9` among roughly two dozen
per-deploy URLs recorded as the audit trail of each phase.

**Confidence.** Confirmed against the real service/data.

**Blast radius.** The same 8 gated tour URLs as F-C01, plus the GIS harvest
tool. Nothing further: no credential, no `/data` shadowing, no `.env`.

**Proposed fix.** Delete the historical deployments, or at minimum the seven
named above (`wrangler pages deployment delete <id> --project-name dts-website`,
or the dashboard). Keeping the last few for rollback is reasonable; keeping
four weeks of them is what created this. Separately, decide whether per-deploy
URLs belong in a document that is itself publicly served — a deployment id
would serve the same audit purpose without handing out a working hostname.
Both are operator actions; neither is applied here.

**Exploit test.** Not written — same reasoning as F-C01. The check that would
hold this closed belongs in the deploy runbook, not in `tests/security/`:
after deleting a deployment, confirm its `/js/config.js` no longer resolves.

**Verification.** Not fixed. Reported only.

---

### F-C03 — `_headers` does not apply to Pages Functions responses

**Severity:** Low — impact Low (defence-in-depth absent on responses that are
JSON and not rendered as documents), exploitability n/a (this is a missing
control, not an exploit), reachability Live. Reported because the operator has
every reason to believe otherwise: `50-headers.sh` reports
`[OK] headers-not-applied — every header declared in _headers appears in the
response`, and that is true only of the static half of the site.

**Location:** `_headers:1` (`/*`), versus every file under `functions/`.

**What it is.** `_headers` declares HSTS, `X-Content-Type-Options`,
`Referrer-Policy` and the full CSP for `/*`. Cloudflare Pages applies that file
to **static assets only**. A Function builds its own response headers in code,
and none of the route files add any of the four. So the half of the site that
serves gated data is the half with no declared security headers.

**Evidence.** Real `GET` responses, 2026-09-06 (not HEAD — see the tooling
note):

```
GET /data/manifest.json    ->  Content-Type, Cache-Control, CF-RAY, NEL ... and nothing else
GET /api/admin/users       ->  401, Content-Type, Cache-Control: no-store ... and nothing else
GET /  (static)            ->  HSTS + CSP + nosniff + Referrer-Policy, all present
```

**Confidence.** Confirmed against the real service/data.

**Blast radius.** Small, and worth saying why rather than inflating it. HSTS is
host-scoped, so one visit to `/` pins the whole hostname for a year — the
Function responses are covered in practice. CSP governs document rendering and
these responses are `application/json` consumed by `fetch`. `nosniff` matters
most where a body is attacker-controlled and served with a sniffable type;
`functions/api/download/[key].js:46-52` already forces
`application/octet-stream` plus `attachment` and does not echo the uploader's
stored content-type, and `functions/data/[[path]].js:35` maps only
`.json`/`.geojson` and falls back to `application/octet-stream`. So this is
genuinely defence-in-depth today. It stops being that the moment any Function
returns HTML.

**Proposed fix.** Add the four headers where the Functions build responses —
the natural place is `json()` in `functions/_lib/access.js`, which every route
already returns through, plus the two `new Response(...)` sites that stream R2
bodies (`functions/data/[[path]].js:42`, `functions/api/download/[key].js:46`).
`nosniff` and `Referrer-Policy` are unconditional; a Function-appropriate CSP
is `default-src 'none'`. This touches no do-not-break item, but it does touch
the shared `json()` helper that every route returns through, so it wants the
regression suite run against it.

**Exploit test.** None proposed — there is no exploit to reproduce. The
verification is a header check on a real `GET`, which belongs in the deploy
runbook next to the existing byte-count checks.

**Verification.** Not fixed. Reported only.

---

### F-C04 — No framing control, and no `form-action`

**Severity:** Low — impact Low (see below; the payoff from a clickjack here is
small *because of an existing control*, not by accident), exploitability Easy
(a crafted link a victim clicks), reachability Live.

**Location:** `_headers:1` — the CSP has no `frame-ancestors`, and there is no
`X-Frame-Options` anywhere.

**What it is.** Any origin can frame the site. The interesting target is a
signed-in `site_admin` with the Admin Board open, or an `org_admin` with the
team panel open, lured into clicking through an invisible overlay.

**Why it is Low and not Medium.** I went looking for a clickjack that achieves
something and mostly did not find one. Every destructive Admin Board action is
behind a native `window.confirm()` — 17 of them, including
`js/admin.js:2791` (delete organization), `:2875` (grant/remove `site_admin`),
`:2900` (delete user), `:2930` (remove member), `:1168` (delete project) and
`:3418` (**Publish to site**), plus `js/app.js:2589` in the org-admin panel. A
framing page cannot overlay or auto-accept browser chrome, so the second click
is not available to an attacker. What remains is single-click state that
carries little value on its own.

**Evidence.**

```
$ curl -s -D- .../  | grep -iE 'frame-ancestors|x-frame-options'
(no output)
$ grep -c "confirm(" js/admin.js
17
```

**Confidence.** Confirmed against the real service (the absent header) and by
reading the code (the `confirm()` coverage).

**Blast radius.** One unconfirmed admin click. Nothing that survives a page
reload.

**Proposed fix.** One line in `_headers`, appended to the existing CSP:
`frame-ancestors 'none'; form-action 'self'`. Both are safe here and I checked
rather than assumed — the site embeds third-party iframes but is never itself
framed by anything, and all three `<form>` elements (`index.html:441`, `:759`,
`:943`) are JS-handled with no `action` attribute, so `'self'` breaks nothing.
`form-action` is bundled in because it is the same edit and the same deploy;
on its own it would not have earned a finding, since an injected form needs an
injection first. Editing `_headers` is not on the do-not-break list, but the
change is not live until someone runs `DEPLOY-STAGING.md`.

**Exploit test.** Not proposed. A clickjacking proof needs a hostile page and a
human clicking it; the honest check is a header assertion after deploy.

**Verification.** Not fixed. Reported only.

---

### F-C05 — `script-src 'unsafe-inline'` is forced by one hashable script

**Severity:** Low — impact Low on its own (it is a missing mitigation, not a
hole), exploitability n/a, reachability Live. It is here because of what it is
a mitigation *for*: this project's CSP decisions were approved on the reasoning
that `script-src` stays strict, and it is not strict.

**Location:** `_headers:1` (`script-src … 'unsafe-inline' …`), forced by
`index.html:55-64`.

**What it is.** The CSP's fetch directives were deliberately broadened to any
`https:` source for `img-src`, `media-src`, `frame-src` and `connect-src` — a
real, user-approved decision recorded at `docs/migration/PROGRESS.md:3117-3180`,
because the CMS accepts arbitrary external URLs. That approval rested on
`script-src` remaining the strict boundary. But `script-src` carries
`'unsafe-inline'`, so a stored-XSS in CMS content — the exact class the `app`
scope found and fixed at `js/app.js:116` and `:546` — executes with no CSP
resistance, and with `connect-src https:` there is no exfiltration limit
either. The session token lives in `localStorage`, not a cookie
(`60-cors.sh`: no `Set-Cookie` on any response), so script on the page reads
it directly.

**Evidence.** The whole justification for `'unsafe-inline'` is one 10-line IIFE
at `index.html:55` that sets an `intro-cloak` class and clears it after 4s.
There are **zero** inline event handlers in the document:

```
$ grep -n "<script" index.html | grep -v "src="
55:   <script>
$ grep -c "on\(click\|load\|error\)=" index.html
0
```

**Confidence.** Confirmed by reading the code.

**Blast radius.** Nothing on its own. It raises the ceiling on any XSS that
reaches the page — which the `app` scope ranked Medium under this project's
`site_admin` calibration, and which the same calibration says is real for
persistence and for a phished admin.

**Proposed fix.** Compute the SHA-256 of that one inline script, put
`'sha256-…'` in `script-src`, and drop `'unsafe-inline'`. Note the maintenance
cost honestly: the hash must be recomputed whenever those ten lines change, and
a stale hash blanks the intro cloak (the script's own 4s failsafe means the
site still reveals itself, so the failure is cosmetic rather than fatal).
`style-src 'unsafe-inline'` must stay — the inline `<style>` at `index.html:50`
and a great deal of JS-set styling depend on it, and style is not the
XSS-relevant boundary here. Not applied.

**Exploit test.** The existing `tests/security/probe-f02-cms-html-injection.mjs`
already covers the injection this would mitigate; a CSP-hash change needs a
header assertion after deploy, not a new probe.

**Verification.** Not fixed. Reported only.

---

## Investigated and dismissed

| Lead | Source | Why it is not a finding |
|---|---|---|
| `cors/` ×6 — "ACAO `*` — confirm this route never returns per-user data" on `/`, `/data/manifest.json`, `/api/track`, `/api/resource/project.test`, `/api/admin/users`, `/api/publish` | `60-cors` | HEAD-probe artifact (see Tooling). A real `GET` with `Origin: https://evil.example.com` returns **no** `Access-Control-Allow-Origin` at all on any Function route — the secure state, and per `references/30-cloudflare.md` §6 that is a pass, not an untested area. The `*` belongs to Cloudflare Pages' default on static assets, which serve only public marketing files. |
| `cache-/data/manifest.json`, `cache-/api/track`, `cache-/api/resource/test` — "cacheable" | `50-headers` | Same artifact. Real `GET`: `/api/resource/*`, `/api/download/*` and `/api/admin/*` all return `Cache-Control: no-store`. `/data/*` returns `public, max-age=30, s-maxage=300` and is shared-cached (`CF-Cache-Status: HIT`) **by design** — it serves only the stripped `data/current/` copy, which is public content, and the cache-aside exists so `/api/publish`'s `caches.default.delete()` purge has something to purge (`functions/data/[[path]].js:12-16`). No route returning per-user content is cacheable. |
| `hdr-permissions-policy` — camera/microphone/geolocation unrestricted | `50-headers` | The default permission allowlist is already `self`, so cross-origin frames get nothing unless the embedding code delegates. It delegates narrowly and deliberately: `js/app.js:619`, `js/app.js:917`, `js/hex-media.js:222`, `js/gis/gis-tour.js:240` — `xr-spatial-tracking`, `fullscreen`, `autoplay`, `gyroscope`, `accelerometer`, `picture-in-picture`, `clipboard-write`. No camera, no microphone, no geolocation, no payment. A `Permissions-Policy` header would also have to keep `geolocation=(self)` alive for the GIS locate tool (`js/gis/gis-viewer.js:872`). Hardening with nothing behind it. |
| `route-guards` — one route file calls no guard | `00-inventory` | `functions/data/[[path]].js` — public by design (`WEBSITE-STATE.md` §5.10). Read it: the R2 key is always the file's own hardcoded `data/current/` prefix plus the request path (`:36`), never a caller-supplied prefix, and `:28` rejects any segment that is empty, `..`, or contains `/`. It cannot resolve `data/source/`. Confirmed live: `/data/source/_latest.json` returns the Function's own 9-byte `not found` on every deployment probed. |
| `deploy-exposure` — 15 paths that must never be published | `55-deploy-exposure` | All 15 return exactly the 64804-byte SPA fallback on the current deployment, including `/tools/gis-harvest.mjs`, the directory that leaked once before. Byte-compared, not status-compared. **Pass.** |
| `csp-unsafe-eval` — eval-family call in client code | `50-headers` | `js/admin.js:3159` is the text `no new Function needed for the listing itself` inside a comment. There is no eval-family call. |
| Uploader-controlled `content-type` stored on R2 objects (`functions/api/admin/apps/upload.js:38`) | manual | Never echoed. `functions/api/download/[key].js:46-52` hardcodes `application/octet-stream`, `content-disposition: attachment`, and `no-store`. The `filename` interpolated into the disposition comes from a `site_admin`-set `r2_object_key`; a CRLF there would be rejected by the Workers `Headers` setter, and a quote is a cosmetic break for the person who typed it. |
| Cache poisoning via unkeyed input | manual | Only two request headers are read anywhere in `functions/`: `Authorization` (`_lib/access.js:41`) and the upload `content-type` above. Nothing is reflected into a response body, a header, or a redirect, so there is no unkeyed input to poison an entry with. |
| Orphaned Pages secrets from the removed `/api/lead` | `references/30-cloudflare.md` §2 | Checked against the real account rather than the repo: the project's configured secrets are exactly `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — the same three `functions/_lib/access.js` and `_lib/admin.js` reference, no more. No leftover Turnstile or Web3Forms secret from Phase 7's revert. |
| `account-hardcode` — account-specific values in committed files | `00-inventory` | `wrangler.toml` carries no `account_id` (deliberate, and it says so at `wrangler.toml:14-18`). Bucket and binding names are disclosure, not compromise. The one account-specific value that *is* committed is the Supabase project ref in `_headers`' CSP — a handoff item, below, not a vulnerability. |
| R2 buckets publicly reachable | manual | Both `dts-content` and `dts-builds`: `Public access via the r2.dev URL is disabled`, and no custom domains connected. Confirmed against the real service. Neither bucket is reachable except through a Function. |
| Working tree drift (3 uncommitted files) | `00-inventory` | A scan script, a `.docx` and an untracked markdown file. No shipped code differs from `b4504b9e`, so the deployed site and the citations in this report describe the same version. |

### Bindings and blast radius (context, not a finding)

Bindings are ambient authority — any Function can use any binding the project
declares. `DTS_CONTENT` is referenced by six route files and `DTS_BUILDS` by
three (`functions/api/download/[key].js:42`,
`functions/api/admin/apps/upload.js:37`, `functions/api/admin/apps/[key].js:48,78`).
Both buckets are writable by declaration; only the code's restraint limits
that. So the content bucket and the build-artifact bucket share one blast
radius, and any `app`-scope Function bug reaches both. Recorded here because
this scope is where that ceiling gets established, not because anything is
currently wrong with it.

---

## Accepted and residual risk

- **`pages_build_output_dir = "."`** would publish `.env`, `scripts/`,
  `supabase/`, `docs/` and raw `data/` if anyone deployed the repo root. The
  only control is a human following `DEPLOY-STAGING.md`. That control has
  failed once in this project's history (`tools/gis-harvest.mjs`, Aug 2026) and
  the runbook grew a file-list diff and an exclusion-presence check in response.
  Verified holding on the current deployment.
- **Broadened `img-src` / `media-src` / `frame-src` / `connect-src` to any
  `https:`** — a real, audited, user-approved decision recorded at
  `docs/migration/PROGRESS.md:3117-3180`, because the CMS accepts arbitrary
  external URLs by design. Not re-litigated here. Its stated premise — that
  `script-src` remains the strict boundary — is F-C05.
- **`/api/track` has no rate limit** (`WEBSITE-STATE.md` §9). Pages Functions
  get none by default, and this one is deliberately callable without a session.
  Worth noting which layer does what elsewhere: the auth endpoints are
  Supabase's, rate-limited by GoTrue and, in practice today, hard-capped by the
  built-in email service's 2 messages/hour; `functions/api/org/invite.js` has
  its own limiter using `admin_audit` as the ledger. So the project has made
  this choice per-endpoint rather than by omission — `track` is the one gap.
- **A Treedis tour URL is a bearer URL once issued** (`WEBSITE-STATE.md` §9).
  Relevant because F-C01 and F-C02 hand out eight of them.
- **Second-order note.** The Phase 2 decision to leave the old repo public
  (`PROGRESS.md:2919`) predates the access model built in Phases 4 and 6. What
  was accepted was "the old site keeps serving what it already served"; what
  followed was "the new site's only content-side control does not apply there."
  That is F-C01, and it is why it is a finding rather than an accepted-risk
  line.

---

## Human action items

- **Decide what happens to the GitHub Pages host (F-C01).** Three options are
  laid out in the finding. This is a hosting and go-live decision, not a code
  change, and I have not touched it.
- **Reissue the eight exposed Treedis tours, if that is possible.** They have
  been publicly fetchable for the life of the GitHub Pages copy, and taking the
  host down does not invalidate a URL someone already has. Only Treedis can
  reissue them; DTS controls who obtains a URL, not what happens after. If
  reissuing is not possible, that is worth knowing before handoff, because it
  bounds what "gated" can mean for those tours.
- **Delete the historical Pages deployments (F-C02)**, at minimum the seven
  named. `wrangler pages deployment delete <id> --project-name dts-website`.
  Decide separately whether per-deploy URLs should keep being written into
  `PROGRESS.md`, which is itself publicly served today.
- **Handoff: the Supabase project ref is committed in more places than the
  handoff document names.** `docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md:360`
  says re-pointing is "that one file edit" (`js/supabase-init.js`). The ref
  appears in three places: that file (`:15`), an `index.html` preconnect
  (`:18`), and — until this session — `_headers`' CSP.

  **Correction, made the same day this section was written.** The first draft
  of this item said missing the `_headers` entry at handoff would produce "a
  silent CSP block, not an error." **That is wrong**, and it overstated the
  item. `connect-src` already permits `https:`, i.e. any secure origin, so a
  new project's ordinary REST and auth traffic is allowed regardless of what
  that line names. The explicit entry only ever permitted the **`wss:`**
  scheme to the old project — and nothing in the codebase uses Supabase
  Realtime (no `.channel(`, `realtime`, `WebSocket` or `wss://` anywhere in
  `js/` or `index.html`). So nothing would have broken. The real consequence
  was smaller: a client's live site would keep naming the developer's personal
  dev project in its page source, and the browser would warm up a connection
  to a project the site no longer uses.

  The dead `wss://<ref>.supabase.co` entry was **deleted** from `_headers` in
  this session's F-C04 commit rather than carried to handoff. If Realtime is
  ever adopted, a `wss:` entry gets added then, pointing at whatever project
  is current. `index.html:18` is deliberately left alone — it is a real
  performance hint for the project actually in use today — and is now named in
  the handoff document instead.
- **The Cloudflare account id is in a publicly-served document**
  (`docs/migration/PROGRESS.md:2995`). Disclosure, not a credential — an
  account id alone grants nothing without an API token, and no token is in the
  repo (`.env` was never committed; it 404s on both hosts).

  **Deliberately not scrubbed, and the reason matters.** The repository is
  public on github.com (`"visibility": "public"`, checked directly), so the id
  is in the git history whatever the current file says. Editing it out of the
  working copy would look like a fix and change nothing an attacker can reach.
  The control that actually works is the one already in place: the API token
  lives only in `.env`/Pages secrets, and `wrangler.toml` deliberately carries
  no `account_id`. The forward-looking fix is to keep the **client's** account
  id out of committed documents at handoff, since theirs is not published yet
  — now stated in `ACCOUNT-SETUP-AND-HANDOFF.md`.
- **Fix the audit skill's own header probing.** `lib/common.sh:214` uses
  `curl --head`; Pages answers HEAD on a Function route with the static SPA
  shell, which is what produced nine misleading leads this run. Changing it to
  a `GET` with a discarded body is a change to `.claude/skills/`, and I have
  not made it without a go-ahead.

---

## Untested areas

- **No authenticated cache-behaviour test.** No session was minted this run, so
  every `/api/*` response observed is an unauthenticated 400/401/404. `no-store`
  was read off those; I did not confirm it on a **200** carrying real gated
  content. Reading the code says the header is set unconditionally in `json()`
  and in the two streaming responses, so I expect it holds — but that is
  "confirmed by reading the code", not "confirmed against the real service".
- **WAF and rate-limiting rules were not inspected.** A `pages.dev` project is
  not a zone, so there is no zone-level WAF or rate-limiting configuration to
  read from the CLI. What I can say is what Cloudflare's defaults are: Pages
  Functions get no rate limiting. Whether anything else sits in front of this
  project is a dashboard question I did not answer.
- **Only the `production` environment's secrets were enumerated.** If a
  `preview` environment exists with its own variables, it was not listed. Every
  deploy this project has made went to `--branch main`, i.e. production.
- **SRI on the two external scripts was not adjudicated** — it belongs to the
  `deps` scope. For that session: `index.html:1019` loads
  `@supabase/supabase-js@2` from jsDelivr, an unpinned major, so SRI is
  structurally impossible without pinning an exact version first; and
  `index.html:1029` loads Turnstile from `challenges.cloudflare.com`, which
  Cloudflare updates in place and documents as not SRI-pinnable.
- **Nothing in this scope was confirmed in a browser.** No finding here depends
  on rendering or interaction, so that is a smaller gap than usual — but the
  `_headers` changes proposed in F-C04 and F-C05 would need a real page load to
  confirm nothing broke, and the F-C05 hash approach in particular should be
  eyeballed once.
- **The `deps` scope remains unrun.** It is now the only one.

---

## Documentation updates — proposed, not applied

**`docs/WEBSITE-STATE.md`**

- §9, "Blocked on external accounts / handoff": rewrite the **Old GitHub repo
  privacy** row. It currently reads as a tidiness item ("making it private
  would break that immediately"). It should say what is actually true — that
  the host serves the unstripped repo, that 27 withheld documents and 8 gated
  tour URLs are reachable there anonymously, and that the Cloudflare access
  model does not apply to it.
- §9: add that the Cloudflare Pages project retains ~25 historical deployments
  at permanent hostnames, that three of them serve the pre-overlay
  `js/config.js` and seven the pre-exclusion `tools/gis-harvest.mjs`, and that
  redeploying does not retract them.
- §7 or §8: record that `_headers` applies to static assets only and **not** to
  Functions responses — the half of the site serving gated data has no declared
  security headers. This is exactly the kind of thing a future session would
  otherwise assume from reading the file.
- §10: append a line that the `cloudflare` scope ran on 2026-09-06 with no
  degraded checks, that the raw-`/data` invariant and the excluded-path set
  were both re-verified against deployment `3eada530`, and that both R2 buckets
  have public access disabled.
- §9's handoff table: add the `_headers` CSP and `index.html` preconnect to the
  list of places the Supabase project ref must be re-pointed, and note the
  `wss:` entry is unused.

**`docs/migration/PROGRESS.md`**

- A session-log entry for this scope: the five findings, the eleven dismissed
  leads and why, the clean results (deploy exposure, CORS, `no-store` on gated
  routes, no orphaned secrets, R2 buckets private), the HEAD-probe tooling
  defect, and the fact that nothing was fixed or deployed.
- Consider whether per-deploy URLs should keep being recorded in this file at
  all while it is publicly served (F-C02).

**`docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md`**

- Step 6 ("Re-point config") currently says the swap is one file edit. Add
  `_headers` and `index.html`, per Human action items.

**`CLAUDE.md`**

- No change proposed. Nothing new landed in `tests/security/` this scope, and
  the two checks worth adding (an excluded-path header assertion, and the
  GitHub Pages 404 check) only make sense once F-C01 and F-C04 are decided.

---

## Fix record — 2026-09-06, same session

Applied after the report above was written, on the owner's instruction. Read
this section as authoritative where it corrects the findings above.

### F-C02 was understated. Two corrections, both material.

**Correction 1 — the deployment list is paginated, and the audit only saw the
first page.** The report says "all 25 retained deployments were probed." That
was 25 because `wrangler pages deployment list` returns 25 per page and the
audit read one page. The project actually held **53 deployments**. Deleting
the first 22 revealed 22 more; deleting those revealed more again, three pages
deep. Anything in this report phrased as "all 25" should be read as "the newest
25."

**Correction 2 — five old deployments were shipping raw `/data` as static
files.** That is the project's single highest-severity invariant
(`WEBSITE-STATE.md` §7, and `references/10-severity.md` ranks it **Critical**),
and the report states plainly that it "is **not** shipping statically on any of
them." That statement was true of every deployment the audit had looked at, and
false of the project as a whole.

Confirmed against the real service before deletion, on `05fa51de`, `a30b1e22`,
`ac9f971e`, `987a897b` and `efc0ce12`:

```
/data/manifest.json          61 entries   (the live filtered copy has 34)
/data/projects/campus.json   2883 bytes, contains "tourUrl": "https://spaces.dtsxr.com/tour/…"
                             (the live stripped copy is 2769 bytes and contains none)
/data/gis/maps/iberia-coastal.json
                             200, 23191 bytes — the gated GIS map document itself
```

These are pre-Phase-6 builds, from before the `data/current/` + `data/source/`
split existed — so this is the *old* static site shape still being served,
not a regression in the current pipeline. That distinction matters for how it
happened and not at all for what it exposed: an anonymous caller could read
the unstripped content from those hostnames today.

**Full tally across all 53.** 46 of the 50 deleted deployments were probed
first; 4 (`71a041ec`, `e6dc6df8`, `e8768a2e`, `f356b143`) were deleted without
probing, so what they served is unknown and now unknowable.

| Exposure | Deployments found serving it |
|---|---|
| `tools/gis-harvest.mjs` | **29** (report said 7) |
| Unstripped `js/config.js` — 9 tour URLs, 8 of them gated | **9** (report said 3) |
| **Raw `/data` as static files** — unfiltered manifest, gated `tourUrl`, gated GIS map | **5** (report said 0) |
| `/.env` | 0 — clean on every deployment probed, at every age |

### What was done

**50 deployments deleted, 3 kept:** `3eada530` (the live alias), `fb6554dd`,
`ecb262ed`. Every deployment carrying any of the three exposures above is in
the deleted set.

`wrangler pages deployment delete <id> --project-name dts-website --force` —
`--force` is documented as "delete even if the deployment has an active alias",
but it also skips the interactive confirmation, which is what makes the command
usable non-interactively. Without it the CLI asks "are you sure?" and answers
itself **no** in a non-interactive shell, reporting nothing useful.

### ⚠ The exposure is NOT yet closed — deletion has not taken the hostnames down

**This is the honest state and it should not be read as a completed fix.**

All 50 deployments are gone from `wrangler pages deployment list` (the project
now lists exactly 3). But **the deleted `<hash>.dts-website-4cu.pages.dev`
hostnames are still serving their old builds**, 45+ minutes after the first
deletion. Verified with cache-busting query strings, so this is not an edge-cache
artifact:

```
23:45Z, first deletion ~23:00Z
  1eab93e9  200, 57182 bytes    05fa51de  9 tour URLs, campus.json still carries tourUrl
  5e8bbb3e  200, 57182 bytes    987a897b  9 tour URLs, campus.json still carries tourUrl
  101ac885  200, 57182 bytes    a30b1e22  9 tour URLs, campus.json still carries tourUrl
```

A path that never existed on `05fa51de` still returns that deployment's *own*
56316-byte SPA fallback rather than a 404 — so the deployment is still running,
not replaying one cached response. Response headers show
`cache-control: public, max-age=0, must-revalidate` and no `CF-Cache-Status`,
which rules out the edge cache as the explanation.

So deletion appears to remove the deployment **record** synchronously and
retire the **hostname** on some slower schedule, or not at all. The audit could
not determine which, and the difference matters:

- If it is a propagation delay, this closes on its own and simply needs
  re-checking.
- If the hostname is retained after deletion, then **deleting deployments is
  not a remedy for this class of exposure at all**, and the only real controls
  are (a) never deploying the excluded files in the first place, which
  `DEPLOY-STAGING.md` already covers, and (b) rotating anything that leaked.

**Re-check before treating F-C02 as fixed:**

```
for u in 1eab93e9 05fa51de a30b1e22 987a897b 101ac885; do
  printf '%-10s ' "$u"
  curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
    "https://$u.dts-website-4cu.pages.dev/?x=$RANDOM"
done
```

Expect a non-200, or the current 64804-byte shell. A 200 at the old byte count
means the old build is still live and Cloudflare support is the next step.

**This does not change the F-C01 recommendation, and it strengthens the tour-URL
one.** Eight gated tour URLs have now been confirmed publicly readable from two
independent hosts over an extended period. Reissuing them is the only action
that does not depend on someone else's infrastructure behaving as documented.

### F-C03 — fixed

`functions/_lib/access.js` gained an exported `SECURITY_HEADERS` constant
(`nosniff`, `Referrer-Policy`, `Content-Security-Policy: default-src 'none'`,
HSTS), spread into `json()` and into every hand-built `Response` in the three
route files that do not go through it: `functions/data/[[path]].js` (3
responses), `functions/api/download/[key].js` (1), and
`functions/api/resource/gismap/[mapId]/layer/[layerId].js` (5). The report's
proposed fix named only two such sites; there were nine.

**Verified by executing the real handlers** against fake R2 bindings and a
stubbed `caches.default`, reading the headers off the Responses they actually
return — not by reading the source:

```
ok   access.json() 200            status=200 ct=application/json cache=no-store
ok   access.json() 401            status=401 ct=application/json cache=no-store
ok   data/[[path]] rejects '..'   status=404
ok   data/[[path]] miss -> 404    status=404
ok   data/[[path]] hit -> 200     status=200 cache=public, max-age=30, s-maxage=300
ok   gismap layer, unknown map    status=404
all responses carry the four headers
```

Existing `content-type` and `cache-control` values are unchanged on every
response, and the `..` path-traversal rejection still fires. Full
credential-free suite green: 5 security probes + the GIS resolver regression.

**Committed, not deployed.** These headers do not exist on the live site until
someone runs `DEPLOY-STAGING.md`.

### F-C04 — fixed

`_headers`' CSP gained `frame-ancestors 'none'; form-action 'self'`. All 13
directives verified present after the edit.

The same edit **deleted the dead `wss://<dev-project-ref>.supabase.co` entry**
from `connect-src`. Nothing in the codebase uses Supabase Realtime, and
`connect-src` already permits `https:`, so the entry granted only the `wss:`
scheme to a project nobody connects to. It also carried the developer's
personal dev project ref into every response header — see the corrected handoff
item above.

**Committed, not deployed.**

### F-C05 — accepted, not fixed

The owner's decision: leave `script-src 'unsafe-inline'` as it is. Recorded as
an accepted risk rather than an open finding. The reasoning in F-C05 still
stands and is worth revisiting if a second person ever holds `site_admin`, or
if the intro-cloak script is removed for other reasons — at which point
dropping `'unsafe-inline'` costs nothing.

### F-C01 — deferred to handoff by the owner

The GitHub Pages host stays up until the Cloudflare version is handed over to
DTS, at which point the old repo/site is retired. That is a deliberate,
recorded decision by the owner and the audit is not treating it as an open
action item. The tour-URL reissue recommendation stands independently of it.
