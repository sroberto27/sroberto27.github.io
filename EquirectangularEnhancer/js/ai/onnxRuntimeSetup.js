// Shared onnxruntime-web runtime for every AI stage (LaMa, Real-ESRGAN, and
// the raw Depth Anything V2 session) so only one WASM/WebGPU backend is ever
// loaded, and one model cache is shared across stages.
//
// GitHub Pages can't set COOP/COEP response headers, so cross-origin
// isolation (and therefore multi-threaded WASM, which needs SharedArrayBuffer)
// is unavailable here — we force single-threaded WASM explicitly.

const ORT_VERSION = "1.27.0";
const ORT_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_CACHE_NAME = "equirect-ai-models-v1";

let ortPromise = null;

export function getOrt() {
  if (!ortPromise) {
    ortPromise = import(/* webpackIgnore: true */ `${ORT_CDN_BASE}ort.all.min.mjs`).then((ort) => {
      ort.env.wasm.wasmPaths = ORT_CDN_BASE;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      return ort;
    });
  }
  return ortPromise;
}

export async function isWebGpuAvailable() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

// Fetches (and caches, via the Cache API) an ONNX model's raw bytes,
// reporting download progress. Repeat visits hit the cache and skip the
// network entirely.
export async function fetchModelBytes(url, onProgress) {
  const cache = await caches.open(MODEL_CACHE_NAME).catch(() => null);

  if (cache) {
    const cached = await cache.match(url);
    if (cached) {
      onProgress && onProgress(1, 1, true);
      return await cached.arrayBuffer();
    }
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download model: ${url} (${response.status})`);

  if (cache) {
    try { await cache.put(url, response.clone()); } catch { /* quota or opaque response — proceed without caching */ }
  }

  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || !total) {
    onProgress && onProgress(0, 0, false);
    return await response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress && onProgress(loaded, total, false);
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return buffer.buffer;
}

// Creates an inference session, preferring WebGPU and transparently falling
// back to WASM if WebGPU init fails or is unavailable.
export async function createSession(modelUrl, { onProgress, preferWebgpu = true } = {}) {
  const ort = await getOrt();
  const bytes = await fetchModelBytes(modelUrl, onProgress);

  if (preferWebgpu && (await isWebGpuAvailable())) {
    try {
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"] });
      return { session, backend: "webgpu" };
    } catch {
      // fall through to WASM
    }
  }

  const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  return { session, backend: "wasm" };
}

export function disposeSession(session) {
  try { session && session.release && session.release(); } catch { /* best-effort */ }
}
