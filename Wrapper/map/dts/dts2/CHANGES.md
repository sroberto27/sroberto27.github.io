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

---

# Desktop audit pass — `Desktop Web.svg` (20 frames @ 1920×1080)

**Viewport interpretation:** every clipped design frame measures
7680×4320 SVG units at a 16:9 ratio — exactly **4× a 1920×1080 CSS
viewport** (the same 4× export density the mobile board used). All
desktop work targets 1920×1080 and holds 1024–1920.

## Frame inventory (clip-path id → screen)
- clip7  Home hero (Education underlined, gold CTA, evidence row, light
  question bar, light cookie card bottom-right)
- clip10 Twin revealed, CTA gold-filled ‖ clip15 content panning away,
  "Explore your world below" ‖ clip20 final: glass card top-left +
  top-centre "Close Digital Twin"
- clip21/23/25/27 Category screens — Education / Industry / Government /
  Community: full-width sector band with sublabels, left intro +
  VIEW {SECTOR} PROJECTS, 2×2 accent cards, right Contact & Info tab,
  dock tab rail
- clip38 Contact panel (PLAN / PROPOSE / PILOT)
- clip33 Access Your Twin login popup (charcoal, Welcome Back!)
- clip1  {SECTOR} BASED PROJECTS full-screen mosaic
- clip2–clip6 Example window ("Solar Farm Sample"): live pane + title
  row with gold CTAs, chips rows, PROJECT EVIDENCE band, Photos and
  Video mosaic, "More from {Sector}", gold FAB, gold circular close
- clip36/clip37 Client portal desktop — HOME tile dashboard / All APPS
  grid, light top bar with centred client logo + Sign out
- clip29/clip31 Annotation frames: "Within a pop up no reload of
  webpage" — satisfied by the existing SPA overlay architecture.

## What changed
- **config.js** — sector copy aligned to the board: Industry is now
  "Commercial & Industrial / Digital Twin of your company", Government
  "Public & Civic / …your city", Community "Civic & Social / …your
  community", with the board's body paragraphs and all 16 card
  titles/blurbs. New sub-verticals Healthcare Facilities (industry) and
  Civic Services (government) use clearly-flagged illustrative
  examples; Properties & Places inherits the hospitality example.
  `navSub` (Campus/Company/City/Community) and dock `short` labels
  (Automotive, Sustainability) added.
- **Home** (per stakeholder review, the original hero is kept): the
  hexagon cluster and the blue arrow-burst behind "Try a Digital Twin"
  remain and stay responsive via their clamp() sizing; the evidence row
  takes the board treatment (spread, no rule, `#FF9D00` dots); light
  question bar; light cookie card with grey pill buttons.
- **Category** (per stakeholder review): the sector menu stays in the
  header exactly as on the main screen — the board's full-width band
  was built and then removed at review; the original blurred backdrop,
  card styling, and the VERTICAL gold "Contact & Info" edge tab are
  kept (the phone tab is now vertical + compact too). "Use Cases" dock
  tab stays title-case with the grey active fill.
- **Twin states** (per stakeholder review): the original top-left
  "Exit experience" pill and translucent glass hero card are kept.
- **Contact panel**: plain centred desktop layout (no card chrome),
  uppercase outlined/gold CTAs per the board.
- **Access Your Twin**: desktop is the board's wide charcoal popup —
  brand block left, `#303030` form card right, `#FFBA00` Login In.
- **Example window**: near-fullscreen board layout — project name as
  the title, gold "Enter Twin" / "Contact Us about this" + square
  open-in-new-tab button, Captured-with/Platform chip rows, PROJECT
  EVIDENCE band with outlined chips and grey evidence tiles, Photos
  and Video mosaic, "More from {Sector}" cards (open sibling
  examples), gold back-to-top FAB, gold circular close.
- **Projects window**: full-screen desktop mosaic (tall / stacked /
  tall) matching clip1.
- **Client portal**: desktop `#1D202E` shell, horizontal HOME / APPS /
  Manage / Support links, centred client-logo block, asymmetric HOME
  tile grid (incl. a new Manage tile), 3-up All APPS card grid.
- Tokens: `--bg #070E18`, `--bg-2 #0A1525`, `--gold #C49A2A`.

## Verified
Headless jsdom harness (`test.js`): **70/70 checks, zero runtime
errors** — boot, band + pillar states, all four category screens
(titles, subs, card sets, VIEW-PROJECTS labels), dock short labels,
example window (title source, CTAs, 5 evidence chips, More-from cards,
FAB), contact stages/CTAs/fineprint, projects mosaic, hero hexagons +
arrow-burst, twin open/close, login → portal → nav links → sign-out
(**61/61 after the review reverts**). CSS
parses clean (css-tree). Pixel screenshots could not be captured (no
modern browser binary in this environment); layout was verified
structurally. The Vision Pro spatial-website CTA and
`vision-pro-spatial.js` are untouched, per requirements.
