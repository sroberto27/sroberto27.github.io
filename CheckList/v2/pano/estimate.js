/* ===================== RELATIVE ROTATION ESTIMATION =====================
   Recovers the rotation between two views from point correspondences.

   Because the capture is (nominally) a pure rotation about one point,
   corresponding rays are related by rotation alone -- no homography
   decomposition, no translation, no depth. That reduces the problem to
   the Wahba problem, which has a closed-form solution. We use the
   Davenport q-method (largest eigenvector of a 4x4 symmetric matrix)
   rather than an SVD, since a correct 4x4 symmetric eigensolver is
   markedly easier to get right than a 3x3 SVD.

   Minimal sample for RANSAC is therefore 2 correspondences, not the 4 a
   homography would need -- a direct, measurable benefit of knowing the
   motion is rotational.
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;

  // Cyclic Jacobi eigen-decomposition for small symmetric matrices.
  // Returns { values, vectors } with vectors[k] the k-th eigenvector.
  function jacobiEigenSym(Ain, n) {
    const A = Ain.slice();
    const V = new Array(n * n).fill(0);
    for (let i = 0; i < n; i++) V[i * n + i] = 1;

    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) off += A[p * n + q] * A[p * n + q];
      }
      if (off < 1e-24) break;

      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = A[p * n + q];
          if (Math.abs(apq) < 1e-30) continue;
          const theta = (A[q * n + q] - A[p * n + p]) / (2 * apq);
          const sgn = theta >= 0 ? 1 : -1;
          const t = sgn / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1);
          const s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = A[k * n + p], akq = A[k * n + q];
            A[k * n + p] = c * akp - s * akq;
            A[k * n + q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = A[p * n + k], aqk = A[q * n + k];
            A[p * n + k] = c * apk - s * aqk;
            A[q * n + k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k * n + p], vkq = V[k * n + q];
            V[k * n + p] = c * vkp - s * vkq;
            V[k * n + q] = s * vkp + c * vkq;
          }
        }
      }
    }

    const values = [];
    const vectors = [];
    for (let i = 0; i < n; i++) {
      values.push(A[i * n + i]);
      const v = [];
      for (let k = 0; k < n; k++) v.push(V[k * n + i]);
      vectors.push(v);
    }
    return { values: values, vectors: vectors };
  }

  /* Wahba: find R minimising sum_k w_k * |b_k - R a_k|^2.
     `a` and `b` are arrays of unit vectors of equal length. */
  function solveRotation(a, b, weights) {
    const n = Math.min(a.length, b.length);
    if (n < 2) return null;

    const B = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < n; k++) {
      const w = weights ? weights[k] : 1;
      const bk = b[k], ak = a[k];
      B[0] += w * bk.x * ak.x; B[1] += w * bk.x * ak.y; B[2] += w * bk.x * ak.z;
      B[3] += w * bk.y * ak.x; B[4] += w * bk.y * ak.y; B[5] += w * bk.y * ak.z;
      B[6] += w * bk.z * ak.x; B[7] += w * bk.z * ak.y; B[8] += w * bk.z * ak.z;
    }

    const sigma = B[0] + B[4] + B[8];
    const Z = [B[5] - B[7], B[6] - B[2], B[1] - B[3]];
    const Sm = [
      2 * B[0], B[1] + B[3], B[2] + B[6],
      B[1] + B[3], 2 * B[4], B[5] + B[7],
      B[2] + B[6], B[5] + B[7], 2 * B[8]
    ];

    // K is 4x4 symmetric, scalar part first.
    const K = new Array(16).fill(0);
    K[0] = sigma;
    K[1] = Z[0]; K[2] = Z[1]; K[3] = Z[2];
    K[4] = Z[0]; K[8] = Z[1]; K[12] = Z[2];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        K[(r + 1) * 4 + (c + 1)] = Sm[r * 3 + c] - (r === c ? sigma : 0);
      }
    }

    const eig = jacobiEigenSym(K, 4);
    let best = 0;
    for (let i = 1; i < 4; i++) if (eig.values[i] > eig.values[best]) best = i;
    const v = eig.vectors[best];
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]) || 1;
    const Q = S.quatToMatrix({ w: v[0] / len, x: v[1] / len, y: v[2] / len, z: v[3] / len });

    // The q-method attitude matrix is expressed in the opposite direction
    // to the a -> b mapping this function promises, so transpose it. The
    // handedness here is convention-dependent and easy to get backwards;
    // test/run-tests.js pins it by recovering known rotations.
    return S.transpose(Q);
  }

  // Angle (radians) between R*a and b.
  function residualAngle(R, a, b) {
    const ra = S.apply(R, a);
    return Math.acos(Math.max(-1, Math.min(1, S.dot(ra, b))));
  }

  /* Rejects correspondences that disagree with the pose prior by more
     than the allowed deviation, which may be a constant or -- preferably --
     a function of the correspondence, so the threshold can be shaped like
     the error it tolerates (see focalSpreadRad in camera.js: focal
     uncertainty displaces rays radially, so the allowance has to grow with
     distance from the principal point). This filter is free -- the prior already
     exists -- and it is the main reason a cheap matcher suffices here:
     the geometrically self-consistent false matches that repeated indoor
     structure produces (identical windows, ceiling tiles) are exactly
     what a global search accepts and what this rejects. */
  function priorGate(corr, RrelPrior, maxDeviation) {
    const perItem = (typeof maxDeviation === 'function');
    const kept = [];
    for (let k = 0; k < corr.length; k++) {
      const c = corr[k];
      const lim = perItem ? maxDeviation(c) : maxDeviation;
      if (residualAngle(RrelPrior, c.a, c.b) <= lim) kept.push(c);
    }
    return kept;
  }

  /* RANSAC over the minimal 2-point sample. Deterministic by default:
     the LCG seed makes runs reproducible, which matters for a research
     baseline where a number has to be defensible twice. */
  function ransacRotation(corr, opts) {
    opts = opts || {};
    const thresh = opts.thresholdRad || (2.5 / 1450);
    const iters = opts.iterations || 300;
    const minInliers = opts.minInliers || 8;
    let seed = (opts.seed || 12345) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

    if (corr.length < 2) return null;

    let bestR = null, bestInliers = [];
    for (let it = 0; it < iters; it++) {
      const i1 = Math.floor(rnd() * corr.length);
      let i2 = Math.floor(rnd() * corr.length);
      if (i2 === i1) i2 = (i2 + 1) % corr.length;
      const c1 = corr[i1], c2 = corr[i2];
      if (Math.abs(S.dot(c1.a, c2.a)) > 0.9999) continue; // degenerate: parallel rays

      const R = solveRotation([c1.a, c2.a], [c1.b, c2.b]);
      if (!R) continue;

      const inl = [];
      for (let k = 0; k < corr.length; k++) {
        if (residualAngle(R, corr[k].a, corr[k].b) <= thresh) inl.push(corr[k]);
      }
      if (inl.length > bestInliers.length) { bestR = R; bestInliers = inl; }
      if (bestInliers.length > corr.length * 0.9 && bestInliers.length >= minInliers) break;
    }

    if (!bestR || bestInliers.length < Math.min(minInliers, corr.length)) return null;

    // Refit on the inlier set, then re-select once (local optimisation).
    let R = solveRotation(bestInliers.map(c => c.a), bestInliers.map(c => c.b));
    let inl = corr.filter(c => residualAngle(R, c.a, c.b) <= thresh);
    if (inl.length >= 2) {
      R = solveRotation(inl.map(c => c.a), inl.map(c => c.b)) || R;
    } else {
      inl = bestInliers;
    }

    let sum = 0;
    for (const c of inl) sum += residualAngle(R, c.a, c.b);
    return {
      R: R,
      inliers: inl,
      inlierCount: inl.length,
      inlierRatio: inl.length / corr.length,
      meanResidualRad: inl.length ? sum / inl.length : Infinity
    };
  }

  global.LSCEstimate = {
    jacobiEigenSym: jacobiEigenSym,
    solveRotation: solveRotation,
    residualAngle: residualAngle,
    priorGate: priorGate,
    ransacRotation: ransacRotation
  };
})(typeof window !== 'undefined' ? window : globalThis);
