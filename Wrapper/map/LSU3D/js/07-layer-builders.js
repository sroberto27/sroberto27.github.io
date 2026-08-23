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

  (toursGeo.features || []).forEach((f) => {
    const props = f.properties || {};
    const order = Number(props.order_num);
    if (!Number.isFinite(order)) return;

    const bounds = boundsOfFeature(f);
    const center = centerOfBounds(bounds);
    if (!center) return;

    // Off-campus tour stops (e.g. a directional-indicator stop) get a
    // distinct amber pin with a small arrow glyph so the user can see
    // at a glance that the shape on the map is a directional indicator
    // rather than a real building footprint.
    const offCampus = !!props.off_campus;
    const root = document.createElement("div");
    root.className = offCampus ? "tour-pin-wrap is-offcampus" : "tour-pin-wrap";
    root.innerHTML = offCampus
      ? `<div class="tour-pin is-offcampus" data-order="${order}" ` +
        `title="Off-campus location — click for details">` +
        `${order}<span class="tour-pin-arrow" aria-hidden="true">↗</span></div>`
      : `<div class="tour-pin" data-order="${order}">${order}</div>`;

    root.addEventListener("click", (e) => {
      e.stopPropagation();
      selectFeature({ sourceId: SOURCE_IDS.tours, featureId: f.id, feature: f }, "tour", { focus: true });
    });

    const marker = new maplibregl.Marker({ element: root, anchor: "center" })
      .setLngLat(center)
      .addTo(map);

    markers.push(marker);
    tourStops.push({ feature: f, featureId: f.id, marker, order });
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
  const stop = tourStops[tourIndex];
  if (!stop) return;
  const node = stop.marker.getElement().querySelector(".tour-pin");
  if (node) node.classList.add("is-active");
}
