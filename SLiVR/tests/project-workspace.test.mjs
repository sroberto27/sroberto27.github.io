import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createActions, initialState } from "../src/app/actions.js";
import { createStore } from "../src/app/store.js";
import { createSaveStatus } from "../src/app/save-status.js";
import { createWorkspaceRepo, projectDeletionSummary } from "../src/data/workspace-repo.js";
import { parseEnvelope } from "../src/data/transfer.js";
import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";
import { projectFixture } from "./fixtures/project.mjs";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
async function setup() {
  const fake = createFakeIndexedDB(), store = createStore(initialState({ indexedDB: true }));
  const repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  const actions = createActions({ store, repo, region, saveStatus: createSaveStatus(), router: { navigate() {} },
    fetchJson: async path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url))) });
  await actions.initializeCatalog(); await actions.initializeStorage("1.1.0");
  const project = await actions.createProject("Production");
  return { fake, store, repo, actions, project };
}
const brief = (number, title) => ({ number, title, intExt: "EXT", dayNight: "UNSPECIFIED", castCount: 0,
  requiredSpaces: ["Doorway"], mustHave: ["Clear access"], openQuestions: ["Permission unknown"] });

test("68/83: project metadata edits retain identity and reject invalid or sensitive fields", async () => {
  const { actions, repo, project } = await setup();
  assert.equal((await actions.updateProject(project.id, { name: "Pilot", productionType: "Short", description: "Two scenes", status: "archived" })).ok, true);
  const saved = await repo.getProject(project.id);
  assert.equal(saved.revision, 2); assert.equal(saved.timeZone, "America/Chicago");
  assert.equal(saved.createdAt, project.createdAt); assert.equal(saved.productionType, "Short");
  assert.equal((await actions.updateProject(project.id, { name: "   " })).ok, false);
  assert.equal((await actions.updateProject(project.id, { accessCode: "private" })).ok, false);
  assert.equal((await repo.getProject(project.id)).revision, 2);
});

test("69/70/82: two scene briefs preserve zero/unknown and independent edits, order and transfer", async () => {
  const { actions, repo, project } = await setup();
  const a = (await actions.saveScene(brief("1", "Arrival"))).scene;
  const b = (await actions.saveScene(brief("2", "Departure"))).scene;
  await actions.saveScene({ title: "Arrival revised", crewSize: 0 }, a.id);
  await actions.moveScene(b.id, -1);
  const bundle = await repo.loadProjectBundle(project.id);
  assert.equal(bundle.scenes.find(s => s.id === a.id).crewSize, 0);
  assert.equal(bundle.scenes.find(s => s.id === b.id).crewSize, undefined);
  assert.equal(bundle.scenes.find(s => s.id === b.id).title, "Departure");
  assert.equal(bundle.scenes.find(s => s.id === b.id).order, 0);
  const parsed = parseEnvelope((await actions.exportProject(project.id)).text);
  assert.equal(parsed.ok, true); assert.deepEqual(parsed.envelope.payload.scenes, bundle.scenes);
  assert.equal((await actions.removeScene(a.id)).ok, true);
  assert.deepEqual((await repo.loadProjectBundle(project.id)).scenes.map(s => s.id), [b.id]);
});

test("69/84: linked scenes cannot be removed or transferred between projects", async () => {
  const { repo } = await setup();
  const bundle = projectFixture(); await repo.writeProjectBundle(bundle);
  await assert.rejects(repo.deleteScene(bundle.projects[0].id, bundle.scenes[0].id), /linked/);
  await assert.rejects(repo.saveRecord("scenes", { ...bundle.scenes[0], projectId: "prj_00000000-0000-4000-8000-000000000099" }), /project/);
  assert.equal((await repo.loadProjectBundle(bundle.projects[0].id)).scenes.length, 2);
});

test("84/227: deletion requires review, cancel is harmless and confirmed deletion is scoped", async () => {
  const { actions, repo, project, store } = await setup();
  await actions.saveScene(brief("1", "Arrival"));
  assert.equal((await actions.deleteProject(project.id)).ok, false);
  const review = await actions.requestProjectDeletion(project.id);
  assert.equal(review.summary.counts.scenes, 1);
  actions.cancelProjectDeletion(); assert.ok(await repo.getProject(project.id));
  const fixture = projectFixture(); await repo.writeProjectBundle(fixture);
  await actions.requestProjectDeletion(project.id);
  assert.equal((await actions.deleteProject(project.id)).ok, true);
  assert.equal(await repo.getProject(project.id), null);
  assert.ok(await repo.getProject(fixture.projects[0].id));
  assert.equal(store.getState().workingBundle, null);
});

test("84/227: failed deletion retains data and retry completes UI cleanup", async () => {
  const { actions, fake, store, repo, project } = await setup();
  await actions.requestProjectDeletion(project.id); fake.failWrites(true);
  assert.equal((await actions.deleteProject(project.id)).ok, false);
  assert.equal(store.getState().workingBundle.projects[0].id, project.id);
  assert.ok(await repo.getProject(project.id));
  fake.failWrites(false); assert.equal((await actions.retrySave()).ok, true);
  assert.equal(store.getState().workingBundle, null); assert.equal(store.getState().pendingDeletion, null);
});

test("84/227: changed deletion review is rejected and cancellation revokes retry", async () => {
  const { actions, repo, project, store } = await setup();
  await actions.requestProjectDeletion(project.id);
  await repo.saveRecord("projects", { ...project, name: "Changed elsewhere", revision: 2 });
  assert.equal((await actions.deleteProject(project.id)).ok, false);
  actions.cancelProjectDeletion();
  assert.equal(store.getState().save.canRetry, false);
  assert.equal((await actions.retrySave()).ok, false);
  assert.ok(await repo.getProject(project.id));
  assert.equal(projectDeletionSummary(await repo.loadProjectBundle(project.id)).name, "Changed elsewhere");
});

test("80/82: failed metadata and scene saves retain emergency data and do not report stale writes saved", async () => {
  const { actions, repo, fake, project, store } = await setup();
  fake.failWrites(true);
  assert.equal((await actions.updateProject(project.id, { name: "Retain draft" })).ok, false);
  assert.equal(parseEnvelope(actions.exportEmergency().text).envelope.payload.projects[0].name, "Retain draft");
  fake.failWrites(false); await actions.retrySave();
  const scene = (await actions.saveScene(brief("1", "Arrival"))).scene;
  await repo.saveRecord("scenes", { ...scene, title: "Newer stored", revision: 99 });
  assert.equal((await actions.saveScene({ title: "Older local" }, scene.id)).ok, false);
  assert.equal(store.getState().save.state, "failed");
  assert.equal((await repo.loadProjectBundle(project.id)).scenes[0].title, "Newer stored");
});

const pause = () => new Promise(resolve => setTimeout(resolve, 80));

test("71/228: adding candidates is idempotent per scene/location and preserves unknown fit", async () => {
  const { actions, repo, project, store } = await setup();
  const a = (await actions.saveScene(brief("1", "Arrival"))).scene;
  const b = (await actions.saveScene(brief("2", "Departure"))).scene;
  const first = await actions.addLocationCandidate(a.id, "LOC-001");
  assert.equal(first.ok, true); assert.equal(first.created, true);
  assert.equal(first.candidate.status, "discovered");
  assert.deepEqual(first.candidate.requirementAssessments, [{ requirement: "Clear access", kind: "mustHave", result: "unknown" }]);
  assert.deepEqual(first.candidate.missingInfo, ["Permission unknown"]);
  assert.equal((await actions.addLocationCandidate(a.id, "LOC-001")).candidate.id, first.candidate.id);
  assert.equal((await actions.addLocationCandidate(b.id, "LOC-001")).ok, true);
  const future = store.getState().catalog.locations.find(l => l.captureStatus !== "current");
  assert.equal((await actions.addLocationCandidate(a.id, future.id)).ok, true);
  assert.equal((await repo.loadProjectBundle(project.id)).candidates.length, 3);
  const duplicated = { ...first.candidate, id: "cnd_00000000-0000-4000-8000-000000000099" };
  assert.equal((await repo.addCandidate(duplicated)).candidate.id, first.candidate.id);
  await assert.rejects(repo.saveRecord("candidates", duplicated), /already has/);
  await assert.rejects(repo.saveRecord("candidates", { ...first.candidate, sceneId: b.id }), /already has|identity/);
  await assert.rejects(repo.addCandidate({ ...first.candidate, projectId: "prj_00000000-0000-4000-8000-000000000099" }), /ownership/);
});

test("71/77/82/228: candidate notes, lifecycle and legacy ratings survive transfer without inferred decisions", async () => {
  const { actions, repo } = await setup();
  const bundle = projectFixture(); await repo.writeProjectBundle(bundle); await actions.openProject(bundle.projects[0].id);
  const original = bundle.candidates[0];
  assert.equal((await actions.updateCandidate(original.id, { rationale: "Review access", concerns: ["Capacity unknown"], status: "under-review" })).ok, true);
  const saved = (await repo.loadProjectBundle(original.projectId)).candidates[0];
  assert.equal(saved.legacyStatus, original.status); assert.equal(saved.workflowVersion, 2);
  assert.deepEqual(saved.requirementAssessments, original.requirementAssessments);
  assert.equal((await actions.updateCandidate(original.id, { status: "preferred" })).ok, false);
  assert.equal((await actions.updateCandidate(original.id, { locationId: "LOC-018" })).ok, false);
  const exported = parseEnvelope((await actions.exportProject(original.projectId)).text);
  assert.equal(exported.ok, true);
  assert.deepEqual(exported.envelope.payload.candidates.find(c => c.id === saved.id), saved);
  exported.envelope.payload.candidates.push({ ...saved, id: "cnd_00000000-0000-4000-8000-000000000099" });
  assert.equal(parseEnvelope(JSON.stringify(exported.envelope)).ok, false);
});

test("80/82/228: failed candidate creation retains emergency data and retry reuses its identity", async () => {
  const { actions, repo, fake, store, project } = await setup();
  const scene = (await actions.saveScene(brief("1", "Arrival"))).scene;
  await pause(); fake.failWrites(true);
  const result = await actions.addLocationCandidate(scene.id, "LOC-001");
  assert.equal(result.ok, false);
  const emergency = parseEnvelope(actions.exportEmergency().text);
  assert.equal(emergency.ok, true); assert.equal(emergency.envelope.payload.candidates[0].id, result.candidate.id);
  assert.equal((await repo.loadProjectBundle(project.id)).candidates.length, 0);
  fake.failWrites(false); assert.equal((await actions.retrySave()).ok, true);
  assert.equal(store.getState().activeCandidateId, result.candidate.id);
  assert.equal((await repo.loadProjectBundle(project.id)).candidates.length, 1);
  fake.failWrites(true);
  assert.equal((await actions.updateCandidate(result.candidate.id, { rationale: "Unstored rationale" })).ok, false);
  assert.equal(parseEnvelope(actions.exportEmergency().text).envelope.payload.candidates[0].rationale, "Unstored rationale");
  fake.failWrites(false); await actions.retrySave();
  assert.equal((await repo.loadProjectBundle(project.id)).candidates[0].rationale, "Unstored rationale");
});

test("71/81/228: active project/scene/candidate survives reload and route changes clear stale context", async () => {
  const { actions, repo, fake, store, project } = await setup();
  const a = (await actions.saveScene(brief("1", "Arrival"))).scene;
  const b = (await actions.saveScene(brief("2", "Departure"))).scene;
  const { candidate } = await actions.addLocationCandidate(a.id, "LOC-001");
  actions.selectCandidate(candidate.id, "immersive"); await pause();
  const reloadStore = createStore(initialState({ indexedDB: true }));
  const reload = createActions({ store: reloadStore, repo, region, saveStatus: createSaveStatus(), router: { navigate() {} } });
  await reload.initializeStorage("1.1.0"); await pause();
  assert.equal(reloadStore.getState().openProjectId, project.id);
  assert.equal(reloadStore.getState().activeSceneId, a.id);
  assert.equal(reloadStore.getState().activeCandidateId, candidate.id);
  assert.equal((await repo.getMeta("workspaceContext")).candidateId, candidate.id);
  actions.applyRoute({ name: "project-scene", params: { projectId: project.id, sceneId: b.id } });
  assert.equal(store.getState().activeSceneId, b.id); assert.equal(store.getState().activeCandidateId, null);
  await actions.removeScene(b.id); assert.equal(store.getState().activeSceneId, null);
  await actions.requestProjectDeletion(project.id); await actions.deleteProject(project.id); await pause();
  assert.deepEqual(await repo.getMeta("workspaceContext"), { projectId: null, sceneId: null, candidateId: null, assessmentId: null, comparisonScroll: {} });
});
