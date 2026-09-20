import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  imagerySources,
  excludedServices,
  validateRegionImagery,
  boundsArray,
} from "../src/map/region-config.js";
import {
  baseStyle,
  imageryLayerSpec,
  IMAGERY_SOURCE_ID,
  BACKGROUND_LAYER_ID,
  rasterSourceSpec,
  createImageryFailover,
  exportImageUrl,
  squareBbox,
  DEFAULT_FAILURE_THRESHOLD,
} from "../src/map/imagery.js";
import { createMapAdapter, MAP_ERROR_CODES } from "../src/map/maplibre-adapter.js";
import { classifyImageContent, imageStatistics, CONTENT_THRESHOLDS } from "../src/map/image-content.js";
import { decodeBmp, encodeBmp } from "../tools/lib/bmp.mjs";
import { toWebMercator, fromWebMercator, metresPerPixel } from "../src/spatial/geo.js";

const region = JSON.parse(
  readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url), "utf8"),
);

const clone = () => structuredClone(region);

// ---- Configuration rules -------------------------------------------------

test("the shipped region configuration passes its own imagery rules", () => {
  const { ok, errors } = validateRegionImagery(region);
  assert.equal(ok, true, JSON.stringify(errors, null, 2));

  const sources = imagerySources(region);
  assert.deepEqual(sources.map((s) => s.role), ["primary", "fallback"]);
  assert.deepEqual(sources.map((s) => s.year), [2025, 2024]);
  assert.deepEqual(boundsArray(region), [-92.05, 30.2, -92.005, 30.255]);
});

test("a service recorded as not covering this inventory can never be configured", () => {
  // Test 25: the 2026 map-service layer must never become the Lafayette primary.
  const excluded = excludedServices(region);
  assert.equal(excluded.length, 1);
  assert.match(excluded[0].service, /MapServer\/187$/);

  const broken = clone();
  broken.imagery.primary.service = excluded[0].service;
  const { ok, errors } = validateRegionImagery(broken);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === "imagery.primary.service" && /excluded list/.test(e.reason)));
});

test("a request template that is not a dynamic image request is refused", () => {
  const broken = clone();
  broken.imagery.primary.tileTemplate = "https://example.test/tiles/{z}/{x}/{y}.jpg";
  const { errors } = validateRegionImagery(broken);
  assert.ok(errors.some((e) => /\{bbox-epsg-3857\}/.test(e.reason)));
});

test("a declared tile size that disagrees with the request is refused", () => {
  // The two drifting apart resamples every tile and silently halves sharpness.
  const broken = clone();
  broken.imagery.primary.tileSize = 256;
  const { errors } = validateRegionImagery(broken);
  assert.ok(errors.some((e) => e.path === "imagery.primary.tileSize"));
});

test("attribution must name the year, and a missing fallback is refused", () => {
  const noYear = clone();
  noYear.imagery.fallback.attribution = "Imagery: Louisiana DOTD";
  assert.ok(validateRegionImagery(noYear).errors.some((e) => e.path === "imagery.fallback.attribution"));

  const noFallback = clone();
  delete noFallback.imagery.fallback;
  assert.ok(validateRegionImagery(noFallback).errors.some((e) => e.path === "imagery.fallback"));
});

test("a configuration with no neutral ground or accuracy note is refused", () => {
  const broken = clone();
  delete broken.imagery.neutralBackgroundColor;
  delete broken.imagery.accuracyNote;
  const paths = validateRegionImagery(broken).errors.map((e) => e.path);
  assert.ok(paths.includes("imagery.neutralBackgroundColor"));
  assert.ok(paths.includes("imagery.accuracyNote"));
});

// ---- Style construction --------------------------------------------------

test("the map is created with a ground and no imagery source", () => {
  // Imagery is added once the map reports `load`, matching the shape the
  // reference project proved, so that a failover swaps one source instead of
  // rebuilding the style and discarding every other layer.
  const style = baseStyle(region);
  assert.equal(style.version, 8);
  assert.deepEqual(style.sources, {}, "the initial style declares no source");
  assert.equal(style.layers.length, 1);
  assert.equal(style.layers[0].id, BACKGROUND_LAYER_ID);
  assert.equal(style.layers[0].type, "background");
  assert.equal(style.layers[0].paint["background-color"], region.imagery.neutralBackgroundColor);
});

test("the imagery layer names the source it is added with", () => {
  const layer = imageryLayerSpec();
  assert.equal(layer.type, "raster");
  assert.equal(layer.source, IMAGERY_SOURCE_ID);
});

test("the raster source carries the proven request shape", () => {
  const [primary] = imagerySources(region);
  const spec = rasterSourceSpec(primary);
  assert.equal(spec.type, "raster");
  assert.equal(spec.tileSize, 512);
  assert.equal(spec.maxzoom, 20);
  assert.match(spec.tiles[0], /exportImage\?bbox=\{bbox-epsg-3857\}/);
  assert.match(spec.tiles[0], /bandIds=0,1,2/);
  assert.equal(spec.attribution, primary.attribution);
});

// ---- Failover ------------------------------------------------------------

test("a working primary becomes active and stays active", () => {
  const failover = createImageryFailover({ region });
  assert.equal(failover.status.state, "pending");
  const status = failover.reportTileLoaded();
  assert.equal(status.state, "active");
  assert.equal(status.year, 2025);
  assert.equal(status.isFallback, false);
});

test("an isolated tile failure does not abandon a working source", () => {
  const failover = createImageryFailover({ region });
  failover.reportTileLoaded();
  for (let i = 0; i < DEFAULT_FAILURE_THRESHOLD - 1; i += 1) failover.reportTileFailed();
  failover.reportTileLoaded();
  for (let i = 0; i < DEFAULT_FAILURE_THRESHOLD - 1; i += 1) failover.reportTileFailed();
  assert.equal(failover.status.sourceId, imagerySources(region)[0].id);
});

test("sustained failure moves to the fallback and names the fallback year", () => {
  // Test 23: the fallback activates and identifies itself.
  const changes = [];
  const failover = createImageryFailover({ region, onChange: (s) => changes.push(s.sourceId) });
  for (let i = 0; i < DEFAULT_FAILURE_THRESHOLD; i += 1) failover.reportTileFailed("HTTP 503");

  const status = failover.status;
  assert.equal(status.year, 2024);
  assert.equal(status.isFallback, true);
  assert.match(status.attribution, /2024/);
  assert.ok(status.history.some((e) => e.event === "failover" && /HTTP 503/.test(e.reason)));
  assert.ok(changes.length > 0);
});

test("exhausting every source leaves a neutral ground and says imagery is unavailable", () => {
  const failover = createImageryFailover({ region });
  failover.reportSourceUnusable("the primary host was blocked");
  failover.reportSourceUnusable("the fallback host was blocked");

  const status = failover.status;
  assert.equal(status.state, "neutral");
  assert.equal(status.source, null);
  assert.match(status.attribution, /No aerial imagery/);
  // Nothing stale is attributed to a year it did not come from.
  assert.equal(/2025|2024/.test(status.attribution), false);
  assert.equal(failover.reportTileFailed().state, "neutral");
});

test("a retry returns to the primary and the history records every transition", () => {
  const failover = createImageryFailover({ region });
  failover.reportSourceUnusable("blocked");
  assert.equal(failover.status.isFallback, true);

  const status = failover.reset();
  assert.equal(status.isFallback, false);
  assert.deepEqual(
    status.history.map((e) => e.event),
    ["failover", "reset"],
  );
});

// ---- Adapter failure paths -----------------------------------------------

test("the map reports a classified failure instead of throwing", () => {
  const events = [];
  const onEvent = (event) => events.push(event.type);

  const noWebgl = createMapAdapter({ container: {}, region, maplibre: {}, onEvent, webgl: false });
  assert.equal(noWebgl.create().error.code, MAP_ERROR_CODES.webglUnavailable);

  const noLibrary = createMapAdapter({ container: {}, region, maplibre: null, onEvent });
  const result = noLibrary.create();
  assert.equal(result.error.code, MAP_ERROR_CODES.libraryUnavailable);
  // The message has to say what still works, because that is the recovery.
  assert.match(result.error.message, /list and dossiers still work/);
  assert.deepEqual(events, ["unavailable", "unavailable"]);
});

test("the adapter starts on the primary and exposes its imagery status", () => {
  const adapter = createMapAdapter({ container: {}, region, maplibre: null });
  assert.equal(adapter.imagery.year, 2025);
  assert.equal(adapter.forceImageryFailure("blocked for the fallback check").year, 2024);
});

// ---- Request construction ------------------------------------------------

test("a probe request reuses the configured template rather than a second one", () => {
  const [primary] = imagerySources(region);
  const bbox = squareBbox(toWebMercator([-92.018864, 30.2215626]), 38.4);
  const url = exportImageUrl(primary, bbox, { format: "bmp", size: 512 });

  assert.ok(url.startsWith(primary.service), "the probe must call the configured service");
  assert.match(url, /format=bmp/);
  assert.equal(url.includes("{bbox-epsg-3857}"), false);
  assert.match(url, /bbox=-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*/);
  // The production shape is the same request with the JPEG format.
  assert.match(exportImageUrl(primary, bbox), /format=jpg/);
});

test("the projection round-trips", () => {
  const position = [-92.018864, 30.2215626];
  const [lon, lat] = fromWebMercator(toWebMercator(position));
  assert.ok(Math.abs(lon - position[0]) < 1e-9, `lon drifted to ${lon}`);
  assert.ok(Math.abs(lat - position[1]) < 1e-9, `lat drifted to ${lat}`);
});

test("the configured top zoom is flagged as asking for more detail than exists", () => {
  // Measured 2026-09-20: both services report about 0.150 m per pixel, while
  // maxZoom 20 at 512 pixels asks for about 0.064 m. That is a warning rather
  // than an error: the configuration renders, and lowering it is a visual
  // judgement that needs a browser.
  const { ok, warnings } = validateRegionImagery(region);
  assert.equal(ok, true);
  assert.deepEqual(
    warnings.map((w) => w.path),
    ["imagery.primary.maxZoom", "imagery.fallback.maxZoom"],
  );

  const [primary] = imagerySources(region);
  assert.ok(metresPerPixel(30.22, primary.maxZoom, primary.tileSize) < primary.sourcePixelSizeM);
});

// ---- Image content -------------------------------------------------------

function solid(width, height, [r, g, b]) {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return { width, height, data };
}

function noisy(width, height, seed = 1) {
  const data = new Uint8Array(width * height * 3);
  let state = seed;
  for (let i = 0; i < data.length; i += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    data[i] = 40 + (state % 160);
  }
  return { width, height, data };
}

test("a no-data response is never accepted as coverage", () => {
  // Test 22: the service renders no-data as 0, returning a valid black image
  // with a 200 response.
  const black = classifyImageContent(solid(64, 64, [0, 0, 0]));
  assert.equal(black.verdict, "no-data");
  assert.equal(black.statistics.nearBlackFraction, 1);
});

test("a flat non-black fill is rejected too, not only black", () => {
  // The excluded map service returns a uniform background colour, so a check
  // that only looked for black would have passed it.
  const grey = classifyImageContent(solid(64, 64, [200, 200, 200]));
  assert.equal(grey.verdict, "uniform");
});

test("photographic variation is accepted", () => {
  const photo = classifyImageContent(noisy(64, 64));
  assert.equal(photo.verdict, "covered");
  assert.ok(photo.statistics.meanStdDev > CONTENT_THRESHOLDS.coveredMinStdDev);
});

test("an image that is neither coverage nor no-data is reported as suspect", () => {
  // Half no-data and half flat colour: a coverage edge, which a person should
  // look at rather than have silently sorted into a neighbouring verdict.
  const image = solid(64, 64, [0, 0, 0]);
  for (let i = 0; i < image.data.length / 2; i += 3) {
    image.data[i] = 90;
    image.data[i + 1] = 92;
    image.data[i + 2] = 88;
  }
  assert.equal(classifyImageContent(image).verdict, "suspect");
});

test("the thresholds separate the values actually observed from the service", () => {
  // Observed 2026-09-20 across twelve point/source combinations: covered tiles
  // ranged 25.4 to 56.1 mean standard deviation over 22,234 to 49,992 distinct
  // colours in 262,144 pixels, a distinct-colour fraction of at least 0.085.
  // Every no-coverage control and the excluded service returned 0.00 variation
  // across a single colour.
  assert.ok(CONTENT_THRESHOLDS.coveredMinStdDev < 25.4, "the weakest covered tile must still pass");
  assert.ok(CONTENT_THRESHOLDS.coveredMinDistinctColourFraction < 0.085, "likewise for texture");
  assert.ok(CONTENT_THRESHOLDS.coveredMinStdDev > 0, "a flat image must never pass");
  assert.ok(CONTENT_THRESHOLDS.coveredMinDistinctColourFraction > 2 / 262144, "nor a two-tone one");
});

test("statistics refuse an image smaller than its declared dimensions", () => {
  assert.throws(
    () => imageStatistics({ width: 64, height: 64, data: new Uint8Array(100) }),
    RangeError,
  );
});

// ---- Pixel reader --------------------------------------------------------

test("the BMP reader returns the pixels it was given", () => {
  const source = noisy(9, 5, 7);
  const decoded = decodeBmp(encodeBmp(source));
  assert.equal(decoded.width, 9);
  assert.equal(decoded.height, 5);
  // A width of 9 forces row padding, which is where a stride error would show.
  assert.deepEqual([...decoded.data], [...source.data]);
});

test("the BMP reader rejects what it cannot read instead of guessing", () => {
  assert.throws(() => decodeBmp(Buffer.alloc(10)), /too short/);
  assert.throws(() => decodeBmp(Buffer.alloc(60)), /bad signature/);

  const bmp = encodeBmp(solid(4, 4, [1, 2, 3]));
  const wrongDepth = Buffer.from(bmp);
  wrongDepth.writeUInt16LE(16, 28);
  assert.throws(() => decodeBmp(wrongDepth), /unsupported bit depth 16/);

  const compressed = Buffer.from(bmp);
  compressed.writeUInt32LE(1, 30);
  assert.throws(() => decodeBmp(compressed), /unsupported compression/);

  const truncated = Buffer.from(bmp).subarray(0, bmp.length - 20);
  assert.throws(() => decodeBmp(truncated), /shorter than its header declares/);
});

test("no application file can reach the excluded service", () => {
  // Test 25: the excluded layer may be named in configuration, where it is
  // recorded as excluded, and nowhere else. A stray reference in application
  // code is how a diagnostic endpoint quietly becomes a live one.
  const excluded = excludedServices(region)[0].service;
  const appFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "src", "index.html", "styles"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);

  assert.ok(appFiles.length > 0, "the file listing must not be empty");
  for (const file of appFiles) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(
      contents.includes(excluded) || /MapServer\/187/.test(contents),
      false,
      `${file} references the excluded service`,
    );
  }
});

test("a source the map rejects without erroring is not recorded as applied", () => {
  // MapLibre reports a rejected style mutation through its error event and
  // otherwise leaves the layer quietly absent. Recording it as applied would
  // mean no tile is ever requested, so no tile ever fails, so the failover
  // never fires and the map stays empty with nothing reported.
  const added = [];
  const handlers = new Map();
  const fakeMap = {
    on: (type, fn) => handlers.set(type, fn),
    getStyle: () => ({ layers: [{ id: BACKGROUND_LAYER_ID }] }),
    getLayer: () => null,
    // Accepts the call, then does not actually register the source.
    getSource: () => null,
    addSource: (id) => added.push(id),
    addLayer: (spec) => added.push(spec.id),
    removeLayer() {},
    removeSource() {},
  };

  const adapter = createMapAdapter({
    container: {},
    region,
    maplibre: { Map: function FakeMap() { return fakeMap; } },
  });
  adapter.create();
  // The library reports its style as loaded; the adapter then adds imagery.
  handlers.get("load")?.();

  assert.ok(added.length > 0, "the adapter must have attempted the mutation");
  // Rejected on both configured sources, it ends on the neutral ground rather
  // than claiming imagery that is not on the map.
  assert.equal(adapter.imagery.state, "neutral");
  assert.equal(adapter.imagery.source, null);
  assert.ok(
    adapter.imagery.history.some((entry) => /rejected/.test(entry.reason)),
    "the rejection must be recorded with its reason",
  );
});

test("a map that is already loaded still gets its imagery", () => {
  // The reference guards this explicitly: attaching a load handler to a map
  // that has already loaded means the event never arrives, imagery is never
  // added, and the map sits empty with nothing reported.
  const added = [];
  const fakeMap = {
    on() {},
    loaded: () => true,
    getStyle: () => ({ layers: [{ id: BACKGROUND_LAYER_ID }] }),
    getLayer: (id) => (added.includes(id) ? { id } : null),
    getSource: (id) => (added.includes(id) ? { id } : null),
    addSource: (id) => added.push(id),
    addLayer: (spec) => added.push(spec.id),
    removeLayer() {},
    removeSource() {},
    resize() {},
  };

  const adapter = createMapAdapter({
    container: {},
    region,
    maplibre: { Map: function FakeMap() { return fakeMap; } },
  });
  adapter.create();

  assert.ok(added.includes(IMAGERY_SOURCE_ID), "the source must be added without waiting");
  assert.equal(adapter.imagery.sourceId, imagerySources(region)[0].id);
});

test("the tilt toggle changes pitch and reports it, and flattening resets bearing", () => {
  // Aerial imagery seen at an angle is what makes a street read as a space
  // with height. Flattening returns to north-up rather than leaving the camera
  // wherever the tilted view ended, which is what the reference does too.
  const eased = [];
  const fakeMap = {
    on() {},
    loaded: () => true,
    getStyle: () => ({ layers: [{ id: BACKGROUND_LAYER_ID }] }),
    getLayer: () => null,
    getSource: () => null,
    addSource() {},
    addLayer() {},
    removeLayer() {},
    removeSource() {},
    addControl() {},
    resize() {},
    getBearing: () => 42,
    easeTo: (options) => eased.push(options),
  };

  const events = [];
  const adapter = createMapAdapter({
    container: {},
    region,
    maplibre: {
      Map: function FakeMap() { return fakeMap; },
      NavigationControl: function Nav() {},
      ScaleControl: function Scale() {},
    },
    onEvent: (event) => events.push(event),
  });
  adapter.create();

  assert.equal(adapter.tilted, false, "the map starts flat");

  adapter.setTilted(true);
  assert.equal(adapter.tilted, true);
  assert.equal(eased.at(-1).pitch, 60);
  assert.equal(eased.at(-1).bearing, 42, "a tilted view keeps the bearing it had");

  adapter.setTilted(false);
  assert.equal(eased.at(-1).pitch, 0);
  assert.equal(eased.at(-1).bearing, 0, "flattening returns to north-up");

  assert.equal(events.filter((e) => e.type === "dimension").length, 2);
});
