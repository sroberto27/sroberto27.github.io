/* Minimal image utilities for the offline stitch evaluation: PNG writing
   (so results can actually be looked at, not just scored) and the
   quality metrics. No dependencies beyond node's zlib. */
const zlib = require('zlib');
const fs = require('fs');

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c;
  }
  return CRC_TABLE;
}

function crc32(buf) {
  const t = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

/** rgb: Float32Array(W*H*3) in 0..1 */
function writePNG(filePath, rgb, W, H) {
  const raw = Buffer.alloc(H * (W * 3 + 1));
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;                                  // filter: none
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        let v = rgb[i + c];
        v = v <= 0 ? 0 : (v >= 1 ? 1 : v);
        raw[o++] = Math.round(v * 255);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

/* Metrics are computed ONLY over pixels an actual view covered. Including
   uncovered sky/floor gaps would let a stitch that simply covers less of
   the sphere score better, which is backwards. */
function psnr(a, b, mask, n) {
  let se = 0, count = 0;
  for (let p = 0; p < n; p++) {
    if (mask && !mask[p]) continue;
    for (let c = 0; c < 3; c++) {
      const d = a[p * 3 + c] - b[p * 3 + c];
      se += d * d;
    }
    count += 3;
  }
  if (!count) return 0;
  const mse = se / count;
  return mse <= 1e-12 ? 99 : 10 * Math.log10(1 / mse);
}

function toGray(rgb, n) {
  const g = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    g[p] = 0.299 * rgb[p * 3] + 0.587 * rgb[p * 3 + 1] + 0.114 * rgb[p * 3 + 2];
  }
  return g;
}

/** Mean SSIM over 8x8 windows, restricted to fully covered windows. */
function ssim(a, b, mask, W, H) {
  const ga = toGray(a, W * H), gb = toGray(b, W * H);
  const C1 = 0.01 * 0.01, C2 = 0.03 * 0.03;
  const win = 8;
  let total = 0, count = 0;

  for (let y = 0; y + win <= H; y += win) {
    for (let x = 0; x + win <= W; x += win) {
      let ok = true;
      let ma = 0, mb = 0;
      for (let j = 0; j < win && ok; j++) {
        for (let i = 0; i < win; i++) {
          const p = (y + j) * W + x + i;
          if (mask && !mask[p]) { ok = false; break; }
          ma += ga[p]; mb += gb[p];
        }
      }
      if (!ok) continue;
      const nWin = win * win;
      ma /= nWin; mb /= nWin;
      let va = 0, vb = 0, cov = 0;
      for (let j = 0; j < win; j++) {
        for (let i = 0; i < win; i++) {
          const p = (y + j) * W + x + i;
          const da = ga[p] - ma, db = gb[p] - mb;
          va += da * da; vb += db * db; cov += da * db;
        }
      }
      va /= nWin - 1; vb /= nWin - 1; cov /= nWin - 1;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) /
               ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return count ? total / count : 0;
}

module.exports = { writePNG, psnr, ssim };
