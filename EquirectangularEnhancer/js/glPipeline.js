import { VERTEX_SRC, FRAGMENT_SHADERS } from "./shaders/shaders.js";

// Yields to the browser so a queued progress-UI update actually paints
// before the next (synchronous, potentially slow) GL stage runs.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile error: ${log}`);
  }
  return sh;
}

function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

class RenderTarget {
  constructor(gl, width, height, filter = gl.LINEAR) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texture = tex;

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
    }
    this.fbo = fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteFramebuffer(this.fbo);
  }
}

export class GLPipeline {
  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL2 is not supported in this browser.");
    this.gl = gl;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // Fullscreen triangle (clipped to viewport)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    this.programs = {};
    for (const [name, fsSrc] of Object.entries(FRAGMENT_SHADERS)) {
      this.programs[name] = linkProgram(gl, VERTEX_SRC, fsSrc);
    }
    this._uniformCache = new Map();
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  }

  _uniformLoc(program, name) {
    let map = this._uniformCache.get(program);
    if (!map) { map = new Map(); this._uniformCache.set(program, map); }
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(program, name));
    return map.get(name);
  }

  // Draw `programName` with the given texture/uniform bindings into `target`
  // (a RenderTarget) or the default framebuffer if target is null.
  _draw(programName, { textures = {}, floats = {}, vec2s = {}, vec3s = {} } = {}, target) {
    const gl = this.gl;
    const program = this.programs[programName];
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.width : this.canvas.width, target ? target.height : this.canvas.height);

    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this._uniformLoc(program, name), unit);
      unit++;
    }
    for (const [name, v] of Object.entries(floats)) gl.uniform1f(this._uniformLoc(program, name), v);
    for (const [name, v] of Object.entries(vec2s)) gl.uniform2f(this._uniformLoc(program, name), v[0], v[1]);
    for (const [name, v] of Object.entries(vec3s)) gl.uniform3f(this._uniformLoc(program, name), v[0], v[1], v[2]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _makeTarget(w, h, filter) {
    return new RenderTarget(this.gl, w, h, filter);
  }

  _uploadSource(source, w, h) {
    const gl = this.gl;
    const target = this._makeTarget(w, h, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return target;
  }

  /**
   * Run the full enhancement pipeline.
   * @param {CanvasImageSource} sourceCanvas - pre-downscaled to workingW x workingH
   * @param {number} workingW
   * @param {number} workingH
   * @param {object} stats - adaptive parameters from analysis
   * @param {object} upscale - { enabled, targetW, targetH } or null
   * @param {(stepId:string)=>void} onStep
   * @returns {{canvas: HTMLCanvasElement, width:number, height:number}}
   */
  async run(sourceCanvas, workingW, workingH, stats, upscale, onStep) {
    const gl = this.gl;
    const w = workingW, h = workingH;
    const texel = [1 / w, 1 / h];

    onStep && onStep("upload");
    await nextFrame();
    let ping = this._uploadSource(sourceCanvas, w, h);
    let pong = this._makeTarget(w, h, gl.LINEAR);
    const swap = () => { const t = ping; ping = pong; pong = t; };

    // --- Denoise ---
    onStep && onStep("denoise");
    await nextFrame();
    this._draw("bilateralDenoise", {
      textures: { uSrc: ping.texture },
      vec2s: { uTexel: texel },
      floats: { uStrength: stats.denoiseStrength, uSigmaRange: 0.12 },
    }, pong);
    swap();

    // --- White balance ---
    onStep && onStep("whitebalance");
    await nextFrame();
    this._draw("whiteBalance", {
      textures: { uSrc: ping.texture },
      vec3s: { uGain: stats.wbGain },
    }, pong);
    swap();

    // --- Local contrast (large-radius lowpass via downsample/blur/upsample) ---
    onStep && onStep("contrast");
    await nextFrame();
    const smallW = Math.max(32, Math.round(w / 12));
    const smallH = Math.max(16, Math.round(h / 12));
    const small1 = this._makeTarget(smallW, smallH, gl.LINEAR);
    const small2 = this._makeTarget(smallW, smallH, gl.LINEAR);
    this._draw("copy", { textures: { uSrc: ping.texture } }, small1); // downsample
    this._draw("blurH", { textures: { uSrc: small1.texture }, vec2s: { uTexel: [1 / smallW, 1 / smallH] }, floats: { uSigma: 3.0 } }, small2);
    this._draw("blurV", { textures: { uSrc: small2.texture }, vec2s: { uTexel: [1 / smallW, 1 / smallH] }, floats: { uSigma: 3.0 } }, small1);
    const lowpassFull = this._makeTarget(w, h, gl.LINEAR);
    this._draw("copy", { textures: { uSrc: small1.texture } }, lowpassFull); // upsample
    small1.dispose(); small2.dispose();

    this._draw("localContrast", {
      textures: { uSrc: ping.texture, uLowpass: lowpassFull.texture },
      floats: { uStrength: stats.localContrastStrength },
    }, pong);
    swap();

    // --- Latitude-aware sharpening ---
    onStep && onStep("sharpen");
    await nextFrame();
    const blurTmp = this._makeTarget(w, h, gl.LINEAR);
    const blurSmallFull = this._makeTarget(w, h, gl.LINEAR);
    this._draw("blurH", { textures: { uSrc: ping.texture }, vec2s: { uTexel: texel }, floats: { uSigma: stats.sharpenBlurSigma } }, blurTmp);
    this._draw("blurV", { textures: { uSrc: blurTmp.texture }, vec2s: { uTexel: texel }, floats: { uSigma: stats.sharpenBlurSigma } }, blurSmallFull);
    this._draw("sharpen", {
      textures: { uSrc: ping.texture, uBlurred: blurSmallFull.texture },
      floats: { uAmount: stats.sharpenAmount },
    }, pong);
    swap();
    blurTmp.dispose(); blurSmallFull.dispose();

    // --- Pole cleanup (reuse the large lowpass) ---
    onStep && onStep("polecleanup");
    await nextFrame();
    this._draw("poleCleanup", {
      textures: { uSrc: ping.texture, uBlurred: lowpassFull.texture },
    }, pong);
    swap();
    lowpassFull.dispose();

    // --- Seam blend ---
    onStep && onStep("seam");
    await nextFrame();
    this._draw("seamBlend", {
      textures: { uSrc: ping.texture },
      vec3s: { uSeamDelta: stats.seamDelta },
      floats: { uBandWidth: 0.015 },
    }, pong);
    swap();

    // --- Saturation / vibrance ---
    onStep && onStep("saturation");
    await nextFrame();
    this._draw("saturation", {
      textures: { uSrc: ping.texture },
      floats: { uAmount: stats.saturationAmount },
    }, pong);
    swap();

    // --- Upscale ---
    let finalTarget = ping;
    let finalW = w, finalH = h;
    if (upscale && upscale.enabled) {
      onStep && onStep("upscale");
      await nextFrame();
      const big = this._makeTarget(upscale.targetW, upscale.targetH, gl.LINEAR);
      this._draw("bicubicUpscale", {
        textures: { uSrc: ping.texture },
        vec2s: { uSrcSize: [w, h] },
      }, big);
      finalTarget = big;
      finalW = upscale.targetW;
      finalH = upscale.targetH;
    }

    // --- Read back ---
    onStep && onStep("encode");
    await nextFrame();
    gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget.fbo);
    const pixels = new Uint8Array(finalW * finalH * 4);
    gl.readPixels(0, 0, finalW, finalH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // WebGL readback is bottom-up; flip rows to get standard top-down image order.
    const outCanvas = document.createElement("canvas");
    outCanvas.width = finalW;
    outCanvas.height = finalH;
    const ctx = outCanvas.getContext("2d");
    const imageData = ctx.createImageData(finalW, finalH);
    const rowBytes = finalW * 4;
    for (let y = 0; y < finalH; y++) {
      const srcStart = (finalH - 1 - y) * rowBytes;
      imageData.data.set(pixels.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
    }
    ctx.putImageData(imageData, 0, 0);

    // Cleanup GPU resources for this run.
    ping.dispose();
    pong.dispose();
    if (finalTarget !== ping && finalTarget !== pong) finalTarget.dispose();

    return { canvas: outCanvas, width: finalW, height: finalH };
  }

  dispose() {
    const gl = this.gl;
    this.disposeEditorBase();
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  }

  // ---------- Editor Mode ----------
  // Uploads `canvas` as the persistent base image Editor Mode's live preview
  // and full-res export both render from. Kept separate from the one-shot
  // `run()` pipeline above so Editor Mode can re-render on every slider tick
  // without re-running Stage 1's fixed auto pipeline.
  setEditorBase(canvas) {
    this.disposeEditorBase();
    this._editorBase = this._uploadSource(canvas, canvas.width, canvas.height);
    this._editorBaseW = canvas.width;
    this._editorBaseH = canvas.height;
  }

  disposeEditorBase() {
    if (this._editorBase) { this._editorBase.dispose(); this._editorBase = null; }
  }

  // Renders denoise -> tone(yaw/exposure/wb/contrast/highlights-shadows/
  // saturation) -> sharpen at (w,h). w/h may be smaller than the uploaded
  // base for a fast live preview (texture() sampling over vUv naturally
  // downsamples) or equal to the base's own size for a full-quality export.
  renderEditorChain(params, w, h) {
    const gl = this.gl;
    const texel = [1 / w, 1 / h];

    let ping = this._makeTarget(w, h, gl.LINEAR);
    let pong = this._makeTarget(w, h, gl.LINEAR);
    const swap = () => { const t = ping; ping = pong; pong = t; };

    this._draw("copy", { textures: { uSrc: this._editorBase.texture } }, ping);

    if (params.denoise > 0.001) {
      this._draw("bilateralDenoise", {
        textures: { uSrc: ping.texture },
        vec2s: { uTexel: texel },
        floats: { uStrength: params.denoise, uSigmaRange: 0.12 },
      }, pong);
      swap();
    }

    this._draw("editorTone", {
      textures: { uSrc: ping.texture },
      floats: {
        uYawShift: params.yaw, uExposure: params.exposure, uContrast: params.contrast,
        uHighlights: params.highlights, uShadows: params.shadows,
        uTemp: params.temp, uTint: params.tint, uSaturation: params.saturation,
      },
    }, pong);
    swap();

    if (params.sharpen > 0.001) {
      const blurTmp = this._makeTarget(w, h, gl.LINEAR);
      const blurred = this._makeTarget(w, h, gl.LINEAR);
      this._draw("blurH", { textures: { uSrc: ping.texture }, vec2s: { uTexel: texel }, floats: { uSigma: 1.2 } }, blurTmp);
      this._draw("blurV", { textures: { uSrc: blurTmp.texture }, vec2s: { uTexel: texel }, floats: { uSigma: 1.2 } }, blurred);
      this._draw("sharpen", {
        textures: { uSrc: ping.texture, uBlurred: blurred.texture },
        floats: { uAmount: params.sharpen },
      }, pong);
      swap();
      blurTmp.dispose(); blurred.dispose();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, ping.fbo);
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext("2d");
    const imageData = ctx.createImageData(w, h);
    const rowBytes = w * 4;
    for (let y = 0; y < h; y++) {
      const srcStart = (h - 1 - y) * rowBytes;
      imageData.data.set(pixels.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
    }
    ctx.putImageData(imageData, 0, 0);

    ping.dispose();
    pong.dispose();
    return outCanvas;
  }
}
