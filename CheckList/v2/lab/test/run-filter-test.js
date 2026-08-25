/* Validates the One Euro angle filter (orientation.js) added to fix the
   "captured patches move a bit" report: raw deviceorientation readings
   were driving the live overlay with no smoothing at all. Checks the
   three properties that actually matter for that UX:

     1. it rejects small-amplitude jitter while the phone is held still
     2. it does NOT introduce a spurious jump when yaw wraps at +/-180deg
     3. it tracks a real, fast sweep without lagging so far behind that
        the overlay feels disconnected from the live camera

   Run: node lab/test/run-filter-test.js
*/
const { load } = require('./load.js');
load('orientation.js');
const O = globalThis.LSCOrientation;
const DEG = Math.PI / 180;

let failures = 0, checks = 0;
function check(name, cond, detail) {
  checks++; if (!cond) failures++;
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  ' + detail : ''));
}
const fmt = (v, d) => Number(v).toFixed(d === undefined ? 3 : d);

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function gauss(rnd) {
  let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

console.log('=== 1. angleDelta wraparound correctness ===');
{
  // angleDelta(a, b) is the signed, wrapped a - b (confirmed against the
  // implementation directly, not just asserted). +pi and -pi represent
  // the identical rotation, so cases are compared via angleDelta itself
  // (wrap-aware) rather than raw subtraction -- otherwise the
  // exactly-antipodal case is a coin flip between two equally correct
  // answers that differ numerically by 2*pi.
  const cases = [
    [179 * DEG, -179 * DEG, -2 * DEG],  // 179 - (-179) wraps to -2, not +2
    [-179 * DEG, 179 * DEG, 2 * DEG],
    [0, 0, 0],
    [90 * DEG, -90 * DEG, 180 * DEG],
    [1 * DEG, 359 * DEG, 2 * DEG]  // 359deg is itself outside (-pi,pi] to exercise mod handling
  ];
  let worst = 0;
  for (const [a, b, expected] of cases) {
    const got = O.angleDelta(a, b);
    worst = Math.max(worst, Math.abs(O.angleDelta(got, expected)));
  }
  check('angleDelta matches expected shortest-path deltas', worst < 1e-9, '(max err ' + worst.toExponential(2) + ')');
}

console.log('\n=== 2. Jitter rejection while held still ===');
{
  const rnd = makeRng(7);
  const f = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
  const trueYaw = 30 * DEG;
  const noiseDeg = 0.8; // representative of raw deviceorientation sample-to-sample noise
  let t = 0, dt = 1 / 60; // 60Hz
  let rawJitter = 0, filteredJitter = 0, n = 0;
  let out = f.filter(trueYaw, t);
  for (let i = 0; i < 300; i++) {
    t += dt;
    const raw = trueYaw + gauss(rnd) * noiseDeg * DEG;
    out = f.filter(raw, t);
    if (i > 30) { // let it settle first
      rawJitter += Math.abs(O.angleDelta(raw, trueYaw));
      filteredJitter += Math.abs(O.angleDelta(out, trueYaw));
      n++;
    }
  }
  const rawMeanDeg = (rawJitter / n) / DEG, filtMeanDeg = (filteredJitter / n) / DEG;
  console.log('    raw mean deviation      ' + fmt(rawMeanDeg, 3) + ' deg');
  console.log('    filtered mean deviation ' + fmt(filtMeanDeg, 3) + ' deg');
  check('filtered signal is calmer than raw while held still',
    filtMeanDeg < rawMeanDeg * 0.5, '(' + fmt(filtMeanDeg / rawMeanDeg, 2) + 'x of raw)');
  check('filtered signal stays close to true value (no steady-state bias)',
    filtMeanDeg < 0.5, '(' + fmt(filtMeanDeg, 3) + ' deg)');
}

console.log('\n=== 3. No spurious jump at the +/-180deg wrap ===');
{
  const f = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
  let t = 0, dt = 1 / 60;
  f.filter(179 * DEG, t);
  let maxStep = 0;
  // Sweep smoothly through the wrap boundary: 179 -> 180/-180 -> -179 -> ...
  const path = [];
  for (let i = 0; i <= 40; i++) path.push((179 - i * 0.5) * DEG); // 179 down through 159, wrapping representation not needed since caller always passes true continuous angle wrapped to (-pi,pi]
  // Actually drive it THROUGH the wrap explicitly, as the app's own wrap does:
  const sweep = [];
  for (let deg = 179; deg <= 185; deg += 0.5) {
    let a = deg; if (a > 180) a -= 360; // matches quaternionToYawPitchRoll's wrap to (-pi, pi]
    sweep.push(a * DEG);
  }
  let prev = f.filter(sweep[0], t);
  for (let i = 1; i < sweep.length; i++) {
    t += dt;
    const out = f.filter(sweep[i], t);
    const step = Math.abs(O.angleDelta(out, prev));
    maxStep = Math.max(maxStep, step);
    prev = out;
  }
  console.log('    max single-step change while crossing the wrap: ' + fmt(maxStep / DEG, 2) + ' deg');
  check('no discontinuous jump when yaw crosses +/-180deg',
    maxStep < 5 * DEG, '(' + fmt(maxStep / DEG, 2) + ' deg, expected a few tenths)');
}

console.log('\n=== 4. Tracks a real sweep without excessive lag ===');
{
  const f = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
  const rnd = makeRng(3);
  let t = 0, dt = 1 / 60;
  const sweepSpeed = 90 * DEG; // rad/s-equivalent: a brisk ~90deg/s hand sweep
  let trueYaw = 0;
  let out = f.filter(0, t);
  let maxLag = 0;
  for (let i = 0; i < 120; i++) { // 2 seconds of sweeping
    t += dt; trueYaw += sweepSpeed * dt;
    const raw = trueYaw + gauss(rnd) * 0.8 * DEG;
    out = f.filter(raw, t);
    if (i > 10) maxLag = Math.max(maxLag, Math.abs(O.angleDelta(trueYaw, out)));
  }
  console.log('    max lag during a ~90deg/s sweep: ' + fmt(maxLag / DEG, 2) + ' deg');
  check('lag during a fast sweep stays small enough to feel connected to the camera',
    maxLag < 12 * DEG, '(' + fmt(maxLag / DEG, 2) + ' deg)');
}

/* ===================== 5. OUTPUT STAYS WRAPPED =====================
   A 360 capture spins the phone through several full turns, and the
   filtered yaw is stored verbatim as each shot's recorded pose. The
   filter accumulates deltas internally (unwrapped, on purpose -- that is
   what keeps its arithmetic stable), so without an explicit wrap at the
   output boundary the returned value keeps climbing: past 360, past 720,
   and on a real 34-shot capture it reached 1844 degrees.

   That is not a cosmetic problem. fromYawPitchRoll() is fed those totals
   to build the pose prior, the prior gate then compares every candidate
   image pair against a prior that is wrong for most shots, and on the
   real capture that reproduced this it threw out 80 of 97 pairs --
   leaving too little of the view graph for refinement to run, so the app
   silently fell back to the unrefined sensor path every single time.
   The failure looked like "the ML did nothing", with no error anywhere. */
{
  console.log('\n=== 5. Filter output stays in (-180, 180] across many turns ===');
  const f = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
  const rnd = makeRng(99);
  let t = 0;
  const dt = 1 / 60;
  let trueYaw = 0;
  let out = f.filter(0, t);
  let maxAbs = 0;
  let worstTrackErr = 0;

  // Six full rotations, the way a scout sweeps a sphere.
  const turns = 6;
  const steps = Math.round(turns * 360 / 90 * 60); // at ~90 deg/s, 60 Hz
  for (let i = 0; i < steps; i++) {
    t += dt;
    trueYaw += 90 * DEG * dt;
    out = f.filter(O.wrapAngle(trueYaw + gauss(rnd) * 0.5 * DEG), t);
    maxAbs = Math.max(maxAbs, Math.abs(out));
    if (i > 20) worstTrackErr = Math.max(worstTrackErr, Math.abs(O.angleDelta(trueYaw, out)));
  }
  console.log('    after ' + turns + ' full turns: |output| max ' + fmt(maxAbs / DEG, 2) +
    ' deg, worst tracking error ' + fmt(worstTrackErr / DEG, 2) + ' deg');

  check('output never escapes (-180, 180] no matter how far the phone turns',
    maxAbs <= Math.PI + 1e-9, '(max |out| = ' + fmt(maxAbs / DEG, 2) + ' deg)');
  check('wrapping does not break tracking of the true heading',
    worstTrackErr < 12 * DEG, '(' + fmt(worstTrackErr / DEG, 2) + ' deg)');

  // wrapAngle itself, including inputs several turns out.
  let wrapWorst = 0;
  for (const a of [0, 1, -1, 179, 180, 181, 359, 361, 720, 1844, -1844, -540]) {
    const w = O.wrapAngle(a * DEG);
    if (w > Math.PI + 1e-9 || w <= -Math.PI - 1e-9) wrapWorst = Infinity;
    // Same direction on the circle as the input.
    wrapWorst = Math.max(wrapWorst, Math.abs(O.angleDelta(a * DEG, w)));
  }
  check('wrapAngle normalises arbitrary totals without changing direction',
    wrapWorst < 1e-9, '(max deviation ' + wrapWorst.toExponential(2) + ')');
}

console.log('\n' + '-'.repeat(58));
console.log(failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED' : failures + ' of ' + checks + ' CHECKS FAILED');
console.log('-'.repeat(58));
process.exit(failures === 0 ? 0 : 1);
