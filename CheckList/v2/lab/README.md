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

## Layout

```
geo/        pure geometry, no browser or model dependency
  so3.js          rotation math; mirrors the worker's basisForOrientation exactly
  camera.js       pinhole + equirect projection, worker conventions
  estimate.js     Wahba/Davenport rotation solve, RANSAC, prior gate
  calibrate.js    focal self-calibration
  bundle.js       pose-graph bundle adjustment (LM), loop-closure diagnostics
  pipeline.js     orchestration
xfeat/      browser-only
  extractor.js    onnxruntime-web session + NMS/top-K/descriptor sampling
  match.js        mutual-NN matching with the geometric gate
test/       node test suites
tools/      fixture generation
vendor/     onnxruntime-web + xfeat.onnx  (see "Vendored files" below)
index.html  the lab page
lab.js      lab page logic
```

## Running the tests

No browser needed. Both suites run in Node:

```bash
node lab/test/run-tests.js                  # geometry vs synthetic ground truth (20 checks)

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
worth taking. Pose error in degrees is only a proxy; this stitches the same 26
views under a ladder of hypotheses, changing exactly one thing per rung, and
scores each against the source panorama. `--png` writes the panoramas out so
they can be looked at, not just scored.

| | hypothesis | PSNR | SSIM | covered |
|---|---|---|---|---|
| A | sensor pose + 68 deg (ships today) | 11.37 dB | 0.160 | 86.9% |
| B | refined pose + 68 deg | 12.31 dB | 0.178 | 86.8% |
| C | sensor pose + calibrated focal | 12.70 dB | 0.285 | 90.2% |
| D | refined pose + calibrated focal | 19.94 dB | 0.675 | 90.1% |
| E | TRUE pose + TRUE focal | 23.19 dB | 0.847 | 90.1% |
| F | E + gain compensation | 26.38 dB | 0.852 | 90.1% |

**Pose and focal are strongly coupled.** Fixing pose alone buys +0.94 dB and
fixing focal alone buys +1.33 dB, but doing both buys **+8.57 dB** — far more
than the sum. Neither half is worth shipping without the other: with the wrong
focal a correct pose still misprojects, and vice versa.

Remaining budget after Phase 0: 3.25 dB of residual pose/focal error, 3.19 dB of
exposure drift (which gain compensation recovers, and which no pose method can
touch), and a 26.38 dB floor from resampling and feather blending.

Two caveats that bound what this can conclude:

- **Zero parallax by construction.** Every view is rendered from one optical
  centre, so this measures E1/E2/E3/E5/E6 but says *nothing* about E4. Parallax
  needs Habitat+HM3D rendering with displaced camera centres, or real paired
  capture — Part III of the research plan.
- **Synthetic correspondences.** The geometry is fed modelled matches here; the
  real-descriptor validation lives in `run-xfeat-test.js`.

Separately: at the true FOV the 26-target pattern covers only ~90% of the sphere.
That is a capture-pattern limit, not a stitching one — it needs more shots or
tighter ring spacing, not better maths.

## Status

Verified offline across three suites (37 checks). **Not yet run in a real browser
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
