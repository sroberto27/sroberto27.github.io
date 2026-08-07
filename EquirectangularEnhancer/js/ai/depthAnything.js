// Depth Anything V2 Small (onnx-community/depth-anything-v2-small,
// Apache-2.0 — the only Depth Anything V2 size released under a
// redistributable license; base/large/giant are CC-BY-NC-4.0).
//
// Run via a raw onnxruntime-web session (not the Transformers.js pipeline
// API) so it shares the single WASM/WebGPU runtime already set up for LaMa
// and Real-ESRGAN instead of pulling in a second copy.
//
// Verified empirically: input "pixel_values", ImageNet-normalized RGB NCHW,
// height/width must be multiples of 14; output "predicted_depth", single
// channel, same spatial size, where LARGER values mean CLOSER to the camera.
import { createSession, disposeSession, getOrt } from "./onnxRuntimeSetup.js";
import { resizeToCanvas, getImageData, imageDataToImageNetNCHW, imageDataToCanvas } from "./tensorUtils.js";

export const MODEL_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx";
export const MODEL_SIZE_MB = 27;
const TARGET_LONG_SIDE = 518;

export async function loadDepthSession(onProgress) {
  return await createSession(MODEL_URL, {
    onProgress: (loaded, total) => onProgress && onProgress(total ? loaded / total : 0),
  });
}

export function disposeDepth(sessionInfo) {
  disposeSession(sessionInfo.session);
}

function multipleOf14(n) {
  return Math.max(14, Math.round(n / 14) * 14);
}

// Resize target that preserves the source aspect ratio while keeping both
// dimensions multiples of 14 (the model's patch size).
function computeInputSize(width, height) {
  const aspect = width / height;
  let w, h;
  if (aspect >= 1) {
    w = TARGET_LONG_SIDE;
    h = multipleOf14(TARGET_LONG_SIDE / aspect);
  } else {
    h = TARGET_LONG_SIDE;
    w = multipleOf14(TARGET_LONG_SIDE * aspect);
  }
  return { w: multipleOf14(w), h };
}

// Returns a full-working-resolution grayscale canvas encoding normalized
// depth (0 = farthest, 255 = closest) for use by stereoSynthesis.
export async function runDepthAnything(workingCanvas, sessionInfo) {
  const w = workingCanvas.width, h = workingCanvas.height;
  const { w: inW, h: inH } = computeInputSize(w, h);

  const inputCanvas = resizeToCanvas(workingCanvas, inW, inH);
  const tensorData = imageDataToImageNetNCHW(getImageData(inputCanvas, inW, inH));

  const ort = await getOrt();
  const feeds = { pixel_values: new ort.Tensor("float32", tensorData, [1, 3, inH, inW]) };
  const results = await sessionInfo.session.run(feeds);
  const outTensor = results.predicted_depth || Object.values(results)[0];
  const dims = outTensor.dims; // [1, H', W']
  const outH = dims[dims.length - 2], outW = dims[dims.length - 1];
  const data = outTensor.data;

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const range = Math.max(max - min, 1e-6);

  const depthImageData = new ImageData(outW, outH);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    const v = Math.round(((data[i] - min) / range) * 255);
    depthImageData.data[p] = v;
    depthImageData.data[p + 1] = v;
    depthImageData.data[p + 2] = v;
    depthImageData.data[p + 3] = 255;
  }
  const depthCanvasSmall = imageDataToCanvas(depthImageData);
  return resizeToCanvas(depthCanvasSmall, w, h);
}

// Reads a depth canvas (from runDepthAnything) into a Float32Array in
// [0,1], row-major, for use by stereoSynthesis.
export function depthCanvasToArray(depthCanvas) {
  const w = depthCanvas.width, h = depthCanvas.height;
  const data = getImageData(depthCanvas, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) out[i] = data[p] / 255;
  return out;
}

// Shared depth cache: Generate VR 3D and Editor Mode's Smart Select / Depth
// Viewer / Stereo Strength slider all need "the depth map for the current
// image" — compute it once per image and hand back the same result instead
// of re-running the model per feature. Keyed loosely on canvas identity +
// size; a new source image invalidates the cache.
let cache = { canvas: null, width: 0, height: 0, depthCanvas: null, depthArray: null };

export function getCachedDepthMap(sourceCanvas) {
  if (cache.canvas === sourceCanvas && cache.width === sourceCanvas.width && cache.height === sourceCanvas.height) {
    return { depthCanvas: cache.depthCanvas, depthArray: cache.depthArray };
  }
  return null;
}

export function invalidateDepthCache() {
  cache = { canvas: null, width: 0, height: 0, depthCanvas: null, depthArray: null };
}

// Computes (or reuses the cached) depth map for sourceCanvas. Loads and
// disposes its own session unless one is passed in via opts.sessionInfo.
export async function computeDepthMap(sourceCanvas, { sessionInfo = null, onProgress, onStatus } = {}) {
  const hit = getCachedDepthMap(sourceCanvas);
  if (hit) return hit;

  let session = sessionInfo;
  let ownSession = false;
  if (!session) {
    onStatus && onStatus("Loading depth model…");
    session = await loadDepthSession(onProgress);
    ownSession = true;
  }
  onStatus && onStatus("Estimating depth…");
  const depthCanvas = await runDepthAnything(sourceCanvas, session);
  if (ownSession) disposeDepth(session);

  const depthArray = depthCanvasToArray(depthCanvas);
  cache = { canvas: sourceCanvas, width: sourceCanvas.width, height: sourceCanvas.height, depthCanvas, depthArray };
  return { depthCanvas, depthArray };
}
