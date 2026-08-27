/* === LSU Death Valley Experience — Part 11: BOOT (data loading, preload, boot) === */
/* -----------------------------------------------------------
   17. BOOT
   ----------------------------------------------------------- */

/** Try to fetch a GeoJSON file. Returns null on any failure
 *  (network error, 404, CORS, file://, non-JSON body). */
async function tryFetchGeoJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    // Some servers serve .geojson as octet-stream or text/plain; that's fine.
    // What we really want is to not accidentally parse HTML.
    if (ct.includes("text/html")) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

/** Load every dataset the app needs: geometry (GeoJSON) and
 *  per-location content (locations.json, treedis-sweeps.json).
 *  All fetches run in parallel; each one silently falls back to
 *  an empty FeatureCollection / no-op on failure (404, CORS,
 *  file:// origin — this project only supports being served over
 *  http, see README). loadDataJSON() — defined in
 *  js/00-data-adapter.js — is responsible for the content
 *  fetches and for rebuilding the flat lookup maps
 *  (config.descriptionMap, config.treedisMaps, …) so the rest
 *  of the app doesn't need to know JSON is involved. */
async function loadAllData() {
  const contentP = (typeof loadDataJSON === "function")
    ? loadDataJSON()
    : Promise.resolve(null);

  const [bFetch, tFetch, contentReport] = await Promise.all([
    tryFetchGeoJSON(config.dataFiles?.buildings || "data/buildings.geojson"),
    tryFetchGeoJSON(config.dataFiles?.tours     || "data/tours.geojson"),
    contentP
  ]);

  const empty = { type: "FeatureCollection", features: [] };
  const buildings = bFetch || empty;
  const tours     = tFetch || empty;

  console.info(`[metaversity] geometry loaded: buildings=${bFetch ? "fetch" : "empty"}, tours=${tFetch ? "fetch" : "empty"}`);
  if (contentReport) {
    console.info(`[metaversity] content loaded: ` +
      `locations=${contentReport.locations}, ` +
      `sweeps=${contentReport.sweeps}`);
  }

  return { buildings, tours };
}

/* Resolves once the MapLibre style has finished its initial load —
   addSource()/addLayer() aren't safe to call before this. No Leaflet
   equivalent was needed (L.map() layers could be added immediately). */
function waitForMapLoad() {
  return new Promise((resolve) => {
    if (map.loaded()) return resolve();
    map.once("load", () => resolve());
  });
}

/* -----------------------------------------------------------
   Asset preloading with progress tracking.

   Every promise here is defensive: it resolves (never rejects)
   on success, failure, OR after a per-asset timeout, so one
   broken URL can never soft-lock the splash. A shared counter
   updates the splash text as each asset finishes.
   ----------------------------------------------------------- */
function preloadImage(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!url) return resolve({ url, ok: false, reason: "empty" });

    const img = new Image();
    let done = false;
    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      resolve({ url, ok, reason });
    };

    const timer = setTimeout(() => {
      console.warn("[preload] image timed out:", url);
      finish(false, "timeout");
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      finish(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      console.warn("[preload] image failed:", url);
      finish(false, "error");
    };
    img.src = url;
  });
}

/* Resolves when Treedis posts TourReady, OR when `timeoutMs`
   elapses — whichever comes first. Never rejects. */
function waitForTreedisReady(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (TourBridge.isReady) {
      return resolve({ ok: true });
    }
    const start = Date.now();
    const t = setInterval(() => {
      if (TourBridge.isReady) {
        clearInterval(t);
        resolve({ ok: true });
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        console.warn("[preload] Treedis not ready within "
          + timeoutMs + "ms — continuing anyway");
        resolve({ ok: false, reason: "timeout" });
      }
    }, 100);
  });
}

/* Waits for TourReady (long deadline — Treedis can take 20s+ on
   cold loads), then silently Navigates the hidden iframe to the
   configured homeSweepId so the entry point is warm by the time
   the user clicks Explore.

   This runs detached from the splash. The splash never waits on
   it. If the user clicks Explore before TourReady fires, the
   warmupCancelled flag set by openStreetView() makes this bail
   before sending the home Navigate, so the user's chosen sweep
   wins.

   Only one sweep is warmed (the home sweep) — Treedis caches
   aggressively after the first nav so subsequent jumps are fast
   anyway, and blasting many navs during boot just competes with
   the model load and slows down TourReady. Never rejects. */
async function warmHomeSweep() {
  const ready = await waitForTreedisReady(60000);
  if (!ready.ok) {
    console.warn("[preload] skipping home-sweep warm-up — Treedis not ready");
    return { ok: false, reason: "not-ready" };
  }

  if (warmupCancelled) {
    console.info("[preload] home-sweep warm-up cancelled — user already navigated");
    return { ok: true, cancelled: true };
  }

  const homeSweep = (config.treedis && config.treedis.homeSweepId) || null;
  if (!homeSweep) {
    console.warn("[preload] no homeSweepId configured — skipping warm-up");
    return { ok: false, reason: "no-home-sweep" };
  }

  console.info("[preload] warming home sweep:", homeSweep);
  TourBridge.warmSweep(homeSweep);

  // Reset so the user's first real Explore click always fires a
  // fresh Navigate (otherwise the dedup in navigateStreetViewToLayer
  // would treat the click as a no-op).
  lastStreetViewSweepId = null;

  console.info("[preload] home sweep warm-up complete");
  return { ok: true };
}


/* Builds the splash-blocking task list: ONLY images. The Treedis
   iframe is started in the background by preloadTreedisIframe()
   and is intentionally NOT in this list — its boot can take 20+
   seconds and we don't want to hold the splash hostage to it.
   The user can interact with the map immediately while the
   iframe finishes loading off-screen. `onProgress(done, total)`
   is called after each image finishes. Imagery/terrain tiles load
   through MapLibre itself, not here — nothing to preload for them. */
function preloadAllAssets(onProgress) {
  const imageUrls = [];

  const imgMap = config.imageMap || {};
  for (const key in imgMap) {
    if (imgMap[key]) imageUrls.push(imgMap[key]);
  }

  const tasks = imageUrls.map((u) => preloadImage(u));

  const total = tasks.length;
  let done = 0;

  // Wrap each task so we can tick the counter as it finishes.
  const tracked = tasks.map((p) =>
    p.then((result) => {
      done += 1;
      try { onProgress && onProgress(done, total); } catch (_) {}
      return result;
    })
  );

  return Promise.all(tracked);
}

/* Updates the counter text shown on the splash. Called from
   preloadAllAssets()'s onProgress callback. */
function updateSplashProgress(done, total) {
  const node = document.getElementById("splashProgress");
  if (node) node.textContent = "Loading " + done + "/" + total + "…";
}

/* Solid neutral-ground fallback, painted BELOW the imagery layer (must
   be the very first layer added — MapLibre "background" layers need no
   source and paint the whole viewport). This is what shows through —
   flat, not blank — when #toggleImageryBtn hides the DOTD photo, in
   both 2D and terrain-draped 3D (brief §3.6: "fall back to a plain
   neutral ground color rather than nothing"). */
function addBackgroundLayer() {
  map.addLayer({
    id: LAYER_IDS.background,
    type: "background",
    paint: { "background-color": "#8A9A78" } // muted grass/earth tone
  });
}

/* Dynamic DOTD ImageServer base layer. Not a cached {z}/{x}/{y} tile
   pyramid — the 2025 6" RGBI service is a dynamic ImageServer
   ("Single Fused Map Cache": false), queried via its exportImage REST
   operation on every pan/zoom. MapLibre's {bbox-epsg-3857} raster-
   source template does the per-tile substitution — no esri-leaflet
   dependency needed (confirmed working via a live web search + the
   in-browser check before committing to this approach). bandIds
   0,1,2 (baked into config.esriImagery.tiles' query string) drop the
   4th (near-infrared) band so the image renders true-color. */
function addImagerySource() {
  const img = config.esriImagery || {};
  if (!img.tiles || !img.tiles.length) {
    console.warn("[metaversity] config.esriImagery.tiles is missing.");
    return;
  }

  map.addSource(SOURCE_IDS.imagery, {
    type: "raster",
    tiles: img.tiles,
    tileSize: img.tileSize || 256,
    maxzoom: img.maxZoom ?? 21,
    attribution: img.attribution || "Imagery: Louisiana DOTD"
  });

  map.addLayer({
    id: LAYER_IDS.imagery,
    type: "raster",
    source: SOURCE_IDS.imagery
  });
}

/* Toggleable streets/buildings/POI-label overlay, built from
   OpenStreetMap raster tiles (the only open source dense enough to
   carry building- and business-level labels — parking lot names,
   campus building names — rather than just roads/admin boundaries).
   OFF by default (see referenceOverlayOn in js/02-state.js), low
   opacity when on so it doesn't fight the imagery underneath;
   #layersBtn (wired in js/14-redesign.js) toggles it via
   setLayoutProperty() — works the same in 2D and 3D. */
function addReferenceOverlaySource() {
  const ref = config.referenceOverlay || {};
  if (!ref.tiles || !ref.tiles.length) return;

  map.addSource(SOURCE_IDS.referenceOverlay, {
    type: "raster",
    tiles: ref.tiles,
    tileSize: ref.tileSize || 256,
    attribution: ref.attribution || ""
  });

  map.addLayer({
    id: LAYER_IDS.referenceOverlay,
    type: "raster",
    source: SOURCE_IDS.referenceOverlay,
    layout: { visibility: referenceOverlayOn ? "visible" : "none" },
    paint: { "raster-opacity": ref.opacity ?? 0.6 }
  });
}

async function boot() {
  // If the sync UA check missed but the WebXR API confirms an
  // XR device, switch to the VR profile *before* preloading the
  // iframe — otherwise we'd point it at the desktop tour URL
  // and have to reload. The async detection was kicked off at
  // module load (detectXRAsync() is memoised), so this awaits
  // a promise that's already in flight, not a fresh probe.
  try {
    await maybeUpgradeToVRProfile();
    // Re-apply the body class — at module-load time <body>
    // might not have been parsed yet.
    document.body.classList.toggle("xr-mode", isVRMode());
  } catch (err) {
    console.warn("[treedis] XR detection failed:", err);
  }

  // Start the Treedis iframe loading in parallel with the map
  // data so it's warm by the time the user hits "Explore". The
  // iframe is still visually hidden — preloadTreedisIframe() only
  // sets the src and wires the postMessage bridge.
  preloadTreedisIframe();

  const [{ buildings: rawB, tours: rawT }] = await Promise.all([
    loadAllData(),
    waitForMapLoad()
  ]);

  // Background (neutral-ground fallback) first, then base imagery +
  // toggleable reference overlay — paint order (i.e. layer add order)
  // puts them at the bottom, under buildings and tour stops.
  addBackgroundLayer();
  addImagerySource();
  addReferenceOverlaySource();

  buildingsGeo = addSourceAndLayers(
    rawB, "building", SOURCE_IDS.buildings, LAYER_IDS.buildingsFill, LAYER_IDS.buildingsExtrusion
  );
  toursGeo = addSourceAndLayers(
    rawT, "tour", SOURCE_IDS.tours, LAYER_IDS.toursFill, LAYER_IDS.toursExtrusion
  );

  // Data extent (from both feature collections combined)
  dataBounds = null;
  [buildingsGeo, toursGeo].forEach((fc) => {
    (fc.features || []).forEach((f) => {
      const b = boundsOfFeature(f);
      if (!b) return;
      if (!dataBounds) dataBounds = b;
      else dataBounds.extend(b);
    });
  });

  if (!dataBounds) {
    console.warn("[metaversity] no valid geometry found; falling back to LSU campus");
    // LSU campus, Baton Rouge — used only until real tour-stop geometry exists.
    dataBounds = new maplibregl.LngLatBounds([-91.192, 30.405], [-91.176, 30.419]);
  }

  // Imagery is already georeferenced — we do NOT compute image
  // bounds from the polygons. Use explicit config bounds if
  // provided; otherwise pad the vector data bounds.
  if (map3d.bounds) {
    imageBounds = new maplibregl.LngLatBounds(
      [map3d.bounds[0], map3d.bounds[1]], [map3d.bounds[2], map3d.bounds[3]]
    );
  } else {
    imageBounds = padBounds(dataBounds, map3d.boundsPadding ?? 0.35);
  }

  // The map was constructed at map3d.initialCenter/initialZoom
  // (js/02-state.js); map2dStartView is the tuned 2D framing on top of
  // that (same ground footprint as the 3D start view). Falls back to
  // fitting the campus bounds if neither is configured.
  if (config.map3d && config.map3d.map2dStartView) {
    applyMap2DStartView(false);
  } else if (!(map3d.initialCenter && map3d.initialZoom)) {
    resetCampusView(false);
  }
  refreshMapConstraints({ recenterIfNeeded: false });

  // Tour pins
  buildTourPins();

  // Locations list
  renderLocationsList();
  renderAllLocationsList();

  // Search index
  const pushFeatures = (fc, kind, sourceId) => {
    (fc.features || []).forEach((f) => {
      const n = cleanName(f.properties && f.properties.name);
      if (n) allFeatures.push({ kind, sourceId, featureId: f.id, feature: f, props: f.properties });
    });
  };
  pushFeatures(buildingsGeo, "building", SOURCE_IDS.buildings);
  pushFeatures(toursGeo,     "tour",     SOURCE_IDS.tours);

  console.info("[metaversity] ready", {
    buildings: buildingsGeo.features.length,
    tours:     toursGeo.features.length
  });

  // Wait for the map's own assets (per-location photos in
  // config.imageMap) before hiding the splash. The Treedis iframe
  // is intentionally NOT in this list — it boots in the background
  // via preloadTreedisIframe() and the user can interact with the
  // map while that finishes. The 15s hard cap is just a safety net
  // in case an image URL hangs. (Its console.warn always logs 15s
  // after this line runs regardless of whether preload already
  // resolved — a harmless quirk inherited from the original build.)
  const preload = preloadAllAssets(updateSplashProgress);
  const hardCap = new Promise((r) => setTimeout(() => {
    console.warn("[metaversity] hard cap reached — revealing app");
    r("hardcap");
  }, 15000));
  await Promise.race([preload, hardCap]);

  // Kick off the Treedis home-sweep warm-up detached. It waits
  // for TourReady (up to 60s) then nudges the iframe to the home
  // sweep so the first Explore click feels instant. Runs in the
  // background while the user is exploring the map.
  warmHomeSweep().catch((err) => {
    console.warn("[preload] home-sweep warm-up errored:", err);
  });

  // Reveal app
  requestAnimationFrame(() => {
    el.app.setAttribute("aria-hidden", "false");
    el.app.classList.add("is-ready");
    el.splash.classList.add("is-hidden");
    setTimeout(() => { el.splash.style.display = "none"; }, 500);
    scheduleMapRefresh({ delay: 80 });

    // Show the welcome / start screen modal. The user picks
    // between "Enter Experience" (just dismiss) and "How to Use"
    // (start the coachmark walkthrough). Only show on the first
    // boot — re-opens are driven from the burger menu.
    if (typeof showStartScreen === "function") {
      // Small delay so the splash fade-out doesn't visually clash
      // with the start screen fade-in.
      setTimeout(() => showStartScreen(), 220);
    }

    // Signal "the app is usable" to the gameday feature modules
    // (js/15-core-services.js onwards): the map, layers, pins, lists
    // and search index all exist by now. Same defensive guard as
    // showStartScreen() above — this file is parsed and boot() is
    // called before those scripts have run, so nothing here may
    // assume they loaded.
    if (typeof onAppReady === "function") onAppReady();
  });
}

// Kick off boot immediately. The splash hides as soon as the
// per-location photos (if any) are loaded. The Treedis iframe
// continues loading in the background and warms its home sweep
// when ready (see warmHomeSweep inside boot).
