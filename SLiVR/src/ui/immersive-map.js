/** Collapsible location context using the same map, imagery and pin adapter as Explore. */
import { createMapAdapter } from "../map/maplibre-adapter.js";

export function createImmersiveMap({ doc, win, region, onExplore, onSelect, makeAdapter = createMapAdapter }) {
  const node = (tag, className, text = "") => {
    const element = doc.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };
  const element = node("section", "immersive-map");
  element.setAttribute("aria-label", "Location map");
  const header = node("div", "immersive-map-header");
  const toggle = node("button", "immersive-map-toggle");
  toggle.setAttribute("type", "button");
  toggle.setAttribute("aria-controls", "immersive-map-body");
  const open = node("button", "immersive-map-open", "Open Explore");
  open.setAttribute("type", "button");
  const body = node("div", "immersive-map-body");
  body.setAttribute("id", "immersive-map-body");
  const caption = node("p", "immersive-map-caption");
  const viewport = node("div", "immersive-map-viewport");
  const canvas = node("div", "immersive-map-canvas");
  const controls = node("div", "immersive-map-controls");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Map controls");
  const paths = {
    plus: "M5 12h14M12 5v14", minus: "M5 12h14",
    center: "M12 2v4M12 18v4M2 12h4M18 12h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 3v18M4 7.5l8 4.5 8-4.5",
    layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
    enlarge: "M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5",
    restore: "M3 8h5V3M16 3v5h5M21 16h-5v5M8 21v-5H3",
  };
  function icon(button, name) {
    const shape = name === "minus"
      ? '<rect x="5" y="11" width="14" height="2" rx="1" fill="currentColor" stroke="none"/>'
      : `<path d="${paths[name]}"/>`;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>`;
  }
  function control(label, name, action) {
    const button = node("button", "immersive-map-control");
    icon(button, name);
    button.setAttribute("type", "button");
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.addEventListener("click", action);
    controls.append(button);
    return button;
  }
  control("Zoom in", "plus", () => adapter?.zoomIn());
  control("Zoom out", "minus", () => adapter?.zoomOut());
  control("Recenter on current location", "center", () => adapter?.focusLocation(location?.id));
  const dimension = control("Toggle 3D map", "cube", () => {
    adapter?.setTilted(!adapter.tilted); refreshControls();
  });
  const streets = control("Toggle street layer", "layers", () => {
    adapter?.toggleReference(); refreshControls();
  });
  const size = control("Enlarge map temporarily", "enlarge", () => setLarge(!large));
  const status = node("p", "immersive-map-status");
  status.setAttribute("role", "status");
  const retry = node("button", "immersive-map-retry", "Retry map");
  retry.setAttribute("type", "button");
  retry.hidden = true;
  header.append(toggle, open);
  viewport.append(canvas, controls);
  body.append(caption, viewport, status, retry);
  element.append(header, body);

  let expanded = !win.matchMedia?.("(max-width: 64rem)").matches;
  let adapter = null, location = null, webgl = true, drawnId = null;
  let generation = 0, records = [], inventoryKey = "", drawnKey = null;
  let large = false, blurTimer = null;
  function refreshControls() {
    dimension.setAttribute("aria-pressed", String(Boolean(adapter?.tilted)));
    streets.setAttribute("aria-pressed", String(Boolean(adapter?.referenceVisible)));
  }
  function setLarge(next) {
    large = next;
    element.classList.toggle("is-enlarged", large);
    icon(size, large ? "restore" : "enlarge");
    size.setAttribute("title", large ? "Restore normal map size" : "Enlarge map temporarily");
    size.setAttribute("aria-label", large ? "Restore normal map size" : "Enlarge map temporarily");
    size.setAttribute("aria-pressed", String(large));
    adapter?.resize();
  }
  function outside(event) {
    let target = event.target;
    while (target && target !== element) target = target.parentNode;
    if (large && !target) setLarge(false);
  }
  function escape(event) {
    if (large && event.key === "Escape") { setLarge(false); size.focus(); }
  }
  function blur() {
    // Cross-origin iframe events cannot bubble into the shell. Observe focus only.
    win.clearTimeout?.(blurTimer);
    blurTimer = win.setTimeout?.(() => {
      blurTimer = null;
      if (large && doc.activeElement?.tagName === "IFRAME") setLarge(false);
    }, 0);
  }
  doc.addEventListener("pointerdown", outside, true);
  doc.addEventListener("focusin", outside, true);
  doc.addEventListener("wheel", outside, { capture: true, passive: true });
  doc.addEventListener("keydown", escape, true);
  win.addEventListener?.("blur", blur);
  refreshControls();
  setLarge(false);

  function release() {
    generation++;
    adapter?.dispose();
    adapter = null;
    drawnId = null; drawnKey = null;
    refreshControls();
  }

  function render() {
    element.hidden = !location;
    body.hidden = !expanded;
    toggle.textContent = expanded ? "Hide map" : "Show map";
    toggle.setAttribute("aria-expanded", String(expanded));
    if (!location || !expanded) { setLarge(false); release(); return; }
    caption.textContent = `${location.id} · ${location.name}`;
    if (!adapter) {
      status.textContent = "Loading aerial map…";
      retry.hidden = true;
      const session = ++generation;
      adapter = makeAdapter({ container: canvas, region, maplibre: globalThis.maplibregl,
        webgl, compact: true, runtimeConfig: win.SLIVR_RUNTIME ?? null, onEvent(event) {
          if (session !== generation) return;
          if (event.type === "tiles-changed") {
            status.textContent = event.status?.message ?? "3D unavailable; Aerial map remains available";
          }
          if (event.type === "imagery-changed") {
            const source = event.status;
            status.textContent = source.state === "neutral" ? "Aerial imagery unavailable. Open Explore or retry."
              : `DOTD ${source.year}${source.isFallback ? " · fallback" : ""} · Approximate location`;
            retry.hidden = !source.isFallback && source.state !== "neutral";
          } else if (event.type === "unavailable" || event.type === "error") {
            status.textContent = "Map unavailable. You can still open this location in Explore.";
            retry.hidden = false;
          }
        } });
      const result = adapter.create();
      if (!result.ok) {
        release();
        status.textContent = "Map unavailable. You can still open this location in Explore.";
        retry.hidden = false;
        return;
      }
    }
    if (drawnKey !== inventoryKey) {
      adapter.setLocations(records, id => onSelect?.(id));
      drawnKey = inventoryKey;
    }
    if (drawnId !== location.id) {
      adapter.setSelectedLocation(location.id);
      drawnId = location.id;
    }
  }

  toggle.addEventListener("click", () => { expanded = !expanded; render(); });
  open.addEventListener("click", () => { if (location) onExplore(location.id); });
  retry.addEventListener("click", () => { release(); render(); });
  element.hidden = true;
  return { element,
    update(nextLocation, capability, nextRecords = nextLocation ? [nextLocation] : []) {
      const nextKey = JSON.stringify(nextRecords.map(item => [item.id, item.position]));
      const changed = location?.id !== nextLocation?.id || webgl !== capability || inventoryKey !== nextKey;
      if (webgl !== capability) release();
      records = nextRecords; inventoryKey = nextKey;
      location = nextLocation;
      webgl = capability;
      if (changed || !location) render();
    },
    dispose() {
      location = null; setLarge(false); release(); element.hidden = true;
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("focusin", outside, true);
      doc.removeEventListener("wheel", outside, true);
      doc.removeEventListener("keydown", escape, true);
      win.removeEventListener?.("blur", blur);
      win.clearTimeout?.(blurTimer);
    },
  };
}
