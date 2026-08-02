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
   data layers there. Legend/identify/pagination helpers land
   with the tasks that need them (layer panel, identify).
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

  window.DTSGisEsri = { buildDynamic: buildDynamic, buildFeature: buildFeature };
})();
