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

   SEQUENCE FRAMES. A capture may include frames taken while the phone was
   moving between targets, flagged `poseOnly`. They exist because two
   photographs 30 deg apart on a blank wall often fail to match while the
   same pair joined by frames 7 deg apart matches every time. They never
   contribute a pixel to the panorama and never get an exposure gain: they
   are matched, their matches are chained into direct correspondences
   between the real photographs (pipeline.chainEdges), and then they are
   dropped before the bundle runs. The bundle therefore stays the size it
   would have been without them, which matters because bundle.js builds a
   dense normal matrix.

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

/* A frame arrives either already decoded (the photographs, which the
   caller has downscaled anyway) or as a compressed blob (sequence frames,
   of which there can be a couple of hundred). Blobs are decoded one at a
   time and released immediately, for the same reason the stitch worker
   does it: a hundred and fifty live 720x960 bitmaps is 400 MB of resident
   pixels, and mobile Safari kills the tab rather than throwing something
   catchable. */
async function frameBitmap(img) {
  if (img.bitmap) return { bitmap: img.bitmap, owned: false };
  if (img.blob) return { bitmap: await createImageBitmap(img.blob), owned: true };
  return null;
}

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

  /* Which frames the caller actually wants poses for. Everything else is
     a sequence frame: matched, chained, then discarded. */
  const isKey = images.map(im => !im.poseOnly);
  const keyIdx = [];
  for (let i = 0; i < images.length; i++) if (isKey[i]) keyIdx.push(i);
  if (keyIdx.length < 4) { post('skipped', { reason: 'too-few-shots' }); return; }

  // ---- features ----
  const features = [];
  const gainViews = [];
  let inferMs = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let f = null;
    let held = null;
    try {
      held = await frameBitmap(img);
      if (held) {
        f = await XF.extract(held.bitmap, { maxSide });
        inferMs += f.timings.infer;
        // Exposure is only ever solved for the photographs. A sequence
        // frame is motion-blurred by construction and contributes no
        // pixels, so sampling it would cost time and buy nothing.
        gainViews.push(isKey[i] ? smallCanvasRGB(held.bitmap, GAIN_SAMPLE_WIDTH) : null);
      } else {
        gainViews.push(null);
      }
    } catch (err) {
      gainViews.push(null);
    }
    features.push(f);
    if (held) {
      try { held.bitmap.close && held.bitmap.close(); } catch (e) { /* ignore */ }
      if (held.owned) img.blob = null;
    }
    if (img.bitmap) img.bitmap = null;
    progress('Analysing photos', 5 + (i + 1) / images.length * 55);
  }

  const usable = keyIdx.filter(i => features[i]).length;
  if (usable < 4) { post('skipped', { reason: 'extraction-failed' }); return; }

  // ---- matching under the pose prior ----
  /* One frame geometry for the whole capture. The matcher's predictor, the
     focal solve and the bundle all take a single width/height/focal, so a
     sequence frame whose dimensions differ from the photographs cannot be
     used without corrupting the geometry -- and video frames are a
     different crop of the sensor on many phones. Drop the mismatches
     rather than trust them; the caller checks the same thing before it
     bothers sending them, so in practice this is a backstop. */
  const W = images[keyIdx[0]].width, H = images[keyIdx[0]].height;
  let mismatched = 0;
  for (let i = 0; i < images.length; i++) {
    if (isKey[i] || !features[i]) continue;
    if (images[i].width !== W || images[i].height !== H) {
      features[i] = null;
      mismatched++;
    }
  }
  const priors = images.map(im => ({
    yaw: typeof im.yaw === 'number' ? im.yaw : 0,
    pitch: typeof im.pitch === 'number' ? im.pitch : 0,
    roll: typeof im.roll === 'number' ? im.roll : 0
  }));
  const priorR = priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));
  /* nominalHFov quotes the lens across its LONG axis; phone stills come
     back portrait, so it has to be mapped onto this image's width before
     it means anything. See widthFovFromLongFov in pano/camera.js. */
  const nominalWidthFov = C.widthFovFromLongFov(nominalHFov * C.DEG, W, H);
  const nominalFocal = C.focalFromHFov(nominalWidthFov, W);

  const sequenceFrames = images.length - keyIdx.length;
  const pairs = P.selectPairs(priors, sequenceFrames ? isKey : null, {})
    .filter(pr => features[pr.i] && features[pr.j]);
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

  /* Chain the sequence frames out of the problem before solving. What
     goes into the bundle is always exactly the photographs. */
  const directEdges = edges.length;
  let chainedEdges = 0, droppedTracks = 0;
  let solveEdges = edges, solvePriors = priors;
  if (sequenceFrames) {
    progress('Linking photos', 83);
    const chained = P.chainEdges(edges, isKey, {});
    droppedTracks = chained.droppedAmbiguousTracks || 0;
    chainedEdges = chained.length;
    if (chained.length < 3) { post('skipped', { reason: 'too-few-matches' }); return; }
    const remap = new Array(images.length).fill(-1);
    keyIdx.forEach((g, k) => { remap[g] = k; });
    solveEdges = chained.map(e => ({ i: remap[e.i], j: remap[e.j], matches: e.matches }));
    solvePriors = keyIdx.map(i => priors[i]);
  }

  // ---- geometry ----
  progress('Solving geometry', 84);
  const result = P.refinePoses({ width: W, height: H, priors: solvePriors, edges: solveEdges },
    { nominalHFovDeg: nominalWidthFov / C.DEG });
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
    const views = result.rotations.map((R, k) => {
      const g = gainViews[sequenceFrames ? keyIdx[k] : k];
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
      shots: keyIdx.length,
      sequenceFrames: sequenceFrames,
      sequenceRejected: mismatched,
      directEdges: directEdges,
      chainedEdges: chainedEdges,
      droppedTracks: droppedTracks,
      usableShots: usable,
      edges: result.edges.length,
      rejectedEdges: result.rejected.length,
      keypointsPerShot: Math.round(
        keyIdx.filter(i => features[i]).reduce((s, i) => s + features[i].count, 0) / usable),
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
