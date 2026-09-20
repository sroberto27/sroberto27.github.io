import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locationBounds, inventoryFitOptions } from "../src/map/viewport.js";
import { createMapAdapter } from "../src/map/maplibre-adapter.js";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
const locations = JSON.parse(readFileSync(new URL("../data/catalog/locations.v1.json", import.meta.url))).locations;

test("inventory bounds include every pin without adding the region's geographic padding", () => {
  const bounds = locationBounds(locations);
  for (const { position: [lng, lat] } of locations) {
    assert.ok(lng >= bounds[0][0] && lng <= bounds[1][0]);
    assert.ok(lat >= bounds[0][1] && lat <= bounds[1][1]);
  }
  for (let axis = 0; axis < 2; axis++) {
    assert.ok(locations.some(location => location.position[axis] === bounds[0][axis]));
    assert.ok(locations.some(location => location.position[axis] === bounds[1][axis]));
  }
  assert.equal(locationBounds([]), null);
});

test("small screens retain usable space, with a zoom cap for a single or coincident position", () => {
  const options = inventoryFitOptions(280, 240, 150);
  assert.ok(options.padding.left + options.padding.right < 140);
  assert.ok(options.padding.top + options.padding.bottom < 160);
  assert.equal(options.maxZoom, 18);
  assert.equal(options.duration, 0);
});

test("adapter fits on inventory and size changes, without resetting navigation on selection redraws", () => {
  const previous = globalThis.ResizeObserver;
  let resize;
  let disconnected = false;
  globalThis.ResizeObserver = class {
    constructor(fn) { resize = fn; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  const fits = [], flights = [];
  const container = { clientWidth: 1200, clientHeight: 800 };
  const map = {
    loaded: () => false, addControl() {}, on() {}, resize() {}, remove() {},
    getBearing: () => 0, getPitch: () => 0,
    fitBounds: (bounds, options) => fits.push({ bounds, options }),
    flyTo: options => flights.push(options), getMaxZoom: () => 20,
  };
  try {
    const adapter = createMapAdapter({ container, region, maplibre: { Map: function () { return map; } } });
    adapter.create();
    adapter.setLocations(locations, () => {});
    assert.equal(fits.length, 1);
    assert.deepEqual(fits[0].bounds, locationBounds(locations));
    resize();
    const count = fits.length;
    adapter.setSelectedLocation("LOC-001");
    assert.deepEqual(flights.at(-1).center, locations[0].position);
    adapter.setLocations(locations, () => {});
    resize();
    assert.equal(fits.length, count, "unchanged layout and selection do not reset the camera");
    assert.equal(flights.length, 1);
    adapter.focusLocation("LOC-001");
    assert.equal(flights.length, 2, "explicit repeat selection recenters after manual navigation");
    container.clientWidth = 340;
    resize();
    assert.equal(flights.length, 3, "resize retains the explicitly selected location");
    assert.ok(flights.at(-1).padding.left < fits[0].options.padding.left);
    adapter.recenter();
    assert.equal(fits.length, count + 1, "explicit Recenter restores the catalog extent");
    assert.deepEqual(fits.at(-1).bounds, locationBounds(locations));
    adapter.dispose();
    assert.equal(disconnected, true);
  } finally { globalThis.ResizeObserver = previous; }
});

test("pending selection moves are superseded by a newer choice, Recenter or disposal", () => {
  const previous = globalThis.requestAnimationFrame;
  const frames = [], flights = [];
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  const flush = () => { while (frames.length) frames.shift()(); };
  const map = {
    loaded: () => false, addControl() {}, on() {}, resize() {}, remove() {},
    getBearing: () => 0, getPitch: () => 0, getMaxZoom: () => 20,
    fitBounds() {}, flyTo: options => flights.push(options),
  };
  try {
    const adapter = createMapAdapter({ container: { clientWidth: 900, clientHeight: 700 }, region,
      maplibre: { Map: function () { return map; } } });
    adapter.create(); adapter.setLocations(locations, () => {});
    adapter.focusLocation("LOC-002"); adapter.focusLocation("LOC-018"); flush();
    assert.equal(flights.length, 1);
    assert.deepEqual(flights[0].center, [-92.04441771641942, 30.228764095274858]);
    assert.equal(flights[0].zoom, 19);
    assert.equal(flights[0].duration, 550);
    adapter.focusLocation("LOC-002"); adapter.recenter(); flush();
    assert.equal(flights.length, 1);
    adapter.focusLocation("LOC-002"); adapter.dispose(); flush();
    assert.equal(flights.length, 1);
  } finally { globalThis.requestAnimationFrame = previous; }
});
