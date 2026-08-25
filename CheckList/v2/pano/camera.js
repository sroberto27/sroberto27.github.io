/* ===================== CAMERA / PROJECTION =====================
   Pinhole and equirectangular projection using the SAME conventions as
   pano-stitch-worker.js, derived from its runStitch() scatter loop:

     nx = (px + 0.5)/W * 2 - 1        ny = 1 - (py + 0.5)/H * 2
     ray_cam = (nx*tanH, ny*tanV, 1)  tanV = tanH * (H/W)

   Substituting tanH = W/(2f) collapses both axes onto one square-pixel
   pinhole with the principal point at the image centre:

     x = (px + 0.5 - W/2) / f         y = (H/2 - py - 0.5) / f

   so the whole FOV question reduces to a single focal length in pixels.
   That is the quantity `calibrate.js` solves for, replacing the
   hardcoded ASSUMED_H_FOV_DEG = 68 in capture360.js.

   Camera axes: +x right, +y up, +z forward (out of the lens).
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;
  const DEG = Math.PI / 180;

  function focalFromHFov(hFovRad, width) {
    return width / (2 * Math.tan(hFovRad / 2));
  }

  function hFovFromFocal(f, width) {
    return 2 * Math.atan(width / (2 * f));
  }

  // Pixel centre -> unit ray in camera frame.
  function pixelToRay(px, py, W, H, f) {
    return S.normalize(S.vec((px + 0.5 - W / 2) / f, (H / 2 - py - 0.5) / f, 1));
  }

  // Camera-frame ray -> pixel. Returns null for rays behind the lens.
  function rayToPixel(r, W, H, f) {
    if (r.z <= 1e-9) return null;
    return {
      px: W / 2 + f * r.x / r.z - 0.5,
      py: H / 2 - f * r.y / r.z - 0.5
    };
  }

  function inFrame(p, W, H, margin) {
    const m = margin || 0;
    return !!p && p.px >= m && p.px <= W - 1 - m && p.py >= m && p.py <= H - 1 - m;
  }

  // Matches the equirect mapping in the stitch worker.
  function rayToEquirect(rWorld, W, H) {
    const yaw = Math.atan2(rWorld.x, rWorld.y);
    const pitch = Math.asin(Math.max(-1, Math.min(1, rWorld.z)));
    let u = (yaw / (2 * Math.PI) + 0.5) * W;
    u = ((u % W) + W) % W;
    return { u: u, v: (0.5 - pitch / Math.PI) * H };
  }

  // The 26-target pattern from capture360.js buildTargetPattern().
  function buildTargetPattern() {
    const t = [];
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: 0 });
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: 35 });
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: -35 });
    t.push({ yaw: 0, pitch: 80 });
    t.push({ yaw: 0, pitch: -80 });
    return t.map(x => ({ yaw: x.yaw * DEG, pitch: x.pitch * DEG }));
  }

  /* Which view pairs are worth matching. Driven by the pose prior, which
     is what makes this cheap: we never search globally, only among views
     the sensor already says point in similar directions. Threshold is on
     the angle between optical axes. */
  function overlappingPairs(rotations, maxAxisAngleRad) {
    const lim = maxAxisAngleRad || (60 * DEG);
    const fwd = rotations.map(R => S.column(R, 2));
    const pairs = [];
    for (let i = 0; i < rotations.length; i++) {
      for (let j = i + 1; j < rotations.length; j++) {
        const c = Math.max(-1, Math.min(1, S.dot(fwd[i], fwd[j])));
        const ang = Math.acos(c);
        if (ang <= lim) pairs.push({ i: i, j: j, axisAngle: ang });
      }
    }
    return pairs;
  }

  global.LSCCamera = {
    DEG: DEG,
    focalFromHFov: focalFromHFov,
    hFovFromFocal: hFovFromFocal,
    pixelToRay: pixelToRay,
    rayToPixel: rayToPixel,
    inFrame: inFrame,
    rayToEquirect: rayToEquirect,
    buildTargetPattern: buildTargetPattern,
    overlappingPairs: overlappingPairs
  };
})(typeof window !== 'undefined' ? window : globalThis);
