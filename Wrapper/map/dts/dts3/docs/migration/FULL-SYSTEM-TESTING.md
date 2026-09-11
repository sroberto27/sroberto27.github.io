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

# Part L — Memory/network performance audit fixes (added 2026-09-05)

New, from the 2026-09-05 memory-and-network audit and its fix session (see
`docs/migration/PROGRESS.md`'s 2026-09-05 entry for the full finding list).
Every item below is real, shipped code whose behavior has **never been
observed in a real browser** — the same "treat a failure as expected-possible,
not surprising" caveat as Part A. Two small, purely non-functional changes from
the same session aren't listed as their own tests because there's nothing a
human can observe differently: scripts now fetch in parallel instead of one at
a time (same execution order), and four `<link rel="preconnect">` hints were
added for hosts already being contacted. If the site boots and behaves
normally through the rest of this document, those two are fine.

## Background image scoping (logBackground.png → .jpg)

**144. The sign-in modal's background artwork loads only when opened, and
still looks right.** Open DevTools → Network, filter for "logBackground",
then load the homepage fresh. Confirm **zero** requests for it. Now click
**ACCESS YOUR TWIN**. Confirm exactly one request fires (a ~39KB `.jpg`, not
the old ~7.7MB `.png`) and the teal→purple gradient artwork renders correctly
behind the CubeLogo/wordmark, with no layout shift or missing-image icon.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## GIS Timeline + suspend/resume

**145. Starting the Timeline, then leaving the map without pausing it,
doesn't leave it running.** Open the GFC project's map, open the **Timeline**
tool, click **Play** (steps through 1930s → Late 1940s → Late 1990s → 2008 →
2015 on the shoreline layers) — then, **without clicking Pause**, close the
project window. Reopen the same map. Confirm the Timeline shows its normal
paused/reset state, not still auto-advancing or stuck on whatever step it
was mid-animation on. (Fixes a real gap: `suspend()`, used when a map is
backgrounded rather than fully closed, didn't stop the Timeline's own
interval before this fix.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Gated GIS map resolve + progressive layer loading

**146. A gated GIS map still opens correctly, and reasonably promptly.** As
`testorgadmin@example.com`, open the GFC project's map experience. Confirm it
resolves and opens normally — this endpoint's tour/feature-tour lookups were
changed from sequential to parallel R2 reads server-side; a functional
regression here would show as a slow resolve, an error, or missing
tours/feature-tours, not a crash.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**147. The map becomes usable before the shoreline/boundary layers finish
loading, and they still appear correctly a moment later.** Open the same map
on a throttled connection (DevTools → Network → "Slow 4G"). Confirm the
basemap and ArcGIS-backed layers appear and the map is pannable/zoomable
promptly, and that the shoreline/parish-boundary layers (deferred to idle
time) still show up correctly shortly after — not stuck in "loading"
indefinitely, and not silently missing.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Home hero 3D models (texture compression)

**148. Both hero 3D models still look acceptable, and the hex boxes don't
flash a stray placeholder photo first.** Load the homepage fresh. Confirm the
hex-2 slot's **Buildings.glb** model (textures resized, same as the
already-shipped `ToolBox.glb` at hex-4 — see test 132) still looks
acceptable at its actual display size — this is the one thing a code read
can't confirm, texture resolution was measurably nearly-quartered. Also
confirm neither hex-2 nor hex-4 briefly shows an unrelated stock photo before
the 3D model mounts (their old placeholder images were removed; they should
now just be a plain dark tile for the brief gap before the model loads).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Network-stall timeouts (lead form, sign-in, content boot)

These need a way to simulate a connection that **stalls** rather than fails
outright — DevTools → Network → right-click the relevant request → "Block
request URL" *after* it's already left the browser doesn't work for this;
use Network throttling set to a custom profile with very low throughput, or
block the domain at the OS/hosts level so the request hangs rather than
getting an immediate connection-refused. All three should recover within
~15 seconds, not hang indefinitely.

**149. The lead form falls back to `mailto:` on a stall, not just an outright
failure.** Block/throttle `api.web3forms.com` so a submit attempt stalls.
Submit a lead form. Confirm that within ~15 seconds the form gives up and
opens the pre-filled `mailto:` fallback, rather than leaving the button
reading "Sending…" forever.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**150. Sign-in recovers from a stalled request instead of hanging on
"Checking…" forever.** Block/throttle Supabase's auth endpoint, then attempt
to sign in. Confirm within ~15 seconds the button re-enables and a
"That's taking too long — check your connection and try again" message
appears, rather than the button staying disabled indefinitely.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**151. A stalled (not just failed) `/data` fetch still falls back to
`js/config.js` instead of leaving the site blank.** Block/throttle
`/data/manifest.json` on a fresh load. Confirm the site still boots — via the
`js/config.js` fallback, same as an outright failure already did before this
fix — instead of sitting on the intro loader forever.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Admin Board / GIS CSS now load dynamically, not statically

`css/13-admin.css` and `css/15-gis.css` were moved out of the page's static
`<head>` list and are now injected by JS the first time each feature is
actually needed. The risk here is exactly the kind of thing code-reading
can't fully rule out: a real flash of unstyled content if the CSS doesn't
arrive before the DOM it styles is shown.

**152. The Admin Board is fully styled the FIRST time it's ever opened on a
brand-new browser profile (no prior admin flag).** In a fresh private
window, go straight to the homepage (no `?admin`/`#admin`), click **ACCESS
YOUR TWIN**, and sign in as `testadmin@example.com`. Confirm the board opens
correctly styled from the first frame — no unstyled/plain-HTML flash, no
missing layout. (This is the click-triggered preload path,
`ensureAdminBundle()` — the one most likely to be missed by a CSS-loading
fix, since it fires before this browser is known to be an admin context at
all.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**153. The Admin Board is still fully styled via the `?admin`/returning-admin
path.** Load the homepage with `?admin` in the URL (or on a browser that's
already signed in as admin before), sign in, confirm the board again opens
fully styled — this is the OTHER of the two places admin CSS gets injected
from.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**154. The GIS map is fully styled the first time it's opened in a session.**
Open any GIS-map project experience. Confirm the map, its panel/toolbar
chrome, and the Timeline/Layers panels all render with their real styling
from the moment they appear — no unstyled flash.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**155. The floating "?" help icon still works normally now that its scripts
load with `defer`.** Re-run tests 22–25 (icon appears correctly positioned,
overlay opens/closes, first-visit hint). A regression here would most likely
show as the icon appearing in the wrong position briefly, or the click
handler not being wired up yet on a very fast click right after load.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Admin user-directory cache

**156. Creating, then immediately viewing, a user doesn't show stale data.**
As `testadmin`, create a throwaway user (Admin Board → Users → create). Within
the same minute, without reloading, check that the new user is immediately
findable in a **different** admin screen that also lists users — e.g. the
Access screen's entitlement-picker search, or Organizations' "add existing
user" search. Confirm it appears right away, not only after the ~30-second
cache window elapses. Then delete the throwaway user and confirm it
disappears from that same search immediately too.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part M — security audit fixes (2026-09-06)

From the `app`-scope audit in `SECURITY-AUDIT-2026-09-06.md`. **These need a
republish before any of Part M can be tested**: the link fix runs at publish
time, so `data/current/` in R2 is unchanged until a `site_admin` uses the
Admin Board's "Publish to site". Test 157 checks exactly that.

## Link access levels (F-01)

The splitter used to strip a link's URL only when its `kind` was `"treedis"`,
so the access picker did nothing on Vimeo/Matterport/external links. It now
keys on the access level alone, and the 29 links that were public by
convention now say `"access": "public"` in `/data`.

**157. Publish, then confirm the public documents are unchanged for guests.**
As `testadmin`, open the Admin Board and use "Publish to site". Then, in a
**private/logged-out window**, open a project with videos (Campus & Schools,
Economic Development, Energy). Confirm the "More from this project" chips are
still ordinary clickable links that open the video — *not* locked tiles. This
is the regression that matters: the fix is supposed to change nothing a
visitor sees.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**158. Gated Treedis links are still locked for a guest.** Same logged-out
window, open Automotive and Campus & Schools. Their Treedis tour chips must
still render as locked tiles, and the main tour experience must still show
"Sign in to view this experience".

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**159. A newly added link defaults to gated, and the editor says so.** As
`testadmin`, add a link to any project (Admin Board → PROJECTS → a project →
Related links → "+ Add link"). Confirm its Access level shows "Inherit from
project" and the hint text explains that Inherit resolves to Registered and
withholds the URL. Set it to **Public**, publish, and confirm a logged-out
visitor can see and click it. Then delete the test link and publish again.
*This is a real behavior change:* before this fix a new external link was
silently public.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**160. A link marked Registered is genuinely withheld.** Set one Vimeo link on
a test project to **Registered**, publish, and confirm in a logged-out window
that it renders as a locked tile with no URL in the page source (view source
and search for the vimeo.com URL — it must be absent). Sign in as
`testuser@example.com` and confirm the tile now resolves and opens. Put it
back to Public and publish.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## CMS text escaping (F-02)

The sector kicker and the use-case card title/text reached `innerHTML`
unescaped.

**161. Sector pages and the mobile drawer render normally.** Visit each of the
four sector views on desktop and confirm the four use-case cards show their
real titles (upper-cased) and body text. Open the mobile drawer on a phone or
a narrow window and confirm each sector's kicker reads correctly. Nothing
should look double-escaped — no stray `&amp;` or `&#39;` on screen.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**162. A sector kicker containing an apostrophe or ampersand still reads
correctly.** As `testadmin`, temporarily set a sector's kicker to something
like `Health & Safety's Twin`, publish, and confirm it renders as typed on the
category page and in the mobile drawer — not as `Health &amp; Safety&#39;s`.
Restore the original value and publish.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Invite rate-limit ledger (F-03)

The `invite.send` audit row is now written before the account it counts, and
strictly rather than best-effort.

**163. Inviting a new teammate still works end to end.** Sign in as
`testorgadmin@example.com`, open the client portal's team panel for Beta
Municipal, and invite a brand-new throwaway email with a temporary password.
Confirm the member appears in the list. Then sign in as `testadmin`, open
Admin Board → Audit, and confirm exactly **one** `invite.send` row exists for
it, with the new account's id in its target — not a blank target, and not two
rows.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**164. A rejected invite leaves no audit row.** As `testorgadmin`, try to
invite an email that already exists (`testmember@example.com`). Expect a clear
"already exists" error. Then check Admin Board → Audit and confirm **no** new
`invite.send` row was created for that attempt. Delete the throwaway account
from test 163 when finished.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## GIS map resolver connection limit (2026-09-06 outage)

`gismap.iberia-coastal` returned 500 to everyone for ~15 hours because the
resolver held 27 R2 bodies open at once, past Workers' limit of 6. Now read 4
at a time. **This is the highest-value test in Part M** — it was a total
feature outage that no automated check caught before it shipped.

**165. The GFC map actually opens for a signed-in user.** Sign in as
`testuser@example.com` (a plain registered account — the map is `registered`,
so this is the lowest privilege that should work). Open the GFC project and its
map experience. Confirm the map renders with its layers, not an error or a
spinner that never resolves. Check the browser console is clean and that
`/api/resource/gismap.iberia-coastal` returns 200 in the network tab, not 500.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**166. Guided tours and feature tours on that map still work.** These are the
27 documents the resolver reads. Start a guided tour, step through it, and open
a feature that has a feature tour attached. If the concurrency cap were wrong,
the symptom would be missing tours rather than a hard error — a map that opens
with an empty tour list is a FAIL here, not a pass.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**167. A signed-out visitor gets the sign-in gate, not an error.** In a
private window, open the GFC project's map. Expect the locked placeholder and
the sign-in prompt. Visiting
`/api/resource/gismap.iberia-coastal` directly should show
`{"error":"sign-in required"}` — if it shows `{"error":"resolution failed"}`
the outage is back.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

# Part N — Portfolio content migration (2026-09-07)

The whole public portfolio was replaced: **17 projects across 4 sectors became
8, exactly 2 per sector.** Every project document, every sector's copy and
cards, and `js/config.js` were rewritten; 14 project documents were deleted.

**Partly confirmed in a browser as of 2026-09-11 — read the distinction.**
In a developer smoke pass (informal browsing, not this checklist run step by
step), the owner confirmed working: **178, 179** (the tour does not reload on a
stage-tab switch, and there is still exactly one Treedis iframe), **180–183**
(the GIS map draws all 17 layers from its new home on Iberia Parish, guided and
feature tours run, a guest gets the gate), **186–191** (the Admin Board shows
and edits the new content, the GIS node included), and **194** (console clean).

Those were the highest-risk items in this Part and the ones nothing but a
browser could settle. The boxes below are deliberately left unticked: a smoke
pass is not the same as running each test as written, and only the person who
ran it should tick them.

**Still unconfirmed:** 168–171 (the counts, and that a deleted project is
neither reachable nor an ugly failure on a deep link — you would have to go
looking for a dead URL to hit these), 172–173 (the two desktop layout
regressions from the 4→2 card change), 175–177 (the guest-versus-signed-in
split, which needs a private window), 184–185 (all 33 images, and that Shell
and Honeywell show four rather than the five each supplied), 192–193 (mobile
drawer and swipe, browser back/forward), 195 (the home page untouched).

Note what 175–177 does and does not carry: gating **enforcement** is already
proven without a browser — the F-01 probe reports 0 gated links leaking, and
anonymous resolves of `gismap.iberia-coastal`, `project.gfc:map` and
`project.gfc:tour` return 401 live while deleted keys return 404. What is
unconfirmed there is whether the locked state *renders* well, not whether it
holds.

What was confirmed without a browser, before any of the above: all 6 automated
test files pass, the real `content-loader.js` produces the correct
`DTS_CONFIG` from the new `/data`, all 33 supplied images resolve case-exact
on disk, all 8 Vimeo URLs return real embeddable videos via Vimeo's oEmbed API,
and all 4 Treedis URLs return 200. That is file- and API-level confidence only
— it says nothing about what renders.

The expected portfolio, for reference while testing:

| Category | Card 1 | Card 2 |
|---|---|---|
| Education | BRCC Film Production Orientation | Louisiana Solar Energy Lab Digital Twin |
| Industry | Shell - Permian Basin Assessment Training | Automotive Dealership Digital Twin |
| Government | Sanitarian Training Enhancement | Advanced Manufacturing Training Demo |
| Community | Downtown Lafayette | Iberia Parish Clean Energy Hub Digital Twin |

## Structure — the counts have to be exactly right

**168. Four categories, two cards each, and nothing else.** Walk all four
sector pages. Each must show **exactly two** cards, matching the table above.
A third card, a card with an old name ("Campus & Schools", "Civic Services",
"Energy & Manufacturing", "Cultural & Heritage"…), or an empty slot is a FAIL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**169. Every card opens its own project.** Click all 8 cards. Each must open
the project named on it — check the window's title line, not just that
*something* opened. A card opening the wrong project is a FAIL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**170. No obsolete project is reachable by normal navigation.** In each sector,
open the bottom dock tabs and the "More from {Sector}" rail inside an open
project. Every destination must be one of the 8. There should be exactly one
"More from this sector" card per project (each sector has only one *other*
project now) — zero cards, or a card naming a deleted project, is a FAIL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**171. A deep link to a deleted project degrades gracefully.** Open
`?category=education&project=campus` directly. Expect the Education category
page with no project window and **no console error**. A blank overlay, a stuck
loading spinner, or a thrown exception is a FAIL. (`campus` was deleted; the
URL validator is supposed to drop it.)

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Layout — both fixed regressions from the 4→2 card change

**172. The desktop "VIEW {SECTOR} PROJECTS" sheet lays out two cards
properly.** On a desktop-width window, open each sector's projects sheet. Two
cards should sit side by side and fill the row. The old mosaic pinned cards to
four named grid areas, so the failure mode is a half-empty sheet with a large
gap on the right — that is a FAIL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**173. Category cards are not absurdly tall.** On a desktop-width window, look
at each sector's two use-case cards. They should size to their content and sit
at the top of the cards area, not stretch to fill the full height with a short
paragraph floating in a tall empty box.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**174. The projects sheet shows each project's real capture and platform.**
In the sheet from test 172, read the "Captured with:" and "Platform:" chips.
They must vary per project and match the project window's own chips — e.g.
Sanitarian Training shows Unity VR/PC, BRCC shows interactive 3D. If every card
still says "Matterport Pro2 / Treedis", the fix did not take: FAIL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Experiences — the public/gated split per the content forms

**175. Every project's showcase video plays for a signed-out visitor.** In a
private window, open all 8 projects. Each opens on its video tab and the Vimeo
player must actually load and play — no sign-in prompt, no locked tile. This is
the whole point of those videos being `public`.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**176. The four gated Treedis tours are locked for a guest.** Same private
window. Solar, Automotive, Downtown Lafayette and Iberia Parish each have a
second stage tab. Each must show the locked placeholder and the sign-in prompt,
not a tour and not an error.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**177. Those tours open after signing in.** As `testuser@example.com`, open all
four and confirm each tour actually loads. **Downtown Lafayette is the one to
watch**: its URL is the content form's `my.treedis.com` link verbatim,
including a `?s=…` share token and an `x`/`y` opening pose — a different host
from every other tour on the site. If it fails to load, the share token having
expired is the first thing to check.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**178. Switching stage tabs does not reload the Treedis tour.** Open Iberia
Parish signed in. It has three tabs (video, tour, GIS map). Move to the tour,
then to the video, then back to the tour. The tour must still be where you left
it, not re-loading from the start.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**179. Still exactly one Treedis iframe.** With Iberia Parish open and its tour
tab active, run in DevTools:
`document.querySelectorAll('iframe[src*="treedis"],iframe[src*="dtsxr"]').length`.
Note the number, switch tabs a few times, and run it again. It must not grow.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## The GIS map — this is the migration's highest-risk claim

The map moved from the old GFC project to the new Iberia Parish project. The
project **id** (`gfc`) and the GIS experience node were deliberately kept
byte-identical, and no file in `js/gis/`, `data/gis/`, `vendor/leaflet/` or
`css/15-gis.css` was edited. These tests exist to prove that held.

**180. The map opens from its new home.** Signed in, open **Community → Iberia
Parish Clean Energy Hub Digital Twin** and select the **GIS Map** tab. The map
must load with its layers drawn. Note that the map lives under Community now,
not Government.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**181. All 17 layers, the basemap switcher, and the tools behave as before.**
Toggle layers on and off, switch basemaps, and exercise the tool UIs (query,
table, measure, share). Anything that worked before this migration must still
work. This is a "nothing changed" test — treat any difference as a FAIL and say
what differed.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**182. Guided tours and feature tours still run.** Start a guided tour and step
through it, then click a feature that has a feature tour attached. A map that
opens with an empty tour list is a FAIL, not a pass — the tours are matched to
the map by `mapId`, and 14 tours + 13 feature tours should be reachable.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**183. A guest gets the gate, not an error.** In a private window, open the
Iberia Parish project's GIS Map tab. Expect the locked placeholder and the
sign-in prompt. `/api/resource/gismap.iberia-coastal` must still return
`{"error":"sign-in required"}`, and `/api/resource/project.gfc%3Amap` must too
— **not** `{"error":"resolution failed"}` and not `404`. A 404 there would mean
the project id changed, which would orphan the seeded entitlement.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Images

**184. All 33 gallery images load, on all 8 projects.** Open each project and
check its "Photos and Video" strip with the network panel open. No 404s. The
filenames contain spaces and some have irregular hyphens
(`Edu - BRCC -04.webp`, `Gov - Honeywell -03.webp`, folder `Edu- Sola`) — those
are correct as supplied, but they are exactly where a path bug would show.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**185. Shell and Honeywell show four images, not five.** Both supply five; the
renderer caps at four by design (owner's call — the fifth stays authored in
`/data` so an editor can reorder). Confirm four render cleanly with no broken
tile or gap where a fifth would be.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Admin Board

**186. The board shows 4 sectors and 8 projects — and nothing deleted.**
As `testadmin`, open the Admin Board. The SECTORS group must list exactly the
four sectors with two projects nested under each, and there must be **no
"Unassigned" group** and no old project anywhere. If you see old projects,
discard any saved draft (a stale `dtsAdminDraft` in localStorage holds the old
content) and reload before calling it a FAIL.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**187. A project's new content is fully editable.** Open any project and
confirm every field from the content form is present and editable: title,
tagline, overview, client name, status, description, capture method, platform,
the experiences list (with per-experience access levels), gallery images with
captions, and all five evidence fields.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**188. The GIS experience still edits correctly.** Open Iberia Parish →
experiences → the GIS item. Its map picker must show `iberia-coastal` selected
and its tour picker `iberia-coastal-intro`, with **no mismatch warning**.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**189. GIS MAPS group is untouched.** Confirm the GIS MAPS nav group still
shows `iberia-coastal` with its tours nested beneath, exactly as before.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**190. Draft → preview → discard still round-trips.** Edit a project title,
save draft, preview (the site should show the edit), then discard and reload
(the edit should be gone).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**191. Publish to site, then re-check a guest.** Use "Publish to site". Then in
a private window confirm the 8 projects still render, the public videos still
play, and the gated tours are still locked. Publishing is what deletes the 14
removed documents from R2 — the CLI upload path does not.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

## Regression sweep

**192. Mobile.** On a phone: the drawer lists the four sectors, sector swipe
works, each sector shows its two cards, and a project opens and scrolls. Dock
tab labels use the short names (BRCC Film, Solar Lab, Shell Permian,
Dealership, Sanitarian, Adv. Manufacturing, Downtown Lafayette, Iberia Parish).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**193. Browser back / forward.** Home → a sector → a project → close, then walk
back and forward through the whole chain. Each step must land where it did
before the migration.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**194. Console clean.** With DevTools open, load the site and open every
sector, every project, every stage tab, the projects sheet, the lead form and
the portal. No errors, no 404s. `[dts] no example for …` in particular means a
card is pointing at a project that no longer exists.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**195. Home page and the rest of the site are untouched.** The hero, hex
cluster, "Try a Digital Twin" reveal (the tour must not reload), FAQ, fun
facts, contact panel, a lead form send, sign-in and the client portal should
all behave exactly as before — none of them were part of this migration, so any
change here is an unintended side effect.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## When you're done

Report results back with the failures called out specifically — a failing test
number, what you saw, and on which account/browser. **Fixes come in a separate
pass, after real results exist.** Nothing here should be repaired speculatively
before it has actually been run.
