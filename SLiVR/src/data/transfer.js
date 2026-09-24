/**
 * Versioned JSON transfer.
 *
 * An export is the user's copy of their own work and the only backup a local
 * prototype can offer, so the envelope states the versions needed to read it
 * back: transfer schema, application build and the catalog the project was
 * assessed against.
 *
 * Import order is fixed: parse, validate the whole envelope, resolve every
 * reference, classify conflicts, and only then write, in one transaction. A
 * file that fails at any step leaves the workspace exactly as it was. A partial
 * import is worse than a refused one, because the damage is invisible.
 *
 * A differing catalog version is reported, not repaired. Catalog facts are read
 * only; an import never rewrites them, and never silently presents a project's
 * older view of a place as current.
 */

import { scoutingReferenceErrors, MEDIA_LIMIT, MEDIA_TOTAL_LIMIT } from "../domain/scout-assessment.js";
import { formatErrors } from "../domain/schema.js";
import {
  APP_VERSION,
  TRANSFER_SCHEMA_VERSION,
  canReadTransferVersion,
  parseVersion,
} from "../domain/versions.js";
import { TRANSFERRED_STORES } from "./migrations.js";
import { validateRecord, emptyBundle, bundleProject } from "./workspace-repo.js";
import { detectConflicts, applyResolution, RESOLUTIONS } from "./conflicts.js";
import { bookmarkOwnershipErrors } from "../domain/bookmark.js";

export const ENVELOPE_KIND = "slivr-project";

export const TRANSFER_ERROR_CODES = Object.freeze({
  invalidJson: "transfer-invalid-json",
  notEnvelope: "transfer-not-an-envelope",
  unsupportedVersion: "transfer-unsupported-schema-version",
  invalidPayload: "transfer-invalid-payload",
  brokenReference: "transfer-broken-reference",
  conflictUnresolved: "transfer-conflict-unresolved",
});

function failure(code, message, problems = []) {
  return { ok: false, error: { code, message, problems } };
}

/**
 * Builds the export envelope for one project bundle.
 *
 * @param {object} options
 * @param {object} options.bundle Records keyed by store name.
 * @param {string} options.catalogVersion Catalog the project was assessed against.
 * @param {string} options.exportedAt ISO timestamp.
 */
export function buildEnvelope({
  bundle,
  catalogVersion,
  exportedAt,
  appVersion = APP_VERSION,
  assetsInline = [],
}) {
  const payload = {};
  for (const storeName of TRANSFERRED_STORES) payload[storeName] = bundle[storeName] ?? [];
  const mediaInline = (payload.scoutMedia ?? []).filter(m => m.data).map(m => ({ assetId: m.id, encoding: "base64", data: m.data }));
  payload.scoutMedia = (payload.scoutMedia ?? []).map(({ data, blob, ...m }) => ({ ...m, missing: !data }));
  return {
    mediaReport: { complete: payload.scoutMedia.every(m => !m.missing), missing: payload.scoutMedia.filter(m => m.missing).map(m => m.id) },
    schemaVersion: TRANSFER_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    catalogVersion,
    kind: ENVELOPE_KIND,
    payload,
    assetsInline: [...assetsInline, ...mediaInline],
  };
}

/** Serialises an envelope with stable key order and readable indentation. */
export function serializeEnvelope(envelope) {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/**
 * Checks every record and every reference in a payload.
 *
 * @returns {{ok: boolean, errors: Array<{path: string, reason: string}>}}
 */
export function validatePayload(payload) {
  const errors = [];
  const error = (path, reason) => errors.push({ path, reason });

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: [{ path: "payload", reason: "must be an object" }] };
  }

  for (const storeName of TRANSFERRED_STORES) {
    const records = payload[storeName];
    if (records === undefined) {
      error(`payload.${storeName}`, "is required");
      continue;
    }
    if (!Array.isArray(records)) {
      error(`payload.${storeName}`, "must be an array");
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const projects = payload.projects;
  if (projects.length !== 1) {
    error("payload.projects", `must contain exactly one project, found ${projects.length}`);
    return { ok: false, errors };
  }

  const ids = new Map();
  for (const storeName of TRANSFERRED_STORES) {
    payload[storeName].forEach((record, index) => {
      const path = `payload.${storeName}[${index}]`;
      const { errors: recordErrors } = validateRecord(storeName, record);
      for (const problem of recordErrors) error(`${path}.${problem.path}`, problem.reason);
      if (record && typeof record.id === "string") {
        if (ids.has(record.id)) error(path, `duplicate id already used by ${ids.get(record.id)}`);
        else ids.set(record.id, path);
      }
    });
  }

  const project = projects[0];
  const idsIn = (storeName) => new Set(payload[storeName].map((record) => record.id));
  const sceneIds = idsIn("scenes");
  const candidateIds = idsIn("candidates");
  const shotSceneIds = idsIn("shotScenes");
  const variantIds = idsIn("variants");
  const objectIds = idsIn("sceneObjects");

  const reference = (storeName, field, allowed, { required = true } = {}) => {
    payload[storeName].forEach((record, index) => {
      const value = record?.[field];
      if (value === undefined || value === null) {
        if (required) error(`payload.${storeName}[${index}].${field}`, "is required");
        return;
      }
      if (!allowed.has(value)) {
        error(`payload.${storeName}[${index}].${field}`, `references a record not in this file: ${value}`);
      }
    });
  };

  // A project file carries exactly one project, so every owned record names
  // it. A design authored outside any project would need its own envelope kind.
  const projectIds = new Set([project?.id]);
  for (const storeName of ["scenes", "candidates", "bookmarks", "shotScenes"]) {
    reference(storeName, "projectId", projectIds);
  }
  reference("candidates", "sceneId", sceneIds);
  const candidateKeys = new Set();
  payload.candidates.forEach((candidate, index) => {
    const key = JSON.stringify([candidate?.projectId, candidate?.sceneId, candidate?.locationId]);
    if (candidateKeys.has(key)) error(`payload.candidates[${index}]`, "duplicates the same project/scene/location relationship");
    candidateKeys.add(key);
    const scene = payload.scenes.find(scene => scene?.id === candidate?.sceneId);
    if (scene && scene.projectId !== candidate.projectId) error(`payload.candidates[${index}]`, "scene belongs to a different project");
  });
  reference("bookmarks", "candidateId", candidateIds, { required: false });
  payload.bookmarks.forEach((bookmark, index) => {
    for (const reason of bookmarkOwnershipErrors(bookmark, project,
      payload.candidates.find(candidate => candidate?.id === bookmark?.candidateId))) {
      error(`payload.bookmarks[${index}]`, reason);
    }
  });
  reference("shotScenes", "sceneId", sceneIds, { required: false });
  reference("shotScenes", "candidateId", candidateIds, { required: false });
  reference("shotScenes", "activeVariantId", variantIds, { required: false });
  for (const storeName of ["sceneObjects", "paths", "shots", "variants", "assets"]) {
    reference(storeName, "shotSceneId", shotSceneIds);
  }
  reference("paths", "ownerObjectId", objectIds);
  reference("shots", "variantId", variantIds, { required: false });
  reference("shots", "cameraObjectId", objectIds, { required: false });

  if (!errors.length) errors.push(...scoutingReferenceErrors(payload));
  return { ok: errors.length === 0, errors };
}

/**
 * Parses and fully validates an exported file.
 *
 * Every rejection names the version or the failing path. "Could not import" on
 * its own leaves the user with no way to tell a corrupted file from one written
 * by a newer build.
 *
 * @param {string} text
 * @returns {{ok: true, envelope: object}|{ok: false, error: {code: string, message: string, problems: Array}}}
 */
export function parseEnvelope(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return failure(
      TRANSFER_ERROR_CODES.invalidJson,
      `The file is not valid JSON: ${cause.message}`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return failure(TRANSFER_ERROR_CODES.notEnvelope, "The file does not contain a SLiVR export.");
  }
  if (parsed.kind !== ENVELOPE_KIND) {
    return failure(
      TRANSFER_ERROR_CODES.notEnvelope,
      `The file is not a SLiVR project export. Its kind is ${JSON.stringify(parsed.kind ?? null)}.`,
    );
  }
  if (!parseVersion(parsed.schemaVersion)) {
    return failure(
      TRANSFER_ERROR_CODES.unsupportedVersion,
      `The file does not declare a readable schema version: ${JSON.stringify(parsed.schemaVersion ?? null)}.`,
    );
  }
  if (!canReadTransferVersion(parsed.schemaVersion)) {
    return failure(
      TRANSFER_ERROR_CODES.unsupportedVersion,
      `This build reads transfer schema ${TRANSFER_SCHEMA_VERSION} and cannot read ${parsed.schemaVersion}. Nothing was changed.`,
    );
  }

  if (parseVersion(parsed.schemaVersion).minor < 3 && parsed.payload) {
    for (const name of ["scoutAssessments", "scoutAssessmentRevisions", "scoutMedia"]) parsed.payload[name] ??= [];
  }
  const { ok, errors } = validatePayload(parsed.payload);
  if (!ok) {
    return failure(
      TRANSFER_ERROR_CODES.invalidPayload,
      `The file has ${errors.length} problem(s) and was not imported:\n${formatErrors(errors)}`,
      errors,
    );
  }

  const inline = parsed.assetsInline ?? [];
  if (!Array.isArray(inline)) {
    return failure(TRANSFER_ERROR_CODES.invalidPayload, "assetsInline must be an array.", [
      { path: "assetsInline", reason: "must be an array" },
    ]);
  }
  const assetIds = new Set([...parsed.payload.assets, ...parsed.payload.scoutMedia].map((asset) => asset.id));
  const orphan = inline.find((entry) => !assetIds.has(entry?.assetId));
  if (orphan) {
    return failure(
      TRANSFER_ERROR_CODES.brokenReference,
      `An inline asset references ${JSON.stringify(orphan?.assetId ?? null)}, which is not in this file.`,
      [{ path: "assetsInline", reason: "references an asset not present in the payload" }],
    );
  }

  const seen = new Set(); let total = 0;
  for (const m of parsed.payload.scoutMedia) {
    const matches = inline.filter(e => e.assetId === m.id);
    if (matches.length > 1) return failure(TRANSFER_ERROR_CODES.invalidPayload, "Duplicate media bytes.");
    const data = matches[0]?.data;
    if (!data) { if (!m.missing) return failure(TRANSFER_ERROR_CODES.invalidPayload, "Media bytes are missing without an explicit missing-media report."); continue; }
    if (matches[0].encoding !== "base64" || data.length > Math.ceil(MEDIA_LIMIT / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) return failure(TRANSFER_ERROR_CODES.invalidPayload, "Invalid or oversized media encoding.");
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0)); total += bytes.length;
    if (bytes.length !== m.size || total > MEDIA_TOTAL_LIMIT) return failure(TRANSFER_ERROR_CODES.invalidPayload, "Media byte size does not match or exceeds project limit.");
    m.data = data; m.blob = new Blob([bytes], { type: m.mime }); m.missing = false; seen.add(m.id);
  }
  return { ok: true, envelope: parsed };
}

/** A note when the file was exported against a different catalog version. */
export function catalogVersionNote(envelope, currentCatalogVersion) {
  if (!envelope.catalogVersion || envelope.catalogVersion === currentCatalogVersion) return null;
  return (
    `This project was assessed against catalog ${envelope.catalogVersion}; ` +
    `this build carries catalog ${currentCatalogVersion}. Location facts may have changed since.`
  );
}

/** Summary shown before an import is confirmed. */
export function describeEnvelope(envelope) {
  const project = bundleProject(envelope.payload);
  return {
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    exportedAt: envelope.exportedAt ?? null,
    appVersion: envelope.appVersion ?? null,
    catalogVersion: envelope.catalogVersion ?? null,
    counts: Object.fromEntries(
      TRANSFERRED_STORES.map((storeName) => [storeName, envelope.payload[storeName].length]),
    ),
  };
}

/**
 * Writes a validated envelope into the workspace.
 *
 * `resolution` is required whenever the project ID already exists; there is no
 * default, because every default would be someone's data loss.
 *
 * @param {object} options
 * @param {object} options.repo Workspace repository.
 * @param {object} options.envelope Result of `parseEnvelope`.
 * @param {"cancel"|"copy"|"replace"} [options.resolution]
 */
export async function importEnvelope({ repo, envelope, resolution = null, currentCatalogVersion }) {
  const existing = await repo.existingProjectIds();
  const conflict = detectConflicts(envelope.payload, existing);

  if (conflict.hasConflict && !resolution) {
    return failure(
      TRANSFER_ERROR_CODES.conflictUnresolved,
      `A project with ID ${conflict.projectId} already exists. Choose cancel, add as copy, or replace.`,
      [{ path: "payload.projects[0].id", reason: "already exists in this workspace" }],
    );
  }

  const chosen = conflict.hasConflict ? resolution : "new";
  if (chosen !== "new" && !RESOLUTIONS.includes(chosen)) {
    return failure(
      TRANSFER_ERROR_CODES.conflictUnresolved,
      `Unknown import resolution: ${chosen}.`,
    );
  }

  const plan =
    chosen === "new"
      ? { action: "write", bundle: envelope.payload, replaceProjectId: null }
      : applyResolution(envelope.payload, chosen);

  if (plan.action === "none") {
    return { ok: true, outcome: "cancelled", written: 0, projectId: null };
  }

  const bundle = emptyBundle();
  for (const storeName of TRANSFERRED_STORES) bundle[storeName] = plan.bundle[storeName] ?? [];

  const { written } = await repo.writeProjectBundle(bundle, {
    replaceProjectId: plan.replaceProjectId,
  });

  return {
    ok: true,
    outcome: chosen === "new" ? "created" : chosen,
    written,
    projectId: bundleProject(bundle)?.id ?? null,
    idMapping: plan.mapping ?? null,
    catalogNote: catalogVersionNote(envelope, currentCatalogVersion),
  };
}

/**
 * Orders records and keys so two bundles can be compared after a round trip.
 * Used to demonstrate that an export and re-import lost nothing.
 */
export function normalizeBundle(bundle) {
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortKeys(value[key])]),
      );
    }
    return value;
  };
  const normalized = {};
  for (const storeName of TRANSFERRED_STORES) {
    normalized[storeName] = [...(bundle[storeName] ?? [])]
      .map(sortKeys)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return normalized;
}

/** Selection never silently removes evidence needed by a decision. */
export function selectAssessmentExport(bundle, assessmentIds, includeMedia = true, mediaIds = null) {
 const selected = new Set(assessmentIds), next = { ...bundle };
 next.scoutAssessments = bundle.scoutAssessments.filter(a => selected.has(a.id));
 next.scoutAssessmentRevisions = bundle.scoutAssessmentRevisions.filter(r => selected.has(r.assessmentId));
 const required = new Set(next.scoutAssessmentRevisions.flatMap(r => r.snapshot.answers.flatMap(a => a.mediaIds)));
 next.scoutMedia = bundle.scoutMedia.filter(m => required.has(m.id)).map(m => includeMedia && (!mediaIds || mediaIds.includes(m.id)) ? m : { ...m, data: undefined, blob: undefined, missing: true });
 const checked = validatePayload(next);
 if (!checked.ok) throw new Error("Selection excludes linked decision/requirement evidence. Include that assessment or explicitly unlink it first.");
 return next;
}
