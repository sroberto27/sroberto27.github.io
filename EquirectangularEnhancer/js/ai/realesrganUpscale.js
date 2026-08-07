// Real-ESRGAN x4 upscale (SceneWorks/real-esrgan-onnx, BSD-3-Clause,
// following the upstream Real-ESRGAN weights — https://huggingface.co/SceneWorks/real-esrgan-onnx).
//
// Verified empirically: input tensor name "input", RGB [0,1] NCHW, dynamic
// HxW; output tensor name "output", RGB ~[0,1] NCHW at 4x the input size.
//
// The model has no notion of "this is a 360 panorama" — tiling has to
// enforce that geometry itself: horizontal tile padding wraps across the
// left/right seam instead of clamping, and tiles near the poles are blended
// back toward a plain bicubic upscale so pole distortion isn't amplified by
// a model trained on ordinary photos.
import { createSession, disposeSession, getOrt } from "./onnxRuntimeSetup.js";
import { canvasToImageData, imageDataToCanvas, imageDataToNCHW01, nchw01ToImageData, resizeToCanvas, cropToCanvas, wrapAwareCrop } from "./tensorUtils.js";

export const MODEL_URL = "https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x4.onnx";
export const MODEL_SIZE_MB = 64;
export const SCALE = 4;

const CORE = 480;
const PAD = 16;
const TILE_IN = CORE + PAD * 2; // 512, matching the model card's own recommended tiling

export async function loadRealEsrganSession(onProgress) {
  return await createSession(MODEL_URL, {
    onProgress: (loaded, total) => onProgress && onProgress(total ? loaded / total : 0),
  });
}

export function disposeRealEsrgan(sessionInfo) {
  disposeSession(sessionInfo.session);
}

// 1 in the equatorial band, fading to 0 within the top/bottom ~14% of rows —
// same falloff shape used by the traditional pipeline's pole attenuation.
function poleWeight(yCenter, height) {
  const v = yCenter / height;
  const d = Math.min(v, 1 - v);
  const band0 = 0.04, band1 = 0.14;
  if (d >= band1) return 1;
  if (d <= band0) return 0;
  return (d - band0) / (band1 - band0);
}

export async function upscaleRealEsrgan(workingCanvas, sessionInfo, { onTileProgress } = {}) {
  const w = workingCanvas.width, h = workingCanvas.height;
  const outW = w * SCALE, outH = h * SCALE;

  const baseline = resizeToCanvas(workingCanvas, outW, outH); // bicubic-ish fallback for pole blending
  const result = document.createElement("canvas");
  result.width = outW;
  result.height = outH;
  const rctx = result.getContext("2d");
  rctx.drawImage(baseline, 0, 0);

  const ort = await getOrt();
  const tilesX = Math.ceil(w / CORE);
  const tilesY = Math.ceil(h / CORE);
  const total = tilesX * tilesY;
  let done = 0;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const coreX = tx * CORE, coreY = ty * CORE;
      const coreW = Math.min(CORE, w - coreX), coreH = Math.min(CORE, h - coreY);
      const cropX = coreX - PAD, cropY = coreY - PAD;

      const tileCanvas = wrapAwareCrop(workingCanvas, w, h, cropX, cropY, TILE_IN, TILE_IN);
      const tensorData = imageDataToNCHW01(canvasToImageData(tileCanvas));
      const feeds = { input: new ort.Tensor("float32", tensorData, [1, 3, TILE_IN, TILE_IN]) };
      const results = await sessionInfo.session.run(feeds);
      const outTensor = results.output || Object.values(results)[0];
      const outSize = TILE_IN * SCALE;
      const outCanvas = imageDataToCanvas(nchw01ToImageData(outTensor.data, outSize, outSize));

      const padOut = PAD * SCALE;
      const coreOutW = coreW * SCALE, coreOutH = coreH * SCALE;
      const coreCanvas = cropToCanvas(outCanvas, padOut, padOut, coreOutW, coreOutH, coreOutW, coreOutH);

      const destX = coreX * SCALE, destY = coreY * SCALE;
      const pw = poleWeight(coreY + coreH / 2, h);
      if (pw > 0.001) {
        rctx.globalAlpha = pw;
        rctx.drawImage(coreCanvas, destX, destY);
        rctx.globalAlpha = 1;
      }

      done++;
      onTileProgress && onTileProgress(done, total);
      // Yield periodically so the progress UI actually paints during long WASM runs.
      if (done % 4 === 0) await new Promise((r) => requestAnimationFrame(r));
    }
  }
  return result;
}
