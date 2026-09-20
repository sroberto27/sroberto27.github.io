/**
 * Minimal XLSX reader, with just enough writing to edit text in place.
 *
 * The catalog is generated from a reviewed workbook, but the application ships
 * no build step and installs no packages, so this reads only the parts of the
 * OOXML format the workbook actually uses: the workbook part, its
 * relationships, the shared string table and each worksheet. Styles, formulas
 * and charts are ignored; only cell values matter here.
 *
 * Producers differ on namespace prefixes, so tag names are normalised before
 * matching and each tag pattern uses a lookahead to avoid matching a longer
 * name that starts with the same letters.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync, deflateRawSync, crc32 } from "node:zlib";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;

/**
 * Element patterns. Each uses a lookahead so a shorter tag name cannot match
 * a longer one, for example <c> against <col>.
 */
const TAG = {
  // Match empty elements first so they cannot consume the following populated cell or row.
  row: /<row(?=[\s/>])[^>]*\/>|<row(?=[\s/>])[^>]*>[\s\S]*?<\/row>/g,
  cell: /<c(?=[\s/>])[^>]*\/>|<c(?=[\s/>])[^>]*>[\s\S]*?<\/c>/g,
  relationship: /<Relationship(?=[\s/>])[^>]*\/>/g,
  sheet: /<sheet(?=[\s/>])[^>]*\/>/g,
};

/** Reads a ZIP container into a map of entry name to Buffer. */
function readZip(filePath) {
  const buf = readFileSync(filePath);
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== END_OF_CENTRAL) end -= 1;
  if (end < 0) throw new Error(`not a zip container: ${filePath}`);

  const entryCount = buf.readUInt16LE(end + 10);
  let offset = buf.readUInt32LE(end + 16);
  const entries = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (buf.readUInt32LE(offset) !== CENTRAL_HEADER) {
      throw new Error("corrupt zip central directory");
    }
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (buf.readUInt32LE(localOffset) !== LOCAL_HEADER) {
      throw new Error(`corrupt zip local header for ${name}`);
    }
    const dataStart =
      localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    entries.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The container's parts, name to inflated bytes, in the order stored. */
export function readParts(filePath) {
  return readZip(filePath);
}

/**
 * Writes parts back as a ZIP container.
 *
 * Everything is deflated and no data descriptors, ZIP64 records or extra
 * fields are produced, which keeps the writer small and is within what the
 * format allows for a workbook of this size. Entry order is preserved,
 * because some consumers read the parts in the order the directory lists them.
 */
export function writeParts(filePath, parts) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of parts) {
    const nameBytes = Buffer.from(name, "utf8");
    const body = Buffer.from(content);
    const deflated = deflateRawSync(body, { level: 9 });
    const checksum = crc32(body);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(1 << 11, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, deflated);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(CENTRAL_HEADER, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(1 << 11, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(deflated.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += 30 + nameBytes.length + deflated.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL, 0);
  end.writeUInt16LE(parts.size, 8);
  end.writeUInt16LE(parts.size, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  writeFileSync(filePath, Buffer.concat([...locals, directory, end]));
}

/**
 * Removes namespace prefixes from tag names so the same patterns work whether
 * a producer writes <row> or <x:row>. Attribute prefixes such as r:id are left
 * alone because they are not in tag-name position.
 */
function normalizeXml(xml) {
  return xml.replace(/^\uFEFF/, "").replace(/<(\/?)[A-Za-z0-9]+:/g, "<$1");
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** Concatenates every <t> run inside a fragment, preserving run order. */
function textRuns(fragment) {
  const matches = fragment.match(/<t(?=[\s/>])[^>]*>([\s\S]*?)<\/t>/g) || [];
  return matches
    .map((run) => decodeXmlEntities(run.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, "")))
    .join("");
}

function readSharedStrings(entries) {
  const part = entries.get("xl/sharedStrings.xml");
  if (!part) return [];
  const xml = normalizeXml(part.toString("utf8"));
  return (xml.match(/<si(?=[\s/>])[\s\S]*?<\/si>/g) || []).map(textRuns);
}

function columnIndex(cellRef) {
  const letters = cellRef.match(/^[A-Z]+/)[0];
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function readSheet(xml, shared) {
  const rows = [];
  for (const rowXml of xml.match(TAG.row) || []) {
    const cells = new Map();
    for (const cellXml of rowXml.match(TAG.cell) || []) {
      const ref = cellXml.match(/\sr="([A-Z]+\d+)"/);
      if (!ref) continue;
      const type = cellXml.match(/\st="(\w+)"/)?.[1] ?? "n";

      let value = "";
      if (type === "inlineStr") {
        value = textRuns(cellXml);
      } else {
        const valueMatch = cellXml.match(/<v(?=[\s/>])[^>]*>([\s\S]*?)<\/v>/);
        if (valueMatch) {
          const raw = decodeXmlEntities(valueMatch[1]);
          value = type === "s" ? shared[Number(raw)] ?? "" : raw;
        }
      }
      cells.set(columnIndex(ref[1]), value);
    }
    if (cells.size === 0) {
      rows.push([]);
      continue;
    }
    const width = Math.max(...cells.keys()) + 1;
    rows.push(Array.from({ length: width }, (_, i) => cells.get(i) ?? ""));
  }
  return rows;
}

/** Reads every worksheet as an array of string rows, keyed by sheet name. */
export function readWorkbook(filePath) {
  const entries = readZip(filePath);
  const shared = readSharedStrings(entries);

  const workbookXml = normalizeXml(entries.get("xl/workbook.xml").toString("utf8"));
  const relsXml = normalizeXml(entries.get("xl/_rels/workbook.xml.rels").toString("utf8"));

  const relTargets = new Map();
  for (const rel of relsXml.match(TAG.relationship) || []) {
    const id = rel.match(/\sId="([^"]+)"/)?.[1];
    const target = rel.match(/\sTarget="([^"]+)"/)?.[1];
    if (id && target) relTargets.set(id, target);
  }

  const sheets = new Map();
  for (const sheet of workbookXml.match(TAG.sheet) || []) {
    const name = decodeXmlEntities(sheet.match(/\sname="([^"]+)"/)?.[1] ?? "");
    const relId = sheet.match(/\sr:id="([^"]+)"/)?.[1];
    let target = (relTargets.get(relId) ?? "").replace(/^\//, "");
    if (!target) continue;
    if (!target.startsWith("xl/")) target = `xl/${target}`;
    const part = entries.get(target);
    if (!part) continue;
    sheets.set(name, readSheet(normalizeXml(part.toString("utf8")), shared));
  }
  return sheets;
}

/**
 * Converts an Excel serial date to an ISO date. The 1900 date system counts
 * from 1899-12-30 because of a deliberate leap-year compatibility offset.
 */
export function excelSerialToISODate(serial) {
  const days = Math.floor(Number(serial));
  return new Date(Date.UTC(1899, 11, 30) + days * 86400000).toISOString().slice(0, 10);
}
