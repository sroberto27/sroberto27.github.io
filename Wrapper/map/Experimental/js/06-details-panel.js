/* === SCSU app — Part 6: Details panel + selection (sec 7, 8) === */
/* -----------------------------------------------------------
   7. Details panel
   ----------------------------------------------------------- */
function openDetails()  {
  el.shell.classList.add("has-details");
  el.details.setAttribute("aria-hidden", "false");

  if (isMobile()) {
    // Always open mutually-exclusive with drawer
    closeMobileLocations({ silent: true });
    setDetailsMode("half");
  }

  scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
}

function closeDetails() {
  el.shell.classList.remove("has-details");
  el.details.setAttribute("aria-hidden", "true");
  el.details.classList.remove("is-open", "is-full", "is-hidden", "is-dragging");
  el.details.style.transform = "";
  detailsMode = null;
  el.shell.classList.remove("details-full");

  scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
}

function setDetailsMode(next) {
  // next ∈ { "half", "full" }. On mobile, toggles the CSS state flags.
  if (!isMobile()) return;
  if (next !== "half" && next !== "full") return;

  detailsMode = next;
  el.details.classList.add("is-open");
  el.details.classList.toggle("is-full", next === "full");
  el.details.classList.remove("is-hidden", "is-dragging");
  el.details.style.transform = "";
  el.shell.classList.toggle("details-full", next === "full");

  scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
}

/* Render the "WHAT HAPPENS HERE?" chip row. Hides the whole
   block if the list is empty. */
function renderHappensHere(name) {
  const items = getHappensHere(name);
  if (!el.chipsHere || !el.happensHereBlock) return;

  if (!items.length) {
    el.happensHereBlock.hidden = true;
    el.chipsHere.innerHTML = "";
    return;
  }

  el.happensHereBlock.hidden = false;
  el.chipsHere.innerHTML = items
    .map((t) => `<span class="chip">${escapeHTML(t)}</span>`)
    .join("");
}

/* Render the location hero image. Falls back to the
   placeholder "X" frame if no image is mapped. */
function renderImage(name) {
  if (!el.detailsImage) return;
  const src = getImage(name);

  if (!src) {
    el.detailsImage.classList.remove("has-image");
    el.detailsImage.innerHTML =
      '<div class="details-image-x" aria-hidden="true"></div>' +
      '<figcaption>LOCATION IMAGE</figcaption>';
    return;
  }

  // Show the placeholder immediately so the panel's slide-in has a
  // simple box to render — then swap in the real <img> after the
  // current frame commits. Because the image is already in the
  // browser cache (preloaded on boot), this swap is effectively
  // instant and doesn't cause layout thrash during the panel's
  // transform animation.
  el.detailsImage.classList.remove("has-image");
  el.detailsImage.innerHTML =
    '<div class="details-image-x" aria-hidden="true"></div>' +
    '<figcaption>LOCATION IMAGE</figcaption>';

  requestAnimationFrame(() => {
    // Bail if the user has already navigated somewhere else.
    if (el.detailsImage.dataset.pendingSrc !== src) return;
    el.detailsImage.classList.add("has-image");
    el.detailsImage.innerHTML =
      `<img src="${escapeHTML(src)}" alt="${escapeHTML(name)}" ` +
      `onerror="this.parentNode.classList.remove('has-image');` +
      `this.parentNode.innerHTML='&lt;div class=&quot;details-image-x&quot;&gt;&lt;/div&gt;` +
      `&lt;figcaption&gt;LOCATION IMAGE&lt;/figcaption&gt;'">`;
  });
  el.detailsImage.dataset.pendingSrc = src;
}

/* Render the "EXPLORABLE LOCATIONS" list. Hides the whole
   block if the list is empty. Each row is clickable and — via
   the handler attached in renderDetails — opens the street view
   at that sub-location's sweep (falling back to the parent's
   view when the data isn't filled in yet). */
function renderExplorable(name) {
  const items = getExplorable(name);
  if (!el.subList || !el.explorableBlock) return;

  if (!items.length) {
    el.explorableBlock.hidden = true;
    el.subList.innerHTML = "";
    return;
  }

  el.explorableBlock.hidden = false;
  el.subList.innerHTML = items
    .map((t) => {
      const entry = getTreedisEntry(t);
      const hasSweep = !!(entry && entry.sweepId);
      // Rows without a sweep get a subtle "pending" class so they
      // still look clickable but signal that data is on the way.
      const pendingCls = hasSweep ? "" : " is-pending";
      return `<li class="sub-row${pendingCls}" role="button" tabindex="0" ` +
             `data-sub="${escapeHTML(t)}">` +
             `<span>${escapeHTML(t)}</span>` +
             `<span class="chev">›</span></li>`;
    })
    .join("");

  // Wire click handlers — the enclosing renderDetails knows the
  // parent building name, so we read it off dataset there.
  const parentName = el.subList.dataset.parent || "";
  el.subList.querySelectorAll(".sub-row").forEach((li) => {
    const handler = () => {
      const sub = li.dataset.sub;
      openSubLocationInStreetView(parentName, sub);
    };
    li.addEventListener("click", handler);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    });
  });
}

function renderDetails(feature, kind) {
  const props = (feature && feature.properties) || {};
  const name = cleanName(props.name);

  el.detailsTag.textContent = (kind === "tour"
                                 ? "TOUR STOP"
                                 : "CAMPUS BUILDING");

  el.detailsTitle.textContent = name || "—";
  el.detailsSub.textContent   = getCategory(name) || "—";
  el.detailsBody.textContent  = getDescription(name);

  // Stash the parent name so the explorable list's click handlers
  // know which building they belong to.
  if (el.subList) el.subList.dataset.parent = name || "";

  renderHappensHere(name);
  renderExplorable(name);
  renderImage(name);

  // Annotate the Explore CTA with the current location so the
  // single button click handler (wired once, further down) knows
  // where to navigate.
  if (el.exploreCta) {
    const entry = getTreedisEntry(name);
    el.exploreCta.dataset.locationName = name || "";
    el.exploreCta.dataset.sweepId = (entry && entry.sweepId) || "";
    // Keep the button enabled even without a sweep so users can
    // still open the viewer at its current position; the handler
    // logs a warning for missing data.
    el.exploreCta.classList.toggle(
      "is-pending", !(entry && entry.sweepId)
    );
    // Mirror the pending-state visual onto the desktop/iPad
    // persistent footer button so it stays in sync with the
    // canonical #exploreCta inside the scrolling content area.
    if (el.exploreCtaFooter) {
      el.exploreCtaFooter.classList.toggle(
        "is-pending", !(entry && entry.sweepId)
      );
    }
  }
  if (el.vrBtn) {
    const entry = getTreedisEntry(name);
    el.vrBtn.dataset.locationName = name || "";
    el.vrBtn.dataset.sweepId = (entry && entry.sweepId) || "";
  }
}

/* -----------------------------------------------------------
   8. Selection + focus
   ----------------------------------------------------------- */
function resetLayerStyle(layer, kind) {
  if (!layer || typeof layer.setStyle !== "function") return;
  layer.setStyle(styleFor(kind));
}

/* Compute the padding to use when flying to a selected feature.
   On mobile, the details sheet covers roughly the bottom half of
   the shell area, so we inflate the *bottom* padding so that the
   feature's center ends up in the visible upper half of the map. */
function focusPaddingFor(layer) {
  if (!isMobile()) return { padding: [80, 80] };

  const shell = el.shell;
  const shellH = shell ? shell.clientHeight : 600;
  // matches --mobile-half-h (46dvh of the whole viewport)
  // We need the portion of the shell that will be covered, roughly.
  const panelH = Math.round(window.innerHeight * 0.46);
  const bottomPad = Math.min(Math.max(panelH, 140), shellH - 80);

  return {
    paddingTopLeft:     [24, 24],
    paddingBottomRight: [24, bottomPad]
  };
}

function selectFeature(layer, kind, { focus = false } = {}) {
  if (selectedLayer && selectedLayer !== layer) {
    resetLayerStyle(selectedLayer, selectedKind);
    if (selectedLayer.closeTooltip) selectedLayer.closeTooltip();
  }
  selectedLayer = layer;
  selectedKind  = kind;

  if (selectedLayer && typeof selectedLayer.setStyle === "function") {
    selectedLayer.setStyle({ ...config.styles.selected });
    if (selectedLayer.bringToFront) selectedLayer.bringToFront();
  }

  renderDetails(layer.feature, kind);
  openDetails();
  if (layer.openTooltip) layer.openTooltip();

  if (focus && layer.getBounds) {
    const fitOpts = {
      ...focusPaddingFor(layer),
      maxZoom: config.tour.focusZoom,
      duration: 0.55
    };
    // Let the layout settle before flying so Leaflet measures the
    // latest shell width after the details panel state changes.
    const fly = () => {
      refreshMapConstraints({ recenterIfNeeded: false });
      map.flyToBounds(layer.getBounds(), fitOpts);
    };
    if (isMobile()) {
      requestAnimationFrame(() => requestAnimationFrame(fly));
    } else {
      requestAnimationFrame(fly);
    }
  }

  // Update the left-side locations list
  syncLocationsList();

  // Update tour index + pin highlight
  const idx = tourStops.findIndex((s) => s.layer === layer);
  tourIndex = idx;
  updateTourbar();
  highlightActivePin();

  // If the user is currently inside the street view, also move
  // the Treedis camera to the newly-selected location. This makes
  // the left Locations list / tour arrows / search results all
  // drive the 3D experience while it's open, per the spec.
  if (streetViewActive) {
    navigateStreetViewToLayer(layer);
  }
}

function clearSelection() {
  if (selectedLayer) {
    resetLayerStyle(selectedLayer, selectedKind);
    if (selectedLayer.closeTooltip) selectedLayer.closeTooltip();
  }

  selectedLayer = null;
  selectedKind  = null;
  tourIndex = -1;
  closeDetails();
  // Closing the details panel also closes the street view — without
  // a selected building there's nothing to drive the 3D view.
  if (streetViewActive) closeStreetView();
  updateTourbar();
  highlightActivePin();
  syncLocationsList();
}

