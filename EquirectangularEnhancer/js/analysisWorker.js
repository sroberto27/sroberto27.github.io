// Runs off the main thread: histogram, noise estimate, white-balance gains,
// seam mismatch, and saturation stats on a downsampled copy of the image.
// All heavy per-pixel work happens here so the UI thread never freezes.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

self.onmessage = (e) => {
  const { buffer, width, height } = e.data;
  const data = new Uint8ClampedArray(buffer);
  const n = width * height;

  // --- Luminance + per-channel sums, histogram ---
  const hist = new Uint32Array(256);
  let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumSat = 0;
  const luma = new Float32Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    hist[l | 0]++;
    sumR += r; sumG += g; sumB += b; sumL += l;

    const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
    const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
    sumSat += sat;
  }

  const meanR = sumR / n, meanG = sumG / n, meanB = sumB / n;
  const meanL = sumL / n;
  const meanSat = sumSat / n / 255 * 255; // already 0..1 scale from above calc (maxc in 0..255) -> sat is 0..1 already
  const meanSatNorm = sumSat / n; // 0..1

  let varL = 0;
  for (let i = 0; i < n; i++) { const d = luma[i] - meanL; varL += d * d; }
  varL /= n;
  const stdL = Math.sqrt(varL);

  // 1st/99th percentile via histogram for dynamic range check
  let cum = 0, p1 = 0, p99 = 255;
  const targetLo = n * 0.01, targetHi = n * 0.99;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum >= targetLo) { p1 = i; break; }
  }
  cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum >= targetHi) { p99 = i; break; }
  }
  const dynRange = (p99 - p1) / 255; // 0..1, low = flat/low-contrast source

  // --- Noise estimate: Laplacian variance restricted to low-gradient (flat) regions ---
  let noiseSum = 0, noiseCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const c = luma[idx];
      const left = luma[idx - 1], right = luma[idx + 1];
      const up = luma[idx - width], down = luma[idx + width];
      const gradMag = Math.abs(right - left) + Math.abs(down - up);
      if (gradMag < 18) { // flat-ish region
        const lap = 4 * c - left - right - up - down;
        noiseSum += lap * lap;
        noiseCount++;
      }
    }
  }
  const noiseVariance = noiseCount > 0 ? noiseSum / noiseCount : 0;
  // Normalize to a rough 0..1 "noise level" (empirically calibrated divisor)
  const noiseLevel = clamp(Math.sqrt(noiseVariance) / 20, 0, 1);

  // --- Seam mismatch: compare average color of leftmost vs rightmost columns ---
  const seamCols = Math.max(1, Math.round(width * 0.01));
  let lr = 0, lg = 0, lb = 0, rr = 0, rg = 0, rb = 0, cnt = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < seamCols; x++) {
      const pL = (y * width + x) * 4;
      const pR = (y * width + (width - 1 - x)) * 4;
      lr += data[pL]; lg += data[pL + 1]; lb += data[pL + 2];
      rr += data[pR]; rg += data[pR + 1]; rb += data[pR + 2];
      cnt++;
    }
  }
  lr /= cnt; lg /= cnt; lb /= cnt; rr /= cnt; rg /= cnt; rb /= cnt;
  const seamDelta = [
    clamp((rr - lr) / 255, -0.06, 0.06),
    clamp((rg - lg) / 255, -0.06, 0.06),
    clamp((rb - lb) / 255, -0.06, 0.06),
  ];

  // --- White balance gain (gray-world), clamped conservatively ---
  const targetGray = (meanR + meanG + meanB) / 3;
  const wbGain = [
    clamp(targetGray / Math.max(meanR, 1), 0.85, 1.2),
    clamp(targetGray / Math.max(meanG, 1), 0.85, 1.2),
    clamp(targetGray / Math.max(meanB, 1), 0.85, 1.2),
  ];

  // --- Derived adaptive pipeline parameters ---
  const stdNorm = stdL / 255; // rough global contrast

  const denoiseStrength = clamp(noiseLevel * 0.9, 0, 0.75);
  const localContrastStrength = clamp((0.55 - dynRange) * 1.1, 0.05, 0.55);
  const sharpenAmount = clamp(0.55 - noiseLevel * 0.4, 0.12, 0.55);
  const saturationAmount = clamp((0.45 - meanSatNorm) * 0.5, 0, 0.22);

  self.postMessage({
    meanL, stdL: stdNorm, dynRange, noiseLevel,
    wbGain, seamDelta,
    denoiseStrength, localContrastStrength, sharpenAmount, saturationAmount,
    meanSat: meanSatNorm,
  });
};
