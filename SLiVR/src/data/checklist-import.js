import { QUESTIONS } from "../scouting/assessment-template.js";
import { newAssessment, MEDIA_LIMIT, MEDIA_TOTAL_LIMIT } from "../domain/scout-assessment.js";
import { newId } from "../domain/ids.js";
let zipLoading;
async function zipLibrary() {
 if (globalThis.JSZip) return globalThis.JSZip;
 zipLoading ??= new Promise((resolve, reject) => { const s = document.createElement("script"); s.src = new URL("../../vendor/jszip-3.10.1.min.js", import.meta.url).href; s.onload = () => resolve(globalThis.JSZip); s.onerror = () => { zipLoading = null; reject(new Error("ZIP reader could not load.")); }; document.head.append(s); });
 return zipLoading;
}
export async function readLegacyFile(file) {
 if (file.size > MEDIA_TOTAL_LIMIT) throw new Error("Import file exceeds 48 MiB.");
 if (!file.name.toLowerCase().endsWith(".zip")) return { location: JSON.parse(await file.text()), files: new Map() };
 const Zip = await zipLibrary(), zip = await Zip.loadAsync(await file.arrayBuffer());
 const entries = Object.values(zip.files).filter(f => !f.dir);
 if (entries.length > 300 || entries.some(f => f.unsafeOriginalName?.split(/[\\/]/).includes("..")) || entries.reduce((n, f) => n + (f._data?.uncompressedSize ?? Infinity), 0) > MEDIA_TOTAL_LIMIT) throw new Error("Unsafe or oversized ZIP package.");
 const manifests = entries.filter(f => /(?:^|\/)data\/location\.json$/.test(f.name));
 if (manifests.length !== 1) throw new Error("Package must contain one data/location.json manifest.");
 const manifest = manifests[0], base = manifest.name.slice(0, -"data/location.json".length), location = JSON.parse(await manifest.async("string")), files = new Map();
 for (const items of Object.values(location.media ?? {})) for (const item of items ?? []) {
  if (!item?.relativePath || item.relativePath.split(/[\\/]/).includes("..")) continue;
  const entry = zip.file(base + item.relativePath); if (entry) { if (entry._data.uncompressedSize > MEDIA_LIMIT) throw new Error("Attachment exceeds 16 MiB."); files.set(item.relativePath, await entry.async("uint8array")); }
 }
 return { location, files };
}
export function previewChecklist({ location, files = new Map() }, { projectId, locationId, catalogVersion, now }) {
 if (!location || !location.fields || typeof location.fields !== "object" || Array.isArray(location.fields)) throw new Error("Expected a single-location checklist JSON.");
 const assessment = newAssessment({ id: newId("assessment"), projectId, locationId, catalogVersion, now, title: String(location.name ?? "Imported checklist").slice(0, 200), sourceKind: "other" });
 const report = { excludedFields: Object.keys(location.fields).filter(id => !QUESTIONS.some(q => q.id === id)), ambiguousDefaults: [], missingMedia: [], legacyStatus: String(location.status ?? "").slice(0, 100), legacyRating: String(location.rating ?? "").slice(0, 100) };
 for (const answer of assessment.answers) {
  const q = QUESTIONS.find(q => q.id === answer.questionId), value = location.fields[q.id];
  if (value === undefined || value === null || value === "") continue;
  if (typeof value !== (q.type === "text" ? "string" : q.type) || (q.type === "number" && (!Number.isInteger(value) || value < 0))) continue;
  if ((value === false || value === 0) && !location.touched?.[q.id]) { report.ambiguousDefaults.push(q.id); answer.state = "needs-validation"; continue; }
  answer.state = "observed"; answer[q.type === "text" ? "textValue" : q.type + "Value"] = value;
 }
 const media = [];
 for (const [category, items] of Object.entries(location.media ?? {})) for (const item of Array.isArray(items) ? items : []) {
  const path = typeof item === "object" ? item.relativePath : null, bytes = files.get(path);
  if (!bytes) {
   report.missingMedia.push(typeof item === "string" ? item : path ?? "Unavailable attachment");
   const missing = { id: newId("scoutMedia"), projectId, locationId, filename: "Unavailable legacy attachment", mime: "application/octet-stream", size: 0, kind: category === "video" ? "video" : category === "panorama-360" ? "panorama" : "photo", provenance: "Legacy reference without recoverable bytes; original media type unknown", createdAt: now, missing: true };
   media.push(missing); const target = assessment.answers.find(a => a.questionId === (category === "panorama-360" ? "wide-angle" : category)); if (target) target.mediaIds.push(missing.id);
   continue;
  }
  const mime = item.mime ?? (/\.png$/i.test(path) ? "image/png" : /\.webp$/i.test(path) ? "image/webp" : /\.mp4$/i.test(path) ? "video/mp4" : /\.webm$/i.test(path) ? "video/webm" : "image/jpeg");
  let binary = ""; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const record = { id: newId("scoutMedia"), projectId, locationId, filename: String(item.filename ?? "Imported media").slice(0, 255), mime, size: bytes.length, kind: category === "video" ? "video" : category === "panorama-360" ? "panorama" : "photo", provenance: "Imported from supplied checklist package", createdAt: now, data: btoa(binary), blob: new Blob([bytes], { type: mime }), missing: false };
  media.push(record); const answer = assessment.answers.find(a => a.questionId === (category === "panorama-360" ? "wide-angle" : category)); if (answer) answer.mediaIds.push(record.id);
 }
 assessment.sourceNote = "Imported checklist. Legacy ratings/status are not candidate decisions. Review ambiguous defaults and missing media.";
 return { assessment, media, report };
}
