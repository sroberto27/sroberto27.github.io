// Depth-based "magic wand": grows a selection outward from a clicked point
// by depth similarity instead of color similarity, using the same depth map
// Generate VR 3D already computed (see computeDepthMap in ai/depthAnything.js).
// A 4-connected flood fill wrapping across the left/right seam (matching the
// panorama's own topology) and clamped at the poles.

const MAX_STACK = 4_000_000; // safety cap so a pathologically flat depth map can't blow up memory

export function smartSelectByDepth(depthArray, width, height, x0, y0, { threshold = 0.05 } = {}) {
  const startIdx = y0 * width + x0;
  const seedDepth = depthArray[startIdx];
  const visited = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);

  const capacity = Math.min(width * height, MAX_STACK);
  const stack = new Int32Array(capacity);
  let sp = 0;
  stack[sp++] = startIdx;
  visited[startIdx] = 1;

  while (sp > 0) {
    const idx = stack[--sp];
    const d = depthArray[idx];
    if (Math.abs(d - seedDepth) > threshold) continue;
    mask[idx] = 1;

    const y = (idx / width) | 0;
    const x = idx - y * width;
    const xl = (x - 1 + width) % width;
    const xr = (x + 1) % width;

    const neighbors = [y * width + xl, y * width + xr];
    if (y > 0) neighbors.push((y - 1) * width + x);
    if (y < height - 1) neighbors.push((y + 1) * width + x);

    for (const n of neighbors) {
      if (!visited[n]) {
        visited[n] = 1;
        if (sp < capacity) stack[sp++] = n;
      }
    }
  }

  return mask; // Uint8Array, 1 = selected
}

export function maskArrayToCanvas(mask, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const imgData = new ImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const v = mask[i] ? 255 : 0;
    const p = i * 4;
    imgData.data[p] = v; imgData.data[p + 1] = v; imgData.data[p + 2] = v; imgData.data[p + 3] = 255;
  }
  canvas.getContext("2d").putImageData(imgData, 0, 0);
  return canvas;
}

// Rolls a depth map (and its source array) horizontally by shiftPx — kept in
// sync with the Recenter (yaw) control so a baked recenter doesn't
// invalidate cached depth used by Smart Select / the depth viewer.
export function rollDepthArray(depthArray, width, height, shiftPx) {
  const shift = ((Math.round(shiftPx) % width) + width) % width;
  if (shift === 0) return depthArray;
  // Matches editorTone's uYawShift sampling convention: the baked pixel at
  // column x reads from source column (x + shift) mod width, so the rolled
  // depth map must be indexed the same way to stay spatially aligned.
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      out[rowStart + x] = depthArray[rowStart + ((x + shift) % width)];
    }
  }
  return out;
}
