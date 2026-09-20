/**
 * Image content inspection.
 *
 * A 200 response is not coverage. The imagery service publishes an extent far
 * larger than the areas it actually holds pixels for, and its own metadata
 * states that the no-data value is 0, so a request outside coverage returns a
 * perfectly valid black image. Accepting that as imagery would put an empty
 * map under a scouting decision.
 *
 * These statistics decide between three states, and an image that does not
 * clearly fall into one is reported as `suspect` rather than pushed into
 * whichever neighbour is convenient.
 *
 * Thresholds are calibrated against real responses from the configured service
 * and recorded with the probe evidence, not chosen by eye.
 */

/** All channels at or below this are treated as the service no-data value. */
export const NEAR_BLACK_LEVEL = 8;

export const CONTENT_THRESHOLDS = Object.freeze({
  // A tile that is essentially all no-data.
  noDataNearBlackFraction: 0.98,
  // A tile that is one flat colour is not photography, whatever that colour is.
  uniformDominantFraction: 0.98,
  // Aerial photography of a built area varies far more than this.
  coveredMinStdDev: 6,
  coveredMaxNearBlackFraction: 0.5,
  // Variation alone is not enough: an image split between two flat regions,
  // such as a coverage edge, has a high standard deviation and no texture at
  // all. Photography carries thousands of distinct colours.
  coveredMinDistinctColourFraction: 0.005,
});

/**
 * Computes content statistics for decoded RGB pixels.
 *
 * @param {{width: number, height: number, data: Uint8Array}} image RGB, 3 bytes per pixel.
 * @param {{sampleStride?: number}} [options] Inspect every Nth pixel. The
 *   default inspects all of them; a stride only exists for very large images.
 */
export function imageStatistics(image, { sampleStride = 1 } = {}) {
  const { width, height, data } = image;
  const pixelCount = width * height;
  if (!pixelCount || data.length < pixelCount * 3) {
    throw new RangeError("image data is smaller than its declared dimensions");
  }

  let sampled = 0;
  let nearBlack = 0;
  const sums = [0, 0, 0];
  const squares = [0, 0, 0];
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  const colourCounts = new Map();

  for (let index = 0; index < pixelCount; index += sampleStride) {
    const offset = index * 3;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];

    sampled += 1;
    if (r <= NEAR_BLACK_LEVEL && g <= NEAR_BLACK_LEVEL && b <= NEAR_BLACK_LEVEL) nearBlack += 1;

    const channels = [r, g, b];
    for (let c = 0; c < 3; c += 1) {
      const value = channels[c];
      sums[c] += value;
      squares[c] += value * value;
      if (value < min[c]) min[c] = value;
      if (value > max[c]) max[c] = value;
    }

    const key = (r << 16) | (g << 8) | b;
    colourCounts.set(key, (colourCounts.get(key) ?? 0) + 1);
  }

  const mean = sums.map((sum) => sum / sampled);
  const stdDev = squares.map((square, c) => {
    const variance = square / sampled - mean[c] * mean[c];
    return Math.sqrt(Math.max(variance, 0));
  });

  let dominantCount = 0;
  for (const count of colourCounts.values()) {
    if (count > dominantCount) dominantCount = count;
  }

  return {
    width,
    height,
    sampled,
    mean,
    stdDev,
    min,
    max,
    meanStdDev: (stdDev[0] + stdDev[1] + stdDev[2]) / 3,
    nearBlackFraction: nearBlack / sampled,
    distinctColours: colourCounts.size,
    dominantColourFraction: dominantCount / sampled,
  };
}

/**
 * Classifies an image as `covered`, `no-data`, `uniform` or `suspect`.
 *
 * `suspect` is a real outcome, not a rounding of one of the others. It means
 * the image does not look like no-data and does not look like photography
 * either, which is exactly the case a person needs to look at.
 *
 * @returns {{verdict: string, reason: string, statistics: object}}
 */
export function classifyImageContent(image, thresholds = CONTENT_THRESHOLDS) {
  const statistics = imageStatistics(image);

  if (statistics.nearBlackFraction >= thresholds.noDataNearBlackFraction) {
    return {
      verdict: "no-data",
      reason: `${percent(statistics.nearBlackFraction)} of pixels are at or below the service no-data level`,
      statistics,
    };
  }

  if (statistics.dominantColourFraction >= thresholds.uniformDominantFraction) {
    return {
      verdict: "uniform",
      reason: `${percent(statistics.dominantColourFraction)} of pixels share one colour, so this is not photography`,
      statistics,
    };
  }

  const distinctColourFraction = statistics.distinctColours / statistics.sampled;
  if (
    statistics.meanStdDev >= thresholds.coveredMinStdDev &&
    statistics.nearBlackFraction <= thresholds.coveredMaxNearBlackFraction &&
    distinctColourFraction >= thresholds.coveredMinDistinctColourFraction
  ) {
    return {
      verdict: "covered",
      reason: `mean channel standard deviation ${statistics.meanStdDev.toFixed(1)} across ${statistics.distinctColours} distinct colours`,
      statistics,
    };
  }

  return {
    verdict: "suspect",
    reason:
      `variation ${statistics.meanStdDev.toFixed(1)}, ${percent(statistics.nearBlackFraction)} near-black and ` +
      `${statistics.distinctColours} distinct colours match neither coverage nor no-data; inspect this tile`,
    statistics,
  };
}

function percent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}
