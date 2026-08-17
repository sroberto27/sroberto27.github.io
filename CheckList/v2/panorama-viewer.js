/* ===================== 360 PANORAMA VIEWER =====================
   Minimal, dependency-free WebGL equirectangular viewer (drag/touch to
   look around, wheel/pinch to zoom). No CDN, no Pannellum — the whole
   thing is ~150 lines so vendoring a library wasn't worth the payload.
   Falls back to a static <img> (with a note) if WebGL is unavailable;
   the rest of the app never depends on this module loading successfully.
*/
(function (global) {
  'use strict';

  const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos; gl_Position = vec4(aPos,0.0,1.0); }`;
  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform float uYaw;
    uniform float uPitch;
    uniform float uTanHalfFov;
    uniform float uAspect;
    void main(){
      vec3 dir = normalize(vec3(vUv.x*uAspect*uTanHalfFov, vUv.y*uTanHalfFov, -1.0));
      float cp = cos(uPitch), sp = sin(uPitch);
      vec3 d2 = vec3(dir.x, dir.y*cp - dir.z*sp, dir.y*sp + dir.z*cp);
      float cy = cos(uYaw), sy = sin(uYaw);
      vec3 d3 = vec3(d2.x*cy + d2.z*sy, d2.y, -d2.x*sy + d2.z*cy);
      float lon = atan(d3.x, -d3.z);
      float lat = asin(clamp(d3.y, -1.0, 1.0));
      vec2 uv = vec2(lon / 6.283185307 + 0.5, 0.5 - lat / 3.141592653);
      gl_FragColor = texture2D(uTex, uv);
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

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'pano-viewer-overlay';
    overlay.innerHTML = `
      <div class="pano-viewer-topbar">
        <span class="pano-viewer-title"></span>
        <button type="button" class="icon-btn pano-viewer-close" aria-label="Close viewer" title="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="pano-viewer-stage"></div>
      <div class="pano-viewer-hint">Drag to look around &middot; pinch or scroll to zoom</div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function openFallback(stage, url) {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'pano-viewer-fallback-img';
    stage.appendChild(img);
    const note = document.createElement('div');
    note.className = 'pano-viewer-fallback-note';
    note.textContent = 'Interactive 360° viewing needs WebGL, which isn’t available here — showing the flat panorama image instead.';
    stage.appendChild(note);
  }

  function open(url, opts) {
    opts = opts || {};
    const overlay = buildOverlay();
    overlay.querySelector('.pano-viewer-title').textContent = opts.title || '360° Panorama';
    const stage = overlay.querySelector('.pano-viewer-stage');

    let cleanup = () => {};
    const close = () => { cleanup(); overlay.remove(); if (opts.onClose) opts.onClose(); };
    overlay.querySelector('.pano-viewer-close').addEventListener('click', close);
    const escHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    const canvas = document.createElement('canvas');
    canvas.className = 'pano-viewer-canvas';
    stage.appendChild(canvas);

    let gl = null;
    try {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }

    if (!gl) {
      canvas.remove();
      openFallback(stage, url);
      cleanup = () => document.removeEventListener('keydown', escHandler);
      return { close };
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => {
      canvas.remove();
      openFallback(stage, url);
    };
    img.onload = () => startGl(gl, canvas, img);
    img.src = url;

    function startGl(gl, canvas, image) {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        canvas.remove(); openFallback(stage, url); return;
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

      const uYaw = gl.getUniformLocation(prog, 'uYaw');
      const uPitch = gl.getUniformLocation(prog, 'uPitch');
      const uTanHalfFov = gl.getUniformLocation(prog, 'uTanHalfFov');
      const uAspect = gl.getUniformLocation(prog, 'uAspect');
      const uTex = gl.getUniformLocation(prog, 'uTex');
      gl.uniform1i(uTex, 0);

      let yaw = 0, pitch = 0, fovDeg = 90;
      let dragging = false, lastX = 0, lastY = 0, raf = null;
      let pinchDist = null;

      function resize() {
        const w = stage.clientWidth, h = stage.clientHeight;
        canvas.width = w * (window.devicePixelRatio || 1);
        canvas.height = h * (window.devicePixelRatio || 1);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      function render() {
        gl.uniform1f(uYaw, yaw);
        gl.uniform1f(uPitch, pitch);
        gl.uniform1f(uTanHalfFov, Math.tan(fovDeg * Math.PI / 360));
        gl.uniform1f(uAspect, canvas.width / canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      function onPointerDown(e) {
        dragging = true;
        lastX = e.clientX; lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      }
      function onPointerMove(e) {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        const sens = fovDeg / canvas.clientHeight * 1.4;
        yaw -= dx * sens * Math.PI / 180;
        pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * sens * Math.PI / 180));
        render();
      }
      function onPointerUp(e) { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} }
      function onWheel(e) {
        e.preventDefault();
        fovDeg = Math.max(30, Math.min(100, fovDeg + e.deltaY * 0.05));
        render();
      }
      function touchDist(t) { const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
      function onTouchMove(e) {
        if (e.touches.length === 2) {
          e.preventDefault();
          const d = touchDist(e.touches);
          if (pinchDist != null) {
            fovDeg = Math.max(30, Math.min(100, fovDeg - (d - pinchDist) * 0.15));
            render();
          }
          pinchDist = d;
        }
      }
      function onTouchEnd() { pinchDist = null; }

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);
      const onResize = () => { resize(); render(); };
      window.addEventListener('resize', onResize);

      resize();
      render();

      cleanup = () => {
        document.removeEventListener('keydown', escHandler);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('resize', onResize);
        if (raf) cancelAnimationFrame(raf);
        gl.getExtension('WEBGL_lose_context') && gl.getExtension('WEBGL_lose_context').loseContext();
      };
    }

    return { close };
  }

  global.LSCPanoViewer = { open };
})(window);
