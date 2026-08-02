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
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4v-17z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    crosshair: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    locate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M20 20l-4.8-4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15l6-6 12 12-6 6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9l2 2M12 6l2 2M15 3l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    swipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 9l-4 3 4 3M17 9l4 3-4 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" fill="currentColor"/></svg>'
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

    // host is a DOM descendant of the same element Leaflet made its map
    // container -- so, per plain DOM bubbling, any interaction with an
    // actual control in here (host itself is pointer-events:none; only its
    // real children opt back in) would otherwise also reach Leaflet's own
    // container-level listeners as a genuine map click/drag/wheel. Real bug
    // caught live: opening the measure panel, or switching its mode/unit
    // mid-measurement, injected a spurious vertex at the clicked button's
    // screen position, since gis-viewer.js's map click listener was already
    // (re-)attached by the time the same click event finished bubbling here.
    // Stopping propagation at this single root -- not per-control -- is the
    // one place that fixes every current and future control the same way.
    ["click", "dblclick", "mousedown", "mouseup", "mousemove", "wheel", "touchstart", "touchmove"].forEach(function (type) {
      host.addEventListener(type, function (e) { e.stopPropagation(); });
    });

    const toolbar = el("div", { class: "dts-gis-toolbar" });
    host.appendChild(toolbar);

    const panels = {};
    const rowRefs = {};
    let openPanel = null;

    function closePanel() {
      if (!openPanel) return;
      const closing = panels[openPanel];
      closing.panel.hidden = true;
      closing.btn.setAttribute("aria-expanded", "false");
      openPanel = null;
      if (closing.onClose) closing.onClose(); // e.g. measure: stop an in-progress session, don't leave map listeners dangling
    }

    function openPanelByName(name) {
      if (openPanel === name) { closePanel(); return; }
      closePanel();
      panels[name].panel.hidden = false;
      panels[name].btn.setAttribute("aria-expanded", "true");
      openPanel = name;
      if (panels[name].onOpen) panels[name].onOpen();
    }

    function registerPanel(name, btn, panel, onOpen, onClose) {
      panels[name] = { btn: btn, panel: panel, onOpen: onOpen, onClose: onClose };
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
      const applyBtn = el("button", { type: "button", class: "dts-gis-btn-primary", text: "Apply" });
      const clearBtn = el("button", { type: "button", class: "dts-gis-btn-secondary", text: "Clear" });

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

    /* ================= bookmarks (task 3.9) =================
       Read-only at runtime, authored in the CMS (mapDoc.bookmarks). No
       engine changes needed at all: setView() already accepts either a
       {center,zoom} or {bbox} view object, which is exactly what a
       bookmark's own `view` already is. */
    if (tools.bookmarks !== false && Array.isArray(mapDoc.bookmarks) && mapDoc.bookmarks.length) {
      const bookmarksBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Bookmarks",
        "aria-expanded": "false", "aria-controls": "dtsGisBookmarksPanel", html: ICONS.bookmark
      });
      toolbar.appendChild(bookmarksBtn);

      const bookmarksBody = el("div", { class: "dts-gis-panel-body dts-gis-bookmarks" });
      mapDoc.bookmarks.forEach(function (b) {
        const item = el("button", { type: "button", class: "dts-gis-bookmark-item", text: b.title || b.id });
        item.addEventListener("click", function () { instance.setView(b.view); closePanel(); });
        bookmarksBody.appendChild(item);
      });
      const bookmarksPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisBookmarksPanel", role: "region", "aria-label": "Bookmarks", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Bookmarks" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close bookmarks panel", html: ICONS.close })
        ]),
        bookmarksBody
      ]);
      bookmarksPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("bookmarks", bookmarksBtn, bookmarksPanel);
    }

    /* ================= coordinates (task 3.9) =================
       Live readout is always-on map chrome while the tool is enabled (like
       the scale bar), not gated behind a panel open/closed state; the panel
       only holds the "go to coordinates" action. Parsing accepts decimal
       degrees ("29.87, -91.75") or DMS ("29°52'12\"N 91°45'00\"W"). */
    function parseCoordInput(text) {
      const dd = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (dd) return { lat: parseFloat(dd[1]), lng: parseFloat(dd[2]) };
      const dmsPart = "(\\d+)[°\\s]+(\\d+)['\\s]+([\\d.]+)[\"\\s]*([NSEW])";
      const dms = new RegExp("^\\s*" + dmsPart + "\\s*[,\\s]\\s*" + dmsPart + "\\s*$", "i").exec(text);
      if (dms) {
        function toDec(deg, min, sec, hemi) {
          const v = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
          return /[SW]/i.test(hemi) ? -v : v;
        }
        const a = toDec(dms[1], dms[2], dms[3], dms[4]);
        const b = toDec(dms[5], dms[6], dms[7], dms[8]);
        // Whichever of the pair carries N/S is latitude, regardless of order.
        const aIsLat = /[NS]/i.test(dms[4]);
        return aIsLat ? { lat: a, lng: b } : { lat: b, lng: a };
      }
      return null;
    }

    if (tools.coordinates !== false) {
      const coordReadout = el("button", { type: "button", class: "dts-gis-coord-readout", "aria-label": "Copy coordinates" });
      host.appendChild(coordReadout);
      let lastCoord = null;
      offListeners.push(instance.on("pointer", function (detail) {
        lastCoord = detail;
        coordReadout.textContent = detail.lat.toFixed(5) + ", " + detail.lng.toFixed(5);
      }));
      coordReadout.addEventListener("click", function () {
        if (!lastCoord || !navigator.clipboard) return;
        navigator.clipboard.writeText(lastCoord.lat.toFixed(5) + ", " + lastCoord.lng.toFixed(5)).then(function () {
          const prev = coordReadout.textContent;
          coordReadout.textContent = "Copied";
          setTimeout(function () { coordReadout.textContent = prev; }, 900);
        }).catch(function () {});
      });

      const coordBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Go to coordinates",
        "aria-expanded": "false", "aria-controls": "dtsGisCoordPanel", html: ICONS.crosshair
      });
      toolbar.appendChild(coordBtn);

      const coordInput = el("input", { type: "text", class: "dts-gis-coord-input", placeholder: "29.87, -91.75 or DMS", "aria-label": "Coordinates" });
      const coordGoBtn = el("button", { type: "button", class: "dts-gis-btn-primary", text: "Go" });
      const coordStatus = el("p", { class: "dts-gis-coord-status", role: "status" });
      function goToCoords() {
        const parsed = parseCoordInput(coordInput.value);
        if (!parsed) { coordStatus.textContent = "Couldn't parse that -- try \"29.87, -91.75\"."; return; }
        coordStatus.textContent = "";
        instance.setView({ center: [parsed.lat, parsed.lng], zoom: Math.max(state.zoom, 14) });
      }
      coordGoBtn.addEventListener("click", goToCoords);
      coordInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); goToCoords(); } });

      const coordPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisCoordPanel", role: "region", "aria-label": "Go to coordinates", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Go to coordinates" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close coordinates panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [
          el("div", { class: "dts-gis-coord-row" }, [coordInput, coordGoBtn]), coordStatus
        ])
      ]);
      coordPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("coords", coordBtn, coordPanel);
    }

    /* ================= geolocate (task 3.9) =================
       One-shot, gated behind instance._geolocate (absent only if
       gis-viewer.js somehow didn't load the seam -- never in practice).
       §11: a permission denial stays silent (no scolding, no toast) --
       every other outcome gets a brief, dismissible one. */
    if (tools.geolocate !== false && instance._geolocate) {
      const geoBtn = el("button", { class: "dts-gis-toolbtn", type: "button", "aria-label": "My location", html: ICONS.locate });
      toolbar.appendChild(geoBtn);
      const geoToast = el("div", { class: "dts-gis-toast", role: "status", hidden: "" });
      host.appendChild(geoToast);
      let geoToastTimer = null;
      function showGeoToast(children, autoHideMs) {
        geoToast.textContent = "";
        (Array.isArray(children) ? children : [document.createTextNode(children)]).forEach(function (c) { geoToast.appendChild(c); });
        geoToast.hidden = false;
        if (geoToastTimer) clearTimeout(geoToastTimer);
        if (autoHideMs) geoToastTimer = setTimeout(function () { geoToast.hidden = true; }, autoHideMs);
      }
      geoBtn.addEventListener("click", function () {
        geoBtn.disabled = true;
        showGeoToast("Locating…");
        instance._geolocate().then(function (result) {
          geoBtn.disabled = false;
          if (result.withinParish) { showGeoToast("Location found.", 2500); return; }
          const zoomBtn = el("button", { type: "button", class: "dts-gis-toast-action", text: "Zoom to parish" });
          zoomBtn.addEventListener("click", function () { instance.setView(mapDoc.view); geoToast.hidden = true; });
          showGeoToast([document.createTextNode("You're outside Iberia Parish. "), zoomBtn]);
        }).catch(function (err) {
          geoBtn.disabled = false;
          if (err && err.code === "denied") { geoToast.hidden = true; return; }
          showGeoToast("Couldn't get your location.", 3000);
        });
      });
    }

    /* ================= search (task 3.9) =================
       Two parish-limited scopes per §6: (a) feature search across queryable
       layers by a "primary field" -- def.searchField if the map document
       sets one (an additive, backward-compatible extension to §4's layer
       schema, same spirit as popup/legend), else the first field
       fieldsForLayer() resolves for that layer; (b) place search via
       Nominatim, bounded to the map's own parish envelope. sources.json
       confirmed the Iberia AddressLocators service is token-restricted, so
       Nominatim -- not that service -- is the only place-search option per
       §6's own fallback chain; no silent statewide results if it fails. */
    if (tools.search !== false) {
      const searchBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Search",
        "aria-expanded": "false", "aria-controls": "dtsGisSearchPanel", html: ICONS.search
      });
      toolbar.appendChild(searchBtn);

      const searchInput = el("input", { type: "search", class: "dts-gis-search-input", placeholder: "Search this map…", "aria-label": "Search" });
      const searchResults = el("div", { class: "dts-gis-search-results" });
      const searchFieldCache = {};
      function searchFieldFor(def) {
        if (def.searchField) return Promise.resolve(def.searchField);
        if (searchFieldCache[def.id]) return searchFieldCache[def.id];
        searchFieldCache[def.id] = fieldsForLayer(def).then(function (fields) { return fields.length ? fields[0].name : null; });
        return searchFieldCache[def.id];
      }

      function searchFeatures(q) {
        const lower = q.toLowerCase();
        return Promise.all(queryableDefs.map(function (def) {
          return searchFieldFor(def).then(function (field) {
            if (!field) return [];
            return queryRows(def).then(function (rows) {
              return rows.filter(function (f) {
                const v = (f.properties || {})[field];
                return v != null && String(v).toLowerCase().indexOf(lower) !== -1;
              }).slice(0, 6).map(function (f) { return { def: def, feature: f, label: String((f.properties || {})[field]) }; });
            });
          });
        })).then(function (grouped) { return [].concat.apply([], grouped); });
      }

      function searchPlaces(q) {
        const b = mapDoc.view && mapDoc.view.maxBounds;
        const params = new URLSearchParams({ format: "json", q: q, countrycodes: "us", limit: "5" });
        if (b) { params.set("viewbox", b[0][1] + "," + b[1][0] + "," + b[1][1] + "," + b[0][0]); params.set("bounded", "1"); }
        return fetch("https://nominatim.openstreetmap.org/search?" + params.toString())
          .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
          .then(function (results) { return results.map(function (r) { return { label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }; }); })
          .catch(function (err) { console.warn("[gis-tools] place search failed:", err); return null; });
      }

      let searchDebounce = null;
      function runSearch() {
        const q = searchInput.value.trim();
        searchResults.textContent = "";
        if (q.length < 2) return;
        searchResults.appendChild(el("p", { class: "dts-gis-search-status", text: "Searching…" }));
        Promise.all([searchFeatures(q), searchPlaces(q)]).then(function (res) {
          const features = res[0], places = res[1];
          searchResults.textContent = "";
          if (features.length) {
            searchResults.appendChild(el("h4", { class: "dts-gis-search-heading", text: "On this map" }));
            features.forEach(function (r) {
              const item = el("button", { type: "button", class: "dts-gis-search-item" }, [
                document.createTextNode(r.label), el("span", { class: "dts-gis-search-sub", text: r.def.title || r.def.id })
              ]);
              item.addEventListener("click", function () {
                instance._zoomToFeature(r.def.id, { objectIds: [rowFeatureId(r.feature)] });
                closePanel();
              });
              searchResults.appendChild(item);
            });
          }
          if (places === null) {
            searchResults.appendChild(el("p", { class: "dts-gis-search-status", text: "Place search is unavailable right now." }));
          } else if (places.length) {
            searchResults.appendChild(el("h4", { class: "dts-gis-search-heading", text: "Places" }));
            places.forEach(function (r) {
              const item = el("button", { type: "button", class: "dts-gis-search-item", text: r.label });
              item.addEventListener("click", function () {
                instance.setView({ center: [r.lat, r.lng], zoom: 15 });
                closePanel();
              });
              searchResults.appendChild(item);
            });
          }
          if (!features.length && (places === null || !places.length)) {
            searchResults.appendChild(el("p", { class: "dts-gis-search-status", text: "No matches." }));
          }
        });
      }
      searchInput.addEventListener("input", function () {
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(runSearch, 350);
      });
      searchInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (searchDebounce) clearTimeout(searchDebounce); runSearch(); } });

      const searchPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisSearchPanel", role: "region", "aria-label": "Search", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Search" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close search panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [searchInput, searchResults])
      ]);
      searchPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("search", searchBtn, searchPanel, function () { searchInput.focus(); });
    }

    /* ================= measure (task 3.9) =================
       All interaction (click-to-vertex, live preview, dblclick-finish,
       on-map labels) lives in gis-viewer.js -- this panel only starts/stops
       a session and mirrors its running total as text (§10: the on-map
       label is not the only channel). Escape cancels an in-progress
       session; the Clear button removes every finished measurement. */
    if (tools.measure !== false && instance._startMeasure) {
      const measureBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Measure",
        "aria-expanded": "false", "aria-controls": "dtsGisMeasurePanel", html: ICONS.ruler
      });
      toolbar.appendChild(measureBtn);

      let measureMode = "distance", measureUnit = "imperial";
      const distBtn = el("button", { type: "button", class: "dts-gis-seg-btn", "aria-pressed": "true", text: "Distance" });
      const areaBtn = el("button", { type: "button", class: "dts-gis-seg-btn", "aria-pressed": "false", text: "Area" });
      const unitImperial = el("button", { type: "button", class: "dts-gis-seg-btn", "aria-pressed": "true", text: "ft / mi" });
      const unitMetric = el("button", { type: "button", class: "dts-gis-seg-btn", "aria-pressed": "false", text: "m / km" });
      const measureReadout = el("p", { class: "dts-gis-measure-readout", role: "status", text: "Click the map to start measuring." });
      const finishBtn = el("button", { type: "button", class: "dts-gis-btn-primary", text: "Finish" });
      const clearBtn = el("button", { type: "button", class: "dts-gis-btn-secondary", text: "Clear" });

      function setPressed(group, active) { group.forEach(function (b) { b.setAttribute("aria-pressed", b === active ? "true" : "false"); }); }
      function restart() { instance._startMeasure(measureMode, measureUnit); }
      distBtn.addEventListener("click", function () { measureMode = "distance"; setPressed([distBtn, areaBtn], distBtn); restart(); });
      areaBtn.addEventListener("click", function () { measureMode = "area"; setPressed([distBtn, areaBtn], areaBtn); restart(); });
      unitImperial.addEventListener("click", function () { measureUnit = "imperial"; setPressed([unitImperial, unitMetric], unitImperial); instance._setMeasureUnit(measureUnit); });
      unitMetric.addEventListener("click", function () { measureUnit = "metric"; setPressed([unitImperial, unitMetric], unitMetric); instance._setMeasureUnit(measureUnit); });
      finishBtn.addEventListener("click", function () { if (instance._finishMeasure) instance._finishMeasure(); });
      clearBtn.addEventListener("click", function () { instance._clearMeasurements(); });

      offListeners.push(instance.on("measure", function (detail) {
        if (!detail || !detail.active) {
          measureReadout.textContent = "Click the map to start measuring.";
          return;
        }
        measureReadout.textContent = detail.mode === "area"
          ? (detail.points.length < 3 ? "Click to add points, double-click to finish." : "Area: " + formatAreaLabel(detail.areaM2, detail.unit))
          : (detail.points.length < 2 ? "Click to add points, double-click to finish." : "Distance: " + formatDistanceLabel(detail.distanceM, detail.unit));
      }));

      // Mirrors gis-viewer.js's own formatDistance/formatArea -- kept local
      // for the same reason as matchesConditions above: this file only
      // reads engine state through events/seams, never its module scope.
      function formatDistanceLabel(m, unit) {
        if (unit === "metric") return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km";
        return m < 528 ? Math.round(m * 3.28084) + " ft" : (m / 1609.344).toFixed(2) + " mi";
      }
      function formatAreaLabel(m2, unit) {
        if (unit === "metric") return m2 < 1e6 ? Math.round(m2) + " m²" : (m2 / 1e6).toFixed(2) + " km²";
        return (m2 / 4046.8564224).toFixed(2) + " ac";
      }

      function onMeasureKeydown(e) { if (e.key === "Escape") instance._cancelMeasure(); }
      document.addEventListener("keydown", onMeasureKeydown);
      offListeners.push(function () { document.removeEventListener("keydown", onMeasureKeydown); });

      const measurePanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisMeasurePanel", role: "region", "aria-label": "Measure", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Measure" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close measure panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [
          el("div", { class: "dts-gis-segmented" }, [distBtn, areaBtn]),
          el("div", { class: "dts-gis-segmented" }, [unitImperial, unitMetric]),
          measureReadout,
          el("div", { class: "dts-gis-filter-actions" }, [finishBtn, clearBtn])
        ])
      ]);
      measurePanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("measure", measureBtn, measurePanel, restart, function () { instance._cancelMeasure(); });
    }

    /* ================= draw / annotate (task 3.9) =================
       Same shape as measure: interaction lives in gis-viewer.js, this panel
       starts/stops sessions and reflects state as text. Drawings persist in
       the engine's own registry (included in getState().d per §7, so they
       survive a share link) until Clear or _removeDrawing. Text labels need
       a value gis-viewer.js can't collect itself -- the engine places the
       point and emits "pending-text"; this file shows a small inline input
       at that point's containerPoint (same positioning technique the 3.7
       identify popup already uses) and finalizes or discards it. */
    if (tools.draw !== false && instance._startDraw) {
      const drawBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Draw",
        "aria-expanded": "false", "aria-controls": "dtsGisDrawPanel", html: ICONS.pencil
      });
      toolbar.appendChild(drawBtn);

      const DRAW_COLORS = ["#c49a2a", "#4fb3ff", "#e35b5b", "#5bd0a0", "#e3b855"];
      let drawColor = DRAW_COLORS[0];
      const typeRow = el("div", { class: "dts-gis-segmented dts-gis-draw-types" });
      ["point", "line", "polygon", "rectangle", "text"].forEach(function (type, i) {
        const btn = el("button", {
          type: "button", class: "dts-gis-seg-btn", "aria-pressed": i === 0 ? "true" : "false",
          text: type.charAt(0).toUpperCase() + type.slice(1)
        });
        btn.addEventListener("click", function () {
          Array.prototype.forEach.call(typeRow.children, function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
          instance._startDraw(type, drawColor);
        });
        typeRow.appendChild(btn);
      });

      const colorRow = el("div", { class: "dts-gis-draw-colors" });
      const colorSwatches = DRAW_COLORS.map(function (c) {
        const sw = el("button", { type: "button", class: "dts-gis-draw-swatch", "aria-label": "Colour " + c, style: "background:" + c });
        sw.addEventListener("click", function () {
          drawColor = c;
          colorSwatches.forEach(function (s) { s.classList.toggle("is-active", s === sw); });
        });
        colorRow.appendChild(sw);
        return sw;
      });
      colorSwatches[0].classList.add("is-active");

      const drawReadout = el("p", { class: "dts-gis-measure-readout", role: "status", text: "Choose a type above, then click the map." });
      const drawClearBtn = el("button", { type: "button", class: "dts-gis-btn-secondary", text: "Clear" });
      const drawDownloadBtn = el("button", { type: "button", class: "dts-gis-btn-primary", text: "Download GeoJSON" });
      drawClearBtn.addEventListener("click", function () { instance._clearDrawings(); });

      function drawingsToGeoJson(list) {
        return {
          type: "FeatureCollection",
          features: list.map(function (d) {
            let geometry;
            if (d.type === "point" || d.type === "text") geometry = { type: "Point", coordinates: [d.latlng[1], d.latlng[0]] };
            else if (d.type === "line") geometry = { type: "LineString", coordinates: d.latlngs.map(function (p) { return [p[1], p[0]]; }) };
            else geometry = { type: "Polygon", coordinates: [d.latlngs.concat([d.latlngs[0]]).map(function (p) { return [p[1], p[0]]; })] };
            const props = { type: d.type, color: d.color };
            if (d.text) props.text = d.text;
            return { type: "Feature", properties: props, geometry: geometry };
          })
        };
      }
      drawDownloadBtn.addEventListener("click", function () {
        const list = instance._getDrawings ? instance._getDrawings() : [];
        if (!list.length) return;
        const blob = new Blob([JSON.stringify(drawingsToGeoJson(list), null, 2)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const a = el("a", { href: url, download: "drawings.geojson" });
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      });

      offListeners.push(instance.on("draw", function (detail) {
        if (!detail) return;
        if (detail.action === "started") {
          drawReadout.textContent = detail.type === "point" ? "Click the map to place the point."
            : detail.type === "text" ? "Click the map to place the label."
            : detail.type === "rectangle" ? "Click two opposite corners."
            : "Click to add points, double-click to finish.";
        } else if (detail.action === "cancelled" || detail.action === "cleared") {
          drawReadout.textContent = "Choose a type above, then click the map.";
        } else if (detail.action === "added") {
          drawReadout.textContent = "Added. Choose a type to draw another.";
        } else if (detail.action === "pending-text") {
          showTextInput(detail.id, detail.containerPoint);
        }
      }));

      let textInputEl = null;
      function closeTextInput(commit) {
        if (!textInputEl) return;
        const wrap = textInputEl;
        textInputEl = null; // set before remove(): its synchronous blur re-enters this function
        const id = wrap._dtsDrawId;
        const value = wrap.querySelector("input").value.trim();
        wrap.remove();
        if (commit && value) instance._setDrawingText(id, value);
        else instance._removeDrawing(id);
      }
      function showTextInput(id, containerPoint) {
        closeTextInput(false);
        const input = el("input", { type: "text", placeholder: "Label text", "aria-label": "Label text" });
        const wrap = el("div", { class: "dts-gis-draw-textbox" }, [input]);
        wrap.style.left = containerPoint[0] + "px";
        wrap.style.top = containerPoint[1] + "px";
        wrap._dtsDrawId = id;
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); closeTextInput(true); }
          if (e.key === "Escape") { e.preventDefault(); closeTextInput(false); }
        });
        input.addEventListener("blur", function () { closeTextInput(true); });
        host.appendChild(wrap);
        textInputEl = wrap;
        input.focus();
      }

      function onDrawKeydown(e) { if (e.key === "Escape" && !textInputEl) instance._cancelDraw(); }
      document.addEventListener("keydown", onDrawKeydown);
      offListeners.push(function () { document.removeEventListener("keydown", onDrawKeydown); });

      const drawPanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisDrawPanel", role: "region", "aria-label": "Draw", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Draw" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close draw panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [
          typeRow, colorRow, drawReadout,
          el("div", { class: "dts-gis-filter-actions" }, [drawDownloadBtn, drawClearBtn])
        ])
      ]);
      drawPanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("draw", drawBtn, drawPanel, null, function () { closeTextInput(false); instance._cancelDraw(); });
    }

    /* ================= swipe compare (task 3.10) =================
       Layer choice comes from currently-visible layers, per §6, rebuilt
       every time the panel opens and kept live while it's open via the
       existing layerchange listener below. Unlike measure/draw, this is
       persistent view state, not a transient session -- closing the panel
       leaves the divider active; only choosing "None" or the engine's own
       reset-on-hide (§6: "must reset cleanly when its layer is switched
       off") turns it off. Dragging uses Pointer Events for one code path
       across mouse and touch. */
    if (tools.swipe !== false && layerDefs.length) {
      const swipeBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Swipe compare",
        "aria-expanded": "false", "aria-controls": "dtsGisSwipePanel", html: ICONS.swipe
      });
      toolbar.appendChild(swipeBtn);

      const swipeSelect = el("select", { class: "dts-gis-filter-layer", "aria-label": "Layer to compare" });
      const swipeHint = el("p", { class: "dts-gis-coord-status", text: "Drag the divider on the map to compare." });

      function refreshSwipeOptions() {
        const current = swipeSelect.value;
        swipeSelect.textContent = "";
        swipeSelect.appendChild(el("option", { value: "", text: "None" }));
        layerDefs.forEach(function (def) {
          if (!state.layers[def.id] || !state.layers[def.id].visible) return;
          swipeSelect.appendChild(el("option", { value: def.id, text: def.title || def.id }));
        });
        swipeSelect.value = Array.prototype.some.call(swipeSelect.options, function (o) { return o.value === current; }) ? current : "";
      }

      const divider = el("div", { class: "dts-gis-swipe-divider", hidden: "" }, [el("div", { class: "dts-gis-swipe-grip" })]);
      host.appendChild(divider);

      function setDividerPct(frac) { divider.style.left = (frac * 100) + "%"; }

      let dragging = false;
      divider.addEventListener("pointerdown", function (e) {
        dragging = true;
        divider.setPointerCapture(e.pointerId);
      });
      divider.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        const rect = host.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        instance._setSwipeDivider(frac);
      });
      function endDrag() { dragging = false; }
      divider.addEventListener("pointerup", endDrag);
      divider.addEventListener("pointercancel", endDrag);

      swipeSelect.addEventListener("change", function () { instance._setSwipeLayer(swipeSelect.value || null); });

      offListeners.push(instance.on("swipechange", function (detail) {
        divider.hidden = !detail.layerId;
        if (detail.layerId) setDividerPct(detail.divider);
        if (swipeSelect.value !== (detail.layerId || "")) swipeSelect.value = detail.layerId || "";
      }));

      const swipePanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisSwipePanel", role: "region", "aria-label": "Swipe compare", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Swipe compare" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close swipe panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [swipeSelect, swipeHint])
      ]);
      swipePanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("swipe", swipeBtn, swipePanel, refreshSwipeOptions);
    }

    /* ================= time slider (task 3.10) =================
       Shown only when the map document actually has a time series or a
       layer with a timeField, per §6 -- mapDoc is static, so this can be
       decided once at mount rather than re-checked per event. */
    const timeSteps = (mapDoc.timeSeries && Array.isArray(mapDoc.timeSeries.steps)) ? mapDoc.timeSeries.steps : [];
    // §6 says the tool shows for "a timeField or ... scenario steps", but a
    // scrubber needs at least two positions to mean anything -- a timeField
    // layer with no mapDoc.timeSeries.steps declared has no defined
    // positions to scrub between (CPRA content is scenario-layers, not a
    // continuous timeField, so steps are the realistic authoring path;
    // timeField alone, with no steps, is a documented no-op here rather
    // than inventing positions from ArcGIS service time-extent metadata).
    if (tools.timeline !== false && timeSteps.length >= 2 && instance._setTimeStep) {
      const timeBtn = el("button", {
        class: "dts-gis-toolbtn", type: "button", "aria-label": "Timeline",
        "aria-expanded": "false", "aria-controls": "dtsGisTimePanel", html: ICONS.clock
      });
      toolbar.appendChild(timeBtn);

      const playBtn = el("button", { type: "button", class: "dts-gis-time-play", "aria-label": "Play" }, [el("span", { html: ICONS.play })]);
      const stepBackBtn = el("button", { type: "button", class: "dts-gis-time-step", "aria-label": "Previous step", text: "◀" });
      const stepFwdBtn = el("button", { type: "button", class: "dts-gis-time-step", "aria-label": "Next step", text: "▶" });
      const scrubber = el("input", {
        type: "range", min: "0", max: String(Math.max(0, timeSteps.length - 1)), step: "1", value: "0",
        class: "dts-gis-time-scrubber", "aria-label": "Time step"
      });
      const timeLabel = el("p", { class: "dts-gis-coord-status", role: "status", text: timeSteps.length ? (timeSteps[0].label || timeSteps[0].id) : "" });

      let playing = false;
      function setPlayIcon() { playBtn.innerHTML = ""; playBtn.appendChild(el("span", { html: playing ? ICONS.pause : ICONS.play })); playBtn.setAttribute("aria-label", playing ? "Pause" : "Play"); }
      playBtn.addEventListener("click", function () { if (playing) instance._pauseTimeSeries(); else instance._playTimeSeries(); });
      stepBackBtn.addEventListener("click", function () { instance._setTimeStep(parseInt(scrubber.value, 10) - 1); });
      stepFwdBtn.addEventListener("click", function () { instance._setTimeStep(parseInt(scrubber.value, 10) + 1); });
      scrubber.addEventListener("input", function () { instance._setTimeStep(parseInt(scrubber.value, 10)); });

      offListeners.push(instance.on("timechange", function (detail) {
        playing = !!detail.playing;
        setPlayIcon();
        if (typeof detail.index === "number") scrubber.value = String(detail.index);
        timeLabel.textContent = detail.label || "";
      }));

      const timePanel = el("div", {
        class: "dts-gis-panel", id: "dtsGisTimePanel", role: "region", "aria-label": "Timeline", hidden: ""
      }, [
        el("div", { class: "dts-gis-panel-head" }, [
          el("h3", { text: "Timeline" }),
          el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Close timeline panel", html: ICONS.close })
        ]),
        el("div", { class: "dts-gis-panel-body" }, [
          el("div", { class: "dts-gis-time-controls" }, [stepBackBtn, playBtn, stepFwdBtn]),
          scrubber, timeLabel
        ])
      ]);
      timePanel.querySelector(".dts-gis-panel-close").addEventListener("click", closePanel);
      registerPanel("time", timeBtn, timePanel);
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
