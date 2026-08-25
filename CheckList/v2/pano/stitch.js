/* ===================== HEADLESS EQUIRECT STITCHER =====================
   A faithful port of the scatter loop in ../../pano-stitch-worker.js, with
   the two hardcoded assumptions lifted out as parameters:

     - per-view rotation (the worker reads the raw sensor pose)
     - focal length      (the worker uses ASSUMED_H_FOV_DEG = 68)

   That is the whole point of this file. Holding the projection and
   blending identical to the shipped code and varying ONLY pose and focal
   isolates how much of the visible error each one causes. Anything this
   measures is attributable, not confounded by a different resampling or
   blending implementation.

   Optional gain compensation is included so the photometric error
   (E5 -- auto-exposure drift across 26 shots) can be measured separately
   from the geometric error, rather than being blamed on pose.

   Works on plain Float32Array RGB buffers so it runs in node without any
   image codec. The browser can use it too.
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;
  const C = global.LSCCamera;

  /**
   * views: [{ rgb: Float32Array(W*H*3) in 0..1, width, height, R, focal, gain? }]
   * Returns { rgb: Float32Array(outW*outH*3), weight: Float32Array, covered: Uint8Array }
   */
  function stitch(views, outW, outH, options) {
    const opts = options || {};
    const featherPower = opts.featherPower !== undefined ? opts.featherPower : 1;
    const colorSum = new Float32Array(outW * outH * 3);
    const weightSum = new Float32Array(outW * outH);

    for (let v = 0; v < views.length; v++) {
      const view = views[v];
      const W = view.width, H = view.height;
      const f = view.focal;
      const R = view.R;
      const gain = view.gain !== undefined ? view.gain : 1;
      const px = view.rgb;

      // Same density guard as the worker: sampling far beyond one sample
      // per output pixel is wasted work.
      const hFov = C.hFovFromFocal(f, W);
      const outSamplesAcross = (hFov / (2 * Math.PI)) * outW;
      const stride = Math.max(1, Math.floor(W / (outSamplesAcross * 1.4 || 1)));

      for (let y = 0; y < H; y += stride) {
        const ny = 1 - (y + 0.5) / H * 2;
        for (let x = 0; x < W; x += stride) {
          const nx = (x + 0.5) / W * 2 - 1;

          const ray = C.pixelToRay(x, y, W, H, f);
          const world = S.apply(R, ray);
          const eq = C.rayToEquirect(world, outW, outH);
          if (eq.v < 0 || eq.v >= outH) continue;

          // Separable feather, identical in form to the worker's. Kept in
          // lockstep deliberately: this file exists to measure what the
          // shipped stitcher does, so any divergence here makes the
          // offline evaluation measure a stitcher that doesn't exist.
          const wxF = Math.cos(Math.min(Math.abs(nx), 1) * Math.PI / 2);
          const wyF = Math.cos(Math.min(Math.abs(ny), 1) * Math.PI / 2);
          let w = wxF * wyF;
          if (w <= 1e-6) continue;
          if (featherPower !== 1) w = Math.pow(w, featherPower);

          const si = (y * W + x) * 3;
          splat(colorSum, weightSum, outW, outH, eq.u, eq.v,
            px[si] * gain, px[si + 1] * gain, px[si + 2] * gain, w);
        }
      }
    }

    const rgb = new Float32Array(outW * outH * 3);
    const covered = new Uint8Array(outW * outH);
    for (let p = 0; p < outW * outH; p++) {
      const ws = weightSum[p];
      if (ws > 1e-4) {
        rgb[p * 3] = colorSum[p * 3] / ws;
        rgb[p * 3 + 1] = colorSum[p * 3 + 1] / ws;
        rgb[p * 3 + 2] = colorSum[p * 3 + 2] / ws;
        covered[p] = 1;
      }
    }
    return { rgb: rgb, weight: weightSum, covered: covered };
  }

  function splat(colorSum, weightSum, W, H, u, v, r, g, b, weight) {
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const fx = u - x0, fy = v - y0;
    for (let dy = 0; dy <= 1; dy++) {
      const yy = y0 + dy;
      if (yy < 0 || yy >= H) continue;
      const wy = dy ? fy : (1 - fy);
      for (let dx = 0; dx <= 1; dx++) {
        let xx = (x0 + dx) % W; if (xx < 0) xx += W;
        const wx = dx ? fx : (1 - fx);
        const w = weight * wx * wy;
        if (w <= 0) continue;
        const p = yy * W + xx;
        colorSum[p * 3] += r * w;
        colorSum[p * 3 + 1] += g * w;
        colorSum[p * 3 + 2] += b * w;
        weightSum[p] += w;
      }
    }
  }

  /* Gain compensation, Brown & Lowe style but reduced to the scalar case.

     For every overlapping pair we measure the mean intensity each view
     reports over the SAME set of world directions, then solve for
     per-view gains that make those agree. Without this, panning past a
     window drives the camera's auto-exposure and the resulting steps show
     up as banding in the panorama no matter how good the geometry is --
     an error pose refinement cannot touch.

     Solves (sum_j N_ij (g_i I_ij - g_j I_ji)^2) + sigma*(g_i - 1)^2 by
     Gauss-Seidel; the regulariser pins the overall exposure so the
     system is not free to drift to zero. */
  function estimateGains(views, sampleStep, regularisation) {
    const n = views.length;
    const step = sampleStep || 16;
    const sigma = regularisation !== undefined ? regularisation : 0.1;

    const I = [];   // I[i][j] = mean intensity of view i over its overlap with j
    const N = [];   // N[i][j] = number of samples in that overlap
    for (let i = 0; i < n; i++) { I.push(new Float64Array(n)); N.push(new Float64Array(n)); }

    for (let i = 0; i < n; i++) {
      const vi = views[i], Wi = vi.width, Hi = vi.height;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const vj = views[j];
        const Rij = S.mul(S.transpose(vj.R), vi.R);
        let sumI = 0, sumJ = 0, cnt = 0;
        for (let y = 0; y < Hi; y += step) {
          for (let x = 0; x < Wi; x += step) {
            const ray = C.pixelToRay(x, y, Wi, Hi, vi.focal);
            const inJ = S.apply(Rij, ray);
            const p = C.rayToPixel(inJ, vj.width, vj.height, vj.focal);
            if (!C.inFrame(p, vj.width, vj.height, 4)) continue;
            const si = (y * Wi + x) * 3;
            const sj = (Math.round(p.py) * vj.width + Math.round(p.px)) * 3;
            sumI += (vi.rgb[si] + vi.rgb[si + 1] + vi.rgb[si + 2]) / 3;
            sumJ += (vj.rgb[sj] + vj.rgb[sj + 1] + vj.rgb[sj + 2]) / 3;
            cnt++;
          }
        }
        if (cnt > 8) { I[i][j] = sumI / cnt; N[i][j] = cnt; }
        if (cnt > 8) { I[j][i] = sumJ / cnt; N[j][i] = cnt; }
      }
    }

    const g = new Float64Array(n).fill(1);
    for (let iter = 0; iter < 200; iter++) {
      let maxDelta = 0;
      for (let i = 0; i < n; i++) {
        let num = sigma, den = sigma;
        for (let j = 0; j < n; j++) {
          if (i === j || !N[i][j]) continue;
          const Iij = I[i][j], Iji = I[j][i];
          num += N[i][j] * Iij * Iji * g[j];
          den += N[i][j] * Iij * Iij;
        }
        const next = den > 1e-9 ? num / den : 1;
        maxDelta = Math.max(maxDelta, Math.abs(next - g[i]));
        g[i] = next;
      }
      if (maxDelta < 1e-9) break;
    }

    // Normalise so the mean gain is 1 -- otherwise the whole panorama
    // brightens or darkens relative to the source.
    let mean = 0;
    for (let i = 0; i < n; i++) mean += g[i];
    mean /= n || 1;
    for (let i = 0; i < n; i++) g[i] /= (mean || 1);
    return Array.from(g);
  }

  global.LSCStitch = { stitch: stitch, estimateGains: estimateGains };
})(typeof self !== 'undefined' ? self : globalThis);
