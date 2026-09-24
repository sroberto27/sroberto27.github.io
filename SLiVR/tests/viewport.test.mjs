import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locationBounds, inventoryFitOptions } from "../src/map/viewport.js";
import { createMapAdapter } from "../src/map/maplibre-adapter.js";
import { createActions, initialState } from "../src/app/actions.js";
import { createStore } from "../src/app/store.js";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
const locations = JSON.parse(readFileSync(new URL("../data/catalog/locations.v1.json", import.meta.url))).locations;

test("225/64: Explore camera survives disposal and late layout; explicit location handoff wins", async () => {
  const previous = globalThis.ResizeObserver;
  const observers = [], instances = [];
  globalThis.ResizeObserver = class {
    constructor(callback) { observers.push(callback); }
    observe() {} disconnect() {}
  };
  const camera = { center: [-92.02, 30.23], zoom: 0, bearing: 0, pitch: 0 };
  const store = createStore({ ...initialState({ webgl: true }), catalog: { locations } });
  const maplibre = { Map: function(options) {
    const map = { options, fits: [], flights: [], removed: false,
      loaded: () => false, addControl() {}, on() {}, resize() {},
      remove() { this.removed = true; },
      getCenter: () => ({ lng: camera.center[0], lat: camera.center[1] }),
      getZoom: () => camera.zoom, getBearing: () => camera.bearing, getPitch: () => camera.pitch,
      getMaxZoom: () => 20,
      fitBounds(...args) { this.fits.push(args); }, flyTo(options) { this.flights.push(options); },
    };
    instances.push(map); return map;
  } };
  const actions = createActions({ store, region, loadMapLibrary: async () => maplibre });
  try {
    const container = { clientWidth: 900, clientHeight: 700 };
    await actions.mountMap(container);
    actions.unmountMap();
    assert.equal(instances[0].removed, true);
    await actions.mountMap(container);
    const restored = instances.at(-1);
    for (const key of Object.keys(camera)) assert.deepEqual(restored.options[key], camera[key]);
    observers.at(-1)();
    assert.equal(restored.fits.length, 0, "initial inventory and ResizeObserver cannot overwrite restoration");
    actions.recenterMap();
    assert.equal(restored.fits.length, 1, "explicit Recenter remains available");
    actions.unmountMap();
    store.setState({ routeResolution: { locationId: "LOC-009" } });
    await actions.mountMap(container);
    assert.deepEqual(instances.at(-1).flights.at(-1).center, locations.find(l => l.id === "LOC-009").position);
    assert.equal(instances.at(-1).options.bearing, 0);
    actions.unmountMap();
  } finally { globalThis.ResizeObserver = previous; }
});

test("225: invalid camera falls back to inventory and disposed camera is unavailable", () => {
  let options;
  const fits = [];
  const map = { loaded: () => false, on() {}, addControl() {}, remove() {},
    getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => NaN,
    getBearing: () => 0, getPitch: () => 0, fitBounds: (...args) => fits.push(args) };
  const adapter = createMapAdapter({ container: { clientWidth: 900, clientHeight: 700 }, region,
    initialCamera: { center: [0, 0], zoom: NaN, pitch: 0, bearing: 0 },
    maplibre: { Map: function(value) { options = value; return map; } } });
  adapter.create(); adapter.setLocations(locations, () => {});
  assert.ok(options.bounds); assert.equal(fits.length, 1);
  assert.equal(adapter.getCamera(), null);
  adapter.dispose(); assert.equal(adapter.getCamera(), null);
});

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

test("218: group fit uses only members, preserves 3D, avoids floating panel and cancels stale selection", () => {
  const previousRAF=globalThis.requestAnimationFrame, previousMatch=globalThis.matchMedia;
  const frames=[], fits=[], flights=[];
  globalThis.requestAnimationFrame=fn=>frames.push(fn);
  globalThis.matchMedia=()=>({matches:true});
  const panel={hidden:false,getBoundingClientRect:()=>({top:12,bottom:788,right:344})};
  const container={clientWidth:1200,clientHeight:800,closest:()=>({querySelector:()=>panel}),
    getBoundingClientRect:()=>({left:0,top:0,bottom:800})};
  const map={loaded:()=>false,addControl(){},on(){},resize(){},remove(){},getBearing:()=>30,getPitch:()=>45,getMaxZoom:()=>20,
    fitBounds:(bounds,options)=>fits.push({bounds,options}),flyTo:options=>flights.push(options)};
  try {
    const adapter=createMapAdapter({container,region,maplibre:{Map:function(){return map;}}});
    adapter.create();adapter.setLocations(locations,()=>{});
    adapter.focusLocation("LOC-018");adapter.focusGroup(locations.slice(0,5));
    while(frames.length)frames.shift()();
    assert.equal(flights.length,0,"group request cancels pending individual focus");
    assert.deepEqual(fits.at(-1).bounds,locationBounds(locations.slice(0,5)));
    assert.equal(fits.at(-1).options.padding.left,368);
    assert.equal(fits.at(-1).options.duration,0);
    assert.equal(fits.at(-1).options.bearing,30);assert.equal(fits.at(-1).options.pitch,45);
    assert.equal(fits.at(-1).options.maxZoom,19);
    panel.hidden=true;globalThis.matchMedia=()=>({matches:false});
    adapter.focusGroup(locations.slice(0,5));
    assert.equal(fits.at(-1).options.duration,550);assert.ok(fits.at(-1).options.padding.left<100);
    adapter.recenter();assert.deepEqual(fits.at(-1).bounds,locationBounds(locations));
    adapter.dispose();const count=fits.length;adapter.focusGroup(locations);assert.equal(fits.length,count);
  } finally {globalThis.requestAnimationFrame=previousRAF;globalThis.matchMedia=previousMatch;}
});
