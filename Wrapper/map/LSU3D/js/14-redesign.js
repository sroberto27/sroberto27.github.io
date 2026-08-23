/* === LSU Death Valley Experience — Part 14: Redesign glue layer =====
   Everything the light "map-first" redesign adds ON TOP of the
   existing business logic. No data formats, no Treedis bridge, no
   config plumbing is touched — this file only:

     • builds the filter chips from locations.json categories
       (rail + mobile floating row) and filters the place cards
     • builds the mobile PEEK sheet (horizontal photo cards +
       "Start guided tour")
     • wires the guided-tour pill's play button and the rail tour
       card (body.tour-rail-open), and draws the dashed gold route
       line between stop centroids while a tour is running
     • wires the custom map controls (zoom / locate / layers /
       3D toggle / recenter) that replace MapLibre's default controls
     • wires the rail's pinned "Recenter on tour" row
     • adds Share / Google Maps / Add-to-guided-tour actions to
       the detail state (wrapping renderDetails non-destructively)
     • builds the street-view picture-in-picture mini-map (a second,
       non-interactive maplibregl.Map) and the 3D help button

   Load order: last. It reads the same top-level globals (map,
   tourStops, tourIndex, el, config, …) the split app already
   shares on the script scope.
   ================================================================ */

(function initRedesign() {
  "use strict";

  const $id = (id) => document.getElementById(id);

  /* ----------------------------------------------------------
     Tour route — dashed gold line between stop centroids, added
     while a tour is running (tourIndex >= 0). One source/layer,
     built once and visibility-toggled — the MapLibre-native
     replacement for Leaflet's add/removeLayer(L.polyline).
     ---------------------------------------------------------- */
  let routeLineBuilt = false;

  function buildRouteLine() {
    if (routeLineBuilt || !tourStops.length) return;
    const coords = tourStops
      .map((s) => { try { return centerOfBounds(boundsOfFeature(s.feature)); } catch (_) { return null; } })
      .filter(Boolean);
    if (coords.length < 2) return;

    map.addSource(SOURCE_IDS.route, {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }
    });
    map.addLayer({
      id: LAYER_IDS.routeLine,
      type: "line",
      source: SOURCE_IDS.route,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#7A5C10",
        "line-width": 2.5,
        "line-opacity": 0.9,
        "line-dasharray": [2, 2]
      }
    });
    routeLineBuilt = true;
  }

  function syncRoute() {
    buildRouteLine();
    if (!routeLineBuilt || !map.getLayer(LAYER_IDS.routeLine)) return;
    const touring = tourIndex >= 0;
    map.setLayoutProperty(LAYER_IDS.routeLine, "visibility", touring ? "visible" : "none");
  }

  /* ----------------------------------------------------------
     Tour rail card open/close (body.tour-rail-open)
     ---------------------------------------------------------- */
  function openTourRail() {
    const rt = $id("railTour");
    if (rt) rt.hidden = false;
    document.body.classList.add("tour-rail-open");
  }
  function closeTourRail() {
    document.body.classList.remove("tour-rail-open");
  }

  const playBtn = $id("tourPlayBtn");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (document.body.classList.contains("tour-rail-open")) {
        closeTourRail();
        return;
      }
      if (tourIndex < 0 && tourStops.length) goToStop(0);
      openTourRail();
    });
  }

  const railTourPrev = $id("railTourPrev");
  const railTourNext = $id("railTourNext");
  if (railTourPrev) railTourPrev.addEventListener("click", () => tourPrevAction());
  if (railTourNext) railTourNext.addEventListener("click", () => tourNextAction());

  const startTourBtn = $id("startTourBtn");
  if (startTourBtn) {
    startTourBtn.addEventListener("click", () => {
      if (tourStops.length) goToStop(0);
      // #railTour is a separate bottom sheet on mobile (fixed,
      // bottom:0) — opening it at the same time as the #details sheet
      // that goToStop() above also opens stacked both on screen at
      // once with no way to dismiss either independently. On mobile
      // the compact #detailsTourStepper (wired below) covers tour
      // navigation instead, so #railTour only opens on desktop, where
      // it's a same-box slide-in inside .rail with no overlap risk.
      if (!isMobile()) openTourRail();
    });
  }

  /* ----------------------------------------------------------
     Mobile tour stepper — lives inside the #details sheet, replacing
     #railTour's prev/next+progress role on mobile (see startTourBtn
     above). Visible only while a tour is running.
     ---------------------------------------------------------- */
  const detailsStepper = $id("detailsTourStepper");
  const detailsStepperLabel = $id("detailsTourStepperLabel");
  const detailsStepperPrev = $id("detailsTourPrev");
  const detailsStepperNext = $id("detailsTourNext");
  if (detailsStepperPrev) detailsStepperPrev.addEventListener("click", () => tourPrevAction());
  if (detailsStepperNext) detailsStepperNext.addEventListener("click", () => tourNextAction());

  function syncDetailsStepper() {
    if (!detailsStepper) return;
    const running = tourIndex >= 0 && tourStops.length;
    detailsStepper.classList.toggle("is-visible", running);
    detailsStepper.setAttribute("aria-hidden", String(!running));
    if (!running) return;

    setText(detailsStepperLabel, `Stop ${tourIndex + 1} of ${tourStops.length}`);
    if (detailsStepperPrev) detailsStepperPrev.disabled = tourIndex === 0;
    if (detailsStepperNext) detailsStepperNext.disabled = tourIndex === tourStops.length - 1;
  }

  /* Wrap updateTourbar so the route + tour-rail state stay in
     sync with every tour transition, without editing callers. */
  const _updateTourbar = updateTourbar;
  updateTourbar = function () {
    _updateTourbar();
    syncRoute();
    if (tourIndex < 0) closeTourRail();
    syncDetailsStepper();
    updateMiniMap();
  };

  /* ----------------------------------------------------------
     Filter chips — built from the category field of the loaded
     locations (config.categoryMap ← data/locations.json).
     ---------------------------------------------------------- */
  function currentCategories() {
    const set = new Map(); // display → count
    tourStops.forEach((stop) => {
      const cat = getCategory(cleanName(stop.feature.properties.name));
      if (!cat) return;
      set.set(cat, (set.get(cat) || 0) + 1);
    });
    return Array.from(set.keys());
  }

  let activeCategory = ""; // "" = All

  function chipLabel(cat) {
    // "ROUTE" → "Route", "FACILITY" → "Facility", others title-cased
    const c = cat.toLowerCase();
    if (/park/.test(c)) return "Parks";
    if (/histor/.test(c)) return "Historic";
    if (/museum/.test(c)) return "Museums";
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }

  function renderChips() {
    const cats = currentCategories();
    const html =
      `<button class="filter-chip${activeCategory === "" ? " is-active" : ""}"
               data-cat="" type="button">All</button>` +
      cats.map((c) =>
        `<button class="filter-chip${activeCategory === c ? " is-active" : ""}"
                 data-cat="${escapeHTML(c)}" type="button">${escapeHTML(chipLabel(c))}</button>`
      ).join("");

    ["filterChips", "filterChipsTop"].forEach((cid) => {
      const wrap = $id(cid);
      if (!wrap) return;
      wrap.innerHTML = html;
      wrap.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.addEventListener("click", () => applyCategoryFilter(chip.dataset.cat || ""));
      });
    });
  }

  function applyCategoryFilter(cat) {
    activeCategory = cat || "";
    // Hide/show place cards without re-rendering (keeps handlers).
    document.querySelectorAll(
      "#locationsList .location-row, #allLocationsList .location-row"
    ).forEach((row) => {
      const rowCat = row.dataset.category || "";
      const show = !activeCategory || rowCat === activeCategory;
      row.style.display = show ? "" : "none";
    });
    renderChips();
  }
  // Exposed so the search autocomplete's CATEGORIES group can apply it.
  window.__niApplyCategoryFilter = applyCategoryFilter;

  /* ----------------------------------------------------------
     Mobile PEEK sheet — horizontal photo cards
     ---------------------------------------------------------- */
  function renderPeekCards() {
    const wrap = $id("peekCards");
    if (!wrap) return;
    wrap.innerHTML = tourStops.map((stop) => {
      const name = cleanName(stop.feature.properties.name);
      const cat = getCategory(name) || "";
      const img = getImage(name);
      const pic = img
        ? `<img src="${escapeHTML(img)}" alt="" loading="lazy" onerror="this.remove()">`
        : "";
      return `<button class="peek-card" type="button"
                      data-name="${escapeHTML(name.toLowerCase())}">
                <span class="peek-card-img gold-hairline-bottom">${pic}</span>
                <span class="peek-card-name">${escapeHTML(name)}</span>
                <span class="peek-card-cat">${escapeHTML(cat)}</span>
              </button>`;
    }).join("");

    wrap.querySelectorAll(".peek-card").forEach((card) => {
      card.addEventListener("click", () => {
        const name = card.dataset.name;
        const stop = tourStops.find(
          (s) => cleanName(s.feature.properties.name).toLowerCase() === name
        );
        if (stop) {
          selectFeature({ sourceId: SOURCE_IDS.tours, featureId: stop.featureId, feature: stop.feature },
                        "tour", { focus: true });
        }
      });
    });

    const count = $id("sheetPeekCount");
    if (count) count.textContent =
      `${tourStops.length} place${tourStops.length === 1 ? "" : "s"}`;
    const stops = $id("railRecenterCount");
    if (stops) stops.textContent = String(tourStops.length);
    const cta = $id("startTourBtn");
    if (cta) cta.textContent =
      `Start guided tour · ${tourStops.length} stops`;
  }

  /* Called by renderLocationsList() after every rebuild. */
  window.__niOnListRendered = function () {
    renderChips();
    renderPeekCards();
    if (activeCategory) applyCategoryFilter(activeCategory);
  };

  /* ----------------------------------------------------------
     Map controls — zoom / locate / layers / 3D / recenter row
     ---------------------------------------------------------- */
  const zoomIn  = $id("zoomInBtn");
  const zoomOut = $id("zoomOutBtn");
  if (zoomIn)  zoomIn.addEventListener("click",  () => map.zoomIn());
  if (zoomOut) zoomOut.addEventListener("click", () => map.zoomOut());

  const locateBtn = $id("locateBtn");
  if (locateBtn) {
    // MapLibre has no Leaflet-style map.locate() convenience — call
    // the browser's Geolocation API directly (what Leaflet did
    // internally anyway).
    locateBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        if (imageBounds) resetCampusView(true);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: Math.min(map.getMaxZoom(), 15)
          });
        },
        () => {
          // Graceful fallback: recenter on the campus extent.
          if (imageBounds) resetCampusView(true);
        },
        { maximumAge: 60000, timeout: 10000 }
      );
    });
  }

  const layersBtn = $id("layersBtn");
  if (layersBtn) {
    // Toggles the OSM streets/buildings/POI-label overlay built in
    // js/11-boot.js (addReferenceOverlaySource()). Starts VISIBLE — it
    // carries the street and building names, which neither the DOTD
    // aerial nor Google's 3D tiles provide.
    layersBtn.classList.toggle("is-active", referenceOverlayOn);
    layersBtn.setAttribute("aria-pressed", String(referenceOverlayOn));

    layersBtn.addEventListener("click", () => {
      if (!map.getLayer(LAYER_IDS.referenceOverlay)) return;
      referenceOverlayOn = !referenceOverlayOn;
      map.setLayoutProperty(LAYER_IDS.referenceOverlay, "visibility", referenceOverlayOn ? "visible" : "none");
      layersBtn.classList.toggle("is-active", referenceOverlayOn);
      layersBtn.setAttribute("aria-pressed", String(referenceOverlayOn));
    });
  }

  const toggleImageryBtn = $id("toggleImageryBtn");
  if (toggleImageryBtn) {
    // Aerial imagery on/off — independent of the reference-overlay
    // toggle above and the 2D/3D toggle (brief §3.6). #background-layer
    // (js/11-boot.js: addBackgroundLayer(), added below imagery in paint
    // order) shows through as a neutral ground tone when off, whether
    // terrain is draping it in 3D or not.
    toggleImageryBtn.addEventListener("click", () => {
      if (!map.getLayer(LAYER_IDS.imagery)) return;
      imageryOn = !imageryOn;
      map.setLayoutProperty(LAYER_IDS.imagery, "visibility", imageryOn ? "visible" : "none");
      toggleImageryBtn.classList.toggle("is-active", imageryOn);
      toggleImageryBtn.setAttribute("aria-pressed", String(imageryOn));
    });
  }

  const railRecenter = $id("railRecenter");
  if (railRecenter) {
    railRecenter.addEventListener("click", () => {
      clearSelection();
      if (imageBounds) resetCampusView(true);
      closeMobileLocations();
    });
  }

  /* Mobile floating search pill: the existing #locationsToggle
     handler opens the list sheet — additionally focus the field. */
  const searchPill = $id("locationsToggle");
  if (searchPill) {
    searchPill.addEventListener("click", () => {
      setTimeout(() => {
        if (el.locations.classList.contains("is-open") && el.searchInput) {
          el.searchInput.focus();
        }
      }, 280);
    });
  }

  /* ----------------------------------------------------------
     Detail-state actions: Google Maps / Share / Add to tour.
     renderDetails is wrapped, not replaced — the original runs
     first and untouched.
     ---------------------------------------------------------- */
  const _renderDetails = renderDetails;
  renderDetails = function (feature, kind) {
    _renderDetails(feature, kind);

    const props = (feature && feature.properties) || {};
    const name = cleanName(props.name);

    const gmaps = $id("gmapsBtn");
    if (gmaps) {
      const addr = getAddress(name);
      if (addr) {
        gmaps.href =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(addr);
        gmaps.hidden = false;
      } else {
        gmaps.hidden = true;
      }
    }

    const addBtn = $id("addToTourBtn");
    if (addBtn) {
      const idx = tourStops.findIndex(
        (s) => cleanName(s.feature.properties.name) === name
      );
      if (idx >= 0) {
        addBtn.hidden = false;
        addBtn.textContent = "Add to guided tour";
        addBtn.onclick = () => {
          goToStop(idx);
          openTourRail();
        };
      } else {
        addBtn.hidden = true;
        addBtn.onclick = null;
      }
    }

    // VR-ENABLED label mirrors the Explore CTA's sweep availability
    const vrLabel = document.querySelector(".details-vr-label");
    if (vrLabel) {
      vrLabel.classList.toggle("is-hidden-no-sweep", !hasSweep(name));
    }

    const shareBtn = $id("shareBtn");
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const url = location.href;
        const payload = { title: `${name} — The Death Valley Experience`, url };
        try {
          if (navigator.share) {
            await navigator.share(payload);
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            const prev = shareBtn.textContent;
            shareBtn.textContent = "Link copied ✓";
            setTimeout(() => { shareBtn.textContent = prev; }, 1400);
          }
        } catch (_) { /* user cancelled — fine */ }
      };
    }
  };

  /* ----------------------------------------------------------
     Street view extras: help button + PiP mini-map
     -----------------------------------------------------------
     The mini-map is a second, small, non-interactive maplibregl.Map
     instance showing the same DOTD imagery — the direct replacement
     for the old L.map(canvas, {...}) picture-in-picture.
     ---------------------------------------------------------- */
  const svHelp = $id("svHelpBtn");
  if (svHelp) {
    svHelp.addEventListener("click", () => {
      const modal = $id("navInstructions");
      if (modal) modal.setAttribute("aria-hidden", "false");
    });
  }

  let miniMap = null;
  let miniMarker = null;

  function ensureMiniMap() {
    if (miniMap) return;
    const canvas = $id("svMiniMapCanvas");
    if (!canvas) return;

    miniMap = new maplibregl.Map({
      container: canvas,
      style: { version: 8, sources: {}, layers: [] },
      interactive: false,
      attributionControl: false
    });

    miniMap.on("load", () => {
      const img = config.esriImagery || {};
      if (!img.tiles || !img.tiles.length) return;
      miniMap.addSource("mini-imagery-source", {
        type: "raster",
        tiles: img.tiles,
        tileSize: img.tileSize || 256,
        maxzoom: img.maxZoom ?? 21
      });
      miniMap.addLayer({ id: "mini-imagery-layer", type: "raster", source: "mini-imagery-source" });
    });

    // Whole PiP returns to the map
    const box = $id("svMiniMap");
    const back = $id("svMiniMapBack");
    const exit = (e) => { e.stopPropagation(); closeStreetView(); };
    if (box)  box.addEventListener("click", exit);
    if (back) back.addEventListener("click", exit);
  }

  function updateMiniMap() {
    if (!streetViewActive) return;
    ensureMiniMap();
    if (!miniMap) return;

    let center = null;
    try {
      if (selectedFeature && selectedFeature.feature) {
        center = centerOfBounds(boundsOfFeature(selectedFeature.feature));
      } else if (imageBounds) {
        const c = imageBounds.getCenter();
        center = [c.lng, c.lat];
      }
    } catch (_) {}
    if (!center) return;

    requestAnimationFrame(() => {
      miniMap.resize();
      miniMap.jumpTo({ center, zoom: 13 });

      const order = tourIndex >= 0 ? tourIndex + 1 : "•";
      if (miniMarker) miniMarker.remove();
      const root = document.createElement("div");
      root.className = "tour-pin-wrap";
      root.innerHTML = `<div class="tour-pin is-active">${order}</div>`;
      miniMarker = new maplibregl.Marker({ element: root, anchor: "center" })
        .setLngLat(center)
        .addTo(miniMap);
    });
  }

  /* Refresh the PiP whenever street view opens — wrap without
     touching 04-street-view.js. */
  const _openStreetView = openStreetView;
  openStreetView = function (...args) {
    _openStreetView(...args);
    updateMiniMap();
  };

  /* ----------------------------------------------------------
     Boot sync — tourStops fills asynchronously in boot(); poll
     briefly until the first render lands, then hydrate the
     redesign chrome. renderLocationsList() also calls
     __niOnListRendered on every later rebuild.
     ---------------------------------------------------------- */
  let tries = 0;
  const bootPoll = setInterval(() => {
    tries += 1;
    if (tourStops && tourStops.length) {
      clearInterval(bootPoll);
      renderChips();
      renderPeekCards();
      buildRouteLine();
      updateTourbar(); // repaint dots + rail card through the wrapper
    } else if (tries > 200) { // ~20s safety cap
      clearInterval(bootPoll);
    }
  }, 100);
})();
