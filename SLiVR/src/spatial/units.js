/**
 * Unit conversion and angle normalisation.
 *
 * SLiVR stores every length in metres and every angle in degrees. Imperial
 * values exist only at input and output boundaries, so conversion lives here
 * rather than being repeated in form handlers and exporters.
 */

const FEET_PER_METRE = 3.280839895013123;
const MM_PER_INCH = 25.4;

/** Rejects NaN, Infinity and non-numbers while accepting a legitimate 0. */
export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function metresToFeet(metres) {
  return metres * FEET_PER_METRE;
}

export function feetToMetres(feet) {
  return feet / FEET_PER_METRE;
}

export function millimetresToInches(mm) {
  return mm / MM_PER_INCH;
}

export function inchesToMillimetres(inches) {
  return inches * MM_PER_INCH;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Normalises a heading to [0, 360). Used wherever an angle is stored or
 * compared, so that -90, 270 and 630 are the same heading.
 */
export function normalizeDeg360(deg) {
  if (!isFiniteNumber(deg)) return NaN;
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Normalises to (-180, 180]. Preferred for pitch/roll and for angular
 * differences, where the sign carries meaning.
 */
export function normalizeDeg180(deg) {
  if (!isFiniteNumber(deg)) return NaN;
  const wrapped = normalizeDeg360(deg);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/** Smallest absolute angle between two headings, in degrees. */
export function angularDifferenceDeg(a, b) {
  const diff = normalizeDeg180(a - b);
  return Math.abs(diff);
}

/**
 * Display helper. `system` is "metric" or "imperial"; the numeric value is
 * always metres so callers never convert before formatting.
 */
export function formatLength(metres, system = "metric", fractionDigits = 2) {
  if (!isFiniteNumber(metres)) return "—";
  if (system === "imperial") {
    return `${metresToFeet(metres).toFixed(fractionDigits)} ft`;
  }
  return `${metres.toFixed(fractionDigits)} m`;
}
