/* ===================== CAPTURE PATTERN COVERAGE =====================
   How much of the sphere a capture pattern reaches, and how much of it it
   reaches TWICE, as a function of the lens it is shot with.

   This is the measurement that decides how many photos the guided capture
   asks for. It is also the one quantity no amount of stitching work can
   improve: a direction no frame contains is a hole, and gapFill() can
   only inpaint it from its neighbours. The 34-shot pattern's docstring in
   capture360.js quotes numbers from a script that was written once and
   never committed, so those claims could not be rechecked when the lens
   assumption changed. This file is that script, kept.

   METHOD. Sample the sphere on a Fibonacci lattice, which is equal-area,
   so every sample carries the same solid angle and coverage is a plain
   count. For each sample, back-project it into every view using
   pano/camera.js -- the SAME projection the stitcher forward-scatters
   with -- and evaluate pano-stitch-worker.js's separable feather there.

   Back-projecting rather than scattering is deliberate. The worker walks
   source pixels and lands them on an equirect grid, which near a pole has
   far more columns than there are samples pointing at it; that speckle is
   a property of the output grid, not of the capture, and measureCoverage()
   in the worker already goes to some trouble to avoid being fooled by it.
   Asking "is this direction inside any frame" removes the question.

   WHY IT COUNTS OVERLAP, NOT JUST COVERAGE. Plain coverage turned out to
   be useless for choosing between patterns: it saturates. Phone stills
   are PORTRAIT, so the vertical field is a third wider than the
   horizontal one, and rings only have to abut for every direction to fall
   inside some frame. At a 46.6 deg lens -- the value calibrated from a
   real capture -- an 8-shot ring at 45 deg spacing leaves consecutive
   frames overlapping by 1.6 deg, and bare coverage still reports 100%.
   That number is true and worthless. Overlap of a degree or two is
   nothing to the eye, nothing to a feature matcher, and nothing to a
   best-pixel blend that needs two candidates before it can choose.

   So a view counts as USEFULLY seeing a direction only when its feather
   there is at least USEFUL_FEATHER: not merely inside the frame, but far
   enough from the border that the stitcher gives it real weight. The
   headline numbers are how much of the sphere is usefully seen at all,
   and how much of it is usefully seen by at least two frames.

   Run: node lab/test/run-pattern-coverage.js [--samples N]
*/
const { load } = require('./load.js');

['pano/so3.js', 'pano/camera.js'].forEach(load);
const S = globalThis.LSCSO3, C = globalThis.LSCCamera;
const DEG = Math.PI / 180;

/* Frame shape of the source photos. Portrait 3:4, matching the real
   capture (3024x4032) and every phone still the app has seen. The
   stitcher derives its vertical FOV from the decoded frame the same way,
   so this is not a free parameter. */
const SRC_W = 3024, SRC_H = 4032;

/* Swept across the frame WIDTH, which is the short axis on a portrait
   frame. 45 is below the narrowest lens measured (46.6 deg on a real
   capture); 78 is above the widest the app's guide overlay assumes. The
   true FOV is unknown while the photos are being taken -- it is
   calibrated afterwards, from the photos -- so a pattern is only as good
   as its worst case over this whole range. */
const FOV_LO = 45, FOV_HI = 78, FOV_STEP = 3;

/* Feather below which a view is not really contributing. cos(|n|*pi/2)
   falls to 0.15 at |n| = 0.90, so this is "inside the central 90% of the
   frame on both axes" -- the region whose pixels survive blending rather
   than being feathered away against whatever else is there. */
const USEFUL_FEATHER = 0.15;

// The worker's own gate, kept for continuity with the numbers already
// quoted in capture360.js and in the paper.
const REACHED_EPS = 1e-4;

const argSamples = (() => {
  const i = process.argv.indexOf('--samples');
  return i > 0 ? Number(process.argv[i + 1]) : 0;
})();
const SAMPLES = argSamples > 0 ? argSamples : 20000;

let failures = 0, checks = 0;
function check(name, cond, detail) {
  checks++; if (!cond) failures++;
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  ' + detail : ''));
}
const f2 = (v, d) => Number(v).toFixed(d === undefined ? 2 : d);
const pct = (v, d) => f2(v * 100, d === undefined ? 1 : d) + '%';

/* Fibonacci lattice: equal-area by construction, and unlike a lat/lon
   grid it has no pole pile-up that would silently weight the two hardest
   directions far above their true solid angle. */
function sphereSamples(n) {
  const pts = new Float64Array(n * 3);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const th = ga * i;
    // World axes match the stitcher: +z up, yaw measured from +y.
    pts[i * 3] = r * Math.cos(th);
    pts[i * 3 + 1] = r * Math.sin(th);
    pts[i * 3 + 2] = z;
  }
  return pts;
}

// ---- candidate patterns -------------------------------------------------

/* Rings are staggered by half a step against the ring below, so that
   ring-to-ring overlap lands where a frame corner would otherwise meet
   another frame corner. */
function ring(n, pitchDeg, stagger) {
  const t = [];
  for (let i = 0; i < n; i++) t.push({ yaw: i * (360 / n) + (stagger || 0), pitch: pitchDeg });
  return t;
}
const POLES = [{ yaw: 0, pitch: 90 }, { yaw: 0, pitch: -90 }];
function pattern(parts) {
  return [].concat.apply([], parts).map(p => ({ yaw: p.yaw * DEG, pitch: p.pitch * DEG }));
}

const CANDIDATES = [
  /* What ships. Three rows of 12 at 0 and +/-45, no pole shots -- the
     pattern Stanford's VFT Photosphere Camera uses. It does NOT cover the
     whole sphere and is not meant to; see buildTargetPattern() in
     capture360.js for the reasoning and the sizes below for the cost. */
  { name: '12/12/12 at 0,+/-45, no poles  (ships)',
    shots: pattern([ring(12, 0), ring(12, 45, 15), ring(12, -45, 15)]) },
  { name: '8/8/8 + 4/4 + poles  (older)',
    shots: pattern([ring(8, 0), ring(8, 33, 22.5), ring(8, -33, 22.5),
                    ring(4, 66), ring(4, -66), POLES]) },
  { name: '10/10/10 + 4/4 + poles',
    shots: pattern([ring(10, 0), ring(10, 33, 18), ring(10, -33, 18),
                    ring(4, 66), ring(4, -66), POLES]) },
  { name: '12/12/12 + poles',
    shots: pattern([ring(12, 0), ring(12, 33, 15), ring(12, -33, 15), POLES]) },
  { name: '12/12/12 + 4/4',
    shots: pattern([ring(12, 0), ring(12, 33, 15), ring(12, -33, 15),
                    ring(4, 66), ring(4, -66)]) },
  { name: '12/12/12 + 4/4 + poles  (full-sphere option)',
    shots: pattern([ring(12, 0), ring(12, 33, 15), ring(12, -33, 15),
                    ring(4, 66), ring(4, -66), POLES]) }
];

// ---- measurement --------------------------------------------------------

/* Per sample and per view, the ray in that view's camera frame reduced to
   its two projective coordinates x/z and y/z. These do not depend on the
   focal length at all, so the whole FOV sweep costs two divisions per
   entry instead of a fresh rotation. z <= 0 (behind the lens) is stored
   as NaN and skipped. */
function projectAll(shots, pts, n) {
  const rots = shots.map(t => S.fromYawPitchRoll(t.yaw, t.pitch, 0));
  const V = shots.length;
  const uv = new Float64Array(n * V * 2);
  for (let v = 0; v < V; v++) {
    const Rt = S.transpose(rots[v]);
    for (let i = 0; i < n; i++) {
      const c = S.apply(Rt, S.vec(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]));
      const o = (i * V + v) * 2;
      if (c.z <= 1e-9) { uv[o] = NaN; uv[o + 1] = NaN; }
      else { uv[o] = c.x / c.z; uv[o + 1] = c.y / c.z; }
    }
  }
  return uv;
}

function measure(uv, n, V, hFovDeg) {
  const tanH = Math.tan(hFovDeg * DEG / 2);
  const tanV = tanH * (SRC_H / SRC_W);
  let reached = 0, useful = 0, overlapped = 0;
  for (let i = 0; i < n; i++) {
    let wsum = 0, nUseful = 0;
    for (let v = 0; v < V; v++) {
      const o = (i * V + v) * 2;
      const x = uv[o];
      if (x !== x) continue;                 // behind the lens
      const nx = x / tanH;
      if (nx > 1 || nx < -1) continue;
      const ny = uv[o + 1] / tanV;
      if (ny > 1 || ny < -1) continue;
      // pano-stitch-worker.js's separable feather, unmodified.
      const w = Math.cos(Math.abs(nx) * Math.PI / 2) * Math.cos(Math.abs(ny) * Math.PI / 2);
      wsum += w;
      if (w >= USEFUL_FEATHER) nUseful++;
    }
    if (wsum > REACHED_EPS) reached++;
    if (nUseful >= 1) useful++;
    if (nUseful >= 2) overlapped++;
  }
  return { reached: reached / n, useful: useful / n, overlapped: overlapped / n };
}

// ---- report -------------------------------------------------------------

const pts = sphereSamples(SAMPLES);
const fovs = [];
for (let f = FOV_LO; f <= FOV_HI + 1e-9; f += FOV_STEP) fovs.push(f);

console.log('Sphere coverage by capture pattern');
console.log('  ' + SAMPLES + ' equal-area samples, ' + SRC_W + 'x' + SRC_H +
  ' portrait frames, FOV quoted across the frame WIDTH');
console.log('  a view "usefully sees" a direction when its feather there is >= ' +
  USEFUL_FEATHER + '\n');

const rows = [];
for (const cand of CANDIDATES) {
  const V = cand.shots.length;
  const uv = projectAll(cand.shots, pts, SAMPLES);
  const m = fovs.map(f => measure(uv, SAMPLES, V, f));
  rows.push({
    name: cand.name, shots: V, m: m,
    worstUseful: Math.min.apply(null, m.map(x => x.useful)),
    worstOverlap: Math.min.apply(null, m.map(x => x.overlapped)),
    worstReached: Math.min.apply(null, m.map(x => x.reached))
  });
}

function table(title, pick) {
  console.log('   ' + title);
  process.stdout.write('     pattern'.padEnd(42) + 'shots');
  for (const f of fovs) process.stdout.write(('' + f).padStart(7));
  console.log('');
  for (const r of rows) {
    process.stdout.write('     ' + r.name.padEnd(37) + ('' + r.shots).padStart(5));
    for (const x of r.m) process.stdout.write(pct(pick(x)).padStart(7));
    console.log('');
  }
  console.log('');
}

table('sphere usefully seen by at least ONE frame', x => x.useful);
table('sphere usefully seen by at least TWO frames (overlap the blend can use)', x => x.overlapped);

console.log('   worst case across the whole 45-78 deg sweep');
console.log('     pattern'.padEnd(42) + 'shots' + '    reached   1 frame   2 frames');
for (const r of rows) {
  console.log('     ' + r.name.padEnd(37) + ('' + r.shots).padStart(5) + '   ' +
    pct(r.worstReached, 2).padStart(8) + '  ' + pct(r.worstUseful, 2).padStart(8) +
    '  ' + pct(r.worstOverlap, 2).padStart(9));
}

/* DECISION RULE.

   Full one-frame coverage across the entire sweep is mandatory and comes
   first: a direction no frame contains is a hole, and no stitcher, blend
   mode or pose refinement can fill one. That requirement alone eliminates
   12/12/12 + poles, which answers the open question about whether the
   +/-66 rings are load-bearing. They are: without them the band between
   the +/-33 ring's top edge and a single pole shot opens up at 95.0% by
   45 deg, and two-frame overlap never exceeds 97.5% even at 78 deg.

   Among the patterns that do cover, take the one with the most two-frame
   overlap rather than the fewest shots. Overlap is the entire reason this
   phase exists -- the shipping 34-shot pattern already covers, and still
   produced doubled edges, because at the 46.6 deg lens a real capture
   calibrated to, consecutive horizon frames overlap by 1.6 deg. Both the
   feature matcher and the best-pixel blend need two candidates before
   they can do anything at all, and below about 60 deg the 34-shot pattern
   does not give them one over half the sphere.

   The cheaper full-coverage options are printed too, because "smallest
   that covers" is a defensible rule and the reader should see what it
   would have chosen and what that costs in overlap. */
/* Two levels, because they answer different questions. `reached` at 100%
   means there is no hole -- every direction is inside some frame, even if
   only near its border. `useful` is the stricter one, and it is allowed a
   hair under 100% at the very bottom of the sweep: at 45 deg the 46-shot
   pattern leaves about 0.02% of the sphere seen only within a frame's
   outer tenth, which is a pinhole a few square degrees across at a lens
   narrower than any yet measured, and closing it would cost another ring. */
const covers = rows.filter(r => r.worstReached >= 0.9999 && r.worstUseful >= 0.999);
const shipRow = rows[0];
const byOverlap = covers.slice().sort((a, b) => b.worstOverlap - a.worstOverlap);
console.log('');
console.log('   patterns with full coverage across 45-78 deg, by worst-case overlap');
for (const r of byOverlap) {
  console.log('     ' + r.name.padEnd(37) + ('' + r.shots).padStart(5) + '   ' +
    pct(r.worstOverlap).padStart(7) + ' two-frame overlap at 45 deg');
}
if (byOverlap.length) {
  console.log('   -> ' + byOverlap[0].name + ' (' + byOverlap[0].shots + ' shots)');
} else {
  console.log('   NO candidate covers the whole sphere across the sweep.');
}

// What the app actually builds today, via the shipping module.
const shipped = C.buildTargetPattern();
const shippedUv = projectAll(shipped, pts, SAMPLES);
const shippedM = fovs.map(f => measure(shippedUv, SAMPLES, shipped.length, f));
const shippedUseful = Math.min.apply(null, shippedM.map(x => x.useful));
const shippedOverlap = Math.min.apply(null, shippedM.map(x => x.overlapped));

console.log('\n=== Checks ===');
check('the shipping pattern is one of the measured candidates',
  rows.some(r => r.shots === shipped.length && Math.abs(r.worstUseful - shippedUseful) < 1e-9),
  shipped.length + ' shots');
/* The shipping pattern deliberately does not reach the poles, so the
   checks below bound the shortfall rather than forbidding it. Both
   directions matter: too much missing means the rings have stopped
   meeting each other, and nothing missing would mean this is measuring a
   pattern the app does not use. */
const shippedReached = Math.min.apply(null, shippedM.map(x => x.reached));
check('the shipping pattern leaves the poles, and only the poles, unphotographed',
  shippedReached >= 0.94 && shippedReached < 0.999,
  'worst ' + pct(shippedReached, 2) + ' reached, at ' +
  fovs[shippedM.map(x => x.reached).indexOf(shippedReached)] + ' deg');
check('what it does reach, it reaches everywhere between the rings',
  shippedM[fovs.length - 1].useful >= 0.999,
  pct(shippedM[fovs.length - 1].useful, 2) + ' at ' + fovs[fovs.length - 1] +
  ' deg, where the frame is tall enough to close the caps');
/* Overlap is what the phase this pattern came from exists to buy, and it
   is the number that must NOT regress: below about 60% the feature
   matcher and the best-pixel blend both start running out of second
   opinions. At a lens wide enough to close the poles, every direction
   should have a second frame. */
check('two frames see most of the sphere even at the narrowest lens',
  shippedOverlap >= 0.60,
  'worst ' + pct(shippedOverlap, 2) + ' at ' +
  fovs[shippedM.map(x => x.overlapped).indexOf(shippedOverlap)] + ' deg');
check('two frames see all of it once the lens closes the poles',
  shippedM[fovs.length - 1].overlapped >= 0.999,
  pct(shippedM[fovs.length - 1].overlapped, 2) + ' at ' + fovs[fovs.length - 1] + ' deg');
/* A full-sphere pattern is still measured and still available, because
   the reason for dropping the pole shots is an indoor one (whatever is
   overhead is usually the closest thing in the room, and a rotation-only
   stitcher cannot register a close object). Outdoors that reasoning does
   not apply, and this is the row to read. */
check('a full-sphere option is still on the table for captures that need it',
  covers.length > 0,
  covers.length ? covers.map(r => r.shots + ' shots').join(', ') : 'none');
check('coverage never improves as the lens gets narrower',
  rows.every(r => r.m[0].useful <= r.m[r.m.length - 1].useful + 1e-9),
  'sanity check on the sweep direction');
check('a horizon-only ring is correctly reported as a gap',
  (() => {
    const horizon = pattern([ring(8, 0)]);
    const u = projectAll(horizon, pts, SAMPLES);
    // Portrait frames are tall, so one ring still covers a wide band --
    // the point is that it cannot reach the poles and the measure says so.
    return measure(u, SAMPLES, horizon.length, 68).useful < 0.75;
  })(), 'the measure can fail, not only pass');

console.log('\n' + '-'.repeat(60));
console.log(failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED'
  : failures + ' OF ' + checks + ' CHECKS FAILED');
console.log('-'.repeat(60));
process.exit(failures === 0 ? 0 : 1);
