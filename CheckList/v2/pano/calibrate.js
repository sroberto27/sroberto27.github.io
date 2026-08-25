/* ===================== FOCAL LENGTH SELF-CALIBRATION =====================
   Recovers the camera's true focal length from the capture itself.

   This targets the largest single error source in the current stitcher:
   capture360.js hardcodes ASSUMED_H_FOV_DEG = 68 with the comment "no
   browser API exposes the real value", and pano-stitch-worker.js
   projects every pixel using it. When the real FOV differs, the error is
   RADIAL and INSIDE each frame -- image centres can line up perfectly
   while edges overlap wrongly. No amount of pose refinement fixes it,
   which is why this runs before the bundle adjustment rather than after.

   The principle: under pure rotation, correspondences between two views
   are related by a rotation of their ray directions. Rays depend on the
   assumed focal length. At the wrong focal the rays are radially
   distorted and NO rotation can align them, so the best-fit residual is
   minimised at the true value. We therefore search focal length directly
   against total alignment residual.

   Caveat worth knowing: the signal is weak when all correspondences sit
   near the image centre, because that is where an incorrect focal has
   least effect. `spread` in the result reports how far matches reach
   from centre so a weak estimate can be detected instead of trusted.

   A second, more dangerous caveat, found by replaying a real handheld
   capture rather than the noise-free synthetic scenes this was
   originally validated against: the residual MUST be measured in pixel
   space, not as the angle between unit ray vectors. A fixed amount of
   real match noise (JPEG blur, sub-pixel localisation error, anything
   that is not the radial-distortion signal this search is trying to
   read) produces a SMALLER angular residual as the assumed focal grows,
   because pixelToRay divides by f -- rays collapse toward straight-ahead
   as the field of view narrows, regardless of whether the correspondence
   is actually consistent. That makes plain angular residual monotonic in
   focal for noisy data: shrinking the assumed field of view always looks
   like it helps, all the way to the degenerate limit, independent of the
   true geometry. On one real 34-shot capture this drove the search to
   its floor (45deg, then 8deg when the floor was moved to test it) with
   NO interior minimum anywhere in between -- a strictly monotonic curve,
   not a noisy-but-real one. Reprojecting into pixel space before scoring
   fixes this: a fixed pixel-level mismatch stays a fixed pixel-level
   mismatch regardless of the assumed focal, so only genuine radial
   distortion (which really does scale with focal error) still produces
   a minimum, and the degenerate collapse is no longer rewarded. */
(function (global) {
  'use strict';

  const S = global.LSCSO3;
  const C = global.LSCCamera;
  const E = global.LSCEstimate;

  function raysFor(matches, W, H, f) {
    const a = [], b = [];
    for (let k = 0; k < matches.length; k++) {
      const m = matches[k];
      a.push(C.pixelToRay(m.ax, m.ay, W, H, f));
      b.push(C.pixelToRay(m.bx, m.by, W, H, f));
    }
    return { a: a, b: b };
  }

  /* Reprojection error in PIXELS, not the angle between two unit rays.
     Rotate A's ray into B's frame and project it back through the SAME
     candidate focal, then measure the pixel distance to where the
     matcher actually found the correspondence. See the module comment
     for why this, and not ray-angle, is the residual this search must
     use: ray-angle silently rewards shrinking the focal regardless of
     whether the correspondences agree, and pixel-space reprojection does
     not. Returns null for a point that lands behind the camera at this
     candidate focal (only possible for a wildly wrong candidate), which
     the caller excludes rather than treats as a perfect (zero) fit. */
  function reprojResidualPx(R, m, W, H, f) {
    const ray = S.apply(R, C.pixelToRay(m.ax, m.ay, W, H, f));
    const p = C.rayToPixel(ray, W, H, f);
    if (!p) return null;
    return Math.hypot(p.px - m.bx, p.py - m.by);
  }

  /* Trimmed mean of the per-match alignment residual across all edges at
     a candidate focal length.

     Trimmed rather than plain mean because a handful of surviving
     outliers otherwise dominate the cost and flatten the minimum. The
     same fraction is discarded at every candidate focal, so the
     comparison between candidates stays fair. */
  function residualAtFocal(edges, W, H, f, keepFraction) {
    const keep = keepFraction || 0.8;
    const all = [];
    for (const ed of edges) {
      if (!ed.matches || ed.matches.length < 3) continue;
      const { a, b } = raysFor(ed.matches, W, H, f);
      const R = E.solveRotation(a, b);
      if (!R) continue;
      for (const m of ed.matches) {
        const r = reprojResidualPx(R, m, W, H, f);
        if (r !== null) all.push(r);
      }
    }
    if (!all.length) return Infinity;
    all.sort((x, y) => x - y);
    const n = Math.max(1, Math.floor(all.length * keep));
    let total = 0;
    for (let k = 0; k < n; k++) total += all[k];
    return total / n;
  }

  // How far matches reach from the principal point, as a fraction of the
  // half-diagonal. Low values mean the focal estimate is poorly conditioned.
  function matchSpread(edges, W, H) {
    const half = Math.sqrt(W * W + H * H) / 2;
    let maxR = 0, n = 0, sum = 0;
    for (const ed of edges) {
      for (const m of (ed.matches || [])) {
        const r1 = Math.hypot(m.ax - W / 2, m.ay - H / 2);
        const r2 = Math.hypot(m.bx - W / 2, m.by - H / 2);
        maxR = Math.max(maxR, r1, r2);
        sum += (r1 + r2) / 2;
        n += 1;
      }
    }
    return { mean: n ? (sum / n) / half : 0, max: maxR / half, count: n };
  }

  /**
   * edges: [{ i, j, matches: [{ax, ay, bx, by}] }] -- inlier matches only.
   * Returns { focal, hFovDeg, residualPx, spread, curve }. residualPx is
   * a trimmed-mean REPROJECTION error in pixels (see reprojResidualPx),
   * not an angle -- comparable across candidate focal lengths, which a
   * ray-angle residual is not.
   */
  function estimateFocal(edges, W, H, options) {
    const opts = options || {};
    const minFov = (opts.minHFovDeg || 45) * C.DEG;
    const maxFov = (opts.maxHFovDeg || 95) * C.DEG;
    const coarse = opts.coarseSamples || 51;

    // Coarse scan to bracket the minimum, since the residual curve is
    // only reliably unimodal near the true value.
    const curve = [];
    let bestIdx = 0, bestVal = Infinity;
    for (let s = 0; s < coarse; s++) {
      const fov = minFov + (maxFov - minFov) * (s / (coarse - 1));
      const f = C.focalFromHFov(fov, W);
      const res = residualAtFocal(edges, W, H, f);
      curve.push({ hFovDeg: fov / C.DEG, residualPx: res });
      if (res < bestVal) { bestVal = res; bestIdx = s; }
    }

    const step = (maxFov - minFov) / (coarse - 1);
    let lo = minFov + step * Math.max(0, bestIdx - 1);
    let hi = minFov + step * Math.min(coarse - 1, bestIdx + 1);

    // Golden-section refinement inside the bracket.
    const gr = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - gr * (hi - lo), x2 = lo + gr * (hi - lo);
    let f1 = residualAtFocal(edges, W, H, C.focalFromHFov(x1, W));
    let f2 = residualAtFocal(edges, W, H, C.focalFromHFov(x2, W));
    for (let it = 0; it < 40 && (hi - lo) > 1e-5; it++) {
      if (f1 < f2) {
        hi = x2; x2 = x1; f2 = f1;
        x1 = hi - gr * (hi - lo);
        f1 = residualAtFocal(edges, W, H, C.focalFromHFov(x1, W));
      } else {
        lo = x1; x1 = x2; f1 = f2;
        x2 = lo + gr * (hi - lo);
        f2 = residualAtFocal(edges, W, H, C.focalFromHFov(x2, W));
      }
    }

    const fov = (lo + hi) / 2;
    const focal = C.focalFromHFov(fov, W);
    return {
      focal: focal,
      hFovDeg: fov / C.DEG,
      residualPx: residualAtFocal(edges, W, H, focal),
      spread: matchSpread(edges, W, H),
      curve: curve
    };
  }

  global.LSCCalibrate = {
    estimateFocal: estimateFocal,
    residualAtFocal: residualAtFocal,
    matchSpread: matchSpread,
    raysFor: raysFor
  };
})(typeof window !== 'undefined' ? window : globalThis);
