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
