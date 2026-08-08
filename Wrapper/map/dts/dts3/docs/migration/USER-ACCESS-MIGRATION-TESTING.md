# User Access Migration — Manual Testing

Manual acceptance checklist for the identity/access model built across Phases
3–9 and Handoff. Run this AFTER the relevant phase, not before — most rows
depend on Phase 4+ (resource gating) or Phase 5b (CMS/org management) being
live. This is representative coverage, not exhaustive; see
`docs/migration/ACCESS-MODEL.md` for the underlying spec these tests verify.

Format per test:

```
Result:
- [ ] PASS
- [ ] FAIL
- [ ] NOT TESTED

Comments:
____________________________________
```

No result is pre-marked. Fill these in yourself as you run through the site.

---

## Guest browsing (Phase 4+)

**1. Guest can browse the full public site.** Home, all four sector views, all
16 project pages, descriptive content (text/images/gallery/evidence) for every
project — signed out.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**2. The main homepage experience is public.** "Try a Digital Twin" reveal
opens the live Treedis tour for a signed-out visitor with no login prompt.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**3. Login/register gate on a gated resource.** As a guest, click a
`registered`-level project experience (e.g. `campus`). Confirm a sign-in
prompt appears INSTEAD of the resource opening — not a degraded preview, not
the resource loading anyway.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**4. Destination preserved through login.** From test 3, sign in as a
registered dummy user. Confirm the ORIGINAL requested experience opens
automatically, rather than landing on the home page or portal.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5. The `automotive`/`campus` `links[]` leak is closed.** As a guest, inspect
the published `automotive` and `campus` project pages/network responses.
Confirm the tour links that used to point directly at `spaces.dtsxr.com` are
either absent or behave as gated tiles — not raw clickable URLs.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5b. The GIS map is withheld wholesale, not just hidden.** As a guest,
directly fetch `data/current/gis/maps/iberia-coastal.json` (view source /
network tab, not the UI) and confirm it does NOT contain `view`/`basemaps`/
`layers`/`tours` — only a public stub, or nothing at all. Also check
`DTS_CONFIG.gisMaps` in the console for the same absence. This is the
strongest version of test 5 — a GIS map is a whole document, not a URL, so a
leak here means the map's full interactive definition (layers, tours, feature
tours) is fetchable directly regardless of what the "Try the map" tile shows.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5c. The GIS map's local layer files are gated independently of the map
document.** As a guest, directly fetch
`data/current/gis/layers/shoreline-1935.geojson` (and the other 4
shorelines + `parish-boundary.geojson`). Confirm 404/absent. This is a
SEPARATE check from 5b — `js/gis/gis-viewer.js` fetches these files by their
own relative URL, independent of the map document and independent of
`DTS_CONFIG` entirely, so passing 5b does not guarantee this one passes. Then,
as an entitled user (`testorgadmin`), confirm the map renders WITH the
shoreline layers visible — proving the authenticated
`/api/resource/gismap/iberia-coastal/layer/<id>` route works, not just that
the guest path is blocked.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5d. `js/config.js` does not hand out gated URLs.** Run:

```
curl https://<deployed-site>/js/config.js | grep -c "spaces.dtsxr.com"
```

Expect **1** (the public homepage tour), not 16. Repeat for `vimeo`. **Do not
substitute a browser network-tab check** — `config.js` is injected
dynamically only when `/data` fails, so it will legitimately appear absent
from a normal page load while remaining fully fetchable by anyone who asks
for it directly. This is the single easiest check to skip and the one that
most completely voids the gating if it fails: one unstripped static file
hands over every gated tour and video URL for all 16 projects regardless of
how correct everything else is.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Registered user (Phase 4+)

**6. Registered access.** Sign in as a plain registered dummy user (no org).
Confirm all `registered`-level experiences/links/GIS maps open normally.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**7. Registered user blocked from `client`-level and `restricted`
resources.** Same user attempts a `client`-level resource (403/blocked, with
an explanatory message, not a silent failure) and a `restricted` resource they
have no entitlement for (403).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Client organization access (Phase 4+)

**8. Org member access.** Sign in as a dummy user who is a `member` of an
organization. Confirm `client`-level resources open, and any resource
`restricted` to their org opens.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**9. Unrelated-organization denial.** Same user attempts a resource
`restricted` to a DIFFERENT organization they do not belong to. Confirm 403,
not a partial/cached view.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**10. Client dashboard / portal.** HOME / APPS / MANAGE / SUPPORT views open
correctly for an org member and show only their own organization's resources.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**11. Multi-organization membership.** Sign in as the dummy user seeded with
membership in TWO organizations (`org_admin` at one, `member` at the other).
Confirm both organizations' `client`/`restricted` resources are reachable, and
the org-admin affordance appears ONLY for the org where they hold that role.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Org-admin (Phase 5b+)

**12. Org-admin member management.** As an `org_admin`, add an existing user
to their org, remove a member, toggle a member ↔ `org_admin`, and invite a new
user by email. Confirm each action completes and reflects immediately.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**13. Org-admin boundaries (adversarial).** As an `org_admin` of Org A,
attempt to modify Org B's membership (by crafting a request with Org B's id,
not just by looking for a UI path). Confirm the server rejects it (403), and
that the same user cannot open the CMS, cannot see other organizations' data,
and cannot promote themselves or anyone to `site_admin`.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Site-admin (Phase 5, 5b)

**14. Site-admin management.** As a `site_admin`, open the Admin Board;
create/rename/disable an organization; create a user and assign them to
multiple organizations with different org roles; grant and revoke a
`restricted` entitlement; promote/demote `site_role`; activate/deactivate an
account. Confirm each writes an `admin_audit` row (visible in the audit view
from Phase 9, or query directly if that phase hasn't run yet).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**15. `org_admin` cannot reach the Admin Board.** Confirm signing in as an
`org_admin`-only user (no `site_admin`) never opens the Admin Board under any
entry point.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## CMS access controls (Phase 5b, 6)

**16. Access-level editors.** As `site_admin`, change a project's access
level, an individual experience's level (including setting it to `inherit`
vs. an explicit override), and a GIS map's level. Confirm each save persists
through the draft → publish pipeline and is reflected on the live site after
publish.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**17. Inherit vs. override.** Set a project to `registered` with one
experience overridden to `restricted`. Confirm the overridden experience
enforces `restricted` while sibling experiences enforce the project default.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Downloads (Phase 8)

**18. Authorized download.** An entitled user (directly, and separately via
org entitlement) downloads a dummy client app successfully via a short-lived
signed URL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**19. Unauthorized download blocked.** A non-entitled user attempting the
same download gets 403. A DISABLED `client_apps` row blocks even an entitled
user.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Analytics and audit (Phase 9)

**20. Analytics events recorded.** Perform a project view, a login gate
trigger, an experience open/close, and a download start. Confirm matching
`events` rows appear with correct `type`, and `org_id`/`user_id` reflect the
actual session, not client-supplied values.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**21. Audit events recorded.** Repeat a membership change, an access-policy
change, and an entitlement grant from test 14. Confirm each produces an
`admin_audit` row with correct `before`/`after` state, visible only to
`site_admin`.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Regression (every phase)

**22. Auth/CMS regression.** Home ↔ sector switching; one example window per
sector; "Try a Digital Twin" reveal open/close (tour must not reload — check
the network tab for a second Treedis iframe request, there must be none); a
lead form send and the mailto fallback; admin draft → preview → discard; zip
export; mobile drawer + swipe; Safari check for the Vision Pro CTA; console
clean on load and on every overlay.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________
