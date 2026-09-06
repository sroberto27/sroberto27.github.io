# Security audit — 2026-09-06

**Target:** https://dts-website-4cu.pages.dev · **Commit:** 964d7df0 · **Working tree:** 3 uncommitted files (a skill script, a .docx, one new doc — none affect this scope)
**Scopes completed:** app · **Fixes:** branch `security-audit-2026-09-06` (`3be4dec0`, `ea805d19`, `84922d80`)
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

### Deployment state — read this before assuming "done"

Separating these two claims matters on this project; conflating them is what
made the 2026-09-06 GIS outage hard to attribute.

- **Live now, no deploy needed:** all three migrations. They are applied to the
  `DTSdev` database and recorded in `schema_migrations` (8 rows). Because RLS
  and grants are enforced by Postgres, F-S01's RLS half, F-S02 and F-S03 are
  **already in force for the deployed site** — including against the currently
  deployed JS.
- **Committed but NOT deployed:** the two JS changes
  (`functions/_lib/admin.js`, `js/app.js`). Until someone redeploys per
  `docs/migration/DEPLOY-STAGING.md`, the live site still runs the old
  `isOrgAdmin()` and the old `buildSessionFromAuth()`. The security consequence
  is contained — the RLS half already denies the reads, so a disabled org's
  org_admin cannot reach data — but `/api/org/members` and `/api/org/invite`
  authorize through the Function-side `isOrgAdmin()`, which is still the
  unfixed copy in production. **F-S01 is not fully closed until that deploy
  happens.**
- **Not confirmed in a browser:** the `js/app.js` change. `node --check` passes
  and the query shape is the documented PostgREST embed syntax, but no one has
  signed in and looked at the portal. Worth a click-through of the org-admin
  team panel for an *active* org after deploying, since that is the path the
  change touches.
