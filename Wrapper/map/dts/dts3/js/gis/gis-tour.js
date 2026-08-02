/* ============================================================
   GIS guided tour player -- window.DTSGisTour
   ------------------------------------------------------------
   Per docs/plans/gis/05-SPEC-guided-tours.md / 09-BUILD-PLAN.md
   Phase 4. Presentation only: step application (view/layers/
   basemap/highlight) is already owned by js/gis/gis-viewer.js's
   startTour/tourNext/tourPrev/tourGoTo/exitTour (04-SPEC §5 public
   API, extended here by one method -- tourGoTo(index), for the
   progress dots' "jump to step" and the off-script "back to step"
   pill, neither of which fits tourNext/tourPrev's relative-step
   shape). This file only ever drives the map through that public
   API -- it never touches a Leaflet object, same rule gis-tools.js
   already follows.
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

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

  function mount(containerEl, mapDoc, instance, opts) {
    opts = opts || {};
    const tourDocs = {};
    (Array.isArray(opts.tours) ? opts.tours : []).forEach(function (t) { tourDocs[t.id] = t; });
    const layerDefs = Array.isArray(mapDoc.layers) ? mapDoc.layers : [];
    const defaultBasemap = (mapDoc.basemaps || []).find(function (b) { return b.default; }) || (mapDoc.basemaps || [])[0];
    const reducedMotion = prefersReducedMotion();

    /* ---- local "what should be on screen right now" model, tracked
       purely off events -- same footing as gis-tools.js's own state
       model, never read off a Leaflet object. Used only for off-script
       detection (§2: "if the user pans, zooms, or toggles a layer
       mid-tour, don't fight them -- mark the step off-script"). ---- */
    const liveLayers = {};
    layerDefs.forEach(function (def) { liveLayers[def.id] = !!def.visible; });
    let liveBasemap = defaultBasemap ? defaultBasemap.id : null;
    let liveCenter = null, liveZoom = null;
    (function seedFromState() {
      const s = instance.getState();
      if (s.b) liveBasemap = s.b;
      if (s.l) Object.keys(s.l).forEach(function (id) { if (id in liveLayers) liveLayers[id] = !!s.l[id][0]; });
      if (Array.isArray(s.c)) { liveCenter = s.c; liveZoom = s.z; }
    })();

    // Real bug, found live: a step whose view changes both center and zoom
    // (e.g. a 2-level zoom-out) can make Leaflet fire more than one
    // "moveend"/viewchange in the process of settling -- confirmed live
    // this can include an intermediate report that doesn't match either
    // the old or the new step's position, which an immediate check would
    // wrongly treat as user-caused off-script drift. Debouncing the
    // *view* half of the check (layers/basemap stay immediate -- those
    // apply atomically, with no animation to settle) means only the
    // position reported once move events actually go quiet gets judged.
    let viewCheckTimer = null;
    function scheduleViewCheck() {
      if (viewCheckTimer) clearTimeout(viewCheckTimer);
      viewCheckTimer = setTimeout(function () { viewCheckTimer = null; checkOffScript(); }, 350);
    }

    const offEvents = [];
    offEvents.push(instance.on("layerchange", function (detail) {
      if (!detail) return;
      if (detail.type === "basemap") { liveBasemap = detail.id; checkOffScript(); return; }
      if (detail.id && "visible" in detail) { liveLayers[detail.id] = !!detail.visible; checkOffScript(); }
    }));
    offEvents.push(instance.on("viewchange", function (detail) {
      liveCenter = detail.center; liveZoom = detail.zoom;
      scheduleViewCheck();
    }));

    /* ---- expected state for the active step, replayed from step 0 so
       a direct jump (progress dot, deep link) is exactly as valid a
       baseline as arriving via Next/Prev. Mirrors gis-viewer.js's own
       applyLayersDirective() logic -- kept independent rather than
       reaching into the engine's closure, same "no Leaflet-object,
       no private-seam" rule this file already follows. ---- */
    function computeExpected(doc, index) {
      const layers = {};
      layerDefs.forEach(function (def) { layers[def.id] = !!def.visible; });
      let basemap = defaultBasemap ? defaultBasemap.id : null;
      for (let i = 0; i <= index; i++) {
        const step = doc.steps[i];
        if (!step) continue;
        const directive = step.layers || {};
        const off = directive.off || [];
        if (off.indexOf("*") !== -1) Object.keys(layers).forEach(function (id) { layers[id] = false; });
        else off.forEach(function (id) { layers[id] = false; });
        (directive.on || []).forEach(function (id) { layers[id] = true; });
        if (step.basemap) basemap = step.basemap;
      }
      return { layers: layers, basemap: basemap, view: doc.steps[index] ? doc.steps[index].view : null };
    }

    let active = null; // { doc, index, expected, offScript, showingOutro }

    function layersMatch(a, b) {
      return Object.keys(a).every(function (id) { return !!a[id] === !!b[id]; }) &&
        Object.keys(b).every(function (id) { return !!a[id] === !!b[id]; });
    }

    function checkOffScript() {
      if (!active || active.showingOutro) return;
      const exp = active.expected;
      let matches = layersMatch(liveLayers, exp.layers) && liveBasemap === exp.basemap;
      // §2: a bbox-defined step has no single expected center/zoom to
      // compare against (fitBounds' resulting zoom depends on viewport
      // size, which this file has no honest way to predict without
      // reaching into Leaflet) -- position drift is only checked for
      // center/zoom-defined steps. A documented limitation, not a
      // silent one: layer/basemap drift alone still catches most
      // real off-script interaction even on a bbox step.
      if (matches && exp.view && exp.view.center && liveCenter) {
        const dLat = Math.abs(liveCenter[0] - exp.view.center[0]);
        const dLng = Math.abs(liveCenter[1] - exp.view.center[1]);
        const zoomOk = typeof exp.view.zoom !== "number" || liveZoom === exp.view.zoom;
        if (dLat > 0.01 || dLng > 0.01 || !zoomOk) matches = false;
      }
      setOffScript(!matches);
    }

    function setOffScript(v) {
      if (!active || active.offScript === v) return;
      active.offScript = v;
      pill.hidden = !v;
    }

    /* ================= card DOM ================= */
    const host = el("div", { class: "dts-gis-tour" });
    containerEl.appendChild(host);
    // Same rationale as gis-tools.js's own host: a DOM descendant of
    // Leaflet's own map container, so a click/drag on a real control in
    // here would otherwise also reach the map's listeners underneath.
    ["click", "dblclick", "mousedown", "mouseup", "mousemove", "wheel", "touchstart", "touchmove"].forEach(function (type) {
      host.addEventListener(type, function (e) { e.stopPropagation(); });
    });

    const liveRegion = el("div", { class: "dts-gis-tour-sr", role: "status", "aria-live": "polite" });
    host.appendChild(liveRegion);

    const toast = el("div", { class: "dts-gis-toast dts-gis-tour-toast", role: "status", hidden: "" });
    host.appendChild(toast);
    let toastTimer = null;
    function showToast(text) {
      toast.textContent = text;
      toast.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.hidden = true; }, 4000);
    }

    const closeBtn = el("button", { class: "dts-gis-panel-close", type: "button", "aria-label": "Exit tour", html: ICON_CLOSE });
    const collapseBtn = el("button", { class: "dts-gis-tour-collapse", type: "button", "aria-label": "Collapse tour card", "aria-expanded": "true", html: ICON_CHEVRON });
    const headLabel = el("div", { class: "dts-gis-tour-head-label" });
    const head = el("div", { class: "dts-gis-tour-head" }, [collapseBtn, headLabel, closeBtn]);

    const titleEl = el("h3", { class: "dts-gis-tour-title" });
    const bodyEl = el("p", { class: "dts-gis-tour-body" });
    const mediaWrap = el("div", { class: "dts-gis-tour-media" });
    const pill = el("button", { class: "dts-gis-tour-pill", type: "button", hidden: "" });
    const dotsWrap = el("div", { class: "dts-gis-tour-dots" });
    const backBtn = el("button", { class: "dts-gis-btn-secondary", type: "button", text: "Back" });
    const nextBtn = el("button", { class: "dts-gis-btn-primary", type: "button", text: "Next" });
    const nav = el("div", { class: "dts-gis-tour-nav" }, [dotsWrap, el("div", { class: "dts-gis-tour-nav-buttons" }, [backBtn, nextBtn])]);
    const ctaBtn = el("button", { class: "dts-gis-btn-primary", type: "button" });

    const body = el("div", { class: "dts-gis-tour-body-wrap" }, [titleEl, bodyEl, mediaWrap, pill, nav, ctaBtn]);
    const card = el("div", { class: "dts-gis-tour-card", hidden: "" }, [head, body]);
    if (reducedMotion) card.classList.add("dts-gis-no-motion");
    host.appendChild(card);

    collapseBtn.addEventListener("click", function () {
      const collapsed = card.classList.toggle("is-collapsed");
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
    closeBtn.addEventListener("click", function () { instance.exitTour(); });
    backBtn.addEventListener("click", function () {
      if (active && active.showingOutro) { renderStep(active.doc, active.doc.steps.length - 1); return; }
      instance.tourPrev();
    });
    nextBtn.addEventListener("click", function () {
      if (!active) return;
      const isLast = active.index === active.doc.steps.length - 1;
      if (isLast) { renderOutro(active.doc); return; }
      instance.tourNext();
    });
    pill.addEventListener("click", function () {
      if (!active) return;
      if (instance.tourGoTo) instance.tourGoTo(active.index);
      setOffScript(false);
    });

    function mediaEl(media) {
      if (!media || !media.source) return null;
      const src = media.source.value;
      if (media._type === "video") {
        return el("video", { src: src, class: "dts-gis-tour-media-el", controls: "", playsinline: "" });
      }
      return el("img", { src: src, alt: media.alt || "", class: "dts-gis-tour-media-el" });
    }

    function renderDots(doc, index) {
      dotsWrap.textContent = "";
      doc.steps.forEach(function (step, i) {
        const dot = el("button", {
          type: "button", class: "dts-gis-tour-dot" + (i === index ? " is-active" : ""),
          "aria-label": "Go to step " + (i + 1) + ": " + (step.title || "")
        });
        dot.addEventListener("click", function () {
          if (instance.tourGoTo) instance.tourGoTo(i);
        });
        dotsWrap.appendChild(dot);
      });
    }

    function announce(text) { liveRegion.textContent = text; }

    function renderStep(doc, index) {
      const step = doc.steps[index];
      if (!step) return;
      active = { doc: doc, index: index, expected: computeExpected(doc, index), offScript: false, showingOutro: false };
      pill.hidden = true;
      pill.textContent = "Back to step " + (index + 1);
      // Real bug, found live: a center/zoom step's setView() animates to
      // its target over several hundred ms (unless prefers-reduced-motion),
      // and liveCenter/liveZoom only update from the "viewchange" event,
      // which fires on moveend -- after that animation finishes. The
      // checkOffScript() call below runs synchronously, right here, so
      // without this it was comparing the *previous* step's still-in-flight
      // position against the *new* step's expected one and flagging
      // off-script immediately on every animated step change. Seeding
      // optimistically to the commanded target is safe either way: if the
      // flight actually lands there, the real moveend confirms no drift; if
      // the user interrupts it mid-flight, their own moveend reports the
      // real (different) position and off-script still catches it then.
      if (active.expected.view && active.expected.view.center) {
        liveCenter = active.expected.view.center;
        if (typeof active.expected.view.zoom === "number") liveZoom = active.expected.view.zoom;
      }
      // The step's own setView() (already issued by gis-viewer.js's
      // applyStep() before this "tourstep" listener runs) will fire its
      // own real "viewchange" event(s) as it settles -- scheduleViewCheck()
      // re-validates once those go quiet, the same debounced path any
      // later user-driven pan/zoom uses.
      scheduleViewCheck();

      card.hidden = false;
      card.classList.remove("dts-gis-tour-outro");
      headLabel.textContent = "TOUR · " + (index + 1) + " of " + doc.steps.length;
      titleEl.textContent = step.title || "";
      bodyEl.textContent = step.body || "";
      mediaWrap.textContent = "";
      const m = mediaEl(step.media);
      if (m) mediaWrap.appendChild(m);
      mediaWrap.hidden = !m;

      if (doc.showProgress !== false) { renderDots(doc, index); dotsWrap.hidden = false; }
      else dotsWrap.hidden = true;

      backBtn.disabled = index === 0;
      nextBtn.textContent = index === doc.steps.length - 1 ? "Done" : "Next";
      ctaBtn.hidden = true;
      nav.hidden = false;

      checkOffScript();
      announce("Step " + (index + 1) + " of " + doc.steps.length + ": " + (step.title || ""));
    }

    function ctaAction(action) {
      if (!action) return;
      if (action === "exit") { instance.exitTour(); return; }
      if (action === "openLayerPanel" || action === "openAttributeTable") {
        if (typeof opts.onAction === "function") opts.onAction(action);
        return;
      }
      if (action.indexOf("startTour:") === 0) {
        const id = action.slice("startTour:".length);
        if (tourDocs[id]) startTour(id);
        return;
      }
      if (action.indexOf("link:") === 0) {
        const url = action.slice("link:".length);
        window.open(url, "_blank", "noopener");
      }
    }

    function renderOutro(doc) {
      if (!active) return;
      active.showingOutro = true;
      pill.hidden = true;
      const outro = doc.outro || {};
      card.classList.add("dts-gis-tour-outro");
      headLabel.textContent = "TOUR · complete";
      titleEl.textContent = outro.title || "Explore on your own";
      bodyEl.textContent = outro.body || "";
      mediaWrap.textContent = ""; mediaWrap.hidden = true;
      dotsWrap.hidden = true;
      nav.hidden = true;
      if (outro.cta && outro.cta.label) {
        ctaBtn.textContent = outro.cta.label;
        ctaBtn.hidden = false;
        ctaBtn.onclick = function () { ctaAction(outro.cta.action); };
      } else {
        ctaBtn.hidden = true;
      }
      announce("Tour complete: " + (outro.title || "Explore on your own"));
    }

    /* ================= keyboard (§2, §10) =================
       Scoped to when focus is inside the tour card -- matches "focus
       goes to the card on start" (below), so arrow keys drive the
       tour without also fighting Leaflet's own default arrow-key map
       panning whenever the map itself happens to hold focus. */
    function onKeydown(e) {
      if (!active || card.hidden) return;
      if (!host.contains(document.activeElement)) return;
      if (e.key === "Escape") { e.preventDefault(); instance.exitTour(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); nextBtn.click(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); backBtn.click(); return; }
    }
    document.addEventListener("keydown", onKeydown);

    /* ================= engine hookup ================= */
    let lastLauncherFocus = null;
    offEvents.push(instance.on("tourstep", function (detail) {
      if (!detail || !detail.tourId) {
        // exitTour() -- §2: "leaves the map in the current step's
        // state" -- this file only ever hides the card, never calls
        // setView/setLayerVisible to restore anything.
        if (active) showToast("Tour ended. The map is where you left it.");
        active = null;
        card.hidden = true;
        card.classList.remove("dts-gis-tour-outro");
        if (lastLauncherFocus && typeof lastLauncherFocus.focus === "function") lastLauncherFocus.focus();
        if (typeof opts.onExit === "function") opts.onExit();
        return;
      }
      const doc = tourDocs[detail.tourId];
      if (!doc) return;
      renderStep(doc, detail.index);
    }));

    // Real bug, found by inspection while wiring this in, not live: a tour
    // can already be running by the time this file's mount() is even
    // called -- js/app.js's mountGis() passes opts.tourId straight to
    // DTSGis.mount() (an experience-level "always start this tour" field,
    // per js/content-loader.js's gis branch, predating Phase 4), and a
    // restored `?...&map=` state param (task 4.4) can likewise call
    // startTour()+applyStep() from inside createInstance() -- both cases
    // fire "tourstep" synchronously before this listener above ever
    // existed to hear it, which would otherwise silently apply the step
    // to the map with no card ever shown. getState().t (already emitted
    // by gis-viewer.js since Phase 3a) is the one place that still knows
    // the answer after the fact -- sync the card to it once, here, before
    // relying on the listener for every step after this one.
    (function syncAlreadyActiveTour() {
      const t = instance.getState().t;
      if (!Array.isArray(t) || !t[0]) return;
      const doc = tourDocs[t[0]];
      if (!doc) return;
      renderStep(doc, typeof t[1] === "number" ? t[1] : 0);
    })();

    function startTour(tourId) {
      const doc = tourDocs[tourId];
      if (!doc) { console.warn('[gis-tour] unknown tour "' + tourId + '"'); return; }
      lastLauncherFocus = document.activeElement;
      instance.startTour(tourId);
      // Focus lands on the card once the first step has rendered
      // (tourstep fires synchronously from startTour above).
      titleEl.setAttribute("tabindex", "-1");
      titleEl.focus();
    }

    function destroy() {
      offEvents.forEach(function (off) { off(); });
      document.removeEventListener("keydown", onKeydown);
      if (toastTimer) clearTimeout(toastTimer);
      if (viewCheckTimer) clearTimeout(viewCheckTimer);
      host.remove();
    }

    return { startTour: startTour, destroy: destroy, isActive: function () { return !!active; } };
  }

  window.DTSGisTour = { mount: mount };
})();
