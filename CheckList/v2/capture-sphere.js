/* ===================== LIVE 3D CAPTURE SPHERE =====================
   The world-locked preview drawn over the live camera while a 360 capture
   is in progress: a faint wireframe globe with every photo taken so far
   pasted onto it at the orientation it was shot at, so the user can see
   the sphere filling in and spot a gap while they are still standing in
   the room.

   It replaces a flat 2D version that drew each shot as an axis-aligned
   rectangle scaled by 1/z. That approximation is fine near the middle of
   the screen and wrong everywhere else: it cannot rotate a patch, so roll
   was baked away, and it cannot curve one, so a shot near a pole was
   drawn as a rectangle where the sphere wanted a fan. Patches met at
   angles that did not correspond to anything, which made "is that a gap
   or is that the projection" a question the user could not answer.

   HAND-ROLLED, NO 3D LIBRARY. vendor/ has none, and panorama-viewer.js
   states the zero-dependency position explicitly. What is needed here is
   one rotation, one perspective divide and a textured grid, which is less
   code than the loader for a library would be.

   WHAT IT REUSES FROM panorama-viewer.js: shader compilation, the
   graceful "no WebGL, caller carries on without me" contract, DPR-aware
   resize, the deliberate UNPACK_FLIP_Y_WEBGL = false decision (see the
   long comment at that call site there -- it is the same reasoning here,
   for the same reason: these texture coordinates are computed, not
   inherited from quad UVs), and WEBGL_lose_context teardown.

   WHAT IT CANNOT REUSE: the geometry or the fragment shader. That viewer
   is a fullscreen-triangle equirect ray-caster -- one triangle, no mesh,
   no matrices -- and it assumes a finished equirect texture exists. This
   is the opposite situation: N sparse perspective patches at arbitrary
   poses and no panorama yet.

   AXES. Capture convention throughout, matching capture360.js and
   pano-stitch-worker.js: +z up, yaw measured from +y, forward =
   (sin(yaw)cos(pitch), cos(yaw)cos(pitch), sin(pitch)). The conversion
   to GL's z-toward-the-viewer happens once, in the view matrix, and
   nowhere else.

   The caller keeps ownership of everything: this module never touches the
   video element, the 2D overlay canvas, or the capture state. If create()
   returns null the caller must draw the old 2D preview instead -- that
   fallback is not optional, it is what runs on any device without WebGL.
*/
(function (global) {
  'use strict';

  const DEG = Math.PI / 180;

  /* Patch textures are re-scaled to at most this on the long side before
     upload. The caller's thumbnails are 480 px, which at 46 shots would be
     about 57 MB of live GPU texture during a capture -- on a phone that is
     competing with the camera pipeline and the stitch worker's
     accumulators for the same budget. 256 px costs 16 MB for the same
     capture and is still more resolution than a patch the width of a
     thumb can show. */
  const MAX_TEX = 256;

  /* Each patch is drawn as a TESS x TESS grid rather than a single quad,
     because a quad's edges are straight lines in screen space and the
     patch's edges are arcs on a sphere. At a ~50 deg frame the error at
     the middle of an edge is a couple of degrees, which is the same order
     as the gaps the user is being asked to look for. */
  const TESS = 6;

  // Graticule spacing. 30 deg matches the capture pattern's yaw step, so
  // the lines read as "one shot per cell" rather than as decoration.
  const GRID_STEP_DEG = 30;

  /* Fraction of each patch, measured in from its border, over which it
     fades out. Without it the patches are opaque rectangles with hard
     edges, and a sphere tiled with hard rectangles reads as a collage
     sitting in front of the world rather than as photographs wrapped
     onto it -- which is exactly the complaint that prompted this. With
     it, overlapping shots cross-fade into each other and a patch with no
     neighbour yet visibly trails off, so the eye reads the boundary as
     "not covered yet" instead of "edge of a card".

     It is deliberately gentler than the stitcher's feather. This is an
     aiming aid: the user has to be able to see WHERE a photo landed, and
     a patch faded over half its width no longer tells them that. */
  const EDGE_FEATHER = 0.14;

  const VERT = `
    attribute vec3 aDir;
    attribute vec2 aUv;
    uniform mat3 uView;      // world -> camera, rows are right/up/forward
    uniform float uScale;    // ndc units per unit of (x/z) at the guide FOV
    uniform vec2 uNearFar;
    varying vec2 vUv;
    void main() {
      vec3 c = uView * aDir;
      vUv = aUv;
      float n = uNearFar.x, f = uNearFar.y;
      float zc = c.z * (f + n) / (f - n) - 2.0 * f * n / (f - n);
      // w = c.z, so GL's own w > 0 and -w <= z <= w clipping removes
      // everything behind the camera and closer than the near plane.
      // Nothing here needs a depth buffer: every vertex sits on the unit
      // sphere, so the visible set is exactly the forward hemisphere.
      gl_Position = vec4(c.x * uScale, c.y * uScale, zc, c.z);
    }`;

  const FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec4 uColor;
    uniform float uUseTex;
    uniform float uEdgeFeather;
    void main() {
      vec4 t = texture2D(uTex, vUv);
      float e = max(uEdgeFeather, 1e-4);
      float f = smoothstep(0.0, e, vUv.x) * smoothstep(0.0, e, 1.0 - vUv.x)
              * smoothstep(0.0, e, vUv.y) * smoothstep(0.0, e, 1.0 - vUv.y);
      gl_FragColor = mix(uColor, vec4(t.rgb, t.a * uColor.a * f), uUseTex);
    }`;

  /* The dimming mask with its aiming peephole, drawn here rather than on
     the 2D overlay canvas above. It has to be underneath the patches --
     the patches are what the mask is being cleared away to reveal -- and
     the 2D canvas sits on top of this one, so a mask drawn there would
     bury everything this module renders. The reticle, the active target
     and the off-screen arrow stay on the 2D canvas, which keeps them on
     top of the patches exactly as they were before. */
  const MASK_VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const MASK_FRAG = `
    precision mediump float;
    uniform vec2 uHole;      // peephole centre, in device pixels
    uniform float uHoleR;
    uniform vec4 uColor;
    void main() {
      if (distance(gl_FragCoord.xy, uHole) < uHoleR) discard;
      gl_FragColor = uColor;
    }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile failed: ' + info);
    }
    return s;
  }

  function link(gl, vertSrc, fragSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  // ---- vector helpers (kept local; orientation.js is a UI-layer module
  // and this file is deliberately loadable on its own for the lab test) --
  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  /* Identical in form to basisForOrientation() in capture360.js and in
     pano-stitch-worker.js. Duplicated rather than imported because those
     two are duplicates of each other already, and a preview that silently
     disagreed with the stitcher about where a photo points would be worse
     than useless -- it would show a sphere that fills in correctly and
     then produce a panorama that does not. */
  function basis(yaw, pitch, roll) {
    const forward = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
    // Analytic roll reference; see the note on fromYawPitchRoll in
    // pano/so3.js for why this is not a normalised cross product.
    const right0 = [Math.cos(yaw), -Math.sin(yaw), 0];
    const up0 = norm(cross(right0, forward));
    const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    const right = norm([right0[0] * cr - up0[0] * sr, right0[1] * cr - up0[1] * sr, right0[2] * cr - up0[2] * sr]);
    const up = norm([up0[0] * cr + right0[0] * sr, up0[1] * cr + right0[1] * sr, up0[2] * cr + right0[2] * sr]);
    return { forward, right, up };
  }

  /* One patch's geometry: a TESS x TESS grid of directions spanning the
     photo's field of view, every vertex normalised onto the unit sphere
     so the patch curves with it.

     hFov is the field across the frame's WIDTH and aspect is its
     height/width, and both have to describe the REAL photo. Getting them
     from a lens spec instead is how this went wrong the first time: a
     phone lens quoted at 68 deg describes its LONG axis, phone stills
     come back portrait, and pairing that 68 deg with a landscape 9:16
     aspect drew every patch as a 68 x 42 deg landscape rectangle when the
     photograph is a 54 x 68 deg portrait one. Every patch was then a
     quarter too wide, a third too short and turned on its side, so they
     did not tile the sphere and did not line up with the graticule --
     they read as loose cards rather than as pieces of the sphere.

     Texture rows: with UNPACK_FLIP_Y_WEBGL left at its default false, row
     0 of the source canvas is t = 0, and row 0 is the TOP of the photo.
     The top of the photo points along +up, which is v = +1 here, so
     t = (1 - v) / 2. Getting this backwards flips every patch upside
     down, which is the bug lab/capture-sphere-test.html exists to catch. */
  function patchMesh(yaw, pitch, roll, hFov, aspect) {
    const b = basis(yaw, pitch, roll);
    const tanH = Math.tan(hFov / 2);
    const tanV = tanH * aspect;
    const n = TESS + 1;
    const dirs = new Float32Array(n * n * 3);
    const uvs = new Float32Array(n * n * 2);
    for (let iy = 0; iy < n; iy++) {
      const v = 1 - 2 * iy / TESS;
      for (let ix = 0; ix < n; ix++) {
        const u = -1 + 2 * ix / TESS;
        const d = norm([
          b.right[0] * u * tanH + b.up[0] * v * tanV + b.forward[0],
          b.right[1] * u * tanH + b.up[1] * v * tanV + b.forward[1],
          b.right[2] * u * tanH + b.up[2] * v * tanV + b.forward[2]
        ]);
        const o = (iy * n + ix) * 3;
        dirs[o] = d[0]; dirs[o + 1] = d[1]; dirs[o + 2] = d[2];
        const q = (iy * n + ix) * 2;
        uvs[q] = (u + 1) / 2;
        uvs[q + 1] = (1 - v) / 2;
      }
    }
    const idx = new Uint16Array(TESS * TESS * 6);
    let k = 0;
    for (let iy = 0; iy < TESS; iy++) {
      for (let ix = 0; ix < TESS; ix++) {
        const a = iy * n + ix, bb = a + 1, c = a + n, d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = bb;
        idx[k++] = bb; idx[k++] = c; idx[k++] = d;
      }
    }
    return { dirs, uvs, idx, count: idx.length };
  }

  // Latitude/longitude graticule as a line list of unit directions.
  function graticule() {
    const pts = [];
    const step = GRID_STEP_DEG * DEG;
    const fine = 4 * DEG;
    const dir = (yaw, pitch) => [
      Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
    for (let yaw = 0; yaw < 2 * Math.PI - 1e-9; yaw += step) {
      for (let p = -Math.PI / 2; p < Math.PI / 2 - 1e-9; p += fine) {
        pts.push(dir(yaw, p), dir(yaw, Math.min(Math.PI / 2, p + fine)));
      }
    }
    for (let pitch = -Math.PI / 2 + step; pitch < Math.PI / 2 - 1e-9; pitch += step) {
      for (let y = 0; y < 2 * Math.PI - 1e-9; y += fine) {
        pts.push(dir(y, pitch), dir(y + fine, pitch));
      }
    }
    const out = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      out[i * 3] = pts[i][0]; out[i * 3 + 1] = pts[i][1]; out[i * 3 + 2] = pts[i][2];
    }
    return out;
  }

  /* Shrink a thumbnail to MAX_TEX on its long side. Returns the original
     when it is already small enough, so the common case allocates
     nothing. */
  function fitTexture(source) {
    const long = Math.max(source.width, source.height);
    if (long <= MAX_TEX) return source;
    const s = MAX_TEX / long;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(source.width * s));
    c.height = Math.max(1, Math.round(source.height * s));
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  /**
   * create(canvas, opts) -> preview handle, or null when WebGL is
   * unavailable. A null return is a normal outcome, not an error: the
   * caller keeps its 2D path for exactly this case.
   *
   * opts.guideFovDeg  virtual FOV the preview is framed at (the video
   *                   underneath is object-fit: cover, so its on-screen
   *                   field is not the sensor's; the caller already has a
   *                   number that makes the two agree and passes it here)
   * opts.ndcSpan      fraction of the half-viewport one guide-FOV unit
   *                   spans, matching the 2D path's layout constants
   * opts.patchAspect  source photo height/width (3:4 portrait by default)
   * opts.patchFovDeg  FOV across the source photo's WIDTH, not its long
   *                   axis. Both are replaced by setPatchGeometry() as
   *                   soon as a real frame has been measured.
   */
  function create(canvas, opts) {
    opts = opts || {};
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
           canvas.getContext('experimental-webgl', { alpha: true });
    } catch (e) { gl = null; }
    if (!gl) return null;

    let prog, maskProg;
    try {
      prog = link(gl, VERT, FRAG);
      maskProg = link(gl, MASK_VERT, MASK_FRAG);
    } catch (e) {
      return null;
    }

    const guideFov = (opts.guideFovDeg || 78) * DEG;
    const ndcSpan = opts.ndcSpan !== undefined ? opts.ndcSpan : 0.84;
    /* Defaults are a PORTRAIT phone still (3:4) at the width-FOV a 68 deg
       long-axis lens gives on one. The caller replaces both the moment it
       has a real frame to measure -- see setPatchGeometry. */
    let patchAspect = opts.patchAspect || (4 / 3);
    let patchFov = (opts.patchFovDeg || 53.7) * DEG;
    const scale = ndcSpan / Math.tan(guideFov / 2);

    const A = {
      aDir: gl.getAttribLocation(prog, 'aDir'),
      aUv: gl.getAttribLocation(prog, 'aUv')
    };
    const U = {
      view: gl.getUniformLocation(prog, 'uView'),
      scale: gl.getUniformLocation(prog, 'uScale'),
      nearFar: gl.getUniformLocation(prog, 'uNearFar'),
      tex: gl.getUniformLocation(prog, 'uTex'),
      color: gl.getUniformLocation(prog, 'uColor'),
      useTex: gl.getUniformLocation(prog, 'uUseTex'),
      edgeFeather: gl.getUniformLocation(prog, 'uEdgeFeather')
    };
    const MA = { aPos: gl.getAttribLocation(maskProg, 'aPos') };
    const MU = {
      hole: gl.getUniformLocation(maskProg, 'uHole'),
      holeR: gl.getUniformLocation(maskProg, 'uHoleR'),
      color: gl.getUniformLocation(maskProg, 'uColor')
    };

    // Fullscreen triangle for the mask, same trick as panorama-viewer.js.
    const maskBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, maskBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const gridData = graticule();
    const gridBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.bufferData(gl.ARRAY_BUFFER, gridData, gl.STATIC_DRAW);
    const gridCount = gridData.length / 3;
    // The grid shader path still reads aUv; give it something valid so the
    // attribute is never left pointing at a deleted buffer.
    const gridUvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridUvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridCount * 2), gl.STATIC_DRAW);

    const blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));

    // Poses are kept alongside the buffers so the meshes can be rebuilt
    // when the real frame geometry arrives, which is usually after the
    // first photo has already been added.
    const patches = [];   // { tex, yaw, pitch, roll, aspect, dirBuf, uvBuf, idxBuf, count }
    let width = 0, height = 0, dpr = 1;
    let view = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let hole = { x: 0, y: 0, r: 0 };
    let lost = false;

    function makeBuffer(target, data, usage) {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, usage || gl.STATIC_DRAW);
      return b;
    }

    function addPatch(p) {
      if (lost) return;
      const src = fitTexture(p.canvas);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // Left at the WebGL default, deliberately, for the same reason
      // panorama-viewer.js leaves it: these texture coordinates are
      // computed in patchMesh(), not inherited from quad UVs, so there is
      // no convention for a flip to cancel out against.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

      const aspect = p.canvas.height / p.canvas.width || patchAspect;
      const m = patchMesh(p.yaw, p.pitch, p.roll || 0, patchFov, aspect);
      patches.push({
        tex: tex,
        yaw: p.yaw, pitch: p.pitch, roll: p.roll || 0, aspect: aspect,
        dirBuf: makeBuffer(gl.ARRAY_BUFFER, m.dirs),
        uvBuf: makeBuffer(gl.ARRAY_BUFFER, m.uvs),
        idxBuf: makeBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx),
        count: m.count
      });
    }

    /* Tell the preview what the photos actually look like. The caller
       cannot know this until it has taken one -- the still pipeline's
       dimensions are not the video preview's -- so patches added before
       then are rebuilt here rather than left at the default. Cheap: a few
       dozen meshes of 49 vertices each. */
    function setPatchGeometry(hFovDeg, aspect) {
      if (lost) return;
      const f = hFovDeg * DEG;
      if (!(f > 0) || !(aspect > 0)) return;
      if (Math.abs(f - patchFov) < 1e-6 && Math.abs(aspect - patchAspect) < 1e-6) return;
      patchFov = f;
      patchAspect = aspect;
      for (const p of patches) {
        p.aspect = aspect;
        const m = patchMesh(p.yaw, p.pitch, p.roll, patchFov, aspect);
        gl.bindBuffer(gl.ARRAY_BUFFER, p.dirBuf);
        gl.bufferData(gl.ARRAY_BUFFER, m.dirs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, p.uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, m.uvs, gl.STATIC_DRAW);
      }
    }

    function dropPatch(p) {
      gl.deleteTexture(p.tex);
      gl.deleteBuffer(p.dirBuf);
      gl.deleteBuffer(p.uvBuf);
      gl.deleteBuffer(p.idxBuf);
    }

    function removePatch(i) {
      if (i < 0 || i >= patches.length) return;
      dropPatch(patches[i]);
      patches.splice(i, 1);
    }

    function resize(cssW, cssH) {
      dpr = window.devicePixelRatio || 1;
      width = cssW; height = cssH;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // Peephole position in CSS pixels, measured from the TOP like every
    // other coordinate the caller works in; converted to gl_FragCoord's
    // bottom-up device pixels here so the caller never has to think about
    // it.
    function setPeephole(cssX, cssY, cssR) {
      hole = { x: cssX * dpr, y: canvas.height - cssY * dpr, r: cssR * dpr };
    }

    function setPose(yaw, pitch, roll) {
      const b = basis(yaw, pitch, roll);
      // Column-major for uniformMatrix3fv; the rows of the world->camera
      // matrix are the camera axes, so the columns are their components.
      view = [
        b.right[0], b.up[0], b.forward[0],
        b.right[1], b.up[1], b.forward[1],
        b.right[2], b.up[2], b.forward[2]
      ];
    }

    function render() {
      if (lost || !canvas.width) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if (hole.r > 0) {
        gl.useProgram(maskProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, maskBuf);
        gl.enableVertexAttribArray(MA.aPos);
        gl.vertexAttribPointer(MA.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(MU.hole, hole.x, hole.y);
        gl.uniform1f(MU.holeR, hole.r);
        gl.uniform4f(MU.color, 28 / 255, 30 / 255, 36 / 255, 0.94);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disableVertexAttribArray(MA.aPos);
      }

      gl.useProgram(prog);
      gl.uniformMatrix3fv(U.view, false, view);
      gl.uniform1f(U.scale, scale);
      gl.uniform2f(U.nearFar, 0.05, 1.5);
      gl.uniform1i(U.tex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.enableVertexAttribArray(A.aDir);
      gl.enableVertexAttribArray(A.aUv);

      // graticule first: it is context, and the photos belong on top of it
      gl.bindTexture(gl.TEXTURE_2D, blank);
      gl.uniform1f(U.useTex, 0);
      gl.uniform1f(U.edgeFeather, 0);
      gl.uniform4f(U.color, 1, 1, 1, 0.16);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
      gl.vertexAttribPointer(A.aDir, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridUvBuf);
      gl.vertexAttribPointer(A.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, gridCount);

      gl.uniform1f(U.useTex, 1);
      gl.uniform1f(U.edgeFeather, EDGE_FEATHER);
      gl.uniform4f(U.color, 1, 1, 1, 1);
      for (let i = 0; i < patches.length; i++) {
        const p = patches[i];
        gl.bindTexture(gl.TEXTURE_2D, p.tex);
        gl.bindBuffer(gl.ARRAY_BUFFER, p.dirBuf);
        gl.vertexAttribPointer(A.aDir, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, p.uvBuf);
        gl.vertexAttribPointer(A.aUv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.idxBuf);
        gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.disableVertexAttribArray(A.aDir);
      gl.disableVertexAttribArray(A.aUv);
    }

    function destroy() {
      if (lost) return;
      lost = true;
      patches.forEach(dropPatch);
      patches.length = 0;
      gl.deleteTexture(blank);
      gl.deleteBuffer(maskBuf);
      gl.deleteBuffer(gridBuf);
      gl.deleteBuffer(gridUvBuf);
      gl.deleteProgram(prog);
      gl.deleteProgram(maskProg);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }

    return {
      addPatch, removePatch, resize, setPeephole, setPose, setPatchGeometry,
      render, destroy,
      get patchCount() { return patches.length; }
    };
  }

  global.LSCCaptureSphere = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
