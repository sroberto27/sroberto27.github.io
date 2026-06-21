# Digital Twin Studios — Website Prototype (v0)

A static, app-shell prototype of the dtsxr.com redesign — *The World as Interface*.
Built on plain **HTML / CSS / JavaScript** (no frameworks, no build step) so it runs
directly from disk or any static host (GitHub Pages, Netlify, etc.).

## Run it
Open `index.html` in a browser. No server required.
(For the Treedis iframe to load, an internet connection is needed.)

## Files
| File | Purpose |
|------|---------|
| `index.html` | App shell — top nav, stage (home + category views), dock bar, overlays, cookie. |
| `styles.css` | All styling. Dark navy/black, gold accent, fixed rounded viewport. |
| `script.js` | State machine — pillar switching, category render, demo/contact modals, question bar, cookie, animated background. |
| `config.js` | Treedis settings + all category/contact content. **Edit copy here.** |
| `dts-tour-bridge.js` | The Treedis `postMessage` bridge, **preserved from the SCSU wrapper** (`js/03-tour-bridge.js`). Same protocol and ping/ready handshake. |

## States implemented
1. **Home** — "Digital twins for Human Life." headline, demo frame, evidence strip, question bar, cookie disclosure.
2. **Category** — click Education / Industry / Government / Community. Education is the most complete. Left intro + use-case cards + bottom tabs + evidence filters.
3. **Demo open** — click the demo frame or *Try a Digital Twin* → large centred overlay with the Treedis experience; app shell stays visible behind it.
4. **Contact** — *Access Your Twin*, the swipe hint, or *View Projects* → "Begin with the right first step." with three CTAs (Request a Proposal is the gold primary).

Navigation is driven by **JS state, not scrolling**.

## Where real Treedis / data still connects
- **`config.js → treedis.tourUrl` / `treedis.origin`** — currently point at the SCSU showcase (`spaces.dtsxr.com/tour/8e4ca3fc`) so the demo shows a live tour out of the box. Replace with the DTS demo showcase.
- **`config.js → treedis.homeSweepId`** — set a sweep id to land users somewhere specific on load.
- **Per-sub-vertical sweeps** — use-case cards currently all open the same demo. To target a specific sweep per card, add a `sweepId` to each card in `config.js` and pass it through `openDemo()` → `TourBridge.navigateToSweep(sweepId)` in `script.js`.
- **Client portal** — `accessTwin` button currently opens the contact view; `config.clientPortalUrl` is the placeholder for the real authenticated portal (kept architecturally separate from the marketing site, per the rationale).
- **Question bar** — `#qbar` submit handler logs the question; connect to a real assistant endpoint there.

## What was preserved from the existing wrapper
`dts-tour-bridge.js` keeps the SCSU wrapper's exact Treedis protocol — `Ping` /
`Navigate` / `RequestSweeps` outbound, `TourReady` / `PoseChanged` / `SweepsChanged` /
`Tag*` inbound, the 2s ping cadence, and the 600ms post-`TourReady` defer before
acting. The original SCSU files were **not modified** — this prototype lives in its
own folder alongside them.
