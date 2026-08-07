import { GLPipeline } from "./glPipeline.js";
import { PanoramaViewer } from "./panoramaViewer.js";
import { CompareSlider } from "./compareSlider.js";
import * as lama from "./ai/lamaInpaint.js";
import * as esrgan from "./ai/realesrganUpscale.js";
import * as depthMod from "./ai/depthAnything.js";
import * as stereo from "./ai/stereoSynthesis.js";
import { EditorController } from "./editor/editorPanel.js";

const MAX_WORKING_WIDTH = 8192;
const MAX_WORKING_HEIGHT = 4096;
const UPSCALE_FLOOR = 4096;
const UPSCALE_TARGET = 6144;
const ANALYSIS_MAX_WIDTH = 1024;
const SHARPEN_BLUR_SIGMA = 1.2;

const STEP_LABELS = {
  analyze: "Analyzing image…",
  upload: "Preparing image…",
  denoise: "Denoising…",
  whitebalance: "Balancing color…",
  contrast: "Boosting local contrast…",
  sharpen: "Sharpening (pole-aware)…",
  polecleanup: "Cleaning up poles…",
  seam: "Checking seam…",
  saturation: "Adjusting vibrance…",
  upscale: "Upscaling for VR…",
  encode: "Encoding result…",
  stage2: "AI Cleanup — removing tripod/photographer…",
  stage3: "AI Detail Boost — neural upscale…",
  stage4: "Generate VR 3D — stereo pair…",
};

// --- DOM refs ---
const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone");
const fileInput = $("fileInput");

const uploadSection = $("upload-section");
const stagesSection = $("stages-section");
const progressSection = $("progress-section");
const resultsSection = $("results-section");
const errorSection = $("error-section");

const stage1Check = $("stage1Check");
const stage2Check = $("stage2Check");
const stage3Check = $("stage3Check");
const stage4Check = $("stage4Check");
const runBtn = $("runBtn");
const stagesResetBtn = $("stagesResetBtn");

const progressList = $("progressList");
const progressBarFill = $("progressBarFill");
const progressSubStatus = $("progressSubStatus");
const runtimeWarnings = $("runtimeWarnings");

const compareAfter = $("compareAfter");
const compareBefore = $("compareBefore");
const compareBeforeWrap = $("compareBeforeWrap");
const compareHandle = $("compareHandle");
const compareSliderEl = $("compareSlider");

const viewTabs = document.querySelectorAll(".view-tab");
const sliderView = $("sliderView");
const vrView = $("vrView");
const editorView = $("editorView");
const vrToggleBtn = $("vrToggleBtn");
const vrToggleLabel = $("vrToggleLabel");
const anaglyphToggleBtn = $("anaglyphToggleBtn");
const anaglyphLabel = $("anaglyphLabel");
const anaglyphHint = $("anaglyphHint");
const vrCanvas = $("vrCanvas");

const summaryText = $("summaryText");
const downloadBtn = $("downloadBtn");
const downloadNote = $("downloadNote");
const resetBtn = $("resetBtn");

const errorText = $("errorText");
const errorResetBtn = $("errorResetBtn");

let compareSlider = null;
let panoramaViewer = null;
let analysisWorker = null;
let currentObjectUrls = [];
let currentResult = null; // { blob, fileName, isStereo }
let pendingFile = null;
let pendingBitmap = null;

// Editor Mode state — kept alongside the auto/AI pipeline's result so
// turning Editor Mode on never discards or re-runs Stages 1-4.
let editorController = null;
let editorInitData = null; // { originalCanvas, autoCanvas, autoStats, isStereo, depthArray } captured after each run
let lastMimeType = "image/jpeg";
let lastQuality = 0.94;
let lastBaseName = "panorama";
let compareImgUpdateTimer = null;

// ---------- Utilities ----------

function getWorker() {
  if (!analysisWorker) analysisWorker = new Worker("js/analysisWorker.js");
  return analysisWorker;
}

function runAnalysis(imageData) {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = (err) => reject(new Error(`Analysis failed: ${err.message}`));
    worker.postMessage(
      { buffer: imageData.data.buffer, width: imageData.width, height: imageData.height },
      [imageData.data.buffer]
    );
  });
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function computeWorkingSize(w, h, maxTextureSize) {
  const capW = Math.min(MAX_WORKING_WIDTH, maxTextureSize || MAX_WORKING_WIDTH);
  const capH = Math.min(MAX_WORKING_HEIGHT, maxTextureSize || MAX_WORKING_HEIGHT);
  const scale = Math.min(1, capW / w, capH / h);
  let ww = Math.round(w * scale);
  let wh = Math.round(h * scale);
  if (ww % 2 !== 0) ww += 1;
  if (wh % 2 !== 0) wh += 1;
  return { width: ww, height: wh };
}

function computeUpscale(w, h, maxTextureSize) {
  if (w >= UPSCALE_FLOOR) return { enabled: false };
  const cap = Math.min(UPSCALE_TARGET, maxTextureSize || UPSCALE_TARGET);
  let targetW = Math.min(cap, Math.max(UPSCALE_FLOOR, w * 2));
  let targetH = Math.round(targetW / (w / h));
  if (targetW % 2 !== 0) targetW += 1;
  if (targetH % 2 !== 0) targetH += 1;
  if (targetW <= w) return { enabled: false };
  return { enabled: true, targetW, targetH };
}

function levelLabel(v, lo, hi) {
  if (v < 0.03) return "none";
  if (v < lo) return "light";
  if (v < hi) return "moderate";
  return "strong";
}

function buildTraditionalSummaryParts(stats, decisions) {
  const parts = [];
  parts.push(`Denoised: ${levelLabel(stats.denoiseStrength, 0.25, 0.5)}`);

  const gainSpread = Math.max(...stats.wbGain) - Math.min(...stats.wbGain);
  parts.push(gainSpread > 0.03 ? "White balance corrected" : "White balance already neutral");

  parts.push(`Local contrast boosted ${Math.round(stats.localContrastStrength * 100)}%`);
  parts.push(`Sharpened pole-aware (${Math.round(stats.sharpenAmount * 100)}% strength, tapered near zenith/nadir)`);
  parts.push("Pole cleanup smoothing applied at top & bottom ~6% of rows");

  const seamMag = Math.max(...stats.seamDelta.map(Math.abs));
  parts.push(seamMag > 0.012 ? "Stitch seam mismatch detected and blended" : "Seam already consistent — no correction needed");

  parts.push(stats.saturationAmount > 0.02
    ? `Vibrance boosted +${Math.round(stats.saturationAmount * 100)}%`
    : "Saturation left natural (source already vivid)");

  if (decisions.upscale.enabled) {
    parts.push(`Upscaled ${decisions.workingW}×${decisions.workingH} → ${decisions.upscale.targetW}×${decisions.upscale.targetH}`);
  } else {
    parts.push(`Resolution kept at ${decisions.workingW}×${decisions.workingH}`);
  }
  return parts;
}

function revokeObjectUrls() {
  for (const url of currentObjectUrls) URL.revokeObjectURL(url);
  currentObjectUrls = [];
}

function canvasToObjectUrl(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Failed to encode image.")); return; }
      const url = URL.createObjectURL(blob);
      currentObjectUrls.push(url);
      resolve({ url, blob });
    }, mimeType, quality);
  });
}

function mimeForFile(file) {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

function extForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function tick() {
  return new Promise((r) => requestAnimationFrame(r));
}

// ---------- Progress UI ----------

function buildProgressList(stepIds) {
  progressList.innerHTML = "";
  for (const id of stepIds) {
    const li = document.createElement("li");
    li.dataset.step = id;
    li.innerHTML = `<span class="step-icon"></span><span class="step-label">${STEP_LABELS[id] || id}</span>`;
    progressList.appendChild(li);
  }
  progressBarFill.style.width = "0%";
}

function setStepActive(stepId, stepIds) {
  const idx = stepIds.indexOf(stepId);
  progressList.querySelectorAll("li").forEach((li) => {
    const liIdx = stepIds.indexOf(li.dataset.step);
    li.classList.remove("active", "done");
    if (liIdx < idx) li.classList.add("done");
    else if (liIdx === idx) li.classList.add("active");
  });
  progressBarFill.style.width = `${Math.round((idx / stepIds.length) * 100)}%`;
}

function markAllDone() {
  progressList.querySelectorAll("li").forEach((li) => { li.classList.add("done"); li.classList.remove("active"); });
  progressBarFill.style.width = "100%";
}

function setSubStatus(text) {
  progressSubStatus.textContent = text || "";
}

function renderRuntimeWarnings(warnings) {
  if (!warnings.length) {
    runtimeWarnings.classList.add("hidden");
    runtimeWarnings.innerHTML = "";
    return;
  }
  runtimeWarnings.innerHTML = warnings.map((w) => `<p>⚠️ ${w}</p>`).join("");
  runtimeWarnings.classList.remove("hidden");
}

// ---------- Section visibility ----------

function showSection(section) {
  for (const s of [uploadSection, stagesSection, progressSection, resultsSection, errorSection]) {
    s.classList.toggle("hidden", s !== section);
  }
}

function showError(message) {
  errorText.textContent = message;
  showSection(errorSection);
}

// ---------- File selection (stage 1 of the UI flow) ----------

async function onFileSelected(file) {
  try {
    revokeObjectUrls();
    renderRuntimeWarnings([]);

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("Please choose a JPG, PNG, or WebP image.");
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("Could not decode this image. It may be corrupt or an unsupported format.");
    }

    pendingFile = file;
    pendingBitmap = bitmap;
    showSection(stagesSection);
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong while reading this image.");
  }
}

// ---------- Main staged pipeline ----------

async function runPipeline() {
  const file = pendingFile;
  const bitmap = pendingBitmap;
  if (!file || !bitmap) return;

  const stages = {
    stage1: stage1Check.checked,
    stage2: stage2Check.checked,
    stage3: stage3Check.checked,
    stage4: stage4Check.checked,
  };
  const warnings = [];

  try {
    showSection(progressSection);
    setSubStatus("");

    const aspect = bitmap.width / bitmap.height;
    let aspectWarning = null;
    if (Math.abs(aspect - 2) > 0.15) {
      aspectWarning = `Note: this image is ${aspect.toFixed(2)}:1, not the standard 2:1 equirectangular ratio — processed as best-effort.`;
    }

    const glPipeline = stages.stage1 ? new GLPipeline() : null;
    const maxTextureSize = glPipeline ? glPipeline.maxTextureSize : MAX_WORKING_WIDTH;
    const { width: workingW, height: workingH } = computeWorkingSize(bitmap.width, bitmap.height, maxTextureSize);

    // Stage 3 (AI Detail Boost) supersedes the traditional pipeline's own
    // bicubic upscale — running both would compound resolution growth.
    let upscaleDecision = computeUpscale(workingW, workingH, maxTextureSize);
    if (stages.stage3) upscaleDecision = { enabled: false };

    const stepIds = [];
    if (stages.stage1) {
      stepIds.push("analyze", "upload", "denoise", "whitebalance", "contrast", "sharpen", "polecleanup", "seam", "saturation");
      if (upscaleDecision.enabled) stepIds.push("upscale");
      stepIds.push("encode");
    }
    if (stages.stage2) stepIds.push("stage2");
    if (stages.stage3) stepIds.push("stage3");
    if (stages.stage4) stepIds.push("stage4");
    buildProgressList(stepIds.length ? stepIds : ["encode"]);

    const workingCanvas = drawToCanvas(bitmap, workingW, workingH);
    bitmap.close && bitmap.close();

    let currentCanvas = workingCanvas;
    const summaryFragments = [];
    let isStereo = false;
    let stackedCanvas = null, leftEyeCanvas = null, rightEyeCanvas = null;
    let pipelineStats = {
      denoiseStrength: 0, localContrastStrength: 0, sharpenAmount: 0, saturationAmount: 0,
    };
    let depthSourceCanvasRef = null;

    // ---- Stage 1: Traditional Enhancement ----
    if (stages.stage1) {
      setStepActive("analyze", stepIds);
      await tick();

      const aScale = Math.min(1, ANALYSIS_MAX_WIDTH / workingW);
      const aw = Math.max(2, Math.round(workingW * aScale));
      const ah = Math.max(2, Math.round(workingH * aScale));
      const analysisCanvas = drawToCanvas(workingCanvas, aw, ah);
      const imageData = analysisCanvas.getContext("2d").getImageData(0, 0, aw, ah);
      const stats = await runAnalysis(imageData);
      stats.sharpenBlurSigma = SHARPEN_BLUR_SIGMA;
      pipelineStats = stats;

      const onStep = (id) => setStepActive(id, stepIds);
      const result = await glPipeline.run(workingCanvas, workingW, workingH, stats, upscaleDecision, onStep);
      currentCanvas = result.canvas;
      glPipeline.dispose && glPipeline.dispose();
      summaryFragments.push(...buildTraditionalSummaryParts(stats, { upscale: upscaleDecision, workingW, workingH }));
    } else {
      summaryFragments.push("Traditional enhancement skipped (using the original upload as the base)");
    }

    // ---- Stage 2: AI Cleanup (LaMa nadir inpainting) ----
    let lamaSessionInfo = null;
    if (stages.stage2) {
      setStepActive("stage2", stepIds);
      await tick();
      try {
        setSubStatus(`Downloading AI model (~${lama.MODEL_SIZE_MB}MB, first time only)…`);
        lamaSessionInfo = await lama.loadLamaSession((frac) => setSubStatus(`Downloading AI model… ${Math.round(frac * 100)}%`));
        setSubStatus("Removing tripod/photographer at the nadir…");
        await tick();
        currentCanvas = await lama.runNadirCleanup(currentCanvas, lamaSessionInfo);
        summaryFragments.push("AI cleanup removed the nadir tripod/photographer footprint");
      } catch (err) {
        console.error(err);
        warnings.push(`AI Cleanup (LaMa) failed to load or run, so it was skipped: ${err.message}`);
        if (lamaSessionInfo) { lama.disposeLama(lamaSessionInfo.session); lamaSessionInfo = null; }
      }
      setSubStatus("");
    }

    // ---- Stage 3: AI Detail Boost (Real-ESRGAN) ----
    if (stages.stage3) {
      setStepActive("stage3", stepIds);
      await tick();
      try {
        setSubStatus(`Downloading AI model (~${esrgan.MODEL_SIZE_MB}MB, first time only)…`);
        const esrganSession = await esrgan.loadRealEsrganSession((frac) => setSubStatus(`Downloading AI model… ${Math.round(frac * 100)}%`));

        let base = currentCanvas;
        if (base.width * esrgan.SCALE > MAX_WORKING_WIDTH) {
          const targetBaseW = Math.floor(MAX_WORKING_WIDTH / esrgan.SCALE);
          const targetBaseH = Math.round(targetBaseW / (base.width / base.height));
          base = drawToCanvas(base, targetBaseW, targetBaseH);
        }

        setSubStatus("Upscaling detail…");
        const beforeW = base.width, beforeH = base.height;
        currentCanvas = await esrgan.upscaleRealEsrgan(base, esrganSession, {
          onTileProgress: (done, total) => setSubStatus(`Upscaling detail… tile ${done}/${total}`),
        });
        esrgan.disposeRealEsrgan(esrganSession);
        summaryFragments.push(`AI detail boost upscaled ${beforeW}×${beforeH} → ${currentCanvas.width}×${currentCanvas.height}`);
      } catch (err) {
        console.error(err);
        warnings.push(`AI Detail Boost (Real-ESRGAN) failed to load or run, so it was skipped: ${err.message}`);
      }
      setSubStatus("");
    }

    // ---- Stage 4: Generate VR 3D (Depth Anything V2 -> stereo pair) ----
    if (stages.stage4) {
      setStepActive("stage4", stepIds);
      await tick();
      try {
        setSubStatus(`Downloading AI model (~${depthMod.MODEL_SIZE_MB}MB, first time only)…`);
        depthSourceCanvasRef = currentCanvas;
        const { depthArray } = await depthMod.computeDepthMap(currentCanvas, {
          onProgress: (frac) => setSubStatus(`Downloading AI model… ${Math.round(frac * 100)}%`),
          onStatus: setSubStatus,
        });
        await tick();

        const { stacked, leftCanvas, rightCanvas } = await stereo.synthesizeStereoPair(currentCanvas, depthArray, {
          lamaSessionInfo,
          onStatus: setSubStatus,
        });
        stackedCanvas = stacked;
        leftEyeCanvas = leftCanvas;
        rightEyeCanvas = rightCanvas;
        currentCanvas = leftCanvas;
        isStereo = true;
        summaryFragments.push("Generated a left/right stereo pair from estimated depth (top/bottom stacked output)");
      } catch (err) {
        console.error(err);
        warnings.push(`Generate VR 3D (Depth Anything V2) failed to load or run, so it was skipped: ${err.message}`);
      }
      setSubStatus("");
    }

    if (lamaSessionInfo) { lama.disposeLama(lamaSessionInfo.session); lamaSessionInfo = null; }

    markAllDone();

    // ---- Encode + populate UI ----
    const mimeType = mimeForFile(file);
    const quality = mimeType === "image/png" ? undefined : 0.94;
    lastMimeType = mimeType;
    lastQuality = quality;

    const [beforeUrl, afterUrl] = await Promise.all([
      canvasToObjectUrl(workingCanvas, mimeType, quality),
      canvasToObjectUrl(currentCanvas, mimeType, quality),
    ]);
    compareBefore.src = beforeUrl.url;
    compareAfter.src = afterUrl.url;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "panorama";
    lastBaseName = baseName;
    let downloadBlob = afterUrl.blob;
    let fileName = `${baseName}-enhanced.${extForMime(mimeType)}`;
    if (isStereo) {
      const stackedUrl = await canvasToObjectUrl(stackedCanvas, mimeType, quality);
      downloadBlob = stackedUrl.blob;
      fileName = `${baseName}-enhanced_TB.${extForMime(mimeType)}`;
    }
    currentResult = { blob: downloadBlob, fileName, isStereo };
    downloadBtn.textContent = isStereo ? "Download stereo (top/bottom) image" : "Download enhanced image";
    downloadNote.textContent = isStereo
      ? "This downloads a top/bottom (over/under) stacked stereo file (filename ends in _TB) — open it in a 360 VR player that supports top/bottom stereo layouts."
      : "";

    if (!panoramaViewer) panoramaViewer = new PanoramaViewer(vrCanvas);
    panoramaViewer.setTexture("original", workingCanvas);
    panoramaViewer.setTexture("enhanced", currentCanvas);
    panoramaViewer.showKey(vrToggleLabel.textContent.trim() === "Original" ? "original" : "enhanced");
    if (isStereo) {
      panoramaViewer.setStereoTextures(leftEyeCanvas, rightEyeCanvas);
      anaglyphToggleBtn.classList.remove("hidden");
      anaglyphHint.classList.remove("hidden");
    } else {
      panoramaViewer.setAnaglyph(false);
      anaglyphLabel.textContent = "Off";
      anaglyphToggleBtn.classList.add("hidden");
      anaglyphHint.classList.add("hidden");
    }

    const finalParts = [];
    if (aspectWarning) finalParts.push(aspectWarning);
    finalParts.push(...summaryFragments);
    summaryText.textContent = finalParts.join(" · ") + ".";

    // A fresh pipeline run means Editor Mode (if it was used before) must
    // start over from this run's own auto/AI output, not the previous
    // image's edited state.
    if (editorController) { editorController.destroy(); editorController = null; }
    const cachedDepth = depthSourceCanvasRef ? depthMod.getCachedDepthMap(depthSourceCanvasRef) : null;
    editorInitData = {
      originalCanvas: workingCanvas,
      autoCanvas: currentCanvas,
      autoStats: pipelineStats,
      isStereo,
      depthArray: cachedDepth ? cachedDepth.depthArray : null,
    };
    viewTabs.forEach((t) => {
      const isSlider = t.dataset.view === "slider";
      t.classList.toggle("active", isSlider);
      t.setAttribute("aria-selected", String(isSlider));
    });
    sliderView.classList.remove("hidden");
    vrView.classList.add("hidden");
    editorView.classList.add("hidden");

    renderRuntimeWarnings(warnings);
    showSection(resultsSection);
    if (!sliderView.classList.contains("hidden")) {
      requestAnimationFrame(() => compareSlider && compareSlider.setPercent(50));
    }
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong while processing this image.");
  }
}

// ---------- Wiring ----------

compareSlider = new CompareSlider({ root: compareSliderEl, beforeWrap: compareBeforeWrap, handle: compareHandle });

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) onFileSelected(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) onFileSelected(file);
});

runBtn.addEventListener("click", runPipeline);

viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    viewTabs.forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    const view = tab.dataset.view;
    sliderView.classList.toggle("hidden", view !== "slider");
    vrView.classList.toggle("hidden", view !== "vr");
    editorView.classList.toggle("hidden", view !== "editor");
    if (view === "vr" && panoramaViewer) {
      requestAnimationFrame(() => panoramaViewer.resize());
    }
    if (view === "editor" && editorInitData) {
      if (!editorController) {
        editorController = new EditorController({
          onPreviewFrame: (canvas) => {
            if (panoramaViewer) panoramaViewer.setTexture("enhanced", canvas);
          },
          onBaseCommitted: (canvas, stereoUpdate) => {
            if (panoramaViewer) {
              panoramaViewer.setTexture("enhanced", canvas);
              if (stereoUpdate && stereoUpdate.leftCanvas) {
                panoramaViewer.setStereoTextures(stereoUpdate.leftCanvas, stereoUpdate.rightCanvas);
              }
            }
            scheduleCompareAfterUpdate(canvas);
          },
        });
        editorController.init(editorInitData);
      }
    }
  });
});

function scheduleCompareAfterUpdate(canvas) {
  clearTimeout(compareImgUpdateTimer);
  compareImgUpdateTimer = setTimeout(() => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      currentObjectUrls.push(url);
      compareAfter.src = url;
    }, lastMimeType, lastQuality);
  }, 250);
}

vrToggleBtn.addEventListener("click", () => {
  const showingOriginal = vrToggleLabel.textContent.trim() === "Original";
  const nextKey = showingOriginal ? "enhanced" : "original";
  vrToggleLabel.textContent = nextKey === "enhanced" ? "Enhanced" : "Original";
  if (panoramaViewer) panoramaViewer.showKey(nextKey);
});

anaglyphToggleBtn.addEventListener("click", () => {
  if (!panoramaViewer) return;
  const next = !panoramaViewer.anaglyphEnabled;
  panoramaViewer.setAnaglyph(next);
  anaglyphLabel.textContent = next ? "On" : "Off";
});

downloadBtn.addEventListener("click", async () => {
  if (!currentResult) return;
  let blob = currentResult.blob;
  let fileName = currentResult.fileName;

  // If Editor Mode has been opened, the download must reflect the full
  // auto + AI + manual/AI-assisted combination, not just the original
  // pipeline's output — rebuild it fresh at full resolution.
  if (editorController && editorController.hasEdits()) {
    const prevLabel = downloadBtn.textContent;
    downloadBtn.textContent = "Preparing edited export…";
    downloadBtn.disabled = true;
    try {
      const built = await editorController.buildExport({ mimeType: lastMimeType, quality: lastQuality, baseName: lastBaseName });
      blob = built.blob;
      fileName = built.fileName;
    } catch (err) {
      console.error(err);
    } finally {
      downloadBtn.textContent = prevLabel;
      downloadBtn.disabled = false;
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

function resetAll() {
  revokeObjectUrls();
  fileInput.value = "";
  currentResult = null;
  pendingFile = null;
  pendingBitmap = null;
  if (editorController) { editorController.destroy(); editorController = null; }
  editorInitData = null;
  renderRuntimeWarnings([]);
  showSection(uploadSection);
}
resetBtn.addEventListener("click", resetAll);
errorResetBtn.addEventListener("click", resetAll);
stagesResetBtn.addEventListener("click", resetAll);
