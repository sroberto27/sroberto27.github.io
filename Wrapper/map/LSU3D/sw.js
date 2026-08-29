/* === LSU Death Valley Experience — service worker ===================
   Offline and flaky-network resilience for the gameday experience.

   WHY THIS EXISTS: on gameday this app is used inside a stadium with
   ~100,000 other phones. That is the worst network it will ever see and
   the one moment it genuinely matters. Two concrete problems:

     1. js/02-state.js builds the map at parse time —
        `const map = new maplibregl.Map(...)`. If maplibre-gl.js (211 KB,
        from unpkg, sent with max-age=60) fails to arrive, that line
        throws and every script after it dies. No MapLibre, no app.

     2. GitHub Pages sends `Cache-Control: max-age=600` on every file it
        serves — html, js, css, json, geojson, no exceptions, and no way
        to change it. Any visit more than ten minutes after the last one
        re-validates all 37 first-party files. A service worker is the
        only caching control available on this host.

   SCOPE: this file sits at Wrapper/map/LSU3D/, so its scope is
   /Wrapper/map/LSU3D/ and nothing above it. That is deliberate and
   important — the same origin also serves ../LSU/, ../NewIberia/,
   ../dts/ and others, which are separate deployed apps. A service
   worker registered at the origin root would intercept all of them.
   Never move this file up a directory.

   WHAT IS DELIBERATELY NEVER CACHED: aerial imagery (DOTD), OSM label
   tiles, Google Photorealistic 3D tiles, and Treedis. Those are metered
   or licensed third-party services; caching them is a terms problem as
   well as a staleness one. They are passed straight through, untouched.

   OFFLINE, HONESTLY: you get the stop list, descriptions, itinerary
   times, per-stop instructions, contacts and tour navigation, over a
   blank map. That is close to what someone actually needs mid-visit —
   "when am I due at the Lawton Room and who do I call" — and all of it
   is first-party.
   ================================================================== */

/* Bump on any change to the precached list below.

   Forgetting to is survivable by design: HTML is network-first and
   static assets are stale-while-revalidate, so content still refreshes
   even on a stale cache version. The version mainly controls when old
   caches get evicted. */
const CACHE_VERSION = "v1";
const CACHE_NAME = `lsu3d-${CACHE_VERSION}`;

/* The app shell. Hand-maintained because this project has no build step
   — scripts/tests/service-worker.test.mjs fails if this list and
   index.html ever drift apart, which is the classic way a no-build
   service worker breaks. */
const PRECACHE = [
  "./",
  "./index.html",
  "./config.js",
  "./js/22-service-worker.js",

  "./css/01-base.css",
  "./css/02-header.css",
  "./css/03-sidebar.css",
  "./css/04-map-details.css",
  "./css/05-leaflet-responsive.css",
  "./css/07-streetview-xr.css",
  "./css/08-start-coachmark.css",
  "./css/09-burger-settings.css",
  "./css/10-nav-instructions.css",
  "./css/11-learn-mode.css",
  "./css/12-google-tiles.css",
  "./css/13-chrome.css",
  "./css/14-gameday.css",
  "./css/15-live-visit.css",
  "./css/16-kiosk.css",

  "./js/00-data-adapter.js",
  "./js/01-utils.js",
  "./js/02-state.js",
  "./js/03-tour-bridge.js",
  "./js/04-street-view.js",
  "./js/05-map-helpers.js",
  "./js/06-details-panel.js",
  "./js/07-layer-builders.js",
  "./js/08-tourbar.js",
  "./js/09-sidebar-search.js",
  "./js/10-event-wiring.js",
  "./js/11-boot.js",
  "./js/12-start-screen.js",
  "./js/13-learn-mode.js",
  "./js/14-redesign.js",
  "./js/15-core-services.js",
  "./js/16-google-tiles.js",
  "./js/17-router.js",
  "./js/18-gameday.js",
  "./js/19-geolocation.js",
  "./js/20-live-visit.js",
  "./js/21-kiosk.js",

  "./data/buildings.geojson",
  "./data/tours.geojson",
  "./data/locations.json",
  "./data/treedis-sweeps.json"
];

/* MapLibre is third-party but it is also load-bearing: without it the
   app does not start at all (see the header). The URL is version-pinned
   and its content never changes, so cache-first is safe here in a way it
   would not be for a tile service. */
const MAPLIBRE_PREFIX = "https://unpkg.com/maplibre-gl@4/";

/* Files that must never be answered from cache while the network is
   available, because they are what turns this worker off. See the fetch
   handler for the two-visit problem this avoids. */
const KILL_SWITCH_PATHS = ["/config.js", "/js/22-service-worker.js"];

/* Origins that must always go straight to the network. Metered or
   licensed content, and content that must not go stale. */
const NEVER_CACHE = [
  "maps.dotd.la.gov",        // aerial imagery, per-tile server render
  "tile.openstreetmap.org",  // label overlay
  "tile.googleapis.com",     // Google Photorealistic 3D Tiles (billed)
  "treedis.com",             // immersive tour
  "fonts.gstatic.com",       // font binaries — the browser caches these well already
  "fonts.googleapis.com"
];

/* ---------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll() is atomic: one 404 fails the whole install. That is
      // too brittle for a hand-maintained list, so each entry is
      // allowed to fail on its own and the worker still installs.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" }))
            .catch((err) => console.warn("[sw] could not precache", url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("lsu3d-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      // Take over open pages immediately rather than waiting for them to
      // close. A stuck old worker is the failure mode that makes service
      // workers frightening; claiming straight away means a deployed fix
      // lands on the next load instead of some unpredictable later one.
      .then(() => self.clients.claim())
  );
});

/* A page can ask this worker to remove itself. This is the kill switch,
   and it works without a deploy — see js/22-service-worker.js. */
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "UNREGISTER") return;
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lsu3d-")).map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never touch anything that is not a plain GET — and there is nothing
  // else in this app today, but a future form post must not be cached.
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Third-party services: pass through untouched, no interception.
  if (NEVER_CACHE.some((host) => url.hostname.endsWith(host))) return;

  // MapLibre: cache-first. Version-pinned and immutable in practice.
  if (req.url.startsWith(MAPLIBRE_PREFIX)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Anything else off-origin is left alone.
  if (url.origin !== self.location.origin) return;

  // Outside this app's folder is somebody else's app on the same origin.
  if (!url.pathname.startsWith(new URL("./", self.location.href).pathname)) return;

  // Navigations: network-first, so a deploy is picked up immediately and
  // a stale shell can never pin someone to an old build. The cache is
  // only the fallback for when the network cannot answer.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // The two files that decide whether this worker should exist at all
  // are network-first for the same reason navigations are.
  //
  // config.js carries enableServiceWorker, and js/22-service-worker.js
  // acts on it. Served stale-while-revalidate, turning the flag off
  // would take TWO visits to bite: the first would be answered from the
  // old cached config still saying `true`, and only the second would
  // see the change. A kill switch that needs two attempts is not a kill
  // switch. They stay precached so the app still works offline — the
  // cache is just the fallback rather than the first answer.
  if (KILL_SWITCH_PATHS.some((p) => url.pathname.endsWith(p))) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Everything else we own — js, css, json, geojson — is
  // stale-while-revalidate: instant from cache, refreshed in the
  // background for next time.
  event.respondWith(staleWhileRevalidate(req));
});

/* ---------------------------------------------------------------- */

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const hit = await cache.match(req) || await cache.match("./index.html");
    if (hit) return hit;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title>" +
      "<body style='font-family:system-ui;background:#1B1029;color:#F2EDFB;" +
      "display:grid;place-items:center;height:100vh;margin:0;text-align:center'>" +
      "<div><h1 style='font-size:20px'>You're offline</h1>" +
      "<p style='opacity:.75;font-size:14px'>Reconnect to load the gameday map.</p></div>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(req);

  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  // Serve the cached copy instantly when we have one; otherwise wait for
  // the network, and only then admit defeat.
  if (hit) return hit;
  const res = await network;
  return res || new Response("", { status: 504, statusText: "Offline" });
}
