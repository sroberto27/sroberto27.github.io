/* ===================== POSE REFINEMENT LAB =====================
   Standalone harness. Reads capture sessions straight out of the app's
   IndexedDB (same origin, read-only -- the app is never modified), runs
   XFeat over every shot, matches overlapping pairs under the pose prior,
   and feeds the correspondences into the geometry pipeline.

   Nothing here writes back. The refined poses and calibrated focal are
   reported and exportable; wiring them into the stitch worker is a
   separate, later step, deliberately kept out of this file so the lab
   can never corrupt a real capture.
*/
(function () {
  'use strict';

  const S = window.LSCSO3, C = window.LSCCamera, P = window.LSCPipeline;
  const XF = window.LSCXFeat, MM = window.LSCMatch;

  const el = id => document.getElementById(id);
  const logEl = el('log');
  let sessions = [];
  let current = null;   // { records, features, result, pairs }

  function log(msg) {
    logEl.textContent += msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }
  function progress(frac) { el('prog').style.width = (frac * 100).toFixed(1) + '%'; }
  function fmt(v, d) { return (v === null || v === undefined || !isFinite(v)) ? '—' : Number(v).toFixed(d === undefined ? 3 : d); }

  // ---- read the app's media store (read-only) ----
  function openAppDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('lsc2_media');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('cannot open lsc2_media'));
    });
  }

  async function scanSessions() {
    el('sessionSel').innerHTML = '<option>Scanning…</option>';
    let db;
    try { db = await openAppDb(); }
    catch (e) { el('sessionSel').innerHTML = '<option>IndexedDB unavailable</option>'; log('ERROR ' + e.message); return; }

    if (!db.objectStoreNames.contains('media')) {
      el('sessionSel').innerHTML = '<option>No media store — capture something first</option>';
      db.close(); return;
    }

    const all = await new Promise((resolve, reject) => {
      const r = db.transaction('media', 'readonly').objectStore('media').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
    db.close();

    const bySession = new Map();
    for (const rec of all) {
      if (rec.category !== 'panorama-360-source' || !rec.sessionId) continue;
      if (!bySession.has(rec.sessionId)) bySession.set(rec.sessionId, []);
      bySession.get(rec.sessionId).push(rec);
    }

    sessions = [...bySession.entries()]
      .map(([id, recs]) => ({
        id,
        records: recs.sort((a, b) => (a.order || 0) - (b.order || 0)),
        hasPose: recs.every(r => typeof r.yaw === 'number'),
        createdAt: Math.min(...recs.map(r => r.createdAt || 0))
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    if (!sessions.length) {
      el('sessionSel').innerHTML = '<option>No 360 capture sessions found</option>';
      el('runBtn').disabled = true;
      log('No panorama-360-source records in IndexedDB. Capture a 360 in the app first.');
      return;
    }

    el('sessionSel').innerHTML = sessions.map((s, i) =>
      '<option value="' + i + '">' + s.id + ' — ' + s.records.length + ' shots' +
      (s.hasPose ? '' : ' (NO POSE DATA)') +
      (s.createdAt ? ' — ' + new Date(s.createdAt).toLocaleString() : '') + '</option>').join('');
    el('runBtn').disabled = false;
    log('Found ' + sessions.length + ' session(s).');
  }

  // ---- main run ----
  async function run() {
    const sess = sessions[Number(el('sessionSel').value) || 0];
    if (!sess) return;
    el('runBtn').disabled = true;
    logEl.textContent = '';
    current = null;
    log('Session ' + sess.id + ' — ' + sess.records.length + ' shots');

    if (!sess.hasPose) {
      log('WARNING: some shots have no recorded orientation. The prior gate and');
      log('bundle adjustment both depend on it; results will be unreliable.');
    }

    const maxSide = Number(el('maxSide').value);
    const useGate = el('gated').checked;

    try {
      el('ortStatus').textContent = 'runtime: loading…';
      const t0 = performance.now();
      // lab-boot.js is a deferred module, so on a very fast click it may
      // not have run yet.
      for (let i = 0; i < 100 && !window.ort; i++) await new Promise(r => setTimeout(r, 50));
      await XF.init({
        maxSide, ort: window.ort,
        modelUrl: '../vendor/xfeat.onnx', wasmPaths: '../vendor/'
      });
      el('ortStatus').innerHTML = 'runtime: <span class="good">ready</span> (wasm, 1 thread)';
      log('onnxruntime-web ready in ' + Math.round(performance.now() - t0) + ' ms');
      log('crossOriginIsolated=' + self.crossOriginIsolated + ' (false is expected on GitHub Pages)');
    } catch (e) {
      el('ortStatus').innerHTML = 'runtime: <span class="bad">failed</span>';
      log('ERROR loading runtime: ' + e.message);
      el('runBtn').disabled = false;
      return;
    }

    // --- extract features ---
    const records = sess.records;
    const features = [];
    const bitmaps = [];
    let inferTotal = 0;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      let bmp;
      try { bmp = await createImageBitmap(rec.blob); }
      catch (e) { log('  shot ' + i + ': unreadable blob, skipped'); features.push(null); bitmaps.push(null); continue; }
      const f = await XF.extract(bmp, { maxSide });
      inferTotal += f.timings.infer;
      features.push(f);
      bitmaps.push(bmp);
      log('  shot ' + String(i).padStart(2) + '  ' + f.width + 'x' + f.height +
        ' -> net ' + f.netWidth + 'x' + f.netHeight +
        '  kp=' + String(f.count).padStart(4) +
        '  infer ' + Math.round(f.timings.infer) + 'ms  post ' + Math.round(f.timings.post) + 'ms');
      progress((i + 1) / records.length * 0.55);
      await new Promise(r => setTimeout(r, 0));  // keep the page responsive
    }

    const valid = features.map((f, i) => f ? i : -1).filter(i => i >= 0);
    if (valid.length < 4) { log('Too few usable shots.'); el('runBtn').disabled = false; return; }
    log('Extraction: ' + Math.round(inferTotal) + ' ms total inference, ' +
      Math.round(inferTotal / valid.length) + ' ms/shot average');

    // --- priors ---
    const W = features[valid[0]].width, H = features[valid[0]].height;
    const priors = records.map((r, i) => ({
      yaw: typeof r.yaw === 'number' ? r.yaw : 0,
      pitch: typeof r.pitch === 'number' ? r.pitch : 0,
      roll: typeof r.roll === 'number' ? r.roll : 0
    }));
    const priorR = priors.map(p => S.fromYawPitchRoll(p.yaw, p.pitch, p.roll));
    const nominalFocal = C.focalFromHFov(68 * C.DEG, W);

    // --- match overlapping pairs ---
    const pairs = P.candidatePairs(priors, {}).filter(pr =>
      features[pr.i] && features[pr.j]);
    log('Matching ' + pairs.length + ' overlapping pairs' + (useGate ? ' (prior-gated)' : ' (exhaustive)') + '…');

    const edgeInputs = [];
    let matchMs = 0, comparisons = 0;
    for (let k = 0; k < pairs.length; k++) {
      const pr = pairs[k];
      const Rrel = S.mul(S.transpose(priorR[pr.j]), priorR[pr.i]);
      const opts = { ratio: 0.92, minScore: 0.5 };
      if (useGate) {
        opts.predict = MM.makePredictor(Rrel, W, H, nominalFocal, S, C);
        opts.searchRadius = Math.max(120, nominalFocal * 9 * C.DEG);
      }
      const t = performance.now();
      const res = MM.match(features[pr.i], features[pr.j], opts);
      matchMs += performance.now() - t;
      comparisons += res.stats.comparisons;
      if (res.matches.length >= 6) {
        edgeInputs.push({ i: pr.i, j: pr.j, matches: res.matches });
      }
      progress(0.55 + (k + 1) / pairs.length * 0.4);
      if (k % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
    log('Matching: ' + Math.round(matchMs) + ' ms, ' +
      (comparisons / 1e6).toFixed(1) + 'M descriptor comparisons, ' +
      edgeInputs.length + ' usable edges');

    // --- geometry ---
    const t2 = performance.now();
    const result = P.refinePoses({ width: W, height: H, priors, edges: edgeInputs }, {});
    const geoMs = performance.now() - t2;
    progress(1);

    if (!result.ok) {
      log('Refinement FAILED: ' + result.reason);
      el('runBtn').disabled = false;
      return;
    }
    log('Geometry: ' + Math.round(geoMs) + ' ms, ' + result.bundle.iterations + ' BA iterations');

    current = { records, features, bitmaps, result, edgeInputs, W, H, priorR };
    render();
    el('runBtn').disabled = false;
  }

  // ---- reporting ----
  function render() {
    const { result, W, H, priorR } = current;
    const rings = P.ringDiagnostics(result.rotations, result.edges);
    const assumedFov = 68;

    const rows = [
      ['Calibrated horizontal FOV', fmt(result.hFovDeg, 2) + '&deg;',
        'app assumes ' + assumedFov + '&deg; &rarr; off by ' + fmt(Math.abs(result.hFovDeg - assumedFov), 2) + '&deg;'],
      ['Focal length', fmt(result.focal, 1) + ' px', 'at ' + W + '&times;' + H],
      ['Match spread (conditioning)', fmt(result.calibration.spread.mean, 2),
        result.calibration.spread.mean < 0.25 ? '<span class="bad">low &mdash; focal estimate weakly constrained</span>' : '<span class="good">adequate</span>'],
      ['Mean pose correction', fmt(result.corrections.meanDeg, 3) + '&deg;', 'vs recorded sensor pose'],
      ['Max pose correction', fmt(result.corrections.maxDeg, 3) + '&deg;', ''],
      ['Edges used', result.edges.length, result.rejected.length + ' rejected'],
      ['RMS edge residual', fmt(result.bundle.rmsEdgeResidualRad * 180 / Math.PI, 4) + '&deg;',
        result.bundle.converged ? '<span class="good">converged</span>' : '<span class="bad">did not converge</span>']
    ];

    for (const name of ['horizon', 'upper', 'lower']) {
      const r = rings[name];
      rows.push(['Loop closure &mdash; ' + name,
        r.measured === null ? '&mdash;' : fmt(r.measured, 3) + '&deg;',
        r.measured === null ? 'ring not fully covered by edges' : 'drift absorbed by BA']);
    }

    el('results').innerHTML = rows.map(r =>
      '<div class="metric"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>' +
      (r[2] ? '<div class="note" style="margin:-4px 0 6px">' + r[2] + '</div>' : '')).join('') +
      '<div style="margin-top:12px"><button class="ghost" id="exportBtn">Export JSON</button></div>';

    el('exportBtn').onclick = exportJson;

    // per-view table
    const tb = el('viewTable').querySelector('tbody');
    const head = '<tr><th>#</th><th class="num">&Delta;yaw</th><th class="num">&Delta;pitch</th>' +
      '<th class="num">&Delta;roll</th><th class="num">kp</th><th class="num">edges</th></tr>';
    const degs = 180 / Math.PI;
    const edgeCount = current.records.map((_, i) =>
      result.edges.filter(e => e.i === i || e.j === i).length);

    tb.innerHTML = head + result.poses.map((p, i) => {
      const pr = S.toYawPitchRoll(priorR[i]);
      let dy = (p.yaw - pr.yaw) * degs;
      while (dy > 180) dy -= 360; while (dy < -180) dy += 360;
      const lonely = edgeCount[i] === 0;
      return '<tr' + (lonely ? ' class="bad"' : '') + '><td>' + i + '</td>' +
        '<td class="num">' + fmt(dy, 2) + '</td>' +
        '<td class="num">' + fmt((p.pitch - pr.pitch) * degs, 2) + '</td>' +
        '<td class="num">' + fmt((p.roll - pr.roll) * degs, 2) + '</td>' +
        '<td class="num">' + (current.features[i] ? current.features[i].count : '—') + '</td>' +
        '<td class="num">' + edgeCount[i] + '</td></tr>';
    }).join('');

    // pair selector
    el('pairSel').innerHTML = result.edges.map((e, k) =>
      '<option value="' + k + '">' + e.i + ' &harr; ' + e.j + '  —  ' +
      e.inlierCount + ' inliers (' + Math.round(e.inlierRatio * 100) + '%)</option>').join('');
    el('pairSel').onchange = drawPair;
    el('showOutliers').onchange = drawPair;
    drawPair();
  }

  function drawPair() {
    if (!current) return;
    const k = Number(el('pairSel').value) || 0;
    const edge = current.result.edges[k];
    if (!edge) return;
    const A = current.bitmaps[edge.i], B = current.bitmaps[edge.j];
    if (!A || !B) return;

    const cv = el('pairCanvas');
    const halfW = cv.width / 2;
    const scale = Math.min(halfW / A.width, cv.height / A.height);
    const dw = A.width * scale, dh = A.height * scale;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#101216';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(A, 0, 0, dw, dh);
    ctx.drawImage(B, halfW, 0, dw, dh);

    const inliers = edge.matches;
    const raw = (current.edgeInputs.find(e => e.i === edge.i && e.j === edge.j) || {}).matches || [];

    if (el('showOutliers').checked) {
      const keep = new Set(inliers.map(m => m.ax + ',' + m.ay));
      ctx.strokeStyle = 'rgba(226,98,107,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const m of raw) {
        if (keep.has(m.ax + ',' + m.ay)) continue;
        ctx.moveTo(m.ax * scale, m.ay * scale);
        ctx.lineTo(halfW + m.bx * scale, m.by * scale);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(78,201,160,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const m of inliers) {
      ctx.moveTo(m.ax * scale, m.ay * scale);
      ctx.lineTo(halfW + m.bx * scale, m.by * scale);
    }
    ctx.stroke();

    el('pairNote').innerHTML = 'view <b>' + edge.i + '</b> &harr; <b>' + edge.j + '</b> &middot; ' +
      raw.length + ' matches proposed, <span class="good">' + edge.inlierCount + ' inliers</span>' +
      (el('showOutliers').checked ? ', <span class="bad">' + (raw.length - edge.inlierCount) + ' rejected</span>' : '') +
      ' &middot; mean residual ' + fmt(edge.meanResidualRad * 180 / Math.PI, 4) + '&deg;';
  }

  function exportJson() {
    const r = current.result;
    const payload = {
      sessionId: sessions[Number(el('sessionSel').value) || 0].id,
      width: current.W, height: current.H,
      calibratedHFovDeg: r.hFovDeg,
      focalPx: r.focal,
      assumedHFovDeg: 68,
      refinedPoses: r.poses,
      priorPoses: current.records.map(rec => ({ yaw: rec.yaw, pitch: rec.pitch, roll: rec.roll })),
      corrections: r.corrections,
      bundle: r.bundle,
      rings: P.ringDiagnostics(r.rotations, r.edges),
      edges: r.edges.map(e => ({ i: e.i, j: e.j, inliers: e.inlierCount, ratio: e.inlierRatio }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'refine_' + payload.sessionId + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  el('reloadBtn').onclick = scanSessions;
  el('runBtn').onclick = () => run().catch(e => { log('ERROR ' + e.message); el('runBtn').disabled = false; });
  scanSessions();
})();
