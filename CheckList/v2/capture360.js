/* ===================== GUIDED 360 CAPTURE =====================
   Full-screen guided panorama capture: live camera preview, aiming
   reticle, target markers, auto-capture on alignment + manual capture
   fallback. Produces N source photos with yaw/pitch/roll metadata, saved
   to IndexedDB progressively (so backgrounding/losing the camera mid
   session never loses an already-captured shot), then hands them to
   pano-stitch-worker.js. If stitching isn't available on this device the
   sources are still kept and the caller is told so explicitly — this
   module never discards a capture just because the final stitch failed.
*/
(function (global) {
  'use strict';

  const O = global.LSCOrientation;
  const DEG = Math.PI / 180;

  // 8 horizon + 4 upper ring + 4 lower ring + zenith + nadir = 18.
  // Change this array (and nothing else) to support a higher-coverage mode later.
  function buildTargetPattern() {
    const t = [];
    for (let i = 0; i < 8; i++) t.push({ yaw: i * 45, pitch: 0 });
    for (let i = 0; i < 4; i++) t.push({ yaw: 45 + i * 90, pitch: 45 });
    for (let i = 0; i < 4; i++) t.push({ yaw: 45 + i * 90, pitch: -45 });
    t.push({ yaw: 0, pitch: 85 });
    t.push({ yaw: 0, pitch: -85 });
    return t.map(x => ({ yaw: x.yaw * DEG, pitch: x.pitch * DEG }));
  }

  const ALIGN_TOLERANCE_DEG = 9;
  const STABLE_MS = 550;
  const ASSUMED_H_FOV_DEG = 68; // typical rear-camera horizontal FOV; see capture360 notes below
  const GUIDE_FOV_DEG = 78; // wider virtual FOV used only for placing on-screen target markers

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
      <div class="c360-scrim c360-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> <span>Starting camera…</span></div>
      <div class="c360-hud" hidden>
        <div class="c360-topbar">
          <button type="button" class="tbtn tbtn--sm c360-cancel"><i class="fa-solid fa-xmark"></i> Cancel</button>
          <div class="c360-counter">Photos: <span class="c360-count">0</span> / <span class="c360-total">18</span></div>
        </div>
        <div class="c360-targets"></div>
        <div class="c360-reticle"><div class="c360-reticle-ring"></div></div>
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
      const loading = overlay.querySelector('.c360-loading');
      const hud = overlay.querySelector('.c360-hud');
      const errorPanel = overlay.querySelector('.c360-error');
      const stitchingPanel = overlay.querySelector('.c360-stitching');
      const targetsEl = overlay.querySelector('.c360-targets');
      const reticle = overlay.querySelector('.c360-reticle');
      const countEl = overlay.querySelector('.c360-count');
      const progressFill = overlay.querySelector('.c360-progress-fill');
      const finishBtn = overlay.querySelector('.c360-finish');
      const captureBtn = overlay.querySelector('.c360-capture');
      const instruction = overlay.querySelector('.c360-instruction');

      const targets = buildTargetPattern();
      const captured = new Array(targets.length).fill(false);
      const sourceMediaIds = [];
      let stream = null;
      let finished = false;
      let currentYaw = 0, currentPitch = 0, currentRoll = 0;
      let hasOrientation = false;
      let startYaw = null;
      let stableSince = null;
      let lastReading = null;
      let rafId = null;
      let orientationHandler = null;

      function finishAndClose(result) {
        if (finished) return;
        finished = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (orientationHandler) {
          window.removeEventListener('deviceorientation', orientationHandler);
        }
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

      function renderTargets() {
        targetsEl.innerHTML = '';
        const tanGuide = Math.tan(GUIDE_FOV_DEG * DEG / 2);
        const { forward: fwd, right, up } = basisForOrientation(currentYaw, currentPitch, currentRoll);
        let nearestIdx = -1, nearestDist = Infinity;
        targets.forEach((t, i) => {
          if (!captured[i] && angularDist(t, { yaw: currentYaw, pitch: currentPitch }) < nearestDist) {
            nearestDist = angularDist(t, { yaw: currentYaw, pitch: currentPitch });
            nearestIdx = i;
          }
        });
        targets.forEach((t, i) => {
          const vec = vecFromYawPitch(t.yaw, t.pitch);
          const lx = O.dot(vec, right), ly = O.dot(vec, up), lz = O.dot(vec, fwd);
          const dot = document.createElement('div');
          dot.className = 'c360-target' + (captured[i] ? ' captured' : '') + (i === nearestIdx ? ' active' : '');
          if (lz > 0.05) {
            const nx = (lx / lz) / tanGuide, ny = (ly / lz) / tanGuide;
            if (Math.abs(nx) <= 1.1 && Math.abs(ny) <= 1.1) {
              dot.style.left = `calc(50% + ${nx * 46}vmin)`;
              dot.style.top = `calc(50% - ${ny * 46}vmin)`;
              dot.innerHTML = captured[i] ? '<i class="fa-solid fa-check"></i>' : '';
              targetsEl.appendChild(dot);
              return;
            }
          }
          // off-screen: skip drawing an edge arrow for captured targets, only guide toward remaining ones
          if (!captured[i] && i === nearestIdx) {
            dot.classList.add('offscreen');
            dot.style.left = `calc(50% + ${Math.sign(lx || 1) * 40}vmin)`;
            dot.style.top = `50%`;
            dot.innerHTML = '<i class="fa-solid fa-arrow-' + (lx > 0 ? 'right' : 'left') + '"></i>';
            targetsEl.appendChild(dot);
          }
        });
        return nearestIdx;
      }

      function updateGuidance() {
        const nearestIdx = renderTargets();
        countEl.textContent = String(captured.filter(Boolean).length);
        progressFill.style.width = (captured.filter(Boolean).length / targets.length * 100) + '%';

        if (nearestIdx === -1) { instruction.textContent = 'All targets captured — tap Finish.'; return nearestIdx; }
        if (!hasOrientation) {
          instruction.textContent = 'Orientation not available — use Capture to shoot each angle manually.';
          reticle.classList.remove('aligned');
          return nearestIdx;
        }
        const dist = angularDist(targets[nearestIdx], { yaw: currentYaw, pitch: currentPitch }) / DEG;
        const aligned = dist < ALIGN_TOLERANCE_DEG;
        reticle.classList.toggle('aligned', aligned);
        instruction.textContent = aligned ? 'Hold steady…' : 'Move the phone until the circles align.';

        if (aligned) {
          const moved = lastReading && (Math.abs(currentYaw - lastReading.yaw) / DEG > 1.5 || Math.abs(currentPitch - lastReading.pitch) / DEG > 1.5);
          if (moved || stableSince === null) stableSince = performance.now();
          if (performance.now() - stableSince > STABLE_MS) {
            captureAt(nearestIdx, true);
            stableSince = null;
          }
        } else {
          stableSince = null;
        }
        lastReading = { yaw: currentYaw, pitch: currentPitch };
        return nearestIdx;
      }

      function loop() {
        if (finished) return;
        updateGuidance();
        rafId = requestAnimationFrame(loop);
      }

      async function captureAt(targetIdx, auto) {
        if (finished || (auto && captured[targetIdx])) return;
        let bitmap = null;
        try {
          const track = stream.getVideoTracks()[0];
          if (typeof ImageCapture !== 'undefined' && track) {
            const ic = new ImageCapture(track);
            bitmap = await ic.grabFrame().catch(() => null);
          }
        } catch (e) { bitmap = null; }

        const canvas = document.createElement('canvas');
        canvas.width = bitmap ? bitmap.width : video.videoWidth;
        canvas.height = bitmap ? bitmap.height : video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (bitmap) { ctx.drawImage(bitmap, 0, 0); bitmap.close && bitmap.close(); }
        else ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.86));
        if (!blob) { toast('Could not capture that frame — try again', 'error'); return; }

        const order = sourceMediaIds.length + 1;
        const t = targets[targetIdx];
        try {
          const id = await global.LSCMedia.putMedia({
            locationId, category: 'panorama-360-source', sessionId,
            filename: `source_${String(order).padStart(3, '0')}_yaw${Math.round(t.yaw / DEG + 360) % 360}_pitch${Math.round(t.pitch / DEG)}.jpg`,
            mime: 'image/jpeg', originalFilename: null,
            width: canvas.width, height: canvas.height,
            order, yaw: hasOrientation ? currentYaw : t.yaw, pitch: hasOrientation ? currentPitch : t.pitch, roll: hasOrientation ? currentRoll : 0,
            blob
          });
          sourceMediaIds.push(id);
          captured[targetIdx] = true;
        } catch (e) {
          toast('Could not save that photo (storage may be full)', 'error');
          return;
        }

        if (captured.every(Boolean)) {
          finishBtn.hidden = false;
          captureBtn.hidden = true;
          instruction.textContent = 'All 18 targets captured — tap Finish to build the panorama.';
        } else if (sourceMediaIds.length >= 6) {
          finishBtn.hidden = false;
        }
      }

      captureBtn.addEventListener('click', () => {
        let idx = targets.findIndex((t, i) => !captured[i]);
        if (hasOrientation) {
          let best = -1, bestD = Infinity;
          targets.forEach((t, i) => { if (!captured[i]) { const d = angularDist(t, { yaw: currentYaw, pitch: currentPitch }); if (d < bestD) { bestD = d; best = i; } } });
          if (best !== -1) idx = best;
        }
        if (idx !== -1) captureAt(idx, false);
      });

      finishBtn.addEventListener('click', async () => {
        const total = captured.filter(Boolean).length;
        if (total < targets.length) {
          const ok = await confirm({
            title: 'Finish Early?',
            body: `Only ${total} of ${targets.length} angles were captured. The panorama may have gaps. Continue anyway?`,
            confirmText: 'Build Panorama'
          });
          if (!ok) return;
        }
        runStitchPhase();
      });

      async function runStitchPhase() {
        hud.hidden = true;
        stitchingPanel.hidden = false;
        const stageEl = stitchingPanel.querySelector('.c360-stitch-stage');
        const fillEl = stitchingPanel.querySelector('.c360-stitch-fill');

        if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') {
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'unsupported' });
          return;
        }

        let worker;
        try { worker = new Worker('pano-stitch-worker.js'); }
        catch (e) { finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'unsupported' }); return; }

        const images = [];
        for (const id of sourceMediaIds) {
          const rec = await global.LSCMedia.getMedia(id);
          if (!rec) continue;
          try {
            const bmp = await createImageBitmap(rec.blob);
            images.push({ bitmap: bmp, width: bmp.width, height: bmp.height, yaw: rec.yaw, pitch: rec.pitch, roll: rec.roll });
          } catch (e) { /* skip unreadable source */ }
        }
        if (!images.length) {
          worker.terminate();
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'no-readable-sources' });
          return;
        }

        const size = chooseOutputSize();
        worker.onmessage = async (e) => {
          const msg = e.data;
          if (msg.type === 'progress') {
            stageEl.textContent = msg.stage;
            fillEl.style.width = msg.pct + '%';
          } else if (msg.type === 'unsupported' || msg.type === 'error') {
            worker.terminate();
            finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: msg.type === 'unsupported' ? 'unsupported' : 'stitch-error' });
          } else if (msg.type === 'result') {
            worker.terminate();
            const imgData = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
            const canvas = document.createElement('canvas');
            canvas.width = msg.width; canvas.height = msg.height;
            canvas.getContext('2d').putImageData(imgData, 0, 0);
            canvas.toBlob(async blob => {
              if (!blob) { finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'encode-failed' }); return; }
              try {
                const panoId = await global.LSCMedia.putMedia({
                  locationId, category: 'panorama-360', sessionId,
                  filename: `panorama_${sessionId}.jpg`, mime: 'image/jpeg', originalFilename: null,
                  width: msg.width, height: msg.height, blob
                });
                finishAndClose({ stitched: true, panoramaMediaId: panoId, sessionId, sourceCount: sourceMediaIds.length });
              } catch (err) {
                finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'storage-failed' });
              }
            }, 'image/jpeg', 0.9);
          }
        };
        worker.onerror = () => {
          worker.terminate();
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'stitch-error' });
        };
        worker.postMessage(
          { type: 'stitch', outputWidth: size.width, outputHeight: size.height, hFovDeg: ASSUMED_H_FOV_DEG, images },
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
