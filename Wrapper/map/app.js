const config = window.CAMPUS_CONFIG;

const EARTH_HALF_CIRC = 20037508.34;

function mercatorToLatLng(x, y) {
  const lng = (x / EARTH_HALF_CIRC) * 180;
  let lat = (y / EARTH_HALF_CIRC) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
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
        ? { ...f.geometry, coordinates: reprojectCoords(f.geometry.coordinates, crs) }
        : null
    }))
  };
}

function cleanName(name) {
  if (!name) return "";
  const cleaned = String(name).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase() === "none") return "";
  return cleaned;
}

function getCategory(name) {
  if (!name) return "";
  return config.categoryMap[name.toLowerCase()] || "CAMPUS";
}

function getDescription(name) {
  if (!name) return "";
  return config.descriptionMap[name.toLowerCase()] || `${name} — more information about this location is coming soon.`;
}

const DETAILS_META = {
  "south carolina state university bookstore": {
    tags: ["TEXTBOOKS", "APPAREL", "SUPPLIES"],
    rooms: ["Main store", "Textbook counter", "Campus merchandise"]
  },
  "nance hall": {
    tags: ["MATH & SCIENCE", "RESEARCH LABS", "FACULTY OFFICES"],
    rooms: ["General lecture", "Research labs", "Faculty suite"]
  },
  "s-h-m memorial square": {
    tags: ["MEMORIAL", "HISTORY", "CAMPUS LANDMARK"],
    rooms: ["Central square", "Memorial area", "Outdoor gathering space"]
  },
  "oliver c. dawson stadium": {
    tags: ["ATHLETICS", "GAME DAY", "EVENTS"],
    rooms: ["Field view", "Seating bowl", "Entry concourse"]
  },
  "kirkland w. green student center": {
    tags: ["STUDENT LIFE", "DINING", "MEETING ROOMS"],
    rooms: ["Student lounge", "Dining area", "Meeting spaces"]
  }
};

function getDetailMeta(name) {
  const key = String(name || "").toLowerCase();
  if (DETAILS_META[key]) return DETAILS_META[key];
  const cat = getCategory(name);
  return {
    tags: [cat || "CAMPUS", "TOUR STOP"],
    rooms: ["Main entrance", "Interior tour", "Campus overview"]
  };
}

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  minZoom: 15,
  maxZoom: 20,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 120,
  zoomAnimation: true,
  fadeAnimation: true,
  markerZoomAnimation: true
});

L.control.zoom({ position: "topright" }).addTo(map);

map.createPane("imagePane");
map.getPane("imagePane").style.zIndex = 200;
map.createPane("zonesPane");
map.getPane("zonesPane").style.zIndex = 410;
map.createPane("buildingsPane");
map.getPane("buildingsPane").style.zIndex = 420;
map.createPane("toursPane");
map.getPane("toursPane").style.zIndex = 430;
map.createPane("pinsPane");
map.getPane("pinsPane").style.zIndex = 500;

const $ = (id) => document.getElementById(id);

const el = {
  splash: $("splash"),
  app: $("app"),
  shell: document.querySelector(".shell"),
  metabar: document.querySelector(".metabar"),
  modeToggle: document.querySelector(".mode-toggle"),

  desktopSearchSlot: document.querySelector(".metabar-search-slot"),
  mobileSearchBar: $("mobileSearchBar"),
  searchWrap: $("searchWrap"),
  searchInput: $("searchInput"),
  searchResults: $("searchResults"),
  searchClose: $("searchClose"),
  searchToggleBtn: $("searchToggleBtn"),

  helpBtn: $("helpBtn"),
  fullscreenBtn: $("fullscreenBtn"),
  alignBtn: $("alignBtn"),

  locations: $("locations"),
  locationsList: $("locationsList"),
  locationsCount: $("locationsCount"),
  locationsToggle: $("locationsToggle"),
  locationsClose: $("locationsClose"),

  details: $("details"),
  detailsHandle: $("detailsHandle"),
  detailsClose: $("detailsClose"),
  detailsTag: $("detailsTag"),
  detailsTitle: $("detailsTitle"),
  detailsSub: $("detailsSub"),
  detailsBody: $("detailsBody"),
  chipsHere: $("chipsHere"),
  subList: $("subList"),
  exploreCta: $("exploreCta"),
  vrBtn: $("vrBtn"),

  fitBtn: $("fitBtn"),
  modeBtns: document.querySelectorAll(".mode-btn"),

  tourbar: $("tourbar"),
  tourPrev: $("tourPrev"),
  tourNext: $("tourNext"),
  tourName: $("tourName"),
  tourCurrent: $("tourCurrent"),
  tourTotal: $("tourTotal"),

  sideTourPrev: $("sideTourPrev"),
  sideTourNext: $("sideTourNext"),
  sideTourName: $("sideTourName"),
  sideTourCurrent: $("sideTourCurrent"),
  sideTourTotal: $("sideTourTotal"),

  alignPanel: $("alignPanel"),
  alignClose: $("alignClose"),
  alignCopy: $("alignCopy"),
  alignSave: $("alignSave"),
  valLat: $("valLat"),
  valLng: $("valLng"),
  valSx: $("valSx"),
  valSy: $("valSy")
};

const mqMobile = window.matchMedia("(max-width: 880px)");

let imageBounds = null;
let imageOverlay = null;
let dataBounds = null;
let buildingsLayer = null;
let toursLayer = null;
let zonesLayer = null;
let tourPinsLayer = L.layerGroup([], { pane: "pinsPane" });

let selectedLayer = null;
let selectedKind = null;
let tourStops = [];
let tourIndex = -1;
let allFeatures = [];
let mobileSearchOpen = false;
let mobileSheetState = "hidden";
let alignMode = false;
let initialCampusZoom = null;
let refreshTimer = null;

const ALIGN_KEY = "scsu-map.align.v1";

function loadAlign() {
  const fromCfg = {
    offsetLat: config.imageOffsetLat || 0,
    offsetLng: config.imageOffsetLng || 0,
    scaleX: config.imageScaleX || 1,
    scaleY: config.imageScaleY || 1
  };
  try {
    const raw = localStorage.getItem(ALIGN_KEY);
    if (!raw) return fromCfg;
    return { ...fromCfg, ...JSON.parse(raw) };
  } catch {
    return fromCfg;
  }
}

function saveAlign(align) {
  try {
    localStorage.setItem(ALIGN_KEY, JSON.stringify(align));
  } catch {}
}

let align = loadAlign();

function isMobile() {
  return mqMobile.matches;
}

function queueMapRefresh(delay = 40) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    map.invalidateSize({ pan: false });
  }, delay);
}

function fillChips(container, values) {
  container.innerHTML = "";
  values.forEach((value) => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = value;
    container.appendChild(span);
  });
}

function fillRooms(container, values) {
  container.innerHTML = "";
  values.forEach((value) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${value}</span><span class="chev">›</span>`;
    container.appendChild(li);
  });
}

function moveSearchWrap() {
  if (isMobile()) {
    if (el.searchWrap.parentElement !== el.mobileSearchBar) {
      el.mobileSearchBar.appendChild(el.searchWrap);
    }
  } else if (el.searchWrap.parentElement !== el.desktopSearchSlot) {
    el.desktopSearchSlot.appendChild(el.searchWrap);
  }
}

function setMobileSearch(open, { focus = false } = {}) {
  if (!isMobile()) {
    mobileSearchOpen = false;
    el.mobileSearchBar.classList.remove("is-open");
    el.mobileSearchBar.setAttribute("aria-hidden", "true");
    el.searchToggleBtn.classList.remove("is-active");
    el.searchToggleBtn.setAttribute("aria-expanded", "false");
    return;
  }

  mobileSearchOpen = !!open;
  el.mobileSearchBar.classList.toggle("is-open", mobileSearchOpen);
  el.mobileSearchBar.setAttribute("aria-hidden", String(!mobileSearchOpen));
  el.searchToggleBtn.classList.toggle("is-active", mobileSearchOpen);
  el.searchToggleBtn.setAttribute("aria-expanded", String(mobileSearchOpen));

  if (!mobileSearchOpen) {
    el.searchResults.hidden = true;
  }

  queueMapRefresh(260);
  if (mobileSearchOpen && focus) {
    requestAnimationFrame(() => el.searchInput.focus());
  }
}

function syncSearchPlacement() {
  moveSearchWrap();
  if (!isMobile()) {
    mobileSearchOpen = false;
    el.mobileSearchBar.classList.remove("is-open");
    el.mobileSearchBar.setAttribute("aria-hidden", "true");
    el.searchToggleBtn.classList.remove("is-active");
    el.searchToggleBtn.setAttribute("aria-expanded", "false");
  }
}

function styleFor(kind, props = {}) {
  if (kind === "building") return { ...config.styles.buildings };
  if (kind === "tour") return { ...config.styles.tours };
  const override = props.color ? { color: props.color, fillColor: props.color } : {};
  return { ...config.styles.zones, ...override };
}

function hoverStyleFor(kind, props = {}) {
  if (kind === "building") return { ...config.styles.buildingsHover };
  if (kind === "tour") return { ...config.styles.toursHover };
  const override = props.color ? { color: props.color, fillColor: props.color } : {};
  return { ...config.styles.zonesHover, ...override };
}

function openDetailsPanel() {
  if (isMobile()) {
    if (!selectedLayer) return;
    if (mobileSheetState === "hidden") mobileSheetState = "peek";
    applyMobileSheetState();
    return;
  }
  el.shell.classList.add("has-details");
  el.details.setAttribute("aria-hidden", "false");
  queueMapRefresh(260);
}

function dismissDetailsPanel() {
  if (isMobile()) {
    mobileSheetState = "hidden";
    applyMobileSheetState();
    return;
  }
  el.shell.classList.remove("has-details");
  el.details.setAttribute("aria-hidden", "true");
  queueMapRefresh(260);
}

function clearSelection() {
  if (selectedLayer && typeof selectedLayer.setStyle === "function") {
    selectedLayer.setStyle(styleFor(selectedKind, selectedLayer.feature?.properties || {}));
  }
  selectedLayer = null;
  selectedKind = null;
  tourIndex = -1;
  dismissDetailsPanel();
  updateTourbar();
  highlightActivePin();
  syncLocationsList();
}

function renderDetails(feature, kind) {
  const props = (feature && feature.properties) || {};
  const name = cleanName(props.name);
  const meta = getDetailMeta(name);

  el.detailsTag.textContent = kind === "tour" ? "TOUR STOP" : kind === "zone" ? "HIGHLIGHT ZONE" : "CAMPUS BUILDING";
  el.detailsTitle.textContent = name || "—";
  el.detailsSub.textContent = getCategory(name) || "—";
  el.detailsBody.textContent = getDescription(name);
  fillChips(el.chipsHere, meta.tags || []);
  fillRooms(el.subList, meta.rooms || []);
}

function resetLayerStyle(layer, kind) {
  if (!layer || typeof layer.setStyle !== "function") return;
  layer.setStyle(styleFor(kind, layer.feature?.properties || {}));
}

function focusLayer(layer) {
  if (!layer || !layer.getBounds) return;
  const bounds = layer.getBounds();
  if (!bounds || !bounds.isValid()) return;
  const padFactor = selectedKind === "tour" ? (isMobile() ? 2.35 : 2.9) : (isMobile() ? 0.9 : 1.35);
  const target = bounds.pad(padFactor);
  const padding = isMobile() ? [28, 28] : [70, 70];
  const maxZoom = Math.min(config.tour.focusZoom || 18, isMobile() ? 17.5 : 18);
  map.flyToBounds(target, {
    padding,
    maxZoom,
    duration: 0.55
  });
}

function selectFeature(layer, kind, { focus = false } = {}) {
  if (selectedLayer && selectedLayer !== layer) {
    resetLayerStyle(selectedLayer, selectedKind);
  }

  selectedLayer = layer;
  selectedKind = kind;

  if (selectedLayer && typeof selectedLayer.setStyle === "function") {
    selectedLayer.setStyle({ ...config.styles.selected });
    if (selectedLayer.bringToFront) selectedLayer.bringToFront();
  }

  renderDetails(layer.feature, kind);
  openDetailsPanel();
  if (layer.openTooltip) layer.openTooltip();
  if (focus) focusLayer(layer);

  const idx = tourStops.findIndex((stop) => stop.layer === layer);
  tourIndex = idx;
  updateTourbar();
  highlightActivePin();
  syncLocationsList();
}

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
      if (selectedLayer === layer || !config.ui.enableHoverPreview) return;
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
      closeMobileLocations();
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

function computeImageBounds(b, imgPxW, imgPxH, padPct, alignState) {
  const s = b.getSouth();
  const n = b.getNorth();
  const w = b.getWest();
  const e = b.getEast();
  const latC = (s + n) / 2;
  const lngC = (w + e) / 2;

  let heightDeg = n - s;
  let widthDeg = e - w;

  const latScale = Math.cos((latC * Math.PI) / 180);
  const dataAspect = (widthDeg * latScale) / heightDeg;
  const imgAspect = imgPxW / imgPxH;

  if (imgAspect > dataAspect) {
    widthDeg = (heightDeg * imgAspect) / latScale;
  } else {
    heightDeg = (widthDeg * latScale) / imgAspect;
  }

  widthDeg *= 1 + padPct;
  heightDeg *= 1 + padPct;

  const offLat = Number(alignState.offsetLat) || 0;
  const offLng = Number(alignState.offsetLng) || 0;
  const sx = Number.isFinite(alignState.scaleX) && alignState.scaleX > 0 ? alignState.scaleX : 1;
  const sy = Number.isFinite(alignState.scaleY) && alignState.scaleY > 0 ? alignState.scaleY : 1;

  widthDeg *= sx;
  heightDeg *= sy;

  const cLat = latC + offLat;
  const cLng = lngC + offLng;

  return L.latLngBounds(
    [cLat - heightDeg / 2, cLng - widthDeg / 2],
    [cLat + heightDeg / 2, cLng + widthDeg / 2]
  );
}

function getPrimaryCampusBounds() {
  if (toursLayer) {
    try {
      const tb = toursLayer.getBounds();
      if (tb && tb.isValid()) return tb;
    } catch {}
  }
  return dataBounds;
}

function getCampusFrameBounds() {
  const base = getPrimaryCampusBounds();
  if (!base || !base.isValid()) return dataBounds;
  return base.pad(isMobile() ? 0.12 : 0.08);
}

function fitCampusFrame({ animate = true } = {}) {
  const bounds = getCampusFrameBounds();
  if (!bounds || !bounds.isValid()) return;

  const padding = isMobile() ? L.point(16, 16) : L.point(22, 22);
  const zoom = map.getBoundsZoom(bounds, false, padding);
  initialCampusZoom = zoom;
  map.setMinZoom(Math.max(15, zoom - 0.25));

  if (animate) {
    map.flyTo(bounds.getCenter(), zoom, { duration: 0.5 });
  } else {
    map.setView(bounds.getCenter(), zoom, { animate: false });
  }
}

function buildTourPins() {
  tourStops = [];
  tourPinsLayer.clearLayers();

  toursLayer.eachLayer((layer) => {
    const props = layer.feature?.properties || {};
    const order = Number(props.order_num);
    if (!Number.isFinite(order)) return;

    let center;
    try {
      center = layer.getBounds().getCenter();
    } catch {
      return;
    }

    const icon = L.divIcon({
      className: "tour-pin-wrap",
      html: `<div class="tour-pin" data-order="${order}">${order}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker(center, {
      icon,
      pane: "pinsPane",
      interactive: false,
      keyboard: false
    });

    tourPinsLayer.addLayer(marker);
    tourStops.push({ feature: layer.feature, layer, marker, order });
  });

  tourStops.sort((a, b) => a.order - b.order);
}

function highlightActivePin() {
  document.querySelectorAll(".tour-pin.is-active").forEach((node) => node.classList.remove("is-active"));
  const stop = tourStops[tourIndex];
  if (!stop) return;
  const pin = stop.marker.getElement()?.querySelector(".tour-pin");
  if (pin) pin.classList.add("is-active");
}

function updateTourbar() {
  const targets = [
    {
      prev: el.tourPrev,
      next: el.tourNext,
      name: el.tourName,
      current: el.tourCurrent,
      total: el.tourTotal
    },
    {
      prev: el.sideTourPrev,
      next: el.sideTourNext,
      name: el.sideTourName,
      current: el.sideTourCurrent,
      total: el.sideTourTotal
    }
  ];

  targets.forEach((ui) => {
    ui.total.textContent = tourStops.length;

    if (tourIndex < 0 || !tourStops[tourIndex]) {
      ui.name.textContent = tourStops.length ? "Start your tour" : "No stops configured";
      ui.current.textContent = 0;
      ui.prev.disabled = true;
      ui.next.disabled = !tourStops.length;
      return;
    }

    const stop = tourStops[tourIndex];
    ui.name.textContent = cleanName(stop.feature.properties.name);
    ui.current.textContent = tourIndex + 1;
    ui.prev.disabled = tourIndex === 0;
    ui.next.disabled = tourIndex === tourStops.length - 1;
  });
}

function goToStop(index) {
  if (!tourStops.length) return;
  tourIndex = Math.max(0, Math.min(index, tourStops.length - 1));
  const stop = tourStops[tourIndex];
  selectFeature(stop.layer, "tour", { focus: true });
}

function syncLocationsList() {
  el.locationsList.querySelectorAll(".location-row[data-name]").forEach((row) => {
    const rowName = row.dataset.name || "";
    const activeName = selectedLayer ? cleanName(selectedLayer.feature.properties.name).toLowerCase() : "";
    row.classList.toggle("is-active", !!activeName && activeName === rowName);
  });
}

function renderLocationsList() {
  el.locationsCount.textContent = tourStops.length;

  const rows = [
    `<li class="location-row all-row" role="option" data-all="1">
      <div class="location-main">
        <div class="location-name"><span class="label-desktop">Campus Map</span><span class="label-mobile">All Locations</span></div>
        <div class="location-num">${tourStops.length} LOCATIONS</div>
      </div>
      <span class="location-chev">›</span>
    </li>`
  ];

  tourStops.forEach((stop, idx) => {
    const name = cleanName(stop.feature.properties.name);
    const cat = getCategory(name);
    rows.push(
      `<li class="location-row" role="option" data-name="${name.toLowerCase()}">
        <div class="location-main">
          <div class="location-name"><span class="location-index">${idx + 1}.</span>${name}</div>
          <div class="location-cat">${cat}</div>
        </div>
        <span class="location-chev">›</span>
      </li>`
    );
  });

  el.locationsList.innerHTML = rows.join("");

  el.locationsList.querySelectorAll(".location-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.dataset.all) {
        clearSelection();
        fitCampusFrame();
        closeMobileLocations();
        return;
      }

      const stop = tourStops.find((item) => cleanName(item.feature.properties.name).toLowerCase() === row.dataset.name);
      if (stop) {
        selectFeature(stop.layer, "tour", { focus: true });
        closeMobileLocations();
      }
    });
  });
}

function openMobileLocations() {
  if (!isMobile()) return;
  setMobileSearch(false);
  el.locations.classList.add("is-open");
}

function closeMobileLocations() {
  if (!isMobile()) return;
  el.locations.classList.remove("is-open");
}

function renderSearch(query) {
  const term = query.trim().toLowerCase();
  if (!term) {
    el.searchResults.hidden = true;
    el.searchResults.innerHTML = "";
    return;
  }

  const seen = new Set();
  const matches = allFeatures
    .filter((item) => {
      const name = cleanName(item.props.name).toLowerCase();
      return name && name.includes(term);
    })
    .filter((item) => {
      const key = `${item.kind}:${cleanName(item.props.name).toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  if (!matches.length) {
    el.searchResults.hidden = false;
    el.searchResults.innerHTML = `<div class="search-empty">No matches for "${query}".</div>`;
    return;
  }

  el.searchResults.hidden = false;
  el.searchResults.innerHTML = matches.map((item, idx) => `
    <div class="search-result" data-i="${idx}" role="option">
      <span>${cleanName(item.props.name)}</span>
      <span class="tag ${item.kind}">${item.kind}</span>
    </div>
  `).join("");

  el.searchResults.querySelectorAll(".search-result").forEach((node) => {
    node.addEventListener("click", () => {
      const match = matches[Number(node.dataset.i)];
      if (!match) return;
      selectFeature(match.layer, match.kind, { focus: true });
      el.searchInput.value = cleanName(match.props.name);
      el.searchResults.hidden = true;
      closeMobileLocations();
      if (isMobile()) setMobileSearch(false);
    });
  });
}

function getPeekHeight() {
  return Math.min(Math.max(280, Math.round(window.innerHeight * 0.38)), 340);
}

function getFullSheetHeight() {
  const top = (el.metabar?.offsetHeight || 0) + (el.mobileSearchBar?.offsetHeight || 0) + (el.modeToggle?.offsetHeight || 0);
  const bottom = el.tourbar ? el.tourbar.offsetHeight : (el.tourPrev.closest(".tourbar")?.offsetHeight || 0);
  return Math.max(getPeekHeight() + 80, Math.round(window.innerHeight - top - bottom));
}

function applyMobileSheetState() {
  if (!isMobile()) {
    el.details.classList.remove("is-open", "sheet-peek", "sheet-full");
    el.details.style.removeProperty("height");
    return;
  }

  const open = !!selectedLayer && mobileSheetState !== "hidden";
  el.details.classList.toggle("is-open", open);
  el.details.classList.toggle("sheet-peek", open && mobileSheetState === "peek");
  el.details.classList.toggle("sheet-full", open && mobileSheetState === "full");
  el.details.setAttribute("aria-hidden", String(!open));

  if (!open) {
    el.details.style.removeProperty("height");
    queueMapRefresh(260);
    return;
  }

  el.details.style.height = `${mobileSheetState === "full" ? getFullSheetHeight() : getPeekHeight()}px`;
  queueMapRefresh(260);
}

const sheetDrag = {
  active: false,
  startY: 0,
  startHeight: 0,
  currentHeight: 0
};

function onSheetPointerDown(e) {
  if (!isMobile() || !selectedLayer) return;
  sheetDrag.active = true;
  sheetDrag.startY = e.clientY;
  sheetDrag.startHeight = el.details.getBoundingClientRect().height || getPeekHeight();
  sheetDrag.currentHeight = sheetDrag.startHeight;
  el.details.style.transition = "none";
  el.detailsHandle.setPointerCapture?.(e.pointerId);
}

function onSheetPointerMove(e) {
  if (!sheetDrag.active || !isMobile()) return;
  const delta = sheetDrag.startY - e.clientY;
  const nextHeight = Math.max(0, Math.min(getFullSheetHeight(), sheetDrag.startHeight + delta));
  sheetDrag.currentHeight = nextHeight;
  el.details.style.height = `${nextHeight}px`;
}

function onSheetPointerUp() {
  if (!sheetDrag.active || !isMobile()) return;
  sheetDrag.active = false;
  el.details.style.transition = "";

  const peek = getPeekHeight();
  const full = getFullSheetHeight();
  const h = sheetDrag.currentHeight;

  if (h < peek * 0.56) {
    mobileSheetState = "hidden";
  } else if (h > (peek + full) / 2) {
    mobileSheetState = "full";
  } else {
    mobileSheetState = "peek";
  }

  applyMobileSheetState();
}

function renderAlignValues() {
  el.valLat.textContent = align.offsetLat.toFixed(6);
  el.valLng.textContent = align.offsetLng.toFixed(6);
  el.valSx.textContent = align.scaleX.toFixed(4);
  el.valSy.textContent = align.scaleY.toFixed(4);
}

function reapplyAlign() {
  if (!imageOverlay || !dataBounds) return;
  imageBounds = computeImageBounds(dataBounds, config.imageWidthPx, config.imageHeightPx, config.imagePaddingPct, align);
  imageOverlay.setBounds(imageBounds);
  map.setMaxBounds(imageBounds.pad(0.14));
  renderAlignValues();
  saveAlign(align);
}

function nudge(dir, big) {
  const latStep = big ? 0.0002 : 0.00002;
  const lngStep = big ? 0.00024 : 0.000024;
  if (dir === "up") align.offsetLat += latStep;
  if (dir === "down") align.offsetLat -= latStep;
  if (dir === "left") align.offsetLng -= lngStep;
  if (dir === "right") align.offsetLng += lngStep;
  reapplyAlign();
}

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
  el.alignBtn?.classList.toggle("is-active", alignMode);
  el.alignPanel.hidden = !alignMode;
  if (imageOverlay) imageOverlay.setOpacity(alignMode ? 0.6 : 1);
  if (alignMode) renderAlignValues();
}

function waitWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}

function waitFontsReady() {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve();
  return document.fonts.ready.catch(() => {});
}

function waitOverlayReady(overlay) {
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    overlay.once("load", done);
    overlay.once("error", done);
    setTimeout(done, 5000);
  });
}

function waitForMapPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        map.invalidateSize({ pan: false });
        resolve();
      }, 120);
    });
  });
}

async function tryFetchGeoJSON(url) {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return null;
    const ct = response.headers.get("content-type") || "";
    if (ct.includes("text/html")) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function loadAllData() {
  const [bFetch, tFetch, zFetch] = await Promise.all([
    tryFetchGeoJSON(config.dataFiles?.buildings || "data/buildings.geojson"),
    tryFetchGeoJSON(config.dataFiles?.tours || "data/tours.geojson"),
    tryFetchGeoJSON(config.dataFiles?.zones || "data/zones.geojson")
  ]);

  const fallback = window.SCSU_DATA || {};
  const empty = { type: "FeatureCollection", features: [] };

  return {
    buildings: bFetch || fallback.buildings || empty,
    tours: tFetch || fallback.tours || empty,
    zones: zFetch || fallback.zones || empty
  };
}

function handleSearchClose() {
  if (el.searchInput.value.trim()) {
    el.searchInput.value = "";
    renderSearch("");
    el.searchInput.focus();
    return;
  }

  if (isMobile()) {
    setMobileSearch(false);
  } else {
    el.searchInput.blur();
    el.searchResults.hidden = true;
  }
}

function handleExploreAction() {
  if (!selectedLayer) return;
  if (isMobile()) {
    mobileSheetState = "full";
    applyMobileSheetState();
  }
  focusLayer(selectedLayer);
}

function registerStaticEvents() {
  el.locationsToggle.addEventListener("click", openMobileLocations);
  el.locationsClose.addEventListener("click", closeMobileLocations);

  el.searchToggleBtn.addEventListener("click", () => {
    if (isMobile()) {
      closeMobileLocations();
      setMobileSearch(!mobileSearchOpen, { focus: !mobileSearchOpen });
      return;
    }
    el.searchInput.focus();
    el.searchInput.select();
  });

  el.searchClose.addEventListener("click", handleSearchClose);
  el.searchInput.addEventListener("input", (e) => renderSearch(e.target.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#searchWrap") && !e.target.closest("#searchToggleBtn")) {
      el.searchResults.hidden = true;
    }
  });

  el.fitBtn.addEventListener("click", () => fitCampusFrame());
  el.detailsClose.addEventListener("click", dismissDetailsPanel);
  el.exploreCta.addEventListener("click", handleExploreAction);
  el.vrBtn.addEventListener("click", handleExploreAction);

  [el.tourPrev, el.sideTourPrev].forEach((btn) => btn.addEventListener("click", () => goToStop(Math.max(0, tourIndex - 1))));
  [el.tourNext, el.sideTourNext].forEach((btn) => btn.addEventListener("click", () => {
    if (tourIndex < 0) {
      goToStop(0);
      return;
    }
    goToStop(tourIndex + 1);
  }));

  el.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.modeBtns.forEach((node) => {
        const active = node === btn;
        node.classList.toggle("is-active", active);
        node.setAttribute("aria-selected", String(active));
      });
    });
  });

  el.helpBtn.addEventListener("click", () => {
    alert(
      "SCSU Metaversity\n\n" +
      "• Use the list or map to open a location.\n" +
      "• Use the arrows to move through the tour stops.\n" +
      "• On mobile, tap SEARCH to open the search bar.\n" +
      "• Drag the details panel up or down on mobile.\n\n" +
      "Alignment tool:\n" +
      "• Press Shift+A or use ALIGN on desktop.\n" +
      "• Nudge the satellite image until it lines up with the polygons."
    );
  });

  el.fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  el.alignBtn?.addEventListener("click", () => toggleAlign());
  el.alignClose.addEventListener("click", () => toggleAlign(false));
  el.alignSave.addEventListener("click", () => toggleAlign(false));
  el.alignCopy.addEventListener("click", () => {
    const snippet = `  imageOffsetLat: ${align.offsetLat.toFixed(6)},\n  imageOffsetLng: ${align.offsetLng.toFixed(6)},\n  imageScaleX:    ${align.scaleX.toFixed(4)},\n  imageScaleY:    ${align.scaleY.toFixed(4)},`;
    const complete = () => {
      el.alignCopy.classList.add("is-copied");
      el.alignCopy.textContent = "Copied ✓";
      setTimeout(() => {
        el.alignCopy.classList.remove("is-copied");
        el.alignCopy.textContent = "Copy config";
      }, 1400);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(snippet).then(complete, () => fallbackCopy(snippet, complete));
    } else {
      fallbackCopy(snippet, complete);
    }
  });

  el.alignPanel.addEventListener("click", (e) => {
    const nudgeBtn = e.target.closest("[data-nudge]");
    if (nudgeBtn) return nudge(nudgeBtn.dataset.nudge, e.shiftKey);

    const resetBtn = e.target.closest('[data-action="reset"]');
    if (resetBtn) return resetAlign();

    const scaleBtn = e.target.closest("[data-scale]");
    if (!scaleBtn) return;
    const [axis, sign] = [scaleBtn.dataset.scale[0], scaleBtn.dataset.scale[1]];
    const step = e.shiftKey ? 0.02 : 0.002;
    scaleBy(axis, sign === "+" ? step : -step);
  });

  el.detailsHandle.addEventListener("pointerdown", onSheetPointerDown);
  window.addEventListener("pointermove", onSheetPointerMove);
  window.addEventListener("pointerup", onSheetPointerUp);
  window.addEventListener("pointercancel", onSheetPointerUp);

  document.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

    if ((e.key === "a" || e.key === "A") && e.shiftKey) {
      toggleAlign();
      e.preventDefault();
      return;
    }

    if (alignMode) {
      if (e.key === "ArrowUp") { nudge("up", e.shiftKey); e.preventDefault(); }
      if (e.key === "ArrowDown") { nudge("down", e.shiftKey); e.preventDefault(); }
      if (e.key === "ArrowLeft") { nudge("left", e.shiftKey); e.preventDefault(); }
      if (e.key === "ArrowRight") { nudge("right", e.shiftKey); e.preventDefault(); }
      if (e.key === "+" || e.key === "=") {
        scaleBy("x", e.shiftKey ? 0.02 : 0.002);
        scaleBy("y", e.shiftKey ? 0.02 : 0.002);
        e.preventDefault();
      }
      if (e.key === "-" || e.key === "_") {
        scaleBy("x", e.shiftKey ? -0.02 : -0.002);
        scaleBy("y", e.shiftKey ? -0.02 : -0.002);
        e.preventDefault();
      }
      if (e.key === "Escape") toggleAlign(false);
      return;
    }

    if (e.key === "ArrowRight") {
      if (tourIndex < 0) goToStop(0);
      else goToStop(tourIndex + 1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      goToStop(Math.max(0, tourIndex - 1));
      e.preventDefault();
    } else if (e.key === "Escape") {
      dismissDetailsPanel();
      closeMobileLocations();
      setMobileSearch(false);
    }
  });

  const refreshLayout = () => {
    syncSearchPlacement();
    closeMobileLocations();
    if (!isMobile()) {
      mobileSheetState = "hidden";
      el.details.style.removeProperty("height");
      el.details.classList.remove("is-open", "sheet-peek", "sheet-full");
      el.details.setAttribute("aria-hidden", el.shell.classList.contains("has-details") ? "false" : "true");
    } else if (selectedLayer && mobileSheetState === "hidden") {
      mobileSheetState = "peek";
      applyMobileSheetState();
    } else {
      applyMobileSheetState();
    }

    queueMapRefresh(40);
    setTimeout(() => {
      map.invalidateSize({ pan: false });
      if (!selectedLayer) fitCampusFrame({ animate: false });
      else if (!isMobile() && el.shell.classList.contains("has-details")) focusLayer(selectedLayer);
    }, 80);
  };

  window.addEventListener("resize", refreshLayout);
  mqMobile.addEventListener?.("change", refreshLayout);
}

function fallbackCopy(text, callback) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    callback();
  } catch {}
  ta.remove();
}

async function boot() {
  registerStaticEvents();
  syncSearchPlacement();

  const { buildings: rawBuildings, tours: rawTours, zones: rawZones } = await loadAllData();

  const buildingsGeo = reprojectFC(rawBuildings, config.dataCRS);
  const toursGeo = reprojectFC(rawTours, config.dataCRS);
  const zonesGeo = reprojectFC(rawZones, config.dataCRS);

  buildingsLayer = buildLayer(buildingsGeo, "building", "buildingsPane");
  toursLayer = buildLayer(toursGeo, "tour", "toursPane");
  zonesLayer = buildLayer(zonesGeo, "zone", "zonesPane");

  dataBounds = L.latLngBounds([]);
  [buildingsLayer, toursLayer, zonesLayer].forEach((layerGroup) => {
    try {
      const bounds = layerGroup.getBounds();
      if (bounds && bounds.isValid()) dataBounds.extend(bounds);
    } catch {}
  });

  if (!dataBounds.isValid()) {
    dataBounds = L.latLngBounds([33.494, -80.855], [33.502, -80.843]);
  }

  imageBounds = computeImageBounds(dataBounds, config.imageWidthPx, config.imageHeightPx, config.imagePaddingPct, align);

  imageOverlay = L.imageOverlay(config.imageUrl, imageBounds, {
    pane: "imagePane",
    interactive: false,
    opacity: 1,
    attribution: "© SC State University | Imagery: SC_2023_RGB WMTS"
  });

  const overlayReady = waitOverlayReady(imageOverlay);
  imageOverlay.addTo(map);

  map.setMaxBounds(imageBounds.pad(0.14));

  zonesLayer.addTo(map);
  buildingsLayer.addTo(map);
  toursLayer.addTo(map);

  buildTourPins();
  tourPinsLayer.addTo(map);
  updateTourbar();
  renderLocationsList();
  syncLocationsList();
  renderAlignValues();

  allFeatures = [];
  const push = (layerGroup, kind) => {
    layerGroup.eachLayer((layer) => {
      const name = cleanName(layer.feature?.properties?.name);
      if (!name) return;
      allFeatures.push({ kind, layer, props: layer.feature.properties });
    });
  };
  push(toursLayer, "tour");
  push(buildingsLayer, "building");
  push(zonesLayer, "zone");

  fitCampusFrame({ animate: false });
  map.invalidateSize({ pan: false });

  map.on("click", (e) => {
    if (e.originalEvent?.target?.closest(".leaflet-interactive")) return;
    clearSelection();
  });

  await Promise.all([
    waitWindowLoad(),
    waitFontsReady(),
    overlayReady,
    waitForMapPaint(),
    new Promise((resolve) => setTimeout(resolve, 250))
  ]);

  requestAnimationFrame(() => {
    el.app.setAttribute("aria-hidden", "false");
    el.app.classList.add("is-ready");
    el.splash.classList.add("is-hidden");
    setTimeout(() => {
      el.splash.style.display = "none";
      map.invalidateSize({ pan: false });
      fitCampusFrame({ animate: false });
    }, 420);
  });
}

boot().catch((err) => {
  console.error("[metaversity] fatal:", err);
  el.splash.innerHTML = `<div style="font-family:monospace;padding:24px;color:#b91c1c;text-align:center;max-width:520px">Failed to initialise the map:<br><br><code>${String(err?.message || err)}</code></div>`;
});
