/* ===================== 360 STITCH WORKER =====================
   Produces a real equirectangular projection from the guided-capture
   source photos. Each source pixel is forward-projected (gnomonic/
   rectilinear -> spherical) onto the output equirect canvas and blended
   with its neighbors using a center-weighted feather.

   The projection itself does no feature matching. Where the pose and FOV
   come from depends on whether refinement ran:

     - pano-refine-worker.js succeeded: yaw/pitch/roll are visually
       refined by bundle adjustment, hFovDeg is calibrated from the
       photos themselves, and each image carries an exposure gain.
     - refinement skipped or failed: the raw device-orientation reading
       and the assumed 68 deg FOV, exactly as before, with gain 1.

   Either way this file only consumes what it is given, so a refinement
   failure degrades to the original behaviour rather than breaking.

   MEMORY IS THE BINDING CONSTRAINT HERE, not speed. Sources arrive as
   compressed Blobs and are decoded ONE AT A TIME inside this worker; an
   earlier version decoded all of them on the main thread and transferred
   34 live ImageBitmaps, which at 1920x1080 is 282 MB of uncompressed
   pixels resident simultaneously. Together with the accumulators that put
   peak usage near half a gigabyte, and mobile Safari kills the whole tab
   rather than throwing something catchable -- the symptom was "the page
   died and I had to reload" instead of the graceful stitch-error fallback
   this file already had. Decoding lazily costs one extra decode per shot
   and drops the bitmap term from 282 MB to about 8 MB.

   Message in:  { type:'stitch', outputWidth, outputHeight, hFovDeg,
                  images:[{yaw,pitch,roll,gain,blob|bitmap,width,height}] }
   Messages out: { type:'progress', stage, pct }, { type:'unsupported', reason },
                 { type:'error', message, stage },
                 { type:'result', blob|buffer, width, height, downscaled, coverage }
*/
'use strict';

if (typeof OffscreenCanvas === 'undefined') {
  postMessage({ type: 'unsupported', reason: 'OffscreenCanvas is not available in this browser' });
} else {
  self.onmessage = (e) => {
    if (!e.data || e.data.type !== 'stitch') return;
    // runStitch is async now (it awaits each decode), so a plain try/catch
    // around the call would no longer see anything it throws.
    Promise.resolve()
      .then(() => runStitch(e.data))
      .catch(err => postMessage({
        type: 'error',
        stage: currentStage,
        message: err && err.message ? err.message : String(err)
      }));
  };
}

/* Whichever stage we are in, so that a failure report can name it.
   Having to guess after the fact is what made the first round of this
   bug hard to pin down. */
let currentStage = 'starting';
function progress(stage, pct) {
  currentStage = stage;
  postMessage({ type: 'progress', stage: stage, pct: pct });
}

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function add3(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale3(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }

function basisForOrientation(yaw, pitch, roll) {
  const forward = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.cos(yaw) * Math.cos(pitch), z: Math.sin(pitch) };
  const worldUp = { x: 0, y: 0, z: 1 };
  let right0 = Math.abs(forward.z) > 0.999 ? { x: 1, y: 0, z: 0 } : normalize(cross(forward, worldUp));
  const up0 = normalize(cross(right0, forward));
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const right = normalize(add3(scale3(right0, cr), scale3(up0, -sr)));
  const up = normalize(add3(scale3(up0, cr), scale3(right0, sr)));
  return { forward, right, up };
}

/* Decode one source, hand back its pixels, and release everything else
   before returning, so only one frame is ever uncompressed at a time.
   Accepts a Blob (the normal path) or an already-decoded ImageBitmap. */
async function readImage(img) {
  let bitmap = img.bitmap || null;
  let owned = false;
  if (!bitmap) {
    if (!img.blob) throw new Error('source has neither blob nor bitmap');
    bitmap = await createImageBitmap(img.blob);
    owned = true;
  }
  const w = bitmap.width, h = bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    try { bitmap.close && bitmap.close(); } catch (e) { /* ignore */ }
    throw new Error('2d context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  try { bitmap.close && bitmap.close(); } catch (e) { /* ignore */ }
  if (owned) img.blob = null;
  const data = ctx.getImageData(0, 0, w, h).data;
  // Release the backing store now instead of waiting on GC while the next
  // source decodes; on iOS total canvas memory is separately capped.
  canvas.width = 1; canvas.height = 1;
  return { data: data, width: w, height: h };
}

/* The accumulators dominate steady-state memory at 16 bytes per output
   pixel, so 4096x2048 costs 134 MB before the output image itself. If a
   device cannot allocate that, halve the output and retry rather than
   die: a smaller panorama beats no panorama. */
function allocate(W, H) {
  let w = W, h = H;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return {
        W: w, H: h,
        colorSum: new Float32Array(w * h * 3),
        weightSum: new Float32Array(w * h)
      };
    } catch (err) {
      w = Math.max(1024, Math.round(w / 2));
      h = Math.max(512, Math.round(h / 2));
    }
  }
  throw new Error('could not allocate stitch buffers');
}

async function runStitch(msg) {
  const { hFovDeg, images } = msg;
  progress('Preparing images', 2);

  const buf = allocate(msg.outputWidth, msg.outputHeight);
  const W = buf.W, H = buf.H, colorSum = buf.colorSum, weightSum = buf.weightSum;
  const downscaled = (W !== msg.outputWidth);
  const hFov = hFovDeg * Math.PI / 180;

  const total = images.length;
  for (let i = 0; i < total; i++) {
    const src = images[i];
    const decoded = await readImage(src);
    const pixels = decoded.data;
    // Trust the decoded size over whatever the caller recorded.
    src.width = decoded.width; src.height = decoded.height;
    // Per-shot exposure gain from pano-refine-worker.js, cancelling the
    // auto-exposure drift across a sweep. 1 when refinement was skipped.
    const gain = (typeof src.gain === 'number' && src.gain > 0) ? src.gain : 1;
    const { forward, right, up } = basisForOrientation(src.yaw, src.pitch, src.roll);
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) * (src.height / src.width));
    const tanH = Math.tan(hFov / 2), tanV = Math.tan(vFov / 2);

    // Bound total scatter work per image regardless of source resolution —
    // density beyond ~1 sample per output pixel is wasted work.
    const outputSamplesAcrossImage = (hFov / (2 * Math.PI)) * W;
    const stride = Math.max(1, Math.floor(src.width / (outputSamplesAcrossImage * 1.4 || 1)));

    for (let py = 0; py < src.height; py += stride) {
      const ny = 1 - (py + 0.5) / src.height * 2;
      for (let px = 0; px < src.width; px += stride) {
        const nx = (px + 0.5) / src.width * 2 - 1;
        const idx = (py * src.width + px) * 4;
        const a = pixels[idx + 3];
        if (a < 8) continue;

        const rw = normalize(add3(add3(scale3(right, nx * tanH), scale3(up, ny * tanV)), forward));
        const yawOut = Math.atan2(rw.x, rw.y);
        const pitchOut = Math.asin(Math.max(-1, Math.min(1, rw.z)));
        let u = (yawOut / (2 * Math.PI) + 0.5) * W;
        const v = (0.5 - pitchOut / Math.PI) * H;
        if (v < 0 || v >= H) continue;
        u = ((u % W) + W) % W;

        /* Separable feather: independent horizontal and vertical falloff,
           multiplied. Still tapers to zero at every edge (so seams stay
           soft) but keeps the FULL RECTANGLE of each photo.

           This replaced a radial feather, cos(min(sqrt(nx^2+ny^2),1)*pi/2),
           which looked equivalent but silently discarded every frame
           corner: at a corner nx,ny = +/-1 so r = sqrt(2) ~ 1.41, giving
           cos(pi/2) ~ 6e-17. Combined with the `wsum > 0.0001` coverage
           test below, that threw away everything outside an inscribed
           ellipse -- about 21% of every photo -- and produced scalloped,
           petal-shaped black holes in the finished panorama. Measured
           sphere coverage on the 26-shot pattern went from 91.9% to 93.7%
           at 68deg hFOV, and 85.7% -> 90.2% at a narrow 62deg lens. */
        const wx = Math.cos(Math.min(Math.abs(nx), 1) * Math.PI / 2);
        const wy = Math.cos(Math.min(Math.abs(ny), 1) * Math.PI / 2);
        const weight = wx * wy;
        if (weight <= 1e-6) continue;

        const r8 = pixels[idx] * gain, g8 = pixels[idx + 1] * gain, b8 = pixels[idx + 2] * gain;
        splat(colorSum, weightSum, W, H, u, v, r8, g8, b8, weight);
      }
    }
    progress('Matching overlaps', 5 + Math.round((i + 1) / total * 55));
  }

  progress('Building panorama', 65);
  const out = new Uint8ClampedArray(W * H * 4);
  const filled = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const wsum = weightSum[p];
    const o = p * 4;
    if (wsum > 0.0001) {
      out[o] = colorSum[p * 3] / wsum;
      out[o + 1] = colorSum[p * 3 + 1] / wsum;
      out[o + 2] = colorSum[p * 3 + 2] / wsum;
      out[o + 3] = 255;
      filled[p] = 1;
    }
  }

  const coverage = measureCoverage(filled, W, H);
  progress('Blending', 78);
  gapFill(out, filled, W, H);

  /* Encode here rather than on the main thread. The old path posted the
     raw buffer back, which the page then copied into an ImageData AND a
     full-size 2D canvas before calling toBlob -- about 100 MB of
     main-thread spike at the exact moment memory was already tightest. */
  progress('Saving', 92);
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const cv = new OffscreenCanvas(W, H);
      const c2 = cv.getContext('2d');
      c2.putImageData(new ImageData(out, W, H), 0, 0);
      const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      cv.width = 1; cv.height = 1;
      if (blob) {
        postMessage({ type: 'result', blob: blob, width: W, height: H, downscaled: downscaled, coverage: coverage });
        return;
      }
    } catch (err) { /* fall through to the raw-buffer path below */ }
  }
  const buffer = out.buffer;
  postMessage({ type: 'result', buffer: buffer, width: W, height: H, downscaled: downscaled, coverage: coverage }, [buffer]);
}

function splat(colorSum, weightSum, W, H, u, v, r, g, b, weight) {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const fx = u - x0, fy = v - y0;
  for (let dy = 0; dy <= 1; dy++) {
    const yy = y0 + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? fy : (1 - fy);
    for (let dx = 0; dx <= 1; dx++) {
      let xx = (x0 + dx) % W; if (xx < 0) xx += W;
      const wx = dx ? fx : (1 - fx);
      const w = weight * wx * wy;
      if (w <= 0) continue;
      const p = yy * W + xx;
      colorSum[p * 3] += r * w;
      colorSum[p * 3 + 1] += g * w;
      colorSum[p * 3 + 2] += b * w;
      weightSum[p] += w;
    }
  }
}

/* How much of the sphere the photos actually reached, measured BEFORE
   gapFill paints over the rest. This is the one number that separates
   "the stitcher did badly" from "the camera never pointed there" -- the
   two look identical in the finished image once the gaps are inpainted.

   Measured on an equal-area grid rather than by counting equirect
   pixels, and the reason is not pedantry. An equirect row near a pole has
   the same W columns as the equator but covers a vanishing sliver of
   solid angle, so forward scatter cannot fill it: at 88 deg latitude a
   34-shot capture leaves roughly 800 of 1024 columns empty in an
   alternating speckle (measured: 185 separate runs in one row), purely
   because the source frames do not have that many samples pointing there.
   Counting pixels called that a 0.35% coverage gap. It is not one -- the
   zenith shot covers a 20 deg disc around the pole outright, and gapFill
   closes the speckle from immediately adjacent pixels of the same photo.

   So each row is divided into round(W*cos(lat)) buckets, which is the
   number of genuinely distinguishable directions it holds, and a bucket
   counts as covered if anything in it was. Every bucket carries the same
   solid angle. A real gap -- a contiguous arc no camera faced -- still
   empties whole buckets and is still reported. */
function measureCoverage(filled, W, H) {
  let covered = 0, total = 0;
  for (let y = 0; y < H; y++) {
    const cw = Math.cos((0.5 - (y + 0.5) / H) * Math.PI);
    if (cw <= 0) continue;
    const n = Math.max(1, Math.round(W * cw));
    const per = cw / n;              // equal solid angle per bucket
    const row = y * W;
    total += cw;
    for (let b = 0; b < n; b++) {
      const x0 = Math.floor(b * W / n), x1 = Math.floor((b + 1) * W / n);
      for (let x = x0; x < x1; x++) {
        if (filled[row + x]) { covered += per; break; }
      }
    }
  }
  return total > 0 ? covered / total : 0;
}

// Fills small gaps (poles beyond the near-zenith/near-nadir shot, thin seams
// between rings) by repeatedly averaging already-filled neighbors — a
// standard dilation inpaint, not invented image content.
function gapFill(out, filled, W, H, passes) {
  passes = passes || 8;
  const nextFilled = new Uint8Array(filled.length);   // reused; a per-pass slice() churned 8 MB at a time
  for (let pass = 0; pass < passes; pass++) {
    let remaining = 0;
    nextFilled.set(filled);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (filled[p]) continue;
        let rs = 0, gs = 0, bs = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            let xx = (x + dx + W) % W;
            const q = yy * W + xx;
            if (filled[q]) { rs += out[q * 4]; gs += out[q * 4 + 1]; bs += out[q * 4 + 2]; n++; }
          }
        }
        if (n > 0) {
          const o = p * 4;
          out[o] = rs / n; out[o + 1] = gs / n; out[o + 2] = bs / n; out[o + 3] = 255;
          nextFilled[p] = 1;
        } else {
          remaining++;
        }
      }
    }
    filled.set(nextFilled);
    if (!remaining) break;
  }
}
