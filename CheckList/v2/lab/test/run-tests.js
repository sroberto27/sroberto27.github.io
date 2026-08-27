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
load('orientation.js');   // the sensor side of the pose round trip

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
section('0. Capture pattern is in step with the shipping app');
{
  /* pano/camera.js keeps a copy of the capture pattern so the offline
     harnesses don't have to load the capture UI. That copy went stale
     once already -- it stayed at 26 shots after capture360.js moved to
     34, so the evaluation silently measured a pattern the app no longer
     used. Rather than trust a comment telling people to keep them in
     sync, execute capture360.js's real function and compare. */
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'capture360.js'), 'utf8');

  const m = src.match(/function buildTargetPattern\(\)\s*\{[\s\S]*?\n  \}/);
  let appPattern = null;
  if (m) {
    const DEG = Math.PI / 180;
    appPattern = new Function('DEG', m[0] + '; return buildTargetPattern();')(DEG);
  }
  check('capture360.js buildTargetPattern() could be extracted', !!appPattern);

  if (appPattern) {
    const labPattern = C.buildTargetPattern();
    let maxDiff = 0;
    const sameLength = appPattern.length === labPattern.length;
    if (sameLength) {
      for (let i = 0; i < appPattern.length; i++) {
        maxDiff = Math.max(maxDiff,
          Math.abs(appPattern[i].yaw - labPattern[i].yaw),
          Math.abs(appPattern[i].pitch - labPattern[i].pitch));
      }
    }
    check('pano/camera.js pattern matches capture360.js exactly',
      sameLength && maxDiff < 1e-12,
      '(' + appPattern.length + ' vs ' + labPattern.length + ' shots' +
      (sameLength ? ', max angle diff ' + maxDiff.toExponential(1) : '') + ')');
  }
}

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

  /* What is claimed here changed when the capture pattern went from 8 to
     12 shots per ring. That doubled the view graph -- 109 edges to 224 at
     6000 points -- and on a graph that well connected the prior barely
     participates in the solution at all: both variants land inside 0.03
     deg of truth and which one wins is noise (they have traded places
     between runs). Asserting that the anisotropic prior wins there would
     be asserting noise, so the dense case now asserts the thing that is
     actually true and actually useful: at that density the prior does not
     matter, and neither choice can hurt you.

     The anisotropic prior earns its place as the graph thins, which is
     the low-texture indoor case this application keeps meeting -- blank
     walls and plain ceilings yield few keypoints no matter how many
     photos are taken, so a denser pattern does not rescue it. That is
     where the second check lives now. */
  const SHOTS = C.buildTargetPattern().length;
  const dense = rows[0];
  check('on a well-connected graph the prior barely matters either way',
    Math.abs(dense.aniso - dense.iso) < 0.02 && dense.aniso < 0.05 && dense.iso < 0.05,
    '(' + fmt(dense.aniso, 4) + ' vs ' + fmt(dense.iso, 4) + ' deg)');
  /* "Thin" is expressed per view rather than as an absolute edge count,
     because an absolute one silently stops meaning anything when the
     capture pattern changes: 200 edges was a well-connected graph on the
     46-shot pattern and is more than the 36-shot pattern ever produces.
     Each rotation carries 3 degrees of freedom, so a graph averaging
     fewer than three edges per view is under-constrained by construction,
     and that is where a prior has to carry the solution. */
  const thin = rows.filter(r => r.edges < 3 * SHOTS);
  check('anisotropic prior is decisively better once the graph is thin',
    thin.length > 0 && thin.every(r => r.aniso < r.iso * 0.9),
    '(under ' + (3 * SHOTS) + ' edges: ' +
    thin.map(r => fmt(r.aniso, 3) + ' vs ' + fmt(r.iso, 3)).join(', ') + ' deg)');

  const sparse = rows[rows.length - 1];
  console.log('    note: at ' + sparse.pts + ' points only ~' + Math.round(sparse.edges) +
    ' edges survive and refinement barely improves on the prior (' +
    fmt(sparse.aniso) + ' vs ' + fmt(sparse.prior) + ' deg) --');
  console.log('          this is the low-texture failure mode, and it is what a stronger matcher has to fix.');
}

// ---------------------------------------------------------------
section('5b. Pose parameterisation survives the poles');
{
  /* The capture pattern aims a shot at true zenith and true nadir, so the
     yaw/pitch/roll parameterisation has to stay exact THERE, not merely
     away from there. It did not.

     so3.fromYawPitchRoll built its roll reference as a normalised
     cross(forward, worldUp) and, when |forward.z| > 0.999, substituted
     (1,0,0) instead -- a threshold of |pitch| > 87.44 deg, which the pole
     targets sit inside by design. The substitution discards yaw, so the
     frame came back turned by whatever the yaw happened to be. On a real
     46-shot capture the nadir frame was rotated 121 deg about its own view
     axis, because that shot was taken at pitch -89.6 with yaw 121.4, and
     the floor of the panorama was smeared accordingly.

     Nothing caught it, and the reason is worth remembering: all four
     copies of the function -- so3, the stitch worker, the capture overlay,
     the 3D preview -- shared the substitution, so every test that compared
     them to each other agreed. What they did not agree with was
     orientation.js, which measures roll against the projected world-up
     with no such guard, and which is where poses actually come from. So
     this checks the round trip through the SENSOR path, not the internal
     one. */
  const O = globalThis.LSCOrientation;
  const DEG = Math.PI / 180;
  function qMul(a, b) {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    };
  }
  function qAxis(ax, ang) {
    const h = ang / 2, si = Math.sin(h);
    return { w: Math.cos(h), x: ax[0] * si, y: ax[1] * si, z: ax[2] * si };
  }
  const angBetween = (a, b) =>
    Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))) / DEG;

  let worstF = 0, worstU = 0, worstAt = 0;
  for (const pitchDeg of [0, 30, 60, 80, 85, 86, 87, 87.4, 87.5, 88, 89, 89.5, 89.9, -87.5, -89.5]) {
    for (const yawDeg of [0, 40, 121.4, -95]) {
      const q = qMul(qMul(qAxis([0, 0, 1], -yawDeg * DEG), qAxis([1, 0, 0], (90 - pitchDeg) * DEG)),
        qAxis([0, 0, 1], 25 * DEG));
      const ypr = O.quaternionToYawPitchRoll(q, 0);
      const R = S.fromYawPitchRoll(ypr.rawYaw, ypr.pitch, ypr.roll);
      const fErr = angBetween(O.normalize(O.rotateVec(q, { x: 0, y: 0, z: -1 })), S.column(R, 2));
      const uErr = angBetween(O.normalize(O.rotateVec(q, { x: 0, y: 1, z: 0 })), S.column(R, 1));
      if (fErr > worstF) worstF = fErr;
      if (uErr > worstU) { worstU = uErr; worstAt = pitchDeg; }
    }
  }
  check('a sensor pose survives yaw/pitch/roll and back, view axis',
    worstF < 1e-6, '(worst ' + worstF.toExponential(1) + ' deg)');
  check('a sensor pose survives yaw/pitch/roll and back, UP axis, including at the poles',
    worstU < 1e-6, '(worst ' + worstU.toExponential(1) + ' deg, at pitch ' + worstAt + ')');

  // The internal pair has to stay an exact inverse there too, or bundle
  // adjustment and the stitcher disagree about what a refined pose means.
  let worstRt = 0;
  for (const pitchDeg of [0, 60, 87, 87.5, 89, 89.9, -89.9]) {
    for (const rollDeg of [0, 30, -106.1]) {
      const R = S.fromYawPitchRoll(121.4 * DEG, pitchDeg * DEG, rollDeg * DEG);
      const ypr = S.toYawPitchRoll(R);
      const R2 = S.fromYawPitchRoll(ypr.yaw, ypr.pitch, ypr.roll);
      for (let c = 0; c < 3; c++) {
        worstRt = Math.max(worstRt, angBetween(S.column(R, c), S.column(R2, c)));
      }
    }
  }
  check('toYawPitchRoll and fromYawPitchRoll stay exact inverses at the poles',
    worstRt < 1e-6, '(worst ' + worstRt.toExponential(1) + ' deg)');

  // And the frame must not jump as a shot creeps up on the zenith, which
  // is the shape the bug actually took.
  let worstJump = 0, jumpAt = 0;
  for (let p = 80; p < 89.99; p += 0.01) {
    const a = S.fromYawPitchRoll(121.4 * DEG, p * DEG, -106.1 * DEG);
    const b = S.fromYawPitchRoll(121.4 * DEG, (p + 0.01) * DEG, -106.1 * DEG);
    const j = angBetween(S.column(a, 0), S.column(b, 0));
    if (j > worstJump) { worstJump = j; jumpAt = p; }
  }
  check('the camera frame is continuous all the way to the pole',
    worstJump < 0.05, '(worst step ' + worstJump.toFixed(4) + ' deg near pitch ' + jumpAt.toFixed(2) + ')');
}

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
