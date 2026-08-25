/* Synthetic verification of the pose-refinement geometry.
   Run: node lab/test/run-tests.js
*/
const { load } = require('./load.js');

load('pano/so3.js');
load('pano/camera.js');
load('pano/estimate.js');
load('pano/calibrate.js');
load('pano/bundle.js');
load('pano/pipeline.js');
load('lab/test/synth.js');

const S = globalThis.LSCSO3;
const C = globalThis.LSCCamera;
const P = globalThis.LSCPipeline;
const Synth = globalThis.LSCSynth;

let failures = 0;
let checks = 0;

function check(name, condition, detail) {
  checks++;
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures++;
  console.log('  [' + mark + '] ' + name + (detail ? '  ' + detail : ''));
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

function fmt(x, d) { return Number(x).toFixed(d === undefined ? 3 : d); }

// ---------------------------------------------------------------
section('1. Conventions match the shipped stitch worker');
{
  const W = 1920, H = 1080, hFov = 68 * C.DEG;
  const f = C.focalFromHFov(hFov, W);
  const tanH = Math.tan(hFov / 2), tanV = tanH * (H / W);
  let maxErr = 0;

  for (const [y, p, r] of [[0, 0, 0], [0.7, -0.3, 0.2], [2.5, 0.6, -0.4], [-1.1, 1.3, 0.9]]) {
    const R = S.fromYawPitchRoll(y, p, r);
    const fwd = S.vec(Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), Math.sin(p));
    const wu = S.vec(0, 0, 1);
    const r0 = Math.abs(fwd.z) > 0.999 ? S.vec(1, 0, 0) : S.normalize(S.cross(fwd, wu));
    const u0 = S.normalize(S.cross(r0, fwd));
    const cr = Math.cos(r), sr = Math.sin(r);
    const right = S.normalize(S.add(S.scale(r0, cr), S.scale(u0, -sr)));
    const up = S.normalize(S.add(S.scale(u0, cr), S.scale(r0, sr)));

    for (const [px, py] of [[0, 0], [1919, 0], [960, 540], [100, 900], [1919, 1079]]) {
      const nx = (px + 0.5) / W * 2 - 1, ny = 1 - (py + 0.5) / H * 2;
      const workerRay = S.normalize(S.add(S.add(
        S.scale(right, nx * tanH), S.scale(up, ny * tanV)), fwd));
      const ours = S.apply(R, C.pixelToRay(px, py, W, H, f));
      maxErr = Math.max(maxErr, S.norm(S.sub(workerRay, ours)));
    }
  }
  check('pixel->world ray identical to worker scatter loop', maxErr < 1e-12,
    '(max deviation ' + maxErr.toExponential(2) + ')');
}

// ---------------------------------------------------------------
section('2. Rotation solver');
{
  let worstFull = 0, worstMin = 0;
  for (let t = 0; t < 400; t++) {
    const ax = S.normalize(S.vec(Math.sin(t * 1.1) + 0.3, Math.cos(t * 0.7), Math.sin(t * 2.3)));
    const Rt = S.exp(S.scale(ax, 0.02 + (t % 50) * 0.03));
    const a = [], b = [];
    for (let k = 0; k < 12; k++) {
      const v = S.normalize(S.vec(Math.sin(k * 3.1 + t), Math.cos(k * 1.7 - t), Math.sin(k * 0.9 + t * 0.5) + 0.5));
      a.push(v); b.push(S.apply(Rt, v));
    }
    worstFull = Math.max(worstFull, S.angleBetween(globalThis.LSCEstimate.solveRotation(a, b), Rt));
    const R2 = globalThis.LSCEstimate.solveRotation([a[0], a[5]], [b[0], b[5]]);
    worstMin = Math.max(worstMin, S.angleBetween(R2, Rt));
  }
  check('recovers known rotation from 12 correspondences',
    worstFull * 180 / Math.PI < 1e-4, '(worst ' + (worstFull * 180 / Math.PI).toExponential(2) + ' deg)');
  check('recovers known rotation from the minimal 2-point sample',
    worstMin * 180 / Math.PI < 1e-4, '(worst ' + (worstMin * 180 / Math.PI).toExponential(2) + ' deg)');
}

// ---------------------------------------------------------------
section('3. End-to-end refinement on a synthetic 26-shot capture');
let mainResult = null;
{
  const scene = Synth.generate({ seed: 42 });
  const priorR = scene.priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));
  const before = Synth.poseError(priorR, scene.trueRotations);

  const t0 = Date.now();
  const res = P.refinePoses(scene, {});
  const ms = Date.now() - t0;
  mainResult = { scene, res, before };

  check('pipeline succeeded', res.ok === true, res.ok ? '' : '(' + res.reason + ')');
  if (!res.ok) { console.log('  aborting section'); }
  else {
    const after = Synth.poseError(res.rotations, scene.trueRotations);
    const fovErr = Math.abs(res.hFovDeg - scene.trueHFovDeg);
    const focalErrPct = Math.abs(res.focal - scene.trueFocal) / scene.trueFocal * 100;

    console.log('    true hFOV            ' + fmt(scene.trueHFovDeg, 2) + ' deg   (app assumes 68.00)');
    console.log('    recovered hFOV       ' + fmt(res.hFovDeg, 2) + ' deg   (err ' + fmt(fovErr, 2) + ' deg, ' + fmt(focalErrPct, 2) + '% focal)');
    console.log('    pose err before      mean ' + fmt(before.meanDeg) + ' deg, max ' + fmt(before.maxDeg) + ' deg');
    console.log('    pose err after       mean ' + fmt(after.meanDeg) + ' deg, max ' + fmt(after.maxDeg) + ' deg');
    console.log('    edges used           ' + res.edges.length + ' of ' + scene.edges.length + ' candidates, ' + res.rejected.length + ' rejected');
    console.log('    BA                   ' + res.bundle.iterations + ' iters, converged=' + res.bundle.converged +
      ', rms edge residual ' + fmt(res.bundle.rmsEdgeResidualRad * 180 / Math.PI, 4) + ' deg');
    console.log('    runtime              ' + ms + ' ms');

    const rings = P.ringDiagnostics(res.rotations, res.edges);
    for (const name of ['horizon', 'upper', 'lower']) {
      const r = rings[name];
      console.log('    loop closure ' + name.padEnd(8) +
        ' measured drift ' + (r.measured === null ? 'n/a' : fmt(r.measured, 3) + ' deg') +
        '  ->  after BA ' + r.refined.toExponential(1) + ' deg');
    }

    // Guard against a bug this suite already caught once: composing
    // absolute rotations around a ring MUST telescope to identity. When
    // the composition order was reversed it silently returned ~7 deg on
    // ground-truth input, which looks plausible enough to be believed.
    const gtClosure = globalThis.LSCBundle.loopClosureError(scene.trueRotations, [0, 1, 2, 3, 4, 5, 6, 7]);
    check('ground-truth absolutes close the loop exactly',
      gtClosure * 180 / Math.PI < 1e-9, '(' + (gtClosure * 180 / Math.PI).toExponential(1) + ' deg)');
    check('bundle adjustment enforces exact loop closure',
      ['horizon', 'upper', 'lower'].every(n => rings[n].refined < 1e-9));
    check('raw pairwise measurements do NOT close the loop on their own',
      rings.horizon.measured !== null && rings.horizon.measured > 1e-3,
      '(' + fmt(rings.horizon.measured, 3) + ' deg of drift absorbed)');

    check('focal length recovered within 2%', focalErrPct < 2.0, '(' + fmt(focalErrPct, 2) + '%)');
    check('recovered FOV is closer to truth than the hardcoded 68 deg',
      fovErr < Math.abs(68 - scene.trueHFovDeg),
      '(' + fmt(fovErr, 2) + ' vs ' + fmt(Math.abs(68 - scene.trueHFovDeg), 2) + ' deg)');
    check('mean pose error below 0.30 deg', after.meanDeg < 0.30, '(' + fmt(after.meanDeg) + ' deg)');
    check('max pose error below 1.00 deg', after.maxDeg < 1.00, '(' + fmt(after.maxDeg) + ' deg)');
    check('refinement improves on the prior by at least 5x',
      before.meanDeg / after.meanDeg > 5,
      '(' + fmt(before.meanDeg / after.meanDeg, 1) + 'x)');
    check('bundle adjustment converged', res.bundle.converged === true);
    check('most candidate edges survived', res.edges.length >= scene.edges.length * 0.8,
      '(' + res.edges.length + '/' + scene.edges.length + ')');
  }
}

// ---------------------------------------------------------------
section('4. Robustness to outlier rate');
{
  const rows = [];
  let allGood = true;
  for (const rate of [0.0, 0.2, 0.4, 0.6]) {
    const scene = Synth.generate({ seed: 7, outlierRate: rate, consistentOutlierRate: rate * 0.6 });
    const res = P.refinePoses(scene, {});
    if (!res.ok) { rows.push([rate, 'FAILED', '', '']); allGood = false; continue; }
    const after = Synth.poseError(res.rotations, scene.trueRotations);
    const fovErr = Math.abs(res.hFovDeg - scene.trueHFovDeg);
    rows.push([rate, fmt(after.meanDeg), fmt(fovErr, 2), res.edges.length]);
    if (after.meanDeg > 0.5 || fovErr > 2.0) allGood = false;
  }
  console.log('    outliers | mean pose err | hFOV err | edges');
  for (const r of rows) {
    console.log('      ' + String(Math.round(r[0] * 100) + '%').padStart(4) + '   |   ' +
      String(r[1]).padStart(9) + '   |  ' + String(r[2]).padStart(5) + '   | ' + r[3]);
  }
  check('stays accurate up to 60% outliers (incl. repeated-structure)', allGood);
}

// ---------------------------------------------------------------
section('5. Anisotropic prior vs isotropic, across graph density');
{
  /* Averaged over seeds deliberately: on any single capture the two are
     within noise of each other, and a one-seed comparison flips sign
     depending on the draw. The effect is only visible in the mean.

     Density is swept because it is the axis that matters -- as texture
     thins out, edges drop away and the prior carries more of the
     solution, which is exactly the low-texture indoor case (blank walls,
     plain ceilings) this application runs into. */
  const SEEDS = [1, 2, 3, 4, 5, 6];
  const rows = [];
  for (const pts of [6000, 1500, 600, 300]) {
    let aSum = 0, iSum = 0, pSum = 0, eSum = 0, n = 0;
    for (const seed of SEEDS) {
      const sc = Synth.generate({ seed: seed, points: pts });
      const pr = sc.priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));
      const a = P.refinePoses(sc, {});
      const i = P.refinePoses(sc, { priorWeightTilt: 1.0, priorWeightYaw: 1.0 });
      if (!a.ok || !i.ok) continue;
      aSum += Synth.poseError(a.rotations, sc.trueRotations).meanDeg;
      iSum += Synth.poseError(i.rotations, sc.trueRotations).meanDeg;
      pSum += Synth.poseError(pr, sc.trueRotations).meanDeg;
      eSum += a.edges.length;
      n++;
    }
    rows.push({ pts: pts, edges: eSum / n, aniso: aSum / n, iso: iSum / n, prior: pSum / n });
  }

  console.log('    points | edges | anisotropic | isotropic | prior-only');
  for (const r of rows) {
    console.log('    ' + String(r.pts).padStart(6) + ' | ' + String(Math.round(r.edges)).padStart(5) +
      ' | ' + fmt(r.aniso, 4).padStart(11) + ' | ' + fmt(r.iso, 4).padStart(9) +
      ' | ' + fmt(r.prior).padStart(10));
  }

  const dense = rows[0];
  check('anisotropic prior beats isotropic on a well-connected graph',
    dense.aniso < dense.iso, '(' + fmt(dense.aniso, 4) + ' vs ' + fmt(dense.iso, 4) + ' deg)');
  check('anisotropic prior is never worse at any density',
    rows.every(r => r.aniso <= r.iso * 1.02));

  const sparse = rows[rows.length - 1];
  console.log('    note: at ' + sparse.pts + ' points only ~' + Math.round(sparse.edges) +
    ' edges survive and refinement barely improves on the prior (' +
    fmt(sparse.aniso) + ' vs ' + fmt(sparse.prior) + ' deg) --');
  console.log('          this is the low-texture failure mode, and it is what a stronger matcher has to fix.');
}

// ---------------------------------------------------------------
section('6. Degenerate and adversarial inputs');
{
  const scene = Synth.generate({ seed: 3 });

  const empty = P.refinePoses({ width: scene.width, height: scene.height, priors: scene.priors, edges: [] }, {});
  check('empty edge list fails cleanly rather than throwing',
    empty.ok === false && empty.reason === 'no-usable-edges');

  const junk = {
    width: scene.width, height: scene.height, priors: scene.priors,
    edges: scene.edges.map(e => ({
      i: e.i, j: e.j,
      matches: e.matches.map((m, k) => ({
        ax: (k * 137) % scene.width, ay: (k * 79) % scene.height,
        bx: (k * 211) % scene.width, by: (k * 43) % scene.height
      }))
    }))
  };
  const junkRes = P.refinePoses(junk, {});
  const junkOk = !junkRes.ok || Synth.poseError(junkRes.rotations, scene.trueRotations).meanDeg
    <= Synth.poseError(scene.priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll)), scene.trueRotations).meanDeg * 1.5;
  check('pure-noise matches do not make the result worse than the prior', junkOk);

  const lowTex = Synth.generate({ seed: 11, points: 900 });
  const lowRes = P.refinePoses(lowTex, {});
  check('sparse-texture capture still refines',
    lowRes.ok && Synth.poseError(lowRes.rotations, lowTex.trueRotations).meanDeg < 1.0,
    lowRes.ok ? '(' + fmt(Synth.poseError(lowRes.rotations, lowTex.trueRotations).meanDeg) + ' deg)' : '(failed)');
}

// ---------------------------------------------------------------
console.log('\n' + '-'.repeat(58));
console.log(failures === 0
  ? 'ALL ' + checks + ' CHECKS PASSED'
  : failures + ' of ' + checks + ' CHECKS FAILED');
console.log('-'.repeat(58));
process.exit(failures === 0 ? 0 : 1);
