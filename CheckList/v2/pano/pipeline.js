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

  /* The prior gate's threshold is deliberately NOT a single angle.

     Pose uncertainty is roughly uniform across the frame, but focal
     uncertainty is radial: it displaces a ray by nothing at the principal
     point and by tens of degrees near the corners (camera.js
     focalSpreadRad). Since the focal is exactly what this pipeline is
     still solving for, a flat gate is mis-shaped -- and mis-shaped in the
     worst possible direction, because overlapping frames share their
     features at the FRAME EDGES, where a flat gate is tightest relative
     to the true error. On a real 34-shot capture a flat 9 deg gate left a
     median of one surviving match per pair and rejected 38 of 81 pairs
     outright.

     So the allowance is pose-uncertainty PLUS whatever the current focal
     ignorance can account for at that match's radius. It narrows on its
     own as calibration narrows [focalLo, focalHi]. */
  function makeGate(baseRad, W, H, focal, focalLo, focalHi) {
    const cx = W / 2, cy = H / 2;
    return function (c) {
      const m = c.m;
      const r = Math.max(
        Math.hypot(m.ax - cx, m.ay - cy),
        Math.hypot(m.bx - cx, m.by - cy));
      return baseRad + C.focalSpreadRad(r, focal, focalLo, focalHi);
    };
  }

  function fitEdges(edgeInputs, priorR, W, H, focal, gateRad, ransacOpts, focalRange) {
    const edges = [];
    const rejected = [];
    const lo = focalRange ? focalRange.lo : focal;
    const hi = focalRange ? focalRange.hi : focal;
    const gateFn = makeGate(gateRad, W, H, focal, lo, hi);
    for (const ein of edgeInputs) {
      const matches = ein.matches || [];
      if (matches.length < 4) { rejected.push({ i: ein.i, j: ein.j, reason: 'too-few-matches' }); continue; }

      const { a, b } = CAL.raysFor(matches, W, H, focal);
      const corr = a.map((av, k) => ({ a: av, b: b[k], m: matches[k] }));

      // Prior gate first: cheap, and it removes the consistent false
      // matches that repeated indoor structure produces before RANSAC
      // ever gets a chance to build a consensus around them.
      const RrelPrior = S.mul(S.transpose(priorR[ein.j]), priorR[ein.i]);
      const gated = E.priorGate(corr, RrelPrior, gateFn);
      if (gated.length < 4) { rejected.push({ i: ein.i, j: ein.j, reason: 'prior-gate' }); continue; }

      const fit = E.ransacRotation(gated, ransacOpts);
      if (!fit) { rejected.push({ i: ein.i, j: ein.j, reason: 'ransac-failed' }); continue; }

      // Reject an edge whose result contradicts the prior wholesale --
      // almost always a degenerate or repeated-texture match set.
      // Whole-edge sanity: compare the SOLVED rotation to the prior. This
      // is a pose-vs-pose comparison, so it uses the base angle only --
      // the radial term above is about individual feature positions.
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
    /* The first pass runs at the ASSUMED focal, because the real one is
       what we are about to solve for. A wrong focal displaces rays
       radially, worst at the frame edges -- which is exactly where
       neighbouring shots overlap and where the correspondences are. So
       the tight prior gate, correct once the focal is known, is far too
       tight to bootstrap with: on a real capture whose assumed focal was
       25% off it rejected 80 of 97 candidate pairs and left nothing to
       calibrate from.

       Pass 1 therefore gates generously, purely to admit enough geometry
       to estimate the focal. Every later pass re-gates at `gateRad`
       against the calibrated focal, so the final edge set is selected
       just as strictly as before -- the widening is a bootstrap, not a
       loosening of the result. */
    const bootstrapGateRad = Math.max(gateRad, (opts.bootstrapGateDeg || 25) * C.DEG);
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
    const calOpts = {
      minHFovDeg: opts.minHFovDeg || 45,
      maxHFovDeg: opts.maxHFovDeg || 95
    };
    /* Before calibration the focal is only known to lie somewhere in the
       search window, so the gate has to tolerate the full radial spread
       that window implies. */
    const searchRange = {
      lo: C.focalFromHFov(calOpts.maxHFovDeg * C.DEG, W),   // widest FOV -> shortest focal
      hi: C.focalFromHFov(calOpts.minHFovDeg * C.DEG, W)
    };
    const pass1 = fitEdges(input.edges, priorR, W, H, nominalFocal, bootstrapGateRad,
      Object.assign({}, ransacOpts, {
        // The pixel threshold is meaningful, but it is divided by a focal
        // we do not trust yet; loosen it in proportion for this pass only.
        thresholdRad: (opts.ransacPixelThreshold || 2.5) * 2 / nominalFocal
      }), searchRange);
    if (!pass1.edges.length) {
      return { ok: false, reason: 'no-usable-edges', rejected: pass1.rejected };
    }

    const pxThresh = opts.ransacPixelThreshold || 2.5;
    /* Once calibration has produced a focal, the remaining uncertainty is
       its own error, not the width of the search window. Allow a modest
       band around it so the gate stays shaped correctly while still
       tightening by roughly an order of magnitude. */
    const refinedBand = opts.focalBand !== undefined ? opts.focalBand : 0.12;
    const rounds = opts.calibrationRounds || 3;

    let focal = nominalFocal;
    let fitted = pass1;
    let cal = null;
    for (let round = 0; round < rounds; round++) {
      cal = CAL.estimateFocal(fitted.edges, W, H, calOpts);
      const prevFocal = focal;
      focal = cal.focal;
      const nextFit = fitEdges(input.edges, priorR, W, H, focal, gateRad,
        Object.assign({}, ransacOpts, { thresholdRad: pxThresh / focal }),
        { lo: focal * (1 - refinedBand), hi: focal * (1 + refinedBand) });
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

    /* Shots that ended up with no surviving edge are not solved for at
       all -- the bundle leaves them exactly at their sensor prior. That is
       safe in isolation but wrong in context: their NEIGHBOURS just moved
       by several degrees, so an unconstrained shot is left behind and
       becomes a visible seam against frames it used to line up with.

       Sensor error here is dominated by slow yaw drift, which is shared
       between shots taken close together, so the correction its
       neighbours needed is the best available estimate of the correction
       it needs too. Carry it across: take the world-frame correction
       D = R_solved * R_prior^T from the nearest connected shots, average
       in the Lie algebra weighted by angular proximity, and apply that to
       the orphan's prior. Shots that were solved for are untouched. */
    const nShots = priorR.length;
    const degree = new Array(nShots).fill(0);
    for (const ed of workingEdges) { degree[ed.i]++; degree[ed.j]++; }
    const connected = [];
    for (let i = 0; i < nShots; i++) if (degree[i] > 0) connected.push(i);

    let carried = 0;
    if (connected.length >= 2) {
      const fwd = priorR.map(R => S.column(R, 2));
      for (let u = 0; u < nShots; u++) {
        if (degree[u] > 0) continue;
        const near = connected
          .map(v => ({
            v: v,
            ang: Math.acos(Math.max(-1, Math.min(1, S.dot(fwd[u], fwd[v]))))
          }))
          .sort((x, y) => x.ang - y.ang)
          .slice(0, 3);
        let acc = S.vec(0, 0, 0), wsum = 0;
        for (const nb of near) {
          const D = S.mul(ba.rotations[nb.v], S.transpose(priorR[nb.v]));
          const w = 1 / (nb.ang + 1e-3);
          acc = S.add(acc, S.scale(S.log(D), w));
          wsum += w;
        }
        if (wsum > 0) {
          ba.rotations[u] = S.mul(S.exp(S.scale(acc, 1 / wsum)), priorR[u]);
          carried++;
        }
      }
    }

    const refined = ba.rotations.map(R => S.toYawPitchRoll(R));
    const corrections = ba.rotations.map((R, i) => S.angleBetween(R, priorR[i]));

    return {
      ok: true,
      unconstrainedShots: nShots - connected.length,
      carriedShots: carried,
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
