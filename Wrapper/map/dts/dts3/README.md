# Digital Twin Studios — Website

Marketing and client-access site for **Digital Twin Studios (DTS)**, dtsxr.com. A single-page, app-style experience: fixed viewport, no long scroll, with a live embedded Treedis digital-twin showcase, sector content for Education / Industry / Government / Community, lead-capture forms, a lightweight client sign-in ("Access Your Twin"), and a built-in **Admin Board** (mini CMS) for editing all site content.

Plain HTML + CSS + vanilla JavaScript. No build step, no framework, no backend — it runs anywhere static files can be served (currently GitHub Pages under `sroberto27.github.io`).

---

## Quick start

```bash
# Serve locally (recommended — matches production and lets /data load)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Opening `index.html` directly over `file://` also works, but the `/data` JSON content can't be fetched, so the site falls back to the baked-in content in `js/config.js`.

Deploying = pushing the files to the GitHub Pages repo. Nothing to build.

---

## What the site does (features)

- **Home view** — hero with hex-image cluster, the "Try a Digital Twin" CTA, a live Treedis tour embedded in the demo stage, and a question bar with FAQ-style answers.
- **Four sector views** — Education, Industry, Government, Community. Each has intro copy, a card slider of sub-verticals (16 in total), and a dock bar (Use cases / Evidence / Projects).
- **Example windows** — clicking a card opens a per-sub-vertical overlay with an overview, a featured project, media (Treedis tour, Vimeo video, or gallery), links, and evidence tabs.
- **Full-screen twin experience** — a centre-out reveal that expands the same live Treedis iframe to fill the screen.
- **Lead forms** — Discovery call, Proposal, and Pilot request forms. Delivery is via Web3Forms (no backend); if that fails or no key is set, a pre-filled `mailto:` link is the fallback.
- **Access Your Twin** — client sign-in backed by a published Google Sheet (read as CSV). Successful sign-in opens a **client portal** (tiles, app list per twin, Manage/Support panels).
- **Admin Board (mini CMS)** — signing in with an admin account opens a content editor instead of the portal. Edit → preview instantly → export the `data/` folder → commit to publish. See "For content administrators" below.
- **Vision Pro support** — a spatial-website backdrop (`<link rel="spatial-backdrop">`) with a hero button that shows step-by-step visionOS instructions (Safari only).
- **Decorative extras** — pointer-smoke particle canvases on the home view, cookie notice card, mobile burger/drawer navigation and sector pager with swipe.

---

## Project structure

```
index.html              App shell — every view and overlay lives in this one page
README.md               This file
docs/CHANGES.md         Changelog

css/                    Stylesheets, loaded in numeric order (later files override earlier)
  01-base.css           Tokens, reset, app shell, top nav, stage, home base
  02-home.css           Hex cluster, primary CTA, twin reveal layer
  03-category.css       Sector view, card slider, dock bar
  04-overlays.css       Shared overlays, lead-form modal, cookie card
  05-mobile-nav.css     Burger, nav drawer, sector pager (mobile chrome)
  06-example-window.css Example window (per sub-vertical)
  07-access.css         Access Your Twin + question-bar answer popover
  08-responsive.css     Breakpoint stacking (phone → tablet → desktop)
  09-mobile.css         Mobile components + ≤760px overrides
  10-vision-pro.css     Apple Vision Pro spatial CTA
  11-desktop.css        Desktop (≥761px) refinements
  12-smoke.css          Home pointer-particle canvases
  13-admin.css          Admin Board (mini CMS)

js/                     Scripts, loaded in dependency order
  config.js             Fallback content + settings (legacy shape app.js expects)
  clients.js            Client directory fallback + sign-in copy for Access Your Twin
  tour-bridge.js        Treedis postMessage bridge — protocol contract, don't change
  content-loader.js     Hydrates the site from /data JSON (or an admin draft), then injects app.js
  app.js                Main application logic (state machine, all UI)
  admin.js              Admin Board (mini CMS)
  smoke-depth.js        Decorative pointer-smoke effect
  vision-pro-spatial.js visionOS instructions toggle

data/                   ALL live site content, as JSON documents
  manifest.json         Index of every document — the loader and Admin Board read this
  site/settings.json    Brand, Treedis showcase URL, global settings
  site/lead.json        Web3Forms key + owner email for lead delivery
  pages/                home.json, contact.json
  sectors/              education / industry / government / community
  projects/             16 sub-vertical documents (campus, workforce, energy, …)
  forms/                discovery / proposal / pilot lead-form definitions
  faq/answers.json      Question-bar answers
  access/access.json    Sign-in UI copy, directory source, adminUsers
  media/library.json    Media library

assets/                 All site imagery (incl. assets/portfolio/)
models/                 3D assets (Vision Pro .usdz)
```

---

## How it works (architecture)

**App shell, not pages.** `js/app.js` runs a small state machine: home and category views are swapped via JS state (never scroll). Everything else — example windows, lead forms, sign-in, client portal, Admin Board — layers over the shell as overlays.

**Content pipeline.** On boot, `content-loader.js`:
1. Checks localStorage for an Admin Board draft (`dtsAdminDraft`). If present, it renders the site from the draft — that's how instant preview works.
2. Otherwise it fetches `data/manifest.json` and every document it lists, converts them into the legacy `window.DTS_CONFIG` shape that `app.js` expects, and applies home-page content to the DOM.
3. If `/data` is unreachable (e.g. `file://`), it falls back to `js/config.js`.
4. It then injects `app.js`, `smoke-depth.js`, `vision-pro-spatial.js`, and `admin.js`.

**One live Treedis iframe.** The showcase iframe is created once at boot inside the home demo stage. Overlays that need it *move the same iframe in the DOM* and return it on close, so the Treedis session and bridge handshake are never reset. Communication is `postMessage` via `js/tour-bridge.js` — the message `type` strings and ping cadence there are the contract Treedis expects; **do not change them**.

**Load order matters.** Scripts at the bottom of `index.html` load in this exact order: `config.js` → `clients.js` → `tour-bridge.js` → `content-loader.js` (which injects the rest once content is ready). CSS files are numbered because later ones intentionally override earlier ones. Don't reorder either list.

**Media convention.** Any image/video/model reference in `/data` uses `source: { kind, value }` — `kind: "path"` for files inside the site folder, `kind: "url"` for external links. Renderers must support both.

---

## For content administrators

You do **not** need to touch code. Almost everything you'd want to change — copy, sectors, project cards, FAQ answers, form fields, images — is edited through the **Admin Board**:

1. Open the site and click **Access Your Twin**.
2. Sign in with an **admin account** (defined in `data/access/access.json` → `adminUsers`, or a Google Sheet row whose `client` is "admin"). The Admin Board opens instead of the client portal.
3. Edit any document in the board.
4. **Save draft & preview** — the site reloads and shows your changes instantly (only on your browser; nothing is published yet).
5. **Export data folder** — downloads `data.zip`. Send it to whoever manages the repo (or replace the repo's `data/` folder yourself and push). That is publishing.
6. **Discard draft** — throws away your changes and goes back to what's live.

Other routine tasks:

- **Client sign-ins** — edit the published Google Sheet (columns: `access_id, access_code, client, project, twin_url, sweep_id, notes`; one row per twin). The site picks it up on next load. Demo login: `demo` / `1234`. ⚠️ A published sheet is publicly readable — the access code is a members-only gate, **not** real security. Never put sensitive data in it.
- **Where lead emails go** — `data/site/lead.json` holds the Web3Forms `accessKey` and `ownerEmail`. To change the destination inbox, register a new free key at web3forms.com and update both fields (through the Admin Board or the file).
- **Change the featured tour** — `data/site/settings.json` → `treedis.tourUrl` and `treedis.origin`.

---

## For developers

**Stack & philosophy.** Vanilla JS only, deliberately. `app.js` is a single file — one state machine with shared state, organized by the section headers in its top comment. Everything sizes with `clamp()` and fr-based grids so the UI fills any viewport with no dead space. CSS references imagery with `../assets/` (stylesheets live in `css/`).

**Key files to read first:** `content-loader.js` (how content gets in), `app.js` top comment (what the state machine covers), `tour-bridge.js` (the Treedis contract), `admin.js` top comment (the CMS editing model).

**Adding content types / documents:** add the JSON file under `data/`, register it in `data/manifest.json`, and teach `content-loader.js` how to map it into `DTS_CONFIG` if it's a new type. The Admin Board discovers documents from the manifest automatically.

**Adding a sector card / sub-vertical:** add a card entry to the sector's document in `data/sectors/`, add a matching project document in `data/projects/` (keyed by the card `id`), and register the project file in the manifest.

**Admin auth:** `admin.js` intercepts the sign-in submit in the capture phase before `app.js` sees it, when credentials match an admin account. Admin accounts come from `data/access/access.json` (`adminUsers`) or a directory row with `client: "admin"`. Export uses JSZip from cdnjs, with per-file downloads as fallback.

**Upgrading client auth:** the sheet-based sign-in is intentionally light. To use a real auth provider, replace `authenticate()` in `js/app.js` — nothing else needs to change.

**Do-not-break list:**
- Script and CSS load order in `index.html`.
- `tour-bridge.js` message types and ping cadence (Treedis contract).
- The single-iframe pattern — never create a second Treedis iframe; move the existing one.
- The `DTS_CONFIG` legacy shape that `content-loader.js` produces — `app.js` depends on it.
- localStorage keys `dtsAdminDraft` and `dtsAdminSession`.

**Testing checklist after changes:** home ↔ sector switching, one example window per sector, "Try a Digital Twin" reveal open/close (tour must not reload), a lead form send (and mailto fallback with the key removed), sign-in with `demo`/`1234`, admin sign-in → draft → preview → discard, mobile drawer + swipe, and a Safari check for the Vision Pro CTA.

---

## Technical reference

### Runtime globals

- `window.DTS_CONTENT` — the raw `/data` documents (`{ manifest, docs, fromDraft }`, keyed by file path e.g. `docs["sectors/education.json"]`). This is what the Admin Board edits in place.
- `window.DTS_CONFIG` — the legacy config shape built from those documents by `buildConfig()` in `content-loader.js`. This is what `app.js` reads. If `/data` is unreachable, it's whatever `js/config.js` defined.
- `window.DTS_CLIENTS` — sign-in directory config from `js/clients.js`.
- `TourBridge` — the Treedis bridge singleton from `js/tour-bridge.js`.

### Loader mapping (data → DTS_CONFIG) — read before adding fields

`buildConfig()` only copies the fields it knows about. **Adding a field to a JSON document does nothing until you also map it in `content-loader.js` and render it in `app.js`.** Notable quirks:

- Sector `cards[].projectId` becomes card `id` in the config — the card id must match a project document's `id`, which is the key into `cfg.examples`.
- Project `media._type: "video"` maps to config `type: "vimeo"` with `embedUrl`/`watchUrl` taken from `source.value`. `_type: "treedis"` maps through with `tourUrl`/`origin`. Any other `_type` is dropped.
- Sectors are ordered by their `order` field, not by manifest order.
- `pages/home.json` is applied straight to the DOM by `applyHome()` (headline supports one line break written as `\n`; `hexCluster[].slot` must match a `.hex.<slot>` element in `index.html`).
- Lead forms are discovered by `_type: "leadForm"` anywhere in the docs, keyed by their `id` (`discovery`, `proposal`, `pilot`).

### Document schemas (essentials)

- **sector** (`sectors/*.json`): `id, label, navSub, blurb, active, accent, kicker, title, sub, body, order, cards[{projectId, title, text, short?}]`.
- **project** (`projects/*.json`): `id, sectorId, title, tagline, overview, project{name, kind, illustrative, blurb}, capturedWith, platform, media?, links[{label, url}], gallery[{source, alt}], sweepId, evidence{Case Studies, Awards, Client Feedback, Press & Research, Project Data}`.
- **media convention** (everywhere): `source: { kind: "path" | "url", value }` — `path` is relative to site root, `url` is external. Renderers must support both.
- **leadForm** (`forms/*.json`): `id, title, intro, submitLabel, fields[]`.
- **faqCollection** (`faq/answers.json`): `items[{match[], q, a}]` — `match` strings are matched against the question-bar input.
- **accessConfig** (`access/access.json`): sign-in `ui` copy, `directorySource`, and `adminUsers[{access_id, access_code}]` for the Admin Board.

When in doubt, copy an existing document of the same `_type` — it is the schema.

### TourBridge API (`js/tour-bridge.js`)

```js
TourBridge.initialize(iframeEl, { origin, defaultTransitionTime, onReady, onPoseChanged })
TourBridge.reset()                      // re-arm after changing iframe src to another tour
TourBridge.isReady                      // true after TourReady received
TourBridge.navigateToSweep(sweepId, { transitionTime?, rotation? })
TourBridge.warmSweep(sweepId)           // instant jump (transitionTime 0) for hidden pre-warm
TourBridge.requestSweeps()
```

Protocol: outbound `Ping` / `Navigate` / `RequestSweeps`; inbound `TourReady` / `PoseChanged` / `SweepsChanged` / `TagClicked|TagFocused|TagDocked|TagHovered` (the tag events are currently no-op hook points for future custom handling). The bridge pings every 2s until `TourReady`, defers `onReady` by 600ms (the showcase SDK needs it), and validates inbound `event.origin` against the configured origin. **These type strings and the ping cadence are Treedis's contract — don't change them.** After swapping the iframe to a different tour URL, always call `reset()`.

### Troubleshooting

- **Site shows old/wrong content locally** — an Admin Board draft may be active. Check the console for `[content] admin draft active`, then discard the draft in the board or clear localStorage key `dtsAdminDraft`.
- **Content edits in `/data` have no effect** — the document isn't registered in `data/manifest.json`, a draft is overriding disk, or the field isn't mapped in `buildConfig()`.
- **Tour won't respond to Navigate** — the bridge isn't ready (check for `[treedis] TourReady` in console), or `reset()` wasn't called after changing the iframe src, or the sweep id doesn't exist in that tour.
- **Site falls back to `js/config.js`** — console shows `[content] /data unavailable`. Usually means it's opened over `file://`; serve with `python3 -m http.server`.
- **Lead form always opens the mail app** — Web3Forms send failed or `accessKey` is empty in `data/site/lead.json`; check the network tab for the `api.web3forms.com` response.
- **Admin Board doesn't open on sign-in** — credentials don't match `adminUsers` in `data/access/access.json` (or a sheet row with `client: "admin"`), or `/data` didn't load so `admin.js` disabled itself (console: `[admin] /data content not loaded`).

## Conventions

- Vanilla JS, no dependencies at runtime (JSZip is fetched from cdnjs only inside the Admin Board export).
- Numbered CSS files: add new rules to the file matching their scope; never reorder links.
- All imagery lives in `assets/`; JSON media references use the `{ kind, value }` source convention.
- `js/config.js` and `js/clients.js` are **fallbacks** — keep them roughly in sync with `/data` when making structural changes, but `/data` is the source of truth.
