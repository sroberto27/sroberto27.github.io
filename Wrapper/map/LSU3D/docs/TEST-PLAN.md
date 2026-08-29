# LSU3D — Full acceptance test plan

The single checklist for the whole gameday evolution, covering **Phase 1 (Make
It Useful)**, **Phase 2 (Make It Fast)** and **Phase 3 (hosting migration)**.

You run it by hand. Then a Claude session reads this filled-in file, triages
what failed, and fixes it — see `docs/plans/FULL-TEST-PROMPT.md`, or run
`/full-test`.

---

## How to fill this in

Put an `x` in exactly one of the three result columns per row.

| Column | Means |
|---|---|
| **Pass** | Did what the Expected column says. |
| **Fail** | Did something else. **Put what actually happened in Comments** — "next button did nothing" is fixable, "broken" is not. |
| **N/T** | Not tested. Skipped, no device for it, or the feature isn't built yet. |

Comments matter more than the ticks. Useful things to write: the exact text of a
console error, the URL you were on, which device/browser, whether it happened
every time or once, and anything that looked wrong even if the test technically
passed.

A row you are unsure about is a **Fail** with a comment saying why you're
unsure. A false pass costs more than a false fail.

---

## Before you start

```bash
cd Wrapper/map/LSU3D
python -m http.server 8000
```

Then open `http://localhost:8000`. **Serving over http is required** — the app
fetches its data with `fetch()` and there is no `file://` fallback.

Two things need HTTPS rather than localhost, so test them on the deployed site
(`https://sroberto27.github.io/Wrapper/map/LSU3D/`):

- Geolocation on a phone (§D)
- Service worker, once Phase 2 exists (§H)

**Keep the browser console open for the whole run.** A clean console is itself a
test, and a red error usually explains three failures at once.

Fill in the run header so results can be compared between runs:

| Field | Value |
|---|---|
| Date | |
| Tested by | |
| Commit / tag | |
| URL used | |
| Devices used | |

---

# Section A — Baseline regression

**Everything here worked before the gameday features existed. A failure in this
section is a regression and outranks every new-feature bug below.**

This is the checklist from `CLAUDE.md`, expanded into individual rows.

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| A1 | Load the app cold (hard refresh) | Splash appears, progresses, hides; app revealed | [x] | [ ] | [ ] | |
| A2 | First load ever (clear localStorage first) | Start-screen modal appears | [x] | [ ] | [ ] | |
| A3 | 2D map loads | DOTD aerial imagery visible, campus framed correctly | [x] | [ ] | [ ] | |
| A4 | Click a tour stop polygon on the map | Details panel opens, camera flies to it | [x] | [ ] | [ ] | |
| A5 | Click a row in the left rail locations list | Same stop selects, same as A4 | [x] | [ ] | [ ] | |
| A6 | Tour bar arrows step forward and back | Moves through all 10 stops, stops at each end | [ ] | [ ] | [x] | RETEST. Original run passed but the pill resized per stop name. Fixed in css/04-map-details.css: `.tour-pill` now has a fixed `width` instead of `max-width`, and `.tour-pill-status` flexes with `min-width:0` so the name ellipsises instead. Desktop only. Confirmed by reading code, NOT in a browser. |
| A7 | `←` / `→` keys | Same stepping as A6 | [x] | [ ] | [ ] | |
| A8 | Guided-tour pill and rail tour card | Progress stays in sync with the current stop | [x] | [ ] | [ ] | |
| A9 | Co-located stops 3–5 (Ops Facility) | Show as one cluster pin that expands | [x] | [ ] | [ ] | |
| A10 | Co-located stops 8–9 (stadium) | Show as one cluster pin that expands | [x] | [ ] | [ ] | |
| A11 | 2D→3D toggle | Terrain loads lazily, buildings extrude | [x] | [ ] | [ ] | |
| A12 | 3D badge with a Google key configured | Google tiles take over; badge reads "3D: Google" | [x] | [ ] | [ ] |It passed but since it is running local the 3d Google map does not load it loads the backup 3d simple but i am sure it work in the deploy version so this passed!|
| A13 | 3D with the Google key removed/invalid | Falls back cleanly; badge reads "3D: Simple" | [x] | [ ] | [ ] | |
| A14 | "Explore" CTA on every stop | Hidden everywhere (no Treedis sweeps exist yet) — info-only panel is correct | [x] | [ ] | [ ] | |
| A15 | Reference-overlay (OSM labels) toggle | Toggles on and off | [x] | [ ] | [ ] | |
| A16 | Imagery on/off toggle | Toggles on and off | [x] | [ ] | [ ] | |
| A17 | Learn tab | Switches to "coming soon" placeholder and back | [x] | [ ] | [ ] | |
| A18 | Burger menu → "How to use" | Reopens the coachmark walkthrough | [x] | [ ] | [ ] | it works but the how to use instructions do not match the current layout we can add this to the end once we finish full functioning site so we are sure that the instruction are up to date with final version|
| A19 | Burger menu settings toggles | Both persist across a reload | [x] | [ ] | [ ] | |
| A20 | Search box + autocomplete | Finds stops and places, selecting one works | [x] | [ ] | [ ] | |
| A21 | Filter chips | Filter the list correctly | [x] | [ ] | [ ] | |
| A22 | Recenter / fit button | Returns to the full campus view | [x] | [ ] | [ ] | |
| A23 | Console during all of the above | No errors | [x] | [ ] | [ ] | |

---

# Section B — Deep links and routing (Phase 1)

Test each URL by **pasting it fresh into the address bar and pressing Enter** —
not by clicking through the app. That is how a QR code arrives.

Base = `http://localhost:8000/` (or the deployed URL).

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| B1 | `?stop=lot-414-river-road-arrival` | Opens at stop 1, details open, camera there | [x] | [ ] | [ ] | |
| B2 | `?stop=board-the-charter-bus` | Opens at stop 2 | [x] | [ ] | [ ] | |
| B3 | `?stop=football-operations-facility` | Opens at stop 3 | [x] | [ ] | [ ] | |
| B4 | `?stop=tiger-tailgate-indoors` | Opens at stop 4 | [x] | [ ] | [ ] | |
| B5 | `?stop=registration` | Opens at stop 5 | [x] | [ ] | [ ] | |
| B6 | `?stop=tiger-walk-victory-hill` | Opens at stop 6 | [x] | [ ] | [ ] | |
| B7 | `?stop=lawton-room` | Opens at stop 7 | [x] | [ ] | [ ] | |
| B8 | `?stop=field-level-warmups` | Opens at stop 8 | [x] | [ ] | [ ] | |
| B9 | `?stop=kickoff-death-valley` | Opens at stop 9 | [x] | [ ] | [ ] | |
| B10 | `?stop=postgame-nicholson-gateway` | Opens at stop 10 | [x] | [ ] | [ ] | |
| B11 | `?stop=not-a-real-stop` | Brief message appears, full map opens normally, bad value removed from the address bar | [x] | [ ] | [ ] | |
| B12 | `?stop=Lawton%20Room` (name, not slug) | Still opens the Lawton Room | [x] | [ ] | [ ] | |
| B13 | No parameters at all | Behaves exactly as it did before deep links existed | [x] | [ ] | [ ] | |
| B14 | `?utm_source=x&fbclid=y` | Junk stripped from the address bar; app loads normally | [x] | [ ] | [ ] | |
| B15 | Click through 5 stops, then browser Back repeatedly | Steps back through the stops you visited | [x] | [ ] | [ ] | |
| B16 | Then browser Forward repeatedly | Steps forward again | [x] | [ ] | [ ] | |
| B17 | Select a stop, then refresh the page | Same stop reopens | [x] | [ ] | [ ] | |
| B18 | Select a stop, then close the details panel | `stop=` disappears from the address bar | [x] | [ ] | [ ] | |
| B19 | Bookmark a stop URL, reopen the bookmark later | Opens that stop | [x] | [ ] | [ ] | |
| B20 | Share button on a stop (desktop) | Copies a link **containing that stop**, button confirms "Link copied" | [x] | [ ] | [ ] | |
| B21 | Paste the copied link into a new tab | Opens the same stop | [x] | [ ] | [ ] | |
| B22 | Share button on a phone | Opens the native share sheet with the stop link | [x] | [ ] | [ ] | |
| B23 | `?src=qr` on any stop link | Works identically; `src=qr` kept in the address bar | [x] | [ ] | [ ] | |
| B24 | Generate a real QR code from a stop URL and scan it with a phone | Opens that stop on the phone | [x] | [ ] | [ ] | |
| B25 | Console during all deep-link tests | No errors | [x] | [ ] | [ ] | |

---

# Section C — My Gameday (Phase 1)

Uses `data/gamedays/sample-gameday.json`. **Its times are placeholders**, so
judge behaviour, not whether "2:15 PM" is the real time.

URL: `?g=sample-gameday`

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| C1 | `?g=sample-gameday` on desktop | Guided-tour card shows greeting, kickoff countdown, Now/Next, contacts | [x] | [ ] | [ ] | |
| C2 | The tour checklist in that card | Each stop shows its scheduled time | [x] | [ ] | [ ] | |
| C3 | Step through stops | Now/Next rows update to match | [x] | [ ] | [ ] | |
| C4 | Open any stop's details panel | Shows that stop's time and instruction | [ ] | [ ] | [x] | RETEST. A cold `?g=&stop=` deep link rendered the panel BEFORE the async itinerary arrived, so no time/instruction block appeared until something re-rendered it (your 3rd image). js/18-gameday.js now re-renders an open panel once the itinerary lands. The block stays display-only by design — nothing opens when tapped. |
| C5 | Step through several stops, watching the details panel | Only **one** instruction block, always the current stop's (not stacking up) | [x] | [ ] | [ ] | |
| C6 | `?g=sample-gameday&n=Jordan` | Greeting reads "Jordan, here's your gameday" | [ ] | [ ] | [x] | RETEST. FIXED (2nd attempt). Real cause was NOT contrast: .rail-list/.rail-tour/.rail-detail are three opaque absolutely-positioned layers stacked z-index 1/2/3 (css/03-sidebar.css), so selecting a stop raises the opaque details panel OVER the tour card holding the greeting. The summary is now also mounted in the details panel. Previous run: still not showing greeting, see second image. |
| C7 | Immediately check the address bar after C6 | `n=Jordan` is **gone** from the URL | [x] | [ ] | [ ] | this is the url after: http://localhost:8000/?g=sample-gameday&stop=lot-414-river-road-arrival|
| C8 | `?g=no-such-gameday` | Brief message; standard tour loads normally; no crash | [x] | [ ] | [ ] | |
| C9 | `?g=../../something` | Ignored; app loads normally | [x] | [ ] | [ ] | |
| C10 | Contacts block | Shows role and note; numbers are blank ("to be confirmed") in the sample | [x] | [ ] | [ ] | |
| C11 | Visit several stops, then reload with the same `?g=` | Visited stops still show as done | [x] | [ ] | [ ] | |
| C12 | Same, in a private/incognito window | Works, just doesn't remember between reloads — **no crash** | [ ] | [ ] | [ ] | |
| C13 | `?g=sample-gameday&stop=lawton-room` | Opens the itinerary **and** that stop | [x] | [ ] | [ ] | |
| C14 | `?g=sample-gameday` on a phone | Times/instructions visible in the details sheet; the tour card does **not** stack on top of the details sheet | [x] | [ ] | [ ] | |
| C15 | Set the device clock forward past kickoff, reload | Countdown says kickoff has passed rather than showing a negative number | [ ] | [ ] | [x] | |
| C16 | Set the device timezone to something else (e.g. Los Angeles), reload | Stop times still read as Baton Rouge wall-clock times (2:15 PM stays 2:15 PM) | [ ] | [ ] | [x] | |
| C17 | Console throughout | No errors | [x] | [ ] | [ ] | |

---

# Section D — Geolocation (Phase 1)

**Needs HTTPS or localhost.** The meaningful tests are on a real phone outdoors
— desktop geolocation is usually IP-based and will look "approximate".

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| D1 | Tap the locate button, allow permission | Blue dot appears at your position with an accuracy ring | [ ] | [ ] | [ ] | |
| D2 | Same, watching the map | Map flies to your position | [ ] | [ ] | [ ] | |
| D3 | Tap locate, **deny** permission | Clear message explaining location is off; **rest of the app keeps working** | [ ] | [ ] | [ ] | |
| D4 | Tap locate again after denying | Does **not** re-prompt; says location is still off | [ ] | [ ] | [ ] | |
| D5 | Reload and allow after previously denying | Works normally | [ ] | [ ] | [ ] | |
| D6 | Indoors / poor signal | Dot shows as dashed/hollow "approximate"; no distance figures quoted | [ ] | [ ] | [ ] | |
| D7 | On campus, outdoors | Dot is roughly where you actually are | [ ] | [ ] | [ ] | |
| D8 | Airplane mode / no signal | Message shown, no crash | [ ] | [ ] | [ ] | |
| D9 | Revoke permission mid-session in site settings | App keeps working, no crash | [ ] | [ ] | [ ] | |
| D10 | Desktop browser with no GPS | Either works via IP or says it can't — never silently nothing | [ ] | [ ] | [ ] | |
| D11 | Console throughout | No errors | [ ] | [ ] | [ ] | |
| D12 | **Off campus** (anywhere but LSU): tap locate, allow | Says you're not on campus yet, keeps the full campus view, no marker dropped | [ ] | [ ] | [ ] | Added after the JPEG/basemap work exposed this — testable from anywhere |
| D13 | Off campus: check the map afterwards | Camera stays on campus, does NOT sit clamped at an edge | [ ] | [ ] | [ ] | |
| D14 | On campus (or a spoofed location inside the campus bounds): tap locate | Normal blue dot behaviour, map flies to you | [ ] | [ ] | [ ] | DevTools → Sensors → Location can spoof this from anywhere |

---

# Section E — Live Visit Mode (Phase 1)

**Mobile-first. The real test is a phone, outdoors, on campus.** Test it on
desktop too, but a desktop pass does not mean this works.

URL: `?mode=live`

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| E1 | `?mode=live` | Top bar appears; browse chrome (search, chips, rail) hidden | [ ] | [ ] | [ ] | |
| E2 | "I'm on campus" button in the tour card | Enters the same mode | [ ] | [ ] | [ ] | |
| E3 | Bar contents | Shows you-are-here, current stop, next stop, progress | [ ] | [ ] | [ ] | |
| E4 | With location allowed, on campus | Next stop shows a distance, an arrow, and a walking time | [ ] | [ ] | [ ] | |
| E5 | Walk 100m toward the next stop | Distance decreases as you go | [ ] | [ ] | [ ] | |
| E6 | The direction arrow | Points at the next stop (map is north-up) | [ ] | [ ] | [ ] | |
| E7 | Next / Back buttons | Move through stops; Back disabled at stop 1, Next at stop 10 | [ ] | [ ] | [ ] | |
| E8 | At the last stop | Says it's the last stop rather than showing a broken "next" | [ ] | [ ] | [ ] | |
| E9 | "Full map" button | Leaves the mode; normal app returns intact | [ ] | [ ] | [ ] | |
| E10 | `Esc` key | Also leaves the mode | [ ] | [ ] | [ ] | |
| E11 | Address bar after leaving | `mode=live` removed | [ ] | [ ] | [ ] | |
| E12 | With `?g=sample-gameday&mode=live` | Scheduled times and a "Call staff" button appear | [ ] | [ ] | [ ] | |
| E13 | "Call staff" on a phone | Opens the dialler (blank number in the sample — check it doesn't crash) | [ ] | [ ] | [ ] | |
| E14 | Location denied, in Live Visit | Bar says distances unavailable; everything else still usable | [ ] | [ ] | [ ] | |
| E15 | Lock the phone for 2 minutes in Live Visit, unlock | Still working; no runaway battery drain | [ ] | [ ] | [ ] | |
| E16 | Leave Live Visit, then check battery/location indicator | Location tracking has stopped | [ ] | [ ] | [ ] | |
| E17 | Phone in bright sunlight | Bar is readable | [ ] | [ ] | [ ] | |
| E18 | One-handed use while walking | Buttons are reachable and big enough to hit | [ ] | [ ] | [ ] | |
| E19 | Desktop | Bar renders sensibly, not stretched across the whole screen | [ ] | [ ] | [ ] | |
| E20 | Console throughout | No errors | [ ] | [ ] | [ ] | |
| E21 | **Off campus** with `?mode=live` | Bar reads "NOT ON CAMPUS — previewing the route"; no distance, arrow or walking time shown | [ ] | [ ] | [ ] | Testable from anywhere |
| E22 | Off campus: the rest of the bar | Current stop, next stop, times and progress all still work | [ ] | [ ] | [ ] | |
| E23 | Spoof a location inside campus bounds, still in Live Visit | Switches to the normal state and distances appear | [ ] | [ ] | [ ] | DevTools → Sensors → Location |

---

# Section F — Kiosk mode (Phase 1)

Test on the actual display hardware if you have it.

URL: `?mode=kiosk` and `?mode=kiosk&autoplay=1`

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| F1 | `?mode=kiosk` | Large overlay, minimal chrome, paused | [x] | [ ] | [ ] | |
| F2 | `?mode=kiosk&autoplay=1` | Starts advancing on its own from stop 1 | [x] | [ ] | [ ] | |
| F3 | Watch a full cycle | Advances through all 10 stops, then loops to stop 1 | [x] | [ ] | [ ] | |
| F4 | Time between stops | Roughly 12 seconds (`config.gameday.kiosk.dwellMs`) | [x] | [ ] | [ ] | |
| F5 | Tap the screen while it's advancing | Pauses; play button shows paused state | [x] | [ ] | [ ] | |
| F6 | Leave it alone for 90 seconds after touching it | Resets to stop 1 and resumes on its own | [x] | [ ] | [ ] | |
| F7 | Play/pause button | Works both ways | [x] | [ ] | [ ] | |
| F8 | Prev/next buttons | Move one stop at a time | [x] | [ ] | [ ] | |
| F9 | Spacebar | Toggles play/pause | [x] | [ ] | [ ] | |
| F10 | First tap anywhere | Goes full screen (browsers require a tap first) | [x] | [ ] | [ ] | |
| F11 | Triple-tap the very top-left corner | Exits kiosk mode | [x] | [ ] | [ ] | |
| F12 | `Esc` | Also exits | [x] | [ ] | [ ] | |
| F13 | After exiting | Normal app is intact and usable | [x] | [ ] | [ ] | |
| F14 | Readability from across a room | Stop name legible at viewing distance | [ ] | [ ] | [x] | RETEST: the kiosk now shows the stop's description under the name (js/21-kiosk.js + .kiosk-blurb). Result cells were left blank on the last run. |
| F15 | **Leave running for 8+ hours** | Still cycling, still responsive, no slowdown | [x] | [ ] | [  ] | |
| F16 | Console after the long run | No accumulating errors | [x] | [ ] | [ ] | |

---

# Section G — Content and data (Phase 1)

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| G1 | `node scripts/validate-data.mjs` | `0 error(s)` | [ ] | [ ] | [ ] | |
| G2 | Deliberately misspell a `stopKey` in a gameday file, re-run | Reports that error, names the file and row | [ ] | [ ] | [ ] | |
| G3 | With that broken file in place, load the app | App still loads; the bad stop is skipped, not fatal | [ ] | [ ] | [ ] | |
| G4 | Put a person's name in a contact, re-run the validator | Refuses it (public file) | [ ] | [ ] | [ ] | |
| G5 | Undo those edits, re-run | Clean again | [ ] | [ ] | [ ] | |
| G6 | Edit a description in `data/locations.json`, reload | New text appears in the details panel | [ ] | [ ] | [ ] | |
| G7 | Follow `docs/CONTENT-EDITING.md` to add a new gameday from scratch | Instructions are sufficient without asking a developer | [ ] | [ ] | [ ] | |
| G8 | Check every stop key in `docs/DATA-SCHEMA.md` against the app | All 10 resolve | [ ] | [ ] | [ ] | |

---

# Section H — Phase 2, Make It Fast

> **NOT BUILT YET.** Every row below should be **N/T** until Phase 2 ships.
> Kept here so the final run covers all three phases in one document.

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| H1 | With `enableServiceWorker: false` (the shipped default) | **Nothing installs.** DevTools → Application → Service Workers is empty | [ ] | [ ] | [ ] | Test this FIRST — it is the shipped state |
| H18 | Set `enableServiceWorker: true`, deploy, load | Worker registers; scope is `/Wrapper/map/LSU3D/` and **not** the origin root | [ ] | [ ] | [ ] | A root scope would hijack ../LSU/, ../NewIberia/, ../dts/ |
| H19 | Reload with the worker active | App loads; DevTools shows assets served from ServiceWorker | [ ] | [ ] | [ ] | |
| H20 | DevTools → Network → filter `dotd.la.gov`, with the worker active | Aerial tiles still come from the **network**, never the worker | [ ] | [ ] | [ ] | Metered third-party content must never be cached |
| H21 | Go offline (DevTools → Network → Offline), reload | Stop list, descriptions, tour navigation all work; map imagery is blank | [ ] | [ ] | [ ] | Blank imagery is correct and expected |
| H22 | Offline with `?g=sample-gameday` | Itinerary times, instructions and contacts still readable | [ ] | [ ] | [ ] | This is the gameday case that justifies the whole feature |
| H23 | Offline, then navigate to a URL never visited before | Offline fallback page, not a browser error | [ ] | [ ] | [ ] | |
| H24 | Edit a CSS file, deploy, reload twice | Change appears; no stale styling persists | [ ] | [ ] | [ ] | |
| H25 | **Kill switch 1:** set `enableServiceWorker: false`, deploy, load once | Worker unregisters itself and its caches are gone, in ONE visit | [ ] | [ ] | [ ] | config.js is network-first specifically so this does not take two visits |
| H26 | **Kill switch 2:** with the worker active, open `?sw=off` | Unregisters immediately, no deploy needed | [ ] | [ ] | [ ] | The rescue path for a device stuck on a bad build |
| H27 | After either kill switch, reload normally | App works, nothing served by a worker | [ ] | [ ] | [ ] | |
| H28 | Confirm the other apps on the origin are untouched | `../LSU/`, `../NewIberia/`, `../dts/` all load normally with no worker | [ ] | [ ] | [ ] | **Do not skip.** Same origin, separate deployed apps |
| H2 | Second visit with the worker active | Measurably faster; note both times in Comments | [ ] | [ ] | [ ] | |
| H3 | Go offline and reload | See H21–H23 | [ ] | [ ] | [ ] | |
| H4 | Deploy an update | See H24 | [ ] | [ ] | [ ] | |
| H5 | Data Saver / Lite mode | Lightweight map, no automatic immersive loading | [ ] | [ ] | [x] | Not built |
| H6 | Manual override of the mode | Always available | [ ] | [ ] | [x] | Not built |
| H7 | Slow 4G throttling, first load | Map usable; note the time in Comments | [ ] | [ ] | [ ] | Now measurable — basemap dropped from ~5.5 MB to ~0.29 MB per viewport |
| H13 | DevTools → Network, filter `dotd.la.gov`, load the map | Tiles are `image/jpeg`, roughly 14–30 KB each, ~12 per viewport (was ~156 KB each, ~35 per viewport) | [ ] | [ ] | [ ] | The single number that should have moved |
| H14 | Look at the aerial imagery on screen | Still looks right — no visible JPEG blockiness at normal zooms | [ ] | [ ] | [ ] | **Judgement call only you can make.** Fallback is `format=jpgpng` at a smaller win |
| H15 | Pan to the far edges of the map | No black or missing tiles at the extremes of the campus bounds | [ ] | [ ] | [ ] | JPEG has no transparency; all 5 corners verified over the network, but confirm visually |
| H16 | Zoom fully in | Imagery still sharp at max zoom | [ ] | [ ] | [ ] | maxZoom moved 21→20 to match the 512px tiles; same ground resolution as before |
| H17 | DevTools → Network → **Protocol** column | Record whether it says h2 or http/1.1 | [ ] | [ ] | [ ] | Settles whether bundling the 22 JS files is worth doing at all |
| H8 | Images lazy-load; next stop prefetched | Not all 10 at once | [ ] | [ ] | [x] | Not built |
| H9 | Treedis stays lazy | Doesn't delay the map | [ ] | [ ] | [x] | Not built |
| H10 | 3D on a low-end phone | Degrades sensibly | [ ] | [ ] | [x] | Not built |
| H11 | JSON/GeoJSON caching | Versioned, no needless `no-cache` | [ ] | [ ] | [x] | Not built |
| H12 | JS/CSS bundling of `js/15`–`21` | Fewer requests on first paint | [ ] | [ ] | [x] | Not built |

---

# Section I — Phase 3, hosting migration

> **NOT BUILT, AND NOT DECIDED.** No migration work has been done and no
> platform has been chosen. Every row is **N/T** until that phase begins.
>
> The rule that governs this section: **the GitHub Pages build is the known-good
> baseline** (tag `baseline/lsu3d-github-pages-2026-08-27`). Nothing gets
> switched off until every row here passes on the new host.

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| I1 | All of Sections A–G re-run on the new host | Identical behaviour | [ ] | [ ] | [x] | Not started |
| I2 | Every existing URL still works | No link breaks | [ ] | [ ] | [x] | Not started |
| I3 | Deep links after migration | Work unchanged | [ ] | [ ] | [x] | Not started |
| I4 | Printed QR codes still resolve | Same stop keys | [ ] | [ ] | [x] | Not started |
| I5 | Staff authentication | Only staff reach staff things | [ ] | [ ] | [x] | Not started |
| I6 | Analytics dashboard | Shows real data | [ ] | [ ] | [x] | Not started |
| I7 | CMS editing and publishing | Works with roles | [ ] | [ ] | [x] | Not started |
| I8 | Security rules on private data | Enforced server-side, not just hidden in the UI | [ ] | [ ] | [x] | Not started |
| I9 | Rollback to the baseline tag | Restores the working site | [ ] | [ ] | [x] | Not started |

---

# Section J — Cross-cutting

Run the **core journey** — load, pick a stop, step the tour, open a deep link,
enter Live Visit — on each combination below.

## Devices and browsers

| # | Combination | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| J1 | Desktop Chrome, 1440px | Core journey works | [ ] | [ ] | [ ] | |
| J2 | Desktop Safari | Core journey works | [ ] | [ ] | [ ] | |
| J3 | Desktop Firefox | Core journey works | [ ] | [ ] | [ ] | |
| J4 | Desktop Edge | Core journey works | [ ] | [ ] | [ ] | |
| J5 | iPhone Safari | Core journey works | [ ] | [ ] | [ ] | |
| J6 | Android Chrome | Core journey works | [ ] | [ ] | [ ] | |
| J7 | iPad / tablet, 768–1024px | Core journey works | [ ] | [ ] | [ ] | |
| J8 | Narrow phone, ~375px | Nothing overflows or is cut off | [ ] | [ ] | [ ] | |
| J9 | Large display for kiosk | Core journey works | [ ] | [ ] | [ ] | |
| J10 | VR headset browser, if available | Loads; VR profile detected | [ ] | [ ] | [ ] | |

## Layout

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| J11 | Mobile ~375px | Rail becomes a bottom sheet, details a drag sheet | [ ] | [ ] | [ ] | |
| J12 | Mobile tour navigation | Stepper appears inside the details sheet | [ ] | [ ] | [ ] | |
| J13 | Rotate the phone mid-use | Layout recovers | [ ] | [ ] | [ ] | |
| J14 | Two panels at once on mobile | Never stacked with no way out | [ ] | [ ] | [ ] | |
| J15 | Phone with a notch | Live Visit bar clears it | [ ] | [ ] | [ ] | |

## Network

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| J16 | Normal broadband | Loads promptly | [ ] | [ ] | [ ] | |
| J17 | DevTools Slow 4G | Still usable; note how long to a usable map in Comments | [ ] | [ ] | [ ] | |
| J18 | Drop the connection mid-load | Fails gracefully, not a blank white screen | [ ] | [ ] | [ ] | |
| J19 | Reconnect after a drop | Recovers or reloads cleanly | [ ] | [ ] | [ ] | |
| J20 | Real campus wifi/cell on gameday | Usable in a crowd | [ ] | [ ] | [ ] | |

## Accessibility

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| J21 | Tab through the whole app | Everything reachable, focus visible | [ ] | [ ] | [ ] | |
| J22 | Keyboard-only tour navigation | Possible | [ ] | [ ] | [ ] | |
| J23 | OS "reduce motion" enabled | Animations calm down; nothing breaks | [ ] | [ ] | [ ] | |
| J24 | Screen reader on the details panel | Stop name and description are announced | [ ] | [ ] | [ ] | |
| J25 | Browser zoom at 200% | Layout holds | [ ] | [ ] | [ ] | |

## Privacy and security

**Any Fail here blocks release, whatever else passes.**

| # | Test | Expected | Pass | Fail | N/T | Comments |
|---|---|---|---|---|---|---|
| J26 | Open `data/gamedays/*.json` in a browser | Contains **no** personal names, mobiles or emails | [ ] | [ ] | [ ] | |
| J27 | `?n=Jordan` | Name gone from the address bar right after load | [ ] | [ ] | [ ] | |
| J28 | DevTools → Network, during a full session | **No** requests carrying analytics, names or coordinates | [ ] | [ ] | [ ] | |
| J29 | DevTools → Application → Storage | No coordinates stored; no cross-visit identifier | [ ] | [ ] | [ ] | |
| J30 | DevTools → Application → Cookies | No cookies set by this app | [ ] | [ ] | [ ] | |
| J31 | Try a stop URL with `<script>` in it | Rendered as text, never executed | [ ] | [ ] | [ ] | |
| J32 | Guess another gameday id | Confirm you're comfortable that anyone can read any itinerary | [ ] | [ ] | [ ] | |
| J33 | Kiosk exit gesture | Exposes nothing a normal visitor couldn't already do | [ ] | [ ] | [ ] | |

---

# Summary

Fill this in after the run.

| | Count |
|---|---|
| Pass | |
| Fail | |
| Not tested | |

**Blocking issues** (Section A regressions, and anything in Privacy and security):

1.
2.

**Non-blocking issues:**

1. **A18 — the "How to use" coachmark describes a layout that no longer
   exists.** Deferred by agreement until the site is feature-complete, since
   Phase 2 may move the UI again and the walkthrough would need rewriting
   twice. **Must be done before real recruit traffic** — it is currently
   actively misleading.
2.

**Anything that passed but felt wrong:**

1.

**Not tested, and why:**

1.
