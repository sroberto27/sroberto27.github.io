/* ===================== 360 POSE REFINEMENT WORKER =====================
   Runs BEFORE pano-stitch-worker.js and replaces two things the stitcher
   would otherwise have to guess:

     - the per-shot pose (currently the raw device-orientation reading,
       which drifts badly in yaw indoors near steel)
     - the horizontal FOV (currently the hardcoded ASSUMED_H_FOV_DEG = 68,
       because no browser API exposes the real value)

   It also returns per-shot exposure gains, so the stitcher can cancel the
   auto-exposure drift that occurs while panning past a window.

   Method: XFeat (CVPR 2024, Apache-2.0, ~0.66M params) extracts features
   from a downscaled copy of each shot; matching is restricted to the disc
   the pose prior predicts, which cuts descriptor comparisons ~5x and
   rejects repeated-structure false matches; focal length is then solved
   from the correspondences and the poses are refined by a rotation-only
   spherical bundle adjustment with loop closure.

   Offline measurements on a synthetic 26-shot capture (lab/README.md):
   pose refinement alone buys +0.94 dB, focal calibration alone +1.33 dB,
   but BOTH TOGETHER buy +8.57 dB. They are strongly coupled -- neither
   half is worth applying without the other.

   This worker is strictly advisory. Every failure path returns a result
   the caller can ignore, and capture360.js falls back to the original
   sensor-pose behaviour. Refinement must never be able to lose a capture.

   Module worker on purpose: onnxruntime-web's bundled ESM build avoids
   the dynamic import() that the classic-script build performs, which is
   the usual first-try failure inside a worker.
*/
import * as ortNS from './vendor/ort.wasm.bundle.min.mjs';
import './pano/so3.js';
import './pano/camera.js';
import './pano/estimate.js';
import './pano/calibrate.js';
import './pano/bundle.js';
import './pano/pipeline.js';
import './pano/stitch.js';
import './pano/xfeat-extractor.js';
import './pano/xfeat-match.js';

const S = self.LSCSO3;
const C = self.LSCCamera;
const P = self.LSCPipeline;
const XF = self.LSCXFeat;
const MM = self.LSCMatch;
const ST = self.LSCStitch;

const GAIN_SAMPLE_WIDTH = 320;   // plenty for a scalar exposure gain

function post(type, payload) { self.postMessage(Object.assign({ type }, payload || {})); }
function progress(stage, pct) { post('progress', { stage, pct: Math.round(pct) }); }

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'refine') return;
  try {
    await refine(msg);
  } catch (err) {
    post('error', { message: err && err.message ? err.message : String(err) });
  }
};

function smallCanvasRGB(bitmap, targetW) {
  const scale = Math.min(1, targetW / bitmap.width);
  const w = Math.max(8, Math.round(bitmap.width * scale));
  const h = Math.max(8, Math.round(bitmap.height * scale));
  const cv = new OffscreenCanvas(w, h);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0, o = 0; i < w * h; i++, o += 3) {
    rgb[o] = d[i * 4] / 255;
    rgb[o + 1] = d[i * 4 + 1] / 255;
    rgb[o + 2] = d[i * 4 + 2] / 255;
  }
  return { rgb, width: w, height: h };
}

async function refine(msg) {
  const images = msg.images || [];
  const opts = msg.options || {};
  const maxSide = opts.maxSide || 640;
  const nominalHFov = opts.nominalHFovDeg || 68;

  if (images.length < 4) {
    post('skipped', { reason: 'too-few-shots' });
    return;
  }
  if (typeof OffscreenCanvas === 'undefined') {
    post('skipped', { reason: 'no-offscreen-canvas' });
    return;
  }

  /* Resolve the model URL against the worker's own URL rather than a
     bare relative path -- the app lives under a sub-path on GitHub
     Pages. wasmPaths is deliberately NOT set: onnxruntime-web resolves
     its own sibling .wasm/.mjs files relative to its own import.meta.url,
     and vendor/ort.wasm.bundle.min.mjs already lives right next to them,
     so passing a wasmPaths override here doubled to vendor/vendor/... and
     404'd in production. See the note in pano/xfeat-extractor.js. */
  const vendorBase = new URL('vendor/', self.location.href).href;

  // The runtime and model are ~17 MB on first use and then cached. Saying
  // so beats a progress bar that looks stuck on a slow connection.
  progress('Loading model (first run downloads ~17 MB)', 2);
  await XF.init({
    ort: ortNS,
    modelUrl: vendorBase + 'xfeat.onnx',
    maxSide
  });

  // ---- features ----
  const features = [];
  const gainViews = [];
  let inferMs = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let f = null;
    try {
      f = await XF.extract(img.bitmap, { maxSide });
      inferMs += f.timings.infer;
      const small = smallCanvasRGB(img.bitmap, GAIN_SAMPLE_WIDTH);
      gainViews.push(small);
    } catch (err) {
      gainViews.push(null);
    }
    features.push(f);
    try { img.bitmap.close && img.bitmap.close(); } catch (e) { /* ignore */ }
    progress('Analysing photos', 5 + (i + 1) / images.length * 55);
  }

  const usable = features.filter(Boolean).length;
  if (usable < 4) { post('skipped', { reason: 'extraction-failed' }); return; }

  // ---- matching under the pose prior ----
  const W = images[0].width, H = images[0].height;
  const priors = images.map(im => ({
    yaw: typeof im.yaw === 'number' ? im.yaw : 0,
    pitch: typeof im.pitch === 'number' ? im.pitch : 0,
    roll: typeof im.roll === 'number' ? im.roll : 0
  }));
  const priorR = priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));
  const nominalFocal = C.focalFromHFov(nominalHFov * C.DEG, W);

  const pairs = P.candidatePairs(priors, {}).filter(pr => features[pr.i] && features[pr.j]);
  const edges = [];
  let comparisons = 0;
  for (let k = 0; k < pairs.length; k++) {
    const pr = pairs[k];
    const Rrel = S.mul(S.transpose(priorR[pr.j]), priorR[pr.i]);
    const r = MM.match(features[pr.i], features[pr.j], {
      predict: MM.makePredictor(Rrel, W, H, nominalFocal, S, C),
      searchRadius: Math.max(120, nominalFocal * 9 * C.DEG),
      ratio: 0.92,
      minScore: 0.5
    });
    comparisons += r.stats.comparisons;
    if (r.matches.length >= 6) edges.push({ i: pr.i, j: pr.j, matches: r.matches });
    progress('Aligning photos', 60 + (k + 1) / pairs.length * 22);
  }

  if (edges.length < 3) { post('skipped', { reason: 'too-few-matches' }); return; }

  // ---- geometry ----
  progress('Solving geometry', 84);
  const result = P.refinePoses({ width: W, height: H, priors, edges }, {});
  if (!result.ok) { post('skipped', { reason: result.reason }); return; }

  /* Sanity gate. A wildly different FOV or an enormous mean correction
     means the solve latched onto something wrong, and shipping that would
     be worse than the sensor pose we started with. Refuse rather than
     degrade a real capture. */
  const fovSane = result.hFovDeg > 45 && result.hFovDeg < 95;
  const correctionSane = result.corrections.meanDeg < 25;
  if (!fovSane || !correctionSane) {
    post('skipped', {
      reason: 'implausible-solution',
      detail: { hFovDeg: result.hFovDeg, meanCorrectionDeg: result.corrections.meanDeg }
    });
    return;
  }

  // ---- exposure gains ----
  progress('Balancing exposure', 92);
  let gains = null;
  try {
    const views = result.rotations.map((R, i) => {
      const g = gainViews[i];
      if (!g) return null;
      return {
        rgb: g.rgb, width: g.width, height: g.height, R,
        focal: C.focalFromHFov(result.hFovDeg * C.DEG, g.width)
      };
    });
    if (views.every(Boolean)) {
      gains = ST.estimateGains(views, 6);
      // Refuse implausible gains rather than wreck the exposure.
      if (!gains.every(v => isFinite(v) && v > 0.4 && v < 2.5)) gains = null;
    }
  } catch (err) { gains = null; }

  progress('Finishing', 99);
  const rings = P.ringDiagnostics(result.rotations, result.edges);
  post('result', {
    poses: result.poses,
    hFovDeg: result.hFovDeg,
    focal: result.focal,
    gains,
    diagnostics: {
      shots: images.length,
      usableShots: usable,
      edges: result.edges.length,
      rejectedEdges: result.rejected.length,
      keypointsPerShot: Math.round(
        features.filter(Boolean).reduce((s, f) => s + f.count, 0) / usable),
      meanCorrectionDeg: result.corrections.meanDeg,
      maxCorrectionDeg: result.corrections.maxDeg,
      rmsEdgeResidualDeg: result.bundle.rmsEdgeResidualRad * 180 / Math.PI,
      matchSpread: result.calibration.spread.mean,
      converged: result.bundle.converged,
      inferMs: Math.round(inferMs),
      comparisons,
      loopDriftDeg: rings.horizon ? rings.horizon.measured : null
    }
  });
}
