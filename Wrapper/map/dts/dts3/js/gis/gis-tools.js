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
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
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
    const state = { zoom: initial.z, basemap: initial.b, layers: {} };
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
