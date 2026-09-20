import test from "node:test";
import assert from "node:assert/strict";

import {
  fieldOfView,
  fieldOfViewDeg,
  effectiveGateMm,
  coverageAtDistance,
  validateOptics,
} from "../src/spatial/optics.js";
import { degToRad } from "../src/spatial/units.js";

/**
 * Documented tolerance for the field-of-view checks.
 *
 * The published-value comparison uses 0.05 deg because the reference figures
 * for common still and cine formats are quoted to one decimal place. The
 * geometric relation is checked to 1e-12, which is the real contract: the
 * tangent of the half angle must equal half the active gate over the focal
 * length, independently of how the implementation arrives at the angle.
 */
const PUBLISHED_TOLERANCE_DEG = 0.05;
const GEOMETRIC_TOLERANCE = 1e-12;

/** Asserts the half-angle tangent relation without reusing the implementation. */
function assertTangentRelation(fovDeg, gateMm, focalMm, label) {
  const expected = gateMm / (2 * focalMm);
  const actual = Math.tan(degToRad(fovDeg) / 2);
  assert.ok(
    Math.abs(actual - expected) < GEOMETRIC_TOLERANCE,
    `${label}: tan(fov/2) was ${actual}, expected ${expected}`,
  );
}

test("full-frame 36.0 x 24.0 mm at 50 mm matches published angles", () => {
  const fov = fieldOfView({ gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 50 });

  // Commonly published for a 50 mm lens on a 36 x 24 mm gate.
  assert.ok(Math.abs(fov.horizontalDeg - 39.6) < PUBLISHED_TOLERANCE_DEG, `H ${fov.horizontalDeg}`);
  assert.ok(Math.abs(fov.verticalDeg - 27.0) < PUBLISHED_TOLERANCE_DEG, `V ${fov.verticalDeg}`);
  assert.ok(Math.abs(fov.diagonalDeg - 46.8) < PUBLISHED_TOLERANCE_DEG, `D ${fov.diagonalDeg}`);

  assertTangentRelation(fov.horizontalDeg, 36, 50, "horizontal");
  assertTangentRelation(fov.verticalDeg, 24, 50, "vertical");
  assertTangentRelation(fov.diagonalDeg, Math.hypot(36, 24), 50, "diagonal");
});

test("Super 35 24.89 x 18.66 mm at 35 mm matches published angles", () => {
  const fov = fieldOfView({ gateWidthMm: 24.89, gateHeightMm: 18.66, focalLengthMm: 35 });

  assert.ok(Math.abs(fov.horizontalDeg - 39.15) < PUBLISHED_TOLERANCE_DEG, `H ${fov.horizontalDeg}`);
  assert.ok(Math.abs(fov.verticalDeg - 29.85) < PUBLISHED_TOLERANCE_DEG, `V ${fov.verticalDeg}`);

  assertTangentRelation(fov.horizontalDeg, 24.89, 35, "horizontal");
  assertTangentRelation(fov.verticalDeg, 18.66, 35, "vertical");
});

test("a 2x crop halves the active gate and narrows the angle accordingly", () => {
  const full = fieldOfView({ gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 50 });
  const cropped = fieldOfView({
    gateWidthMm: 36,
    gateHeightMm: 24,
    focalLengthMm: 50,
    cropFactor: 2,
  });

  assert.equal(cropped.activeGateMm.widthMm, 18);
  assert.equal(cropped.activeGateMm.heightMm, 12);
  assert.ok(cropped.horizontalDeg < full.horizontalDeg);
  assertTangentRelation(cropped.horizontalDeg, 18, 50, "cropped horizontal");

  // A 2x crop on a 50 mm lens covers the same angle as a 100 mm lens uncropped.
  const longer = fieldOfView({ gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 100 });
  assert.ok(Math.abs(cropped.horizontalDeg - longer.horizontalDeg) < 1e-12);
});

test("a wider target aspect trims height and keeps width", () => {
  const gate = effectiveGateMm({
    gateWidthMm: 36,
    gateHeightMm: 24,
    focalLengthMm: 50,
    targetAspect: 16 / 9,
  });
  assert.equal(gate.widthMm, 36);
  assert.ok(Math.abs(gate.heightMm - 20.25) < 1e-12);
});

test("a narrower target aspect trims width and keeps height", () => {
  const gate = effectiveGateMm({
    gateWidthMm: 36,
    gateHeightMm: 24,
    focalLengthMm: 50,
    targetAspect: 1,
  });
  assert.equal(gate.heightMm, 24);
  assert.equal(gate.widthMm, 24);
});

test("an aspect equal to the gate changes nothing", () => {
  const gate = effectiveGateMm({
    gateWidthMm: 36,
    gateHeightMm: 24,
    focalLengthMm: 50,
    targetAspect: 1.5,
  });
  assert.ok(Math.abs(gate.widthMm - 36) < 1e-12);
  assert.ok(Math.abs(gate.heightMm - 24) < 1e-12);
});

test("zero and negative values are rejected with a reason", () => {
  const cases = [
    { gateWidthMm: 0, gateHeightMm: 24, focalLengthMm: 50 },
    { gateWidthMm: 36, gateHeightMm: 0, focalLengthMm: 50 },
    { gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 0 },
    { gateWidthMm: -36, gateHeightMm: 24, focalLengthMm: 50 },
    { gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: -50 },
    { gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 50, cropFactor: 0 },
    { gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 50, targetAspect: -1 },
  ];
  for (const spec of cases) {
    const result = validateOptics(spec);
    assert.equal(result.ok, false, JSON.stringify(spec));
    assert.ok(result.errors.length > 0);
    assert.throws(() => fieldOfView(spec), RangeError, JSON.stringify(spec));
  }
});

test("non-numeric and non-finite optics are rejected", () => {
  for (const value of ["50", null, undefined, NaN, Infinity]) {
    const result = validateOptics({ gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: value });
    assert.equal(result.ok, false, `focal ${String(value)}`);
  }
  assert.equal(validateOptics(null).ok, false);
});

test("fieldOfViewDeg rejects invalid dimensions directly", () => {
  assert.throws(() => fieldOfViewDeg(0, 50), RangeError);
  assert.throws(() => fieldOfViewDeg(36, 0), RangeError);
  assert.throws(() => fieldOfViewDeg(36, NaN), RangeError);
});

test("coverage at a distance follows the half-angle tangent", () => {
  const fov = fieldOfView({ gateWidthMm: 36, gateHeightMm: 24, focalLengthMm: 50 });
  // tan(H/2) is exactly 0.36 for this gate and focal length, so 10 m out the
  // covered width is 7.2 m.
  assert.ok(Math.abs(coverageAtDistance(fov.horizontalDeg, 10) - 7.2) < 1e-9);
  assert.equal(coverageAtDistance(fov.horizontalDeg, 0), 0);
  assert.throws(() => coverageAtDistance(fov.horizontalDeg, -1), RangeError);
  assert.throws(() => coverageAtDistance(180, 10), RangeError);
});
