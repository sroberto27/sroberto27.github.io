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
       polyline between stop centroids while a tour is running
     • wires the custom map controls (zoom / locate / layers /
       recenter) that replace the default Leaflet zoom control
     • wires the rail's pinned "Recenter on tour" row
     • adds Share / Google Maps / Add-to-guided-tour actions to
       the detail state (wrapping renderDetails non-destructively)
     • builds the street-view picture-in-picture mini-map and the
       3D help button

   Load order: last. It reads the same top-level globals (map,
   tourStops, tourIndex, el, config, …) the split app already
   shares on the script scope.
   ================================================================ */

(function initRedesign() {
  "use strict";

  const $id = (id) => document.getElementById(id);

  /* ----------------------------------------------------------
     Tour route — dashed gold polyline between stop centroids.
     Added while a tour is running (tourIndex >= 0).
     ---------------------------------------------------------- */
  let routeLine = null;

  function buildRouteLine() {
    if (routeLine || !tourStops.length || typeof L === "undefined") return;
    const pts = tourStops
      .map((s) => { try { return s.layer.getBounds().getCenter(); } catch (_) { return null; } })
      .filter(Boolean);
    if (pts.length < 2) return;
    routeLine = L.polyline(pts, {
      pane: "toursPane",
      className: "tour-route-line",
      color: "#7A5C10",
      weight: 2.5,
      opacity: 0.9,
      dashArray: "7 7",
      interactive: false
    });
  }

  function syncRoute() {
    buildRouteLine();
    if (!routeLine) return;
    const touring = tourIndex >= 0;
    if (touring && !map.hasLayer(routeLine)) routeLine.addTo(map);
    if (!touring && map.hasLayer(routeLine)) map.removeLayer(routeLine);
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
      openTourRail();
    });
  }

  /* Wrap updateTourbar so the route + tour-rail state stay in
     sync with every tour transition, without editing callers. */
  const _updateTourbar = updateTourbar;
  updateTourbar = function () {
    _updateTourbar();
    syncRoute();
    if (tourIndex < 0) closeTourRail();
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
    // "STATE PARK" → "Parks", "CITY" → "City", others title-cased
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
        if (stop) selectFeature(stop.layer, "tour", { focus: true });
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
     Map controls — zoom / locate / layers / recenter row
     ---------------------------------------------------------- */
  const zoomIn  = $id("zoomInBtn");
  const zoomOut = $id("zoomOutBtn");
  if (zoomIn)  zoomIn.addEventListener("click",  () => map.zoomIn());
  if (zoomOut) zoomOut.addEventListener("click", () => map.zoomOut());

  const locateBtn = $id("locateBtn");
  if (locateBtn) {
    locateBtn.addEventListener("click", () => {
      map.once("locationfound", (e) => {
        map.flyTo(e.latlng, Math.min(map.getMaxZoom(), 15));
      });
      map.once("locationerror", () => {
        // Graceful fallback: recenter on the parish extent.
        if (imageBounds) resetCampusView(true);
      });
      map.locate({ setView: false, maxZoom: 15 });
    });
  }

  const layersBtn = $id("layersBtn");
  if (layersBtn) {
    // Toggles the OSM streets/buildings/POI-label overlay built in
    // js/11-boot.js (referenceOverlayLayer). Starts hidden.
    layersBtn.addEventListener("click", () => {
      if (!referenceOverlayLayer) return;
      const on = map.hasLayer(referenceOverlayLayer);
      if (on) {
        map.removeLayer(referenceOverlayLayer);
      } else {
        referenceOverlayLayer.addTo(map);
      }
      layersBtn.classList.toggle("is-active", !on);
      layersBtn.setAttribute("aria-pressed", String(!on));
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
    if (miniMap || typeof L === "undefined") return;
    const canvas = $id("svMiniMapCanvas");
    if (!canvas) return;

    miniMap = L.map(canvas, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });

    const t = config.tiles || {};
    if (config.mapMode === "tiles" && t.url) {
      L.tileLayer(t.url, {
        minZoom: t.minZoom ?? 10,
        maxZoom: t.maxZoom ?? 20,
        maxNativeZoom: t.maxNativeZoom ?? t.maxZoom ?? 20,
        tms: !!t.tms,
        noWrap: true,
        bounds: t.bounds ? L.latLngBounds(t.bounds) : undefined
      }).addTo(miniMap);
    }

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
      if (selectedLayer && selectedLayer.getBounds) {
        center = selectedLayer.getBounds().getCenter();
      } else if (imageBounds) {
        center = imageBounds.getCenter();
      }
    } catch (_) {}
    if (!center) return;

    requestAnimationFrame(() => {
      miniMap.invalidateSize({ pan: false });
      miniMap.setView(center, 13, { animate: false });

      const order = tourIndex >= 0 ? tourIndex + 1 : "•";
      const icon = L.divIcon({
        className: "tour-pin-wrap",
        html: `<div class="tour-pin is-active">${order}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      if (miniMarker) miniMap.removeLayer(miniMarker);
      miniMarker = L.marker(center, { icon, interactive: false }).addTo(miniMap);
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
