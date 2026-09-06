# Cloudflare scope — deploy exposure, secrets, cache, bindings, headers

Loaded for the `cloudflare` scope. Pinned at build time.

**Scan input:** `55-deploy-exposure.sh`, `50-headers.sh`, `60-cors.sh`,
`00-inventory.sh`.

---

## 1. Deploy exposure — start here, always

On a Pages project whose build output directory is the repo root, **the deploy
publishes whatever is in the directory you point it at.** There is no
allowlist, no `.gitignore` equivalent, and no warning. If the deploy command
is run against the working tree instead of a staged copy, everything ships:
`.env`, `scripts/`, `supabase/migrations/`, `docs/`, `tools/`, and raw `data/`.

The control is a human following a documented staging procedure. On this
project that control **has already failed in production** — a script under
`tools/` was served live because a checklist step was skipped.

### The severe case: static assets shadow Functions

Cloudflare Pages serves a **static asset in preference to a Function at the
same path.** So a published static `/data/<path>` silently takes priority over
`functions/data/[[path]].js` and bypasses every access check the site has —
with no error, no log line, and no visible symptom. One mis-staged deploy
turns a gated site into an open one.

This is the highest-severity invariant in the project. Test it every run.

### How to test it properly

Status codes prove nothing: a single-page app answers unknown paths with its
`index.html` fallback at HTTP 200. Compare **byte counts** against that
fallback, and check `content-type`. `55-deploy-exposure.sh` implements this.

The strongest single probe: fetch a `/data` document that exists on disk but
is **absent from the manifest**. The Function routes by manifest and will not
serve it; a static upload knows nothing about the manifest and will. A 200
there is near-conclusive evidence raw `data/` was published.

### Related

- `js/config.js` is injected dynamically, so it never appears in a normal
  network trace — and it is fetchable, and the repo copy holds real gated
  URLs. Check the **deployed** copy. Count distinct ids rather than raw
  matches: a correctly stripped build legitimately mentions the public tour
  more than once.
- Direct-upload deploys have no git connection, so nothing enforces that what
  was deployed matches any commit. A dirty working tree at deploy time ships
  uncommitted code. Record the commit and the tree state with every audit.

---

## 2. Secrets and account-specific values

- **`wrangler.toml` is committed.** Anything in it is public. Bucket names and
  binding names are disclosure, not compromise, but an `account_id` or a token
  is a real finding.
- **Secrets belong in Pages environment variables**, set out of band, never in
  a committed file and never in `_headers`. Check for account-specific values
  that have leaked into committed files beyond the one file the project
  sanctions for them — a project ref hardcoded into a CSP `connect-src` is
  easy to miss and blocks handoff.
- **`.dev.vars` is the local equivalent** and must be git-ignored if present.
- **Orphaned secrets.** When a Function is deleted, its Pages env vars stay.
  A secret nobody reads is still a secret that can leak. Cross-check every
  `env.X` referenced in `functions/` against the configured variables, and
  look for code comments referencing a Function file that no longer exists —
  that is the usual tell.

---

## 3. Bindings and least privilege

Bindings are ambient authority: any Function can use any binding declared for
the project. There is no per-route scoping.

Ask:

- Which routes actually touch each binding? `00-inventory.sh` counts `env.X`
  references. A binding used by one route is reachable from all of them.
- Does a read-only consumer hold a binding that also permits writes? Bucket
  bindings are not read-only by declaration; the code's restraint is the only
  limit.
- Is a build/artifact bucket bound into the same project as the content
  bucket? Then any Function bug reaches both.

None of these is automatically a finding. They set the blast radius for every
`app`-scope finding, which is why this scope should establish them first.

---

## 4. Cache

Cloudflare caches aggressively by default, and a Pages Function response can
be cached like anything else.

- **A gated response that is shared-cacheable is a cross-user leak waiting for
  a key collision.** Every route returning per-user content needs
  `Cache-Control: no-store` (or at minimum `private`). `50-headers.sh` checks
  the data and API routes.
- **`Vary` matters.** A response that differs by `Authorization` or `Origin`
  but does not `Vary` on it can be served to the wrong caller.
- **Cache poisoning via unkeyed input.** If a response varies on a header that
  is not part of the cache key, an attacker can poison the entry for everyone.
  Look for Functions that read a request header and reflect it into the
  response or into a redirect.
- **Purge is not automatic.** Content written by a CLI tool rather than
  through the app's own publish path may not invalidate the edge cache, so
  stale content is served for the TTL. That is a correctness and
  content-integrity issue more than a security one — but it also means "I
  fixed it and deployed" does not guarantee the fix is live. Re-verify fixes
  against a cache-busted URL.

---

## 5. Headers

`50-headers.sh` compares served headers against the repo's `_headers` file.
The comparison is the point: `_headers` states an intention, a response proves
what is served. Pages applies `_headers` to static assets, while a Function
builds its own headers in code — so the two halves of the site can differ, and
the Function half is the one serving gated data.

- **A directive in `_headers` that never appears in a response** means the
  file is not being applied as its author believes. Report the mechanism, not
  just the absence.
- **`frame-ancestors`** (or `X-Frame-Options`) is the clickjacking control. A
  site that embeds a third-party iframe is doing the *opposite* thing; it does
  not protect itself.
- **`form-action`** stops an injected form posting to an attacker origin.
- **CSP `script-src`** is the directive that matters for XSS. `'unsafe-inline'`
  is often forced by a genuine inline script — check `index.html` before
  reporting, and if it is forced, the honest recommendation is a nonce or
  hash, not "remove unsafe-inline".
- **Broadened `img-src` / `media-src` / `frame-src` / `connect-src`** may be a
  documented, approved decision on a CMS that accepts arbitrary external URLs.
  Read `WEBSITE-STATE.md` and `PROGRESS.md` before reporting. Re-reporting an
  approved decision as a finding signals the grounding read did not happen.
- **`'unsafe-eval'` absent + `eval`/`new Function` present in the code** is
  live-only breakage: works over a local static server, blocked on the
  deployed site. Not a vulnerability; a real bug worth reporting.
- **Allowlist entries with no corresponding tag** are stale — but verify by
  grepping the JS too, since scripts are often loaded at runtime rather than
  declared in the HTML.

---

## 6. CORS

Absent CORS headers are the **secure** state. Report finding nothing as a
pass, not as "not tested".

What is actually dangerous:

- ACAO **reflecting** the request's `Origin` **with** `Allow-Credentials:
  true` — any site can read authenticated responses as the victim. This is the
  one to hunt for.
- `ACAO: *` on a route returning per-user data. Browsers refuse to combine
  `*` with credentials, so this leaks only what an anonymous caller could
  already fetch — real, lower.
- Reflection without `Vary: Origin`, which lets a shared cache serve one
  origin the response computed for another.

Supabase's own PostgREST answers `*` by design. That is upstream behaviour,
not a finding against this project — and it is exactly why the RLS policies
have to be right.

---

## 7. Rate limiting and WAF

Pages Functions get no rate limiting by default. Anything unauthenticated and
writable is abusable until something limits it.

- **Auth endpoints** are the priority: login, signup, reset, OTP. These are
  Supabase's, not Cloudflare's — check the provider's own limits and say which
  layer is doing the work.
- **A public write endpoint with no limit** (analytics, tracking, lead
  capture) is a cost and data-integrity problem, not a disclosure. Rank
  accordingly, and check whether one already exists elsewhere in the codebase:
  a project that rate-limits invitations but not tracking made a choice, and
  the report should say which it was.
- **Where a limiter uses a table as its ledger**, check what happens when the
  write fails, and whether the key is something the caller controls.

---

## 8. Fixing in this scope

Header and config changes are low-risk and easy to verify — but on this
project the deploy is manual, so a fix is not live until someone runs the
documented staging procedure. **Never improvise a deploy.** Follow
`docs/migration/DEPLOY-STAGING.md` exactly; several real bugs have shipped
from improvising that step and they are documented there.

State plainly in the report whether a fix is *committed* or *deployed*. They
are different claims and only one of them protects anyone.
