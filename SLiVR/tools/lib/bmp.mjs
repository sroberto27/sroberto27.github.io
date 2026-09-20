/**
 * Minimal BMP reader for the imagery probe.
 *
 * The imagery service renders the same raster to several formats. The probe
 * asks for uncompressed 24-bit BMP because it decodes to exact pixels in a few
 * lines with nothing installed, which is what lets the coverage check inspect
 * content rather than trust a status code. Production requests still use JPEG,
 * which is roughly twenty times smaller for the same tile.
 *
 * Only the uncompressed cases these services return are supported: 24 bits
 * per pixel from the image services, and 32 bits per pixel from the map
 * service, whose fourth byte is alpha and is ignored. Anything else is
 * rejected rather than guessed at, because a misread header would produce
 * plausible pixel statistics from nonsense.
 */

const FILE_HEADER = 14;

/**
 * Decodes an uncompressed 24- or 32-bit BMP to RGB.
 *
 * @param {Buffer|Uint8Array} bytes
 * @returns {{width: number, height: number, channels: 3, data: Uint8Array}}
 *   `data` is RGB, top row first.
 */
export function decodeBmp(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length < FILE_HEADER + 40) throw new Error("not a BMP: too short");
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) throw new Error("not a BMP: bad signature");

  const pixelOffset = buffer.readUInt32LE(10);
  const headerSize = buffer.readUInt32LE(14);
  if (headerSize < 40) throw new Error(`unsupported DIB header size ${headerSize}`);

  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);

  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new Error(`unsupported bit depth ${bitsPerPixel}`);
  }
  // 0 is BI_RGB. 3 is BI_BITFIELDS, which 32-bit writers use for plain BGRA.
  if (compression !== 0 && !(compression === 3 && bitsPerPixel === 32)) {
    throw new Error(`unsupported compression ${compression}`);
  }
  if (width <= 0 || rawHeight === 0) throw new Error(`unusable dimensions ${width}x${rawHeight}`);

  const height = Math.abs(rawHeight);
  // A positive height means the rows are stored bottom-up.
  const bottomUp = rawHeight > 0;
  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = ((width * bytesPerPixel + 3) >> 2) << 2;

  if (buffer.length < pixelOffset + rowStride * height) {
    throw new Error("BMP pixel data is shorter than its header declares");
  }

  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = bottomUp ? height - 1 - y : y;
    let source = pixelOffset + sourceRow * rowStride;
    let target = y * width * 3;
    for (let x = 0; x < width; x += 1) {
      // BMP stores blue, green, red, and for 32 bpp an alpha byte that the
      // coverage statistics do not use.
      data[target] = buffer[source + 2];
      data[target + 1] = buffer[source + 1];
      data[target + 2] = buffer[source];
      source += bytesPerPixel;
      target += 3;
    }
  }

  return { width, height, channels: 3, data };
}

/** Builds a 24-bit BMP, used to exercise the reader against known pixels. */
export function encodeBmp({ width, height, data }) {
  const rowStride = ((width * 3 + 3) >> 2) << 2;
  const pixelBytes = rowStride * height;
  const buffer = Buffer.alloc(FILE_HEADER + 40 + pixelBytes);

  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(FILE_HEADER + 40, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelBytes, 34);

  for (let y = 0; y < height; y += 1) {
    let source = y * width * 3;
    let target = FILE_HEADER + 40 + (height - 1 - y) * rowStride;
    for (let x = 0; x < width; x += 1) {
      buffer[target] = data[source + 2];
      buffer[target + 1] = data[source + 1];
      buffer[target + 2] = data[source];
      source += 3;
      target += 3;
    }
  }

  return buffer;
}
