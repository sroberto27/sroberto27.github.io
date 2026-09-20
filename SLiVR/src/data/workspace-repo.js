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

import { validate, formatErrors } from "../domain/schema.js";
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
  return validate(definition.record, record);
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
    assertValid(storeName, record);
    return write([storeName], (stores) => putIfNewer(stores[storeName], storeName, record));
  }

  /** Reads a project and everything it owns. Returns null when absent. */
  async function loadProjectBundle(projectId) {
    return read(TRANSFERRED_STORES, async (stores) => {
      const project = await get(stores.projects, projectId);
      if (!project) return null;

      const bundle = emptyBundle();
      bundle.projects = [project];
      for (const storeName of ["scenes", "candidates", "bookmarks", "shotScenes"]) {
        bundle[storeName] = await getAllByIndex(stores[storeName], "projectId", projectId);
      }
      for (const shotScene of bundle.shotScenes) {
        for (const storeName of ["sceneObjects", "paths", "shots", "variants", "assets"]) {
          const owned = await getAllByIndex(stores[storeName], "shotSceneId", shotScene.id);
          bundle[storeName].push(...owned);
        }
      }
      return bundle;
    });
  }

  async function collectOwnedKeys(stores, projectId) {
    const keys = [];
    for (const storeName of ["scenes", "candidates", "bookmarks"]) {
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
  async function deleteProject(projectId) {
    return write(TRANSFERRED_STORES, async (stores) => {
      const project = await get(stores.projects, projectId);
      if (!project) return { deleted: false };
      for (const [storeName, key] of await collectOwnedKeys(stores, projectId)) {
        await remove(stores[storeName], key);
      }
      await remove(stores.projects, projectId);
      return { deleted: true };
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
    for (const storeName of TRANSFERRED_STORES) {
      for (const record of bundle[storeName] ?? []) assertValid(storeName, record);
    }

    return write(TRANSFERRED_STORES, async (stores) => {
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
    loadProjectBundle,
    writeProjectBundle,
    deleteProject,
    existingProjectIds,
  };
}

export { StorageError, IDB_ERROR_CODES };
