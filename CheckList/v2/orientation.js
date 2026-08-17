/* ===================== ORIENTATION MATH =====================
   Converts DeviceOrientationEvent (alpha/beta/gamma) readings into a
   panorama-local yaw/pitch/roll:
     - yaw is relative to wherever capture started (no magnetic-north
       dependency — see task spec, sensor accuracy varies too much).
     - pitch/roll are relative to gravity (the device orientation API
       derives beta/gamma partly from the accelerometer), so "pitch 0"
       really means level with the horizon regardless of where the user
       started.
   This file is loaded by both the guided-capture UI and (conceptually)
   documents the convention the stitch worker rebuilds from yaw/pitch/roll.
*/
(function (global) {
  'use strict';

  function degToRad(d) { return d * Math.PI / 180; }

  // Standard W3C device-orientation -> quaternion conversion (ZXY intrinsic
  // order matching alpha(Z), beta(X'), gamma(Y')).
  function eulerToQuaternion(alpha, beta, gamma) {
    const x = degToRad(beta) / 2, y = degToRad(gamma) / 2, z = degToRad(alpha) / 2;
    const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z);
    const sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    return {
      w: cX * cY * cZ - sX * sY * sZ,
      x: sX * cY * cZ - cX * sY * sZ,
      y: cX * sY * cZ + sX * cY * sZ,
      z: cX * cY * sZ + sX * sY * cZ
    };
  }

  // Compensates for the page being rotated relative to the device's
  // natural orientation (portrait vs landscape) — required so a landscape
  // capture doesn't read as tilted 90 degrees.
  function screenQuaternion(angleDeg) {
    const a = degToRad(angleDeg) / 2;
    return { w: Math.cos(a), x: 0, y: 0, z: -Math.sin(a) };
  }

  function quatMultiply(a, b) {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    };
  }

  function rotateVec(q, v) {
    // v' = q * v * q^-1, expanded for a unit quaternion
    const { w, x, y, z } = q;
    const ix = w * v.x + y * v.z - z * v.y;
    const iy = w * v.y + z * v.x - x * v.z;
    const iz = w * v.z + x * v.y - y * v.x;
    const iw = -x * v.x - y * v.y - z * v.z;
    return {
      x: ix * w + iw * -x + iy * -z - iz * -y,
      y: iy * w + iw * -y + iz * -x - ix * -z,
      z: iz * w + iw * -z + ix * -y - iy * -x
    };
  }

  function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }

  /**
   * Full reading -> world-frame quaternion, screen-orientation compensated.
   */
  function orientationToQuaternion(alpha, beta, gamma, screenAngle) {
    const q = eulerToQuaternion(alpha || 0, beta || 0, gamma || 0);
    return quatMultiply(q, screenQuaternion(screenAngle || 0));
  }

  const WORLD_UP = { x: 0, y: 0, z: 1 };

  /**
   * Extracts panorama-local yaw/pitch/roll (radians) from a world quaternion,
   * given the yaw (radians) recorded at capture start. Camera "forward" is
   * the device's -Z axis (out the back, opposite the screen).
   */
  function quaternionToYawPitchRoll(q, startYaw) {
    const forward = normalize(rotateVec(q, { x: 0, y: 0, z: -1 }));
    const upVec = normalize(rotateVec(q, { x: 0, y: 1, z: 0 }));

    const rawYaw = Math.atan2(forward.x, forward.y);
    const pitch = Math.asin(Math.max(-1, Math.min(1, forward.z)));

    let trueUpPerp = sub(WORLD_UP, scale(forward, dot(WORLD_UP, forward)));
    trueUpPerp = normalize(trueUpPerp);
    let roll = 0;
    if (isFinite(trueUpPerp.x) && (trueUpPerp.x || trueUpPerp.y || trueUpPerp.z)) {
      const crossV = cross(trueUpPerp, upVec);
      roll = Math.atan2(dot(crossV, forward), dot(trueUpPerp, upVec));
    }

    let yaw = rawYaw - (startYaw || 0);
    yaw = ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

    return { yaw, pitch, roll, rawYaw };
  }

  global.LSCOrientation = {
    orientationToQuaternion, quaternionToYawPitchRoll,
    normalize, dot, cross, sub, scale, rotateVec, degToRad
  };
})(typeof window !== 'undefined' ? window : self);
