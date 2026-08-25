/* ===================== ROTATION-ONLY BUNDLE ADJUSTMENT =====================
   Fuses two sources of information into one globally consistent set of
   camera rotations:

     - pairwise relative rotations measured from image correspondences
     - the per-view device-orientation prior recorded at capture time

   Cost (all residuals in the SO(3) tangent space):

     sum over edges  w_ij * | log( Rmeas_ij^T * R_j^T * R_i ) |^2
   + sum over views  | W_i * log( R_i * Rprior_i^T ) |^2

   Two design notes that matter:

   1. The prior term is expressed in the WORLD frame, so its three
      components separate cleanly into tilt (x, y) and yaw (z). Phone
      orientation error is strongly anisotropic -- pitch and roll are
      gravity-referenced and good to a fraction of a degree, while yaw
      depends on the magnetometer and drifts badly indoors near steel.
      Weighting those independently is the whole point; an isotropic
      prior throws away the most useful thing the sensor tells us.

   2. The prior term also fixes the gauge. Rotation averaging from
      relative measurements alone is only determined up to a global
      rotation; anchoring to the prior removes that freedom without an
      arbitrary "view 0 is identity" choice, which would dump all
      accumulated error onto whichever view happened to be first.

   Jacobians are numerical (central differences) with sparsity: a
   perturbation of view i touches only edges incident to i and prior i.
   Analytic Jacobians would be faster but are easy to get subtly wrong,
   and at 26 views this solves in milliseconds either way.
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;

  // Cholesky solve for a symmetric positive-definite dense system.
  // Returns null if the matrix is not SPD, so the caller can raise damping.
  function choleskySolve(A, b, n) {
    const L = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = A[i * n + j];
        for (let k = 0; k < j; k++) sum -= L[i * n + k] * L[j * n + k];
        if (i === j) {
          if (sum <= 1e-14) return null;
          L[i * n + j] = Math.sqrt(sum);
        } else {
          L[i * n + j] = sum / L[j * n + j];
        }
      }
    }
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let k = 0; k < i; k++) sum -= L[i * n + k] * y[k];
      y[i] = sum / L[i * n + i];
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let k = i + 1; k < n; k++) sum -= L[k * n + i] * x[k];
      x[i] = sum / L[i * n + i];
    }
    return x;
  }

  /**
   * priors  : array of N camera-to-world rotation matrices (flat 9)
   * edges   : [{ i, j, R, weight }] where R maps camera-i frame to camera-j
   * options : { priorWeightTilt, priorWeightYaw, maxIterations, tolerance }
   */
  function optimize(priors, edges, options) {
    const opts = options || {};
    const N = priors.length;
    // Defaults reflect the measured shape of phone orientation error:
    // tilt trusted far more than yaw. Section 3.7 of the research plan
    // replaces these with values fitted to real devices.
    const wTilt = opts.priorWeightTilt !== undefined ? opts.priorWeightTilt : 4.0;
    const wYaw = opts.priorWeightYaw !== undefined ? opts.priorWeightYaw : 0.25;
    const maxIter = opts.maxIterations || 60;
    const tol = opts.tolerance || 1e-10;

    const R = priors.map(m => m.slice());
    const nEdges = edges.length;
    const nRes = nEdges * 3 + N * 3;
    const nParam = N * 3;

    // Which residual blocks each view touches.
    const touched = [];
    for (let i = 0; i < N; i++) touched.push([]);
    for (let e = 0; e < nEdges; e++) {
      touched[edges[e].i].push(e);
      touched[edges[e].j].push(e);
    }

    function edgeResidual(e, Rlocal, out, base) {
      const ed = edges[e];
      const w = Math.sqrt(ed.weight !== undefined ? ed.weight : 1);
      const pred = S.mul(S.transpose(Rlocal[ed.j]), Rlocal[ed.i]);
      const err = S.log(S.mul(S.transpose(ed.R), pred));
      out[base] = w * err.x;
      out[base + 1] = w * err.y;
      out[base + 2] = w * err.z;
    }

    function priorResidual(i, Rlocal, out, base) {
      const err = S.log(S.mul(Rlocal[i], S.transpose(priors[i])));
      out[base] = wTilt * err.x;
      out[base + 1] = wTilt * err.y;
      out[base + 2] = wYaw * err.z;
    }

    function residuals(Rlocal) {
      const r = new Float64Array(nRes);
      for (let e = 0; e < nEdges; e++) edgeResidual(e, Rlocal, r, e * 3);
      for (let i = 0; i < N; i++) priorResidual(i, Rlocal, r, nEdges * 3 + i * 3);
      return r;
    }

    function cost(r) {
      let c = 0;
      for (let k = 0; k < r.length; k++) c += r[k] * r[k];
      return c;
    }

    function perturbed(Rlocal, view, axis, h) {
      const w = S.vec(axis === 0 ? h : 0, axis === 1 ? h : 0, axis === 2 ? h : 0);
      const copy = Rlocal.slice();
      copy[view] = S.mul(Rlocal[view], S.exp(w));
      return copy;
    }

    let r = residuals(R);
    let c = cost(r);
    let lambda = 1e-4;
    let iter = 0;
    let converged = false;

    const J = new Float64Array(nRes * nParam);
    const h = 1e-6;

    for (; iter < maxIter; iter++) {
      J.fill(0);

      // Sparse central-difference Jacobian.
      for (let v = 0; v < N; v++) {
        for (let axis = 0; axis < 3; axis++) {
          const col = v * 3 + axis;
          const Rp = perturbed(R, v, axis, h);
          const Rm = perturbed(R, v, axis, -h);
          const tmpP = new Float64Array(3);
          const tmpM = new Float64Array(3);

          for (const e of touched[v]) {
            edgeResidual(e, Rp, tmpP, 0);
            edgeResidual(e, Rm, tmpM, 0);
            for (let k = 0; k < 3; k++) {
              J[(e * 3 + k) * nParam + col] = (tmpP[k] - tmpM[k]) / (2 * h);
            }
          }
          priorResidual(v, Rp, tmpP, 0);
          priorResidual(v, Rm, tmpM, 0);
          for (let k = 0; k < 3; k++) {
            J[(nEdges * 3 + v * 3 + k) * nParam + col] = (tmpP[k] - tmpM[k]) / (2 * h);
          }
        }
      }

      // Normal equations.
      const H = new Float64Array(nParam * nParam);
      const g = new Float64Array(nParam);
      for (let row = 0; row < nRes; row++) {
        const off = row * nParam;
        for (let a = 0; a < nParam; a++) {
          const ja = J[off + a];
          if (ja === 0) continue;
          g[a] -= ja * r[row];
          for (let b = a; b < nParam; b++) {
            const jb = J[off + b];
            if (jb === 0) continue;
            H[a * nParam + b] += ja * jb;
          }
        }
      }
      for (let a = 0; a < nParam; a++) {
        for (let b = a + 1; b < nParam; b++) H[b * nParam + a] = H[a * nParam + b];
      }

      let applied = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const Hd = Float64Array.from(H);
        for (let a = 0; a < nParam; a++) {
          Hd[a * nParam + a] += lambda * (H[a * nParam + a] + 1e-9);
        }
        const delta = choleskySolve(Hd, g, nParam);
        if (!delta) { lambda *= 10; continue; }

        const Rtry = R.map((m, i) => S.mul(
          m, S.exp(S.vec(delta[i * 3], delta[i * 3 + 1], delta[i * 3 + 2]))
        ));
        const rTry = residuals(Rtry);
        const cTry = cost(rTry);

        if (cTry < c) {
          const improvement = c - cTry;
          for (let i = 0; i < N; i++) R[i] = Rtry[i];
          r = rTry;
          c = cTry;
          lambda = Math.max(lambda * 0.3, 1e-12);
          applied = true;
          if (improvement < tol) converged = true;
          break;
        }
        lambda *= 10;
      }

      if (!applied || converged) { converged = true; break; }
    }

    return {
      rotations: R,
      cost: c,
      iterations: iter + 1,
      converged: converged,
      rmsEdgeResidualRad: rmsEdge(R, edges)
    };
  }

  function rmsEdge(R, edges) {
    if (!edges.length) return 0;
    let sum = 0;
    for (const ed of edges) {
      const pred = S.mul(S.transpose(R[ed.j]), R[ed.i]);
      const e = S.log(S.mul(S.transpose(ed.R), pred));
      sum += e.x * e.x + e.y * e.y + e.z * e.z;
    }
    return Math.sqrt(sum / edges.length);
  }

  /* Composes a cycle of ABSOLUTE rotations. Relative rotations compose
     leftward: R_20 = R_21 * R_10, so the accumulator must be
     left-multiplied, not right-multiplied.

     This quantity is identically zero for any self-consistent set of
     absolute rotations -- poses cannot disagree with themselves, and the
     product telescopes to R_0^T R_0. It is therefore a SANITY CHECK on
     the composition, not a quality metric. Use loopClosureFromEdges for
     the number that actually carries information. */
  function loopClosureError(R, cycle) {
    let acc = S.IDENTITY;
    for (let k = 0; k < cycle.length; k++) {
      const i = cycle[k];
      const j = cycle[(k + 1) % cycle.length];
      acc = S.mul(S.mul(S.transpose(R[j]), R[i]), acc);
    }
    return S.norm(S.log(acc));
  }

  /* Composes the MEASURED relative rotations around a closed cycle and
     reports how far the product is from identity.

     This is the informative one. Each edge is estimated independently
     from image content, so nothing forces them to agree globally; going
     once around a ring and not arriving back where you started is
     accumulated drift, and it is exactly the multi-view/loop-closure
     consistency problem the deep-stitching literature names as open.
     Bundle adjustment then absorbs this inconsistency by construction --
     which is the point of solving for absolute poses rather than
     chaining pairwise estimates, as the current app effectively does.

     Returns null if the cycle is not fully covered by the edge set. */
  function loopClosureFromEdges(edges, cycle) {
    const map = new Map();
    for (const e of edges) {
      map.set(e.i + '>' + e.j, e.R);
      map.set(e.j + '>' + e.i, S.transpose(e.R));
    }
    let acc = S.IDENTITY;
    for (let k = 0; k < cycle.length; k++) {
      const i = cycle[k];
      const j = cycle[(k + 1) % cycle.length];
      const Rji = map.get(i + '>' + j);
      if (!Rji) return null;
      acc = S.mul(Rji, acc);
    }
    return S.norm(S.log(acc));
  }

  global.LSCBundle = {
    optimize: optimize,
    loopClosureError: loopClosureError,
    loopClosureFromEdges: loopClosureFromEdges,
    choleskySolve: choleskySolve
  };
})(typeof window !== 'undefined' ? window : globalThis);
