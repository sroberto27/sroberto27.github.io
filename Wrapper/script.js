/* =============================================================
   CAMPUS VIRTUAL TOUR — PROTOTYPE SCRIPT
   =============================================================
   STATUS LABELS USED THROUGHOUT THIS FILE:
     ✅ VERIFIED FROM PROVIDED SDK DOCS
     🔲 PLACEHOLDER / TO BE ADAPTED
     💡 PROPOSED FUTURE WRAPPER IDEA
   ============================================================= */

/* ==============================================================
   1. LOCATION DATA — PLACEHOLDER / TO BE ADAPTED
   ==============================================================
   Replace every field with real Treedis model IDs, sweep IDs,
   thumbnails, and map coordinates when production data is ready.
   ---------------------------------------------------------------- */
const LOCATION_DATA = [
  {
    id: 'campus_home',
    label: 'Campus View (Home)',
    treedisModelId: '0df38e34',       // 🔲 replace
    treedisSweepId: 'PLACEHOLDER_SWEEP_HOME',           // 🔲 replace
    thumbnail: 'https://images.unsplash.com/photo-1562774053-701939374585?w=600&q=70',
    mapPosition: null,    // home has no map pin
    parent: null,
    children: [],
  },
  {
    id: 'nance_hall',
    label: 'Nance Hall',
    sublabel: 'Mathematics & Science',
    treedisModelId: '0df38e34',
    treedisSweepId: 'asfnat04t866bzrkzegbaki6c',
    thumbnail: 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=600&q=70',
    mapPosition: { left: '19%', top: '40%' },
    parent: null,
    children: ['nance_hall_floor_1', 'nance_hall_floor_2'],
  },
  {
    id: 'nance_hall_floor_1',
    label: '1st Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: 'asfnat04t866bzrkzegbaki6c',
    thumbnail: 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=600&q=70',
    mapPosition: null,
    parent: 'nance_hall',
    children: [],
  },
  {
    id: 'nance_hall_floor_2',
    label: '2nd Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: 'asfnat04t866bzrkzegbaki6c',
    thumbnail: 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=600&q=70',
    mapPosition: null,
    parent: 'nance_hall',
    children: [],
  },
  {
    id: 'crawford_zimmerman',
    label: 'Crawford-Zimmerman',
    sublabel: 'Administration',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_CZ',
    thumbnail: 'https://images.unsplash.com/photo-1567168544646-208fa5d408fb?w=600&q=70',
    mapPosition: { left: '52%', top: '65%' },
    parent: null,
    children: ['crawford_floor_1'],
  },
  {
    id: 'crawford_floor_1',
    label: '1st Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_CZ_F1',
    thumbnail: 'https://images.unsplash.com/photo-1567168544646-208fa5d408fb?w=600&q=70',
    mapPosition: null,
    parent: 'crawford_zimmerman',
    children: [],
  },
  {
    id: 'student_center',
    label: 'Student Center',
    sublabel: 'Administration',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_SC',
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&q=70',
    mapPosition: { left: '48%', top: '30%' },
    parent: null,
    children: ['student_center_floor_1', 'student_center_floor_2'],
  },
  {
    id: 'student_center_floor_1',
    label: '1st Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_SC_F1',
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&q=70',
    mapPosition: null,
    parent: 'student_center',
    children: [],
  },
  {
    id: 'student_center_floor_2',
    label: '2nd Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_SC_F2',
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&q=70',
    mapPosition: null,
    parent: 'student_center',
    children: [],
  },
  {
    id: 'dawson_stadium',
    label: 'Oliver C. Dawson Stadium',
    sublabel: 'Sports Complex',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_STADIUM',
    thumbnail: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=600&q=70',
    mapPosition: { left: '82%', top: '28%' },
    parent: null,
    children: [],
  },
  {
    id: 'olar_farm',
    label: 'Olar Farm',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_FARM',
    thumbnail: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?w=600&q=70',
    mapPosition: null,
    parent: null,
    children: [],
  },
  {
    id: 'legacy_plaza',
    label: 'Legacy Plaza',
    sublabel: 'Memorial',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_PLAZA',
    thumbnail: 'https://images.unsplash.com/photo-1577495508326-19a1b3cf65b7?w=600&q=70',
    mapPosition: { left: '37.9%', top: '45.5%' },
    parent: null,
    children: [],
  },
  {
    id: 'street_view',
    label: 'Street View',
    sublabel: 'Exploration',
    treedisModelId: '0df38e34',
    treedisSweepId: 'PLACEHOLDER_SWEEP_STREET',
    thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=70',
    mapPosition: { left: '34%', top: '72%' },
    parent: null,
    children: [],
  },
];


/* ==============================================================
   2. STATE
   ============================================================== */
let activeLocationId = 'campus_home';
let tourReady = false;
let tourWindow = null;     // will hold reference to popup or iframe


/* ==============================================================
   3. TREEDIS SDK WRAPPER — TourBridge
   ==============================================================
   Encapsulates all communication with the Treedis tour.
   Methods are labelled ✅ / 🔲 / 💡 per SDK documentation.
   ---------------------------------------------------------------- */
const TourBridge = {

  /* ── iframe reference (set during init) ─────────────────── */
  _iframe: null,

  /* ✅ VERIFIED — Initialize the Treedis experience
     Uses the iframe embed pattern documented in the SDK.
     ---------------------------------------------------------------- */
  initialize(iframeElement) {
    this._iframe = iframeElement;
    // ✅ Listen for inbound events from the tour
    window.addEventListener('message', this._onMessage.bind(this));
    logEvent('TourBridge.initialize() called');
  },

  /* ✅ VERIFIED — central inbound event handler
     Handles every event type listed in the SDK docs.
     ---------------------------------------------------------------- */
  _onMessage(event) {
    // ✅ In production, validate origin:
    // if (event.origin !== 'https://app.treedis.com') return;
    const { type, ...data } = event.data ?? {};
    switch (type) {
      case 'TourReady':
        tourReady = true;
        logEvent('TourReady received');
        break;
      case 'PoseChanged':
        // ✅ Continuous camera updates (~10 Hz)
        // data: { x, y, z, rotationY, sweep }
        // 💡 Could update a real-time minimap dot here
        break;
      case 'SweepsChanged':
        // ✅ Full sweep list — data.sweeps
        logEvent(`SweepsChanged — ${data.sweeps?.length ?? 0} sweeps`);
        break;
      case 'TagClicked':
        logEvent(`TagClicked — ${data.tag?.title}`);
        break;
      case 'TagHovered':
        break; // high frequency — only log if needed
      case 'TagFocused':
        logEvent(`TagFocused — ${data.tag?.title}`);
        break;
      case 'TagDocked':
        logEvent(`TagDocked — ${data.tag?.title}`);
        break;
    }
  },

  /* ✅ VERIFIED — Send a Navigate command to the tour
     The SDK Navigate command accepts sweepId, optional rotation,
     and optional transitionTime.
     ---------------------------------------------------------------- */
  navigateToSweep(sweepId, options = {}) {
    const cmd = {
      type: 'Navigate',
      sweepId,
      transitionTime: options.transitionTime ?? 1500,
    };
    if (options.rotation) cmd.rotation = options.rotation;
    this._postCommand(cmd);
    logEvent(`Navigate → ${sweepId}`);
  },

  /* ✅ VERIFIED — Request the current sweep list */
  requestSweeps() {
    this._postCommand({ type: 'RequestSweeps' });
    logEvent('RequestSweeps sent');
  },

  /* ✅ VERIFIED — Ping the tour to check readiness */
  ping() {
    this._postCommand({ type: 'Ping' });
    logEvent('Ping sent');
  },

  /* Internal helper — send a postMessage to the tour */
  _postCommand(cmd) {
    if (this._iframe?.contentWindow) {
      // ✅ Iframe pattern
      this._iframe.contentWindow.postMessage(cmd, '*');
    } else if (tourWindow && !tourWindow.closed) {
      // ✅ Popup pattern
      tourWindow.postMessage(cmd, '*');
    } else {
      logEvent('⚠ No tour target available');
    }
  },
};


/* ==============================================================
   4. HIGH-LEVEL WRAPPER FUNCTIONS
   ==============================================================
   These are called by the menu, map markers, and keyboard.
   Each one updates the local UI *and* issues SDK calls where
   possible.  Status labels indicate readiness.
   ---------------------------------------------------------------- */

/**
 * 🔲 PLACEHOLDER — Initialise the full experience.
 * In production this would create the iframe / popup and begin
 * the ping-based handshake described in the SDK docs.
 */
function initializeTreedisExperience() {
  logEvent('initializeTreedisExperience()');

  // 🔲 PLACEHOLDER — When real tour is embedded:
  // const iframe = document.getElementById('tour-frame');
  // TourBridge.initialize(iframe);
  //
  // ✅ VERIFIED — SDK recommends pinging until TourReady:
  // const pingInterval = setInterval(() => {
  //   if (!tourReady) TourBridge.ping();
  //   else clearInterval(pingInterval);
  // }, 2000);

  // For now, simulate readiness after 500ms
  setTimeout(() => {
    tourReady = true;
    logEvent('(simulated) TourReady');
  }, 500);
}

/**
 * 🔲 PLACEHOLDER — Navigate to a location by its data ID.
 * Updates placeholder UI and prepares the real SDK Navigate call.
 */
function loadTreedisLocation(locationId) {
  const loc = LOCATION_DATA.find(l => l.id === locationId);
  if (!loc) return;

  activeLocationId = locationId;
  logEvent(`loadTreedisLocation("${locationId}")`);

  // ── Update placeholder viewer ──
  showLoading(true);
  setTimeout(() => {
    document.getElementById('treedis-placeholder-img').src = loc.thumbnail;
    document.getElementById('treedis-overlay-label').textContent = loc.label;
    document.getElementById('current-location-label').textContent = loc.label;
    showLoading(false);
  }, 600);

  // ── Update menu + map highlights ──
  highlightActiveMenu(locationId);
  highlightActiveMapMarker(locationId);

  // ✅ VERIFIED — In production, issue the Navigate command:
  // TourBridge.navigateToSweep(loc.treedisSweepId, {
  //   transitionTime: 1500,
  // });
}

/**
 * 🔲 PLACEHOLDER — Switch floor within a building.
 * In the data model, a "floor" is just a child location.
 */
function switchTreedisFloor(buildingId, floorId) {
  logEvent(`switchTreedisFloor("${buildingId}", "${floorId}")`);
  loadTreedisLocation(floorId);
}

/**
 * 💡 PROPOSED — Focus on a specific tag/marker inside the tour.
 * The SDK does not expose a "focus on tag" command directly, but
 * you could Navigate to the tag's associated sweep and set rotation
 * to face the tag's 3D position.
 */
function focusOnMarker(markerId) {
  logEvent(`focusOnMarker("${markerId}") — proposed wrapper`);
  // 💡 Future: look up the marker's sweep and rotation, then call
  // TourBridge.navigateToSweep(markerSweepId, { rotation: ... });
}

/**
 * ✅ VERIFIED (Navigate) / 🔲 PLACEHOLDER (home sweep ID).
 * Reset the viewer to the home/campus-wide view.
 */
function resetToHomeView() {
  logEvent('resetToHomeView()');
  loadTreedisLocation('campus_home');
}

/**
 * 🔲 PLACEHOLDER — VR mode is mentioned in the mockup menu but
 * not exposed in the provided SDK docs. Keep as a stub.
 */
function switchToVRMode() {
  logEvent('switchToVRMode() — placeholder');
  alert('VR mode is not yet integrated. Check Treedis documentation for VR support.');
}

/**
 * 🔲 PLACEHOLDER — Opens the student portal. This is unrelated to
 * Treedis — it simply opens an external URL.
 */
function openStudentPortal() {
  logEvent('openStudentPortal()');
  // 🔲 Replace with real portal URL
  window.open('https://example.com/student-portal', '_blank');
}

/** Show / close the help modal */
function showHelp() {
  document.getElementById('help-modal').classList.remove('hidden');
}
function closeHelp() {
  document.getElementById('help-modal').classList.add('hidden');
}

/**
 * 🔲 PLACEHOLDER — Exit the experience. Could close the popup,
 * navigate to a landing page, etc.
 */
function exitExperience() {
  logEvent('exitExperience()');
  if (confirm('Leave the campus tour?')) {
    // 🔲 Replace with real exit behaviour
    window.location.href = '#';
  }
}

/** Scroll the page to the campus map section */
function scrollToMap() {
  document.getElementById('campus-map').scrollIntoView({ behavior: 'smooth' });
}

/** Toggle the side menu visibility (for mobile) */
function toggleMenu() {
  document.getElementById('side-menu').classList.toggle('hidden');
}


/* ==============================================================
   5. UI HIGHLIGHT HELPERS
   ============================================================== */

/** Highlight the active menu item and de-highlight others */
function highlightActiveMenu(locationId) {
  document.querySelectorAll('#locations-list a').forEach(a => {
    a.classList.toggle('active', a.dataset.locationId === locationId);
  });
}

/** Highlight the active map marker and de-highlight others */
function highlightActiveMapMarker(locationId) {
  document.querySelectorAll('.map-marker').forEach(m => {
    m.classList.toggle('active', m.dataset.locationId === locationId);
  });
}

/** Show or hide the loading overlay */
function showLoading(visible) {
  document.getElementById('treedis-loading').classList.toggle('hidden', !visible);
}


/* ==============================================================
   6. EVENT LOG (development helper)
   ============================================================== */
function logEvent(msg) {
  const list = document.getElementById('event-log-list');
  if (!list) return;
  const li = document.createElement('li');
  const t = new Date().toLocaleTimeString();
  li.textContent = `[${t}] ${msg}`;
  list.prepend(li);
  // keep list manageable
  while (list.children.length > 80) list.lastChild.remove();
}
function clearEventLog() {
  document.getElementById('event-log-list').innerHTML = '';
}
function toggleEventLog() {
  document.getElementById('event-log').classList.toggle('hidden');
}


/* ==============================================================
   7. BUILD THE UI FROM DATA ON PAGE LOAD
   ============================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Build side-menu location list ─────────────────────── */
  const locationsList = document.getElementById('locations-list');
  LOCATION_DATA.forEach(loc => {
    const li = document.createElement('li');
    if (loc.parent) li.classList.add('sub-item');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = loc.label;
    a.dataset.locationId = loc.id;
    if (loc.id === activeLocationId) a.classList.add('active');
    a.addEventListener('click', e => {
      e.preventDefault();
      if (loc.parent) {
        switchTreedisFloor(loc.parent, loc.id);
      } else {
        loadTreedisLocation(loc.id);
      }
    });
    li.appendChild(a);
    locationsList.appendChild(li);
  });

  /* ── Build map markers ─────────────────────────────────── */
  const markersContainer = document.getElementById('map-markers');
  LOCATION_DATA.filter(l => l.mapPosition).forEach(loc => {
    const marker = document.createElement('div');
    marker.className = 'map-marker';
    marker.dataset.locationId = loc.id;
    marker.style.left = loc.mapPosition.left;
    marker.style.top = loc.mapPosition.top;

    const labelEl = document.createElement('span');
    labelEl.className = 'marker-label';
    labelEl.innerHTML = loc.label +
      (loc.sublabel ? `<span class="marker-sublabel">${loc.sublabel}</span>` : '');

    const pin = document.createElement('span');
    pin.className = 'marker-pin';

    marker.appendChild(labelEl);
    marker.appendChild(pin);

    marker.addEventListener('click', () => {
      loadTreedisLocation(loc.id);
      // Scroll up to the viewer so the user sees the change
      document.getElementById('treedis-viewer').scrollIntoView({ behavior: 'smooth' });
    });

    markersContainer.appendChild(marker);
  });

  /* ── Kick off the experience ───────────────────────────── */
  initializeTreedisExperience();
  logEvent('Page loaded — prototype ready');
});
