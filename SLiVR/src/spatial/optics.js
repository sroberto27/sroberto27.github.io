/**
 * Camera lens geometry for the Shot Designer.
 *
 * The model is an ideal rectilinear lens: FOV = 2 * atan(gate / (2 * focal)).
 * It deliberately excludes distortion, anamorphic squeeze, focus breathing,
 * stabilisation crop and real depth of field. A coverage cone drawn from these
 * numbers is a schematic boundary, not an optical simulation.
 *
 * All sensor and focal values are millimetres; all angles are degrees.
 */

import { isFiniteNumber, radToDeg } from "./units.js";

/**
 * @typedef {object} OpticsSpec
 * @property {number} gateWidthMm   Physical gate width.
 * @property {number} gateHeightMm  Physical gate height.
 * @property {number} focalLengthMm
 * @property {number} [cropFactor]  Digital/recording crop; 1 means the full gate.
 * @property {number} [targetAspect] Recorded aspect ratio (width/height). Omit to
 *   use the full gate shape.
 */

const POSITIVE_FIELDS = ["gateWidthMm", "gateHeightMm", "focalLengthMm"];

/**
 * Validates an optics spec without throwing, for form and import paths.
 * @returns {{ok: boolean, errors: Array<{path: string, reason: string}>}}
 */
export function validateOptics(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") {
    return { ok: false, errors: [{ path: "", reason: "optics spec must be an object" }] };
  }
  for (const field of POSITIVE_FIELDS) {
    const value = spec[field];
    if (!isFiniteNumber(value)) {
      errors.push({ path: field, reason: "must be a finite number in millimetres" });
    } else if (value <= 0) {
      errors.push({ path: field, reason: "must be greater than zero" });
    }
  }
  if (spec.cropFactor !== undefined) {
    if (!isFiniteNumber(spec.cropFactor) || spec.cropFactor <= 0) {
      errors.push({ path: "cropFactor", reason: "must be greater than zero" });
    }
  }
  if (spec.targetAspect !== undefined && spec.targetAspect !== null) {
    if (!isFiniteNumber(spec.targetAspect) || spec.targetAspect <= 0) {
      errors.push({ path: "targetAspect", reason: "must be greater than zero" });
    }
  }
  return { ok: errors.length === 0, errors };
}

function assertValid(spec) {
  const { ok, errors } = validateOptics(spec);
  if (!ok) {
    const detail = errors.map((e) => `${e.path || "spec"}: ${e.reason}`).join("; ");
    throw new RangeError(`invalid optics spec — ${detail}`);
  }
}

/**
 * Active gate after crop and aspect selection, in millimetres.
 *
 * Crop shrinks both dimensions. A target aspect then selects the largest
 * rectangle of that shape fitting inside the cropped gate, which is how a
 * camera derives 16:9 or 2.39:1 from a physical sensor.
 */
export function effectiveGateMm(spec) {
  assertValid(spec);
  const crop = spec.cropFactor ?? 1;
  const croppedWidth = spec.gateWidthMm / crop;
  const croppedHeight = spec.gateHeightMm / crop;

  const target = spec.targetAspect ?? null;
  if (target === null) {
    return { widthMm: croppedWidth, heightMm: croppedHeight };
  }

  const croppedAspect = croppedWidth / croppedHeight;
  if (target >= croppedAspect) {
    // Wider than the gate: width is the limit, height is trimmed.
    return { widthMm: croppedWidth, heightMm: croppedWidth / target };
  }
  return { widthMm: croppedHeight * target, heightMm: croppedHeight };
}

/** Field of view in degrees for one gate dimension. */
export function fieldOfViewDeg(gateDimensionMm, focalLengthMm) {
  if (!isFiniteNumber(gateDimensionMm) || gateDimensionMm <= 0) {
    throw new RangeError("gate dimension must be greater than zero");
  }
  if (!isFiniteNumber(focalLengthMm) || focalLengthMm <= 0) {
    throw new RangeError("focal length must be greater than zero");
  }
  return radToDeg(2 * Math.atan(gateDimensionMm / (2 * focalLengthMm)));
}

/**
 * Horizontal, vertical and diagonal field of view for a camera setup,
 * together with the active gate the angles were derived from.
 */
export function fieldOfView(spec) {
  const gate = effectiveGateMm(spec);
  const diagonalMm = Math.hypot(gate.widthMm, gate.heightMm);
  return {
    horizontalDeg: fieldOfViewDeg(gate.widthMm, spec.focalLengthMm),
    verticalDeg: fieldOfViewDeg(gate.heightMm, spec.focalLengthMm),
    diagonalDeg: fieldOfViewDeg(diagonalMm, spec.focalLengthMm),
    activeGateMm: gate,
    focalLengthMm: spec.focalLengthMm,
  };
}

/**
 * Width covered by a field of view at a given subject distance, in the same
 * length unit as the distance. Used for the plan-view coverage cone.
 */
export function coverageAtDistance(fovDeg, distance) {
  if (!isFiniteNumber(fovDeg) || fovDeg <= 0 || fovDeg >= 180) {
    throw new RangeError("field of view must be between 0 and 180 degrees");
  }
  if (!isFiniteNumber(distance) || distance < 0) {
    throw new RangeError("distance must be zero or greater");
  }
  return 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
}
