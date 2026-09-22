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
  assert.match(dom.app.textContent, /nothing to open/);
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
    for (const section of ["Overview", "Production considerations", "Visual / spatial character", "Immersive coverage", "Access information", "Evidence / sources", "Project context", "Share location"]) assert.ok(text.includes(section), `${location.id}: ${section}`);
    const detail = store.getState().catalog.scoutDetailsByLocationId.get(location.id);
    for (const [key,value] of Object.entries(detail)) if (!['locationId','sourceIds','recordStatus'].includes(key)) assert.ok(text.includes(value), `${location.id}: ${key}`);
    assert.ok(text.includes("Public hours do not imply production availability"));
    assert.ok(text.includes("Coordinates (approximate; not surveyed)"));
    assert.ok(text.includes("Information has not been found"));
    assert.ok(text.includes("Project observations and candidate decisions are separate"));
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
