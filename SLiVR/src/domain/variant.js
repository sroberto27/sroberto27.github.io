/**
 * Variant: a named alternative treatment of one shot scene.
 *
 * Variants exist so that exploring a second approach does not overwrite the
 * first. `frameVersion` is copied from the shot scene at creation: a variant
 * authored before a recalibration keeps the frame it was drawn in, and any
 * later migration is an explicit decision rather than a side effect.
 */

import { defineRecord } from "./schema.js";

export const variantRecord = defineRecord("Variant", {
  id: { type: "workspaceId", kind: "variant", required: true },
  shotSceneId: { type: "workspaceId", kind: "shotScene", required: true },
  name: { type: "string", required: true, minLength: 1, maxLength: 160 },
  note: { type: "string", required: false, maxLength: 4000 },
  frameVersion: { type: "number", required: true, integer: true, min: 1 },
  createdAt: { type: "isoDate", required: true },
  revision: { type: "number", required: true, integer: true, min: 1 },
});
