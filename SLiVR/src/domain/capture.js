/**
 * Capture record: what the immersive provider actually holds for a location.
 *
 * A capture is not permission to film, evidence of present condition, or proof
 * that every relevant room was recorded. Its date and coverage are frequently
 * unknown, and that state is carried verbatim rather than defaulted.
 *
 * A future candidate has no provider identity at all. The fields are null
 * rather than placeholder strings so that no interface can assemble a tour URL
 * for a place that has never been scanned.
 */

import { defineRecord, validate } from "./schema.js";

export const CAPTURE_STATE = Object.freeze(["current", "future"]);

/** Provider fields that must be present together, or absent together. */
const PROVIDER_FIELDS = Object.freeze(["experienceId", "sweepId", "startX", "startY", "url"]);

export const captureRecord = defineRecord("Capture", {
  id: { type: "catalogId", kind: "capture", required: true },
  locationId: { type: "catalogId", kind: "location", required: true },
  workbookLocationName: { type: "text", required: true },
  state: { type: "enum", values: CAPTURE_STATE, required: true },
  grouping: { type: "text", required: true },
  experienceId: { type: "string", required: false, pattern: /^[a-z0-9]{6,32}$/ },
  sweepId: { type: "string", required: false, pattern: /^[a-z0-9]{8,64}$/ },
  // Supplied entry orientation in the provider frame. Zero is a valid angle,
  // so these are validated as finite numbers rather than for truthiness.
  startX: { type: "number", required: false },
  startY: { type: "number", required: false },
  url: { type: "url", required: false },
  captureDate: { type: "text", required: true },
  coverageNotes: { type: "text", required: true },
  validationStatus: { type: "text", required: true },
});

/**
 * Validates a capture, including the rules the declarative schema cannot
 * express: provider identity is all-or-nothing, and it must agree with state.
 *
 * @param {object} capture
 * @param {{experienceAllowlist?: string[], origin?: string}} [region]
 */
export function validateCapture(capture, region = {}) {
  const { ok, errors } = validate(captureRecord, capture);
  const all = [...errors];
  if (!ok && errors.some((e) => e.path === "state")) return { ok: false, errors: all };

  const present = PROVIDER_FIELDS.filter(
    (field) => capture[field] !== null && capture[field] !== undefined,
  );

  if (capture.state === "current") {
    for (const field of PROVIDER_FIELDS) {
      if (!present.includes(field)) {
        all.push({ path: field, reason: "is required for a current capture" });
      }
    }
    if (region.experienceAllowlist && capture.experienceId) {
      if (!region.experienceAllowlist.includes(capture.experienceId)) {
        all.push({
          path: "experienceId",
          reason: `is not in the region experience allowlist (${capture.experienceId})`,
        });
      }
    }
    if (capture.url && region.origin && !capture.url.startsWith(`${region.origin}/`)) {
      all.push({ path: "url", reason: `must be served from ${region.origin}` });
    }
    if (capture.url && capture.sweepId && !capture.url.includes(capture.sweepId)) {
      all.push({ path: "url", reason: "does not reference its own sweep ID" });
    }
  } else if (present.length > 0) {
    for (const field of present) {
      all.push({
        path: field,
        reason: "must be null for a future candidate, which has no capture",
      });
    }
  }

  return { ok: all.length === 0, errors: all };
}

/**
 * Entry URL for a current capture, or null when nothing has been captured.
 * Never fabricates a URL, and never falls back to the experience root, which
 * would silently open a different place.
 */
export function entryUrl(capture) {
  if (capture.state !== "current" || !capture.experienceId || !capture.sweepId) return null;
  return capture.url ?? null;
}

/** Groups captures by experience, so shared-experience entries stay visible. */
export function groupByExperience(captures) {
  const grouped = new Map();
  for (const capture of captures) {
    if (!capture.experienceId) continue;
    if (!grouped.has(capture.experienceId)) grouped.set(capture.experienceId, []);
    grouped.get(capture.experienceId).push(capture);
  }
  return grouped;
}
