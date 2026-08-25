/* ===================== SYNTHETIC CAPTURE GENERATOR =====================
   Builds a fake 26-shot spherical capture with exactly known ground
   truth, so the geometry pipeline can be validated without a camera, a
   feature matcher, or a browser.

   What it models, and why each part is there:

   - True poses are the app's 26-target pattern plus a random miss of up
     to ALIGN_TOLERANCE_DEG, because capture360.js fires the shutter as
     soon as the sensor is within 5 deg of target. The user never lands
     exactly on the target and the pipeline must not assume they did.

   - The prior is the true pose corrupted by ANISOTROPIC error: small on
     tilt (gravity-referenced) and large on yaw, plus a yaw drift that
     accumulates with shot order. That drift is the realistic failure --
     it is what makes the last shot of a ring disagree with the first,
     and it is precisely what loop closure has to absorb.

   - True focal length deliberately differs from the 68 deg the app
     assumes, so a pipeline that silently trusts the constant fails the
     test instead of passing it by luck.

   - Outliers come in two flavours: random mismatches, and CONSISTENT
     mismatches offset by a fixed shift. The second kind simulates
     repeated indoor structure (identical windows, ceiling tiles) and is
     the dangerous one, because a plain RANSAC can build a consensus
     around it. The prior gate is what should catch those.
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;
  const C = global.LSCCamera;
  const DEG = Math.PI / 180;

  // Deterministic PRNG so a failing test fails the same way twice.
  function makeRng(seed) {
    let s = (seed || 1) >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function generate(options) {
    const opts = options || {};
    const rnd = makeRng(opts.seed || 42);

    const W = opts.width || 1920;
    const H = opts.height || 1080;
    const trueHFovDeg = opts.trueHFovDeg !== undefined ? opts.trueHFovDeg : 73.5;
    const focal = C.focalFromHFov(trueHFovDeg * DEG, W);

    const aimErrorDeg = opts.aimErrorDeg !== undefined ? opts.aimErrorDeg : 4.0;
    const yawNoiseDeg = opts.yawNoiseDeg !== undefined ? opts.yawNoiseDeg : 2.5;
    const yawDriftDeg = opts.yawDriftDeg !== undefined ? opts.yawDriftDeg : 6.0;
    const tiltNoiseDeg = opts.tiltNoiseDeg !== undefined ? opts.tiltNoiseDeg : 0.35;
    const pixelNoise = opts.pixelNoise !== undefined ? opts.pixelNoise : 0.7;
    const outlierRate = opts.outlierRate !== undefined ? opts.outlierRate : 0.25;
    const consistentOutlierRate = opts.consistentOutlierRate !== undefined
      ? opts.consistentOutlierRate : 0.15;
    const nPoints = opts.points || 6000;

    // ---- true poses: pattern + aiming error ----
    const pattern = C.buildTargetPattern();
    const truePoses = pattern.map(t => ({
      yaw: t.yaw + gauss(rnd) * aimErrorDeg * DEG,
      pitch: t.pitch + gauss(rnd) * aimErrorDeg * DEG,
      roll: gauss(rnd) * 3 * DEG
    }));
    const trueR = truePoses.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));

    // ---- priors: anisotropic sensor error + accumulating yaw drift ----
    const priors = truePoses.map((p, i) => {
      const drift = (i / (truePoses.length - 1)) * yawDriftDeg * DEG;
      return {
        yaw: p.yaw + drift + gauss(rnd) * yawNoiseDeg * DEG,
        pitch: p.pitch + gauss(rnd) * tiltNoiseDeg * DEG,
        roll: p.roll + gauss(rnd) * tiltNoiseDeg * DEG
      };
    });

    // ---- world points ----
    const points = [];
    for (let k = 0; k < nPoints; k++) {
      const z = rnd() * 2 - 1;
      const th = rnd() * 2 * Math.PI;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      points.push(S.vec(r * Math.cos(th), r * Math.sin(th), z));
    }

    // ---- visibility ----
    const margin = 12;
    const visible = trueR.map(R => {
      const Rt = S.transpose(R);
      const seen = new Map();
      for (let k = 0; k < points.length; k++) {
        const cam = S.apply(Rt, points[k]);
        const px = C.rayToPixel(cam, W, H, focal);
        if (C.inFrame(px, W, H, margin)) seen.set(k, px);
      }
      return seen;
    });

    // ---- correspondences for every genuinely overlapping pair ----
    const pairs = C.overlappingPairs(trueR, 60 * DEG);
    const edges = [];
    for (const pr of pairs) {
      const vi = visible[pr.i], vj = visible[pr.j];
      const matches = [];
      vi.forEach((pxi, k) => {
        const pxj = vj.get(k);
        if (!pxj) return;
        let bx = pxj.px + gauss(rnd) * pixelNoise;
        let by = pxj.py + gauss(rnd) * pixelNoise;

        const u = rnd();
        if (u < outlierRate * 0.5) {
          // random mismatch
          bx = rnd() * (W - 1);
          by = rnd() * (H - 1);
        } else if (u < outlierRate * 0.5 + consistentOutlierRate) {
          // repeated-structure mismatch: a fixed shift shared by a whole
          // group of matches, so it is internally self-consistent
          bx = pxj.px + 46;
          by = pxj.py - 31;
        }
        matches.push({
          ax: pxi.px + gauss(rnd) * pixelNoise,
          ay: pxi.py + gauss(rnd) * pixelNoise,
          bx: bx, by: by
        });
      });
      if (matches.length >= 6) edges.push({ i: pr.i, j: pr.j, matches: matches });
    }

    return {
      width: W, height: H,
      trueHFovDeg: trueHFovDeg, trueFocal: focal,
      truePoses: truePoses, trueRotations: trueR,
      priors: priors,
      edges: edges
    };
  }

  /* Mean/max geodesic error between two rotation sets, AFTER removing the
     global gauge freedom. A panorama is unchanged by rotating every view
     together, so comparing absolute rotations without this alignment
     measures an unobservable quantity and reports nonsense. */
  function poseError(estimated, truth) {
    const n = Math.min(estimated.length, truth.length);
    if (!n) return { meanDeg: 0, maxDeg: 0 };

    // Gauge = the rotation best aligning estimate to truth, found by
    // averaging the per-view discrepancies in the tangent space.
    let acc = S.vec(0, 0, 0);
    for (let i = 0; i < n; i++) {
      const d = S.log(S.mul(truth[i], S.transpose(estimated[i])));
      acc = S.add(acc, d);
    }
    let G = S.exp(S.scale(acc, 1 / n));
    for (let iter = 0; iter < 12; iter++) {
      let a = S.vec(0, 0, 0);
      for (let i = 0; i < n; i++) {
        a = S.add(a, S.log(S.mul(truth[i], S.transpose(S.mul(G, estimated[i])))));
      }
      a = S.scale(a, 1 / n);
      G = S.mul(S.exp(a), G);
      if (S.norm(a) < 1e-12) break;
    }

    let sum = 0, max = 0;
    for (let i = 0; i < n; i++) {
      const e = S.angleBetween(S.mul(G, estimated[i]), truth[i]);
      sum += e;
      if (e > max) max = e;
    }
    return { meanDeg: (sum / n) * (180 / Math.PI), maxDeg: max * (180 / Math.PI) };
  }

  global.LSCSynth = { generate: generate, poseError: poseError, makeRng: makeRng, gauss: gauss };
})(typeof window !== 'undefined' ? window : globalThis);
