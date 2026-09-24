import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";
import { projectFixture, FIXTURE_IDS } from "./fixtures/project.mjs";
import {
  WORKSPACE_SCHEMA,
  WORKSPACE_STORES,
  TRANSFERRED_STORES,
  assertStorageConfig,
} from "../src/data/migrations.js";
import { createWorkspaceRepo, emptyBundle } from "../src/data/workspace-repo.js";
import { WORKSPACE_SCHEMA_VERSION } from "../src/domain/versions.js";

const region = JSON.parse(
  readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url), "utf8"),
);

async function openRepo() {
  const fake = createFakeIndexedDB();
  const repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  await repo.open();
  return { repo, fake };
}

// ---- Test 16: the declared database, stores and indexes -------------------

test("the workspace schema declares exactly the approved stores", () => {
  assert.deepEqual(Object.keys(WORKSPACE_STORES), [
    "meta",
    "projects",
    "scenes",
    "candidates",
    "scoutAssessments", "scoutAssessmentRevisions", "scoutMedia",
    "bookmarks",
    "shotScenes",
    "sceneObjects",
    "paths",
    "shots",
    "variants",
    "assets",
  ]);
  assert.equal(WORKSPACE_SCHEMA.version, WORKSPACE_SCHEMA_VERSION);
  assert.equal(WORKSPACE_SCHEMA.version, region.storage.databaseVersion);
});

test("each store declares the approved indexes", () => {
  const indexes = Object.fromEntries(
    Object.entries(WORKSPACE_STORES).map(([name, definition]) => [
      name,
      definition.indexes.map((index) => index.name),
    ]),
  );
  assert.deepEqual(indexes.meta, []);
  assert.deepEqual(indexes.projects, ["updatedAt"]);
  assert.deepEqual(indexes.scenes, ["projectId"]);
  assert.deepEqual(indexes.candidates, ["projectId", "sceneId", "locationId", "projectScene"]);
  assert.deepEqual(indexes.bookmarks, ["projectId", "locationId", "captureId", "candidateId"]);
  assert.deepEqual(indexes.shotScenes, ["projectId", "sceneId", "candidateId", "locationId"]);
  assert.deepEqual(indexes.sceneObjects, ["shotSceneId", "shotSceneType"]);
  assert.deepEqual(indexes.paths, ["shotSceneId", "ownerObjectId"]);
  assert.deepEqual(indexes.shots, ["shotSceneId", "variantId", "order"]);
  assert.deepEqual(indexes.variants, ["shotSceneId"]);
  assert.deepEqual(indexes.assets, ["shotSceneId"]);

  // The compound keys the plan names, spelled as compound keys rather than
  // two separate scans.
  assert.deepEqual(WORKSPACE_STORES.candidates.indexes.at(-1).keyPath, ["projectId", "sceneId"]);
  assert.deepEqual(WORKSPACE_STORES.sceneObjects.indexes.at(-1).keyPath, ["shotSceneId", "type"]);
});

test("opening creates only the declared database, stores and indexes", async () => {
  const fake = createFakeIndexedDB();
  const repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  await repo.open();

  assert.deepEqual([...fake.databases.keys()], ["slivr-workspace"]);
  const db = fake.databases.get("slivr-workspace");
  assert.equal(db.version, 2);
  assert.deepEqual([...db._stores.keys()], Object.keys(WORKSPACE_STORES));
  for (const [name, definition] of Object.entries(WORKSPACE_STORES)) {
    assert.deepEqual(
      [...db._stores.get(name)._indexes.keys()],
      definition.indexes.map((index) => index.name),
      name,
    );
  }
  repo.close();
});

test("a database name outside the SLiVR namespace is refused", () => {
  assert.equal(assertStorageConfig(region.storage).ok, true);
  assert.equal(assertStorageConfig({ ...region.storage, databaseName: "workspace" }).ok, false);
  assert.equal(assertStorageConfig({ ...region.storage, keyPrefix: "app:" }).ok, false);
  assert.equal(assertStorageConfig({ ...region.storage, databaseVersion: 7 }).ok, false);
  assert.throws(
    () => createWorkspaceRepo({ factory: {}, storage: { ...region.storage, databaseName: "shared-db" } }),
    /outside the slivr- namespace/,
  );
});

test("reopening at the same version keeps existing records", async () => {
  const fake = createFakeIndexedDB();
  const first = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  await first.open();
  await first.writeProjectBundle(projectFixture());
  first.close();

  const second = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  await second.open();
  const projects = await second.listProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].id, FIXTURE_IDS.project);
});

// ---- Test 17: round trip through storage ---------------------------------

test("a project fixture round-trips with identical IDs and relationships", async () => {
  const { repo } = await openRepo();
  const bundle = projectFixture();
  await repo.writeProjectBundle(bundle);

  const loaded = await repo.loadProjectBundle(FIXTURE_IDS.project);
  assert.ok(loaded, "the project must be readable after the write");

  for (const storeName of TRANSFERRED_STORES) {
    const before = [...bundle[storeName]].map((r) => r.id).sort();
    const after = [...loaded[storeName]].map((r) => r.id).sort();
    assert.deepEqual(after, before, storeName);
  }

  const candidate = loaded.candidates.find((c) => c.id === FIXTURE_IDS.candidateA);
  assert.equal(candidate.sceneId, FIXTURE_IDS.sceneA);
  assert.equal(candidate.locationId, "LOC-001");
  assert.equal(candidate.catalogVersion, "1.0.0");

  const shot = loaded.shots[0];
  assert.equal(shot.variantId, FIXTURE_IDS.variant);
  assert.equal(shot.cameraObjectId, FIXTURE_IDS.camera);

  const path = loaded.paths[0];
  assert.equal(path.ownerObjectId, FIXTURE_IDS.actor);
});

test("zero values survive storage rather than being treated as absent", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const loaded = await repo.loadProjectBundle(FIXTURE_IDS.project);

  const camera = loaded.sceneObjects.find((object) => object.id === FIXTURE_IDS.camera);
  assert.equal(camera.transform.headingDeg, 0);
  assert.equal(camera.transform.x, 0);
  assert.equal(loaded.shots[0].order, 0);
  assert.equal(loaded.shotScenes[0].northOffsetDeg, 0);
  assert.equal(loaded.shotScenes[0].origin.groundElevationM, 0);
  assert.equal(loaded.paths[0].points[0].atS, 0);
});

test("an unknown project reads as absent rather than as an empty project", async () => {
  const { repo } = await openRepo();
  assert.equal(await repo.loadProjectBundle("prj_missing"), null);
  assert.equal(await repo.getProject("prj_missing"), null);
});

test("the session record names the schema, catalog and build", async () => {
  const { repo } = await openRepo();
  await repo.recordSession({
    catalogVersion: "1.0.0",
    appVersion: "0.2.0",
    openedAt: "2026-09-20T00:00:00Z",
  });
  assert.equal(await repo.getMeta("schemaVersion"), 2);
  assert.equal(await repo.getMeta("catalogVersion"), "1.0.0");
  assert.equal(await repo.getMeta("appVersion"), "0.2.0");
  assert.equal(await repo.getMeta("lastOpened"), "2026-09-20T00:00:00Z");
});

// ---- Validation before writing -------------------------------------------

test("an invalid record is rejected before it reaches storage", async () => {
  const { repo } = await openRepo();
  const bundle = projectFixture();
  const broken = { ...bundle.projects[0], status: "in-progress" };

  await assert.rejects(() => repo.saveRecord("projects", broken), (error) => {
    assert.equal(error.code, "workspace-invalid-record");
    assert.deepEqual(error.detail.errors, [
      { path: "status", reason: "must be one of: active, archived" },
    ]);
    return true;
  });

  assert.equal(await repo.getProject(broken.id), null, "nothing may be stored");
});

test("a bundle with one invalid record writes nothing at all", async () => {
  const { repo } = await openRepo();
  const bundle = projectFixture();
  bundle.shots[0] = { ...bundle.shots[0], order: -1 };

  await assert.rejects(() => repo.writeProjectBundle(bundle), /order: must be at least 0/);
  assert.equal(await repo.getProject(FIXTURE_IDS.project), null);
  assert.deepEqual(await repo.listProjects(), []);
});

test("an unknown store is refused", async () => {
  const { repo } = await openRepo();
  await assert.rejects(() => repo.saveRecord("secrets", { id: "x" }), /unknown store: secrets/);
});

// ---- Revision ordering ----------------------------------------------------

test("a completing older write is discarded once the revision has advanced", async () => {
  const { repo } = await openRepo();
  const bundle = projectFixture();
  const project = bundle.projects[0];

  const newer = { ...project, name: "Newer name", revision: 5 };
  await repo.saveRecord("projects", newer);

  const older = { ...project, name: "Older name", revision: 3 };
  const outcome = await repo.saveRecord("projects", older);

  assert.deepEqual(outcome, { written: false, reason: "stale-revision", storedRevision: 5 });
  assert.equal((await repo.getProject(project.id)).name, "Newer name");
});

test("the same or a newer revision is written", async () => {
  const { repo } = await openRepo();
  const project = projectFixture().projects[0];
  await repo.saveRecord("projects", { ...project, revision: 2, name: "Two" });
  assert.deepEqual(await repo.saveRecord("projects", { ...project, revision: 2, name: "Two again" }), {
    written: true,
  });
  assert.deepEqual(await repo.saveRecord("projects", { ...project, revision: 3, name: "Three" }), {
    written: true,
  });
  assert.equal((await repo.getProject(project.id)).name, "Three");
});

// ---- Ownership and deletion ----------------------------------------------

test("deleting a project removes its own records and nothing else", async () => {
  const { repo, fake } = await openRepo();
  const first = projectFixture();
  await repo.writeProjectBundle(first);

  const second = emptyBundle();
  second.projects = [{ ...first.projects[0], id: "prj_00000000-0000-4000-8000-000000000002", name: "Other" }];
  second.scenes = [{ ...first.scenes[0], id: "scn_00000000-0000-4000-8000-000000000009", projectId: second.projects[0].id }];
  await repo.writeProjectBundle(second);

  await repo.deleteProject(FIXTURE_IDS.project);

  assert.equal(await repo.getProject(FIXTURE_IDS.project), null);
  assert.equal(await repo.loadProjectBundle(FIXTURE_IDS.project), null);
  assert.equal((await repo.listProjects()).length, 1);

  const db = fake.databases.get("slivr-workspace");
  for (const storeName of ["scenes", "candidates", "bookmarks", "shotScenes", "sceneObjects", "paths", "shots", "variants"]) {
    const remaining = [...db._stores.get(storeName)._data.values()];
    assert.equal(
      remaining.every((record) => record.projectId !== FIXTURE_IDS.project && record.shotSceneId !== FIXTURE_IDS.shotScene),
      true,
      storeName,
    );
  }
  assert.equal([...db._stores.get("scenes")._data.values()].length, 1, "the other project keeps its scene");
});

test("deleting a project that is not there changes nothing", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  assert.deepEqual(await repo.deleteProject("prj_absent"), { deleted: false });
  assert.equal((await repo.listProjects()).length, 1);
});

// ---- Test 21: storage failure --------------------------------------------

test("a write failure leaves the stored records untouched", async () => {
  const { repo, fake } = await openRepo();
  await repo.writeProjectBundle(projectFixture());

  fake.failWrites(true);
  const project = projectFixture().projects[0];
  await assert.rejects(
    () => repo.saveRecord("projects", { ...project, name: "Renamed", revision: 2 }),
    /simulated write failure/,
  );

  fake.failWrites(false);
  const stored = await repo.getProject(FIXTURE_IDS.project);
  assert.equal(stored.name, "Pilot short — downtown nights");
  assert.equal(stored.revision, 1);
});

test("a failed bundle write aborts without leaving part of it behind", async () => {
  const { repo, fake } = await openRepo();
  fake.failWrites(true);
  await assert.rejects(() => repo.writeProjectBundle(projectFixture()), /simulated write failure/);
  fake.failWrites(false);
  assert.deepEqual(await repo.listProjects(), []);
});

test("the repository reports rather than hides a closed database", async () => {
  const { repo } = await openRepo();
  repo.close();
  await assert.rejects(() => repo.listProjects(), /not open|closed/);
});

test("projects are listed most recently updated first", async () => {
  const { repo } = await openRepo();
  const base = projectFixture().projects[0];
  await repo.saveRecord("projects", { ...base, id: "prj_00000000-0000-4000-8000-000000000001", updatedAt: "2026-09-18T10:00:00.000Z" });
  await repo.saveRecord("projects", { ...base, id: "prj_00000000-0000-4000-8000-000000000002", updatedAt: "2026-09-20T10:00:00.000Z" });
  await repo.saveRecord("projects", { ...base, id: "prj_00000000-0000-4000-8000-000000000003", updatedAt: "2026-09-19T10:00:00.000Z" });
  assert.deepEqual(
    (await repo.listProjects()).map((project) => project.updatedAt),
    ["2026-09-20T10:00:00.000Z", "2026-09-19T10:00:00.000Z", "2026-09-18T10:00:00.000Z"],
  );
});

test("the test double is declared as a double, not as browser evidence", () => {
  // Guards the note that keeps automated and live evidence apart in the
  // verification record.
  const source = readFileSync(fileURLToPath(new URL("./fixtures/indexeddb.mjs", import.meta.url)), "utf8");
  assert.match(source, /test double, not a conformance implementation/);
});
