// Wraps histogramWorker.js: builds a small downsampled proxy of whatever
// canvas is currently on screen and computes histogram/stats off the main
// thread, debounced so it never fights the real-time slider preview.

const PROXY_MAX_WIDTH = 256;

let worker = null;
function getWorker() {
  if (!worker) worker = new Worker("js/editor/histogramWorker.js");
  return worker;
}

export function computeProxyImageData(sourceCanvas, maxW = PROXY_MAX_WIDTH) {
  const scale = Math.min(1, maxW / sourceCanvas.width);
  const w = Math.max(2, Math.round(sourceCanvas.width * scale));
  const h = Math.max(2, Math.round(sourceCanvas.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(sourceCanvas, 0, 0, w, h);
  return c.getContext("2d").getImageData(0, 0, w, h);
}

export function computeHistogram(imageData) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const data = new Uint8ClampedArray(imageData.data); // copy — the worker takes ownership of this buffer
    w.onmessage = (e) => resolve(e.data);
    w.onerror = (err) => reject(err);
    w.postMessage({ buffer: data.buffer, width: imageData.width, height: imageData.height }, [data.buffer]);
  });
}

// Draws RGB + luminance histograms into `canvas`, scaled to its pixel size.
export function drawHistogram(canvas, stats) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const drawChannel = (hist, color, alpha) => {
    const max = Math.max(1, ...hist);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * w;
      const y = h - (hist[i] / max) * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  drawChannel(stats.histR, "#ff6b6b", 0.45);
  drawChannel(stats.histG, "#4ade80", 0.45);
  drawChannel(stats.histB, "#5cc8ff", 0.45);
  drawChannel(stats.histL, "#e8ecf4", 0.35);
}

// Debounced recompute helper: call schedule() on every slider input; it only
// actually runs `delay` ms after the last call (plus a final run happens on
// pointerup, which callers should invoke via runNow()).
export function makeDebouncedHistogram(getSourceCanvas, onResult, delay = 150) {
  let timer = null;
  async function runNow() {
    const proxy = computeProxyImageData(getSourceCanvas());
    const stats = await computeHistogram(proxy);
    onResult(stats, proxy);
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(runNow, delay);
  }
  return { schedule, runNow };
}
