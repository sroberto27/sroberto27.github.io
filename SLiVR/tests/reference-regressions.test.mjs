import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTreedisAdapter } from "../src/immersive/treedis-adapter.js";
import { createMapAdapter } from "../src/map/maplibre-adapter.js";
import { IMAGERY_SOURCE_ID, IMAGERY_LAYER_ID } from "../src/map/imagery.js";
import { createActions, initialState } from "../src/app/actions.js";
import { createStore } from "../src/app/store.js";
import { createViewerHost } from "../src/immersive/viewer-host.js";
import { createFakeDom } from "./fixtures/dom.mjs";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
const captures = JSON.parse(readFileSync(new URL("../data/catalog/captures.v1.json", import.meta.url))).captures;
const entry = captures[0];

// Deterministic event ordering; this harness supplies no provider or rendering evidence.
function viewerHarness() {
  let time = 0;
  let sequence = 0;
  const timers = new Map();
  const listeners = new Set();
  const posted = [];
  const win = {
    addEventListener(type, fn) { if (type === "message") listeners.add(fn); },
    removeEventListener(type, fn) { if (type === "message") listeners.delete(fn); },
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  function makeFrame() {
    const handlers = new Map();
    const attributes = new Map();
    return {
      handlers,
      contentWindow: { postMessage(message, origin) { posted.push({ message, origin }); } },
      setAttribute(key, value) { attributes.set(key, value); },
      getAttribute(key) { return attributes.get(key) ?? null; },
      addEventListener(type, fn) {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type).add(fn);
      },
      removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
      fire(type) { for (const fn of [...(handlers.get(type) ?? [])]) fn({ type }); },
    };
  }
  const frame = makeFrame();
  return {
    win, frame, makeFrame, posted, timers,
    send(data, source = frame.contentWindow) {
      for (const fn of [...listeners]) fn({ data, source, origin: region.immersive.origin });
    },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); time = next[1].at; next[1].fn();
      }
      time = end;
    },
  };
}

function actionsHarness(h, loadMapLibrary = async () => null) {
  const store = createStore(initialState({ webgl: true, indexedDB: false }));
  const actions = createActions({ store, region, viewerWindow: h.win, loadMapLibrary });
  return { actions, store };
}

test("185: SCSU entry navigation waits for readiness and carries the supplied orientation", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, { ...entry, startX: 0, startY: 0 });
  h.send({ type: "TourReady" });
  h.advance(599);
  assert.equal(h.posted.filter(p => p.message.type === "Navigate").length, 0);
  h.advance(1);
  assert.deepEqual(h.posted.find(p => p.message.type === "Navigate")?.message, {
    type: "Navigate", sweepId: entry.sweepId, transitionTime: 0, rotation: { x: 0, y: 0 },
  });
  h.send({ type: "PoseChanged", sweep: entry.sweepId, x: 0 });
  assert.equal(h.timers.size, 0, "arrival at the entry sweep clears verification timers");
  adapter.dispose();
});

test("186: iframe load cannot restart a handshake that already received TourReady", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, entry);
  h.send({ type: "TourReady" });
  h.frame.fire("load");
  h.advance(600);
  h.send({ type: "PoseChanged", sweep: entry.sweepId });
  h.advance(30000);
  assert.equal(adapter.state, "ready", "late load must not turn a connected viewer unresponsive");
  adapter.dispose();
});

test("187: another frame on the provider origin cannot report ready for this viewer", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, entry);
  h.send({ type: "TourReady" }, h.makeFrame().contentWindow);
  assert.equal(adapter.state, "handshaking");
  assert.equal(adapter.capabilities.ready, "unknown");
  adapter.dispose();
});

test("188: a frame that emits neither load nor error has a bounded wait", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: { ...region.immersive, loadTimeoutMs: 1000 }, win: h.win });
  adapter.attach(h.frame, entry);
  h.advance(1001);
  assert.equal(adapter.state, "timedOut");
  assert.equal(adapter.capabilities.embedding, "unknown");
  assert.equal(h.timers.size, 0);
  adapter.dispose();
});

test("189: document load alone does not prove that Treedis embedded successfully", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, entry);
  h.frame.fire("load");
  assert.equal(adapter.capabilities.embedding, "unknown");
  adapter.dispose();
});

test("190: changing downtown entry reuses the responsive SCSU-style session", () => {
  const h = viewerHarness();
  const { actions, store } = actionsHarness(h);
  const first = actions.mountViewer(h.frame, entry);
  h.send({ type: "TourReady" });
  h.advance(600);
  h.send({ type: "PoseChanged", sweep: entry.sweepId });
  const url = h.frame.getAttribute("src");
  const sibling = captures[4];
  const second = actions.mountViewer(h.frame, sibling);
  assert.equal(h.frame.getAttribute("src"), url, "same experience must not be downloaded again");
  assert.equal(second, first);
  assert.equal(store.getState().viewer.locationId, sibling.locationId);
  assert.deepEqual(h.posted.filter(p => p.message.type === "Navigate").at(-1).message.rotation,
    { x: sibling.startX, y: sibling.startY });
  h.send({ type: "PoseChanged", sweep: sibling.sweepId });
  assert.equal(actions.viewerReport().captureId, sibling.id);
  actions.unmountViewer();
});

test("191: reattaching and disposing leaves no frame listeners or delayed callbacks", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, entry);
  adapter.attach(h.frame, entry);
  adapter.dispose();
  assert.equal([...h.frame.handlers.values()].reduce((n, handlers) => n + handlers.size, 0), 0);
  const before = adapter.report().observations.length;
  h.frame.fire("load");
  h.advance(30000);
  assert.equal(adapter.state, "idle");
  assert.equal(adapter.report().observations.length, before);
  assert.equal(h.timers.size, 0);
});

function mapHarness() {
  const handlers = new Map();
  const sources = new Map();
  const layers = new Map();
  let additions = 0;
  const map = {
    on(type, fn) { handlers.set(type, fn); },
    loaded: () => true,
    addControl() {},
    getStyle: () => ({ layers: [...layers.values()] }),
    getSource: id => sources.get(id),
    getLayer: id => layers.get(id),
    addSource(id, spec) { additions++; sources.set(id, spec); },
    addLayer(spec) { layers.set(spec.id, spec); },
    removeSource(id) { sources.delete(id); },
    removeLayer(id) { layers.delete(id); },
    remove() {},
  };
  const library = { Map: function () { return map; } };
  const adapter = createMapAdapter({ container: {}, region, maplibre: library });
  return { adapter, library, map, additions: () => additions,
    fail: () => handlers.get("error")({ sourceId: IMAGERY_SOURCE_ID, error: new Error("tile refused") }),
    succeed: () => handlers.get("data")({ sourceId: IMAGERY_SOURCE_ID, tile: {}, isSourceLoaded: true }),
  };
}

test("192: real imagery source errors activate fallback and neutral recovery", () => {
  const h = mapHarness(); h.adapter.create();
  for (let i = 0; i < 4; i++) h.fail();
  assert.equal(h.adapter.imagery.year, 2024);
  for (let i = 0; i < 4; i++) h.fail();
  assert.equal(h.adapter.imagery.state, "neutral");
  assert.equal(h.map.getLayer(IMAGERY_LAYER_ID), undefined);
  h.adapter.retryImagery();
  assert.equal(h.adapter.imagery.year, 2025);
  assert.ok(h.map.getSource(IMAGERY_SOURCE_ID));
  h.adapter.dispose();
});

test("193: tile success resets failure count without rebuilding the current source", () => {
  const h = mapHarness(); h.adapter.create();
  h.succeed();
  assert.equal(h.adapter.imagery.state, "active");
  for (let i = 0; i < 3; i++) h.fail();
  h.succeed(); h.fail();
  assert.equal(h.adapter.imagery.year, 2025);
  assert.equal(h.additions(), 1, "isolated tile failures must not restart the imagery download");
  h.adapter.dispose();
});

test("194: leaving Explore while its library loads prevents a stale map mount", async () => {
  const h = viewerHarness();
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  const { actions, store } = actionsHarness(h, () => promise);
  const mounting = actions.mountMap({});
  actions.unmountMap();
  resolve(mapHarness().library);
  await mounting;
  assert.equal(store.getState().map.status, "idle");
  actions.unmountMap();
});

test("195: malformed provider poses and sweep lists do not change capabilities", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, entry);
  h.send({ type: "PoseChanged", sweep: entry.sweepId, x: Infinity });
  h.send({ type: "SweepsChanged", sweeps: [42] });
  assert.equal(adapter.capabilities.messaging, "unknown");
  assert.equal(adapter.capabilities.poseReporting, "unknown");
  assert.equal(adapter.capabilities.sweepList, "unknown");
  adapter.dispose();
});

test("196: independent experience gets a fresh frame that rejects abandoned ready messages", () => {
  const h = viewerHarness();
  const dom = createFakeDom();
  const host = createViewerHost({ doc: dom.document, win: h.win });
  const { actions, store } = actionsHarness(h);
  actions.mountViewer(host.frame, entry, host.renewFrame);
  const oldFrame = host.frame;
  oldFrame.contentWindow = h.makeFrame().contentWindow;
  actions.mountViewer(host.frame, captures[8], host.renewFrame);
  assert.notEqual(host.frame, oldFrame, "a persistent WindowProxy cannot distinguish old-model messages");
  host.frame.contentWindow = h.makeFrame().contentWindow;
  h.send({ type: "TourReady" }, oldFrame.contentWindow);
  assert.equal(store.getState().viewer.status, "handshaking");
  h.send({ type: "TourReady" }, host.frame.contentWindow);
  h.advance(600);
  h.send({ type: "PoseChanged", sweep: captures[8].sweepId }, host.frame.contentWindow);
  assert.equal(store.getState().viewer.status, "ready");
  assert.equal(oldFrame.getAttribute("src"), "about:blank");
  assert.equal(host.element.children.filter(node => node.tagName === "IFRAME").length, 1);
  actions.unmountViewer(); host.dispose();
});

test("197: cancelled verification cannot post a stale command after another request to the same sweep", () => {
  const h = viewerHarness();
  const adapter = createTreedisAdapter({ region: region.immersive, win: h.win });
  adapter.attach(h.frame, entry);
  h.send({ type: "TourReady" }); h.advance(600);
  const queued = [...h.timers.values()].find(t => t.at === 2100).fn;
  adapter.goToSweep(entry.sweepId, { rotation: { x: 0, y: 90 } });
  const count = h.posted.length;
  queued();
  assert.equal(h.posted.length, count);
  adapter.dispose();
});

test("220: downtown, Magnolia and Moncus transitions preserve session identity and reject abandoned frames", () => {
  const h = viewerHarness();
  const dom = createFakeDom();
  const host = createViewerHost({ doc: dom.document, win: h.win });
  const { actions, store } = actionsHarness(h);
  let previousFrame = null;
  let previousCapture = null;

  for (const locationId of ["LOC-001", "LOC-005", "LOC-009", "LOC-011"]) {
    const capture = captures.find(record => record.locationId === locationId);
    actions.mountViewer(host.frame, capture, host.renewFrame);
    host.frame.contentWindow ??= h.makeFrame().contentWindow;
    if (previousFrame) {
      if (previousCapture.experienceId === capture.experienceId) {
        assert.equal(host.frame, previousFrame, "downtown retains its responsive session");
      } else {
        assert.notEqual(host.frame, previousFrame, "an independent model gets a fresh source window");
        assert.equal(previousFrame.getAttribute("src"), "about:blank");
        h.send({ type: "TourReady" }, previousFrame.contentWindow);
        h.send({ type: "PoseChanged", sweep: previousCapture.sweepId }, previousFrame.contentWindow);
        assert.equal(store.getState().viewer.status, "handshaking");
      }
    }
    h.send({ type: "TourReady" }, host.frame.contentWindow);
    h.advance(600);
    assert.equal(h.posted.filter(p => p.message.type === "Navigate").at(-1).message.sweepId, capture.sweepId);
    h.send({ type: "PoseChanged", sweep: capture.sweepId }, host.frame.contentWindow);
    assert.equal(store.getState().viewer.status, "ready");
    assert.equal(store.getState().viewer.locationId, locationId);
    assert.equal(actions.viewerReport().captureId, capture.id);
    assert.equal(host.element.children.filter(node => node.tagName === "IFRAME").length, 1);
    previousFrame = host.frame;
    previousCapture = capture;
  }
  actions.unmountViewer();
  host.dispose();
  assert.equal(previousFrame.getAttribute("src"), "about:blank");
  assert.equal(h.timers.size, 0);
  assert.equal(store.getState().viewer.status, "idle");
});
