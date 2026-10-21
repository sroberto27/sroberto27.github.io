import { parseEnvelope, serializeEnvelope } from "../data/transfer.js";
import { zipLibrary } from "../data/checklist-import.js";
import { MEDIA_LIMIT } from "../domain/scout-assessment.js";

export const PACKAGE_LIMIT = 128 * 1024 * 1024;
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_./-]+$/.test(path)
  && !path.startsWith("/") && !path.split("/").some(part => !part || part === "." || part === "..");

/** Package paths are generated independently of user filenames. */
export async function projectZip(text, Zip = null) {
  const checked = parseEnvelope(text);
  if (!checked.ok) throw new Error(checked.error.message);
  const envelope = JSON.parse(text), files = [];
  const zip = new (Zip ?? await zipLibrary())();
  const mediaIds = new Set(envelope.payload.scoutMedia.map(m => m.id));
  envelope.assetsInline = (envelope.assetsInline ?? []).filter(asset => {
    if (!mediaIds.has(asset.assetId)) return true;
    const path = `media/${files.length + 1}.bin`;
    files.push({ assetId: asset.assetId, path });
    zip.file(path, asset.data, { base64: true });
    return false;
  });
  zip.file("project.json", serializeEnvelope(envelope));
  zip.file("package.json", JSON.stringify({ kind: "slivr-media-package", version: 1, files }));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  if (bytes.byteLength > PACKAGE_LIMIT) throw new Error("Package exceeds 128 MiB. Export fewer attachments or use JSON.");
  return bytes;
}

/** Recover bytes before passing the canonical file to the atomic import path. */
export async function readProjectFile(file, Zip = null) {
  if (file.size > PACKAGE_LIMIT) throw new Error("Project file exceeds 128 MiB.");
  if (!file.name.toLowerCase().endsWith(".zip")) return file.text();
  const library = Zip ?? await zipLibrary();
  const zip = await library.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > 500 || entries.some(entry => !safePath(entry.unsafeOriginalName ?? entry.name))
      || entries.reduce((size, entry) => size + (entry._data?.uncompressedSize ?? Infinity), 0) > PACKAGE_LIMIT) {
    throw new Error("Unsafe or oversized ZIP package.");
  }
  if (!zip.file("package.json") || !zip.file("project.json")) throw new Error("Package needs package.json and project.json.");
  const manifest = JSON.parse(await zip.file("package.json").async("string"));
  const envelope = JSON.parse(await zip.file("project.json").async("string"));
  if (manifest.kind !== "slivr-media-package" || manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error("Unsupported project package.");
  if (!Array.isArray(envelope.payload?.scoutMedia) || !Array.isArray(envelope.assetsInline)) throw new Error("Invalid project manifest.");
  const ids = new Set(), paths = new Set(["package.json", "project.json"]);
  for (const item of manifest.files) {
    if (!safePath(item.path) || !item.path.startsWith("media/") || paths.has(item.path) || ids.has(item.assetId)) throw new Error("Duplicate or unsafe package media reference.");
    const media = envelope.payload.scoutMedia.find(m => m.id === item.assetId);
    if (!media || envelope.assetsInline.some(a => a.assetId === item.assetId)) throw new Error("Package contains unknown or duplicate media.");
    ids.add(item.assetId); paths.add(item.path);
    const entry = zip.file(item.path);
    if (!entry) { media.missing = true; continue; }
    if (entry._data.uncompressedSize > MEDIA_LIMIT) throw new Error("Attachment exceeds 16 MiB.");
    envelope.assetsInline.push({ assetId: item.assetId, encoding: "base64", data: await entry.async("base64") });
  }
  if (entries.some(entry => !paths.has(entry.name))) throw new Error("Package contains undeclared files.");
  for (const media of envelope.payload.scoutMedia) {
    if (!envelope.assetsInline.some(asset => asset.assetId === media.id)) media.missing = true;
  }
  envelope.mediaReport = { complete: envelope.payload.scoutMedia.every(m => !m.missing), missing: envelope.payload.scoutMedia.filter(m => m.missing).map(m => m.id) };
  const text = serializeEnvelope(envelope), checked = parseEnvelope(text);
  if (!checked.ok) throw new Error(checked.error.message);
  return text;
}
