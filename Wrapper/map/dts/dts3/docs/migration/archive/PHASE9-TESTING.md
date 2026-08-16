# Phase 9 — Analytics, Events, Audit, Marketing Tags — Manual Testing

Everything gating/security-relevant has already been confirmed by scripted
checks against the real dev Supabase project and the real deployed
Cloudflare Pages site — see `docs/migration/PROGRESS.md`'s Phase 9 session
log entry for exactly what ran (23 assertions total: 8 adversarial RLS
checks for `events`/`admin_audit`, 15 live checks against
`/api/track`/`/api/admin/audit`). This document only covers what a script
can't show: real browser click-through, whether the chart actually renders,
and how it *looks*.

Test against **https://dts-website-4cu.pages.dev** (the stable alias), not
localhost — per the standing decision from Phase 5's session log. Give the
stable alias a few minutes to catch up to the latest deploy if you test
right after a redeploy.

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

## Cookie consent banner (fixed this phase — used to be cosmetic)

**1. First visit (or after clearing `localStorage`), the banner appears
and Accept/Reject now actually do different things.** Open the site in a
private/incognito window. Confirm the "Help us Improve." banner appears
bottom-right. Open DevTools → Application → Local Storage — confirm there is
**no** `dtsCookieConsent` key yet.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**2. Clicking Reject hides the banner and stores the choice, permanently.**
Click Reject. Confirm the banner disappears. Confirm `localStorage` now has
`dtsCookieConsent: "rejected"`. Reload the page — confirm the banner does
**not** reappear.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**3. Clicking Accept hides the banner and stores the choice.** Clear
`localStorage` (or open a fresh private window) to see the banner again,
then click Accept. Confirm `dtsCookieConsent: "accepted"` is stored. Since
`js/analytics-init.js` currently ships with placeholder-empty GA4/Clarity
IDs, no actual tracking script should load either way yet — this test is
only confirming the banner/storage mechanics work, not that GA4/Clarity
fire (there's nothing to fire until real IDs are added — see
`docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md` §8).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Client portal — Activity dashboard tile

**4. The Activity tab is hidden for a user with no organization.** Sign in
as `testuser@example.com` (registered, no org membership). Confirm there is
**no** "Activity" link in the portal's top nav or the mobile menu.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5. The Activity tab appears and renders a real chart for an org
member.** Sign in as `testmember@example.com` (member of Beta Municipal
only). Confirm "Activity" appears in the nav. Click it — confirm a bar
chart renders (Chart.js loads on demand; give it a moment on first open).
If there's been no real activity in the last 30 days, confirm it shows the
"No activity recorded... yet" message instead of an empty chart.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**6. A member never sees another organization's activity.** This is the
core security property — already proven server-side via RLS in the
scripted adversarial check (`testmember` got exactly Beta's rows, never
Acme's), but worth a visual sanity check: the counts shown to
`testmember` should plausibly be Beta-only activity, not a suspiciously
large/combined number.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Admin Board — Audit screen

**7. The Audit screen is reachable and lists real entries.** Sign in as
`testadmin@example.com` → Admin Board → ADMIN → Audit. Confirm a list of
past administrative actions appears (organization/user changes, entitlement
grants, etc. from earlier phases' own testing), most recent first, each
with a real actor email (not a raw UUID) and a timestamp.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Event instrumentation — spot checks

These don't need any special verification tooling — just do the thing and
trust that `/api/track` fired (already proven at the network-call level by
the scripted checks). This is really about confirming nothing *visibly*
broke — no console errors, no UI change, no delay.

**8. Opening a project window, switching experience tabs, and closing the
window all still work exactly as before, with no console errors.** Open
any project with 2+ experience tabs (e.g. `gfc`), switch tabs, close the
window. Check the browser console — should be clean (matches the
project's own standing regression rule: "Console clean on load and on
every overlay").

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**9. The homepage "Try a Digital Twin" reveal still opens/closes
normally, and the tour does not reload.** This is the one call site this
phase added inside `js/tour-bridge.js`'s territory (an `onReady` hook, not
a protocol change) — confirm the do-not-break rule still holds.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**10. A lead form submission (and separately, the mailto fallback) still
work.** Submit the lead form normally — confirm the success screen
appears. No easy way to trigger the fallback path deliberately without
breaking the real key, so this is optional/best-effort.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**11. The "Ask a Question" bar still answers questions normally.** Type a
question that matches an FAQ entry, and separately one that doesn't.
Confirm both still show the expected inline answer / fallback message.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Full regression (README checklist, one final pass)

**12. Home ↔ each of the four sector views.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**13. One example window per sector.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**14. Sign-in with each seeded dummy account, mobile drawer, sector
swipe, browser back/forward through home → sector → project → close.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________
