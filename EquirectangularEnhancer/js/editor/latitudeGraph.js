// Per-latitude average brightness — makes pole overexposure/underexposure
// and stitching brightness mismatches visible in a way a normal histogram
// (which pools the whole image together) can't show. Computed from the same
// downsampled proxy image the histogram uses, so it's cheap enough to
// recompute alongside it.

export function computeLatitudeBrightness(imageData, bins = 48) {
  const { width, height, data } = imageData;
  const rowsPerBin = height / bins;
  const result = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const y0 = Math.floor(b * rowsPerBin);
    const y1 = Math.max(y0 + 1, Math.floor((b + 1) * rowsPerBin));
    let sum = 0, count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4;
        sum += 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
        count++;
      }
    }
    result[b] = count ? sum / count : 0;
  }
  return result; // index 0 = top of frame (+90° latitude) ... last index = bottom (-90°)
}

export function drawLatitudeGraph(canvas, brightnessArray) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Midline at 128 (neutral gray) for a visual reference.
  ctx.strokeStyle = "rgba(152,162,184,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const midY = h - (128 / 255) * h;
  ctx.moveTo(0, midY);
  ctx.lineTo(w, midY);
  ctx.stroke();

  const n = brightnessArray.length;
  ctx.strokeStyle = "#5cc8ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const y = h - (brightnessArray[i] / 255) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
