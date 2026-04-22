/* =============================================================
   CAMPUS VIRTUAL TOUR — SCRIPT
   ============================================================= */

/* ==============================================================
   1. LOCATION DATA
   ============================================================== */
const LOCATION_DATA = [
  {
    id: 'campus_home',
    label: 'Campus View (Home)',
    sublabel: null,
    treedisModelId: '0df38e34',
    treedisSweepId: '0df38e34',
    thumbnail: 'https://images.unsplash.com/photo-1562774053-701939374585?w=600&q=70',
    mapPosition: null,
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
    mapPosition: { left: '17%', top: '40%' },
    parent: null,
    children: ['nance_hall_floor_1', 'nance_hall_floor_2'],
  },
  {
    id: 'nance_hall_floor_1',
    label: '1st Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: '2ki84r23di9yq9p613u5yg34d',
    thumbnail: 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=600&q=70',
    mapPosition: null,
    parent: 'nance_hall',
    children: [],
  },
  {
    id: 'nance_hall_floor_2',
    label: '2nd Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: '1t7xp1xztp4aw4bs372705dwd',
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
    treedisSweepId: 'd2brr5bczkx2m8pg0ap06di9d',
    thumbnail: 'https://images.unsplash.com/photo-1567168544646-208fa5d408fb?w=600&q=70',
    mapPosition: { left: '42%', top: '53%' },
    parent: null,
    children: ['crawford_floor_1'],
  },
  {
    id: 'crawford_floor_1',
    label: '1st Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: 'sawh7uqgn3msc6b6y5aeabgpc',
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
    treedisSweepId: 'itqbbw5un90s6fubay1sg9wpb',
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&q=70',
    mapPosition: { left: '52%', top: '24%' },
    parent: null,
    children: ['student_center_floor_1', 'student_center_floor_2'],
  },
  {
    id: 'student_center_floor_1',
    label: '1st Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: null,
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=600&q=70',
    mapPosition: null,
    parent: 'student_center',
    children: [],
  },
  {
    id: 'student_center_floor_2',
    label: '2nd Floor',
    treedisModelId: '0df38e34',
    treedisSweepId: null,
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
    treedisSweepId: 'a69zbymdc8gnx3nzhy7nm3rna',
    thumbnail: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=600&q=70',
    mapPosition: { left: '87.5%', top: '10%' },
    parent: null,
    children: [],
  },
  {
    id: 'olar_farm',
    label: 'Olar Farm',
    sublabel: null,
    treedisModelId: '0df38e34',
    treedisSweepId: 'pgq02k1ubi2mb2gc7cpfpm24d',
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
    treedisSweepId: 'uf2k18cpw057bbexxqs9g2w4a',
    thumbnail: 'https://images.unsplash.com/photo-1577495508326-19a1b3cf65b7?w=600&q=70',
    mapPosition: { left: '29%', top: '39%' },
    parent: null,
    children: [],
  },
  {
    id: 'street_view',
    label: 'Street View',
    sublabel: 'Exploration',
    treedisModelId: '0df38e34',
    treedisSweepId: 'gs6itzr7wgg9zm7iicpmf27qd',
    thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=70',
    mapPosition: { left: '32%', top: '58%' },
    parent: null,
    children: [],
  },
];

/* ==============================================================
   2. STATE
   ============================================================== */
let activeLocationId = 'campus_home';
let tourReady = false;
let menuOpen = true;
let mapVisible = true;

/* Map pan/zoom state */
const mapState = {
  scale: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
  minScale: 0.5,
  maxScale: 4,
};

/* ==============================================================
   3. TREEDIS SDK WRAPPER
   ============================================================== */
const TourBridge = {
  _iframe: null,
  _pingInterval: null,

  initialize(iframeElement) {
    this._iframe = iframeElement;
    window.addEventListener('message', this._onMessage.bind(this));
    logEvent('TourBridge initialized');
    this._pingInterval = setInterval(() => {
      if (!tourReady) { this.ping(); }
      else { clearInterval(this._pingInterval); logEvent('Tour ready — pings stopped'); }
    }, 2000);
  },

  _onMessage(event) {
    if (!event.data || typeof event.data !== 'object' || !event.data.type) return;
    const { type, ...data } = event.data;
    switch (type) {
      case 'TourReady':
        tourReady = true;
        logEvent('✅ TourReady');
        break;
      case 'PoseChanged': break;
      case 'SweepsChanged':
        logEvent(`SweepsChanged — ${data.sweeps?.length ?? 0} sweeps`);
        break;
      case 'TagClicked': logEvent(`TagClicked — ${data.tag?.title}`); break;
      case 'TagHovered': break;
      case 'TagFocused': logEvent(`TagFocused — ${data.tag?.title}`); break;
      case 'TagDocked': logEvent(`TagDocked — ${data.tag?.title}`); break;
    }
  },

  navigateToSweep(sweepId, options = {}) {
    if (!sweepId) { logEvent('⚠ Navigate skipped — no sweepId'); return; }
    const cmd = { type: 'Navigate', sweepId, transitionTime: options.transitionTime ?? 1500 };
    if (options.rotation) cmd.rotation = options.rotation;
    this._postCommand(cmd);
    logEvent(`Navigate → ${sweepId}`);
  },

  requestSweeps() { this._postCommand({ type: 'RequestSweeps' }); },
  ping() { this._postCommand({ type: 'Ping' }); },

  _postCommand(cmd) {
    if (this._iframe && this._iframe.contentWindow) {
      this._iframe.contentWindow.postMessage(cmd, '*');
    }
  },
};

/* ==============================================================
   4. HIGH-LEVEL WRAPPERS
   ============================================================== */

function initializeTreedisExperience() {
  const iframe = document.getElementById('tour-frame');
  if (iframe) TourBridge.initialize(iframe);
  else logEvent('⚠ #tour-frame not found');
}

function loadTreedisLocation(locationId) {
  const loc = LOCATION_DATA.find(l => l.id === locationId);
  if (!loc) return;
  activeLocationId = locationId;
  logEvent(`loadTreedisLocation("${locationId}")`);

  const labelEl = document.getElementById('current-location-label');
  if (labelEl) labelEl.textContent = loc.label;

  highlightActiveMenu(locationId);
  highlightActiveMapMarker(locationId);
  highlightActiveMobileCard(locationId);

  if (loc.treedisSweepId) {
    TourBridge.navigateToSweep(loc.treedisSweepId, { transitionTime: 1500 });
  } else {
    logEvent(`⚠ No sweepId for "${loc.label}"`);
  }
}

function switchTreedisFloor(buildingId, floorId) {
  logEvent(`switchTreedisFloor("${buildingId}", "${floorId}")`);
  loadTreedisLocation(floorId);
}

function resetToHomeView() { loadTreedisLocation('campus_home'); }
function openStudentPortal() { window.open('https://metaversitysportal.carrd.co/', '_blank'); }
function showHelp() { document.getElementById('help-modal').classList.remove('hidden'); }
function closeHelp() { document.getElementById('help-modal').classList.add('hidden'); }
function exitExperience() { if (confirm('Leave the campus tour?')) window.location.href = '#'; }

function toggleMenu() {
  const menu = document.getElementById('side-menu');
  menuOpen = !menuOpen;
  menu.classList.toggle('menu-closed', !menuOpen);
  menu.classList.toggle('menu-open', menuOpen);
  document.body.classList.toggle('menu-is-open', menuOpen);
}

/* ==============================================================
   5. MAP PANEL TOGGLE
   ============================================================== */

function toggleMapPanel() {
  const panel = document.getElementById('campus-map');
  const tab = document.getElementById('map-show-tab');
  const link = document.getElementById('toggle-map-link');
  if (!panel) return;

  mapVisible = !mapVisible;
  panel.classList.toggle('map-hidden', !mapVisible);
  if (tab) tab.style.display = mapVisible ? 'none' : 'block';
  if (link) link.textContent = mapVisible ? 'Hide Map' : 'Show Map';
}

/* ==============================================================
   6. MAP ZOOM / PAN
   ============================================================== */

function applyMapTransform() {
  const inner = document.getElementById('map-inner');
  if (!inner) return;
  inner.style.transform = `translate(${mapState.panX}px, ${mapState.panY}px) scale(${mapState.scale})`;
}

function mapZoomIn() {
  mapState.scale = Math.min(mapState.maxScale, mapState.scale * 1.3);
  applyMapTransform();
}

function mapZoomOut() {
  mapState.scale = Math.max(mapState.minScale, mapState.scale / 1.3);
  // Clamp pan so it doesn't fly off
  clampPan();
  applyMapTransform();
}

function mapResetView() {
  mapState.scale = 1;
  mapState.panX = 0;
  mapState.panY = 0;
  applyMapTransform();
}

function clampPan() {
  // Basic clamp — prevent panning too far off-screen
  const viewport = document.getElementById('map-viewport');
  const inner = document.getElementById('map-inner');
  if (!viewport || !inner) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const iw = inner.scrollWidth * mapState.scale;
  const ih = inner.scrollHeight * mapState.scale;
  const maxX = Math.max(0, (iw - vw) / 2);
  const maxY = Math.max(0, (ih - vh) / 2);
  mapState.panX = Math.max(-maxX, Math.min(maxX, mapState.panX));
  mapState.panY = Math.max(-maxY, Math.min(maxY, mapState.panY));
}

function initMapDrag() {
  const viewport = document.getElementById('map-viewport');
  if (!viewport) return;

  // Mouse events
  viewport.addEventListener('mousedown', (e) => {
    mapState.dragging = true;
    mapState.startX = e.clientX;
    mapState.startY = e.clientY;
    mapState.startPanX = mapState.panX;
    mapState.startPanY = mapState.panY;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!mapState.dragging) return;
    mapState.panX = mapState.startPanX + (e.clientX - mapState.startX);
    mapState.panY = mapState.startPanY + (e.clientY - mapState.startY);
    applyMapTransform();
  });
  window.addEventListener('mouseup', () => { mapState.dragging = false; });

  // Touch events
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    mapState.dragging = true;
    mapState.startX = e.touches[0].clientX;
    mapState.startY = e.touches[0].clientY;
    mapState.startPanX = mapState.panX;
    mapState.startPanY = mapState.panY;
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    if (!mapState.dragging || e.touches.length !== 1) return;
    mapState.panX = mapState.startPanX + (e.touches[0].clientX - mapState.startX);
    mapState.panY = mapState.startPanY + (e.touches[0].clientY - mapState.startY);
    applyMapTransform();
    e.preventDefault();
  }, { passive: false });
  viewport.addEventListener('touchend', () => { mapState.dragging = false; });

  // Scroll wheel zoom on map
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      mapState.scale = Math.min(mapState.maxScale, mapState.scale * 1.12);
    } else {
      mapState.scale = Math.max(mapState.minScale, mapState.scale / 1.12);
    }
    clampPan();
    applyMapTransform();
  }, { passive: false });
}

/**
 * Fit the map image to fill the viewport height,
 * then center it horizontally.
 */
function fitMapToViewport() {
  const viewport = document.getElementById('map-viewport');
  const img = document.getElementById('map-bg');
  const inner = document.getElementById('map-inner');
  if (!viewport || !img || !inner) return;

  // Wait for image to load
  const doFit = () => {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;

    // Scale image to fill viewport WIDTH (panoramic map is wide)
    const fitScale = vw / natW;
    const displayW = vw;
    const displayH = natH * fitScale;

    inner.style.width = displayW + 'px';
    inner.style.height = displayH + 'px';
    img.style.width = displayW + 'px';
    img.style.height = displayH + 'px';

    // Center vertically (image may be taller or shorter than panel)
    mapState.panX = 0;
    mapState.panY = (vh - displayH) / 2;
    mapState.scale = 1;
    applyMapTransform();
  };

  if (img.complete && img.naturalWidth) doFit();
  else img.addEventListener('load', doFit);

  // Re-fit on window resize
  window.addEventListener('resize', doFit);
}

/* ==============================================================
   7. UI HIGHLIGHTS
   ============================================================== */

function highlightActiveMenu(locationId) {
  document.querySelectorAll('#locations-list a').forEach(a => {
    a.classList.toggle('active', a.dataset.locationId === locationId);
  });
}
function highlightActiveMapMarker(locationId) {
  document.querySelectorAll('.map-marker').forEach(m => {
    m.classList.toggle('active', m.dataset.locationId === locationId);
  });
}
function highlightActiveMobileCard(locationId) {
  document.querySelectorAll('.mobile-loc-card').forEach(c => {
    c.classList.toggle('active', c.dataset.locationId === locationId);
  });
}

/* ==============================================================
   8. TOUCH GUARD
   ============================================================== */
function initTouchGuard() {
  const guard = document.getElementById('touch-guard');
  if (!guard) return;
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) return;

  guard.classList.add('active');
  guard.addEventListener('click', () => {
    guard.classList.add('dismissed');
    guard.classList.remove('active');
  });

  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!guard.classList.contains('active')) {
        guard.classList.remove('dismissed');
        guard.classList.add('active');
      }
    }, 300);
  }, { passive: true });
}

/* ==============================================================
   9. EVENT LOG
   ============================================================== */
function logEvent(msg) {
  const list = document.getElementById('event-log-list');
  if (!list) return;
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  list.prepend(li);
  while (list.children.length > 80) list.lastChild.remove();
}
function clearEventLog() { document.getElementById('event-log-list').innerHTML = ''; }
function toggleEventLog() { document.getElementById('event-log').classList.toggle('hidden'); }

/* ==============================================================
   10. BUILD UI ON PAGE LOAD
   ============================================================== */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Side menu ─────────────────────────────────────────── */
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
      loc.parent ? switchTreedisFloor(loc.parent, loc.id) : loadTreedisLocation(loc.id);
      if (window.innerWidth <= 600 && menuOpen) toggleMenu();
    });
    li.appendChild(a);
    locationsList.appendChild(li);
  });

  /* ── Map markers ───────────────────────────────────────── */
  const markersContainer = document.getElementById('map-markers');
  if (markersContainer) {
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
      marker.addEventListener('click', (e) => {
        e.stopPropagation(); // don't trigger map drag
        loadTreedisLocation(loc.id);
      });
      markersContainer.appendChild(marker);
    });
  }

  /* ── Mobile location cards ─────────────────────────────── */
  const mobileList = document.getElementById('mobile-locations-list');
  if (mobileList) {
    LOCATION_DATA.filter(l => !l.parent && l.id !== 'campus_home').forEach(loc => {
      const card = document.createElement('div');
      card.className = 'mobile-loc-card';
      card.dataset.locationId = loc.id;

      const img = document.createElement('img');
      img.src = loc.thumbnail;
      img.alt = loc.label;
      img.loading = 'lazy';

      const body = document.createElement('div');
      body.className = 'mobile-loc-card-body';
      const h4 = document.createElement('h4');
      h4.textContent = loc.label;
      body.appendChild(h4);
      if (loc.sublabel) {
        const sub = document.createElement('span');
        sub.textContent = loc.sublabel;
        body.appendChild(sub);
      }

      card.appendChild(img);
      card.appendChild(body);
      card.addEventListener('click', () => loadTreedisLocation(loc.id));
      mobileList.appendChild(card);
    });
  }

  /* ── Init ───────────────────────────────────────────────── */
  document.body.classList.add('menu-is-open');
  initTouchGuard();
  initMapDrag();
  fitMapToViewport();
  initializeTreedisExperience();
  logEvent('Page loaded — ready');
});
