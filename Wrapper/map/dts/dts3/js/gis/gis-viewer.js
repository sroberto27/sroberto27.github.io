/* ============================================================
   GIS engine -- window.DTSGis
   ------------------------------------------------------------
   Per docs/plans/gis/04-SPEC-gis-engine.md. This file owns map
   init, view/bounds, basemaps, the layer factory for all six
   sourceTypes (esri* layers delegate to gis-esri.js; geojson/
   tileXYZ/wms are simple enough to stay local), and the full
   public API surface (§5). The parish clip mask and the tool
   UIs (layer panel, identify, measure, etc.) are separate
   build-plan tasks; each `layers` registry entry's `query` seam
   is what they plug into.
   ============================================================ */
(function () {
  "use strict";

  function round(n, d) {
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  }

  function clamp(n, lo, hi) {
    if (typeof lo !== "number") lo = -Infinity;
    if (typeof hi !== "number") hi = Infinity;
    return Math.max(lo, Math.min(hi, n));
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function featureRowId(f) {
    if (f.id != null) return f.id;
    const props = f.properties || {};
    return props.OBJECTID != null ? props.OBJECTID : props.id;
  }

  // Filter/query-builder (3.8): gis-tools.js builds a plain, serialisable
  // condition list -- [{field, op, value}], ANDed -- and hands it here to
  // translate into whichever mechanism a sourceType actually understands:
  // an ArcGIS SQL where-clause for esriFeature, an in-memory predicate
  // function for geojson. Kept next to each other so the two stay in sync
  // on operator support.
  function sqlQuote(v) { return "'" + String(v).replace(/'/g, "''") + "'"; }

  function buildWhereFromConditions(conditions) {
    if (!conditions || !conditions.length) return "1=1";
    const opSql = { "=": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=" };
    return conditions.map(function (c) {
      const field = '"' + String(c.field).replace(/"/g, "") + '"';
      if (c.op === "contains") return "UPPER(" + field + ") LIKE UPPER(" + sqlQuote("%" + c.value + "%") + ")";
      const n = parseFloat(c.value);
      const isNum = c.value !== "" && !isNaN(n);
      return field + " " + (opSql[c.op] || "=") + " " + (isNum ? n : sqlQuote(c.value));
    }).join(" AND ");
  }

  function buildPredicateFromConditions(conditions) {
    if (!conditions || !conditions.length) return null;
    return function (props) {
      return conditions.every(function (c) {
        const raw = props[c.field];
        if (c.op === "contains") return raw != null && String(raw).toLowerCase().indexOf(String(c.value).toLowerCase()) !== -1;
        if (raw == null) return false;
        const n = parseFloat(c.value);
        const isNum = c.value !== "" && !isNaN(n) && typeof raw === "number";
        const a = isNum ? Number(raw) : String(raw);
        const b = isNum ? n : String(c.value);
        switch (c.op) {
          case "=": return a === b;
          case "!=": return a !== b;
          case ">": return a > b;
          case "<": return a < b;
          case ">=": return a >= b;
          case "<=": return a <= b;
          default: return true;
        }
      });
    };
  }

  // Measure tool (3.9) geometry math. Per 04-SPEC §2 ("~80 lines, no Turf"):
  // distance doesn't need hand-rolled haversine at all -- Leaflet's own
  // L.LatLng#distanceTo already implements it (L.CRS.Earth), so
  // pathLengthMeters below just sums that. Area has no Leaflet-core
  // equivalent (that's Leaflet.draw's separate GeometryUtil plugin, not
  // vendored), so this uses the spec's own suggested shortcut: an
  // equirectangular projection centred on the ring's mean latitude, then
  // the ordinary planar shoelace formula -- accurate enough at parish scale,
  // far simpler than full spherical-excess trigonometry.
  function pathLengthMeters(latlngs) {
    let d = 0;
    for (let i = 1; i < latlngs.length; i++) d += latlngs[i - 1].distanceTo(latlngs[i]);
    return d;
  }

  function polygonAreaMeters2(latlngs) {
    if (latlngs.length < 3) return 0;
    const R = 6371000;
    const toRad = Math.PI / 180;
    const refLat = latlngs.reduce(function (s, p) { return s + p.lat; }, 0) / latlngs.length;
    const cosRef = Math.cos(refLat * toRad);
    const pts = latlngs.map(function (p) { return [R * p.lng * toRad * cosRef, R * p.lat * toRad]; });
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
  }

  const UNIT_CONVERT = {
    distance: {
      ft: function (m) { return m * 3.28084; },
      mi: function (m) { return m / 1609.344; },
      m: function (m) { return m; },
      km: function (m) { return m / 1000; }
    },
    area: {
      ac: function (m2) { return m2 / 4046.8564224; },
      ft2: function (m2) { return m2 * 10.76391; },
      m2: function (m2) { return m2; },
      km2: function (m2) { return m2 / 1e6; }
    }
  };

  function formatDistance(m, system) {
    if (system === "metric") return m < 1000 ? round(m, 0) + " m" : round(UNIT_CONVERT.distance.km(m), 2) + " km";
    return m < 528 ? round(UNIT_CONVERT.distance.ft(m), 0) + " ft" : round(UNIT_CONVERT.distance.mi(m), 2) + " mi";
  }

  function formatArea(m2, system) {
    if (system === "metric") return m2 < 1e6 ? round(m2, 0) + " m²" : round(UNIT_CONVERT.area.km2(m2), 2) + " km²";
    return round(UNIT_CONVERT.area.ac(m2), 2) + " ac";
  }

  function buildTileLayer(def, ctx) {
    const opts = { attribution: def.attribution || "", opacity: typeof def.opacity === "number" ? def.opacity : 1 };
    if (typeof def.minZoom === "number") opts.minZoom = def.minZoom;
    if (typeof def.maxZoom === "number") opts.maxZoom = def.maxZoom;
    if (ctx && ctx.pane) opts.pane = ctx.pane;
    return L.tileLayer(def.url, opts);
  }

  function buildWmsLayer(def, ctx) {
    const opts = {
      layers: Array.isArray(def.layers) ? def.layers.join(",") : (def.layers || ""),
      format: "image/png",
      transparent: true,
      attribution: def.attribution || "",
      opacity: typeof def.opacity === "number" ? def.opacity : 1
    };
    if (ctx && ctx.pane) opts.pane = ctx.pane;
    return L.tileLayer.wms(def.url, opts);
  }

  function buildEsriImageDataLayer(def, ctx) {
    const opts = { url: def.url, attribution: def.attribution || "", opacity: typeof def.opacity === "number" ? def.opacity : 1 };
    if (ctx && ctx.pane) opts.pane = ctx.pane;
    return { leaflet: L.esri.imageMapLayer(opts), query: null };
  }

  function buildGeoJsonLayer(def, ctx) {
    return fetch(def.url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " fetching " + def.url);
      return res.json();
    }).then(function (data) {
      const styleOpts = def.style || {};
      function styleFor(feature) {
        const style = {
          color: styleOpts.color || "#c49a2a",
          weight: typeof styleOpts.weight === "number" ? styleOpts.weight : 1.5,
          fillColor: styleOpts.fillColor || styleOpts.color || "#c49a2a",
          fillOpacity: typeof styleOpts.fillOpacity === "number" ? styleOpts.fillOpacity : 0.18,
          dashArray: styleOpts.dashArray || null
        };
        const classify = styleOpts.classify;
        if (classify && Array.isArray(classify.breaks) && feature && feature.properties) {
          const v = feature.properties[classify.field];
          let c = classify.colors[classify.colors.length - 1];
          for (let i = 0; i < classify.breaks.length; i++) { if (v <= classify.breaks[i]) { c = classify.colors[i]; break; } }
          style.color = c; style.fillColor = c;
        }
        return style;
      }
      const geoJsonOpts = {
        style: styleFor,
        pointToLayer: function (feature, latlng) {
          // Real bug, found live while testing 3.10's swipe compare against
          // a point layer: L.circleMarker built here has always defaulted
          // to Leaflet's own "overlayPane" (zIndex 400) instead of this
          // layer's ensurePane(zIndex) pane -- pane is a per-layer option on
          // individual L.Path instances, not something a parent L.geoJSON's
          // own `pane` option propagates into a custom pointToLayer's
          // manually-built marker. Confirmed live: every point feature from
          // every geojson layer was landing in one shared pane regardless of
          // its configured zIndex, and swipe compare -- which clips a
          // layer's *own* pane -- was clipping the wrong element entirely
          // for any point layer. §6's "layer order follows zIndex" was
          // silently never true for points until this fix.
          const opts = {
            radius: typeof styleOpts.pointRadius === "number" ? styleOpts.pointRadius : 5,
            color: styleOpts.color || "#c49a2a",
            weight: typeof styleOpts.weight === "number" ? styleOpts.weight : 1.5,
            fillColor: styleOpts.fillColor || styleOpts.color || "#c49a2a",
            fillOpacity: typeof styleOpts.fillOpacity === "number" ? styleOpts.fillOpacity : 0.6
          };
          if (ctx && ctx.pane) opts.pane = ctx.pane;
          return L.circleMarker(latlng, opts);
        }
      };
      if (ctx && ctx.pane) geoJsonOpts.pane = ctx.pane;
      const leaflet = L.geoJSON(data, geoJsonOpts);

      // Filter/query-builder + attribute-table tasks (3.8) both need every
      // feature back, not just an objectIds lookup -- selector.predicate is
      // a plain (properties) => bool function built by gis-tools.js from its
      // field/operator/value rows, run in-memory against the already-fetched
      // data. No selector at all (attribute table's "give me every row")
      // returns the full set.
      const query = (def.queryable === false) ? null : function (selector) {
        let feats = data.features || [];
        if (selector && selector.objectIds) {
          const idSet = {};
          selector.objectIds.forEach(function (id) { idSet[id] = true; });
          feats = feats.filter(function (f) { return idSet[featureRowId(f)]; });
        } else if (selector && typeof selector.predicate === "function") {
          feats = feats.filter(function (f) { return selector.predicate(f.properties || {}); });
        }
        return Promise.resolve({ type: "FeatureCollection", features: feats });
      };

      // Live L.geoJSON is a LayerGroup -- every feature's sub-layer was added
      // to it at construction, so capturing that set once here is enough to
      // toggle membership later without ever re-fetching or rebuilding.
      const allFeatureLayers = [];
      leaflet.eachLayer(function (l) { allFeatureLayers.push(l); });

      const setFilter = (def.queryable === false) ? null : function (predicate) {
        allFeatureLayers.forEach(function (l) {
          const match = !predicate || predicate((l.feature && l.feature.properties) || {});
          const shown = leaflet.hasLayer(l);
          if (match && !shown) leaflet.addLayer(l);
          if (!match && shown) leaflet.removeLayer(l);
        });
      };

      return { leaflet: leaflet, query: query, setFilter: setFilter };
    });
  }

  function buildBasemap(def) {
    if (def.type === "tileXYZ") return buildTileLayer(def, {});
    if (def.type === "esriImage") return buildEsriImageDataLayer(def, {}).leaflet;
    throw new Error('Unsupported basemap type "' + def.type + '"');
  }

  function flattenRings(latlngs, out) {
    // L.Polygon.getLatLngs() nests one level deeper for a MultiPolygon than
    // a Polygon; recurse until we hit an array of actual LatLngs (one ring).
    if (!Array.isArray(latlngs) || !latlngs.length) return;
    if (latlngs[0] instanceof L.LatLng) { out.push(latlngs); return; }
    latlngs.forEach(function (sub) { flattenRings(sub, out); });
  }

  function requireEsri() {
    if (!window.DTSGisEsri) throw new Error("js/gis/gis-esri.js was not loaded");
    return window.DTSGisEsri;
  }

  function ensurePane(map, zIndex) {
    if (typeof zIndex !== "number") return null;
    const name = "gis-z-" + zIndex;
    let pane = map.getPane(name);
    if (!pane) {
      pane = map.createPane(name);
      pane.style.zIndex = zIndex;
    }
    return name;
  }

  function buildLayer(def, map, view) {
    const ctx = {
      envelopeBounds: view.maxBounds ? L.latLngBounds(view.maxBounds) : null,
      pane: ensurePane(map, def.zIndex)
    };
    switch (def.sourceType) {
      case "esriDynamic": return Promise.resolve().then(function () { return requireEsri().buildDynamic(def, ctx); });
      case "esriFeature": return Promise.resolve().then(function () { return requireEsri().buildFeature(def, ctx); });
      case "esriImage": return Promise.resolve().then(function () { return buildEsriImageDataLayer(def, ctx); });
      case "geojson": return buildGeoJsonLayer(def, ctx);
      case "tileXYZ": return Promise.resolve().then(function () { return { leaflet: buildTileLayer(def, ctx), query: null }; });
      case "wms": return Promise.resolve().then(function () { return { leaflet: buildWmsLayer(def, ctx), query: null }; });
      default: return Promise.reject(new Error('Unsupported sourceType "' + def.sourceType + '"'));
    }
  }

  function mount(containerEl, mapDoc, opts) {
    opts = opts || {};
    if (!containerEl) {
      return Promise.reject(new Error("DTSGis.mount: containerEl is required"));
    }
    if (!mapDoc || !mapDoc.view || !Array.isArray(mapDoc.basemaps) || !mapDoc.basemaps.length) {
      return Promise.reject(new Error("DTSGis.mount: mapDoc is missing view/basemaps"));
    }
    if (!window.DTSGisLoader) {
      return Promise.reject(new Error("DTSGis.mount: js/gis/gis-loader.js was not loaded first"));
    }
    return window.DTSGisLoader.load().then(function () {
      return createInstance(containerEl, mapDoc, opts);
    });
  }

  function createInstance(containerEl, mapDoc, opts) {
    const reducedMotion = prefersReducedMotion();
    const view = mapDoc.view || {};
    const tourList = Array.isArray(opts.tours) ? opts.tours : Object.keys(opts.tours || {}).map(function (k) { return opts.tours[k]; });

    const listeners = {};
    function on(evt, cb) {
      (listeners[evt] = listeners[evt] || []).push(cb);
      return function off() {
        listeners[evt] = (listeners[evt] || []).filter(function (fn) { return fn !== cb; });
      };
    }
    function emit(evt, detail) {
      (listeners[evt] || []).slice().forEach(function (cb) {
        try { cb(detail); } catch (err) { console.error('[gis] listener for "' + evt + '" threw:', err); }
      });
    }

    /* ---- map init: view + bounds (§8 defence 3 is the bounds half; the
       dim mask half is a separate task) ---- */
    const mapOptions = {
      minZoom: view.minZoom,
      maxZoom: view.maxZoom,
      maxBounds: (view.restrictToBounds && view.maxBounds) ? view.maxBounds : null,
      maxBoundsViscosity: view.restrictToBounds ? 1.0 : 0,
      preferCanvas: true
    };
    if (view.center && !view.bbox) {
      mapOptions.center = view.center;
      mapOptions.zoom = typeof view.zoom === "number" ? view.zoom : 10;
    }
    containerEl.classList.add("dts-gis-map");
    const map = L.map(containerEl, mapOptions);
    if (view.bbox) {
      map.fitBounds(view.bbox, { animate: false });
    } else if (!view.center) {
      map.setView([0, 0], 2);
    }
    if (mapDoc.attribution) map.attributionControl.addAttribution(mapDoc.attribution);
    // Scale bar is always-on chrome (§6), not a gated tool -- css/15-gis.css
    // restyles it to the site tokens.
    L.control.scale({ position: "bottomleft" }).addTo(map);

    map.on("moveend", function () {
      const c = map.getCenter();
      emit("viewchange", { center: [c.lat, c.lng], zoom: map.getZoom() });
    });

    // Coordinates tool (3.9): "live lat/lng readout on pointer move (and on
    // tap on touch devices)". Leaflet's own mousemove doesn't fire on touch,
    // so click covers the tap case too (harmless extra emit on desktop click).
    // An addition to §5's documented event set, same spirit as "identify".
    map.on("mousemove click", function (e) {
      emit("pointer", { lat: e.latlng.lat, lng: e.latlng.lng });
    });

    /* ---- basemaps ---- */
    const basemapDefs = {};
    (mapDoc.basemaps || []).forEach(function (b) { basemapDefs[b.id] = b; });
    const basemapLayers = {}; // lazily built, cached so switching back doesn't re-fetch
    let currentBasemapId = null;

    function ensureBasemapLayer(id) {
      if (basemapLayers[id]) return basemapLayers[id];
      const def = basemapDefs[id];
      if (!def) throw new Error('Unknown basemap "' + id + '"');
      const layer = buildBasemap(def);
      basemapLayers[id] = layer;
      return layer;
    }

    function setBasemap(id) {
      if (!basemapDefs[id]) { console.warn('[gis] setBasemap: unknown basemap "' + id + '"'); return; }
      if (id === currentBasemapId) return;
      let layer;
      try {
        layer = ensureBasemapLayer(id);
      } catch (err) {
        console.warn("[gis] basemap failed to load:", err);
        emit("error", { scope: "basemap", id: id, message: err.message });
        return;
      }
      if (currentBasemapId && basemapLayers[currentBasemapId]) map.removeLayer(basemapLayers[currentBasemapId]);
      layer.addTo(map);
      currentBasemapId = id;
      emit("layerchange", { type: "basemap", id: id });
    }

    const defaultBasemap = (mapDoc.basemaps || []).find(function (b) { return b.default; }) || mapDoc.basemaps[0];
    setBasemap(defaultBasemap.id);

    /* ---- data layers: the registry is structural (id, visible, opacity)
       from mount; `leaflet`/`query` are filled in asynchronously per layer
       so one slow or broken source never blocks the rest of the map (§11) ---- */
    const layers = {};
    (mapDoc.layers || []).forEach(function (def) {
      layers[def.id] = {
        def: def,
        visible: !!def.visible,
        opacity: typeof def.opacity === "number" ? def.opacity : 1,
        leaflet: null,
        query: null,
        setFilter: null,
        filterConditions: null,
        status: "pending"
      };
    });

    function isInZoomRange(def) {
      const z = map.getZoom();
      if (typeof def.minZoom === "number" && z < def.minZoom) return false;
      if (typeof def.maxZoom === "number" && z > def.maxZoom) return false;
      return true;
    }

    function syncLayerToMap(entry) {
      if (!entry.leaflet) return;
      const shouldShow = entry.visible && isInZoomRange(entry.def) && isTimeVisible(entry);
      const isShown = map.hasLayer(entry.leaflet);
      if (shouldShow && !isShown) entry.leaflet.addTo(map);
      if (!shouldShow && isShown) map.removeLayer(entry.leaflet);
    }

    map.on("zoomend", function () {
      // §9: layers outside their zoom range come off the map, not just hidden.
      Object.keys(layers).forEach(function (id) { syncLayerToMap(layers[id]); });
    });

    /* ---- parish boundary dim mask (§8 defence 3 -- cosmetic; defences 1-2
       are the real enforcement, done at harvest/query time) ---- */
    const boundaryCfg = mapDoc.boundary || null;

    // Real bug, found live while testing task 3.8 against an esriFeature
    // boundary layer (sources.json's own recommended default sourceType for
    // the parish boundary, "esriFeature (single static polygon; also freeze
    // as a local geojson clip mask)"): esri-leaflet's FeatureLayer extends
    // L.Layer, not L.LayerGroup -- confirmed live, `typeof
    // L.esri.featureLayer({url}).eachLayer` is "undefined" (esri-leaflet's
    // own source only ever calls it as `this.eachLayer && this.eachLayer(...)`,
    // i.e. it expects this to be absent on some layer types). The original
    // eachLayer()+getLatLngs() approach only ever worked for the geojson
    // sourceType's plain L.geoJSON layer. Building the mask from entry.query()
    // instead -- already implemented for both esriFeature and geojson --
    // works for both, via a throwaway L.geoJSON() conversion of the result.
    function buildParishMask(entry) {
      if (typeof entry.query !== "function") {
        console.warn('[gis] boundary layer "' + boundaryCfg.layerId + '" isn\'t queryable -- skipping the dim mask');
        return;
      }
      entry.query({}).then(function (fc) {
        const rings = [];
        L.geoJSON(fc).eachLayer(function (child) {
          if (typeof child.getLatLngs === "function") flattenRings(child.getLatLngs(), rings);
        });
        if (!rings.length) {
          console.warn('[gis] boundary layer "' + boundaryCfg.layerId + '" has no polygon geometry -- skipping the dim mask');
          return;
        }
        const worldRing = [L.latLng(85, -180), L.latLng(85, 180), L.latLng(-85, 180), L.latLng(-85, -180)];
        const maskPane = ensurePane(map, 450); // above ordinary data-layer panes, below markers/popups
        const mask = L.polygon([worldRing].concat(rings), {
          pane: maskPane,
          stroke: false,
          fill: true,
          fillColor: "#04070c",
          fillOpacity: typeof boundaryCfg.maskOpacity === "number" ? boundaryCfg.maskOpacity : 0.55,
          fillRule: "evenodd",
          interactive: false
        });
        mask.addTo(map);
      }).catch(function (err) {
        console.warn('[gis] boundary mask query failed:', err);
      });
    }

    function markUnavailable(id, message) {
      const entry = layers[id];
      if (!entry || entry.status === "unavailable") return;
      entry.status = "unavailable";
      if (entry.leaflet && map.hasLayer(entry.leaflet)) map.removeLayer(entry.leaflet);
      console.warn('[gis] layer "' + id + '" is unavailable:', message);
      emit("error", { scope: "layer", id: id, message: message });
      emit("layerchange", { id: id, status: "unavailable" });
    }

    /* ---- identify (task 3.7). Gated at the source, not just in
       gis-tools.js's UI, so a map with tools.identify:false attaches no
       click listeners and makes no identify requests at all. */
    const identifyEnabled = !(mapDoc.tools && mapDoc.tools.identify === false);

    function loadLayer(id) {
      const entry = layers[id];
      entry.status = "loading";
      buildLayer(entry.def, map, view).then(function (built) {
        entry.leaflet = built.leaflet;
        entry.query = built.query;
        entry.setFilter = built.setFilter || null;
        entry.status = "ready";
        applyPendingFilter(entry); // re-applies a filter set by applyState() before this layer finished loading
        if (typeof entry.leaflet.setOpacity === "function") entry.leaflet.setOpacity(entry.opacity);
        // esri-leaflet layers build synchronously but fetch lazily -- a bad
        // service surfaces here, not as a constructor throw (§11).
        if (typeof entry.leaflet.on === "function") {
          entry.leaflet.on("requesterror", function (e) { markUnavailable(id, e.message || "request failed"); });
        }
        // Vector layers (esriFeature/geojson) already have the clicked
        // feature client-side -- identify resolves it locally with no
        // network round trip. esriDynamic is a raster image with nothing
        // to attach a click to; that path is the map-level handler below.
        if (identifyEnabled && entry.def.queryable !== false && typeof entry.leaflet.on === "function" &&
          (entry.def.sourceType === "esriFeature" || entry.def.sourceType === "geojson")) {
          entry.leaflet.on("click", function (e) {
            L.DomEvent.stopPropagation(e);
            const feature = (e.layer && e.layer.feature) || (e.sourceTarget && e.sourceTarget.feature);
            emit("identify", {
              latlng: [e.latlng.lat, e.latlng.lng],
              containerPoint: [e.containerPoint.x, e.containerPoint.y],
              hits: [{
                layerId: id,
                sublayerId: entry.def.sourceType === "esriFeature" ? entry.def.layerId : null,
                properties: (feature && feature.properties) || {}
              }]
            });
          });
        }
        syncLayerToMap(entry);
        if (boundaryCfg && boundaryCfg.showMask !== false && id === boundaryCfg.layerId) {
          buildParishMask(entry);
        }
        emit("layerchange", { id: id, status: "ready" });
      }).catch(function (err) {
        markUnavailable(id, err.message);
      });
    }

    Object.keys(layers).forEach(loadLayer);

    /* ---- identify, continued: esriDynamic is a raster image, so a click
       on it never reaches a Leaflet layer object -- it always falls through
       to the map itself. Every visible+ready+queryable esriDynamic layer in
       zoom range gets queried in parallel and the results are combined into
       one "grouped by layer" identify event (§6), same event vector-layer
       clicks emit above. Fires with an empty hits[] on a genuine miss so
       gis-tools.js can dismiss a stale popup on every click, not just hits. */
    if (identifyEnabled) {
      map.on("click", function (e) {
        const targets = Object.keys(layers).filter(function (id) {
          const entry = layers[id];
          return entry.status === "ready" && entry.visible && entry.def.queryable !== false &&
            entry.def.sourceType === "esriDynamic" && isInZoomRange(entry.def);
        });
        if (!targets.length) {
          emit("identify", { latlng: [e.latlng.lat, e.latlng.lng], containerPoint: [e.containerPoint.x, e.containerPoint.y], hits: [] });
          return;
        }
        Promise.all(targets.map(function (id) {
          return requireEsri().identify(layers[id].def, map, e.latlng).then(function (results) {
            return results.map(function (r) {
              return { layerId: id, sublayerId: r.sublayerId, sublayerName: r.sublayerName, properties: r.properties };
            });
          }).catch(function (err) {
            console.warn('[gis] identify failed for "' + id + '":', err);
            return [];
          });
        })).then(function (grouped) {
          const hits = [].concat.apply([], grouped);
          emit("identify", { latlng: [e.latlng.lat, e.latlng.lng], containerPoint: [e.containerPoint.x, e.containerPoint.y], hits: hits });
        });
      });
    }

    function setLayerVisible(id, visible) {
      const entry = layers[id];
      if (!entry) { console.warn('[gis] setLayerVisible: unknown layer "' + id + '"'); return; }
      entry.visible = !!visible;
      syncLayerToMap(entry);
      // §6: swipe "must reset cleanly when its layer is switched off".
      if (!entry.visible && id === swipeLayerId) setSwipeLayer(null);
      emit("layerchange", { id: id, visible: entry.visible });
    }

    function setLayerOpacity(id, opacity) {
      const entry = layers[id];
      if (!entry) { console.warn('[gis] setLayerOpacity: unknown layer "' + id + '"'); return; }
      entry.opacity = clamp(opacity, 0, 1);
      if (entry.leaflet && typeof entry.leaflet.setOpacity === "function") entry.leaflet.setOpacity(entry.opacity);
      emit("layerchange", { id: id, opacity: entry.opacity });
    }

    /* ---- layer bounds: not part of the §5 public API (no Leaflet objects
       cross that boundary), but gis-tools.js's zoom-to-extent button needs
       real, already-reprojected bounds and there's no reliable way to get
       those from ArcGIS service metadata alone (extents come back in the
       service's native SR, which for Iberia's servers isn't WGS84). Returns
       a Promise of [[south,west],[north,east]] -- a serialisable array, not
       a Leaflet object -- or null when there's no answer.

       Confirmed live against the vendored esri-leaflet 3.0.19: FeatureLayer
       and DynamicMapLayer implement no getBounds() at all (typeof is
       "undefined", not sync or async), so this only ever resolves non-null
       for the geojson sourceType's plain L.geoJSON layer, which has the
       standard synchronous Leaflet getBounds(). Wrapped in a resolved
       Promise regardless, so this seam has one stable async contract no
       matter which sourceType built the layer. */
    function getLayerBounds(id) {
      const entry = layers[id];
      if (!entry || !entry.leaflet || typeof entry.leaflet.getBounds !== "function") return Promise.resolve(null);
      try {
        const b = entry.leaflet.getBounds();
        if (!b || (typeof b.isValid === "function" && !b.isValid())) return Promise.resolve(null);
        return Promise.resolve([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]);
      } catch (err) {
        return Promise.resolve(null);
      }
    }

    /* ---- geolocate (task 3.9): navigator.geolocation, one-shot, with an
       accuracy circle. §11: geolocation denial is silent at the tool level
       (no scolding) -- this just rejects with a typed reason and lets
       gis-tools.js decide tone; "outside parish" is reported, not hidden,
       so the UI can offer to zoom to the parish instead of the user. */
    const geolocateGroup = L.layerGroup().addTo(map);
    function clearGeolocate() { geolocateGroup.clearLayers(); }
    function geolocate() {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) { reject({ code: "unsupported", message: "Geolocation isn't available in this browser." }); return; }
        navigator.geolocation.getCurrentPosition(function (pos) {
          const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
          const accuracy = pos.coords.accuracy;
          clearGeolocate();
          L.circleMarker(latlng, { radius: 6, color: "#4fb3ff", weight: 2, fillColor: "#4fb3ff", fillOpacity: 0.7, interactive: false }).addTo(geolocateGroup);
          if (accuracy) L.circle(latlng, { radius: accuracy, color: "#4fb3ff", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(geolocateGroup);
          const bounds = view.maxBounds ? L.latLngBounds(view.maxBounds) : null;
          resolve({ lat: latlng.lat, lng: latlng.lng, accuracy: accuracy, withinParish: !bounds || bounds.contains(latlng) });
        }, function (err) {
          reject({ code: err.code === 1 ? "denied" : (err.code === 3 ? "timeout" : "unavailable"), message: err.message });
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
      });
    }

    /* ---- measure (task 3.9): distance (multi-segment, running total) and
       area, per §6. Interaction lives entirely here (gis-tools.js never
       touches L) -- click adds a vertex, mousemove previews the next
       segment/closing edge, dblclick finishes, Escape cancels an
       in-progress session (via _cancelMeasure), the clear button removes
       every finished measurement (via _clearMeasurements). Distance uses
       Leaflet's own L.LatLng#distanceTo (already haversine -- no need to
       hand-roll it); area uses polygonAreaMeters2 (§2's suggested
       projected-plane shoelace, defined above buildTileLayer). */
    const measureGroup = L.layerGroup().addTo(map);
    const measureState = { mode: null, unit: "imperial" };
    let measureSession = null; // {points, shapeLayer, pointLayers, labelLayers} while a measurement is in progress
    let finishedMeasureLayers = [];

    function measureLabel(latlng, text, extraClass) {
      const marker = L.marker(latlng, {
        icon: L.divIcon({ className: "dts-gis-measure-label" + (extraClass ? " " + extraClass : ""), html: text, iconSize: null }),
        interactive: false, keyboard: false
      });
      marker.addTo(measureGroup);
      return marker;
    }
    function measureMidpoint(a, b) { return L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2); }

    function redrawMeasureSession(previewLatLng) {
      if (measureSession.shapeLayer) { measureGroup.removeLayer(measureSession.shapeLayer); measureSession.shapeLayer = null; }
      measureSession.pointLayers.forEach(function (l) { measureGroup.removeLayer(l); });
      measureSession.pointLayers = [];
      measureSession.labelLayers.forEach(function (l) { measureGroup.removeLayer(l); });
      measureSession.labelLayers = [];

      const pts = measureSession.points;
      pts.forEach(function (p) {
        const m = L.circleMarker(p, { radius: 4, color: "#f0c75e", weight: 2, fillColor: "#151005", fillOpacity: 1, interactive: false });
        m.addTo(measureGroup);
        measureSession.pointLayers.push(m);
      });

      const livePts = previewLatLng ? pts.concat([previewLatLng]) : pts;
      if (livePts.length < 2) return;
      const isArea = measureState.mode === "area";
      const closed = isArea && livePts.length >= 3;
      const shapePts = closed ? livePts.concat([livePts[0]]) : livePts;
      measureSession.shapeLayer = L.polyline(shapePts, {
        color: "#f0c75e", weight: 2, dashArray: previewLatLng ? "6 5" : null
      }).addTo(measureGroup);

      for (let i = 1; i < livePts.length; i++) {
        const segLen = livePts[i - 1].distanceTo(livePts[i]);
        measureSession.labelLayers.push(measureLabel(measureMidpoint(livePts[i - 1], livePts[i]), formatDistance(segLen, measureState.unit)));
      }
      if (isArea && closed) {
        measureSession.labelLayers.push(measureLabel(
          livePts[livePts.length - 1], formatArea(polygonAreaMeters2(livePts), measureState.unit), "dts-gis-measure-total"
        ));
      } else if (!isArea) {
        measureSession.labelLayers.push(measureLabel(
          livePts[livePts.length - 1], "Total " + formatDistance(pathLengthMeters(livePts), measureState.unit), "dts-gis-measure-total"
        ));
      }
    }

    function buildMeasureDetail(finished) {
      const pts = measureSession ? measureSession.points : [];
      return {
        mode: measureState.mode, active: !!measureSession, finished: !!finished, unit: measureState.unit,
        distanceM: pathLengthMeters(pts),
        areaM2: measureState.mode === "area" ? polygonAreaMeters2(pts) : 0,
        points: pts.map(function (p) { return [p.lat, p.lng]; })
      };
    }

    function onMeasureClick(e) {
      measureSession.points.push(e.latlng);
      redrawMeasureSession(null);
      emit("measure", buildMeasureDetail(false));
    }
    function onMeasureMove(e) {
      if (!measureSession.points.length) return;
      redrawMeasureSession(e.latlng);
    }
    function onMeasureDblClick(e) {
      L.DomEvent.stop(e);
      // Leaflet fires two ordinary 'click' events before 'dblclick'; if the
      // last two confirmed points are effectively the same screen spot (the
      // dblclick's own click pair), drop the redundant one before finishing.
      if (measureSession.points.length >= 2) {
        const a = map.latLngToContainerPoint(measureSession.points[measureSession.points.length - 1]);
        const b = map.latLngToContainerPoint(measureSession.points[measureSession.points.length - 2]);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 10) measureSession.points.pop();
      }
      finishMeasure();
    }

    function teardownMeasureListeners() {
      map.doubleClickZoom.enable();
      containerEl.classList.remove("dts-gis-measuring");
      map.off("click", onMeasureClick);
      map.off("mousemove", onMeasureMove);
      map.off("dblclick", onMeasureDblClick);
    }

    function cancelMeasureSession() {
      if (!measureSession) return;
      if (measureSession.shapeLayer) measureGroup.removeLayer(measureSession.shapeLayer);
      measureSession.pointLayers.forEach(function (l) { measureGroup.removeLayer(l); });
      measureSession.labelLayers.forEach(function (l) { measureGroup.removeLayer(l); });
      teardownMeasureListeners();
      measureSession = null;
    }

    function startMeasure(mode, unit) {
      cancelMeasureSession(); // an in-progress session is abandoned when a new one starts; finished ones stay
      measureState.mode = mode === "area" ? "area" : "distance";
      if (unit) measureState.unit = unit;
      measureSession = { points: [], shapeLayer: null, pointLayers: [], labelLayers: [] };
      map.doubleClickZoom.disable();
      containerEl.classList.add("dts-gis-measuring");
      map.on("click", onMeasureClick);
      map.on("mousemove", onMeasureMove);
      map.on("dblclick", onMeasureDblClick);
      emit("measure", buildMeasureDetail(false));
    }

    function finishMeasure() {
      if (!measureSession) return;
      const minPts = measureState.mode === "area" ? 3 : 2;
      if (measureSession.points.length < minPts) { cancelMeasure(); return; }
      redrawMeasureSession(null);
      finishedMeasureLayers.push(measureSession.shapeLayer);
      measureSession.pointLayers.forEach(function (l) { finishedMeasureLayers.push(l); });
      measureSession.labelLayers.forEach(function (l) { finishedMeasureLayers.push(l); });
      // Built while measureSession is still non-null (buildMeasureDetail reads
      // its points for the final totals), but the session ends as of this
      // same event -- active must report false here, not "still active".
      // Confirmed live: without this override, gis-tools.js's readout got
      // stuck showing the last in-progress distance instead of resetting.
      const detail = buildMeasureDetail(true);
      detail.active = false;
      teardownMeasureListeners();
      measureSession = null;
      emit("measure", detail);
    }

    function cancelMeasure() {
      cancelMeasureSession();
      emit("measure", { mode: null, active: false, finished: false });
    }

    function clearMeasurements() {
      cancelMeasureSession();
      finishedMeasureLayers.forEach(function (l) { measureGroup.removeLayer(l); });
      finishedMeasureLayers = [];
      emit("measure", { mode: null, active: false, finished: false, cleared: true });
    }

    function setMeasureUnit(unit) {
      measureState.unit = unit === "metric" ? "metric" : "imperial";
      if (measureSession) { redrawMeasureSession(null); emit("measure", buildMeasureDetail(false)); }
    }

    /* ---- draw / annotate (task 3.9): point, line, polygon, rectangle, text.
       Same click-to-vertex/dblclick-finish interaction model as measure
       (line/polygon only -- point is one click, rectangle is two opposite
       corners, text is one click + inline text entry owned by gis-tools.js).
       Drawings are a plain-object registry -- {id,type,color,latlng?,
       latlngs?,text?} -- so they're already exactly what §7's getState().d
       and applyState() need, with no Leaflet object ever crossing out. */
    const drawGroup = L.layerGroup().addTo(map);
    const drawings = {};
    const drawingLayers = {};
    let drawIdCounter = 0;
    let drawSession = null; // {type, color, points, previewLayer}

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    // Text labels render through a divIcon's innerHTML -- d.text can arrive
    // via applyState() from a share link someone else authored, so it must
    // be escaped here, not trusted as safe markup.
    function renderDrawingLayer(d) {
      const color = d.color || "#c49a2a";
      if (d.type === "point") {
        return L.circleMarker(d.latlng, { radius: 6, color: color, weight: 2, fillColor: color, fillOpacity: 0.7 });
      }
      if (d.type === "text") {
        return L.marker(d.latlng, {
          icon: L.divIcon({
            className: "dts-gis-draw-text", iconSize: null,
            html: '<span style="color:' + color + '">' + escapeHtml(d.text || "") + "</span>"
          })
        });
      }
      if (d.type === "line") return L.polyline(d.latlngs, { color: color, weight: 3 });
      return L.polygon(d.latlngs, { color: color, weight: 2, fillColor: color, fillOpacity: 0.15 }); // polygon | rectangle
    }

    function addDrawing(d) {
      const id = d.id || ("d" + (++drawIdCounter) + "-" + Date.now().toString(36));
      const rec = Object.assign({}, d, { id: id });
      drawings[id] = rec;
      drawingLayers[id] = renderDrawingLayer(rec).addTo(drawGroup);
      emit("draw", { action: "added", drawing: rec });
      return id;
    }
    function removeDrawing(id) {
      if (!drawings[id]) return;
      drawGroup.removeLayer(drawingLayers[id]);
      delete drawingLayers[id];
      delete drawings[id];
      emit("draw", { action: "removed", id: id });
    }
    function clearDrawings() {
      drawGroup.clearLayers();
      Object.keys(drawings).forEach(function (id) { delete drawings[id]; });
      Object.keys(drawingLayers).forEach(function (id) { delete drawingLayers[id]; });
      emit("draw", { action: "cleared" });
    }
    function getDrawings() { return Object.keys(drawings).map(function (id) { return drawings[id]; }); }
    function setDrawingText(id, text) {
      const d = drawings[id];
      if (!d) return;
      d.text = text;
      drawGroup.removeLayer(drawingLayers[id]);
      drawingLayers[id] = renderDrawingLayer(d).addTo(drawGroup);
      emit("draw", { action: "updated", drawing: d });
    }

    function redrawDrawPreview(previewLatLng) {
      if (drawSession.previewLayer) { drawGroup.removeLayer(drawSession.previewLayer); drawSession.previewLayer = null; }
      const pts = previewLatLng ? drawSession.points.concat([previewLatLng]) : drawSession.points;
      if (pts.length < 2) return;
      const build = drawSession.type === "polygon" ? L.polygon : L.polyline;
      drawSession.previewLayer = build(pts, {
        color: drawSession.color, weight: 2, fillOpacity: 0.12, dashArray: previewLatLng ? "6 5" : null
      }).addTo(drawGroup);
    }

    function rectCorners(a, b) { return [[a.lat, a.lng], [a.lat, b.lng], [b.lat, b.lng], [b.lat, a.lng]]; }

    function finishDrawSession(pts) {
      const type = drawSession.type, color = drawSession.color;
      if (drawSession.previewLayer) drawGroup.removeLayer(drawSession.previewLayer);
      teardownDrawListeners();
      drawSession = null;
      if (type === "point") addDrawing({ type: "point", latlng: [pts[0].lat, pts[0].lng], color: color });
      else addDrawing({ type: type, latlngs: pts.map(function (p) { return [p.lat, p.lng]; }), color: color });
    }

    function onDrawClick(e) {
      const type = drawSession.type;
      if (type === "point") { finishDrawSession([e.latlng]); return; }
      if (type === "text") {
        const color = drawSession.color;
        teardownDrawListeners();
        drawSession = null;
        const id = addDrawing({ type: "text", latlng: [e.latlng.lat, e.latlng.lng], text: "", color: color });
        emit("draw", { action: "pending-text", id: id, containerPoint: [e.containerPoint.x, e.containerPoint.y] });
        return;
      }
      if (type === "rectangle") {
        drawSession.points.push(e.latlng);
        if (drawSession.points.length === 2) finishDrawSession(rectCorners(drawSession.points[0], drawSession.points[1]));
        return;
      }
      drawSession.points.push(e.latlng); // line | polygon
      redrawDrawPreview(null);
    }
    function onDrawMove(e) {
      if (!drawSession || !drawSession.points.length) return;
      redrawDrawPreview(e.latlng);
    }
    function onDrawDblClick(e) {
      L.DomEvent.stop(e);
      if (!drawSession) return;
      if (drawSession.points.length >= 2) {
        const a = map.latLngToContainerPoint(drawSession.points[drawSession.points.length - 1]);
        const b = map.latLngToContainerPoint(drawSession.points[drawSession.points.length - 2]);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 10) drawSession.points.pop();
      }
      const minPts = drawSession.type === "polygon" ? 3 : 2;
      if (drawSession.points.length < minPts) { cancelDraw(); return; }
      finishDrawSession(drawSession.points.slice());
    }

    function teardownDrawListeners() {
      map.doubleClickZoom.enable();
      containerEl.classList.remove("dts-gis-drawing");
      map.off("click", onDrawClick);
      map.off("mousemove", onDrawMove);
      map.off("dblclick", onDrawDblClick);
    }
    function cancelDrawSession() {
      if (!drawSession) return;
      if (drawSession.previewLayer) drawGroup.removeLayer(drawSession.previewLayer);
      teardownDrawListeners();
      drawSession = null;
    }
    function startDraw(type, color) {
      cancelDrawSession();
      drawSession = { type: type, color: color || "#c49a2a", points: [], previewLayer: null };
      containerEl.classList.add("dts-gis-drawing");
      map.doubleClickZoom.disable();
      map.on("click", onDrawClick);
      if (type === "line" || type === "polygon") { map.on("mousemove", onDrawMove); map.on("dblclick", onDrawDblClick); }
      emit("draw", { action: "started", type: type });
    }
    function cancelDraw() {
      cancelDrawSession();
      emit("draw", { action: "cancelled" });
    }

    /* ---- swipe compare (task 3.9/3.10): a draggable divider clipping one
       chosen layer to the region right of it, per §6. Clips the layer's own
       Leaflet pane via CSS clip-path rather than reassigning it to a
       dedicated pane -- simpler, and correct as long as each layer keeps a
       distinct zIndex (true of every layer in 04-SPEC §4's own example and
       the expected authoring convention; two layers sharing one zIndex
       would share one pane and both get clipped, a documented limitation,
       not a silent one). Reset is explicit: switching the swiped layer off
       via setLayerVisible clears the clip immediately, per §6's own
       "must reset cleanly" requirement. */
    let swipeLayerId = null;
    let swipeDivider = 0.5; // fraction 0..1 of map width

    // Real bug, found live: entry.leaflet.getPane() throws once the layer
    // has been removed from the map (map.removeLayer() nulls its internal
    // _map reference, and Leaflet's own getPane() reads this._map.getPane()
    // with no null guard) -- exactly what happens when the swiped layer is
    // switched off, since setLayerVisible's syncLayerToMap() call removes it
    // from the map *before* this code runs. Looking the pane up by name
    // through the map object itself is always safe, attached or not.
    function paneElFor(id) {
      const entry = layers[id];
      const name = entry && entry.leaflet && entry.leaflet.options && entry.leaflet.options.pane;
      return name ? map.getPane(name) : null;
    }
    function applySwipeClip() {
      const el = swipeLayerId && paneElFor(swipeLayerId);
      if (!el) return;
      el.style.clipPath = "inset(0 0 0 " + Math.round(map.getSize().x * swipeDivider) + "px)";
    }
    function clearSwipeClip(id) {
      const el = paneElFor(id);
      if (el) el.style.clipPath = "";
    }
    function setSwipeLayer(id) {
      if (swipeLayerId) clearSwipeClip(swipeLayerId);
      swipeLayerId = id || null;
      if (swipeLayerId) applySwipeClip();
      emit("swipechange", { layerId: swipeLayerId, divider: swipeDivider });
    }
    function setSwipeDivider(fraction) {
      swipeDivider = clamp(fraction, 0, 1);
      applySwipeClip();
      emit("swipechange", { layerId: swipeLayerId, divider: swipeDivider });
    }

    /* ---- time slider (task 3.10), per §6: shown when at least one visible
       layer has a timeField or the map declares timeSeries steps. Additive
       to §3's gisMap schema -- mapDoc.timeSeries.steps: [{id,label,date?}] --
       and to §4's layer schema -- def.timeStep (matches a step id: pure
       visibility swap, since "CPRA's projections are typically separate
       layers per scenario rather than a temporal field") or def.timeField
       (ArcGIS time query via the layer's own setTimeRange, for the case a
       source genuinely is temporal). A layer can only use one mechanism;
       both are supported per §6's explicit "support both". */
    let timeStepIndex = 0;
    let timePlayTimer = null;
    function timeSteps() { return (mapDoc.timeSeries && Array.isArray(mapDoc.timeSeries.steps)) ? mapDoc.timeSeries.steps : []; }
    function isTimeVisible(entry) {
      if (!entry.def.timeStep) return true;
      const steps = timeSteps();
      if (!steps.length) return true;
      const step = steps[timeStepIndex];
      return !!step && entry.def.timeStep === step.id;
    }
    function applyTimeFilters() {
      const steps = timeSteps();
      const step = steps[timeStepIndex];
      Object.keys(layers).forEach(function (id) {
        const entry = layers[id];
        syncLayerToMap(entry); // re-evaluates visibility including isTimeVisible()
        if (step && entry.def.timeField && entry.leaflet && typeof entry.leaflet.setTimeRange === "function") {
          const t = step.date ? new Date(step.date).getTime() : null;
          if (t != null && !isNaN(t)) entry.leaflet.setTimeRange(t, t);
        }
      });
    }
    function emitTimeChange() {
      const step = timeSteps()[timeStepIndex];
      emit("timechange", { index: timeStepIndex, stepId: step ? step.id : null, label: step ? step.label : null, playing: !!timePlayTimer });
    }
    function setTimeStep(index) {
      const steps = timeSteps();
      if (!steps.length) return;
      timeStepIndex = clamp(index, 0, steps.length - 1);
      applyTimeFilters();
      emitTimeChange();
    }
    function pauseTimeSeries() {
      if (!timePlayTimer) return;
      clearInterval(timePlayTimer);
      timePlayTimer = null;
      emitTimeChange();
    }
    function playTimeSeries() {
      const steps = timeSteps();
      if (timePlayTimer || steps.length < 2) return;
      timePlayTimer = setInterval(function () {
        const next = timeStepIndex + 1;
        if (next >= steps.length) { pauseTimeSeries(); return; }
        setTimeStep(next);
      }, 1800);
      emitTimeChange();
    }

    /* ---- highlight ---- */
    const highlightGroup = L.layerGroup().addTo(map);
    function clearHighlight() { highlightGroup.clearLayers(); }

    // Shared by highlight() and zoomToFeature() below. L.geoJSON's `style`
    // option only touches path layers (lines/polygons) -- a bare L.geoJSON()
    // on point features falls back to Leaflet's default blue marker icon,
    // confirmed live via the attribute table's row-click zoom against the
    // point fixture layer. pointToLayer is required to get the site's gold
    // circle-marker highlight instead.
    function highlightGeoJson(geojson, style) {
      const s = Object.assign({ color: "#c49a2a", weight: 3, fillOpacity: 0.08 }, style || {});
      return L.geoJSON(geojson, {
        style: s,
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, { radius: 8, color: s.color, weight: s.weight, fillColor: s.color, fillOpacity: 0.35 });
        }
      }).addTo(highlightGroup);
    }

    function highlight(layerId, selector, style) {
      const entry = layers[layerId];
      clearHighlight();
      if (!entry) { console.warn('[gis] highlight: unknown layer "' + layerId + '"'); return; }
      if (typeof entry.query !== "function") {
        // Becomes real once the layer factory wires up query() for this source.
        console.info('[gis] highlight: "' + layerId + '" isn\'t queryable yet');
        return;
      }
      entry.query(selector).then(function (geojson) {
        highlightGeoJson(geojson, style);
      }).catch(function (err) {
        console.warn("[gis] highlight query failed:", err);
        emit("error", { scope: "highlight", id: layerId, message: err.message });
      });
    }

    /* ---- filter/query builder (task 3.8) and attribute-table support ----
       Internal seams for js/gis/gis-tools.js, same "not §5 public API"
       footing as _getLayerBounds: the table needs raw feature rows and a
       row-click zoom, neither of which has an honest Leaflet-object-free
       shape to add to §5 itself. */
    function queryLayer(id, selector) {
      const entry = layers[id];
      if (!entry || typeof entry.query !== "function") return Promise.resolve({ type: "FeatureCollection", features: [] });
      return entry.query(selector || {});
    }

    // Split from setLayerFilter so a filter set via applyState() (share-link
    // restore) before the layer has finished loading -- entry.setFilter is
    // only attached once loadLayer()'s promise resolves -- is remembered and
    // re-applied from loadLayer's ready branch rather than silently dropped.
    function applyLayerFilter(entry) {
      if (typeof entry.setFilter !== "function") return; // not loaded yet, or sourceType doesn't support filtering
      if (entry.def.sourceType === "esriFeature") entry.setFilter(buildWhereFromConditions(entry.filterConditions));
      else entry.setFilter(buildPredicateFromConditions(entry.filterConditions));
    }

    function setLayerFilter(id, conditions) {
      const entry = layers[id];
      if (!entry) { console.warn('[gis] setLayerFilter: unknown layer "' + id + '"'); return; }
      const list = (Array.isArray(conditions) && conditions.length) ? conditions : null;
      entry.filterConditions = list;
      applyLayerFilter(entry);
      emit("layerchange", { id: id, filter: list });
    }

    // Called from loadLayer's ready branch. A no-op "1=1"/null-predicate
    // setFilter() on a layer with no filter ever set is not just wasted work:
    // confirmed live, esri-leaflet's FeatureLayer.setWhere() forces an
    // immediate full requery that races the layer's own just-started initial
    // grid load against the same service, and one of the two concurrent
    // request waves came back "Unable to complete operation." Only touch
    // setFilter here when a filter is actually pending (applyState() ran
    // before this layer finished loading) -- an ordinary first load leaves
    // the layer's own default query alone entirely.
    function applyPendingFilter(entry) {
      if (entry.filterConditions) applyLayerFilter(entry);
    }

    // Zooms to + highlights one feature (by the same objectIds selector
    // highlight() already takes). Reprojection/bounds math needs a real
    // Leaflet object, which is exactly why this lives here and not in
    // gis-tools.js -- same rationale as _getLayerBounds. Queries once and
    // reuses the result for both the highlight layer and the bounds fit,
    // rather than letting highlight() re-issue the same query.
    function zoomToFeature(id, selector) {
      const entry = layers[id];
      if (!entry || typeof entry.query !== "function") return Promise.resolve(false);
      clearHighlight();
      return entry.query(selector).then(function (fc) {
        if (!fc || !fc.features || !fc.features.length) return false;
        highlightGeoJson(fc, { color: "#f0c75e" });
        try {
          const bounds = L.geoJSON(fc).getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { animate: !reducedMotion, maxZoom: view.maxZoom });
        } catch (err) { /* geometry-less or malformed feature -- highlight still applied */ }
        return true;
      }).catch(function (err) {
        console.warn("[gis] zoomToFeature query failed:", err);
        return false;
      });
    }

    /* ---- view ---- */
    function setView(v) {
      if (!v) return;
      if (v.bbox) { map.fitBounds(v.bbox, { animate: !reducedMotion }); return; }
      if (v.center) { map.setView(v.center, typeof v.zoom === "number" ? v.zoom : map.getZoom(), { animate: !reducedMotion }); }
    }

    /* ---- tours: applies each step's directives via this same public API,
       per §5 -- gis-tour.js (a later task) is the presentational player
       (card, keyboard, off-script pill) that drives these methods ---- */
    const tourState = { tour: null };

    function findTour(id) { return tourList.find(function (t) { return t.id === id; }); }

    function applyLayersDirective(directive) {
      if (!directive) return;
      const off = directive.off || [];
      if (off.indexOf("*") !== -1) {
        Object.keys(layers).forEach(function (id) { setLayerVisible(id, false); });
      } else {
        off.forEach(function (id) { setLayerVisible(id, false); });
      }
      (directive.on || []).forEach(function (id) { setLayerVisible(id, true); });
      const opacity = directive.opacity || {};
      Object.keys(opacity).forEach(function (id) { setLayerOpacity(id, opacity[id]); });
    }

    function applyStep(index) {
      const tour = tourState.tour;
      if (!tour) return;
      const steps = tour.doc.steps || [];
      if (!steps.length) return;
      const i = clamp(index, 0, steps.length - 1);
      const step = steps[i];
      clearHighlight();
      applyLayersDirective(step.layers);
      if (step.basemap) setBasemap(step.basemap);
      setView(step.view);
      if (step.highlight) highlight(step.highlight.layerId, step.highlight, { color: "#f0c75e" });
      tour.index = i;
      emit("tourstep", { tourId: tour.doc.id, index: i, stepId: step.id });
    }

    function startTour(tourId) {
      const doc = findTour(tourId);
      if (!doc) { console.warn('[gis] startTour: unknown tour "' + tourId + '"'); return; }
      tourState.tour = { doc: doc, index: -1 };
      applyStep(0);
    }
    function tourNext() { if (tourState.tour) applyStep(tourState.tour.index + 1); }
    function tourPrev() { if (tourState.tour) applyStep(tourState.tour.index - 1); }
    function exitTour() {
      if (!tourState.tour) return;
      clearHighlight();
      tourState.tour = null;
      emit("tourstep", { tourId: null, index: null, stepId: null });
    }

    /* ---- state encoding (§7) ---- */
    function getState() {
      const c = map.getCenter();
      const l = {};
      const f = {};
      Object.keys(layers).forEach(function (id) {
        const entry = layers[id];
        const def = entry.def;
        const defaultVisible = !!def.visible;
        const defaultOpacity = typeof def.opacity === "number" ? def.opacity : 1;
        if (entry.visible !== defaultVisible || entry.opacity !== defaultOpacity) {
          l[id] = [entry.visible ? 1 : 0, round(entry.opacity, 2)];
        }
        if (entry.filterConditions) f[id] = entry.filterConditions;
      });
      return {
        v: 1,
        c: [round(c.lat, 5), round(c.lng, 5)],
        z: map.getZoom(),
        b: currentBasemapId,
        l: l,
        f: f,   // filters: layerId -> [{field, op, value}], per setLayerFilter
        t: tourState.tour ? [tourState.tour.doc.id, tourState.tour.index] : null,
        d: getDrawings()   // [{id,type,color,latlng?,latlngs?,text?}, …] -- draw/annotate task
      };
    }

    function applyState(obj) {
      try {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj.c) && typeof obj.z === "number") {
          setView({ center: obj.c, zoom: clamp(obj.z, view.minZoom, view.maxZoom) });
        }
        if (obj.b && basemapDefs[obj.b]) setBasemap(obj.b);
        if (obj.l && typeof obj.l === "object") {
          Object.keys(obj.l).forEach(function (id) {
            if (!layers[id]) return; // unknown ids ignored, per spec
            const pair = obj.l[id];
            if (Array.isArray(pair)) {
              setLayerVisible(id, !!pair[0]);
              if (typeof pair[1] === "number") setLayerOpacity(id, pair[1]);
            }
          });
        }
        if (obj.f && typeof obj.f === "object") {
          Object.keys(obj.f).forEach(function (id) {
            if (!layers[id]) return; // unknown ids ignored, per spec
            if (Array.isArray(obj.f[id])) setLayerFilter(id, obj.f[id]);
          });
        }
        if (Array.isArray(obj.t) && obj.t[0]) {
          startTour(obj.t[0]);
          if (typeof obj.t[1] === "number") applyStep(obj.t[1]);
        }
        if (Array.isArray(obj.d)) {
          clearDrawings();
          obj.d.forEach(function (rec) { if (rec && rec.type) addDrawing(rec); });
        }
      } catch (err) {
        console.warn("[gis] applyState: malformed state, falling back to default view:", err);
        setView(view);
      }
    }

    /* ---- lifecycle ---- */
    function invalidateSize() {
      map.invalidateSize();
      if (swipeLayerId) applySwipeClip(); // the divider is a px offset of map width -- must re-derive on resize
    }

    let suspendedLayers = null;
    function suspend() {
      if (suspendedLayers) return;
      suspendedLayers = [];
      map.eachLayer(function (layer) { suspendedLayers.push(layer); map.removeLayer(layer); });
    }
    function resume() {
      if (!suspendedLayers) return;
      suspendedLayers.forEach(function (layer) { layer.addTo(map); });
      suspendedLayers = null;
      map.invalidateSize();
    }

    function destroy() {
      pauseTimeSeries(); // clears the setInterval -- would otherwise keep firing against a torn-down map
      map.remove();
      containerEl.classList.remove("dts-gis-map");
      Object.keys(listeners).forEach(function (k) { delete listeners[k]; });
    }

    const instance = {
      invalidateSize: invalidateSize,
      suspend: suspend,
      resume: resume,
      destroy: destroy,
      setView: setView,
      setLayerVisible: setLayerVisible,
      setLayerOpacity: setLayerOpacity,
      setBasemap: setBasemap,
      highlight: highlight,
      clearHighlight: clearHighlight,
      startTour: startTour,
      tourNext: tourNext,
      tourPrev: tourPrev,
      exitTour: exitTour,
      getState: getState,
      applyState: applyState,
      on: on,
      // Internal seams for js/gis/gis-tools.js only -- not §5 public API.
      _getLayerBounds: getLayerBounds,
      _queryLayer: queryLayer,
      _setLayerFilter: setLayerFilter,
      _zoomToFeature: zoomToFeature,
      _geolocate: geolocate,
      _startMeasure: startMeasure,
      _finishMeasure: finishMeasure,
      _cancelMeasure: cancelMeasure,
      _clearMeasurements: clearMeasurements,
      _setMeasureUnit: setMeasureUnit,
      _startDraw: startDraw,
      _cancelDraw: cancelDraw,
      _addDrawing: addDrawing,
      _removeDrawing: removeDrawing,
      _clearDrawings: clearDrawings,
      _getDrawings: getDrawings,
      _setDrawingText: setDrawingText,
      _setSwipeLayer: setSwipeLayer,
      _setSwipeDivider: setSwipeDivider,
      _setTimeStep: setTimeStep,
      _playTimeSeries: playTimeSeries,
      _pauseTimeSeries: pauseTimeSeries
    };

    if (opts.stateParam) {
      const decoded = decodeStateParam(opts.stateParam);
      if (decoded) applyState(decoded);
    } else if (opts.tourId) {
      startTour(opts.tourId);
    } else if (opts.initialView) {
      setView(opts.initialView);
    }

    if (typeof opts.onStateChange === "function") {
      ["viewchange", "layerchange", "tourstep"].forEach(function (evt) {
        on(evt, function () { opts.onStateChange(getState()); });
      });
    }

    // setTimeout, not a synchronous emit: mount()'s promise resolution is a
    // microtask, so a caller's `.then(inst => inst.on("ready", cb))` is always
    // attached before this macrotask fires.
    setTimeout(function () { emit("ready", instance); }, 0);

    return instance;
  }

  function decodeStateParam(param) {
    try {
      const json = decodeURIComponent(escape(atob(param.replace(/-/g, "+").replace(/_/g, "/"))));
      return JSON.parse(json);
    } catch (err) {
      console.warn("[gis] decodeStateParam: malformed state param:", err);
      return null;
    }
  }

  window.DTSGis = { mount: mount };
})();
