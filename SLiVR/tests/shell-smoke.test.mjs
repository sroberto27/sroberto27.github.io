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
import { createMarkers } from "../src/map/markers.js";

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
async function bootShell({ hash = "", withStorage = true, indexedDB = null, missing, diagnostics = null } = {}) {
  serveFromDisk(missing);
  const dom = createFakeDom({
    hash,
    diagnostics,
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

test("227: project editing and deletion review use working controls and safe cancellation", async () => {
  const { dom, store, actions } = await bootShell();
  const project = await actions.createProject("Editable production"); dom.window.dispatch("hashchange");
  const form = dom.app.querySelectorAll("form").find(node => node.querySelectorAll("button").some(b => b.textContent === "Save project changes"));
  form.querySelectorAll("input").find(n => n.getAttribute("name") === "name").value = "Revised production";
  form.dispatch("submit", { preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(store.getState().workingBundle.projects[0].name, "Revised production");
  assert.equal(store.getState().save.state, "saved");
  assert.ok(dom.app.querySelectorAll("button").some(b => b.textContent === "Create scene brief"));
  await actions.requestProjectDeletion(project.id);
  assert.ok(dom.app.textContent.includes("Delete Revised production?"));
  assert.ok(dom.app.textContent.includes("Confirm project deletion"));
  assert.equal(dom.app.querySelector(".workspace").inert, true);
  dom.app.querySelectorAll("button").find(b => b.textContent === "Cancel, keep project").click();
  assert.equal(store.getState().pendingDeletion, null);
  assert.equal(dom.app.querySelector(".workspace").inert, false);
  assert.equal(store.getState().workingBundle.projects[0].id, project.id);
  actions.unmountMap(); actions.unmountViewer();
});

test("226/60-62: bookmark form survives viewer redraw; same-entry restore renews the viewer", async () => {
  const { dom, store, actions } = await bootShell();
  await actions.createProject("Entry bookmarks"); dom.window.dispatch("hashchange");
  actions.navigate({ name: "immersive", params: { locationId: "LOC-009" } }); dom.window.dispatch("hashchange");
  dom.app.querySelectorAll("button").find(b => b.textContent === "Location details").click();
  const input = dom.document.getElementById("bookmark-name");
  input.value = "Front door"; input.dispatch("input", { target: input });
  const note = dom.document.getElementById("bookmark-note");
  note.value = "Confirm access later"; note.dispatch("input", { target: note });
  store.setState({ viewer: { ...store.getState().viewer } });
  assert.equal(dom.document.getElementById("bookmark-name").getAttribute("value"), "Front door");
  assert.equal(dom.document.getElementById("bookmark-note").value, "Confirm access later");
  dom.app.querySelector(".bookmark-form").dispatch("submit", { preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.getState().workingBundle.bookmarks.length, 1);
  assert.equal(store.getState().save.state, "saved");
  const oldFrame = viewerFrame(dom);
  dom.app.querySelectorAll("button").find(b => b.textContent === "Restore entry").click();
  assert.notEqual(viewerFrame(dom), oldFrame, "restoring the current entry must not keep the walked-away view");
  assert.match(store.getState().bookmarkStatus, /Entry restore requested/);
  assert.equal(store.getState().viewer.captureId, "CAP-009");
  actions.unmountViewer(); actions.unmountMap();
});

test("223: Explore list and pin selections open the same location through the Immersive tab", async () => {
  const { dom, store, actions } = await bootShell();
  const tab = mode => dom.app.querySelectorAll("button").find(n => n.getAttribute(mode === "immersive" ? "data-view" : "data-mode") === mode);
  const search = dom.app.descendants().find(n => n.getAttribute("aria-label") === "Search locations");
  search.value = "Magnolia"; search.dispatch("input"); dom.advance(180);
  dom.app.querySelector(".explore-results").querySelectorAll("button")[0].click();
  dom.window.dispatch("hashchange");
  tab("immersive").click(); dom.window.dispatch("hashchange");
  assert.equal(store.getState().route.name, "immersive");
  assert.equal(store.getState().viewer.locationId, "LOC-009");
  assert.equal(store.getState().viewer.captureId, "CAP-009");
  assert.match(viewerFrame(dom).getAttribute("src"), /a872109b/);
  tab("explore").click(); dom.window.dispatch("hashchange");
  assert.equal(store.getState().routeResolution.locationId, "LOC-009");

  const createElement = dom.document.createElement;
  let pin;
  dom.document.createElement = (...args) => {
    const node = createElement(...args); node.dataset = {}; return node;
  };
  const markers = createMarkers({ map: {}, maplibre: { Marker: class {
    constructor({ element }) { pin = element; }
    setLngLat() { return this; }
    addTo() { return this; }
    remove() {}
  } }, onSelect: locationId => actions.navigate({ name: "location", params: { locationId } }) });
  try {
    markers.setLocations([store.getState().catalog.locations.find(l => l.id === "LOC-011")]);
    pin.dispatch("click", { stopPropagation() {} }); dom.window.dispatch("hashchange");
    tab("immersive").click(); dom.window.dispatch("hashchange");
    assert.equal(store.getState().viewer.locationId, "LOC-011");
    assert.equal(store.getState().viewer.captureId, "CAP-011");
    assert.match(viewerFrame(dom).getAttribute("src"), /4c37c871/);
    tab("explore").click(); dom.window.dispatch("hashchange");
    assert.equal(store.getState().routeResolution.locationId, "LOC-011");
    assert.equal(search.value, "Magnolia", "selection handoff preserves retained discovery");
  } finally {
    markers.dispose(); dom.document.createElement = createElement;
    actions.unmountViewer(); actions.unmountMap();
  }
});

test("223: no selection opens the immersive index and a future selection preserves its no-capture state", async () => {
  for (const [hash, expected] of [["#/explore", null], ["#/location/LOC-999", null], ["#/location/LOC-018", "LOC-018"]]) {
    const { dom, store } = await bootShell({ hash });
    dom.app.querySelectorAll("button").find(n => n.getAttribute("data-view") === "immersive").click();
    dom.window.dispatch("hashchange");
    assert.equal(store.getState().route.name, expected ? "immersive" : "immersive-index");
    assert.equal(store.getState().routeResolution.locationId ?? null, expected);
    assert.equal(viewerFrame(dom).getAttribute("src"), "about:blank");
    if (expected) assert.match(dom.app.textContent, /No capture exists/);
  }
});

test("221: Explore returns to the current immersive location and focuses its map position", async () => {
  const previousLibrary = globalThis.maplibregl;
  const flights = [];
  try {
    const { dom, actions, store } = await bootShell();
    const search = dom.app.descendants().find(n => n.getAttribute("aria-label") === "Search locations");
    search.value = "Carpe Diem";
    search.dispatch("input"); dom.advance(180);
    const list = dom.app.querySelector(".explore-results");
    list.scrollTop = 73;
    globalThis.maplibregl = { Map: function () {
      return { loaded: () => false, on() {}, off() {}, addControl() {}, remove() {}, resize() {},
        fitBounds() {}, flyTo: options => flights.push(options), getMaxZoom: () => 20 };
    } };
    store.setState({ capabilities: { ...store.getState().capabilities, webgl: true } });
    for (const locationId of ["LOC-001", "LOC-005", "LOC-009", "LOC-011"]) {
      actions.navigate({ name: "immersive", params: { locationId } });
      dom.window.dispatch("hashchange");
      const frame = dom.app.querySelector("iframe");
      dom.app.querySelectorAll("button").find(n => n.getAttribute("data-mode") === "explore").click();
      dom.window.dispatch("hashchange");
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(store.getState().route.name, "location");
      assert.equal(store.getState().routeResolution.locationId, locationId);
      assert.deepEqual(flights.at(-1)?.center, store.getState().catalog.locations.find(l => l.id === locationId).position);
      assert.equal(dom.app.querySelector(".rail-left").hidden, false);
      assert.match(dom.app.querySelector(".explore-dossier").textContent, new RegExp(locationId));
      assert.equal(frame.getAttribute("src"), "about:blank", "leaving Immersive releases the viewer");
      dom.app.querySelectorAll("button").find(n => n.textContent === "Back to locations").click();
      dom.window.dispatch("hashchange");
      assert.equal(search.value, "Carpe Diem");
      assert.equal(list.scrollTop, 73);
      assert.equal(list.querySelectorAll("button").length, 1, "returning does not clear discovery filters");
    }
    actions.unmountMap();
  } finally { globalThis.maplibregl = previousLibrary; }
});

test("221: Explore from an immersive index or unknown location uses the ordinary map route", async () => {
  for (const hash of ["#/immersive", "#/immersive/LOC-999"]) {
    const { dom, store } = await bootShell({ hash });
    dom.app.querySelectorAll("button").find(n => n.getAttribute("data-mode") === "explore").click();
    dom.window.dispatch("hashchange");
    assert.equal(store.getState().route.name, "explore");
    assert.equal(store.getState().routeResolution.locationId, undefined);
  }
});

test("222: immersive mini-map stays attached during viewer updates and does not reload the tour on collapse", async () => {
  const { dom, store, actions } = await bootShell({ hash: "#/immersive/LOC-001" });
  const mini = dom.app.querySelector(".immersive-map");
  const parent = mini.parentNode;
  const replace = parent.replaceChildren;
  parent.replaceChildren = () => { throw new Error("live mini-map was detached"); };
  const frame = dom.app.querySelector("iframe");
  const src = frame.getAttribute("src");
  try {
    store.setState({ viewer: { ...store.getState().viewer, status: "navigating" } });
    assert.equal(dom.app.querySelector(".immersive-map"), mini);
    assert.equal(mini.parentNode, parent);
    mini.querySelector(".immersive-map-toggle").click();
    assert.equal(frame.getAttribute("src"), src);
    mini.querySelector(".immersive-map-toggle").click();
    assert.equal(frame.getAttribute("src"), src);
    actions.navigate({ name: "immersive", params: { locationId: "LOC-009" } });
    dom.window.dispatch("hashchange");
    assert.match(mini.querySelector(".immersive-map-caption").textContent, /Magnolia Pantry/);
  } finally { parent.replaceChildren = replace; }
  mini.querySelector(".immersive-map-open").click();
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().routeResolution.locationId, "LOC-009");
  assert.equal(store.getState().mode, "explore");
  assert.equal(dom.app.querySelector(".immersive-map"), null);
});

test("booting builds a page rather than leaving an empty body", async () => {
  const { dom } = await bootShell();
  assert.ok(dom.app.children.length > 0, "the application root must not be empty");

  const text = dom.app.textContent;
  assert.match(text, /SLiVR/);
  assert.match(text, /Explore/);
  assert.match(text, /Project tools/);
  assert.match(text, /Immersive/);
  assert.match(text, /Shot Designer/);
});

test("232: Explore and Shot Designer are the only top-level destinations", async () => {
  // Partial automated evidence for test 15. It shows the controls exist and
  // carry an active state; whether they are legible and keyboard-operable is
  // a live check.
  const { dom } = await bootShell();
  const buttons = dom.app.descendants().filter((node) => node.getAttribute("data-mode"));
  assert.deepEqual(
    buttons.map((button) => button.getAttribute("data-mode")),
    ["explore", "shot"],
  );

  const active = buttons.filter((button) => button.getAttribute("aria-current") === "page");
  assert.equal(active.length, 1, "exactly one mode is current");
  assert.equal(active[0].getAttribute("data-mode"), "explore");
});

test("the catalog loads and the shell reports what it holds", async () => {
  const { store, dom } = await bootShell();
  const state = store.getState();
  assert.equal(state.catalogError, null);
  assert.equal(state.catalog.locations.length, 18);
  dom.app.descendants().find(n => n.getAttribute("aria-label") === "Catalog and help").click();
  assert.match(dom.app.textContent, /Catalog version/);
  assert.match(dom.app.textContent, /18 \(11 current, 7 future\)/);
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
  const projects = dom.app.querySelectorAll("button").find(node => node.textContent === "Project tools");
  projects.click();
  dom.window.dispatch("hashchange");

  assert.equal(store.getState().mode, "explore");
  assert.ok(dom.app.querySelector(".tool-window"));
  assert.match(dom.app.textContent, /New local project/);
});

test("a map library that will not load leaves the shell working and says so", async () => {
  // `maplibre-gl` is a bare specifier with no import map in Node, so the
  // dynamic import fails exactly as it would if the CDN were unreachable.
  const { store, dom } = await bootShell();
  assert.equal(store.getState().map.status, "unavailable");
  assert.match(store.getState().map.error.message, /did not load/);
  // The mode is still usable and still lists the catalog.
  assert.match(dom.app.textContent, /Locations/);
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
  // Startup uses the base experience; queued navigation preserves the exact entry.
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-001" });
  const state = store.getState();

  assert.equal(state.mode, "immersive");
  assert.equal(state.viewer.captureId, "CAP-001");
  assert.equal(state.viewer.status, "handshaking");

  const frame = viewerFrame(dom);
  assert.ok(frame, "the immersive surface renders a frame");
  assert.equal(frame.hidden, undefined, "the frame is not hidden in the mode that uses it");

  const capture = state.catalog.capturesByLocationId.get("LOC-001");
  assert.equal(frame.getAttribute("src"), new URL(capture.url).origin + new URL(capture.url).pathname);
  assert.match(capture.url, /5eb11a1b/, "the shared downtown experience");
  assert.match(capture.url, new RegExp(capture.sweepId), "carrying this record's own sweep");
});

test("six downtown records share one experience and still open at six distinct sweeps", async () => {
  // The property test 29 exists for, at the routing layer: a shared experience
  // must not collapse six catalog records into one destination.
  const targets = new Set();
  const baseUrls = new Set();
  for (const id of ["LOC-001", "LOC-002", "LOC-003", "LOC-004", "LOC-005", "LOC-006"]) {
    const { store, dom, actions } = await bootShell({ hash: `#/immersive/${id}` });
    const frame = viewerFrame(dom);
    const commands = [];
    frame.contentWindow = { postMessage: (message, origin) => commands.push({ message, origin }) };
    const capture = store.getState().catalog.capturesByLocationId.get(id);
    const origin = new URL(capture.url).origin;
    baseUrls.add(frame.getAttribute("src"));
    dom.window.dispatch("message", { source: frame.contentWindow, origin, data: { type: "TourReady" } });
    dom.advance(599);
    assert.equal(commands.filter(c => c.message.type === "Navigate").length, 0);
    dom.advance(1);
    const navigation = commands.find(c => c.message.type === "Navigate");
    assert.ok(navigation, "each entry must issue its own navigation command after readiness");
    assert.equal(navigation.origin, origin);
    assert.equal(navigation.message.sweepId, capture.sweepId);
    assert.deepEqual(navigation.message.rotation, { x: capture.startX, y: capture.startY });
    assert.equal(navigation.message.transitionTime, 0);
    targets.add(navigation.message.sweepId);
    dom.window.dispatch("message", { source: frame.contentWindow, origin,
      data: { type: "PoseChanged", sweep: capture.sweepId } });
    assert.equal(store.getState().viewer.status, "ready");
    assert.equal(store.getState().viewer.locationId, id);
    actions.unmountViewer();
  }
  assert.equal(targets.size, 6, "six distinct requested and acknowledged entry sweeps");
  assert.equal(baseUrls.size, 1, "one shared experience launches before navigation");

});

test("leaving the mode releases the provider session rather than leaving it streaming", async () => {
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-001" });
  assert.equal(store.getState().viewer.status, "handshaking");

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
  assert.match(dom.app.textContent, /Continue scouting on the map/);
});

test("198: switching and retrying immersive sessions through the shell is re-entrancy safe", async () => {
  const { store, dom, actions } = await bootShell({ hash: "#/immersive/LOC-001" });
  const old = viewerFrame(dom);
  old.contentWindow = { postMessage() {} };
  dom.window.location.hash = "#/immersive/LOC-009";
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().viewer.captureId, "CAP-009");
  assert.equal(store.getState().viewer.status, "handshaking");
  assert.notEqual(viewerFrame(dom), old);
  dom.advance(60001);
  assert.equal(store.getState().viewer.status, "timedOut");
  const stalled = viewerFrame(dom);
  const retry = dom.app.descendants().find(n => n.tagName === "BUTTON" && n.textContent === "Reload supplied entry");
  assert.ok(retry, "timeout must offer retry in the product");
  retry.click();
  assert.equal(store.getState().viewer.status, "handshaking");
  assert.notEqual(viewerFrame(dom), stalled);
  assert.equal(actions.viewerReport().captureId, "CAP-009");
  actions.unmountViewer();
});

test("199: Stop waiting returns to the location without immediately remounting Treedis", async () => {
  const { store, dom } = await bootShell({ hash: "#/immersive/LOC-001" });
  dom.advance(30001);
  const cancel = dom.app.descendants().find(n => n.tagName === "BUTTON" && n.textContent === "Stop waiting");
  assert.equal(cancel.hidden, false);
  cancel.click();
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().mode, "explore");
  assert.equal(store.getState().routeResolution.locationId, "LOC-001");
  assert.equal(store.getState().viewer.status, "idle");
  assert.equal(viewerFrame(dom).getAttribute("src"), "about:blank");
});


test("204: same-panel dossier preserves query, filters, sorting and scroll through routes and failures", async () => {
  const { dom, actions, store } = await bootShell();
  const label = value => dom.app.descendants().find(n => n.getAttribute("aria-label") === value);
  const button = text => dom.app.querySelectorAll("button").find(n => n.textContent === text);
  const search = label("Search locations");
  search.value = "lafayette"; search.dispatch("input");
  const capture = label("Capture availability");
  capture.value = "future"; capture.dispatch("change");
  const sort = label("Sort locations");
  sort.value = "name"; sort.dispatch("change");
  const list = dom.app.querySelector(".explore-results");
  list.scrollTop = 123;
  const rows = list.querySelectorAll("button");
  assert.ok(rows.length > 0 && rows.length < 18);
  const id = rows[0].getAttribute("data-location-id");
  rows[0].click();
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().routeResolution.locationId, id);
  assert.ok(dom.app.querySelector(".rail-left").textContent.includes("Back to locations"));
  assert.equal(dom.app.querySelector(".rail-right").textContent, "");
  assert.equal(button("Open in Immersive"), undefined, "future capture has no invented entry action");
  assert.ok(button("Back to locations").focused);
  button("Back to locations").click();
  dom.window.dispatch("hashchange");
  assert.equal(label("Search locations"), search);
  assert.equal(search.value, "lafayette");
  assert.equal(capture.value, "future");
  assert.equal(sort.value, "name");
  assert.equal(list.scrollTop, 123);
  assert.ok(rows[0].focused);
  actions.navigate({ name: "location", params: { locationId: "LOC-001" } });
  dom.window.dispatch("hashchange");
  assert.ok(button("Open in Immersive"));
  dom.app.querySelector(".rail-left").dispatch("keydown", { key: "Escape" });
  dom.window.dispatch("hashchange");
  assert.equal(store.getState().route.name, "explore");
  search.value = "zzzz-no-match"; search.dispatch("input");
  dom.advance(180);
  assert.match(list.textContent, /No matching locations/);
  button("Clear filters").click();
  assert.equal(list.querySelectorAll("button").length, 18);
  assert.equal(store.getState().map.status, "unavailable", "list flow works despite map library failure");
});

test("205: collapse, sheet expansion, menu close and map selection restore the panel", async () => {
  const { dom, actions } = await bootShell();
  const button = text => dom.app.querySelectorAll("button").find(n => n.textContent === text);
  const workspace = dom.app.querySelector(".workspace");
  const rail = dom.app.querySelector(".rail-left");
  button("Hide panel").click();
  assert.equal(rail.hidden, true);
  assert.equal(workspace.getAttribute("data-panel"), "closed");
  assert.ok(button("Show locations").focused);
  button("Show locations").click();
  assert.equal(rail.hidden, false);
  button("Expand sheet").click();
  assert.equal(workspace.getAttribute("data-panel"), "expanded");
  button("Hide panel").click();
  actions.navigate({ name: "location", params: { locationId: "LOC-001" } });
  dom.window.dispatch("hashchange");
  assert.equal(rail.hidden, false);
  button("Hide panel").click();
  actions.navigate({ name: "location", params: { locationId: "LOC-001" } });
  assert.equal(rail.hidden, false, "repeat selection restores the dossier without a new hash");
  const menu = dom.app.descendants().find(n => n.getAttribute("aria-label") === "Catalog and help");
  menu.click();
  assert.equal(menu.getAttribute("aria-expanded"), "true");
  assert.match(dom.app.querySelector(".explore-menu").textContent, /Catalog version/);
  dom.document.dispatch("keydown", { key: "Escape" });
  assert.equal(menu.getAttribute("aria-expanded"), "false");
  assert.ok(menu.focused);
  actions.navigate({ name: "shot" });
  dom.window.dispatch("hashchange");
  assert.equal(workspace.getAttribute("data-explore"), "false");
  assert.equal(menu.hidden, true);
});

test("39-44/216: all dossiers retain public fields, source boundaries, unknowns and working public actions", async () => {
  const { dom, actions, store } = await bootShell();
  const before = JSON.stringify(store.getState().catalog.locations);
  for (const location of store.getState().catalog.locations) {
    actions.navigate({ name:"location", params:{locationId:location.id} }); dom.window.dispatch("hashchange");
    const dossier = dom.app.querySelector(".explore-dossier");
    const text = dossier.textContent;
    for (const section of ["Overview", "Production considerations", "Visual / spatial character", "Immersive coverage", "Access information", "Evidence / sources", "Share location"]) assert.ok(text.includes(section), `${location.id}: ${section}`);
    const detail = store.getState().catalog.scoutDetailsByLocationId.get(location.id);
    for (const [key,value] of Object.entries(detail)) if (!['locationId','sourceIds','recordStatus'].includes(key)) assert.ok(text.includes(value), `${location.id}: ${key}`);
    assert.ok(text.includes("Public hours do not imply production availability"));
    assert.ok(text.includes("Coordinates (approximate; not surveyed)"));
    assert.ok(text.includes("Information has not been found"));
    assert.ok(!text.includes("Project context"));
    const buttons = dossier.querySelectorAll("button");
    assert.equal(buttons.some(n => n.textContent === "Open in Immersive"), location.captureStatus === "current");
    assert.ok(!buttons.some(n => /checklist|assessment|compare|candidate/i.test(n.textContent)));
    assert.ok(!dossier.querySelectorAll("a").some(n => /^(?:\.?\/?(?:docs|outputs)\/|javascript:)/.test(n.getAttribute("href"))));
    buttons.find(n => n.textContent === "Copy public location link").click();
    assert.ok(text.includes(location.name));
    assert.match(dossier.textContent, /Copy unavailable/);
  }
  assert.equal(JSON.stringify(store.getState().catalog.locations), before);
});

test("35/37/204: search is debounced and recent order survives direct routes and mode changes", async () => {
  const { dom, actions, store } = await bootShell();
  const label = value => dom.app.descendants().find(n => n.getAttribute("aria-label") === value);
  const search = label("Search locations");
  search.value = "no-match"; search.dispatch("input"); dom.advance(90);
  search.value = "carpe"; search.dispatch("input"); dom.advance(90);
  assert.equal(dom.app.querySelector(".explore-results").querySelectorAll("button").length,18);
  dom.advance(90);
  assert.equal(dom.app.querySelector(".explore-results").querySelectorAll("button").length,1);
  dom.app.querySelectorAll("button").find(n => n.textContent === "Clear filters").click();
  for (const id of ["LOC-003","LOC-018","LOC-003"]) {
    actions.navigate({name:"location",params:{locationId:id}}); dom.window.dispatch("hashchange");
  }
  actions.navigate({name:"explore"}); dom.window.dispatch("hashchange");
  const sort = label("Sort locations"); sort.value="recent"; sort.dispatch("change");
  assert.deepEqual(store.getState().recentLocations,["LOC-003","LOC-018"]);
  assert.equal(dom.app.querySelector(".explore-results").querySelectorAll("button")[0].getAttribute("data-location-id"),"LOC-003");
});

test("44/216: clipboard success copies a context-free absolute public link and reports completion", async () => {
  const { dom, actions } = await bootShell();
  const copied=[];
  dom.window.location.href="https://example.org/SLiVR/?private=secret#/project/prj_private";
  dom.window.navigator={ clipboard:{writeText:async text => copied.push(text)} };
  actions.navigate({name:"location",params:{locationId:"LOC-018"}}); dom.window.dispatch("hashchange");
  dom.app.querySelectorAll("button").find(n => n.textContent==="Copy public location link").click();
  await Promise.resolve();
  assert.deepEqual(copied,["https://example.org/SLiVR/#/location/LOC-018"]);
  assert.match(dom.app.querySelector(".explore-dossier").textContent,/Public location link copied/);
});

test("44/71/81/228: dossier adds candidates and returns from Immersive to the selected scene", async () => {
  const { dom, actions, store } = await bootShell();
  const project = await actions.createProject("Candidate production"); dom.window.dispatch("hashchange");
  const scene = (await actions.saveScene({ number: "1", title: "Arrival", intExt: "EXT", dayNight: "DAY" })).scene;
  actions.selectScene(scene.id);
  actions.navigate({ name: "location", params: { locationId: "LOC-001" } }); dom.window.dispatch("hashchange");
  const button = text => dom.app.querySelectorAll("button").find(n => n.textContent === text);
  button("Scouting checklist").click();
  assert.ok(button("Add location to scene")); button("Add location to scene").click();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(store.getState().workingBundle.candidates.length, 1);
  assert.ok(button("Open candidate")); button("Open candidate").click(); dom.window.dispatch("hashchange");
  assert.equal(store.getState().route.params.sceneId, scene.id);
  assert.ok(dom.app.querySelector(".candidate-card"));
  assert.equal(dom.app.querySelector(".scene-brief").getAttribute("open"), "open");
  button("Inspect in Immersive").click(); dom.window.dispatch("hashchange");
  assert.equal(store.getState().mode, "immersive");
  assert.ok(button("Open candidate")); button("Open candidate").click(); dom.window.dispatch("hashchange");
  assert.equal(store.getState().route.params.projectId, project.id);
  assert.equal(store.getState().activeSceneId, scene.id);
  const form = dom.app.querySelectorAll("form").find(f => f.querySelectorAll("button").some(b => b.textContent === "Save candidate"));
  assert.ok(form);
  const rationale = form.querySelectorAll("textarea").find(n => n.getAttribute("name") === "rationale");
  rationale.value = "Access still needs checking";
  form.dispatch("submit", { preventDefault() {} }); await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(store.getState().workingBundle.candidates[0].rationale, "Access still needs checking");
});

test("207/208/209/215: shared checklist autosaves zero/false and flushes on close without provider access", async () => {
 const { dom, actions, store } = await bootShell();
 const project = await actions.createProject("Checklist production"); dom.window.dispatch("hashchange");
 const scene = (await actions.saveScene({ number: "1", title: "Room", intExt: "INT", dayNight: "DAY", mustHave: ["Access"] })).scene;
 const { candidate } = await actions.addLocationCandidate(scene.id, "LOC-001");
 const { assessment } = await actions.createAssessment(candidate.id);
 const dialog = dom.app.querySelectorAll(".tool-window").find(n=>n.getAttribute("aria-label")==="Scouting checklist"); assert.ok(dialog);
 const field = label => dialog.descendants().find(n => n.getAttribute("aria-label") === label);
 const doors = field("door count: value"); assert.ok(doors); doors.value = "0"; doors.dispatch("input");
 const noise = field("ambient noise: value"); noise.value = "false"; noise.dispatch("change");
 dialog.querySelectorAll("button").find(b => b.textContent === "Close").click();
 await new Promise(r => setTimeout(r, 100));
 assert.equal(store.getState().activeAssessmentId, null);
 const saved = actions.getWorkspace().scoutAssessments[0];
 assert.equal(saved.answers.find(a => a.questionId === "door-count").numberValue, 0);
 assert.equal(saved.answers.find(a => a.questionId === "ambient-noise").booleanValue, false);
 assert.equal(store.getState().save.state, "saved");
 actions.navigate({ name: "location", params: { locationId: "LOC-001" } }); dom.window.dispatch("hashchange");
 dom.app.querySelectorAll("button").find(b=>b.textContent === "Scouting checklist").click();
 const reopen = dom.app.querySelectorAll("button").find(b => b.textContent.startsWith("Scouting assessment ")); assert.ok(reopen); reopen.click(); await new Promise(r=>setTimeout(r,20));
 assert.equal(store.getState().activeAssessmentId, assessment.id);
 assert.equal(dom.app.querySelectorAll(".tool-window").find(n=>n.getAttribute("aria-label")==="Scouting checklist").querySelectorAll("input").find(n => n.getAttribute("aria-label") === "door count: value").value, "0");
 dom.app.querySelectorAll(".tool-window").find(n=>n.getAttribute("aria-label")==="Scouting checklist").querySelectorAll("button").find(b => b.textContent === "Close").click(); await new Promise(r => setTimeout(r, 20));
 assert.equal(actions.getWorkspace().projects[0].id, project.id);
});

test("80/81: existing workspace forms autosave and export flushes an immediate edit", async () => {
 const { dom, actions, store } = await bootShell(); const project = await actions.createProject("Before autosave"); dom.window.dispatch("hashchange");
 const form = dom.app.querySelectorAll("form").find(n => n.querySelectorAll("button").some(b => b.textContent === "Save project changes"));
 const name = form.querySelectorAll("input").find(n => n.getAttribute("name") === "name");
 name.value = "Latest before export"; name.dispatch("input"); form.dispatch("input");
 const file = await actions.exportProject(project.id);
 assert.equal(JSON.parse(file.text).payload.projects[0].name, "Latest before export");
 assert.equal(store.getState().save.state, "saved");
});

test("72-74/77: three-candidate comparison and detail edit the same judgment with unknowns intact", async () => {
 const { dom, actions } = await bootShell(); await actions.createProject("Comparison production"); dom.window.dispatch("hashchange");
 const scene = (await actions.saveScene({ number: "1", title: "Arrival", intExt: "EXT", dayNight: "DAY", mustHave: ["Access"] })).scene;
 for (const id of ["LOC-001", "LOC-002", "LOC-003"]) await actions.addLocationCandidate(scene.id, id);
 const comparisons = dom.app.querySelectorAll(".comparison"); assert.equal(comparisons.length, 4);
 const table = comparisons.at(-1); assert.equal(table.querySelectorAll("th").length, 5);
 let rating = table.descendants().find(n => n.getAttribute("aria-label") === "LOC-001: Access fit");
 assert.equal(rating.value, "unknown"); rating.value = "concern"; rating.dispatch("change");
 await actions.flushScouting();
 const candidate = actions.getWorkspace().candidates.find(c => c.locationId === "LOC-001"); assert.equal(candidate.evaluations[0].rating, "concern");
 const detail = dom.app.querySelectorAll(".comparison")[0]; rating = detail.descendants().find(n => n.getAttribute("aria-label") === "LOC-001: Access fit");
 assert.equal(rating.value, "concern"); rating.value = "unknown"; rating.dispatch("change"); await actions.flushScouting();
 assert.equal(actions.getWorkspace().candidates.find(c => c.id === candidate.id).evaluations[0].rating, "unknown");
});

test("230: leftover save-failure mode explains failed Create and recovers the same project without reload", async () => {
 const fake = createFakeIndexedDB();
 const { dom, actions, store } = await bootShell({ indexedDB: fake.factory, diagnostics: { forceStorageFailure: true, forceImageryFailure: true } });
 const project = await actions.createProject("Recover project"); dom.window.dispatch("hashchange");
 assert.equal(store.getState().save.state, "failed");
 assert.match(dom.app.textContent, /Save-failure test mode is ON/);
 assert.match(dom.app.textContent, /Save-failure test mode is enabled in this browser/);
 assert.equal(JSON.parse(actions.exportEmergency().text).payload.projects[0].id, project.id);
 dom.app.querySelectorAll("button").find(b => b.textContent === "Turn off save-failure test and retry").click();
 await new Promise(resolve => setTimeout(resolve, 120));
 assert.equal(store.getState().save.state, "saved");
 assert.equal(store.getState().openProjectId, project.id);
 assert.equal(JSON.parse(dom.window.localStorage.getItem("slivr:diagnostics")).forceImageryFailure, true);
 assert.equal(JSON.parse(dom.window.localStorage.getItem("slivr:diagnostics")).forceStorageFailure, false);
 const scene = (await actions.saveScene({ number: "1", title: "Room", intExt: "INT", dayNight: "DAY" })).scene;
 const { candidate } = await actions.addLocationCandidate(scene.id, "LOC-001");
 dom.window.localStorage.setItem("slivr:diagnostics", JSON.stringify({ forceStorageFailure: true }));
 const assessment = await actions.createAssessment(candidate.id); assert.equal(assessment.ok, false);
 assert.equal(store.getState().save.error.code, "storage-simulation-enabled");
 assert.equal((await actions.stopStorageFailureTest()).ok, true);
 const reloaded = await bootShell({ indexedDB: fake.factory });
 await reloaded.actions.openProject(project.id);
 assert.equal(reloaded.actions.getWorkspace().scoutAssessments[0].id, assessment.assessment.id);
});

test("230: real write errors remain visible after project navigation without claiming simulation", async () => {
 const fake = createFakeIndexedDB(); const { dom, actions, store } = await bootShell({ indexedDB: fake.factory });
 fake.failWrites(true); await actions.createProject("Unstored"); dom.window.dispatch("hashchange");
 assert.equal(store.getState().save.state, "failed");
 assert.ok(dom.app.textContent.includes(store.getState().save.error.message));
 assert.ok(!dom.app.textContent.includes("Save-failure test mode is ON"));
 fake.failWrites(false); assert.equal((await actions.retrySave()).ok, true);
});

test("231: Create waits for database opening and saves while catalog loading is still pending", async () => {
  serveFromDisk();
  const diskFetch = globalThis.fetch;
  let releaseCatalog, releaseDatabase;
  const catalogGate = new Promise(resolve => { releaseCatalog = resolve; });
  const databaseGate = new Promise(resolve => { releaseDatabase = resolve; });
  globalThis.fetch = async path => {
    if (!String(path).includes("lafayette.region.json")) await catalogGate;
    return diskFetch(path);
  };
  const fake = createFakeIndexedDB();
  let opens = 0;
  const indexedDB = { open(...args) {
    opens++;
    const request = fake.factory.open(...args);
    return new Proxy(request, { set(target, key, value) {
      target[key] = key === "onsuccess" ? event => { void databaseGate.then(() => value(event)); } : value;
      return true;
    } });
  } };
  const dom = createFakeDom({ hash: "#/projects", indexedDB });
  globalThis.document = dom.document;
  const { boot } = await import("../src/app/main.js");
  const booting = boot({ root: dom.app, win: dom.window });
  const until = async predicate => {
    for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(predicate(), "expected startup condition within one second");
  };
  try {
    await until(() => !!dom.document.getElementById("new-project-name"));
    assert.match(dom.app.textContent, /Opening local storage/);
    dom.document.getElementById("new-project-name").value = "Early project";
    const form = dom.app.querySelectorAll("form").find(node => node.querySelectorAll("button").some(b => b.textContent === "Create"));
    form.dispatch("submit", { preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.doesNotMatch(dom.app.textContent, /Not saved:|Save failed/);
    releaseDatabase();
    await until(() => dom.app.textContent.includes("Saved locally"));
    assert.equal(opens, 1);
    assert.ok(dom.app.textContent.includes("Save project changes"));
    assert.ok(dom.app.textContent.includes("Checklist import needs the location catalog"));
    releaseCatalog();
    const app = await booting;
    assert.equal(app.store.getState().save.state, "saved");
    assert.equal(app.store.getState().workingBundle.projects[0].name, "Early project");
    app.actions.unmountMap(); app.actions.unmountViewer();
    const projectId = app.store.getState().openProjectId;
    const reloaded = await bootShell({ indexedDB: fake.factory, hash: `#/project/${projectId}` });
    assert.ok(reloaded.store.getState().projects.some(p => p.name === "Early project"));
    assert.equal(reloaded.store.getState().workingBundle.projects[0].id, projectId);
    reloaded.actions.unmountMap(); reloaded.actions.unmountViewer();
  } finally {
    releaseDatabase(); releaseCatalog();
    await booting;
  }
});

test("232/233: project tools and checklist resizing keep the active tour frame attached", async () => {
 const {dom,actions,store}=await bootShell();await actions.createProject("Unified scouting");dom.window.dispatch("hashchange");
 const scene=(await actions.saveScene({number:"1",title:"Entry",intExt:"INT",dayNight:"DAY"})).scene;
 const {candidate}=await actions.addLocationCandidate(scene.id,"LOC-001");
 actions.navigate({name:"immersive",params:{locationId:"LOC-001"}});dom.window.dispatch("hashchange");
 const frame=viewerFrame(dom), src=frame.getAttribute("src");
 dom.app.querySelectorAll("button").find(b=>b.textContent==="Project tools").click();
 assert.equal(viewerFrame(dom),frame);assert.equal(frame.getAttribute("src"),src);
 const {assessment}=await actions.createAssessment(candidate.id);
 const tool=dom.app.querySelectorAll('.tool-window').find(n=>n.getAttribute('aria-label')==='Scouting checklist');
 for(const label of ['Side by side','Maximize','Restore','Minimize']){tool.querySelectorAll('button').find(b=>b.textContent===label).click();assert.equal(viewerFrame(dom),frame);assert.equal(frame.getAttribute('src'),src);}
 assert.equal(store.getState().activeAssessmentId,assessment.id);
 assert.notEqual(dom.app.querySelector('.workspace').inert,true);
 tool.querySelectorAll('button').find(b=>b.textContent==='Pin checklist to this location').click();
 actions.navigate({name:'immersive',params:{locationId:'LOC-009'}});dom.window.dispatch('hashchange');
 assert.match(tool.textContent,/Viewing another location/);assert.equal(store.getState().workingBundle.scoutAssessments[0].locationId,'LOC-001');
 actions.unmountMap();actions.unmountViewer();
});

test('236: checklist follows map/list routes and project candidates, remembers assessments and does not create on selection', async () => {
 const {dom,actions,store}=await bootShell();await actions.createProject('Follow scouting');dom.window.dispatch('hashchange');
 const scene=(await actions.saveScene({number:'1',title:'Entry',intExt:'INT',dayNight:'DAY'})).scene;
 const c1=(await actions.addLocationCandidate(scene.id,'LOC-001')).candidate;
 const a1=(await actions.createAssessment(c1.id)).assessment;
 const c2=(await actions.addLocationCandidate(scene.id,'LOC-003')).candidate;
 const a2=(await actions.createAssessment(c2.id)).assessment;
 const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,5));};
 actions.navigate({name:'location',params:{locationId:'LOC-001'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a1.id);
 const tool=dom.app.querySelectorAll('.tool-window').find(n=>n.getAttribute('aria-label')==='Scouting checklist');
 assert.match(tool.querySelector('.checklist-identity').textContent,/Carpe Diem/);
 actions.selectCandidate(c2.id,'project');dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a2.id);
 tool.querySelectorAll('button').find(b=>b.textContent==='Pin checklist to this location').click();
 actions.navigate({name:'location',params:{locationId:'LOC-001'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a2.id);
 tool.querySelectorAll('button').find(b=>b.textContent==='Follow selected location').click();await settle();
 assert.equal(store.getState().activeAssessmentId,a1.id);
 actions.navigate({name:'immersive',params:{locationId:'LOC-009'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,null);
 assert.equal(store.getState().workingBundle.scoutAssessments.length,2);
 assert.ok(tool.querySelectorAll('button').some(b=>b.textContent.startsWith('Start assessment for ')));
 actions.navigate({name:'location',params:{locationId:'LOC-003'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a2.id);
 store.setState({save:{state:'failed',label:'Save failed'}});
 actions.navigate({name:'location',params:{locationId:'LOC-001'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a2.id);
 assert.match(store.getState().notice,/could not be saved/);
 store.setState({save:{state:'saved',label:'Saved locally'}});
 tool.querySelectorAll('button').find(b=>b.textContent==='Follow selected location').click();await settle();
 assert.equal(store.getState().activeAssessmentId,a1.id);
 actions.navigate({name:'location',params:{locationId:'LOC-009'}});dom.window.dispatch('hashchange');
 actions.navigate({name:'location',params:{locationId:'LOC-003'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a2.id);
 await actions.createAssessment(c2.id);await actions.openAssessment(a2.id);
 actions.navigate({name:'location',params:{locationId:'LOC-001'}});dom.window.dispatch('hashchange');await settle();
 actions.navigate({name:'location',params:{locationId:'LOC-003'}});dom.window.dispatch('hashchange');await settle();
 assert.equal(store.getState().activeAssessmentId,a2.id,'remember the selected assessment, not just the newest');
 assert.equal(tool.querySelectorAll('select').find(n=>n.getAttribute('aria-label')==='Checklist assessment date').children.length,2);
 actions.unmountMap();actions.unmountViewer();
});
