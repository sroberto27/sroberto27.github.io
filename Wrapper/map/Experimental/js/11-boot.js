/* === Boot: data loading, asset preload, startup sequence === */

/* Fetch a GeoJSON file. Returns null on any failure (network error,
   404, CORS, file:// origin, non-JSON body) so the caller can fall
   back to the shim data. */
async function tryFetchGeoJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";

    // Some servers serve .geojson as octet-stream or text/plain — fine.
    // Just avoid accidentally parsing an HTML error page.
    if (ct.includes("text/html")) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

/* Load every dataset: geometry (GeoJSON) plus per-location content
   (locations.json, treedis-sweeps.json, courses.json). All fetches run
   in parallel; each silently falls back to its data/*.js shim on
   failure. Content loading is delegated to loadDataJSON() in
   00-data-adapter.js, which rebuilds the flat config maps. */
async function loadAllData() {

  const contentP = (typeof loadDataJSON === "function")
    ? loadDataJSON()
    : Promise.resolve(null);

  const [bFetch, tFetch, contentReport] = await Promise.all([
    tryFetchGeoJSON(config.dataFiles?.buildings || "data/buildings.geojson"),
    tryFetchGeoJSON(config.dataFiles?.tours     || "data/tours.geojson"),
    contentP
  ]);

  const fallback = window.SCSU_DATA || {};
  const empty = { type: "FeatureCollection", features: [] };

  const buildings = bFetch || fallback.buildings || empty;
  const tours     = tFetch || fallback.tours     || empty;

  const geomSource =
    (bFetch && tFetch) ? "fetch (.geojson files)"
    : (bFetch || tFetch) ? "mixed (fetch + shim)"
    : "shim (window.SCSU_DATA)";
  console.info(`[metaversity] geometry loaded via ${geomSource}`);
  if (contentReport) {
    console.info(`[metaversity] content loaded: ` +
      `locations=${contentReport.locations}, ` +
      `sweeps=${contentReport.sweeps}, ` +
      `courses=${contentReport.courses}`);
  }

  return { buildings, tours };
}

/* -----------------------------------------------------------
   Asset preloading with progress tracking
   -----------------------------------------------------------
   Every promise here resolves (never rejects) on success, failure, or
   per-asset timeout, so one broken URL can never soft-lock the splash.
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

/* Resolves when Treedis posts TourReady or when the timeout elapses,
   whichever comes first. Never rejects. */
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

/* Waits for TourReady (long deadline — Treedis can take 20s+ on cold
   loads), then silently Navigates the hidden iframe to the configured
   homeSweepId so the entry point is warm before the first Explore
   click. Runs detached from the splash. If the user opens street view
   first, warmupCancelled makes this bail so their sweep wins. Only the
   home sweep is warmed — Treedis caches aggressively after the first
   nav, and extra navs during boot would just slow down TourReady. */
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

  // Reset so the first real Explore click always fires a fresh
  // Navigate instead of being deduped.
  lastStreetViewSweepId = null;

  console.info("[preload] home sweep warm-up complete");
  return { ok: true };
}

/* Build the splash-blocking task list — images only. The Treedis
   iframe is deliberately excluded: it can take 20s+ to boot and loads
   in the background instead. onProgress(done, total) fires after each
   image finishes. */
function preloadAllAssets(onProgress) {
  const imageUrls = [];

  // In tile mode the base map loads tile-by-tile through Leaflet, so
  // there is no single large image to preload.
  if (config.mapMode !== "tiles" && config.imageUrl) {
    imageUrls.push(config.imageUrl);
  }
  const imgMap = config.imageMap || {};
  for (const key in imgMap) {
    if (imgMap[key]) imageUrls.push(imgMap[key]);
  }

  const tasks = imageUrls.map((u) => preloadImage(u));

  const total = tasks.length;
  let done = 0;

  const tracked = tasks.map((p) =>
    p.then((result) => {
      done += 1;
      try { onProgress && onProgress(done, total); } catch (_) {}
      return result;
    })
  );

  return Promise.all(tracked);
}

/* Splash counter text, driven by preloadAllAssets' onProgress. */
function updateSplashProgress(done, total) {
  const node = document.getElementById("splashProgress");
  if (node) node.textContent = "Loading " + done + "/" + total + "…";
}
/* Add the XYZ tile base layer from config.tiles. */
function addBaseTileLayer() {
  const t = config.tiles || {};

  if (!t.url) {
    console.warn("[metaversity] mapMode is 'tiles' but config.tiles.url is missing.");
    return null;
  }

  return L.tileLayer(t.url, {
    pane: "imagePane",
    minZoom: t.minZoom ?? 15,
    maxZoom: t.maxZoom ?? 20,
    maxNativeZoom: t.maxNativeZoom ?? t.maxZoom ?? 20,
    tms: !!t.tms,
    noWrap: true,
    bounds: t.bounds ? L.latLngBounds(t.bounds) : undefined,
    attribution: t.attribution || "Created by QGIS"
  }).addTo(map);
}
/* -----------------------------------------------------------
   Boot sequence
   ----------------------------------------------------------- */
async function boot() {

  // Finish XR detection before preloading the iframe — otherwise it
  // would point at the desktop tour URL and need a reload. The async
  // probe was pre-warmed at module load, so this await is cheap.
  try {
    await maybeUpgradeToVRProfile();

    document.body.classList.toggle("xr-mode", isVRMode());
  } catch (err) {
    console.warn("[treedis] XR detection failed:", err);
  }

  // Start the Treedis iframe in parallel with map data so it's warm by
  // the time the user hits Explore. It stays visually hidden.
  preloadTreedisIframe();

  const { buildings: rawB, tours: rawT } = await loadAllData();

  const buildingsGeo = reprojectFC(rawB, config.dataCRS);
  const toursGeo     = reprojectFC(rawT, config.dataCRS);

  buildingsLayer = buildLayer(buildingsGeo, "building", "buildingsPane");
  toursLayer     = buildLayer(toursGeo,     "tour",     "toursPane");

  // Combined extent of both layers.
  dataBounds = L.latLngBounds([]);
  [buildingsLayer, toursLayer].forEach((l) => {
    try {
      const b = l.getBounds();
      if (b && b.isValid()) dataBounds.extend(b);
    } catch (_) {}
  });

  if (!dataBounds.isValid()) {
    console.warn("[metaversity] no valid geometry found; falling back");
    dataBounds = L.latLngBounds([33.494, -80.855], [33.502, -80.843]);
  }

// Base map. Tile mode is the production path: the raster is already
// georeferenced by the XYZ grid, and campus bounds come from
// config.tiles.bounds (or padded vector bounds) for fit/reset/max-
// bounds behavior.
if (config.mapMode === "tiles") {
  baseTileLayer = addBaseTileLayer();

  if (config.tiles && config.tiles.bounds) {
    imageBounds = L.latLngBounds(config.tiles.bounds);
  } else {
    imageBounds = dataBounds.pad((config.tiles && config.tiles.boundsPadding) ?? 0.35);
  }

  if (config.tiles && config.tiles.initialCenter && config.tiles.initialZoom) {
    map.setView(config.tiles.initialCenter, config.tiles.initialZoom, { animate: false });
  } else {
    resetCampusView(false);
  }

  refreshMapConstraints({ recenterIfNeeded: false });
// Legacy single-image overlay mode.
} else {

  imageBounds = computeImageBounds(
    dataBounds,
    config.imageWidthPx,
    config.imageHeightPx,
    config.imagePaddingPct,
    align
  );

  imageOverlay = L.imageOverlay(config.imageUrl, imageBounds, {
    pane: "imagePane",
    interactive: false,
    opacity: 1,
    attribution: "© SC State University | Imagery: SC_2023_RGB WMTS"
  }).addTo(map);

  resetCampusView(false);
}

  // Overlays (z-order: buildings, then tours), pins, and lists.
  buildingsLayer.addTo(map);
  toursLayer.addTo(map);

  buildTourPins();
  tourPinsLayer.addTo(map);

  renderLocationsList();
  renderAllLocationsList();

  // Leaflet warm-up: apply and revert selected/hover styles once now,
  // while the splash is still up, so the first real click doesn't pay
  // Leaflet's lazy setup cost.
  try {
    const warm = tourStops[0] && tourStops[0].layer;
    if (warm) {
      warm.setStyle({ ...config.styles.selected });
      warm.setStyle(hoverStyleFor("tour"));
      warm.setStyle(styleFor("tour"));
    }
  } catch (_) {  }

  // Search index (buildings first, then tours).
  const push = (layer, kind) => {
    layer.eachLayer((lyr) => {
      const n = cleanName(lyr.feature.properties.name);
      if (n) allFeatures.push({ kind, layer: lyr, props: lyr.feature.properties });
    });
  };
  push(buildingsLayer, "building");
  push(toursLayer,     "tour");

  console.info("[metaversity] ready", {
    buildings: buildingsLayer.getLayers().length,
    tours:     toursLayer.getLayers().length
  });

  // Hold the splash for image preloading only, with a 15s hard cap in
  // case a URL hangs. The Treedis iframe keeps loading in the
  // background.
  const preload = preloadAllAssets(updateSplashProgress);
  const hardCap = new Promise((r) => setTimeout(() => {
    console.warn("[metaversity] hard cap reached — revealing app");
    r("hardcap");
  }, 15000));
  await Promise.race([preload, hardCap]);

  // Detached: waits for TourReady (up to 60s) then warms the home
  // sweep while the user explores the map.
  warmHomeSweep().catch((err) => {
    console.warn("[preload] home-sweep warm-up errored:", err);
  });

  // Reveal the app and show the welcome screen (unless suppressed).
  requestAnimationFrame(() => {
    el.app.setAttribute("aria-hidden", "false");
    el.app.classList.add("is-ready");
    el.splash.classList.add("is-hidden");
    setTimeout(() => { el.splash.style.display = "none"; }, 500);
    scheduleMapRefresh({ delay: 80 });

    if (typeof showStartScreen === "function") {

      // Small delay so the splash fade-out doesn't clash with the
      // start-screen fade-in.
      setTimeout(() => showStartScreen(), 220);
    }
  });
}

