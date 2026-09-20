/**
 * Scene geometry, and the thin layer that hands it to Three.js.
 *
 * The geometry is plain data: positions in local ENU metres, a camera basis
 * from heading and pitch, and the eight corners of a view frustum derived from
 * the lens. Only `buildThreeScene` touches the library, so every number that
 * appears in an exit gate is computed and tested without a renderer, and the
 * browser spike is left to prove that what renders matches what was computed.
 *
 * Conventions, fixed here because a silent disagreement about them is the most
 * expensive kind of bug in this workspace:
 *
 *  - Scene axes are ENU: +X east, +Y north, +Z up. Three.js is Y-up, so the
 *    bridge maps ENU (x, y, z) to Three (x, z, -y) at the boundary and nowhere
 *    else.
 *  - Heading is degrees clockwise from scene +Y, matching a compass bearing,
 *    so zero points at scene north. Pitch is positive upward.
 *  - Distances are metres. Focal lengths and gate dimensions are millimetres.
 */

import { degToRad } from "../spatial/units.js";
import { fieldOfView } from "../spatial/optics.js";

/**
 * Unit basis vectors for a camera, in ENU metres.
 *
 * @param {{headingDeg: number, pitchDeg?: number}} orientation
 * @returns {{forward: number[], right: number[], up: number[]}}
 */
export function cameraBasis({ headingDeg, pitchDeg = 0 }) {
  const heading = degToRad(headingDeg);
  const pitch = degToRad(pitchDeg);
  const cosPitch = Math.cos(pitch);

  // Heading is clockwise from north, so east is sin and north is cos.
  const forward = [
    Math.sin(heading) * cosPitch,
    Math.cos(heading) * cosPitch,
    Math.sin(pitch),
  ];
  // Right is 90 degrees clockwise from the heading, level with the ground.
  const right = [Math.cos(heading), -Math.sin(heading), 0];
  const up = cross(right, forward);

  return { forward, right, up };
}

/**
 * The eight corners of a view frustum in world ENU metres.
 *
 * Corners are ordered near then far, each as bottom-left, bottom-right,
 * top-right, top-left seen from behind the camera.
 *
 * @param {object} options
 * @param {number[]} options.position Camera position in scene metres.
 * @param {{headingDeg: number, pitchDeg?: number}} options.orientation
 * @param {{focalLengthMm: number, gateWidthMm: number, gateHeightMm: number, aspectRatio?: number}} options.lens
 * @param {number} [options.nearM]
 * @param {number} [options.farM]
 */
export function frustumCorners({ position, orientation, lens, nearM = 0.3, farM = 25 }) {
  if (!(farM > nearM)) throw new RangeError("the far plane must be beyond the near plane");

  const fov = fieldOfView(lens);
  const halfH = Math.tan(degToRad(fov.horizontalDeg) / 2);
  const halfV = Math.tan(degToRad(fov.verticalDeg) / 2);
  const { forward, right, up } = cameraBasis(orientation);

  const corners = [];
  for (const distance of [nearM, farM]) {
    const halfWidth = halfH * distance;
    const halfHeight = halfV * distance;
    const centre = add(position, scale(forward, distance));
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      corners.push(add(centre, add(scale(right, sx * halfWidth), scale(up, sy * halfHeight))));
    }
  }
  return { corners, fov, nearM, farM };
}

/**
 * Builds the Phase 0 spike scene: one camera, one actor, one frustum.
 *
 * Deliberately small. Its job is to prove that the transforms, heights, unit
 * handling and lens maths agree with the fixtures before any editing surface
 * is built on them.
 *
 * @param {object} options
 * @param {{position: number[], orientation: object, lens: object, mountHeightM?: number}} options.camera
 * @param {{position: number[], headingDeg?: number, heightM?: number}} options.actor
 * @param {{groundElevationM?: number, northOffsetDeg?: number}} [options.frame]
 */
export function buildSpikeScene({ camera, actor, frame = {} }) {
  const groundElevationM = frame.groundElevationM ?? 0;
  const northOffsetDeg = frame.northOffsetDeg ?? 0;

  const cameraPosition = [
    camera.position[0],
    camera.position[1],
    // A mount height is measured from the floor the camera stands on.
    (camera.position[2] ?? 0) + (camera.mountHeightM ?? 0),
  ];

  const frustum = frustumCorners({
    position: cameraPosition,
    orientation: camera.orientation,
    lens: camera.lens,
  });

  return {
    frame: { groundElevationM, northOffsetDeg, units: "metric", axes: "ENU, +X east, +Y north, +Z up" },
    camera: {
      position: cameraPosition,
      orientation: camera.orientation,
      basis: cameraBasis(camera.orientation),
      lens: camera.lens,
      fov: frustum.fov,
    },
    actor: {
      position: [actor.position[0], actor.position[1], actor.position[2] ?? 0],
      headingDeg: actor.headingDeg ?? 0,
      heightM: actor.heightM ?? 1.75,
    },
    frustum,
  };
}

/** Straight-line distance between two scene points, in metres. */
export function distanceM(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));
}

/**
 * Whether a point lies inside the frustum.
 *
 * Used by the spike to show the actor is genuinely framed rather than merely
 * drawn near a cone.
 */
export function isWithinFrustum(point, { position, orientation, lens, nearM = 0.3, farM = 25 }) {
  const { forward, right, up } = cameraBasis(orientation);
  const offset = [point[0] - position[0], point[1] - position[1], (point[2] ?? 0) - position[2]];

  const depth = dot(offset, forward);
  if (depth < nearM || depth > farM) return false;

  const fov = fieldOfView(lens);
  const halfWidth = Math.tan(degToRad(fov.horizontalDeg) / 2) * depth;
  const halfHeight = Math.tan(degToRad(fov.verticalDeg) / 2) * depth;

  return Math.abs(dot(offset, right)) <= halfWidth && Math.abs(dot(offset, up)) <= halfHeight;
}

/**
 * ENU metres to the Three.js Y-up frame. The only place the two frames mix.
 *
 * The `+ 0` keeps a negated zero from becoming `-0`, which compares unequal to
 * `0` under deep equality and reads as a sign nobody intended.
 */
export function enuToThree([x, y, z]) {
  return [x + 0, z + 0, -y + 0];
}

/**
 * Creates Three.js objects for a scene description.
 *
 * The only function here that needs the library, and it computes nothing: it
 * places what `buildSpikeScene` already decided. Kept separate so a rendering
 * problem can never be confused with a geometry problem.
 *
 * @param {object} scene Result of `buildSpikeScene`.
 * @param {object} THREE The Three.js module.
 */
export function buildThreeScene(scene, THREE) {
  const root = new THREE.Group();
  root.name = "slivr-spike";

  const cameraMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x7fb3d5 }),
  );
  cameraMarker.name = "camera";
  cameraMarker.position.set(...enuToThree(scene.camera.position));
  root.add(cameraMarker);

  const actorHeight = scene.actor.heightM;
  const actorMarker = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, Math.max(actorHeight - 0.44, 0.1), 4, 12),
    new THREE.MeshStandardMaterial({ color: 0xe0b978 }),
  );
  actorMarker.name = "actor";
  const actorCentre = [scene.actor.position[0], scene.actor.position[1], scene.actor.position[2] + actorHeight / 2];
  actorMarker.position.set(...enuToThree(actorCentre));
  root.add(actorMarker);

  // The frustum is drawn from the same corners the fixtures assert, so what is
  // on screen is the computed geometry rather than a second approximation.
  const positions = new Float32Array(scene.frustum.corners.flatMap((corner) => enuToThree(corner)));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7,
  ]);
  const frustumLines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x7fc8a9 }),
  );
  frustumLines.name = "frustum";
  root.add(frustumLines);

  return root;
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, k) {
  return [v[0] * k, v[1] * k, v[2] * k];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
