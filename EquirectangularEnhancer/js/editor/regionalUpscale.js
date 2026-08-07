// Regional AI detail boost: run Real-ESRGAN on just the user's selected
// rectangle instead of tiling the whole panorama, then composite the
// boosted patch back in. Much lighter than Phase 2's full-image pass — this
// is meant to feel closer to instant, scoped-selection AI, not a full run.
import { wrapAwareCrop, drawWrapAwareBack, resizeToCanvas } from "../ai/tensorUtils.js";
import * as esrgan from "../ai/realesrganUpscale.js";

const MAX_CROP_DIM = 768; // cap fed to the model — regional boost targets small areas, not whole-image work

export async function boostRegion(baseCanvas, rect, { sessionInfo, onTileProgress, featherFraction = 0.1 } = {}) {
  const w = baseCanvas.width, h = baseCanvas.height;
  const rw = Math.min(rect.width, w);
  const rh = Math.min(rect.height, h);
  const y = Math.max(0, Math.min(h - rh, rect.y));

  const pad = Math.round(Math.max(rw, rh) * featherFraction);
  const cropX = rect.x - pad;
  const cropY = Math.max(0, y - pad);
  const cropW = Math.min(w, rw + pad * 2);
  const cropH = Math.min(h, y + rh + pad) - cropY;

  let crop = wrapAwareCrop(baseCanvas, w, h, cropX, cropY, cropW, cropH);
  if (Math.max(cropW, cropH) > MAX_CROP_DIM) {
    const scale = MAX_CROP_DIM / Math.max(cropW, cropH);
    crop = resizeToCanvas(crop, Math.round(cropW * scale), Math.round(cropH * scale));
  }

  const upscaled = await esrgan.upscaleRealEsrgan(crop, sessionInfo, { onTileProgress });

  // Resize the AI-reconstructed detail back down to the original footprint —
  // this still recovers real detail vs. the original pixels without growing
  // the panorama's overall resolution the way a full boost would.
  const backToFootprint = resizeToCanvas(upscaled, cropW, cropH);

  const feathered = document.createElement("canvas");
  feathered.width = cropW;
  feathered.height = cropH;
  const fctx = feathered.getContext("2d");
  const grad = fctx.createRadialGradient(
    cropW / 2, cropH / 2, Math.min(cropW, cropH) * 0.32,
    cropW / 2, cropH / 2, Math.max(cropW, cropH) * 0.62
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  fctx.fillStyle = grad;
  fctx.fillRect(0, 0, cropW, cropH);
  fctx.globalCompositeOperation = "source-in";
  fctx.drawImage(backToFootprint, 0, 0);

  const result = document.createElement("canvas");
  result.width = w;
  result.height = h;
  result.getContext("2d").drawImage(baseCanvas, 0, 0);
  drawWrapAwareBack(result, feathered, cropX, cropY);
  return result;
}
