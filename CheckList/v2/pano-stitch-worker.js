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
   every live ImageBitmap at once, which for 34 frames at 1920x1080 is
   282 MB of uncompressed
   pixels resident simultaneously. Together with the accumulators that put
   peak usage near half a gigabyte, and mobile Safari kills the whole tab
   rather than throwing something catchable -- the symptom was "the page
   died and I had to reload" instead of the graceful stitch-error fallback
   this file already had. Decoding lazily costs one extra decode per shot
   and drops the bitmap term from 282 MB to about 8 MB.

   BLENDING. Overlapping sources can be combined three ways, chosen by
   the caller with `blend` (see BLEND MODES below). The historical
   behaviour -- a plain feathered average -- ghosts: averaging two
   slightly misaligned copies of the same edge draws it twice. The other
   two modes let the SHARPEST source win instead, which is what
   dedicated photosphere apps do and what removes doubled edges.

   Message in:  { type:'stitch', outputWidth, outputHeight, hFovDeg, blend,
                  images:[{yaw,pitch,roll,gain,blob|bitmap,width,height}] }
   Messages out: { type:'progress', stage, pct }, { type:'unsupported', reason },
                 { type:'error', message, stage },
                 { type:'result', blob|buffer, width, height, downscaled, coverage }
*/
'use strict';

/* ===================== BLEND MODES =====================
   'average'  the original feathered mean of every source that reached a
              pixel. Retained because it is the gentlest on exposure
              steps, and because an Enhance-off capture with several
              degrees of pose error can look better smeared than
              hard-cut.
   'sharp'    the same single-pass average, but each sample's feather is
              multiplied by a saturating function of local sharpness, so
              a source that resolves detail there outvotes one that does
              not. Seams stay soft. No extra buffers.
   'best'     true per-pixel winner-takes-all: one source owns each
              output pixel outright. Zero ghosting, hard seams. Costs one
              Float32Array(W*H) plus one Uint8Array(W*H).

   Sharpness is the absolute Laplacian of luma, measured at the SAME
   sample grid the scatter loop walks (so it describes detail at the
   output's scale, not the sensor's), box-smoothed so the winner is
   spatially coherent instead of salt-and-pepper, then squashed through
   s/(s+SHARP_K) into 0..1. The squash is deliberately absolute rather
   than per-image normalised: the whole point is to compare sources
   against each other, and normalising each image to its own maximum
   would promote a uniformly blurry frame to "sharp".

   The map has to be built inside the decode loop, while `pixels` is
   still alive -- the decoded buffer is released each iteration on
   purpose, so there is no later opportunity. */
const DEFAULT_BLEND = 'best';
const SHARP_K = 6;              // |Laplacian| (0..255 luma) scoring 0.5
/* Box-smooth radius for the sharpness map, in sample-grid cells (a cell
   is about 0.7 output pixels, so 12 is a ~17 px window in the panorama).

   This was 2, and 2 is far too small. On a low-texture surface -- a
   ceiling tile, a painted wall, a floor -- every source scores near zero
   and the differences between them are sensor noise, so the winner
   flipped every few pixels and the whole ceiling came out as heavy
   salt-and-pepper mottling on the first real capture. Smoothing over a
   window many pixels wide is what turns "which source is sharper HERE"
   into a question with a stable answer. */
const SHARP_SMOOTH = 12;
/* 'sharp' multiplies the feather by  SHARP_FLOOR + norm^SHARP_EXP.

   The floor is not cosmetic. Where a surface is featureless every source
   scores ~0, and without a floor their weights collapse under the
   `wsum > 0.0001` coverage test -- which would punch holes in blank
   walls, the one place the blend has nothing to gain in the first place.
   Adding the floor rather than folding it into the base keeps the floor
   independent of the exponent, so the contrast between a sharp source
   and a blurred one can be tuned without putting coverage at risk.

   At 0.005/3 a norm of 0.6 outvotes 0.2 by about 17x. That is a real
   preference, but it is still a weighted average -- a losing source is
   attenuated, never excluded -- which is what distinguishes this mode
   from 'best' and why it keeps soft seams. */
const SHARP_FLOOR = 0.005;
const SHARP_EXP = 3;
/* 'best' ranks sources by  sharpness + BEST_FEATHER_WEIGHT * feather.

   The feather term is not a tie-break, it is load-bearing. Sharpness
   alone leaves the winner undetermined wherever the scene has no
   detail, and "undetermined" in practice means "decided by noise",
   which is what produced the mottled ceiling described above. Feather
   is a smooth function of position within each frame, so ranking by it
   partitions the overlap along the curve where two frames are equally
   far from their own centres -- one clean seam instead of speckle.

   The weight sets the exchange rate: at 0.35 a source must be about
   0.035 sharper (on the 0..1 squashed scale) to overcome a 0.1 feather
   deficit. Real detail differences are several times that, so genuine
   sharpness still wins outright; noise, which is an order of magnitude
   smaller, never does. Exact ties keep the lower source index, because
   the comparison is strictly greater-than. */
const BEST_FEATHER_WEIGHT = 0.35;

function resolveBlend(mode, imageCount) {
  if (mode !== 'average' && mode !== 'sharp' && mode !== 'best') mode = DEFAULT_BLEND;
  // The owner map is a Uint8Array with 0 reserved for "nobody yet".
  if (mode === 'best' && imageCount > 255) mode = 'sharp';
  return mode;
}

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

/* The reference for roll is the world-up direction projected
     perpendicular to the view axis, and it is written out analytically
     rather than as a normalised cross product because the cross product
     vanishes at the pole and the guard that used to stand in for it was
     wrong.

     cross(forward, worldUp) = (cos(yaw)cos(pitch), -sin(yaw)cos(pitch), 0),
     so once normalised it is exactly (cos(yaw), -sin(yaw), 0) for every
     pitch in (-90, 90) -- the cos(pitch) factor divides straight out. The
     old code computed the cross product and, when |forward.z| > 0.999,
     substituted (1, 0, 0) instead. That threshold is |pitch| > 87.44 deg,
     which the capture pattern's zenith and nadir targets sit inside by
     design, and the substitution DISCARDS YAW: it turns the frame by
     whatever the yaw happened to be.

     Measured on a real capture, the nadir frame came back rotated 121 deg
     about its own view axis, because that shot was taken at pitch -89.6
     with yaw 121.4. The bug was invisible in every offline test because
     all four copies of this function shared it, so they agreed with each
     other; what they did not agree with is orientation.js, which measures
     roll against the projected world-up with no such guard. A device
     quaternion taken through quaternionToYawPitchRoll and back came out
     with its up axis 40 deg wrong at pitch 87.5 and right at 87.0. */
function basisForOrientation(yaw, pitch, roll) {
  const forward = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.cos(yaw) * Math.cos(pitch), z: Math.sin(pitch) };
  const right0 = { x: Math.cos(yaw), y: -Math.sin(yaw), z: 0 };
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
function allocate(W, H, wantBest) {
  let w = W, h = H;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return {
        W: w, H: h,
        colorSum: new Float32Array(w * h * 3),
        weightSum: new Float32Array(w * h),
        // Inside the try on purpose: on a device tight enough that the
        // winner-takes-all buffers are what tips it over, stepping the
        // output down is still the right answer.
        bestScore: wantBest ? new Float32Array(w * h) : null,
        bestOwner: wantBest ? new Uint8Array(w * h) : null
      };
    } catch (err) {
      w = Math.max(1024, Math.round(w / 2));
      h = Math.max(512, Math.round(h / 2));
    }
  }
  throw new Error('could not allocate stitch buffers');
}

/* Local sharpness on the scatter loop's own sample grid.

   Only the pixels the scatter loop actually visits need a score, so the
   map is (ceil(w/stride) x ceil(h/stride)) rather than full resolution:
   on a 3024x4032 phone frame at stride 5 that is 2 MB instead of 48 MB,
   and the Laplacian's +/-stride footprint measures detail at the scale
   the output can hold rather than sensor noise it cannot.

   Returns values already squashed into 0..1 by s/(s+SHARP_K). */
function sharpnessMap(pixels, w, h, stride) {
  const sw = Math.ceil(w / stride), sh = Math.ceil(h / stride);
  const raw = new Float32Array(sw * sh);
  const gray = (x, y) => {
    const o = (y * w + x) * 4;
    return 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2];
  };
  for (let gy = 0; gy < sh; gy++) {
    const y = gy * stride;
    const yUp = y - stride < 0 ? 0 : y - stride;
    const yDn = y + stride >= h ? h - 1 : y + stride;
    for (let gx = 0; gx < sw; gx++) {
      const x = gx * stride;
      const xL = x - stride < 0 ? 0 : x - stride;
      const xR = x + stride >= w ? w - 1 : x + stride;
      const lap = gray(xL, y) + gray(xR, y) + gray(x, yUp) + gray(x, yDn) - 4 * gray(x, y);
      raw[gy * sw + gx] = lap < 0 ? -lap : lap;
    }
  }

  /* Box blur with a running sum, so the radius is free. It has to be
     generous -- see SHARP_SMOOTH -- and a naive kernel at that radius
     would cost more than the scatter loop it feeds. */
  const tmp = new Float32Array(sw * sh);
  const R = SHARP_SMOOTH;
  for (let gy = 0; gy < sh; gy++) {
    const row = gy * sw;
    let sum = 0;
    for (let k = 0; k <= (R < sw - 1 ? R : sw - 1); k++) sum += raw[row + k];
    for (let gx = 0; gx < sw; gx++) {
      const a = gx - R, b = gx + R;
      tmp[row + gx] = sum / ((b >= sw ? sw - 1 : b) - (a < 0 ? 0 : a) + 1);
      if (b + 1 < sw) sum += raw[row + b + 1];
      if (a >= 0) sum -= raw[row + a];
    }
  }
  for (let gx = 0; gx < sw; gx++) {
    let sum = 0;
    for (let k = 0; k <= (R < sh - 1 ? R : sh - 1); k++) sum += tmp[k * sw + gx];
    for (let gy = 0; gy < sh; gy++) {
      const a = gy - R, b = gy + R;
      const s = sum / ((b >= sh ? sh - 1 : b) - (a < 0 ? 0 : a) + 1);
      if (b + 1 < sh) sum += tmp[(b + 1) * sw + gx];
      if (a >= 0) sum -= tmp[a * sw + gx];
      raw[gy * sw + gx] = s / (s + SHARP_K);
    }
  }
  return { map: raw, sw: sw, sh: sh };
}

async function runStitch(msg) {
  const { hFovDeg, images } = msg;
  progress('Preparing images', 2);

  const blend = resolveBlend(msg.blend, images.length);
  const buf = allocate(msg.outputWidth, msg.outputHeight, blend === 'best');
  const W = buf.W, H = buf.H, colorSum = buf.colorSum, weightSum = buf.weightSum;
  const bestScore = buf.bestScore, bestOwner = buf.bestOwner;
  // A step-down inside allocate() can drop the winner buffers; if it did,
  // degrade to the single-pass mode rather than dereferencing null.
  const mode = (blend === 'best' && !bestScore) ? 'sharp' : blend;
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

    /* Must happen here, not later: readImage() hands back the only copy of
       these pixels and the next iteration replaces it. */
    let sharp = null, sharpW = 0;
    if (mode !== 'average') {
      const sm = sharpnessMap(pixels, src.width, src.height, stride);
      sharp = sm.map; sharpW = sm.sw;
    }
    const owner = i + 1;   // 0 means "no source has claimed this pixel yet"

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
        const feather = wx * wy;
        if (feather <= 1e-6) continue;

        const r8 = pixels[idx] * gain, g8 = pixels[idx + 1] * gain, b8 = pixels[idx + 2] * gain;
        if (mode === 'average') {
          splat(colorSum, weightSum, W, H, u, v, r8, g8, b8, feather);
        } else {
          const norm = sharp[(py / stride) * sharpW + (px / stride)];
          if (mode === 'sharp') {
            const boost = SHARP_FLOOR + Math.pow(norm, SHARP_EXP);
            splat(colorSum, weightSum, W, H, u, v, r8, g8, b8, feather * boost);
          } else {
            splatBest(colorSum, weightSum, bestScore, bestOwner, W, H, u, v,
              r8, g8, b8, feather, norm + BEST_FEATHER_WEIGHT * feather, owner);
          }
        }
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

/* Winner-takes-all splat.

   Each output pixel is owned by exactly one source. Sources are scattered
   sequentially and in full, so by the time image j is considered,
   bestScore[p] already holds image i's BEST score at p -- which makes the
   outcome independent of the order samples happen to arrive in within an
   image, and dependent only on source order for exact ties.

   Samples from the current owner keep accumulating normally (one source
   contributes several samples to one output pixel, and averaging those is
   resampling, not cross-source blending). A strictly better score evicts
   the incumbent outright: its colour and weight for that pixel are
   discarded, which is the whole point -- a ghost is what you get when
   they are kept.

   `weightSum` therefore still means exactly what it meant before ("some
   source reached here, and by how much"), so measureCoverage() and
   gapFill() need no knowledge of any of this. */
function splatBest(colorSum, weightSum, bestScore, bestOwner, W, H, u, v, r, g, b, weight, score, owner) {
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
      if (bestOwner[p] === owner) {
        if (score > bestScore[p]) bestScore[p] = score;
      } else if (bestOwner[p] === 0 || score > bestScore[p]) {
        bestOwner[p] = owner;
        bestScore[p] = score;
        colorSum[p * 3] = 0; colorSum[p * 3 + 1] = 0; colorSum[p * 3 + 2] = 0;
        weightSum[p] = 0;
      } else {
        continue;
      }
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
   real capture leaves roughly 800 of 1024 columns empty in an
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
  /* Each pass grows the filled region by one pixel, so the cap is the
     widest hole that can be closed. 8 was enough for the hairline seams
     this was written for, but not for a real gap: a genuinely narrow lens
     (a portrait phone frame is only ~47 deg wide, giving the 8-shot rings
     almost no horizon overlap) leaves wedges tens of pixels across once
     pose refinement moves the frames, and those survived 8 passes as
     conspicuous black. The loop already exits the moment nothing is left
     to fill, so a high cap costs nothing on a capture that has no holes
     and simply finishes the job on one that does. */
  passes = passes || 96;
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
