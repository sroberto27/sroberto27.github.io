import test from "node:test";
import assert from "node:assert/strict";

import {
  parseRoute,
  routeToHash,
  routeMode,
  createRouter,
  MODES,
  DEFAULT_ROUTE,
} from "../src/app/router.js";

/** Minimal window stand-in with a hash and event listeners. */
function fakeWindow(hash = "") {
  const listeners = new Map();
  return {
    location: { hash, pathname: "/SLiVR/", search: "" },
    history: {
      replaceState(_state, _title, url) {
        const index = String(url).indexOf("#");
        this.window.location.hash = index === -1 ? "" : String(url).slice(index);
      },
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function linkedWindow(hash = "") {
  const win = fakeWindow(hash);
  win.history.window = win;
  return win;
}

test("every approved route parses to its own name and mode", () => {
  const cases = [
    ["#/explore", "explore", "explore"],
    ["#/location/LOC-003", "location", "explore"],
    ["#/projects", "projects", "projects"],
    ["#/project/prj_00000000-0000-4000-8000-000000000001", "project", "projects"],
    [
      "#/project/prj_00000000-0000-4000-8000-000000000001/scene/scn_00000000-0000-4000-8000-000000000001",
      "project-scene",
      "projects",
    ],
    ["#/immersive", "immersive-index", "immersive"],
    ["#/immersive/LOC-001", "immersive", "immersive"],
    ["#/shot", "shot-index", "shot"],
    ["#/shot/sht_00000000-0000-4000-8000-000000000001", "shot", "shot"],
  ];
  for (const [hash, name, mode] of cases) {
    const route = parseRoute(hash);
    assert.equal(route.name, name, hash);
    assert.equal(route.mode, mode, hash);
    assert.equal(routeMode(route), mode, hash);
  }
});

test("an empty or bare hash is the explore route", () => {
  for (const hash of ["", "#", "#/", "#//"]) {
    assert.equal(parseRoute(hash).name, "explore", JSON.stringify(hash));
  }
});

test("route parameters are captured and returned verbatim", () => {
  assert.deepEqual(parseRoute("#/location/LOC-003").params, { locationId: "LOC-003" });
  assert.deepEqual(parseRoute("#/project/prj_a/scene/scn_b").params, {
    projectId: "prj_a",
    sceneId: "scn_b",
  });
});

test("the immersive route carries a bookmark query", () => {
  const route = parseRoute("#/immersive/LOC-001?bookmark=bkm_1");
  assert.equal(route.name, "immersive");
  assert.deepEqual(route.query, { bookmark: "bkm_1" });
});

test("serialising a route is deterministic and round-trips", () => {
  const hashes = [
    "#/explore",
    "#/location/LOC-017",
    "#/projects",
    "#/immersive/LOC-001?bookmark=bkm_1",
    "#/shot/sht_1",
  ];
  for (const hash of hashes) {
    const route = parseRoute(hash);
    assert.equal(routeToHash(route), hash, hash);
    assert.equal(routeToHash(route), routeToHash(parseRoute(routeToHash(route))), hash);
  }
});

test("query keys are serialised in a stable order", () => {
  const route = { name: "immersive", params: { locationId: "LOC-001" }, query: { z: "2", a: "1" } };
  assert.equal(routeToHash(route), "#/immersive/LOC-001?a=1&z=2");
});

test("an unknown address parses to a recoverable not-found route", () => {
  const route = parseRoute("#/nowhere/at/all");
  assert.equal(route.name, "not-found");
  assert.equal(route.raw, "/nowhere/at/all");
  // It still belongs to a mode, so the shell keeps its navigation.
  assert.equal(route.mode, "explore");
});

test("a well-formed route with an unknown identifier still parses", () => {
  // Resolution is the application's job; the grammar itself is satisfied.
  const route = parseRoute("#/location/LOC-999");
  assert.equal(route.name, "location");
  assert.equal(route.params.locationId, "LOC-999");
});

test("route identifiers survive percent-encoding in both directions", () => {
  const hash = routeToHash({ name: "location", params: { locationId: "LOC 003/x" } });
  assert.equal(hash, "#/location/LOC%20003%2Fx");
  assert.equal(parseRoute(hash).params.locationId, "LOC 003/x");
});

test("a malformed escape sequence does not throw", () => {
  const route = parseRoute("#/location/%E0%A4%A");
  assert.equal(route.name, "location");
  assert.equal(typeof route.params.locationId, "string");
});

test("every mode button points at a route that parses back to that mode", () => {
  for (const mode of MODES) {
    const hash = routeToHash(mode.route);
    assert.equal(parseRoute(hash).mode, mode.id, mode.id);
  }
});

test("the router reports the initial route and defaults to explore", () => {
  const win = linkedWindow("");
  const seen = [];
  const router = createRouter({ window: win, onRoute: (route) => seen.push(route) });
  router.start();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, "explore");
  assert.equal(win.location.hash, routeToHash(DEFAULT_ROUTE));
  router.stop();
  assert.equal(win.listenerCount("hashchange"), 0);
});

test("a direct open of a deep route reports that route, not the default", () => {
  const win = linkedWindow("#/location/LOC-003");
  const seen = [];
  const router = createRouter({ window: win, onRoute: (route) => seen.push(route) });
  router.start();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, "location");
  assert.equal(seen[0].params.locationId, "LOC-003");
});

test("navigating writes the hash once and reports the route once", () => {
  const win = linkedWindow("#/explore");
  const seen = [];
  const router = createRouter({ window: win, onRoute: (route) => seen.push(route.name) });
  router.start();
  seen.length = 0;

  router.navigate({ name: "location", params: { locationId: "LOC-001" } });
  // Navigation writes the hash; the listener is the only thing that applies a
  // route, so the browser event that follows reports it exactly once.
  win.dispatch("hashchange");
  win.dispatch("hashchange");

  assert.deepEqual(seen, ["location"]);
  assert.equal(win.location.hash, "#/location/LOC-001");
});

test("navigating to the route already shown changes nothing", () => {
  const win = linkedWindow("#/explore");
  const seen = [];
  const router = createRouter({ window: win, onRoute: (route) => seen.push(route.name) });
  router.start();
  seen.length = 0;
  router.navigate({ name: "explore" });
  assert.deepEqual(seen, []);
  assert.equal(win.location.hash, "#/explore");
});

test("a back or forward gesture reports the route it lands on", () => {
  const win = linkedWindow("#/explore");
  const seen = [];
  const router = createRouter({ window: win, onRoute: (route) => seen.push(route.name) });
  router.start();
  seen.length = 0;

  win.location.hash = "#/projects";
  win.dispatch("hashchange");
  win.location.hash = "#/explore";
  win.dispatch("popstate");

  assert.deepEqual(seen, ["projects", "explore"]);
});

test("no route carries anything but record identifiers", () => {
  // Private content in a URL would travel into history and into pasted links.
  const hash = routeToHash({
    name: "project",
    params: { projectId: "prj_00000000-0000-4000-8000-000000000001" },
  });
  assert.equal(hash, "#/project/prj_00000000-0000-4000-8000-000000000001");
});
