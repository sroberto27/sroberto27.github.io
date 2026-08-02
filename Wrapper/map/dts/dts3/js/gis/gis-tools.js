/* ============================================================
   GIS tool UI -- window.DTSGisTools
   ------------------------------------------------------------
   Per docs/plans/gis/04-SPEC-gis-engine.md §6 / 09-BUILD-PLAN.md
   tasks 3.6 (layer panel, basemap switcher, legend) and 3.7
   (identify/popups). Later tasks (attribute table, filter,
   measure, draw, swipe, timeline, print/export, share) extend
   this same file.

   Talks to the map almost entirely through window.DTSGis's public
   §5 API (setLayerVisible/setLayerOpacity/setBasemap/getState/on),
   the same seam gis-tour.js uses -- plus one narrow, explicitly
   internal exception: instance._getLayerBounds(id), for the
   zoom-to-extent button, which has no honest answer through
   ArcGIS service metadata alone (see the comment in gis-viewer.js).
   Everything else here reads mapDoc (the static document) and the
   instance's events/getState() to keep its own small state model
   in sync -- it never touches a Leaflet object. The identify popup
   (task 3.7) follows the same rule: it's positioned from the
   "identify" event's containerPoint, not a Leaflet popup object.
   ============================================================ */
(function () {
  "use strict";

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  const ICONS = {
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    legend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="3.5" cy="6" r="1.5" fill="currentColor"/><circle cx="3.5" cy="12" r="1.5" fill="currentColor"/><circle cx="3.5" cy="18" r="1.5" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5.5M12 7.6v.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    table: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15" stroke="currentColor" stroke-width="1.6"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V18l-4 2v-7.5L4 5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
  };

  function mount(containerEl, mapDoc, instance, opts) {
    opts = opts || {};
    const tools = mapDoc.tools || {};
    const groups = Array.isArray(mapDoc.groups) ? mapDoc.groups : [];
    const layerDefs = Array.isArray(mapDoc.layers) ? mapDoc.layers : [];
    const offListeners = [];

    /* ---- local state model, seeded from the static doc + getState(),
       kept in sync via events -- never read off a Leaflet object ---- */
    const initial = instance.getState();
    const state = { zoom: initial.z, basemap: initial.b, layers: {}, filters: initial.f || {} };
    layerDefs.forEach(function (def) {
      const diff = initial.l && initial.l[def.id];
      state.layers[def.id] = {
        visible: diff ? !!diff[0] : !!def.visible,
        opacity: diff && typeof diff[1] === "number" ? diff[1] : (typeof def.opacity === "number" ? def.opacity : 1),
        status: "pending"
      };
    });

    const host = el("div", { class: "dts-gis-tools" });
    containerEl.appendChild(host);

    const toolbar = el("div", { class: "dts-gis-toolbar" });
    host.appendChild(toolbar);

    const panels = {};
    const rowRefs = {};
    let openPanel = null;

    function closePanel() {
      if (!openPanel) return;
      panels[openPanel].panel.hidden = true;
      panels[openPanel].btn.setAttribute("aria-expanded", "false");
      openPanel = null;
    }

    function openPanelByName(name) {
      if (openPanel === name) { closePanel(); return; }
      closePanel();
      panels[name].panel.hidden = false;
      panels[name].btn.setAttribute("aria-expanded", "true");
      openPanel = name;
      if (panels[name].onOpen) panels[name].onOpen();
    }

    function registerPanel(name, btn, panel, onOpen) {
      panels[name] = { btn: btn, panel: panel, onOpen: onOpen };
      btn.addEventListener("click", function () { openPanelByName(name); });
      host.appendChild(panel);
    }

    /* ================= layer panel ================= */
    if (tools.layerPanel !== false && layerDefs.length) {
      const layerBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Layers",
        "aria-expanded": "false", "aria-controls": "dtsGisLayerPanel", html: ICONS.layers
      });
      toolbar.appendChild(layerBtn);

      const layerBody = el("div", { class: "dts-gis-panel-body" });
      const layerPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisLayerPanel", role: "region", "aria-label": "Layers", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Layers" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close layers panel", html: ICONS.close })
        ]),
        layerBody
      ]);
      layerPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);

      const byGroup = {};
      layerDefs.slice().sort(function (a, b) { return (a.zIndex || 0) - (b.zIndex || 0); })
        .forEach(function (def) { (byGroup[def.group] = byGroup[def.group] || []).push(def); });

      const groupList = groups.length ? groups : Object.keys(byGroup).map(function (g) { return { id: g, title: g, open: true }; });

      groupList.forEach(function (g) {
        const defs = byGroup[g.id] || [];
        if (!defs.length) return;
        const groupBody = el("div", { class: "dts-gis-group-body" });
        if (g.open === false) groupBody.hidden = true;
        const toggleBtn = el("button", {
          class: "dts-gis-group-toggle", type: "button", "aria-expanded": g.open === false ? "false" : "true"
        }, [el("span", { text: g.title || g.id })]);
        toggleBtn.addEventListener("click", function () {
          const open = toggleBtn.getAttribute("aria-expanded") === "true";
          toggleBtn.setAttribute("aria-expanded", open ? "false" : "true");
          groupBody.hidden = open;
        });
        const allBtn = el("button", { class: "dts-gis-group-action", type: "button", text: "All" });
        const noneBtn = el("button", { class: "dts-gis-group-action", type: "button", text: "None" });
        allBtn.addEventListener("click", function () { defs.forEach(function (d) { setLayerVisible(d.id, true); }); });
        noneBtn.addEventListener("click", function () { defs.forEach(function (d) { setLayerVisible(d.id, false); }); });

        defs.forEach(function (def) { groupBody.appendChild(buildLayerRow(def)); });

        layerBody.appendChild(el("div", { class: "dts-gis-group" }, [
          el("div", { class: "dts-gis-group-head" }, [toggleBtn, el("div", { class: "dts-gis-group-actions" }, [allBtn, noneBtn])]),
          groupBody
        ]));
      });

      registerPanel("layers", layerBtn, layerPanel);
    }

    function setLayerVisible(id, visible) {
      instance.setLayerVisible(id, visible);
      state.layers[id].visible = visible;
      if (rowRefs[id]) rowRefs[id].checkbox.checked = visible;
    }

    function refreshZoomGate(id) {
      const ref = rowRefs[id];
      if (!ref) return;
      const def = ref.def;
      const inRange = !(typeof def.minZoom === "number" && state.zoom < def.minZoom) &&
        !(typeof def.maxZoom === "number" && state.zoom > def.maxZoom);
      ref.zoomHint.hidden = inRange;
      ref.root.classList.toggle("is-zoomed-out", !inRange);
    }

    function buildLayerRow(def) {
      const s = state.layers[def.id];
      const checkbox = el("input", { type: "checkbox" });
      checkbox.checked = s.visible;
      checkbox.addEventListener("change", function () { setLayerVisible(def.id, checkbox.checked); });

      const infoBtn = el("button", {
        class: "dts-gis-layer-info", type: "button", "aria-label": "More about " + (def.title || def.id), "aria-expanded": "false", html: ICONS.info
      });

      const statusEl = el("div", { class: "dts-gis-layer-status", text: "Unavailable right now" });
      statusEl.hidden = true;
      const zoomHint = el("div", { class: "dts-gis-layer-status", text: "Zoom in to see this layer" });
      zoomHint.hidden = true;

      const opacityInput = el("input", { type: "range", min: "0", max: "1", step: "0.05" });
      opacityInput.value = String(s.opacity);
      opacityInput.setAttribute("aria-label", "Opacity for " + (def.title || def.id));
      opacityInput.addEventListener("input", function () {
        const v = parseFloat(opacityInput.value);
        instance.setLayerOpacity(def.id, v);
        state.layers[def.id].opacity = v;
      });

      const zoomStatus = el("span", { class: "dts-gis-sr-status", role: "status" });
      const zoomBtn = el("button", { class: "dts-gis-layer-zoomto", type: "button" }, [
        el("span", { html: ICONS.target }), document.createTextNode(" Zoom to extent")
      ]);
      zoomBtn.addEventListener("click", function () {
        zoomStatus.textContent = "Locating extent…";
        const boundsPromise = instance._getLayerBounds ? instance._getLayerBounds(def.id) : Promise.resolve(null);
        boundsPromise.then(function (bounds) {
          if (bounds) { instance.setView({ bbox: bounds }); zoomStatus.textContent = ""; }
          else zoomStatus.textContent = "Extent isn't available for this layer yet.";
        });
      });

      const detail = el("div", { class: "dts-gis-layer-detail" }, [
        def.description ? el("p", { class: "dts-gis-layer-desc", text: def.description }) : null,
        (def.attribution || def.updated) ? el("p", { class: "dts-gis-layer-meta", text: [def.attribution, def.updated].filter(Boolean).join(" · ") }) : null,
        el("label", { class: "dts-gis-layer-opacity" }, [document.createTextNode("Opacity"), opacityInput]),
        zoomBtn,
        zoomStatus
      ]);
      detail.hidden = true;
      infoBtn.addEventListener("click", function () {
        const open = infoBtn.getAttribute("aria-expanded") === "true";
        infoBtn.setAttribute("aria-expanded", open ? "false" : "true");
        detail.hidden = open;
      });

      const root = el("div", { class: "dts-gis-layer" }, [
        el("div", { class: "dts-gis-layer-main" }, [
          el("label", { class: "dts-gis-layer-check" }, [checkbox, el("span", { text: def.title || def.id })]),
          infoBtn
        ]),
        statusEl, zoomHint, detail
      ]);

      rowRefs[def.id] = { root: root, checkbox: checkbox, statusEl: statusEl, zoomHint: zoomHint, def: def };
      refreshZoomGate(def.id);
      return root;
    }

    /* ================= legend panel ================= */
    const legendCache = {};
    function fetchArcgisLegend(url) {
      if (legendCache[url]) return legendCache[url];
      legendCache[url] = fetch(url + "/legend?f=pjson").then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).catch(function (err) {
        console.warn("[gis-tools] legend fetch failed for " + url + ":", err);
        return null;
      });
      return legendCache[url];
    }

    function legendRowsForCustom(def) {
      return Promise.resolve((def.legendItems || []).map(function (item) {
        return { label: item.label, color: item.color };
      }));
    }

    function legendRowsForStyle(def) {
      const style = def.style || {};
      return Promise.resolve([{ label: def.title || def.id, color: style.color || style.fillColor || "#c49a2a" }]);
    }

    function legendRowsForArcgis(def) {
      return fetchArcgisLegend(def.url).then(function (data) {
        if (!data || !Array.isArray(data.layers)) return legendRowsForStyle(def);
        const wantIds = def.sourceType === "esriFeature" ? [def.layerId] : (def.layers || []);
        const matched = data.layers.filter(function (l) { return wantIds.indexOf(l.layerId) !== -1; });
        const rows = [];
        matched.forEach(function (l) {
          (l.legend || []).forEach(function (item) {
            rows.push({ label: item.label || l.layerName, swatch: "data:" + item.contentType + ";base64," + item.imageData });
          });
        });
        return rows.length ? rows : legendRowsForStyle(def);
      });
    }

    function legendRowsFor(def) {
      const mode = (def.legend && def.legend.mode) || "auto";
      if (mode === "none") return Promise.resolve([]);
      if (mode === "custom") return legendRowsForCustom(def);
      if (def.sourceType === "esriDynamic" || def.sourceType === "esriFeature") return legendRowsForArcgis(def);
      return legendRowsForStyle(def);
    }

    function buildLegendSwatch(row) {
      if (row.swatch) return el("img", { class: "dts-gis-legend-swatch", src: row.swatch, alt: "" });
      return el("span", { class: "dts-gis-legend-swatch", style: "background:" + (row.color || "#c49a2a") });
    }

    function renderLegend() {
      legendBody.textContent = "";
      const visible = layerDefs.filter(function (def) { return state.layers[def.id].visible && state.layers[def.id].status !== "unavailable"; });
      if (!visible.length) {
        legendBody.appendChild(el("p", { class: "dts-gis-legend-empty", text: "No layers are visible right now." }));
        return;
      }
      visible.forEach(function (def) {
        const section = el("div", { class: "dts-gis-legend-section" }, [el("h4", { text: def.title || def.id })]);
        legendBody.appendChild(section);
        legendRowsFor(def).then(function (rows) {
          rows.forEach(function (row) {
            section.appendChild(el("div", { class: "dts-gis-legend-row" }, [buildLegendSwatch(row), el("span", { text: row.label })]));
          });
        });
      });
    }

    let legendBody = null;
    if (tools.legend !== false && layerDefs.length) {
      const legendBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Legend",
        "aria-expanded": "false", "aria-controls": "dtsGisLegendPanel", html: ICONS.legend
      });
      toolbar.appendChild(legendBtn);

      legendBody = el("div", { class: "dts-gis-panel-body" });
      const legendPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisLegendPanel", role: "region", "aria-label": "Legend", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Legend" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close legend panel", html: ICONS.close })
        ]),
        legendBody
      ]);
      legendPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("legend", legendBtn, legendPanel, renderLegend);
    }

    /* ================= basemap switcher ================= */
    if (tools.basemapSwitcher !== false && Array.isArray(mapDoc.basemaps) && mapDoc.basemaps.length > 1) {
      const select = el("select", { class: "dts-gis-basemap-select", "aria-label": "Basemap" });
      mapDoc.basemaps.forEach(function (b) {
        select.appendChild(el("option", { value: b.id, text: b.title || b.id }));
      });
      select.value = state.basemap;
      select.addEventListener("change", function () { instance.setBasemap(select.value); });
      toolbar.appendChild(select);
      offListeners.push(instance.on("layerchange", function (detail) {
        if (detail && detail.type === "basemap") { state.basemap = detail.id; select.value = detail.id; }
      }));
    }

    /* ================= identify / popup (task 3.7) =================
       gis-viewer.js emits "identify" -- an addition to §5's documented
       event set (ready/viewchange/layerchange/tourstep/error), same
       spirit as extending DTS_CONFIG rather than reshaping it -- with
       {latlng, containerPoint, hits:[{layerId, sublayerId, properties}]}.
       This popup is a plain positioned div, not a Leaflet popup: it only
       needs containerPoint (already relative to the map container, which
       this module owns the overlay for) and never needs the map object
       itself, so identify stays on the same "no Leaflet objects here"
       footing as the rest of this file. It doesn't track the map on pan/
       zoom -- closing on the next viewchange is simpler than repositioning
       and matches how most identify popups behave anyway. */
    let popupEl = null;
    function closePopup() {
      if (!popupEl) return;
      const restore = popupEl._dtsRestoreFocus;
      popupEl.remove();
      popupEl = null;
      if (restore && typeof restore.focus === "function") restore.focus();
    }

    const SYSTEM_FIELD_RE = /^(objectid|fid|globalid|shape)([._]|$)/i;
    function isSystemField(name) { return SYSTEM_FIELD_RE.test(name); }

    function formatFieldValue(field, raw) {
      if (raw === null || raw === undefined || raw === "") return "—";
      if (field.format === "number" && typeof raw === "number") return raw.toLocaleString() + (field.suffix || "");
      return String(raw);
    }

    function renderTemplate(tpl, props) {
      return tpl.replace(/\{(\w+)\}/g, function (m, key) {
        return (key in props) ? String(props[key]) : "";
      });
    }

    function fieldsForHit(hit, def) {
      const props = hit.properties || {};
      if (def && def.popup && Array.isArray(def.popup.fields) && def.popup.fields.length) {
        return Promise.resolve(def.popup.fields);
      }
      const keys = Object.keys(props).filter(function (k) { return !isSystemField(k); });
      const isEsri = def && (def.sourceType === "esriFeature" || def.sourceType === "esriDynamic");
      if (isEsri && typeof hit.sublayerId === "number" && window.DTSGisEsri) {
        return DTSGisEsri.fetchFieldAliases(def.url, hit.sublayerId).then(function (aliases) {
          return keys.map(function (k) { return { name: k, label: aliases[k] || k }; });
        });
      }
      return Promise.resolve(keys.map(function (k) { return { name: k, label: k }; }));
    }

    function buildPopupSection(hit, def) {
      const props = hit.properties || {};
      const popupCfg = (def && def.popup) || {};
      const title = popupCfg.title ? renderTemplate(popupCfg.title, props) : (def ? (def.title || def.id) : "Feature");
      return fieldsForHit(hit, def).then(function (fields) {
        const rows = fields.map(function (f) {
          return el("div", { class: "dts-gis-popup-row" }, [
            el("span", { class: "dts-gis-popup-key", text: f.label || f.name }),
            el("span", { class: "dts-gis-popup-val", text: formatFieldValue(f, props[f.name]) })
          ]);
        });
        return el("div", { class: "dts-gis-popup-section" }, [el("h4", { text: title })].concat(rows));
      });
    }

    function showPopup(containerPoint, sectionEls) {
      const closeBtn = el("button", { class: "dts-gis-popup-close", type: "button", "aria-label": "Close", html: ICONS.close });
      const body = el("div", { class: "dts-gis-popup-body" }, sectionEls);
      const popup = el("div", { class: "dts-gis-popup", role: "dialog", "aria-label": "Feature details" }, [closeBtn, body]);
      closeBtn.addEventListener("click", closePopup);

      const flipDown = containerPoint[1] < 160;
      popup.classList.toggle("is-below", flipDown);
      const hostWidth = containerEl.clientWidth || 0;
      const x = hostWidth ? Math.min(Math.max(containerPoint[0], 150), Math.max(150, hostWidth - 150)) : containerPoint[0];
      popup.style.left = x + "px";
      popup.style.top = containerPoint[1] + "px";

      popup._dtsRestoreFocus = document.activeElement;
      host.appendChild(popup);
      popupEl = popup;
      closeBtn.focus();
    }

    if (tools.identify !== false) {
      offListeners.push(instance.on("identify", function (detail) {
        closePopup();
        if (!detail || !detail.hits || !detail.hits.length) return;
        Promise.all(detail.hits.map(function (hit) {
          const def = layerDefs.find(function (d) { return d.id === hit.layerId; });
          return buildPopupSection(hit, def);
        })).then(function (sections) {
          showPopup(detail.containerPoint, sections);
        });
      }));
      function onKeyDown(e) { if (e.key === "Escape") closePopup(); }
      document.addEventListener("keydown", onKeyDown);
      offListeners.push(function () { document.removeEventListener("keydown", onKeyDown); });
    }

    /* ================= attribute table + filter/query builder (task 3.8) =================
       Per §6: table is "one tab per queryable layer", offered only for
       geojson/esriFeature; filter is field+operator+value rows ANDed,
       applied as a where clause (esriFeature) or predicate (geojson) via
       instance._setLayerFilter -- gis-viewer.js decides which. The active
       filter is always shown as a removable chip over the map so it's
       never invisibly on, independent of whether either panel is open. */
    const queryableDefs = layerDefs.filter(function (def) {
      return (def.sourceType === "geojson" || def.sourceType === "esriFeature") && def.queryable !== false;
    });

    const rowsCache = {};
    function queryRows(def) {
      if (!rowsCache[def.id]) {
        rowsCache[def.id] = (instance._queryLayer ? instance._queryLayer(def.id, {}) : Promise.resolve(null))
          .then(function (fc) { return (fc && fc.features) || []; });
      }
      return rowsCache[def.id];
    }

    function rowFeatureId(f) {
      if (f.id != null) return f.id;
      const props = f.properties || {};
      return props.OBJECTID != null ? props.OBJECTID : props.id;
    }

    // Mirrors gis-viewer.js's buildPredicateFromConditions exactly, kept
    // local rather than shared: this file never reaches into gis-viewer.js
    // beyond the instance/_-prefixed seams, and the function is a few lines.
    // Used so the attribute table's row set reflects an active query-builder
    // filter, not just its own text box.
    function matchesConditions(props, conditions) {
      if (!conditions || !conditions.length) return true;
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
    }

    const fieldsCacheByLayer = {};
    function fieldsForLayer(def) {
      if (fieldsCacheByLayer[def.id]) return fieldsCacheByLayer[def.id];
      let p;
      if (def.popup && Array.isArray(def.popup.fields) && def.popup.fields.length) {
        p = Promise.resolve(def.popup.fields.map(function (f) { return { name: f.name, label: f.label || f.name }; }));
      } else if (def.sourceType === "esriFeature" && window.DTSGisEsri) {
        p = DTSGisEsri.fetchFieldAliases(def.url, typeof def.layerId === "number" ? def.layerId : 0).then(function (aliases) {
          return Object.keys(aliases).filter(function (k) { return !isSystemField(k); }).map(function (k) { return { name: k, label: aliases[k] }; });
        });
      } else {
        p = queryRows(def).then(function (rows) {
          const keys = rows.length ? Object.keys(rows[0].properties || {}).filter(function (k) { return !isSystemField(k); }) : [];
          return keys.map(function (k) { return { name: k, label: k }; });
        });
      }
      fieldsCacheByLayer[def.id] = p;
      return p;
    }

    function csvEscape(v) {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function downloadCsv(filename, fields, rows) {
      const header = fields.map(function (f) { return csvEscape(f.label || f.name); }).join(",");
      const lines = rows.map(function (f) {
        const props = f.properties || {};
        return fields.map(function (fld) { return csvEscape(props[fld.name]); }).join(",");
      });
      const blob = new Blob([[header].concat(lines).join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    /* ---- filter chips (always visible when a filter is active, regardless
       of whether either panel is open) ---- */
    let renderChips = function () {};
    let renderFilterBuilder = function () {};
    let filterLayerId = queryableDefs.length ? queryableDefs[0].id : null;

    if (tools.filter !== false && queryableDefs.length && instance._setLayerFilter) {
      const chipsHost = el("div", { class: "dts-gis-filter-chips" });
      host.appendChild(chipsHost);

      renderChips = function () {
        chipsHost.textContent = "";
        Object.keys(state.filters).forEach(function (id) {
          const conditions = state.filters[id];
          if (!conditions || !conditions.length) return;
          const def = layerDefs.find(function (d) { return d.id === id; });
          const label = (def ? (def.title || def.id) : id) + " · " + conditions.length + (conditions.length === 1 ? " filter" : " filters");
          const chip = el("button", {
            type: "button", class: "dts-gis-filter-chip",
            "aria-label": "Remove filter on " + (def ? (def.title || def.id) : id)
          }, [document.createTextNode(label), el("span", { class: "dts-gis-filter-chip-x", html: ICONS.close })]);
          chip.addEventListener("click", function () { instance._setLayerFilter(id, null); });
          chipsHost.appendChild(chip);
        });
      };

      const filterBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Filter",
        "aria-expanded": "false", "aria-controls": "dtsGisFilterPanel", html: ICONS.filter
      });
      toolbar.appendChild(filterBtn);

      const layerSelect = el("select", { class: "dts-gis-filter-layer", "aria-label": "Layer to filter" });
      queryableDefs.forEach(function (def) {
        layerSelect.appendChild(el("option", { value: def.id, text: def.title || def.id }));
      });
      const rowsContainer = el("div", { class: "dts-gis-filter-rows" });
      const addRowBtn = el("button", { type: "button", class: "dts-gis-filter-add", text: "+ Add condition" });
      const applyBtn = el("button", { type: "button", class: "dts-gis-filter-apply", text: "Apply" });
      const clearBtn = el("button", { type: "button", class: "dts-gis-filter-clear", text: "Clear" });

      function activeFilterDef() { return queryableDefs.find(function (d) { return d.id === filterLayerId; }); }

      function buildConditionRow(cond) {
        const fieldSelect = el("select", { class: "dts-gis-filter-field", "aria-label": "Field" });
        const opSelect = el("select", { class: "dts-gis-filter-op", "aria-label": "Operator" }, [
          el("option", { value: "=", text: "=" }),
          el("option", { value: "!=", text: "≠" }),
          el("option", { value: ">", text: ">" }),
          el("option", { value: "<", text: "<" }),
          el("option", { value: ">=", text: "≥" }),
          el("option", { value: "<=", text: "≤" }),
          el("option", { value: "contains", text: "contains" })
        ]);
        opSelect.value = cond.op || "=";
        const valueInput = el("input", { type: "text", class: "dts-gis-filter-value", "aria-label": "Value" });
        valueInput.value = cond.value || "";
        const removeBtn = el("button", { type: "button", class: "dts-gis-filter-remove", "aria-label": "Remove condition", html: ICONS.close });
        const row = el("div", { class: "dts-gis-filter-row" }, [fieldSelect, opSelect, valueInput, removeBtn]);
        row._dtsGet = function () { return { field: fieldSelect.value, op: opSelect.value, value: valueInput.value }; };
        row._dtsSetFields = function (fields) {
          fieldSelect.textContent = "";
          fields.forEach(function (f) { fieldSelect.appendChild(el("option", { value: f.name, text: f.label || f.name })); });
          if (cond.field) fieldSelect.value = cond.field;
        };
        removeBtn.addEventListener("click", function () { row.remove(); });
        return row;
      }

      renderFilterBuilder = function () {
        const def = activeFilterDef();
        rowsContainer.textContent = "";
        if (!def) return;
        const existing = state.filters[def.id];
        const initialRows = (existing && existing.length) ? existing : [{ field: "", op: "=", value: "" }];
        fieldsForLayer(def).then(function (fields) {
          initialRows.forEach(function (cond) {
            const row = buildConditionRow(cond);
            row._dtsSetFields(fields);
            rowsContainer.appendChild(row);
          });
        });
      };

      layerSelect.addEventListener("change", function () { filterLayerId = layerSelect.value; renderFilterBuilder(); });
      addRowBtn.addEventListener("click", function () {
        const def = activeFilterDef();
        if (!def) return;
        fieldsForLayer(def).then(function (fields) {
          const row = buildConditionRow({ field: "", op: "=", value: "" });
          row._dtsSetFields(fields);
          rowsContainer.appendChild(row);
        });
      });
      applyBtn.addEventListener("click", function () {
        const def = activeFilterDef();
        if (!def) return;
        const conditions = Array.prototype.slice.call(rowsContainer.children)
          .map(function (row) { return row._dtsGet(); })
          .filter(function (c) { return c.field && c.value !== ""; });
        instance._setLayerFilter(def.id, conditions.length ? conditions : null);
      });
      clearBtn.addEventListener("click", function () {
        const def = activeFilterDef();
        if (!def) return;
        instance._setLayerFilter(def.id, null);
      });

      const filterPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisFilterPanel", role: "region", "aria-label": "Filter", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Filter" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close filter panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [
          layerSelect, rowsContainer, addRowBtn,
          el("div", { class: "dts-gis-filter-actions" }, [applyBtn, clearBtn])
        ])
      ]);
      filterPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("filter", filterBtn, filterPanel, renderFilterBuilder);
      renderChips();
    }

    /* ---- attribute table (bottom drawer, always full-width regardless of
       viewport -- distinct from the docked/bottom-sheet .dts-gis-panel used
       by layers/legend/filter) ---- */
    let renderAttributeTable = function () {};
    let tableActiveLayerId = queryableDefs.length ? queryableDefs[0].id : null;

    if (tools.attributeTable !== false && queryableDefs.length && instance._queryLayer) {
      const tableSort = { field: null, dir: 1 };
      const tableBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Attribute table",
        "aria-expanded": "false", "aria-controls": "dtsGisTableDrawer", html: ICONS.table
      });
      toolbar.appendChild(tableBtn);

      const tableTabs = el("div", { class: "dts-gis-table-tabs", role: "tablist", "aria-label": "Layer" });
      if (queryableDefs.length > 1) {
        queryableDefs.forEach(function (def) {
          const tab = el("button", {
            type: "button", class: "dts-gis-table-tab", role: "tab",
            "aria-selected": def.id === tableActiveLayerId ? "true" : "false", text: def.title || def.id
          });
          tab.addEventListener("click", function () {
            tableActiveLayerId = def.id;
            tableSort.field = null;
            Array.prototype.forEach.call(tableTabs.children, function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
            renderAttributeTable();
          });
          tableTabs.appendChild(tab);
        });
      }

      const filterInput = el("input", { type: "search", class: "dts-gis-table-filter", placeholder: "Filter rows", "aria-label": "Filter table rows" });
      const statusEl = el("span", { class: "dts-gis-table-status", role: "status" });
      const csvBtn = el("button", { type: "button", class: "dts-gis-table-csv" }, [el("span", { html: ICONS.download }), document.createTextNode(" CSV")]);
      const tableScroll = el("div", { class: "dts-gis-table-scroll" });

      let lastFields = [], lastRows = [];
      filterInput.addEventListener("input", function () { renderAttributeTable(); });
      csvBtn.addEventListener("click", function () {
        const def = queryableDefs.find(function (d) { return d.id === tableActiveLayerId; });
        if (!def || !lastRows.length) return;
        downloadCsv((def.id || "layer") + ".csv", lastFields, lastRows);
      });

      function renderTableBody(fields, rows, totalFiltered, totalRows) {
        lastFields = fields; lastRows = rows.slice(); // full filtered set, ahead of the 200-row page cap, for CSV
        tableScroll.textContent = "";
        if (!rows.length) {
          tableScroll.appendChild(el("p", { class: "dts-gis-table-empty", text: "No rows match." }));
          statusEl.textContent = "0 of " + totalRows;
          return;
        }
        const page = rows.slice(0, 200);
        const table = el("table", { class: "dts-gis-table" });
        const thead = el("thead");
        const headRow = el("tr");
        fields.forEach(function (f) {
          const sorted = tableSort.field === f.name;
          const th = el("th", {
            scope: "col", "aria-sort": sorted ? (tableSort.dir === 1 ? "ascending" : "descending") : "none"
          }, [document.createTextNode((f.label || f.name) + (sorted ? (tableSort.dir === 1 ? " ▲" : " ▼") : ""))]);
          th.tabIndex = 0;
          th.addEventListener("click", function () {
            tableSort.dir = (tableSort.field === f.name) ? -tableSort.dir : 1;
            tableSort.field = f.name;
            renderAttributeTable();
          });
          th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); th.click(); } });
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        const tbody = el("tbody");
        page.forEach(function (f) {
          const props = f.properties || {};
          const tr = el("tr", { tabindex: "0" });
          fields.forEach(function (fld) { tr.appendChild(el("td", { text: props[fld.name] == null ? "—" : String(props[fld.name]) })); });
          function activate() {
            if (!instance._zoomToFeature) return;
            instance._zoomToFeature(tableActiveLayerId, { objectIds: [rowFeatureId(f)] });
          }
          tr.addEventListener("click", activate);
          tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
          tbody.appendChild(tr);
        });
        table.appendChild(thead);
        table.appendChild(tbody);
        tableScroll.appendChild(table);
        statusEl.textContent = totalFiltered > 200
          ? ("Showing 200 of " + totalFiltered + (totalFiltered !== totalRows ? " (filtered from " + totalRows + ")" : ""))
          : (totalFiltered + " of " + totalRows);
      }

      renderAttributeTable = function () {
        const def = queryableDefs.find(function (d) { return d.id === tableActiveLayerId; });
        if (!def) return;
        statusEl.textContent = "Loading…";
        Promise.all([queryRows(def), fieldsForLayer(def)]).then(function (results) {
          const rows = results[0], fields = results[1];
          const conditions = state.filters[def.id];
          const q = (filterInput.value || "").trim().toLowerCase();
          let filtered = rows.filter(function (f) { return matchesConditions(f.properties || {}, conditions); });
          if (q) {
            filtered = filtered.filter(function (f) {
              const props = f.properties || {};
              return fields.some(function (fld) {
                const v = props[fld.name];
                return v != null && String(v).toLowerCase().indexOf(q) !== -1;
              });
            });
          }
          if (tableSort.field) {
            filtered = filtered.slice().sort(function (a, b) {
              const av = (a.properties || {})[tableSort.field], bv = (b.properties || {})[tableSort.field];
              if (av == null && bv == null) return 0;
              if (av == null) return 1;
              if (bv == null) return -1;
              if (av < bv) return -tableSort.dir;
              if (av > bv) return tableSort.dir;
              return 0;
            });
          }
          renderTableBody(fields, filtered, filtered.length, rows.length);
        }).catch(function (err) {
          statusEl.textContent = "Couldn't load rows.";
          console.warn("[gis-tools] attribute table load failed:", err);
        });
      };

      const tableDrawer = el("div", {
        class: "dts-gis-drawer", id: "dtsGisTableDrawer", role: "region", "aria-label": "Attribute table", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Attribute table" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close attribute table", html: ICONS.close })
        ]),
        tableTabs,
        el("div", { class: "dts-gis-table-toolbar" }, [filterInput, statusEl, csvBtn]),
        tableScroll
      ]);
      tableDrawer.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("table", tableBtn, tableDrawer, renderAttributeTable);
    }

    /* ================= keep state in sync ================= */
    offListeners.push(instance.on("viewchange", function (detail) {
      state.zoom = detail.zoom;
      layerDefs.forEach(function (def) { refreshZoomGate(def.id); });
      closePopup(); // doesn't track the map -- see the identify/popup section above
    }));
    offListeners.push(instance.on("layerchange", function (detail) {
      if (!detail || !detail.id || !state.layers[detail.id]) return;
      const s = state.layers[detail.id];
      if (typeof detail.visible === "boolean") s.visible = detail.visible;
      if (typeof detail.opacity === "number") s.opacity = detail.opacity;
      if (detail.status) s.status = detail.status;
      const ref = rowRefs[detail.id];
      if (ref) {
        ref.checkbox.checked = s.visible;
        ref.statusEl.hidden = s.status !== "unavailable";
        ref.root.classList.toggle("is-unavailable", s.status === "unavailable");
      }
      if (openPanel === "legend") renderLegend();
      if ("filter" in detail) {
        state.filters[detail.id] = detail.filter;
        renderChips();
        if (openPanel === "table" && tableActiveLayerId === detail.id) renderAttributeTable();
        if (openPanel === "filter" && filterLayerId === detail.id) renderFilterBuilder();
      }
    }));

    function destroy() {
      offListeners.forEach(function (off) { off(); });
      closePanel();
      closePopup();
      host.remove();
    }

    return { destroy: destroy };
  }

  window.DTSGisTools = { mount: mount };
})();
