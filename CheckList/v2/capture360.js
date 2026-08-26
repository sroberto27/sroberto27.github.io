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

  /* 46-shot pattern: 12 horizon + 12 at +33 + 12 at -33 + 4 at +66
     + 4 at -66 + true zenith + true nadir.

     Chosen by lab/test/run-pattern-coverage.js, which samples the sphere
     equal-area and back-projects every sample through the real stitcher
     projection and feather, across the whole plausible phone-lens range.
     Run it rather than trusting this paragraph.

     This replaced an 8-per-ring version, and the reason is overlap, not
     coverage. Coverage is a trap here: phone stills come back PORTRAIT,
     so the vertical field is a third wider than the horizontal one, and
     rings only have to ABUT for every direction to land inside some
     frame. The 8-per-ring pattern measured 100% covered and still
     produced doubled edges, because at the 46.6deg lens calibrated from
     a real capture, 45deg yaw spacing leaves consecutive horizon frames
     overlapping by 1.6deg. Neither the feature matcher nor the
     best-pixel blend can do anything with that -- both need two frames
     to see the same direction properly before they have a choice to
     make. Measured as the share of the sphere seen well by at least two
     frames, 8-per-ring manages 48.7% at 45deg and 93.0% at 57deg;
     12-per-ring reaches 77.5% and 99.6%, and is complete by 60deg.

     Every part of it is load-bearing, and the measurement says so:
     - 12 per ring rather than 8, for the overlap above. 30deg spacing
       gives a real margin at any lens the app is likely to meet.
     - the +/-66 rings close the band between the +/-33 ring's top edge
       and a single pole shot. Dropping them (12/12/12 + poles, 38 shots)
       loses full coverage outright -- 95.0% at 45deg -- and its two-frame
       overlap never exceeds 97.5% even at 78deg.
     - zenith/nadir at true +/-90, which is both better coverage and
       easier to aim than an off-pole shot. They are only worth about 2.7
       points of overlap over the 44-shot variant, but they are two
       photographs and they are the margin if a lens turns out narrower
       than anything swept here.
     - the +/-33 rings are staggered by half a step (15deg) against the
       horizon ring, so ring-to-ring overlap lands where a frame corner
       would otherwise meet another frame corner. That also gives pose
       refinement more cross-ring feature matches to work with. */
  function buildTargetPattern() {
    const t = [];
    for (let i = 0; i < 12; i++) t.push({ yaw: i * 30, pitch: 0 });
    for (let i = 0; i < 12; i++) t.push({ yaw: i * 30 + 15, pitch: 33 });
    for (let i = 0; i < 12; i++) t.push({ yaw: i * 30 + 15, pitch: -33 });
    for (let i = 0; i < 4; i++) t.push({ yaw: i * 90, pitch: 66 });
    for (let i = 0; i < 4; i++) t.push({ yaw: i * 90, pitch: -66 });
    t.push({ yaw: 0, pitch: 90 });
    t.push({ yaw: 0, pitch: -90 });
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
  /* Longest side the refinement stage sees. Measured on a real 34-shot
     portrait capture (3024x4032 sources), holding everything else fixed:

       640 px   30 match edges, 4.2 s inference -- seated person DOUBLED
       960 px   37 match edges, 8.9 s inference -- person single and sharp
      1280 px   28 match edges, 16.3 s inference -- worse and 4x the cost

     640 was chosen originally because XFeat is trained around VGA, but a
     portrait phone still downscales to 480x640 there, and a large room's
     detail does not survive it: too few distinctive keypoints reach the
     matcher and thin-overlap pairs fail. 1280 is worse again because the
     2048-keypoint cap then spreads over four times the area, thinning
     spatial coverage. 960 is the measured optimum, at roughly double the
     inference time -- acceptable for a stage the user opts into. */
  const REFINE_MAX_SIDE = 960;
  /* Whole-refinement deadline, not a per-step one: if this fires we give
     up on refinement entirely and stitch from the sensor pose.

     It is sized by MATCH PAIRS, not by shot count, because pairwise
     matching dominates and pairs grow much faster than photos do. Going
     from the 8-per-ring pattern to the 12-per-ring one took the capture
     from 34 shots to 46 (1.35x) but from 124 candidate pairs to 253
     (2.04x). 240000 was the value tuned against 124 pairs, so this is
     that number scaled by the measured pair growth and rounded. */
  const REFINE_TIMEOUT_MS = 480000;
  /* Longest gap tolerated between two progress messages from the stitch
     worker before we assume it died. Generous, because the per-image
     scatter loop on a slow phone can genuinely take a while.

     Deliberately NOT scaled with the pattern size: the worker reports
     progress once per source image, so this bounds the time for ONE
     decode plus one scatter pass, which does not depend on how many
     photos there are. */
  const STITCH_WATCHDOG_MS = 75000;

  function refineEnabled() {
    try { return localStorage.getItem(REFINE_PREF_KEY) !== '0'; }
    catch (e) { return true; }
  }
  function setRefineEnabled(on) {
    try { localStorage.setItem(REFINE_PREF_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  /* How pano-stitch-worker.js combines sources where photos overlap.
     'best' (winner-takes-all) ships as the default because a handheld
     capture's pose is never exactly right, and a few hard seam lines
     read as cleaner than the doubled edges averaging produces. It is a
     preference rather than a constant because that trade genuinely
     flips: with Enhance off the pose can be several degrees out, and a
     smeared seam can beat a hard one that lands in the wrong place. */
  const BLEND_PREF_KEY = 'lsc2_pano_blend';
  const BLEND_MODES = ['best', 'sharp', 'average'];
  function blendMode() {
    try {
      const v = localStorage.getItem(BLEND_PREF_KEY);
      return BLEND_MODES.indexOf(v) >= 0 ? v : 'best';
    } catch (e) { return 'best'; }
  }
  function setBlendMode(v) {
    try { localStorage.setItem(BLEND_PREF_KEY, v); } catch (e) { /* ignore */ }
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
          <div class="c360-counter">Photos: <span class="c360-count">0</span> / <span class="c360-total">0</span></div>
          <label class="c360-enhance" title="Corrects lens FOV, pose drift and exposure on-device before stitching. Slower, but much sharper seams.">
            <input type="checkbox" class="c360-enhance-input"> Enhance
          </label>
          <label class="c360-blend" title="How overlapping photos are combined. Sharpest wins: no doubled edges, but seams can be visible. Blended: smoothest seams, but slight ghosting.">
            <select class="c360-blend-input">
              <option value="best">Sharpest wins</option>
              <option value="sharp">Sharpness-weighted</option>
              <option value="average">Blended</option>
            </select>
          </label>
        </div>
        <div class="c360-instruction">Move the phone until the circles align.</div>
        <div class="c360-progress-track"><div class="c360-progress-fill"></div></div>
        <div class="c360-utility">
          <button type="button" class="tbtn tbtn--sm c360-savezip" hidden><i class="fa-solid fa-file-zipper"></i> Save photos (.zip)</button>
        </div>
        <div class="c360-controls">
          <button type="button" class="tbtn tbtn--sm c360-retake" hidden><i class="fa-solid fa-rotate-left"></i> Retake</button>
          <button type="button" class="tbtn tbtn--primary c360-capture"><i class="fa-solid fa-camera"></i> Capture</button>
          <button type="button" class="tbtn c360-finish" hidden><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</button>
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

  /* Output size is a memory decision before it is a quality one. The
     stitch worker holds 16 bytes of accumulator per output pixel -- 21 in
     the winner-takes-all blend, which adds a score and an owner map -- so
     4096x2048 costs 134 to 176 MB, plus 34 MB for the output image itself.

     Note this does NOT scale with the number of photos: the accumulators
     are per OUTPUT pixel, and sources are decoded one at a time. Adding
     shots to the capture pattern costs time, not peak memory.

     navigator.deviceMemory does not exist on Safari or Firefox, which
     means every iPhone used to land on the 4096x2048 branch -- the most
     expensive one -- purely because we could not measure it. Combined
     with every source bitmap decoded that was enough to have the browser
     kill the tab outright. Unknown now means 3072x1536 (about 100 MB of
     accumulators): still a detailed panorama, and it leaves headroom.
     Devices that actually report >= 8 GB still get the full size. */
  function chooseOutputSize() {
    const mem = navigator.deviceMemory;
    if (mem && mem <= 3) return { width: 2048, height: 1024 };
    if (mem && mem >= 8) return { width: 4096, height: 2048, allowHigh: true };
    if (mem) return { width: 3072, height: 1536 };
    return { width: 3072, height: 1536 };
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
      const retakeBtn = overlay.querySelector('.c360-retake');
      const saveZipBtn = overlay.querySelector('.c360-savezip');
      const instruction = overlay.querySelector('.c360-instruction');
      const enhanceInput = overlay.querySelector('.c360-enhance-input');
      enhanceInput.checked = refineEnabled();
      enhanceInput.addEventListener('change', () => setRefineEnabled(enhanceInput.checked));
      const blendInput = overlay.querySelector('.c360-blend-input');
      blendInput.value = blendMode();
      blendInput.addEventListener('change', () => setBlendMode(blendInput.value));

      const targets = buildTargetPattern();
      totalEl.textContent = String(targets.length);
      const captured = new Array(targets.length).fill(false);
      const capturedPatches = []; // { yaw, pitch, canvas }
      const sourceMediaIds = [];
      /* Capture order, so Retake knows which shot was actually last --
         which is not the same as the highest target index, because the
         user can shoot targets out of order. */
      const shotLog = [];         // { targetIdx, mediaId, yaw, pitch, roll, width, height }
      let activeIndex = 0;
      let blurRetries = 0;
      let stream = null;
      let finished = false;
      let currentYaw = 0, currentPitch = 0, currentRoll = 0;
      // Raw deviceorientation events are noisy frame-to-frame (no OS-level
      // smoothing guarantee), and that raw value used to drive both the
      // live overlay and the 550ms "hold steady" capture timer directly —
      // visibly jittering the already-captured patches on screen and
      // spuriously resetting the stability timer on ordinary sensor noise.
      // These filters absorb that noise while staying responsive during a
      // real sweep to the next target; see LSCOrientation.makeOneEuroAngleFilter.
      const yawFilter = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
      const pitchFilter = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
      const rollFilter = O.makeOneEuroAngleFilter({ minCutoff: 0.9, beta: 0.4 });
      let hasOrientation = false;
      let startYaw = null;
      let stableSince = null;
      let lastReading = null;
      let rafId = null;
      let orientationHandler = null;
      let capturingInFlight = false;
      let canvasW = 0, canvasH = 0, dpr = 1;
      let alignedNow = false;
      /* After a retake the phone is usually still pointing at the target
         it just discarded, so the stability timer would fire immediately
         and take the same bad photo again. Auto-capture stays disarmed
         until the user either aims away once or waits this out. */
      let rearmAfterLeaving = false;
      let rearmAt = 0;
      let zipping = false;

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

        if (activeIndex >= targets.length) { instruction.textContent = 'All targets captured — tap Generate.'; alignedNow = false; return; }
        if (!hasOrientation) {
          instruction.textContent = 'Orientation not available — use Capture to shoot each angle manually.';
          alignedNow = false;
          return;
        }
        const dist = angularDist(targets[activeIndex], { yaw: currentYaw, pitch: currentPitch }) / DEG;
        alignedNow = dist < ALIGN_TOLERANCE_DEG;
        instruction.textContent = alignedNow ? 'Hold steady…' : 'Move the phone until the circles align.';

        if (rearmAfterLeaving && (!alignedNow || performance.now() > rearmAt)) rearmAfterLeaving = false;
        if (rearmAfterLeaving) instruction.textContent = 'Reframe the shot — aim away and back, or hold on.';

        if (alignedNow && !rearmAfterLeaving) {
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
            shotLog.push({
              targetIdx: targetIdx, mediaId: id,
              yaw: hasOrientation ? capturedYaw : t.yaw,
              pitch: hasOrientation ? capturedPitch : t.pitch,
              roll: hasOrientation ? capturedRoll : 0,
              width: shotCanvas.width, height: shotCanvas.height
            });
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
            instruction.textContent = `All ${targets.length} targets captured — tap Generate to build the panorama.`;
          }
        } finally {
          // Order matters: updateControls() reads capturingInFlight, so it
          // has to run after the flag clears or Retake stays disabled for
          // the rest of the session.
          capturingInFlight = false;
          updateControls();
        }
      }

      /* Which of the four buttons are live, in one place, so Capture,
         Retake and Generate can never disagree about the shot count. */
      function updateControls() {
        const n = shotLog.length;
        const done = captured.every(Boolean);
        captureBtn.hidden = done;
        retakeBtn.hidden = n === 0;
        finishBtn.hidden = n === 0;
        saveZipBtn.hidden = n === 0;
        retakeBtn.disabled = capturingInFlight;
        // Left alone while a ZIP is being built; that path owns the button
        // (spinner label and all) until it finishes.
        if (!zipping) saveZipBtn.disabled = capturingInFlight;
      }

      /* Undo the most recent shot and aim back at its target. The photo is
         deleted from IndexedDB rather than orphaned, otherwise a session
         with several retakes would leave dead blobs behind and the ZIP
         export would contain frames the panorama never used. */
      async function retakeLast() {
        if (finished || capturingInFlight || !shotLog.length) return;
        const last = shotLog.pop();
        const k = sourceMediaIds.indexOf(last.mediaId);
        if (k >= 0) { sourceMediaIds.splice(k, 1); capturedPatches.splice(k, 1); }
        captured[last.targetIdx] = false;
        activeIndex = last.targetIdx;
        stableSince = null;
        lastReading = null;
        blurRetries = 0;
        rearmAfterLeaving = true;
        rearmAt = performance.now() + 3000;
        try { await global.LSCMedia.deleteMedia(last.mediaId); } catch (e) { /* already gone */ }
        updateControls();
        toast(`Shot ${last.targetIdx + 1} discarded — aim at the highlighted target again.`, 'info');
      }

      /* Saves every source frame plus a metadata.json describing the pose
         each one was taken at. The photos alone are not enough to
         reproduce a stitch offline: the whole pipeline is driven by the
         per-shot yaw/pitch/roll, so the JSON is the load-bearing half of
         this file. Open lab/replay.html on a desktop and drop the ZIP in
         to re-run the real refine and stitch workers over it. */
      async function saveSourcesZip() {
        if (!sourceMediaIds.length) { toast('No photos captured yet.', 'error'); return; }
        if (typeof JSZip === 'undefined') { toast('ZIP export is not available in this browser.', 'error'); return; }
        const original = saveZipBtn.innerHTML;
        zipping = true;
        saveZipBtn.disabled = true;
        saveZipBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Packing…';
        try {
          const zip = new JSZip();
          const folder = zip.folder('photos');
          const shots = [];
          for (let k = 0; k < sourceMediaIds.length; k++) {
            const rec = await global.LSCMedia.getMedia(sourceMediaIds[k]);
            if (!rec || !rec.blob) continue;
            const entry = shotLog.find(sl => sl.mediaId === sourceMediaIds[k]) || null;
            const name = rec.filename || `source_${String(k + 1).padStart(3, '0')}.jpg`;
            folder.file(name, rec.blob);
            const tIdx = entry ? entry.targetIdx : -1;
            const tgt = tIdx >= 0 ? targets[tIdx] : null;
            shots.push({
              file: 'photos/' + name,
              order: k + 1,
              targetIndex: tIdx,
              targetYawDeg: tgt ? +(tgt.yaw / DEG).toFixed(3) : null,
              targetPitchDeg: tgt ? +(tgt.pitch / DEG).toFixed(3) : null,
              // Radians are what the pipeline consumes; degrees are for reading.
              yaw: rec.yaw, pitch: rec.pitch, roll: rec.roll,
              yawDeg: +((rec.yaw || 0) / DEG).toFixed(3),
              pitchDeg: +((rec.pitch || 0) / DEG).toFixed(3),
              rollDeg: +((rec.roll || 0) / DEG).toFixed(3),
              width: rec.width, height: rec.height,
              bytes: rec.blob.size
            });
          }
          if (!shots.length) { toast('Could not read the captured photos.', 'error'); return; }
          const meta = {
            format: 'lsc-360-capture/1',
            sessionId: sessionId,
            capturedAt: new Date().toISOString(),
            locationId: locationId != null ? String(locationId) : null,
            shotCount: shots.length,
            patternSize: targets.length,
            // Recorded so an offline run reproduces exactly what the phone did.
            assumedHFovDeg: ASSUMED_H_FOV_DEG,
            refineEnabled: refineEnabled(),
            refineMaxSide: REFINE_MAX_SIDE,
            hasOrientation: hasOrientation,
            outputSize: chooseOutputSize(),
            pattern: targets.map((t, i) => ({
              index: i,
              yawDeg: +(t.yaw / DEG).toFixed(3),
              pitchDeg: +(t.pitch / DEG).toFixed(3),
              captured: !!captured[i]
            })),
            device: {
              userAgent: navigator.userAgent,
              deviceMemory: navigator.deviceMemory || null,
              hardwareConcurrency: navigator.hardwareConcurrency || null,
              screen: { width: screen.width, height: screen.height, dpr: window.devicePixelRatio || 1 }
            },
            shots: shots
          };
          zip.file('metadata.json', JSON.stringify(meta, null, 2));
          const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
          const url = URL.createObjectURL(out);
          const a = document.createElement('a');
          a.href = url;
          a.download = `360-capture_${sessionId}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          toast(`Saved ${shots.length} photos + metadata.json.`, 'success');
        } catch (err) {
          toast('Could not build the ZIP: ' + (err && err.message ? err.message : err), 'error');
        } finally {
          zipping = false;
          saveZipBtn.innerHTML = original;
          saveZipBtn.disabled = false;
        }
      }

      retakeBtn.addEventListener('click', retakeLast);
      saveZipBtn.addEventListener('click', saveSourcesZip);

      captureBtn.addEventListener('click', () => {
        if (activeIndex < targets.length) captureAt(activeIndex, false);
      });

      finishBtn.addEventListener('click', async () => {
        const total = captured.filter(Boolean).length;
        if (total < targets.length) {
          const gapPct = computeCoverageGapPct(targets, captured);
          const ok = await confirm({
            title: 'Generate Early?',
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

        /* Hand the worker the COMPRESSED blobs and let it decode them one
           at a time. Decoding them all here first produced one live
           ImageBitmap per shot at 1920x1080 -- 282 MB of resident pixel
           data for a 34-shot capture, more now,
           which on top of the worker's own accumulators was enough for
           mobile Safari to kill the tab instead of throwing something the
           error handlers below could catch. Blobs are ~500 KB each and
           are passed by reference, so this loop now costs nothing. */
        const images = records.map(rec => {
          const fix = refinement ? refinement.byId.get(rec.id) : null;
          return {
            blob: rec.blob, width: rec.width, height: rec.height,
            yaw: fix ? fix.yaw : rec.yaw,
            pitch: fix ? fix.pitch : rec.pitch,
            roll: fix ? fix.roll : rec.roll,
            gain: fix ? fix.gain : 1
          };
        }).filter(im => im.blob);
        if (!images.length) {
          worker.terminate();
          finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'no-readable-sources' });
          return;
        }

        const size = chooseOutputSize();
        /* ASSUMED_H_FOV_DEG describes the lens across its LONG axis. The
           camera returns portrait stills, so applying it to the frame
           WIDTH would overstate the lens by ~25% (see
           widthFovFromLongFov in pano/camera.js). Convert using the real
           dimensions of the frames we are about to stitch. Refinement,
           when it ran, already measured the width-axis FOV directly. */
        const ref0 = images[0];
        const fallbackHFovDeg = ref0
          ? 2 * Math.atan(
              Math.max(ref0.width, ref0.height) === 0 ? 0 :
              ref0.width / (2 * (Math.max(ref0.width, ref0.height) /
                (2 * Math.tan(ASSUMED_H_FOV_DEG * DEG / 2))))
            ) / DEG
          : ASSUMED_H_FOV_DEG;
        const hFovDeg = refinement && refinement.hFovDeg ? refinement.hFovDeg : fallbackHFovDeg;
        const refineInfo = refinement
          ? Object.assign({ hFovDeg: refinement.hFovDeg }, refinement.diagnostics || {})
          : null;

        /* A worker killed for memory does not always fire onerror -- it can
           simply stop, leaving the progress bar frozen forever with no way
           out but reloading the page. The sources are already safe in
           IndexedDB at this point, so treat prolonged silence as a failure
           and hand the user back a session they can retry or export. */
        let lastStage = 'Preparing images';
        let watchdog = null;
        const armWatchdog = () => {
          if (watchdog) clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            try { worker.terminate(); } catch (e) { /* ignore */ }
            finishAndClose({
              stitched: false, sessionId, sourceCount: sourceMediaIds.length,
              reason: 'stitch-stalled', stage: lastStage
            });
          }, STITCH_WATCHDOG_MS);
        };
        const stopWatchdog = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };

        async function storePanorama(blob, width, height) {
          if (!blob) { finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'encode-failed' }); return; }
          try {
            const panoId = await global.LSCMedia.putMedia({
              locationId, category: 'panorama-360', sessionId,
              filename: `panorama_${sessionId}.jpg`, mime: 'image/jpeg', originalFilename: null,
              width, height, blob
            });
            finishAndClose({
              stitched: true, panoramaMediaId: panoId, sessionId,
              sourceCount: sourceMediaIds.length, refinement: refineInfo
            });
          } catch (err) {
            finishAndClose({ stitched: false, sessionId, sourceCount: sourceMediaIds.length, reason: 'storage-failed' });
          }
        }

        worker.onmessage = async (e) => {
          const msg = e.data;
          if (msg.type === 'progress') {
            lastStage = msg.stage;
            armWatchdog();
            setProgress(msg.stage, base + msg.pct * span / 100);
          } else if (msg.type === 'unsupported' || msg.type === 'error') {
            stopWatchdog();
            worker.terminate();
            finishAndClose({
              stitched: false, sessionId, sourceCount: sourceMediaIds.length,
              reason: msg.type === 'unsupported' ? 'unsupported' : 'stitch-error',
              stage: msg.stage || lastStage, detail: msg.message || null
            });
          } else if (msg.type === 'result') {
            stopWatchdog();
            worker.terminate();
            // The worker encodes the JPEG itself when it can. The raw-buffer
            // branch is the fallback, and is the expensive one: it costs an
            // ImageData plus a full-size canvas on the main thread.
            if (msg.blob) { await storePanorama(msg.blob, msg.width, msg.height); return; }
            const imgData = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
            const canvas2 = document.createElement('canvas');
            canvas2.width = msg.width; canvas2.height = msg.height;
            canvas2.getContext('2d').putImageData(imgData, 0, 0);
            canvas2.toBlob(async blob => {
              canvas2.width = 1; canvas2.height = 1;
              await storePanorama(blob, msg.width, msg.height);
            }, 'image/jpeg', 0.92);
          }
        };
        worker.onerror = () => {
          stopWatchdog();
          worker.terminate();
          finishAndClose({
            stitched: false, sessionId, sourceCount: sourceMediaIds.length,
            reason: 'stitch-error', stage: lastStage
          });
        };
        armWatchdog();
        worker.postMessage({
          type: 'stitch', outputWidth: size.width, outputHeight: size.height, hFovDeg,
          blend: blendMode(), images
        });
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
        updateControls();
        resizeCanvas();

        // Some sideways drift of the lens between shots is unavoidable —
        // a handheld phone can't rotate about its own lens's optical
        // center — and no amount of pose refinement afterward can correct
        // for it (it needs depth information this app doesn't have). The
        // one thing that actually helps is capture technique: pivoting at
        // the wrist keeps the lens closer to a fixed point than swinging
        // from the shoulder does. One-time tip, not repeated per shot.
        toast('Tip: pivot from your wrist, not your shoulder — swinging your arm shifts the lens and shows up as ghosting.', 'info');

        if (hasOrientation) {
          orientationHandler = (e) => {
            if (typeof e.alpha !== 'number') return;
            const q = O.orientationToQuaternion(e.alpha, e.beta, e.gamma, screenAngle());
            const reading = O.quaternionToYawPitchRoll(q, startYaw || 0);
            if (startYaw === null) {
              startYaw = reading.rawYaw; // first reading only sets the yaw==0 baseline
              const t0 = performance.now() / 1000;
              yawFilter.reset(0, t0); pitchFilter.reset(reading.pitch, t0); rollFilter.reset(reading.roll, t0);
              return;
            }
            const t = performance.now() / 1000;
            currentYaw = yawFilter.filter(reading.yaw, t);
            currentPitch = pitchFilter.filter(reading.pitch, t);
            currentRoll = rollFilter.filter(reading.roll, t);
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
