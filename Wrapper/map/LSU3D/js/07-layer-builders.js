/* === LSU Death Valley Experience — Part 7: Layer builders, bounds, tour pins === */
/* -----------------------------------------------------------
   9. Layer builders (MapLibre)
   -----------------------------------------------------------
   Biggest structural change from the Leaflet build: there's no
   per-feature JS "layer" object anymore. A GeoJSON FeatureCollection
   becomes one source + a fill/fill-extrusion layer PAIR (2D/3D — see
   js/05-map-helpers.js: set3DMode()), styled by ONE declarative
   expression per paint property (js/02-state.js: styleExpressionsFor()),
   with hover/selected state tracked via map.setFeatureState() instead
   of Leaflet's imperative layer.setStyle(). Click/hover are delegated
   map-level listeners scoped to a layer id, not per-feature .on({...}).
   ----------------------------------------------------------- */

/* Prepares a raw fetched FeatureCollection for MapLibre: every feature
   needs a stable NUMERIC id for map.setFeatureState() to work, and a
   baked-in `__styleVariant` (route/facility/offCampus) so the paint
   expression can select the right color without re-deriving it per
   render. `fid` (already present + unique on tour features) is
   promoted straight to feature.id; anything without a numeric fid
   falls back to its array index.

   `defaultHeight` is baked in as `__height` for every feature — there's
   no per-building height source (no OSM height/building:levels tags in
   this data), so the fill-extrusion layer's height expression reads a
   single flat constant uniformly (see config.map3d.buildingDefaultHeight). */
function prepGeoJSON(fc, defaultHeight) {
  const features = (fc && fc.features) || [];
  return {
    type: "FeatureCollection",
    features: features.map((f, i) => {
      const fid = (f.properties && Number.isFinite(f.properties.fid)) ? f.properties.fid : i;
      return {
        ...f,
        id: fid,
        properties: {
          ...f.properties,
          __styleVariant: styleVariantFor(f),
          __height: defaultHeight
        }
      };
    })
  };
}

/* One reusable hover tooltip element (see css/05-leaflet-responsive.css
   .campus-label) instead of Leaflet's per-layer bindTooltip(). */
let tooltipEl = null;
function ensureTooltipEl() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "campus-label";
  tooltipEl.style.display = "none";
  map.getContainer().appendChild(tooltipEl);
  return tooltipEl;
}
function showTooltip(feature, lngLat) {
  const label = cleanName(feature.properties && feature.properties.name);
  if (!label) return;
  const t = ensureTooltipEl();
  t.textContent = label;
  t.style.display = "block";
  moveTooltip(lngLat);
}
function moveTooltip(lngLat) {
  if (!tooltipEl || tooltipEl.style.display === "none") return;
  const p = map.project(lngLat);
  tooltipEl.style.left = p.x + "px";
  tooltipEl.style.top = p.y + "px";
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = "none";
}

/* Delegated mouseover/mouseout/click for one style layer id. Registered
   once per layer (fill AND its fill-extrusion twin both get this, so
   hover/selection/tooltips work identically whichever is visible). */
function bindLayerEvents(layerId, sourceId, kind) {
  let hoveredId = null;
  const wantsTooltip = config.ui.showBuildingTooltips || kind === "tour";

  map.on("mousemove", layerId, (e) => {
    const f = e.features && e.features[0];
    if (!f) return;

    if (config.ui.enableHoverPreview && hoveredId !== f.id) {
      if (hoveredId !== null) {
        map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
      }
      hoveredId = f.id;
      map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: true });
    }

    if (wantsTooltip) {
      if (tooltipEl && tooltipEl.style.display !== "none") moveTooltip(e.lngLat);
      else showTooltip(f, e.lngLat);
    }
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", layerId, () => {
    if (hoveredId !== null) {
      map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
      hoveredId = null;
    }
    hideTooltip();
    map.getCanvas().style.cursor = "";
  });

  map.on("click", layerId, (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    selectFeature({ sourceId, featureId: f.id, feature: f }, kind, { focus: true });
  });
}

/* Adds one GeoJSON source + a fill/fill-extrusion layer pair for a
   FeatureCollection. Returns the prepped GeoJSON (with ids + variants
   baked in) so callers can keep it around for bounds/search/pin logic. */
function addSourceAndLayers(rawFC, kind, sourceId, fillId, extrusionId) {
  const defaultHeight = kind === "building"
    ? (config.map3d.buildingDefaultHeight ?? 14)
    : 6; // tour stops are placeholder route/facility boxes, not real structures
  const geo = prepGeoJSON(rawFC, defaultHeight);
  map.addSource(sourceId, { type: "geojson", data: geo });

  const exprs = styleExpressionsFor(kind);

  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    layout: { visibility: "visible" },
    paint: {
      "fill-color": exprs.fillColor,
      "fill-opacity": exprs.fillOpacity,
      "fill-outline-color": exprs.outlineColor
    }
  });

  map.addLayer({
    id: extrusionId,
    type: "fill-extrusion",
    source: sourceId,
    layout: { visibility: "none" }, // 2D by default; js/05-map-helpers.js: set3DMode() swaps this
    paint: {
      "fill-extrusion-color": exprs.fillColor,
      // fill-extrusion-opacity does NOT support data-driven/feature-state
      // expressions in MapLibre (only -color/-height/-base do) — passing
      // exprs.fillOpacity here makes addLayer silently reject the whole
      // layer with no thrown error (confirmed by isolating each paint
      // property in a live probe). Flat constant instead; selection/hover
      // still reads clearly via the color expression alone.
      "fill-extrusion-opacity": 0.85,
      // __height is baked onto every feature by prepGeoJSON() above —
      // one flat defaultHeight for every building (no per-building height
      // data source; see config.map3d.buildingDefaultHeight). This is the
      // fallback that's always available; when Google Photorealistic 3D
      // Tiles are active (js/16-google-tiles.js) this layer is hidden.
      "fill-extrusion-height": ["get", "__height"],
      "fill-extrusion-base": 0
    }
  });

  bindLayerEvents(fillId, sourceId, kind);
  bindLayerEvents(extrusionId, sourceId, kind);

  return geo;
}

/* -----------------------------------------------------------
   10. Feature bounds (replaces Leaflet's layer.getBounds())
   ----------------------------------------------------------- */
// boundsOfFeature()/centerOfBounds() moved to js/02-state.js (sec 5) since
// selectFeature()'s camera-fly (js/06-details-panel.js) needs them too.

/* -----------------------------------------------------------
   11. Tour pins (numbered maplibregl.Marker pins over stops)
   ----------------------------------------------------------- */
function buildTourPins() {
  tourStops = [];

  if (buildTourPins._markers) {
    buildTourPins._markers.forEach((m) => m.remove());
  }
  const markers = [];

  /* Several stops share one building — 3/4/5 are all inside the Football
     Operations Facility, 8/9 both inside Tiger Stadium — so their footprints,
     and therefore their pin centers, are byte-identical. Plain stacked markers
     hid every pin but the last one drawn (only "5" and "9" were visible).

     Co-located stops are therefore drawn as ONE collapsed cluster pin showing
     the range it covers ("3–5"), which expands into a row of the individual
     numbered pins — in tour order — on hover, keyboard focus, or tap. That
     keeps the map uncluttered at rest while still making every stop
     individually reachable, which a permanently-fanned-out spray of pins or a
     single cycling/animated number would not (with a cycling number only
     whichever digit happened to be showing would be clickable).

     Expansion is driven by JS classes rather than CSS :hover so the same code
     path serves touch devices, where :hover never fires. */
  const groups = new Map();
  (toursGeo.features || []).forEach((f) => {
    const order = Number((f.properties || {}).order_num);
    if (!Number.isFinite(order)) return;
    const center = centerOfBounds(boundsOfFeature(f));
    if (!center) return;
    const key = `${center[0].toFixed(6)},${center[1].toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, { center, items: [] });
    groups.get(key).items.push({ f, order });
  });

  // Builds one numbered pin node and wires its click-to-select.
  function makePinNode(f, order) {
    // Off-campus tour stops (e.g. a directional-indicator stop) get a
    // distinct amber pin with a small arrow glyph so the user can see
    // at a glance that the shape on the map is a directional indicator
    // rather than a real building footprint.
    const offCampus = !!(f.properties || {}).off_campus;
    const node = document.createElement("div");
    node.className = offCampus ? "tour-pin is-offcampus" : "tour-pin";
    node.dataset.order = String(order);
    // The teardrop body is rotated -45deg in CSS, so its contents live in
    // their own element that counter-rotates — otherwise the number would
    // render on its side.
    if (offCampus) {
      node.title = "Off-campus location — click for details";
      node.innerHTML =
        `<span class="tour-pin-num">${order}` +
        `<span class="tour-pin-arrow" aria-hidden="true">↗</span></span>`;
    } else {
      node.innerHTML = `<span class="tour-pin-num">${order}</span>`;
    }
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      selectFeature({ sourceId: SOURCE_IDS.tours, featureId: f.id, feature: f }, "tour", { focus: true });
    });
    return node;
  }

  groups.forEach(({ center, items }) => {
    items.sort((a, b) => a.order - b.order);

    const root = document.createElement("div");

    if (items.length === 1) {
      const { f, order } = items[0];
      root.className = "tour-pin-wrap";
      const node = makePinNode(f, order);
      root.appendChild(node);
      tourStops.push({ feature: f, featureId: f.id, order, pinNode: node });
    } else {
      root.className = "tour-pin-wrap tour-pin-cluster";

      const orders = items.map((it) => it.order);
      const consecutive = orders.every((n, i) => i === 0 || n === orders[i - 1] + 1);
      const label = consecutive
        ? `${orders[0]}–${orders[orders.length - 1]}`
        : orders.join("·");

      const summary = document.createElement("button");
      summary.type = "button";
      summary.className = "tour-pin-cluster-summary";
      summary.textContent = label;
      summary.setAttribute("aria-expanded", "false");
      summary.setAttribute(
        "aria-label",
        `${items.length} tour stops at this building: ${orders.join(", ")}. Expand to choose one.`
      );

      const membersWrap = document.createElement("div");
      membersWrap.className = "tour-pin-cluster-members";

      items.forEach(({ f, order }) => {
        const node = makePinNode(f, order);
        membersWrap.appendChild(node);
        tourStops.push({ feature: f, featureId: f.id, order, pinNode: node });
      });

      root.appendChild(summary);
      root.appendChild(membersWrap);

      const setOpen = (open) => {
        root.classList.toggle("is-open", open);
        summary.setAttribute("aria-expanded", String(open));
      };
      root.addEventListener("mouseenter", () => setOpen(true));
      root.addEventListener("mouseleave", () => setOpen(false));
      root.addEventListener("focusin", () => setOpen(true));
      root.addEventListener("focusout", (e) => {
        if (!root.contains(e.relatedTarget)) setOpen(false);
      });
      // Touch: the summary has no hover to trigger it, so tapping toggles.
      summary.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(!root.classList.contains("is-open"));
      });
    }

    // anchor:"bottom" (not "center") so the teardrop's TIP sits on the real
    // coordinate — the whole point of a drop-shaped pin. Clusters bottom-align
    // the same way, so their chip/row floats just above the shared point.
    const marker = new maplibregl.Marker({ element: root, anchor: "bottom" })
      .setLngLat(center)
      .addTo(map);
    markers.push(marker);
  });

  buildTourPins._markers = markers;

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
  document.querySelectorAll(".tour-pin-cluster.has-active")
          .forEach((n) => n.classList.remove("has-active"));
  const stop = tourStops[tourIndex];
  if (!stop || !stop.pinNode) return;
  stop.pinNode.classList.add("is-active");
  // A collapsed cluster would otherwise hide the pin that just became the
  // active stop — mark the cluster so CSS keeps it expanded while its own
  // stop is the current one, without needing a hover.
  const cluster = stop.pinNode.closest(".tour-pin-cluster");
  if (cluster) cluster.classList.add("has-active");
}
