# Digital Twin Studios — Website

Marketing and client-access site for Digital Twin Studios (DTS). A
single-page, app-style experience: fixed viewport, no long scroll,
with a live embedded Treedis digital-twin showcase, sector content for
Education / Industry / Government / Community, lead-capture forms, and
a lightweight client sign-in ("Access Your Twin").

Plain HTML + CSS + vanilla JavaScript. No build step, no framework,
no backend — it runs anywhere static files can be served, including
GitHub Pages.

## Quick start

```
# Option 1: open directly
open index.html

# Option 2: serve locally (recommended — matches production behaviour)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Deploying is just pushing the files: the site currently lives on
GitHub Pages under `sroberto27.github.io`.

## Project structure

```
index.html              App shell — all views/overlays are in this one page
README.md               This file
docs/
  CHANGES.md            Changelog
css/                    Stylesheets, loaded in numeric order (see below)
  01-base.css           Tokens, reset, app shell, top nav, stage, home base
  02-home.css           Hex cluster, primary CTA, twin reveal layer
  03-category.css       Sector view, card slider, dock bar
  04-overlays.css       Shared overlays, lead-form modal, cookie card
  05-mobile-nav.css     Burger, nav drawer, sector pager (mobile chrome)
  06-example-window.css Example window (per sub-vertical)
  07-access.css         Access Your Twin + question-bar answer popover
  08-responsive.css     Breakpoint stacking (phone → tablet → desktop)
  09-mobile.css         Mobile components + ≤760px fidelity overrides
  10-vision-pro.css     Apple Vision Pro spatial CTA
  11-desktop.css        Desktop (≥761px) refinements
  12-smoke.css          Home pointer-particle canvases
js/                     Scripts, loaded in dependency order
  config.js             ALL site content and settings — edit here first
  clients.js            Client directory for Access Your Twin
  tour-bridge.js        Treedis postMessage bridge (protocol contract)
  app.js                Main application logic (state machine, UI)
  smoke-depth.js        Decorative pointer-smoke effect
  vision-pro-spatial.js visionOS spatial-website instructions toggle
assets/                 All site imagery (incl. assets/portfolio/)
models/                 3D assets (Vision Pro .usdz)
```

**Migration note (first deploy of this structure):** `index.html` now
loads styles from `css/` and scripts from `js/`. After copying these
files into the repo, delete or archive the superseded root-level
files — `styles.css`, `script.js`, `config.js`, `dts-clients.js`,
`dts-tour-bridge.js`, `smoke-depth.js`, `vision-pro-spatial.js` —
they are no longer referenced. Then move these nine images from the
repo root into `assets/` (the code now expects them there):
`assets-logo.png`, `assets-cta-arrow.png`, `CubeLogo.png`,
`InteractiveCities.png`, `assets-droplet.jpg`, `VirginHotel.png`,
`assets-wave.jpg`, `assets-category-bg.jpg`, `logBackground.png`.
Leave `assets/portfolio/` and `models/` where they are.

## How it works

**App shell, not pages.** `js/app.js` runs a small state machine:
the home and category views are swapped via JS state (never scroll),
and everything else — example windows, lead forms, sign-in, client
portal, sector projects — layers over the shell as overlays.

**One live Treedis iframe.** The showcase iframe is created once at
boot inside the home demo stage. Overlays that need it *move the same
iframe in the DOM* and return it on close, so the Treedis session and
bridge handshake are never reset. Communication happens over
`postMessage` via `js/tour-bridge.js` — the message `type` strings and
ping cadence in that file are the contract Treedis expects; don't
change them.

**Config-driven content.** Nearly every piece of copy, navigation,
form, and example-window content lives in `js/config.js`. Most content
changes never touch `app.js` or the HTML.

**Script load order matters** (declared at the bottom of
`index.html`): `config.js` and `clients.js` define globals, then
`tour-bridge.js`, then `app.js` boots the UI, then the decorative
extras. Keep that order if you add scripts.

**CSS order matters too.** The stylesheets are numbered because later
files intentionally override earlier ones (e.g. `09-mobile.css` and
`11-desktop.css` win over base rules). Add new rules to the file that
matches their scope, and don't reorder the `<link>` tags.

## Common tasks

**Edit copy, sectors, cards, or FAQ answers** — `js/config.js`.
Sectors live in `categories`, the 16 example windows in `examples`
(keyed by card id), question-bar answers in `answers`.

**Point the site at a different Treedis showcase** — set
`treedis.tourUrl` and `treedis.origin` in `js/config.js`.

**Lead-form email delivery** — forms email the owner via Web3Forms
(no backend). `lead.accessKey` and `lead.ownerEmail` in
`js/config.js` control routing; register a new key at
https://web3forms.com if the destination inbox changes. Without a
key, forms fall back to a pre-filled `mailto:` link.

**Manage client sign-ins (Access Your Twin)** — the directory is a
published Google Sheet read as CSV. Setup steps, the demo login
(`demo` / `1234`), and an important security note are documented at
the top of `js/clients.js`. In short: a published sheet is publicly
readable, so treat the access code as a members-only gate, not real
security, and never put sensitive data in the sheet.

**Swap the hero hexagon imagery** — in `index.html`, swap the
`url()` values between the `hex-1`…`hex-4` spans; positions and sizes
stay put.

**Vision Pro CTA** — shown only in real Safari (`app.js` adds
`body.is-safari`). The spatial backdrop is declared via
`<link rel="spatial-backdrop">` in the head; the hero button only
toggles instructions, since Safari opens the environment from its
own Page Menu.

## Conventions

- Vanilla JS only; `app.js` is deliberately a single file — it is one
  state machine with shared state, organized by the section headers
  listed in its top comment.
- Everything sizes with `clamp()` and fr-based grids so the UI fills
  any viewport with no dead space.
- All imagery lives in `assets/`; CSS references it with `../assets/`
  since the stylesheets live in `css/`.
