/**
 * Bookmark: a saved immersive viewpoint with a note.
 *
 * Which view fields a provider actually reports is unknown until the Phase 0
 * reconnaissance runs, so `view` carries only the fields that were genuinely
 * received and `supportedFields` names them. An absent yaw is recorded as
 * absent; it never becomes zero, which would restore a confidently wrong
 * direction.
 *
 * `adapterCapabilityVersion` records what the adapter could do at the time, so
 * a bookmark that cannot be restored later is explainable rather than broken.
 */

import { defineRecord } from "./schema.js";

/** Check ownership without requiring a retired catalog to remain available. */
export function bookmarkOwnershipErrors(bookmark, project, candidate) {
  const errors = [];
  if (!project || bookmark?.projectId !== project.id) errors.push("Project ownership does not match.");
  if (bookmark?.candidateId && (!candidate || candidate.id !== bookmark.candidateId
      || candidate.projectId !== bookmark.projectId || candidate.locationId !== bookmark.locationId
      || (candidate.captureId && candidate.captureId !== bookmark.captureId))) {
    errors.push("Candidate project, location or capture does not match.");
  }
  return errors;
}

export const bookmarkRecord = defineRecord("Bookmark", {
  id: { type: "workspaceId", kind: "bookmark", required: true },
  projectId: { type: "workspaceId", kind: "project", required: true },
  locationId: { type: "catalogId", kind: "location", required: true },
  captureId: { type: "catalogId", kind: "capture", required: true },
  candidateId: { type: "workspaceId", kind: "candidate", required: false },
  catalogVersion: { type: "string", required: true, minLength: 1 },
  experienceId: { type: "string", required: true, minLength: 1 },
  sweepId: { type: "string", required: true, minLength: 1 },
  view: {
    type: "object",
    required: true,
    allowExtra: true,
    fields: {
      // Angles in degrees. Zero is a real value, so these are optional rather
      // than defaulted, and their presence is declared in supportedFields.
      yawDeg: { type: "number", required: false },
      pitchDeg: { type: "number", required: false },
      fovDeg: { type: "number", required: false, exclusiveMin: 0 },
      x: { type: "number", required: false },
      y: { type: "number", required: false },
    },
  },
  supportedFields: { type: "array", required: true, of: { type: "string", minLength: 1 } },
  name: { type: "string", required: true, minLength: 1, maxLength: 160 },
  note: { type: "string", required: false, maxLength: 4000 },
  createdAt: { type: "isoDate", required: true },
  captureVersionRef: { type: "string", required: true, minLength: 1 },
  adapterCapabilityVersion: { type: "string", required: true, minLength: 1 },
  revision: { type: "number", required: true, integer: true, min: 1 },
});
