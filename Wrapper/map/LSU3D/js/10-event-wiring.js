/* === LSU Death Valley Experience — Part 10: Event wiring === */
/* -----------------------------------------------------------
   16. Event wiring
   -----------------------------------------------------------
   The Leaflet build's entire image-alignment dev tool (align
   panel, Shift+A shortcut, arrow-key nudge/scale) is deleted —
   it existed only for the legacy single-image-overlay mode,
   which no longer exists under MapLibre (imagery is always a
   georeferenced raster source now). Everything else below is
   ported with minimal change; the one real behavioral fix is
   the bare-map-click handler at the bottom (see its comment).
   ----------------------------------------------------------- */

/* ------- Tour navigation buttons (desktop + mobile) ------- */
if (el.tourPrev)       el.tourPrev.addEventListener("click",       tourPrevAction);
if (el.tourNext)       el.tourNext.addEventListener("click",       tourNextAction);
if (el.tourPrevMobile) el.tourPrevMobile.addEventListener("click", tourPrevAction);
if (el.tourNextMobile) el.tourNextMobile.addEventListener("click", tourNextAction);

/* ------- Street view wiring --------------------------------
   • Explore CTA inside the metadata panel  → opens the viewer at
     the currently-selected building's sweep.
   • VR "Explore" button (desktop-only area) → same behaviour.
   • Explorable list rows are wired inside renderExplorable().
   • Close button hides the overlay and returns to the map.
   • Clicking the touch guard arms the 3D viewer for the first
     real interaction; it re-arms automatically on next open.
----------------------------------------------------------- */
function handleExploreClick(e) {
  if (e) e.preventDefault();
  const btn = e && e.currentTarget;
  const name    = (btn && btn.dataset.locationName)  || "";
  const sweepId = (btn && btn.dataset.sweepId)       || "";

  // Pull the latest entry in case config changed since render.
  // `fresh` is also where we read the per-entry rotation /
  // transitionTime — the dataset only carries the sweep id.
  const fresh = getTreedisEntry(name);
  const effectiveSweep = sweepId || (fresh && fresh.sweepId) || null;

  openStreetView(effectiveSweep, name, getCategory(name), {
    rotation:       (fresh && fresh.rotation)       || null,
    transitionTime: (fresh && fresh.transitionTime) || null
  });
}
if (el.exploreCta) el.exploreCta.addEventListener("click", handleExploreClick);

/* The persistent desktop/iPad footer carries its own Explore button.
   Rather than duplicate the dataset/state logic above, the footer
   button simply forwards its click to the canonical #exploreCta —
   that element already has its dataset kept in sync by
   updateDetailsPanel() above and runs through handleExploreClick. */
if (el.exploreCtaFooter && el.exploreCta) {
  el.exploreCtaFooter.addEventListener("click", (e) => {
    e.preventDefault();
    el.exploreCta.click();
  });
}

/* The VR button carries a different intent than Explore: it shows
   a small instruction popup explaining how to open this location
   inside a VR headset (per the Figma annotation on the desktop
   flow). It does NOT launch the 2D street view.               */
if (el.vrBtn) {
  el.vrBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const name = el.vrBtn.dataset.locationName || "this location";
    const tourUrl = (config.treedis && config.treedis.tourUrl) || "";
    alert(
      `${name} is VR-Enabled\n\n` +
      `In your headset, navigate to:\n  ${tourUrl}\n\n` +
      `Open the tour and look for this location's door to enter.`
    );
  });
}

if (el.streetviewClose) {
  el.streetviewClose.addEventListener("click", () => closeStreetView());
}

if (el.streetviewLoadingCancel) {
  el.streetviewLoadingCancel.addEventListener("click", () => {
    console.info("[streetview] user cancelled while loading");
    closeStreetView();
  });
}

if (el.streetviewTouchGuard) {
  el.streetviewTouchGuard.addEventListener("click", () => {
    el.streetviewTouchGuard.classList.remove("is-active");
  });
}

el.fitBtn.addEventListener("click", () => {
  if (imageBounds) resetCampusView(true);
});

el.detailsClose.addEventListener("click", () => clearSelection());

if (el.searchInput) {
  el.searchInput.addEventListener("input", (e) => renderSearch(e.target.value));
  document.addEventListener("click", (e) => {
    // Don't hide results if the click is inside the search area itself
    if (e.target.closest(".metabar-search")) return;
    // Don't hide if user is tapping the SEARCH toggle button
    if (e.target.closest("#searchBtn")) return;
    el.searchResults.hidden = true;
  });
}

el.modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.modeBtns.forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    // Drive the page-level mode swap. The CSS uses `body.mode-learn`
    // to hide the .shell (Explore) and reveal the .learn-shell.
    const mode = btn.dataset.mode;          // "explore" | "learn"
    setAppMode(mode);
  });
});

window.addEventListener("resize", () => {
  scheduleMapRefresh({ delay: 80 });
});

// Help button — simple info overlay for now
el.helpBtn.addEventListener("click", () => {
  alert(
    "The Death Valley Experience\n\n" +
    "• Tap or click a stop on the map to see details.\n" +
    "• Use the list on the left to jump to tour stops.\n" +
    "• Arrow buttons step through the tour.\n" +
    "• Arrow keys ← / → also navigate the tour.\n" +
    "• Press Escape to close any open panel."
  );
});

// Fullscreen toggle
el.fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

document.addEventListener("fullscreenchange", () => {
  scheduleMapRefresh({ delay: 80 });
});

// 2D/3D toggle
if (el.toggle3DBtn) {
  el.toggle3DBtn.addEventListener("click", () => set3DMode(!is3DMode));
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
    // Allow Escape inside the search field to close / blur
    if (e.key === "Escape" && e.target === el.searchInput) {
      if (isMobile() && el.metabarSearch.classList.contains("is-open")) {
        closeSearchPanel();
      } else {
        el.searchInput.blur();
        el.searchResults.hidden = true;
      }
    }
    return;
  }

  // Arrow keys drive the tour
  if (e.key === "ArrowRight")      { tourNextAction(); e.preventDefault(); }
  else if (e.key === "ArrowLeft")  { tourPrevAction(); e.preventDefault(); }
  else if (e.key === "Escape")     {
    if (isMobile() && el.metabarSearch.classList.contains("is-open")) {
      closeSearchPanel();
    } else if (streetViewActive) {
      // Escape is the fastest way back to the map from 3D.
      closeStreetView();
    } else if (drawerOpen) {
      closeMobileLocations();
    } else {
      clearSelection();
    }
  }
});

/* Clicking the bare map clears selection.
   MapLibre fires this generic map-level "click" listener AND any
   layer-scoped ones (js/07-layer-builders.js: bindLayerEvents())
   independently for the same click — there's no Leaflet-style DOM
   bubbling/stopPropagation between them, so a click that already
   selected a stop would also reach here and immediately clear it.
   We guard against that by querying whether the click actually hit
   one of our interactive fill/fill-extrusion layers first (the
   MapLibre-native replacement for the old
   `e.originalEvent.target.closest(".leaflet-interactive")` check). */
map.on("click", (e) => {
  if (drawerOpen) { closeMobileLocations(); return; }
  // When the street view is covering the map, clicks that still
  // somehow reach the canvas (e.g., synthetic events) shouldn't
  // dismiss the current selection.
  if (streetViewActive) return;

  const interactiveLayers = [
    LAYER_IDS.buildingsFill, LAYER_IDS.buildingsExtrusion,
    LAYER_IDS.toursFill, LAYER_IDS.toursExtrusion
  ].filter((id) => map.getLayer(id));
  if (interactiveLayers.length &&
      map.queryRenderedFeatures(e.point, { layers: interactiveLayers }).length) {
    return;
  }

  clearSelection();
});
