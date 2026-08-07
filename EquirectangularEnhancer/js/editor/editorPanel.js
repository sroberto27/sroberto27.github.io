// Editor Mode orchestrator: wires the slider UI to GLPipeline's real-time
// editor chain, the analysis panel (histogram/latitude graph/depth viewer),
// and the AI-assisted region tools (brush/lasso removal, depth smart-select,
// regional detail boost). See index.html's #editorView for the markup this
// binds to.
import { GLPipeline } from "../glPipeline.js";
import * as lama from "../ai/lamaInpaint.js";
import * as esrgan from "../ai/realesrganUpscale.js";
import * as depthMod from "../ai/depthAnything.js";
import * as stereo from "../ai/stereoSynthesis.js";
import { ManualMask } from "./manualMask.js";
import { smartSelectByDepth, maskArrayToCanvas, rollDepthArray } from "./smartSelect.js";
import { boostRegion } from "./regionalUpscale.js";
import { drawHistogram, makeDebouncedHistogram } from "./histogram.js";
import { computeLatitudeBrightness, drawLatitudeGraph } from "./latitudeGraph.js";

const PREVIEW_MAX_WIDTH = 1400;

// Raw-slider-unit -> shader-param-unit scale for each control (slider value
// / SCALES[key] = the shader uniform's native range).
const SCALES = { yaw: 360, exposure: 50, contrast: 100, highlights: 100, shadows: 100, temp: 100, tint: 100, saturation: 100, sharpen: 100, denoise: 100 };

function neutralParams() {
  return { yaw: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, temp: 0, tint: 0, saturation: 0, sharpen: 0, denoise: 0 };
}

function cloneCanvas(src) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}

const $ = (id) => document.getElementById(id);

export class EditorController {
  constructor({ onPreviewFrame, onBaseCommitted } = {}) {
    this.onPreviewFrame = onPreviewFrame || (() => {});
    this.onBaseCommitted = onBaseCommitted || (() => {});
    this.gl = null;
    this.tool = "none";
    this.mask = null;
    this.regionRect = null;
    this._dragStart = null;
    this._brushLast = null;
    this._lamaSession = null;
    this._esrganSession = null;
    this._initialized = false;

    this._els = {
      canvas: $("editorCanvas"),
      overlay: $("editorOverlayCanvas"),
      wrap: $("editorCanvasWrap"),
      actionRow: $("editorActionRow"),
      actionStatus: $("editorActionStatus"),
      confirmBtn: $("editorConfirmBtn"),
      cancelBtn: $("editorCancelBtn"),
      resetAutoBtn: $("editorResetAutoBtn"),
      resetOrigBtn: $("editorResetOrigBtn"),
      brushSizeRow: $("brushSizeRow"),
      brushSizeSlider: $("brushSizeSlider"),
      histCanvas: $("histogramCanvas"),
      latCanvas: $("latitudeCanvas"),
      statsGrid: $("editorStatsGrid"),
      depthToggleBtn: $("depthToggleBtn"),
      depthImg: $("depthPreviewImg"),
      stereoRow: $("stereoStrengthRow"),
      stereoSlider: $("sldStereo"),
      stereoVal: $("valStereo"),
    };

    this._sliders = {
      yaw: { el: $("sldRecenter"), val: $("valRecenter"), tag: $("tagRecenter"), fmt: (v) => `${v}°` },
      exposure: { el: $("sldExposure"), val: $("valExposure"), tag: $("tagExposure"), fmt: (v) => `${v}` },
      contrast: { el: $("sldContrast"), val: $("valContrast"), tag: $("tagContrast"), fmt: (v) => `${v}` },
      highlights: { el: $("sldHighlights"), val: $("valHighlights"), tag: $("tagHighlights"), fmt: (v) => `${v}` },
      shadows: { el: $("sldShadows"), val: $("valShadows"), tag: $("tagShadows"), fmt: (v) => `${v}` },
      temp: { el: $("sldTemp"), val: $("valTemp"), tag: $("tagTemp"), fmt: (v) => `${v}` },
      tint: { el: $("sldTint"), val: $("valTint"), tag: $("tagTint"), fmt: (v) => `${v}` },
      saturation: { el: $("sldSaturation"), val: $("valSaturation"), tag: $("tagSaturation"), fmt: (v) => `${v}` },
      sharpen: { el: $("sldSharpen"), val: $("valSharpen"), tag: $("tagSharpen"), fmt: (v) => `${v}` },
      denoise: { el: $("sldDenoise"), val: $("valDenoise"), tag: $("tagDenoise"), fmt: (v) => `${v}` },
    };

    // seedRaw[key]: the raw slider position (native slider units, e.g. "12"
    // for 12%) that represents "zero additional change" — i.e. what's
    // already baked into editorBaseCanvas. Sliders display seedRaw+delta but
    // the shader only ever receives the delta, so leaving a slider at its
    // seeded position never double-applies an auto-computed effect.
    this.seedRaw = neutralParams();
    this.params = neutralParams();
    this._bindStaticUI();
  }

  // ---------- Lifecycle ----------

  init({ originalCanvas, autoCanvas, autoStats, isStereo, depthArray }) {
    this.originalCanvas = originalCanvas;
    this.autoCanvas = autoCanvas;
    this.autoStats = autoStats;
    this.isStereo = isStereo;
    this.baseDepthArray = depthArray ? depthArray.slice() : null;
    this._initialDepthArray = this.baseDepthArray ? this.baseDepthArray.slice() : null;

    if (!this.gl) this.gl = new GLPipeline();
    this.editorBaseCanvas = cloneCanvas(autoCanvas);
    this.gl.setEditorBase(this.editorBaseCanvas);

    const scale = Math.min(1, PREVIEW_MAX_WIDTH / this.editorBaseCanvas.width);
    this.previewW = Math.max(2, Math.round(this.editorBaseCanvas.width * scale));
    this.previewH = Math.max(2, Math.round(this.editorBaseCanvas.height * scale));

    this._els.stereoRow.classList.toggle("hidden", !isStereo);
    this._histDebounced = makeDebouncedHistogram(() => this._lastPreviewCanvas, (stats, proxy) => this._onHistogram(stats, proxy));

    this._applyAutoSeed();
    this._setTool("none");
    this._initialized = true;
    this._renderPreviewNow();
  }

  isReady() {
    return this._initialized;
  }

  destroy() {
    if (this.gl) { this.gl.dispose(); this.gl = null; }
    if (this._lamaSession) { lama.disposeLama(this._lamaSession.session); this._lamaSession = null; }
    if (this._esrganSession) { esrgan.disposeRealEsrgan(this._esrganSession); this._esrganSession = null; }
    this._initialized = false;
  }

  // ---------- Seeding / resets ----------

  // editorBaseCanvas already has the auto pipeline's denoise/contrast/
  // sharpen/saturation baked in — so sliders seed to a raw position that
  // *displays* the auto-computed strength, while the actual delta fed to
  // the shader starts at 0 (no double-application). See the seedRaw comment
  // in the constructor.
  _applyAutoSeed() {
    const s = this.autoStats;
    this.seedRaw = neutralParams();
    this.seedRaw.contrast = Math.round(clampParam(s.localContrastStrength) * SCALES.contrast);
    this.seedRaw.sharpen = Math.round(clampParam(s.sharpenAmount) * SCALES.sharpen);
    this.seedRaw.denoise = Math.round(clampParam(s.denoiseStrength) * SCALES.denoise);
    this.seedRaw.saturation = Math.round(clampParam(s.saturationAmount) * SCALES.saturation);
    this.params = neutralParams();
    this._syncSlidersFromParams({ contrast: "auto", sharpen: "auto", denoise: "auto", saturation: "auto" });
  }

  resetToAuto() {
    this.editorBaseCanvas = cloneCanvas(this.autoCanvas);
    this.gl.setEditorBase(this.editorBaseCanvas);
    this.baseDepthArray = this._initialDepthArray ? this._initialDepthArray.slice() : this.baseDepthArray;
    this._applyAutoSeed();
    this._clearMask();
    this._renderPreviewNow();
  }

  resetToOriginal() {
    this.editorBaseCanvas = cloneCanvas(this.originalCanvas);
    this.gl.setEditorBase(this.editorBaseCanvas);
    this.baseDepthArray = null; // original wasn't what any cached depth map describes
    this.seedRaw = neutralParams();
    this.params = neutralParams();
    this._syncSlidersFromParams({ contrast: "manual", sharpen: "manual", denoise: "manual", saturation: "manual" });
    this._clearMask();
    this._renderPreviewNow();
  }

  _syncSlidersFromParams(tagOverrides = {}) {
    for (const [key, s] of Object.entries(this._sliders)) {
      const raw = Math.round(this.seedRaw[key] + this.params[key] * SCALES[key]);
      s.el.value = raw;
      s.val.textContent = s.fmt(raw);
      if (tagOverrides[key] && s.tag) s.tag.textContent = tagOverrides[key];
    }
  }

  // ---------- Static UI wiring ----------

  _bindStaticUI() {
    for (const [key, s] of Object.entries(this._sliders)) {
      s.el.addEventListener("input", () => {
        const raw = Number(s.el.value);
        this.params[key] = (raw - this.seedRaw[key]) / SCALES[key];
        s.val.textContent = s.fmt(raw);
        if (s.tag && s.tag.textContent === "auto") s.tag.textContent = "manually adjusted";
        this._scheduleRender();
      });
    }

    this._els.resetAutoBtn.addEventListener("click", () => this.resetToAuto());
    this._els.resetOrigBtn.addEventListener("click", () => this.resetToOriginal());

    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => this._setTool(btn.dataset.tool));
    });

    this._els.confirmBtn.addEventListener("click", () => this._confirmToolAction());
    this._els.cancelBtn.addEventListener("click", () => this._cancelToolAction());

    this._els.depthToggleBtn.addEventListener("click", () => this._toggleDepthPreview());

    this._els.stereoSlider.addEventListener("input", () => {
      const pct = Number(this._els.stereoSlider.value);
      this._els.stereoVal.textContent = `${pct}%`;
      clearTimeout(this._stereoDebounce);
      this._stereoDebounce = setTimeout(() => this._regenerateStereo(pct), 350);
    });

    this._bindPointerEvents();
  }

  // ---------- Rendering ----------

  _scheduleRender() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this._renderPreviewNow();
    });
  }

  _renderPreviewNow() {
    if (!this.gl) return;
    const out = this.gl.renderEditorChain(this.params, this.previewW, this.previewH);
    const canvas = this._els.canvas;
    if (canvas.width !== out.width || canvas.height !== out.height) {
      canvas.width = out.width;
      canvas.height = out.height;
      this._els.overlay.width = out.width;
      this._els.overlay.height = out.height;
    }
    canvas.getContext("2d").drawImage(out, 0, 0);
    this._lastPreviewCanvas = out;
    this.onPreviewFrame(out);
    this._histDebounced.schedule();
  }

  // Full-resolution render for export/bake — same chain, run once against
  // the base's native size instead of the capped preview size.
  renderFullRes() {
    return this.gl.renderEditorChain(this.params, this.editorBaseCanvas.width, this.editorBaseCanvas.height);
  }

  // Bakes current slider params into editorBaseCanvas (full resolution),
  // rolls the cached depth map to match a recenter shift, and resets
  // sliders to neutral — used before any AI-assisted action so it "operates
  // on the edited image," matching how Phase 2's stages chain.
  async _commitBake() {
    const w = this.editorBaseCanvas.width, h = this.editorBaseCanvas.height;
    const baked = this.renderFullRes();
    if (this.baseDepthArray && Math.abs(this.params.yaw) > 1e-6) {
      this.baseDepthArray = rollDepthArray(this.baseDepthArray, w, h, this.params.yaw * w);
    }
    this.editorBaseCanvas = baked;
    this.gl.setEditorBase(baked);
    this.seedRaw = neutralParams();
    this.params = neutralParams();
    this._syncSlidersFromParams({ contrast: "manual", sharpen: "manual", denoise: "manual", saturation: "manual" });
    this.onBaseCommitted(this.editorBaseCanvas);
    this._renderPreviewNow();
  }

  hasEdits() {
    return this._initialized;
  }

  async buildExport({ mimeType, quality, baseName }) {
    const finalMono = this.editorHasLiveParams() ? this.renderFullRes() : cloneCanvas(this.editorBaseCanvas);
    const monoBlob = await canvasToBlob(finalMono, mimeType, quality);
    if (!this.isStereo) {
      return { blob: monoBlob, mono: finalMono, fileName: `${baseName}-edited.${extForMime(mimeType)}` };
    }
    let depthArray = this.baseDepthArray;
    if (!depthArray) {
      this._els.actionStatus.textContent = "Estimating depth for stereo export…";
      const r = await depthMod.computeDepthMap(finalMono);
      depthArray = r.depthArray;
      this._els.actionStatus.textContent = "";
    }
    const { stacked, leftCanvas, rightCanvas } = await stereo.synthesizeStereoPair(finalMono, depthArray, {});
    const stackedBlob = await canvasToBlob(stacked, mimeType, quality);
    return { blob: stackedBlob, mono: finalMono, leftCanvas, rightCanvas, fileName: `${baseName}-edited_TB.${extForMime(mimeType)}` };
  }

  editorHasLiveParams() {
    const n = neutralParams();
    return Object.keys(n).some((k) => Math.abs(this.params[k] - n[k]) > 1e-6);
  }

  // ---------- Histogram / latitude / stats ----------

  _onHistogram(stats, proxy) {
    drawHistogram(this._els.histCanvas, stats);
    const brightness = computeLatitudeBrightness(proxy, 48);
    drawLatitudeGraph(this._els.latCanvas, brightness);
    const w = this._lastPreviewCanvas.width, h = this._lastPreviewCanvas.height;
    this._els.statsGrid.innerHTML = `
      <div><span>Resolution</span><strong>${this.editorBaseCanvas.width}×${this.editorBaseCanvas.height}</strong></div>
      <div><span>Mean brightness</span><strong>${stats.meanBrightness.toFixed(1)} / 255</strong></div>
      <div><span>Contrast (σ)</span><strong>${stats.contrastStd.toFixed(1)}</strong></div>
      <div><span>Clipped highlights</span><strong>${stats.clippedHighlightsPct.toFixed(2)}%</strong></div>
      <div><span>Clipped shadows</span><strong>${stats.clippedShadowsPct.toFixed(2)}%</strong></div>
      <div><span>Preview size</span><strong>${w}×${h}</strong></div>
    `;
  }

  // ---------- Depth viewer ----------

  async _toggleDepthPreview() {
    if (!this._els.depthImg.classList.contains("hidden")) {
      this._els.depthImg.classList.add("hidden");
      this._els.depthToggleBtn.textContent = "Show depth map";
      return;
    }
    this._els.depthToggleBtn.textContent = "Loading depth map…";
    const { depthArray, depthCanvas } = await this._ensureDepth();
    this._els.depthImg.src = depthCanvas.toDataURL("image/png");
    this._els.depthImg.classList.remove("hidden");
    this._els.depthToggleBtn.textContent = "Hide depth map";
  }

  async _ensureDepth() {
    if (this.baseDepthArray) {
      return { depthArray: this.baseDepthArray, depthCanvas: depthArrayPreviewCanvas(this.baseDepthArray, this.editorBaseCanvas.width, this.editorBaseCanvas.height) };
    }
    this._els.actionStatus.textContent = "Estimating depth…";
    const { depthArray, depthCanvas } = await depthMod.computeDepthMap(this.editorBaseCanvas, {
      onProgress: (frac) => { this._els.actionStatus.textContent = `Downloading depth model… ${Math.round(frac * 100)}%`; },
    });
    this.baseDepthArray = depthArray;
    if (!this._initialDepthArray) this._initialDepthArray = depthArray.slice();
    this._els.actionStatus.textContent = "";
    return { depthArray, depthCanvas };
  }

  // ---------- Stereo strength ----------

  async _regenerateStereo(pct) {
    if (!this.isStereo) return;
    this._els.actionStatus.textContent = "Regenerating stereo pair…";
    try {
      const finalMono = this.renderFullRes();
      const { depthArray } = await this._ensureDepth();
      const maxShiftDeg = stereo.DEFAULT_MAX_SHIFT_DEG * (pct / 100);
      const { stacked, leftCanvas, rightCanvas } = await stereo.synthesizeStereoPair(finalMono, depthArray, { maxShiftDeg });
      this.onBaseCommitted(finalMono, { stacked, leftCanvas, rightCanvas });
    } finally {
      this._els.actionStatus.textContent = "";
    }
  }

  // ---------- Tools (brush / lasso / smart-select / regional boost) ----------

  _setTool(tool) {
    this.tool = tool;
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
    this._els.brushSizeRow.classList.toggle("hidden", tool !== "brush");
    this._clearMask();
  }

  _clearMask() {
    if (this.mask) this.mask.clear();
    this.regionRect = null;
    this._els.overlay.getContext("2d").clearRect(0, 0, this._els.overlay.width, this._els.overlay.height);
    this._els.actionRow.classList.add("hidden");
  }

  _ensureMask() {
    if (!this.mask || this.mask.width !== this.editorBaseCanvas.width) {
      this.mask = new ManualMask(this.editorBaseCanvas.width, this.editorBaseCanvas.height);
    }
    return this.mask;
  }

  // Maps a pointer event (client coords) to full-res image pixel coords,
  // accounting for the current yaw shift so brush/lasso/region tools paint
  // onto the un-shifted base image.
  _eventToImageCoords(e) {
    const rect = this._els.canvas.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;
    const w = this.editorBaseCanvas.width, h = this.editorBaseCanvas.height;
    const ub = ((u + this.params.yaw) % 1 + 1) % 1;
    return { x: ub * w, y: Math.max(0, Math.min(h - 1, v * h)), rectW: rect.width };
  }

  _bindPointerEvents() {
    const wrap = this._els.wrap;

    wrap.addEventListener("pointerdown", (e) => {
      if (this.tool === "none") return;
      wrap.setPointerCapture(e.pointerId);
      const { x, y, rectW } = this._eventToImageCoords(e);

      if (this.tool === "brush") {
        const mask = this._ensureMask();
        const radius = Number(this._els.brushSizeSlider.value) * (this.editorBaseCanvas.width / rectW);
        mask.brushDot(x, y, radius);
        this._brushLast = { x, y, radius };
        this._redrawOverlay();
        this._els.actionRow.classList.remove("hidden");
      } else if (this.tool === "lasso") {
        const mask = this._ensureMask();
        mask.addLassoPoint(x, y);
        this._redrawOverlay();
      } else if (this.tool === "smart") {
        this._runSmartSelect(x, y);
      } else if (this.tool === "region") {
        this._dragStart = { x, y };
      }
    });

    wrap.addEventListener("pointermove", (e) => {
      if (this.tool === "brush" && this._brushLast) {
        const { x, y } = this._eventToImageCoords(e);
        this.mask.brushStroke(this._brushLast.x, this._brushLast.y, x, y, this._brushLast.radius);
        this._brushLast = { x, y, radius: this._brushLast.radius };
        this._redrawOverlay();
      } else if (this.tool === "region" && this._dragStart) {
        const { x, y } = this._eventToImageCoords(e);
        this.regionRect = rectFromPoints(this._dragStart, { x, y });
        this._redrawOverlay();
      }
    });

    const endStroke = () => {
      if (this.tool === "brush") this._brushLast = null;
      if (this.tool === "region" && this._dragStart) {
        this._dragStart = null;
        if (this.regionRect && this.regionRect.width > 4 && this.regionRect.height > 4) {
          this._els.actionRow.classList.remove("hidden");
        }
      }
    };
    wrap.addEventListener("pointerup", endStroke);
    wrap.addEventListener("pointercancel", endStroke);

    wrap.addEventListener("dblclick", () => {
      if (this.tool === "lasso" && this.mask && this.mask.lassoPointCount >= 3) {
        this.mask.closeLasso();
        this._redrawOverlay();
        this._els.actionRow.classList.remove("hidden");
      }
    });
  }

  _redrawOverlay() {
    const ctx = this._els.overlay.getContext("2d");
    const w = this._els.overlay.width, h = this._els.overlay.height;
    ctx.clearRect(0, 0, w, h);
    if (this.mask && !this.mask.isEmpty()) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.mask.canvas, 0, 0, w, h);
      ctx.restore();
    }
    if (this.regionRect) {
      const scaleX = w / this.editorBaseCanvas.width, scaleY = h / this.editorBaseCanvas.height;
      ctx.strokeStyle = "#5cc8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.regionRect.x * scaleX, this.regionRect.y * scaleY, this.regionRect.width * scaleX, this.regionRect.height * scaleY);
    }
  }

  async _runSmartSelect(x, y) {
    this._els.actionStatus.textContent = "Estimating depth…";
    const { depthArray } = await this._ensureDepth();
    const w = this.editorBaseCanvas.width, h = this.editorBaseCanvas.height;
    const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
    const maskArr = smartSelectByDepth(depthArray, w, h, xi, yi, { threshold: 0.05 });
    const maskCanvas = maskArrayToCanvas(maskArr, w, h);
    this._ensureMask().setFromCanvas(maskCanvas);
    this._redrawOverlay();
    this._els.actionRow.classList.remove("hidden");
    this._els.actionStatus.textContent = "";
  }

  async _cancelToolAction() {
    this._clearMask();
  }

  async _confirmToolAction() {
    if (this.tool === "region") {
      if (!this.regionRect) return;
      this._els.actionStatus.textContent = "Boosting detail in selection…";
      try {
        await this._commitBake();
        if (!this._esrganSession) {
          this._esrganSession = await esrgan.loadRealEsrganSession((frac) => {
            this._els.actionStatus.textContent = `Downloading AI model… ${Math.round(frac * 100)}%`;
          });
        }
        const result = await boostRegion(this.editorBaseCanvas, this.regionRect, {
          sessionInfo: this._esrganSession,
          onTileProgress: (done, total) => { this._els.actionStatus.textContent = `Boosting detail… tile ${done}/${total}`; },
        });
        this.editorBaseCanvas = result;
        this.gl.setEditorBase(result);
        this.onBaseCommitted(result);
        this._renderPreviewNow();
      } catch (err) {
        console.error(err);
        this._els.actionStatus.textContent = `Regional detail boost failed: ${err.message}`;
        setTimeout(() => { this._els.actionStatus.textContent = ""; }, 4000);
      } finally {
        this._clearMask();
      }
      return;
    }

    // brush / lasso / smart-select all confirm into a LaMa object-removal pass.
    if (!this.mask || this.mask.isEmpty()) return;
    this._els.actionStatus.textContent = "Removing selection…";
    try {
      const maskCanvas = this.mask.canvas;
      await this._commitBake();
      if (!this._lamaSession) {
        this._lamaSession = await lama.loadLamaSession((frac) => {
          this._els.actionStatus.textContent = `Downloading AI model… ${Math.round(frac * 100)}%`;
        });
      }
      const result = await lama.runMaskedCleanup(this.editorBaseCanvas, maskCanvas, this._lamaSession);
      this.editorBaseCanvas = result;
      this.gl.setEditorBase(result);
      this.onBaseCommitted(result);
      this._renderPreviewNow();
    } catch (err) {
      console.error(err);
      this._els.actionStatus.textContent = `Object removal failed: ${err.message}`;
      setTimeout(() => { this._els.actionStatus.textContent = ""; }, 4000);
    } finally {
      this._clearMask();
    }
  }
}

function clampParam(v) {
  return Math.max(-1, Math.min(1, v));
}

function rectFromPoints(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

function depthArrayPreviewCanvas(depthArray, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(depthArray[i] * 255);
    const p = i * 4;
    imgData.data[p] = v; imgData.data[p + 1] = v; imgData.data[p + 2] = v; imgData.data[p + 3] = 255;
  }
  canvas.getContext("2d").putImageData(imgData, 0, 0);
  return canvas;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image."))), mimeType, quality);
  });
}

function extForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
