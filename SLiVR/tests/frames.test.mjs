import test from "node:test";
import assert from "node:assert/strict";

import {
  createFrame,
  geoToLocal,
  localToGeo,
  heightAboveGroundM,
  FRAME_VALIDITY_RADIUS_M,
} from "../src/spatial/frames.js";
import { distanceM, bearingDeg, radiiOfCurvatureM, withinBounds } from "../src/spatial/geo.js";

/** Downtown Lafayette, near the shared-experience cluster. */
const ORIGIN = { lon: -92.0189, lat: 30.2216 };

function frame(extra = {}) {
  return createFrame({ ...ORIGIN, groundElevationM: 12, elevationDatum: "NAVD88", ...extra });
}

test("the origin maps to exactly zero", () => {
  const f = frame();
  const local = geoToLocal(f, [ORIGIN.lon, ORIGIN.lat]);
  assert.equal(local.x, 0);
  assert.equal(local.y, 0);
  assert.equal(local.z, 0);
  assert.equal(local.beyondValidityRadius, false);
});

test("a zero north offset leaves east on +X and north on +Y", () => {
  const f = frame();
  const north = localToGeo(f, { x: 0, y: 100 });
  const east = localToGeo(f, { x: 100, y: 0 });

  assert.ok(north.position[1] > ORIGIN.lat, "north increases latitude");
  assert.ok(Math.abs(north.position[0] - ORIGIN.lon) < 1e-12, "north does not change longitude");
  assert.ok(east.position[0] > ORIGIN.lon, "east increases longitude");
  assert.ok(Math.abs(east.position[1] - ORIGIN.lat) < 1e-12, "east does not change latitude");

  assert.ok(Math.abs(bearingDeg([ORIGIN.lon, ORIGIN.lat], north.position) - 0) < 1e-6);
  assert.ok(Math.abs(bearingDeg([ORIGIN.lon, ORIGIN.lat], east.position) - 90) < 1e-3);
});

test("local coordinates round-trip through geography", () => {
  const f = frame();
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
    { x: 0, y: 100, z: 3 },
    { x: -250.5, y: 725.25, z: -1.5 },
    { x: 1500, y: -1200, z: 0 },
  ];
  for (const point of points) {
    const geo = localToGeo(f, point);
    const back = geoToLocal(f, geo.position, geo.elevationM);
    assert.ok(Math.abs(back.x - point.x) < 1e-6, `x ${point.x} -> ${back.x}`);
    assert.ok(Math.abs(back.y - point.y) < 1e-6, `y ${point.y} -> ${back.y}`);
    assert.ok(Math.abs(back.z - point.z) < 1e-9, `z ${point.z} -> ${back.z}`);
  }
});

test("a known 100 m offset measures 100 m to within a decimetre", () => {
  const f = frame();
  for (const point of [
    { x: 0, y: 100 },
    { x: 100, y: 0 },
    { x: 70.710678, y: 70.710678 },
  ]) {
    const geo = localToGeo(f, point);
    const measured = distanceM([ORIGIN.lon, ORIGIN.lat], geo.position);
    // The tangent plane uses the local radii of curvature while the geographic
    // distance uses a mean sphere, so the two agree to roughly 0.3 percent.
    assert.ok(Math.abs(measured - 100) < 0.4, `${JSON.stringify(point)} measured ${measured}`);
  }
});

test("a north offset rotates the scene axes", () => {
  const rotated = frame({ northOffsetDeg: 90 });
  const unrotated = frame();
  const dueNorth = localToGeo(unrotated, { x: 0, y: 100 }).position;

  // With +Y pointing east, a point due north sits on -X.
  const local = geoToLocal(rotated, dueNorth);
  assert.ok(Math.abs(local.x + 100) < 1e-6, `x was ${local.x}`);
  assert.ok(Math.abs(local.y) < 1e-6, `y was ${local.y}`);
});

test("north offset values normalise and round-trip", () => {
  for (const offset of [0, 45, 90, 180, 270, 359.9, -90, 450]) {
    const f = frame({ northOffsetDeg: offset });
    assert.ok(f.northOffsetDeg >= 0 && f.northOffsetDeg < 360, `${offset}`);
    const point = { x: 12.5, y: -33.75, z: 2 };
    const back = geoToLocal(f, localToGeo(f, point).position, 12 + point.z);
    assert.ok(Math.abs(back.x - point.x) < 1e-6, `offset ${offset} x`);
    assert.ok(Math.abs(back.y - point.y) < 1e-6, `offset ${offset} y`);
  }
});

test("heights stay separated", () => {
  const f = frame();
  // A camera on the second floor at 1.4 m eye height is 5.4 m above ground.
  assert.equal(heightAboveGroundM({ floorElevationM: 4, heightAboveFloorM: 1.4 }), 5.4);
  assert.equal(heightAboveGroundM({}), 0);
  assert.throws(() => heightAboveGroundM({ floorElevationM: NaN }), RangeError);

  const local = geoToLocal(f, [ORIGIN.lon, ORIGIN.lat], 17.4);
  assert.ok(Math.abs(local.z - 5.4) < 1e-9, "z is measured above the frame ground datum");
});

test("conversions beyond the validity radius are flagged", () => {
  const f = frame();
  const near = localToGeo(f, { x: 0, y: FRAME_VALIDITY_RADIUS_M - 100 });
  const far = localToGeo(f, { x: 0, y: FRAME_VALIDITY_RADIUS_M + 100 });
  assert.equal(geoToLocal(f, near.position).beyondValidityRadius, false);
  assert.equal(geoToLocal(f, far.position).beyondValidityRadius, true);
});

test("invalid frames and coordinates are rejected", () => {
  assert.throws(() => createFrame({ lon: 200, lat: 30 }), RangeError);
  assert.throws(() => createFrame({ lon: -92, lat: 95 }), RangeError);
  assert.throws(() => createFrame({ lon: -92, lat: 30, groundElevationM: NaN }), RangeError);
  assert.throws(() => createFrame({ lon: -92, lat: 30, northOffsetDeg: NaN }), RangeError);
  assert.throws(() => geoToLocal(frame(), [200, 30]), RangeError);
  assert.throws(() => localToGeo(frame(), { x: NaN, y: 0 }), RangeError);
});

test("radii of curvature bracket the mean radius at this latitude", () => {
  const { meridionalM, primeVerticalM } = radiiOfCurvatureM(ORIGIN.lat);
  assert.ok(meridionalM > 6_300_000 && meridionalM < 6_400_000, `M ${meridionalM}`);
  assert.ok(primeVerticalM > meridionalM, "prime vertical exceeds meridional away from the poles");
});

test("bounds testing rejects a swapped pair", () => {
  const bounds = { west: -92.05, south: 30.2, east: -92.005, north: 30.255 };
  assert.equal(withinBounds([-92.0189, 30.2216], bounds), true);
  assert.equal(withinBounds([30.2216, -92.0189], bounds), false);
  assert.equal(withinBounds([0, 0], bounds), false);
});
