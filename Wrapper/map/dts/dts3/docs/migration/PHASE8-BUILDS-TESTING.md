# Phase 8 — Builds — Manual Testing

Everything gating-related (entitled/non-entitled/disabled/site_admin-bypass/
public-access, plus every new admin API route) has already been confirmed by
a scripted end-to-end pass against the real deployed site — see
`docs/migration/PROGRESS.md`'s Phase 8 session log entry for exactly what ran
and what it proved. This document only covers what a script can't show: real
browser click-through, a real file actually landing on disk, and how it
*looks*.

Test against **https://dts-website-4cu.pages.dev** (the stable alias), not
localhost — per the standing decision recorded in PROGRESS.md's Phase 5
session log to test the deployed Cloudflare URL going forward.

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

## Admin Board — Builds screen

**1. The Builds screen is reachable.** Sign in as `testadmin@example.com` →
Admin Board → ADMIN → Builds. Confirm the existing `dummy-viewer-win` app
appears, showing its key, platform/version, and "no file uploaded yet" is
NOT shown (a real dummy build was seeded and uploaded this phase).

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**2. Register a new build.** Under "New build," create one with a throwaway
key (e.g. `test-browser-app`), a name, and a platform. Confirm it appears in
the list immediately after creating it.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**3. Edit metadata.** On the app from test 2, change its name/version and
access level dropdown, click Save. Reload the Admin Board and confirm the
change persisted (this writes live to Postgres, not the draft/publish
pipeline — no "Save draft & preview" step needed).

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**4. Upload a real file.** On the same app, choose a small file with the
file picker and click "Upload file." Confirm the status shows "Uploaded."
and the row's hint text now shows a `file:` path.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: It passed but something that i did not see was a way to delete a file, also a way to delete a build.

**5. Restricted apps show the entitlement picker.** Set the test app's
access level to Restricted and confirm the "Who has access" picker appears
on its row, and that granting/revoking an org or user there works the same
way it already does for a Restricted project experience.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**6. Disable, then re-enable.** Click "Disable" on the test app, confirm the
row's title gets a "— disabled" suffix and the button now reads "Enable."
Click it again to re-enable.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**7. The Access screen also lists downloads.** ADMIN → Access. Confirm a
"Download — <name>" row appears for every registered build alongside the
existing project/GIS-map rows, showing its resolved level and
`download.<key>` resource_key.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**8. Clean up.** Delete/disable the throwaway `test-browser-app` you created
in test 2 (there's no delete button by design — Disable is the closest
equivalent, matching Organizations/Users' own "disable, never delete"
convention; leaving it disabled is fine).

Result: - [ ] PASS - [x] FAIL - [ ] NOT TESTED
Comments: there should be also a delete button. keeping the disable.

> **Fixed same session, redeployed (`101ac885...`), re-verified scripted
> end-to-end (see PROGRESS.md) — NOT yet re-confirmed by clicking the actual
> button in a browser.** A real "Delete" button now exists next to Disable
> on each build (confirm-gated, removes the row + its R2 file + any
> `download.<key>` entitlement grants), plus a "Remove file" button (shown
> only when a file is uploaded) that clears just the file and keeps the
> build registered. If you get a chance: retest 8 for real — register a
> throwaway build, upload a file, click "Remove file" and confirm the build
> stays listed with "no file uploaded yet", then click "Delete" and confirm
> the row disappears entirely.
>
> Result: - [ ] PASS - [ ] FAIL - [ ] NOT TESTED
> Comments: ____________________________________

---

## Client portal — Download tile

**9. `testuser` sees the download and it actually saves a file.** Sign out,
sign in as `testuser@example.com` (has a DIRECT entitlement to
`download.dummy-viewer-win`). Open the portal → All Apps. Confirm a card
for "Dummy Viewer (dev)" appears with a "Download" label and clicking it
triggers a real browser file save (not a new tab, not an error).

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**10. `testorgadmin` reaches the SAME download via the ORG path.** Sign in
as `testorgadmin@example.com` (member of `acme-hotels`, which holds the org
grant — this account has no direct entitlement of its own). Confirm the same
download tile appears and downloads successfully.

Result: - [X] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**11. `testmember` sees the tile but is correctly blocked.** Sign in as
`testmember@example.com` (member of `beta-municipal` only, no grant either
way). The download tile is expected to still APPEAR in the list (app
metadata is intentionally not access-filtered client-side — see
ACCESS-MODEL.md's "never trust a client-computed decision" principle) but
clicking it should show the existing "You don't have access to this download
yet. Ask your DTS contact for access." alert, not a silent failure or a
corrupted file download.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

**12. Downloaded file is genuinely correct.** For test 9 or 10, open the
saved file and confirm it's the real uploaded content, not empty or
corrupted, and the filename matches what was uploaded.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________

---

## Regression (should be unaffected by this phase)

**13. Full README/CLAUDE.md testing checklist still passes.** Home ↔ sector
views, an example project window, the "Try a Digital Twin" reveal, the lead
form, demo sign-in, the Admin Board's other screens (Organizations/Users/
Access/project/GIS editors), mobile drawer, browser back/forward, console
clean on load and on every overlay — this phase touched `js/app.js`/
`js/admin.js` and should not have changed any of this, but it's the same
class of file where Phase 4/6/7 each found a real regression.

Result: - [x] PASS - [ ] FAIL - [ ] NOT TESTED
Comments: ____________________________________
