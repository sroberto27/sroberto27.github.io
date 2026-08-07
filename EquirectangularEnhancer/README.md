# Equirectangular VR Enhancer

A static, 100% client-side web app that takes a single 360° equirectangular
photo and automatically enhances it for the best possible viewing experience
in a VR headset — no accounts, nothing server-side.

**Your image never leaves your device.** Everything — analysis, denoising,
white balance, contrast, sharpening, upscaling, encoding, and every AI
model's inference — runs locally in the browser via WebGL2, Web Workers, and
WebGPU/WASM. Nothing is ever uploaded. Only the (public, open) AI model
weights themselves are fetched from Hugging Face on first use, and then
cached locally so repeat visits don't re-download them.

## Using it

Open `index.html` (locally or via GitHub Pages), drop in a JPG/PNG/WebP
equirectangular panorama, choose which pipeline stages to run (see below —
the default, "Traditional Enhancement" only, matches the original one-click
behavior byte-for-byte), and click **Run pipeline**. When it's done you can:

- Drag the before/after slider to compare flat images.
- Switch to the 360° tab and drag to look around inside the panorama —
  toggle between original and enhanced to judge the difference the way
  you'd actually see it in a headset. If you generated a stereo pair, a
  red/cyan anaglyph toggle gives a rough sanity check of the 3D effect
  without a headset (put on anaglyph glasses, or just eyeball the color
  fringing on near objects).
- Download the result. Stereo output downloads as a top/bottom stacked file
  (filename ends in `_TB`) instead of the normal flat image.

No build step — it's plain ES modules served as static files. Three.js,
onnxruntime-web, and the AI model weights are all loaded from CDNs (jsdelivr
/ Hugging Face) at runtime.

## Pipeline stages

Four independently-toggleable stages, always run in this order when enabled
— each enabled stage operates on the output of the previous *enabled* stage,
so e.g. running only stage 4 operates on the raw upload, while running 1+4
operates on the traditionally-enhanced result:

| # | Stage | Default | What it needs |
|---|-------|---------|----------------|
| 1 | **Traditional Enhancement** | ✅ on | Nothing — pure WebGL2, no downloads |
| 2 | **AI Cleanup** — nadir inpainting | off | [Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX) (Apache-2.0), ~208MB |
| 3 | **AI Detail Boost** — neural upscale | off | [SceneWorks/real-esrgan-onnx](https://huggingface.co/SceneWorks/real-esrgan-onnx) (BSD-3-Clause, following upstream [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)), ~64MB |
| 4 | **Generate VR 3D** — stereo pair | off | [onnx-community/depth-anything-v2-small](https://huggingface.co/onnx-community/depth-anything-v2-small) (Apache-2.0), ~27MB |

All three models are fetched lazily — only when their checkbox is actually
used — and cached via the Cache API so they aren't re-downloaded on repeat
visits. Every model runs through a single shared `onnxruntime-web` runtime
(`js/ai/onnxRuntimeSetup.js`): WebGPU is tried first, with an automatic
fallback to single-threaded WASM (GitHub Pages can't set the COOP/COEP
headers multi-threaded WASM needs, so threading is disabled outright for
portability). If a model fails to load or run — offline, unsupported
browser, whatever — that stage is skipped with a visible warning and the
rest of the pipeline continues.

### Stage 2 — AI Cleanup (LaMa inpainting)

Automatically removes whatever's sitting at the nadir (bottom pole) of a
ground-mounted 360 shot — almost always the tripod and/or photographer's
feet. A circular mask centered on the bottom edge (radius ≈ 8% of image
height) is cropped out with padding, resized to the model's fixed 512×512
input, inpainted, and feather-composited back in. This is a *nadir-only*
heuristic — it won't remove arbitrary unwanted objects elsewhere in the
frame, by design (there's no reliable automatic way to know what else in an
arbitrary photo is "unwanted").

The exact preprocessing (image normalized to `[0,1]` RGB, mask as a binary
`{0,1}` single channel where `1` = inpaint, output already in `~[0,255]`
with no further scaling) was verified empirically against the model's own
published sample image/mask before being wired into the app — LaMa ONNX
exports vary on the internet in these conventions, so this wasn't just
copied from documentation.

### Stage 3 — AI Detail Boost (Real-ESRGAN)

Tiles the working image at 512px (480px core + 16px context padding on each
side, per the model card's own recommendation), runs each tile through
Real-ESRGAN's 4x super-resolution model, and stitches the results back
together using only each tile's core region (the padding exists purely to
give the model context, then gets discarded to avoid tile-boundary
artifacts). Horizontal tile padding **wraps** across the seam instead of
clamping — the model has no idea it's looking at a panorama, so the app
enforces that geometry at the tiling layer. Tiles near the poles are
alpha-blended back toward a plain bicubic upscale (same pole-falloff shape
used by the traditional pipeline's sharpening) so a model trained on
ordinary photos doesn't amplify pole distortion.

When this stage is enabled it fully replaces the traditional pipeline's own
upscale step (step 9 below) — running both would compound into runaway
resolution growth. If the current image is already large enough that 4x
would exceed the app's working-resolution ceiling, it's downscaled first so
the AI-upscaled result still lands within that ceiling.

### Stage 4 — Generate VR 3D (Depth Anything V2 → stereo pair)

Uses the **small** Depth Anything V2 variant specifically — it's the only
size released under an Apache-2.0 (redistributable) license; base/large/
giant are CC-BY-NC-4.0 and unsuitable for a tool anyone can freely use.
Depth inference runs through a raw `onnxruntime-web` session (not the
Transformers.js pipeline API) so it shares the one runtime already set up
for stages 2/3 instead of pulling in a second WASM/WebGPU backend.

Because this is equirectangular rather than a flat photo, the x-axis is
already linear in longitude at *every* row, so a per-pixel horizontal
disparity in pixels is automatically an angularly-consistent shift at any
latitude — no per-row angular correction needed, unlike normal
depth-image-based-rendering on a perspective photo. What *is* different: a
shifted pixel that would fall off the left/right edge instead **wraps**
across the seam rather than being cropped. Disparity is capped to a
conservative ~1.2° max angular shift to keep the 3D effect comfortable
rather than extreme, and forward-warping the source through the depth map
inevitably opens small disocclusion gaps (places the shift revealed that
weren't visible in the mono source) — these are filled by the already-loaded
LaMa model if stage 2 ran, or a fast directional nearest-neighbor clone fill
otherwise.

Output is a **top/bottom (over/under)** stacked equirectangular stereo
image at the source's width and 2x its height — the standard layout most
360 VR players auto-detect or can be told to expect. The filename gets a
`_TB` suffix so a player without embedded metadata still has a hint. Adding
proper [Google Spatial Media](https://github.com/google/spatial-media) XMP
metadata (so players detect the layout automatically, with zero naming
convention needed) is a natural follow-up, not implemented in v1.

The left/right eye shift-sign convention (which eye shifts which direction)
is a best-effort physical derivation, not something verified against a real
headset in this environment — if a rendered pair reads as pseudoscopic
(depth feels inside-out), the fix is a one-line sign flip in
`js/ai/stereoSynthesis.js`.

## How the traditional pipeline (stage 1) works

Equirectangular panoramas aren't ordinary photos: column 0 and the last
column are the same seam on the sphere, the top/bottom rows are a single
point stretched across the full width (the zenith/nadir), and many are
machine-stitched with visible seams. A generic photo filter gets all of this
wrong, so every stage below is built around those constraints:

1. **Analyze** (Web Worker, off the main thread) — luminance histogram,
   mean/stddev, a 1st/99th-percentile dynamic-range estimate, a noise
   estimate (Laplacian variance restricted to low-gradient/"flat" regions
   so texture isn't mistaken for noise), gray-world color averages, and a
   left/right edge-column color comparison for seam detection. Produces the
   adaptive parameters every later stage uses — nothing is a fixed constant.
2. **Denoise** — a small joint-bilateral (edge-preserving) filter, blended
   in proportional to the estimated noise level. Clean sources get little to
   none.
3. **Auto white balance** — gray-world per-channel gain, clamped to a modest
   range so it corrects casts without overcorrecting intentional color.
4. **Local contrast** — a GPU-efficient stand-in for tiled CLAHE: a
   large-radius low-pass of the image (via a downsample → small-kernel blur
   → upsample chain, which is much cheaper than a literal huge Gaussian
   kernel) approximates the "local average" a tile histogram would give.
   The high-frequency residual (detail vs. that local average) is boosted in
   luminance only, in YCbCr-equivalent space, so hue/saturation aren't
   disturbed. This is deliberately an approximation of true tiled CLAHE,
   chosen so the whole stage is two cheap blur passes instead of a
   multi-pass tiled-histogram compute pipeline.
5. **Latitude-aware sharpening** — an unsharp mask, attenuated toward the
   poles by a `cos`-like falloff so pole-region stitching noise doesn't get
   amplified. All horizontal sampling (here and everywhere else) uses `REPEAT`
   texture wrapping, so the kernel reads across the left/right seam correctly
   instead of clamping — no seam artifact from filtering.
6. **Pole cleanup** — an extra blend toward a blurred version, masked to
   only the top/bottom ~6% of rows, to tame stitching noise at the
   zenith/nadir without softening the rest of the image.
7. **Seam blend** — if the analysis stage found a brightness/color mismatch
   between the leftmost and rightmost columns (typical of stitched sources),
   a small corrective gradient is blended across a narrow band on each edge.
8. **Saturation/vibrance** — a modest, vibrance-style boost (larger effect
   on already-desaturated pixels, near-zero on already-vivid ones), capped
   conservatively — oversaturation reads much worse a few inches from your
   eyes in a headset than it does on a monitor.
9. **Upscale** — if the working resolution is below a VR-comfortable floor
   (4096px wide), a bicubic (Catmull-Rom) shader pass upscales toward
   6144px wide. Skipped entirely for already-high-res sources.
10. **Encode** — read back from the GPU and encode via `canvas.toBlob`
    (JPEG ~94, or PNG/WebP to match the source format).

All per-pixel work runs as WebGL2 fragment shaders operating on ping-ponged
framebuffers; textures use `REPEAT` wrap horizontally and `CLAMP_TO_EDGE`
vertically, which is what makes wrap-aware filtering and pole-safe filtering
fall out of ordinary texture sampling instead of needing manual seam math in
every shader. Large panoramas are capped to at most 8192×4096 (and further
capped to the device's actual `MAX_TEXTURE_SIZE` if lower) before entering
the pipeline, so big files don't crash the tab.

## Editor Mode (Phase 3)

An opt-in "Editor Mode" tab appears alongside the flat before/after and 360°
tabs once a result exists. It's layered on top of whatever Stage 1/2/3/4
combination you ran — opening it never discards or re-runs the auto/AI
pipeline, and leaving it off keeps the app behaving exactly as it always has.

**Manual sliders** (Exposure, Contrast, Highlights, Shadows, Temperature,
Tint, Saturation, Sharpening, Denoise) are real-time WebGL2 shader uniforms
(`editorTone` in `js/shaders/shaders.js`, plus the existing bilateral-denoise
and latitude-aware sharpen passes reused from stage 1) — dragging them never
re-runs the traditional pipeline. Contrast/Sharpening/Denoise/Saturation seed
to the *auto-computed* strength from stage 1's analysis, shown as an "auto"
tag, so the slider reflects what already happened instead of opening at a
misleading 0 — internally this is tracked as a slider position representing
zero *additional* change, so leaving it untouched doesn't double-apply the
effect that's already baked into the image. Exposure/Highlights/Shadows/
Temperature/Tint have no auto equivalent and start neutral. **Recenter**
rolls the panorama horizontally (wrap-around, no reprojection) via the same
shader pass. **Reset to auto** restores the stage 1/2/3/4 output and its
seeded sliders; **Reset to original** goes back to the untouched upload with
all sliders neutral.

**AI-assisted region tools** (toolbar above the preview) reuse the exact
Phase 2 models, aimed at a user-picked spot instead of the whole panorama:

- **Brush Select** / **Lasso Select** — paint or trace an arbitrary region,
  confirm to run LaMa inpainting scoped to a padded crop around just that
  region (not a full-image pass).
- **Depth Smart-Select** — click a point; a 4-connected flood fill over the
  cached depth map (wrap-aware on x, clamped at the poles) grows the
  selection to everything at a similar distance, then feeds the same LaMa
  removal as Brush/Lasso.
- **Regional Detail Boost** — drag a rectangle; Real-ESRGAN runs on just that
  padded crop (capped to 768px on the long side before upscaling) and the
  result is resized back to the original footprint and feather-composited
  in — much lighter than stage 3's full-panorama tiling pass.

All three crop/composite through `wrapAwareCrop`/`drawWrapAwareBack`
(`js/ai/tensorUtils.js`), so selections straddling the left/right seam are
handled the same way stage 3's tiling already handles it. Before any
AI-assisted action runs, current slider adjustments are "baked" into a new
base image first (mirroring how stage 2/3/4 already chain off each other's
output), and the depth map is cached (`computeDepthMap` in
`js/ai/depthAnything.js`) and rolled in sync with a baked Recenter shift, so
Smart Select and the depth viewer stay aligned without recomputing depth
per action.

**Analysis panel**: an RGB + luminance histogram and a per-latitude average
brightness graph (useful for spotting pole exposure/stitching mismatches a
pooled histogram can't show), both computed off a small downsampled proxy in
a Web Worker (`js/editor/histogramWorker.js`) and debounced so they never
compete with the live preview. A depth-map toggle exposes the same depth
data used by Smart Select as a diagnostic overlay. If stage 4 (Generate VR
3D) ran, a Stereo Depth Strength slider re-synthesizes the stereo pair on
demand from the current edited image.

The download button always reflects the full current combination — auto
pipeline + any AI stages + any manual/AI-assisted edits — rebuilding the
export at full resolution (and re-synthesizing the stereo pair if
applicable) at click time rather than reusing a stale blob from the original
run.

## File structure

- `index.html`, `styles.css` — layout and styling.
- `js/app.js` — UI wiring and staged pipeline orchestration (checkbox state
  → which stages run, in order, on each other's output).
- `js/analysisWorker.js` — Web Worker: histogram/noise/white-balance/seam
  stats on a downsampled copy of the image (stage 1 only).
- `js/glPipeline.js` — WebGL2 program/framebuffer management and the
  stage-1 (traditional) enhancement pipeline.
- `js/shaders/shaders.js` — all GLSL ES 3.00 fragment shader sources.
- `js/panoramaViewer.js` — Three.js sphere-mapped 360° viewer (drag to look
  around, scroll/pinch to zoom, toggle original/enhanced, anaglyph preview).
- `js/compareSlider.js` — the flat before/after drag slider.
- `js/ai/onnxRuntimeSetup.js` — shared onnxruntime-web loader (CDN import,
  WebGPU-then-WASM session creation, Cache-API model download+cache with
  progress reporting).
- `js/ai/tensorUtils.js` — canvas ⇄ ONNX tensor conversion helpers shared by
  all three AI stages.
- `js/ai/lamaInpaint.js` — stage 2: nadir mask generation, crop/inpaint/
  feather-composite, plus the low-level `inpaintTile` primitive reused by
  stage 4's gap-fill.
- `js/ai/realesrganUpscale.js` — stage 3: wrap-aware, pole-blended tiled
  4x upscale.
- `js/ai/depthAnything.js` — stage 4a: depth estimation, plus the shared
  `computeDepthMap`/cache used by both stage 4 and Editor Mode.
- `js/ai/stereoSynthesis.js` — stage 4b: depth → left/right eye synthesis,
  disocclusion gap-fill, top/bottom composite.
- `js/editor/editorPanel.js` — Editor Mode orchestrator: slider state,
  GLPipeline editor-chain rendering, tool/pointer handling, AI-assisted
  action wiring.
- `js/editor/histogram.js` / `histogramWorker.js` — proxy-resolution RGB/
  luminance histogram + stats, debounced.
- `js/editor/latitudeGraph.js` — per-latitude average brightness graph.
- `js/editor/manualMask.js` — brush/lasso mask drawing (seam-wrap-aware).
- `js/editor/smartSelect.js` — depth-based flood-fill region growing, plus
  the depth-map roll helper used to keep depth aligned after a baked
  Recenter shift.
- `js/editor/regionalUpscale.js` — cropped, wrap-aware Real-ESRGAN regional
  detail boost.

## Limitations

- Local contrast enhancement is a multi-scale unsharp-mask approximation of
  tiled CLAHE, not a literal per-tile histogram equalization — chosen for
  GPU efficiency; visually similar but not pixel-identical to reference
  CLAHE implementations.
- Non-2:1 source images are processed best-effort with a note in the
  summary; pole handling assumes a true equirectangular projection.
- The traditional pipeline's own upscale (stage 1, step 9) is bicubic; when
  stage 3 (AI Detail Boost) is enabled it fully replaces that step with a
  genuine neural upscale instead.
- Working resolution — and therefore output resolution when upscaling — is
  capped by the browser's WebGL `MAX_TEXTURE_SIZE`, which varies by device.
- **AI stage performance varies enormously by device.** WebGPU is used when
  available; otherwise everything falls back to single-threaded WASM (no
  COOP/COEP on GitHub Pages rules out multi-threading), which can take
  anywhere from several seconds to well over a minute per stage on a full
  8K panorama on CPU-only hardware. The UI shows live per-stage status so
  this doesn't look frozen, but there's no getting around the underlying
  cost of running real neural nets client-side without a GPU.
- Stage 2's nadir mask is a simple heuristic (a fixed-size circle at bottom-
  center) — it doesn't detect the tripod, it just assumes it's there. On
  panoramas without a nadir obstruction this stage is a harmless no-op-ish
  smoothing over an already-fine area; on panoramas with unusual nadir
  content it may remove something that should have stayed.
- Stage 4's stereo disparity, gap-fill, and left/right sign convention are
  all best-effort implementations that couldn't be verified against a real
  VR headset in this development environment — see the stage 4 section
  above for the specific assumptions and how to correct the sign convention
  if a rendered pair looks pseudoscopic.
- Real-ESRGAN tiling (stage 3) currently does a hard paste of each tile's
  core region rather than an additional cross-tile feather blend; the
  overlap-and-discard-padding technique it uses is usually sufficient to
  avoid visible seams, but very high-frequency detail right at a tile
  boundary could in principle still show a faint seam.
