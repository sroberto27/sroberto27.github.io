/* ===================== PHASE 0 ERROR DECOMPOSITION =====================
   The measurement that decides which research route is worth taking.

   Pose error in degrees is only a proxy. What matters is the panorama.
   This harness stitches the SAME 26 rendered views under a ladder of
   hypotheses, changing exactly one thing at each rung, and scores each
   result against the source panorama. The gaps between rungs attribute
   the visible error to specific causes:

     A  sensor pose + assumed FOV     what the app ships today
     B  refined pose + 68 deg         pose fixed, focal still assumed
     C  sensor pose + calibrated      focal fixed, pose still raw
     D  refined pose + calibrated     the full Phase 0 pipeline
     E  TRUE pose + TRUE focal        geometric ceiling
     F  E + gain compensation         removes exposure drift too

   Read it as: D-vs-A is what Phase 0 buys. E-vs-D is the pose/focal
   error still left. F-vs-E is how much of the residual is purely
   photometric. And whatever remains at F is resampling and blending --
   the floor this projection and feather can reach at all.

   The ladder runs under the SHIPPING blend mode, and a second table
   below re-runs hypothesis D under all three. Read that table with care:
   PSNR rewards averaging. Averaging several slightly misaligned copies
   of an edge is exactly the operation that minimises squared error and
   exactly the operation that draws the edge twice, so 'average' scores
   highest here while looking worst on a real capture. The numbers are
   recorded to make the size of that trade explicit, not to pick the
   default -- that is decided by looking at a real capture.

   Run: node lab/test/run-stitch-eval.js [--png]
*/
const path = require('path');
const fs = require('fs');
const { load } = require('./load.js');
const { writePNG, psnr, ssim } = require('./imgutil.js');

['pano/so3.js', 'pano/camera.js', 'pano/estimate.js', 'pano/calibrate.js',
 'pano/bundle.js', 'pano/pipeline.js', 'pano/stitch.js',
 'lab/test/synth.js', 'lab/test/scene.js'].forEach(load);

const S = globalThis.LSCSO3, C = globalThis.LSCCamera, P = globalThis.LSCPipeline;
const ST = globalThis.LSCStitch, Scene = globalThis.LSCScene, Synth = globalThis.LSCSynth;

const WRITE_PNG = process.argv.includes('--png');
const OUTDIR = path.join(__dirname, '..', '..', '.stitch-eval');
const DEG = Math.PI / 180;

const EW = 2048, EH = 1024;
/* PORTRAIT 3:4 source views, matching the only frame shape the app can
   produce; see the note on the defaults in synth.js for why rendering
   landscape here measured a capture that cannot be taken. */
const VW = 600, VH = 800;
/* What the app assumes when refinement is unavailable. ASSUMED_H_FOV_DEG
   in capture360.js is 68 deg across the lens's LONG axis, which on a
   portrait frame is the HEIGHT, so the width assumption is the converted
   value -- exactly the conversion the app does before starting the stitch
   worker. Quoting 68 against a portrait width would overstate the lens by
   a quarter and is the bug that conversion exists to prevent. */
const ASSUMED_HFOV = 2 * Math.atan(
  VW / (2 * (Math.max(VW, VH) / (2 * Math.tan(68 * Math.PI / 360))))) * 180 / Math.PI;

let failures = 0, checks = 0;
function check(name, cond, detail) {
  checks++; if (!cond) failures++;
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  ' + detail : ''));
}
const f2 = (v, d) => Number(v).toFixed(d === undefined ? 2 : d);

console.log('Building scene…');
const scene = Synth.generate({ seed: 42, width: VW, height: VH, trueHFovDeg: 58 });
const pano = Scene.makePanorama(EW, EH, 1234);
const gains = Scene.exposureGains(scene.trueRotations);

console.log('Rendering ' + scene.trueRotations.length + ' views (with auto-exposure drift)…');
const rendered = scene.trueRotations.map((R, i) =>
  Scene.renderView(pano, EW, EH, R, VW, VH, scene.trueFocal, gains[i]));

console.log('Refining poses…');
const priorR = scene.priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));
const res = P.refinePoses(scene, {});
if (!res.ok) { console.log('refinePoses failed: ' + res.reason); process.exit(1); }

const assumedFocal = C.focalFromHFov(ASSUMED_HFOV * DEG, VW);
const poseBefore = Synth.poseError(priorR, scene.trueRotations);
const poseAfter = Synth.poseError(res.rotations, scene.trueRotations);

console.log('  true hFOV ' + f2(scene.trueHFovDeg) + ' deg, recovered ' + f2(res.hFovDeg) +
  ' deg, assumed ' + ASSUMED_HFOV.toFixed(2) + ' deg');
console.log('  pose error ' + f2(poseBefore.meanDeg, 3) + ' -> ' + f2(poseAfter.meanDeg, 3) + ' deg');

// The refined rotations are only defined up to a global rotation, which
// is unobservable in pose terms but very much observable when the result
// is compared pixel-for-pixel against the source panorama. Align first,
// or every refined hypothesis is penalised for an error that does not
// exist.
function gaugeAlign(estimated, truth) {
  let G = S.IDENTITY;
  for (let iter = 0; iter < 25; iter++) {
    let a = S.vec(0, 0, 0);
    for (let i = 0; i < estimated.length; i++) {
      a = S.add(a, S.log(S.mul(truth[i], S.transpose(S.mul(G, estimated[i])))));
    }
    a = S.scale(a, 1 / estimated.length);
    G = S.mul(S.exp(a), G);
    if (S.norm(a) < 1e-13) break;
  }
  return estimated.map(R => S.mul(G, R));
}
const refinedAligned = gaugeAlign(res.rotations, scene.trueRotations);
const priorAligned = gaugeAlign(priorR, scene.trueRotations);

function buildViews(rotations, focal, gainList) {
  return rotations.map((R, i) => ({
    rgb: rendered[i], width: VW, height: VH, R: R, focal: focal,
    gain: gainList ? gainList[i] : 1
  }));
}

// The mode the app ships with, and the one the ladder below is scored in.
const SHIP_BLEND = 'best';

/* Coverage weighted by solid angle, the same semantics measureCoverage()
   uses in pano-stitch-worker.js. Counting equirect pixels instead makes
   the poles look far more important than they are -- an 8.7 deg cap is
   1.2% of the sphere but 9.7% of the rows of a 2048x1024 equirect -- which
   matters now that the capture pattern leaves those caps on purpose. */
function solidAngleCoverage(covered, W, H) {
  let seen = 0, total = 0;
  for (let y = 0; y < H; y++) {
    const cw = Math.cos((0.5 - (y + 0.5) / H) * Math.PI);
    if (cw <= 0) continue;
    const row = y * W;
    let rowSeen = 0;
    for (let x = 0; x < W; x++) if (covered[row + x]) rowSeen++;
    seen += cw * (rowSeen / W);
    total += cw;
  }
  return total > 0 ? seen / total : 0;
}

const HYPOTHESES = [
  ['A', 'sensor pose + assumed FOV (ships today)', priorAligned, assumedFocal, null],
  ['B', 'refined pose + assumed FOV', refinedAligned, assumedFocal, null],
  ['C', 'sensor pose + calibrated focal', priorAligned, res.focal, null],
  ['D', 'refined pose + calibrated focal', refinedAligned, res.focal, null],
  ['E', 'TRUE pose + TRUE focal', scene.trueRotations, scene.trueFocal, null],
  ['F', 'E + gain compensation', scene.trueRotations, scene.trueFocal, 'auto']
];

if (WRITE_PNG) fs.mkdirSync(OUTDIR, { recursive: true });

console.log('\nStitching ' + HYPOTHESES.length + ' hypotheses at ' + EW + 'x' + EH +
  ' (blend: ' + SHIP_BLEND + ')…');
const results = [];
let sharedMask = null;

for (const [tag, label, rotations, focal, gainMode] of HYPOTHESES) {
  let gainList = null;
  if (gainMode === 'auto') {
    gainList = ST.estimateGains(buildViews(rotations, focal, null), 16);
  }
  const out = ST.stitch(buildViews(rotations, focal, gainList), EW, EH, { blend: SHIP_BLEND });
  // Score every hypothesis over the SAME pixel set, so coverage
  // differences cannot flatter one of them.
  if (!sharedMask) sharedMask = out.covered;
  else for (let p = 0; p < sharedMask.length; p++) if (!out.covered[p]) sharedMask[p] = 0;
  results.push({ tag, label, out, gainList, coverage: solidAngleCoverage(out.covered, EW, EH) });
}

for (const r of results) {
  r.psnr = psnr(r.out.rgb, pano, sharedMask, EW * EH);
  r.ssim = ssim(r.out.rgb, pano, sharedMask, EW, EH);
  if (WRITE_PNG) writePNG(path.join(OUTDIR, r.tag + '.png'), r.out.rgb, EW, EH);
}
if (WRITE_PNG) {
  writePNG(path.join(OUTDIR, 'reference.png'), pano, EW, EH);
  console.log('  wrote PNGs to ' + OUTDIR);
}

console.log('\n=== Error decomposition (scored over ' +
  (solidAngleCoverage(sharedMask, EW, EH) * 100).toFixed(1) +
  '% of the sphere seen by all hypotheses) ===\n');
console.log('       hypothesis                            PSNR dB   SSIM    sphere covered');
for (const r of results) {
  console.log('   ' + r.tag + '   ' + r.label.padEnd(36) + f2(r.psnr).padStart(7) + '  ' +
    f2(r.ssim, 4).padStart(7) + '   ' + (f2(r.coverage * 100, 1) + '%').padStart(9));
}

const byTag = Object.fromEntries(results.map(r => [r.tag, r]));
const gap = (x, y) => byTag[x].psnr - byTag[y].psnr;

console.log('\n   attribution');
console.log('     Phase 0 pipeline buys          ' + f2(gap('D', 'A')).padStart(6) + ' dB   (A -> D)');
console.log('       of which pose refinement     ' + f2(gap('B', 'A')).padStart(6) + ' dB   (A -> B)');
console.log('       of which focal calibration   ' + f2(gap('C', 'A')).padStart(6) + ' dB   (A -> C)');
console.log('     residual pose/focal error      ' + f2(gap('E', 'D')).padStart(6) + ' dB   (D -> E)');
console.log('     exposure drift (photometric)   ' + f2(gap('F', 'E')).padStart(6) + ' dB   (E -> F)');
console.log('     floor: resampling + blending   ' + f2(byTag['F'].psnr).padStart(6) + ' dB absolute');

/* Coverage is a separate finding from accuracy: no stitching improvement
   can fill a direction the camera never pointed at.

   The current pattern stops at +/-45 and takes no pole shot, so it leaves
   a cap at each pole ON PURPOSE -- see buildTargetPattern in capture360.js
   for why, and lab/test/run-pattern-coverage.js for the measured size.
   The figure below is that deliberate cap plus the simulated per-shot
   aiming error, and it is not expected to reach 100%. */
console.log('\n   NOTE: at the true FOV the capture pattern covers ' +
  f2(byTag['E'].coverage * 100, 1) + '% of the sphere (' +
  scene.trueRotations.length + ' shots).');
console.log('         The shortfall is the pole caps this pattern deliberately does not');
console.log('         photograph, plus simulated aiming error. gapFill() inpaints them.');

/* Blend-mode comparison, held at hypothesis D -- the pipeline that
   actually ships -- so the only thing varying is how overlapping
   sources are combined. */
console.log('\n=== Blend modes at hypothesis D (refined pose + calibrated focal) ===\n');
const blendRows = [];
for (const bm of ['average', 'sharp', 'best']) {
  const o = ST.stitch(buildViews(refinedAligned, res.focal, null), EW, EH, { blend: bm });
  blendRows.push({
    mode: bm,
    psnr: psnr(o.rgb, pano, sharedMask, EW * EH),
    ssim: ssim(o.rgb, pano, sharedMask, EW, EH),
    coverage: solidAngleCoverage(o.covered, EW, EH)
  });
  if (WRITE_PNG) writePNG(path.join(OUTDIR, 'D-' + bm + '.png'), o.rgb, EW, EH);
}
console.log('       blend      PSNR dB   SSIM    sphere covered');
for (const r of blendRows) {
  console.log('   ' + r.mode.padEnd(12) + f2(r.psnr).padStart(7) + '  ' +
    f2(r.ssim, 4).padStart(7) + '   ' + (f2(r.coverage * 100, 1) + '%').padStart(9));
}
console.log('\n   Averaging minimises squared error by construction, so it wins on PSNR here');
console.log('   even where it visibly doubles edges. Coverage is the number that must NOT');
console.log('   move: a blend mode is allowed to trade sharpness for smoothness, but it is');
console.log('   never allowed to stop a source from reaching a direction it photographed.');

const byBlend = Object.fromEntries(blendRows.map(r => [r.mode, r]));

console.log('\n=== Checks ===');
check('focal calibration alone beats the assumed FOV', gap('C', 'A') > 0.5,
  '(+' + f2(gap('C', 'A')) + ' dB)');
check('pose refinement alone beats the sensor prior', gap('B', 'A') > 0.5,
  '(+' + f2(gap('B', 'A')) + ' dB)');
check('full Phase 0 beats what ships today', gap('D', 'A') > 1.0,
  '(+' + f2(gap('D', 'A')) + ' dB)');
check('Phase 0 gets close to the geometric ceiling', gap('E', 'D') < gap('D', 'A'),
  '(' + f2(gap('E', 'D')) + ' dB left vs ' + f2(gap('D', 'A')) + ' dB gained)');
check('gain compensation recovers exposure drift', gap('F', 'E') > 0.3,
  '(+' + f2(gap('F', 'E')) + ' dB)');
check('every blend mode reaches the same sphere coverage',
  Math.abs(byBlend['sharp'].coverage - byBlend['average'].coverage) < 0.002 &&
  Math.abs(byBlend['best'].coverage - byBlend['average'].coverage) < 0.002,
  'average ' + f2(byBlend['average'].coverage * 100, 1) + '%, sharp ' +
  f2(byBlend['sharp'].coverage * 100, 1) + '%, best ' + f2(byBlend['best'].coverage * 100, 1) + '%');
check('winner-takes-all costs PSNR rather than gaining it (expected, and why the default is a visual call)',
  byBlend['best'].psnr < byBlend['average'].psnr,
  f2(byBlend['best'].psnr) + ' dB vs ' + f2(byBlend['average'].psnr) + ' dB');
check('gains track the simulated auto-exposure',
  (() => {
    const g = byTag['F'].gainList;
    if (!g) return false;
    let num = 0, d1 = 0, d2 = 0;
    const inv = gains.map(v => 1 / v);
    const mg = g.reduce((s, v) => s + v, 0) / g.length;
    const mi = inv.reduce((s, v) => s + v, 0) / inv.length;
    for (let i = 0; i < g.length; i++) {
      num += (g[i] - mg) * (inv[i] - mi); d1 += (g[i] - mg) ** 2; d2 += (inv[i] - mi) ** 2;
    }
    return num / Math.sqrt(d1 * d2) > 0.9;
  })(), '(correlation with true inverse exposure)');

console.log('\n' + '-'.repeat(60));
console.log(failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED' : failures + ' of ' + checks + ' CHECKS FAILED');
console.log('-'.repeat(60));
console.log('\nNOTE: this scene has ZERO parallax by construction (all views share one');
console.log('optical centre). The floor reported above is therefore optimistic for real');
console.log('handheld capture, where parallax (E4) is expected to dominate indoors.');
process.exit(failures === 0 ? 0 : 1);
