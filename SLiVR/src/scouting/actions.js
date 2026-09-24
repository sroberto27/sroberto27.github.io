import { flushDrafts } from "./autosave.js";
import { validateRecord } from "../data/workspace-repo.js";
import { newId } from "../domain/ids.js";
import { newAssessment, assessmentErrors, MEDIA_LIMIT, MEDIA_TOTAL_LIMIT, MEDIA_MIMES, scoutingReferenceErrors } from "../domain/scout-assessment.js";
export function createScoutingActions({ store, repo, persist, now, notice, rememberWorkspace = () => {} }) {
 const state = () => store.getState();
 const bundle = () => state().workingBundle;
 const set = patch => store.setState(patch);
 let queue = Promise.resolve();
 function save(next) {
  const errors = [...scoutingReferenceErrors(next), ...Object.entries(next).flatMap(([name, records]) => records.flatMap(record => validateRecord(name, record).errors))];
  if (errors.length) { notice(errors.map(e => e.reason).join("; ")); return Promise.resolve({ ok: false }); }
  set({ workingBundle: next });
  queue = queue.then(() => persist(() => repo.saveScouting(next)));
  return queue;
 }
 function snapshot(next, assessment) {
  return { ...next, scoutAssessments: [...next.scoutAssessments.filter(a => a.id !== assessment.id), assessment],
   scoutAssessmentRevisions: [...next.scoutAssessmentRevisions, { id: newId("assessmentRevision"), assessmentId: assessment.id, projectId: assessment.projectId, locationId: assessment.locationId, revision: assessment.revision, snapshot: structuredClone(assessment) }] };
 }
 async function importChecklistPreview(preview) {
  const b = bundle(); if (preview.assessment.projectId !== b?.projects[0]?.id) return { ok: false };
  if (assessmentErrors(preview.assessment).length) return { ok: false };
  const next = snapshot({ ...b, scoutMedia: [...b.scoutMedia, ...preview.media] }, preview.assessment);
  const errors = [...scoutingReferenceErrors(next), ...Object.entries(next).flatMap(([name, records]) => records.flatMap(record => validateRecord(name, record).errors))];
  if (errors.length) { notice(errors.map(e => e.reason).join("; ")); return { ok: false }; }
  const result = await persist(async () => { const written = await repo.saveScouting(next); set({ workingBundle: next }); return written; });
  if (result.ok) set({ activeAssessmentId: preview.assessment.id }); return result;
 }
 async function createAssessment(candidateId) {
  await flushDrafts(); if (["failed","saving"].includes(state().save.state)) { notice("Retry the pending save before changing assessments."); return {ok:false}; }
  const b = bundle(), c = b?.candidates.find(c => c.id === candidateId); if (!c) return { ok: false };
  const a = newAssessment({ id: newId("assessment"), projectId: c.projectId, locationId: c.locationId, catalogVersion: c.catalogVersion, now: now() });
  if (c.captureId) a.captureId = c.captureId;
  set({ activeAssessmentId: a.id }); const result = await save(snapshot(b, a)); rememberWorkspace(); return { ...result, assessment: a };
 }
 async function openAssessment(id) { await flushDrafts(); if (state().save.state === "failed") { notice("Retry the pending save before closing or changing assessments."); return; } if (!id || bundle()?.scoutAssessments.some(a => a.id === id)) { set({ activeAssessmentId: id }); rememberWorkspace(); } }
 async function updateAssessment(id, fields) {
  const b = bundle(), old = b?.scoutAssessments.find(a => a.id === id); if (!old) return { ok: false };
  if (Object.keys(fields).some(k => !["title", "observationDate", "sourceKind", "sourceNote", "answers", "archived"].includes(k))) return { ok: false };
  const a = { ...old, ...fields, revision: old.revision + 1, updatedAt: now() };
  const errors = assessmentErrors(a); if (errors.length) { notice(errors.map(e => `${e.path}: ${e.reason}`).join("; ")); return { ok: false }; }
  return save(snapshot(b, a));
 }
 async function attachMedia(id, questionId, file, kind) {
  const old = bundle()?.scoutAssessments.find(a => a.id === id); if (!old) return { ok: false };
  if (file.type === "application/octet-stream" || !MEDIA_MIMES.includes(file.type) || !file.size || file.size > MEDIA_LIMIT || (kind === "video") !== file.type.startsWith("video/")) { notice("Choose a JPEG, PNG, WebP, MP4 or WebM file, up to 16 MiB, with the matching media kind."); return { ok: false }; }
  let dimensions = {};
  if (file.type.startsWith("image/") && typeof createImageBitmap === "function") {
    try { const image = await createImageBitmap(file); dimensions = { width: image.width, height: image.height }; image.close();
      if (dimensions.width * dimensions.height > 64000000) throw new Error("Image exceeds 64 million pixels.");
    } catch (error) { notice(`Image could not be attached: ${error.message}`); return { ok: false }; }
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bundle()?.scoutAssessments.some(a => a.id === id) || bundle().projects[0].id !== old.projectId) return { ok: false };
  if (bundle().scoutMedia.reduce((n, m) => n + m.size, 0) + bytes.length > MEDIA_TOTAL_LIMIT) { notice("Project media limit is 48 MiB. Nothing attached."); return { ok: false }; }
  let binary = ""; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const media = { id: newId("scoutMedia"), projectId: old.projectId, locationId: old.locationId, filename: file.name.slice(0, 255), ...dimensions, mime: file.type, size: bytes.length, kind,
   provenance: "User supplied file; not captured from provider", createdAt: now(), data: btoa(binary), blob: new Blob([bytes], { type: file.type }), missing: false };
  const b = bundle(), a = b.scoutAssessments.find(a => a.id === id);
  const updated = { ...a, answers: a.answers.map(answer => answer.questionId === questionId ? { ...answer, mediaIds: [...answer.mediaIds, media.id] } : answer), revision: a.revision + 1, updatedAt: now() };
  return save(snapshot({ ...b, scoutMedia: [...b.scoutMedia, media] }, updated));
 }
 async function evaluateCandidate(id, evaluations) {
  const b = bundle(), old = b?.candidates.find(c => c.id === id); if (!old) return { ok: false };
  const c = { ...old, evaluations, updatedAt: now(), revision: old.revision + 1 };
  return save({ ...b, candidates: b.candidates.map(item => item.id === id ? c : item) });
 }
 async function decideScene(sceneId, { preferredCandidateId, backupCandidateIds, rationale, openQuestions = "" }) {
  const b = bundle(), scene = b?.scenes.find(s => s.id === sceneId), ids = [preferredCandidateId, ...backupCandidateIds];
  if (!scene || !rationale.trim() || !backupCandidateIds.length || new Set(ids).size !== ids.length || ids.some(id => !b.candidates.some(c => c.id === id && c.sceneId === sceneId))) { notice("Choose a preferred location, a different backup, and a rationale."); return { ok: false }; }
  const decision = { preferredCandidateId, backupCandidateIds, rationale, openQuestions, decidedAt: now(), candidateSnapshots: b.candidates.filter(c => c.sceneId === sceneId).map(c => structuredClone(c)) };
  return save({ ...b, scenes: b.scenes.map(s => s.id === sceneId ? { ...s, decisions: [...(s.decisions ?? []), decision], updatedAt: now(), revision: s.revision + 1 } : s),
   candidates: b.candidates.map(c => c.sceneId !== sceneId ? c : { ...c, status: c.id === preferredCandidateId ? "preferred" : backupCandidateIds.includes(c.id) ? "backup" : ["preferred", "backup"].includes(c.status) ? "shortlisted" : c.status, revision: c.revision + 1, updatedAt: now() }) });
 }
 async function linkShot(candidateId) {
  const b = bundle(), c = b?.candidates.find(c => c.id === candidateId); if (!c) return { ok: false };
  const existing = b.shotScenes.find(s => s.candidateId === c.id); if (existing) return { ok: true, shotScene: existing };
  const location = state().catalog.locations.find(l => l.id === c.locationId);
  const shot = { id: newId("shotScene"), projectId: c.projectId, sceneId: c.sceneId, candidateId: c.id, locationId: c.locationId, catalogVersion: c.catalogVersion,
   name: `Shot workspace: ${location.name}`.slice(0,160), origin: { lon: location.position[0], lat: location.position[1], groundElevationM: 0, elevationDatum: "Schematic zero; not surveyed" }, northOffsetDeg: 0, units: "metric", backgroundRef: { kind: "grid" }, calibration: { accuracyMode: "schematic", method: "Catalog planning point only" }, frameVersion: 1, createdAt: now(), updatedAt: now(), revision: 1 };
  return { ...await save({ ...b, shotScenes: [...b.shotScenes, shot] }), shotScene: shot };
 }
 async function reopenDecision(sceneId) {
  const b = bundle(), scene = b?.scenes.find(s => s.id === sceneId); if (!scene?.decisions?.length) return { ok: false };
  return save({ ...b, scenes: b.scenes.map(s => s.id === sceneId ? { ...s, revision: s.revision + 1, updatedAt: now(), decisions: s.decisions.map((d, i) => i === s.decisions.length - 1 ? { ...d, reopenedAt: now() } : d) } : s) });
 }
 return { linkShot, importChecklistPreview, createAssessment, openAssessment, updateAssessment, attachMedia, evaluateCandidate, decideScene, reopenDecision, flushScouting: () => queue };
}
