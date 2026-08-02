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
          return L.circleMarker(latlng, {
            radius: typeof styleOpts.pointRadius === "number" ? styleOpts.pointRadius : 5,
            color: styleOpts.color || "#c49a2a",
            weight: typeof styleOpts.weight === "number" ? styleOpts.weight : 1.5,
            fillColor: styleOpts.fillColor || styleOpts.color || "#c49a2a",
            fillOpacity: typeof styleOpts.fillOpacity === "number" ? styleOpts.fillOpacity : 0.6
          });
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
      const shouldShow = entry.visible && isInZoomRange(entry.def);
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
        d: []   // drawings -- draw/annotate task
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
      } catch (err) {
        console.warn("[gis] applyState: malformed state, falling back to default view:", err);
        setView(view);
      }
    }

    /* ---- lifecycle ---- */
    function invalidateSize() { map.invalidateSize(); }

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
      _zoomToFeature: zoomToFeature
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
