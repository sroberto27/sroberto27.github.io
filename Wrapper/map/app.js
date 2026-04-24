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

function getHappensHere(name) {
  if (!name) return [];
  const k = name.toLowerCase();
  const list = (config.happensHereMap || {})[k];
  return Array.isArray(list) ? list : [];
}

function getImage(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return (config.imageMap || {})[k] || "";
}

function getExplorable(name) {
  if (!name) return [];
  const k = name.toLowerCase();
  const list = (config.explorableMap || {})[k];
  return Array.isArray(list) ? list : [];
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -----------------------------------------------------------
   3. Leaflet map + panes
   ----------------------------------------------------------- */
const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  maxZoom: 20,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 120,
  maxBoundsViscosity: 1.0
});

L.control.zoom({ position: "topright" }).addTo(map);

map.createPane("imagePane");     map.getPane("imagePane").style.zIndex     = 200;
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
  searchBtn:       $("searchBtn"),

  locations:          $("locations"),
  locationsList:      $("locationsList"),
  locationsCount:     $("locationsCount"),
  locationsClose:     $("locationsClose"),
  locationsToggle:    $("locationsToggle"),
  locationsBackdrop:  $("locationsBackdrop"),

  details:         $("details"),
  detailsHandle:   $("detailsHandle"),
  detailsClose:    $("detailsClose"),
  detailsTag:      $("detailsTag"),
  detailsTitle:    $("detailsTitle"),
  detailsSub:      $("detailsSub"),
  detailsBody:     $("detailsBody"),

  // Metadata panel dynamic sections
  happensHereBlock: $("happensHereBlock"),
  chipsHere:        $("chipsHere"),
  explorableBlock:  $("explorableBlock"),
  subList:          $("subList"),
  detailsImage:     $("detailsImage"),

  // Desktop tour nav (inside sidebar footer)
  tourName:        $("tourName"),
  tourCurrent:     $("tourCurrent"),
  tourTotal:       $("tourTotal"),
  tourPrev:        $("tourPrev"),
  tourNext:        $("tourNext"),

  // Mobile tour nav (separate .tourbar at the bottom of viewport)
  tourNameMobile:    $("tourNameMobile"),
  tourCurrentMobile: $("tourCurrentMobile"),
  tourTotalMobile:   $("tourTotalMobile"),
  tourPrevMobile:    $("tourPrevMobile"),
  tourNextMobile:    $("tourNextMobile"),

  fitBtn:          $("fitBtn"),

  metabarSearch:   $("metabarSearch"),
  searchInput:     $("searchInput"),
  searchResults:   $("searchResults"),
  searchClear:     $("searchClear"),

  modeBtns:        document.querySelectorAll(".mode-btn")
};

const mqMobile = window.matchMedia("(max-width: 880px)");
function isMobile() { return mqMobile.matches; }

/* -----------------------------------------------------------
   5. Styling helpers
   ----------------------------------------------------------- */
function styleFor(kind) {
  const s = config.styles;
  if (kind === "building") return { ...s.buildings };
  if (kind === "tour")     return { ...s.tours };
  return { ...s.buildings };
}

function hoverStyleFor(kind) {
  const s = config.styles;
  if (kind === "building") return { ...s.buildingsHover };
  if (kind === "tour")     return { ...s.toursHover };
  return { ...s.buildingsHover };
}

/* -----------------------------------------------------------
   6. State
   ----------------------------------------------------------- */
let imageBounds     = null;
let imageOverlay    = null; // kept so alignment tool can update it live
let dataBounds      = null;
let buildingsLayer  = null;
let toursLayer      = null;
let tourPinsLayer   = L.layerGroup([], { pane: "pinsPane" });

let selectedLayer = null;
let selectedKind  = null;

let tourStops  = []; // [{ feature, layer, marker, order }]
let tourIndex  = -1;
let allFeatures = [];

/* Mobile drawer state. At any given time on mobile we can be in:
     - "map only"         (nothing open)
     - drawer open        (locations list visible)
     - details half       (bottom sheet covering ~half the screen)
     - details full       (bottom sheet covering the whole map area)
   The drawer and details are mutually exclusive. */
let drawerOpen   = false;
let detailsMode  = null; // null | "half" | "full"

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
   6a. Map constraints + refresh helpers
   ----------------------------------------------------------- */
function getCampusCoverZoom() {
  if (!imageBounds) return 15;
  return Math.min(map.getMaxZoom(), map.getBoundsZoom(imageBounds, true));
}

function refreshMapConstraints({ recenterIfNeeded = true } = {}) {
  if (!imageBounds) return;

  map.invalidateSize({ pan: false });

  const coverZoom = getCampusCoverZoom();
  const extraZoomOut = 0.75; // try 0.25, 0.5, 0.75, or 1.0
  const minAllowedZoom = Math.max(0, coverZoom - extraZoomOut);

  map.setMaxBounds(imageBounds);
  map.setMinZoom(minAllowedZoom);

  if (!recenterIfNeeded) return;

  if (map.getZoom() < minAllowedZoom) {
    map.setView(imageBounds.getCenter(), minAllowedZoom, { animate: false });
  } else {
    map.panInsideBounds(imageBounds, { animate: false });
  }
}

function getCampusOffsetCenter(zoom, offsetXPx = 0, offsetYPx = 60) {
  if (!imageBounds) return null;

  const baseCenter = imageBounds.getCenter();
  const projected = map.project(baseCenter, zoom);

  // Negative Y here makes the image appear lower on screen.
  const shifted = L.point(projected.x + offsetXPx, projected.y - offsetYPx);

  return map.unproject(shifted, zoom);
}

function resetCampusView(animate = false) {
  if (!imageBounds) return;

  refreshMapConstraints({ recenterIfNeeded: false });

  const zoom = getCampusCoverZoom();
  const center = getCampusOffsetCenter(zoom, 0, -230); // 600 px downward visual offset

  map.setView(center, zoom, { animate });
}

function scheduleMapRefresh({ recenterIfNeeded = true, delay = 0 } = {}) {
  clearTimeout(scheduleMapRefresh._t);
  scheduleMapRefresh._t = setTimeout(() => {
    refreshMapConstraints({ recenterIfNeeded });
  }, delay);
}

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

  el.detailsImage.classList.add("has-image");
  el.detailsImage.innerHTML =
    `<img src="${escapeHTML(src)}" alt="${escapeHTML(name)}" ` +
    `onerror="this.parentNode.classList.remove('has-image');` +
    `this.parentNode.innerHTML='&lt;div class=&quot;details-image-x&quot;&gt;&lt;/div&gt;` +
    `&lt;figcaption&gt;LOCATION IMAGE&lt;/figcaption&gt;'">`;
}

/* Render the "EXPLORABLE LOCATIONS" list. Hides the whole
   block if the list is empty. */
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
    .map((t) => `<li><span>${escapeHTML(t)}</span><span class="chev">›</span></li>`)
    .join("");
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

  renderHappensHere(name);
  renderExplorable(name);
  renderImage(name);
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
      layer.setStyle(hoverStyleFor(kind));
      if (layer.bringToFront) layer.bringToFront();
    },
    mouseout: () => {
      if (selectedLayer === layer) return;
      resetLayerStyle(layer, kind);
      if (layer.closeTooltip) layer.closeTooltip();
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
    style: () => styleFor(kind),
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
  setText(el.tourTotal,       tourStops.length);
  setText(el.tourTotalMobile, tourStops.length);
  setText(el.tourCurrent,       0);
  setText(el.tourCurrentMobile, 0);
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
   12. Tourbar (shared between desktop sidebar footer & mobile bar)
   ----------------------------------------------------------- */
function setText(node, value) { if (node) node.textContent = value; }

function updateTourbar() {
  if (tourIndex < 0 || !tourStops[tourIndex]) {
    const label = tourStops.length ? "Start your tour" : "No stops configured";
    setText(el.tourName,       label);
    setText(el.tourNameMobile, label);
    const cur = tourIndex < 0 ? 0 : tourIndex + 1;
    setText(el.tourCurrent,       cur);
    setText(el.tourCurrentMobile, cur);

    const prevDisabled = true;
    const nextDisabled = !tourStops.length;
    if (el.tourPrev)       el.tourPrev.disabled       = prevDisabled;
    if (el.tourNext)       el.tourNext.disabled       = nextDisabled;
    if (el.tourPrevMobile) el.tourPrevMobile.disabled = prevDisabled;
    if (el.tourNextMobile) el.tourNextMobile.disabled = nextDisabled;
    return;
  }
  const stop = tourStops[tourIndex];
  const name = cleanName(stop.feature.properties.name);
  setText(el.tourName,       name);
  setText(el.tourNameMobile, name);
  setText(el.tourCurrent,       tourIndex + 1);
  setText(el.tourCurrentMobile, tourIndex + 1);

  const prevDisabled = tourIndex === 0;
  const nextDisabled = tourIndex === tourStops.length - 1;
  if (el.tourPrev)       el.tourPrev.disabled       = prevDisabled;
  if (el.tourNext)       el.tourNext.disabled       = nextDisabled;
  if (el.tourPrevMobile) el.tourPrevMobile.disabled = prevDisabled;
  if (el.tourNextMobile) el.tourNextMobile.disabled = nextDisabled;
}

function goToStop(i) {
  if (!tourStops.length) return;
  tourIndex = Math.max(0, Math.min(i, tourStops.length - 1));
  const stop = tourStops[tourIndex];
  selectFeature(stop.layer, "tour", { focus: true });
}

function tourPrevAction() { goToStop(Math.max(0, tourIndex - 1)); }
function tourNextAction() {
  if (tourIndex < 0) return goToStop(0);
  goToStop(tourIndex + 1);
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
        if (imageBounds) resetCampusView(true);
        // On mobile, close the drawer after action
        closeMobileLocations();
        return;
      }
      const name = row.dataset.name;
      const stop = tourStops.find(
        (s) => cleanName(s.feature.properties.name).toLowerCase() === name
      );
      if (stop) {
        // On mobile, close the drawer BEFORE selecting so the map
        // has the full width to recenter with correct padding.
        closeMobileLocations({ silent: true });
        selectFeature(stop.layer, "tour", { focus: true });
      }
    });
  });
}

/* -----------------------------------------------------------
   14. Mobile locations drawer
   -----------------------------------------------------------
   The drawer slides in from the left, covering ~82% of the
   shell width. The remaining sliver of map behind it is dimmed
   by a backdrop that also tap-closes the drawer.

   Drawer and details are mutually exclusive.
   ----------------------------------------------------------- */
function openMobileLocations() {
  drawerOpen = true;
  el.locations.classList.add("is-open");
  el.locationsBackdrop.classList.add("is-open");
  el.shell.classList.add("drawer-open");

  // Mutually exclusive with details: close the bottom sheet first.
  if (el.details.classList.contains("is-open")) {
    clearSelection();
  }

  scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
}

function closeMobileLocations(opts = {}) {
  if (!isMobile() && !opts.force) {
    // On desktop the list is permanent; nothing to do.
    return;
  }
  drawerOpen = false;
  el.locations.classList.remove("is-open");
  el.locationsBackdrop.classList.remove("is-open");
  el.shell.classList.remove("drawer-open");

  scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
}

el.locationsToggle.addEventListener("click", () => {
  if (drawerOpen) closeMobileLocations();
  else openMobileLocations();
});
el.locationsClose.addEventListener("click", () => closeMobileLocations());
el.locationsBackdrop.addEventListener("click", () => closeMobileLocations());

/* -----------------------------------------------------------
   14a. Mobile details drag/slide
   -----------------------------------------------------------
   Ported from drag.html. The bottom sheet has two "snapped"
   states, "half" and "full", plus a transient "dragging" state
   where JS writes a live transform on the element. On release,
   the direction & distance of the drag decide which state to
   snap back to.
   ----------------------------------------------------------- */
let dragging  = false;
let dragStartY = 0;
let dragCurrY  = 0;
let dragStartMode = "half";

function onDetailsPointerDown(e) {
  if (!isMobile()) return;
  if (detailsMode !== "half" && detailsMode !== "full") return;

  dragging = true;
  dragStartY = e.clientY;
  dragCurrY  = e.clientY;
  dragStartMode = detailsMode;

  el.details.classList.add("is-dragging");
  try { el.detailsHandle.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
}

function onDetailsPointerMove(e) {
  if (!dragging || !isMobile()) return;
  dragCurrY = e.clientY;
  const delta = dragCurrY - dragStartY;

  // We only let the user drag in the "meaningful" direction for the
  // starting state. From "full", you can only pull down (delta>0).
  // From "half", you can either pull up to expand or down to dismiss.
  if (dragStartMode === "full") {
    el.details.style.transform = `translateY(${Math.max(0, delta)}px)`;
  } else if (dragStartMode === "half") {
    // Allow pull-up by up to 140px preview, pull-down unlimited.
    el.details.style.transform = `translateY(${Math.max(-140, delta)}px)`;
  }
}

function onDetailsPointerUp() {
  if (!dragging || !isMobile()) return;
  dragging = false;
  el.details.classList.remove("is-dragging");
  el.details.style.transform = "";

  const delta = dragCurrY - dragStartY;
  const THRESH = 40; // px of drag before we commit to a state change

  if (dragStartMode === "half") {
    if (delta < -THRESH) {
      setDetailsMode("full");
    } else if (delta > THRESH) {
      // Pulled down from half → dismiss entirely.
      clearSelection();
    } else {
      setDetailsMode("half");
    }
  } else if (dragStartMode === "full") {
    if (delta > THRESH) {
      setDetailsMode("half");
    } else {
      setDetailsMode("full");
    }
  }
}

el.detailsHandle.addEventListener("pointerdown", onDetailsPointerDown);
window.addEventListener("pointermove", onDetailsPointerMove);
window.addEventListener("pointerup",   onDetailsPointerUp);
window.addEventListener("pointercancel", onDetailsPointerUp);

/* Handle viewport changes. Switching from mobile → desktop (or vice
   versa) needs to reset panel state so the right CSS rules win. */
function handleViewportChange() {
  if (!isMobile()) {
    // On desktop: clear mobile-only state.
    drawerOpen = false;
    el.locations.classList.remove("is-open");
    el.locationsBackdrop.classList.remove("is-open");
    el.shell.classList.remove("drawer-open", "details-full");
    el.details.classList.remove("is-full", "is-hidden", "is-dragging");
    el.details.style.transform = "";
  } else {
    // On mobile: if details is open, restore the half state.
    if (el.shell.classList.contains("has-details")) {
      setDetailsMode("half");
    }
  }

  scheduleMapRefresh({ delay: 80 });
}
mqMobile.addEventListener?.("change", handleViewportChange);

/* -----------------------------------------------------------
   14b. Mobile search toggle
   ------------------------------------------------------------
   On desktop the search field lives permanently in the header,
   so the SEARCH button just focuses it. On mobile the search
   panel is hidden by default and the SEARCH button slides it
   in from under the header. The "x" button on the right of the
   field has two states:
     • if the input has text → clear the text
     • if empty              → close the whole panel
   ----------------------------------------------------------- */
function updateSearchBtnState() {
  if (!el.searchBtn) return;
  const open = el.metabarSearch.classList.contains("is-open");
  el.searchBtn.classList.toggle("is-active", open);
  el.searchBtn.setAttribute("aria-expanded", String(open));
}

function openSearchPanel() {
  el.metabarSearch.classList.add("is-open");
  // Let the DOM settle before focusing (avoids iOS keyboard flash)
  requestAnimationFrame(() => el.searchInput && el.searchInput.focus());
  updateSearchBtnState();
}

function closeSearchPanel() {
  el.metabarSearch.classList.remove("is-open");
  el.searchInput.value = "";
  el.searchResults.hidden = true;
  el.searchResults.innerHTML = "";
  refreshSearchClear();
  updateSearchBtnState();
}

function refreshSearchClear() {
  if (!el.searchClear) return;
  // Desktop: always hidden (the input behaves like a normal field).
  // Mobile : visible so the user can clear text or close the panel.
  if (isMobile()) {
    el.searchClear.hidden = false;
  } else {
    el.searchClear.hidden = true;
  }
}

if (el.searchBtn) {
  el.searchBtn.addEventListener("click", () => {
    if (isMobile()) {
      if (el.metabarSearch.classList.contains("is-open")) {
        closeSearchPanel();
      } else {
        openSearchPanel();
      }
    } else {
      // Desktop: just focus the field
      el.searchInput.focus();
      el.searchInput.select();
    }
  });
}

if (el.searchClear) {
  el.searchClear.addEventListener("click", () => {
    if (el.searchInput.value) {
      // First click with text → clear it
      el.searchInput.value = "";
      el.searchResults.hidden = true;
      el.searchResults.innerHTML = "";
      el.searchInput.focus();
    } else {
      // Second click with empty input → close the panel (mobile only)
      if (isMobile()) {
        closeSearchPanel();
      }
    }
  });
}

// Keep the clear-button visibility in sync with the viewport
mqMobile.addEventListener?.("change", refreshSearchClear);
refreshSearchClear();

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
      // On mobile, tucking the search away after a pick feels right
      if (isMobile()) closeSearchPanel();
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

/* ------- Tour navigation buttons (desktop + mobile) ------- */
if (el.tourPrev)       el.tourPrev.addEventListener("click",       tourPrevAction);
if (el.tourNext)       el.tourNext.addEventListener("click",       tourNextAction);
if (el.tourPrevMobile) el.tourPrevMobile.addEventListener("click", tourPrevAction);
if (el.tourNextMobile) el.tourNextMobile.addEventListener("click", tourNextAction);

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
  });
});

window.addEventListener("resize", () => {
  scheduleMapRefresh({ delay: 80 });
});

// Help button — simple info overlay for now
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
  if (e.key === "ArrowRight")      { tourNextAction(); e.preventDefault(); }
  else if (e.key === "ArrowLeft")  { tourPrevAction(); e.preventDefault(); }
  else if (e.key === "Escape")     {
    if (isMobile() && el.metabarSearch.classList.contains("is-open")) {
      closeSearchPanel();
    } else if (drawerOpen) {
      closeMobileLocations();
    } else {
      clearSelection();
    }
  }
});

// Clicking the bare map clears selection
map.on("click", (e) => {
  if (e.originalEvent.target.closest(".leaflet-interactive")) return;
  // Don't steal the tap that closes the drawer
  if (drawerOpen) { closeMobileLocations(); return; }
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

/** Load both datasets. Tries fetch first (works when the
 *  page is served over http/https) and falls back to the
 *  window.SCSU_DATA shim (works when opened from disk). */
async function loadAllData() {
  const [bFetch, tFetch] = await Promise.all([
    tryFetchGeoJSON(config.dataFiles?.buildings || "data/buildings.geojson"),
    tryFetchGeoJSON(config.dataFiles?.tours     || "data/tours.geojson")
  ]);

  const fallback = window.SCSU_DATA || {};
  const empty = { type: "FeatureCollection", features: [] };

  const buildings = bFetch || fallback.buildings || empty;
  const tours     = tFetch || fallback.tours     || empty;

  const source =
    (bFetch && tFetch) ? "fetch (.geojson files)"
    : (bFetch || tFetch) ? "mixed (fetch + shim)"
    : "shim (window.SCSU_DATA)";
  console.info(`[metaversity] data loaded via ${source}`);

  return { buildings, tours };
}

/* -----------------------------------------------------------
   Asset preloading — resolves when a URL is actually loaded.
   Used by boot() so the splash only hides after the satellite
   SVG, the building images, and (optionally) the Treedis
   iframe have finished loading.
   ----------------------------------------------------------- */
function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    // Resolve on both success and failure so one missing asset
    // can't soft-lock the splash forever.
    img.onload  = () => resolve();
    img.onerror = () => {
      console.warn("[metaversity] image failed to preload:", url);
      resolve();
    };
    img.src = url;
  });
}

function preloadAllImages() {
  const urls = [config.imageUrl];
  const imgMap = config.imageMap || {};
  for (const key in imgMap) {
    if (imgMap[key]) urls.push(imgMap[key]);
  }
  return Promise.all(urls.map(preloadImage));
}

/* Waits for Treedis TourReady, but gives up after `timeoutMs`
   so the splash still clears if Treedis is slow or offline.
   The iframe keeps loading in the background either way. */
function waitForTreedisReady(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (TourBridge.isReady) return resolve();
    const start = Date.now();
    const t = setInterval(() => {
      if (TourBridge.isReady) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        console.warn("[metaversity] Treedis not ready within "
          + timeoutMs + "ms — revealing app anyway");
        resolve();
      }
    }, 100);
  });
}

async function boot() {
  const { buildings: rawB, tours: rawT } = await loadAllData();

  const buildingsGeo = reprojectFC(rawB, config.dataCRS);
  const toursGeo     = reprojectFC(rawT, config.dataCRS);

  buildingsLayer = buildLayer(buildingsGeo, "building", "buildingsPane");
  toursLayer     = buildLayer(toursGeo,     "tour",     "toursPane");

  // Data extent (from both layers combined)
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

  resetCampusView(false);

  // Add overlays (z-order: buildings → tours)
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

  console.info("[metaversity] ready", {
    buildings: buildingsLayer.getLayers().length,
    tours:     toursLayer.getLayers().length
  });

  // Wait for real assets to finish loading before hiding the
  // splash. preloadAllImages() covers the satellite SVG and
  // every entry in config.imageMap. waitForTreedisReady() has
  // its own timeout so a slow iframe can't soft-lock us.
  await Promise.all([
    preloadAllImages(),
    waitForTreedisReady()
  ]);

  // Reveal app
  requestAnimationFrame(() => {
    el.app.setAttribute("aria-hidden", "false");
    el.app.classList.add("is-ready");
    el.splash.classList.add("is-hidden");
    // Keep this timeout — it matches the .4s CSS opacity
    // transition in mapstyles.css (.splash transition).
    setTimeout(() => { el.splash.style.display = "none"; }, 500);
    scheduleMapRefresh({ delay: 80 });
  });
}
}

// Kick off boot immediately. The splash now stays visible until
// the satellite image, building photos, and Treedis iframe have
// all finished loading (see the Promise.all at the end of boot).
boot().catch((err) => {
  console.error("[metaversity] fatal:", err);
  el.splash.innerHTML =
    "<div style='font-family:monospace;padding:24px;color:#b91c1c;" +
    "text-align:center;max-width:480px'>" +
    "Failed to initialise the map:<br><br><code>" +
    String(err && err.message || err) + "</code></div>";
});
