/* === SCSU app — Part 7: Layer builders, bounds, tour pins === */
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

