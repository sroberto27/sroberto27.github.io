// Live histogram/stats for Editor Mode's analysis panel. Runs on a small
// downsampled proxy of the current preview (not the full working image), so
// it stays cheap enough to recompute on every slider release.

self.onmessage = (e) => {
  const { buffer, width, height } = e.data;
  const data = new Uint8ClampedArray(buffer);
  const n = width * height;

  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  const histL = new Uint32Array(256);
  const luma = new Float32Array(n);

  let sumL = 0, clippedHi = 0, clippedLo = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    histR[r]++; histG[g]++; histB[b]++;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    histL[l | 0]++;
    sumL += l;
    if (r >= 250 || g >= 250 || b >= 250) clippedHi++;
    if (r <= 5 && g <= 5 && b <= 5) clippedLo++;
  }

  const meanBrightness = sumL / n;
  let varL = 0;
  for (let i = 0; i < n; i++) { const d = luma[i] - meanBrightness; varL += d * d; }
  const contrastStd = Math.sqrt(varL / n);

  self.postMessage({
    histR, histG, histB, histL,
    meanBrightness,
    contrastStd,
    clippedHighlightsPct: (clippedHi / n) * 100,
    clippedShadowsPct: (clippedLo / n) * 100,
    width, height,
  }, [histR.buffer, histG.buffer, histB.buffer, histL.buffer]);
};
