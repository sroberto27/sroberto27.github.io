/* ===================== STITCH WORKER PLUMBING TEST =====================
   Executes ../../pano-stitch-worker.js -- the real shipped file, not a
   copy -- inside a vm with the handful of browser APIs it touches
   (OffscreenCanvas, createImageBitmap, ImageData, postMessage) replaced
   by minimal stand-ins.

   run-stitch-eval.js already scores image QUALITY through pano/stitch.js.
   This file tests the thing that actually broke on a real phone, which
   quality metrics cannot see:

     - sources arrive as compressed Blobs and are decoded ONE AT A TIME.
       The previous version took 34 pre-decoded ImageBitmaps, 282 MB of
       resident pixels, and mobile Safari killed the tab outright rather
       than throwing anything the error handlers could catch.
     - allocate() steps the output down instead of dying when the
       accumulators will not fit.
     - a failure reports the STAGE it happened in, because on a phone
       there is no console to read and "it errored somewhere" cost a lot
       of guesswork the first time.
     - coverage is measured on an equal-area grid. Counting equirect
       pixels instead reported a 0.35% gap for a pattern that has none:
       near a pole, forward scatter physically cannot fill 1024 columns
       that span a sliver of solid angle, so it speckles (185 alternating
       runs in one measured row) and a pixel count reads that as missing.

   Run: node lab/test/run-worker-test.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load } = require('./load.js');

load('pano/so3.js');
load('pano/camera.js');
const C = globalThis.LSCCamera;

const WORKER_PATH = path.join(__dirname, '..', '..', 'pano-stitch-worker.js');
const SRC = fs.readFileSync(WORKER_PATH, 'utf8');

let failures = 0, checks = 0;
function check(name, cond, detail) {
  checks++; if (!cond) failures++;
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  ' + detail : ''));
}
const f2 = (v, d) => Number(v).toFixed(d === undefined ? 2 : d);

/* ---- browser stand-ins -------------------------------------------------
   Deliberately thin. Each records what the worker did with it so the test
   can assert on behaviour (how many bitmaps were alive at once) rather
   than only on the final image. */
function makeEnv(opts) {
  opts = opts || {};
  const state = { live: 0, peakLive: 0, decodes: 0, canvases: 0, posts: [] };

  class FakeImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  }

  function createImageBitmap(blob) {
    state.decodes++;
    state.live++;
    state.peakLive = Math.max(state.peakLive, state.live);
    return Promise.resolve({
      width: blob._w, height: blob._h, _rgba: blob._rgba,
      close() { state.live--; }
    });
  }

  class FakeOffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; this._rgba = null; state.canvases++; }
    getContext() {
      const self_ = this;
      return {
        drawImage(bmp) { self_._rgba = bmp._rgba; },
        getImageData(x, y, w, h) {
          return new FakeImageData(self_._rgba || new Uint8ClampedArray(w * h * 4), w, h);
        },
        putImageData(img) { self_._rgba = img.data; }
      };
    }
    convertToBlob() {
      if (opts.failEncode) return Promise.reject(new Error('encode unavailable'));
      return Promise.resolve({ _fake: 'jpeg', size: this.width * this.height / 8 });
    }
  }

  const sandbox = {
    OffscreenCanvas: FakeOffscreenCanvas,
    ImageData: FakeImageData,
    createImageBitmap,
    Uint8ClampedArray, Uint8Array, Float32Array: opts.Float32Array || Float32Array,
    Float64Array, Math, Error, Promise, console,
    postMessage: (m) => state.posts.push(m)
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: WORKER_PATH });
  return { sandbox, state };
}

// A source "photo": flat RGBA plus the pose it was taken at.
function fakeShot(w, h, pose, tint) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = tint; rgba[i * 4 + 1] = 255 - tint; rgba[i * 4 + 2] = 128; rgba[i * 4 + 3] = 255;
  }
  return {
    blob: { _w: w, _h: h, _rgba: rgba },
    width: w, height: h,
    yaw: pose.yaw, pitch: pose.pitch, roll: 0, gain: 1
  };
}

function buildShots(w, h) {
  return C.buildTargetPattern().map((p, i) => fakeShot(w, h, p, (i * 7) % 256));
}

function run(env, msg) {
  return new Promise((resolve, reject) => {
    env.sandbox.self.onmessage({ data: msg });
    const deadline = Date.now() + 60000;
    (function poll() {
      const done = env.state.posts.find(p =>
        p.type === 'result' || p.type === 'error' || p.type === 'unsupported');
      if (done) return resolve(done);
      if (Date.now() > deadline) return reject(new Error('worker never finished'));
      setImmediate(poll);
    })();
  });
}

(async () => {
  console.log('=== 1. Full 34-shot stitch, sources as blobs ===');
  {
    const env = makeEnv();
    const shots = buildShots(320, 180);
    const t0 = Date.now();
    const out = await run(env, {
      type: 'stitch', outputWidth: 1024, outputHeight: 512, hFovDeg: 68, images: shots
    });
    const st = env.state;

    check('produces a result', out.type === 'result', out.type === 'result' ? '' : JSON.stringify(out));
    check('encodes in the worker (no raw buffer on the main thread)', !!out.blob);
    check('output size honoured', out.width === 1024 && out.height === 512, `${out.width}x${out.height}`);
    check('decoded every source exactly once', st.decodes === shots.length, `${st.decodes} decodes / ${shots.length} shots`);

    /* The whole point of the change. One decoded frame alive at a time
       instead of all 34; on a real 1920x1080 capture that is the
       difference between 8 MB and 282 MB. */
    check('never holds more than one decoded frame at once', st.peakLive <= 1, `peak ${st.peakLive} live bitmaps`);
    check('releases every bitmap it decoded', st.live === 0, `${st.live} still open`);

    /* Coverage is the assertion that would have caught the black-holes
       bug directly: perfect poses, 34 shots, nominal FOV, nothing should
       be missing. */
    check("34-shot pattern covers the whole sphere", out.coverage > 0.999,
      f2(out.coverage * 100, 2) + '% (solid-angle weighted)');
    check('did not have to downscale', out.downscaled === false);

    const stages = st.posts.filter(p => p.type === 'progress').map(p => p.stage);
    check('reports progress through to Saving', stages.includes('Saving'), stages.length + ' progress messages');
    console.log('    (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  }

  console.log('\n=== 2. Coverage actually measures a gap ===');
  {
    // Horizon ring only: the sky and floor are genuinely unreachable, and
    // coverage must say so rather than being flattered by the poles.
    const env = makeEnv();
    const ring = [];
    for (let i = 0; i < 8; i++) ring.push(fakeShot(320, 180, { yaw: i * 45 * Math.PI / 180, pitch: 0 }, 100));
    const out = await run(env, {
      type: 'stitch', outputWidth: 1024, outputHeight: 512, hFovDeg: 68, images: ring
    });
    check('a horizon-only capture reports a large gap', out.coverage < 0.65,
      f2(out.coverage * 100, 1) + '% covered');
    check('but still covers the band it did shoot', out.coverage > 0.3,
      f2(out.coverage * 100, 1) + '%');
  }

  console.log('\n=== 3. Memory pressure degrades instead of dying ===');
  {
    // A Float32Array that refuses anything large, standing in for a device
    // that cannot allocate the full-size accumulators.
    const LIMIT = 4 * 1024 * 1024;
    function TightFloat32Array(n) {
      if (typeof n === 'number' && n > LIMIT) throw new RangeError('Array buffer allocation failed');
      return new Float32Array(n);
    }
    const env = makeEnv({ Float32Array: TightFloat32Array });
    const out = await run(env, {
      type: 'stitch', outputWidth: 4096, outputHeight: 2048, hFovDeg: 68, images: buildShots(320, 180)
    });
    check('still returns a panorama', out.type === 'result', out.type);
    check('stepped the output down', out.width < 4096, `${out.width}x${out.height}`);
    check('flags that it downscaled', out.downscaled === true);
  }

  console.log('\n=== 4. Failures name the stage they happened in ===');
  {
    const env = makeEnv();
    const shots = buildShots(320, 180);
    shots[5].blob = null;   // one unreadable source
    const out = await run(env, {
      type: 'stitch', outputWidth: 512, outputHeight: 256, hFovDeg: 68, images: shots
    });
    check('reports an error rather than hanging', out.type === 'error', out.type);
    check('names the stage', !!out.stage, 'stage=' + out.stage);
    check('carries a message', !!out.message, out.message);
  }

  console.log('\n=== 5. Falls back to the raw buffer if encoding is unavailable ===');
  {
    const env = makeEnv({ failEncode: true });
    const out = await run(env, {
      type: 'stitch', outputWidth: 512, outputHeight: 256, hFovDeg: 68, images: buildShots(320, 180)
    });
    check('still returns a result', out.type === 'result', out.type);
    check('sends the raw buffer instead', !out.blob && !!out.buffer);
    check('coverage is reported either way', typeof out.coverage === 'number',
      f2((out.coverage || 0) * 100, 1) + '%');
  }

  console.log('\n' + '-'.repeat(60));
  console.log(failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED' : failures + ' of ' + checks + ' CHECKS FAILED');
  console.log('-'.repeat(60));
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => { console.error(err); process.exit(1); });
