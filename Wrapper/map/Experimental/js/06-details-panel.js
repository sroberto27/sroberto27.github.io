/* === Details panel + selection === */

/* -----------------------------------------------------------
   Details panel
   ----------------------------------------------------------- */
function openDetails()  {
  el.shell.classList.add("has-details");
  el.details.setAttribute("aria-hidden", "false");

  if (isMobile()) {

    // Mutually exclusive with the mobile drawer.
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

/* Mobile only: snap the bottom sheet to "half" or "full". */
function setDetailsMode(next) {

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

/* Render the "WHAT HAPPENS HERE?" chip row; hides the block when the
   list is empty. */
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

/* Render the location hero image, falling back to the placeholder frame
   when no image is mapped. The placeholder is shown first and the real
   <img> is swapped in on the next frame — images are preloaded at boot,
   so the swap is instant and avoids layout thrash during the panel's
   slide-in animation. */
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

  el.detailsImage.classList.remove("has-image");
  el.detailsImage.innerHTML =
    '<div class="details-image-x" aria-hidden="true"></div>' +
    '<figcaption>LOCATION IMAGE</figcaption>';

  requestAnimationFrame(() => {

    // Bail if the user has already navigated elsewhere.
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

/* Render the "EXPLORABLE LOCATIONS" list; hides the block when empty.
   Each row opens street view at that sub-location's sweep. Rows without
   a sweep get an "is-pending" class — still clickable, falling back to
   the parent's view. */
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

      const pendingCls = hasSweep ? "" : " is-pending";
      return `<li class="sub-row${pendingCls}" role="button" tabindex="0" ` +
             `data-sub="${escapeHTML(t)}">` +
             `<span>${escapeHTML(t)}</span>` +
             `<span class="chev">›</span></li>`;
    })
    .join("");

  // Parent building name is stashed on the list by renderDetails().
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

/* Render the address block and "Open in Maps" links. Hidden entirely
   when no address is configured. When present, renders:
     - the address line (selectable text)
     - a Google Maps link (all platforms)
     - an Apple Maps link (iOS/macOS only)
     - a geo: URI link (Android/iOS only — the OS app chooser lets the
       user pick their preferred map app) */
function renderAddress(name) {
  if (!el.addressBlock || !el.detailsAddress || !el.detailsAddressLinks) return;

  const addr = getAddress(name);
  if (!addr) {
    el.addressBlock.hidden = true;
    el.detailsAddress.textContent = "";
    el.detailsAddressLinks.innerHTML = "";
    return;
  }

  el.addressBlock.hidden = false;
  el.detailsAddress.textContent = addr;

  const q = encodeURIComponent(addr);
  const ua = navigator.userAgent || "";
  const isIOS     = /iPhone|iPad|iPod/.test(ua);
  const isMacOS   = /Macintosh/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile  = isIOS || isAndroid;

  const links = [];

  // Google Maps — works in every browser.
  links.push(
    `<a class="address-link address-link-google" ` +
    `href="https://www.google.com/maps/search/?api=1&query=${q}" ` +
    `target="_blank" rel="noopener noreferrer" ` +
    `aria-label="Open ${escapeHTML(addr)} in Google Maps">` +
    `<span class="address-link-icon" aria-hidden="true">🗺️</span>` +
    `Google Maps</a>`
  );

  // Apple Maps — only on Apple platforms where it actually opens.
  if (isIOS || isMacOS) {
    links.push(
      `<a class="address-link address-link-apple" ` +
      `href="https://maps.apple.com/?q=${q}" ` +
      `target="_blank" rel="noopener noreferrer" ` +
      `aria-label="Open ${escapeHTML(addr)} in Apple Maps">` +
      `<span class="address-link-icon" aria-hidden="true">🍎</span>` +
      `Apple Maps</a>`
    );
  }

  // geo: URI — skipped on desktop where it does nothing useful.
  if (isMobile) {
    links.push(
      `<a class="address-link address-link-native" ` +
      `href="geo:0,0?q=${q}" ` +
      `aria-label="Open ${escapeHTML(addr)} in your preferred map app">` +
      `<span class="address-link-icon" aria-hidden="true">📍</span>` +
      `Open in Maps</a>`
    );
  }

  el.detailsAddressLinks.innerHTML = links.join("");
}

function renderDetails(feature, kind) {
  const props = (feature && feature.properties) || {};
  const name = cleanName(props.name);
  const isOffCampus = !!props.off_campus;
  const offCampusDistance = props.off_campus_distance || "";

  if (isOffCampus) {
    el.detailsTag.textContent = "OFF-CAMPUS STOP";
    el.detailsTag.classList.add("is-offcampus");
  } else {
    el.detailsTag.textContent = (kind === "tour"
                                   ? "TOUR STOP"
                                   : "CAMPUS BUILDING");
    el.detailsTag.classList.remove("is-offcampus");
  }

  el.detailsTitle.textContent = name || "—";

  // Subtitle shows the occupying department(s); falls back to the
  // category so the row never reads as an empty line.
  const depts = getDepartments(name);
  el.detailsSub.textContent = depts.length
    ? depts.join("; ")
    : (getCategory(name) || "—");

  el.detailsBody.textContent  = getDescription(name);

  // Off-campus notice above the description, created lazily. Tells the
  // user the site isn't represented on the campus map.
  let note = document.getElementById("detailsOffCampusNote");
  if (isOffCampus) {
    if (!note && el.detailsBody && el.detailsBody.parentNode) {
      note = document.createElement("div");
      note.id = "detailsOffCampusNote";
      note.className = "details-offcampus-note";
      el.detailsBody.parentNode.insertBefore(note, el.detailsBody);
    }
    if (note) {
      const distLine = offCampusDistance
        ? ` Approximately <strong>${offCampusDistance}</strong>.`
        : "";
      note.innerHTML =
        `<span class="offcampus-icon" aria-hidden="true">📍</span>` +
        `<span><strong>Off-campus location.</strong> ` +
        `This site isn't shown on the campus map.${distLine} ` +
        `Use <strong>Explore</strong> to open the virtual tour.</span>`;
    }
  } else if (note && note.parentNode) {
    note.parentNode.removeChild(note);
  }

  // Stash the parent name for the explorable list's click handlers.
  if (el.subList) el.subList.dataset.parent = name || "";

  renderHappensHere(name);
  renderExplorable(name);
  renderAddress(name);
  renderImage(name);

  // The Explore CTA and VR controls are shown only when the location
  // has a real Treedis sweep; otherwise the panel becomes an info-only
  // card. Four elements are toggled so the mobile inline layout and the
  // desktop/iPad footer stay in sync. A dedicated class
  // (.is-hidden-no-sweep, with !important — see 04-map-details.css) is
  // used instead of the hidden attribute because explicit display rules
  // on these elements would override it.
  const sweepAvailable = hasSweep(name);

  if (el.exploreCta) {
    const entry = getTreedisEntry(name);
    el.exploreCta.dataset.locationName = name || "";
    el.exploreCta.dataset.sweepId = (entry && entry.sweepId) || "";
    el.exploreCta.classList.toggle("is-hidden-no-sweep", !sweepAvailable);
  }
  if (el.exploreCtaFooter) {
    el.exploreCtaFooter.classList.toggle("is-hidden-no-sweep", !sweepAvailable);
  }
  if (el.vrInline) {
    el.vrInline.classList.toggle("is-hidden-no-sweep", !sweepAvailable);
  }
  if (el.detailsFooter) {
    el.detailsFooter.classList.toggle("is-hidden-no-sweep", !sweepAvailable);
  }
  if (el.vrBtn) {
    const entry = getTreedisEntry(name);
    el.vrBtn.dataset.locationName = name || "";
    el.vrBtn.dataset.sweepId = (entry && entry.sweepId) || "";
  }
}

/* -----------------------------------------------------------
   Selection + focus
   ----------------------------------------------------------- */
function resetLayerStyle(layer, kind) {
  if (!layer || typeof layer.setStyle !== "function") return;
  layer.setStyle(styleFor(kind, layer.feature));
}

/* Padding used when flying to a selected feature. On mobile the details
   sheet covers roughly the bottom half, so bottom padding is inflated
   to keep the feature in the visible upper half. */
function focusPaddingFor(layer) {
  if (!isMobile()) return { padding: [80, 80] };

  const shell = el.shell;
  const shellH = shell ? shell.clientHeight : 600;

  // Matches --mobile-half-h (46dvh of the viewport).
  const panelH = Math.round(window.innerHeight * 0.46);
  const bottomPad = Math.min(Math.max(panelH, 140), shellH - 80);

  return {
    paddingTopLeft:     [24, 24],
    paddingBottomRight: [24, bottomPad]
  };
}

/* Select a feature: restyle it, render + open the details panel, sync
   the sidebar / tour bar / pins, and (optionally) fly the map to it.
   While street view is open, the selection also drives the 3D camera. */
function selectFeature(layer, kind, { focus = false } = {}) {
  if (selectedLayer && selectedLayer !== layer) {
    resetLayerStyle(selectedLayer, selectedKind);
    if (selectedLayer.closeTooltip) selectedLayer.closeTooltip();
  }
  selectedLayer = layer;
  selectedKind  = kind;

  const isOffCampus = isOffCampusFeature(layer && layer.feature);

  if (selectedLayer && typeof selectedLayer.setStyle === "function") {
    selectedLayer.setStyle(selectedStyleFor(layer && layer.feature));
    if (selectedLayer.bringToFront) selectedLayer.bringToFront();
  }

  renderDetails(layer.feature, kind);
  openDetails();
  if (layer.openTooltip) layer.openTooltip();

  // Normal fly-to. The RAF settle lets the layout finish so Leaflet
  // measures the post-panel-open shell width before flying.
  if (focus && layer.getBounds && !isOffCampus) {
    const fitOpts = {
      ...focusPaddingFor(layer),
      maxZoom: config.tour.focusZoom,
      duration: 0.55
    };

    const fly = () => {
      refreshMapConstraints({ recenterIfNeeded: false });
      map.flyToBounds(layer.getBounds(), fitOpts);
    };
    if (isMobile()) {
      requestAnimationFrame(() => requestAnimationFrame(fly));
    } else {
      requestAnimationFrame(fly);
    }
  // Off-campus stops carry only a directional placeholder polygon at
  // the campus edge; flying to it would be disorienting. Reset to the
  // full campus view instead so the arrow toward the real site is
  // visible. Skipped inside street view, where no map is visible.
  } else if (focus && isOffCampus && !streetViewActive && imageBounds) {

    const reset = () => {
      refreshMapConstraints({ recenterIfNeeded: false });
      resetCampusView(true);
    };
    if (isMobile()) {
      requestAnimationFrame(() => requestAnimationFrame(reset));
    } else {
      requestAnimationFrame(reset);
    }
  }

  syncLocationsList();

  const idx = tourStops.findIndex((s) => s.layer === layer);
  tourIndex = idx;
  updateTourbar();
  highlightActivePin();

  // Keep the 3D view in sync so list/search/tour navigation drives
  // Treedis while street view is open.
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

  // Without a selected building there is nothing to drive the 3D view.
  if (streetViewActive) closeStreetView();
  updateTourbar();
  highlightActivePin();
  syncLocationsList();
}
