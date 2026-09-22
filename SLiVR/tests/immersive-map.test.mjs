import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFakeDom } from "./fixtures/dom.mjs";
import { createImmersiveMap } from "../src/ui/immersive-map.js";
import { createMapAdapter } from "../src/map/maplibre-adapter.js";
import { IMAGERY_SOURCE_ID } from "../src/map/imagery.js";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
const locations = JSON.parse(readFileSync(new URL("../data/catalog/locations.v1.json", import.meta.url))).locations;

function fixture(narrow = false) {
  const dom = createFakeDom(), sessions = [], opened = [], selected = [];
  dom.window.matchMedia = () => ({ matches: narrow });
  let fail = false;
  const widget = createImmersiveMap({ doc: dom.document,
    win: dom.window, region,
    onSelect: id => selected.push(id),
    onExplore: id => opened.push(id),
    makeAdapter: options => {
      const session = { options, disposed: false, draws: [], selected: null };
      sessions.push(session);
      return {
        create: () => ({ ok: !fail }),
        dispose: () => { session.disposed = true; },
        resize: () => { session.resizes = (session.resizes ?? 0) + 1; },
        zoomIn: () => { session.zoom = 1; }, zoomOut: () => { session.zoom = -1; },
        focusLocation: id => { session.focus = id; },
        setTilted(value) { this.tilted = value; },
        toggleReference() { this.referenceVisible = !this.referenceVisible; },
        setLocations: (values, callback) => { session.draws.push(values); session.select = callback; },
        setSelectedLocation: id => { session.selected = id; },
      };
    },
  });
  const toggle = widget.element.querySelector(".immersive-map-toggle");
  return { dom, selected, widget, sessions, opened, toggle, fail: value => { fail = value; } };
}

test("222: desktop map is collapsible, reuses its session and follows the selected location", () => {
  const h = fixture();
  h.widget.update(locations[0], true);
  assert.equal(h.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(h.sessions.length, 1);
  assert.equal(h.sessions[0].options.compact, true);
  h.widget.update(locations[0], true);
  assert.equal(h.sessions[0].draws.length, 1, "viewer status redraws do not rebuild the map");
  h.widget.update(locations[10], true);
  assert.equal(h.sessions.length, 1);
  assert.equal(h.sessions[0].selected, "LOC-011");
  h.widget.element.querySelector(".immersive-map-open").click();
  assert.deepEqual(h.opened, ["LOC-011"]);
  h.toggle.click();
  assert.equal(h.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(h.widget.element.querySelector(".immersive-map-body").hidden, true);
  assert.equal(h.sessions[0].disposed, true);
  h.widget.update(locations[8], true);
  assert.equal(h.sessions.length, 1, "hidden maps consume no provider context");
  h.toggle.click();
  assert.equal(h.sessions.length, 2);
  assert.equal(h.sessions[1].selected, "LOC-009");
  h.widget.update(null, true);
  assert.equal(h.widget.element.hidden, true);
  assert.equal(h.sessions[1].disposed, true);
});

test("222: narrow map starts closed but remains available and retains the user's choice", () => {
  const h = fixture(true);
  h.widget.update(locations[3], true);
  assert.equal(h.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(h.sessions.length, 0);
  h.toggle.click();
  assert.equal(h.sessions.length, 1);
  h.widget.update(null, true);
  h.widget.update(locations[8], true);
  assert.equal(h.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(h.sessions[1].selected, "LOC-009");
  h.widget.dispose();
  assert.equal(h.sessions[1].disposed, true);
});

test("222: map failure preserves Explore action and retry ignores disposed-session events", () => {
  const h = fixture();
  h.fail(true);
  h.widget.update(locations[0], false);
  const status = h.widget.element.querySelector(".immersive-map-status");
  const retry = h.widget.element.querySelector(".immersive-map-retry");
  assert.match(status.textContent, /Map unavailable/);
  assert.equal(retry.hidden, false);
  assert.equal(h.sessions[0].disposed, true);
  h.widget.element.querySelector(".immersive-map-open").click();
  assert.deepEqual(h.opened, ["LOC-001"]);
  h.fail(false); retry.click();
  h.sessions[1].options.onEvent({ type: "imagery-changed", status: { year: 2024, isFallback: true, state: "active" } });
  assert.match(status.textContent, /2024 · fallback/);
  h.sessions[0].options.onEvent({ type: "error" });
  assert.match(status.textContent, /2024 · fallback/);
  h.widget.dispose();
});

test("222: compact adapter uses Explore imagery failover with interaction and external controls", () => {
  const handlers = new Map(), sources = new Map(), layers = new Map(), flights = [];
  let options, removed = false, controls = 0;
  const map = {
    loaded: () => true, on: (type, fn) => handlers.set(type, fn), off() {}, resize() {},
    getStyle: () => ({ layers: [...layers.values()] }),
    getSource: id => sources.get(id), getLayer: id => layers.get(id),
    addSource: (id, value) => sources.set(id, value), addLayer: value => layers.set(value.id, value),
    removeSource: id => sources.delete(id), removeLayer: id => layers.delete(id),
    setLayoutProperty() {}, addControl: () => { controls++; },
    flyTo: value => flights.push(value), getMaxZoom: () => 20,
    remove: () => { removed = true; },
  };
  const adapter = createMapAdapter({ region, container: {}, compact: true,
    maplibre: { Map: function (value) { options = value; return map; } } });
  assert.equal(adapter.create().ok, true);
  assert.equal(options.interactive, true);
  assert.deepEqual(options.attributionControl, { compact: false });
  assert.equal(controls, 0);
  adapter.setLocations([locations[3]], () => {});
  adapter.setSelectedLocation("LOC-004");
  assert.equal(flights.at(-1).zoom, 16);
  assert.equal(flights.at(-1).duration, 0);
  assert.deepEqual(flights.at(-1).center, locations[3].position);
  for (let i = 0; i < 4; i++) handlers.get("error")({ sourceId: IMAGERY_SOURCE_ID });
  assert.equal(adapter.imagery.year, 2024);
  for (let i = 0; i < 4; i++) handlers.get("error")({ sourceId: IMAGERY_SOURCE_ID });
  assert.equal(adapter.imagery.state, "neutral");
  assert.equal(sources.has(IMAGERY_SOURCE_ID), false);
  adapter.dispose();
  assert.equal(removed, true);
});


test("224: mini-map selects captures, controls the map and restores size on outside/iframe interaction", () => {
  const h = fixture();
  h.widget.update(locations[0], true, locations.slice(0, 11));
  const session = h.sessions[0];
  session.select("LOC-009");
  assert.deepEqual(h.selected, ["LOC-009"]);
  assert.equal(session.draws[0].length, 11);
  const buttons = h.widget.element.querySelector(".immersive-map-controls").children;
  buttons[0].click(); assert.equal(session.zoom, 1);
  buttons[1].click(); assert.equal(session.zoom, -1);
  buttons[2].click(); assert.equal(session.focus, "LOC-001");
  buttons[3].click(); assert.equal(buttons[3].getAttribute("aria-pressed"), "true");
  buttons[4].click(); assert.equal(buttons[4].getAttribute("aria-pressed"), "true");
  const large = () => h.widget.element.classList.contains("is-enlarged");
  buttons[5].click(); assert.equal(large(), true);
  h.dom.document.dispatch("pointerdown", { target: buttons[0] }); assert.equal(large(), true);
  h.dom.document.dispatch("pointerdown", { target: h.dom.document.body }); assert.equal(large(), false);
  buttons[5].click(); buttons[5].click(); assert.equal(large(), false);
  buttons[5].click(); h.dom.document.dispatch("keydown", { key: "Escape" }); assert.equal(large(), false);
  buttons[5].click();
  h.dom.document.activeElement = h.dom.document.createElement("iframe");
  h.dom.window.dispatch("blur"); h.dom.advance(0); assert.equal(large(), false);
  buttons[5].click(); h.toggle.click(); assert.equal(large(), false);
  h.widget.dispose();
  h.dom.window.dispatch("blur"); h.dom.advance(0);
  assert.equal(session.disposed, true);
});
