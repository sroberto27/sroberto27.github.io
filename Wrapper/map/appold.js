/* ===========================================================
   SCSU METAVERSITY — App
   -----------------------------------------------------------
   Data loading strategy:
     1. Try fetching the .geojson files (works over http://
        and https:// — i.e., once deployed on a website).
     2. If fetch fails (e.g., someone opens index.html
        directly from disk), fall back to window.SCSU_DATA
        which is populated by the data/*.js shim scripts.
   Either way the app ends up with the same data.
   =========================================================== */

const config = window.CAMPUS_CONFIG;

/* -----------------------------------------------------------
   1. Reprojection (EPSG:3857 meters → EPSG:4326 lat/lng)
   ----------------------------------------------------------- */
const EARTH_HALF_CIRC = 20037508.34;

function mercatorToLatLng(x, y) {
  const lng = (x / EARTH_HALF_CIRC) * 180;
  let lat = (y / EARTH_HALF_CIRC) * 180;
  lat = (180 / Math.PI) *
        (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function reprojectCoords(coords, crs) {
  if (crs !== "EPSG:3857") return coords;
  if (typeof coords[0] === "number") {
    return mercatorToLatLng(coords[0], coords[1]);
  }
  return coords.map((c) => reprojectCoords(c, crs));
}

function reprojectFC(fc, crs) {
  if (!fc || !Array.isArray(fc.features)) {
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      ...f,
      geometry: f.geometry
        ? { ...f.geometry,
            coordinates: reprojectCoords(f.geometry.coordinates, crs) }
        : null
    }))
  };
}

/* -----------------------------------------------------------
   2. Helpers
   ----------------------------------------------------------- */
function cleanName(name) {
  if (!name) return "";
  const cleaned = String(name).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase() === "none") return "";
  return cleaned;
}

function getCategory(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return config.categoryMap[k] || "CAMPUS";
}

function getDescription(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return config.descriptionMap[k] ||
         `${name} — more information about this location is coming soon.`;
}

/* -----------------------------------------------------------
   3. Leaflet map + panes
   ----------------------------------------------------------- */
const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  minZoom: 15,
  maxZoom: 20,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 120
});

L.control.zoom({ position: "topright" }).addTo(map);

map.createPane("imagePane");     map.getPane("imagePane").style.zIndex     = 200;
map.createPane("zonesPane");     map.getPane("zonesPane").style.zIndex     = 410;
map.createPane("buildingsPane"); map.getPane("buildingsPane").style.zIndex = 420;
map.createPane("toursPane");     map.getPane("toursPane").style.zIndex     = 430;
map.createPane("pinsPane");      map.getPane("pinsPane").style.zIndex      = 500;

/* -----------------------------------------------------------
   4. DOM refs
   ----------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const el = {
  splash:          $("splash"),
  app:             $("app"),
  shell:           document.querySelector(".shell"),

  helpBtn:         $("helpBtn"),
  fullscreenBtn:   $("fullscreenBtn"),

  locations:       $("locations"),
  locationsList:   $("locationsList"),
  locationsCount:  $("locationsCount"),
  locationsClose:  $("locationsClose"),
  locationsToggle: $("locationsToggle"),

  details:         $("details"),
  detailsClose:    $("detailsClose"),
  detailsTag:      $("detailsTag"),
  detailsTitle:    $("detailsTitle"),
  detailsSub:      $("detailsSub"),
  detailsBody:     $("detailsBody"),

  tourName:        $("tourName"),
  tourCurrent:     $("tourCurrent"),
  tourTotal:       $("tourTotal"),
  tourPrev:        $("tourPrev"),
  tourNext:        $("tourNext"),

  fitBtn:          $("fitBtn"),
  searchInput:     $("searchInput"),
  searchResults:   $("searchResults"),
  modeBtns:        document.querySelectorAll(".mode-btn")
};

/* -----------------------------------------------------------
   5. Styling helpers
   ----------------------------------------------------------- */
function styleFor(kind, props = {}) {
  const s = config.styles;
  if (kind === "building") return { ...s.buildings };
  if (kind === "tour")     return { ...s.tours };
  const override = props.color ? { color: props.color, fillColor: props.color } : {};
  return { ...s.zones, ...override };
}

function hoverStyleFor(kind, props = {}) {
  const s = config.styles;
  if (kind === "building") return { ...s.buildingsHover };
  if (kind === "tour")     return { ...s.toursHover };
  const override = props.color ? { color: props.color, fillColor: props.color } : {};
  return { ...s.zonesHover, ...override };
}

/* -----------------------------------------------------------
   6. State
   ----------------------------------------------------------- */
let imageBounds     = null;
let imageOverlay    = null; // kept so alignment tool can update it live
let dataBounds      = null;
let buildingsLayer  = null;
let toursLayer      = null;
let zonesLayer      = null;
let tourPinsLayer   = L.layerGroup([], { pane: "pinsPane" });

let selectedLayer = null;
let selectedKind  = null;

let tourStops  = []; // [{ feature, layer, marker, order }]
let tourIndex  = -1;
let allFeatures = [];

/* Image-alignment state. Loaded from localStorage first (so
   the user's tuning persists), then falls back to the values
   in config.js. */
const ALIGN_KEY = "scsu-map.align.v1";
function loadAlign() {
  const fromCfg = {
    offsetLat: config.imageOffsetLat || 0,
    offsetLng: config.imageOffsetLng || 0,
    scaleX:    config.imageScaleX    || 1,
    scaleY:    config.imageScaleY    || 1
  };
  try {
    const raw = localStorage.getItem(ALIGN_KEY);
    if (!raw) return fromCfg;
    const parsed = JSON.parse(raw);
    return { ...fromCfg, ...parsed };
  } catch (_) { return fromCfg; }
}
function saveAlign(a) {
  try { localStorage.setItem(ALIGN_KEY, JSON.stringify(a)); } catch (_) {}
}
let align = loadAlign();

/* -----------------------------------------------------------
   7. Details panel
   ----------------------------------------------------------- */
function openDetails()  {
  el.shell.classList.add("has-details");
  el.details.setAttribute("aria-hidden", "false");
  if (window.matchMedia("(max-width: 880px)").matches) {
    el.details.classList.add("is-open");
  }
}
function closeDetails() {
  el.shell.classList.remove("has-details");
  el.details.setAttribute("aria-hidden", "true");
  el.details.classList.remove("is-open");
}

function renderDetails(feature, kind) {
  const props = (feature && feature.properties) || {};
  const name = cleanName(props.name);

  el.detailsTag.textContent = (kind === "tour"     ? "TOUR STOP"
                            :  kind === "zone"     ? "HIGHLIGHT"
                            :  "CAMPUS BUILDING");

  el.detailsTitle.textContent = name || "—";
  el.detailsSub.textContent   = getCategory(name) || "—";
  el.detailsBody.textContent  = getDescription(name);
}

/* -----------------------------------------------------------
   8. Selection + focus
   ----------------------------------------------------------- */
function resetLayerStyle(layer, kind) {
  if (!layer || typeof layer.setStyle !== "function") return;
  layer.setStyle(styleFor(kind, layer.feature?.properties || {}));
}

function selectFeature(layer, kind, { focus = false } = {}) {
  if (selectedLayer && selectedLayer !== layer) {
    resetLayerStyle(selectedLayer, selectedKind);
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
    map.flyToBounds(layer.getBounds(), {
      padding: [80, 80],
      maxZoom: config.tour.focusZoom,
      duration: 0.55
    });
  }

  // Update the left-side locations list
  syncLocationsList();

  // Update tour index + pin highlight
  const idx = tourStops.findIndex((s) => s.layer === layer);
  tourIndex = idx;
  updateTourbar();
  highlightActivePin();
}

function clearSelection() {
  if (selectedLayer) resetLayerStyle(selectedLayer, selectedKind);
  selectedLayer = null;
  selectedKind  = null;
  tourIndex = -1;
  closeDetails();
  updateTourbar();
  highlightActivePin();
  syncLocationsList();
}

/* -----------------------------------------------------------
   9. Layer builders
   ----------------------------------------------------------- */
function bindEvents(feature, layer, kind) {
  const props = feature.properties || {};
  const label = cleanName(props.name);
  if (!label) return;

  if (config.ui.showBuildingTooltips || kind === "tour") {
    layer.bindTooltip(label, {
      direction: "top",
      className: "campus-label",
      sticky: false,
      opacity: 1
    });
  }

  layer.on({
    mouseover: () => {
      if (selectedLayer === layer) return;
      if (!config.ui.enableHoverPreview) return;
      layer.setStyle(hoverStyleFor(kind, props));
      if (layer.bringToFront) layer.bringToFront();
    },
    mouseout: () => {
      if (selectedLayer === layer) return;
      resetLayerStyle(layer, kind);
    },
    click: (e) => {
      L.DomEvent.stopPropagation(e);
      selectFeature(layer, kind, { focus: true });
    }
  });
}

function buildLayer(data, kind, paneName) {
  return L.geoJSON(data, {
    pane: paneName,
    style: (f) => styleFor(kind, f.properties || {}),
    onEachFeature: (f, l) => bindEvents(f, l, kind)
  });
}

/* -----------------------------------------------------------
   10. Image-bounds computation
   ----------------------------------------------------------- */
function computeImageBounds(b, imgPxW, imgPxH, padPct, align) {
  const s = b.getSouth(), n = b.getNorth();
  const w = b.getWest(),  e = b.getEast();
  const latC = (s + n) / 2;
  const lngC = (w + e) / 2;

  let heightDeg = n - s;
  let widthDeg  = e - w;

  const latScale = Math.cos((latC * Math.PI) / 180);
  const dataAspect = (widthDeg * latScale) / heightDeg;
  const imgAspect  = imgPxW / imgPxH;

  if (imgAspect > dataAspect) {
    widthDeg = (heightDeg * imgAspect) / latScale;
  } else {
    heightDeg = (widthDeg * latScale) / imgAspect;
  }

  widthDeg  *= 1 + padPct;
  heightDeg *= 1 + padPct;

  // Apply user-tunable alignment offsets + independent X/Y scale
  const a = align || {};
  const offLat = Number(a.offsetLat) || 0;
  const offLng = Number(a.offsetLng) || 0;
  const sx = Number.isFinite(a.scaleX) && a.scaleX > 0 ? a.scaleX : 1;
  const sy = Number.isFinite(a.scaleY) && a.scaleY > 0 ? a.scaleY : 1;

  widthDeg  *= sx;
  heightDeg *= sy;

  const cLat = latC + offLat;
  const cLng = lngC + offLng;

  return L.latLngBounds(
    [cLat - heightDeg / 2, cLng - widthDeg / 2],
    [cLat + heightDeg / 2, cLng + widthDeg / 2]
  );
}

/* -----------------------------------------------------------
   11. Tour pins (numbered circles over stops)
   ----------------------------------------------------------- */
function buildTourPins() {
  tourStops = [];

  toursLayer.eachLayer((layer) => {
    const f = layer.feature;
    const props = f.properties || {};
    const order = Number(props.order_num);
    if (!Number.isFinite(order)) return;

    let center;
    try { center = layer.getBounds().getCenter(); }
    catch (e) { return; }

    const icon = L.divIcon({
      className: "tour-pin-wrap",
      html: `<div class="tour-pin" data-order="${order}">${order}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const marker = L.marker(center, {
      icon,
      pane: "pinsPane",
      interactive: false,
      keyboard: false
    });
    tourPinsLayer.addLayer(marker);

    tourStops.push({ feature: f, layer, marker, order });
  });

  tourStops.sort((a, b) => a.order - b.order);
  el.tourTotal.textContent = tourStops.length;
  el.tourCurrent.textContent = 0;
  updateTourbar();
}

function highlightActivePin() {
  document.querySelectorAll(".tour-pin.is-active")
          .forEach((n) => n.classList.remove("is-active"));
  const stop = tourStops[tourIndex];
  if (!stop) return;
  const node = stop.marker.getElement()?.querySelector(".tour-pin");
  if (node) node.classList.add("is-active");
}

/* -----------------------------------------------------------
   12. Tourbar
   ----------------------------------------------------------- */
function updateTourbar() {
  if (tourIndex < 0 || !tourStops[tourIndex]) {
    el.tourName.textContent = tourStops.length
      ? "Start your tour"
      : "No stops configured";
    el.tourCurrent.textContent = tourIndex < 0 ? 0 : tourIndex + 1;
    el.tourPrev.disabled = true;
    el.tourNext.disabled = !tourStops.length;
    return;
  }
  const stop = tourStops[tourIndex];
  el.tourName.textContent = cleanName(stop.feature.properties.name);
  el.tourCurrent.textContent = tourIndex + 1;
  el.tourPrev.disabled = tourIndex === 0;
  el.tourNext.disabled = tourIndex === tourStops.length - 1;
}

function goToStop(i) {
  if (!tourStops.length) return;
  tourIndex = Math.max(0, Math.min(i, tourStops.length - 1));
  const stop = tourStops[tourIndex];
  selectFeature(stop.layer, "tour", { focus: true });
}

/* -----------------------------------------------------------
   13. Locations sidebar (Figma-style list)
   ----------------------------------------------------------- */
function syncLocationsList() {
  const rows = el.locationsList.querySelectorAll(".location-row");
  rows.forEach((r) => {
    const name = r.dataset.name || "";
    const active = selectedLayer &&
                   cleanName(selectedLayer.feature.properties.name).toLowerCase() === name;
    r.classList.toggle("is-active", !!active);
  });
}

function renderLocationsList() {
  el.locationsCount.textContent = tourStops.length;
  const rows = [];

  // "All locations" row — fits the map to the entire campus.
  rows.push(`
    <li class="location-row all-row" role="option" data-all="1">
      <div>
        <div class="location-name">All Locations</div>
        <div class="location-num">${tourStops.length} LOCATIONS</div>
      </div>
      <span class="location-chev">›</span>
    </li>
  `);

  tourStops.forEach((stop, i) => {
    const name = cleanName(stop.feature.properties.name);
    const cat = getCategory(name);
    rows.push(`
      <li class="location-row" role="option" data-name="${name.toLowerCase()}">
        <div>
          <div class="location-name">
            <span class="location-index">${i + 1}.</span>${name}
          </div>
          <div class="location-cat">${cat}</div>
        </div>
        <span class="location-chev">›</span>
      </li>
    `);
  });

  el.locationsList.innerHTML = rows.join("");

  el.locationsList.querySelectorAll(".location-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.dataset.all) {
        clearSelection();
        if (imageBounds) map.flyToBounds(imageBounds, { padding: [20, 20], duration: 0.5 });
        // On mobile, close the overlay after action
        closeMobileLocations();
        return;
      }
      const name = row.dataset.name;
      const stop = tourStops.find(
        (s) => cleanName(s.feature.properties.name).toLowerCase() === name
      );
      if (stop) {
        selectFeature(stop.layer, "tour", { focus: true });
        closeMobileLocations();
      }
    });
  });
}

/* -----------------------------------------------------------
   14. Mobile locations overlay
   ----------------------------------------------------------- */
const mqMobile = window.matchMedia("(max-width: 880px)");

function openMobileLocations()  { el.locations.classList.add("is-open"); }
function closeMobileLocations() {
  if (mqMobile.matches) el.locations.classList.remove("is-open");
}

el.locationsToggle.addEventListener("click", openMobileLocations);
el.locationsClose.addEventListener("click", closeMobileLocations);

/* -----------------------------------------------------------
   15. Search
   ----------------------------------------------------------- */
function renderSearch(q) {
  const term = q.trim().toLowerCase();
  if (!term) { el.searchResults.hidden = true; el.searchResults.innerHTML = ""; return; }

  const matches = allFeatures
    .filter((x) => {
      const n = cleanName(x.props.name).toLowerCase();
      return n && n.includes(term);
    })
    .slice(0, 12);

  if (!matches.length) {
    el.searchResults.hidden = false;
    el.searchResults.innerHTML =
      `<div class="search-empty">No matches for "${q}".</div>`;
    return;
  }

  el.searchResults.hidden = false;
  el.searchResults.innerHTML = matches.map((m, i) => `
    <div class="search-result" data-i="${i}" role="option">
      <span>${cleanName(m.props.name)}</span>
      <span class="tag ${m.kind}">${m.kind}</span>
    </div>
  `).join("");

  el.searchResults.querySelectorAll(".search-result").forEach((node) => {
    node.addEventListener("click", () => {
      const m = matches[Number(node.dataset.i)];
      if (!m) return;
      selectFeature(m.layer, m.kind, { focus: true });
      el.searchInput.value = cleanName(m.props.name);
      el.searchResults.hidden = true;
    });
  });
}

/* -----------------------------------------------------------
   16. Event wiring
   ----------------------------------------------------------- */

/* ------- IMAGE ALIGNMENT TOOL ------- */
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

/** Recompute bounds & push them to the live overlay. */
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
  map.setMaxBounds(imageBounds.pad(0.25));
  renderAlignValues();
  saveAlign(align);
}

function renderAlignValues() {
  alignUI.valLat.textContent = align.offsetLat.toFixed(6);
  alignUI.valLng.textContent = align.offsetLng.toFixed(6);
  alignUI.valSx .textContent = align.scaleX.toFixed(4);
  alignUI.valSy .textContent = align.scaleY.toFixed(4);
}

function nudge(dir, big) {
  // 1 base step ≈ ~2.5 m at this latitude (0.00002° lat, 0.00003° lng)
  const latStep = (big ? 0.0002  : 0.00002);
  const lngStep = (big ? 0.00024 : 0.000024);
  if (dir === "up")    align.offsetLat += latStep;
  if (dir === "down")  align.offsetLat -= latStep;
  if (dir === "left")  align.offsetLng -= lngStep;
  if (dir === "right") align.offsetLng += lngStep;
  reapplyAlign();
}

function scaleBy(axis, delta) {
  // delta is multiplicative factor, e.g. +0.002 or -0.002
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

alignUI.btn  .addEventListener("click", () => toggleAlign());
alignUI.close.addEventListener("click", () => toggleAlign(false));
alignUI.save .addEventListener("click", () => toggleAlign(false));

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

/* ------- Tour navigation buttons ------- */
el.tourPrev.addEventListener("click", () => goToStop(Math.max(0, tourIndex - 1)));
el.tourNext.addEventListener("click", () => {
  if (tourIndex < 0) return goToStop(0);
  goToStop(tourIndex + 1);
});

el.fitBtn.addEventListener("click", () => {
  if (imageBounds) map.flyToBounds(imageBounds, { padding: [20, 20], duration: 0.5 });
});

el.detailsClose.addEventListener("click", () => clearSelection());

if (el.searchInput) {
  el.searchInput.addEventListener("input", (e) => renderSearch(e.target.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) el.searchResults.hidden = true;
  });
}

el.modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.modeBtns.forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
  });
});

// Help button — simple info overlay for now
el.helpBtn.addEventListener("click", () => {
  alert(
    "SCSU Metaversity\n\n" +
    "• Tap or click a location on the map to see details.\n" +
    "• Use the list on the left to jump to tour stops.\n" +
    "• Arrow buttons at the bottom step through the tour.\n" +
    "• Arrow keys ← / → also navigate the tour.\n" +
    "• Press Escape to close any open panel.\n\n" +
    "Image alignment:\n" +
    "• If the satellite image doesn't line up with the polygons,\n" +
    "  click ALIGN in the header (or press Shift+A) to enter\n" +
    "  alignment mode. Use the on-screen controls or arrow keys\n" +
    "  to nudge the image, then hit Save & close."
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

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

  // Shift+A → toggle alignment tool
  if ((e.key === "a" || e.key === "A") && e.shiftKey) {
    toggleAlign();
    e.preventDefault();
    return;
  }

  // When alignment tool is open, arrow keys nudge the image, +/- scale
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

  // Otherwise: arrow keys drive the tour
  if (e.key === "ArrowRight") { el.tourNext.click(); e.preventDefault(); }
  else if (e.key === "ArrowLeft")  { el.tourPrev.click(); e.preventDefault(); }
  else if (e.key === "Escape")     { clearSelection(); closeMobileLocations(); }
});

// Clicking the bare map clears selection
map.on("click", (e) => {
  if (e.originalEvent.target.closest(".leaflet-interactive")) return;
  clearSelection();
});

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

/** Load all three datasets. Tries fetch first (works when the
 *  page is served over http/https) and falls back to the
 *  window.SCSU_DATA shim (works when opened from disk). */
async function loadAllData() {
  const [bFetch, tFetch, zFetch] = await Promise.all([
    tryFetchGeoJSON(config.dataFiles?.buildings || "data/buildings.geojson"),
    tryFetchGeoJSON(config.dataFiles?.tours     || "data/tours.geojson"),
    tryFetchGeoJSON(config.dataFiles?.zones     || "data/zones.geojson")
  ]);

  const fallback = window.SCSU_DATA || {};
  const empty = { type: "FeatureCollection", features: [] };

  const buildings = bFetch || fallback.buildings || empty;
  const tours     = tFetch || fallback.tours     || empty;
  const zones     = zFetch || fallback.zones     || empty;

  const source =
    (bFetch && tFetch && zFetch) ? "fetch (.geojson files)"
    : (bFetch || tFetch || zFetch) ? "mixed (fetch + shim)"
    : "shim (window.SCSU_DATA)";
  console.info(`[metaversity] data loaded via ${source}`);

  return { buildings, tours, zones };
}

async function boot() {
  const { buildings: rawB, tours: rawT, zones: rawZ } = await loadAllData();

  const buildingsGeo = reprojectFC(rawB, config.dataCRS);
  const toursGeo     = reprojectFC(rawT, config.dataCRS);
  const zonesGeo     = reprojectFC(rawZ, config.dataCRS);

  buildingsLayer = buildLayer(buildingsGeo, "building", "buildingsPane");
  toursLayer     = buildLayer(toursGeo,     "tour",     "toursPane");
  zonesLayer     = buildLayer(zonesGeo,     "zone",     "zonesPane");

  // Data extent (from all three layers combined)
  dataBounds = L.latLngBounds([]);
  [buildingsLayer, toursLayer, zonesLayer].forEach((l) => {
    try {
      const b = l.getBounds();
      if (b && b.isValid()) dataBounds.extend(b);
    } catch (_) {}
  });

  if (!dataBounds.isValid()) {
    console.warn("[metaversity] no valid geometry found; falling back");
    dataBounds = L.latLngBounds([33.494, -80.855], [33.502, -80.843]);
  }

  // Image bounds computed to match the image's native aspect
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

  map.setMaxBounds(imageBounds.pad(0.25));
  map.fitBounds(imageBounds, { padding: [20, 20] });

  // Add overlays (z-order: zones → buildings → tours)
  zonesLayer.addTo(map);
  buildingsLayer.addTo(map);
  toursLayer.addTo(map);

  // Tour pins
  buildTourPins();
  tourPinsLayer.addTo(map);

  // Locations list
  renderLocationsList();

  // Search index
  const push = (layer, kind) => {
    layer.eachLayer((lyr) => {
      const n = cleanName(lyr.feature.properties.name);
      if (n) allFeatures.push({ kind, layer: lyr, props: lyr.feature.properties });
    });
  };
  push(buildingsLayer, "building");
  push(toursLayer,     "tour");
  push(zonesLayer,     "zone");

  console.info("[metaversity] ready", {
    buildings: buildingsLayer.getLayers().length,
    tours:     toursLayer.getLayers().length,
    zones:     zonesLayer.getLayers().length
  });

  // Reveal app
  requestAnimationFrame(() => {
    el.app.setAttribute("aria-hidden", "false");
    el.app.classList.add("is-ready");
    el.splash.classList.add("is-hidden");
    setTimeout(() => { el.splash.style.display = "none"; }, 500);
  });
}

// Small delay so the splash is actually visible; also gives Leaflet
// time to measure its container.
setTimeout(() => {
  boot().catch((err) => {
    console.error("[metaversity] fatal:", err);
    el.splash.innerHTML =
      "<div style='font-family:monospace;padding:24px;color:#b91c1c;" +
      "text-align:center;max-width:480px'>" +
      "Failed to initialise the map:<br><br><code>" +
      String(err && err.message || err) + "</code></div>";
  });
}, 350);
