# App scope — authz, injection, XSS, IDOR, CSRF

Loaded for the `app` scope, and for `deps` reachability triage. Pinned at
build time.

**Scan input:** `00-inventory.sh` (route/guard matrix, sinks) plus targeted
greps described below.

---

## 1. The trust boundary this scope owns

The Pages Functions use the **service role** for every database query. RLS is
bypassed completely. There is no second line of defence behind these routes:
**the Functions are the trust boundary.**

That has a direct consequence for ranking. A route whose guard is missing,
mis-ordered, or whose return value goes unchecked is not a degraded control —
it is unauthenticated access to everything that route can reach. Start those
at Critical.

---

## 2. Function-level authorization — the highest-value pass

`00-inventory.sh` prints which guard each route *calls*. That grep cannot
answer three things, and those three are the work:

### a. Is the guard's return value actually checked, before the first side effect?

A guard that returns an error object rather than throwing is only effective if
the caller inspects it. Read each handler's first few lines:

```js
const auth = await requireSiteAdmin(request, env);
if (auth.error) return auth.error;      // <- this line is the control
```

Missing that line means the guard ran, returned a denial, and the handler
proceeded anyway. Grep for the guard call, then **read forward** to the first
`pgrst()`, R2 access, or mutation. Anything between them that acts on request
data is reached pre-authorization.

### b. Is it the *right* guard?

`requireSiteAdmin` on a route any org admin should reach is a functional bug.
`requireOrgAdminOf(orgId)` on a route where `orgId` comes from the request
body rather than the path is an authorization bug — the caller picks which org
they are an admin of. Check where the guard's own argument comes from.

### c. Does the route re-derive authority, or trust the client?

Any authorization input taken from the request body — a role, an org id, a
"isAdmin" flag — is attacker-controlled. It must be re-derived from the
verified user id server-side.

### The documented exceptions

Some routes are intentionally unguarded or auth-optional. `WEBSITE-STATE.md`
lists them. Confirm each against that list rather than reporting it. A route
that is *newly* unguarded and not on the list is the finding.

**Auth-optional is a trap worth naming.** A `verifyUser()` that returns `null`
for an invalid or expired token — treating it as a guest rather than an error
— is correct for a route that serves anonymous callers. But it means checking
"does this route reject a bad token?" answers the wrong question. The real
question is what the **downstream** access check does with a null user. Test
that, not the token verifier.

---

## 3. IDOR — routes that take an id

Enumerate every route with a path or query parameter naming a resource, then
for each:

- Is there an ownership or entitlement check, or does the id alone grant
  access?
- Is the check done **after** the object is fetched, and does the error path
  distinguish "not found" from "not yours"? (A 404-vs-403 difference is an
  enumeration oracle. Minor alone; useful in a chain.)
- Are ids guessable? Sequential ids make a sweep trivial; UUIDs raise the cost
  but are not an access control.
- Do **write** verbs get the same check as reads? The commonest form of this
  bug is a `GET` that checks ownership and a `DELETE` on the same resource
  that does not.

The exploit test for this is a low-privilege session sweeping every id-taking
route with another user's identifiers. Write it once; it keeps paying.

---

## 4. Injection

### PostgREST filter injection — this project's proven class

Ids are spliced into PostgREST query strings as template literals:

```js
pgrst(env, `organization_members?org_id=eq.${orgId}&role=eq.org_admin`)
```

This is not SQL injection, and it is worse than it looks. The query path goes
into a URL. **A literal `#` in the interpolated value truncates the string** —
`fetch()` treats everything after it as a fragment and never sends it. The
restricting clause silently disappears and the request becomes *less*
restrictive than intended. Other separators (`&`, `,`, `=`) let a caller add
or alter filters outright.

This has already been a **live authorization bypass on this codebase.**

**The mechanical check, run every `app` session:** every `${...}` inside a
`pgrst()` template literal must be either

- guarded by a strict validator before use (a UUID shape test, say), or
- wrapped in `encodeURIComponent()`.

```bash
grep -rn 'pgrst(env, `[^`]*\${' functions/
```

Then, for each hit, follow the value back to its origin and confirm the guard
is on **that** path — not merely present somewhere in the file. A guard in
one branch does not protect another. Values sourced from the database rather
than the request are lower risk but still worth noting, since one
attacker-controlled row makes them live.

### Everything else

- **SQL**: only where raw SQL or an RPC takes a string. Parameterised is safe;
  string-built is not.
- **Command**: `exec`/`spawn` with request data. Rare in Workers; check build
  scripts, which run on a developer machine with more privilege than the edge.
- **Template**: any string concatenated into HTML — see below.
- **Path traversal**: `../` in a key used to build an object-store path or a
  file path. Check every route taking a key or filename, including catch-all
  routes.
- **Header injection**: `\r\n` in a value written into a response header or a
  redirect target.

---

## 5. XSS

### Where to look

`00-inventory.sh` counts sinks. The counts are not the finding; the **source
of the value** is.

For every `innerHTML` / `insertAdjacentHTML` / `outerHTML` / `document.write`
assignment, ask: **who authors this value?**

| Author | Rank at | Why |
|---|---|---|
| A stranger (URL/query/share-link state, form input) | High | Victim only has to click a link |
| A registered user or org member | Medium–High | Depends who sees the rendered output |
| `site_admin`, via the CMS | Medium | See the calibration in `10-severity.md` — the author is already maximally trusted; the finding is persistence and blast radius |
| A constant in the code | Not a finding | |

### The pattern to check for specifically

Where a codebase has an escape helper and uses it inconsistently, the
inconsistency is the finding, not the sink count. Compare the number of escape
calls against the number of sinks, then read the gaps. A codebase that escapes
in 15 places and not in 3 knows the pattern — the 3 are oversights, and they
are worth listing individually with `file:line`.

Sinks fed from a **share link's decoded state** are the ones that matter most.
That path takes a value authored by anyone, opened by a victim, and this
project has already had a real exploited XSS on it (a crafted colour value
breaking out of a `style` attribute, fixed with a whitelist sanitiser). When
auditing it: check the **sibling fields** on the same decoded object. A fix
applied to one field usually leaves the others alone.

### URL-valued sinks

An `href` or a `src` built from CMS or user data can carry `javascript:` or
`data:`. `img.src` and `video.src` do not execute those schemes, so the risk
is low there; an `<a href>` does. Check for a scheme allowlist, and note that
CSP `object-src 'none'` and `base-uri 'self'` limit but do not remove this.

### Why XSS is worse here than the CSP suggests

The session token lives in `localStorage`, not an HttpOnly cookie. Any script
running on the page can read it directly and use it anywhere. Weight XSS
findings with that in mind, and say so in the report.

---

## 6. CSRF

Bearer tokens in `localStorage` are not sent automatically by the browser, so
classic CSRF largely does not apply — a cross-origin form post arrives with no
credentials.

Two things to confirm rather than assume:

- **No cookie-borne session.** `60-cors.sh` checks for `Set-Cookie`. If one
  appears, the assumption above is dead and CSRF is live again.
- **No route that authenticates by anything ambient** — an origin check alone,
  an IP allowlist, a header the browser sets for you.

---

## 7. Mass assignment

Where a handler passes a request body into an update, ask which columns the
caller can reach. A `PATCH` that forwards the whole body lets a caller write
any column the service role can write — including role, tenancy, and status
columns.

Look for an explicit allowlist of assignable fields. Its absence is the
finding; the presence of a denylist is nearly as bad, because the next column
added to the table is assignable by default.

---

## 8. Client-side gating is not authorization

A flag in `localStorage`, a query parameter, or a state variable that decides
whether admin code is *downloaded* is a payload-size decision, not a control.
Anyone can set it.

The check: for each such flag, confirm **nothing security-relevant depends on
it.** The real controls should be a server-side role check on every privileged
route, plus the client verifying the role from a verified session before
rendering privileged UI. Where a flag has quietly acquired a second
responsibility, that is the finding.

Conversely: the client rendering a "locked" placeholder from public data is
fine — provided the real target only ever arrives in an authorized server
response. Confirm that by reading the response, not the UI.

---

## 9. Drift between code and `WEBSITE-STATE.md`

Bugs live where documentation and code disagree, because someone believed the
document. When you find drift:

- if the code is more permissive than the document → likely a finding
- if the code is stricter → likely a stale document; propose the doc update
- either way it goes in the report, under findings or documentation updates

---

## 10. `deps` reachability triage

The lockfile is usually **not** where a static site's visitor-facing
third-party code comes from.

1. **Read `package.json`'s own description.** If the dependencies are
   build/migration tooling that never ships to the browser, an advisory there
   is a developer-machine and CI risk. Real, worth patching, **not** visitor
   exposure. Do not rank it as though users were affected.
2. **The browser-facing supply chain is the CDN `<script>` tags** — in
   `index.html` and, easier to miss, the ones injected at runtime from JS.
   `10-deps.sh` lists both. For each: is there Subresource Integrity? Is the
   version pinned tighter than a major? An unpinned CDN URL means the operator
   of that CDN, and whoever can publish to that package, can execute script on
   every page load.
3. **Install scripts** in the lockfile run arbitrary code at `npm install`, on
   whatever machine installs. Check them regardless of runtime reachability.
4. **Lockfile integrity** — packages resolved off the public registry, or with
   no integrity hash — is a supply-chain question independent of any CVE.

Rank a dependency finding by which of those it actually is. They differ by
orders of magnitude.
