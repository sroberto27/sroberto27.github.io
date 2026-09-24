/**
 * Workspace repository: the record API above IndexedDB.
 *
 * Every write is validated against its record definition first, so a structural
 * defect is reported with a field path instead of being stored and discovered
 * later. Writes also carry a `revision`: a slower write that completes after a
 * newer one is discarded rather than allowed to overwrite it, which is what
 * makes debounced autosave safe to add in Phase 3.
 *
 * A project bundle is read and written as a unit in one transaction. That is
 * what lets an import either apply completely or leave the workspace untouched.
 */

import { assessmentErrors, scoutingReferenceErrors } from "../domain/scout-assessment.js";
import { validate, formatErrors } from "../domain/schema.js";
import { bookmarkOwnershipErrors } from "../domain/bookmark.js";
import {
  WORKSPACE_SCHEMA,
  WORKSPACE_STORES,
  TRANSFERRED_STORES,
  assertStorageConfig,
  applyMigrations,
} from "./migrations.js";
import {
  openDatabase,
  runTransaction,
  get,
  getAll,
  getAllByIndex,
  put,
  remove,
  StorageError,
  IDB_ERROR_CODES,
} from "./idb.js";

export const REPO_ERROR_CODES = Object.freeze({
  invalidRecord: "workspace-invalid-record",
  unknownStore: "workspace-unknown-store",
  misconfigured: "workspace-misconfigured",
  notOpen: "workspace-not-open",
});

/** An empty bundle with every transferred store present. */
export function emptyBundle() {
  return Object.fromEntries(TRANSFERRED_STORES.map((name) => [name, []]));
}

/** The project a bundle describes, or null when it carries none. */
export function bundleProject(bundle) {
  return bundle?.projects?.[0] ?? null;
}

export function projectDeletionSummary(bundle) {
  const project = bundleProject(bundle);
  if (!project) return null;
  const counts = Object.fromEntries(TRANSFERRED_STORES.map(name => [name, bundle[name]?.length ?? 0]));
  const token = JSON.stringify(TRANSFERRED_STORES.map(name => [name,
    [...(bundle[name] ?? [])].map(record => [record.id, record.revision ?? null]).sort((a, b) => a[0].localeCompare(b[0]))]));
  return { projectId: project.id, name: project.name, counts, token };
}

function requireStore(storeName) {
  const definition = WORKSPACE_STORES[storeName];
  if (!definition) {
    throw new StorageError(REPO_ERROR_CODES.unknownStore, `unknown store: ${storeName}`);
  }
  return definition;
}

/**
 * Validates a record against its store definition.
 * @returns {{ok: boolean, errors: Array<{path: string, reason: string}>}}
 */
export function validateRecord(storeName, record) {
  const definition = requireStore(storeName);
  if (!definition.record) return { ok: true, errors: [] };
  const clean = storeName === "scoutMedia" ? Object.fromEntries(Object.entries(record ?? {}).filter(([key]) => key !== "blob")) : record;
  const result = validate(definition.record, clean);
  if (storeName === "scoutAssessments") result.errors.push(...assessmentErrors(record));
  if (storeName === "scoutAssessmentRevisions") result.errors.push(...assessmentErrors(record?.snapshot));
  result.ok = result.errors.length === 0;
  if (storeName === "bookmarks" && result.ok) {
    const fields = record.supportedFields;
    if (new Set(fields).size !== fields.length || fields.length !== Object.keys(record.view).length
        || fields.some(field => !Object.hasOwn(record.view, field) || !Number.isFinite(record.view[field]))) {
      result.errors.push({ path: "supportedFields", reason: "must name exactly the finite fields present in view" });
      result.ok = false;
    }
  }
  return result;
}

function assertValid(storeName, record) {
  const { ok, errors } = validateRecord(storeName, record);
  if (!ok) {
    throw new StorageError(
      REPO_ERROR_CODES.invalidRecord,
      `${storeName} record is not valid:\n${formatErrors(errors)}`,
      { detail: { store: storeName, errors } },
    );
  }
}

/**
 * Writes a record unless a newer revision is already stored.
 * @returns {Promise<{written: boolean, reason?: string, storedRevision?: number}>}
 */
async function putIfNewer(store, storeName, record) {
  const existing = await get(store, record[requireStore(storeName).keyPath]);
  if (existing && Number.isFinite(existing.revision) && existing.revision > record.revision) {
    return { written: false, reason: "stale-revision", storedRevision: existing.revision };
  }
  await put(store, record);
  return { written: true };
}

/**
 * @param {object} options
 * @param {IDBFactory} options.factory
 * @param {{databaseName: string, databaseVersion: number, keyPrefix?: string}} options.storage
 *   Storage identity from the region configuration.
 */
export function createWorkspaceRepo({ factory, storage }) {
  const config = assertStorageConfig(storage);
  if (!config.ok) {
    throw new StorageError(
      REPO_ERROR_CODES.misconfigured,
      `workspace storage configuration is unusable: ${config.problems.join("; ")}`,
      { detail: config.problems },
    );
  }

  let db = null;

  function database() {
    if (!db) {
      throw new StorageError(REPO_ERROR_CODES.notOpen, "the workspace database is not open");
    }
    return db;
  }

  async function open() {
    if (db) return db;
    db = await openDatabase({
      factory,
      name: storage.databaseName,
      version: storage.databaseVersion,
      upgrade: applyMigrations,
    });
    return db;
  }

  function close() {
    db?.close();
    db = null;
  }

  async function read(storeNames, body) {
    return runTransaction(database(), storeNames, "readonly", body);
  }

  async function write(storeNames, body) {
    return runTransaction(database(), storeNames, "readwrite", body);
  }

  async function getMeta(key) {
    const entry = await read(["meta"], (stores) => get(stores.meta, key));
    return entry ? entry.value : undefined;
  }

  async function setMeta(key, value) {
    await write(["meta"], (stores) => put(stores.meta, { key, value }));
  }

  /** Records what this build opened, so a later build can recognise the state. */
  async function recordSession({ catalogVersion, appVersion, openedAt }) {
    await write(["meta"], async (stores) => {
      await put(stores.meta, { key: "schemaVersion", value: WORKSPACE_SCHEMA.version });
      await put(stores.meta, { key: "catalogVersion", value: catalogVersion });
      await put(stores.meta, { key: "appVersion", value: appVersion });
      await put(stores.meta, { key: "lastOpened", value: openedAt });
    });
  }

  async function listProjects() {
    const projects = await read(["projects"], (stores) => getAll(stores.projects));
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function getProject(id) {
    return (await read(["projects"], (stores) => get(stores.projects, id))) ?? null;
  }

  async function saveRecord(storeName, record) {
    requireStore(storeName);
    if (["scoutAssessments", "scoutAssessmentRevisions", "scoutMedia"].includes(storeName)) throw new Error("Scouting records require an atomic history/evidence transaction.");
    assertValid(storeName, record);
    if (storeName === "candidates") {
      return write(["candidates", "scenes", "projects"], async stores => {
        await assertCandidateOwner(stores, record);
        const peers = await getAllByIndex(stores.candidates, "projectId", record.projectId);
        if (peers.some(c => c.id !== record.id && c.sceneId === record.sceneId && c.locationId === record.locationId)) {
          throw new StorageError(REPO_ERROR_CODES.invalidRecord, "This scene already has a candidate for that location.");
        }
        const previous = await get(stores.candidates, record.id);
        if (previous && ["projectId", "sceneId", "locationId", "captureId"].some(key => previous[key] !== record[key])) {
          throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Candidate identity cannot change.");
        }
        return putIfNewer(stores.candidates, storeName, record);
      });
    }
    if (storeName === "scenes") {
      return write(["scenes", "projects"], async stores => {
        if (!await get(stores.projects, record.projectId)) throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Scene project is unavailable.");
        const existing = await get(stores.scenes, record.id);
        if (existing && existing.projectId !== record.projectId) throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Scene ownership cannot change.");
        return putIfNewer(stores.scenes, storeName, record);
      });
    }
    if (storeName === "bookmarks") {
      return write(["bookmarks", "projects", "candidates"], async stores => {
        const errors = bookmarkOwnershipErrors(record, await get(stores.projects, record.projectId),
          record.candidateId ? await get(stores.candidates, record.candidateId) : null);
        if (errors.length) throw new StorageError(REPO_ERROR_CODES.invalidRecord, errors.join(" "));
        return putIfNewer(stores.bookmarks, storeName, record);
      });
    }
    return write([storeName], (stores) => putIfNewer(stores[storeName], storeName, record));
  }

  async function assertCandidateOwner(stores, record) {
    const scene = await get(stores.scenes, record.sceneId);
    if (!await get(stores.projects, record.projectId) || scene?.projectId !== record.projectId) {
      throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Candidate scene/project ownership does not match.");
    }
  }

  async function addCandidate(record) {
    assertValid("candidates", record);
    return write(["candidates", "scenes", "projects"], async stores => {
      await assertCandidateOwner(stores, record);
      const existing = (await getAllByIndex(stores.candidates, "projectId", record.projectId))
        .find(c => c.sceneId === record.sceneId && c.locationId === record.locationId);
      if (existing) return { candidate: existing, created: false };
      if (await get(stores.candidates, record.id)) throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Candidate identifier is already in use.");
      await put(stores.candidates, record);
      return { candidate: record, created: true };
    });
  }

  /** Reads a project and everything it owns. Returns null when absent. */
  async function readBundle(stores, projectId) {
      const project = await get(stores.projects, projectId);
      if (!project) return null;

      const bundle = emptyBundle();
      bundle.projects = [project];
      for (const storeName of ["scenes", "candidates", "bookmarks", "shotScenes", "scoutAssessments", "scoutAssessmentRevisions", "scoutMedia"]) {
        bundle[storeName] = await getAllByIndex(stores[storeName], "projectId", projectId);
      }
      for (const shotScene of bundle.shotScenes) {
        for (const storeName of ["sceneObjects", "paths", "shots", "variants", "assets"]) {
          const owned = await getAllByIndex(stores[storeName], "shotSceneId", shotScene.id);
          bundle[storeName].push(...owned);
        }
      }
      return bundle;
  }

  async function loadProjectBundle(projectId) {
    return read(TRANSFERRED_STORES, stores => readBundle(stores, projectId));
  }

  async function collectOwnedKeys(stores, projectId) {
    const keys = [];
    for (const storeName of ["scenes", "candidates", "bookmarks", "scoutAssessments", "scoutAssessmentRevisions", "scoutMedia"]) {
      const records = await getAllByIndex(stores[storeName], "projectId", projectId);
      for (const record of records) keys.push([storeName, record.id]);
    }
    const shotScenes = await getAllByIndex(stores.shotScenes, "projectId", projectId);
    for (const shotScene of shotScenes) {
      for (const storeName of ["sceneObjects", "paths", "shots", "variants", "assets"]) {
        const records = await getAllByIndex(stores[storeName], "shotSceneId", shotScene.id);
        for (const record of records) keys.push([storeName, record.id]);
      }
      keys.push(["shotScenes", shotScene.id]);
    }
    return keys;
  }

  /** Deletes one project and only the records that project owns. */
  async function deleteProject(projectId, { expectedToken = null } = {}) {
    return write(TRANSFERRED_STORES, async (stores) => {
      const project = await get(stores.projects, projectId);
      if (!project) return { deleted: false };
      if (expectedToken !== null && projectDeletionSummary(await readBundle(stores, projectId)).token !== expectedToken) {
        throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Project records changed after review. Cancel and review deletion again.");
      }
      for (const [storeName, key] of await collectOwnedKeys(stores, projectId)) {
        await remove(stores[storeName], key);
      }
      await remove(stores.projects, projectId);
      return { deleted: true };
    });
  }

  async function deleteScene(projectId, sceneId) {
    return write(["scenes", "candidates", "shotScenes"], async stores => {
      const scene = await get(stores.scenes, sceneId);
      if (!scene || scene.projectId !== projectId) throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Scene ownership does not match.");
      const candidates = await getAllByIndex(stores.candidates, "projectId", projectId);
      const shots = await getAllByIndex(stores.shotScenes, "projectId", projectId);
      if ([...candidates, ...shots].some(record => record.sceneId === sceneId)) {
        throw new StorageError(REPO_ERROR_CODES.invalidRecord, "This scene has linked candidates or shot designs. Keep it until those links are explicitly resolved.");
      }
      await remove(stores.scenes, sceneId);
      return { deleted: true };
    });
  }

  async function reorderScenes(projectId, orderedIds, updatedAt) {
    return write(["scenes"], async stores => {
      const scenes = await getAllByIndex(stores.scenes, "projectId", projectId);
      if (new Set(orderedIds).size !== scenes.length || orderedIds.length !== scenes.length
          || scenes.some(scene => !orderedIds.includes(scene.id))) {
        throw new StorageError(REPO_ERROR_CODES.invalidRecord, "Scene list changed; reload before reordering.");
      }
      const ordered = orderedIds.map((id, order) => ({ ...scenes.find(scene => scene.id === id), order }));
      for (const scene of ordered) { scene.revision++; scene.updatedAt = updatedAt; assertValid("scenes", scene); await put(stores.scenes, scene); }
      return ordered;
    });
  }

  /**
   * Writes a whole bundle in one transaction.
   *
   * With `replaceProjectId`, the named project and its owned records are
   * removed first, inside the same transaction, so a replace that fails
   * part-way leaves the original in place.
   */
  async function writeProjectBundle(bundle, { replaceProjectId = null } = {}) {
    const referenceErrors = scoutingReferenceErrors(bundle);
    if (referenceErrors.length) throw new Error(referenceErrors.map(e => e.reason).join("; "));
    for (const storeName of TRANSFERRED_STORES) {
      for (const record of bundle[storeName] ?? []) assertValid(storeName, record);
    }

    return write(TRANSFERRED_STORES, async (stores) => {
      const projectId = bundle.projects[0]?.id;
      for (const name of TRANSFERRED_STORES) for (const record of bundle[name] ?? []) {
        const old = await get(stores[name], record.id);
        if (!old || name === "projects") continue;
        const ownerId = old.projectId ?? (old.shotSceneId ? (await get(stores.shotScenes, old.shotSceneId))?.projectId : null);
        if (ownerId && ownerId !== projectId) throw new Error("An imported record ID belongs to another project. Import a copy with remapped IDs.");
      }
      if (replaceProjectId) {
        const existing = await get(stores.projects, replaceProjectId);
        if (existing) {
          for (const [storeName, key] of await collectOwnedKeys(stores, replaceProjectId)) {
            await remove(stores[storeName], key);
          }
          await remove(stores.projects, replaceProjectId);
        }
      }
      let written = 0;
      for (const storeName of TRANSFERRED_STORES) {
        for (const record of bundle[storeName] ?? []) {
          await put(stores[storeName], record);
          written += 1;
        }
      }
      return { written };
    });
  }

  /** Atomic assessment/evidence changes retain immutable historical snapshots. */
  async function saveScouting(bundle) {
    for (const name of TRANSFERRED_STORES) for (const record of bundle[name] ?? []) assertValid(name, record);
    const errors = scoutingReferenceErrors(bundle);
    if (errors.length) throw new Error(errors.map(e => e.reason).join("; "));
    return write(TRANSFERRED_STORES, async stores => {
      for (const name of TRANSFERRED_STORES) for (const record of bundle[name] ?? []) {
        const old = await get(stores[name], record.id);
        if (old && old.projectId && old.projectId !== record.projectId) throw new Error("Record ownership changed.");
        if (old && ((old.revision > record.revision) ||
            (old.revision === record.revision && JSON.stringify(old) !== JSON.stringify(record)))) throw new Error("Stored revision changed. Export the working copy before reloading.");
        if (old && name === "scoutAssessmentRevisions" && JSON.stringify(old) !== JSON.stringify(record)) throw new Error("Assessment history is immutable.");
        await put(stores[name], record);
      }
      return { written: true };
    });
  }

  /** Project IDs already present, used to classify an import conflict. */
  async function existingProjectIds() {
    const projects = await read(["projects"], (stores) => getAll(stores.projects));
    return new Set(projects.map((project) => project.id));
  }

  return {
    schemaVersion: WORKSPACE_SCHEMA.version,
    databaseName: storage.databaseName,
    open,
    close,
    getMeta,
    setMeta,
    recordSession,
    listProjects,
    getProject,
    saveRecord,
    saveScouting,
    addCandidate,
    loadProjectBundle,
    writeProjectBundle,
    deleteProject,
    deleteScene,
    reorderScenes,
    existingProjectIds,
  };
}

export { StorageError, IDB_ERROR_CODES };
