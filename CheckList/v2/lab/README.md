# 360 Pose Refinement Lab

Standalone research harness for improving the guided 360 capture. **Nothing in
this folder is loaded by the checklist app** — `index.html` at the app root does
not reference any of it, and this code never writes to the app's data.

It implements Phase 0 of the research plan (`../docs/360-Stitching-Research-Plan.docx`):
the classical baseline that every later learned method has to beat.

## What it does

The shipped stitcher (`../pano-stitch-worker.js`) projects every pixel using the
recorded device orientation and a hardcoded `ASSUMED_H_FOV_DEG = 68`, with no
visual correction anywhere. This pipeline adds the missing correction stage:

1. **XFeat** feature extraction per view (~0.66M params, runs in-browser)
2. **Prior-gated matching** — the sensor pose predicts where each keypoint should
   land, so only a small disc of candidates is compared (~5x fewer comparisons,
   and it rejects repeated-structure false matches before RANSAC can build a
   consensus around them)
3. **Focal self-calibration** — recovers the true FOV, retiring the 68° guess
4. **Rotation-only spherical bundle adjustment** — one globally consistent pose
   set, anchored to the prior with anisotropic weights (tilt is gravity-referenced
   and trustworthy; yaw drifts indoors), with loop closure enforced

## Replaying a real capture

The synthetic harness has zero parallax by construction and perfect ground
truth, which makes it ideal for regression-testing geometry and useless for
judging what a handheld capture actually looks like. `replay.html` closes that
gap:

1. In the app's 360° capture screen, tap **Save photos (.zip)** before
   generating. That writes every source frame plus a `metadata.json` holding
   the per-shot yaw/pitch/roll, the capture pattern, and the device details.
2. Serve this folder over HTTP (module workers need a real origin — `file://`
   will not work) and open `lab/replay.html`.
3. Drop the archive in, then **Run** or **A/B: sensor vs enhanced**.

It drives the *shipping* workers — `../pano-refine-worker.js` and
`../pano-stitch-worker.js` — unmodified, so a result there is what the phone
would have produced given the same memory budget. It reports sphere coverage,
recovered FOV, mean pose correction, match-graph size and timing, and the
panorama is downloadable.

## Layout

The pipeline modules are the SHIPPING copies under `../pano/` — the lab loads
those directly rather than keeping its own, so the two cannot drift:

```
../pano/            shipping pipeline (loaded by both the app and these tests)
  so3.js              rotation math; mirrors the worker's basisForOrientation
  camera.js           pinhole + equirect projection + the capture pattern
  estimate.js         Wahba/Davenport rotation solve, RANSAC, prior gate
  calibrate.js        focal self-calibration
  bundle.js           pose-graph bundle adjustment (LM), loop-closure diagnostics
  pipeline.js         orchestration
  stitch.js           headless equirect stitcher (mirrors pano-stitch-worker.js)
  xfeat-extractor.js  onnxruntime-web session + NMS/top-K/descriptor sampling
  xfeat-match.js      mutual-NN matching with the geometric gate
../vendor/          onnxruntime-web + xfeat.onnx (see "Vendored files" below)

lab/
  test/               node test suites + synthetic scene generators
  tools/              fixture generation
  index.html, lab.js  the lab page
  lab-boot.js         loads onnxruntime-web for the lab page
  runtime-smoketest.html   real-worker/model smoke test
  viewer-flip-test.html    panorama-viewer orientation regression test
```

## Running the tests

No browser needed. All four suites run in Node:

```bash
node lab/test/run-tests.js                  # geometry vs synthetic ground truth (22 checks)
node lab/test/run-filter-test.js            # orientation smoothing filter (5 checks)

python lab/tools/xfeat_fixture.py           # needs: pip install onnx onnxruntime numpy
node lab/test/run-xfeat-test.js .fixture    # full chain, real model (11 checks)

node --max-old-space-size=3072 lab/test/run-stitch-eval.js --png   # error decomposition (6 checks)
```

The second one renders views off a synthetic panorama at a known focal length and
known rotations, runs the real XFeat ONNX model, and drives the actual browser-side
detection, descriptor sampling, matching and geometry code. The only thing it
cannot cover is onnxruntime-web itself, which needs a real device.

## Running the lab page

Needs a real HTTP server — `file://` will not load WASM or the model.

```bash
python -m http.server 8000      # from CheckList/v2
# then open http://localhost:8000/lab/
```

**Important — the origin has to match.** The lab reads capture sessions straight
out of the app's IndexedDB (`lsc2_media`), and IndexedDB is per-origin. So the lab
only sees captures made from the *same* scheme+host+port. Captures made on the
deployed GitHub Pages site are not visible to a `localhost` lab, and vice versa.
To work with real field captures, either deploy `lab/` alongside the app or make
the test captures against the same local server.

## Runtime smoke test

`lab/runtime-smoketest.html` loads `pano-refine-worker.js` exactly the way a real
capture does — real `onnxruntime-web`, real `xfeat.onnx`, real inference — against
four throwaway synthetic images, and reports pass/fail into the DOM. It needs no
camera, no capture session, and no phone, so it is the fastest way to catch a
vendor-path or MIME regression (this caught a real one: `wasmPaths` was being
passed as `'vendor/'`, but `onnxruntime-web` resolves that *relative to its own
script location*, not the page — since the bundle already lives in `vendor/`,
this doubled to `vendor/vendor/...` and 404'd. Fixed by not overriding
`wasmPaths` at all when the runtime and model are co-located; see the comment in
`pano/xfeat-extractor.js`).

Drive it headlessly with Puppeteer against `pano-refine-worker.js`'s real
`postMessage` result (a plain `--dump-dom` won't work — the worker's async
model load needs real wall-clock time to complete, and `--virtual-time-budget`
does not reliably advance it):

```js
const page = await browser.newPage();
await page.goto('http://localhost:8000/lab/runtime-smoketest.html');
await page.waitForFunction(
  () => /^(RESULT|FAIL)/.test(document.getElementById('result').textContent),
  { timeout: 45000, polling: 500 }
);
```

A healthy run reports `RESULT {"type":"skipped","reason":"no-usable-edges"}` —
the four synthetic images share no real overlap, so the worker correctly
declines rather than fabricating a geometric solution; the point of the test is
that it gets that far (model fetched, session created, inference run) at all.

## Viewer flip regression test

`lab/viewer-flip-test.html` renders a synthetic top-red(ceiling)/bottom-blue(floor)
equirect image through the real, unmodified `panorama-viewer.js`, drags the
real viewer via real `PointerEvent`s, and reads back the rendered canvas —
this is how a genuine bug was caught: `UNPACK_FLIP_Y_WEBGL` was set to `true`,
which swapped ceiling and floor in every 360 preview. Root cause and fix are
documented at the call site in `panorama-viewer.js`; the short version is that
"flip Y" is the standard fix for a full-screen-quad shader sampled with its
own vertex UVs, and exactly the wrong thing for this shader, which computes
`uv` directly from spherical lon/lat and samples `texture2D()` with it as a
raw texture coordinate — there's no quad-UV step for the flip to cancel
against.

Same driving pattern as the runtime smoke test (a `--dump-dom` timing hack
won't work; use `page.waitForFunction` against the result text):

```js
await page.goto('http://localhost:8000/lab/viewer-flip-test.html');
await page.waitForFunction(
  () => /^(PASS|FAIL)/.test(document.getElementById('result').textContent),
  { timeout: 20000, polling: 300 }
);
```

One thing this test's harness has to work around, worth knowing if you extend
it: `panorama-viewer.js` correctly omits `preserveDrawingBuffer` (it costs
performance and the on-screen result is unaffected — the compositor keeps
showing the last drawn frame between interactions). But that means an
*external* async readback, like this test's `drawImage`-based color sample
running on a later `setTimeout` tick, can legitimately see a browser-cleared
buffer and read back solid black. The test monkey-patches
`HTMLCanvasElement.prototype.getContext` to inject
`preserveDrawingBuffer: true` for its own readback only — never do this in
the shipped viewer itself.

## Vendored files

`vendor/` holds ~17 MB that is **not** currently gitignored, because GitHub Pages
serves straight from the repo — ignoring it would make the lab undeployable. That
is a real decision to make deliberately:

| File | Size | Source |
|---|---|---|
| `xfeat.onnx` | 2.8 MB | [kornia/xfeat](https://huggingface.co/kornia/xfeat) `xfeat_backbone.onnx`, external data merged into one file. Apache-2.0. |
| `ort-wasm-simd-threaded.wasm` | 14.0 MB | onnxruntime-web 1.29.0, MIT |
| `ort-wasm-simd-threaded.mjs` | 24 KB | onnxruntime-web 1.29.0, MIT |
| `ort.wasm.min.js` | 50 KB | onnxruntime-web 1.29.0, MIT |

Alternatives if 17 MB in the repo is unwelcome: gitignore `vendor/` and keep the
lab local-only, or load onnxruntime from a CDN (fine for the lab; reconsider before
shipping anything to the app itself).

## Deployment constraints that shaped the design

- **GitHub Pages cannot set COOP/COEP headers**, so `crossOriginIsolated` is false,
  `SharedArrayBuffer` is unavailable, and multi-threaded WASM cannot start. The
  runtime is configured single-threaded (`numThreads = 1`). A `coi-serviceworker`
  shim can force isolation but adds iOS risk.
- **WebGPU/JSEP is avoided** — see
  [microsoft/onnxruntime#26827](https://github.com/microsoft/onnxruntime/issues/26827)
  for the Safari/WebKit 26 CPU and memory regression.

## Phase 0 error decomposition

`run-stitch-eval.js` is the measurement that decides which research route is
worth taking. Pose error in degrees is only a proxy; this stitches the same 34
views under a ladder of hypotheses, changing exactly one thing per rung, and
scores each against the source panorama. `--png` writes the panoramas out so
they can be looked at, not just scored.

| | hypothesis | PSNR | SSIM | covered |
|---|---|---|---|---|
| A | sensor pose + 68 deg (ships today) | 11.90 dB | 0.168 | 97.9% |
| B | refined pose + 68 deg | 13.11 dB | 0.185 | 98.0% |
| C | sensor pose + calibrated focal | 13.26 dB | 0.300 | 98.3% |
| D | refined pose + calibrated focal | 20.31 dB | 0.706 | 98.3% |
| E | TRUE pose + TRUE focal | 23.08 dB | 0.845 | 98.3% |
| F | E + gain compensation | 26.56 dB | 0.855 | 98.3% |

**Pose and focal are strongly coupled.** Fixing pose alone buys +1.21 dB and
fixing focal alone buys +1.36 dB, but doing both buys **+8.42 dB** — far more
than the sum. Neither half is worth shipping without the other: with the wrong
focal a correct pose still misprojects, and vice versa.

Remaining budget after Phase 0: 2.77 dB of residual pose/focal error, 3.47 dB of
exposure drift (which gain compensation recovers, and which no pose method can
touch), and a 26.56 dB floor from resampling and feather blending.

Two caveats that bound what this can conclude:

- **Zero parallax by construction.** Every view is rendered from one optical
  centre, so this measures E1/E2/E3/E5/E6 but says *nothing* about E4. Parallax
  needs Habitat+HM3D rendering with displaced camera centres, or real paired
  capture — Part III of the research plan.
- **Synthetic correspondences.** The geometry is fed modelled matches here; the
  real-descriptor validation lives in `run-xfeat-test.js`.

## Sphere coverage: two bugs that showed as black holes

Real captures came back with scalloped black gaps. Two independent causes, both
now fixed, measured with equal-area sphere sampling through the real projection
and feather:

1. **The blend weight discarded every frame corner.** The feather was radial —
   `cos(min(sqrt(nx²+ny²),1)·π/2)` — so a corner at `nx,ny = ±1` sits at
   `r = √2`, giving `cos(π/2) ≈ 6e-17`. Combined with the `wsum > 0.0001`
   coverage test, everything outside an *inscribed ellipse* was thrown away:
   about 21% of every photo. Replaced with a separable feather (independent
   horizontal × vertical falloff), which still tapers at every edge but keeps
   the full rectangle.
2. **The 26-shot pattern could not close the sphere.** Rings at 0°/±35° with a
   single zenith at only ±80° left a genuine unreachable band. Replaced with 34
   shots: 8 horizon, 8 at ±33° (staggered 22.5°), 4 at ±66°, and true ±90°
   zenith/nadir.

Measured coverage of the capture pattern alone, landscape 1920×1080:

| pattern | 58° | 62° | 68° | 73.5° | 78° | shots |
|---|---|---|---|---|---|---|
| old (0, ±35, z±80) | 87.1% | 90.2% | 93.6% | 95.7% | 96.8% | 26 |
| **current (0, ±33, ±66, z±90)** | **100%** | **100%** | **100%** | **100%** | **100%** | 34 |

The margin across the whole FOV range matters: the true lens FOV is unknown at
capture time (it's calibrated afterwards, from the photos), so the pattern has
to hold up even on a narrower lens than assumed.

`pano/camera.js` keeps a copy of this pattern for the offline harnesses. It went
stale once — section 0 of `run-tests.js` now executes `capture360.js`'s real
function and asserts the two agree, so it can't drift quietly again.

## Status

Verified offline across four suites (44 checks). **Not yet run in a real browser
or on a phone** — that is the next step, and the numbers below are desktop figures,
not device measurements.

| Metric | Value |
|---|---|
| Focal recovery | 73.39° vs 73.50° true (0.15% error; the 68° guess is off by 5.5°) |
| Pose error | 2.579° → 0.271° mean (9.5x better than the sensor prior) |
| Prior gating | 4.7x fewer descriptor comparisons, 89% of matches retained |
| Mean inlier ratio | 0.70 |

Nothing here is wired into the stitch worker yet. That is deliberate: the refined
poses are reported and exportable, so the lab can never corrupt a real capture.
