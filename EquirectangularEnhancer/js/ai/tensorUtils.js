// Small canvas <-> ONNX tensor conversion helpers shared by the AI stages.

export function resizeToCanvas(source, w, h, smoothing = true) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = smoothing;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export function cropToCanvas(source, sx, sy, sw, sh, outW, outH) {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas;
}

export function getImageData(canvasOrSource, w, h) {
  const canvas = canvasOrSource instanceof HTMLCanvasElement && canvasOrSource.width === w && canvasOrSource.height === h
    ? canvasOrSource
    : resizeToCanvas(canvasOrSource, w, h);
  return canvas.getContext("2d").getImageData(0, 0, w, h);
}

// RGB image, [0,1] range, NCHW float32 — verified convention for both the
// LaMa and Real-ESRGAN ONNX exports used here.
export function imageDataToNCHW01(imageData) {
  const { width: w, height: h, data } = imageData;
  const out = new Float32Array(3 * w * h);
  const plane = w * h;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = data[p] / 255;
    out[plane + i] = data[p + 1] / 255;
    out[2 * plane + i] = data[p + 2] / 255;
  }
  return out;
}

// ImageNet-normalized RGB, NCHW float32 — used by the Depth Anything V2 ONNX
// export (mean/std from its preprocessor_config.json).
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

export function imageDataToImageNetNCHW(imageData) {
  const { width: w, height: h, data } = imageData;
  const out = new Float32Array(3 * w * h);
  const plane = w * h;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = (data[p] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    out[plane + i] = (data[p + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    out[2 * plane + i] = (data[p + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }
  return out;
}

// Binary single-channel mask, NCHW float32, values in {0,1}. 1 = region to
// modify (inpaint hole / disocclusion gap) — verified LaMa convention.
export function alphaOrLumaToBinaryMaskNCHW(imageData, threshold = 0.5) {
  const { width: w, height: h, data } = imageData;
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const luma = (data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722) / 255;
    out[i] = luma > threshold ? 1 : 0;
  }
  return out;
}

// CHW float32 in [0,1] (no batch dim) -> ImageData, clamped.
export function nchw01ToImageData(chw, w, h) {
  const plane = w * h;
  const imageData = new ImageData(w, h);
  const data = imageData.data;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    data[p] = clamp255(chw[i] * 255);
    data[p + 1] = clamp255(chw[plane + i] * 255);
    data[p + 2] = clamp255(chw[2 * plane + i] * 255);
    data[p + 3] = 255;
  }
  return imageData;
}

// CHW float32 already in ~[0,255] (no batch dim) -> ImageData, clamped.
// Verified convention for the LaMa ONNX export's output tensor.
export function nchw255ToImageData(chw, w, h) {
  const plane = w * h;
  const imageData = new ImageData(w, h);
  const data = imageData.data;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    data[p] = clamp255(chw[i]);
    data[p + 1] = clamp255(chw[plane + i]);
    data[p + 2] = clamp255(chw[2 * plane + i]);
    data[p + 3] = 255;
  }
  return imageData;
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function canvasToImageData(canvas) {
  return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
}

export function imageDataToCanvas(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return canvas;
}

// Crops a wCrop x hCrop region starting at (x,y): wraps horizontally across
// the equirectangular seam (x may be negative or exceed width — handled via
// modulo), clamps (edge-extends) vertically since there's no wraparound at
// the poles. Shared by Real-ESRGAN tiling, editor regional tools, and the
// LaMa arbitrary-mask cleanup — anything that crops a working region out of
// a 360 panorama needs this same seam-safe behavior.
export function wrapAwareCrop(source, width, height, x, y, wCrop, hCrop) {
  const canvas = document.createElement("canvas");
  canvas.width = wCrop;
  canvas.height = hCrop;
  const ctx = canvas.getContext("2d");

  const srcY = Math.max(0, y);
  const srcYEnd = Math.min(height, y + hCrop);
  const srcH = Math.max(0, srcYEnd - srcY);
  const destY = srcY - y;

  let curX = ((x % width) + width) % width;
  let remaining = wCrop;
  let destX = 0;
  while (remaining > 0 && srcH > 0) {
    const segW = Math.min(remaining, width - curX);
    ctx.drawImage(source, curX, srcY, segW, srcH, destX, destY, segW, srcH);
    destX += segW;
    remaining -= segW;
    curX = 0;
  }
  if (destY > 0) ctx.drawImage(canvas, 0, destY, wCrop, 1, 0, 0, wCrop, destY);
  const bottomStart = destY + srcH;
  if (bottomStart < hCrop && bottomStart > 0) {
    ctx.drawImage(canvas, 0, bottomStart - 1, wCrop, 1, 0, bottomStart, wCrop, hCrop - bottomStart);
  }
  return canvas;
}

// Inverse of wrapAwareCrop: draws patchCanvas (wCrop x hCrop) back onto
// destCanvas at (x,y), wrapping horizontally across the seam. Splits into up
// to two horizontal segments when the patch straddles x=0/x=width. No
// vertical wrap (matches wrapAwareCrop's clamp-at-poles convention).
export function drawWrapAwareBack(destCanvas, patchCanvas, x, y) {
  const width = destCanvas.width, height = destCanvas.height;
  const wCrop = patchCanvas.width, hCrop = patchCanvas.height;
  const ctx = destCanvas.getContext("2d");

  const destY = Math.max(0, y);
  const srcYOffset = destY - y;
  const drawH = Math.min(hCrop - srcYOffset, height - destY);
  if (drawH <= 0) return;

  let curX = ((x % width) + width) % width;
  let remaining = wCrop;
  let srcX = 0;
  while (remaining > 0) {
    const segW = Math.min(remaining, width - curX);
    ctx.drawImage(patchCanvas, srcX, srcYOffset, segW, drawH, curX, destY, segW, drawH);
    srcX += segW;
    remaining -= segW;
    curX = 0;
  }
}
