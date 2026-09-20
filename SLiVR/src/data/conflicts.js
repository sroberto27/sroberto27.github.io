/**
 * Import conflict detection and resolution.
 *
 * An import that finds an ID already present has exactly three outcomes, and
 * each one is a deliberate choice rather than a default:
 *
 *   cancel   nothing is written
 *   copy     every workspace ID in the payload is regenerated, references
 *            rewritten consistently, so both projects survive
 *   replace  only the named project and the records it owns are removed
 *
 * Silently merging, or overwriting on the assumption that the newer file wins,
 * is what loses work that nobody agreed to lose.
 *
 * Catalog IDs are never remapped by a copy. The copy still refers to the same
 * real place, and rewriting a location ID would break the join to researched
 * facts.
 */

import { createIdRemapper, isWorkspaceId } from "../domain/ids.js";
import { TRANSFERRED_STORES } from "./migrations.js";

export const RESOLUTIONS = Object.freeze(["cancel", "copy", "replace"]);

/**
 * Reports which payload records collide with what is already stored.
 *
 * @param {object} bundle Payload keyed by store name.
 * @param {Set<string>} existingProjectIds
 * @returns {{hasConflict: boolean, projectId: string|null, existingName?: string}}
 */
export function detectConflicts(bundle, existingProjectIds) {
  const project = bundle?.projects?.[0] ?? null;
  if (!project) return { hasConflict: false, projectId: null };
  return {
    hasConflict: existingProjectIds.has(project.id),
    projectId: project.id,
  };
}

/**
 * Rewrites every workspace ID in a payload, keeping internal references
 * consistent.
 *
 * Walks values rather than named fields, so a reference added in a later phase
 * is remapped without this module having to know about it. Only strings that
 * already look like workspace IDs are touched.
 */
export function copyWithNewIds(bundle) {
  const remapper = createIdRemapper();

  // Seed the mapping from primary keys first, so every reference resolves to
  // the same new ID regardless of the order the records are walked in.
  for (const storeName of TRANSFERRED_STORES) {
    for (const record of bundle[storeName] ?? []) {
      if (isWorkspaceId(record.id)) remapper.remap(record.id);
    }
  }

  const rewrite = (value) => {
    if (typeof value === "string") return remapper.remap(value);
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
    }
    return value;
  };

  const copied = {};
  for (const storeName of TRANSFERRED_STORES) {
    copied[storeName] = (bundle[storeName] ?? []).map((record) => rewrite(record));
  }
  return { bundle: copied, mapping: new Map(remapper.mapping) };
}

/**
 * Applies a chosen resolution to a payload.
 *
 * @returns {{action: "none"}|{action: "write", bundle: object, replaceProjectId: string|null, mapping?: Map<string,string>}}
 */
export function applyResolution(bundle, resolution) {
  if (!RESOLUTIONS.includes(resolution)) {
    throw new RangeError(`unknown import resolution: ${resolution}`);
  }
  if (resolution === "cancel") return { action: "none" };
  if (resolution === "copy") {
    const { bundle: copied, mapping } = copyWithNewIds(bundle);
    return { action: "write", bundle: copied, replaceProjectId: null, mapping };
  }
  return {
    action: "write",
    bundle,
    replaceProjectId: bundle?.projects?.[0]?.id ?? null,
  };
}
