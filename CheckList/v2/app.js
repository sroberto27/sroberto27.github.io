(() => {
  'use strict';

  /* ===================== FIELD DEFINITIONS ===================== */
  const TEXT_FIELDS = ['room-name', 'location-address', 'scouted-by', 'parking-capacity',
    'distance-to-location', 'wall-colors', 'flooring-type', 'owner-contact-name',
    'contact-information', 'noise-source', 'tags-categories', 'video-link'];
  const DATE_FIELDS = ['date-of-scouting'];
  const NUMBER_FIELDS = ['door-count', 'window-count', 'fixture-count', 'power-outlets'];
  const SELECT_FIELDS = ['equipment-accessibility', 'window-direction', 'natural-light-type',
    'color-temperature', 'control-options', 'outlet-locations', 'network-connectivity',
    'flooring-condition', 'room-acoustics'];
  const CHECKBOX_FIELDS = ['room-layout-sketch', 'wide-angle', 'close-up', 'video', 'staging-area',
    'overhead', 'sconce', 'lamp', 'LED', 'ceiling', 'wall', 'table', 'circuit-capacity',
    'furniture-present', 'ease-of-moving-furniture', 'zoning-regulations', 'ownership-confirmed',
    'permission-to-film', 'ambient-noise', 'detailed-report', 'database-entry'];
  const TEXTAREA_FIELDS = ['connectivity-details', 'architectural-details', 'additional-notes'];

  const ALL_FIELDS = [...TEXT_FIELDS, ...DATE_FIELDS, ...NUMBER_FIELDS, ...SELECT_FIELDS,
    ...CHECKBOX_FIELDS, ...TEXTAREA_FIELDS];

  const SECTION_META = [
    { n: 1, name: 'General Information', icon: 'fa-circle-info',
      fields: ['room-name', 'location-address', 'date-of-scouting', 'scouted-by', 'room-layout-sketch', 'wide-angle', 'close-up', 'video'] },
    { n: 2, name: 'Exterior Details', icon: 'fa-door-open',
      fields: ['door-count', 'equipment-accessibility', 'staging-area', 'parking-capacity', 'distance-to-location'] },
    { n: 3, name: 'Lighting Assessment', icon: 'fa-lightbulb',
      fields: ['window-count', 'window-direction', 'natural-light-type', 'fixture-count', 'overhead', 'sconce', 'lamp', 'LED', 'ceiling', 'wall', 'table', 'color-temperature', 'control-options'] },
    { n: 4, name: 'Power & Network', icon: 'fa-plug',
      fields: ['power-outlets', 'outlet-locations', 'network-connectivity', 'circuit-capacity', 'connectivity-details'] },
    { n: 5, name: 'Aesthetic & Design', icon: 'fa-paint-roller',
      fields: ['wall-colors', 'flooring-type', 'architectural-details', 'flooring-condition', 'furniture-present', 'ease-of-moving-furniture'] },
    { n: 6, name: 'Compliance & Permissions', icon: 'fa-file-signature',
      fields: ['zoning-regulations', 'ownership-confirmed', 'owner-contact-name', 'contact-information', 'permission-to-film'] },
    { n: 7, name: 'Acoustic Evaluation', icon: 'fa-volume-high',
      fields: ['ambient-noise', 'noise-source', 'room-acoustics'] },
    { n: 8, name: 'Final Documentation', icon: 'fa-clipboard-check',
      fields: ['detailed-report', 'database-entry', 'tags-categories', 'additional-notes'] },
  ];

  const TOTAL_TRACKED_FIELDS = SECTION_META.reduce((sum, sec) => sum + sec.fields.length, 0);

  const PHOTO_KEYS = ['wide-angle', 'close-up'];

  const STORAGE_LOCATIONS = 'lsc2_locations';
  const STORAGE_ACTIVE = 'lsc2_active';
  const STORAGE_THEME = 'lsc2_theme';

  /* ===================== STATE ===================== */
  let locations = {};
  let activeId = null;
  let saveTimer = null;
  let pendingConfirm = null;

  /* ===================== HELPERS ===================== */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => 'loc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function blankLocation(name) {
    return {
      id: uid(),
      name: name || 'Untitled Location',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fields: {},
      touched: {},
      photos: { 'wide-angle': [], 'close-up': [] },
      rating: 0,
      status: ''
    };
  }

  function loadLocationsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_LOCATIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) { /* ignore corrupt data */ }
    return null;
  }

  function persistLocations() {
    try {
      localStorage.setItem(STORAGE_LOCATIONS, JSON.stringify(locations));
      localStorage.setItem(STORAGE_ACTIVE, activeId);
      return true;
    } catch (e) {
      setSaveStatus('error', 'Storage full — remove some photos');
      return false;
    }
  }

  /* ===================== FORM <-> DATA ===================== */
  function collectFormData() {
    const data = {};
    TEXT_FIELDS.concat(DATE_FIELDS, TEXTAREA_FIELDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) data[id] = el.value;
    });
    NUMBER_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) data[id] = parseInt(el.value, 10) || 0;
    });
    SELECT_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) data[id] = el.value;
    });
    CHECKBOX_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) data[id] = el.checked;
    });
    return data;
  }

  function applyFormData(fields) {
    fields = fields || {};
    TEXT_FIELDS.concat(DATE_FIELDS, TEXTAREA_FIELDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = fields[id] || '';
    });
    NUMBER_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = Number.isFinite(fields[id]) ? fields[id] : 0;
    });
    SELECT_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = fields[id] || '';
    });
    CHECKBOX_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!fields[id];
    });
  }

  function fieldIsAnswered(id, fields, touched) {
    if (touched && touched[id]) return true;
    const v = fields ? fields[id] : undefined;
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return v === true;
    if (typeof v === 'number') return v > 0;
    return String(v).trim() !== '';
  }

  /* ===================== LOCATION MANAGEMENT ===================== */
  function ensureAtLeastOneLocation() {
    if (Object.keys(locations).length === 0) {
      const loc = blankLocation('Location 1');
      locations[loc.id] = loc;
      activeId = loc.id;
    }
  }

  function populateLocationSelect() {
    const sel = qs('#locationSelect');
    sel.innerHTML = '';
    const sorted = Object.values(locations).sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.name;
      sel.appendChild(opt);
    });
    sel.value = activeId;
  }

  function loadLocationIntoForm(id) {
    const loc = locations[id];
    if (!loc) return;
    activeId = id;
    applyFormData(loc.fields);
    qs('#overallStatus').value = loc.status || '';
    setStars(loc.rating || 0);
    PHOTO_KEYS.forEach(renderPhotos);
    renderGeoStatus();
    renderNoiseStatus();
    populateLocationSelect();
    updateProgressUI();
    setSaveStatus('saved', 'All changes saved');
  }

  function switchLocation(id) {
    if (id === activeId) return;
    loadLocationIntoForm(id);
  }

  function currentLocation() {
    return locations[activeId];
  }

  /* ===================== SAVE / STATUS ===================== */
  function setSaveStatus(kind, text) {
    const el = qs('#saveStatus');
    el.className = 'save-status' + (kind === 'saved' ? '' : ' ' + kind);
    const icon = kind === 'saved' ? 'fa-circle-check' : kind === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-notch fa-spin';
    el.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${text}</span>`;
  }

  function scheduleSave() {
    setSaveStatus('unsaved', 'Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistCurrent, 500);
  }

  function persistCurrent() {
    const loc = currentLocation();
    if (!loc) return;
    // merge (not replace) so device-captured extras like geo-lat/geo-lon/
    // noise-level-reading — which have no matching form element — survive
    Object.assign(loc.fields, collectFormData());
    loc.status = qs('#overallStatus').value;
    loc.updatedAt = Date.now();
    const ok = persistLocations();
    if (ok) setSaveStatus('saved', 'All changes saved');
    updateProgressUI();
  }

  function markTouched(id) {
    const loc = currentLocation();
    if (!loc) return;
    loc.touched[id] = true;
  }

  /* ===================== PROGRESS / NAV ===================== */
  function buildSectionNav() {
    const list = qs('#sectionList');
    list.innerHTML = '';
    SECTION_META.forEach(sec => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#sec-${sec.n}" data-sec="${sec.n}">
        <span class="snum">${sec.n}</span>
        <span class="sname">${sec.name}</span>
        <span class="sfrac" id="sfrac-${sec.n}"></span>
      </a>`;
      list.appendChild(li);
    });
    qsa('#sectionList a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 980) closeSidenav();
      });
    });
  }

  function updateProgressUI() {
    const loc = currentLocation();
    if (!loc) return;
    const fields = loc.fields || {};
    const touched = loc.touched || {};
    let totalAnswered = 0;
    SECTION_META.forEach(sec => {
      const answered = sec.fields.filter(id => fieldIsAnswered(id, fields, touched)).length;
      totalAnswered += answered;
      const frac = qs(`#sfrac-${sec.n}`);
      if (frac) frac.textContent = `${answered}/${sec.fields.length}`;
      const link = qs(`a[data-sec="${sec.n}"]`);
      if (link) link.classList.toggle('complete', answered === sec.fields.length);
    });
    const pct = Math.round((totalAnswered / TOTAL_TRACKED_FIELDS) * 100);
    qs('#progressFill').style.width = pct + '%';
    qs('#progressLabel').textContent = pct + '% complete';
  }

  function setupSectionObserver() {
    const links = qsa('#sectionList a');
    const sections = qsa('section[data-section]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const n = entry.target.dataset.section;
          links.forEach(l => l.classList.toggle('active', l.dataset.sec === n));
        }
      });
    }, { rootMargin: '-200px 0px -70% 0px', threshold: 0 });
    sections.forEach(s => observer.observe(s));
  }

  /* ===================== STAR RATING ===================== */
  function setStars(val) {
    qsa('#starRating .star').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val, 10) <= val);
    });
    qs('#starRating').dataset.value = val;
  }

  function bindStars() {
    qsa('#starRating .star').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        const current = parseInt(qs('#starRating').dataset.value || '0', 10);
        const next = val === current ? 0 : val; // click same star again to clear
        setStars(next);
        const loc = currentLocation();
        if (loc) loc.rating = next;
        scheduleSave();
      });
    });
  }

  /* ===================== PHOTOS ===================== */
  function renderPhotos(key) {
    const strip = qs(`#photos-${key}`);
    if (!strip) return;
    const loc = currentLocation();
    const photos = (loc && loc.photos && loc.photos[key]) || [];
    strip.innerHTML = '';
    photos.forEach((src, idx) => {
      const div = document.createElement('div');
      div.className = 'photo-thumb';
      div.innerHTML = `<img src="${src}" alt="Attached photo"><button type="button" class="rm" data-key="${key}" data-idx="${idx}" aria-label="Remove photo">✕</button>`;
      strip.appendChild(div);
    });
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxW = 1000;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function bindPhotoInputs() {
    qsa('.photo-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        qs(`.photo-input[data-target="${target}"]`).click();
      });
    });
    qsa('.photo-input').forEach(input => {
      input.addEventListener('change', async () => {
        const key = input.dataset.target;
        const loc = currentLocation();
        if (!loc) return;
        const files = Array.from(input.files || []);
        for (const file of files) {
          try {
            const dataUrl = await resizeImage(file);
            loc.photos[key].push(dataUrl);
          } catch (e) { /* skip unreadable file */ }
        }
        if (files.length) {
          document.getElementById(key).checked = true;
          markTouched(key);
          renderPhotos(key);
          scheduleSave();
        }
        input.value = '';
      });
    });
    qsa('.photo-strip').forEach(strip => {
      strip.addEventListener('click', e => {
        const btn = e.target.closest('.rm');
        if (!btn) return;
        const loc = currentLocation();
        if (!loc) return;
        loc.photos[btn.dataset.key].splice(parseInt(btn.dataset.idx, 10), 1);
        renderPhotos(btn.dataset.key);
        scheduleSave();
      });
    });
  }

  /* ===================== COUNTERS ===================== */
  function bindCounters() {
    qsa('.counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        let v = parseInt(input.value, 10) || 0;
        v = btn.dataset.action === 'inc' ? v + 1 : Math.max(0, v - 1);
        input.value = v;
        markTouched(input.id);
        scheduleSave();
        updateProgressUI();
      });
    });
  }

  /* ===================== GENERIC FIELD BINDING ===================== */
  function bindFormFields() {
    ALL_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date') ? 'change' : 'input';
      el.addEventListener(evt, () => {
        markTouched(id);
        scheduleSave();
        updateProgressUI();
      });
    });
    qs('#overallStatus').addEventListener('change', () => {
      scheduleSave();
    });
  }

  /* ===================== MODAL ===================== */
  function showModal({ title, body, showInput = false, inputValue = '', confirmText = 'Confirm', danger = false, onConfirm }) {
    qs('#modalTitle').textContent = title;
    qs('#modalBody').textContent = body || '';
    const wrap = qs('#modalInputWrap');
    const input = qs('#modalInput');
    wrap.classList.toggle('open', showInput);
    input.value = inputValue;
    const confirmBtn = qs('#modalConfirm');
    confirmBtn.textContent = confirmText;
    confirmBtn.classList.toggle('tbtn--danger', danger);
    confirmBtn.classList.toggle('tbtn--primary', !danger);
    pendingConfirm = () => onConfirm(showInput ? input.value.trim() : null);
    qs('#modalBackdrop').classList.add('open');
    if (showInput) setTimeout(() => input.focus(), 50);
  }

  function closeModal() {
    qs('#modalBackdrop').classList.remove('open');
    pendingConfirm = null;
  }

  function bindModal() {
    qs('#modalCancel').addEventListener('click', closeModal);
    qs('#modalBackdrop').addEventListener('click', e => {
      if (e.target.id === 'modalBackdrop') closeModal();
    });
    qs('#modalConfirm').addEventListener('click', () => {
      if (pendingConfirm) pendingConfirm();
      closeModal();
    });
    qs('#modalInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (pendingConfirm) pendingConfirm(); closeModal(); }
    });
  }

  /* ===================== TOAST ===================== */
  function toast(message, kind = 'info') {
    const stack = qs('#toastStack');
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'success' ? ' success' : kind === 'error' ? ' error' : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ===================== TOOLBAR ACTIONS ===================== */
  function bindToolbar() {
    qs('#locationSelect').addEventListener('change', e => switchLocation(e.target.value));

    qs('#btnNew').addEventListener('click', () => {
      showModal({
        title: 'New Location',
        body: 'Give this location a name to start a fresh checklist.',
        showInput: true,
        inputValue: `Location ${Object.keys(locations).length + 1}`,
        confirmText: 'Create',
        onConfirm: name => {
          if (!name) return;
          const loc = blankLocation(name);
          locations[loc.id] = loc;
          persistLocations();
          loadLocationIntoForm(loc.id);
          toast('New location created', 'success');
        }
      });
    });

    qs('#btnRename').addEventListener('click', () => {
      const loc = currentLocation();
      showModal({
        title: 'Rename Location',
        body: 'Enter a new name for this location.',
        showInput: true,
        inputValue: loc.name,
        confirmText: 'Rename',
        onConfirm: name => {
          if (!name) return;
          loc.name = name;
          persistLocations();
          populateLocationSelect();
          toast('Location renamed', 'success');
        }
      });
    });

    qs('#btnDuplicate').addEventListener('click', () => {
      const loc = currentLocation();
      showModal({
        title: 'Duplicate Location',
        body: 'Name for the duplicated checklist.',
        showInput: true,
        inputValue: `${loc.name} (Copy)`,
        confirmText: 'Duplicate',
        onConfirm: name => {
          if (!name) return;
          const clone = JSON.parse(JSON.stringify(loc));
          clone.id = uid();
          clone.name = name;
          clone.createdAt = Date.now();
          clone.updatedAt = Date.now();
          locations[clone.id] = clone;
          persistLocations();
          loadLocationIntoForm(clone.id);
          toast('Location duplicated', 'success');
        }
      });
    });

    qs('#btnDelete').addEventListener('click', () => {
      const loc = currentLocation();
      if (Object.keys(locations).length <= 1) {
        toast('You need at least one location', 'error');
        return;
      }
      showModal({
        title: 'Delete Location',
        body: `Delete "${loc.name}"? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
        onConfirm: () => {
          delete locations[loc.id];
          const nextId = Object.keys(locations)[0];
          persistLocations();
          loadLocationIntoForm(nextId);
          toast('Location deleted', 'success');
        }
      });
    });

    qs('#btnClear').addEventListener('click', () => {
      const loc = currentLocation();
      showModal({
        title: 'Clear This Location',
        body: `Erase all entered data for "${loc.name}"? The location itself will stay in your list.`,
        confirmText: 'Clear Data',
        danger: true,
        onConfirm: () => {
          loc.fields = {};
          loc.touched = {};
          loc.photos = { 'wide-angle': [], 'close-up': [] };
          loc.rating = 0;
          loc.status = '';
          persistLocations();
          loadLocationIntoForm(loc.id);
          toast('Location data cleared', 'success');
        }
      });
    });

    const doExport = () => {
      const loc = currentLocation();
      Object.assign(loc.fields, collectFormData());
      const blob = new Blob([JSON.stringify(loc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${loc.name.replace(/[^a-z0-9\-_]+/gi, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Exported JSON', 'success');
    };
    qs('#btnExport').addEventListener('click', doExport);
    qs('#btnExportBottom').addEventListener('click', doExport);

    qs('#btnImport').addEventListener('click', () => qs('#importFile').click());
    qs('#importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object' || !data.fields) throw new Error('bad shape');
          const loc = blankLocation(data.name ? `${data.name} (Imported)` : 'Imported Location');
          loc.fields = data.fields || {};
          loc.touched = data.touched || {};
          loc.photos = data.photos || { 'wide-angle': [], 'close-up': [] };
          loc.rating = data.rating || 0;
          loc.status = data.status || '';
          locations[loc.id] = loc;
          persistLocations();
          loadLocationIntoForm(loc.id);
          toast('Location imported', 'success');
        } catch (err) {
          toast('Could not read that file — invalid checklist JSON', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    const doPrint = () => window.print();
    qs('#btnPrint').addEventListener('click', doPrint);
    qs('#btnPrintBottom').addEventListener('click', doPrint);

    qs('#btnSaveBottom').addEventListener('click', () => { persistCurrent(); toast('Saved', 'success'); });
  }

  /* ===================== THEME ===================== */
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    qs('#themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_THEME, next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    qs('#themeToggle').innerHTML = theme === 'dark'
      ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }

  /* ===================== DEVICE: GPS LOCATION ===================== */
  function renderGeoStatus() {
    const status = qs('#geoStatus');
    if (!status) return;
    const loc = currentLocation();
    const lat = loc.fields['geo-lat'], lon = loc.fields['geo-lon'];
    if (lat !== undefined && lon !== undefined) {
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
      status.innerHTML = `<i class="fa-solid fa-map-pin"></i> <a href="${mapsUrl}" target="_blank" rel="noopener">View captured GPS location on map</a>`;
    } else {
      status.textContent = '';
    }
  }

  function bindGeolocation() {
    const btn = qs('#btnGeoLocate');
    if (!btn) return;
    if (!('geolocation' in navigator)) {
      btn.disabled = true;
      btn.title = 'Location services are not available on this device/browser';
      return;
    }
    btn.addEventListener('click', () => {
      const status = qs('#geoStatus');
      status.textContent = 'Locating…';
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        const loc = currentLocation();
        loc.fields['geo-lat'] = latitude;
        loc.fields['geo-lon'] = longitude;
        renderGeoStatus();
        try {
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`,
            { headers: { 'Accept': 'application/json' } });
          if (resp.ok) {
            const data = await resp.json();
            const addrEl = document.getElementById('location-address');
            if (data && data.display_name && addrEl && !addrEl.value.trim()) {
              addrEl.value = data.display_name;
              markTouched('location-address');
            }
          }
        } catch (e) { /* offline or blocked — coordinates + map link are still captured */ }
        markTouched('location-address');
        scheduleSave();
        btn.disabled = false;
        toast('GPS location captured', 'success');
      }, () => {
        status.textContent = 'Could not get your location — check location permissions.';
        btn.disabled = false;
        toast('Location access denied or unavailable', 'error');
      }, { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  /* ===================== DEVICE: COMPASS ===================== */
  function headingToCardinal(heading) {
    const h = ((heading % 360) + 360) % 360;
    if (h >= 315 || h < 45) return 'North';
    if (h >= 45 && h < 135) return 'East';
    if (h >= 135 && h < 225) return 'South';
    return 'West';
  }

  function bindCompass() {
    const btn = qs('#btnCompass');
    if (!btn) return;
    if (!('DeviceOrientationEvent' in window)) {
      btn.disabled = true;
      btn.title = 'Compass is not available on this device/browser';
      return;
    }
    btn.addEventListener('click', async () => {
      const status = qs('#compassStatus');
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm !== 'granted') { toast('Compass permission denied', 'error'); return; }
        }
      } catch (e) {
        toast('Could not access the compass', 'error');
        return;
      }
      status.textContent = 'Hold the phone flat, pointed at the window…';
      let settled = false;
      const handler = e => {
        if (settled) return;
        let heading = null;
        if (typeof e.webkitCompassHeading === 'number') {
          heading = e.webkitCompassHeading;
        } else if (typeof e.alpha === 'number') {
          heading = 360 - e.alpha;
        }
        if (heading === null) return;
        settled = true;
        window.removeEventListener('deviceorientationabsolute', handler);
        window.removeEventListener('deviceorientation', handler);
        const dir = headingToCardinal(heading);
        const sel = document.getElementById('window-direction');
        sel.value = dir;
        markTouched('window-direction');
        scheduleSave();
        updateProgressUI();
        status.textContent = `Detected ≈ ${Math.round(heading)}° → set to ${dir}`;
        toast(`Window direction set to ${dir}`, 'success');
      };
      window.addEventListener('deviceorientationabsolute', handler);
      window.addEventListener('deviceorientation', handler);
      setTimeout(() => {
        if (!settled) {
          window.removeEventListener('deviceorientationabsolute', handler);
          window.removeEventListener('deviceorientation', handler);
          status.textContent = 'No compass reading available on this device.';
        }
      }, 4000);
    });
  }

  /* ===================== DEVICE: MICROPHONE NOISE METER ===================== */
  function renderNoiseStatus() {
    const status = qs('#noiseMeterStatus');
    if (!status) return;
    const loc = currentLocation();
    const reading = loc.fields['noise-level-reading'];
    status.textContent = (reading !== undefined)
      ? `Last measured relative level: ${reading}/100 (not a calibrated decibel meter)`
      : '';
  }

  function bindNoiseMeter() {
    const btn = qs('#btnNoiseMeter');
    if (!btn) return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      btn.disabled = true;
      btn.title = 'Microphone access is not available on this device/browser';
      return;
    }
    btn.addEventListener('click', async () => {
      const status = qs('#noiseMeterStatus');
      btn.disabled = true;
      status.textContent = 'Listening… hold still for 3 seconds.';
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        status.textContent = 'Microphone access denied.';
        btn.disabled = false;
        toast('Microphone permission denied', 'error');
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const samples = [];
      const start = Date.now();

      const sample = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSquares += v * v;
        }
        samples.push(Math.sqrt(sumSquares / data.length));
        if (Date.now() - start < 3000) {
          requestAnimationFrame(sample);
        } else {
          finish();
        }
      };

      const finish = () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        const avgRms = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
        const relativeLevel = Math.max(0, Math.min(100, Math.round(20 * Math.log10(avgRms || 0.0001) + 100)));
        const loc = currentLocation();
        loc.fields['noise-level-reading'] = relativeLevel;

        let suggestion = 'None';
        if (relativeLevel > 55) suggestion = 'Moderate';
        else if (relativeLevel > 35) suggestion = 'Slight';
        const acousticsSelect = document.getElementById('room-acoustics');
        if (!acousticsSelect.value) {
          acousticsSelect.value = suggestion;
          markTouched('room-acoustics');
        }
        if (relativeLevel > 35) {
          document.getElementById('ambient-noise').checked = true;
          markTouched('ambient-noise');
        }

        renderNoiseStatus();
        scheduleSave();
        updateProgressUI();
        btn.disabled = false;
        toast('Noise level measured', 'success');
      };

      requestAnimationFrame(sample);
    });
  }

  /* ===================== DEVICE: NATIVE SHARE ===================== */
  function bindShare() {
    const btns = [qs('#btnShare'), qs('#btnShareBottom')].filter(Boolean);
    if (!btns.length) return;
    if (!navigator.share) {
      btns.forEach(b => b.style.display = 'none');
      return;
    }
    btns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const loc = currentLocation();
        Object.assign(loc.fields, collectFormData());
        const json = JSON.stringify(loc, null, 2);
        const fileName = `${loc.name.replace(/[^a-z0-9\-_]+/gi, '_')}.json`;
        try {
          const file = new File([json], fileName, { type: 'application/json' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: loc.name, text: 'Location scouting checklist' });
          } else {
            await navigator.share({ title: loc.name, text: `Location scouting checklist: ${loc.name}` });
          }
        } catch (e) {
          if (e.name !== 'AbortError') toast('Sharing was cancelled or is unavailable here', 'error');
        }
      });
    });
  }

  /* ===================== STICKY OFFSET ===================== */
  // The sticky topbar + toolbar wrap onto extra rows at narrow widths, so their
  // combined height isn't a fixed number. Measure it for real and expose it as a
  // CSS var so section-jump scrolling and the sidenav never land underneath them.
  function updateStickyOffset() {
    const topbar = qs('.topbar');
    const toolbar = qs('.toolbar');
    const total = (topbar ? topbar.offsetHeight : 0) + (toolbar ? toolbar.offsetHeight : 0);
    document.documentElement.style.setProperty('--sticky-offset', total + 'px');
  }

  function bindStickyOffset() {
    updateStickyOffset();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateStickyOffset, 150);
    });
    window.addEventListener('orientationchange', () => setTimeout(updateStickyOffset, 250));
  }

  /* ===================== MOBILE NAV ===================== */
  function openSidenav() {
    qs('#sidenav').classList.add('open');
    qs('#sidenavBackdrop').classList.add('open');
    document.body.classList.add('no-scroll');
  }
  function closeSidenav() {
    qs('#sidenav').classList.remove('open');
    qs('#sidenavBackdrop').classList.remove('open');
    document.body.classList.remove('no-scroll');
  }
  function bindMobileNav() {
    qs('#navToggle').addEventListener('click', openSidenav);
    qs('#sidenavBackdrop').addEventListener('click', closeSidenav);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && qs('#sidenav').classList.contains('open')) closeSidenav();
    });
  }

  /* ===================== INIT ===================== */
  function init() {
    initTheme();

    const stored = loadLocationsFromStorage();
    locations = stored || {};
    ensureAtLeastOneLocation();

    const storedActive = localStorage.getItem(STORAGE_ACTIVE);
    activeId = (storedActive && locations[storedActive]) ? storedActive : Object.keys(locations)[0];

    buildSectionNav();
    bindFormFields();
    bindCounters();
    bindPhotoInputs();
    bindStars();
    bindModal();
    bindToolbar();
    bindMobileNav();
    bindStickyOffset();
    bindGeolocation();
    bindCompass();
    bindNoiseMeter();
    bindShare();
    setupSectionObserver();

    loadLocationIntoForm(activeId);
    persistLocations();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
