import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEntryBookmark, bookmarkRestoration, ENTRY_BOOKMARK_VERSION } from "../src/immersive/bookmarks.js";
import { createActions, initialState } from "../src/app/actions.js";
import { createStore } from "../src/app/store.js";
import { createSaveStatus } from "../src/app/save-status.js";
import { createWorkspaceRepo, validateRecord } from "../src/data/workspace-repo.js";
import { parseEnvelope, buildEnvelope, validatePayload } from "../src/data/transfer.js";
import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";
import { projectFixture, fixedId } from "./fixtures/project.mjs";

const region = JSON.parse(readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url)));
async function setup() {
  const fake = createFakeIndexedDB();
  const repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  const store = createStore(initialState({ indexedDB: true }));
  const routes = [];
  const actions = createActions({ store, repo, region, saveStatus: createSaveStatus(),
    router: { navigate: route => routes.push(route) },
    fetchJson: async path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url))) });
  await actions.initializeCatalog(); await actions.initializeStorage("1.1.0");
  const project = await actions.createProject("Bookmark acceptance");
  return { fake, repo, store, actions, routes, project };
}

test("60/61/208: entry bookmark keeps identity through repository reload and JSON transfer", async () => {
  const { repo, store, actions, project } = await setup();
  const saved = await actions.saveEntryBookmark({ locationId: "LOC-009", name: "Magnolia entrance", note: "Check access on site" });
  assert.equal(saved.ok, true);
  const bookmark = saved.bookmark;
  assert.equal(bookmark.projectId, project.id);
  assert.equal(bookmark.captureId, "CAP-009");
  assert.equal(bookmark.adapterCapabilityVersion, ENTRY_BOOKMARK_VERSION);
  assert.deepEqual(bookmark.view, {}); assert.deepEqual(bookmark.supportedFields, []);
  assert.equal(bookmark.captureVersionRef, "catalog-1.1.0/CAP-009");
  repo.close(); await repo.open();
  const reloaded = await repo.loadProjectBundle(project.id);
  assert.deepEqual(reloaded.bookmarks, [bookmark]);
  const exported = await actions.exportProject(project.id);
  const parsed = parseEnvelope(exported.text); assert.equal(parsed.ok, true);
  const other = await setup();
  assert.equal((await other.actions.importFile(exported.text)).ok, true);
  assert.deepEqual((await other.repo.loadProjectBundle(project.id)).bookmarks, [bookmark]);
  assert.equal(bookmarkRestoration(bookmark, reloaded, store.getState().catalog).ok, true);
  assert.equal(actions.restoreBookmark(bookmark.id).ok, true);
  assert.equal(store.getState().bookmarkStatus.startsWith("Entry restore requested."), true);
});

test("62: retired identity and unverified view remain preserved without misleading restore", async () => {
  const { actions, store } = await setup();
  const { bookmark } = await actions.saveEntryBookmark({ locationId: "LOC-001", name: "Door", note: "retain me" });
  const { catalog, workingBundle } = store.getState();
  const retired = { ...catalog, captures: catalog.captures.filter(c => c.id !== bookmark.captureId) };
  assert.match(bookmarkRestoration(bookmark, workingBundle, retired).message, /retired/);
  const changed = { ...bookmark, sweepId: "retired-sweep" };
  assert.equal(bookmarkRestoration(changed, workingBundle, catalog).ok, false);
  const legacy = { ...bookmark, view: { yawDeg: 0 }, supportedFields: ["yawDeg"], adapterCapabilityVersion: "unverified-0" };
  assert.match(bookmarkRestoration(legacy, workingBundle, catalog).message, /unverified/);
  assert.equal(legacy.view.yawDeg, 0);
  const newer = { ...catalog, version: "1.2.0" };
  assert.match(bookmarkRestoration(bookmark, workingBundle, newer).message, /Saved against catalog 1.1.0/);
  assert.equal(bookmark.note, "retain me");
});

test("60/62: failed write retains bookmark in normal and emergency export and retries once", async () => {
  const { actions, store, fake, repo, project } = await setup();
  fake.failWrites(true);
  const saved = await actions.saveEntryBookmark({ locationId: "LOC-011", name: "Moncus", note: "keep after failure" });
  assert.equal(saved.ok, false); assert.equal(store.getState().save.state, "failed");
  assert.equal(parseEnvelope((await actions.exportProject(project.id)).text).envelope.payload.bookmarks.length, 1);
  assert.equal(parseEnvelope(actions.exportEmergency().text).envelope.payload.bookmarks[0].note, "keep after failure");
  assert.equal((await actions.saveEntryBookmark({ locationId: "LOC-001", name: "Another" })).ok, false);
  assert.equal(await actions.createProject("Do not discard"), null);
  fake.failWrites(false); assert.equal((await actions.retrySave()).ok, true);
  assert.equal((await repo.loadProjectBundle(project.id)).bookmarks.length, 1);
});

test("208: cross-location candidate ownership and current catalog mismatch reject atomically", async () => {
  const { actions, store, repo } = await setup();
  const bundle = projectFixture({ catalogVersion: "1.1.0" });
  const bookmark = bundle.bookmarks[0];
  bookmark.candidateId = bundle.candidates[1].id;
  assert.equal(validatePayload(bundle).ok, false);
  await assert.rejects(repo.saveRecord("bookmarks", bookmark), /ownership|Candidate/);
  bookmark.candidateId = bundle.candidates[0].id;
  bookmark.experienceId = "wrong-experience";
  const text = JSON.stringify(buildEnvelope({ bundle, catalogVersion: "1.1.0", exportedAt: "2026-09-22" }));
  assert.equal((await actions.importFile(text)).ok, false);
  assert.equal(await repo.getProject(bundle.projects[0].id), null);
  const capture = store.getState().catalog.captures.find(c => c.id === "CAP-001");
  const result = createEntryBookmark({ id: fixedId("bkm", 8), project: bundle.projects[0], candidate: bundle.candidates[1],
    catalog: store.getState().catalog, capture, name: "Wrong owner", now: "2026-09-22" });
  assert.equal(result.ok, false);
});

test("60/62: supported view fields preserve zeros and reject missing, nonfinite or undeclared values", () => {
  const bookmark = projectFixture().bookmarks[0];
  bookmark.view = { yawDeg: 0, pitchDeg: 0 }; bookmark.supportedFields = ["yawDeg", "pitchDeg"];
  assert.equal(validateRecord("bookmarks", bookmark).ok, true);
  bookmark.supportedFields = ["yawDeg"]; assert.equal(validateRecord("bookmarks", bookmark).ok, false);
  bookmark.supportedFields = ["yawDeg", "pitchDeg"]; bookmark.view.pitchDeg = Infinity;
  assert.equal(validateRecord("bookmarks", bookmark).ok, false);
});

test("61: replacing an imported project refreshes the open bookmark bundle", async () => {
  const { actions, store, project } = await setup();
  await actions.saveEntryBookmark({ locationId: "LOC-001", name: "Original" });
  const exported = JSON.parse((await actions.exportProject(project.id)).text);
  exported.payload.bookmarks[0].name = "Imported revision";
  assert.equal((await actions.importFile(JSON.stringify(exported))).conflict, true);
  assert.equal((await actions.resolveImport("replace")).ok, true);
  assert.equal(store.getState().workingBundle.bookmarks[0].name, "Imported revision");
});

test("60/208: late project loads cannot attach a bookmark to another selected project", async () => {
  const { actions, store, repo, project } = await setup();
  const second = await actions.createProject("Second");
  const load = repo.loadProjectBundle;
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  repo.loadProjectBundle = async id => {
    const bundle = await load(id);
    if (id === project.id) await new Promise(resolve => { release = resolve; entered(); });
    return bundle;
  };
  const slow = actions.openProject(project.id);
  await started;
  await actions.openProject(second.id);
  release(); await slow;
  assert.equal(store.getState().workingBundle.projects[0].id, second.id);
  assert.equal(store.getState().openProjectId, second.id);
});
