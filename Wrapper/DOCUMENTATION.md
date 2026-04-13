# Campus Virtual Tour — Prototype Documentation

---

## SECTION A — Quick Summary

### What was built

A three-file prototype (HTML + CSS + JS) that recreates the mockup layout:

1. **Treedis Viewer Area** (upper-left) — a large placeholder that simulates where the real Treedis 3D tour will be embedded. Clicking locations swaps the placeholder image and label to simulate navigation.
2. **Side Menu** (right panel) — a dark vertical panel with grouped navigation ("Locations" and "Support") built entirely in HTML/CSS. Every menu item calls a JavaScript wrapper function.
3. **Interactive Campus Map** (bottom) — an aerial photo with absolutely-positioned clickable markers. Clicking a marker updates both the viewer placeholder and the menu highlight.

All location data lives in a single `LOCATION_DATA` array in `script.js`. Replacing placeholder IDs, thumbnails, and coordinates there is the only step needed to connect real content.

### How it connects to future Treedis integration

The `TourBridge` object in `script.js` already implements the exact postMessage protocol described in the Treedis SDK documentation. Every wrapper function (e.g., `loadTreedisLocation`) contains a commented-out, verified SDK call that can be uncommented once a real Treedis model ID is available. The prototype's UI, event flow, and data model are all designed so that switching from "placeholder simulation" to "live SDK communication" requires changing configuration values — not rewriting logic.

---

## SECTION C — Treedis SDK Usage Notes

> Based exclusively on the postMessage SDK documentation provided.

### C.1 Core concept

The Treedis tour runs inside its own browsing context — either an **iframe** or a **popup window**. Communication happens through the browser's native `window.postMessage()` API. No relay server, custom bridge, or third-party library is required.

There are two directions of communication:

| Direction | Mechanism |
|---|---|
| **Tour → Parent** | The tour calls `window.parent.postMessage(event, '*')` (iframe) or `window.opener.postMessage(event, '*')` (popup). |
| **Parent → Tour** | Your page calls `iframe.contentWindow.postMessage(cmd, '*')` (iframe) or `tourWindow.postMessage(cmd, '*')` (popup). |

The tour auto-detects which context it is in.

### C.2 Two integration patterns

**Iframe (used in this prototype's architecture)**

```html
<iframe id="tour-frame"
        src="https://app.treedis.com/tour/<model-id>"
        allow="fullscreen"
        style="width:100%;height:100%;border:none;"></iframe>
```

**Popup window**

```js
const tourWindow = window.open(
  'https://app.treedis.com/tour/<model-id>',
  'treedis-tour'
);
```

Both patterns share the identical event/command protocol.

### C.3 Initialisation flow (handshake)

1. Parent opens the tour (iframe or popup).
2. Tour loads internally.
3. Tour emits `{ type: 'TourReady' }` when fully loaded.
4. Tour emits `{ type: 'SweepsChanged', sweeps: [...] }` with the sweep list.
5. Tour begins emitting `{ type: 'PoseChanged', ... }` as the camera moves (~10 Hz).
6. Parent may now send commands.

**Tip from docs**: Send a `{ type: 'Ping' }` command on an interval after opening. If the tour is already loaded it responds immediately with `TourReady`. This handles the race condition where the tour loads before the parent is ready.

### C.4 Inbound events (Tour → Parent)

| Event | When | Key fields |
|---|---|---|
| `TourReady` | Tour finished loading (or in response to Ping) | — |
| `PoseChanged` | Camera moves (~100 ms) | `x`, `y`, `z`, `rotationY`, `sweep` |
| `SweepsChanged` | Sweeps loaded / on `RequestSweeps` | `sweeps[]` with `id`, `x`, `y`, `z` |
| `TagClicked` | User clicks a tag | `tag` object (see below) |
| `TagHovered` | Cursor over a tag | `tag` object |
| `TagFocused` | Tag panel comes into focus | `tag` object |
| `TagDocked` | Tag docked into sidebar | `tag` object |

**Tag object shape**: `{ sid, defaultSid, id, title, url, type, description, position: { x, y, z } }`

### C.5 Outbound commands (Parent → Tour)

| Command | Purpose | Required fields |
|---|---|---|
| `Navigate` | Move camera to a sweep | `sweepId` (required), `rotation` and `transitionTime` (optional) |
| `RequestSweeps` | Re-emit `SweepsChanged` | — |
| `Ping` | Check if tour is ready | — |

### C.6 How custom HTML controls trigger Treedis actions

The pattern is straightforward:

1. A custom button/link calls a JavaScript function.
2. That function builds a command object (`{ type: 'Navigate', sweepId: '...' }`).
3. It sends the command via `iframe.contentWindow.postMessage(cmd, '*')`.

This means any HTML element — a menu item, a map marker, a breadcrumb, a floor picker — can control the tour with zero coupling to Treedis internals.

### C.7 Iframe / embed considerations

- The iframe must include `allow="fullscreen"` if you want fullscreen support.
- No special sandbox attributes are documented as required.
- In the popup pattern, `window.open()` **must** be called inside a user-gesture handler (click) or the browser will block it.
- If the popup is closed and re-opened, the message listener on the parent window persists — no need to re-add it.

### C.8 Limitations, assumptions, and unknowns

| Item | Status |
|---|---|
| **VR mode** | Mentioned in the mockup menu but **not documented** in the postMessage SDK. Unknown API. |
| **Focus on a specific tag** | No outbound command for this. Workaround: navigate to the tag's associated sweep and set the rotation to face the tag's position. |
| **Floor switching** | Not a separate SDK concept. Each "floor" would be a different sweep (or a different model). The wrapper treats floors as child locations with their own sweep IDs. |
| **Loading a different model** | The SDK uses a single model per tour URL. To switch models you would change the iframe `src` or open a new popup URL. |
| **Origin validation** | The docs recommend validating `event.origin === 'https://app.treedis.com'` in production for security. |

---

## SECTION D — Wrapper API Design

Below is the full wrapper API implemented (or stubbed) in `script.js`.

### D.1 `initializeTreedisExperience()`

| Aspect | Detail |
|---|---|
| **Status** | 🔲 Placeholder (iframe creation) + ✅ Verified (Ping handshake) |
| **Purpose** | Create the iframe / popup, register the message listener, begin the Ping interval until `TourReady` is received. |

```js
function initializeTreedisExperience() {
  const iframe = document.getElementById('tour-frame');
  TourBridge.initialize(iframe);
  // ✅ Verified — Ping interval from SDK docs
  const pingInterval = setInterval(() => {
    if (!tourReady) TourBridge.ping();
    else clearInterval(pingInterval);
  }, 2000);
}
```

### D.2 `loadTreedisLocation(locationId)`

| Aspect | Detail |
|---|---|
| **Status** | 🔲 Placeholder UI swap + ✅ Verified SDK `Navigate` call (commented out) |
| **Purpose** | Navigate the tour to a new sweep, update the menu highlight, update the map marker highlight, and update the top-bar label. |

```js
function loadTreedisLocation(locationId) {
  const loc = LOCATION_DATA.find(l => l.id === locationId);
  // ✅ Verified:
  TourBridge.navigateToSweep(loc.treedisSweepId, { transitionTime: 1500 });
  highlightActiveMenu(locationId);
  highlightActiveMapMarker(locationId);
}
```

### D.3 `switchTreedisFloor(buildingId, floorId)`

| Aspect | Detail |
|---|---|
| **Status** | 🔲 Proposed abstraction |
| **Purpose** | Convenience wrapper — calls `loadTreedisLocation(floorId)`. Internally the SDK sees this as a normal sweep navigation. |

### D.4 `focusOnMarker(markerId)`

| Aspect | Detail |
|---|---|
| **Status** | 💡 Proposed future wrapper idea |
| **Purpose** | Navigate to a tag's sweep and rotate to face its 3D position. Requires maintaining a lookup table of tag IDs → sweep IDs + rotations. Not directly supported by a single SDK command. |

```js
function focusOnMarker(markerId) {
  const marker = TAG_LOOKUP[markerId]; // 💡 custom data structure
  TourBridge.navigateToSweep(marker.sweepId, {
    rotation: marker.facingRotation,
    transitionTime: 1200,
  });
}
```

### D.5 `resetToHomeView()`

| Aspect | Detail |
|---|---|
| **Status** | ✅ Verified (uses Navigate) / 🔲 Placeholder (home sweep ID) |
| **Purpose** | Return to the default campus-wide view. |

### D.6 `switchToVRMode()`

| Aspect | Detail |
|---|---|
| **Status** | 🔲 Placeholder |
| **Purpose** | Not documented in the provided SDK. Kept as a stub for future Treedis VR API. |

### D.7 `openStudentPortal()`

| Aspect | Detail |
|---|---|
| **Status** | 🔲 Placeholder |
| **Purpose** | Opens an external URL. Not related to Treedis. |

### D.8 `showHelp()` / `closeHelp()`

| Aspect | Detail |
|---|---|
| **Status** | Implemented (pure UI) |
| **Purpose** | Toggle a help modal. Could be extended to display dynamic info from tour state. |

### D.9 `exitExperience()`

| Aspect | Detail |
|---|---|
| **Status** | 🔲 Placeholder |
| **Purpose** | Close the tour popup (if popup pattern) or navigate away. |

### D.10 `highlightActiveMenu(locationId)`

| Aspect | Detail |
|---|---|
| **Status** | Implemented (pure UI) |
| **Purpose** | Toggle the `.active` class on the correct menu link. |

### D.11 `highlightActiveMapMarker(locationId)`

| Aspect | Detail |
|---|---|
| **Status** | Implemented (pure UI) |
| **Purpose** | Toggle the `.active` class on the correct map marker. |

---

## SECTION E — Extra SDK Interaction Examples

### E.1 Custom location jump buttons

**Status**: ✅ Verified (Navigate command)

```html
<button onclick="jumpTo('abc12345-...', 90)">Go to Lobby</button>
<script>
function jumpTo(sweepId, yaw) {
  const frame = document.getElementById('tour-frame');
  frame.contentWindow.postMessage({
    type: 'Navigate',
    sweepId,
    rotation: { x: 0, y: yaw },
    transitionTime: 1200,
  }, '*');
}
</script>
```

### E.2 Custom floor switcher

**Status**: 🔲 Proposed abstraction (each floor = different sweep ID)

```html
<select id="floor-picker" onchange="switchFloor(this.value)">
  <option value="SWEEP_F1">1st Floor</option>
  <option value="SWEEP_F2">2nd Floor</option>
</select>
<script>
function switchFloor(sweepId) {
  document.getElementById('tour-frame')
    .contentWindow.postMessage({ type: 'Navigate', sweepId }, '*');
}
</script>
```

### E.3 Custom loading state UI

**Status**: ✅ Verified (`TourReady` event)

```js
const overlay = document.getElementById('loading-overlay');
overlay.style.display = 'flex'; // show spinner

window.addEventListener('message', (e) => {
  if (e.data?.type === 'TourReady') {
    overlay.style.display = 'none'; // hide spinner
  }
});
```

### E.4 Current-location indicator

**Status**: ✅ Verified (`PoseChanged` event provides `sweep` field)

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'PoseChanged') {
    document.getElementById('status-sweep').textContent = e.data.sweep;
    document.getElementById('status-rotation').textContent =
      Math.round(e.data.rotationY) + '°';
  }
});
```

### E.5 Event logger panel

**Status**: ✅ Verified (all inbound events)

Already included in the prototype as the togglable "Event Log" panel (bottom-right clipboard button).

### E.6 Syncing a map marker click with Treedis navigation

**Status**: ✅ Verified (Navigate) + 🔲 Placeholder (sweep IDs)

```js
document.querySelectorAll('.map-marker').forEach(marker => {
  marker.addEventListener('click', () => {
    const sweepId = marker.dataset.sweepId; // 🔲 real sweep ID
    frame.contentWindow.postMessage({
      type: 'Navigate', sweepId, transitionTime: 1500,
    }, '*');
  });
});
```

### E.7 Syncing Treedis state back into external HTML

**Status**: ✅ Verified (`PoseChanged` carries the active sweep ID)

```js
// Build a sweep→location lookup from your data
const sweepToLocation = {};
LOCATION_DATA.forEach(loc => {
  sweepToLocation[loc.treedisSweepId] = loc;
});

window.addEventListener('message', (e) => {
  if (e.data?.type === 'PoseChanged') {
    const loc = sweepToLocation[e.data.sweep];
    if (loc) highlightActiveMenu(loc.id);
  }
});
```

### E.8 Custom "back to home" button

**Status**: ✅ Verified (Navigate to the home sweep)

```html
<button onclick="goHome()">🏠 Back to Campus View</button>
<script>
function goHome() {
  frame.contentWindow.postMessage({
    type: 'Navigate',
    sweepId: 'HOME_SWEEP_ID', // 🔲 replace
    transitionTime: 2000,
  }, '*');
}
</script>
```

### E.9 Mobile-friendly quick navigation drawer

**Status**: 💡 Proposed (pure UI, triggers Navigate)

```html
<div id="mobile-drawer" class="drawer closed">
  <button onclick="toggleDrawer()">☰ Locations</button>
  <ul id="drawer-list"></ul>
</div>
<script>
function toggleDrawer() {
  document.getElementById('mobile-drawer').classList.toggle('closed');
}
// Populate drawer-list from LOCATION_DATA, each item calls Navigate
</script>
```

### E.10 Breadcrumb navigation

**Status**: 💡 Proposed abstraction

```js
// Maintain a breadcrumb trail
const breadcrumbs = ['campus_home'];

function navigateAndTrack(locationId) {
  breadcrumbs.push(locationId);
  loadTreedisLocation(locationId);
  renderBreadcrumbs();
}
function goBack() {
  breadcrumbs.pop();
  const prev = breadcrumbs[breadcrumbs.length - 1] || 'campus_home';
  loadTreedisLocation(prev);
  renderBreadcrumbs();
}
```

### E.11 Tag info panel (from TagClicked)

**Status**: ✅ Verified (TagClicked event)

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'TagClicked') {
    const tag = e.data.tag;
    document.getElementById('tag-panel-title').textContent = tag.title;
    document.getElementById('tag-panel-desc').textContent = tag.description;
    document.getElementById('tag-panel').classList.remove('hidden');
  }
});
```

---

## SECTION F — How to Replace Placeholders with Real Data

### F.1 Replace placeholder images

In `LOCATION_DATA` (script.js), every object has a `thumbnail` field pointing to an Unsplash placeholder. Replace each URL with a real image path or CDN URL:

```js
// Before
thumbnail: 'https://images.unsplash.com/photo-...',
// After
thumbnail: '/assets/images/nance-hall-thumb.jpg',
```

The campus map background image is set in `index.html` on the `#map-bg` element. Replace its `src` with your actual aerial photo.

### F.2 Replace fake location IDs

Every location has an `id` field (e.g., `'nance_hall'`). These are internal to the prototype and can stay as-is or be renamed. What matters for the SDK is the `treedisModelId` and `treedisSweepId` fields.

### F.3 Replace Treedis model and sweep IDs

```js
// Before
treedisModelId: 'PLACEHOLDER_MODEL_NANCE',
treedisSweepId: 'PLACEHOLDER_SWEEP_NANCE',
// After
treedisModelId: 'a1b2c3d4-real-model-uuid',
treedisSweepId: 'xyz98765-real-sweep-uuid',
```

The `treedisModelId` is used to construct the tour URL:
```
https://app.treedis.com/tour/{treedisModelId}
```

The `treedisSweepId` is passed into the SDK's `Navigate` command.

### F.4 Replace map marker coordinates

Each location with a map pin has a `mapPosition` object with `left` and `top` as CSS percentages. These are relative to the map container. Adjust them to match pin positions on your real aerial photo:

```js
// Before
mapPosition: { left: '14%', top: '58%' },
// After
mapPosition: { left: '22%', top: '41%' },
```

### F.5 Activate real SDK calls

In `script.js`, every wrapper function contains a commented-out block marked `✅ VERIFIED`. To go live:

1. **Embed the real iframe** — In `index.html`, replace the `#treedis-placeholder` div with a real `<iframe>` pointing at your tour URL.
2. **Uncomment the SDK calls** — In `loadTreedisLocation()`, uncomment `TourBridge.navigateToSweep(...)`.
3. **Uncomment the initialiser** — In `initializeTreedisExperience()`, uncomment the iframe reference and ping interval.
4. **Remove the placeholder simulation** — Delete the `setTimeout` blocks that swap placeholder images.
5. **Enable origin validation** — In `TourBridge._onMessage()`, uncomment the origin check: `if (event.origin !== 'https://app.treedis.com') return;`

### F.6 Replace support links

- **Student Portal**: Update the URL in `openStudentPortal()`.
- **Exit**: Update the destination in `exitExperience()`.
- **Help text**: Edit the modal content in `index.html`.

### F.7 Add real floors/sub-locations

Add new entries to `LOCATION_DATA` with a `parent` field pointing to the parent building's `id`. The menu renderer automatically indents children. Each floor needs its own `treedisSweepId`.

### F.8 Checklist for going live

- [ ] Replace all `PLACEHOLDER_MODEL_*` values with real Treedis model UUIDs
- [ ] Replace all `PLACEHOLDER_SWEEP_*` values with real sweep UUIDs
- [ ] Replace placeholder thumbnail URLs with real images
- [ ] Replace the aerial campus map photo
- [ ] Adjust all `mapPosition` percentages for the new map image
- [ ] Swap the placeholder `<div>` for a real `<iframe>` in `index.html`
- [ ] Uncomment all verified SDK calls in `script.js`
- [ ] Remove the simulated loading `setTimeout` blocks
- [ ] Uncomment origin validation in `TourBridge._onMessage()`
- [ ] Update the Student Portal URL
- [ ] Test the Ping → TourReady handshake in a real browser
- [ ] Test Navigate commands for each location
- [ ] Test on mobile (responsive layout)
