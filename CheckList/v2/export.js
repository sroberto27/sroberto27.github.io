/* ===================== SCOUT EXPORT (ZIP / Folder / PDF) =====================
   Builds one shared "export plan" (PDF blob + relative-path file list + a
   lightweight location.json with no embedded binary) and hands it to either
   a ZIP writer (JSZip, works everywhere Blob download works) or a direct
   folder writer (window.showDirectoryPicker, feature-detected — Chrome/Edge
   desktop & Android only, never claimed elsewhere).
*/
(function (global) {
  'use strict';

  const PAGE = { w: 595.28, h: 841.89, margin: 40 };

  function sanitize(name) {
    return String(name || 'Untitled').trim().replace(/[^a-z0-9\-_ ]+/gi, '').replace(/\s+/g, '_') || 'Untitled';
  }

  function todayStamp(loc) {
    const d = (loc.fields && loc.fields['date-of-scouting']) || new Date().toISOString().slice(0, 10);
    return d;
  }

  function rootFolderName(loc) {
    return `Location_Scout_${sanitize(loc.name)}_${todayStamp(loc)}`;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  const STATUS_LABELS = { pending: 'Pending Review', approved: 'Approved', backup: 'Backup Option', rejected: 'Rejected' };

  function fieldLabel(id) {
    const el = document.querySelector(`label[for="${id}"]`);
    if (el) return el.textContent.trim();
    return id;
  }

  function formatFieldValue(id, value) {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  function extFromMime(mime, fallback) {
    const map = {
      'video/quicktime': '.mov', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
      'image/jpeg': '.jpg', 'image/png': '.png'
    };
    return map[mime] || fallback || '.mp4';
  }

  async function generateVideoPoster(blob) {
    return new Promise(resolve => {
      let done = false;
      const finishOnce = (result) => { if (done) return; done = true; resolve(result); };
      try {
        const url = URL.createObjectURL(blob);
        const v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
        const cleanup = () => URL.revokeObjectURL(url);
        v.addEventListener('loadeddata', () => { try { v.currentTime = Math.min(0.3, (v.duration || 1) / 4); } catch (e) { capture(); } });
        v.addEventListener('seeked', capture);
        v.addEventListener('error', () => { cleanup(); finishOnce(null); });
        function capture() {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = v.videoWidth || 320; canvas.height = v.videoHeight || 180;
            canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(b => { cleanup(); finishOnce(b); }, 'image/jpeg', 0.8);
          } catch (e) { cleanup(); finishOnce(null); }
        }
        setTimeout(() => finishOnce(null), 4000);
      } catch (e) { finishOnce(null); }
    });
  }

  /* ===================== PDF GENERATION ===================== */
  function newDoc() {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: 'pt', format: 'a4' });
  }

  function drawStars(doc, x, y, rating) {
    const r = 5;
    for (let i = 0; i < 5; i++) {
      const cx = x + i * 16;
      doc.setDrawColor(150).setFillColor(i < rating ? '#f5a623' : '#e3e6ec');
      doc.circle(cx, y, r, 'FD');
    }
  }

  function ensureRoom(doc, cursor, needed) {
    if (cursor.y + needed > PAGE.h - PAGE.margin) {
      doc.addPage();
      cursor.y = PAGE.margin;
    }
  }

  function sectionHeading(doc, cursor, text) {
    ensureRoom(doc, cursor, 34);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor('#AD1D28');
    doc.text(text, PAGE.margin, cursor.y);
    doc.setDrawColor('#e3e6ec').line(PAGE.margin, cursor.y + 5, PAGE.w - PAGE.margin, cursor.y + 5);
    cursor.y += 20;
    doc.setTextColor('#000000');
  }

  function writeFieldRow(doc, cursor, cols, colIdx, label, value) {
    const colW = (PAGE.w - PAGE.margin * 2) / cols;
    const x = PAGE.margin + colIdx * colW;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor('#667085');
    doc.text(label.toUpperCase(), x, cursor.y);
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor('#000000');
    const lines = doc.splitTextToSize(String(value), colW - 10);
    doc.text(lines, x, cursor.y + 13);
    return 13 + lines.length * 13 + 10;
  }

  async function layoutImageGrid(doc, cursor, images, opts) {
    opts = opts || {};
    const perRow = opts.perRow || 2;
    const gap = 12;
    const usable = PAGE.w - PAGE.margin * 2;
    const colW = (usable - gap * (perRow - 1)) / perRow;
    let col = 0;
    for (const img of images) {
      const aspect = img.width && img.height ? img.height / img.width : 0.75;
      const h = colW * aspect;
      const rowH = h + 16;
      if (col === 0) ensureRoom(doc, cursor, rowH);
      const x = PAGE.margin + col * (colW + gap);
      try {
        const dataUrl = await blobToDataUrl(img.blob);
        doc.addImage(dataUrl, 'JPEG', x, cursor.y, colW, h, undefined, 'FAST');
      } catch (e) { doc.setFillColor('#f2f4f7').rect(x, cursor.y, colW, h, 'F'); }
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor('#667085');
      doc.text(img.filename || '', x, cursor.y + h + 11);
      col++;
      if (col >= perRow) { col = 0; cursor.y += rowH; }
    }
    if (col !== 0) cursor.y += colW * 0.75 + 16;
    cursor.y += 6;
  }

  async function layoutPanorama(doc, cursor, pano) {
    const usable = PAGE.w - PAGE.margin * 2;
    const h = usable / 2;
    ensureRoom(doc, cursor, h + 40);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor('#000000');
    doc.text('360° Panorama', PAGE.margin, cursor.y);
    cursor.y += 12;
    try {
      const dataUrl = await blobToDataUrl(pano.blob);
      doc.addImage(dataUrl, 'JPEG', PAGE.margin, cursor.y, usable, h, undefined, 'FAST');
    } catch (e) { doc.setFillColor('#f2f4f7').rect(PAGE.margin, cursor.y, usable, h, 'F'); }
    cursor.y += h + 12;
    doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor('#667085');
    doc.text(`${pano.filename || ''} — open the exported JPEG in a 360° viewer to look around.`, PAGE.margin, cursor.y);
    cursor.y += 18;
  }

  async function layoutVideos(doc, cursor, videoLink, videoFiles) {
    ensureRoom(doc, cursor, 20);
    if (videoLink) {
      doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor('#000000');
      doc.text(`Video link: ${videoLink}`, PAGE.margin, cursor.y);
      cursor.y += 18;
    }
    for (const v of videoFiles) {
      const posterH = 90, posterW = 160;
      ensureRoom(doc, cursor, posterH + 34);
      let poster = null;
      try { poster = await generateVideoPoster(v.blob); } catch (e) { poster = null; }
      if (poster) {
        try {
          const dataUrl = await blobToDataUrl(poster);
          doc.addImage(dataUrl, 'JPEG', PAGE.margin, cursor.y, posterW, posterH, undefined, 'FAST');
        } catch (e) { /* skip poster */ }
      } else {
        doc.setFillColor('#f2f4f7').rect(PAGE.margin, cursor.y, posterW, posterH, 'F');
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor('#98a2b3');
        doc.text('Video attached', PAGE.margin + 10, cursor.y + posterH / 2);
      }
      const tx = PAGE.margin + posterW + 14;
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor('#000000');
      doc.text(v.filename || 'video', tx, cursor.y + 16);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor('#667085');
      doc.text(`${v.mime || ''}   ${v.sizeLabel || ''}`, tx, cursor.y + 32);
      cursor.y += posterH + 20;
    }
  }

  async function generateScoutPdf(loc, media) {
    const doc = newDoc();
    const cursor = { y: PAGE.margin };

    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor('#AD1D28');
    doc.text('Location Scouting Report', PAGE.margin, cursor.y + 4);
    cursor.y += 26;
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor('#1f2430');
    doc.text(loc.name || 'Untitled Location', PAGE.margin, cursor.y);
    cursor.y += 16;
    doc.setFontSize(9).setTextColor('#667085');
    doc.text(`Scouted ${todayStamp(loc)}${loc.fields && loc.fields['scouted-by'] ? ' by ' + loc.fields['scouted-by'] : ''}`, PAGE.margin, cursor.y);
    cursor.y += 20;

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor('#000000');
    doc.text(`Status: ${STATUS_LABELS[loc.status] || 'Not set'}`, PAGE.margin, cursor.y);
    doc.text('Suitability:', PAGE.margin + 200, cursor.y);
    drawStars(doc, PAGE.margin + 260, cursor.y - 4, loc.rating || 0);
    cursor.y += 24;

    (global.LSCApp.SECTION_META).forEach(sec => {
      sectionHeading(doc, cursor, `${sec.n}. ${sec.name}`);
      const textFields = sec.fields.filter(id => !global.LSCApp.MEDIA_FIELD_SET.has(id));
      const cols = 2;
      for (let i = 0; i < textFields.length; i += cols) {
        const rowFields = textFields.slice(i, i + cols);
        ensureRoom(doc, cursor, 45);
        let maxH = 0;
        rowFields.forEach((id, idx) => {
          const h = writeFieldRow(doc, cursor, cols, idx, fieldLabel(id), formatFieldValue(id, loc.fields[id]));
          maxH = Math.max(maxH, h);
        });
        cursor.y += maxH;
      }
      cursor.y += 4;
    });

    sectionHeading(doc, cursor, 'Photographic Documentation');
    if (media['wide-angle'].length) {
      doc.setFont('helvetica', 'bold').setFontSize(10).text('Wide-angle Photos', PAGE.margin, cursor.y);
      cursor.y += 14;
      await layoutImageGrid(doc, cursor, media['wide-angle']);
    }
    if (media['close-up'].length) {
      ensureRoom(doc, cursor, 20);
      doc.setFont('helvetica', 'bold').setFontSize(10).text('Close-up Photos', PAGE.margin, cursor.y);
      cursor.y += 14;
      await layoutImageGrid(doc, cursor, media['close-up']);
    }
    if (media['panorama-360'].length) {
      for (const pano of media['panorama-360']) await layoutPanorama(doc, cursor, pano);
    }
    if ((loc.fields && loc.fields['video-link']) || media.video.length) {
      ensureRoom(doc, cursor, 20);
      doc.setFont('helvetica', 'bold').setFontSize(10).text('Video Walkthrough', PAGE.margin, cursor.y);
      cursor.y += 14;
      await layoutVideos(doc, cursor, loc.fields && loc.fields['video-link'], media.video);
    }

    return doc.output('blob');
  }

  /* ===================== EXPORT PLAN (shared by ZIP + Folder) ===================== */
  function sizeLabel(bytes) {
    if (!bytes) return '';
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  }

  async function loadLocationMedia(loc) {
    const out = { 'wide-angle': [], 'close-up': [], 'panorama-360': [], 'video': [] };
    const refs = (loc.media) || {};
    for (const cat of Object.keys(out)) {
      for (const id of (refs[cat] || [])) {
        const rec = await global.LSCMedia.getMedia(id);
        if (rec && rec.blob) { rec.sizeLabel = sizeLabel(rec.blob.size); out[cat].push(rec); }
      }
    }
    return out;
  }

  async function buildExportPlan(loc, opts) {
    opts = opts || {};
    const root = rootFolderName(loc);
    const media = await loadLocationMedia(loc);
    const files = [];
    const jsonMedia = { 'wide-angle': [], 'close-up': [], 'panorama-360': [], 'video': [] };

    media['wide-angle'].forEach((rec, i) => {
      const name = `wide-angle_${String(i + 1).padStart(3, '0')}.jpg`;
      const rel = `images/wide-angle/${name}`;
      files.push({ relativePath: rel, blob: rec.blob });
      jsonMedia['wide-angle'].push({ filename: name, relativePath: rel, width: rec.width, height: rec.height });
    });
    media['close-up'].forEach((rec, i) => {
      const name = `close-up_${String(i + 1).padStart(3, '0')}.jpg`;
      const rel = `images/close-up/${name}`;
      files.push({ relativePath: rel, blob: rec.blob });
      jsonMedia['close-up'].push({ filename: name, relativePath: rel, width: rec.width, height: rec.height });
    });
    for (let i = 0; i < media['panorama-360'].length; i++) {
      const rec = media['panorama-360'][i];
      const name = `panorama_${String(i + 1).padStart(3, '0')}.jpg`;
      const rel = `images/360/${name}`;
      files.push({ relativePath: rel, blob: rec.blob });
      const sources = [];
      if (rec.sessionId) {
        const all = await global.LSCMedia.getBySession(rec.sessionId);
        const srcRecs = all.filter(r => r.category === 'panorama-360-source').sort((a, b) => (a.order || 0) - (b.order || 0));
        srcRecs.forEach((s, si) => {
          const sname = s.filename || `source_${String(si + 1).padStart(3, '0')}.jpg`;
          const srel = `images/360/sources/panorama_${String(i + 1).padStart(3, '0')}/${sname}`;
          files.push({ relativePath: srel, blob: s.blob });
          sources.push({ filename: sname, relativePath: srel, yaw: s.yaw, pitch: s.pitch, roll: s.roll, order: s.order, timestamp: s.createdAt });
        });
      }
      jsonMedia['panorama-360'].push({ filename: name, relativePath: rel, width: rec.width, height: rec.height, sessionId: rec.sessionId, sources });
    }
    media.video.forEach((rec, i) => {
      const ext = extFromMime(rec.mime, rec.originalFilename && /\.\w+$/.test(rec.originalFilename) ? rec.originalFilename.match(/\.\w+$/)[0] : '.mp4');
      const name = `walkthrough_${String(i + 1).padStart(3, '0')}${ext}`;
      const rel = `videos/${name}`;
      files.push({ relativePath: rel, blob: rec.blob });
      jsonMedia.video.push({ filename: name, relativePath: rel, mime: rec.mime, originalFilename: rec.originalFilename });
    });

    let pdfBlob = null;
    if (!opts.skipPdf) {
      try { pdfBlob = await generateScoutPdf(loc, media); } catch (e) { pdfBlob = null; }
    }
    const pdfName = `${root}.pdf`;
    if (pdfBlob) files.push({ relativePath: pdfName, blob: pdfBlob });

    const locationJson = {
      id: loc.id, name: loc.name, createdAt: loc.createdAt, updatedAt: loc.updatedAt,
      fields: loc.fields, rating: loc.rating, status: loc.status,
      media: jsonMedia, exportedAt: Date.now()
    };
    const jsonBlob = new Blob([JSON.stringify(locationJson, null, 2)], { type: 'application/json' });
    files.push({ relativePath: 'data/location.json', blob: jsonBlob });

    return { root, files, pdfBlob, pdfMissing: !pdfBlob && !opts.skipPdf };
  }

  /* ===================== ZIP EXPORT ===================== */
  async function exportZip(loc) {
    if (typeof JSZip === 'undefined') throw new Error('ZIP library failed to load');
    const plan = await buildExportPlan(loc);
    const zip = new JSZip();
    const rootFolder = zip.folder(plan.root);
    plan.files.forEach(f => rootFolder.file(f.relativePath, f.blob));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${plan.root}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return plan;
  }

  /* ===================== FOLDER EXPORT ===================== */
  function folderExportSupported() {
    return 'showDirectoryPicker' in window;
  }

  async function writeFileInDir(dirHandle, relativePath, blob) {
    const parts = relativePath.split('/');
    const fileName = parts.pop();
    let dir = dirHandle;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async function exportFolder(loc) {
    if (!folderExportSupported()) throw new Error('UNSUPPORTED');
    const plan = await buildExportPlan(loc);
    let handle;
    try {
      handle = await window.showDirectoryPicker();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('CANCELLED');
      throw e;
    }
    const root = await handle.getDirectoryHandle(plan.root, { create: true });
    for (const f of plan.files) await writeFileInDir(root, f.relativePath, f.blob);
    return plan;
  }

  /* ===================== DIRECT PDF DOWNLOAD ===================== */
  async function exportPdfOnly(loc) {
    const media = await loadLocationMedia(loc);
    const blob = await generateScoutPdf(loc, media);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${rootFolderName(loc)}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return blob;
  }

  global.LSCExport = {
    generateScoutPdf, loadLocationMedia, buildExportPlan,
    exportZip, exportFolder, exportPdfOnly, folderExportSupported,
    rootFolderName, sanitize
  };
})(window);
