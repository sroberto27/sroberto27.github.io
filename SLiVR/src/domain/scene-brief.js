/**
 * Scene brief: what a scene needs from a location, written before candidates
 * are judged.
 *
 * The requirement lists are kept separate on purpose. A must-have that is not
 * met disqualifies a candidate; a preference does not. Collapsing them into one
 * scored list is what makes an unmet requirement disappear into an average.
 *
 * The brief editor is Phase 3. This definition exists now so the store, the
 * transfer envelope and the conflict rules operate on real records.
 */

import { defineRecord } from "./schema.js";

export const INT_EXT = Object.freeze(["INT", "EXT", "INT/EXT"]);
export const DAY_NIGHT = Object.freeze(["DAY", "NIGHT", "DUSK", "DAWN", "UNSPECIFIED"]);

const textList = { type: "array", required: true, of: { type: "string", minLength: 1 } };

export const sceneRecord = defineRecord("SceneBrief", {
  id: { type: "workspaceId", kind: "scene", required: true },
  projectId: { type: "workspaceId", kind: "project", required: true },
  number: { type: "string", required: true, minLength: 1, maxLength: 32 },
  title: { type: "string", required: true, minLength: 1, maxLength: 200 },
  storyLocation: { type: "string", required: false, maxLength: 200 },
  intExt: { type: "enum", values: INT_EXT, required: true },
  dayNight: { type: "enum", values: DAY_NIGHT, required: true },
  description: { type: "string", required: false, maxLength: 4000 },
  characterNotes: { type: "string", required: false, maxLength: 2000 },
  periodNotes: { type: "string", required: false, maxLength: 2000 },
  requiredSpaces: textList,
  castCount: { type: "number", required: false, integer: true, min: 0 },
  extrasCount: { type: "number", required: false, integer: true, min: 0 },
  vehicles: textList,
  equipment: textList,
  crewSize: { type: "number", required: false, integer: true, min: 0 },
  mustHave: textList,
  preferred: textList,
  rejectionConditions: textList,
  openQuestions: textList,
  notes: { type: "string", required: false, maxLength: 4000 },
  createdAt: { type: "isoDate", required: true },
  updatedAt: { type: "isoDate", required: true },
  revision: { type: "number", required: true, integer: true, min: 1 },
  decisions: { type: "array", of: { type: "object", fields: {
    preferredCandidateId: { type: "workspaceId", kind: "candidate", required: true },
    backupCandidateIds: { type: "array", required: true, of: { type: "workspaceId", kind: "candidate" } },
    rationale: { type: "string", required: true, minLength: 1, maxLength: 4000 }, openQuestions: { type: "string", maxLength: 4000 },
    decidedAt: { type: "isoDate", required: true }, reopenedAt: { type: "isoDate" },
    candidateSnapshots: { type: "array", required: true, of: { type: "object", fields: {} } }
  } } },
  order: { type: "number", required: false, integer: true, min: 0 },
});

export const SCENE_LIST_FIELDS = ["requiredSpaces", "vehicles", "equipment", "mustHave", "preferred", "rejectionConditions", "openQuestions"];

export function createSceneBrief({ id, projectId, now, order, fields }) {
  return { ...Object.fromEntries(SCENE_LIST_FIELDS.map(key => [key, []])), dayNight: "UNSPECIFIED",
    ...fields, id, projectId, createdAt: now, updatedAt: now, revision: 1, order };
}
