/**
 * Candidate: a catalog location considered for one scene of one project.
 *
 * The catalog reference is the triple location + capture + catalog version.
 * Keeping the version means a project opened against a newer catalog can say
 * that a fact has moved on, instead of quietly presenting old evidence as
 * current.
 *
 * `missingInfo` is a first-class field rather than an absence. A candidate with
 * unanswered questions must read as unanswered, never as acceptable.
 */

import { defineRecord } from "./schema.js";

export const CANDIDATE_STATUS = Object.freeze([
  "discovered",
  "under-review",
  "withdrawn",
  "considering",
  "shortlisted",
  "preferred",
  "backup",
  "rejected",
]);

export const ASSESSMENT_RESULT = Object.freeze(["met", "notMet", "unknown"]);

const textList = { type: "array", required: true, of: { type: "string", minLength: 1 } };

export const candidateRecord = defineRecord("Candidate", {
  id: { type: "workspaceId", kind: "candidate", required: true },
  projectId: { type: "workspaceId", kind: "project", required: true },
  sceneId: { type: "workspaceId", kind: "scene", required: true },
  locationId: { type: "catalogId", kind: "location", required: true },
  captureId: { type: "catalogId", kind: "capture", required: false },
  catalogVersion: { type: "string", required: true, minLength: 1 },
  status: { type: "enum", values: CANDIDATE_STATUS, required: true },
  addedAt: { type: "isoDate", required: true },
  rationale: { type: "string", required: false, maxLength: 4000 },
  strengths: textList,
  concerns: textList,
  missingInfo: textList,
  requirementAssessments: {
    type: "array",
    required: true,
    of: {
      type: "object",
      fields: {
        requirement: { type: "string", required: true, minLength: 1 },
        kind: { type: "enum", values: ["mustHave", "preferred"], required: true },
        result: { type: "enum", values: ASSESSMENT_RESULT, required: true },
        note: { type: "string", required: false, maxLength: 1000 },
      },
    },
  },
  decisionNotes: { type: "string", required: false, maxLength: 4000 },
  updatedAt: { type: "isoDate", required: true },
  revision: { type: "number", required: true, integer: true, min: 1 },
  workflowVersion: { type: "number", required: false, integer: true, min: 1, max: 2 },
  evaluations: { type: "array", of: { type: "object", allowExtra: false, fields: {
    requirement: { type: "string", required: true, minLength: 1 }, kind: { type: "enum", values: ["mustHave", "preferred", "rejection"], required: true },
    rating: { type: "enum", values: ["strong-fit", "acceptable", "concern", "fails-requirement", "unknown"], required: true }, note: { type: "string", maxLength: 4000 },
    assessmentRevisionId: { type: "workspaceId", kind: "assessmentRevision" }, questionId: { type: "string" }
  } } },
  legacyStatus: { type: "string", required: false, maxLength: 80 },
});

export const REVIEW_STATUSES = ["discovered", "under-review", "shortlisted", "rejected", "withdrawn"];

/** Explicit user edits upgrade workflow vocabulary without rewriting old ratings. */
export function reviseCandidate(candidate, fields, now) {
  const status = fields.status ?? candidate.status;
  if (!REVIEW_STATUSES.includes(status) && status !== candidate.status) throw new Error("Preferred/backup choices require a scene decision.");
  return { ...candidate, ...fields, status,
    ...(REVIEW_STATUSES.includes(status) ? { workflowVersion: 2,
      ...(!candidate.workflowVersion || candidate.workflowVersion === 1 ? { legacyStatus: candidate.legacyStatus ?? candidate.status } : {}) } : {}),
    updatedAt: now, revision: candidate.revision + 1 };
}

export function createCandidate({ id, projectId, scene, location, capture, catalogVersion, now }) {
  return { id, projectId, sceneId: scene.id, locationId: location.id,
    ...(capture ? { captureId: capture.id } : {}), catalogVersion, workflowVersion: 2,
    status: "discovered", addedAt: now, updatedAt: now, revision: 1,
    rationale: "", strengths: [], concerns: [], missingInfo: [...scene.openQuestions],
    requirementAssessments: [
      ...scene.mustHave.map(requirement => ({ requirement, kind: "mustHave", result: "unknown" })),
      ...scene.preferred.map(requirement => ({ requirement, kind: "preferred", result: "unknown" })),
    ] };
}

/** Unmet and unknown requirements, so neither can be averaged away. */
export function unresolvedRequirements(candidate) {
  return candidate.requirementAssessments.filter((a) => a.result !== "met");
}
