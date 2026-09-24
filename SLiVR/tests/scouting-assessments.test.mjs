import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createActions, initialState } from "../src/app/actions.js";
import { createStore } from "../src/app/store.js";
import { createSaveStatus } from "../src/app/save-status.js";
import { createWorkspaceRepo } from "../src/data/workspace-repo.js";
import { buildEnvelope, parseEnvelope, importEnvelope, selectAssessmentExport } from "../src/data/transfer.js";
import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";
import { projectFixture } from "./fixtures/project.mjs";
import { completion, SECTIONS, QUESTIONS } from "../src/scouting/assessment-template.js";
import { previewChecklist } from "../src/data/checklist-import.js";
import { assessmentErrors } from "../src/domain/scout-assessment.js";
const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
async function setup() {
 const fake = createFakeIndexedDB(), repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage }), store = createStore(initialState({ indexedDB: true }));
 const actions = createActions({ store, repo, region, saveStatus: createSaveStatus(), router: { navigate() {} }, fetchJson: async path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url))) });
 await actions.initializeCatalog(); await actions.initializeStorage("1.1.0"); const fixture = projectFixture(); await repo.writeProjectBundle(fixture); await actions.openProject(fixture.projects[0].id);
 return { fake, repo, store, actions, fixture };
}
function answer(assessment, id, patch) { return assessment.answers.map(a => a.questionId === id ? { ...a, ...patch } : a); }
const png = { name: "observation.png", type: "image/png", size: 8, arrayBuffer: async () => Uint8Array.of(137,80,78,71,13,10,26,10).buffer };

test("206/207: dated assessments preserve eight sections, typed false/zero and immutable revisions", async () => {
 const { actions, repo, fixture } = await setup();
 const { assessment: a } = await actions.createAssessment(fixture.candidates[0].id);
 assert.equal(SECTIONS.length, 8); assert.equal(a.answers.length, QUESTIONS.length);
 let answers = answer(a, "door-count", { state: "observed", numberValue: 0 }); answers = answers.map(a => a.questionId === "ambient-noise" ? { ...a, state: "observed", booleanValue: false } : a);
 assert.equal((await actions.updateAssessment(a.id, { answers, title: "First room" })).ok, true);
 const bundle = await repo.loadProjectBundle(a.projectId), latest = bundle.scoutAssessments[0];
 assert.equal(completion(latest).observed, 2); assert.equal(bundle.scoutAssessmentRevisions.length, 2);
 assert.equal(bundle.scoutAssessmentRevisions[0].snapshot.title, "Scouting assessment");
 assert.equal((await actions.updateAssessment(a.id, { answers: answer(latest, "window-count", { state: "observed" }) })).ok, false);
 assert.equal((await actions.createAssessment(fixture.candidates[0].id)).ok, true);
 assert.equal((await repo.loadProjectBundle(a.projectId)).scoutAssessments.length, 2);
 await assert.rejects(repo.saveRecord("scoutAssessmentRevisions", bundle.scoutAssessmentRevisions[0]), /atomic/);
 const modified = structuredClone(bundle); modified.scoutAssessmentRevisions[0].snapshot.title = "Changed history";
 await assert.rejects(repo.saveScouting(modified), /revision|immutable/i);
});

test("208/209/210: correct-location bookmark/media evidence survives failure, retry and emergency export", async () => {
 const { actions, repo, fixture, fake } = await setup();
 const { assessment: a } = await actions.createAssessment(fixture.candidates[0].id);
 const b = fixture.bookmarks[0];
 assert.equal((await actions.updateAssessment(a.id, { answers: answer(a, "wide-angle", { bookmarkId: b.id }) })).ok, true);
 assert.equal((await actions.attachMedia(a.id, "wide-angle", png, "photo")).ok, true);
 const latest = actions.getWorkspace().scoutAssessments[0]; assert.equal(latest.answers.find(a => a.questionId === "wide-angle").mediaIds.length, 1);
 assert.equal((await actions.attachMedia(a.id, "video", { ...png, type: "application/pdf" }, "video")).ok, false);
 await new Promise(r => setTimeout(r, 60)); fake.failWrites(true);
 assert.equal((await actions.updateAssessment(a.id, { title: "Recover this" })).ok, false);
 const emergency = parseEnvelope(actions.exportEmergency().text); assert.equal(emergency.ok, true, JSON.stringify(emergency.error)); assert.equal(emergency.envelope.payload.scoutAssessments[0].title, "Recover this");
 assert.equal(emergency.envelope.payload.scoutMedia[0].data.length > 0, true);
 fake.failWrites(false); assert.equal((await actions.retrySave()).ok, true);
 assert.equal((await repo.loadProjectBundle(a.projectId)).scoutAssessments[0].title, "Recover this");
 const { assessment: other } = await actions.createAssessment(fixture.candidates[1].id);
 assert.equal((await actions.updateAssessment(other.id, { answers: answer(other, "wide-angle", { bookmarkId: b.id }) })).ok, false);
});

test("72-76/206: comparison judgments retain exact evidence and decision history", async () => {
 const { actions, fixture, repo } = await setup();
 const c = fixture.candidates[0], { assessment: a } = await actions.createAssessment(c.id);
 await actions.updateAssessment(a.id, { answers: answer(a, "door-count", { state: "observed", numberValue: 0 }) });
 const revision = actions.getWorkspace().scoutAssessmentRevisions.at(-1);
 const evaluation = { requirement: "Room for a two-shot", kind: "mustHave", rating: "concern", note: "Check on site", assessmentRevisionId: revision.id, questionId: "door-count" };
 assert.equal((await actions.evaluateCandidate(c.id, [evaluation])).ok, true);
 const backup = fixture.candidates.find(other => other.sceneId === c.sceneId && other.id !== c.id);
 assert.equal((await actions.decideScene(c.sceneId, { preferredCandidateId: c.id, backupCandidateIds: [backup.id], rationale: "Conditional choice", openQuestions: "Capacity unknown" })).ok, true);
 await actions.updateAssessment(a.id, { title: "Later observations" });
 await actions.reopenDecision(c.sceneId);
 const b = await repo.loadProjectBundle(c.projectId), decision = b.scenes.find(s => s.id === c.sceneId).decisions[0];
 assert.ok(decision.reopenedAt); assert.equal(decision.candidateSnapshots.find(s => s.id === c.id).evaluations[0].assessmentRevisionId, revision.id);
 assert.equal(b.scoutAssessmentRevisions.find(r => r.id === revision.id).snapshot.title, "Scouting assessment");
 assert.throws(() => selectAssessmentExport(b, [], false), /excludes/);
 assert.equal((await actions.evaluateCandidate(c.id, [{ ...evaluation, assessmentRevisionId: "scr_00000000-0000-4000-8000-000000000099" }])).ok, false);
});

test("211/214: complete and data-only media exports, copy import and old-project migration", async () => {
 const { actions, repo, fixture } = await setup(); const { assessment: a } = await actions.createAssessment(fixture.candidates[0].id);
 await actions.attachMedia(a.id, "wide-angle", png, "panorama");
 const parsed = parseEnvelope((await actions.exportProject(a.projectId)).text); assert.equal(parsed.ok, true, JSON.stringify(parsed.error));
 const copied = await importEnvelope({ repo, envelope: parsed.envelope, resolution: "copy", currentCatalogVersion: "1.1.0" });
 assert.equal(copied.ok, true); const copy = await repo.loadProjectBundle(copied.projectId);
 assert.notEqual(copy.scoutAssessments[0].id, a.id); assert.equal(copy.scoutMedia[0].data, parsed.envelope.payload.scoutMedia[0].data);
 assert.equal(copy.scoutAssessmentRevisions[0].snapshot.id, copy.scoutAssessments[0].id);
 const dataOnly = parseEnvelope((await actions.exportProject(a.projectId, { assessmentIds: [a.id], includeMedia: false })).text);
 assert.equal(dataOnly.ok, true); assert.equal(dataOnly.envelope.mediaReport.complete, false); assert.equal(dataOnly.envelope.payload.scoutMedia[0].missing, true);
 const broken = buildEnvelope({ bundle: actions.getWorkspace(), catalogVersion: "1.1.0", exportedAt: new Date().toISOString() }); broken.assetsInline[0].data = "invalid";
 assert.equal(parseEnvelope(JSON.stringify(broken)).ok, false);
 const legacy = buildEnvelope({ bundle: fixture, catalogVersion: "1.0.0", exportedAt: new Date().toISOString() }); legacy.schemaVersion = "1.2.0";
 for (const key of ["scoutAssessments", "scoutAssessmentRevisions", "scoutMedia"]) delete legacy.payload[key];
 assert.equal(parseEnvelope(JSON.stringify(legacy)).ok, true);
});

test("212: legacy preview excludes private fields and requires touched false/zero", async () => {
 const { actions, fixture, repo, fake } = await setup();
 const preview = previewChecklist({ location: { name: "Room", fields: { "door-count": 0, "window-count": 0, "ambient-noise": false, "owner-contact-name": "PRIVATE PERSON", "contact-information": "PRIVATE NUMBER" }, touched: { "door-count": true, "ambient-noise": true }, media: { video: ["legacy-id"] }, rating: 5, status: "approved" } }, { projectId: fixture.projects[0].id, locationId: "LOC-001", catalogVersion: "1.1.0", now: new Date().toISOString() });
 assert.equal(assessmentErrors(preview.assessment).length, 0); assert.equal(completion(preview.assessment).observed, 2);
 assert.deepEqual(preview.report.ambiguousDefaults, ["window-count"]); assert.deepEqual(preview.report.missingMedia, ["legacy-id"]);
 assert.equal(JSON.stringify(preview).includes("PRIVATE"), false);
 const before = actions.getWorkspace(); await new Promise(r => setTimeout(r, 50)); fake.failWrites(true);
 assert.equal((await actions.importChecklistPreview(preview)).ok, false); assert.equal(actions.getWorkspace(), before);
 fake.failWrites(false); assert.equal((await actions.retrySave()).ok, true);
 assert.equal((await repo.loadProjectBundle(fixture.projects[0].id)).scoutAssessments.length, 1);
});

test("78/82/84: linked shot metadata and scoped deletion include assessment/history/media", async () => {
 const { actions, repo, fixture } = await setup();
 const { assessment: a } = await actions.createAssessment(fixture.candidates[0].id); await actions.attachMedia(a.id, "wide-angle", png, "photo");
 const c = fixture.candidates[1]; const linked = await actions.linkShot(c.id); assert.equal(linked.ok, true); assert.equal(linked.shotScene.candidateId, c.id);
 assert.equal((await actions.linkShot(c.id)).shotScene.id, linked.shotScene.id);
 assert.equal(parseEnvelope((await actions.exportProject(a.projectId)).text).ok, true);
 const review = await actions.requestProjectDeletion(a.projectId); assert.equal(review.summary.counts.scoutMedia, 1);
 assert.equal((await actions.deleteProject(a.projectId)).ok, true); assert.equal(await repo.loadProjectBundle(a.projectId), null);
});

test("211: version-one database upgrades additively without rewriting legacy projects", async () => {
 const { WORKSPACE_STORES } = await import("../src/data/migrations.js");
 const { openDatabase, runTransaction, put } = await import("../src/data/idb.js");
 const fake = createFakeIndexedDB(); const fixture = projectFixture();
 const db = await openDatabase({ factory: fake.factory, name: region.storage.databaseName, version: 1, upgrade(old) {
  for (const [name, def] of Object.entries(WORKSPACE_STORES).filter(([name]) => !name.startsWith("scout"))) {
   const store = old.createObjectStore(name, { keyPath: def.keyPath }); for (const i of def.indexes) store.createIndex(i.name, i.keyPath);
  }
 } });
 await runTransaction(db, ["projects"], "readwrite", stores => put(stores.projects, fixture.projects[0])); db.close();
 const repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage }); await repo.open();
 const bundle = await repo.loadProjectBundle(fixture.projects[0].id);
 assert.deepEqual(bundle.projects, fixture.projects); assert.deepEqual(bundle.scoutAssessments, []);
});

test("209: rapid assessment updates commit in order and late media cannot attach to another project", async () => {
 const { actions, fixture, repo } = await setup(); const { assessment: a } = await actions.createAssessment(fixture.candidates[0].id);
 const first = actions.updateAssessment(a.id, { title: "First" }), second = actions.updateAssessment(a.id, { title: "Latest" });
 assert.equal((await first).ok, true); assert.equal((await second).ok, true);
 const b = await repo.loadProjectBundle(a.projectId); assert.equal(b.scoutAssessments[0].title, "Latest"); assert.equal(b.scoutAssessmentRevisions.length, 3);
 let release; const slow = { ...png, arrayBuffer: () => new Promise(resolve => { release = resolve; }) };
 const attaching = actions.attachMedia(a.id, "wide-angle", slow, "photo");
 await actions.createProject("Other project"); release(Uint8Array.of(137,80,78,71,13,10,26,10).buffer);
 assert.equal((await attaching).ok, false); assert.equal(actions.getWorkspace().scoutMedia.length, 0);
});

test("212: supplied legacy ZIP manifest imports owned bytes without source sessions or private fields", async () => {
 const { createRequire } = await import("node:module"); const require = createRequire(import.meta.url);
 const JSZip = require("../vendor/jszip-3.10.1.min.js"); globalThis.JSZip = JSZip;
 const { readLegacyFile } = await import("../src/data/checklist-import.js");
 const zip = new JSZip(); zip.file("Room/data/location.json", JSON.stringify({ name: "Room", fields: { "door-count": 0, "owner-contact-name": "PRIVATE" }, media: { "wide-angle": [{ filename: "photo.png", relativePath: "images/photo.png", sources: [{ sessionId: "excluded" }] }] } }));
 zip.file("Room/images/photo.png", new Uint8Array(await png.arrayBuffer()));
 const bytes = await zip.generateAsync({ type: "uint8array" });
 const parsed = await readLegacyFile({ name: "room.zip", size: bytes.length, arrayBuffer: async () => bytes });
 const preview = previewChecklist(parsed, { projectId: projectFixture().projects[0].id, locationId: "LOC-001", catalogVersion: "1.1.0", now: new Date().toISOString() });
 assert.equal(preview.media.length, 1); assert.equal(preview.report.ambiguousDefaults.includes("door-count"), true); assert.equal(JSON.stringify(preview).includes("PRIVATE"), false);
 delete globalThis.JSZip;
});

test("211/84: import cannot overwrite another project's owned IDs", async () => {
 const { repo, fixture } = await setup();
 const other = structuredClone(fixture), id = "prj_00000000-0000-4000-8000-000000000099";
 other.projects[0].id = id;
 for (const store of ["scenes", "candidates", "bookmarks", "shotScenes"]) for (const record of other[store]) record.projectId = id;
 await assert.rejects(repo.writeProjectBundle(other), /another project/);
 assert.equal(await repo.getProject(id), null);
 assert.equal((await repo.loadProjectBundle(fixture.projects[0].id)).candidates[0].projectId, fixture.projects[0].id);
});
