import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { createGoogleTiles, GOOGLE_TILES_LAYER_ID } from "../src/map/google-tiles.js";
import { updateTilesCameraPose, updateTilesCameraProjection, buildGoogleTilesGroupTransform } from "../src/map/google-tiles-camera.js";
import { IMAGERY_LAYER_ID, BACKGROUND_LAYER_ID } from "../src/map/imagery.js";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
const imports = JSON.parse(readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const hook = registerHooks({ resolve(specifier, context, next) {
  const key = Object.keys(imports).find(key => key === specifier || key.endsWith("/") && specifier.startsWith(key));
  if (key) return next(new URL(imports[key] + specifier.slice(key.length), new URL("../", import.meta.url)).href, context);
  return next(specifier, context);
} });
test.after(() => hook.deregister());

test("the published import map resolves the actual pinned renderer and compressed-model loaders", async () => {
  const [core, plugins, gltf, draco, ktx] = await Promise.all([
    import("3d-tiles-renderer"), import("3d-tiles-renderer/core/plugins"),
    import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js"),
    import("three/addons/loaders/KTX2Loader.js"),
  ]);
  for (const value of [core.TilesRenderer, plugins.GoogleCloudAuthPlugin, gltf.GLTFLoader, draco.DRACOLoader, ktx.KTX2Loader]) assert.equal(typeof value, "function");
  const maplibre = (await import("../vendor/maplibre-gl/maplibre-gl.js")).default;
  const [lng, lat] = region.defaultView.center;
  const transform = buildGoogleTilesGroupTransform(THREE, core.WGS84_ELLIPSOID, maplibre, lng, lat);
  const anchor = new THREE.Vector3();
  core.WGS84_ELLIPSOID.getCartographicToPosition(lat * Math.PI / 180, lng * Math.PI / 180, 0, anchor);
  assert.ok(anchor.applyMatrix4(transform.groupMatrix).length() < 1e-6, "the geographic anchor becomes the local origin");
  const camera = new THREE.PerspectiveCamera(); camera.matrixAutoUpdate = false;
  const map = { getCanvas: () => ({ width: 1000, height: 700 }), getZoom: () => 18,
    transform: { fov: 36.87, pitch: 60, bearing: 0, center: { lng, lat }, cameraToCenterDistance: 1050 } };
  const axes = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  for (const bearing of [0, 90, 180, 270]) {
    map.transform.bearing = bearing;
    updateTilesCameraProjection(map, camera);
    updateTilesCameraPose(maplibre, map, camera, transform.anchorMercator, transform.meterScale, axes);
    assert.ok(Math.abs(camera.projectionMatrix.elements[5] - 3) < .001, "LOD detail cannot vary with bearing");
    assert.ok(Math.abs(camera.matrix.determinant() - 1) < 1e-10, "LOD pose is a rigid transform in meters");
  }
});

function harness({ key = "test", load, timeoutMs = 20000 } = {}) {
  const layers = new Map([[IMAGERY_LAYER_ID, {}], [BACKGROUND_LAYER_ID, {}]]);
  const visibility = new Map();
  const callbacks = new Map();
  const canvasEvents = new Map();
  const statuses = [];
  let tileInstance;
  let tileDisposals = 0;
  let draws = 0;
  class Tiles {
    group = new THREE.Group(); visibleTiles = new Set(); manager = { addHandler() {} }; events = new Map();
    constructor() { tileInstance = this; }
    registerPlugin() {} setCamera() {} resetFailedTiles() {} setResolutionFromRenderer() {} update() {}
    getAttributions() { return [{ value: "Provider attribution" }]; }
    addEventListener(type, fn) { this.events.set(type, fn); }
    dispose() { tileDisposals++; }
  }
  class Loader { setDecoderPath() {} setTranscoderPath() {} setDRACOLoader() {} setKTX2Loader() {} detectSupport() {} dispose() {} }
  const libs = {
    THREE: { ...THREE, WebGLRenderer: class { resetState() {} render() { draws++; } dispose() {} } },
    TilesRenderer: Tiles, WGS84_ELLIPSOID: {
      getEastNorthUpFrame(a, b, c, m) { m.identity(); },
      getCartographicToPosition(a, b, c, v) { v.set(0, 0, 0); },
    }, GoogleCloudAuthPlugin: class {}, GLTFLoader: Loader, DRACOLoader: Loader, KTX2Loader: Loader,
  };
  const canvas = { width: 1000, height: 700,
    addEventListener(type, fn) { canvasEvents.set(type, fn); },
    removeEventListener(type) { canvasEvents.delete(type); },
  };
  const map = {
    getLayer: id => layers.get(id),
    addLayer(layer) { layers.set(layer.id, layer); layer.onAdd(map, {}); },
    removeLayer(id) { layers.get(id)?.onRemove?.(); layers.delete(id); },
    setLayoutProperty(id, property, value) { visibility.set(id, value); },
    getCanvas: () => canvas, getCenter: () => ({ lng: -92, lat: 30 }), getZoom: () => 18,
    transform: { fov: 36.87, pitch: 60, bearing: 0, center: {}, cameraToCenterDistance: 1050 },
    triggerRepaint() {},
  };
  const controller = createGoogleTiles({ map, region, runtimeConfig: key ? { googleMapsApiKey: key } : null,
    maplibre: { MercatorCoordinate: { fromLngLat: () => ({ x: .3, y: .4, z: 0, meterInMercatorCoordinateUnits: () => 1e-7 }) } },
    load: load ?? (async () => libs), onStatus: status => statuses.push(status), timeoutMs,
    timers: { setTimeout(fn) { const id = Symbol(); callbacks.set(id, fn); return id; }, clearTimeout(id) { callbacks.delete(id); } },
  });
  return { controller, layers, visibility, callbacks, canvasEvents, statuses,
    get tiles() { return tileInstance; }, get disposals() { return tileDisposals; }, get draws() { return draws; },
    render() { layers.get(GOOGLE_TILES_LAYER_ID).render({}, new THREE.Matrix4().toArray()); },
  };
}

test("missing key reports aerial fallback without importing or contacting a provider", async () => {
  const h = harness({ key: null, load() { throw new Error("must not import"); } });
  await h.controller.activate();
  assert.equal(h.controller.status.state, "fallback");
  assert.match(h.controller.status.message, /not configured/);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.layers.has(GOOGLE_TILES_LAYER_ID), false);
  h.controller.dispose();
  assert.equal(h.canvasEvents.size, 0);
});

test("root availability alone cannot hide aerial imagery or claim active geometry", async () => {
  const h = harness();
  await h.controller.activate();
  h.render();
  assert.equal(h.controller.status.state, "loading");
  h.tiles.visibleTiles.add({}); h.render();
  assert.equal(h.draws, 2);
  assert.equal(h.controller.status.state, "active");
  assert.equal(h.controller.status.attribution, "Provider attribution");
  assert.equal(h.visibility.get(IMAGERY_LAYER_ID), "none");
  assert.equal(h.callbacks.size, 0);
  h.controller.deactivate();
  assert.equal(h.visibility.get(IMAGERY_LAYER_ID), "visible");
  assert.equal(h.disposals, 0, "toggles retain the warm tile cache");
  await h.controller.activate(); h.render();
  assert.equal(h.controller.status.state, "active");
  h.controller.dispose(); h.controller.dispose();
  assert.equal(h.disposals, 1);
});

test("leaving before libraries resolve prevents a stale activation", async () => {
  let resolve;
  const h = harness({ load: () => new Promise(done => { resolve = done; }) });
  const pending = h.controller.activate();
  h.controller.dispose(); resolve({}); await pending;
  assert.equal(h.layers.has(GOOGLE_TILES_LAYER_ID), false);
  assert.equal(h.callbacks.size, 0);
});

test("library failure and geometry timeout both leave a labelled aerial map", async () => {
  const rejected = harness({ load: async () => { throw new Error("failed"); } });
  await rejected.controller.activate();
  assert.equal(rejected.controller.status.state, "fallback");
  rejected.controller.dispose();
  const h = harness(); await h.controller.activate();
  [...h.callbacks.values()][0]();
  assert.equal(h.controller.status.state, "fallback");
  assert.equal(h.layers.has(GOOGLE_TILES_LAYER_ID), false);
  assert.equal(h.visibility.get(IMAGERY_LAYER_ID), "visible");
  h.controller.dispose();
});

test("provider rejection and graphics context loss remove geometry and preserve the aerial map", async () => {
  for (const reason of ["provider", "context"]) {
    const h = harness(); await h.controller.activate();
    h.tiles.visibleTiles.add({}); h.render();
    if (reason === "provider") { h.tiles.events.get("load-error")({ tile: null }); await Promise.resolve(); }
    else h.canvasEvents.get("webglcontextlost")();
    assert.equal(h.controller.status.state, "fallback");
    assert.equal(h.layers.has(GOOGLE_TILES_LAYER_ID), false);
    assert.equal(h.visibility.get(IMAGERY_LAYER_ID), "visible");
    h.controller.dispose();
  }
});
