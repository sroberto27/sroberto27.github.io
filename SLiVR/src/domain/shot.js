/**
 * Shot: one editorial entry linked to the objects that produce it.
 *
 * A shot references a camera object rather than copying its pose, so moving the
 * camera in the workspace cannot leave the shot list describing a setup that no
 * longer exists.
 *
 * Lens values follow the optics contract in `spatial/optics.js`: gate
 * dimensions in millimetres, focal length in millimetres, and an aspect ratio
 * that may crop the gate. Field of view is derived, never stored, so it cannot
 * drift away from the lens it came from.
 */

import { defineRecord } from "./schema.js";

export const SHOT_STATUS = Object.freeze(["planned", "approved", "captured", "dropped"]);

export const shotRecord = defineRecord("Shot", {
  id: { type: "workspaceId", kind: "shot", required: true },
  shotSceneId: { type: "workspaceId", kind: "shotScene", required: true },
  variantId: { type: "workspaceId", kind: "variant", required: false },
  cameraObjectId: { type: "workspaceId", kind: "sceneObject", required: false },
  // Position within its variant. Zero is a valid first position.
  order: { type: "number", required: true, integer: true, min: 0 },
  number: { type: "string", required: true, minLength: 1, maxLength: 32 },
  shotType: { type: "string", required: false, maxLength: 64 },
  lens: {
    type: "object",
    required: false,
    fields: {
      focalLengthMm: { type: "number", required: true, exclusiveMin: 0 },
      gateWidthMm: { type: "number", required: true, exclusiveMin: 0 },
      gateHeightMm: { type: "number", required: true, exclusiveMin: 0 },
      gateName: { type: "string", required: false, maxLength: 64 },
    },
  },
  aspectRatio: { type: "number", required: false, exclusiveMin: 0 },
  description: { type: "string", required: false, maxLength: 4000 },
  movement: { type: "string", required: false, maxLength: 1000 },
  estimatedDurationS: { type: "number", required: false, min: 0 },
  status: { type: "enum", values: SHOT_STATUS, required: true },
  notes: { type: "string", required: false, maxLength: 4000 },
  revision: { type: "number", required: true, integer: true, min: 1 },
});
