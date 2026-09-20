import test from "node:test";
import assert from "node:assert/strict";

import {
  metresToFeet,
  feetToMetres,
  millimetresToInches,
  inchesToMillimetres,
  normalizeDeg360,
  normalizeDeg180,
  angularDifferenceDeg,
  isFiniteNumber,
  formatLength,
} from "../src/spatial/units.js";

test("length conversions match the defined constants", () => {
  // One international foot is exactly 0.3048 m and one inch exactly 25.4 mm.
  assert.ok(Math.abs(feetToMetres(1) - 0.3048) < 1e-12);
  assert.ok(Math.abs(metresToFeet(0.3048) - 1) < 1e-12);
  assert.equal(inchesToMillimetres(1), 25.4);
  assert.ok(Math.abs(millimetresToInches(25.4) - 1) < 1e-12);
});

test("length conversions round-trip", () => {
  for (const value of [0, 0.001, 1, 1.8288, 123.456, 10000]) {
    assert.ok(Math.abs(feetToMetres(metresToFeet(value)) - value) < 1e-9, `metres ${value}`);
    assert.ok(
      Math.abs(millimetresToInches(inchesToMillimetres(value)) - value) < 1e-9,
      `inches ${value}`,
    );
  }
});

test("headings normalise to [0, 360)", () => {
  const cases = [
    [0, 0],
    [360, 0],
    [-360, 0],
    [720, 0],
    [-90, 270],
    [270, 270],
    [630, 270],
    [-450, 270],
    [359.999, 359.999],
  ];
  for (const [input, expected] of cases) {
    assert.ok(Math.abs(normalizeDeg360(input) - expected) < 1e-9, `${input} -> ${expected}`);
  }
});

test("signed angles normalise to (-180, 180]", () => {
  const cases = [
    [0, 0],
    [180, 180],
    [-180, 180],
    [181, -179],
    [270, -90],
    [-270, 90],
    [360, 0],
  ];
  for (const [input, expected] of cases) {
    assert.ok(Math.abs(normalizeDeg180(input) - expected) < 1e-9, `${input} -> ${expected}`);
  }
});

test("angular difference takes the short way round", () => {
  assert.ok(Math.abs(angularDifferenceDeg(350, 10) - 20) < 1e-9);
  assert.ok(Math.abs(angularDifferenceDeg(10, 350) - 20) < 1e-9);
  assert.ok(Math.abs(angularDifferenceDeg(0, 180) - 180) < 1e-9);
  assert.equal(angularDifferenceDeg(45, 45), 0);
});

test("zero is a valid number and non-numbers are rejected", () => {
  assert.equal(isFiniteNumber(0), true);
  assert.equal(isFiniteNumber(-0), true);
  assert.equal(isFiniteNumber(NaN), false);
  assert.equal(isFiniteNumber(Infinity), false);
  assert.equal(isFiniteNumber("0"), false);
  assert.equal(isFiniteNumber(null), false);
  assert.equal(isFiniteNumber(undefined), false);
  assert.equal(Number.isNaN(normalizeDeg360(NaN)), true);
});

test("formatLength converts only at the output boundary", () => {
  assert.equal(formatLength(1, "metric"), "1.00 m");
  assert.equal(formatLength(0.3048, "imperial"), "1.00 ft");
  assert.equal(formatLength(0, "metric"), "0.00 m");
  assert.equal(formatLength(NaN), "—");
});
