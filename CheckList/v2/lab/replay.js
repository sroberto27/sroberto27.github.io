/* ===================== CAPTURE REPLAY =====================
   Re-runs a real phone capture on a desktop, through the SHIPPING
   workers rather than a reimplementation of them.

   The app's 360 capture screen has a "Save photos (.zip)" button that
   writes every source frame plus a metadata.json describing the pose each
   one was taken at. The photos on their own are not enough to reproduce
   anything: the whole pipeline is driven by per-shot yaw/pitch/roll, so
   the JSON is the load-bearing half of the archive.

   Why this exists: the synthetic harness in lab/test/ has zero parallax
   by construction (every view shares one optical centre) and perfectly
   known ground truth, which makes it excellent for regression-testing
   geometry and useless for judging what a handheld capture actually
   looks like. This page closes that gap without needing a phone in hand
   for every experiment.

   Nothing here writes to the app's IndexedDB. It only reads a file the
   user hands it.
*/
(function () {
  'use strict';

  const el = id => document.getElementById(id);
  const logEl = el('log');
  const DEG = Math.PI / 180;
  const REFINE_MAX_SIDE = 640;   // must match capture360.js
  const ASSUMED_LONG_FOV_DEG = 68;  // lens FOV across its LONG axis (capture360.js)

  /* The assumed lens FOV is quoted across the LONG image axis, but phone
     stills come back portrait, so it has to be mapped onto the frame
     WIDTH before it is used as a focal length. Applying it to a portrait
     width directly overstates the lens by ~25%. Mirrors
     widthFovFromLongFov in ../pano/camera.js. */
  function widthFovDeg(longFovDeg, w, h) {
    const longSide = Math.max(w, h);
    const f = longSide / (2 * Math.tan(longFovDeg * DEG / 2));
    return 2 * Math.atan(w / (2 * f)) / DEG;
  }

  // Width-axis FOV implied for the loaded archive's frames.
  function baselineFovDeg() {
    const s0 = archive && archive.shots && archive.shots[0];
    if (!s0 || !s0.width || !s0.height) return ASSUMED_LONG_FOV_DEG;
    return widthFovDeg(ASSUMED_LONG_FOV_DEG, s0.width, s0.height);
  }

  let archive = null;  // { meta, shots:[{name, blob, yaw, pitch, roll, width, height}] }
  let lastBlob = null;

  function log(msg) {
    logEl.textContent += msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }
  function stage(text) { el('stage').textContent = text; }
  function progress(frac) { el('prog').style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%'; }
  function fmt(v, d) {
    return (v === null || v === undefined || !isFinite(v)) ? '—' : Number(v).toFixed(d === undefined ? 2 : d);
  }
  function metric(label, value, cls) {
    return `<div class="metric"><span>${label}</span><b class="${cls || ''}">${value}</b></div>`;
  }

  // ---------------------------------------------------------------- load

  const drop = el('drop');
  const fileInput = el('file');
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadZip(fileInput.files[0]); });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f) loadZip(f);
  });

  async function loadZip(file) {
    try {
      log(`\nreading ${file.name} (${(file.size / 1048576).toFixed(1)} MB)…`);
      const zip = await JSZip.loadAsync(file);
      const metaFile = zip.file('metadata.json');
      if (!metaFile) throw new Error('no metadata.json — is this a capture archive?');
      const meta = JSON.parse(await metaFile.async('string'));
      if (!meta.shots || !meta.shots.length) throw new Error('metadata.json lists no shots');

      const shots = [];
      for (const s of meta.shots) {
        const entry = zip.file(s.file);
        if (!entry) { log(`  MISSING ${s.file}`); continue; }
        shots.push({
          name: s.file.replace(/^photos\//, ''),
          blob: await entry.async('blob'),
          // Radians, exactly as the phone recorded them.
          yaw: s.yaw, pitch: s.pitch, roll: s.roll,
          width: s.width, height: s.height,
          targetIndex: s.targetIndex
        });
      }
      if (!shots.length) throw new Error('none of the listed photos were present in the archive');

      archive = { meta, shots };
      lastBlob = null;
      el('dlBtn').disabled = true;
      log(`  loaded ${shots.length} shots, session ${meta.sessionId}`);
      renderSession();
      renderThumbs();
      el('ortStatus').textContent = `${shots.length} shots · ${meta.sessionId}`;
    } catch (err) {
      log('  ERROR ' + (err && err.message ? err.message : err));
      alert('Could not read that archive: ' + (err && err.message ? err.message : err));
    }
  }

  function renderSession() {
    const m = archive.meta;
    const d = m.device || {};
    const captured = (m.pattern || []).filter(p => p.captured).length;
    el('sessionMeta').innerHTML =
      metric('Session', m.sessionId) +
      metric('Captured at', (m.capturedAt || '').replace('T', ' ').slice(0, 19)) +
      metric('Shots', `${archive.shots.length} of ${m.patternSize || '?'} targets` +
        (captured && captured !== archive.shots.length ? ` (${captured} marked)` : '')) +
      metric('Source size', `${archive.shots[0].width || '?'} × ${archive.shots[0].height || '?'}`) +
      metric('Enhance was on', m.refineEnabled ? 'yes' : 'no') +
      metric('Orientation sensor', m.hasOrientation ? 'yes' : 'NO — poses are target angles', m.hasOrientation ? '' : 'bad') +
      metric('Phone output size', m.outputSize ? `${m.outputSize.width} × ${m.outputSize.height}` : '—') +
      metric('deviceMemory', d.deviceMemory ? d.deviceMemory + ' GB' : 'not reported (Safari/Firefox)') +
      metric('User agent', `<span class="dim" style="font-size:11px">${(d.userAgent || '—').slice(0, 64)}</span>`);
    el('sessionCard').hidden = false;
  }

  function renderThumbs() {
    const box = el('thumbs');
    box.innerHTML = '';
    archive.shots.forEach((s, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = URL.createObjectURL(s.blob);
      img.onload = () => URL.revokeObjectURL(img.src);
      const cap = document.createElement('figcaption');
      cap.textContent = `${i + 1}· ${fmt(s.yaw / DEG, 0)}°/${fmt(s.pitch / DEG, 0)}°`;
      fig.appendChild(img); fig.appendChild(cap);
      box.appendChild(fig);
    });
    el('shotsCard').hidden = false;
  }

  // ---------------------------------------------------------------- refine

  /* Same protocol capture360.js uses: downscaled ImageBitmaps, transferred.
     Resolves to { byId, hFovDeg, diagnostics } or null, where null means
     "stitch from the sensor pose", exactly as on the phone. */
  function runRefinement(shots, onProgress) {
    return new Promise(resolve => {
      let worker;
      try { worker = new Worker('../pano-refine-worker.js', { type: 'module' }); }
      catch (e) { log('  refine worker could not start: ' + e.message); resolve(null); return; }

      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        try { worker.terminate(); } catch (e) { /* ignore */ }
        resolve(v);
      };

      worker.onmessage = (e) => {
        const msg = e.data;
        if (!msg) return;
        if (msg.type === 'progress') { onProgress(msg.stage, msg.pct); return; }
        if (msg.type === 'result' && Array.isArray(msg.poses)) {
          finish({ poses: msg.poses, hFovDeg: msg.hFovDeg, gains: msg.gains, diagnostics: msg.diagnostics });
          return;
        }
        log('  refinement did not apply: ' + (msg.reason || msg.message || msg.type));
        finish(null);
      };
      worker.onerror = (e) => { log('  refine worker error: ' + (e.message || 'unknown')); finish(null); };

      (async () => {
        const images = [];
        for (const s of shots) {
          const full = await createImageBitmap(s.blob);
          const scale = Math.min(1, REFINE_MAX_SIDE / Math.max(full.width, full.height));
          const bmp = await createImageBitmap(full, {
            resizeWidth: Math.max(8, Math.round(full.width * scale)),
            resizeHeight: Math.max(8, Math.round(full.height * scale)),
            resizeQuality: 'medium'
          });
          full.close();
          images.push({ bitmap: bmp, width: bmp.width, height: bmp.height, yaw: s.yaw, pitch: s.pitch, roll: s.roll });
        }
        worker.postMessage(
          { type: 'refine', images, options: { maxSide: REFINE_MAX_SIDE, nominalHFovDeg: ASSUMED_LONG_FOV_DEG } },
          images.map(i => i.bitmap)
        );
      })().catch(err => { log('  decode failed: ' + err.message); finish(null); });
    });
  }

  // ---------------------------------------------------------------- stitch

  function runStitch(images, W, H, hFovDeg, onProgress) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('../pano-stitch-worker.js');
      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'progress') { onProgress(msg.stage, msg.pct); return; }
        worker.terminate();
        if (msg.type === 'result') resolve(msg);
        else reject(new Error(`${msg.type}${msg.stage ? ' during ' + msg.stage : ''}: ${msg.message || msg.reason || ''}`));
      };
      worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'stitch worker crashed')); };
      // Blobs, not bitmaps — the worker decodes one at a time. Sending 34
      // decoded frames instead is what used to run phones out of memory.
      worker.postMessage({ type: 'stitch', outputWidth: W, outputHeight: H, hFovDeg, images });
    });
  }

  async function buildOnce(useRefine, W, H, label) {
    const t0 = performance.now();
    let refinement = null;
    if (useRefine) {
      stage('refining…');
      refinement = await runRefinement(archive.shots, (s, pct) => {
        stage(s); progress(pct / 100 * 0.55);
      });
      if (refinement) {
        const d = refinement.diagnostics || {};
        log(`  refined: hFOV ${fmt(refinement.hFovDeg)}°, mean correction ${fmt(d.meanCorrectionDeg)}°, ` +
          `${d.edges} edges (${d.rejectedEdges} rejected), ${d.keypointsPerShot} kpts/shot`);
      } else {
        log('  refinement returned nothing — falling back to sensor pose');
      }
    }

    const images = archive.shots.map((s, i) => {
      const p = refinement && refinement.poses[i];
      const g = refinement && refinement.gains && refinement.gains[i];
      return {
        blob: s.blob, width: s.width, height: s.height,
        yaw: p ? p.yaw : s.yaw,
        pitch: p ? p.pitch : s.pitch,
        roll: p ? p.roll : s.roll,
        gain: (typeof g === 'number') ? g : 1
      };
    });

    const hFov = (refinement && refinement.hFovDeg) ? refinement.hFovDeg : baselineFovDeg();
    const base = useRefine ? 0.55 : 0;
    const span = useRefine ? 0.45 : 1;
    const res = await runStitch(images, W, H, hFov, (s, pct) => {
      stage(s); progress(base + pct / 100 * span);
    });
    const ms = performance.now() - t0;
    log(`  ${label}: ${fmt(res.coverage * 100, 1)}% sphere coverage, ${(ms / 1000).toFixed(1)}s` +
      (res.downscaled ? ' [worker downscaled the output — not enough memory]' : ''));
    return { res, refinement, hFov, ms };
  }

  async function draw(res) {
    const cv = el('pano');
    cv.width = res.width; cv.height = res.height;
    const ctx = cv.getContext('2d');
    if (res.blob) {
      const bmp = await createImageBitmap(res.blob);
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      lastBlob = res.blob;
    } else {
      const data = new ImageData(new Uint8ClampedArray(res.buffer), res.width, res.height);
      ctx.putImageData(data, 0, 0);
      lastBlob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    }
    el('dlBtn').disabled = !lastBlob;
    el('resultCard').hidden = false;
  }

  function showMetrics(rows) {
    el('metrics').innerHTML = rows.join('');
  }

  function outputSize() {
    const [w, h] = el('outSize').value.split('x').map(Number);
    return { W: w, H: h };
  }

  function busy(on) {
    el('runBtn').disabled = on;
    el('abBtn').disabled = on;
  }

  el('runBtn').addEventListener('click', async () => {
    if (!archive) return;
    busy(true);
    try {
      const { W, H } = outputSize();
      const useRefine = el('useRefine').checked;
      log(`\nrun: ${archive.shots.length} shots -> ${W}x${H}, enhance ${useRefine ? 'ON' : 'OFF'}`);
      const r = await buildOnce(useRefine, W, H, useRefine ? 'enhanced' : 'sensor pose');
      await draw(r.res);
      const d = (r.refinement && r.refinement.diagnostics) || {};
      showMetrics([
        metric('Sphere coverage', fmt(r.res.coverage * 100, 1) + '%',
          r.res.coverage > 0.995 ? 'good' : (r.res.coverage > 0.97 ? '' : 'bad')),
        metric('Output', `${r.res.width} × ${r.res.height}` + (r.res.downscaled ? ' (downscaled)' : '')),
        metric('Horizontal FOV used', fmt(r.hFov) + '°' +
          (r.refinement ? '' : ' (assumed, from ' + ASSUMED_LONG_FOV_DEG + '° long-axis)')),
        metric('Pose refinement', r.refinement ? 'applied' : 'not applied', r.refinement ? 'good' : 'dim'),
        metric('Mean pose correction', d.meanCorrectionDeg !== undefined ? fmt(d.meanCorrectionDeg) + '°' : '—'),
        metric('Max pose correction', d.maxCorrectionDeg !== undefined ? fmt(d.maxCorrectionDeg) + '°' : '—'),
        metric('Match edges kept', d.edges !== undefined ? `${d.edges} (${d.rejectedEdges} rejected)` : '—'),
        metric('Keypoints per shot', d.keypointsPerShot !== undefined ? d.keypointsPerShot : '—'),
        metric('RMS edge residual', d.rmsEdgeResidualDeg !== undefined ? fmt(d.rmsEdgeResidualDeg, 3) + '°' : '—'),
        metric('Horizon loop drift', d.loopDriftDeg !== undefined && d.loopDriftDeg !== null ? fmt(d.loopDriftDeg) + '°' : '—'),
        metric('Total time', (r.ms / 1000).toFixed(1) + ' s')
      ]);
      stage('done'); progress(1);
    } catch (err) {
      log('  FAILED ' + (err && err.message ? err.message : err));
      stage('failed: ' + (err && err.message ? err.message : err));
    } finally { busy(false); }
  });

  /* The comparison that matters for the paper: identical photos, identical
     output size, the only difference being whether refinement ran. */
  el('abBtn').addEventListener('click', async () => {
    if (!archive) return;
    busy(true);
    try {
      const { W, H } = outputSize();
      log(`\nA/B: ${archive.shots.length} shots -> ${W}x${H}`);
      const a = await buildOnce(false, W, H, `A sensor pose + ${fmt(baselineFovDeg(), 1)}°`);
      const b = await buildOnce(true, W, H, 'B enhanced');
      await draw(b.res);
      const d = (b.refinement && b.refinement.diagnostics) || {};
      showMetrics([
        metric('A · sensor pose coverage', fmt(a.res.coverage * 100, 1) + '%'),
        metric('B · enhanced coverage', fmt(b.res.coverage * 100, 1) + '%'),
        metric('Coverage delta', (b.res.coverage >= a.res.coverage ? '+' : '') +
          fmt((b.res.coverage - a.res.coverage) * 100, 2) + ' pts',
          b.res.coverage >= a.res.coverage ? 'good' : 'bad'),
        metric('FOV: assumed → calibrated', `${fmt(baselineFovDeg(), 1)}° → ${fmt(b.hFov)}°`),
        metric('Mean pose correction', d.meanCorrectionDeg !== undefined ? fmt(d.meanCorrectionDeg) + '°' : '—'),
        metric('A time', (a.ms / 1000).toFixed(1) + ' s'),
        metric('B time', (b.ms / 1000).toFixed(1) + ' s'),
        metric('Enhancement cost', ((b.ms - a.ms) / 1000).toFixed(1) + ' s')
      ]);
      log('  showing B (enhanced) above. Coverage is a capture property, so the two ' +
        'should be close; the visible difference is seam alignment.');
      stage('done'); progress(1);
    } catch (err) {
      log('  FAILED ' + (err && err.message ? err.message : err));
      stage('failed: ' + (err && err.message ? err.message : err));
    } finally { busy(false); }
  });

  el('dlBtn').addEventListener('click', () => {
    if (!lastBlob) return;
    const url = URL.createObjectURL(lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panorama_${archive.meta.sessionId}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });

  log('ready — drop a capture archive above.');
})();
