/* ===================== OFFLINE SERVICE WORKER =====================
   Makes the whole app work with no network at all: the checklist, the
   guided 360 capture, the stitcher, and the on-device XFeat refinement.

   Nothing here syncs, uploads or phones home. Everything the app produces
   already lives in IndexedDB (db.js) and localStorage; this file only
   makes the CODE available offline, which was the one remaining reason a
   scout in a basement needed a signal.

   TWO TIERS, and the split matters.

   SHELL is the app itself -- markup, styles, modules, workers, fonts,
   icons. About 1.5 MB. It is precached during install and install FAILS
   if any of it is missing, because a half-installed shell is worse than
   none: the browser would keep serving it and the app would break in ways
   that look like bugs rather than like a bad install.

   ML is onnxruntime-web plus the XFeat model, about 17 MB, and it is
   fetched in the background AFTER install rather than during it. Blocking
   a first visit on 17 MB over a phone connection is how installs time out
   and get retried forever, and the app degrades honestly without it --
   capture360.js treats refinement as advisory and falls back to sensor
   pose. The page can ask how that download is going, and start it, via
   the message API at the bottom.

   FRESHNESS. Text assets are served stale-while-revalidate: the cached
   copy answers immediately (so offline works and startup is instant) and
   a fresh copy is fetched in the background for next time. Binary vendor
   assets are cache-first with no revalidation, because re-fetching a
   14 MB wasm on every load to discover it has not changed is exactly the
   behaviour a field app cannot afford.

   That combination means a deploy reaches the user on their second load
   without anyone having to remember to bump a version string -- which is
   the failure this file is most likely to cause and the one worth
   designing out. VERSION below still exists, and bumping it forces a
   clean re-precache; it is the lever for the rarer case where a vendored
   binary changes.
*/
const VERSION = 'v1';
const SHELL_CACHE = 'lsc2-shell-' + VERSION;
const ML_CACHE = 'lsc2-ml-' + VERSION;
const RUNTIME_CACHE = 'lsc2-runtime-' + VERSION;
const ALL_CACHES = [SHELL_CACHE, ML_CACHE, RUNTIME_CACHE];

const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.json',

  'db.js',
  'orientation.js',
  'panorama-viewer.js',
  'capture-sphere.js',
  'capture360.js',
  'export.js',
  'install.js',
  'app.js',

  // Workers are fetched by URL, so they need caching like any other asset.
  'pano-stitch-worker.js',
  'pano-refine-worker.js',

  // pano-refine-worker.js is a module worker and imports these directly;
  // a missing one breaks refinement with an opaque worker error.
  'pano/so3.js',
  'pano/camera.js',
  'pano/estimate.js',
  'pano/calibrate.js',
  'pano/bundle.js',
  'pano/pipeline.js',
  'pano/stitch.js',
  'pano/xfeat-extractor.js',
  'pano/xfeat-match.js',

  'vendor/jszip.min.js',
  'vendor/jspdf.umd.min.js',

  'vendor/fonts/inter.css',
  'vendor/fonts/inter-latin-400.woff2',
  'vendor/fonts/inter-latin-500.woff2',
  'vendor/fonts/inter-latin-600.woff2',
  'vendor/fonts/inter-latin-700.woff2',
  'vendor/fonts/inter-latin-800.woff2',
  'vendor/fonts/inter-latin-ext-400.woff2',
  'vendor/fonts/inter-latin-ext-500.woff2',
  'vendor/fonts/inter-latin-ext-600.woff2',
  'vendor/fonts/inter-latin-ext-700.woff2',
  'vendor/fonts/inter-latin-ext-800.woff2',

  'vendor/fontawesome/fontawesome.min.css',
  'vendor/fontawesome/solid.min.css',
  'vendor/fontawesome/webfonts/fa-solid-900.woff2',

  'HCILab.jpg',
  'LEDlogo.png',
  'ULL.png',

  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

/* onnxruntime-web and the XFeat model. Listed separately because of size,
   not because they are optional to the feature they serve. */
const ML_ASSETS = [
  'vendor/ort.wasm.bundle.min.mjs',
  'vendor/ort-wasm-simd-threaded.mjs',
  'vendor/ort-wasm-simd-threaded.wasm',
  'vendor/xfeat.onnx'
];

const TEXTUAL = /\.(html|css|js|mjs|json)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    /* cache.addAll() is atomic and that is the point: one 404 in the list
       above should stop the install rather than leave a shell with a hole
       in it. { cache: 'reload' } bypasses the browser's own HTTP cache so
       an install never bakes in a stale copy of a file just deployed. */
    await cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => n.indexOf('lsc2-') === 0 && ALL_CACHES.indexOf(n) === -1)
      .map(n => caches.delete(n)));
    await self.clients.claim();
    // Non-blocking on purpose: see the header note on the two tiers.
    primeMlCache();
  })());
});

let mlPriming = null;
function primeMlCache() {
  if (mlPriming) return mlPriming;
  mlPriming = (async () => {
    const cache = await caches.open(ML_CACHE);
    for (const url of ML_ASSETS) {
      try {
        if (await cache.match(url)) continue;
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (e) {
        /* Offline, or the connection dropped mid-download. Leave it for
           the next activation or an explicit request from the page --
           never let this reject, because nothing awaits it. */
      }
    }
    await broadcast({ type: 'ml-cache-status', status: await mlStatus() });
  })();
  const done = mlPriming;
  done.catch(() => {}).then(() => { if (mlPriming === done) mlPriming = null; });
  return done;
}

async function mlStatus() {
  const cache = await caches.open(ML_CACHE);
  let have = 0;
  for (const url of ML_ASSETS) if (await cache.match(url)) have++;
  return { have: have, total: ML_ASSETS.length, complete: have === ML_ASSETS.length };
}

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) { try { c.postMessage(msg); } catch (e) { /* gone */ } }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* Anything not served from this origin is left entirely alone. The only
     one the app makes is the Nominatim reverse-geocode, which app.js
     already treats as best-effort and skips when it fails -- caching an
     address lookup would be both useless and a privacy footgun. */
  if (url.origin !== self.location.origin) return;

  /* A navigation must always resolve to something, or an offline launch
     from the home screen shows the browser's error page instead of the
     app. Try the network first so a deploy is picked up promptly, and
     fall back to the cached shell. */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('index.html')) ||
               (await cache.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });

    /* Text assets: answer from cache instantly, refresh in the background.
       The next load gets the new version, so a deploy lands without anyone
       bumping VERSION. */
    if (cached && TEXTUAL.test(url.pathname)) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(new Request(req.url, { cache: 'reload' }));
          if (fresh && fresh.ok) {
            const cache = await caches.open(SHELL_CACHE);
            const old = await cache.match(req, { ignoreSearch: true });
            await cache.put(req, fresh.clone());
            if (old && await changed(old, fresh)) {
              await broadcast({ type: 'update-ready' });
            }
          }
        } catch (e) { /* offline: the cached copy already answered */ }
      })());
      return cached;
    }

    // Everything else already cached (fonts, images, the wasm, the model).
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      /* Opaque and error responses are not worth storing, and storing a
         206 would poison a later full request. */
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (e) {
      return Response.error();
    }
  })());
});

/* Compare two responses cheaply enough to run on every text asset. ETag or
   Last-Modified is enough on GitHub Pages, which sets both; falling back to
   body length keeps this working on a plain static server that sets
   neither. */
async function changed(a, b) {
  const ea = a.headers.get('etag'), eb = b.headers.get('etag');
  if (ea && eb) return ea !== eb;
  const la = a.headers.get('last-modified'), lb = b.headers.get('last-modified');
  if (la && lb) return la !== lb;
  try {
    const ta = await a.clone().text();
    const tb = await b.clone().text();
    return ta.length !== tb.length;
  } catch (e) { return false; }
}

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'skip-waiting') { self.skipWaiting(); return; }
  if (msg.type === 'ml-cache-start') { primeMlCache(); return; }
  if (msg.type === 'ml-cache-query') {
    event.waitUntil((async () => {
      const status = await mlStatus();
      const source = event.source;
      if (source) source.postMessage({ type: 'ml-cache-status', status });
      else await broadcast({ type: 'ml-cache-status', status });
    })());
  }
});
