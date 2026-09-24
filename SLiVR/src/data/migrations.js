/**
 * Workspace database schema and upgrade path.
 *
 * One declaration drives three things: what `idb.js` creates during an upgrade,
 * what `workspace-repo.js` is allowed to write, and what `transfer.js` moves in
 * and out of a file. Keeping them from drifting apart is the point of declaring
 * the stores rather than calling `createObjectStore` in several places.
 *
 * Every store is owned, directly or through a shot scene, by exactly one
 * project. `owner` records that chain so deleting a project can remove its own
 * records and nothing else.
 *
 * The database name and version are supplied by the region configuration. The
 * version here is asserted against it rather than duplicated, because two
 * copies of a schema version eventually disagree.
 */

import { WORKSPACE_SCHEMA_VERSION } from "../domain/versions.js";
import { assessmentRecord, assessmentRevisionRecord, scoutMediaRecord } from "../domain/scout-assessment.js";
import { projectRecord } from "../domain/project.js";
import { sceneRecord } from "../domain/scene-brief.js";
import { candidateRecord } from "../domain/candidate.js";
import { bookmarkRecord } from "../domain/bookmark.js";
import {
  shotSceneRecord,
  sceneObjectRecord,
  pathRecord,
  assetRecord,
} from "../domain/shot-scene.js";
import { shotRecord } from "../domain/shot.js";
import { variantRecord } from "../domain/variant.js";

/**
 * Store definitions for schema version 1.
 *
 * `record` is the validator applied before any write. `meta` has none: it holds
 * single-value bookkeeping entries rather than domain records.
 */
export const WORKSPACE_STORES = Object.freeze({
  meta: {
    keyPath: "key",
    indexes: [],
    record: null,
    owner: null,
    transferred: false,
  },
  projects: {
    keyPath: "id",
    indexes: [{ name: "updatedAt", keyPath: "updatedAt" }],
    record: projectRecord,
    owner: null,
    transferred: true,
  },
  scenes: {
    keyPath: "id",
    indexes: [{ name: "projectId", keyPath: "projectId" }],
    record: sceneRecord,
    owner: { store: "projects", field: "projectId" },
    transferred: true,
  },
  candidates: {
    keyPath: "id",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "sceneId", keyPath: "sceneId" },
      { name: "locationId", keyPath: "locationId" },
      { name: "projectScene", keyPath: ["projectId", "sceneId"] },
    ],
    record: candidateRecord,
    owner: { store: "projects", field: "projectId" },
    transferred: true,
  },
  ...Object.fromEntries([["scoutAssessments", assessmentRecord], ["scoutAssessmentRevisions", assessmentRevisionRecord], ["scoutMedia", scoutMediaRecord]].map(([name, record]) => [name, {
    keyPath: "id", indexes: [{ name: "projectId", keyPath: "projectId" }, { name: "locationId", keyPath: "locationId" }], record, owner: { store: "projects", field: "projectId" }, transferred: true
  }])),
  bookmarks: {
    keyPath: "id",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "locationId", keyPath: "locationId" },
      { name: "captureId", keyPath: "captureId" },
      { name: "candidateId", keyPath: "candidateId" },
    ],
    record: bookmarkRecord,
    owner: { store: "projects", field: "projectId" },
    transferred: true,
  },
  shotScenes: {
    keyPath: "id",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "sceneId", keyPath: "sceneId" },
      { name: "candidateId", keyPath: "candidateId" },
      { name: "locationId", keyPath: "locationId" },
    ],
    record: shotSceneRecord,
    owner: { store: "projects", field: "projectId" },
    transferred: true,
  },
  sceneObjects: {
    keyPath: "id",
    indexes: [
      { name: "shotSceneId", keyPath: "shotSceneId" },
      { name: "shotSceneType", keyPath: ["shotSceneId", "type"] },
    ],
    record: sceneObjectRecord,
    owner: { store: "shotScenes", field: "shotSceneId" },
    transferred: true,
  },
  paths: {
    keyPath: "id",
    indexes: [
      { name: "shotSceneId", keyPath: "shotSceneId" },
      { name: "ownerObjectId", keyPath: "ownerObjectId" },
    ],
    record: pathRecord,
    owner: { store: "shotScenes", field: "shotSceneId" },
    transferred: true,
  },
  shots: {
    keyPath: "id",
    indexes: [
      { name: "shotSceneId", keyPath: "shotSceneId" },
      { name: "variantId", keyPath: "variantId" },
      { name: "order", keyPath: "order" },
    ],
    record: shotRecord,
    owner: { store: "shotScenes", field: "shotSceneId" },
    transferred: true,
  },
  variants: {
    keyPath: "id",
    indexes: [{ name: "shotSceneId", keyPath: "shotSceneId" }],
    record: variantRecord,
    owner: { store: "shotScenes", field: "shotSceneId" },
    transferred: true,
  },
  assets: {
    keyPath: "id",
    indexes: [{ name: "shotSceneId", keyPath: "shotSceneId" }],
    record: assetRecord,
    owner: { store: "shotScenes", field: "shotSceneId" },
    transferred: true,
  },
});

export const WORKSPACE_SCHEMA = Object.freeze({
  version: WORKSPACE_SCHEMA_VERSION,
  stores: WORKSPACE_STORES,
});

/** Stores carried by a project export, in write order. */
export const TRANSFERRED_STORES = Object.freeze(
  Object.entries(WORKSPACE_STORES)
    .filter(([, definition]) => definition.transferred)
    .map(([name]) => name),
);

/** Stores whose records hang off a shot scene rather than a project directly. */
export const SHOT_SCENE_OWNED_STORES = Object.freeze(
  Object.entries(WORKSPACE_STORES)
    .filter(([, definition]) => definition.owner?.store === "shotScenes")
    .map(([name]) => name),
);

/**
 * Creates the stores and indexes a given upgrade step is missing.
 *
 * Runs inside the browser upgrade transaction. It only adds what is absent, so
 * reopening an existing database at the same version is a no-op rather than a
 * rebuild that would discard work.
 *
 * @param {IDBDatabase} db
 * @param {IDBTransaction} transaction The upgrade transaction.
 * @param {number} fromVersion 0 for a database that did not exist.
 */
export function applyMigrations(db, transaction, fromVersion) {
  if (fromVersion >= WORKSPACE_SCHEMA.version) return;

  for (const [name, definition] of Object.entries(WORKSPACE_STORES)) {
    const store = db.objectStoreNames.contains(name)
      ? transaction.objectStore(name)
      : db.createObjectStore(name, { keyPath: definition.keyPath });

    for (const index of definition.indexes) {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options ?? {});
      }
    }
  }
}

/**
 * Confirms the configured storage identity matches this schema.
 *
 * The origin also serves neighbouring applications, so a database name outside
 * the SLiVR namespace is a defect worth refusing to open rather than a warning.
 */
export function assertStorageConfig({ databaseName, databaseVersion, keyPrefix }) {
  const problems = [];
  if (typeof databaseName !== "string" || !databaseName.startsWith("slivr-")) {
    problems.push(`database name "${databaseName}" is outside the slivr- namespace`);
  }
  if (databaseVersion !== WORKSPACE_SCHEMA.version) {
    problems.push(
      `configured database version ${databaseVersion} does not match schema version ${WORKSPACE_SCHEMA.version}`,
    );
  }
  if (keyPrefix !== undefined && keyPrefix !== "slivr:") {
    problems.push(`storage key prefix "${keyPrefix}" is outside the slivr: namespace`);
  }
  return { ok: problems.length === 0, problems };
}
