/* ===================== MEDIA STORE (IndexedDB) =====================
   Binary photo/video/panorama data lives here as Blobs, keyed by a
   generated media id. Locations only keep lightweight id references
   (see app.js `loc.media`). Falls back cleanly to a "unsupported" mode
   when IndexedDB isn't available — callers must check LSCMedia.available.
*/
(function (global) {
  'use strict';

  const DB_NAME = 'lsc2_media';
  const DB_VERSION = 1;
  const STORE = 'media';

  let dbPromise = null;
  const objectUrlCache = new Map(); // mediaId -> object URL, so we can revoke on demand

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in global)) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('locationId', 'locationId', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open media database'));
      req.onblocked = () => reject(new Error('Media database upgrade blocked by another tab'));
    });
    return dbPromise;
  }

  let availableChecked = false;
  let availableFlag = false;
  async function checkAvailable() {
    if (availableChecked) return availableFlag;
    availableChecked = true;
    try {
      await openDb();
      availableFlag = true;
    } catch (e) {
      availableFlag = false;
    }
    return availableFlag;
  }

  const uid = () => 'med_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

  function tx(mode) {
    return openDb().then(db => db.transaction(STORE, mode).objectStore(STORE));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
    });
  }

  /**
   * record: { locationId, category, filename, mime, originalFilename, width, height,
   *           sessionId, order, yaw, pitch, roll, blob }
   * Returns the generated media id.
   */
  async function putMedia(record) {
    const store = await tx('readwrite');
    const id = record.id || uid();
    const full = Object.assign({
      id, createdAt: Date.now(), width: null, height: null,
      sessionId: null, order: null, yaw: null, pitch: null, roll: null
    }, record, { id });
    await reqToPromise(store.put(full));
    return id;
  }

  async function getMedia(id) {
    const store = await tx('readonly');
    return reqToPromise(store.get(id));
  }

  async function deleteMedia(id) {
    revokeObjectUrl(id);
    const store = await tx('readwrite');
    return reqToPromise(store.delete(id));
  }

  async function deleteMany(ids) {
    for (const id of ids) { try { await deleteMedia(id); } catch (e) { /* continue */ } }
  }

  async function getByLocation(locationId) {
    const store = await tx('readonly');
    const idx = store.index('locationId');
    return reqToPromise(idx.getAll(locationId));
  }

  async function deleteByLocation(locationId) {
    const records = await getByLocation(locationId);
    await deleteMany(records.map(r => r.id));
  }

  async function getBySession(sessionId) {
    const store = await tx('readonly');
    const idx = store.index('sessionId');
    return reqToPromise(idx.getAll(sessionId));
  }

  function getObjectUrl(id, blob) {
    if (objectUrlCache.has(id)) return objectUrlCache.get(id);
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(id, url);
    return url;
  }

  function revokeObjectUrl(id) {
    if (objectUrlCache.has(id)) {
      URL.revokeObjectURL(objectUrlCache.get(id));
      objectUrlCache.delete(id);
    }
  }

  function revokeAll() {
    objectUrlCache.forEach(url => URL.revokeObjectURL(url));
    objectUrlCache.clear();
  }

  async function getObjectUrlFor(id) {
    if (objectUrlCache.has(id)) return objectUrlCache.get(id);
    const rec = await getMedia(id);
    if (!rec || !rec.blob) return null;
    return getObjectUrl(id, rec.blob);
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mimeMatch = /data:(.*?);base64/.exec(parts[0]);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function imageDims(blob) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }); };
      img.src = url;
    });
  }

  /**
   * Converts a location's legacy embedded `photos` (data-URL arrays) into
   * Blob media records in IndexedDB, verifies the count matches, then
   * clears the legacy field. Never removes `photos` unless the migrated
   * count matches exactly, so a partial/failed migration is retried next
   * load instead of quietly losing photos.
   */
  async function migrateLocationPhotos(loc) {
    if (!loc || !loc.photos) return loc;
    const keys = Object.keys(loc.photos).filter(k => Array.isArray(loc.photos[k]) && loc.photos[k].length);
    if (!keys.length) { delete loc.photos; return loc; }
    if (!(await checkAvailable())) return loc; // leave legacy data in place until IndexedDB is usable

    loc.media = loc.media || {};
    let migratedCount = 0;
    let expectedCount = 0;
    for (const key of keys) {
      const category = key; // 'wide-angle' | 'close-up' — same names used going forward
      loc.media[category] = loc.media[category] || [];
      for (const src of loc.photos[key]) {
        expectedCount++;
        try {
          const blob = typeof src === 'string' && src.startsWith('data:') ? dataUrlToBlob(src) : null;
          if (!blob) continue; // corrupt legacy entry — skip, don't crash the whole migration
          const dims = await imageDims(blob);
          const id = await putMedia({
            locationId: loc.id, category, filename: `${category}_legacy_${migratedCount + 1}.jpg`,
            mime: blob.type || 'image/jpeg', originalFilename: null,
            width: dims.width, height: dims.height, blob
          });
          loc.media[category].push(id);
          migratedCount++;
        } catch (e) { /* skip this photo, keep going — never abort the whole migration */ }
      }
    }
    if (migratedCount === expectedCount) {
      delete loc.photos;
    } else {
      loc._photosMigrationPartial = true; // surfaced as a toast by app.js
    }
    return loc;
  }

  global.LSCMedia = {
    checkAvailable, putMedia, getMedia, deleteMedia, deleteMany,
    getByLocation, deleteByLocation, getBySession,
    getObjectUrlFor, revokeObjectUrl, revokeAll,
    dataUrlToBlob, imageDims, migrateLocationPhotos,
    uid
  };
})(window);
