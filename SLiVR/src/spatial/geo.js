/**
 * WGS84 geographic helpers.
 *
 * Distances produced here are straight-line ground distances. They are never
 * travel distance or travel time: no routing, road network or access
 * restriction is considered, and the UI must label them accordingly.
 *
 * Coordinates are [longitude, latitude] in decimal degrees, matching GeoJSON.
 */

import { degToRad, radToDeg, isFiniteNumber, normalizeDeg360 } from "./units.js";

const FLATTENING = 1 / 298.257223563;

/** WGS84 ellipsoid constants. */
export const WGS84 = Object.freeze({
  semiMajorAxisM: 6378137.0,
  flattening: FLATTENING,
  eccentricitySquared: 2 * FLATTENING - FLATTENING * FLATTENING,
  meanRadiusM: 6371008.8,
});

export function isLonLat(position) {
  return (
    Array.isArray(position) &&
    position.length >= 2 &&
    isFiniteNumber(position[0]) &&
    isFiniteNumber(position[1]) &&
    position[0] >= -180 &&
    position[0] <= 180 &&
    position[1] >= -90 &&
    position[1] <= 90
  );
}

/**
 * Great-circle distance in metres using a spherical mean radius.
 *
 * This differs from the ellipsoidal tangent plane in frames.js by roughly 0.3%
 * at Lafayette latitudes. That is deliberate: this function serves
 * discovery-scale proximity, while a scene frame needs the local radii of
 * curvature. Do not reconcile one to the other.
 */
export function distanceM(a, b) {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const phi1 = degToRad(lat1);
  const phi2 = degToRad(lat2);
  const dPhi = degToRad(lat2 - lat1);
  const dLambda = degToRad(lon2 - lon1);
  const h =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return 2 * WGS84.meanRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a to b, in degrees clockwise from north. */
export function bearingDeg(a, b) {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const phi1 = degToRad(lat1);
  const phi2 = degToRad(lat2);
  const dLambda = degToRad(lon2 - lon1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return normalizeDeg360(radToDeg(Math.atan2(y, x)));
}

/** Local radii of curvature at a latitude, used by the tangent-plane frame. */
export function radiiOfCurvatureM(latDeg) {
  const phi = degToRad(latDeg);
  const e2 = WGS84.eccentricitySquared;
  const sinPhi = Math.sin(phi);
  const denom = 1 - e2 * sinPhi * sinPhi;
  return {
    meridionalM: (WGS84.semiMajorAxisM * (1 - e2)) / Math.pow(denom, 1.5),
    primeVerticalM: WGS84.semiMajorAxisM / Math.sqrt(denom),
  };
}

/** Axis-aligned envelope test for region and catalog validation. */
export function withinBounds(position, bounds) {
  if (!isLonLat(position)) return false;
  const [lon, lat] = position;
  return (
    lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north
  );
}

/**
 * Web Mercator (EPSG:3857) limits.
 *
 * The projection is defined on a sphere of this radius, not on the WGS84
 * ellipsoid, and it cannot represent the poles at all. Imagery services speak
 * this projection, so the conversion lives here rather than in the map layer.
 */
export const WEB_MERCATOR = Object.freeze({
  radiusM: 6378137.0,
  maxLatitudeDeg: 85.05112878,
});

/** Projects [longitude, latitude] to EPSG:3857 metres. */
export function toWebMercator(position) {
  if (!isLonLat(position)) throw new RangeError("position must be [longitude, latitude]");
  const [lon, lat] = position;
  const clampedLat = Math.min(
    WEB_MERCATOR.maxLatitudeDeg,
    Math.max(-WEB_MERCATOR.maxLatitudeDeg, lat),
  );
  return [
    degToRad(lon) * WEB_MERCATOR.radiusM,
    Math.log(Math.tan(Math.PI / 4 + degToRad(clampedLat) / 2)) * WEB_MERCATOR.radiusM,
  ];
}

/** Inverse of `toWebMercator`. */
export function fromWebMercator([x, y]) {
  return [
    radToDeg(x / WEB_MERCATOR.radiusM),
    radToDeg(2 * Math.atan(Math.exp(y / WEB_MERCATOR.radiusM)) - Math.PI / 2),
  ];
}

/**
 * Ground metres per pixel at a latitude, for a Web Mercator tile pyramid.
 * Used to request a probe image at the source resolution rather than at an
 * arbitrary scale that would hide or invent detail.
 */
export function metresPerPixel(latDeg, zoom, tileSize = 256) {
  const circumference = 2 * Math.PI * WEB_MERCATOR.radiusM;
  return (circumference * Math.cos(degToRad(latDeg))) / (tileSize * 2 ** zoom);
}
