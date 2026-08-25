/* ===================== XFEAT FEATURE EXTRACTION =====================
   Runs XFeat (CVPR 2024, Apache-2.0) in the browser via onnxruntime-web
   and returns keypoints with L2-normalised 64-d descriptors.

   Model: kornia/xfeat `xfeat_backbone.onnx`, external data merged into a
   single 2.8 MB file. ~0.66M parameters. Outputs, all for one image:

     descriptors  [1, 64, H/8, W/8]   dense descriptor field
     heatmap      [1,  1, H,   W  ]   keypoint score, already softmaxed
                                      and pixel-shuffled to full res
     reliability  [1,  1, H,   W  ]   matchability

   Detection (NMS, top-K, descriptor sampling, normalisation) is done
   here in JS rather than inside the graph. That is deliberate: it keeps
   the ONNX graph to plain convolutional ops that WASM handles well, and
   avoids TopK/NonMaxSuppression with dynamic shapes, which are a common
   source of first-try failures in onnxruntime-web.

   Runs single-threaded on purpose. GitHub Pages cannot send COOP/COEP
   headers, so `crossOriginIsolated` is false, SharedArrayBuffer is
   unavailable, and multi-threaded WASM cannot start. WebGPU/JSEP is also
   avoided -- see microsoft/onnxruntime#26827 for the Safari/WebKit 26
   CPU and memory regression.
*/
(function (global) {
  'use strict';

  const DEFAULTS = {
    modelUrl: 'vendor/xfeat.onnx',
    wasmPaths: 'vendor/',
    // XFeat is trained around VGA. Larger inputs find more keypoints but
    // cost roughly linearly, and on a phone that adds up over 26 shots.
    maxSide: 640,
    topK: 2048,
    scoreThreshold: 0.02,
    nmsRadius: 3
  };

  let session = null;
  let sessionPromise = null;
  let ort = null;

  function resolveOrt(provided) {
    const o = provided || global.ort;
    if (!o) throw new Error('onnxruntime-web is not loaded (pass opts.ort or set global `ort`)');
    return o;
  }

  async function init(options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (session) return session;
    if (sessionPromise) return sessionPromise;

    // Accepts an explicit runtime so a module worker can pass the ESM
    // import directly instead of relying on a global side effect.
    ort = resolveOrt(opts.ort);
    ort.env.wasm.wasmPaths = opts.wasmPaths;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    ort.env.logLevel = 'error';

    sessionPromise = ort.InferenceSession.create(opts.modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    }).then(s => { session = s; return s; });

    return sessionPromise;
  }

  // Target size: fits inside maxSide, both dimensions multiples of 8 so
  // the descriptor grid divides cleanly.
  function targetSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(8, Math.round(width * scale / 8) * 8);
    const h = Math.max(8, Math.round(height * scale / 8) * 8);
    return { w: w, h: h };
  }

  function toTensorData(imageData, W, H) {
    const px = imageData.data;
    const plane = W * H;
    const out = new Float32Array(3 * plane);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const o = y * W + x;
        out[o] = px[i] / 255;
        out[plane + o] = px[i + 1] / 255;
        out[2 * plane + o] = px[i + 2] / 255;
      }
    }
    return out;
  }

  /* Non-maximum suppression: keep pixels that are the strict maximum of
     their (2r+1) neighbourhood and clear the threshold. A border margin
     is excluded because descriptors sampled at the very edge of the
     frame are unreliable -- and frame edges are exactly where panorama
     seams fall, so a bad match there is disproportionately costly. */
  function detectKeypoints(heat, W, H, opts) {
    const r = opts.nmsRadius;
    const thr = opts.scoreThreshold;
    const border = Math.max(r, 8);
    const found = [];

    for (let y = border; y < H - border; y++) {
      for (let x = border; x < W - border; x++) {
        const v = heat[y * W + x];
        if (v < thr) continue;
        let isMax = true;
        for (let dy = -r; dy <= r && isMax; dy++) {
          const yy = y + dy;
          for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (heat[yy * W + x + dx] > v) { isMax = false; break; }
          }
        }
        if (isMax) found.push({ x: x, y: y, score: v });
      }
    }

    found.sort((a, b) => b.score - a.score);
    return found.length > opts.topK ? found.slice(0, opts.topK) : found;
  }

  // Bilinear sample of the 64-channel descriptor field, then L2 normalise
  // so matching is a plain dot product.
  function sampleDescriptors(desc, gw, gh, keypoints) {
    const C = 64;
    const out = new Float32Array(keypoints.length * C);
    const plane = gw * gh;

    for (let k = 0; k < keypoints.length; k++) {
      const gx = Math.min(gw - 1.001, Math.max(0, keypoints[k].x / 8));
      const gy = Math.min(gh - 1.001, Math.max(0, keypoints[k].y / 8));
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);

      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy, w11 = fx * fy;
      const i00 = y0 * gw + x0, i10 = y0 * gw + x1;
      const i01 = y1 * gw + x0, i11 = y1 * gw + x1;

      const base = k * C;
      let norm = 0;
      for (let c = 0; c < C; c++) {
        const p = c * plane;
        const v = desc[p + i00] * w00 + desc[p + i10] * w10 +
                  desc[p + i01] * w01 + desc[p + i11] * w11;
        out[base + c] = v;
        norm += v * v;
      }
      norm = Math.sqrt(norm) || 1;
      for (let c = 0; c < C; c++) out[base + c] /= norm;
    }
    return out;
  }

  /**
   * source: ImageBitmap, HTMLImageElement, HTMLCanvasElement or OffscreenCanvas
   * Returns { keypoints: [{x, y, score}], descriptors: Float32Array(N*64),
   *           count, width, height, scale, timings }
   * Keypoint coordinates are in ORIGINAL source pixels, not network input
   * pixels, so callers never have to think about the internal downscale.
   */
  async function extract(source, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    await init(opts);

    const srcW = source.width || source.naturalWidth;
    const srcH = source.height || source.naturalHeight;
    const { w: W, h: H } = targetSize(srcW, srcH, opts.maxSide);

    const t0 = performance.now();
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, W, H);
    const imageData = ctx.getImageData(0, 0, W, H);
    const input = toTensorData(imageData, W, H);
    const tPrep = performance.now() - t0;

    const t1 = performance.now();
    const feeds = { image: new ort.Tensor('float32', input, [1, 3, H, W]) };
    const results = await session.run(feeds);
    const tInfer = performance.now() - t1;

    const t2 = performance.now();
    const heat = results.heatmap.data;
    const desc = results.descriptors.data;
    const gh = results.descriptors.dims[2];
    const gw = results.descriptors.dims[3];

    const kps = detectKeypoints(heat, W, H, opts);
    const descriptors = sampleDescriptors(desc, gw, gh, kps);
    const tPost = performance.now() - t2;

    // Map back to original image coordinates.
    const sx = srcW / W, sy = srcH / H;
    const keypoints = kps.map(k => ({ x: k.x * sx, y: k.y * sy, score: k.score }));

    return {
      keypoints: keypoints,
      descriptors: descriptors,
      count: keypoints.length,
      width: srcW,
      height: srcH,
      netWidth: W,
      netHeight: H,
      timings: { prep: tPrep, infer: tInfer, post: tPost, total: tPrep + tInfer + tPost }
    };
  }

  function isReady() { return !!session; }

  global.LSCXFeat = {
    init: init,
    extract: extract,
    isReady: isReady,
    targetSize: targetSize,
    DEFAULTS: DEFAULTS,
    // Exported so the offline fixture test can drive the real detection
    // and sampling code with recorded model outputs, no browser needed.
    detectKeypoints: detectKeypoints,
    sampleDescriptors: sampleDescriptors
  };
})(typeof self !== 'undefined' ? self : globalThis);
