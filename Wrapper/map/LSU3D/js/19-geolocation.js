/* === LSU Death Valley Experience — Part 19: Geolocation =============
   "You are here" on the campus map.

   Replaces the one-shot getCurrentPosition() → flyTo() behind
   #locateBtn (js/14-redesign.js), which left no trace on the map and
   said nothing when permission was refused.

   Design decisions worth stating, because they are the difference
   between a useful feature and a battery complaint:

   • ON DEMAND BY DEFAULT. Nothing is requested at boot. A one-shot
     fix happens when the user taps the locate button. Continuous
     watchPosition() runs only while Live Visit Mode is open, and
     stops the moment the tab is hidden or the mode is left.

   • DENIAL IS FINAL. If someone says no, we remember it and never
     ask again in that session. Browsers punish repeat prompting and,
     more to the point, so do people.

   • POOR ACCURACY IS ADMITTED. Inside a concrete stadium bowl a fix
     can be 200 m out. Above config.gameday.poorAccuracyM we show the
     position as approximate and refuse to quote a distance, rather
     than confidently sending a family the wrong way.

   • NOTHING IS STORED OR SENT. Coordinates live in memory for as long
     as the page does. They are never written to storage and never
     attached to an analytics event — only the accuracy bucket is.
   ================================================================ */

(function initGeolocation() {
  "use strict";

  const cfg = (window.CAMPUS_CONFIG && window.CAMPUS_CONFIG.gameday) || {};
  if (cfg.enableGeolocation === false) return;

  const POOR_ACCURACY_M = cfg.poorAccuracyM || 50;
  const ARRIVAL_RADIUS_FT = cfg.arrivalRadiusFt || 150;

  const SOURCE_ACCURACY = "user-accuracy-source";
  const LAYER_ACCURACY_FILL = "user-accuracy-fill";
  const LAYER_ACCURACY_LINE = "user-accuracy-line";

  const state = {
    coords: null,        // [lng, lat] — memory only, never persisted
    accuracyM: null,
    at: 0,
    denied: false,
    watchId: null,
    marker: null,
    listeners: new Set()
  };

  /* ============================================================
     Map rendering
     ------------------------------------------------------------
     The accuracy ring is a GeoJSON polygon in geographic
     coordinates rather than a circle layer with a pixel radius.
     A pixel radius would have to be recomputed on every zoom to
     stay physically correct; a polygon just scales with the map,
     which is what "a 30 m radius" actually means.
     ============================================================ */

  /* Approximate a circle of `radiusM` around a [lng, lat] point. */
  function circlePolygon(center, radiusM, steps = 48) {
    const [lng, lat] = center;
    // Degrees per metre, corrected for latitude on the east-west axis.
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
    const ring = [];
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      ring.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
    }
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
  }

  function emptyFC() { return { type: "FeatureCollection", features: [] }; }

  function ensureAccuracyLayers() {
    if (!map || !map.getStyle || map.getSource(SOURCE_ACCURACY)) return;

    map.addSource(SOURCE_ACCURACY, { type: "geojson", data: emptyFC() });
    map.addLayer({
      id: LAYER_ACCURACY_FILL,
      type: "fill",
      source: SOURCE_ACCURACY,
      paint: { "fill-color": "#2563EB", "fill-opacity": 0.12 }
    });
    map.addLayer({
      id: LAYER_ACCURACY_LINE,
      type: "line",
      source: SOURCE_ACCURACY,
      paint: { "line-color": "#2563EB", "line-width": 1, "line-opacity": 0.5 }
    });
  }

  function ensureMarker() {
    if (state.marker) return state.marker;
    const node = document.createElement("div");
    node.className = "user-dot";
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = '<span class="user-dot-pulse"></span><span class="user-dot-core"></span>';
    state.marker = new maplibregl.Marker({ element: node })
      .setLngLat([0, 0])
      .addTo(map);
    return state.marker;
  }

  function renderPosition() {
    if (!state.coords) return;
    try {
      ensureAccuracyLayers();
      ensureMarker().setLngLat(state.coords);

      const el = state.marker.getElement();
      el.classList.toggle("is-approximate", isApproximate());

      const src = map.getSource(SOURCE_ACCURACY);
      if (src) {
        // Below ~10 m the ring is smaller than the dot and just looks
        // like a smudge, so we don't draw one.
        src.setData(
          state.accuracyM && state.accuracyM > 10
            ? { type: "FeatureCollection", features: [circlePolygon(state.coords, state.accuracyM)] }
            : emptyFC()
        );
      }
    } catch (err) {
      console.warn("[geo] render failed:", err);
    }
  }

  function clearPosition() {
    if (state.marker) { state.marker.remove(); state.marker = null; }
    try {
      const src = map.getSource(SOURCE_ACCURACY);
      if (src) src.setData(emptyFC());
    } catch (_) { /* style may already be gone */ }
  }

  /* ============================================================
     Getting a fix
     ============================================================ */

  function isApproximate() {
    return state.accuracyM != null && state.accuracyM > POOR_ACCURACY_M;
  }

  /* Coarse buckets, so analytics can answer "does this work inside
     the stadium?" without ever handling a coordinate. */
  function accuracyBucket(m) {
    if (m == null) return "unknown";
    if (m <= 10) return "good";
    if (m <= POOR_ACCURACY_M) return "usable";
    if (m <= 200) return "poor";
    return "very_poor";
  }

  function onPosition(pos, { source, fly }) {
    state.coords = [pos.coords.longitude, pos.coords.latitude];
    state.accuracyM = pos.coords.accuracy;
    state.at = Date.now();
    state.denied = false;

    renderPosition();

    Core.track("geo_fix", {
      source,
      accuracy: accuracyBucket(state.accuracyM),
      approximate: isApproximate()
    });

    if (fly) {
      map.flyTo({ center: state.coords, zoom: Math.min(map.getMaxZoom(), 17) });
    }
    notify();
  }

  function onError(err, { source }) {
    const denied = err && err.code === 1;      // PERMISSION_DENIED
    if (denied) state.denied = true;

    Core.track("geo_permission", {
      source,
      result: denied ? "denied" : "error",
      code: err && err.code
    });

    if (denied) {
      Router.showToast(
        "Location is turned off for this site, so we can’t show where you are. " +
        "You can enable it in your browser’s site settings — everything else still works."
      );
    } else if (err && err.code === 3) {        // TIMEOUT
      Router.showToast("We couldn’t get a location fix. Try again once you’re outside.");
    } else {
      Router.showToast("Location isn’t available right now.");
    }
    notify();
  }

  /* One-shot fix. This is what the locate button calls. */
  function locate({ source = "manual", fly = true } = {}) {
    if (!navigator.geolocation) {
      Router.showToast("This browser can’t share a location.");
      return Promise.resolve(null);
    }
    // Asking again after a refusal re-prompts on some browsers and is
    // silently ignored on others. Neither is worth doing.
    if (state.denied) {
      Router.showToast("Location is still turned off for this site.");
      return Promise.resolve(null);
    }

    Core.track("geo_permission", { source, result: "requested" });

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => { onPosition(pos, { source, fly }); resolve(state.coords); },
        (err) => { onError(err, { source }); resolve(null); },
        // A 60s-old fix is fine for a campus-scale map and saves
        // waking the GPS chip; 10s is long enough for a cold fix.
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
      );
    });
  }

  /* Continuous updates. Only Live Visit Mode should call this. */
  function startWatch({ source = "live_visit" } = {}) {
    if (!navigator.geolocation || state.denied || state.watchId != null) return;

    Core.track("geo_permission", { source, result: "watch_requested" });

    state.watchId = navigator.geolocation.watchPosition(
      (pos) => onPosition(pos, { source, fly: false }),
      (err) => { onError(err, { source }); stopWatch(); },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  }

  function stopWatch() {
    if (state.watchId == null) return;
    try { navigator.geolocation.clearWatch(state.watchId); } catch (_) { /* already gone */ }
    state.watchId = null;
  }

  /* A phone in a pocket should not be running the GPS. Suspend the
     watch whenever the tab is hidden and resume when it comes back,
     but only if something still wants it. */
  let wantsWatch = false;

  function requestWatch()  { wantsWatch = true;  if (!document.hidden) startWatch(); }
  function releaseWatch()  { wantsWatch = false; stopWatch(); }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopWatch();
    else if (wantsWatch) startWatch();
  });

  window.addEventListener("pagehide", stopWatch);

  /* ============================================================
     Queries
     ============================================================ */

  /* Distance and heading from the user to a tour stop.
     Returns null when we have no fix, or when the fix is too vague
     to quote — an honest "we don't know" beats a confident number
     that is 200 m wrong. */
  function toStop(i) {
    if (!state.coords || isApproximate()) return null;
    if (typeof tourStops === "undefined" || !tourStops[i]) return null;

    const center = centerOfBounds(boundsOfFeature(tourStops[i].feature));
    if (!center) return null;

    const feet = Core.haversineFt(state.coords, center);
    const bearing = Core.bearingDeg(state.coords, center);
    return {
      feet,
      bearing,
      compass: Core.compassPoint(bearing),
      label: Core.formatDistance(feet),
      minutes: Core.walkMinutes(feet),
      arrived: feet != null && feet <= ARRIVAL_RADIUS_FT
    };
  }

  /* Nearest tour stop to the current position, or null. */
  function nearestStop() {
    if (!state.coords || typeof tourStops === "undefined") return null;
    let best = null;
    for (let i = 0; i < tourStops.length; i++) {
      const center = centerOfBounds(boundsOfFeature(tourStops[i].feature));
      if (!center) continue;
      const feet = Core.haversineFt(state.coords, center);
      if (feet == null) continue;
      if (!best || feet < best.feet) best = { index: i, feet };
    }
    return best;
  }

  /* Subscribers (Live Visit Mode) get told when the fix changes. */
  function notify() {
    for (const fn of state.listeners) {
      try { fn(publicState()); } catch (err) { console.warn("[geo] listener failed:", err); }
    }
  }

  function publicState() {
    return {
      coords: state.coords ? state.coords.slice() : null,
      accuracyM: state.accuracyM,
      approximate: isApproximate(),
      denied: state.denied,
      watching: state.watchId != null,
      at: state.at
    };
  }

  window.Geo = {
    locate,
    requestWatch,
    releaseWatch,
    stopWatch,
    toStop,
    nearestStop,
    getState: publicState,
    isApproximate,
    clear: clearPosition,
    onChange(fn) { if (typeof fn === "function") state.listeners.add(fn); },
    offChange(fn) { state.listeners.delete(fn); }
  };
})();
