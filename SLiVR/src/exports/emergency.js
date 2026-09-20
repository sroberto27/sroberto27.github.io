/**
 * Emergency export.
 *
 * Runs entirely from the in-memory bundle. It touches no storage, because the
 * situation it exists for is storage refusing to accept a write: quota
 * exhausted, a transaction aborting, or IndexedDB unavailable in this profile.
 *
 * The output is an ordinary project envelope, so recovery is a normal import
 * rather than a special path that has never been exercised. The only difference
 * is the filename and a marker recording why it was produced.
 */

import { buildEnvelope, serializeEnvelope } from "../data/transfer.js";
import { buildFilename } from "./filenames.js";
import { bundleProject } from "../data/workspace-repo.js";

/**
 * Serialises the current in-memory project without reading storage.
 *
 * @param {object} options
 * @param {object} options.bundle Records keyed by store name, held in memory.
 * @param {string} options.catalogVersion
 * @param {string} options.exportedAt ISO timestamp.
 * @param {string} [options.reason] What failed, recorded in the file.
 * @returns {{filename: string, text: string, envelope: object}}
 */
export function buildEmergencyExport({ bundle, catalogVersion, exportedAt, reason = "" }) {
  const envelope = buildEnvelope({ bundle, catalogVersion, exportedAt });
  envelope.emergency = {
    reason: reason || "Local storage did not accept a write.",
    exportedFrom: "in-memory workspace",
  };

  const project = bundleProject(bundle);
  const filename = buildFilename({
    project: project?.name ?? "project",
    suffix: "emergency",
    revision: Number.isInteger(project?.revision) ? project.revision : undefined,
    extension: "json",
    date: exportedAt.slice(0, 10),
  });

  return { filename, text: serializeEnvelope(envelope), envelope };
}

/** Filename for a normal project export. */
export function projectExportFilename(project, exportedAt) {
  return buildFilename({
    project: project?.name ?? "project",
    revision: Number.isInteger(project?.revision) ? project.revision : undefined,
    extension: "json",
    date: exportedAt.slice(0, 10),
  });
}
