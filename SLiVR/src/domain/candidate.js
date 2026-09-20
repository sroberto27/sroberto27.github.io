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
});

/** Unmet and unknown requirements, so neither can be averaged away. */
export function unresolvedRequirements(candidate) {
  return candidate.requirementAssessments.filter((a) => a.result !== "met");
}
