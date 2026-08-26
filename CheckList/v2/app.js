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
  const MEDIA_CATEGORIES = ['wide-angle', 'close-up', 'panorama-360', 'video'];
  const MEDIA_FIELD_SET = new Set(['wide-angle', 'close-up', 'video']); // presence toggles shown via the photo grid, not the text dump

  const STORAGE_LOCATIONS = 'lsc2_locations';
  const STORAGE_ACTIVE = 'lsc2_active';
  const STORAGE_THEME = 'lsc2_theme';

  /* ===================== STATE ===================== */
  let locations = {};
  let activeId = null;
  let saveTimer = null;
  let pendingConfirm = null;
  let mediaAvailable = false;

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
      media: { 'wide-angle': [], 'close-up': [], 'panorama-360': [], 'video': [] },
      rating: 0,
      status: ''
    };
  }

  function normalizeLocation(loc) {
    loc.media = loc.media || { 'wide-angle': [], 'close-up': [], 'panorama-360': [], 'video': [] };
    MEDIA_CATEGORIES.forEach(cat => { if (!Array.isArray(loc.media[cat])) loc.media[cat] = []; });
    return loc;
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
      setSaveStatus('error', 'Storage full — remove some photos/video');
      toast('Local storage is full. Free up space (remove photos or old locations) to keep saving.', 'error');
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
    if (window.LSCMedia) window.LSCMedia.revokeAll(); // drop the previous location's object URLs
    applyFormData(loc.fields);
    qs('#overallStatus').value = loc.status || '';
    setStars(loc.rating || 0);
    PHOTO_KEYS.forEach(renderPhotoStrip);
    renderPanoramaCard();
    renderVideoAttachment();
    renderGeoStatus();
    renderNoiseStatus();
    populateLocationSelect();
    updateProgressUI();
    setSaveStatus('saved', 'All changes saved');
    if (loc._photosMigrationPartial) {
      toast('Some legacy photos for this location could not be migrated and were left in place.', 'error');
    }
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

  /* ===================== PHOTOS (wide-angle / close-up) ===================== */
  function resizeImageToBlob(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxW = 1600;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (!blob) { reject(new Error('encode failed')); return; }
            resolve({ blob, width: canvas.width, height: canvas.height });
          }, 'image/jpeg', 0.82);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function resizeImageToDataUrl(file) {
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

  async function renderPhotoStrip(key) {
    const strip = qs(`#photos-${key}`);
    if (!strip) return;
    const loc = currentLocation();
    if (!loc) return;
    strip.innerHTML = '';

    // legacy fallback entries (only present when IndexedDB was unavailable at capture time)
    const legacy = (loc.photos && loc.photos[key]) || [];
    legacy.forEach((src, idx) => {
      const div = document.createElement('div');
      div.className = 'photo-thumb';
      div.innerHTML = `<img src="${src}" alt="Attached photo"><button type="button" class="rm" data-legacy-key="${key}" data-idx="${idx}" aria-label="Remove photo">✕</button>`;
      strip.appendChild(div);
    });

    const ids = loc.media[key] || [];
    for (const id of ids) {
      const url = await window.LSCMedia.getObjectUrlFor(id).catch(() => null);
      const div = document.createElement('div');
      div.className = 'photo-thumb';
      if (url) {
        div.innerHTML = `<img src="${url}" alt="Attached photo"><button type="button" class="rm" data-media-key="${key}" data-media-id="${id}" aria-label="Remove photo">✕</button>`;
      } else {
        div.innerHTML = `<div class="photo-thumb-broken" title="This photo could not be loaded">⚠</div><button type="button" class="rm" data-media-key="${key}" data-media-id="${id}" aria-label="Remove photo">✕</button>`;
      }
      strip.appendChild(div);
    }
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
        let added = 0;
        for (const file of files) {
          try {
            if (mediaAvailable) {
              const { blob, width, height } = await resizeImageToBlob(file);
              const id = await window.LSCMedia.putMedia({
                locationId: loc.id, category: key, filename: `${key}_${Date.now()}_${added}.jpg`,
                mime: 'image/jpeg', originalFilename: file.name, width, height, blob
              });
              loc.media[key].push(id);
            } else {
              const dataUrl = await resizeImageToDataUrl(file);
              loc.photos = loc.photos || { 'wide-angle': [], 'close-up': [] };
              loc.photos[key] = loc.photos[key] || [];
              loc.photos[key].push(dataUrl);
            }
            added++;
          } catch (e) { /* skip unreadable file */ }
        }
        if (added) {
          document.getElementById(key).checked = true;
          markTouched(key);
          await renderPhotoStrip(key);
          scheduleSave();
          toast(`${added} photo(s) attached`, 'success');
        } else if (files.length) {
          toast('Could not attach the selected photo(s)', 'error');
        }
        input.value = '';
      });
    });
    qsa('.photo-strip').forEach(strip => {
      strip.addEventListener('click', async e => {
        const btn = e.target.closest('.rm');
        if (!btn) return;
        const loc = currentLocation();
        if (!loc) return;
        if (btn.dataset.legacyKey) {
          loc.photos[btn.dataset.legacyKey].splice(parseInt(btn.dataset.idx, 10), 1);
        } else if (btn.dataset.mediaKey) {
          const key = btn.dataset.mediaKey, id = btn.dataset.mediaId;
          try { await window.LSCMedia.deleteMedia(id); } catch (err) { /* continue removing the reference regardless */ }
          loc.media[key] = loc.media[key].filter(x => x !== id);
        }
        await renderPhotoStrip(btn.dataset.legacyKey || btn.dataset.mediaKey);
        scheduleSave();
      });
    });
  }

  /* ===================== VIDEO ATTACHMENT ===================== */
  async function renderVideoAttachment() {
    const box = qs('#videoAttachment');
    if (!box) return;
    const loc = currentLocation();
    box.innerHTML = '';
    const ids = (loc.media && loc.media.video) || [];
    for (const id of ids) {
      const rec = await window.LSCMedia.getMedia(id).catch(() => null);
      if (!rec) continue;
      const url = await window.LSCMedia.getObjectUrlFor(id).catch(() => null);
      const card = document.createElement('div');
      card.className = 'media-attach-card';
      const sizeLabel = rec.blob && rec.blob.size ? (rec.blob.size > 1024 * 1024 ? (rec.blob.size / (1024 * 1024)).toFixed(1) + ' MB' : Math.round(rec.blob.size / 1024) + ' KB') : '';
      card.innerHTML = `
        <div class="media-attach-info"><i class="fa-solid fa-file-video"></i> <span>${rec.originalFilename || rec.filename}</span> <span class="media-attach-meta">${sizeLabel}</span></div>
        <div class="media-attach-actions">
          ${url ? `<button type="button" class="tbtn tbtn--sm video-play" data-url="${url}"><i class="fa-solid fa-play"></i> Play</button>` : ''}
          <button type="button" class="tbtn tbtn--sm tbtn--danger video-remove" data-id="${id}"><i class="fa-solid fa-trash"></i> Remove</button>
        </div>
        <video class="media-attach-preview" hidden playsinline controls></video>`;
      box.appendChild(card);
    }
    box.querySelectorAll('.video-play').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.media-attach-card');
        const video = card.querySelector('.media-attach-preview');
        video.src = btn.dataset.url;
        video.hidden = false;
        video.play().catch(() => {});
      });
    });
    box.querySelectorAll('.video-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const loc2 = currentLocation();
        try { await window.LSCMedia.deleteMedia(btn.dataset.id); } catch (e) { /* continue */ }
        loc2.media.video = loc2.media.video.filter(x => x !== btn.dataset.id);
        await renderVideoAttachment();
        scheduleSave();
        toast('Video removed', 'success');
      });
    });
  }

  function bindVideoAttach() {
    const btn = qs('#btnVideoAttach');
    const input = qs('#inputVideoAttach');
    if (!btn || !input) return;
    if (!mediaAvailable) {
      btn.disabled = true;
      btn.title = 'Video attachment needs browser storage that is not available here';
      return;
    }
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      const loc = currentLocation();
      if (!loc) return;
      if (file.size > 500 * 1024 * 1024) {
        toast('That video is very large (>500MB) — attaching it anyway, but export/ZIP may be slow.', 'error');
      }
      try {
        const id = await window.LSCMedia.putMedia({
          locationId: loc.id, category: 'video', filename: file.name || 'video',
          mime: file.type || 'video/mp4', originalFilename: file.name, blob: file
        });
        loc.media.video.push(id);
        document.getElementById('video').checked = true;
        markTouched('video');
        await renderVideoAttachment();
        scheduleSave();
        toast('Video attached', 'success');
      } catch (e) {
        toast('Could not store that video — it may be too large for available storage.', 'error');
      }
    });
  }

  /* ===================== 360° PANORAMA ===================== */
  async function renderPanoramaCard() {
    const strip = qs('#pano360Strip');
    const hint = qs('#pano360Hint');
    if (!strip) return;
    const loc = currentLocation();
    strip.innerHTML = '';
    if (hint) hint.innerHTML = '';

    const ids = (loc.media && loc.media['panorama-360']) || [];
    for (const id of ids) {
      const rec = await window.LSCMedia.getMedia(id).catch(() => null);
      if (!rec) continue;
      const url = await window.LSCMedia.getObjectUrlFor(id).catch(() => null);
      const card = document.createElement('div');
      card.className = 'pano-card';
      card.innerHTML = `
        ${url ? `<img src="${url}" alt="360 panorama" class="pano-thumb">` : `<div class="photo-thumb-broken">⚠</div>`}
        <div class="pano-card-actions">
          <button type="button" class="tbtn tbtn--sm pano-view" data-id="${id}"><i class="fa-solid fa-street-view"></i> View 360°</button>
          <button type="button" class="tbtn tbtn--sm pano-retake" data-id="${id}"><i class="fa-solid fa-arrows-rotate"></i> Retake</button>
          <button type="button" class="tbtn tbtn--sm tbtn--danger pano-delete" data-id="${id}" data-session="${rec.sessionId || ''}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>`;
      strip.appendChild(card);
    }

    strip.querySelectorAll('.pano-view').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = await window.LSCMedia.getObjectUrlFor(btn.dataset.id);
        if (url && window.LSCPanoViewer) window.LSCPanoViewer.open(url, { title: currentLocation().name });
      });
    });
    strip.querySelectorAll('.pano-retake').forEach(btn => {
      btn.addEventListener('click', () => startPanoramaCapture({ replaceId: btn.dataset.id }));
    });
    strip.querySelectorAll('.pano-delete').forEach(btn => {
      btn.addEventListener('click', () => deletePanorama(btn.dataset.id, btn.dataset.session));
    });

    // surface any interrupted capture session (page reload / backgrounding mid-capture)
    if (mediaAvailable && window.LSCMedia) {
      try {
        const all = await window.LSCMedia.getByLocation(loc.id);
        const finishedSessionIds = new Set((await Promise.all(ids.map(id => window.LSCMedia.getMedia(id)))).filter(Boolean).map(r => r.sessionId).filter(Boolean));
        const orphanSources = all.filter(r => r.category === 'panorama-360-source' && !finishedSessionIds.has(r.sessionId));
        const bySession = {};
        orphanSources.forEach(r => { (bySession[r.sessionId] = bySession[r.sessionId] || []).push(r); });
        const sessionIds = Object.keys(bySession);
        if (sessionIds.length && hint) {
          const sid = sessionIds[0];
          hint.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Incomplete 360° session found (${bySession[sid].length} photos). `;
          const discardBtn = document.createElement('button');
          discardBtn.type = 'button';
          discardBtn.className = 'link-btn';
          discardBtn.textContent = 'Discard it';
          discardBtn.addEventListener('click', async () => {
            await window.LSCMedia.deleteMany(bySession[sid].map(r => r.id));
            renderPanoramaCard();
            toast('Incomplete session discarded', 'success');
          });
          hint.appendChild(discardBtn);
        }
      } catch (e) { /* non-critical */ }
    }
  }

  async function deletePanorama(id, sessionId) {
    const loc = currentLocation();
    const ok = await confirmAsync({ title: 'Delete Panorama', body: 'Delete this 360° panorama? Its source photos will also be removed.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await window.LSCMedia.deleteMedia(id);
      if (sessionId) {
        const sources = (await window.LSCMedia.getBySession(sessionId)).filter(r => r.category === 'panorama-360-source');
        await window.LSCMedia.deleteMany(sources.map(r => r.id));
      }
    } catch (e) { /* continue */ }
    loc.media['panorama-360'] = loc.media['panorama-360'].filter(x => x !== id);
    await renderPanoramaCard();
    scheduleSave();
    toast('Panorama deleted', 'success');
  }

  async function startPanoramaCapture(opts) {
    opts = opts || {};
    if (!mediaAvailable) { toast('360° capture needs browser storage that is not available here', 'error'); return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      toast('Camera access is not available on this device/browser', 'error');
      return;
    }
    const loc = currentLocation();
    const result = await window.LSCCapture360.start({ locationId: loc.id, toast, confirm: confirmAsync });
    if (result.cancelled) return;

    if (opts.replaceId) {
      const old = await window.LSCMedia.getMedia(opts.replaceId).catch(() => null);
      try { await window.LSCMedia.deleteMedia(opts.replaceId); } catch (e) { /* continue */ }
      if (old && old.sessionId) {
        const oldSources = (await window.LSCMedia.getBySession(old.sessionId)).filter(r => r.category === 'panorama-360-source');
        await window.LSCMedia.deleteMany(oldSources.map(r => r.id));
      }
      loc.media['panorama-360'] = loc.media['panorama-360'].filter(x => x !== opts.replaceId);
    }

    if (result.stitched) {
      loc.media['panorama-360'].push(result.panoramaMediaId);
      await renderPanoramaCard();
      scheduleSave();
      // Surface what refinement actually did — on a phone there is no
      // console to check, and these two numbers are the quickest way to
      // tell whether it ran and whether it produced something sane.
      const r = result.refinement;
      const detail = (r && typeof r.hFovDeg === 'number')
        ? ` — lens measured at ${r.hFovDeg.toFixed(1)}° FOV, aim corrected ${
            typeof r.meanCorrectionDeg === 'number' ? r.meanCorrectionDeg.toFixed(2) : '?'}° avg`
        : '';
      toast('360° panorama created' + detail, 'success');
    } else {
      await renderPanoramaCard(); // still shows the "incomplete session" recovery hint for the saved sources
      const n = result.sourceCount || 0;
      const reasonText = {
        unsupported: `Automatic stitching isn’t supported in this browser. Your ${n} source photos were saved — they can be re-processed later or exported as a source set.`,
        'stitch-error': 'Stitching failed, but your source photos were saved and were not lost.',
        // Almost always memory: the worker was killed rather than throwing.
        'stitch-stalled': `Stitching stopped responding— most likely this device ran out of memory. Your ${n} source photos were saved. Turning off “Enhance” reduces how much memory the build needs; you can also finish a capture early rather than shooting every angle.`,
        'no-readable-sources': 'Could not read the captured photos back from storage — nothing to stitch.',
        'encode-failed': 'The finished panorama could not be encoded, but your source photos were saved.',
        'storage-failed': 'The finished panorama could not be saved (storage may be full), but your source photos were kept.',
        'camera-interrupted': 'The camera was interrupted, but photos captured so far were saved.'
      }[result.reason] || 'Stitching did not complete, but your source photos were saved.';
      // The stage is the single most useful thing to know when this is
      // reported back, and a phone has no console to read it from.
      toast(reasonText + (result.stage ? ` (stopped during: ${result.stage})` : ''), 'error');
    }
  }

  function bind360() {
    const captureBtn = qs('#btn360Capture');
    const attachBtn = qs('#btn360Attach');
    const attachInput = qs('#input360Attach');
    if (captureBtn) {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        captureBtn.disabled = true;
        captureBtn.title = 'Camera access is not available on this device/browser';
      }
      captureBtn.addEventListener('click', () => startPanoramaCapture());
    }
    if (attachBtn && attachInput) {
      if (!mediaAvailable) {
        attachBtn.disabled = true;
        attachBtn.title = 'Attaching 360° images needs browser storage that is not available here';
      } else {
        attachBtn.addEventListener('click', () => attachInput.click());
        attachInput.addEventListener('change', async () => {
          const file = attachInput.files && attachInput.files[0];
          attachInput.value = '';
          if (!file) return;
          const loc = currentLocation();
          try {
            const dims = await window.LSCMedia.imageDims(file);
            if (dims.width && dims.height && Math.abs(dims.width / dims.height - 2) > 0.2) {
              toast('That image doesn’t look like a standard 2:1 equirectangular panorama — attaching it anyway.', 'error');
            }
            const id = await window.LSCMedia.putMedia({
              locationId: loc.id, category: 'panorama-360', filename: file.name || 'panorama.jpg',
              mime: file.type || 'image/jpeg', originalFilename: file.name, width: dims.width, height: dims.height, blob: file
            });
            loc.media['panorama-360'].push(id);
            await renderPanoramaCard();
            scheduleSave();
            toast('360° image attached', 'success');
          } catch (e) {
            toast('Could not attach that image', 'error');
          }
        });
      }
    }
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

  // Promise-based confirm for modules (capture360, export) that can't hold a
  // reference to app.js's callback-style showModal.
  function confirmAsync({ title, body, confirmText, danger }) {
    return new Promise(resolve => {
      let settled = false;
      showModal({ title, body, confirmText: confirmText || 'Confirm', danger, onConfirm: () => { settled = true; resolve(true); } });
      const backdrop = qs('#modalBackdrop');
      const obs = new MutationObserver(() => {
        if (!backdrop.classList.contains('open')) {
          if (!settled) { settled = true; resolve(false); }
          obs.disconnect();
        }
      });
      obs.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
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

  /* ===================== MEDIA DUPLICATION / CLEANUP ===================== */
  async function duplicateLocationMedia(oldLoc, newLoc) {
    if (!mediaAvailable) return;
    const sessionRemap = {};
    for (const cat of MEDIA_CATEGORIES) {
      const newIds = [];
      for (const id of oldLoc.media[cat] || []) {
        const rec = await window.LSCMedia.getMedia(id).catch(() => null);
        if (!rec) continue;
        let newSessionId = null;
        if (rec.sessionId) {
          if (!sessionRemap[rec.sessionId]) sessionRemap[rec.sessionId] = 'pano_' + uid();
          newSessionId = sessionRemap[rec.sessionId];
        }
        const newId = await window.LSCMedia.putMedia(Object.assign({}, rec, {
          id: undefined, locationId: newLoc.id, sessionId: newSessionId
        }));
        newIds.push(newId);
        if (rec.sessionId) {
          const sources = (await window.LSCMedia.getBySession(rec.sessionId)).filter(r => r.category === 'panorama-360-source');
          for (const s of sources) {
            await window.LSCMedia.putMedia(Object.assign({}, s, { id: undefined, locationId: newLoc.id, sessionId: newSessionId }));
          }
        }
      }
      newLoc.media[cat] = newIds;
    }
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
        onConfirm: async name => {
          if (!name) return;
          const clone = JSON.parse(JSON.stringify(loc));
          clone.id = uid();
          clone.name = name;
          clone.createdAt = Date.now();
          clone.updatedAt = Date.now();
          clone.media = { 'wide-angle': [], 'close-up': [], 'panorama-360': [], 'video': [] };
          locations[clone.id] = clone;
          await duplicateLocationMedia(loc, clone);
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
        onConfirm: async () => {
          const deletedId = loc.id;
          delete locations[deletedId];
          const nextId = Object.keys(locations)[0];
          persistLocations();
          loadLocationIntoForm(nextId);
          if (mediaAvailable) { try { await window.LSCMedia.deleteByLocation(deletedId); } catch (e) { /* ignore */ } }
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
        onConfirm: async () => {
          if (mediaAvailable) { try { await window.LSCMedia.deleteByLocation(loc.id); } catch (e) { /* ignore */ } }
          loc.fields = {};
          loc.touched = {};
          loc.photos = undefined;
          loc.media = { 'wide-angle': [], 'close-up': [], 'panorama-360': [], 'video': [] };
          loc.rating = 0;
          loc.status = '';
          persistLocations();
          loadLocationIntoForm(loc.id);
          toast('Location data cleared', 'success');
        }
      });
    });

    const doJsonExport = () => {
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
      toast('Exported data JSON', 'success');
    };

    function openExportDialog() {
      qs('#exportStatus').textContent = '';
      qs('#btnExportFolder').disabled = !window.LSCExport.folderExportSupported();
      qs('#btnExportFolder').title = window.LSCExport.folderExportSupported() ? '' : 'Folder export is not supported by this browser. Use ZIP Export instead.';
      qs('#exportModalBackdrop').classList.add('open');
    }
    function closeExportDialog() { qs('#exportModalBackdrop').classList.remove('open'); }

    qs('#btnExport').addEventListener('click', openExportDialog);
    qs('#btnExportBottom').addEventListener('click', openExportDialog);
    qs('#exportModalCancel').addEventListener('click', closeExportDialog);
    qs('#exportModalBackdrop').addEventListener('click', e => { if (e.target.id === 'exportModalBackdrop') closeExportDialog(); });

    async function withExportStatus(label, fn) {
      const status = qs('#exportStatus');
      status.textContent = label;
      try {
        await fn();
        status.textContent = '';
        closeExportDialog();
      } catch (e) {
        status.textContent = '';
        if (e && e.message === 'CANCELLED') return;
        toast('Export failed: ' + (e && e.message ? e.message : 'unknown error'), 'error');
      }
    }

    qs('#btnExportZip').addEventListener('click', () => {
      const loc = currentLocation();
      Object.assign(loc.fields, collectFormData());
      withExportStatus('Building ZIP…', async () => {
        await window.LSCExport.exportZip(loc);
        toast('ZIP exported', 'success');
      });
    });
    qs('#btnExportFolder').addEventListener('click', () => {
      if (!window.LSCExport.folderExportSupported()) {
        toast('Folder export is not supported by this browser. Use ZIP Export instead.', 'error');
        return;
      }
      const loc = currentLocation();
      Object.assign(loc.fields, collectFormData());
      withExportStatus('Writing folder…', async () => {
        await window.LSCExport.exportFolder(loc);
        toast('Folder exported', 'success');
      });
    });
    qs('#btnExportPdf').addEventListener('click', () => {
      const loc = currentLocation();
      Object.assign(loc.fields, collectFormData());
      withExportStatus('Generating PDF…', async () => {
        await window.LSCExport.exportPdfOnly(loc);
        toast('PDF downloaded', 'success');
      });
    });
    qs('#btnExportJson').addEventListener('click', () => { doJsonExport(); closeExportDialog(); });

    qs('#btnImport').addEventListener('click', () => qs('#importFile').click());
    qs('#importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object' || !data.fields) throw new Error('bad shape');
          const loc = blankLocation(data.name ? `${data.name} (Imported)` : 'Imported Location');
          loc.fields = data.fields || {};
          loc.touched = data.touched || {};
          loc.rating = data.rating || 0;
          loc.status = data.status || '';
          normalizeLocation(loc);
          if (data.media) MEDIA_CATEGORIES.forEach(cat => { if (Array.isArray(data.media[cat])) loc.media[cat] = data.media[cat]; });
          if (data.photos) {
            loc.photos = data.photos;
            await window.LSCMedia.migrateLocationPhotos(loc);
          }
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
  async function init() {
    initTheme();

    mediaAvailable = window.LSCMedia ? await window.LSCMedia.checkAvailable() : false;
    if (!mediaAvailable) {
      toast('Photo/video storage (IndexedDB) is unavailable in this browser — photos will use a smaller legacy storage mode, and 360°/video attachment are disabled.', 'error');
    }

    const stored = loadLocationsFromStorage();
    locations = stored || {};
    ensureAtLeastOneLocation();
    Object.values(locations).forEach(normalizeLocation);

    if (mediaAvailable) {
      for (const loc of Object.values(locations)) {
        if (loc.photos) await window.LSCMedia.migrateLocationPhotos(loc);
      }
    }

    const storedActive = localStorage.getItem(STORAGE_ACTIVE);
    activeId = (storedActive && locations[storedActive]) ? storedActive : Object.keys(locations)[0];

    buildSectionNav();
    bindFormFields();
    bindCounters();
    bindPhotoInputs();
    bindVideoAttach();
    bind360();
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

  window.LSCApp = { SECTION_META, MEDIA_FIELD_SET, MEDIA_CATEGORIES };

  document.addEventListener('DOMContentLoaded', init);
})();
