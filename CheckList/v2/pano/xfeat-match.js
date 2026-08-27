/* ===================== DESCRIPTOR MATCHING =====================
   Mutual-nearest-neighbour matching over L2-normalised 64-d XFeat
   descriptors, with an optional geometric gate driven by the pose prior.

   Why the gate matters. Exhaustive MNN between two 2048-keypoint sets is
   2048 x 2048 x 64 multiply-adds -- around 270 MFLOP per pair, and a
   26-shot capture has ~60 overlapping pairs. That is minutes of
   single-threaded WASM on a phone.

   But we already know roughly where the camera was pointing. Projecting
   a keypoint from view A through the prior relative rotation predicts
   where it should land in view B to within the prior's uncertainty (a
   few degrees, ~200 px). Restricting each comparison to a disc of that
   radius cuts the candidate set by an order of magnitude AND raises
   precision, because the geometrically self-consistent false matches
   that repeated indoor structure produces are usually far outside the
   disc.

   This is the cheap version of the idea the research plan proposes to
   learn: the prior is information, not just an initialisation.
*/
(function (global) {
  'use strict';

  const DIM = 64;

  function dot(A, ai, B, bi) {
    const a = ai * DIM, b = bi * DIM;
    let s = 0;
    for (let c = 0; c < DIM; c++) s += A[a + c] * B[b + c];
    return s;
  }

  /* Lowe ratio on true L2 distance. Descriptors are unit-norm, so
     d^2 = 2 - 2*cos and the ratio test on squared distances is
     (1 - s_best) / (1 - s_second) < ratio^2. Working in similarities
     avoids two square roots per candidate. */
  function passesRatio(sBest, sSecond, ratioSq) {
    const dBest = 1 - sBest;
    const dSecond = 1 - sSecond;
    if (dSecond <= 1e-12) return false;
    return (dBest / dSecond) < ratioSq;
  }

  // Uniform grid over B's keypoints for O(1) neighbourhood queries.
  function buildGrid(keypoints, width, height, cell) {
    const cols = Math.max(1, Math.ceil(width / cell));
    const rows = Math.max(1, Math.ceil(height / cell));
    const buckets = new Array(cols * rows);
    for (let i = 0; i < buckets.length; i++) buckets[i] = [];
    for (let i = 0; i < keypoints.length; i++) {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(keypoints[i].x / cell)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(keypoints[i].y / cell)));
      buckets[cy * cols + cx].push(i);
    }
    return { cols: cols, rows: rows, cell: cell, buckets: buckets };
  }

  function queryGrid(grid, x, y, radius, out) {
    out.length = 0;
    const c0 = Math.max(0, Math.floor((x - radius) / grid.cell));
    const c1 = Math.min(grid.cols - 1, Math.floor((x + radius) / grid.cell));
    const r0 = Math.max(0, Math.floor((y - radius) / grid.cell));
    const r1 = Math.min(grid.rows - 1, Math.floor((y + radius) / grid.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const b = grid.buckets[r * grid.cols + c];
        for (let k = 0; k < b.length; k++) out.push(b[k]);
      }
    }
    return out;
  }

  /**
   * featA, featB: results from LSCXFeat.extract()
   * options:
   *   predict(x, y) -> {x, y} | null   expected location in B (optional)
   *   searchRadius                     px, only used with predict
   *   ratio                            Lowe ratio, default 0.92
   *   minScore                         minimum cosine similarity
   * Returns { matches: [{ax,ay,bx,by,score}], stats }
   */
  function match(featA, featB, options) {
    const opts = options || {};
    const ratio = opts.ratio !== undefined ? opts.ratio : 0.92;
    const ratioSq = ratio * ratio;
    const minScore = opts.minScore !== undefined ? opts.minScore : 0.5;
    const predict = opts.predict || null;
    const radius = opts.searchRadius || 220;

    const kpA = featA.keypoints, kpB = featB.keypoints;
    const dA = featA.descriptors, dB = featB.descriptors;
    const nA = kpA.length, nB = kpB.length;

    const stats = { nA: nA, nB: nB, comparisons: 0, gated: !!predict, aborted: 0 };
    if (!nA || !nB) return { matches: [], stats: stats };

    const grid = predict ? buildGrid(kpB, featB.width, featB.height,
      Math.max(32, radius / 2)) : null;

    // Forward pass: best and second-best in B for each keypoint in A.
    const bestB = new Int32Array(nA).fill(-1);
    const bestScore = new Float32Array(nA).fill(-2);
    const secondScore = new Float32Array(nA).fill(-2);
    const scratch = [];

    for (let i = 0; i < nA; i++) {
      let cand = null;
      if (predict) {
        const p = predict(kpA[i].x, kpA[i].y);
        if (!p) { stats.aborted++; continue; }
        cand = queryGrid(grid, p.x, p.y, radius, scratch);
        if (!cand.length) continue;
      }

      const n = cand ? cand.length : nB;
      let b1 = -1, s1 = -2, s2 = -2;
      for (let k = 0; k < n; k++) {
        const j = cand ? cand[k] : k;
        const s = dot(dA, i, dB, j);
        if (s > s1) { s2 = s1; s1 = s; b1 = j; }
        else if (s > s2) { s2 = s; }
      }
      stats.comparisons += n;
      bestB[i] = b1; bestScore[i] = s1; secondScore[i] = s2;
    }

    /* Reverse pass for mutual consistency. Only keypoints in B that were
       actually chosen by someone need checking, which keeps this cheap
       even without a gate. */
    const needed = new Set();
    for (let i = 0; i < nA; i++) if (bestB[i] >= 0) needed.add(bestB[i]);

    const bestA = new Map();
    needed.forEach(j => {
      let a1 = -1, s1 = -2;
      for (let i = 0; i < nA; i++) {
        const s = dot(dA, i, dB, j);
        if (s > s1) { s1 = s; a1 = i; }
      }
      stats.comparisons += nA;
      bestA.set(j, a1);
    });

    const matches = [];
    for (let i = 0; i < nA; i++) {
      const j = bestB[i];
      if (j < 0) continue;
      if (bestA.get(j) !== i) continue;                       // not mutual
      if (bestScore[i] < minScore) continue;
      if (secondScore[i] > -2 && !passesRatio(bestScore[i], secondScore[i], ratioSq)) continue;
      matches.push({
        ax: kpA[i].x, ay: kpA[i].y,
        bx: kpB[j].x, by: kpB[j].y,
        // Keypoint INDICES, not just coordinates. Geometry only ever needs
        // the coordinates, but pipeline.chainEdges() has to recognise that
        // "this keypoint in frame s" is the same keypoint across two
        // different edges, and identity is what an index gives it.
        ai: i, bi: j,
        score: bestScore[i]
      });
    }

    stats.matched = matches.length;
    return { matches: matches, stats: stats };
  }

  /* Builds a predict() for `match` from a relative rotation and focal
     length, using the same projection the stitch worker uses. */
  function makePredictor(Rrel, width, height, focal, SO3, Camera) {
    return function (x, y) {
      const rayA = Camera.pixelToRay(x, y, width, height, focal);
      const rayB = SO3.apply(Rrel, rayA);
      const p = Camera.rayToPixel(rayB, width, height, focal);
      return p ? { x: p.px, y: p.py } : null;
    };
  }

  global.LSCMatch = { match: match, makePredictor: makePredictor };
})(typeof self !== 'undefined' ? self : globalThis);
