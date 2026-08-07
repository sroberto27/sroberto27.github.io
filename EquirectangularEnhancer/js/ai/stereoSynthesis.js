// Depth Anything's depth map -> a top/bottom stereo equirectangular pair.
//
// Because this is equirectangular (not a flat perspective photo), the x axis
// is already linear in longitude at every row — so a per-pixel horizontal
// disparity in pixels is automatically an angularly-consistent shift at any
// latitude, no per-row angular correction needed. That's the one thing that
// makes this simpler than DIBR on a normal photo. What's different (and
// harder) than a flat image: shifted pixels must wrap across the left/right
// seam instead of being cropped/clamped at the frame edge.
//
// Sign convention (best-effort, unverified without a headset): the left eye
// camera sits left-of-center, so a near object appears shifted toward image
// +x (right) in the left eye's view relative to the mono source, and toward
// -x in the right eye's view. If a rendered pair reads as pseudoscopic
// (depth feels inside-out) in a real headset, flip LEFT_SIGN/RIGHT_SIGN.
import { inpaintTile } from "./lamaInpaint.js";
import { getImageData, imageDataToCanvas, resizeToCanvas, cropToCanvas } from "./tensorUtils.js";

export const DEFAULT_MAX_SHIFT_DEG = 1.2;
const LEFT_SIGN = 1;
const RIGHT_SIGN = -1;
const GAP_REFINE_TILE = 512;

function synthesizeEye(sourceCanvas, depthArray, sign, maxShiftPx) {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const srcData = getImageData(sourceCanvas, w, h).data;
  const outImageData = new ImageData(w, h);
  const outData = outImageData.data;
  const filled = new Uint8Array(w * h);
  const depthBuffer = new Float32Array(w * h).fill(-1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const closeness = depthArray[idx];
      const shift = Math.round(sign * closeness * maxShiftPx);
      const destX = ((x + shift) % w + w) % w; // wrap across the seam
      const destIdx = y * w + destX;
      if (closeness >= depthBuffer[destIdx]) {
        depthBuffer[destIdx] = closeness;
        const sp = idx * 4, dp = destIdx * 4;
        outData[dp] = srcData[sp];
        outData[dp + 1] = srcData[sp + 1];
        outData[dp + 2] = srcData[sp + 2];
        outData[dp + 3] = 255;
        filled[destIdx] = 1;
      }
    }
  }
  return { imageData: outImageData, filled, w, h };
}

function copyPixel(data, srcIdx, dstIdx) {
  const sp = srcIdx * 4, dp = dstIdx * 4;
  data[dp] = data[sp]; data[dp + 1] = data[sp + 1]; data[dp + 2] = data[sp + 2]; data[dp + 3] = 255;
}

// Fast default gap fill: nearest valid neighbor along the row, in the
// direction content would have been revealed from.
function cloneFillGaps(imageData, filled, w, h) {
  const data = imageData.data;
  const handled = new Uint8Array(filled);
  for (let y = 0; y < h; y++) {
    let lastValid = -1;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (filled[idx]) lastValid = x;
      else if (lastValid >= 0) { copyPixel(data, y * w + lastValid, idx); handled[idx] = 1; }
    }
  }
  for (let y = 0; y < h; y++) {
    let lastValid = -1;
    for (let x = w - 1; x >= 0; x--) {
      const idx = y * w + x;
      if (filled[idx]) lastValid = x;
      else if (!handled[idx] && lastValid >= 0) copyPixel(data, y * w + lastValid, idx);
    }
  }
}

// Higher-quality (optional) gap fill: re-inpaints any 512-grid tile that
// contains disocclusion gaps using the already-loaded LaMa session, treating
// gap pixels as the mask. Reuses the same inpaintTile primitive as the
// nadir-cleanup stage.
async function refineGapsWithLama(canvas, filled, w, h, lamaSessionInfo, onStatus) {
  const tilesX = Math.ceil(w / GAP_REFINE_TILE), tilesY = Math.ceil(h / GAP_REFINE_TILE);
  const total = tilesX * tilesY;
  let done = 0;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      done++;
      const x0 = tx * GAP_REFINE_TILE, y0 = ty * GAP_REFINE_TILE;
      const tw = Math.min(GAP_REFINE_TILE, w - x0), th = Math.min(GAP_REFINE_TILE, h - y0);

      let hasGap = false;
      for (let y = y0; y < y0 + th && !hasGap; y++) {
        for (let x = x0; x < x0 + tw; x++) { if (!filled[y * w + x]) { hasGap = true; break; } }
      }
      if (!hasGap) continue;

      onStatus && onStatus(`Refining disocclusion gaps (tile ${done}/${total})…`);

      const imageCrop512 = cropToCanvas(canvas, x0, y0, tw, th, GAP_REFINE_TILE, GAP_REFINE_TILE);

      const maskAtTileRes = document.createElement("canvas");
      maskAtTileRes.width = tw;
      maskAtTileRes.height = th;
      const mCtx = maskAtTileRes.getContext("2d");
      const maskData = mCtx.createImageData(tw, th);
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const v = filled[(y0 + y) * w + (x0 + x)] ? 0 : 255;
          const p = (y * tw + x) * 4;
          maskData.data[p] = v; maskData.data[p + 1] = v; maskData.data[p + 2] = v; maskData.data[p + 3] = 255;
        }
      }
      mCtx.putImageData(maskData, 0, 0);
      const mask512 = resizeToCanvas(maskAtTileRes, GAP_REFINE_TILE, GAP_REFINE_TILE, false);

      const outTile = await inpaintTile(lamaSessionInfo, imageCrop512, mask512);
      const outAtTileRes = resizeToCanvas(outTile, tw, th);
      canvas.getContext("2d").drawImage(outAtTileRes, x0, y0);

      if (done % 2 === 0) await new Promise((r) => requestAnimationFrame(r));
    }
  }
}

// Returns { stacked, leftCanvas, rightCanvas }. `stacked` is the top/bottom
// (left over right) equirectangular stereo pair at the source's width and
// 2x its height.
export async function synthesizeStereoPair(workingCanvas, depthArray, {
  maxShiftDeg = DEFAULT_MAX_SHIFT_DEG, lamaSessionInfo = null, onStatus,
} = {}) {
  const w = workingCanvas.width, h = workingCanvas.height;
  const maxShiftPx = Math.round(w * (maxShiftDeg / 360));

  onStatus && onStatus("Synthesizing left eye…");
  const left = synthesizeEye(workingCanvas, depthArray, LEFT_SIGN, maxShiftPx);
  onStatus && onStatus("Synthesizing right eye…");
  const right = synthesizeEye(workingCanvas, depthArray, RIGHT_SIGN, maxShiftPx);

  cloneFillGaps(left.imageData, left.filled, w, h);
  cloneFillGaps(right.imageData, right.filled, w, h);

  const leftCanvas = imageDataToCanvas(left.imageData);
  const rightCanvas = imageDataToCanvas(right.imageData);

  if (lamaSessionInfo) {
    onStatus && onStatus("Refining left eye disocclusion gaps…");
    await refineGapsWithLama(leftCanvas, left.filled, w, h, lamaSessionInfo, onStatus);
    onStatus && onStatus("Refining right eye disocclusion gaps…");
    await refineGapsWithLama(rightCanvas, right.filled, w, h, lamaSessionInfo, onStatus);
  }

  const stacked = document.createElement("canvas");
  stacked.width = w;
  stacked.height = h * 2;
  const ctx = stacked.getContext("2d");
  ctx.drawImage(leftCanvas, 0, 0);
  ctx.drawImage(rightCanvas, 0, h);

  return { stacked, leftCanvas, rightCanvas };
}
