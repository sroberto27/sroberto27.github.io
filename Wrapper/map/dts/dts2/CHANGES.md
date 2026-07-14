# DTS prototype — what changed & how to finish wiring it

These six files replace the homepage prototype set. Drop them in alongside
the existing assets and open `index.html`.

## Files
- `index.html` — added the example-window overlay, the Access-Your-Twin
  overlay (sign-in + dashboard), and the question-bar answer popover. Added
  `<script src="dts-clients.js">` before `script.js`.
- `script.js` — wired up everything that was a placeholder (details below).
- `styles.css` — styles for the three new components, plus their phone rules.
- `config.js` — your version, **plus** added: `examples` (16 sub-vertical
  windows), `answers` (FAQ replies for the question bar). Categories,
  contact, and lead forms are unchanged from your file.
- `dts-clients.js` — NEW. Client directory + sign-in config for Access Your Twin.
- `dts-tour-bridge.js` — unchanged (Treedis postMessage bridge).

## What now works (was placeholder before)
1. **The boot crash is fixed.** The old `config.js` defined `CAMPUS_CONFIG`;
   the app reads `DTS_CONFIG`. Your new config resolves it.
2. **16 example windows.** Every use-case card and every bottom dock tab opens
   a populated window (overview + example project + switchable evidence tabs +
   CTAs), styled after `experienceOpenedWindow.png`. Content comes from the
   design-rationale PDF. Three sub-verticals with no named client in the PDF
   (Healthcare Training, Manufacturing, Sustainability) use clearly-flagged
   "Illustrative example" copy — swap in real projects when you have them, in
   `config.js` under `examples`.
3. **Access Your Twin.** Top-right button opens a returning-client sign-in,
   then a small dashboard, then opens their twin. See setup below.
4. **Question bar** answers the five FAQ prompts inline.
5. **Evidence filters** (Case Studies / Awards / …) open the active sector's
   lead example focused on that proof type.

## To connect the LIVE Treedis showcase
In `config.js` → `treedis`: set `tourUrl` and `origin` to the real showcase.
Per-sub-vertical landing sweeps go in `config.js` → `examples.<id>.sweepId`.

## To connect lead emails
In `config.js` → `lead`: your Web3Forms `accessKey` and `ownerEmail` are
already set. (Tidy: the key line has a stray email pasted into the comment —
harmless, but worth cleaning.) Until a key validates, forms fall back to the
user's mail app.

## To set up Access Your Twin (the Google Sheet)
Open `dts-clients.js` — full instructions are in the header comment. Short version:
1. Make a Google Sheet with columns:
   `access_id | access_code | client | project | twin_url | sweep_id | notes`
   (one row per client).
2. File ▸ Share ▸ Publish to web ▸ that tab ▸ CSV ▸ Publish. Copy the URL.
3. Paste it into `sheetCsvUrl` in `dts-clients.js`.
Until then a built-in demo directory is used (try ID `demo`, code `1234`).

**Security, honestly:** a published sheet is publicly readable, so the access
code is a light members-only gate, not real security — which matches the
brief's note that twin data is public anyway. Don't put anything truly
sensitive in the sheet. To upgrade later, replace the single `authenticate()`
function in `script.js` with a real auth call; nothing else needs to change.

## Verified
A headless test (boot + every interaction) passes 29/29 checks with zero
runtime errors: all 4 sectors render, all 16 example windows open and populate
from cards and dock tabs, the FAQ answers, and the access flow logs in, shows
the dashboard, signs out, and rejects bad codes.

---

# Mobile audit pass — `Mobile Web.svg` (27 frames @ 360×780)

The Figma mobile board exports each frame at 1440×3120 SVG units =
exactly **4× a 360×780 CSS viewport** (Android-class phone; the 26px
status bar and 46px nav bar in the frames are phone chrome, leaving a
360×708 page area). All mobile work targets 360 and holds 320–480.

## What changed
- **Sector accents** unified to the board: education `#E9B44C`,
  industry `#2E8BFF`, government `#34598F`, community `#D27049`
  (kicker, dash, card titles, VIEW-PROJECTS button, drawer bar,
  sector strip, divider line, contact tab).
- **Nav drawer** (clips 13–16): left slide-in panel listing only the
  four sectors; active item is a full-width accent bar.
- **Home hero** (clips 8/9): hexagon cluster and the four evidence
  bullets are now shown on phones (they were hidden), question-bar
  restyled to the light pill with quoted rotating placeholder.
- **Cookie disclosure** (clip 0): light rounded card above the dock
  with grey Accept / Reject.
- **Category screens** (clips 17/31/32/33): sector-named
  "VIEW {SECTOR} PROJECTS" button, right-edge accent
  "Contact & Info / Click here" tab, dock-tab rail styling, and the
  redesigned sector strip (accent sector name + short sub, SWIPE
  diamond, next-sector peek, accent hairline).
- **NEW sector projects window** (clip 28): "{SECTOR} BASED PROJECTS"
  sheet, one card per sub-vertical project with Captured-with /
  Platform chips; each card opens that example window.
- **Contact panel** (clip 18): centred PLAN / PROPOSE / PILOT steps —
  stage label above each button, thin connector lines, gold primary.
- **Lead-form modals** (clips 19/21/25): field sets rebuilt to the
  board (Full Name + Phone, Email + Company, Country + time-frame
  selects two-up, textarea, uppercase gold submits: SCHEDULE A
  DISCOVERY / REQUEST A PROPOSAL / START MY PILOT REQUEST) with the
  board's placeholders; success state is now the REQUEST SENT /
  "Thanks for contacting us!" toast (clip 23).
- **Access Your Twin** (clip 1): rebuilt as the "Welcome Back!"
  login — Email + Password over light inputs, Remember me, Forgot
  password?, gold "Login In", "Don't have an account · Contact Us".
  The Email field maps onto the directory's access ID; the demo
  directory was empty and has been repopulated (demo / 1234).
- **NEW client portal** (clips 4/5/6): post-login full-screen layer —
  MENU / client-logo / Sign out header, HOME tile view, "All APPS"
  cards (one per twin), and the HOME/APPS/Manage/Support tile menu.
- **Twin experience** (clip 12): the glass hero card now sits
  top-left over the live view on phones.

## Verified
Headless jsdom harness: 74/74 checks, zero runtime errors — boot, the
drawer, all four category screens, projects window, contact steps,
all three form modals (labels, placeholders, pairing, submits),
success toast, the full sign-in → portal → sign-out flow, and misc
copy. Pixel screenshots could not be captured in this environment
(no browser binary); layout was verified structurally.
