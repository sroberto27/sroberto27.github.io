/**
 * Local scene coordinate frames.
 *
 * A shot scene works in local east/north/up metres about a declared origin.
 * `northOffsetDeg` is the compass bearing of the scene +Y axis, so 0 means +Y
 * is true north and +X is east.
 *
 * The geographic conversion is a tangent-plane approximation using the local
 * radii of curvature. It is intended for scene-sized extents: error grows with
 * the square of the distance from the origin, so it must not be used for
 * region-wide geometry. Conversions beyond FRAME_VALIDITY_RADIUS_M are flagged
 * rather than silently returned.
 *
 * Heights are separated deliberately. groundElevationM is the frame ground
 * datum, an object z is height above that ground, and a camera mount height is
 * measured above its own floor rather than above ground.
 */

import { degToRad, isFiniteNumber, normalizeDeg360 } from "./units.js";
import { radiiOfCurvatureM, isLonLat } from "./geo.js";

/** Distance from the origin beyond which the tangent-plane error is unbounded. */
export const FRAME_VALIDITY_RADIUS_M = 2000;

/**
 * @typedef {object} SceneFrame
 * @property {number} lon Origin longitude, decimal degrees.
 * @property {number} lat Origin latitude, decimal degrees.
 * @property {number} groundElevationM Ground datum at the origin.
 * @property {string} elevationDatum Named datum, recorded so a later survey can be compared.
 * @property {number} northOffsetDeg Bearing of the scene +Y axis.
 * @property {number} version Incremented whenever calibration changes.
 */

export function createFrame({
  lon,
  lat,
  groundElevationM = 0,
  elevationDatum = "unknown",
  northOffsetDeg = 0,
  version = 1,
} = {}) {
  if (!isLonLat([lon, lat])) {
    throw new RangeError("scene frame origin must be a valid [lon, lat] position");
  }
  if (!isFiniteNumber(groundElevationM)) {
    throw new RangeError("groundElevationM must be a finite number");
  }
  if (!isFiniteNumber(northOffsetDeg)) {
    throw new RangeError("northOffsetDeg must be a finite number");
  }
  return Object.freeze({
    lon,
    lat,
    groundElevationM,
    elevationDatum,
    northOffsetDeg: normalizeDeg360(northOffsetDeg),
    version,
  });
}

function rotationOf(frame) {
  const theta = degToRad(frame.northOffsetDeg);
  return { sin: Math.sin(theta), cos: Math.cos(theta) };
}

/**
 * Geographic position to scene metres.
 * @returns {{x: number, y: number, z: number, beyondValidityRadius: boolean}}
 */
export function geoToLocal(frame, position, elevationM = frame.groundElevationM) {
  if (!isLonLat(position)) {
    throw new RangeError("position must be a valid [lon, lat]");
  }
  const [lon, lat] = position;
  const { meridionalM, primeVerticalM } = radiiOfCurvatureM(frame.lat);
  const east = degToRad(lon - frame.lon) * primeVerticalM * Math.cos(degToRad(frame.lat));
  const north = degToRad(lat - frame.lat) * meridionalM;

  const { sin, cos } = rotationOf(frame);
  return {
    x: east * cos - north * sin,
    y: east * sin + north * cos,
    z: elevationM - frame.groundElevationM,
    beyondValidityRadius: Math.hypot(east, north) > FRAME_VALIDITY_RADIUS_M,
  };
}

/** Scene metres back to a geographic position and absolute elevation. */
export function localToGeo(frame, { x, y, z = 0 }) {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    throw new RangeError("local coordinates must be finite numbers");
  }
  const { sin, cos } = rotationOf(frame);
  const east = x * cos + y * sin;
  const north = -x * sin + y * cos;

  const { meridionalM, primeVerticalM } = radiiOfCurvatureM(frame.lat);
  const lat = frame.lat + (north / meridionalM) * (180 / Math.PI);
  const lon =
    frame.lon + (east / (primeVerticalM * Math.cos(degToRad(frame.lat)))) * (180 / Math.PI);

  return {
    position: [lon, lat],
    elevationM: frame.groundElevationM + (isFiniteNumber(z) ? z : 0),
  };
}

/**
 * Height of an object above the frame ground, given the floor it stands on.
 * Kept explicit so a camera on an upper floor is never confused with a camera
 * on a high tripod.
 */
export function heightAboveGroundM({ floorElevationM = 0, heightAboveFloorM = 0 }) {
  if (!isFiniteNumber(floorElevationM) || !isFiniteNumber(heightAboveFloorM)) {
    throw new RangeError("floor elevation and height must be finite numbers");
  }
  return floorElevationM + heightAboveFloorM;
}
