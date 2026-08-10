# In-app documentation (site_admin / org_admin / member / normal user) — Manual Testing

Standalone feature, independent of any numbered migration phase — it does not
block or require `/migrate-handoff`. Everything in this document is genuinely
unverified live: the Chrome browser automation tool was unavailable this
session (extension not connected), so unlike most other phases' testing docs,
**nothing here has been spot-checked by the agent at all** — every item below
is first-hand, not just "not marked passed on your behalf."

What *was* verified without a browser: `node --check` on every new/edited JS
file (`js/help.js`, `js/help-content.js`, `js/app.js`, `js/admin.js`), and a
local `python3 -m http.server 8000` run confirming `js/help.js`,
`js/help-content.js`, and `css/16-help.css` all serve `200` and the edited
`index.html` still serves `200`. That's it — no rendering, no click-through.

Test against **https://dts-website-4cu.pages.dev** (the stable alias) after
redeploying per `docs/migration/DEPLOY-STAGING.md`, not localhost — per the
standing decision from Phase 5's session log. Give the stable alias a few
minutes to catch up after a redeploy.

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

## Floating help icon (normal user — guest + no-org signed-in visitor)

**1. The icon appears on the homepage and doesn't collide with anything.**
Load the homepage. Confirm a small circular "?" icon is visible, fixed near
the bottom-left, clear of the "Ask a Question" bar and clear of the cookie
consent card (bottom-right). This is the one placement claim in this feature
that was calculated from CSS (`--dock-h`), not visually confirmed — check it
carefully, including with the cookie banner still showing.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**2. It opens a help overlay with real content, and closes cleanly.** Click
the icon. Confirm an overlay opens with a search box, a list of topics on the
left, and content on the right (first topic open by default). Close it via
the X button, then reopen and close again via clicking the dimmed backdrop,
then via the Escape key.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**3. It's hidden while a twin, the portal, or the Admin Board is open.**
Open any project's experience — confirm the help icon disappears while the
experience is open, and reappears after closing it. Sign in and confirm it's
hidden behind the portal too (the portal has its own Help tab instead — see
below).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**4. The one-time hint appears on first visit and never again.** In a private/
incognito window (or after clearing `localStorage`), confirm the icon shows a
small pulsing badge and a "Need help?" tooltip. Click the icon — confirm the
badge is gone. Reload the page — confirm it stays gone (`localStorage` should
now have a `dtsHelpHintSeen` key; the two protected keys,
`dtsAdminDraft`/`dtsAdminSession`, should be untouched).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**5. Search actually filters topics.** Open the help icon, type a word that
appears in only one topic (e.g. "cookie"). Confirm the topic list narrows to
matching topics only. Clear the search — confirm the full list returns.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Client portal — Help tab (org_admin / member)

**6. Every signed-in portal session sees a Help tab, even with no
organization.** Sign in as `testuser@example.com` (registered, no org).
Confirm "Help" appears in the portal's top nav and the mobile menu (unlike
Activity, which stays hidden for this account).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**7. A plain member sees member-scoped content only, no team-management
topics.** Sign in as `testmember@example.com` (member of Beta Municipal, not
an org admin there). Open Help — confirm topics cover the portal (All Apps,
Activity, Support, account) but nothing about inviting/removing members or
role toggles.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**8. An org_admin sees member content PLUS team-management topics layered
on top — not a separate, disconnected screen.** Sign in as
`testorgadmin@example.com`. Open Help — confirm the same member topics from
test 7 are still there, plus additional topics about adding/inviting/removing
members and the role toggle (including the small inline diagram).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Admin Board — Documentation screen (site_admin)

**9. The screen is reachable and covers every real screen in the board.**
Sign in as `testadmin@example.com` → Admin Board → HELP → Documentation.
Confirm topics exist for Home/Contact/FAQ/Fun facts, Category pages,
Projects, GIS maps & tours, Organizations, Users, Builds, Access, and Audit,
plus the Save Draft/Preview/Discard/Publish/Export workflow.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**10. The Access topic's diagram renders and is legible.** Open the "Access
levels & entitlements" topic — confirm the four-box public → registered →
client → restricted diagram renders with visible arrows, in both light and
dark OS theme if easy to check.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**11. The entitlement picker's "?" hint jumps straight to the Access
topic.** Go to any project's Access section, find the entitlement picker
("Who has access"), click the small "?" next to its label. Confirm it
navigates to the Documentation screen with the Access topic already open
(not just the screen's default first topic).

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Cross-cutting interactivity

**12. Deep link opens the right topic on load.** From the floating icon (or
any mounted guide), open a topic, copy the resulting URL (its hash should
look like `#help=guest:signin` or similar), then load that URL fresh in a new
tab. Confirm the guide opens with that exact topic already selected, not the
default first one.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**13. The `?` keyboard shortcut opens the right guide for the context
you're in, and never fires while typing.** Press `?` on the plain homepage —
confirm the floating overlay opens. Close it, sign in, open the portal, press
`?` — confirm the portal's Help tab opens instead. As `testadmin`, inside the
Admin Board, press `?` — confirm the Documentation screen opens. Then click
into any text field anywhere (e.g. the search box itself, or a lead form
field) and type a literal `?` character — confirm it types normally and does
NOT open anything.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**14. Print / Save as PDF produces a real, linked table of contents.** Open
any of the three guides, click "Print / Save as PDF", and use the browser's
print preview (or actually save as PDF). Confirm: the search box and print
button are hidden in the output, every topic appears in one flowing document
(not just the currently-open one), and the first page's topic list are real
links that jump to the right section when clicked in the saved PDF.

Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Full regression (CLAUDE.md's own checklist, one final pass)

**15. Home ↔ each of the four sector views.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**16. One example window per sector; the tour must not reload.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**17. A lead form send, plus the mailto fallback.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**18. Sign-in with `demo` / `1234`; Admin sign-in → save draft → preview →
discard.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**19. Mobile drawer and sector swipe — confirm the floating help icon does
not interfere with either.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**20. Browser back/forward through home → sector → project → close.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**21. Console clean on load and on every overlay, including opening/closing
the new help overlay and both Help tab/screen variants.**
Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________
