# DTS Migration — Progress Log

Claude updates this after every phase so any new session can resume cold. The
identity/access model each phase from 3 onward implements is defined in
`docs/migration/ACCESS-MODEL.md` — read it alongside this log when resuming.

| Phase | Status | Deployed URL / notes | Tested |
|-------|--------|----------------------|--------|
| 0 — Verify | done | `.gitignore` + `.env.example` scaffolded, approved | — |
| 1 — Cloudflare foundation | done | **https://dts-website-4cu.pages.dev** (stable — always latest; per-deploy hash URLs like `987a897b...` change every redeploy, don't bookmark those) | deterministic checks pass; user confirmed tour, lead forms, demo sign-in, mobile |
| 2 — Scrub secrets | done, except item 6 (GitHub repo privacy — deferred to domain cutover) | https://dts-website-4cu.pages.dev | secrets confirmed gone from live deploy; demo sign-in now localhost-only by design |
| 3 — Supabase (dev): org/access schema + RLS + dummy seed | **done** | project `DTSdev` (`wsqvzyfvxjenqvqjpqjv`, region `us-west-2`) | schema/RLS/functions/seed verified by direct query; access backfill applied + validated; adversarial RLS check (SELECT + write-path) all pass |
| 4 — Client auth swap + resource gating | **DONE** — full manual checklist passed, including both post-fix retests | https://dts-website-4cu.pages.dev | Every checklist item passed except forgot-password (item 14 — blocked on the deferred SMTP setup, an account/infra gap, not a code issue; retest once §7 is done). All real bugs found during testing (resource-key decode, gating-UX auto-prompt, locked-placeholder-not-restored, cross-tab sign-in sync, sign-out not revoking cached access) fixed and user-confirmed live, not just deployed. |
| 5 — Admin auth swap (site_role) | code complete, **needs user's manual test pass** | https://dts-website-4cu.pages.dev (not yet redeployed with this phase's changes) | not yet tested live |
| 5b — CMS access editors + org management | not started | — | — |
| 6 — Content pipeline (public/protected split) | not started | — | — |
| 7 — Lead form | not started | — | — |
| 8 — Builds (org/user entitlement-gated) | not started | — | — |
| 9 — Analytics & audit | not started | — | — |
| Handoff — go live (real orgs + members) | not started | — | — |

## Session log
(Newest first. One short entry per working session: what changed, what was tested, what's blocked.)

- 2026-08-08 — Ran `/migrate-phase5`. Deleted the entire old ADMIN
  AUTHENTICATION block in `js/admin.js` (`adminAccounts`, `registerAdmins`,
  the `access.json`/Google-Sheet admin-account sources, `splitCSV`,
  `isAdminLogin`, and the capture-phase `submit` interceptor) — Supabase
  requires an async round trip before any role is known, so credential-based
  capture-phase interception is structurally impossible now, not just
  replaced by preference.

  **New routing, built on Phase 4's existing `dts:signed-in` event** (which
  already carried `session.siteRole` and `session.orgs[].orgRole` as
  genuinely separate fields — no schema change needed, confirming
  `ACCESS-MODEL.md` §1's axes were already respected end to end):
  `admin.js` listens for `dts:signed-in` and opens the Admin Board only when
  `siteRole === "site_admin"`; every other signed-in user (including
  `org_admin`) is untouched, since `app.js` already routes them to the
  ordinary client portal. `org_admin`'s "Manage your team" affordance stays
  deferred to Phase 5b exactly as planned — nothing in this phase adds it.

  **Two real gaps found by tracing the actual call path before writing any
  code, not assumed from the phase file's literal wording, both flagged for
  approval before implementing:**
  1. `app.js`'s `finishSignIn()`/`restoreSession()` called `openPortal()`
     unconditionally after every sign-in — with no per-role branch, a
     `site_admin` login would have opened BOTH the Admin Board (from
     `admin.js`'s new listener) AND the client portal in the same dispatch,
     since the event fires before that call. Fixed by making `app.js` itself
     skip portal/pending-resource resumption when `siteRole === "site_admin"`
     — their destination is entirely `admin.js`'s to decide. Also fixed
     `openAccess()`, which had the same unconditional-`openPortal()` bug for
     an already-signed-in admin re-opening the sign-in form.
  2. **A real race, reproduced by tracing script load order, not
     hypothetical:** `admin.js` is lazy-loaded via a separate `<script>` tag
     (content-loader.js's `isAdminContext()` — unchanged this phase — loads
     it eagerly whenever a draft exists in localStorage, which Save draft &
     preview's reload always triggers). `restoreSession()`'s `getSession()`
     read resolves from local storage, no network call, so it can easily
     dispatch `dts:signed-in` before a network-loaded `admin.js` has even
     registered its listener. The OLD design never had this problem — its
     chip-on-reload check was fully synchronous. Fixed by exposing
     `window.DTS_ACCESS = access` (same by-reference pattern as
     `window.DTS_CONFIG`/`DTS_CONTENT`) so `admin.js`, once loaded, can
     synchronously check for an already-existing `site_admin` session
     instead of depending on winning the race to register in time.

  **Preserved the Save & Preview UX deliberately, not just structurally:**
  the `dts:signed-in` event now carries a `restored` flag (`false` from a
  real just-now sign-in submit via `finishSignIn()`, `true` from
  `restoreSession()`'s page-load/reload path). `admin.js` opens the board
  directly only when `restored:false`; on `restored:true` it just shows the
  floating chip — otherwise every reload while signed in as `site_admin`
  (including the one Save & Preview itself triggers) would have thrown the
  reader straight back into the editor instead of letting them see the live
  preview, defeating the feature's whole purpose.

  **`dtsAdminSession` dropped entirely** (per this phase's explicit
  instruction — a deliberate, approved deviation from `CLAUDE.md`'s
  do-not-break list, superseded by the real Supabase session now being the
  session). `closeBoard(true)` ("Sign out") now calls the real
  `window.DTS_SUPABASE.auth.signOut()` + a full reload — the same pattern
  `app.js`'s own `signOut()` uses, for the same reason established during
  Phase 4 testing (in-place-mutated experience/GIS caches have no clean
  "undo"; a reload is the only reliable way to guarantee a signed-out
  session can't still reach anything). `dtsAdminDraft` is untouched.

  **A real gap found incidentally while reading the resource resolver for
  this phase, NOT fixed here (out of Phase 5's scope, and Phase 4 is already
  closed/tested) — flagged for whenever it becomes live-relevant:**
  `functions/_lib/access.js`'s `checkAccess()` has no `site_admin` bypass at
  all — a `restricted`-level resource still requires a real
  `resource_entitlements` row for a `site_admin`, contradicting
  `ACCESS-MODEL.md` §8's table ("Open restricted resources entitled to
  them... yes (all)" for `site_admin`). Zero live impact today — nothing in
  `/data` is currently `client` or `restricted` (Phase 3's backfill only
  ever set `public`/`registered`) — but this will matter the moment any
  resource (or a Phase 8 download) becomes `restricted`, since a `site_admin`
  would get a false 403 instead of the site-wide access the spec promises.
  Worth a small, standalone fix (an `is_site_admin` check added to
  `checkAccess()`, mirroring the DB-side function used elsewhere) before
  Phase 8 ships, or whenever the first real `restricted` resource is
  authored.

  **Verified by reading the code and syntax-checking both files
  (`node --check`) — not yet verified live.** Every other claim in this
  entry is a "confirmed by reading the code" claim, not a live one. **Not
  yet deployed** to the Cloudflare dev URL — this phase's instructions
  stop at "test, update PROGRESS.md" and don't call for a redeploy, and
  Supabase auth behaves identically local vs. deployed, so the user can
  test via `python3 -m http.server 8000` per `CLAUDE.md`'s local-dev
  instructions if that's preferred over a redeploy first. **Needs the
  user's live pass**, sign-in as each seeded dummy account
  (`testadmin@example.com` → Admin Board should open directly;
  `testorgadmin@example.com` → ordinary portal, Admin Board must NOT open
  under any path; `testuser@example.com` → ordinary portal, no admin
  affordance anywhere), plus Save draft & preview → discard, and the zip
  export escape hatch, still working unchanged.

- 2026-08-08 — **Phase 4 is DONE.** Both outstanding retests passed:
  cross-tab sign-in sync (verified via a same-tab-vs-other-tab plain login,
  since the original email-based retest hit the same known 2/hour rate
  limit — same code path either way, `onAuthStateChange` doesn't
  distinguish how the other tab's session was established) and sign-out
  actually revoking cached access (confirmed a previously-viewed gated
  experience correctly re-locks after sign-out, without a manual reload).
  Every item in the manual checklist has now passed except forgot-password
  (item 14), which stays blocked on the deferred custom-SMTP setup — an
  account/infrastructure gap already fully documented, not a code issue,
  and not a blocker for calling Phase 4 complete. Next: `/migrate-phase5`.

- 2026-08-08 — **Item 14 (forgot-password) root-caused — confirmed from the
  user's own Supabase dashboard screenshot, not guessed.** Authentication →
  Rate Limits showed "Rate limit for sending emails: 2 emails/h" —
  Supabase's documented built-in-email default, shared project-wide across
  every auth email type (confirmed against Supabase's own docs via
  WebFetch, not assumed from memory). Not a code bug. The user's earlier
  successful signup-confirmation email almost certainly used the hour's
  quota before the password-reset request that failed.
  **Deferred, same as OAuth** — the real fix (custom SMTP via a provider
  like Resend) requires a verified domain, and the user doesn't have DNS
  access to one available right now. Documented for later, and — unlike
  OAuth — flagged as NOT optional at production handoff, since Supabase
  itself documents the built-in service as unsuitable for production and
  this affects password reset regardless of whether self-registration or
  OAuth ship: new `ACCOUNT-SETUP-AND-HANDOFF.md` §7 (dev setup steps once a
  domain is available), a new row 10 in its Quick checklist, a new
  inventory row 11 in `migrate-handoff.md` step 1 marked explicitly
  non-skippable, and an addition to migrate-handoff step 2 / Part 3 step 4
  (production Supabase) requiring it be done during that step, not
  deferred to production the way it was in dev.
  **Known testing constraint until this is fixed:** the whole dev project
  shares 2 auth emails/hour — don't chain signup/reset attempts within the
  same hour and mistake the shared cap for a new bug.

- 2026-08-08 — **User ran the full verification checklist — 23/25 passed,
  2 real bugs found, both fixed.**
  1. **Cross-tab sign-up confirmation never reached the original tab.**
     Reported as: sign up, get the "check your email" note, confirm the
     email in a NEW tab (which correctly signs in there) — but the
     ORIGINAL tab's form just sits there still showing the sign-up fields,
     with no indication anything happened. Root cause: there was no
     `supabase.auth.onAuthStateChange()` listener anywhere in `js/app.js` —
     the only session checks were the one-shot `getSession()` in
     `restoreSession()` (boot only) and the direct calls inside
     `submitAccess()` (that tab's own submit only). Neither could ever
     learn about a session established in a DIFFERENT tab. Fixed: added an
     `onAuthStateChange` listener that calls the existing `finishSignIn()`
     for any `SIGNED_IN` event this tab didn't cause itself — guarded with
     a `localAuthInFlight` flag (set for the duration of `submitAccess()`
     and `restoreSession()`) so the normal same-tab paths never get
     double-handled by both their own direct call AND the listener.
  2. **Signing out didn't actually revoke client-side access until a
     manual reload.** Real security-relevant bug, not cosmetic:
     `resolveExperienceNode()`'s whole design is to skip the network
     entirely once a node already carries its real target (`Object.assign`
     mutates the shared `cfg.examples[...]` node in place on first
     resolve) — `signOut()` cleared `access.session` but never undid any
     of those mutations, nor `access.resolvedGisMaps`/`cfg.gisMaps`, so
     anything resolved earlier in the session stayed reachable client-side
     after logout with zero server round-trip to catch it. There's no
     clean "undo" for those in-place mutations, so the fix is a full
     `window.location.reload()` after `auth.signOut()` completes — the
     only way to guarantee every trace is actually gone. (The same
     `onAuthStateChange` listener now also nulls `access.session` on a
     `SIGNED_OUT` event from elsewhere, e.g. a token revoked in another
     tab — a smaller, complementary fix, though the reload is what
     actually closes the exploit.)
  Both verified via curl that the fix is live (`onAuthStateChange`,
  `localAuthInFlight` present in the deployed `js/app.js`); **not yet
  re-verified live in a browser** — needs the user's re-test.
  **Also**: item 14 (forgot-password) failed — no email arrived. Root
  cause not yet determined; `submitForgotPassword()` was silently
  swallowing the actual Supabase response either way (deliberately, so the
  UI never leaks whether an email has an account) — added
  `console.warn()` logging of the real error so a future failure is at
  least diagnosable instead of just "nothing arrived". Most likely
  candidates, none yet confirmed: the Supabase Redirect URLs allow-list
  item flagged in the self-registration entry below was never confirmed
  done (`resetPasswordForEmail`'s `redirectTo` would be rejected if so);
  Supabase free-tier auth email rate limits (shared bucket with the
  signup-confirmation email that DID arrive successfully); or the email
  landed in spam. Needs the user to check Supabase Dashboard →
  Authentication → Logs and Rate Limits, and their spam folder, since none
  of this is visible from the deployed code alone.
  Redeployed: https://82e97b22.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

- 2026-08-08 — **Google/Microsoft OAuth deferred; handoff docs restructured
  around a credential-inventory gate.** User confirmed they'll set up the
  Google/Microsoft OAuth apps later (still under their own personal accounts
  first, per the self-registration entry below — not the client's, this
  early) and chose to leave the "Continue with Google/Microsoft" buttons
  visible on the live site in the meantime (they'll show a Supabase
  "provider not enabled" error if clicked until the providers are
  configured — known, not a bug).
  Separately, the user asked that gathering ALL client account access
  (Cloudflare, Supabase, OAuth if it's launching, domain/DNS, the real
  client list) become the explicit FIRST step of `/migrate-handoff`, not
  something discovered mid-process. Restructured both handoff documents:
  `.claude/commands/migrate-handoff.md` gained a new step 1 — a 10-row
  credential/access table covering every external account this migration
  now touches, framed as a hard gate ("don't start step 2 until every row
  is either in hand or explicitly deferred") — and every later step
  renumbered (2-8) to make room, including a new step 5 for the
  Google/Microsoft OAuth production setup (skippable, with the deferral
  noted in `PROGRESS.md`, exactly as decided here). `docs/migration/
  ACCOUNT-SETUP-AND-HANDOFF.md`'s Part 1 gained a new §6 (dev-account OAuth
  setup steps, under the user's own accounts) and Part 3's step-by-step
  walkthrough was restructured to lead with the same credential-inventory
  step, with cross-references fixed throughout (step numbers had shifted).
  No code changed this entry — documentation/process only.

- 2026-08-08 — **Self-registration added** — user asked whether guests could
  create their own account (email/password, or Google/Microsoft), and
  clarified this was never actually specified anywhere in the migration kit;
  the model built through Phase 4 assumed every account is created by DTS
  staff. A genuine, approved extension, not a correction.
  **The database already supported this with zero schema change** — confirmed
  by reading `supabase/migrations/20260807220000_core_schema.sql`:
  `handle_new_user()` already fires on every new `auth.users` row (however it
  was created — password sign-up or OAuth) and inserts a `profiles` row with
  `site_role='user'`, exactly the "registered" tier per `ACCESS-MODEL.md` §3.
  Only the client UI and Supabase Auth provider config were missing.
  **Built:** a Log In ⇄ Create Account mode toggle in the existing sign-in
  form (`setAccessMode()` in `js/app.js`) reusing the same fields/submit
  handler; `submitAccess()` branches to `supabase.auth.signUp()` in signup
  mode, with a client-side password-confirmation check first. Per the user's
  choice, email confirmation is required — `signUp()` returns no session in
  that case, so the form shows a "check your email" success note and drops
  back to login mode rather than pretending to sign the reader in.
  Google + Microsoft "Continue with…" buttons call
  `supabase.auth.signInWithOAuth({provider:"google"|"azure"})`. Since OAuth is
  a full-page redirect away and back (not a fetch), `access.pendingResourceKey`
  (in-memory) would be lost across that navigation — `signInWithOAuth()` now
  persists it to `sessionStorage` first, and `restoreSession()` (which already
  runs on every boot) checks for that marker on return and resumes either the
  original gated resource or the portal, but ONLY when the marker is present —
  an ordinary page load with an already-existing session still does nothing
  automatically, unchanged from before. No CSP change needed: OAuth's
  redirects are top-level navigation, which CSP's `connect-src`/`script-src`
  don't govern. New CSS: `.access-oauth-row`/`.access-oauth-btn`/
  `.access-divider` (`css/09-mobile.css`), `.form-success-note`
  (`css/04-overlays.css`).
  **Verified via curl against the live deploy:** the new form fields/buttons
  (`accessGoogle`, `accessMicrosoft`, `accessModeToggle`, `accessConfirmField`)
  and JS functions (`signInWithOAuth`, `setAccessMode`, `finishSignIn`) are
  present in the deployed `index.html`/`js/app.js`. **NOT yet verified live**
  — needs the user's own click-through, same as the rest of this phase's
  outstanding checklist.
  **Requires external setup ONLY the user can do, before this fully works —
  none of it is optional, and one item retroactively affects an already-
  shipped feature:**
  1. Supabase Dashboard → Authentication → Providers → Email → confirm
     "Confirm email" is ON (should already be Supabase's project default,
     but never explicitly verified this session).
  2. Supabase Dashboard → Authentication → URL Configuration → **Redirect
     URLs allow-list.** Add `https://dts-website-4cu.pages.dev/*` (site's
     `redirectTo`/`emailRedirectTo` is always `location.origin +
     location.pathname`, so one entry covers sign-up confirmation, OAuth
     return, AND the existing forgot-password flow). **This was never
     confirmed done for forgot-password either** (`docs/migration/
     PROGRESS.md` has no record of it) — worth checking now since an
     un-whitelisted redirect would silently break all three.
  3. Google OAuth: Google Cloud Console → APIs & Services → Credentials →
     Create OAuth client ID (Web application) → Authorized redirect URI
     `https://wsqvzyfvxjenqvqjpqjv.supabase.co/auth/v1/callback` → copy
     Client ID + Secret → Supabase Dashboard → Authentication → Providers →
     Google → enable, paste both, save.
  4. Microsoft OAuth: Azure Portal → Azure Active Directory → App
     registrations → New registration, redirect URI (Web)
     `https://wsqvzyfvxjenqvqjpqjv.supabase.co/auth/v1/callback` → New client
     secret → Supabase Dashboard → Authentication → Providers → Azure →
     enable, paste Application (client) ID + secret + tenant URL, save.
  Until 3/4 are done, clicking those buttons will show a Supabase
  provider-not-enabled error — expected, not a bug.
  Redeployed: https://d55645ed.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

- 2026-08-08 — **UX follow-up requested after the resolver-bug fix**, three
  changes to how gating actually feels to a visitor (no access-model change,
  all client-side + one new portal control):
  1. **Sign-in form now explains itself.** Added
     `.access-brand-note` under the "Grounded in Human Experience." tagline
     in the login panel: "Log in for full, free access to our immersive
     platform and interactive maps." (`index.html`, `css/09-mobile.css`,
     `css/11-desktop.css`).
  2. **Gated experiences no longer auto-prompt sign-in just from opening a
     project window.** This was the biggest change. Previously
     `showExperience()` unconditionally called `resolveExperienceNode()` the
     instant a project window opened — for a `registered` Treedis/GIS
     experience, that meant an immediate 401 → sign-in form, even though the
     reader hadn't tried to view anything yet. Now `showExperience()` takes
     an `opts.resolveNow` flag: by default (opening a project card, a deep
     link, back/forward, a stage-tab switch) it does NOT resolve — a gated,
     not-yet-resolved experience renders a new locked placeholder inside
     `#exStageSlot` ("Sign in to view this experience/video/map", clickable)
     instead of either a blank pane or an auto-popped login form. Only two
     things actually trigger a resolve: clicking that placeholder, or
     clicking "Enter Twin"/"Full screen map" — both explicit view attempts,
     which is where the sign-in prompt is now allowed to appear (a 401 from
     `resolveExperienceNode` still opens the existing sign-in form exactly as
     before). `resolveNow:true` is also passed by destination-preservation
     (`openResourceByKey`, post-login reopen) and the portal's own resource
     cards, since a click there already IS the explicit view attempt — it
     just happened before the sign-in interruption. A `public` experience
     (the 9 Vimeo videos, and anything already resolved earlier this
     session) is unaffected — `experienceIsAvailable()` short-circuits it
     straight to the existing zero-network-call auto-mount path, so it still
     "just plays" on window open, per the earlier fix. New CSS:
     `.example-locked-placeholder` in `css/06-example-window.css`.
  3. **Client portal now has a close (X) control.** `openPortal()`'s
     `#portalLayer` previously only closed via Escape or sign-out (which also
     clears the session) — added `#portalClose` next to "Sign out" in the
     topbar, wired to the existing `closePortal(false)` (closes the board,
     keeps the session, same function Escape already used) so a signed-in
     visitor can back out to the site without being signed out.
  **Verified by reading the code path (not assumed):** confirmed
  `resolveExperienceNode`'s existing zero-fetch shortcut
  (`node.tourUrl||embedUrl||watchUrl||mapId||url`) is exactly the right
  predicate for "already available, don't gate" and reused it unchanged as
  `experienceIsAvailable()`, so the public-video fast path added earlier this
  session needed no further change. **Verified against the real deployed
  site via curl:** the login subtitle text, `id="portalClose"`, and the new
  `experienceIsAvailable`/`showLockedPlaceholder`/`resolveNow` functions are
  all present in the live `index.html`/`js/app.js`
  (https://dts-website-4cu.pages.dev). **NOT yet verified live in a
  browser** — the Claude-in-Chrome extension was disconnected at the point
  this needed checking; the actual click-through (does the placeholder
  really appear instead of a blank pane, does clicking it really pop sign-in,
  does the portal X really work) is left to the user's manual pass, alongside
  the rest of the outstanding Phase 4 checklist below.
  Redeployed: https://03e1cdf2.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

  **User caught a real follow-on bug from their own click-through, before
  finishing the rest of the verification pass:** closing the sign-in form
  (the X, after clicking the locked placeholder) left the stage with
  nothing clickable at all — not locked, not open — recoverable only by
  reopening the project or switching tabs away and back. Root cause:
  `showExperience()`'s failure branches (`resolveExperienceNode` 401/403,
  and the GIS second-step failure) called `handleResolveFailure()` to open
  the sign-in form but never put the locked placeholder back afterward —
  it had already been hidden at the top of the same call (the unconditional
  `hideLockedPlaceholder()` that runs before deciding whether to show it
  again). Fixed: both failure branches now re-show the locked placeholder
  (`if (!experienceIsAvailable(target)) showLockedPlaceholder(slot, target)`)
  before returning, so dismissing the sign-in form leaves the reader back
  at the same clickable "Sign in to view this…" tile, able to retry.
  Verified via curl that the fix is live
  (`js/app.js` contains the new "Still not available" comment marker).
  Redeployed: https://c049950a.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev). Still needs the user's live click
  confirmation, same as the rest of this entry.

- 2026-08-08 — **User reported Phase 4 broken in real testing**, contradicting
  the prior session's "API-level verified" status: clicking a gated experience
  (automotive Treedis tour) showed a completely blank experience pane with NO
  login prompt, for BOTH guests and signed-in `testorgadmin`; user also
  reported public/registered videos not showing for guests at all, and could
  not sign in from the portal. Confirmed not a caching issue (user hard-
  refreshed and tried incognito, same result).

  **Root cause, found by reproducing live in-browser (Claude-in-Chrome) then
  isolating with direct `fetch()` calls from the page console:**
  `fetchResource()` in `js/app.js` calls `encodeURIComponent(resourceKey)`
  before requesting `/api/resource/<key>` — turning `project.automotive:treedis`
  into `project.automotive%3Atreedis`. Cloudflare Pages does NOT percent-decode
  dynamic route segments (confirmed empirically: a raw, unencoded colon in the
  URL correctly hit `parseResourceKey()`'s colon split and returned 401; the
  `%3A`-encoded form returned 400 "unrecognized resource key"). Since
  `parseResourceKey()` runs BEFORE the auth check, this 400 happened
  identically for guests and signed-in users, for EVERY gated experience/link
  — exactly matching the reported symptom. The client's `handleResolveFailure()`
  only `console.warn`s on an unrecognized "error" reason (vs. opening the
  sign-in form for a real 401), so nothing was visible in the UI at all — a
  silent failure, not a crash.

  **Fixed** in `functions/api/resource/[key].js`: decode `params.key` via
  `decodeURIComponent()` as the first line of `onRequestGet` (a no-op if the
  segment ever arrives already-decoded, so this is safe regardless of exactly
  how Cloudflare is or isn't decoding). Verified by curl (encoded key now
  returns 401 "sign-in required", stable across repeated requests) AND live in
  the browser: the "Welcome Back!" sign-in form now correctly opens over the
  automotive project window for a guest, matching the intended design for the
  first time.

  **Also addressed the user's separate point 0 ("videos should be open access
  to any user even not registered")** — a real reversal of the `registered`
  default `ACCESS-MODEL.md` §6 set for all Treedis+Vimeo experiences, but the
  user stated it plainly as an explicit requirement, not an open question.
  Changed `media.access` from `"registered"` to `"public"` on the 9 Vimeo-only
  project documents (`civic`, `foodsafety`, `healthcare`, `healthfac`,
  `municipal`, `nonprofit`, `sustain`, `workforce`, `workplace.json`) —
  Treedis and GIS experiences are untouched and remain `registered`, matching
  "not a treedis experience or a map" in the user's own wording. Re-uploaded
  all `data/source/` documents to R2 (`upload-source-to-r2.mjs`, idempotent)
  so the server-side resolver stays consistent even though the client no
  longer calls it for these (public resources short-circuit client-side with
  zero network calls, by existing design in `resolveExperienceNode()`).
  Verified via curl: `civic.json`'s published document now carries its real
  `embedUrl`/`watchUrl` directly (no strip) with `access:"public"`; a gated
  project (`automotive`) is confirmed still stripped/gated exactly as before.

  **Known gap surfaced, not fixed (out of scope for this pass):**
  `js/config.js` (the `/data`-unreachable fallback) has never carried any
  `access` field at all and `strip-public-data.mjs`'s config.js-stripping
  step unconditionally deletes every example's `embedUrl`/`watchUrl`/
  `tourUrl` regardless of access level. This means if `/data` ever fails to
  load and the site falls back to `config.js`, the 9 now-public videos would
  incorrectly appear gated in that fallback path (they did before this
  change too — this isn't a regression, just a pre-existing gap made visible
  by the videos becoming public in the primary `/data` path). Not fixed
  because it only matters in a rare degraded-mode fallback, not the bug the
  user reported. Needs: an `access` field added to `config.js`'s per-example
  media, and `strip-public-data.mjs`'s config.js section updated to honor it
  the same way the `/data` section already does.

  Rebuilt the deploy staging directory from scratch (fresh `robocopy` +
  `strip-public-data.mjs`, same exclusions as before plus the two oversized
  unused Backrooms `.usdz` files, which the fresh copy re-included and which
  still exceed Cloudflare's 25 MiB file cap). Redeployed:
  https://ea8f2b35.dts-website-4cu.pages.dev (stable alias:
  https://dts-website-4cu.pages.dev).

  **Still NOT yet verified — needs the user:** the full sign-in FORM flow
  beyond the login prompt appearing (actually signing in, destination
  preservation, reload persistence, sign-out, forgot-password), the GIS map
  rendering visually, and the full README regression checklist. These are
  the same items flagged as outstanding in the previous session's entry —
  this session only fixed the blocking bug that prevented testing them at
  all, it did not newly verify them.

- 2026-08-08 — Ran `/migrate-phase4` end to end (the security-critical
  phase). Built and tested infrastructure BEFORE touching app.js, then
  built app.js on top of an already-validated backend.

  **Infrastructure:** confirmed empirically (not assumed) that R2 bindings
  work with the existing Direct Upload deploy once `wrangler.toml` has
  `pages_build_output_dir` set. Seeded `dts-content`'s `data/source/`
  prefix with unstripped project/GIS data (`scripts/upload-source-to-r2.mjs`,
  new). Wrote `scripts/strip-public-data.mjs` (new) for the public-facing
  strip Phase 6 will later formalize.

  **Real bugs found and fixed before they ever shipped, each verified
  independently after fixing, not just assumed correct:**
  1. `strip-public-data.mjs` initially missed 8/15 gated projects — video
     experiences use nested `embed`/`watch` source objects in raw /data,
     not the flat `embedUrl`/`watchUrl` the *converted* DTS_CONFIG shape
     uses. Confirmed by reading a real raw document (`civic.json`), not
     assumed from the converted shape.
  2. The `config.js` strip's first version used regex string-matching and
     shipped a real bug: it "protected" a DIFFERENT project's tourUrl
     because it happened to share the homepage's tour ID string. Rewrote
     to operate on the parsed object graph via `vm` — fields identified by
     structural position, never by string content.
  3. `gfc.json`'s GIS map had no `access` field of its own (only the
     project-side experience pointer got one from Phase 3's backfill) —
     added `"access": "registered"` to `data/gis/maps/iberia-coastal.json`
     directly, re-uploaded to R2.
  4. The resolver's GIS payload originally spread computed `tours`/
     `featureTours` (full objects) directly over `mapDoc`, silently
     overwriting `mapDoc.tours` — which the RAW document already carries
     as an array of ID STRINGS that `js/app.js`'s `toursForMap()` looks up
     against a global `cfg.gisTours` map. Caught by tracing the actual
     client consumer before shipping, not by assuming the naming implied
     the right shape. Fixed: `{mapDoc, tours, featureTours}` as separate
     keys; the client populates `cfg.gisTours`/`cfg.gisFeatureTours` itself,
     the same keying `buildConfig()` already uses for public maps.
  5. **A real "three places" gap, not yet caught by anything:**
     `content-loader.js`'s `convertExperience()` and the project/links
     mapping in `buildConfig()` never mapped the `access` field through to
     `DTS_CONFIG` at all — Phase 3's backfill added it to `/data`, but step
     2 of the rule (map it in `buildConfig()`) was never done. Didn't
     manifest as a live bug only because every real resource today happens
     to resolve to `registered` either way — but `computeAccessibleResources()`
     (the portal's "All Apps" list) genuinely needs `node.access`/`ex.access`
     client-side to work correctly once ANY resource is ever `client` or
     `restricted`. Fixed: `access` now flows through
     `convertExperience()`, the project-level `ex`, and links (which also
     needed a stable `id` — `link-<1-based-index>`, matching the resolver's
     convention — since they never had one).
  6. The deploy staging build accidentally swept in `node_modules` (from
     installing `@supabase/supabase-js` for the migration tooling
     scripts) — caught by checking the staging directory's actual contents
     before deploying, not assumed clean. Excluded `node_modules/`,
     `package.json`, `scripts/`, and `supabase/` from the public deploy —
     none are needed there, and the latter two reveal internal
     implementation details (exact RLS policies, resource_key formats,
     R2 path structure) with no benefit to shipping them.

  **app.js**: deleted `loadDirectory`/`parseCSV`/`normalizeRow`/old
  `authenticate` (~120 lines); new `authenticate` via
  `supabase.auth.signInWithPassword`; session restore on boot (fire-and-
  forget, never blocks initial paint); `dts:signed-in` event dispatch;
  real forgot-password flow; `resolveExperienceNode`/`resolveGisMapById`/
  `fetchResource` as the gating layer, integrated into `showExperience()`
  (now async, with a race guard matching the pattern `mountGis()` already
  used for its own async mount); `buildExampleLinks()` rewritten so a
  gated link renders as a resolve-then-open button instead of a raw
  `<a href>` a guest could just read out of the page source; portal
  redesigned around `computeAccessibleResources()` (scans `cfg.examples`,
  cross-references the user's own entitlements, readable client-side
  under RLS as "your own") since the old `session.twins[]` model doesn't
  exist anymore. `mountTreedis`/`mountVideo`/`mountGis` themselves:
  ZERO changes, exactly as planned — the gating layer sits at the mount
  boundary, not inside them.

  `index.html`: supabase-js CDN + `js/supabase-init.js` (the only
  account-specific values in a committed file, by design) before
  `content-loader.js`; `js/clients.js` deleted entirely (fully dead code
  after Phase 2); "Login In" → "Log In"; Remember-me checkbox removed
  (the underlying logic is gone). `_headers`: Supabase URL added to
  `connect-src` (https + wss).

  **Verified on the live deployed site (API-level, via curl with real
  Supabase tokens for testuser/testorgadmin/testmember) — not just
  locally:** registered resource resolves with real target for a signed-in
  user, 401 for a guest; the `automotive` link-1 leak is closed end to
  end (real BMW X1 tour URL only returned to an authenticated request);
  the two-step GIS resolve works (`project.gfc:map` → `{mapId, tourId}`
  → `gismap.iberia-coastal` → full doc with 14 tours + 13 feature tours);
  the GIS layer proxy streams real geojson to an authenticated user, 401
  to a guest; `js/config.js` on the live deploy has exactly 1 `tourUrl`
  (the homepage) and 0 `embedUrl`/`watchUrl`; the GIS map document and a
  local layer file are both confirmed absent from the public deploy
  (checked actual response body/size against `index.html`'s real byte
  count, not status code alone — Cloudflare's SPA-style fallback returns
  200 for genuinely-missing paths).

  **NOT yet verified — needs the user, per the project's manual-testing
  convention:** the sign-in FORM flow (does clicking a gated tile actually
  open the login form, not just the API returning 401), destination
  preservation after login, session persisting across a reload, sign-out,
  forgot-password actually sending, the GIS map rendering correctly in
  the browser (tours/feature tours/layers visually working, not just the
  API returning correct data), the full README regression checklist
  (tour must not reload, lead form, mobile drawer).

- 2026-08-08 — Ran `/migrate-phase3` step 8 (adversarial RLS check) —
  **Phase 3 is now fully DONE.** Wrote a scripted check that signs in as
  each dummy user with the ANON key (not service role, which bypasses RLS
  entirely and would prove nothing) and queries what their own session can
  actually see.
  **Two false failures in the first run, both my own test-assertion bugs,
  not real RLS problems — investigated each before accepting or dismissing
  either:**
  1. `testmember` "failed" a check expecting exactly 1 visible
     `organization_members` row. The real count was 2. Investigated by
     adding `user_id` to the query: the second row belonged to
     `testorgadmin`, who is *also* a plain member of `beta-municipal`. This
     is correct behavior under the "org members see their org's roster"
     policy, not a leak — confirmed neither row was ever `acme-hotels`. Fixed
     the assertion to check "every visible row is beta-municipal" instead of
     an exact count that was wrong to begin with.
  2. `testorgadmin` then "failed" two checks that had been passing — caused
     by my own fix in (1) changing the row-string format (adding the
     `user_id` suffix) without updating these two assertions' exact-match
     comparisons. Fixed to use `.startsWith()`.
  **After both fixes, every check passes** — `testadmin` (site_admin) sees
  everything; `testuser` sees only their own direct entitlement and nothing
  org-related; `testorgadmin` sees the full rosters/entitlements of both
  orgs they belong to (Acme + Beta) and correctly does NOT see `testuser`'s
  entitlement; `testmember` sees only Beta's data, never Acme's.
  **Also added a write-path adversarial check** beyond what the phase file
  literally asked for (SELECT-visibility only), since the infrastructure was
  already built and this validates the exact mechanism Phase 5b's team
  panel depends on: confirmed `testorgadmin` (org_admin at Acme, plain
  member at Beta) CAN update their own membership row at Acme, and CANNOT
  modify `testmember`'s row at Beta (RLS silently filters the UPDATE to
  zero affected rows) — org_admin write scope is genuinely per-org, not
  global, confirmed both directions, not just asserted from reading the
  policy SQL.
  Removed the temporary check script from the project directory afterward
  (throwaway verification, was never meant to be committed).
  Phase 3 complete. Next: `/migrate-phase4` — the security-critical client
  auth swap + resource gating enforcement.

- 2026-08-08 — Ran `/migrate-phase3` step 7. Wrote
  `scripts/backfill-access.mjs` (defaults to dry-run/print-only; only writes
  with `--apply`). **Caught a real bug in the script itself before showing
  the plan for approval:** the first dry-run flagged all 15 real project
  files as "NOT IN data/manifest.json", which was wrong — the manifest
  stores project paths relative to `data/` (`"projects/campus.json"`, no
  `data/` prefix), but the script compared against the prefixed form. Fixed
  the comparison and re-ran before showing anything to the user, rather than
  presenting a plan with a false flag on every single file.
  **`emergency.json` decision — user chose to register it.** Read its actual
  content for the first time this session (previously only knew it existed
  and had no experience/media): a real, complete `government`-sector project
  document (GOHSEP/FEMA PA documentation) that was simply never wired in. It
  had no sector card either, which would have left it registered-but-
  unreachable, so both were added: a card entry in `data/sectors/
  government.json` and the manifest entry. Noted but NOT touched:
  `government` sector's own `active` field is currently `false` (predates
  this session, unrelated to the emergency.json question, out of scope for
  this task — flagging only).
  Applied the backfill (`--apply`) after review: `access: "public"` on the
  homepage tour context (`data/site/settings.json` — documentation only,
  nothing currently gates it), `access: "registered"` on all 14 legacy
  `media` projects, both of `gfc.json`'s experiences (`tour` + `map`), and
  the 4 leak links (3 in `automotive.json`, 1 in `campus.json`) — the vimeo
  links in both files were correctly left untouched (spot-checked directly).
  `heritage.json` correctly received no changes (nothing to gate) and
  `emergency.json` correctly received none either (also nothing to gate,
  registration alone was enough). Validated all 20 touched/read JSON files
  parse correctly after writing, not just trusted the script's own "Done."
  **Remaining in Phase 3:** step 8 (adversarial RLS check), step 9 (this
  table row, once 8 is done).

- 2026-08-08 — Ran `/migrate-phase3` steps 1-6. Supabase dev project
  `DTSdev` (ref `wsqvzyfvxjenqvqjpqjv`, region `us-west-2`) created by the
  user; `.env` filled with all 6 Supabase vars (never printed to chat — user
  edited the file directly after being told not to paste secrets in-chat).
  **Two real infrastructure bugs found and fixed, not routed around blindly:**
  1. `supabase link` failed on a secondary "fetch API keys" step (a CLI
     schema-validation error on a date field) — but the CORE link state
     (project ref, org, Postgres version) was confirmed written correctly
     regardless, so migrations proceeded via `supabase db push --db-url`
     instead of depending on a full clean `link`.
  2. `db.<ref>.supabase.co` (the "direct connection" host) only has an IPv6
     DNS record, no IPv4 — confirmed via `nslookup`, not assumed. The
     `aws-0-<region>.pooler.supabase.com` guess also failed ("tenant not
     found") because the actual pooler cluster assignment was
     `aws-1-us-west-2`, not `aws-0` — got the authoritative value from
     Supabase's own Management API
     (`GET /v1/projects/{ref}/config/database/pooler`) rather than guessing
     further. **The working connection for this project:**
     `postgresql://postgres.<ref>:<password>@aws-1-us-west-2.pooler.supabase.com:6543/postgres`
     (transaction-mode session pooler, port 6543) — worth remembering for
     any future phase that needs a direct DB connection to this project.
  Wrote and applied 3 migrations (`supabase/migrations/`): core schema (7
  tables per `ACCESS-MODEL.md` §2), RLS helper functions + deny-by-default
  policies on every table, and a follow-up fix (see below). Verified by
  direct SQL query (not just trusting `db push`'s success message): all 7
  tables have `rowsecurity=true`; policy counts per table match exactly
  what was written (profiles=2, organizations=4, organization_members=4,
  resource_entitlements=4, client_apps=4, events=2, admin_audit=1); all 5
  functions exist. (A 6th function, `rls_auto_enable`, also showed up —
  that's Supabase's own automatic-RLS safety net from the "Enable automatic
  RLS" project-creation checkbox, not something this migration wrote;
  expected, not a bug.)
  **Found and fixed a real bug in the migration's own `protect_site_role`
  trigger**, confirmed empirically (queried `auth.uid()`/`auth.role()` on a
  raw backend connection and got `null`/`null`) before touching anything: as
  originally written, the trigger would have blocked even a legitimate
  service-role/backend connection from ever setting the FIRST `site_admin`,
  since `is_site_admin()` depends on `auth.uid()`, which is null outside a
  PostgREST-mediated request. Fixed with an additive migration
  (`20260807220200_fix_protect_site_role_bootstrap.sql`) allowing the change
  when `auth.uid() is null` — safe because RLS already reduces any
  unauthenticated PostgREST request on `profiles` to zero affected rows
  before the trigger would ever see them, so this only opens the path that
  backend/service connections already had on every other table anyway.
  Wrote and ran `scripts/seed-dev.mjs`: 2 orgs (`acme-hotels`,
  `beta-municipal`), 4 dummy users covering every role combination
  including the multi-org case (`testorgadmin@example.com` = `org_admin`
  at Acme + `member` at Beta simultaneously), 2 entitlements exercising
  both `subject_type` paths (org-level: `project.gfc:map` -> acme-hotels;
  user-level: `download.dummy-viewer-win` -> testuser), 1 `client_apps`
  row. Verified by direct query, not just the script's own output. Dev
  passwords were shown once in this session for testing purposes, never
  written to any file.
  Wrote (did NOT run) `scripts/import-clients.mjs` — defaults to
  `--dry-run`, groups rows into organizations, flags near-duplicate client
  names as a probable duplicate-org bug per `migrate-handoff.md`'s
  safeguard, and explicitly refuses to guess two things that need a human
  decision at handoff: who is `org_admin` per org (needs `--org-admins`
  input, never inferred from the sheet) and the legacy-`twin_url`-to-real-
  `resource_key` mapping (needs `--resource-map` input).
  Added `package.json` + `scripts/` — Node tooling for migration scripts
  only, separate from the site's own vanilla-JS runtime (no framework
  introduced to the browser-facing code).
  **Remaining in Phase 3:** step 7 (`scripts/backfill-access.mjs`, needs its
  own diff-review approval since it writes to reviewed `/data` content, and
  will surface the `emergency.json`-not-in-manifest question), step 8 (the
  adversarial RLS check — confirm `testmember` genuinely cannot see Acme's
  rows, etc.), step 9 (this table's Status column, once 7-8 are done).

- 2026-08-07 — Ran `/migrate-phase2`. Traced every real consumer before
  editing (not just following the phase file's literal text):
  `content-loader.js` never maps `access.json` into `DTS_CONFIG` at all; the
  only reader is `admin.js:68-74`, and both call sites already guard against
  `undefined` (`registerAdmins(list)` does `(list || [])`;
  `accessDoc.directorySource && ...`) — confirmed zero crash risk before
  deleting anything.
  Deleted `directorySource`, `roles`, and `adminUsers` (incl.
  `CHANGE_ME_BEFORE_DEPLOY`) from `data/access/access.json`, keeping `ui` and
  `portal`. Deleted `sheetCsvUrl` from `js/clients.js` and gated
  `demoDirectory` behind `location.hostname === 'localhost'` — **demo/1234
  sign-in now only works locally, not on the live Cloudflare URL**, by
  design (Phase 4 rebuilds real auth).
  **Found a third leaked copy of the Web3Forms key the phase file didn't
  mention:** `js/config.js:154` (the `/data`-unreachable fallback — same
  blind spot as the CSP gap in Phase 1, since it's never a `<script>` tag).
  Traced `app.js:2107` (`if (!lead.accessKey) return false` → mailto
  fallback) to confirm blanking it is safe, then blanked it. Left
  `data/site/lead.json`'s copy untouched per the phase's own instruction —
  that one is flagged for rotation, actually replaced in Phase 7, not
  removed now (removing it without a replacement would break lead delivery
  in the meantime).
  Verified on the LIVE deployed site, not just locally: `curl`'d
  `data/access/access.json`, `js/clients.js`, `js/config.js` from
  `https://e6dc6df8.dts-website-4cu.pages.dev` and confirmed zero matches
  for the sheet URL or the Web3Forms key.
  **Deferred item 6 (make the old GitHub repo private/delete it) — not
  done.** That repo is still the actual live host via GitHub Pages right
  now (Cloudflare is a parallel deployment, not yet the sole live site);
  making it private would very likely break GitHub Pages serving
  immediately, and deleting it is irreversible. Revisit at domain cutover
  (near Phase 6/handoff), not now. User agreed to this deferral.
  Redeployed: https://dts-website-4cu.pages.dev (stable alias; the specific
  deploy was `e6dc6df8...`). Phase 2 status: DONE except item 6. Next:
  `/migrate-phase3`.

- 2026-08-07 — **User confirmed the model renders correctly** at
  https://71a041ec.dts-website-4cu.pages.dev — Phase 1 fully DONE, no open
  items remain. Next: `/migrate-phase2`.

- 2026-08-07 — Real CSP gap found and fixed: the compressed `ToolBox.glb`
  wasn't rendering on the homepage despite the file itself serving correctly
  (confirmed by exact byte-size download in the prior session entry) — traced
  the actual code path (`js/hex-media.js:59-60`) rather than guessing, and
  found the `model` media type lazy-loads Google's `<model-viewer>` web
  component from `ajax.googleapis.com` (fallback `cdn.jsdelivr.net`), neither
  of which was in the original CSP's `script-src` — a real origin my initial
  research missed (it isn't a static `<script src>` tag in `index.html`, it's
  loaded dynamically by `hex-media.js`, so grepping `index.html` alone
  wouldn't surface it). The CSP silently blocked the component from loading,
  so the code correctly fell back to "poster only"
  (`hex-media.js:239`'s console warning) — not a broken asset, a blocked
  script.
  Added `ajax.googleapis.com` + `cdn.jsdelivr.net` to `script-src` AND
  `connect-src` (defensive — `<model-viewer>`/three.js commonly fetch a
  Draco/KTX2 WASM decoder as a separate request after the initial script
  load), plus `blob:` to `img-src` and a `worker-src 'self' blob:` (3D
  viewer libraries commonly decode via Web Worker + blob URLs). Redeployed;
  confirmed via the new deployment's own hash URL
  (`71a041ec.dts-website-4cu.pages.dev`) that the updated CSP is live and
  correct. The STABLE alias URL (`dts-website-4cu.pages.dev`) took a short
  time to propagate the new deployment — confirmed normal, not a second bug;
  if it's ever still showing a stale CSP after a few minutes, that would be
  worth investigating, but a brief propagation window right after deploy is
  expected. **Still needs the user's visual confirmation that the model
  actually renders now** — this fix addresses why it was blocked, not a
  guarantee it looks correct once loaded.

- 2026-08-07 — Phase 1 complete. User confirmed all interactive checks pass
  on the deployed URL: Treedis tour, lead form send, demo sign-in, mobile.
  Compressed `assets/ToolBox.glb` per the user's decision. Diagnosed with
  `@gltf-transform/cli inspect` first rather than guessing: the 38.15 MB size
  was almost entirely two uncompressed 4096×4096 PNG textures (baseColor
  22.67 MB + normal 15.45 MB); the mesh geometry itself was only 29.62 KB.
  `gltf-transform optimize`'s texture-compression step failed on this machine
  (a `sharp`/`libvips` colourspace bug — "value 32 invalid for
  VipsInterpretation" — reproduced on WebP, AVIF/auto, and even plain resize,
  so it's an environment issue, not a WebP-specific one). Worked around it
  with a pure-JS path with no native dependency: unpacked the GLB to loose
  files (`gltf-transform copy`), resized both PNGs 4096→2048 with `jimp`
  (no libvips involved), then repacked (`gltf-transform copy` again).
  Result: 38.15 MB → 11.46 MB (70% reduction), comfortably under Cloudflare's
  25 MB limit. `gltf-transform validate` reports zero errors; mesh structure
  (756 vertices, same attributes) is byte-identical to the original — only
  the two textures changed. The true original is preserved, untouched, at
  `.../scratchpad/glb-work/ToolBox.original.glb` in this session's temp dir
  (not in the repo) in case full-resolution masters are ever needed again —
  worth copying somewhere durable if that matters, since scratchpad temp
  dirs aren't guaranteed to persist.
  Redeployed with the compressed model included (no more exclusions needed):
  https://987a897b.dts-website-4cu.pages.dev. Confirmed by download, not
  just status code, that `assets/ToolBox.glb` now serves the real
  11,456,292-byte file with the correct `model/gltf-binary` content type.
  **Not yet verified: visual quality of the resized textures** — I can
  confirm the file is structurally valid and geometry is unchanged, but
  actual rendered appearance (does the compressed texture still look good at
  the hex-4 slot's display size) needs the user's eyes, not a CLI check.
  The two orphaned Backrooms usdz files stay permanently excluded (zero
  references, confirmed earlier). Phase 1 status: DONE.

- 2026-08-07 — Finished the deploy half of `/migrate-phase1`.
  `wrangler login` confirmed (`robertoenrique2710@hotmail.com`, account
  `290ae8584c9b91cac7f995c4e28e18c5`). Created R2 buckets `dts-content` and
  `dts-builds` (empty — content upload is Phase 6/8) and the Pages project
  `dts-website`. **Deployed from a staging copy, not the source tree
  directly** — necessary because a straight deploy would have published the
  migration-kit's internal docs (`.claude/`, `docs/migration/`,
  `README-MIGRATION.md`, `.env.example`) to a public URL, which never existed
  on the live GitHub Pages site and isn't meant to be public (the access
  model's own design doc, RLS layout, etc.). Also caught a genuine near-miss:
  the local `.wrangler/cache/wrangler-account.json` (created by the CLI
  commands run this session) contains the real Cloudflare account ID in
  plaintext — excluded it from the staging copy; it was already correctly
  excluded from git by `.gitignore`.
  **Real deploy blocker found and resolved:** Cloudflare Pages caps files at
  25 MiB. Three files exceeded it — `assets/ToolBox.glb` (37 MB, genuinely
  used: the homepage hex-4 slot model, `data/pages/home.json`) and two
  unreferenced files, `models/DTScube_Backrooms_Animated.usdz` and
  `..._v2.usdz` (27 MB each, confirmed zero references anywhere in `/data`,
  `/js`, or `index.html`). The two unused ones are permanently dropped from
  the deploy with no functional impact. `ToolBox.glb` is set aside (not
  deleted — held at
  `.../scratchpad/ToolBox.glb.excluded-from-deploy` in this session's temp
  dir) and is **excluded from THIS deployment only** — the homepage hex-4
  slot will show missing/broken on the Cloudflare URL until this is resolved
  (compress it, move it to R2 with a content-pipeline change, or something
  else — needs a decision, not a unilateral fix, since re-encoding a real
  asset or restructuring how it's served are content/architecture choices).
  **Live GitHub Pages is completely unaffected** — this only touched the new
  Cloudflare deployment.
  **Unrelated pre-existing bug found incidentally:**
  `data/site/settings.json` references
  `models/DTS_Studio_Interior_VisionPro_V2.1.usdz` (with a `.1`) but the real
  file on disk is `DTS_Studio_Interior_VisionPro_V2.usdz` (no `.1`) — the
  Vision Pro spatial backdrop already 404s on the CURRENT live GitHub Pages
  site too. Predates this migration; out of Phase 1's "deploy as-is" scope,
  not fixed. Flagged because the README's own testing checklist calls out
  "Safari check for the Vision Pro CTA."
  **Deployed:** https://efc0ce12.dts-website-4cu.pages.dev — deterministic
  checks pass: real content served correctly for `/data/manifest.json`,
  `/js/app.js`, `/css/01-base.css`; security headers present and match
  `_headers`; migration-kit paths confirmed NOT really served (Cloudflare
  Pages returns its default 200-with-`index.html`-fallback for unmatched
  paths rather than a real 404 — verified by content-length/body, not status
  code alone, since the fallback masks true 404s as 200). Interactive checks
  (Treedis tour reveal, lead form send, demo sign-in, mobile drawer) are
  NOT yet done — handed to the user per the project's manual-testing
  convention rather than driving a browser session unprompted.

- 2026-08-07 — Started `/migrate-phase1`. Verified local `HEAD` matched
  `origin/main` exactly (`a19a4072`) before touching anything, so nothing had
  silently diverged from what GitHub Pages serves. The 47 files `git status`
  showed as modified turned out to be pure line-ending noise
  (`core.autocrlf=true` vs. on-disk CRLF) — `git diff --numstat` confirmed
  ZERO real content differences before staging anything. Committed locally as
  `799ab78d` "Pre-migration baseline": the 21 real new migration-kit files
  (`.claude/commands/`, `docs/migration/`, `README-MIGRATION.md`,
  `.env.example`, `.gitignore`) plus the line-ending renormalization, which
  turned out to add zero extra file changes once staged (git recognized them
  as unchanged). Working tree is now clean; `origin/main` still points at the
  old commit, confirming the baseline never left this machine. Grounded the
  real external origins the site uses today (not the phase file's generic
  "GA/Clarity" assumption, which doesn't exist in this site yet): Treedis
  (`spaces.dtsxr.com`), Vimeo (`player.vimeo.com`), Web3Forms
  (`api.web3forms.com`), Google Fonts, cdnjs (JSZip, admin-only), and — for
  the live GIS map, which is unauthenticated and reachable today since
  nothing is gated yet — `maps.iberiagov.net`,
  `cimsgeo.coastal.louisiana.gov`, `cimsgeo3.coastal.louisiana.gov`,
  `tile.openstreetmap.org`, `tiles.maps.eox.at`, and
  `nominatim.openstreetmap.org`. Excluded `mpdap.coastal.la.gov`/
  `mpdv.coastal.la.gov` from the CSP — those only appear in
  `data/gis/sources.json` as research notes on candidate servers, never
  wired into the live map. Confirmed a real inline `<script>`
  (`index.html:39`) and inline `<style>` (`index.html:34`), so the CSP needs
  `'unsafe-inline'` on script-src/style-src to match current behavior.
  `npx wrangler` confirmed working (auto-resolves 4.120.0, no separate
  install needed). Not yet done: `wrangler.toml`, `_headers`, R2 buckets, or
  the actual deploy — those need `npx wrangler login` first, which only the
  user can approve (browser OAuth).

- 2026-08-07 — Ran `/migrate-start` (Step 0 verification). Portability
  confirmed: only the Google Sheet CSV URL (`js/clients.js:29`,
  `data/access/access.json:31`), the Web3Forms key (`data/site/lead.json:5`),
  and the `CHANGE_ME_BEFORE_DEPLOY` admin placeholder (`access.json:62`) are
  account-specific values outside the designated config spots — all three are
  already scheduled for removal in Phase 2, so nothing blocks the clean
  handoff. `data/site/settings.json`'s Treedis tour URL/origin is also
  account-specific but is a third-party showcase URL DTS already owns, not a
  Cloudflare/Supabase credential — out of scope for the account-portability
  rule. Dev-phase cost confirmed $0 + optional domain, no changes to the
  numbers in `00-VERIFY-FIRST.md`. Two things found and handled: no
  `.gitignore` existed at all (created one — excludes `.env`/`.env.*`, allows
  `.env.example`, plus `node_modules/`/`.wrangler/`/`.supabase/` for the
  tooling upcoming phases introduce); and this repo is NOT a fresh local-only
  git repo as `WORKFLOW.md`'s safety model assumes — `origin` is already set
  to the real GitHub Pages remote (`sroberto27.github.io.git`) on `main`,
  which is what currently serves the live site. Local commits are safe;
  `git push` during migration would go live immediately and should be
  avoided until Phase 1's Cloudflare deploy is the live site instead.
  **Decision confirmed by the user: no `git push` to `origin` for the
  remainder of the migration** — commit locally only, phase by phase, until
  Phase 1 makes the Cloudflare deploy the live site and GitHub Pages is
  retired. Any future session should honor this until it's explicitly
  revisited. Scaffolded `.env.example` with all 8 placeholder vars. No site code, `/data`,
  or Phase 1 work done — Step 0 output presented for approval.

- 2026-08-07 — Reconciled the migration kit with the current site (GIS engine,
  multi-experience projects) and redesigned the identity/access model per
  `docs/migration/ACCESS-MODEL.md`: organizations, memberships, org roles,
  four-level resource gating (public/registered/client/restricted), split
  public/protected content publishing, org/user download entitlements, and a
  separate `events`/`admin_audit` split. Rewrote Phases 2-9 and Handoff; added
  new Phase 5b. No code, schema, or `/data` changes made — this session only
  updated the migration-kit instructions. Nothing has been executed.

## Open questions / blockers
- **`checkAccess()` has no `site_admin` bypass for `restricted` resources**
  (found reading `functions/_lib/access.js` during Phase 5; not fixed there —
  out of scope, Phase 4 already closed). Contradicts `ACCESS-MODEL.md` §8
  ("site_admin: yes (all)" for restricted resources) — a `site_admin` with no
  direct/org entitlement would get a false 403. Zero live impact today (no
  `/data` resource is currently `client`/`restricted`), but fix before Phase
  8 (downloads use the same `restricted` path) or before the first real
  `restricted` resource is authored, whichever comes first.
- **RESOLVED — `assets/ToolBox.glb` compressed and redeployed** (38.15 MB →
  11.46 MB; see session log for the exact method). **Still needs the user to
  visually confirm the compressed textures look acceptable at the hex-4
  slot's display size** — structural validity and unchanged geometry are
  confirmed, actual rendered quality is not (needs eyes, not a CLI check).
  True original preserved at
  `.../scratchpad/glb-work/ToolBox.original.glb` (session temp dir, not
  durable — worth relocating if it might be needed again).
- **Pre-existing, unrelated bug found incidentally:**
  `data/site/settings.json`'s Vision Pro `spatialBackdrop` references
  `models/DTS_Studio_Interior_VisionPro_V2.1.usdz` (with a `.1`) but the real
  file on disk is `DTS_Studio_Interior_VisionPro_V2.usdz` (no `.1`) — already
  404s on the CURRENT live GitHub Pages site, predates this migration. Not
  fixed (out of Phase 1's "deploy as-is" scope) — flag for whenever it makes
  sense to fix, migration-related or not.
- **GIS maps are a whole-document gate, not a field-level one.** Confirmed by
  reading `js/gis/gis-viewer.js:311-317` — `DTSGis.mount()` takes the entire
  `gisMap` document, sourced today from `cfg.gisMaps[mapId]` in the
  unconditionally-fetched `DTS_CONFIG`. Phase 4/6 must withhold the whole
  `gisMap`/`gisTour`/`gisFeatureTour` document set from `data/current/` for a
  gated map (not strip a field within it) and resolve it via
  `/api/resource/gismap.<mapId>` — see `ACCESS-MODEL.md` §5. Verify with
  `USER-ACCESS-MIGRATION-TESTING.md` test 5b.
- **Second half of the same gap: `iberia-coastal`'s 5 local shoreline/
  boundary `.geojson` layer files** (`data/gis/layers/*.geojson`) are fetched
  directly by `js/gis/gis-viewer.js:170`, independent of the map document and
  of `DTS_CONFIG` entirely — gating the map document alone does not stop a
  guest who knows the file path. Phase 4 adds
  `/api/resource/gismap/[mapId]/layer/[layerId].js` and Phase 6 routes these
  6 files to `data/source/`, never `data/current/`, with the map resolver
  rewriting `layers[].url` to the authenticated route (zero changes to
  `gis-viewer.js` itself). Verify with
  `USER-ACCESS-MIGRATION-TESTING.md` test 5c.
- **`js/config.js` is a third leak surface and the easiest to miss.** It is
  the `/data`-unreachable fallback, injected dynamically rather than via a
  `<script>` tag (`content-loader.js:367-375`), so it never appears in a
  normal page-load network trace — but it is a deployed static file holding
  16 `spaces.dtsxr.com` tour URLs and 46 Vimeo references for all 16
  projects. `curl https://<site>/js/config.js` returns every gated target
  unless it is stripped alongside `data/current/`. Phase 4 strips it (or
  verifies the strip), Phase 6 folds it into `split-content.mjs`. Must be
  RE-verified whenever `config.js` is regenerated, since `CLAUDE.md` directs
  keeping it in sync with `/data` and that sync is what would re-add the
  URLs. Verify with `USER-ACCESS-MIGRATION-TESTING.md` test 5d.
- **`js/config.js` has no `access` field anywhere and its strip step is
  access-blind** — `strip-public-data.mjs`'s config.js section unconditionally
  strips every example's `tourUrl`/`embedUrl`/`watchUrl`, regardless of the
  real access level in `/data`. Harmless while everything was `registered`
  (that's the correct strip either way), but now that 9 Vimeo experiences are
  `public` in `/data` (see 2026-08-08 session entry), the fallback is
  stricter than the real data — only matters if `/data` fails to load AND the
  site falls back to `config.js` AND a guest opens one of those 9 videos in
  that degraded state. Needs an `access` field added to `config.js` per
  example and the strip step updated to check it, mirroring the `/data`
  logic already in the same script.
- Whether an `org_admin`'s invite should be restricted to specific email
  domains — currently unrestricted (DTS issues client addresses on its own
  domain), rate-limited + audited server-side. Revisit at Phase 5b if abuse
  becomes a concern.
- `data/projects/emergency.json` exists on disk but is absent from
  `data/manifest.json` — Phase 3's backfill script must ask before deciding
  whether to register or leave it out.
- Confirm Supabase free-tier auth email volume covers org-admin invites at
  real client scale before handoff (see `00-VERIFY-FIRST.md`).

## Account inventory (fill in as you go — NEVER put secret values here)
- Dev Cloudflare account: ____
- Dev Supabase project URL: ____  (anon key lives in js/supabase-init.js)
- Domain (dev *.pages.dev or real): ____
- Client Cloudflare account (handoff): ____
- Client Supabase project (handoff): ____
