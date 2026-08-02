/* ============================================================
   ArcGIS REST helpers -- window.DTSGisEsri
   ------------------------------------------------------------
   Per docs/plans/gis/04-SPEC-gis-engine.md §4 (layer schema) and
   §8 (Iberia enforcement). Builds the two ArcGIS-backed layer
   types that need more than a one-line esri-leaflet call:
   esriDynamic (image overlay, no client query) and esriFeature
   (client-side vector, with a query() that carries the parish
   envelope per §8 defence 2). esriImage is trivial enough to
   build inline in gis-viewer.js -- shared by both basemaps and
   data layers there. Also identifyFeatures + field-alias lookup
   (task 3.7, used by gis-viewer.js's click handling and
   gis-tools.js's popup content, respectively). The legend fetch
   lives directly in gis-tools.js instead -- it's a plain fetch,
   nothing esri-leaflet-specific to wrap.
   ============================================================ */
(function () {
  "use strict";

  function baseStyle(styleOpts) {
    return {
      color: styleOpts.color || "#c49a2a",
      weight: typeof styleOpts.weight === "number" ? styleOpts.weight : 1.5,
      fillColor: styleOpts.fillColor || styleOpts.color || "#c49a2a",
      fillOpacity: typeof styleOpts.fillOpacity === "number" ? styleOpts.fillOpacity : 0.18,
      dashArray: styleOpts.dashArray || null
    };
  }

  function classifiedColor(classify, value) {
    if (!classify || !Array.isArray(classify.breaks)) return null;
    for (let i = 0; i < classify.breaks.length; i++) {
      if (value <= classify.breaks[i]) return classify.colors[i];
    }
    return classify.colors[classify.colors.length - 1];
  }

  function buildDynamic(def, ctx) {
    const opts = {
      url: def.url,
      layers: def.layers,
      opacity: typeof def.opacity === "number" ? def.opacity : 1,
      attribution: def.attribution || ""
    };
    if (ctx && ctx.pane) opts.pane = ctx.pane;
    const layer = L.esri.dynamicMapLayer(opts);
    return { leaflet: layer, query: null }; // image layer -- identify is a separate task
  }

  function buildFeature(def, ctx) {
    const styleOpts = def.style || {};
    // esri-leaflet's FeatureLayer has no layerId option -- it queries
    // whatever URL it's given verbatim, so the sublayer id has to be part
    // of the URL itself (confirmed against a live service: without this,
    // every query silently hit .../MapServer/query instead of .../MapServer/0/query).
    const layerId = typeof def.layerId === "number" ? def.layerId : 0;
    const featureUrl = def.url.replace(/\/$/, "") + "/" + layerId;

    const opts = {
      url: featureUrl,
      precision: 6,
      style: function (feature) {
        const style = baseStyle(styleOpts);
        const c = feature && feature.properties && classifiedColor(styleOpts.classify, feature.properties[styleOpts.classify && styleOpts.classify.field]);
        if (c) { style.color = c; style.fillColor = c; }
        return style;
      }
    };
    // Real bug, found live task 3.14 against the real Iberia hydrography
    // (polyline) layer: the vendored esri-leaflet 3.0.19 FeatureLayer's own
    // _redraw() unconditionally calls this.options.pointToLayer(feature,
    // L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]))
    // whenever pointToLayer is set and the existing layer object has
    // setStyle -- true of Polyline/Polygon too, not just point markers, and
    // with no geometry.type check at all. _redraw() runs whenever a feature
    // already on the map is re-encountered (e.g. a line spanning more than
    // one of esri-leaflet's internal query tiles, exactly what a
    // parish-wide drainage network does on pan/zoom): for a LineString/
    // MultiLineString/Polygon, geometry.coordinates[0]/[1] are whole
    // coordinate arrays, not lat/lng numbers, so L.latLng() throws "Invalid
    // LatLng object" as an uncaught exception outside this file's own
    // try/catch (gis-viewer.js only wraps the initial layer build, not
    // esri-leaflet's own later internal redraws). Leaflet core's
    // geometryToLayer -- what actually builds each feature the first time,
    // via createNewLayer() -- already checks geometry.type before ever
    // calling pointToLayer, so omitting it here for non-point layers loses
    // nothing on that path; it only starves the buggy branch above of a
    // truthy this.options.pointToLayer to call. pointRadius is only ever
    // set on this map's actual point layers, so it's used as the geometry
    // signal here rather than adding a new authored field to the schema
    // for a vendored-library workaround.
    if (typeof styleOpts.pointRadius === "number") {
      opts.pointToLayer = function (feature, latlng) {
        const pointOpts = {
          radius: styleOpts.pointRadius,
          color: styleOpts.color || "#c49a2a",
          weight: typeof styleOpts.weight === "number" ? styleOpts.weight : 1.5,
          fillColor: styleOpts.fillColor || styleOpts.color || "#c49a2a",
          fillOpacity: typeof styleOpts.fillOpacity === "number" ? styleOpts.fillOpacity : 0.6
        };
        // Same fix as gis-viewer.js's buildGeoJsonLayer: pane must be
        // forwarded explicitly -- it is not inherited from the parent
        // layer's own pane option. Real bug, found live testing task
        // 3.10's swipe compare against a point layer.
        if (ctx && ctx.pane) pointOpts.pane = ctx.pane;
        return L.circleMarker(latlng, pointOpts);
      };
    }
    if (typeof def.minZoom === "number") opts.minZoom = def.minZoom;
    if (typeof def.maxZoom === "number") opts.maxZoom = def.maxZoom;
    if (ctx && ctx.pane) opts.pane = ctx.pane;

    const layer = L.esri.featureLayer(opts);

    const query = (def.queryable === false) ? null : function (selector) {
      return new Promise(function (resolve, reject) {
        let q = layer.query();
        if (ctx && ctx.envelopeBounds) q = q.intersects(ctx.envelopeBounds); // §8 defence 2
        if (selector && selector.where) q = q.where(selector.where);
        if (selector && selector.objectIds) q = q.objectIds(selector.objectIds);
        q.run(function (error, featureCollection) {
          if (error) reject(error); else resolve(featureCollection);
        });
      });
    };

    // Filter/query-builder task (3.8): esri-leaflet's FeatureLayer ships its
    // own setWhere(where, callback) that requeries the service and swaps the
    // displayed feature set -- this *is* the "applies as a where clause"
    // mechanism §6 asks for, not something to reimplement. It's independent
    // of query() above (a fresh, unfiltered Query object each call), so the
    // attribute table always sees every row regardless of an active map filter.
    const setFilter = (def.queryable === false) ? null : function (where) {
      layer.setWhere(where || "1=1");
    };

    return { leaflet: layer, query: query, setFilter: setFilter };
  }

  /* ---- identify (task 3.7) -- esriDynamic only; esriFeature/geojson clicks
     resolve locally in gis-viewer.js since the feature is already client-side.
     Uses the task's raw third callback argument (the untouched ArcGIS JSON),
     not the GeoJSON conversion, because each result carries its own true
     sublayerId -- needed to fetch that sublayer's field aliases below, and
     an esriDynamic layer can have several sublayers with different schemas. ---- */
  function identify(def, map, latlng) {
    return new Promise(function (resolve) {
      L.esri.identifyFeatures({ url: def.url })
        .on(map)
        .at(latlng)
        .layers("visible:" + (Array.isArray(def.layers) && def.layers.length ? def.layers.join(",") : "all"))
        .tolerance(6)
        .run(function (error, featureCollection, rawResponse) {
          if (error || !rawResponse || !Array.isArray(rawResponse.results)) { resolve([]); return; }
          resolve(rawResponse.results.map(function (r) {
            return { sublayerId: r.layerId, sublayerName: r.layerName, properties: r.attributes || {} };
          }));
        });
    });
  }

  /* ---- field aliases for the popup "no popup.fields configured" fallback
     (04-SPEC §6: "show all non-system fields with their ArcGIS aliases").
     Cached per url+sublayerId -- the layer panel's legend fetch uses the
     same per-service caching idea in gis-tools.js. ---- */
  const fieldsCache = {};
  function fetchFieldAliases(url, sublayerId) {
    const key = url + "|" + sublayerId;
    if (fieldsCache[key]) return fieldsCache[key];
    fieldsCache[key] = fetch(url.replace(/\/$/, "") + "/" + sublayerId + "?f=pjson").then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      const aliases = {};
      (data.fields || []).forEach(function (f) { aliases[f.name] = f.alias || f.name; });
      return aliases;
    }).catch(function (err) {
      console.warn("[gis] field alias fetch failed for " + key + ":", err);
      return {};
    });
    return fieldsCache[key];
  }

  window.DTSGisEsri = {
    buildDynamic: buildDynamic,
    buildFeature: buildFeature,
    identify: identify,
    fetchFieldAliases: fetchFieldAliases
  };
})();
