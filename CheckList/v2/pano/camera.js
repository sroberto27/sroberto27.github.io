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

  /* Convert a lens FOV quoted across the LONG image axis into the FOV
     across the image WIDTH, for an image of the given dimensions.

     This exists because ASSUMED_H_FOV_DEG = 68 is a property of the lens,
     not of the file: it describes the long axis, which for a landscape
     frame IS the width. Phone cameras, however, return portrait stills
     (a real capture measured here was 3024x4032), and applying 68 deg
     across a portrait frame's 3024-pixel WIDTH claims a far wider lens
     than exists -- a 25% focal error, before any pose error at all.

     That error is radial and grows toward the frame edges, which is
     exactly where neighbouring shots overlap and where correspondences
     therefore live, so it poisoned the pose prior precisely where the
     prior was needed: on one real 34-shot capture the 9 deg prior gate
     rejected 80 of 97 candidate pairs and refinement had nothing left to
     solve with. Converting the quoted FOV onto the correct axis first
     predicts 53.67 deg for that capture, against 50.7-54.4 deg recovered
     independently by self-calibration from the photographs. */
  function widthFovFromLongFov(longFovRad, width, height) {
    const longSide = Math.max(width, height);
    const f = longSide / (2 * Math.tan(longFovRad / 2));
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

  /* How far a ray's direction can move, for a feature this many pixels
     from the principal point, purely because the focal length is not yet
     known exactly.

     This is the term that makes a FIXED angular prior gate the wrong
     shape. A wrong focal displaces rays RADIALLY: nothing at all at the
     image centre, growing steadily toward the corners. Measured on a real
     capture at a nominal 53.7 deg with the focal only known to lie in the
     45-95 deg search range, the induced shift is 0 deg at the centre but
     over 20 deg near the frame edge -- so a flat 9 deg gate is loose where
     it should be strict and far too strict where the overlapping frames
     actually share their features. It threw away all but a median of ONE
     match per pair on real data.

     Returning the spread as a function of radius lets the gate be shaped
     like the error it is meant to tolerate, and lets it tighten on its own
     once calibration has narrowed the focal range. */
  function focalSpreadRad(rPx, focal, focalLo, focalHi) {
    if (!(rPx > 0)) return 0;
    const at = (f) => Math.atan(rPx / f);
    const base = at(focal);
    return Math.max(Math.abs(at(focalLo) - base), Math.abs(at(focalHi) - base));
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

  /* The capture pattern, mirroring capture360.js buildTargetPattern().
     Used only by the offline test harnesses, which need the pattern
     without loading the whole capture UI module.

     MUST be kept in step with capture360.js. This copy silently went
     stale once (it stayed at the old 26-shot pattern after the capture
     side moved to 34), which made the offline evaluation report coverage
     for a pattern the app no longer used. lab/test/run-tests.js now
     asserts the two agree, so that can't happen again quietly. */
  function buildTargetPattern() {
    const t = [];
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: 0 });
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45 + 22.5, pitch: 33 });
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45 + 22.5, pitch: -33 });
    for (let i = 0; i < 4; i++) t.push({ yaw: i * 90, pitch: 66 });
    for (let i = 0; i < 4; i++) t.push({ yaw: i * 90, pitch: -66 });
    t.push({ yaw: 0, pitch: 90 });
    t.push({ yaw: 0, pitch: -90 });
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
    widthFovFromLongFov: widthFovFromLongFov,
    pixelToRay: pixelToRay,
    rayToPixel: rayToPixel,
    focalSpreadRad: focalSpreadRad,
    inFrame: inFrame,
    rayToEquirect: rayToEquirect,
    buildTargetPattern: buildTargetPattern,
    overlappingPairs: overlappingPairs
  };
})(typeof window !== 'undefined' ? window : globalThis);
