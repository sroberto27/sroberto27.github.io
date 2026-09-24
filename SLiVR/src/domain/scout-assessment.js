import { candidateRecord } from "./candidate.js";
import { defineRecord, validate } from "./schema.js";
import { QUESTIONS, TEMPLATE_VERSION, ANSWER_STATES, SOURCE_KINDS } from "../scouting/assessment-template.js";
const str = (max = 4000, required = false) => ({ type: "string", maxLength: max, required });
const id = kind => ({ type: "workspaceId", kind, required: true });
const common = { projectId: id("project"), locationId: { type: "catalogId", kind: "location", required: true } };
export const assessmentRecord = defineRecord("ScoutAssessment", {
 id: id("assessment"), ...common, captureId: { type: "catalogId", kind: "capture" }, catalogVersion: str(80, true), templateVersion: { type: "enum", values: [TEMPLATE_VERSION], required: true },
 title: { ...str(200, true), minLength: 1 }, observationDate: { type: "isoDate", required: true }, sourceKind: { type: "enum", values: SOURCE_KINDS, required: true },
 sourceNote: str(), createdAt: { type: "isoDate", required: true }, updatedAt: { type: "isoDate", required: true }, revision: { type: "number", integer: true, min: 1, required: true },
 archived: { type: "boolean" }, answers: { type: "array", required: true, of: { type: "object", allowExtra: false, fields: {
 questionId: { type: "enum", values: QUESTIONS.map(q => q.id), required: true }, state: { type: "enum", values: ANSWER_STATES, required: true },
 textValue: str(), numberValue: { type: "number", integer: true, min: 0 }, booleanValue: { type: "boolean" }, note: str(), referenceUrl: { type: "url" },
 bookmarkId: { type: "workspaceId", kind: "bookmark" }, mediaIds: { type: "array", required: true, of: id("scoutMedia") }
 } } }
});
export const assessmentRevisionRecord = defineRecord("ScoutAssessmentRevision", { id: id("assessmentRevision"), ...common,
 assessmentId: id("assessment"), revision: { type: "number", min: 1, integer: true, required: true }, snapshot: { type: "object", fields: {}, required: true } });
export const MEDIA_LIMIT = 16 * 1024 * 1024, MEDIA_TOTAL_LIMIT = 48 * 1024 * 1024;
export const MEDIA_MIMES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "application/octet-stream"];
export const scoutMediaRecord = defineRecord("ScoutMedia", { id: id("scoutMedia"), ...common, filename: str(255, true), mime: { type: "enum", values: MEDIA_MIMES, required: true },
 size: { type: "number", min: 0, max: MEDIA_LIMIT, integer: true, required: true }, kind: { type: "enum", values: ["photo", "video", "panorama"], required: true },
 provenance: str(1000, true), createdAt: { type: "isoDate", required: true }, data: str(Math.ceil(MEDIA_LIMIT / 3) * 4), missing: { type: "boolean" }, width: { type: "number", min: 1 }, height: { type: "number", min: 1 }
});
export function newAssessment({ id, projectId, locationId, catalogVersion, now, title = "Scouting assessment", sourceKind = "virtual-tour" }) {
 return { id, projectId, locationId, catalogVersion, templateVersion: TEMPLATE_VERSION, title, sourceKind, observationDate: now.slice(0, 10), sourceNote: "", createdAt: now, updatedAt: now, revision: 1,
 answers: QUESTIONS.map(q => ({ questionId: q.id, state: "unanswered", mediaIds: [] })) };
}
export function assessmentErrors(record) {
 const errors = validate(assessmentRecord, record).errors;
 if (!Array.isArray(record?.answers)) return errors;
 if (record.answers.length !== QUESTIONS.length || new Set(record.answers.map(a => a?.questionId)).size !== QUESTIONS.length) errors.push({ path: "answers", reason: "must contain every template question exactly once" });
 for (const a of record.answers) {
  const q = QUESTIONS.find(q => q.id === a?.questionId); if (!q) continue;
  const key = q.type === "text" ? "textValue" : q.type + "Value";
  const values = ["textValue", "numberValue", "booleanValue"].filter(k => a[k] !== undefined);
  if (values.some(k => k !== key) || (a.state === "observed" && (a[key] === undefined || (q.type === "text" && !a[key].trim())))) errors.push({ path: a.questionId, reason: "observed answers require a substantive correctly typed value" });
  if (["unanswered", "not-applicable"].includes(a.state) && values.length) errors.push({ path: a.questionId, reason: "unanswered/excluded values must be cleared" });
 }
 return errors;
}
export function scoutingReferenceErrors(bundle) {
 const errors = [], fail = reason => errors.push({ path: "scouting", reason });
 const projectId = bundle.projects[0]?.id;
 for (const store of ["scoutAssessments", "scoutAssessmentRevisions", "scoutMedia"]) for (const r of bundle[store] ?? []) if (r.projectId !== projectId) fail("record belongs to another project");
 const revisions = bundle.scoutAssessmentRevisions ?? [], assessments = bundle.scoutAssessments ?? [];
 const pairs = new Set();
 for (const r of revisions) {
  const a = assessments.find(a => a.id === r.assessmentId);
  if (!a || a.locationId !== r.locationId || r.snapshot?.id !== a.id || r.snapshot?.revision !== r.revision || r.snapshot?.projectId !== projectId || r.snapshot?.locationId !== r.locationId) fail("revision ownership/snapshot mismatch");
  const pair = `${r.assessmentId}/${r.revision}`; if (pairs.has(pair)) fail("duplicate assessment revision"); pairs.add(pair);
 }
 for (const a of assessments) if (!revisions.some(r => r.assessmentId === a.id && r.revision === a.revision && JSON.stringify(r.snapshot) === JSON.stringify(a))) fail("current assessment must have an identical immutable snapshot");
 for (const a of [...assessments, ...revisions.map(r => r.snapshot)]) for (const answer of a?.answers ?? []) {
  if (answer.bookmarkId) {
   const b = bundle.bookmarks.find(b => b.id === answer.bookmarkId);
   if (!b || b.projectId !== a.projectId || b.locationId !== a.locationId || (a.captureId && b.captureId !== a.captureId)) fail("bookmark belongs to a different project/location");
  }
  for (const id of answer.mediaIds ?? []) {
   const m = (bundle.scoutMedia ?? []).find(m => m.id === id);
   if (!m || m.projectId !== a.projectId || m.locationId !== a.locationId) fail("media belongs to a different project/location");
  }
 }
 const candidateVersions = [...(bundle.candidates ?? [])];
 for (const scene of bundle.scenes ?? []) for (const decision of scene.decisions ?? []) {
  const chosen = [decision.preferredCandidateId, ...(decision.backupCandidateIds ?? [])];
  if (new Set(chosen).size !== chosen.length || !decision.backupCandidateIds?.length || chosen.some(id => !bundle.candidates.some(c => c.id === id && c.sceneId === scene.id))) fail("decision preferred/backup references must belong to its scene");
  for (const snapshot of decision.candidateSnapshots ?? []) {
   if (validate(candidateRecord, snapshot).errors.length || snapshot.sceneId !== scene.id || snapshot.projectId !== scene.projectId || !bundle.candidates.some(c => c.id === snapshot.id && c.locationId === snapshot.locationId)) fail("invalid decision candidate snapshot");
   candidateVersions.push(snapshot);
  }
 }
 for (const candidate of candidateVersions) for (const e of candidate.evaluations ?? []) if (e.assessmentRevisionId) {
  const r = revisions.find(r => r.id === e.assessmentRevisionId);
  if (!r || r.projectId !== candidate.projectId || r.locationId !== candidate.locationId || !r.snapshot.answers.some(a => a.questionId === e.questionId)) fail("requirement evidence revision/question does not match candidate");
 }
 if ((bundle.scoutMedia ?? []).reduce((sum, m) => sum + m.size, 0) > MEDIA_TOTAL_LIMIT) fail("project media exceeds 48 MiB limit");
 return errors;
}
