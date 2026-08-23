/* === LSU Death Valley Experience — Part 5: Map constraints + refresh helpers === */
/* Ported from the Leaflet build. The old "tiles" vs "esri-image" mapMode
   branching is gone entirely — MapLibre's imagery is always a raster
   source (js/11-boot.js: addImagerySource()), so there's only one code
   path here now. New in this file: set3DMode(), the pitch/bearing
   transition + lazy terrain-source loading behind the 2D/3D toggle. */
/* -----------------------------------------------------------
   6a. Map constraints + refresh helpers
   ----------------------------------------------------------- */
function getCampusCoverZoom() {
  if (!imageBounds) return 15;
  // MapLibre's cameraForBounds() is a read-only query — the direct
  // analog of Leaflet's map.getBoundsZoom(bounds, true): "what zoom
  // would frame these bounds" without moving the camera.
  const cam = map.cameraForBounds(imageBounds, { padding: 0 });
  return cam ? Math.min(map.getMaxZoom(), cam.zoom) : 15;
}

function refreshMapConstraints({ recenterIfNeeded = true } = {}) {
  if (!imageBounds) return;

  map.resize();

  const coverZoom = getCampusCoverZoom();
  const extraZoomOut = (map3d && map3d.zoomOutExtra) ?? 0.75;
  const minAllowedZoom = Math.max(0, coverZoom - extraZoomOut);

  // setMaxBounds/setMinZoom immediately re-clamp the current camera if it
  // now violates either constraint — no manual "pan back inside" step
  // needed the way Leaflet's panInsideBounds() required.
  map.setMaxBounds(imageBounds);
  map.setMinZoom(minAllowedZoom);

  if (!recenterIfNeeded) return;

  if (map.getZoom() < minAllowedZoom) {
    map.jumpTo({ center: imageBounds.getCenter(), zoom: minAllowedZoom });
  }
}

function resetCampusView(animate = false) {
  if (!imageBounds) return;

  refreshMapConstraints({ recenterIfNeeded: false });

  const opts = { padding: 24, duration: animate ? 800 : 0 };
  if (map3d && map3d.initialZoom) opts.maxZoom = map3d.initialZoom;
  map.fitBounds(imageBounds, opts);
}

function scheduleMapRefresh({ recenterIfNeeded = true, delay = 0 } = {}) {
  clearTimeout(scheduleMapRefresh._t);
  scheduleMapRefresh._t = setTimeout(() => {
    refreshMapConstraints({ recenterIfNeeded });
  }, delay);
}

/* -----------------------------------------------------------
   6b. 2D/3D toggle (new — no Leaflet equivalent)
   -----------------------------------------------------------
   One map instance, pitch:0 in 2D and pitch:60 in 3D — same
   markers, same selection, nothing to sync (brief §3.4). Terrain
   is added lazily on first 3D entry (perf: don't fetch DEM tiles
   for users who never leave 2D). Building/tour-stop fill vs.
   fill-extrusion layer pairs (js/07-layer-builders.js,
   js/11-boot.js Phase 6) are visibility-toggled here too; the
   map.getLayer() guards make this safe to call before those
   layers exist (Phase 1-5 of the build). */
function set3DMode(on) {
  is3DMode = !!on;

  if (is3DMode && !map.getSource(SOURCE_IDS.terrain)) {
    const t = config.terrain || {};
    if (t.tiles) {
      map.addSource(SOURCE_IDS.terrain, {
        type: "raster-dem",
        tiles: t.tiles,
        tileSize: t.tileSize || 256,
        encoding: t.encoding || "terrarium"
      });
    }
  }
  if (map.getSource(SOURCE_IDS.terrain)) {
    map.setTerrain(is3DMode ? { source: SOURCE_IDS.terrain, exaggeration: 1 } : null);
  }

  map.easeTo({
    pitch: is3DMode ? 60 : 0,
    bearing: is3DMode ? map.getBearing() : 0,
    duration: 800
  });

  // Swap each fill/fill-extrusion pair's visibility. Guarded: harmless
  // no-op until js/11-boot.js: addBuildingLayers() creates these (Phase 6).
  [
    [LAYER_IDS.buildingsFill, LAYER_IDS.buildingsExtrusion],
    [LAYER_IDS.toursFill, LAYER_IDS.toursExtrusion]
  ].forEach(([fillId, extrusionId]) => {
    if (map.getLayer(fillId)) {
      map.setLayoutProperty(fillId, "visibility", is3DMode ? "none" : "visible");
    }
    if (map.getLayer(extrusionId)) {
      map.setLayoutProperty(extrusionId, "visibility", is3DMode ? "visible" : "none");
    }
  });

  if (el.toggle3DBtn) {
    el.toggle3DBtn.classList.toggle("is-active", is3DMode);
    el.toggle3DBtn.setAttribute("aria-pressed", String(is3DMode));
    el.toggle3DBtn.setAttribute("aria-label", is3DMode ? "Switch to 2D view" : "Switch to 3D view");
    el.toggle3DBtn.title = is3DMode ? "2D view" : "3D view";
  }

  // Google Photorealistic 3D Tiles (js/16-google-tiles.js) — opt-in,
  // off by default (config.map3d.googleTilesEnabled). The flat
  // fallback above is already showing at this point (progressive
  // enhancement): if Google tiles are configured, activateGoogleTilesMode()
  // takes over asynchronously once its tileset actually loads, and
  // falls back to this same flat view again on any failure. On exit to
  // 2D, tear the Google layer down entirely rather than leave it
  // running off-screen.
  if (is3DMode) {
    applySimplified3DFallback();
    if (typeof activateGoogleTilesMode === "function") activateGoogleTilesMode();
  } else {
    if (typeof deactivateGoogleTilesMode === "function") deactivateGoogleTilesMode();
    active3DRenderer = null;
    if (typeof updateMode3DBadge === "function") updateMode3DBadge();
    // Return to the fixed 2D framing (same ground footprint as the 3D
    // start view, flat and north-up) rather than leaving the camera
    // wherever 3D happened to end. Overrides the easeTo above, which
    // only reset pitch/bearing.
    applyMap2DStartView(true);
  }
}

/* Applies config.map3d.map2dStartView. Used on first load and whenever
   3D mode is switched off, so 2D always opens on the same framing.
   `animate` eases (toggling out of 3D); the boot path jumps instead. */
function applyMap2DStartView(animate) {
  const view = (config.map3d && config.map3d.map2dStartView) || null;
  if (!view) return;
  const opts = {
    center: view.center || config.map3d.initialCenter,
    zoom: view.zoom ?? config.map3d.initialZoom,
    bearing: view.bearing ?? 0,
    pitch: view.pitch ?? 0
  };
  if (animate) map.easeTo({ ...opts, duration: 800 });
  else map.jumpTo(opts);
}

/* Prints the current camera as a ready-to-paste config.js snippet —
   the reliable way to retune google3DStartView / map2dStartView: fly
   to the view you want, run __captureView() in the console, paste. */
window.__captureView = function () {
  const c = map.getCenter();
  const snippet =
    (is3DMode ? "google3DStartView" : "map2dStartView") + ": {\n" +
    "  center: [" + c.lng.toFixed(6) + ", " + c.lat.toFixed(6) + "],\n" +
    "  zoom: " + map.getZoom().toFixed(2) + ",\n" +
    "  bearing: " + map.getBearing().toFixed(1) + ",\n" +
    "  pitch: " + map.getPitch().toFixed(1) + "\n" +
    "}";
  console.log("[capture-view] paste this into config.js -> map3d:\n" + snippet);
  return snippet;
};
