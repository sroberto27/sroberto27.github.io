# DTS Website — Full System Manual Testing

One consolidated pass over the **entire site**, end to end — not a single
phase. This supersedes the individual phase-testing documents
(`PHASE8-BUILDS-TESTING.md`, `PHASE9-TESTING.md`, `HELP-DOCS-TESTING.md`,
`USER-ACCESS-MIGRATION-TESTING.md`) by merging them, de-duplicating the
overlapping checks, and folding in `CLAUDE.md`'s own standing regression
checklist.

Those four now live in [`archive/`](archive/) — kept, not deleted, because two
of them carry real results a human actually recorded.

It also covers, as **first-class items**, everything from the 2026-08-09 /
2026-08-10 audit-and-fix sessions that has **never been verified in a real
browser** — Chrome automation was unavailable throughout those sessions, so
every one of those fixes is confirmed only at the API/file level. Those are in
Part A, deliberately first.

**Nothing in this document is pre-marked.** No result has been filled in on
your behalf. Where a fix is "already proven at the API level," that is stated so
you know what a failure would mean — not as a reason to skip the test.

---

## Before you start

**Test against <https://dts-website-4cu.pages.dev>** (the stable alias), never
localhost — the standing convention for this project. If you have just
redeployed, give the alias a few minutes to catch up to the latest deploy.

**Seeded dummy accounts** (dev Supabase project `DTSdev`):

| Account | Site role | Organizations |
|---|---|---|
| `testadmin@example.com` | `site_admin` | none |
| `testorgadmin@example.com` | `user` | **org_admin at Beta Municipal**, member at Acme Hotels |
| `testmember@example.com` | `user` | member at Beta Municipal only |
| `testuser@example.com` | `user` | none — plain registered |

> Note: `scripts/seed-dev.mjs`'s own console output prints `testorgadmin`'s two
> orgs the other way round. The table above is what the real database contains.

**Known constraint:** Supabase's built-in email is capped at **2 messages per
hour, project-wide**, shared across signup confirmation and password reset.
Don't chain email-dependent tests in the same hour and mistake the shared cap
for a new bug.

**Useful resets between tests:** sign out; clear `localStorage` (or use a fresh
private window) to re-trigger the cookie banner and the first-visit help hint.
The keys in play are `dtsAdminDraft`, `dtsCookieConsent`, `dtsHelpHintSeen`.

**Format per test:**

```
Result:
- [ ] PASS
- [ ] FAIL
- [ ] NOT TESTED

Comments:
____________________________________
```

---

# Part A — Never verified live (deployed, API-confirmed only)

Everything in this part is real, shipped code whose behavior in an actual
browser has never been observed. Treat a failure here as expected-possible,
not surprising.

## A1. Org membership auth-bypass fix — the legitimate path still works

The fix added a strict UUID guard (`isUuid()`) at every point an
externally-supplied id reaches a PostgREST filter. The exploit itself is
confirmed closed with real minted sessions. What is **unverified** is that a
real org_admin's ordinary day-to-day team management still works normally
through the UI — which is precisely what this fix touched.

**1. An org_admin sees their team panel and its real member list.** Sign in as
`testorgadmin@example.com`. Open the client portal → **Manage**. Confirm a team
panel appears for **Beta Municipal** (the org where they hold `org_admin`), with
a real list of that org's members. Confirm **no** panel appears for Acme Hotels,
where they are only a plain member.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**2. Add an existing user to the org.** In that panel, add
`testuser@example.com` by email. Confirm it succeeds and the member list updates
immediately.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**3. Toggle a member's role, both directions.** Promote the member you just
added to `org_admin`, confirm the change shows, then demote back to `member`.
Neither direction should error.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**4. Remove a member.** Remove `testuser@example.com` again. Confirm it
disappears from the list and no error appears.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5. Invite a brand-new user.** Use the invite-new control with a throwaway
address (e.g. `throwaway-<something>@example.com`) and a temporary password.
Confirm the account is created and appears as a member. Then remove it again to
clean up. (Rate limit: 20 invites per actor per rolling hour.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**6. A plain member sees no team panel at all.** Sign out, sign in as
`testmember@example.com`, open the portal → Manage. Confirm there is **no**
org-admin panel — just the ordinary static Manage content.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**7. Console is clean throughout the above.** No errors, no 400s that aren't
deliberate. A 400 on a *legitimate* action would be the signature of the UUID
guard being too strict.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## A2. GIS shareable-link XSS fix

`renderDrawingLayer()` escaped a drawing's `text` but not its `color`, which is
concatenated into a `style="color:…"` **attribute**. A crafted `?map=<base64>`
link could break out and run script in the site's origin. Fixed with a strict
whitelist (`sanitizeColor()` — hex code or a plain CSS color keyword; anything
else falls back to the default).

**8. Normal drawings still render in their real colors.** Sign in as
`testorgadmin@example.com`, open the GFC project's map experience, and use the
drawing tools to create a marker/shape with a non-default color. Confirm the
color actually applies — the whitelist must not have broken legitimate colors.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**9. A shared map-state link round-trips.** Produce a shareable link from that
map state, open it in a new tab (signed in), and confirm the drawings come back
with the same colors.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**10. A hostile color value is neutralized, not executed.** Take a working
share link, and — if you're comfortable doing so — hand-craft one whose drawing
`color` is a break-out attempt rather than a color. Confirm the page does not
execute anything and the drawing simply falls back to the default color. If you'd
rather not hand-craft base64, mark NOT TESTED; the whitelist is confirmed by
code reading and test 8 covers the regression risk.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**11. A feature-tour popup with a title renders as text, not markup.** Open a
feature on the map that has a feature tour attached and open its popup. Confirm
the "start tour" button shows the tour's real title as plain text. (The same
session fixed an unescaped CMS-authored title concatenated into `html:` here.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## A3. Admin Board can finally see gated GIS content

Two stacked bugs meant the board saw a title-only stub instead of the real map:
`_type` was missing from the public GIS stub, and nothing ever read
`data/source/` back into the board. Fixed with `_type` added to the stub, a
combined `data/source/_latest.json` bundle, `GET /api/admin/content`, and
`ensureFullContent()` in `js/admin.js`.

**12. GIS MAPS is populated.** Sign in as `testadmin@example.com` → Admin Board.
Confirm the left nav's **GIS MAPS** section lists `iberia-coastal` (Iberia
Parish), not an empty section.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**13. Its tours are all there.** Confirm the map's guided tours are listed
under it — 14 tours, plus the feature tours reachable through the feature-tour
editor. Not one, not zero.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**14. Opening the map shows its real content.** Click into `iberia-coastal`.
Confirm the editor shows its real layer list (17 layers) and view settings — not
just an id/title/subtitle stub.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**15. The GFC project's GIS experience has a working Map dropdown.** Open
SECTORS → Government → the GFC project → its GIS-type experience. Confirm the
**Map** dropdown is populated and `iberia-coastal` is selectable — it used to be
empty.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**16. Save draft & preview still works with the fuller content set.** Make a
trivial edit, click **Save draft & preview**, confirm the site reloads into
preview with the change visible, then **Discard draft** and confirm it reverts.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**17. A draft is never silently overwritten.** With a draft active, reopen the
Admin Board. Confirm your unsaved draft edits are still there — `ensureFullContent()`
is supposed to skip entirely when a draft is active.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## A4. GIS MAPS nav hierarchy (collapse / expand)

Each map now renders as its own bold parent row with a collapse toggle; its
tours nest one indent level deeper. Collapse state defaults to **expanded** for
every map, matching the previous always-flat behavior.

**18. The hierarchy is visually real.** Confirm the map row is visibly a parent
(bold, its own row) and its tours are indented beneath it — a map is no longer
indistinguishable from one of its own tours.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**19. The toggle collapses and expands, with its rotate animation.** Click the
toggle. Confirm the tours hide, the caret rotates, and clicking again brings
them back.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**20. A map with no tours shows an aligned spacer, not a toggle.** Create a new
map (or use the existing unrenamed "New map" placeholder if it's still there).
Confirm its row has no toggle but stays aligned with the others — the list must
not jog left/right between maps with and without tours.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**21. Creating a tour force-expands its parent.** Collapse `iberia-coastal`,
then add a tour to it. Confirm the map auto-expands and the new tour is visible
— never silently hidden behind a collapsed parent. Repeat via the feature-tour
editor's "+ Create tour for this feature" shortcut.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## A5. In-app documentation — all four audiences

Zero live verification of any kind. Every item below is first-hand-unconfirmed.

**22. The floating "?" icon appears and clears the other bottom-edge UI.** Load
the homepage. Confirm a small circular "?" is visible near the bottom-left,
clear of the "Ask a Question" bar and clear of the cookie card (bottom-right).
Check it **with the cookie banner still showing** — this placement was
calculated from CSS (`--dock-h`), never seen.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**23. The overlay opens with real content and closes three ways.** Click the
icon. Confirm a search box, a topic list on the left, and content on the right
(first topic open). Close via the X, reopen and close via the dimmed backdrop,
then via Escape.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**24. The icon hides while a twin, the portal, or the board is open.** Open a
project experience — confirm the icon disappears and returns on close. Sign in
and confirm it's hidden behind the portal too.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**25. The first-visit hint appears once and never again.** In a private window,
confirm a pulsing badge and a "Need help?" tooltip. Click the icon — badge
gone. Reload — still gone. Confirm `localStorage` now has `dtsHelpHintSeen` and
that `dtsAdminDraft` was not touched.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**26. Search filters topics.** Type a word appearing in only one topic (e.g.
"cookie"). Confirm the list narrows. Clear it — full list returns.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**27. Every signed-in portal session gets a Help tab, even with no org.** Sign
in as `testuser@example.com`. Confirm **Help** appears in the portal's top nav
and mobile menu — unlike Activity, which stays hidden for this account.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**28. A plain member sees member content only.** Sign in as
`testmember@example.com` → Help. Confirm topics cover the portal (All Apps,
Activity, Support, account) and **nothing** about inviting/removing members or
role toggles.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**29. An org_admin sees member content PLUS team topics, layered.** Sign in as
`testorgadmin@example.com` → Help. Confirm the same member topics from test 28
are still present, **plus** topics on adding/inviting/removing members and the
role toggle, including the inline invite-flow diagram.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**30. The Admin Board's Documentation screen covers every real screen.** As
`testadmin` → Admin Board → HELP → Documentation. Confirm topics exist for
Home/Contact/FAQ/Fun facts, Category pages, Projects, GIS maps & tours,
Organizations, Users, Builds, Access, and Audit, plus the Save
Draft/Preview/Discard/Publish/Export workflow.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**31. The admin topics actually teach, with real labels.** Spot-check two or
three topics. Confirm they contain numbered click-by-click steps, "before you
start" callouts, and that quoted button names ("Save draft & preview", "+ Add
category page", "Test connection", "Who has access") match what's really on
screen.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**32. The topics are explicit about which screens write live vs. draft.**
Confirm the Organizations / Users / Builds / Access topics say plainly that they
write immediately with no publish step, and the content topics say they follow
draft → preview → publish.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**33. The access-ladder diagram renders and is legible.** Open "Access levels &
entitlements". Confirm the four-box public → registered → client → restricted
diagram renders with visible arrows. Check both light and dark OS theme if easy.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**34. The entitlement picker's "?" jumps straight to the Access topic.** Open
any project's Access section, find the "Who has access" picker, click the small
"?" next to its label. Confirm it lands on the Documentation screen with the
**Access topic already open**, not the default first topic.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**35. Deep links open the right topic on load.** Open a topic, copy the URL
(hash should look like `#help=guest:signin`), load it fresh in a new tab.
Confirm that exact topic is selected, not the default.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**36. The `?` shortcut routes by context and never fires while typing.** Press
`?` on the plain homepage → floating overlay. Close, sign in, open the portal,
press `?` → the portal's Help tab. As `testadmin` inside the board, press `?` →
the Documentation screen. Then click into any text field (the help search box
itself, or a lead-form field) and type a literal `?` — confirm it types normally
and opens nothing.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**37. Print / Save as PDF produces a real linked table of contents.** Click
"Print / Save as PDF" and use print preview (or actually save). Confirm the
search box and print button are hidden, **every** topic appears in one flowing
document (not only the open one), and the first page's topic list are real links
that jump to the right section in the saved PDF.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## A6. Sector `active` toggle (new field, live content impact)

`sector.active` was loaded and mapped but never consumed and had no editor
control. It is now filtered in `buildConfig()` and has a checkbox. All four
sectors were deliberately reset to `active: true` first so today's visible
behavior was preserved.

**38. All four sector pillars render on the homepage.** Confirm Education,
Industry, Government, and Community all appear in the pillars and in the mobile
drawer. (Three of them were `active: false` in the data before this fix — if any
is missing, the reset didn't take.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**39. The new checkbox exists and is explained.** As `testadmin` → Admin Board →
SECTORS → any category page. Confirm an "Active (shown in site navigation)"
checkbox exists, with the hint about projects assigned to a deactivated category
not being reassigned automatically.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**40. Deactivating really removes the sector from the site.** Uncheck it on one
sector, Save draft & preview. Confirm that sector disappears from the pillars,
the mobile drawer, and prev/next navigation. Then re-check it, preview again,
confirm it comes back, and **Discard draft** so nothing is published.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## A7. iPhone crash-loop fix — needs a real iPhone

The static `<link rel="spatial-backdrop">` is confirmed gone from the served
HTML and the corrected USDZ filename resolves live, but the actual crash can
only be confirmed on real hardware, and Chromium-based automation could never
reproduce WebKit behavior anyway.

**41. The homepage loads normally on a real iPhone.** Open the site in Safari
on an iPhone. Confirm the loading progress does **not** climb, reset to 0%, and
repeat, and that you never reach Safari's "A problem repeatedly occurred" page.
This is the one test nothing else can substitute for.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**42. The Vision Pro CTA still behaves in desktop Safari.** On macOS Safari,
confirm the hero's Vision Pro button still toggles the step-by-step visionOS
instructions, and nothing about the page load is degraded.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**43. Android and desktop Chrome are unaffected.** Load the homepage on both.
Confirm normal behavior and a clean console.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part B — Public site and guest access

**44. A guest can browse the whole public site.** Signed out: home, all four
sector views, every project card, and every project's descriptive content
(text, images, gallery, evidence). None of that is ever gated.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**45. The homepage twin is public.** "Try a Digital Twin" opens the live
Treedis tour for a signed-out visitor with **no** login prompt.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**46. Public Vimeo videos play for a guest.** Open one of the 9 video-only
projects (e.g. `civic`, `healthcare`, `workplace`). Confirm the video plays for
a signed-out visitor with no gate and no network round trip to `/api/resource`.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**47. A gated experience shows a locked placeholder, not an auto-popped login
form.** As a guest, open a project with a gated Treedis experience (e.g.
`automotive`, `campus`). Confirm the stage shows a clickable "Sign in to view
this experience" tile — **not** a blank pane, and **not** an immediate sign-in
form just from opening the window.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**48. Clicking the placeholder (or "Enter Twin") opens the sign-in form.** Only
an explicit view attempt should prompt.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**49. Dismissing the sign-in form restores the locked tile.** Close the sign-in
form with the X. Confirm you land back on the same clickable "Sign in to
view this…" tile and can retry — not a stage with nothing clickable at all.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**50. Gated links render as gated tiles, not raw `<a href>`.** On `automotive`
and `campus`, confirm the tour links that used to point straight at
`spaces.dtsxr.com` are not readable URLs in the page source for a guest.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**51. Destination is preserved through login.** From test 48, sign in as
`testuser@example.com`. Confirm the **originally requested experience opens
automatically**, rather than dumping you on the home page or the portal.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part C — Server-side leak checks (curl, not the browser)

These cannot be done from the network tab. Run them from a terminal against
`https://dts-website-4cu.pages.dev`.

**52. `js/config.js` hands out exactly one tour URL.**

```
curl -s https://dts-website-4cu.pages.dev/js/config.js | grep -c "spaces.dtsxr.com"
```

Expect **1** (the public homepage tour), not 16. Repeat with `vimeo`. This is
the single easiest check to skip and the one that most completely voids the
gating if it fails — `config.js` is injected dynamically only when `/data`
fails, so it legitimately never appears in a normal page load while remaining
fully fetchable by anyone.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**53. The GIS map document is a stub for the public.**

```
curl -s https://dts-website-4cu.pages.dev/data/gis/maps/iberia-coastal.json
```

Expect only `id`, `title`, `subtitle`, `_type` — **no** `view`, `basemaps`,
`layers`, or `tours`. Also check `DTS_CONFIG.gisMaps` in the browser console for
the same absence.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**54. The map's local layer files are gated independently.**

```
curl -s -o /dev/null -w "%{http_code}\n" \
  https://dts-website-4cu.pages.dev/data/gis/layers/shoreline-1935.geojson
```

Expect **404** — and the same for the other four shorelines and
`parish-boundary.geojson`. This is a **separate** check from test 53: the GIS
engine fetches these by their own relative URL, independent of the map document
and of `DTS_CONFIG` entirely.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**55. A gated tour and feature tour 404 for the public.**

```
curl -s -o /dev/null -w "%{http_code}\n" \
  https://dts-website-4cu.pages.dev/data/gis/tours/cpra-cypremort-point.json
```

Expect **404**, and the same for a `featuretours/` document.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**56. `data/source/` is unreachable through the public route.**

```
curl -s -o /dev/null -w "%{http_code}\n" \
  https://dts-website-4cu.pages.dev/data/source/manifest.json
```

Expect **404**.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**57. Every excluded internal path returns the SPA fallback, not a real file.**
Fetch `/` and note its exact byte size. Then confirm each of these returns
**exactly the same** byte count: `/.env`, `/scripts/seed-dev.mjs`,
`/supabase/config.toml`, `/CLAUDE.md`, `/docs/migration/PROGRESS.md`,
`/docs/WEBSITE-STATE.md`, **`/tools/gis-harvest.mjs`**. Status code alone proves
nothing — Cloudflare Pages returns a real `200` for genuinely missing paths.

> **Known to fail as of 2026-08-10:** `/tools/gis-harvest.mjs` currently returns
> a real 16,886-byte file, not the fallback. `tools/` is in
> `DEPLOY-STAGING.md`'s exclusion list but a later deploy rebuilt staging
> without it. Low severity (no secrets, but internal implementation comments).
> Confirm whether it's still leaking, and fix on the next deploy.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**58. `/data/manifest.json` returns a genuinely different size.** Proof the
R2-backed Function route still works rather than falling through to the SPA
fallback.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**59. Every manifest-listed file actually resolves.** Download
`/data/manifest.json` and fetch each file it lists. **All must return 200.** A
single 404 here rejects `content-loader.js`'s `Promise.all()` and drops *every*
visitor — admins included — to the `js/config.js` fallback. This exact failure
took the whole site down once.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part D — Authentication and accounts

**60. Password sign-in works for all four seeded accounts,** and each lands
where it should: `testadmin` → **Admin Board** (never the portal);
`testorgadmin`, `testmember`, `testuser` → the **client portal** (never the
board).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**61. Session persists across a reload.** Sign in, reload the page. Confirm you
are still signed in. As `testadmin`, confirm a reload shows the floating admin
chip rather than throwing you straight back into the editor — that behavior is
deliberate, so Save draft & preview can actually be previewed.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**62. Sign-out genuinely revokes access.** Open a gated experience while signed
in, then sign out. Confirm the same experience re-locks **without** needing a
manual reload, and that nothing previously resolved is still reachable.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**63. Cross-tab sign-in sync.** Sign in in one tab while a second tab sits on
the sign-in form. Confirm the second tab picks up the session without a manual
reload.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**64. Self-registration (email + password).** Use Create Account with a
throwaway address. Confirm the password-confirmation check works, and that you
get a "check your email" note rather than being pretended-signed-in. Confirm the
confirmation email arrives and signing in then works. **Mind the 2 emails/hour
project-wide cap.**

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**65. Cross-tab confirmation reaches the original tab.** Confirm the sign-up
email in a **different** tab. Confirm the original tab notices and completes
sign-in rather than sitting on the form.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**66. Forgot password.** Request a reset. Confirm the email arrives and the
reset completes. **Known blocked** on the deferred custom-SMTP setup and the
2/hour cap — if nothing arrives, check Supabase → Authentication → Logs and Rate
Limits before calling it a code bug.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**67. OAuth buttons error predictably.** Click "Continue with Google" and
"Continue with Microsoft". A Supabase "provider not enabled" error is the
**expected** result today — confirm it's that, not a crash or a blank page.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**68. The portal's close (X) keeps you signed in.** Click the X next to Sign
out. Confirm the portal closes back to the site and you are **still** signed in.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part E — Resource gating by role

**69. A registered user (no org) opens `registered` resources.** As
`testuser@example.com`, confirm gated Treedis/GIS experiences and links open
normally.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**70. The same user is blocked from `client` and `restricted` resources.**
Confirm a clear explanatory message, not a silent failure and not a partial
view.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**71. An org member reaches `client`-level and their org's `restricted`
resources.** As `testmember@example.com` (Beta Municipal).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**72. Cross-org denial.** The same user attempts a resource restricted to Acme
Hotels. Confirm 403 — not a partial or cached view.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**73. Multi-org membership behaves per-org.** As `testorgadmin@example.com`,
confirm both orgs' resources are reachable, and the org-admin panel appears
**only** for Beta Municipal.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**74. `site_admin` bypasses everything.** As `testadmin@example.com` (zero
memberships, zero entitlements), confirm `client` and `restricted` resources
still open.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**75. An `org_admin` can never reach the Admin Board.** As
`testorgadmin@example.com`, confirm the board never opens under **any** entry
point — sign-in, reload, deep link, or the `?` shortcut.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part F — Client portal

**76. The portal's five/six views all open.** HOME, APPS, Manage, Support, Help
— plus Activity where applicable. Both desktop nav and the mobile menu.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**77. All Apps shows only what the session should see.** Confirm the list and
its count reflect the signed-in user's real resources.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**78. Activity is hidden for a no-org session.** As `testuser@example.com`,
confirm there is **no** Activity link in either the top nav or the mobile menu.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**79. Activity renders a real chart for an org member.** As
`testmember@example.com`, confirm Activity appears and a bar chart renders
(Chart.js loads on demand — give it a moment on first open). With no activity in
the last 30 days, confirm the "No activity recorded… yet" message instead of an
empty chart.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**80. A member never sees another org's activity.** The counts shown to
`testmember` should plausibly be Beta-only, not a suspiciously large combined
number. (Already proven server-side by RLS; this is the visual sanity check.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**81. `testuser` downloads a build via a DIRECT entitlement.** Portal → All
Apps → the "Dummy Viewer (dev)" card. Confirm clicking it triggers a real
browser file save — not a new tab, not an error.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**82. `testorgadmin` reaches the same download via the ORG path.** This account
has no direct entitlement of its own — Acme Hotels holds the org grant. Confirm
the tile appears and downloads successfully.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**83. `testmember` sees the tile but is correctly blocked.** The tile is
*expected* to appear (app metadata is deliberately not access-filtered
client-side). Clicking should show the "You don't have access to this download
yet…" message — not a silent failure and not a corrupted file.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**84. The downloaded file is genuinely correct.** Open the file saved in test
81 or 82. Confirm real content, not empty or corrupted, and the filename matches
what was uploaded.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part G — Admin Board

## Content editing and publishing

**85. Every content editor opens and saves.** Home page, Contact panel, FAQ
answers, Fun facts, each category page, and a project — edit a field in each,
confirm the change sticks in the board.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**86. Add and delete work where they should.** Confirm "+ Add category page" /
"Delete this category page" exist and work, and that deleting a category is
**blocked** while any project still points at it (with a pointer to reassign via
each project's Category dropdown). Confirm add/delete on projects, GIS maps, GIS
tours, and array sub-lists (experiences, links, gallery, FAQ, fun facts, sector
cards).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**87. Publish to site reports a real count.** Make a small edit and click
**Publish to site**. Confirm the message shows a real number of files — not
"Published undefined file(s)."

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**88. A published change is genuinely live.** After test 87, load the public
site in a fresh tab (or curl the relevant `/data` document) and confirm the edit
is really there. Then publish the original value back.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**89. Deleting a document actually removes it from R2.** Delete a throwaway
document (e.g. a test GIS tour you created), publish, and confirm its old
`/data/...` URL now 404s rather than staying fetchable at its guessable path.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**90. Export data folder still works.** Click **Export data folder** and
confirm a real `data.zip` downloads with the expected documents inside. This is
the deliberate escape hatch and must keep working.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**91. Sign out from inside the board really ends the session.** Confirm you are
signed out of Supabase, not just returned to the site.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Organizations, Users, Access, Audit

**92. Organizations: create, rename, disable, delete.** Create a throwaway org,
rename it, disable it (confirm the label reflects the status), then delete it.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**93. Disabling an org really revokes `client` access.** Confirm a member of a
disabled org loses `client`-level access, and regains it on reactivation. (This
was a real bug once — "disable" used to be purely cosmetic.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**94. Users: create, promote/demote, disable/reactivate, delete.** Create a
throwaway user, promote to `site_admin` and back, disable and reactivate, then
delete. Confirm a disabled account genuinely cannot sign in.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**95. The two delete safety rails hold.** Confirm a `site_admin` cannot delete
their **own** account, and that the last remaining `site_admin` cannot be
deleted. (The self-delete block is live-proven; the last-admin block is
code-verified only — don't reduce the dev project to one admin just to test it.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**96. Search-add a user to an org, change their role, remove them.** Through
the Users screen.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**97. The Access screen enumerates every resource_key.** ADMIN → Access.
Confirm project, experience, link, GIS-map, **and** `download.<key>` rows all
appear, each showing its resolved level.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**98. The entitlement picker grants and revokes for real.** On a `restricted`
row, search for an org and a user, grant each, confirm they list with correct
resolved labels (org name / user email, not raw UUIDs), then revoke both.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**99. Access-level editors persist through publish.** Change a project's level,
one experience's level (including `inherit` vs. an explicit override), and the
GIS map's level. Publish. Confirm the live site enforces the new levels.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**100. Inherit vs. override is genuinely per-experience.** Set a project to
`registered` with one experience overridden to `restricted`. Confirm the
overridden one enforces `restricted` while its siblings enforce the project
default.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**101. The Audit screen lists real entries with resolved emails.** ADMIN →
Audit. Confirm past administrative actions appear, newest first, each with a
real actor **email** (not a raw UUID) and a timestamp — including the actions
you just performed in tests 92–99.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Builds

**102. The Builds screen lists the seeded build.** ADMIN → Builds. Confirm
`dummy-viewer-win` appears with its key, platform/version, and a real uploaded
file (not "no file uploaded yet").

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**103. Register, edit, and upload.** Create a throwaway build, change its
name/version/access level and confirm it persists across a board reload (this
writes live to Postgres, no draft step). Upload a small file and confirm the
status shows "Uploaded." with a `file:` path.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**104. Disable, then re-enable.** Confirm the row gets a "— disabled" suffix
and the button flips to "Enable," and back.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**105. "Remove file" clears only the file.** Click it on the throwaway build.
Confirm the build stays listed showing "no file uploaded yet." *(Added after
the Phase 8 pass found this missing; never re-confirmed by clicking the real
button.)*

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**106. "Delete" removes the build entirely.** Confirm the confirm-gate appears,
then that the row disappears from the list. *(Same — API-proven, never clicked.)*

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part H — GIS engine

**107. The map renders for an entitled user.** As `testorgadmin@example.com`,
open the GFC project's map experience and "Full screen map". Confirm the map
loads with its basemap and layers.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**108. The gated local shoreline layers actually appear.** Confirm the
shoreline and parish-boundary layers render — proving the authenticated
`/api/resource/gismap/iberia-coastal/layer/<id>` route works, not just that the
guest path is blocked (test 54).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**109. The live ArcGIS layers load.** Confirm the Iberia Parish / CPRA
service-backed layers render — these come from public government endpoints, not
from R2.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**110. Guided tours run.** Start a guided tour and step through it. Confirm
steps advance, the map moves, and any step media plays.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**111. Feature tours trigger from the map.** Click a feature that has a feature
tour and start it from its popup.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**112. Map tools work.** Layer panel toggles, identify, measure, and the
drawing tools.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**113. Deep-linking into a map state works.** Open a map with a `?…&map=<state>`
URL and confirm the saved state restores.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**114. The Admin Board's Layer editor talks to real services.** In the GIS map
editor, use "Test connection" and "Load fields from service" on a layer.
Confirm they reach the real ArcGIS endpoint (CSP allows any `https:` source
here).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part I — Analytics, consent, and the lead form

**115. First visit shows the cookie banner and stores nothing yet.** In a
private window, confirm the "Help us Improve." banner appears bottom-right and
that `localStorage` has **no** `dtsCookieConsent` key.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**116. Reject stores the choice permanently.** Click Reject. Banner
disappears, `dtsCookieConsent: "rejected"` is stored, and reloading does not
bring it back.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**117. Accept stores the choice.** Fresh private window → Accept. Confirm
`dtsCookieConsent: "accepted"`. No GA4/Clarity script should load either way yet
— both IDs ship placeholder-empty, so this only tests the banner/storage
mechanics.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**118. Instrumented flows are visibly unaffected.** Open a project window,
switch experience tabs, close it. Navigate between sectors. Confirm no console
errors, no UI change, no delay — `/api/track` is fire-and-forget and must never
be visible.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**119. The "Ask a Question" bar still answers.** Type a question matching an
FAQ entry, and separately one that doesn't. Confirm both show the expected
inline answer / fallback.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**120. The Turnstile widget renders and gates the submit button.** Open a lead
form. Confirm the widget renders, and that **Send is disabled** until Turnstile
completes. Close and reopen the form — confirm the widget resets.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**121. A real lead submits successfully.** Fill in and send a lead form.
Confirm the success screen appears and the message actually arrives at the
destination inbox. Repeat for at least a second form type (discovery /
proposal / pilot).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**122. The `mailto:` fallback still works.** Best-effort — there's no clean way
to force a Web3Forms failure without breaking the real key. If you can (e.g. by
blocking `api.web3forms.com` in DevTools), confirm the pre-filled mail client
opens instead of a silent failure.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part J — Standing regression checklist (`CLAUDE.md`)

Run this whole part after any change, and as the final pass here.

**123. Home ↔ each of the four sector views.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**124. One example window per sector.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**125. "Try a Digital Twin" reveal opens and closes — and the tour does NOT
reload.** Check the network tab for a second Treedis iframe request: there must
be none. This is the single-iframe do-not-break rule.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**126. A lead form send, plus the `mailto:` fallback.** (Covered by 121–122;
re-confirm here if anything changed since.)
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**127. Admin sign-in → save draft → preview → discard.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**128. Mobile drawer and sector swipe — and the floating help icon interferes
with neither.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**129. Safari check for the Vision Pro CTA.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**130. Browser back/forward through home → sector → project → close.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**131. Console clean on load and on every overlay** — including the help
overlay, both Help tab/screen variants, the portal, the Admin Board, and the
GIS map.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**132. The hero hexagons render — image, video, and the 3D model.** Confirm the
compressed `ToolBox.glb` still looks acceptable at the hex-4 slot's display
size (its textures were resized 4096→2048; geometry is unchanged, but rendered
quality has never been confirmed by eye).
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**133. An external image URL set through the Admin Board actually loads.** The
CSP was broadened for exactly this. Set a hexagon's image to an external URL and
confirm it renders.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**134. The site is usable at phone, tablet, and desktop widths.** No horizontal
scroll, no dead space, no overlapping fixed elements.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**135. `demo` / `1234` sign-in.** Note: this is **localhost-only by design**
since Phase 2 — on the deployed URL it should correctly fail. Confirm that, and
mark PASS if it behaves as designed.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part K — Email-domain auto org-assignment (added 2026-08-18)

New feature: an admin configures email domains per organization; a brand-new
account whose email matches one is auto-added as a `member`. The DB-level
mechanics (matching, case-insensitivity, disabled-org exclusion, the
cross-org uniqueness conflict, RLS, and the `invite.js` race) are already
**confirmed against the real dev Supabase project via a scripted test
battery** (24/24 assertions passing) — see `docs/CHANGES.md`. Deployed
2026-08-18; the user has since run a first real pass (tests 136, 137-partial,
139, 141 below) directly against the live site — see each item's Comments.

**136. Admin Board: add a domain to an organization.** ADMIN → Organizations
→ open an org's "Email domains" area → add a domain. Confirm it appears in
the list immediately (no draft/publish step — this is a live Postgres
write, same as the rest of this screen).
Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: User added `louisiana.edu` to an organization on the live site;
appeared immediately. 2026-08-18.

**137. Admin Board: edit and remove a domain.** Edit the domain you just
added (change one character, Save), confirm it updates in place, then
remove it.
Result: - [ ] PASS - [ ] FAIL - [x] NOT TESTED (partial — see comment)
Comments: Remove confirmed working (user removed the `louisiana.edu` domain
after finishing the test below). The edit-in-place half (change a
character, Save) was not exercised. 2026-08-18.

**138. Admin Board: adding the same domain to a second org is rejected.**
Add a domain to org A, then try to add the same domain (any case) to org B.
Confirm a clear error, not a raw failure — and confirm org A's domain is
unaffected.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**139. A brand-new self-registered signup with a matching domain lands in
the right org.** Configure a throwaway domain on a throwaway org, then sign
up (email+password) with an address on that domain. After confirming the
account, sign in and confirm the client portal shows membership in that org
(e.g. the Activity tab becomes visible, or the org appears wherever
membership is surfaced).
Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: User created a new account with their own `louisiana.edu` address
against the live site; it was automatically added to the organization the
domain was configured on. Which account-creation path was used (the
self-registration signup form vs. an Admin-Board-created account) wasn't
specified — either exercises the same trigger, so this confirms the
trigger-level mechanism either way; worth re-confirming via the signup form
specifically if that distinction matters later. 2026-08-18.

**140. A signup with a non-matching domain is unaffected.** Sign up with an
address on a domain nothing is configured for. Confirm the account is
created as a plain registered user with no org membership — ordinary
pre-existing behavior, unchanged.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**141. Domain-matched membership actually grants `client`-level access.**
Using the account from test 139, confirm it can open a `client`-level
resource belonging to that org (not just that a membership row exists —
that the access check itself passes).
Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: User confirmed the auto-joined account could download a build
that only that organization's members can access — real end-to-end proof
the access check itself passes, not just that the membership row exists.
Test account and the `louisiana.edu` domain mapping both cleaned up
afterward. 2026-08-18.

**142. Org invite still works normally when the invitee's domain also
matches the org being invited into.** As an org_admin, invite a new email
address whose domain is configured for auto-assignment to that SAME org.
Confirm the invite succeeds (no 500), the account ends up with the `org_role`
you actually selected in the invite (not silently stuck at `member`), and
only one membership row exists for them (check the Users screen — no
duplicate). This is the `invite.js` race the migration's own scripted test
already confirmed at the API level; this is the live/UI confirmation.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**143. The Audit screen shows the domain-management actions.** ADMIN →
Audit. Confirm `org_domain.add`/`org_domain.update`/`org_domain.remove`
entries appear for the actions taken in tests 136–138, each with a real
actor email and the organization involved.
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## When you're done

Report results back with the failures called out specifically — a failing test
number, what you saw, and on which account/browser. **Fixes come in a separate
pass, after real results exist.** Nothing here should be repaired speculatively
before it has actually been run.
