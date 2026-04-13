# Campus Virtual Tour — Prototype Documentation

---

## SECTION A — Quick Summary

### What was built

A three-file prototype (HTML + CSS + JS) for a campus virtual tour:

1. **Treedis Viewer Area** — placeholder that simulates the real Treedis 3D tour embed. Clicking locations swaps the placeholder image and label.
2. **Side Menu** — dark vertical panel with grouped navigation ("Locations" and "Support"). Toggleable via a hamburger button in the top bar.
3. **Interactive Campus Map** (desktop/tablet) — aerial photo with absolutely-positioned clickable markers. Uses natural aspect ratio to prevent distortion on resize.
4. **Mobile Location List** (phones) — a thumbnail card grid replacing the map on small screens to avoid marker overlap/tap issues.

### Treedis Configuration

All locations share a single Treedis model: `0df38e34`
Tour URL: `https://spaces.dtsxr.com/tour/0df38e34`
Student Portal: `https://metaversitysportal.carrd.co/`

### Sweep IDs (from spreadsheet)

| Location | Sweep ID |
|---|---|
| Nance Hall | `asfnat04t866bzrkzegbaki6c` |
| Nance Hall 1st Floor | `2ki84r23di9yq9p613u5yg34d` |
| Nance Hall 2nd Floor | `1t7xp1xztp4aw4bs372705dwd` |
| Crawford-Zimmerman | `d2brr5bczkx2m8pg0ap06di9d` |
| Crawford-Zimmerman 1st Floor | `sawh7uqgn3msc6b6y5aeabgpc` |
| Student Center | `itqbbw5un90s6fubay1sg9wpb` |
| Student Center 1st Floor | *no sweep found* |
| Student Center 2nd Floor | *no sweep found* |
| Oliver C. Dawson Stadium | `a69zbymdc8gnx3nzhy7nm3rna` |
| Olar Farm | `pgq02k1ubi2mb2gc7cpfpm24d` |
| Legacy Plaza | `uf2k18cpw057bbexxqs9g2w4a` |
| Street View | `gs6itzr7wgg9zm7iicpmf27qd` |

---

## SECTION B — Changes Made in This Update

### B.1 Real Treedis Data
- All `treedisModelId` fields set to `0df38e34`
- All `treedisSweepId` fields populated from spreadsheet
- Student Center floors marked `null` (no sweep found)
- Student Portal URL updated to `https://metaversitysportal.carrd.co/`
- Treedis origin updated to `https://spaces.dtsxr.com`

### B.2 Map Aspect Ratio Fix
- Removed fixed `height` on `#map-container`
- `#map-bg` now uses `height: auto` so the image's natural aspect ratio is always preserved
- On window resize the map scales proportionally — markers stay in correct positions

### B.3 Mobile Optimization
- Added "tap to interact" touch guard overlay on the viewer for mobile
- Side menu is a slide-up bottom sheet on phones (≤600px)
- Desktop map hidden on phones; replaced with a 2-column thumbnail card grid
- Touch guard re-engages on scroll so users can scroll past the viewer
- `100dvh` used alongside `100vh` for iOS Safari compatibility
- Very small phones (≤380px) get single-column card layout

### B.4 Menu Toggle Fix
- Removed the old "close and can't reopen" behavior
- Added hamburger button in top bar that toggles menu open/closed
- Hamburger animates to X when menu is open
- On mobile, menu auto-closes after selecting a location
- Menu state tracked via `menuOpen` variable

### B.5 Responsive Design Improvements
- Top bar is `position: sticky` so it's always accessible
- Viewer uses `aspect-ratio: 16/9` on tablet and `16/10` on mobile instead of fixed heights
- iOS Safari `-webkit-touch-callout` and `100dvh` fixes
- Overlay label is `max-width: 90%` with `text-align: center` to prevent overflow
- Event log goes full-width on mobile

---

## SECTION C — Treedis SDK Usage Notes

*(Same as before — see original documentation. Origin updated to `https://spaces.dtsxr.com`.)*

---

## SECTION D — Mobile-Specific Architecture

### D.1 Touch Guard ("Tap to interact")

The `#touch-guard` element sits over the Treedis viewer on touch devices. It prevents accidental 3D interaction when the user is trying to scroll the page.

**Behavior:**
1. On page load, if touch device detected → guard is shown
2. User taps the guard → guard is dismissed, viewer becomes interactive
3. User scrolls the page → guard re-engages after 300ms of scroll inactivity

This mirrors how Google Maps handles embedded maps on mobile.

### D.2 Mobile Location List

On screens ≤600px, the `#campus-map` section (with image + markers) is hidden via CSS. Instead, `#mobile-locations` shows a grid of thumbnail cards for each top-level location. This avoids marker overlap and small tap targets.

### D.3 Bottom Sheet Menu

On phones, the side menu becomes a fixed bottom sheet that slides up from the bottom of the screen. It has a drag handle indicator and closes after location selection.

---

## SECTION E — File Structure

```
index.html    — Main HTML with viewer, menu, map, mobile list, touch guard
styles.css    — All styling including responsive breakpoints and iOS fixes
script.js     — Location data, SDK wrapper, UI logic, touch guard
Map.jpg       — Aerial campus map image
```

---

## SECTION F — How to Replace Placeholders with Real Data

### F.1 Activate real SDK calls

1. In `index.html`, replace `#treedis-placeholder` with:
   ```html
   <iframe id="tour-frame"
           src="https://spaces.dtsxr.com/tour/0df38e34"
           allow="fullscreen"
           style="width:100%;height:100%;border:none;"></iframe>
   ```
2. In `script.js`, uncomment `TourBridge.navigateToSweep(...)` in `loadTreedisLocation()`
3. Uncomment the initializer in `initializeTreedisExperience()`
4. Remove the `setTimeout` placeholder simulation blocks
5. Uncomment origin validation: `if (event.origin !== 'https://spaces.dtsxr.com') return;`

### F.2 Replace placeholder thumbnails

Replace Unsplash URLs in `LOCATION_DATA` with real campus images.

### F.3 Checklist for going live

- [ ] Replace all placeholder thumbnail URLs with real images
- [ ] Swap `#treedis-placeholder` for real `<iframe>` in `index.html`
- [ ] Uncomment all verified SDK calls in `script.js`
- [ ] Remove simulated loading `setTimeout` blocks
- [ ] Uncomment origin validation in `TourBridge._onMessage()`
- [ ] Find sweep IDs for Student Center floors (currently null)
- [ ] Test the Ping → TourReady handshake
- [ ] Test Navigate commands for each location
- [ ] Test on mobile (iOS Safari + Android Chrome)
- [ ] Test touch guard behavior on real touch devices
