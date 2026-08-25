/* Synthetic panoramic scene: an equirectangular source image plus the
   ability to render perspective views from it at exact known poses and
   focal length.

   Used by run-stitch-eval.js to measure END-TO-END stitch quality rather
   than pose error in degrees. Degrees are only a proxy; what matters is
   what the panorama looks like, and a metric on the image is the only
   thing that can rank pose error against focal error against exposure
   error on a common scale.

   One important limitation, stated plainly because it changes what the
   evaluation can conclude: every view here is rendered from a SINGLE
   optical centre, so this scene contains exactly ZERO parallax. It can
   therefore measure error sources E1, E2, E3, E5 and E6, but says
   nothing at all about E4. Parallax needs a real 3D scene (Habitat +
   HM3D, per Part III of the research plan) or real paired capture.
*/
(function (global) {
  'use strict';

  const S = global.LSCSO3;
  const C = global.LSCCamera;

  function makeRng(seed) {
    let s = (seed || 1) >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* Rich, non-repetitive texture. Non-repetitive matters: repeating
     structure would create genuinely ambiguous correspondences and
     confound a measurement that is supposed to isolate pose and focal. */
  function makePanorama(EW, EH, seed) {
    const rnd = makeRng(seed || 1234);
    const pano = new Float32Array(EW * EH * 3);

    // Low-frequency wash so large flat regions are not pure noise.
    const cw = Math.ceil(EW / 32), ch = Math.ceil(EH / 32);
    const coarse = new Float32Array(cw * ch * 3);
    for (let i = 0; i < coarse.length; i++) coarse[i] = rnd();
    for (let y = 0; y < EH; y++) {
      const cy = Math.min(ch - 1, Math.floor(y / 32));
      for (let x = 0; x < EW; x++) {
        const cx = Math.min(cw - 1, Math.floor(x / 32));
        const s = (cy * cw + cx) * 3, d = (y * EW + x) * 3;
        pano[d] = coarse[s]; pano[d + 1] = coarse[s + 1]; pano[d + 2] = coarse[s + 2];
      }
    }

    // Rectangles and bars give corners and edges to lock onto.
    function box(x0, y0, w, h, r, g, b) {
      for (let y = y0; y < y0 + h; y++) {
        if (y < 0 || y >= EH) continue;
        for (let x = x0; x < x0 + w; x++) {
          const xx = ((x % EW) + EW) % EW;
          const d = (y * EW + xx) * 3;
          pano[d] = r; pano[d + 1] = g; pano[d + 2] = b;
        }
      }
    }
    for (let i = 0; i < 1400; i++) {
      box(Math.floor(rnd() * EW), Math.floor(rnd() * EH),
        8 + Math.floor(rnd() * 70), 8 + Math.floor(rnd() * 50),
        rnd(), rnd(), rnd());
    }
    for (let i = 0; i < 700; i++) {
      box(Math.floor(rnd() * EW), Math.floor(rnd() * EH),
        30 + Math.floor(rnd() * 180), 2 + Math.floor(rnd() * 3),
        rnd(), rnd(), rnd());
    }
    // Fine grain everywhere.
    for (let i = 0; i < pano.length; i++) {
      pano[i] = Math.min(1, Math.max(0, pano[i] * 0.82 + rnd() * 0.18));
    }
    return pano;
  }

  function samplePano(pano, EW, EH, u, v) {
    let u0 = Math.floor(u), v0 = Math.floor(v);
    const fu = u - u0, fv = v - v0;
    u0 = ((u0 % EW) + EW) % EW;
    const u1 = (u0 + 1) % EW;
    v0 = Math.min(EH - 1, Math.max(0, v0));
    const v1 = Math.min(EH - 1, v0 + 1);
    const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv);
    const w01 = (1 - fu) * fv, w11 = fu * fv;
    const i00 = (v0 * EW + u0) * 3, i10 = (v0 * EW + u1) * 3;
    const i01 = (v1 * EW + u0) * 3, i11 = (v1 * EW + u1) * 3;
    return [
      pano[i00] * w00 + pano[i10] * w10 + pano[i01] * w01 + pano[i11] * w11,
      pano[i00 + 1] * w00 + pano[i10 + 1] * w10 + pano[i01 + 1] * w01 + pano[i11 + 1] * w11,
      pano[i00 + 2] * w00 + pano[i10 + 2] * w10 + pano[i01 + 2] * w01 + pano[i11 + 2] * w11
    ];
  }

  /** Renders one perspective view. `gain` simulates auto-exposure drift. */
  function renderView(pano, EW, EH, R, W, H, focal, gain) {
    const g = gain === undefined ? 1 : gain;
    const out = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ray = C.pixelToRay(x, y, W, H, focal);
        const world = S.apply(R, ray);
        const eq = C.rayToEquirect(world, EW, EH);
        const c = samplePano(pano, EW, EH, eq.u, eq.v);
        const d = (y * W + x) * 3;
        out[d] = Math.min(1, c[0] * g);
        out[d + 1] = Math.min(1, c[1] * g);
        out[d + 2] = Math.min(1, c[2] * g);
      }
    }
    return out;
  }

  /* Auto-exposure model: the camera meters the scene it is pointing at,
     so gain varies smoothly with viewing direction rather than randomly.
     Panning toward a bright window and back is what produces the banding
     that no amount of pose refinement can remove. */
  function exposureGains(rotations, amplitude) {
    const amp = amplitude === undefined ? 0.18 : amplitude;
    return rotations.map(R => {
      const fwd = S.column(R, 2);
      return 1 + amp * Math.sin(Math.atan2(fwd.x, fwd.y) * 1.5);
    });
  }

  global.LSCScene = {
    makePanorama: makePanorama,
    renderView: renderView,
    samplePano: samplePano,
    exposureGains: exposureGains,
    makeRng: makeRng
  };
})(typeof self !== 'undefined' ? self : globalThis);
