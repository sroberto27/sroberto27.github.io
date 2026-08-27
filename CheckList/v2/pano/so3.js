/* ===================== SO(3) / VECTOR MATH =====================
   Rotation utilities for the pose-refinement pipeline.

   Matrices are flat row-major arrays of 9 (R[0..2] is row 0). The
   capture and stitch code works in explicit right/up/forward basis
   vectors instead; `fromYawPitchRoll` below is the bridge and
   reproduces that basis EXACTLY (see basisForOrientation in
   capture360.js / pano-stitch-worker.js). If that convention ever
   changes, this function must change with it or refined poses will be
   silently wrong.

   Camera-to-world matrix R has columns [right, up, forward], so a
   camera-frame ray r maps to world as R*r.

   Loads under window (browser) or globalThis (node) so the same file
   backs both the lab page and the synthetic test suite.
*/
(function (global) {
  'use strict';

  function vec(x, y, z) { return { x: x, y: y, z: z }; }
  function add(a, b) { return vec(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return vec(a.x - b.x, a.y - b.y, a.z - b.z); }
  function scale(a, s) { return vec(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function normalize(a) {
    const n = norm(a) || 1;
    return vec(a.x / n, a.y / n, a.z / n);
  }

  const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  function mul(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return C;
  }

  function transpose(R) {
    return [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
  }

  function apply(R, v) {
    return vec(
      R[0] * v.x + R[1] * v.y + R[2] * v.z,
      R[3] * v.x + R[4] * v.y + R[5] * v.z,
      R[6] * v.x + R[7] * v.y + R[8] * v.z
    );
  }

  function column(R, i) { return vec(R[i], R[3 + i], R[6 + i]); }

  // Rodrigues. Small-angle branch keeps the Jacobian well behaved when
  // the optimiser takes tiny steps.
  function exp(w) {
    const th = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    if (th < 1e-10) {
      return [1, -w.z, w.y, w.z, 1, -w.x, -w.y, w.x, 1];
    }
    const kx = w.x / th, ky = w.y / th, kz = w.z / th;
    const c = Math.cos(th), s = Math.sin(th), v = 1 - c;
    return [
      c + kx * kx * v, kx * ky * v - kz * s, kx * kz * v + ky * s,
      ky * kx * v + kz * s, c + ky * ky * v, ky * kz * v - kx * s,
      kz * kx * v - ky * s, kz * ky * v + kx * s, c + kz * kz * v
    ];
  }

  function log(R) {
    let c = (R[0] + R[4] + R[8] - 1) / 2;
    c = Math.max(-1, Math.min(1, c));
    const theta = Math.acos(c);
    const wx = R[7] - R[5], wy = R[2] - R[6], wz = R[3] - R[1];

    if (theta < 1e-7) return vec(wx / 2, wy / 2, wz / 2);

    if (Math.PI - theta < 1e-6) {
      // Near pi the skew part vanishes; (R + I)/2 = n n^T instead.
      const d = [(R[0] + 1) / 2, (R[4] + 1) / 2, (R[8] + 1) / 2];
      let k = 0;
      if (d[1] > d[k]) k = 1;
      if (d[2] > d[k]) k = 2;
      const nk = Math.sqrt(Math.max(1e-18, d[k]));
      let n;
      if (k === 0) n = vec(nk, (R[1] + R[3]) / (4 * nk), (R[2] + R[6]) / (4 * nk));
      else if (k === 1) n = vec((R[1] + R[3]) / (4 * nk), nk, (R[5] + R[7]) / (4 * nk));
      else n = vec((R[2] + R[6]) / (4 * nk), (R[5] + R[7]) / (4 * nk), nk);
      n = normalize(n);
      if (n.x * wx + n.y * wy + n.z * wz < 0) n = scale(n, -1);
      return scale(n, theta);
    }

    const s = theta / (2 * Math.sin(theta));
    return vec(wx * s, wy * s, wz * s);
  }

  // Geodesic distance between two rotations, in radians.
  function angleBetween(A, B) {
    let c = 0;
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 3; k++) c += A[r * 3 + k] * B[r * 3 + k];
    }
    c = Math.max(-1, Math.min(1, (c - 1) / 2));
    return Math.acos(c);
  }

  function quatToMatrix(q) {
    const w = q.w, x = q.x, y = q.y, z = q.z;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
      2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
      2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)
    ];
  }

  /* Mirrors basisForOrientation() in the capture/stitch code exactly.

     The reference for roll is the world-up direction projected
     perpendicular to the view axis, and it is written out analytically
     rather than as a normalised cross product because the cross product
     vanishes at the pole and the guard that used to stand in for it was
     wrong.

     cross(forward, worldUp) = (cos(yaw)cos(pitch), -sin(yaw)cos(pitch), 0),
     so once normalised it is exactly (cos(yaw), -sin(yaw), 0) for every
     pitch in (-90, 90) -- the cos(pitch) factor divides straight out. The
     old code computed the cross product and, when |forward.z| > 0.999,
     substituted (1, 0, 0) instead. That threshold is |pitch| > 87.44 deg,
     which the capture pattern's zenith and nadir targets sit inside by
     design, and the substitution DISCARDS YAW: it turns the frame by
     whatever the yaw happened to be.

     Measured on a real capture, the nadir frame came back rotated 121 deg
     about its own view axis, because that shot was taken at pitch -89.6
     with yaw 121.4. The bug was invisible in every offline test because
     all four copies of this function shared it, so they agreed with each
     other; what they did not agree with is orientation.js, which measures
     roll against the projected world-up with no such guard. A device
     quaternion taken through quaternionToYawPitchRoll and back came out
     with its up axis 40 deg wrong at pitch 87.5 and right at 87.0. */
  function fromYawPitchRoll(yaw, pitch, roll) {
    const forward = vec(
      Math.sin(yaw) * Math.cos(pitch),
      Math.cos(yaw) * Math.cos(pitch),
      Math.sin(pitch)
    );
    const right0 = vec(Math.cos(yaw), -Math.sin(yaw), 0);
    const up0 = normalize(cross(right0, forward));
    const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    const right = normalize(sub(scale(right0, cr), scale(up0, sr)));
    const up = normalize(add(scale(up0, cr), scale(right0, sr)));
    return [
      right.x, up.x, forward.x,
      right.y, up.y, forward.y,
      right.z, up.z, forward.z
    ];
  }

  function toYawPitchRoll(R) {
    const forward = column(R, 2);
    const right = column(R, 0);
    const yaw = Math.atan2(forward.x, forward.y);
    const pitch = Math.asin(Math.max(-1, Math.min(1, forward.z)));
    // Same reference frame as fromYawPitchRoll, so the two stay an exact
    // inverse pair right up to the pole. See the note there.
    const right0 = vec(Math.cos(yaw), -Math.sin(yaw), 0);
    const up0 = normalize(cross(right0, forward));
    const roll = Math.atan2(-dot(right, up0), dot(right, right0));
    return { yaw: yaw, pitch: pitch, roll: roll };
  }

  global.LSCSO3 = {
    vec: vec, add: add, sub: sub, scale: scale, dot: dot, cross: cross,
    norm: norm, normalize: normalize,
    IDENTITY: IDENTITY, mul: mul, transpose: transpose, apply: apply, column: column,
    exp: exp, log: log, angleBetween: angleBetween, quatToMatrix: quatToMatrix,
    fromYawPitchRoll: fromYawPitchRoll, toYawPitchRoll: toYawPitchRoll
  };
})(typeof window !== 'undefined' ? window : globalThis);
