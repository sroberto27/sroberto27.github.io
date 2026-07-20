/* === Event wiring + image alignment tool === */

/* -----------------------------------------------------------
   Image alignment tool (legacy single-image mode only)
   ----------------------------------------------------------- */
const alignUI = {
  btn:    $("alignBtn"),
  panel:  $("alignPanel"),
  close:  $("alignClose"),
  copy:   $("alignCopy"),
  save:   $("alignSave"),
  valLat: $("valLat"),
  valLng: $("valLng"),
  valSx:  $("valSx"),
  valSy:  $("valSy")
};

let alignMode = false;

/* Recompute bounds from the current alignment values and push them to
   the live overlay; persists to localStorage. */
function reapplyAlign() {
  if (!imageOverlay || !dataBounds) return;
  imageBounds = computeImageBounds(
    dataBounds,
    config.imageWidthPx,
    config.imageHeightPx,
    config.imagePaddingPct,
    align
  );
  imageOverlay.setBounds(imageBounds);
  refreshMapConstraints();
  renderAlignValues();
  saveAlign(align);
}

function renderAlignValues() {
  alignUI.valLat.textContent = align.offsetLat.toFixed(6);
  alignUI.valLng.textContent = align.offsetLng.toFixed(6);
  alignUI.valSx .textContent = align.scaleX.toFixed(4);
  alignUI.valSy .textContent = align.scaleY.toFixed(4);
}

/* Shift the overlay. One base step ≈ 2.5 m at this latitude. */
function nudge(dir, big) {

  const latStep = (big ? 0.0002  : 0.00002);
  const lngStep = (big ? 0.00024 : 0.000024);
  if (dir === "up")    align.offsetLat += latStep;
  if (dir === "down")  align.offsetLat -= latStep;
  if (dir === "left")  align.offsetLng -= lngStep;
  if (dir === "right") align.offsetLng += lngStep;
  reapplyAlign();
}

/* Adjust X/Y scale by an additive step, clamped to [0.5, 2]. */
function scaleBy(axis, delta) {

  if (axis === "x") align.scaleX = Math.max(0.5, Math.min(2, align.scaleX + delta));
  if (axis === "y") align.scaleY = Math.max(0.5, Math.min(2, align.scaleY + delta));
  reapplyAlign();
}

function resetAlign() {
  align = { offsetLat: 0, offsetLng: 0, scaleX: 1, scaleY: 1 };
  reapplyAlign();
}

function toggleAlign(force) {
  alignMode = typeof force === "boolean" ? force : !alignMode;
  document.body.classList.toggle("align-mode", alignMode);
  alignUI.btn.classList.toggle("is-active", alignMode);
  alignUI.panel.hidden = !alignMode;
  if (imageOverlay) imageOverlay.setOpacity(alignMode ? 0.55 : 1);
  if (alignMode) renderAlignValues();
}

// Tiles are georeferenced by the XYZ grid, so the alignment tool only
// applies to single-image mode.
if (config.mapMode === "tiles") {

  if (alignUI.btn) {
    alignUI.btn.hidden = true;
  }
} else {
  alignUI.btn  .addEventListener("click", () => toggleAlign());
  alignUI.close.addEventListener("click", () => toggleAlign(false));
  alignUI.save .addEventListener("click", () => toggleAlign(false));
}

/* Copy the current alignment values as a config.js snippet. */
alignUI.copy.addEventListener("click", () => {
  const snippet =
`  imageOffsetLat: ${align.offsetLat.toFixed(6)},
  imageOffsetLng: ${align.offsetLng.toFixed(6)},
  imageScaleX:    ${align.scaleX.toFixed(4)},
  imageScaleY:    ${align.scaleY.toFixed(4)},`;
  const done = () => {
    alignUI.copy.classList.add("is-copied");
    alignUI.copy.textContent = "Copied ✓";
    setTimeout(() => {
      alignUI.copy.classList.remove("is-copied");
      alignUI.copy.textContent = "Copy config";
    }, 1400);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(snippet).then(done, () => fallback(snippet, done));
  } else {
    fallback(snippet, done);
  }
});
function fallback(text, cb) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); cb(); } catch (_) {}
  ta.remove();
}

alignUI.panel.addEventListener("click", (e) => {
  const nudgeBtn = e.target.closest("[data-nudge]");
  if (nudgeBtn) return nudge(nudgeBtn.dataset.nudge, e.shiftKey);

  const resetBtn = e.target.closest('[data-action="reset"]');
  if (resetBtn) return resetAlign();

  const scaleBtn = e.target.closest("[data-scale]");
  if (scaleBtn) {
    const [axis, sign] = [scaleBtn.dataset.scale[0], scaleBtn.dataset.scale[1]];
    const step = e.shiftKey ? 0.02 : 0.002;
    scaleBy(axis, sign === "+" ? step : -step);
  }
});

/* -----------------------------------------------------------
   Tour navigation buttons (desktop + mobile)
   ----------------------------------------------------------- */
if (el.tourPrev)       el.tourPrev.addEventListener("click",       tourPrevAction);
if (el.tourNext)       el.tourNext.addEventListener("click",       tourNextAction);
if (el.tourPrevMobile) el.tourPrevMobile.addEventListener("click", tourPrevAction);
if (el.tourNextMobile) el.tourNextMobile.addEventListener("click", tourNextAction);

/* -----------------------------------------------------------
   Street view wiring
   -----------------------------------------------------------
   - Explore CTA opens the viewer at the selected location's sweep.
   - Explorable list rows are wired inside renderExplorable().
   - Close button returns to the map.
   - Tapping the touch guard arms the 3D viewer for interaction.
   ----------------------------------------------------------- */

/* The dataset only carries the sweep id, so the latest entry is
   re-read here for the per-entry rotation / transitionTime (and in
   case the config changed since render). */
function handleExploreClick(e) {
  if (e) e.preventDefault();
  const btn = e && e.currentTarget;
  const name    = (btn && btn.dataset.locationName)  || "";
  const sweepId = (btn && btn.dataset.sweepId)       || "";

  const fresh = getTreedisEntry(name);
  const effectiveSweep = sweepId || (fresh && fresh.sweepId) || null;

  openStreetView(effectiveSweep, name, getCategory(name), {
    rotation:       (fresh && fresh.rotation)       || null,
    transitionTime: (fresh && fresh.transitionTime) || null
  });
}
if (el.exploreCta) el.exploreCta.addEventListener("click", handleExploreClick);

/* The desktop/iPad footer button forwards clicks to the canonical
   #exploreCta, whose dataset is kept in sync by renderDetails(). */
if (el.exploreCtaFooter && el.exploreCta) {
  el.exploreCtaFooter.addEventListener("click", (e) => {
    e.preventDefault();
    el.exploreCta.click();
  });
}

/* The VR button shows instructions for opening this location in a
   headset; it does not launch the 2D street view. */
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

    if (e.target.closest(".metabar-search")) return;

    if (e.target.closest("#searchBtn")) return;
    el.searchResults.hidden = true;
  });
}

/* Explore/Learn pill. setAppMode() toggles body.mode-learn, which
   swaps the visible shell via CSS. */
el.modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.modeBtns.forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });

    const mode = btn.dataset.mode;
    setAppMode(mode);
  });
});

window.addEventListener("resize", () => {
  scheduleMapRefresh({ delay: 80 });
});

/* Help button — simple info overlay. */
el.helpBtn.addEventListener("click", () => {
  alert(
    "SCSU Metaversity\n\n" +
    "• Tap or click a location on the map to see details.\n" +
    "• Use the list on the left to jump to tour stops.\n" +
    "• Arrow buttons step through the tour.\n" +
    "• Arrow keys ← / → also navigate the tour.\n" +
    "• Press Escape to close any open panel.\n\n" +
    "Image alignment:\n" +
    "• If the satellite image doesn't line up with the polygons,\n" +
    "  click ALIGN in the header (or press Shift+A) to enter\n" +
    "  alignment mode. Use the on-screen controls or arrow keys\n" +
    "  to nudge the image, then hit Save & close."
  );
});

/* Fullscreen toggle. */
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

/* -----------------------------------------------------------
   Keyboard shortcuts
   -----------------------------------------------------------
   Shift+A toggles the alignment tool. While it is open, arrows nudge
   and +/- scales. Otherwise arrows step the tour and Escape closes
   the topmost open panel (search, street view, drawer, selection).
   ----------------------------------------------------------- */
document.addEventListener("keydown", (e) => {
  // Inside form fields, only handle Escape for the search input.
  if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) {

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

  if ((e.key === "a" || e.key === "A") && e.shiftKey) {
    toggleAlign();
    e.preventDefault();
    return;
  }

  if (alignMode) {
    if (e.key === "ArrowUp")    { nudge("up",    e.shiftKey); e.preventDefault(); }
    if (e.key === "ArrowDown")  { nudge("down",  e.shiftKey); e.preventDefault(); }
    if (e.key === "ArrowLeft")  { nudge("left",  e.shiftKey); e.preventDefault(); }
    if (e.key === "ArrowRight") { nudge("right", e.shiftKey); e.preventDefault(); }
    if (e.key === "+" || e.key === "=") {
      scaleBy("x",  e.shiftKey ? 0.02 :  0.002);
      scaleBy("y",  e.shiftKey ? 0.02 :  0.002);
      e.preventDefault();
    }
    if (e.key === "-" || e.key === "_") {
      scaleBy("x", e.shiftKey ? -0.02 : -0.002);
      scaleBy("y", e.shiftKey ? -0.02 : -0.002);
      e.preventDefault();
    }
    if (e.key === "Escape") { toggleAlign(false); }
    return;
  }

  if (e.key === "ArrowRight")      { tourNextAction(); e.preventDefault(); }
  else if (e.key === "ArrowLeft")  { tourPrevAction(); e.preventDefault(); }
  else if (e.key === "Escape")     {
    if (isMobile() && el.metabarSearch.classList.contains("is-open")) {
      closeSearchPanel();
    } else if (streetViewActive) {

      closeStreetView();
    } else if (drawerOpen) {
      closeMobileLocations();
    } else {
      clearSelection();
    }
  }
});

/* Clicking bare map clears the selection. Skipped while the drawer is
   open (that tap closes the drawer) and while street view covers the
   map (stray events shouldn't dismiss the selection). */
map.on("click", (e) => {
  if (e.originalEvent.target.closest(".leaflet-interactive")) return;

  if (drawerOpen) { closeMobileLocations(); return; }

  if (streetViewActive) return;
  clearSelection();
});

