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
      },
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

    return { leaflet: layer, query: query };
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
