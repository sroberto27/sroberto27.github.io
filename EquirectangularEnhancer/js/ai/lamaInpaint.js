// LaMa inpainting (Carve/LaMa-ONNX, Apache-2.0 — https://huggingface.co/Carve/LaMa-ONNX).
//
// Verified empirically against the model's own sample image/mask before
// wiring this in: image input is RGB [0,1] NCHW 512x512, mask input is a
// binary {0,1} NCHW 512x512 single channel where 1 = region to inpaint, and
// the output tensor is already in ~[0,255] RGB (no extra *255 needed).
import { createSession, disposeSession, getOrt } from "./onnxRuntimeSetup.js";
import {
  resizeToCanvas, cropToCanvas, canvasToImageData, imageDataToCanvas,
  imageDataToNCHW01, alphaOrLumaToBinaryMaskNCHW, nchw255ToImageData,
  wrapAwareCrop, drawWrapAwareBack,
} from "./tensorUtils.js";

export const MODEL_URL = "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx";
export const MODEL_SIZE_MB = 208;
const TILE = 512;

export async function loadLamaSession(onProgress) {
  const { session, backend } = await createSession(MODEL_URL, {
    onProgress: (loaded, total) => onProgress && onProgress(total ? loaded / total : 0),
  });
  return { session, backend };
}

export function disposeLama(session) {
  disposeSession(session);
}

// Draws a circular nadir mask (white = inpaint) at full working resolution.
// The circle is centered on the bottom edge, radius as a fraction of image
// height — this is a deliberately simple heuristic: it targets the
// tripod/photographer footprint typical of ground-mounted 360 rigs, not
// arbitrary unwanted objects elsewhere in the frame.
export function drawNadirMask(width, height, radiusFraction = 0.08) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  const r = height * radiusFraction;
  const cx = width / 2;
  const cy = height;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  return { canvas, cx, cy, r };
}

// Runs LaMa on a single 512x512 image+mask pair (both already at model
// resolution) and returns the raw output as a same-size canvas.
export async function inpaintTile(sessionInfo, imageCanvas512, maskCanvas512) {
  const ort = await getOrt();
  const imgData = canvasToImageData(imageCanvas512);
  const maskData = canvasToImageData(maskCanvas512);

  const imgTensorData = imageDataToNCHW01(imgData);
  const maskTensorData = alphaOrLumaToBinaryMaskNCHW(maskData);

  const feeds = {
    image: new ort.Tensor("float32", imgTensorData, [1, 3, TILE, TILE]),
    mask: new ort.Tensor("float32", maskTensorData, [1, 1, TILE, TILE]),
  };
  const results = await sessionInfo.session.run(feeds);
  const outName = sessionInfo.session.outputNames ? sessionInfo.session.outputNames[0] : "output";
  const outTensor = results[outName] || Object.values(results)[0];
  const imageData = nchw255ToImageData(outTensor.data, TILE, TILE);
  return imageDataToCanvas(imageData);
}

// Full nadir-cleanup pass: crops a padded square around the nadir circle,
// runs LaMa at 512x512, and feather-composites the result back into a copy
// of the working canvas.
export async function runNadirCleanup(workingCanvas, sessionInfo, { radiusFraction = 0.08 } = {}) {
  const w = workingCanvas.width, h = workingCanvas.height;
  const { cx, cy, r } = drawNadirMask(w, h, radiusFraction);

  const pad = r * 1.5;
  const boxSize = Math.min(Math.max(pad * 2, r * 2 + 32), Math.min(w, h * 2));
  const boxX = Math.max(0, Math.min(w - boxSize, cx - boxSize / 2));
  const boxY = Math.max(0, cy - boxSize);
  const boxW = Math.min(boxSize, w - boxX);
  const boxH = Math.min(boxSize, h - boxY);

  const imageCrop512 = cropToCanvas(workingCanvas, boxX, boxY, boxW, boxH, TILE, TILE);

  // Rasterize the circle mask directly in crop-local 512-space for a crisp,
  // non-blurred binary mask at model resolution.
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = TILE;
  maskCanvas.height = TILE;
  const mctx = maskCanvas.getContext("2d");
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, TILE, TILE);
  mctx.fillStyle = "#fff";
  mctx.beginPath();
  const scaleX = TILE / boxW, scaleY = TILE / boxH;
  mctx.ellipse((cx - boxX) * scaleX, (cy - boxY) * scaleY, r * scaleX, r * scaleY, 0, 0, Math.PI * 2);
  mctx.fill();

  const outputTile = await inpaintTile(sessionInfo, imageCrop512, maskCanvas);
  const outputAtCropRes = resizeToCanvas(outputTile, Math.round(boxW), Math.round(boxH));

  // Feathered composite: soft-edged circular alpha mask at crop resolution.
  const feather = document.createElement("canvas");
  feather.width = Math.round(boxW);
  feather.height = Math.round(boxH);
  const fctx = feather.getContext("2d");
  const grad = fctx.createRadialGradient(
    cx - boxX, cy - boxY, Math.max(0, r - r * 0.15),
    cx - boxX, cy - boxY, r * 1.1
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  fctx.fillStyle = grad;
  fctx.beginPath();
  fctx.ellipse(cx - boxX, cy - boxY, r * 1.1, r * 1.1, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.globalCompositeOperation = "source-in";
  fctx.drawImage(outputAtCropRes, 0, 0);

  const result = document.createElement("canvas");
  result.width = w;
  result.height = h;
  const rctx = result.getContext("2d");
  rctx.drawImage(workingCanvas, 0, 0);
  rctx.drawImage(feather, boxX, boxY);
  return result;
}

// Editor Mode's freeform/depth-based object removal: unlike runNadirCleanup
// (a fixed circle at a known spot), the mask here can be any user-painted
// shape anywhere in the image — including straddling the left/right seam.
// Finds the mask's bounding region (wrap-aware on x), crops a padded box
// around it, runs LaMa at 512x512, and feather-composites the result back.
export async function runMaskedCleanup(baseCanvas, maskCanvas, sessionInfo, { padFraction = 0.25, minPad = 48 } = {}) {
  const w = baseCanvas.width, h = baseCanvas.height;
  const maskData = maskCanvas.getContext("2d").getImageData(0, 0, w, h).data;

  const colHas = new Uint8Array(w);
  const rowHas = new Uint8Array(h);
  let anyMarked = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (maskData[(y * w + x) * 4] > 128) { colHas[x] = 1; rowHas[y] = 1; anyMarked = true; }
    }
  }
  if (!anyMarked) return baseCanvas;

  // Wrap-aware x span: the marked region is everything outside the longest
  // circular run of unmarked columns — handles selections that straddle x=0.
  let bestLen = 0, bestStart = 0, run = 0, runStart = 0;
  for (let i = 0; i < w * 2; i++) {
    const x = i % w;
    if (!colHas[x]) {
      if (run === 0) runStart = i;
      run++;
      if (run > bestLen) { bestLen = run; bestStart = runStart; }
    } else {
      run = 0;
    }
  }
  bestLen = Math.min(bestLen, w);
  const markedStart = (bestStart + bestLen) % w;
  const markedLen = Math.max(1, w - bestLen);

  let minY = h, maxY = -1;
  for (let y = 0; y < h; y++) if (rowHas[y]) { if (y < minY) minY = y; if (y > maxY) maxY = y; }

  const padX = Math.max(minPad, Math.round(markedLen * padFraction));
  const padY = Math.max(minPad, Math.round((maxY - minY + 1) * padFraction));

  const boxX = markedStart - padX;
  const boxW = Math.min(w, markedLen + padX * 2);
  const boxY = Math.max(0, minY - padY);
  const boxH = Math.min(h, maxY + 1 + padY) - boxY;

  const TILE = 512;
  const imageCrop = wrapAwareCrop(baseCanvas, w, h, boxX, boxY, boxW, boxH);
  const maskCrop = wrapAwareCrop(maskCanvas, w, h, boxX, boxY, boxW, boxH);

  const imageCrop512 = resizeToCanvas(imageCrop, TILE, TILE);
  const maskCrop512 = resizeToCanvas(maskCrop, TILE, TILE, false);

  const outputTile = await inpaintTile(sessionInfo, imageCrop512, maskCrop512);
  const outputAtCropRes = resizeToCanvas(outputTile, boxW, boxH);

  // Feather using a blurred version of the crop-local mask as the alpha, so
  // the composite edge follows the user's painted shape instead of a fixed
  // ellipse.
  const feather = document.createElement("canvas");
  feather.width = boxW;
  feather.height = boxH;
  const fctx = feather.getContext("2d");
  fctx.filter = `blur(${Math.max(2, Math.round(Math.min(boxW, boxH) * 0.03))}px)`;
  fctx.drawImage(maskCrop, 0, 0);
  fctx.filter = "none";
  fctx.globalCompositeOperation = "source-in";
  fctx.drawImage(outputAtCropRes, 0, 0);

  const result = document.createElement("canvas");
  result.width = w;
  result.height = h;
  result.getContext("2d").drawImage(baseCanvas, 0, 0);
  drawWrapAwareBack(result, feather, boxX, boxY);
  return result;
}
