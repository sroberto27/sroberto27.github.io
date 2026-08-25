/* ===================== POSE REFINEMENT PIPELINE =====================
   Turns (26 photos + their recorded device orientation + correspondences
   between overlapping pairs) into (calibrated focal length + globally
   consistent refined rotations), ready to drop into the existing stitch
   worker in place of the raw sensor pose.

   Deliberately synchronous and free of any image or model dependency.
   Feature extraction and matching happen outside and hand their results
   in, so this whole file is testable against synthetic ground truth in
   node without a browser, a camera, or an ONNX runtime present. The
   matcher is swappable; the geometry is not.

   Order matters: focal length is calibrated BEFORE the bundle
   adjustment, because a wrong focal biases every relative rotation and
   the optimiser would faithfully converge on that bias.
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;
  const C = global.LSCCamera;
  const E = global.LSCEstimate;
  const CAL = global.LSCCalibrate;
  const B = global.LSCBundle;

  // Which view pairs should be matched, from the prior alone.
  function candidatePairs(priors, options) {
    const opts = options || {};
    const R = priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll || 0));
    return C.overlappingPairs(R, (opts.maxAxisAngleDeg || 60) * C.DEG);
  }

  function fitEdges(edgeInputs, priorR, W, H, focal, gateRad, ransacOpts) {
    const edges = [];
    const rejected = [];
    for (const ein of edgeInputs) {
      const matches = ein.matches || [];
      if (matches.length < 4) { rejected.push({ i: ein.i, j: ein.j, reason: 'too-few-matches' }); continue; }

      const { a, b } = CAL.raysFor(matches, W, H, focal);
      const corr = a.map((av, k) => ({ a: av, b: b[k], m: matches[k] }));

      // Prior gate first: cheap, and it removes the consistent false
      // matches that repeated indoor structure produces before RANSAC
      // ever gets a chance to build a consensus around them.
      const RrelPrior = S.mul(S.transpose(priorR[ein.j]), priorR[ein.i]);
      const gated = E.priorGate(corr, RrelPrior, gateRad);
      if (gated.length < 4) { rejected.push({ i: ein.i, j: ein.j, reason: 'prior-gate' }); continue; }

      const fit = E.ransacRotation(gated, ransacOpts);
      if (!fit) { rejected.push({ i: ein.i, j: ein.j, reason: 'ransac-failed' }); continue; }

      // Reject an edge whose result contradicts the prior wholesale --
      // almost always a degenerate or repeated-texture match set.
      const deviation = S.angleBetween(fit.R, RrelPrior);
      if (deviation > gateRad * 1.5) {
        rejected.push({ i: ein.i, j: ein.j, reason: 'contradicts-prior' });
        continue;
      }

      edges.push({
        i: ein.i,
        j: ein.j,
        R: fit.R,
        weight: fit.inlierCount,
        inlierCount: fit.inlierCount,
        inlierRatio: fit.inlierRatio,
        meanResidualRad: fit.meanResidualRad,
        matches: fit.inliers.map(c => c.m)
      });
    }
    return { edges: edges, rejected: rejected };
  }

  /**
   * input: {
   *   width, height,
   *   priors: [{ yaw, pitch, roll }],          // radians, as stored by capture360
   *   edges:  [{ i, j, matches: [{ax,ay,bx,by}] }]
   * }
   */
  function refinePoses(input, options) {
    const opts = options || {};
    const W = input.width, H = input.height;
    const priors = input.priors;
    const priorR = priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll || 0));

    const gateRad = (opts.priorGateDeg || 9) * C.DEG;
    const nominalFocal = C.focalFromHFov((opts.nominalHFovDeg || 68) * C.DEG, W);
    const ransacOpts = {
      thresholdRad: (opts.ransacPixelThreshold || 2.5) / nominalFocal,
      iterations: opts.ransacIterations || 300,
      minInliers: opts.minInliers || 8,
      seed: opts.seed || 12345
    };

    /* Focal length and inlier selection are mutually dependent: RANSAC
       decides which matches are inliers using the current focal, and the
       calibration then reads the focal off those inliers. Running that
       once is circular -- inliers chosen at the assumed 68 deg are
       biased toward matches that agree with 68 deg (and toward the image
       centre, where a wrong focal matters least), which drags the
       estimate back toward the assumption. So alternate the two to
       convergence instead. */
    const pass1 = fitEdges(input.edges, priorR, W, H, nominalFocal, gateRad, ransacOpts);
    if (!pass1.edges.length) {
      return { ok: false, reason: 'no-usable-edges', rejected: pass1.rejected };
    }

    const calOpts = {
      minHFovDeg: opts.minHFovDeg || 45,
      maxHFovDeg: opts.maxHFovDeg || 95
    };
    const pxThresh = opts.ransacPixelThreshold || 2.5;
    const rounds = opts.calibrationRounds || 3;

    let focal = nominalFocal;
    let fitted = pass1;
    let cal = null;
    for (let round = 0; round < rounds; round++) {
      cal = CAL.estimateFocal(fitted.edges, W, H, calOpts);
      const prevFocal = focal;
      focal = cal.focal;
      const nextFit = fitEdges(input.edges, priorR, W, H, focal, gateRad,
        Object.assign({}, ransacOpts, { thresholdRad: pxThresh / focal }));
      if (nextFit.edges.length) fitted = nextFit;
      if (Math.abs(focal - prevFocal) / focal < 1e-4) break;
    }
    const edges = fitted.edges;

    const baOpts = {
      priorWeightTilt: opts.priorWeightTilt,
      priorWeightYaw: opts.priorWeightYaw,
      maxIterations: opts.maxIterations
    };
    let ba = B.optimize(priorR, edges, baOpts);

    /* Graph-level robustness. A group of matches that is internally
       self-consistent but wrong -- the signature of repeated indoor
       structure matching to the wrong instance of a window or tile --
       survives per-edge RANSAC intact, because within that edge it IS
       the consensus. It only reveals itself as an edge that disagrees
       with the rest of the view graph. So down-weight edges by their
       residual and re-solve (IRLS with a Cauchy loss and a MAD-derived
       scale, so the threshold adapts to the capture rather than being a
       tuned constant). */
    const robustRounds = opts.robustRounds !== undefined ? opts.robustRounds : 3;
    let workingEdges = edges;
    for (let round = 0; round < robustRounds; round++) {
      const resid = edges.map(ed => {
        const pred = S.mul(S.transpose(ba.rotations[ed.j]), ba.rotations[ed.i]);
        return S.norm(S.log(S.mul(S.transpose(ed.R), pred)));
      });
      const sorted = resid.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 1e-6;
      const scale = Math.max(median * 1.5, 1e-4);

      workingEdges = edges.map((ed, k) => {
        const u = resid[k] / scale;
        return Object.assign({}, ed, { weight: ed.inlierCount / (1 + u * u) });
      });
      ba = B.optimize(priorR, workingEdges, baOpts);
    }

    const refined = ba.rotations.map(R => S.toYawPitchRoll(R));
    const corrections = ba.rotations.map((R, i) => S.angleBetween(R, priorR[i]));

    return {
      ok: true,
      focal: cal.focal,
      hFovDeg: cal.hFovDeg,
      calibration: cal,
      rotations: ba.rotations,
      poses: refined,
      priorRotations: priorR,
      edges: edges,
      rejected: fitted.rejected,
      bundle: {
        converged: ba.converged,
        iterations: ba.iterations,
        cost: ba.cost,
        rmsEdgeResidualRad: ba.rmsEdgeResidualRad
      },
      corrections: {
        meanDeg: corrections.reduce((s, v) => s + v, 0) / corrections.length * (180 / Math.PI),
        maxDeg: Math.max.apply(null, corrections) * (180 / Math.PI)
      }
    };
  }

  /* Loop-closure diagnostics for the three rings of the capture pattern.

     `measured` composes the independently-estimated pairwise rotations
     around each ring: it is the drift that accumulates when pairwise
     estimates are chained, which is what the current app effectively
     does by trusting per-shot sensor pose with no global solve.

     `refined` composes the absolute rotations after bundle adjustment
     and is ~0 by construction. That is not a result, it is a check that
     the solve produced a globally consistent set at all -- the useful
     reading is that the `measured` inconsistency has been absorbed
     rather than left to smear a seam somewhere. */
  function ringDiagnostics(rotations, edges) {
    const DEGS = 180 / Math.PI;

    /* Rings are DERIVED from each view's actual pitch, not read off
       hardcoded index ranges. The capture pattern has changed once
       already (26 -> 34 shots, and the ring pitches moved), and fixed
       indices would have kept "working" while silently reporting closure
       for the wrong set of views. Grouping by pitch stays correct through
       any future pattern change, and automatically picks up rings this
       function was never told about. */
    const byPitch = [];
    for (let i = 0; i < rotations.length; i++) {
      const p = S.toYawPitchRoll(rotations[i]).pitch * DEGS;
      let g = byPitch.find(x => Math.abs(x.pitch - p) < 12);
      if (!g) { g = { pitch: p, idx: [] }; byPitch.push(g); }
      g.idx.push({ i: i, yaw: S.toYawPitchRoll(rotations[i]).yaw });
    }

    function closure(group) {
      // Traverse the ring in yaw order; an index-order traversal would
      // measure a path that zig-zags around the ring rather than a loop.
      const cycle = group.idx.slice().sort((a, b) => a.yaw - b.yaw).map(x => x.i);
      if (cycle.length < 3) return { measured: null, refined: null };
      const measured = edges ? B.loopClosureFromEdges(edges, cycle) : null;
      return {
        measured: measured === null ? null : measured * DEGS,
        refined: B.loopClosureError(rotations, cycle) * DEGS,
        pitchDeg: group.pitch,
        shots: cycle.length
      };
    }

    const rings = byPitch
      .filter(g => g.idx.length >= 3)
      .sort((a, b) => a.pitch - b.pitch)
      .map(g => Object.assign({ pitchDeg: g.pitch }, closure(g)));

    const EMPTY = { measured: null, refined: null };
    const nearest = target => {
      let best = null, bestD = Infinity;
      for (const r of rings) {
        const d = Math.abs(r.pitchDeg - target);
        if (d < bestD) { bestD = d; best = r; }
      }
      return best || EMPTY;
    };

    // horizon/upper/lower are kept as named aliases because existing
    // callers (the refine worker, the lab page, the test suite) read them
    // by name; `all` exposes every ring the pattern actually has.
    const out = {
      horizon: nearest(0),
      upper: rings.filter(r => r.pitchDeg > 15)[0] || EMPTY,
      lower: rings.filter(r => r.pitchDeg < -15).slice(-1)[0] || EMPTY,
      all: rings
    };
    return out;
  }

  global.LSCPipeline = {
    candidatePairs: candidatePairs,
    refinePoses: refinePoses,
    ringDiagnostics: ringDiagnostics
  };
})(typeof window !== 'undefined' ? window : globalThis);
