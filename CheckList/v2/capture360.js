/* ===================== GUIDED 360 CAPTURE =====================
   Full-screen guided panorama capture. A single canvas overlay paints a
   gray mask over the live camera with a circular "peephole" at the
   reticle for aiming; each captured shot is drawn back onto that canvas,
   world-locked via the same device-orientation math used for alignment,
   so it visually "fills in" the gray as you go (Photo-Sphere style) and
   stays put as you keep rotating. Only one target is active at a time —
   the rest of the pattern isn't shown until you get there.

   Produces N source photos with yaw/pitch/roll metadata, saved to
   IndexedDB progressively (so backgrounding/losing the camera mid session
   never loses an already-captured shot), then hands them to
   pano-stitch-worker.js. If stitching isn't available on this device the
   sources are still kept and the caller is told so explicitly — this
   module never discards a capture just because the final stitch failed.
*/
(function (global) {
  'use strict';

  const O = global.LSCOrientation;
  const DEG = Math.PI / 180;

  // 8 horizon + 8 upper ring + 8 lower ring + zenith + nadir = 26.
  // At the assumed 68deg horizontal FOV, 45deg ring spacing gives real
  // overlap (previously the upper/lower rings used 4 shots at 90deg
  // spacing, which is a ~22deg GAP, not overlap, at that FOV).
  function buildTargetPattern() {
    const t = [];
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: 0 });
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: 35 });
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: -35 });
    t.push({ yaw: 0, pitch: 80 });
    t.push({ yaw: 0, pitch: -80 });
    return t.map(x => ({ yaw: x.yaw * DEG, pitch: x.pitch * DEG }));
  }

  const ALIGN_TOLERANCE_DEG = 5;
  const STABLE_MS = 550;
  const ASSUMED_H_FOV_DEG = 68; // fallback only — pano-refine-worker.js calibrates the real value from the photos

  // ---- pose refinement (pano-refine-worker.js) ----
  // Refinement is advisory: if anything about it fails we stitch exactly as
  // before, from raw sensor pose and the assumed FOV. It must never be able
  // to cost the user a capture.
  const REFINE_PREF_KEY = 'lsc2_pano_refine';
  const REFINE_MAX_SIDE = 640;    // XFeat is trained around VGA; larger costs time for little gain
  const REFINE_TIMEOUT_MS = 240000;

  function refineEnabled() {
    try { return localStorage.getItem(REFINE_PREF_KEY) !== '0'; }
    catch (e) { return true; }
  }
  function setRefineEnabled(on) {
    try { localStorage.setItem(REFINE_PREF_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
  }
  const ASSUMED_ASPECT = 9 / 16; // height/width used only to size the on-screen patch footprint
  const GUIDE_FOV_DEG = 78; // wider virtual FOV used for placing the reticle/target/patches on screen
  const MAX_BLUR_RETRIES = 2; // low-texture scenes (blank walls/ceilings) read as "blurry" too — don't loop forever
  const SHARPNESS_MIN = 12; // conservative: only rejects genuinely motion-blurred frames

  function basisForOrientation(yaw, pitch, roll) {
    const forward = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.cos(yaw) * Math.cos(pitch), z: Math.sin(pitch) };
    const worldUp = { x: 0, y: 0, z: 1 };
    const right0 = Math.abs(forward.z) > 0.999 ? { x: 1, y: 0, z: 0 } : O.normalize(O.cross(forward, worldUp));
    const up0 = O.normalize(O.cross(right0, forward));
    const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    const right = O.normalize({ x: right0.x * cr - up0.x * sr, y: right0.y * cr - up0.y * sr, z: right0.z * cr - up0.z * sr });
    const up = O.normalize({ x: up0.x * cr + right0.x * sr, y: up0.y * cr + right0.y * sr, z: up0.z * cr + right0.z * sr });
    return { forward, right, up };
  }

  function angularDist(a, b) {
    const d = O.dot(vecFromYawPitch(a.yaw, a.pitch), vecFromYawPitch(b.yaw, b.pitch));
    return Math.acos(Math.max(-1, Math.min(1, d)));
  }
  function vecFromYawPitch(yaw, pitch) {
    return { x: Math.sin(yaw) * Math.cos(pitch), y: Math.cos(yaw) * Math.cos(pitch), z: Math.sin(pitch) };
  }

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'capture360-overlay';
    overlay.innerHTML = `
      <video class="c360-video" autoplay playsinline muted></video>
      <canvas class="c360-canvas"></canvas>
      <div class="c360-scrim c360-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> <span>Starting camera…</span></div>
      <div class="c360-hud" hidden>
        <div class="c360-topbar">
          <button type="button" class="tbtn tbtn--sm c360-cancel"><i class="fa-solid fa-xmark"></i> Cancel</button>
          <div class="c360-counter">Photos: <span class="c360-count">0</span> / <span class="c360-total">26</span></div>
          <label class="c360-enhance" title="Corrects lens FOV, pose drift and exposure on-device before stitching. Slower, but much sharper seams.">
            <input type="checkbox" class="c360-enhance-input"> Enhance
          </label>
        </div>
        <div class="c360-instruction">Move the phone until the circles align.</div>
        <div class="c360-progress-track"><div class="c360-progress-fill"></div></div>
        <div class="c360-controls">
          <button type="button" class="tbtn c360-finish" hidden>Finish</button>
          <button type="button" class="tbtn tbtn--primary c360-capture"><i class="fa-solid fa-camera"></i> Capture</button>
        </div>
      </div>
      <div class="c360-error" hidden>
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p class="c360-error-msg"></p>
        <button type="button" class="tbtn tbtn--primary c360-error-close">Close</button>
      </div>
      <div class="c360-stitching" hidden>
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <div class="c360-stitch-stage">Preparing images</div>
        <div class="c360-progress-track"><div class="c360-progress-fill c360-stitch-fill"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        return res === 'granted';
      } catch (e) { return false; }
    }
    return 'DeviceOrientationEvent' in window; // Android etc. — no explicit permission step, just feature detection
  }

  function screenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    if (typeof window.orientation === 'number') return window.orientation;
    return 0;
  }

  function chooseOutputSize() {
    const mem = navigator.deviceMemory;
    if (mem && mem <= 3) return { width: 2048, height: 1024 };
    if (mem && mem >= 8) return { width: 4096, height: 2048, allowHigh: true };
    return { width: 4096, height: 2048 };
  }

  // Laplacian-variance sharpness score on a small downsample. Low-texture
  // scenes (blank walls/ceilings) also score low here — this only guards
  // against genuinely motion-blurred frames, and gives up after a couple
  // of retries rather than trapping the user on a plain surface.
  function sharpnessScore(sourceCanvas) {
    const w = 160, h = Math.round(160 * sourceCanvas.height / sourceCanvas.width) || 90;
    const small = document.createElement('canvas');
    small.width = w; small.height = h;
    const sctx = small.getContext('2d');
    sctx.drawImage(sourceCanvas, 0, 0, w, h);
    const data = sctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    let sum = 0, sumSq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const lap = gray[idx - 1] + gray[idx + 1] + gray[idx - w] + gray[idx + w] - 4 * gray[idx];
        sum += lap; sumSq += lap * lap; n++;
      }
    }
    const mean = sum / n;
    return sumSq / n - mean * mean;
  }

  function makeThumbnail(sourceCanvas, maxDim) {
    const scale = Math.min(1, maxDim / Math.max(sourceCanvas.width, sourceCanvas.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    c.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    c.getContext('2d').drawImage(sourceCanvas, 0, 0, c.width, c.height);
    return c;
  }

  // Coarse coverage check (a yaw/pitch grid) so "Finish Early" can warn
  // about real spherical gaps, not just a raw shot count.
  function computeCoverageGapPct(targets, captured) {
    const hFov = ASSUMED_H_FOV_DEG * DEG, vFov = 2 * Math.atan(Math.tan(hFov / 2) * ASSUMED_ASPECT);
    const cones = targets.filter((t, i) => captured[i]).map(t => basisForOrientation(t.yaw, t.pitch, 0));
    const tanH = Math.tan(hFov / 2), tanV = Math.tan(vFov / 2);
    let total = 0, covered = 0;
    for (let yawStep = 0; yawStep < 24; yawStep++) {
      const yaw = (yawStep / 24) * 2 * Math.PI - Math.PI;
      for (let pitchStep = 0; pitchStep < 12; pitchStep++) {
        const pitch = (pitchStep / 11) * Math.PI - Math.PI / 2;
        total++;
        const vec = vecFromYawPitch(yaw, pitch);
        const hit = cones.some(basis => {
          const lz = O.dot(vec, basis.forward);
          if (lz <= 0.05) return false;
          const lx = O.dot(vec, basis.right), ly = O.dot(vec, basis.up);
          return Math.abs((lx / lz) / tanH) <= 1 && Math.abs((ly / lz) / tanV) <= 1;
        });
        if (hit) covered++;
      }
    }
    return Math.round((1 - covered / total) * 100);
  }

  /**
   * opts: { locationId, toast(msg,kind), confirm({title,body,confirmText,danger}) -> Promise<boolean> }
   * Returns a Promise resolving to:
   *   { cancelled:true } |
   *   { stitched:true, panoramaMediaId, sessionId, sourceCount } |
   *   { stitched:false, sessionId, sourceCount, reason }
   */
  function start(opts) {
    return new Promise(resolve => {
      const { locationId, toast, confirm } = opts;
      const sessionId = 'pano_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const overlay = buildOverlay();
      const video = overlay.querySelector('.c360-video');
      const canvas = overlay.querySelector('.c360-canvas');
      const ctx = canvas.getContext('2d');
      const loading = overlay.querySelector('.c360-loading');
      const hud = overlay.querySelector('.c360-hud');
      const errorPanel = overlay.querySelector('.c360-error');
      const stitchingPanel = overlay.querySelector('.c360-stitching');
      const countEl = overlay.querySelector('.c360-count');
      const totalEl = overlay.querySelector('.c360-total');
      const progressFill = overlay.querySelector('.c360-progress-fill');
      const finishBtn = overlay.querySelector('.c360-finish');
      const captureBtn = overlay.querySelector('.c360-capture');
      const instruction = overlay.querySelector('.c360-instruction');
      const enhanceInput = overlay.querySelector('.c360-enhance-input');
      enhanceInput.checked = refineEnabled();
      enhanceInput.addEventListener('change', () => setRefineEnabled(enhanceInput.checked));

      const targets = buildTargetPattern();
      totalEl.textContent = String(targets.length);
      const captured = new Array(targets.length).fill(false);
      const capturedPatches = []; // { yaw, pitch, canvas }
      const sourceMediaIds = [];
      let activeIndex = 0;
      let blurRetries = 0;
      let stream = null;
      let finished = false;
      let currentYaw = 0, currentPitch = 0, currentRoll = 0;
      let hasOrientation = false;
      let startYaw = null;
      let stableSince = null;
      let lastReading = null;
      let rafId = null;
      let orientationHandler = null;
      let capturingInFlight = false;
      let canvasW = 0, canvasH = 0, dpr = 1;
      let alignedNow = false;

      function finishAndClose(result) {
        if (finished) return;
        finished = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (orientationHandler) window.removeEventListener('deviceorientation', orientationHandler);
        window.removeEventListener('resize', resizeCanvas);
        if (stream) stream.getTracks().forEach(t => t.stop());
        overlay.remove();
        resolve(result);
      }

      function showError(message) {
        loading.hidden = true;
        hud.hidden = true;
        errorPanel.hidden = false;
        errorPanel.querySelector('.c360-error-msg').textContent = message;
      }
      overlay.querySelector('.c360-error-close').addEventListener('click', () => finishAndClose({ cancelled: true }));

      overlay.querySelector('.c360-cancel').addEventListener('click', async () => {
        if (sourceMediaIds.length) {
          const ok = await confirm({
            title: 'Cancel 360° Capture',
            body: `Discard the ${sourceMediaIds.length} photo(s) captured so far?`,
            confirmText: 'Discard', danger: true
          });
          if (!ok) return;
          await global.LSCMedia.deleteMany(sourceMediaIds);
        }
        finishAndClose({ cancelled: true });
      });

      document.addEventListener('visibilitychange', function onVis() {
        if (document.hidden) return;
        if (finished) { document.removeEventListener('visibilitychange', onVis); return; }
        const track = stream && stream.getVideoTracks()[0];
        if (track && track.readyState === 'ended') {
          toast('Camera was interrupted — captured photos were kept. Reopen 360° capture to continue.', 'error');
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'camera-interrupted' });
        }
      });

      function resizeCanvas() {
        dpr = window.devicePixelRatio || 1;
        canvasW = overlay.clientWidth; canvasH = overlay.clientHeight;
        canvas.width = Math.round(canvasW * dpr);
        canvas.height = Math.round(canvasH * dpr);
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
      }
      window.addEventListener('resize', resizeCanvas);

      function project(yaw, pitch, right, up, fwd, tanGuide) {
        const vec = vecFromYawPitch(yaw, pitch);
        const lx = O.dot(vec, right), ly = O.dot(vec, up), lz = O.dot(vec, fwd);
        return { nx: (lx / lz) / tanGuide, ny: (ly / lz) / tanGuide, lz, lx };
      }

      function drawFrame() {
        if (!canvasW) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvasW, canvasH);

        const reticleX = canvasW / 2, reticleY = canvasH * 0.46;
        const holeR = Math.min(canvasW, canvasH) * 0.135;

        // gray mask with a circular peephole at the reticle for aiming
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvasW, canvasH);
        ctx.moveTo(reticleX + holeR, reticleY);
        ctx.arc(reticleX, reticleY, holeR, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(28,30,36,0.94)';
        ctx.fill('evenodd');
        ctx.restore();

        const { forward: fwd, right, up } = basisForOrientation(currentYaw, currentPitch, currentRoll);
        const tanGuide = Math.tan(GUIDE_FOV_DEG * DEG / 2);
        const unitPxW = canvasW * 0.42, unitPxH = canvasH * 0.42;
        const hFovRad = ASSUMED_H_FOV_DEG * DEG;
        const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) * ASSUMED_ASPECT);
        const patchHalfW0 = (Math.tan(hFovRad / 2) / tanGuide) * unitPxW;
        const patchHalfH0 = (Math.tan(vFovRad / 2) / tanGuide) * unitPxH;

        // already-captured shots, world-locked so they "fill in" the gray
        capturedPatches.forEach(p => {
          const proj = project(p.yaw, p.pitch, right, up, fwd, tanGuide);
          if (proj.lz <= 0.05 || Math.abs(proj.nx) > 1.35 || Math.abs(proj.ny) > 1.35) return;
          const scale = 1 / proj.lz;
          const halfW = patchHalfW0 * scale, halfH = patchHalfH0 * scale;
          const cx = canvasW / 2 + proj.nx * unitPxW, cy = canvasH / 2 - proj.ny * unitPxH;
          ctx.drawImage(p.canvas, cx - halfW, cy - halfH, halfW * 2, halfH * 2);
        });

        // the single active target
        if (activeIndex < targets.length) {
          const t = targets[activeIndex];
          const proj = project(t.yaw, t.pitch, right, up, fwd, tanGuide);
          ctx.save();
          if (proj.lz > 0.05 && Math.abs(proj.nx) <= 1.1 && Math.abs(proj.ny) <= 1.1) {
            const tx = canvasW / 2 + proj.nx * unitPxW, ty = canvasH / 2 - proj.ny * unitPxH;
            ctx.beginPath();
            ctx.arc(tx, ty, 22, 0, Math.PI * 2);
            ctx.fillStyle = alignedNow ? 'rgba(245,166,35,0.9)' : 'rgba(245,166,35,0.55)';
            ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
          } else {
            const dir = proj.lx > 0 || proj.lz <= 0.05 ? 1 : -1;
            const ax = canvasW / 2 + dir * canvasW * 0.38, ay = reticleY;
            ctx.beginPath();
            ctx.moveTo(ax - dir * 14, ay - 12); ctx.lineTo(ax + dir * 10, ay); ctx.lineTo(ax - dir * 14, ay + 12);
            ctx.closePath();
            ctx.fillStyle = 'rgba(245,166,35,0.9)';
            ctx.fill();
          }
          ctx.restore();
        }

        // reticle ring (the fixed aim point)
        ctx.beginPath();
        ctx.arc(reticleX, reticleY, holeR, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = alignedNow ? '#f5a623' : 'rgba(255,255,255,0.85)';
        ctx.stroke();
      }

      function updateGuidance() {
        drawFrame();
        countEl.textContent = String(captured.filter(Boolean).length);
        progressFill.style.width = (captured.filter(Boolean).length / targets.length * 100) + '%';

        if (activeIndex >= targets.length) { instruction.textContent = 'All targets captured — tap Finish.'; alignedNow = false; return; }
        if (!hasOrientation) {
          instruction.textContent = 'Orientation not available — use Capture to shoot each angle manually.';
          alignedNow = false;
          return;
        }
        const dist = angularDist(targets[activeIndex], { yaw: currentYaw, pitch: currentPitch }) / DEG;
        alignedNow = dist < ALIGN_TOLERANCE_DEG;
        instruction.textContent = alignedNow ? 'Hold steady…' : 'Move the phone until the circles align.';

        if (alignedNow) {
          const moved = lastReading && (Math.abs(currentYaw - lastReading.yaw) / DEG > 1.2 || Math.abs(currentPitch - lastReading.pitch) / DEG > 1.2);
          if (moved || stableSince === null) stableSince = performance.now();
          if (performance.now() - stableSince > STABLE_MS) {
            captureAt(activeIndex, true);
            stableSince = null;
          }
        } else {
          stableSince = null;
        }
        lastReading = { yaw: currentYaw, pitch: currentPitch };
      }

      function loop() {
        if (finished) return;
        updateGuidance();
        rafId = requestAnimationFrame(loop);
      }

      async function grabStillFrame() {
        const track = stream.getVideoTracks()[0];
        if (typeof ImageCapture !== 'undefined' && track) {
          const ic = new ImageCapture(track);
          if (typeof ic.takePhoto === 'function') {
            try {
              const blob = await ic.takePhoto();
              const bmp = await createImageBitmap(blob);
              return bmp;
            } catch (e) { /* fall through to grabFrame */ }
          }
          try {
            const bmp = await ic.grabFrame();
            return bmp;
          } catch (e) { /* fall through to video draw */ }
        }
        return null;
      }

      async function captureAt(targetIdx, auto) {
        if (finished || capturingInFlight || (auto && captured[targetIdx])) return;
        capturingInFlight = true;
        try {
          // Snapshot orientation together with the frame grab, before any
          // further await — reading it later means the saved metadata could
          // reflect wherever the phone had moved to by the time encoding
          // finished, desyncing the photo from its recorded direction.
          const capturedYaw = currentYaw, capturedPitch = currentPitch, capturedRoll = currentRoll;
          const bitmap = await grabStillFrame().catch(() => null);

          const shotCanvas = document.createElement('canvas');
          shotCanvas.width = bitmap ? bitmap.width : video.videoWidth;
          shotCanvas.height = bitmap ? bitmap.height : video.videoHeight;
          const sctx = shotCanvas.getContext('2d');
          if (bitmap) { sctx.drawImage(bitmap, 0, 0); bitmap.close && bitmap.close(); }
          else sctx.drawImage(video, 0, 0, shotCanvas.width, shotCanvas.height);

          if (sharpnessScore(shotCanvas) < SHARPNESS_MIN && blurRetries < MAX_BLUR_RETRIES) {
            blurRetries++;
            instruction.textContent = 'That was blurry — hold steadier and it will retry automatically.';
            return;
          }
          blurRetries = 0;

          const blob = await new Promise(res => shotCanvas.toBlob(res, 'image/jpeg', 0.95));
          if (!blob) { toast('Could not capture that frame — try again', 'error'); return; }

          const order = sourceMediaIds.length + 1;
          const t = targets[targetIdx];
          try {
            const id = await global.LSCMedia.putMedia({
              locationId, category: 'panorama-360-source', sessionId,
              filename: `source_${String(order).padStart(3, '0')}_yaw${Math.round(t.yaw / DEG + 360) % 360}_pitch${Math.round(t.pitch / DEG)}.jpg`,
              mime: 'image/jpeg', originalFilename: null,
              width: shotCanvas.width, height: shotCanvas.height,
              order, yaw: hasOrientation ? capturedYaw : t.yaw, pitch: hasOrientation ? capturedPitch : t.pitch, roll: hasOrientation ? capturedRoll : 0,
              blob
            });
            sourceMediaIds.push(id);
            captured[targetIdx] = true;
            capturedPatches.push({ yaw: hasOrientation ? capturedYaw : t.yaw, pitch: hasOrientation ? capturedPitch : t.pitch, canvas: makeThumbnail(shotCanvas, 480) });
            if (targetIdx === activeIndex) {
              let next = activeIndex + 1;
              while (next < targets.length && captured[next]) next++;
              activeIndex = next;
            }
          } catch (e) {
            toast('Could not save that photo (storage may be full)', 'error');
            return;
          }

          if (captured.every(Boolean)) {
            finishBtn.hidden = false;
            captureBtn.hidden = true;
            instruction.textContent = `All ${targets.length} targets captured — tap Finish to build the panorama.`;
          } else if (sourceMediaIds.length >= 6) {
            finishBtn.hidden = false;
          }
        } finally {
          capturingInFlight = false;
        }
      }

      captureBtn.addEventListener('click', () => {
        if (activeIndex < targets.length) captureAt(activeIndex, false);
      });

      finishBtn.addEventListener('click', async () => {
        const total = captured.filter(Boolean).length;
        if (total < targets.length) {
          const gapPct = computeCoverageGapPct(targets, captured);
          const ok = await confirm({
            title: 'Finish Early?',
            body: gapPct > 5
              ? `About ${gapPct}% of the sphere has no coverage yet — those areas will look smeared in the panorama. Continue anyway?`
              : `${total} of ${targets.length} angles were captured, but coverage looks close to complete. Continue?`,
            confirmText: 'Build Panorama'
          });
          if (!ok) return;
        }
        runStitchPhase();
      });

      // Source records, in capture order, read back once and shared by the
      // refinement and stitch phases.
      async function loadSourceRecords() {
        const recs = [];
        for (const id of sourceMediaIds) {
          const rec = await global.LSCMedia.getMedia(id);
          if (rec && rec.blob) recs.push(rec);
        }
        return recs;
      }

      /* Runs pano-refine-worker.js. Resolves to
         { byId, hFovDeg, diagnostics } or NULL, and null always means
         "stitch exactly the way this app did before refinement existed".
         Every failure path — no worker support, module worker rejected,
         model fetch failure, implausible solution, timeout — funnels to
         null rather than an error, because a refinement problem must never
         cost the user their 26 photos. */
      function runRefinement(records, onProgress) {
        return new Promise(resolve => {
          if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') { resolve(null); return; }

          const order = [];
          const images = [];
          let worker = null;
          let settled = false;
          let timer = null;

          const finish = (value) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            try { if (worker) worker.terminate(); } catch (e) { /* ignore */ }
            // Anything still untransferred has to be released explicitly.
            for (const im of images) { try { im.bitmap.close && im.bitmap.close(); } catch (e) { /* ignore */ } }
            resolve(value);
          };

          try { worker = new Worker('pano-refine-worker.js', { type: 'module' }); }
          catch (e) { finish(null); return; }

          timer = setTimeout(() => finish(null), REFINE_TIMEOUT_MS);

          worker.onmessage = (e) => {
            const msg = e.data;
            if (!msg) return;
            if (msg.type === 'progress') { onProgress(msg.stage, msg.pct); return; }
            if (msg.type === 'result' && Array.isArray(msg.poses)) {
              const byId = new Map();
              for (let k = 0; k < order.length && k < msg.poses.length; k++) {
                const pose = msg.poses[k];
                if (!pose || typeof pose.yaw !== 'number') continue;
                byId.set(order[k], {
                  yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll,
                  gain: (msg.gains && typeof msg.gains[k] === 'number') ? msg.gains[k] : 1
                });
              }
              if (!byId.size) { finish(null); return; }
              finish({ byId, hFovDeg: msg.hFovDeg, diagnostics: msg.diagnostics || null });
              return;
            }
            finish(null);   // 'skipped', 'error', or anything unexpected
          };
          worker.onerror = () => finish(null);

          (async () => {
            // Downscaled copies only. Geometry does not need full resolution,
            // and decoding 26 full frames twice is a real cost on a phone.
            for (const rec of records) {
              if (settled) return;
              let bmp = null;
              try {
                const w = rec.width || 0, h = rec.height || 0;
                if (w && h) {
                  const s = Math.min(1, REFINE_MAX_SIDE / Math.max(w, h));
                  bmp = await createImageBitmap(rec.blob, {
                    resizeWidth: Math.max(8, Math.round(w * s)),
                    resizeHeight: Math.max(8, Math.round(h * s)),
                    resizeQuality: 'medium'
                  });
                } else {
                  bmp = await createImageBitmap(rec.blob);
                }
              } catch (err) { bmp = null; }
              if (!bmp) continue;
              order.push(rec.id);
              images.push({
                bitmap: bmp, width: bmp.width, height: bmp.height,
                yaw: rec.yaw, pitch: rec.pitch, roll: rec.roll
              });
            }
            if (settled) return;
            if (images.length < 4) { finish(null); return; }
            try {
              worker.postMessage(
                { type: 'refine', images, options: { maxSide: REFINE_MAX_SIDE, nominalHFovDeg: ASSUMED_H_FOV_DEG } },
                images.map(i => i.bitmap)
              );
              images.length = 0;   // ownership transferred to the worker
            } catch (err) { finish(null); }
          })();
        });
      }

      async function runStitchPhase() {
        hud.hidden = true;
        stitchingPanel.hidden = false;
        const stageEl = stitchingPanel.querySelector('.c360-stitch-stage');
        const fillEl = stitchingPanel.querySelector('.c360-stitch-fill');
        const setProgress = (stage, pct) => {
          stageEl.textContent = stage;
          fillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
        };

        if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') {
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'unsupported' });
          return;
        }

        const records = await loadSourceRecords();
        if (!records.length) {
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'no-readable-sources' });
          return;
        }

        // Refinement, when it runs, owns the first 55% of the progress bar.
        let refinement = null;
        if (refineEnabled()) {
          refinement = await runRefinement(records, (stage, pct) => setProgress(stage, pct * 0.55));
        }
        const base = refinement ? 55 : 0;
        const span = refinement ? 45 : 100;
        setProgress('Preparing images', base);

        let worker;
        try { worker = new Worker('pano-stitch-worker.js'); }
        catch (e) { finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'unsupported' }); return; }

        const images = [];
        for (const rec of records) {
          try {
            const bmp = await createImageBitmap(rec.blob);
            const fix = refinement ? refinement.byId.get(rec.id) : null;
            images.push({
              bitmap: bmp, width: bmp.width, height: bmp.height,
              yaw: fix ? fix.yaw : rec.yaw,
              pitch: fix ? fix.pitch : rec.pitch,
              roll: fix ? fix.roll : rec.roll,
              gain: fix ? fix.gain : 1
            });
          } catch (e) { /* skip unreadable source */ }
        }
        if (!images.length) {
          worker.terminate();
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'no-readable-sources' });
          return;
        }

        const size = chooseOutputSize();
        const hFovDeg = refinement && refinement.hFovDeg ? refinement.hFovDeg : ASSUMED_H_FOV_DEG;
        const refineInfo = refinement
          ? Object.assign({ hFovDeg: refinement.hFovDeg }, refinement.diagnostics || {})
          : null;

        worker.onmessage = async (e) => {
          const msg = e.data;
          if (msg.type === 'progress') {
            setProgress(msg.stage, base + msg.pct * span / 100);
          } else if (msg.type === 'unsupported' || msg.type === 'error') {
            worker.terminate();
            finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: msg.type === 'unsupported' ? 'unsupported' : 'stitch-error' });
          } else if (msg.type === 'result') {
            worker.terminate();
            const imgData = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
            const canvas2 = document.createElement('canvas');
            canvas2.width = msg.width; canvas2.height = msg.height;
            canvas2.getContext('2d').putImageData(imgData, 0, 0);
            canvas2.toBlob(async blob => {
              if (!blob) { finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'encode-failed' }); return; }
              try {
                const panoId = await global.LSCMedia.putMedia({
                  locationId, category: 'panorama-360', sessionId,
                  filename: `panorama_${sessionId}.jpg`, mime: 'image/jpeg', originalFilename: null,
                  width: msg.width, height: msg.height, blob
                });
                finishAndClose({
                  stitched: true, panoramaMediaId: panoId, sessionId,
                  sourceCount: sourceMediaIds.length, refinement: refineInfo
                });
              } catch (err) {
                finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'storage-failed' });
              }
            }, 'image/jpeg', 0.92);
          }
        };
        worker.onerror = () => {
          worker.terminate();
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'stitch-error' });
        };
        worker.postMessage(
          { type: 'stitch', outputWidth: size.width, outputHeight: size.height, hFovDeg, images },
          images.map(i => i.bitmap)
        );
      }

      // ---- boot sequence: must stay synchronous-ish so the iOS permission
      // prompt is still tied to the tap that opened this overlay ----
      (async () => {
        hasOrientation = await requestOrientationPermission();
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
          });
        } catch (e) {
          showError(e && e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access to use guided 360° capture.' : 'No usable camera was found on this device.');
          return;
        }
        video.srcObject = stream;
        loading.hidden = true;
        hud.hidden = false;
        resizeCanvas();

        if (hasOrientation) {
          orientationHandler = (e) => {
            if (typeof e.alpha !== 'number') return;
            const q = O.orientationToQuaternion(e.alpha, e.beta, e.gamma, screenAngle());
            const reading = O.quaternionToYawPitchRoll(q, startYaw || 0);
            if (startYaw === null) { startYaw = reading.rawYaw; return; } // first reading only sets the yaw==0 baseline
            currentYaw = reading.yaw; currentPitch = reading.pitch; currentRoll = reading.roll;
          };
          window.addEventListener('deviceorientation', orientationHandler);
        } else {
          instruction.textContent = 'Orientation not available — use Capture to shoot each angle manually.';
        }

        loop();
      })();
    });
  }

  global.LSCCapture360 = { start, buildTargetPattern };
})(window);
