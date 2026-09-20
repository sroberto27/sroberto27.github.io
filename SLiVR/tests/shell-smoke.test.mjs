/**
 * Boot smoke check.
 *
 * A blank page has two very different causes: the application threw while
 * building itself, or it was opened in a way that never ran it at all, such as
 * from the file system where modules and fetch are blocked. Those look
 * identical on screen. This boots the real entry point against a DOM
 * stand-in so the first cause can be ruled out from the command line.
 *
 * It is not a substitute for a browser. Nothing here lays out, paints or
 * handles a real event, so the live checks still decide whether the shell is
 * usable.
 */

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakeDom } from "./fixtures/dom.mjs";
import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";

const ROOT = new URL("../", import.meta.url);

const REAL_FETCH = globalThis.fetch;
const REAL_DOCUMENT = globalThis.document;

/** Serves the project files the way an HTTP server would. */
function serveFromDisk(missing = () => false) {
  globalThis.fetch = async (path) => {
    if (missing(String(path))) {
      return { ok: false, status: 500, statusText: "Server Error", json: async () => ({}) };
    }
    try {
      const body = readFileSync(new URL(String(path), ROOT), "utf8");
      return { ok: true, status: 200, statusText: "OK", json: async () => JSON.parse(body) };
    } catch {
      return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) };
    }
  };
}

/**
 * Boots the real entry point against a DOM stand-in.
 *
 * The globals stay installed after this returns. The shell creates elements
 * through the ambient document, as it does in a browser, so a later re-render
 * would throw if the global were restored while the page was still live — and
 * the store reports a failing subscriber rather than propagating it, so the
 * failure would be silent.
 */
async function bootShell({ hash = "", withStorage = true, indexedDB = null, missing } = {}) {
  serveFromDisk(missing);
  const dom = createFakeDom({
    hash,
    indexedDB: indexedDB ?? (withStorage ? createFakeIndexedDB().factory : null),
  });
  globalThis.document = dom.document;
  const { boot } = await import("../src/app/main.js");
  const app = await boot({ root: dom.app, win: dom.window });
  return { ...app, dom };
}

after(() => {
  globalThis.fetch = REAL_FETCH;
  globalThis.document = REAL_DOCUMENT;
});

test("booting builds a page rather than leaving an empty body", async () => {
  const { dom } = await bootShell();
  assert.ok(dom.app.children.length > 0, "the application root must not be empty");

  const text = dom.app.textContent;
  assert.match(text, /SLiVR/);
  assert.match(text, /Explore/);
  assert.match(text, /Projects/);
  assert.match(text, /Immersive/);
  assert.match(text, /Shot Designer/);
});

test("the four approved modes are buttons, with the active one marked", async () => {
  // Partial automated evidence for test 15. It shows the controls exist and
  // carry an active state; whether they are legible and keyboard-operable is
  // a live check.
  const { dom } = await bootShell();
  const buttons = dom.app.descendants().filter((node) => node.getAttribute("data-mode"));
  assert.deepEqual(
    buttons.map((button) => button.getAttribute("data-mode")),
    ["explore", "projects", "immersive", "shot"],
  );

  const active = buttons.filter((button) => button.getAttribute("aria-current") === "page");
  assert.equal(active.length, 1, "exactly one mode is current");
  assert.equal(active[0].getAttribute("data-mode"), "explore");
});

test("the catalog loads and the shell reports what it holds", async () => {
  const { store, dom } = await bootShell();
  const state = store.getState();
  assert.equal(state.catalogError, null);
  assert.equal(state.catalog.locations.length, 17);
  assert.match(dom.app.textContent, /Catalog version/);
  assert.match(dom.app.textContent, /17 \(11 current, 6 future\)/);
});

test("a deep route opens directly and names the record", async () => {
  const { store, dom } = await bootShell({ hash: "#/location/LOC-003" });
  assert.equal(store.getState().route.name, "location");
  assert.equal(store.getState().routeResolution.status, "ok");
  assert.match(dom.app.textContent, /LOC-003/);
});

test("an unknown identifier reaches the recoverable not-found panel", async () => {
  const { store, dom } = await bootShell({ hash: "#/location/LOC-999" });
  assert.equal(store.getState().routeResolution.status, "unknown-record");
  assert.match(dom.app.textContent, /did not resolve/);
  assert.match(dom.app.textContent, /Nothing was lost/);
});

test("switching mode by clicking a button re-renders that mode", async () => {
  const { dom, store } = await bootShell();
  const projects = dom.app.descendants().find((node) => node.getAttribute("data-mode") === "projects");
  projects.click();
  dom.window.dispatch("hashchange");

  assert.equal(store.getState().mode, "projects");
  assert.match(dom.app.textContent, /New local project/);
});

test("a map library that will not load leaves the shell working and says so", async () => {
  // `maplibre-gl` is a bare specifier with no import map in Node, so the
  // dynamic import fails exactly as it would if the CDN were unreachable.
  const { store, dom } = await bootShell();
  assert.equal(store.getState().map.status, "unavailable");
  assert.match(store.getState().map.error.message, /did not load/);
  // The mode is still usable and still lists the catalog.
  assert.match(dom.app.textContent, /Catalog records/);
});

test("without local storage the shell warns instead of failing", async () => {
  const { store, dom } = await bootShell({ withStorage: false });
  assert.equal(store.getState().storage.available, false);
  assert.match(dom.app.textContent, /Running without local saving/);
  assert.match(dom.app.textContent, /Export it before you leave/);
});

test("a project created in the interface is listed and survives a reboot", async () => {
  // One shared database across both boots, standing in for one browser profile.
  const shared = createFakeIndexedDB().factory;

  const first = await bootShell({ indexedDB: shared });
  await first.actions.createProject("Smoke production");
  assert.match(first.dom.app.textContent, /Smoke production/);

  const second = await bootShell({ indexedDB: shared });
  second.router.navigate({ name: "projects" });
  second.dom.window.dispatch("hashchange");

  assert.equal(second.store.getState().projects.length, 1);
  assert.match(second.dom.app.textContent, /Smoke production/);
});

test("a broken catalog shows the failure and lists no locations", async () => {
  const { store, dom } = await bootShell({
    missing: (path) => path.includes("captures.v1.json"),
  });

  assert.equal(store.getState().catalog, null);
  assert.ok(store.getState().catalogError);
  assert.match(dom.app.textContent, /A partial catalog is never shown/);
  assert.equal(/LOC-001/.test(dom.app.textContent), false);
});

/** The persistent viewer frame the immersive surface renders into. */
function viewerFrame(dom) {
  return dom.app.descendants().find((node) => node.className === "viewer-frame") ?? null;
}

test("opening a captured location loads its supplied entry into the viewer frame", async () => {
  // Partial automated evidence for tests 28 and 29: the route reaches the
  // provider URL recorded for that record, not a generic experience URL.
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-001" });
  const state = store.getState();

  assert.equal(state.mode, "immersive");
  assert.equal(state.viewer.captureId, "CAP-001");
  assert.equal(state.viewer.status, "loading");

  const frame = viewerFrame(dom);
  assert.ok(frame, "the immersive surface renders a frame");
  assert.equal(frame.hidden, undefined, "the frame is not hidden in the mode that uses it");

  const capture = state.catalog.capturesByLocationId.get("LOC-001");
  assert.equal(frame.getAttribute("src"), capture.url);
  assert.match(capture.url, /5eb11a1b/, "the shared downtown experience");
  assert.match(capture.url, new RegExp(capture.sweepId), "carrying this record's own sweep");
});

test("six downtown records share one experience and still open at six distinct sweeps", async () => {
  // The property test 29 exists for, at the routing layer: a shared experience
  // must not collapse six catalog records into one destination.
  const opened = new Map();
  for (const id of ["LOC-001", "LOC-002", "LOC-003", "LOC-004", "LOC-005", "LOC-006"]) {
    const { store, dom } = await bootShell({ hash: `#/immersive/${id}` });
    opened.set(id, viewerFrame(dom).getAttribute("src"));
    assert.equal(store.getState().viewer.locationId, id);
  }

  const urls = [...opened.values()];
  assert.equal(new Set(urls).size, 6, "six distinct entry URLs");
  assert.ok(urls.every((url) => url.includes("5eb11a1b")), "one shared experience");
});

test("leaving the mode releases the provider session rather than leaving it streaming", async () => {
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-001" });
  assert.equal(store.getState().viewer.status, "loading");

  dom.window.location.hash = "#/explore";
  dom.window.dispatch("hashchange");

  assert.equal(store.getState().viewer.status, "idle");
  assert.equal(store.getState().viewer.captureId, null);
  assert.equal(viewerFrame(dom).getAttribute("src"), "about:blank");
});

test("a future candidate has nothing to open and no frame is pointed anywhere", async () => {
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-014" });
  assert.equal(store.getState().routeResolution.status, "ok");
  assert.equal(store.getState().viewer.status, "idle");
  assert.equal(viewerFrame(dom).getAttribute("src"), "about:blank");
  assert.match(dom.app.textContent, /nothing to open/);
});

test("198: switching and retrying immersive sessions through the shell is re-entrancy safe", async () => {
  const { store, dom, actions } = await bootShell({ hash: "#/immersive/LOC-001" });
  const old = viewerFrame(dom);
  old.contentWindow = { postMessage() {} };
  dom.window.location.hash = "#/immersive/LOC-009";
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().viewer.captureId, "CAP-009");
  assert.equal(store.getState().viewer.status, "loading");
  assert.notEqual(viewerFrame(dom), old);
  dom.advance(60001);
  assert.equal(store.getState().viewer.status, "timedOut");
  const stalled = viewerFrame(dom);
  const retry = dom.app.descendants().find(n => n.tagName === "BUTTON" && n.textContent === "Reload supplied entry");
  assert.ok(retry, "timeout must offer retry in the product");
  retry.click();
  assert.equal(store.getState().viewer.status, "loading");
  assert.notEqual(viewerFrame(dom), stalled);
  assert.equal(actions.viewerReport().captureId, "CAP-009");
  actions.unmountViewer();
});

test("199: Stop waiting returns to the location without immediately remounting Treedis", async () => {
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-001" });
  dom.advance(25001);
  const cancel = dom.app.descendants().find(n => n.tagName === "BUTTON" && n.textContent === "Stop waiting");
  assert.equal(cancel.hidden, false);
  cancel.click();
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().mode, "explore");
  assert.equal(store.getState().routeResolution.locationId, "LOC-001");
  assert.equal(store.getState().viewer.status, "idle");
  assert.equal(viewerFrame(dom).getAttribute("src"), "about:blank");
});
